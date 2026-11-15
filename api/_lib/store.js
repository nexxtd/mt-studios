// Pitch storage.
// Production: Supabase (Postgres) via its REST API — no SDK needed.
//   Set SUPABASE_URL and SUPABASE_SECRET_KEY in Vercel → Settings → Environment Variables.
//   Create the table once with supabase.sql (Supabase → SQL Editor → paste → Run).
// Local dev without those vars: a JSON file in .data/ (gitignored).
import { promises as fs } from 'node:fs';
import path from 'node:path';

const SB_URL = (process.env.SUPABASE_URL || '').replace(/\/$/, '');
const SB_KEY = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
const TABLE = 'pitches';

export class StoreNotConfigured extends Error {}

function backend() {
  if (SB_URL && SB_KEY) return 'supabase';
  if (process.env.VERCEL) throw new StoreNotConfigured('No database connected');
  return 'file';
}

// ---- Supabase REST ----
async function sb(method, query = '', body, prefer) {
  const headers = { apikey: SB_KEY, 'Content-Type': 'application/json' };
  if (SB_KEY.startsWith('eyJ')) headers.Authorization = `Bearer ${SB_KEY}`; // legacy service_role JWT
  if (prefer) headers.Prefer = prefer;
  const r = await fetch(`${SB_URL}/rest/v1/${TABLE}${query}`, { method, headers, body: body && JSON.stringify(body) });
  const text = await r.text();
  if (!r.ok) throw new Error(`Supabase ${r.status}: ${text.slice(0, 300)}`);
  return text ? JSON.parse(text) : null;
}
// app shape ↔ table row (created_at / updated_at are the table's names for at / updated)
const toRow = ({ at, updated, ...p }) => ({ ...p, created_at: at, updated_at: updated ?? null });
const fromRow = ({ created_at, updated_at, ...r }) => ({ ...r, at: created_at, updated: updated_at || undefined });
const eq = ref => `?ref=eq.${encodeURIComponent(ref)}`;

// ---- local file fallback (dev only) ----
const FILE = path.join(process.cwd(), '.data', 'pitches.json');
async function readFile() {
  try { return JSON.parse(await fs.readFile(FILE, 'utf8')); } catch { return {}; }
}
async function writeFile(obj) {
  await fs.mkdir(path.dirname(FILE), { recursive: true });
  await fs.writeFile(FILE, JSON.stringify(obj, null, 2));
}

// Insert or update (by ref).
export async function savePitch(p) {
  if (backend() === 'supabase') return void await sb('POST', '?on_conflict=ref', toRow(p), 'resolution=merge-duplicates,return=minimal');
  const all = await readFile(); all[p.ref] = p; await writeFile(all);
}

export async function getPitch(ref) {
  if (backend() === 'supabase') { const rows = await sb('GET', eq(ref) + '&select=*'); return rows[0] ? fromRow(rows[0]) : null; }
  return (await readFile())[ref] || null;
}

export async function listPitches() {
  if (backend() === 'supabase') return (await sb('GET', '?select=*&order=created_at.desc')).map(fromRow);
  return Object.values(await readFile()).sort((a, b) => String(b.at).localeCompare(String(a.at)));
}

export async function deletePitch(ref) {
  if (backend() === 'supabase') return void await sb('DELETE', eq(ref));
  const all = await readFile(); delete all[ref]; await writeFile(all);
}

// Best-effort spam limit, kept in memory per server instance (no database needed).
const hits = new Map();
export async function hit(bucket, windowSec) {
  const now = Date.now(), e = hits.get(bucket);
  if (!e || e.until < now) { hits.set(bucket, { n: 1, until: now + windowSec * 1000 }); return 1; }
  return ++e.n;
}
