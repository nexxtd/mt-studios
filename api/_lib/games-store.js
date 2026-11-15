// Portfolio games + player-count history.
// Production: Supabase tables `games` and `ccu_samples` (see supabase.sql).
// Local dev without SUPABASE_* vars: JSON files in .data/ (gitignored).
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { StoreNotConfigured } from './store.js';

const SB_URL = (process.env.SUPABASE_URL || '').replace(/\/$/, '');
const SB_KEY = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

// The games the site launched with; used to seed an empty local store.
export const SEED_UNIVERSES = [10770806914, 10772159183, 10773748361];

function backend() {
  if (SB_URL && SB_KEY) return 'supabase';
  if (process.env.VERCEL) throw new StoreNotConfigured('No database connected');
  return 'file';
}

async function sb(table, method, query = '', body, prefer) {
  const headers = { apikey: SB_KEY, 'Content-Type': 'application/json' };
  if (SB_KEY.startsWith('eyJ')) headers.Authorization = `Bearer ${SB_KEY}`;
  if (prefer) headers.Prefer = prefer;
  const r = await fetch(`${SB_URL}/rest/v1/${table}${query}`, { method, headers, body: body && JSON.stringify(body) });
  const text = await r.text();
  if (!r.ok) throw new Error(`Supabase ${r.status}: ${text.slice(0, 300)}`);
  return text ? JSON.parse(text) : null;
}

// app shape ↔ table row
const toRow = g => ({
  universe_id: g.universeId, place_id: g.placeId ?? null, slug: g.slug, name: g.name, studio: g.studio ?? '',
  acquired_on: g.acquiredOn || null, note: g.note ?? null, featured: !!g.featured, hidden: !!g.hidden,
  position: g.position ?? 0, added_at: g.addedAt, stats: g.stats ?? null, stats_at: g.statsAt ?? null,
});
const fromRow = r => ({
  universeId: Number(r.universe_id), placeId: r.place_id && Number(r.place_id), slug: r.slug, name: r.name, studio: r.studio,
  acquiredOn: r.acquired_on || null, note: r.note || '', featured: !!r.featured, hidden: !!r.hidden,
  position: r.position || 0, addedAt: r.added_at, stats: r.stats || null, statsAt: r.stats_at || null,
});

/* ---------- local file fallback ---------- */
const DIR = path.join(process.cwd(), '.data');
const GAMES_FILE = path.join(DIR, 'games.json'), SAMPLES_FILE = path.join(DIR, 'ccu-samples.json');
async function readJson(file, fallback) { try { return JSON.parse(await fs.readFile(file, 'utf8')); } catch { return fallback; } }
async function writeJson(file, v) { await fs.mkdir(DIR, { recursive: true }); await fs.writeFile(file, JSON.stringify(v, null, 2)); }
async function readGamesFile() {
  const all = await readJson(GAMES_FILE, null);
  if (all) return all;
  const now = new Date().toISOString(), seeded = {};
  SEED_UNIVERSES.forEach((id, i) => { seeded[id] = { universeId: id, slug: String(id), name: '', studio: '', position: i, addedAt: now, stats: null, statsAt: null }; });
  await writeJson(GAMES_FILE, seeded);
  return seeded;
}

/* ---------- games ---------- */
const byOrder = (a, b) => (a.position - b.position) || String(a.addedAt).localeCompare(String(b.addedAt));

export async function listGames() {
  if (backend() === 'supabase') return (await sb('games', 'GET', '?select=*&order=position.asc,added_at.asc')).map(fromRow);
  return Object.values(await readGamesFile()).sort(byOrder);
}

export async function getGame(universeId) {
  if (backend() === 'supabase') {
    const rows = await sb('games', 'GET', `?universe_id=eq.${Number(universeId)}&select=*`);
    return rows[0] ? fromRow(rows[0]) : null;
  }
  return (await readGamesFile())[universeId] || null;
}

export async function saveGame(g) {
  if (backend() === 'supabase') return void await sb('games', 'POST', '?on_conflict=universe_id', toRow(g), 'resolution=merge-duplicates,return=minimal');
  const all = await readGamesFile(); all[g.universeId] = g; await writeJson(GAMES_FILE, all);
}

// Update only the cached Roblox stats for several games at once.
export async function saveStats(list) {
  if (!list.length) return;
  if (backend() === 'supabase') {
    await Promise.all(list.map(g => sb('games', 'PATCH', `?universe_id=eq.${g.universeId}`,
      { stats: g.stats, stats_at: g.statsAt, name: g.name, studio: g.studio, place_id: g.placeId, slug: g.slug }, 'return=minimal')));
    return;
  }
  const all = await readGamesFile();
  for (const g of list) if (all[g.universeId]) Object.assign(all[g.universeId], { stats: g.stats, statsAt: g.statsAt, name: g.name, studio: g.studio, placeId: g.placeId, slug: g.slug });
  await writeJson(GAMES_FILE, all);
}

export async function deleteGame(universeId) {
  if (backend() === 'supabase') return void await sb('games', 'DELETE', `?universe_id=eq.${Number(universeId)}`);
  const all = await readGamesFile(); delete all[universeId]; await writeJson(GAMES_FILE, all);
}

/* ---------- total-players history (for the live chart) ---------- */
const KEEP_MS = 7 * 24 * 3600 * 1000;

export async function addSample(total, at = new Date()) {
  if (backend() === 'supabase') {
    await sb('ccu_samples', 'POST', '', { t: at.toISOString(), total }, 'return=minimal');
    await sb('ccu_samples', 'DELETE', `?t=lt.${new Date(at - KEEP_MS).toISOString()}`); // prune old rows
    return;
  }
  const rows = (await readJson(SAMPLES_FILE, [])).filter(r => at - new Date(r.t) < KEEP_MS);
  rows.push({ t: at.toISOString(), total });
  await writeJson(SAMPLES_FILE, rows);
}

export async function listSamples(sinceMs = 24 * 3600 * 1000) {
  const since = new Date(Date.now() - sinceMs).toISOString();
  if (backend() === 'supabase') return sb('ccu_samples', 'GET', `?t=gte.${since}&select=t,total&order=t.asc`);
  return (await readJson(SAMPLES_FILE, [])).filter(r => r.t >= since);
}
