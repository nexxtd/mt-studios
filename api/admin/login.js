// POST /api/admin/login  { password }  → sets session cookie
import { passwordMatches, sessionCookie } from '../_lib/auth.js';
import { hit, clearHits } from '../_lib/store.js';
import { json, readJson, clientIp, sameOriginJson, handle } from '../_lib/http.js';

const MAX_TRIES = 5, WINDOW = 15 * 60;

export const POST = handle(async req => {
  if (!sameOriginJson(req)) return json({ error: 'Bad request' }, 400);
  const bucket = 'login:' + clientIp(req);
  if ((await hit(bucket, WINDOW)) > MAX_TRIES) return json({ error: 'Too many attempts. Wait 15 minutes.' }, 429);

  const { password } = await readJson(req, 1000);
  if (typeof password !== 'string' || !passwordMatches(password)) {
    await new Promise(r => setTimeout(r, 400)); // slow down guessing
    return json({ error: 'Wrong password' }, 401);
  }
  await clearHits(bucket);
  return json({ ok: true }, 200, { 'Set-Cookie': sessionCookie(req) });
});
