// Public Roblox web APIs (no key needed). Used server-side only, because browsers
// can't call these endpoints directly (no CORS).

const TIMEOUT = 8000;
const sleep = ms => new Promise(r => setTimeout(r, ms));
// Retries rate limits (429) and Roblox hiccups (5xx) with a short backoff.
async function get(url) {
  for (let attempt = 0; ; attempt++) {
    const r = await fetch(url, { headers: { accept: 'application/json' }, signal: AbortSignal.timeout(TIMEOUT) });
    if (r.ok) return r.json();
    const retryable = r.status === 429 || r.status >= 500;
    if (retryable && attempt < 2) { await sleep(attempt === 0 ? 1200 : 3000); continue; }
    if (r.status === 429) throw Object.assign(new Error('Roblox is busy right now. Try again in a few seconds.'), { status: 503, robloxStatus: 429 });
    throw Object.assign(new Error(`Roblox API ${r.status}`), { robloxStatus: r.status, ...(r.status >= 500 ? { status: 502 } : {}) });
  }
}

// Strip emoji, [tags] and odd characters so names and copy read cleanly.
export const clean = s => String(s || '')
  .replace(/\[[^\]]*\]/g, '')
  .replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}\u{200D}\u{2B00}-\u{2BFF}\u{1F1E6}-\u{1F1FF}]/gu, '')
  .replace(/�/g, '').replace(/[ \t]+/g, ' ').trim();
