/* MT Studios admin dashboard. All pitch content is untrusted — it is only ever
   inserted via esc()/textContent, never as raw HTML. There is no login. */
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
  if (!r.ok) throw new Error(j.error || `Error ${r.status}`);
  return j;
}

/* ---------- data ---------- */
async function load() {
  setMsg('Loading…');
  try { pitches = (await api('/api/admin/pitches')).pitches; setMsg(''); render(); }
  catch (err) { setMsg(err.message === 'Failed to fetch' ? 'Could not reach the server.' : err.message, true); }
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

load();
})();
