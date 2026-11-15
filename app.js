/* MT Studios — app logic. No dependencies.
   Edit the CONTENT block below to change services, games and tracks. */
(() => {
'use strict';
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
// Motion is on by default; visitors can switch it off with the footer toggle.
let motionPref = 'on';
try { motionPref = localStorage.getItem('mt_motion') || 'on'; } catch { /* storage unavailable */ }
const reduced = motionPref === 'off';
document.documentElement.classList.add('js');
if (reduced) document.documentElement.classList.add('no-motion');

/* ================= CONTENT (sample data — replace with real figures) ================= */
const SERVICES = [
  { id: 'Funding', blurb: 'Milestone-based capital for content, hires and UA. Revenue share, no equity.',
    long: 'We put money in against milestones you help define, and we get paid back only from the revenue we help create. No equity in your studio, no claim on your IP.',
    items: ['Prototype & production funding', 'Team hiring budget', 'UA and sponsored ads budget', 'Contractor & asset costs'] },
  { id: 'LiveOps', blurb: 'Event calendar, seasonal content and weekly updates, planned and shipped with you.',
    long: 'A live-ops designer and producer own the calendar: weekly updates, seasonal beats, limited-time modes and the boring-but-critical release checklist.',
    items: ['12-week event calendar', 'Seasonal & limited-time events', 'Update cadence & release management', 'Community & Discord comms'] },
  { id: 'Growth', blurb: 'Icons, thumbnails, sponsored ads and creator campaigns, tested not guessed.',
    long: 'We test what gets the click and what keeps the session. Creative is produced in-house and every campaign is measured against retention, not just visits.',
    items: ['Icon & thumbnail testing', 'Sponsored & search ads', 'Creator and influencer campaigns', 'Cross-promotion across the portfolio'] },
  { id: 'Monetization', blurb: 'Economy design, passes and offers that players think are fair.',
    long: 'Economy modelling, game pass and developer product strategy, and offer design tuned for long-term spend and a community that still likes you afterwards.',
    items: ['Economy audit & rebalance', 'Game pass & product line-up', 'Starter packs and timed offers', 'Pricing experiments'] },
  { id: 'Analytics', blurb: 'Funnels, cohorts and a dashboard your whole team actually opens.',
    long: 'We instrument the game properly, then turn it into one dashboard and one weekly memo: what moved, why, and what to ship next.',
    items: ['Event taxonomy & instrumentation', 'Retention and funnel dashboards', 'A/B test design & readouts', 'Weekly insights memo'] },
  { id: 'QA & Loc', blurb: 'Device coverage, regression passes and localization in 12 languages.',
    long: 'Every update gets a regression pass across phone, tablet, console and low-end PC, plus localization by people who play Roblox in that language.',
    items: ['Cross-device regression testing', 'Performance profiling on low-end devices', 'Localization in 12 languages', 'Moderation & policy review'] },
];

// Real games: generated from the Roblox API by update-games.mjs into games-data.js
const GAMES = (window.MT_GAMES || []).map(g => ({ ...g, year: new Date(g.created).getFullYear() }));
const TOTAL_PLAYING_NOW = GAMES.reduce((a, g) => a + g.playing, 0) || 1000;
const UPDATED = window.MT_GAMES_UPDATED ? new Date(window.MT_GAMES_UPDATED) : null;
function compact(n) {
  if (n >= 1e9) return +(n / 1e9).toFixed(1) + 'B';
  if (n >= 1e6) return +(n / 1e6).toFixed(1) + 'M';
  if (n >= 1e3) return +(n / 1e3).toFixed(1) + 'K';
  return String(n);
}
const playUrl = g => `https://www.roblox.com/games/${g.placeId}`;

const TRACKS = {
  Seed:   { fund: '$25K – $150K', crew: 'Producer + analyst, part-time', focus: 'Core loop, first-session retention, soft launch' },
  Growth: { fund: '$150K – $750K', crew: 'Producer, live-ops designer, analyst', focus: 'Event calendar, economy, paid and creator growth' },
  Scale:  { fund: '$750K+', crew: 'Full embedded crew of 5–8', focus: 'Content pipeline, localization, portfolio cross-promo' },
};

const FEED = GAMES.length ? GAMES.flatMap(g => [
  ['LIVE', `${g.name}: ${g.playing.toLocaleString('en-US')} playing`],
  ['VISITS', `${g.name}: ${compact(g.visits)} visits`],
  ['RATING', `${g.name}: ${g.likes}% liked`],
]) : [['LIVE', 'Portfolio loading']];
/* ===================================================================================== */

const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/* ---------- game covers (real thumbnails) ---------- */
function cover(g, big) {
  return `<div class="cover${big ? ' big' : ''}">
    <img src="${esc(big ? g.thumb : g.thumb)}" alt="" loading="${big ? 'eager' : 'lazy'}" decoding="async" onload="this.parentNode.classList.add('loaded')">
    <span class="status"><i></i>${g.playing.toLocaleString('en-US')} playing</span>
    <img class="cover-icon" src="${esc(g.icon)}" alt="" loading="lazy" decoding="async">
  </div>`;
}
function card(g) {
  return `<a class="card reveal" href="#/portfolio/${g.slug}" aria-label="${esc(g.name)} by ${esc(g.studio)}">
    ${cover(g)}
    <div class="card-meta"><h3>${esc(g.name)}</h3><span class="k">${esc(g.studio)}</span></div>
    <div class="card-foot"><div class="tags"><span>${compact(g.visits)} visits</span><span>${g.likes}% liked</span></div><span>Since <b>${new Date(g.created).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}</b></span></div>
  </a>`;
}

/* ---------- scroll reveal ---------- */
const io = 'IntersectionObserver' in window ? new IntersectionObserver(es => {
  for (const e of es) if (e.isIntersecting) {
    e.target.classList.add('in'); io.unobserve(e.target);
    setTimeout(() => e.target.style.removeProperty('--i'), 1600); // drop stagger delay so hover stays snappy
    if (e.target.classList.contains('stat')) countUp($('b', e.target));
  }
}, { threshold: 0.15, rootMargin: '0px 0px -6% 0px' }) : null;

function watch(root = document) {
  const groups = new Map();
  for (const el of $$('.reveal:not(.in), .cover:not(.in), .rw:not(.in)', root)) {
    if (el.classList.contains('reveal')) {
      const n = groups.get(el.parentElement) || 0;
      el.style.setProperty('--i', n % 4); groups.set(el.parentElement, n + 1);
    }
    if (io) io.observe(el); else el.classList.add('in');
  }
}

function countUp(el) {
  if (!el || reduced || el.dataset.done) return;
  el.dataset.done = '1';
  const end = parseFloat(el.dataset.count), suf = el.dataset.suffix || '', dec = String(el.dataset.count).includes('.') ? 1 : 0;
  const t0 = performance.now(), dur = 1400;
  const tick = t => {
    const p = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - p, 4);
    const val = end * e;
    el.textContent = (dec ? val.toFixed(dec) : Math.round(val).toLocaleString('en-US')) + suf;
    if (p < 1) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

/* ---------- static renders ---------- */
$('#svcRows').innerHTML = SERVICES.map((s, i) => `<li class="reveal"><a href="#/services">
  <span class="n">0${i + 1}</span><h3>${esc(s.id)}</h3><p>${esc(s.blurb)}</p><span class="arr" aria-hidden="true">→</span></a></li>`).join('');

$('#svcDetail').innerHTML = SERVICES.map((s, i) => `<article class="svc-item reveal">
  <div><span class="n">0${i + 1} / 0${SERVICES.length}</span><h2 class="display">${esc(s.id)}</h2></div>
  <p>${esc(s.long)}</p>
  <ul>${s.items.map(x => `<li>${esc(x)}</li>`).join('')}</ul></article>`).join('');

$('#featured').innerHTML = GAMES.map(card).join('');

$('#needChecks').innerHTML = SERVICES.map(s => `<label><input type="checkbox" name="needs" value="${esc(s.id)}"><span>${esc(s.id)}</span></label>`).join('');

(() => {
  const s = $$('.stats .stat b'), visits = GAMES.reduce((a, g) => a + g.visits, 0);
  const avgLikes = GAMES.length ? Math.round(GAMES.reduce((a, g) => a + g.likes, 0) / GAMES.length) : 0;
  const v = compact(visits), num = parseFloat(v), suf = v.replace(/[\d.]/g, '');
  const set = (el, n, suffix, label) => { el.dataset.count = n; el.dataset.suffix = suffix; el.textContent = n.toLocaleString('en-US') + suffix; el.nextElementSibling.textContent = label; };
  set(s[0], GAMES.length, '', 'games in the portfolio');
  set(s[1], num, suf, 'lifetime visits across the portfolio');
  set(s[2], TOTAL_PLAYING_NOW, '', 'players in our games right now');
  set(s[3], avgLikes, '%', 'average like rating');
})();
$('#yr').textContent = new Date().getFullYear();
const motionBtn = $('#motionBtn');
motionBtn.textContent = `Motion: ${reduced ? 'Off' : 'On'}`;
motionBtn.setAttribute('aria-pressed', String(!reduced));
motionBtn.addEventListener('click', () => {
  try { localStorage.setItem('mt_motion', reduced ? 'on' : 'off'); } catch { return; }
  location.reload();
});

/* ---------- portfolio filter (by studio) ---------- */
let filter = 'All';
function renderChips() {
  const opts = ['All', ...new Set(GAMES.map(g => g.studio))];
  $('#chips').innerHTML = opts.map(o => {
    const n = o === 'All' ? GAMES.length : GAMES.filter(g => g.studio === o).length;
    return `<button type="button" class="chip" data-f="${esc(o)}" aria-pressed="${o === filter}">${esc(o)}<sup>${n}</sup></button>`;
  }).join('');
}
function renderGrid() {
  const list = filter === 'All' ? GAMES : GAMES.filter(g => g.studio === filter);
  $('#grid').innerHTML = list.length ? list.map(card).join('') : `<p class="empty">No games yet.</p>`;
  watch($('#grid'));
}
$('#chips').addEventListener('click', e => {
  const b = e.target.closest('.chip'); if (!b) return;
  filter = b.dataset.f; renderChips(); renderGrid();
  $(`.chip[data-f="${CSS.escape(filter)}"]`)?.focus();
});

/* ---------- game page ---------- */
function renderCase(g) {
  const next = GAMES[(GAMES.indexOf(g) + 1) % GAMES.length];
  const since = new Date(g.created).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  $('#case').innerHTML = `
  <div class="case-top">
    ${cover(g, true)}
    <div class="case-info">
      <a class="back" href="#/portfolio">← All games</a>
      <div>
        <p class="eyebrow">${esc(g.studio)} · Live since ${since}</p>
        <h1 class="display">${esc(g.name)}</h1>
        <p class="lede">${esc(g.intro)}</p>
        <div class="actions"><a class="btn btn-sig" href="${playUrl(g)}" target="_blank" rel="noopener">Play on Roblox <span aria-hidden="true">↗</span></a></div>
      </div>
      <div class="case-stats">
        <div><b>${g.playing.toLocaleString('en-US')}</b><span>Playing now</span></div>
        <div><b>${compact(g.visits)}</b><span>Visits</span></div>
        <div><b>${g.likes}%</b><span>Liked · ${compact(g.favorites)} favs</span></div>
      </div>
    </div>
  </div>
  ${g.howTo.length ? `<section class="band case-body">
    <div class="reveal"><p class="eyebrow">How it plays</p><h2 class="display" style="margin-top:16px">The loop</h2>
      <p class="lede">Built and owned by ${esc(g.studio)}.</p></div>
    <ol class="reveal">${g.howTo.map(w => `<li>${esc(w)}</li>`).join('')}</ol>
  </section>` : ''}
  ${GAMES.length > 1 ? `<section class="band case-next">
    <div><p class="eyebrow">Next game</p><a class="display" href="#/portfolio/${next.slug}">${esc(next.name)} →</a></div>
    <a class="btn btn-ghost" href="#/apply">Pitch your game <span aria-hidden="true">→</span></a>
  </section>` : ''}
  ${UPDATED ? `<p class="data-note">Stats from the Roblox API, ${UPDATED.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}.</p>` : ''}`;
}

/* ---------- router ---------- */
const TITLES = { home: 'MT Studios — Funding & LiveOps for Roblox games', portfolio: 'Portfolio — MT Studios', services: 'What we do — MT Studios', apply: 'Pitch your game — MT Studios' };
let first = true, wipeTimer = 0;
const wipe = document.createElement('div');
wipe.className = 'wipe'; wipe.setAttribute('aria-hidden', 'true');
wipe.innerHTML = Array.from({ length: 6 }, (_, i) => `<i style="--d:${i}"></i>`).join('');
document.body.append(wipe);
function route() {
  if (first || reduced) return swap();
  if (wipeTimer) return;            // a wipe is already covering; swap() will read the latest hash
  wipe.classList.remove('run'); void wipe.offsetWidth; wipe.classList.add('run');
  wipeTimer = setTimeout(() => { wipeTimer = 0; swap(); }, 600);
}
wipe.addEventListener('animationend', e => { if (e.target === wipe.lastElementChild) wipe.classList.remove('run'); });
function swap() {
  const parts = location.hash.replace(/^#\/?/, '').split('/').filter(Boolean);
  let view = parts[0] || 'home', navKey = view;
  if (view === 'portfolio' && parts[1]) {
    const g = GAMES.find(x => x.slug === parts[1]);
    if (!g) { location.replace('#/portfolio'); return; }
    renderCase(g); view = 'case'; navKey = 'portfolio'; document.title = `${g.name} — MT Studios`;
  } else {
    if (!TITLES[view]) { view = navKey = 'home'; }
    document.title = TITLES[view];
  }
  const views = $$('.view');
  views.forEach(v => { v.hidden = true; });
  const el = $(`.view[data-view="${view}"]`);
  void el.offsetWidth; // restart the enter animation
  el.hidden = false;
  $$('.nav a').forEach(a => a.dataset.nav === navKey ? a.setAttribute('aria-current', 'page') : a.removeAttribute('aria-current'));
  closeMenu();
  if (!first) { window.scrollTo(0, 0); $('#main').setAttribute('tabindex', '-1'); $('#main').focus({ preventScroll: true }); }
  first = false;
  watch(el);
  onScroll();
}
addEventListener('hashchange', route);

/* ---------- menu ---------- */
const menuBtn = $('.menu-btn'), nav = $('#nav');
function closeMenu() { nav.classList.remove('open'); menuBtn.setAttribute('aria-expanded', 'false'); }
menuBtn.addEventListener('click', () => {
  const open = nav.classList.toggle('open'); menuBtn.setAttribute('aria-expanded', String(open));
});
addEventListener('keydown', e => { if (e.key === 'Escape') closeMenu(); });

/* ---------- scroll progress ---------- */
const bar = document.createElement('div'); bar.className = 'progress'; document.body.append(bar);
const consoleEl = $('.console');
let ticking = false, lastY = scrollY, marq = null, marqT = 0;
function onScroll() {
  if (ticking) return; ticking = true;
  requestAnimationFrame(() => {
    const max = document.documentElement.scrollHeight - innerHeight;
    bar.style.transform = `scaleX(${max > 0 ? Math.min(1, scrollY / max) : 0})`;
    // console flattens out of its tilt as you scroll
    consoleEl.style.setProperty('--tilt', `${(14 * Math.max(0, 1 - scrollY / 420)).toFixed(2)}deg`);
    // marquee speeds up with scroll velocity
    const v = Math.abs(scrollY - lastY); lastY = scrollY;
    const track = $('.marquee-track');
    marq = marq || (track.getAnimations ? track.getAnimations()[0] : null);
    if (marq && v) {
      marq.playbackRate = 1 + Math.min(7, v / 10);
      clearTimeout(marqT); marqT = setTimeout(() => { marq.playbackRate = 1; }, 180);
    }
    ticking = false;
  });
}
addEventListener('scroll', onScroll, { passive: true });
addEventListener('resize', onScroll);

/* ---------- hero pointer light ---------- */
/* ---------- hero: interactive block field ---------- */
const hero = $('.hero');
(() => {
  const cv = document.createElement('canvas'); cv.setAttribute('aria-hidden', 'true'); hero.prepend(cv);
  const ctx = cv.getContext('2d'); if (!ctx) return;
  const GAP = 30, mouse = { x: -9999, y: -9999 };
  let W = 0, H = 0, ripples = [], raf = 0, visible = false, lastAuto = 0;
  function resize() {
    const r = hero.getBoundingClientRect(), dpr = Math.min(2, devicePixelRatio || 1);
    W = r.width; H = r.height;
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (!raf) draw(performance.now(), true);
  }
  function draw(t, once) {
    ctx.clearRect(0, 0, W, H);
    for (const r of ripples) { r.r += 5; r.life -= 0.011; }
    ripples = ripples.filter(r => r.life > 0);
    for (let y = GAP / 2; y < H; y += GAP) for (let x = GAP / 2; x < W; x += GAP) {
      const d = Math.hypot(x - mouse.x, y - mouse.y), m = Math.max(0, 1 - d / 240);
      const wave = (Math.sin(x * 0.012 + y * 0.018 + t * 0.0012) + 1) / 2;
      let v = m * m;
      for (const r of ripples) { const q = (Math.hypot(x - r.x, y - r.y) - r.r) / 34; v += Math.exp(-q * q) * r.life; }
      v = Math.min(1, v);
      const s = 0.8 + wave * 0.7 + v * 4.2;
      ctx.fillStyle = v > 0.04
        ? `rgba(${Math.round(124 + 131 * v)},${Math.round(108 - 13 * v)},${Math.round(255 - 55 * v)},${0.3 + v * 0.7})`
        : `rgba(255,255,255,${0.06 + wave * 0.1})`;
      ctx.beginPath(); ctx.arc(x, y, s, 0, 6.2832); ctx.fill();
    }
    if (once) return;
    if (t - lastAuto > 2600) { lastAuto = t; ripples.push({ x: Math.random() * W, y: Math.random() * H, r: 0, life: 0.7 }); }
    raf = requestAnimationFrame(draw);
  }
  function sync() {
    const run = visible && !document.hidden && !reduced;
    if (run && !raf) raf = requestAnimationFrame(draw);
    if (!run && raf) { cancelAnimationFrame(raf); raf = 0; }
  }
  hero.addEventListener('pointermove', e => { const r = hero.getBoundingClientRect(); mouse.x = e.clientX - r.left; mouse.y = e.clientY - r.top; });
  hero.addEventListener('pointerleave', () => { mouse.x = mouse.y = -9999; });
  hero.addEventListener('pointerdown', e => { const r = hero.getBoundingClientRect(); ripples.push({ x: e.clientX - r.left, y: e.clientY - r.top, r: 0, life: 1 }); });
  if ('ResizeObserver' in window) new ResizeObserver(resize).observe(hero); else addEventListener('resize', resize);
  if ('IntersectionObserver' in window) new IntersectionObserver(es => { visible = es[0].isIntersecting; sync(); }).observe(hero); else visible = true;
  document.addEventListener('visibilitychange', sync);
  resize(); sync();
})();

/* ---------- split text: hero letters, heading words ---------- */
(() => {
  const title = $('.hero-title');
  title.setAttribute('aria-label', title.textContent.replace(/\s+/g, ' ').trim());
  let c = 0;
  for (const l of $$('.line', title)) {
    l.setAttribute('aria-hidden', 'true');
    const words = l.textContent.trim().split(/\s+/), total = words.join('').length;
    let j = 0;
    l.innerHTML = words.map(w =>
      `<span class="wd">${[...w].map(ch => `<span class="ch" style="--c:${c++};--k:${(j++ / Math.max(1, total - 1)).toFixed(2)}">${esc(ch)}</span>`).join('')}</span>`).join(' ');
  }
  title.classList.add('split');

  for (const el of $$('.sec-head h2, .page-head h1, .cta h2, .fit h2, .apply-side h1')) {
    let i = 0;
    for (const n of [...el.childNodes]) {
      if (n.nodeType !== 3) continue;
      const frag = document.createDocumentFragment();
      for (const tok of n.textContent.split(/(\s+)/)) {
        if (!tok) continue;
        if (/^\s+$/.test(tok)) { frag.append(' '); continue; }
        const o = document.createElement('span'), s = document.createElement('span');
        o.className = 'w'; s.style.setProperty('--w', i++); s.textContent = tok; o.append(s); frag.append(o);
      }
      n.replaceWith(frag);
    }
    el.classList.add('rw');
  }
})();

/* ---------- card tilt + magnetic buttons ---------- */
if (!reduced && matchMedia('(hover:hover) and (pointer:fine)').matches) {
  let tilt = null, mag = null;
  document.addEventListener('pointermove', e => {
    const t = e.target instanceof Element ? e.target : null;
    const c = t && t.closest('.card'), b = t && t.closest('.btn');
    const sp = t && t.closest('.svc-rows a, .stat, .steps li, .svc-item, .fit-tool, .form');
    if (sp) { const r = sp.getBoundingClientRect(); sp.style.setProperty('--sx', `${e.clientX - r.left}px`); sp.style.setProperty('--sy', `${e.clientY - r.top}px`); }
    if (tilt && tilt !== c) { $('.cover', tilt).style.transform = ''; tilt = null; }
    if (mag && mag !== b) { mag.style.transform = ''; mag = null; }
    if (c) {
      const cov = $('.cover', c), r = cov.getBoundingClientRect();
      const px = (e.clientX - r.left) / r.width - 0.5, py = (e.clientY - r.top) / r.height - 0.5;
      cov.style.transform = `perspective(900px) rotateY(${(px * 12).toFixed(2)}deg) rotateX(${(-py * 12).toFixed(2)}deg) scale(1.02)`;
      tilt = c;
    }
    if (b) {
      const r = b.getBoundingClientRect();
      b.style.transform = `translate(${((e.clientX - r.left - r.width / 2) * 0.18).toFixed(1)}px,${((e.clientY - r.top - r.height / 2) * 0.28).toFixed(1)}px)`;
      mag = b;
    }
  });
  document.addEventListener('pointerleave', () => {
    if (tilt) { $('.cover', tilt).style.transform = ''; tilt = null; }
    if (mag) { mag.style.transform = ''; mag = null; }
  });
}

/* ---------- ops console (demo data) ---------- */
const fmt = n => Math.round(n).toLocaleString('en-US');
const line = $('#spark polyline'), ccuEl = $('#ccu');
let series = Array.from({ length: 40 }, (_, i) => TOTAL_PLAYING_NOW * (0.94 + Math.sin(i / 4) * 0.03 + i * 0.0015));
series[series.length - 1] = TOTAL_PLAYING_NOW;
function drawSpark() {
  const min = Math.min(...series), max = Math.max(...series), span = max - min || 1;
  line.setAttribute('points', series.map((v, i) => `${(i / (series.length - 1) * 240).toFixed(1)},${(60 - (v - min) / span * 56).toFixed(1)}`).join(' '));
  ccuEl.textContent = fmt(series[series.length - 1]);
}
drawSpark();
const feedEl = $('#opsfeed');
let feedI = 0;
function feedItem() {
  const [tag, text] = FEED[feedI++ % FEED.length];
  const t = new Date(), hh = String(t.getHours()).padStart(2, '0'), mm = String(t.getMinutes()).padStart(2, '0');
  const li = document.createElement('li');
  li.innerHTML = `<time>${hh}:${mm}</time><span>${esc(text)}</span><span class="tag">${esc(tag)}</span>`;
  feedEl.prepend(li);
  while (feedEl.children.length > 3) feedEl.lastElementChild.remove();
}
for (let i = 0; i < 3; i++) feedItem();
if (!reduced) {
  setInterval(() => {
    if (document.hidden) return;
    const last = series[series.length - 1];
    series.push(Math.max(TOTAL_PLAYING_NOW * 0.85, Math.min(TOTAL_PLAYING_NOW * 1.12, last + (Math.random() - 0.48) * TOTAL_PLAYING_NOW * 0.012))); series.shift(); drawSpark();
  }, 1200);
  setInterval(() => { if (!document.hidden) feedItem(); }, 3400);
}

/* ---------- fit tool ---------- */
const fit = $('#fit'), slider = $('#fitCcu');
let lastTrack = '';
function ccuFromSlider(v) {
  if (v <= 0) return 0;
  const raw = Math.pow(10, v / 100 * 5), mag = Math.pow(10, Math.max(0, Math.floor(Math.log10(raw)) - 1));
  return Math.round(raw / mag) * mag;
}
function updateFit() {
  const v = +slider.value, ccu = ccuFromSlider(v), stage = new FormData(fit).get('stage');
  slider.style.setProperty('--p', v + '%');
  $('#fitCcuOut').textContent = ccu >= 100000 ? '100,000+' : fmt(ccu);
  const name = stage === 'prototype' || ccu < 500 ? 'Seed' : ccu < 10000 ? 'Growth' : 'Scale';
  const t = TRACKS[name], el = $('#fitTrack');
  $('#fitFund').textContent = t.fund; $('#fitCrew').textContent = t.crew; $('#fitFocus').textContent = t.focus;
  if (name !== lastTrack) {
    el.textContent = name; lastTrack = name;
    el.classList.remove('swap'); void el.offsetWidth; el.classList.add('swap');
  }
}
fit.addEventListener('input', updateFit);
fit.addEventListener('submit', e => e.preventDefault());
updateFit();

/* ---------- apply form ---------- */
const form = $('#applyForm');
function setErr(field, msg) {
  field.classList.toggle('bad', !!msg);
  const p = $('.err', field); if (p) p.textContent = msg || '';
  const input = $('input:not([type=checkbox]),select', field);
  if (input) input.setAttribute('aria-invalid', msg ? 'true' : 'false');
}
function check(input) {
  const field = input.closest('.field'), v = input.value.trim();
  let msg = '';
  if (input.required && !v) msg = 'Required';
  else if (input.type === 'email' && v && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v)) msg = 'Enter a valid email';
  else if (input.type === 'url' && v) { try { const u = new URL(v); if (!/^https?:$/.test(u.protocol)) throw 0; } catch { msg = 'Enter a full link starting with https://'; } }
  else if (input.name === 'ccu' && v && !/^[\d,.\sKkMm]+$/.test(v)) msg = 'Numbers only, e.g. 2,400';
  setErr(field, msg); return !msg;
}
form.addEventListener('blur', e => { if (e.target.matches('input:not([type=checkbox]),select')) check(e.target); }, true);
form.addEventListener('input', e => {
  const f = e.target.closest('.field');
  if (f && f.classList.contains('bad')) e.target.type === 'checkbox' ? setErr(f, '') : check(e.target);
});
form.addEventListener('submit', e => {
  e.preventDefault();
  const inputs = $$('input:not([type=checkbox]),select', form);
  let ok = inputs.map(check).every(Boolean);
  const needsField = $('#needChecks').closest('.field'), needs = $$('input[name=needs]:checked', form).map(i => i.value);
  setErr(needsField, needs.length ? '' : 'Pick at least one');
  if (!needs.length) ok = false;
  if ($('button[type=submit]', form).disabled) return;
  if (!ok) { ($('.bad input, .bad select', form) || form).focus(); return; }
  const ref = 'MT-' + Math.random().toString(36).slice(2, 8).toUpperCase();
  const data = Object.fromEntries(new FormData(form)); data.needs = needs; data.ref = ref; data.at = new Date().toISOString();
  try { const all = JSON.parse(localStorage.getItem('mt_pitches') || '[]'); all.push(data); localStorage.setItem('mt_pitches', JSON.stringify(all)); } catch { /* storage unavailable */ }
  const btn = $('button[type=submit]', form), label = btn.innerHTML;
  btn.disabled = true; btn.innerHTML = '<i class="spinner" aria-hidden="true"></i> Sending…';
  setTimeout(() => {
    btn.disabled = false; btn.innerHTML = label;
    $('#sentRef').textContent = ref;
    form.hidden = true; $('#sent').hidden = false; $('#sent').focus();
    form.reset();
  }, reduced ? 0 : 1100);
});
// returning to the pitch page shows a fresh form
addEventListener('hashchange', () => { if (!location.hash.startsWith('#/apply')) { form.hidden = false; $('#sent').hidden = true; } });

/* ---------- go: intro loader, then first route ---------- */
renderChips(); renderGrid(); route();
const root = document.documentElement;
if (reduced) root.classList.add('ready');
else {
  const loader = document.createElement('div');
  loader.className = 'loader'; loader.setAttribute('aria-hidden', 'true');
  loader.innerHTML = `<div class="loader-in"><div class="loader-mark">${[0, 1, 2, 3].map(i => `<i style="--d:${i}"></i>`).join('')}</div>
    <div class="loader-row"><span>Loading portfolio</span><span class="loader-pct">0%</span></div>
    <div class="loader-bar"><i></i></div></div>`;
  document.body.append(loader);
  const pct = $('.loader-pct', loader), fill = $('.loader-bar i', loader), t0 = performance.now(), DUR = 1300;
  let done = false;
  const finish = () => {
    if (done) return; done = true;
    pct.textContent = '100%'; fill.style.transform = 'scaleX(1)';
    loader.classList.add('out'); root.classList.add('ready');
    setTimeout(() => loader.remove(), 900);
  };
  const step = t => {
    if (done) return;
    const p = Math.min(1, (t - t0) / DUR), e = 1 - Math.pow(1 - p, 3);
    pct.textContent = Math.round(e * 100) + '%'; fill.style.transform = `scaleX(${e})`;
    p < 1 ? requestAnimationFrame(step) : finish();
  };
  requestAnimationFrame(step);
  setTimeout(finish, DUR + 1200); // safety net if the tab is throttled
}
})();
