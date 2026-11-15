// /api/admin/games — admin only. Manage the games MT Studios owns / has bought.
//   GET                                                     → all games (incl. hidden + private fields)
//   POST   { input, preview: true }                         → look up a game without saving
//   POST   { input, acquiredOn?, note?, featured? }         → add it to the portfolio
//   PATCH  { universeId, acquiredOn?, note?, featured?, hidden?, position? }
//   DELETE { universeId }
import { isAuthed } from '../_lib/auth.js';
import { resolveUniverse, fetchGames, slugify } from '../_lib/roblox.js';
import { listGames, getGame, saveGame, deleteGame } from '../_lib/games-store.js';
import { getPortfolio, clearPortfolioCache } from '../_lib/portfolio.js';
import { json, readJson, sameOriginJson, handle } from '../_lib/http.js';

const unauthorized = () => json({ error: 'Not signed in' }, 401);
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const cleanDate = v => (v === '' || v == null) ? null : (DATE.test(v) && !isNaN(new Date(v)) ? v : undefined);

export const GET = handle(async req => {
  if (!isAuthed(req)) return unauthorized();
  await getPortfolio().catch(() => {}); // refresh stats if they're stale
  return json({ games: await listGames() });
});

export const POST = handle(async req => {
  if (!isAuthed(req)) return unauthorized();
  if (!sameOriginJson(req)) return json({ error: 'Bad request' }, 400);
  const { input, preview, acquiredOn, note, featured } = await readJson(req);

  const universeId = await resolveUniverse(input);
  const [live] = await fetchGames([universeId]);
  if (!live) return json({ error: 'Roblox didn’t return that game. It may be private or deleted.' }, 404);
  const existing = await getGame(universeId);
  if (preview) return json({ game: live, alreadyAdded: !!existing });
  if (existing) return json({ error: `${live.name} is already in the portfolio.` }, 409);

  const date = cleanDate(acquiredOn);
  if (date === undefined) return json({ error: 'Purchase date must be a valid date.' }, 400);
  const all = await listGames();
  const { universeId: _u, placeId, name, studio, ...stats } = live;
  const game = {
    universeId, placeId, name, studio,
    slug: all.some(g => g.slug === slugify(name)) ? `${slugify(name)}-${universeId}` : slugify(name),
    acquiredOn: date, note: String(note || '').slice(0, 2000), featured: !!featured, hidden: false,
    position: all.reduce((m, g) => Math.max(m, g.position || 0), -1) + 1,
    addedAt: new Date().toISOString(), stats, statsAt: new Date().toISOString(),
  };
  await saveGame(game);
  clearPortfolioCache();
  return json({ game }, 201);
});

export const PATCH = handle(async req => {
  if (!isAuthed(req)) return unauthorized();
  if (!sameOriginJson(req)) return json({ error: 'Bad request' }, 400);
  const { universeId, acquiredOn, note, featured, hidden, position } = await readJson(req);
  const g = await getGame(universeId);
  if (!g) return json({ error: 'Not found' }, 404);
  if (acquiredOn !== undefined) {
    const d = cleanDate(acquiredOn);
    if (d === undefined) return json({ error: 'Purchase date must be a valid date.' }, 400);
    g.acquiredOn = d;
  }
  if (note !== undefined) g.note = String(note).slice(0, 2000);
  if (featured !== undefined) g.featured = !!featured;
  if (hidden !== undefined) g.hidden = !!hidden;
  if (position !== undefined) {
    if (!Number.isInteger(position) || position < 0 || position > 10_000) return json({ error: 'Bad position' }, 400);
    g.position = position;
  }
  await saveGame(g);
  clearPortfolioCache();
  return json({ game: g });
});

export const DELETE = handle(async req => {
  if (!isAuthed(req)) return unauthorized();
  if (!sameOriginJson(req)) return json({ error: 'Bad request' }, 400);
  const { universeId } = await readJson(req);
  if (!(await getGame(universeId))) return json({ error: 'Not found' }, 404);
  await deleteGame(universeId);
  clearPortfolioCache();
  return json({ ok: true });
});
