// POST /api/pitch — public endpoint the "Pitch your game" form submits to.
import crypto from 'node:crypto';
import { savePitch, hit } from './_lib/store.js';
import { json, readJson, clientIp, sameOriginJson, handle } from './_lib/http.js';

const NEEDS = ['Funding', 'LiveOps', 'Growth', 'Monetization', 'Analytics', 'QA & Loc'];
const STAGES = ['Prototype', 'Soft launch', 'Live'];

const str = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

export const POST = handle(async req => {
  if (!sameOriginJson(req)) return json({ error: 'Bad request' }, 400);
  if ((await hit('pitch:' + clientIp(req), 3600)) > 10) return json({ error: 'Too many pitches — try again later' }, 429);

  const b = await readJson(req);
  if (str(b.website, 200)) return json({ ok: true, ref: 'MT-' + crypto.randomBytes(3).toString('hex').toUpperCase() }); // honeypot: pretend success

  const p = {
    name: str(b.name, 120), studio: str(b.studio, 120), email: str(b.email, 200),
    link: str(b.link, 500), stage: str(b.stage, 40), ccu: str(b.ccu, 40), msg: str(b.msg, 4000),
    needs: Array.isArray(b.needs) ? [...new Set(b.needs)].filter(n => NEEDS.includes(n)) : [],
  };
  const errs = [];
  if (!p.name) errs.push('name');
  if (!p.studio) errs.push('studio');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(p.email)) errs.push('email');
  try { if (!/^https?:$/.test(new URL(p.link).protocol)) throw 0; } catch { errs.push('link'); }
  if (!STAGES.includes(p.stage)) errs.push('stage');
  if (!p.needs.length) errs.push('needs');
  if (errs.length) return json({ error: 'Invalid fields', fields: errs }, 422);

  p.ref = 'MT-' + crypto.randomBytes(3).toString('hex').toUpperCase();
  p.at = new Date().toISOString();
  p.status = 'new';
  await savePitch(p);
  return json({ ok: true, ref: p.ref }, 201);
});
