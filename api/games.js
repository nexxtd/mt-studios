// GET /api/games — public portfolio with live Roblox stats and the last 24h of
// total players. Cached ~30s at the edge so Roblox and the database aren't hammered.
import { getPortfolio } from './_lib/portfolio.js';
import { json, handle } from './_lib/http.js';

export const GET = handle(async () => json(await getPortfolio(), 200, {
  'Cache-Control': 'public, max-age=15, s-maxage=30, stale-while-revalidate=120',
}));
