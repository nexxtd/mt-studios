// POST /api/admin/logout
import { clearCookie } from '../_lib/auth.js';
import { json, handle } from '../_lib/http.js';

export const POST = handle(async req => json({ ok: true }, 200, { 'Set-Cookie': clearCookie(req) }));
