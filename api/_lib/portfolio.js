// Keeps portfolio stats fresh: at most one Roblox refresh per minute, cached in memory
// per server instance, and a total-players sample stored on each refresh for the chart.
import { fetchGames, slugify } from './roblox.js';
import { listGames, saveStats, addSample, listSamples, SEED_UNIVERSES } from './games-store.js';

const STALE_MS = 60_000;
let cache = null; // { at, data }

// Fold fresh Roblox data into stored games; give each a unique, readable slug.
function merge(stored, live) {
  const now = new Date().toISOString(), used = new Set();
  return stored.map(g => {
    const l = live.find(x => x.universeId === g.universeId);
    const name = l?.name || g.name || `Game ${g.universeId}`;
    let slug = slugify(name);
    if (used.has(slug)) slug = `${slug}-${g.universeId}`;
    used.add(slug);
    if (!l) return { ...g, slug, name };
    const { universeId, placeId, name: _n, studio, ...stats } = l;
    return { ...g, slug, name, studio, placeId, stats, statsAt: now };
  });
}

// Public shape: no private admin fields (note, purchase date).
export const toPublic = g => ({
  slug: g.slug, universeId: g.universeId, placeId: g.placeId, name: g.name, studio: g.studio,
  featured: !!g.featured, ...(g.stats || {}),
});

async function loadStored() {
  try { return { games: await listGames(), db: true }; }
  catch (e) {
    // No database yet (or tables not created): still show the launch games, live from Roblox.
    console.warn('games store unavailable, using launch games:', e.message);
    return { games: SEED_UNIVERSES.map((id, i) => ({ universeId: id, position: i, slug: String(id), name: '', stats: null })), db: false };
  }
}

export async function getPortfolio({ force = false } = {}) {
  if (!force && cache && Date.now() - cache.at < 30_000) return cache.data;

  const { games: stored, db } = await loadStored();
  const stale = force || stored.some(g => !g.statsAt || Date.now() - new Date(g.statsAt) > STALE_MS);
  let games = stored, refreshed = false;
  if (stale && stored.length) {
    try {
      games = merge(stored, await fetchGames(stored.map(g => g.universeId)));
      refreshed = true;
    } catch (e) { console.warn('Roblox refresh failed, serving cached stats:', e.message); }
  }

  const visible = games.filter(g => !g.hidden && g.stats);
  const totalPlaying = visible.reduce((a, g) => a + (g.stats.playing || 0), 0);
  let history = [];
  if (db) {
    try {
      if (refreshed) { await saveStats(games.filter(g => g.statsAt)); await addSample(totalPlaying); }
      history = await listSamples();
    } catch (e) { console.warn('could not save stats/history:', e.message); }
  }

  const data = {
    games: visible.map(toPublic),
    totalPlaying,
    history: history.map(r => [new Date(r.t).getTime(), r.total]),
    updatedAt: games.reduce((m, g) => (g.statsAt && g.statsAt > m ? g.statsAt : m), '') || null,
  };
  cache = { at: Date.now(), data };
  return data;
}

export function clearPortfolioCache() { cache = null; }
