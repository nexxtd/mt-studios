/* MT Studios admin dashboard. All pitch content is untrusted — it is only ever
   inserted via esc()/textContent, never as raw HTML. Auth lives on the server. */
(() => {
'use strict';
const $ = (s, r = document) => r.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const safeUrl = u => { try { const x = new URL(u); return /^https?:$/.test(x.protocol) ? x.href : ''; } catch { return ''; } };
const fmt = iso => { const d = new Date(iso); return isNaN(d) ? '' : d.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }); };

const STATUSES = ['new', 'reviewing', 'accepted', 'rejected'];
let pitches = [], filter = 'all', query = '', openRef = null;

async function api(path, opts = {}) {
  const r = await fetch(path, { credentials: 'same-origin', ...opts, headers: { 'Content-Type': 'application/json', ...(opts.headers || {}) } });
  const j = await r.json().catch(() => ({}));
  if (r.status === 401 && path !== '/api/admin/login') { showLogin(); throw new Error('Signed out'); }
  if (!r.ok) throw new Error(j.error || `Error ${r.status}`);
  return j;
}

/* ---------- auth ---------- */
function showLogin() { $('#dash').hidden = true; closeDrawer(); $('#login').hidden = false; $('#pw').value = ''; $('#pw').focus(); }
function showDash() { $('#login').hidden = true; $('#dash').hidden = false; setView(viewFromHash()); }

$('#loginForm').addEventListener('submit', async e => {
  e.preventDefault();
  const btn = $('button', e.target); btn.disabled = true; $('#loginErr').textContent = '';
  try {
    await api('/api/admin/login', { method: 'POST', body: JSON.stringify({ password: $('#pw').value }) });
    showDash(); load();
  } catch (err) { $('#loginErr').textContent = err.message; $('#pw').select(); }
  finally { btn.disabled = false; }
});
$('#logout').addEventListener('click', async () => { try { await api('/api/admin/logout', { method: 'POST' }); } catch { /* ignore */ } pitches = []; render(); showLogin(); });

/* ---------- data ---------- */
async function load() {
  setMsg('Loading…');
  try { pitches = (await api('/api/admin/pitches')).pitches; setMsg(''); render(); }
  catch (err) { if (err.message !== 'Signed out') setMsg(err.message, true); }
}
function setMsg(t, bad) { const m = $('#msg'); m.textContent = t; m.classList.toggle('bad', !!bad); }

/* ---------- render ---------- */
function render() {
  const count = s => pitches.filter(p => (p.status || 'new') === s).length;
  $('#stats').innerHTML = [['Total', pitches.length], ['New', count('new')], ['Reviewing', count('reviewing')], ['Accepted', count('accepted')]]
    .map(([k, n]) => `<div class="a-stat"><span class="k">${k}</span><b>${n}</b></div>`).join('');

  $('#tabs').innerHTML = ['all', ...STATUSES].map(s =>
    `<button type="button" role="tab" data-f="${s}" aria-selected="${s === filter}">${s[0].toUpperCase() + s.slice(1)} · ${s === 'all' ? pitches.length : count(s)}</button>`).join('');

  const q = query.toLowerCase();
  const rows = pitches.filter(p => (filter === 'all' || (p.status || 'new') === filter) &&
    (!q || [p.name, p.studio, p.email, p.link, p.ref, p.msg].some(v => String(v || '').toLowerCase().includes(q))));

  $('#list').innerHTML = rows.length ? rows.map(p => `
    <button class="a-row" type="button" data-ref="${esc(p.ref)}">
      <span><strong>${esc(p.studio)}</strong><span class="dim">${esc(p.name)} · ${esc(p.stage)}${p.ccu ? ' · ' + esc(p.ccu) + ' CCU' : ''}</span></span>
      <span class="a-tags">${(p.needs || []).map(n => `<span class="a-tag">${esc(n)}</span>`).join('')}</span>
      <time datetime="${esc(p.at)}">${esc(fmt(p.at))}</time>
      <span class="a-status s-${esc(p.status || 'new')}">${esc(p.status || 'new')}</span>
    </button>`).join('')
    : `<div class="a-empty">${pitches.length ? 'No pitches match.' : 'No pitches yet. They’ll show up here as soon as someone submits the form.'}</div>`;
}

$('#tabs').addEventListener('click', e => { const b = e.target.closest('[data-f]'); if (b) { filter = b.dataset.f; render(); } });
$('#search').addEventListener('input', e => { query = e.target.value.trim(); render(); });
$('#refresh').addEventListener('click', load);
$('#list').addEventListener('click', e => { const r = e.target.closest('[data-ref]'); if (r) openDrawer(r.dataset.ref); });

