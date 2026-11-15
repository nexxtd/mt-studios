// Admin auth: password check + signed, HttpOnly session cookie.
// Set ADMIN_PASSWORD (and optionally SESSION_SECRET) in Vercel → Settings → Environment Variables.
import crypto from 'node:crypto';

const COOKIE = 'mt_admin';
const TTL_SEC = 60 * 60 * 8; // 8 hours

// Only a salted scrypt hash of the admin password is stored here, never the password.
// To change it: node -e "const c=require('crypto'),s=c.randomBytes(16).toString('hex');console.log('scrypt:'+s+':'+c.scryptSync('NEW_PASSWORD',s,32).toString('hex'))"
// and paste the output below (or set ADMIN_PASSWORD in Vercel to override it).
const PASSWORD_HASH = 'scrypt:79d4fa4dfc1881a7b330a9dba9cc94be:47f5e0809b6d101c5427f0e2977872e53f883c550d55bc67e04618920ab7071f';

// Secret is derived from the password (hash), so changing the password logs everyone out.
const secret = () => crypto.createHash('sha256')
  .update('mt-admin|' + (process.env.ADMIN_PASSWORD || PASSWORD_HASH) + '|' + (process.env.SESSION_SECRET || '')).digest();

const sha = s => crypto.createHash('sha256').update(String(s)).digest();
export function passwordMatches(input) {
  if (process.env.ADMIN_PASSWORD) return crypto.timingSafeEqual(sha(input), sha(process.env.ADMIN_PASSWORD));
  const [, salt, hash] = PASSWORD_HASH.split(':');
  return crypto.timingSafeEqual(crypto.scryptSync(String(input), salt, 32), Buffer.from(hash, 'hex')); // constant time
}

const sign = payload => crypto.createHmac('sha256', secret()).update(payload).digest('base64url');

export function sessionCookie(req) {
  const exp = Math.floor(Date.now() / 1000) + TTL_SEC;
  const payload = Buffer.from(JSON.stringify({ exp, n: crypto.randomBytes(8).toString('hex') })).toString('base64url');
  return `${COOKIE}=${payload}.${sign(payload)}; ${attrs(req)}; Max-Age=${TTL_SEC}`;
}
export function clearCookie(req) {
  return `${COOKIE}=; ${attrs(req)}; Max-Age=0`;
}
function attrs(req) {
  const secure = new URL(req.url).protocol === 'https:' ? '; Secure' : '';
  return `Path=/api/admin; HttpOnly; SameSite=Strict${secure}`;
}

export function isAuthed(req) {
  const raw = (req.headers.get('cookie') || '').split(/;\s*/).find(c => c.startsWith(COOKIE + '='));
  if (!raw) return false;
  const [payload, sig] = raw.slice(COOKIE.length + 1).split('.');
  if (!payload || !sig) return false;
  const want = Buffer.from(sign(payload)), got = Buffer.from(sig);
  if (want.length !== got.length || !crypto.timingSafeEqual(want, got)) return false;
  try { return JSON.parse(Buffer.from(payload, 'base64url').toString()).exp > Date.now() / 1000; } catch { return false; }
}
