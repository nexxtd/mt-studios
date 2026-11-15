import { StoreNotConfigured } from './store.js';

const BASE = { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' };

export function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), { status, headers: { ...BASE, ...headers } });
}

export function clientIp(req) {
  return (req.headers.get('x-forwarded-for') || '').split(',')[0].trim() || req.headers.get('x-real-ip') || 'local';
}

// Reject cross-site requests and anything that isn't a JSON body (blocks form-based CSRF).
export function sameOriginJson(req) {
  const origin = req.headers.get('origin');
  if (origin && origin !== new URL(req.url).origin) return false;
  return (req.headers.get('content-type') || '').startsWith('application/json');
}

export async function readJson(req, maxBytes = 20_000) {
  const text = await req.text();
  if (text.length > maxBytes) throw Object.assign(new Error('Too large'), { status: 413 });
  try { return JSON.parse(text); } catch { throw Object.assign(new Error('Bad JSON'), { status: 400 }); }
}

export function handle(fn) {
  return async req => {
    try { return await fn(req); } catch (e) {
      if (e instanceof StoreNotConfigured) return json({ error: 'Database not connected yet' }, 503);
      if (e.status) return json({ error: e.message }, e.status);
      console.error(e);
      return json({ error: 'Server error' }, 500);
    }
  };
}