/* ---------- detail drawer ---------- */
function openDrawer(ref) {
  const p = pitches.find(x => x.ref === ref); if (!p) return;
  openRef = ref;
  const link = safeUrl(p.link);
  const row = (k, v) => v ? `<div><dt>${k}</dt><dd>${v}</dd></div>` : '';
  $('#detail').innerHTML = `
    <p class="eyebrow">${esc(p.ref)}</p>
    <h2 class="display" id="dTitle">${esc(p.studio)}</h2>
    <span class="a-status s-${esc(p.status || 'new')}">${esc(p.status || 'new')}</span>
    <dl class="a-dl">
      ${row('Name', esc(p.name))}
      ${row('Email', `<a href="mailto:${esc(encodeURIComponent(p.email).replace(/%40/g, '@'))}">${esc(p.email)}</a>`)}
      ${row('Game', link ? `<a href="${esc(link)}" target="_blank" rel="noopener noreferrer">${esc(p.link)}</a>` : esc(p.link))}
      ${row('Stage', esc(p.stage))}
      ${row('Peak CCU', esc(p.ccu))}
      ${row('Needs', esc((p.needs || []).join(', ')))}
      ${row('Stuck on', esc(p.msg))}
      ${row('Received', esc(fmt(p.at)))}
      ${row('Updated', esc(fmt(p.updated)))}
    </dl>
    <form class="a-edit" id="editForm">
      <div class="field"><label for="dStatus">Status</label>
        <select id="dStatus">${STATUSES.map(s => `<option value="${s}"${(p.status || 'new') === s ? ' selected' : ''}>${s[0].toUpperCase() + s.slice(1)}</option>`).join('')}</select></div>
      <div class="field"><label for="dNote">Private note <span class="opt">only admins see this</span></label>
        <textarea id="dNote" rows="4">${esc(p.note)}</textarea></div>
      <div class="a-btns">
        <button class="btn btn-sig" type="submit">Save</button>
        <button class="btn btn-danger" type="button" id="del">Delete</button>
        <span class="a-saved" id="saved" role="status"></span>
      </div>
    </form>`;
  $('#scrim').hidden = false; $('#drawer').hidden = false; $('#close').focus();
}
function closeDrawer() { $('#scrim').hidden = true; $('#drawer').hidden = true; openRef = null; }
$('#close').addEventListener('click', closeDrawer);
$('#scrim').addEventListener('click', closeDrawer);
addEventListener('keydown', e => { if (e.key === 'Escape' && !$('#drawer').hidden) closeDrawer(); });

$('#detail').addEventListener('submit', async e => {
  if (e.target.id !== 'editForm') return; // the games editor shares this drawer
  e.preventDefault();
  const ref = openRef, saved = $('#saved');
  saved.textContent = 'Saving…';
  try {
    const { pitch } = await api('/api/admin/pitches', { method: 'PATCH', body: JSON.stringify({ ref, status: $('#dStatus').value, note: $('#dNote').value }) });
    pitches = pitches.map(p => p.ref === ref ? pitch : p);
    render(); openDrawer(ref); $('#saved').textContent = 'Saved ✓';
  } catch (err) { saved.textContent = err.message; }
});
$('#detail').addEventListener('click', async e => {
  if (e.target.id !== 'del') return;
  const p = pitches.find(x => x.ref === openRef);
  if (!p || !confirm(`Delete the pitch from ${p.studio}? This can't be undone.`)) return;
  try {
    await api('/api/admin/pitches', { method: 'DELETE', body: JSON.stringify({ ref: p.ref }) });
    pitches = pitches.filter(x => x.ref !== p.ref); closeDrawer(); render();
  } catch (err) { $('#saved').textContent = err.message; }
});

