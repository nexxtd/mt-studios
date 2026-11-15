// Local dev server: serves the static site and runs api/*.js like Vercel does.
// Usage: npm run dev  →  http://localhost:5173  (admin at /admin)
import http from 'node:http';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const ROOT = process.cwd(), PORT = Number(process.env.PORT) || 5173;
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json' };
const ADMIN_CSP = "default-src 'self'; script-src 'self'; style-src 'self' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; img-src 'self' data: https://tr.rbxcdn.com https://*.rbxcdn.com; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'";

http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  try {
    if (url.pathname.startsWith('/api/') && !url.pathname.includes('/_')) {
      const file = path.join(ROOT, url.pathname.replace(/\/$/, '') + '.js');
      const mod = await import(pathToFileURL(file).href + '?t=' + Date.now());
      const fn = mod[req.method];
      if (!fn) { res.writeHead(405).end(); return; }
      const chunks = []; for await (const c of req) chunks.push(c);
      const headers = new Headers(); for (const [k, v] of Object.entries(req.headers)) headers.set(k, Array.isArray(v) ? v.join(', ') : v);
      const r = await fn(new Request(url, { method: req.method, headers, body: chunks.length ? Buffer.concat(chunks) : undefined }));
      res.writeHead(r.status, Object.fromEntries(r.headers)); res.end(Buffer.from(await r.arrayBuffer()));
      return;
    }
    let p = decodeURIComponent(url.pathname);
    if (p === '/') p = '/index.html';
    if (p === '/admin') p = '/admin.html';
    const file = path.join(ROOT, path.normalize(p));
    if (!file.startsWith(ROOT) || /[\\/](\.|api[\\/])/.test(file.slice(ROOT.length))) { res.writeHead(404).end(); return; }
    const body = await fs.readFile(file);
    const h = { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream' };
    if (p === '/admin.html') Object.assign(h, { 'Content-Security-Policy': ADMIN_CSP, 'Cache-Control': 'no-store' });
    res.writeHead(200, h).end(body);
  } catch (e) {
    if (e.code === 'ENOENT' || e.code === 'ERR_MODULE_NOT_FOUND') res.writeHead(404).end('Not found');
    else { console.error(e); res.writeHead(500).end('Server error'); }
  }
}).listen(PORT, () => console.log(`MT Studios dev server → http://localhost:${PORT}  (admin: /admin)`));
