// Pitch storage.
// Production (Vercel): Upstash Redis over its REST API — add the "Upstash for Redis"
// integration in the Vercel dashboard and it sets the env vars below automatically.
// Local dev: a JSON file in .data/ (gitignored).
import { promises as fs } from 'node:fs';
import path from 'node:path';

const REDIS_URL = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
const KEY = 'mt:pitches';

export class StoreNotConfigured extends Error {}

async function redis(...cmd) {
  const r = await fetch(REDIS_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${REDIS_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(cmd),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || j.error) throw new Error('Redis error: ' + (j.error || r.status));
  return j.result;
}

// ---- local file fallback (dev only) ----
const FILE = path.join(process.cwd(), '.data', 'pitches.json');
async function readFile() {
  try { return JSON.parse(await fs.readFile(FILE, 'utf8')); } catch { return {}; }
}
async function writeFile(obj) {
  await fs.mkdir(path.dirname(FILE), { recursive: true });
  await fs.writeFile(FILE, JSON.stringify(obj, null, 2));
}
const local = new Map(); // in-memory counters for rate limiting in dev

function backend() {
  if (REDIS_URL && REDIS_TOKEN) return 'redis';
  if (process.env.VERCEL) throw new StoreNotConfigured('No database connected');
  return 'file';
}

export async function savePitch(p) {
  if (backend() === 'redis') return void await redis('HSET', KEY, p.ref, JSON.stringify(p));
  const all = await readFile(); all[p.ref] = p; await writeFile(all);
}

export async function getPitch(ref) {
  if (backend() === 'redis') { const v = await redis('HGET', KEY, ref); return v ? JSON.parse(v) : null; }
  return (await readFile())[ref] || null;
}

export async function listPitches() {
  let rows;
  if (backend() === 'redis') {
    const flat = (await redis('HGETALL', KEY)) || [];
    rows = [];
    for (let i = 1; i < flat.length; i += 2) { try { rows.push(JSON.parse(flat[i])); } catch { /* skip bad row */ } }
  } else rows = Object.values(await readFile());
  return rows.sort((a, b) => String(b.at).localeCompare(String(a.at)));
}

export async function deletePitch(ref) {
  if (backend() === 'redis') return void await redis('HDEL', KEY, ref);
  const all = await readFile(); delete all[ref]; await writeFile(all);
}

// Fixed-window counter: returns the count after incrementing.
export async function hit(bucket, windowSec) {
  const k = `mt:rl:${bucket}`;
  if (backend() === 'redis') {
    const n = await redis('INCR', k);
    if (n === 1) await redis('EXPIRE', k, windowSec);
    return n;
  }
  const now = Date.now(), e = local.get(k);
  if (!e || e.until < now) { local.set(k, { n: 1, until: now + windowSec * 1000 }); return 1; }
  return ++e.n;
}

export async function clearHits(bucket) {
  const k = `mt:rl:${bucket}`;
  if (backend() === 'redis') return void await redis('DEL', k);
  local.delete(k);
}