// Game names: drop [UPD!]-style tags, unless that would leave almost nothing ("[Brick Bronze] PBR").
export const cleanName = s => { const c = clean(s); return c.length > 4 ? c : clean(String(s || '').replace(/[\[\]]/g, ' ')); };
export const slugify = s => cleanName(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'game';

/* ---------- turn whatever the admin pastes into a universe ID ---------- */
// Accepts: roblox.com/games/<placeId>/..., a share link (roblox.com/share?code=...),
// a bare place ID, or a bare universe ID.
export async function resolveUniverse(input) {
  const raw = String(input || '').trim();
  if (!raw) throw bad('Paste a Roblox game link or ID.');
  let url = null;
  try { url = new URL(/^https?:/i.test(raw) ? raw : 'https://' + raw); } catch { /* not a URL */ }

  if (url && /(^|\.)roblox\.com$/i.test(url.hostname)) {
    const m = url.pathname.match(/\/games\/(\d+)/);
    if (m) return universeFromPlace(m[1]);
    const code = url.searchParams.get('code');
    if (/\/share/.test(url.pathname) && code) return universeFromShare(code);
    throw bad('That Roblox link isn’t a game page. Open the game and copy its link.');
  }
  if (/^\d{3,20}$/.test(raw)) {
    // A number can be a place ID *and* a universe ID of two different games (e.g. a real game's
    // universe ID is also some random empty place). Look up both and keep the real one.
    let fromPlace = null;
    try { fromPlace = await universeFromPlace(raw); } catch (e) { if (e.status !== 404) throw e; }
    const ids = [...new Set([fromPlace, Number(raw)].filter(Boolean))];
    const g = await get(`https://games.roblox.com/v1/games?universeIds=${ids.join(',')}`);
    const best = (g.data || []).sort((a, b) => (b.visits || 0) - (a.visits || 0))[0];
    if (best) return Number(best.id);
    throw bad('No Roblox game found with that ID.', 404);
  }
  throw bad('Paste a Roblox game link (roblox.com/games/…) or a place/universe ID.');
}

async function universeFromPlace(placeId) {
  try {
    const { universeId } = await get(`https://apis.roblox.com/universes/v1/places/${placeId}/universe`);
    if (universeId) return Number(universeId);
  } catch (e) { if (e.robloxStatus && e.robloxStatus !== 404 && e.robloxStatus !== 400) throw e; }
  throw bad('No Roblox game found for that link.', 404);
}

// Share links need a signed-in Roblox account to resolve, so read the game's name from
// the share page title and find it with Roblox search. The admin confirms the preview.
async function universeFromShare(code) {
  const r = await fetch(`https://www.roblox.com/share?code=${encodeURIComponent(code)}&type=ExperienceDetails`,
    { headers: { 'user-agent': 'Mozilla/5.0 (MT Studios admin)' }, signal: AbortSignal.timeout(TIMEOUT) });
  const html = r.ok ? await r.text() : '';
  const title = (html.match(/<title>([^<]*)<\/title>/i)?.[1] || '').replace(/\s*-\s*Roblox\s*$/i, '').trim();
  if (!title || /^roblox$/i.test(title)) throw bad('Couldn’t read that share link. Open the game on Roblox and copy the roblox.com/games/… link instead.');
  const q = new URLSearchParams({ searchQuery: title, sessionId: crypto.randomUUID(), pageType: 'all' });
  const s = await get(`https://apis.roblox.com/search-api/omni-search?${q}`);
  const hits = (s.searchResults || []).flatMap(x => x.contents || []).filter(c => c.universeId);
  const exact = hits.find(c => clean(c.name).toLowerCase() === clean(title).toLowerCase()) || hits[0];
  if (!exact) throw bad(`Found “${title}” but couldn’t look it up. Use the roblox.com/games/… link instead.`, 404);
  return Number(exact.universeId);
}

/* ---------- live details for a batch of universes ---------- */
export async function fetchGames(universeIds) {
  const ids = [...new Set(universeIds.map(Number))].filter(Boolean);
  if (!ids.length) return [];
  const out = [];
  for (let i = 0; i < ids.length; i += 50) { // API batch limit
    const q = ids.slice(i, i + 50).join(',');
    const [games, votes, icons, thumbs] = await Promise.all([
      get(`https://games.roblox.com/v1/games?universeIds=${q}`),
      get(`https://games.roblox.com/v1/games/votes?universeIds=${q}`).catch(() => ({ data: [] })),
      get(`https://thumbnails.roblox.com/v1/games/icons?universeIds=${q}&size=512x512&format=Png`).catch(() => ({ data: [] })),
      get(`https://thumbnails.roblox.com/v1/games/multiget/thumbnails?universeIds=${q}&size=768x432&format=Png&countPerUniverse=1`).catch(() => ({ data: [] })),
    ]);
    for (const g of games.data || []) {
      const v = (votes.data || []).find(x => x.id === g.id) || {};
      const up = v.upVotes || 0, down = v.downVotes || 0;
      const lines = clean(g.description).split('\n').map(l => l.trim()).filter(Boolean);
      const howIdx = lines.findIndex(l => /^how to play/i.test(l));
      out.push({
        universeId: g.id,
        placeId: g.rootPlaceId,
        // Roblox sometimes sends a temporary 'TITLE UNAVAILABLE' placeholder; treat as unknown.
        name: /title unavailable|content deleted/i.test(g.name || '') ? null : (cleanName(g.name) || g.name),
        studio: g.creator?.name || '',
        created: g.created,
        updated: g.updated,
        playing: g.playing || 0,
        visits: g.visits || 0,
        favorites: g.favoritedCount || 0,
        likes: up + down ? Math.round(up / (up + down) * 100) : null,
        intro: lines.slice(0, howIdx > 0 ? howIdx : 2).filter(l => !/^code:/i.test(l)).join(' ').slice(0, 600) || 'Live on Roblox.',
        howTo: howIdx >= 0 ? lines.slice(howIdx + 1, howIdx + 7).map(l => l.slice(0, 200)) : [],
        icon: (icons.data || []).find(x => x.targetId === g.id && x.state === 'Completed')?.imageUrl || null,
        thumb: (thumbs.data || []).find(x => x.universeId === g.id)?.thumbnails?.find(t => t.state === 'Completed')?.imageUrl || null,
      });
    }
  }
  return out;
}

function bad(message, status = 400) { return Object.assign(new Error(message), { status }); }