/* ---------- CSV export ---------- */
$('#export').addEventListener('click', () => {
  const cols = ['ref', 'at', 'status', 'name', 'studio', 'email', 'link', 'stage', 'ccu', 'needs', 'msg', 'note'];
  // quote everything; prefix formula-looking cells so spreadsheets don't execute them
  const cell = v => { let s = Array.isArray(v) ? v.join('; ') : String(v ?? ''); if (/^[=+\-@\t\r]/.test(s)) s = "'" + s; return '"' + s.replace(/"/g, '""') + '"'; };
  const csv = [cols.join(','), ...pitches.map(p => cols.map(c => cell(p[c])).join(','))].join('\r\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv' }));
  a.download = `mt-pitches-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
});

/* =====================================================================
   GAMES — the portfolio. Add games the studio buys; they show on the site
   with live Roblox stats. Roblox text (names, studios) is untrusted too.
   ===================================================================== */
let games = [], gamesLoaded = false, openGame = null;
const nf = n => Number(n || 0).toLocaleString('en-US');
const compact = n => n >= 1e9 ? +(n / 1e9).toFixed(1) + 'B' : n >= 1e6 ? +(n / 1e6).toFixed(1) + 'M' : n >= 1e3 ? +(n / 1e3).toFixed(1) + 'K' : String(n || 0);
const imgUrl = u => { const s = safeUrl(u); return /^https:\/\/[a-z0-9.-]*rbxcdn\.com\//i.test(s) ? s : ''; };
const today = () => { const d = new Date(); return new Date(d - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10); };
const dateLabel = d => d ? new Date(d + 'T00:00:00').toLocaleDateString(undefined, { dateStyle: 'medium' }) : '';
const ordered = () => [...games].sort((a, b) => (a.position - b.position) || String(a.addedAt).localeCompare(String(b.addedAt)));

function viewFromHash() { return location.hash === '#games' ? 'games' : 'pitches'; }
function setView(v) {
  $('#gamesView').hidden = v !== 'games';
  $('#pitchesView').hidden = v !== 'pitches';
  $('#export').hidden = v !== 'pitches';
  document.querySelectorAll('.a-views a').forEach(a => a.setAttribute('aria-current', a.dataset.view === v ? 'page' : 'false'));
  document.title = `${v === 'games' ? 'Games' : 'Pitches'} — MT Studios admin`;
  if (v === 'games' && !gamesLoaded) loadGames();
}
addEventListener('hashchange', () => { if (!$('#dash').hidden) { closeDrawer(); setView(viewFromHash()); } });
$('#refresh').addEventListener('click', () => { if (viewFromHash() === 'games') loadGames(); });

function gMsg(t, bad) { const m = $('#gMsg'); m.textContent = t; m.classList.toggle('bad', !!bad); }
async function loadGames() {
  gMsg('Loading…');
  try { games = (await api('/api/admin/games')).games; gamesLoaded = true; gMsg(''); renderGames(); }
  catch (err) { if (err.message !== 'Signed out') gMsg(err.message, true); }
}

function renderGames() {
  const live = games.filter(g => !g.hidden), st = g => g.stats || {};
  $('#gStats').innerHTML = [
    ['On the site', live.length],
    ['Playing now', nf(live.reduce((a, g) => a + (st(g).playing || 0), 0))],
    ['Total visits', compact(live.reduce((a, g) => a + (st(g).visits || 0), 0))],
    ['Hidden', games.length - live.length],
  ].map(([k, n]) => `<div class="a-stat"><span class="k">${k}</span><b>${n}</b></div>`).join('');

  const list = ordered();
  $('#gList').innerHTML = list.length ? list.map((g, i) => {
    const s = st(g), thumb = imgUrl(s.thumb || s.icon);
    return `<div class="a-game${g.hidden ? ' is-hidden' : ''}" data-u="${g.universeId}">
      ${thumb ? `<img class="a-thumb" src="${esc(thumb)}" alt="" loading="lazy">` : '<span class="a-thumb"></span>'}
      <span class="a-gmain">
        <strong>${esc(g.name || 'Loading from Roblox…')}</strong>
        <span class="dim">${esc(g.studio)}${g.acquiredOn ? ` · bought ${esc(dateLabel(g.acquiredOn))}` : ''}</span>
        <span class="a-badges">${g.featured ? '<span class="a-status s-accepted">Featured</span>' : ''}${g.hidden ? '<span class="a-status s-rejected">Hidden</span>' : ''}</span>
      </span>
      <span class="a-num"><b>${nf(s.playing)}</b><span>playing</span></span>
      <span class="a-num"><b>${compact(s.visits)}</b><span>visits</span></span>
      <span class="a-gact">
        <button type="button" data-act="up" aria-label="Move ${esc(g.name)} up" ${i === 0 ? 'disabled' : ''}>↑</button>
        <button type="button" data-act="down" aria-label="Move ${esc(g.name)} down" ${i === list.length - 1 ? 'disabled' : ''}>↓</button>
        <button type="button" data-act="hide">${g.hidden ? 'Show' : 'Hide'}</button>
        <button type="button" data-act="edit">Edit</button>
      </span>
    </div>`;
  }).join('') : `<div class="a-empty">No games yet. Paste a Roblox link above to add the first one.</div>`;
}

async function patchGame(universeId, fields) {
  const { game } = await api('/api/admin/games', { method: 'PATCH', body: JSON.stringify({ universeId, ...fields }) });
  games = games.map(g => g.universeId === universeId ? game : g);
  return game;
}

$('#gList').addEventListener('click', async e => {
  const btn = e.target.closest('[data-act]'), row = e.target.closest('[data-u]');
  if (!btn || !row) return;
  const id = Number(row.dataset.u), g = games.find(x => x.universeId === id);
  if (!g) return;
  const act = btn.dataset.act;
  if (act === 'edit') return openGameDrawer(id);
  btn.disabled = true;
  try {
    if (act === 'hide') await patchGame(id, { hidden: !g.hidden });
    if (act === 'up' || act === 'down') {
      const list = ordered(), i = list.indexOf(g), j = act === 'up' ? i - 1 : i + 1;
      if (j < 0 || j >= list.length) return;
      [list[i], list[j]] = [list[j], list[i]];
      // write back clean 0..n positions for anything that moved
      await Promise.all(list.map((x, k) => x.position === k ? null : patchGame(x.universeId, { position: k })));
    }
    gMsg('');
  } catch (err) { gMsg(err.message, true); }
  renderGames();
});

/* ---- add: look up → preview → confirm ---- */
$('#addForm').addEventListener('submit', async e => {
  e.preventDefault();
  const input = $('#gInput').value.trim(), btn = $('#lookupBtn');
  if (!input) return;
  btn.disabled = true; $('#addErr').textContent = ''; $('#addPreview').innerHTML = '<div class="a-preview a-loading">Looking it up on Roblox…</div>';
  try {
    const { game, alreadyAdded } = await api('/api/admin/games', { method: 'POST', body: JSON.stringify({ input, preview: true }) });
    renderPreview(game, alreadyAdded, input);
  } catch (err) { $('#addPreview').innerHTML = ''; if (err.message !== 'Signed out') $('#addErr').textContent = err.message; }
  finally { btn.disabled = false; }
});

function renderPreview(g, alreadyAdded, input) {
  const thumb = imgUrl(g.thumb || g.icon), link = `https://www.roblox.com/games/${Number(g.placeId)}`;
  $('#addPreview').innerHTML = `
  <div class="a-preview">
    ${thumb ? `<img class="a-pthumb" src="${esc(thumb)}" alt="">` : '<span class="a-pthumb"></span>'}
    <div class="a-pinfo">
      <p class="eyebrow">Found on Roblox</p>
      <h2 class="display">${esc(g.name)}</h2>
      <p class="dim">by ${esc(g.studio)} · ${nf(g.playing)} playing · ${compact(g.visits)} visits${g.likes != null ? ` · ${g.likes}% liked` : ''}</p>
      <a class="a-link" href="${esc(link)}" target="_blank" rel="noopener noreferrer">Open on Roblox ↗</a>
    </div>
    ${alreadyAdded ? `<p class="a-already">This game is already in the portfolio.</p>` : `
    <form class="a-pform" id="confirmAdd">
      <div class="field"><label for="pDate">Purchase date <span class="opt">private</span></label><input id="pDate" type="date" value="${today()}" max="${today()}"></div>
      <div class="field"><label for="pNote">Note <span class="opt">private · e.g. price, seller</span></label><textarea id="pNote" rows="2" maxlength="2000"></textarea></div>
      <div class="checks"><label><input type="checkbox" id="pFeat"><span>Feature on home page</span></label></div>
      <div class="a-btns">
        <button class="btn btn-sig" type="submit">Add to portfolio <span aria-hidden="true">→</span></button>
        <button class="btn btn-ghost" type="button" id="pCancel">Cancel</button>
        <span class="a-saved" id="pSaved" role="status"></span>
      </div>
    </form>`}
  </div>`;
  $('#addPreview').dataset.input = input;
}

$('#addPreview').addEventListener('click', e => { if (e.target.id === 'pCancel') { $('#addPreview').innerHTML = ''; $('#gInput').focus(); } });
$('#addPreview').addEventListener('submit', async e => {
  if (e.target.id !== 'confirmAdd') return;
  e.preventDefault();
  const btn = $('button[type=submit]', e.target), saved = $('#pSaved');
  btn.disabled = true; saved.textContent = 'Adding…';
  try {
    const { game } = await api('/api/admin/games', { method: 'POST', body: JSON.stringify({
      input: $('#addPreview').dataset.input, acquiredOn: $('#pDate').value, note: $('#pNote').value, featured: $('#pFeat').checked,
    }) });
    games.push(game); renderGames();
    $('#addPreview').innerHTML = ''; $('#gInput').value = '';
    gMsg(`Added ${game.name}. It’s live on the site within a minute.`);
    document.querySelector(`[data-u="${game.universeId}"]`)?.classList.add('a-flash');
  } catch (err) { saved.textContent = err.message; btn.disabled = false; }
});

/* ---- edit drawer ---- */
function openGameDrawer(id) {
  const g = games.find(x => x.universeId === id); if (!g) return;
  openGame = id;
  const s = g.stats || {}, row = (k, v) => v ? `<div><dt>${k}</dt><dd>${v}</dd></div>` : '';
  const link = g.placeId ? `https://www.roblox.com/games/${Number(g.placeId)}` : '';
  $('#detail').innerHTML = `
    <p class="eyebrow">Universe ${esc(g.universeId)}</p>
    <h2 class="display" id="dTitle">${esc(g.name)}</h2>
    <dl class="a-dl">
      ${row('Studio', esc(g.studio))}
      ${row('Playing', nf(s.playing))}
      ${row('Visits', nf(s.visits))}
      ${row('Favorites', nf(s.favorites))}
      ${row('Liked', s.likes != null ? s.likes + '%' : '')}
      ${row('Roblox', link ? `<a href="${esc(link)}" target="_blank" rel="noopener noreferrer">Open game ↗</a>` : '')}
      ${row('Site page', `<a href="/#/portfolio/${esc(encodeURIComponent(g.slug))}" target="_blank" rel="noopener">/portfolio/${esc(g.slug)} ↗</a>`)}
      ${row('Added', esc(fmt(g.addedAt)))}
      ${row('Stats from', esc(fmt(g.statsAt)))}
    </dl>
    <form class="a-edit" id="gameForm">
      <div class="field"><label for="eDate">Purchase date <span class="opt">private</span></label><input id="eDate" type="date" value="${esc(g.acquiredOn || '')}" max="${today()}"></div>
      <div class="field"><label for="eNote">Private note <span class="opt">only admins see this</span></label><textarea id="eNote" rows="4" maxlength="2000">${esc(g.note)}</textarea></div>
      <div class="checks">
        <label><input type="checkbox" id="eFeat"${g.featured ? ' checked' : ''}><span>Featured on home page</span></label>
        <label><input type="checkbox" id="eHide"${g.hidden ? ' checked' : ''}><span>Hidden from site</span></label>
      </div>
      <div class="a-btns">
        <button class="btn btn-sig" type="submit">Save</button>
        <button class="btn btn-danger" type="button" id="gDel">Remove</button>
        <span class="a-saved" id="gSaved" role="status"></span>
      </div>
    </form>`;
  $('#scrim').hidden = false; $('#drawer').hidden = false; $('#close').focus();
}

$('#detail').addEventListener('submit', async e => {
  if (e.target.id !== 'gameForm') return;
  e.preventDefault();
  const id = openGame, saved = $('#gSaved');
  saved.textContent = 'Saving…';
  try {
    await patchGame(id, { acquiredOn: $('#eDate').value, note: $('#eNote').value, featured: $('#eFeat').checked, hidden: $('#eHide').checked });
    renderGames(); openGameDrawer(id); $('#gSaved').textContent = 'Saved ✓';
  } catch (err) { saved.textContent = err.message; }
});
$('#detail').addEventListener('click', async e => {
  if (e.target.id !== 'gDel') return;
  const g = games.find(x => x.universeId === openGame);
  if (!g || !confirm(`Remove ${g.name} from the portfolio? It disappears from the website. (The game itself on Roblox isn't touched.)`)) return;
  try {
    await api('/api/admin/games', { method: 'DELETE', body: JSON.stringify({ universeId: g.universeId }) });
    games = games.filter(x => x.universeId !== g.universeId); closeDrawer(); renderGames(); gMsg(`Removed ${g.name}.`);
  } catch (err) { $('#gSaved').textContent = err.message; }
});

/* ---------- boot: try the existing session ---------- */
fetch('/api/admin/pitches', { credentials: 'same-origin' })
  .then(async r => {
    if (r.status === 401) return showLogin();
    const j = await r.json().catch(() => ({}));
    showDash();
    if (!r.ok) return setMsg(j.error || `Error ${r.status}`, true);
    pitches = j.pitches; render();
  })
  .catch(() => { showDash(); setMsg('Could not reach the server.', true); });
})();
