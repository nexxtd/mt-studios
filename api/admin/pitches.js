// /api/admin/pitches — admin only.
//   GET                              → list all pitches
//   PATCH  { ref, status?, note? }   → update review status / private note
//   DELETE { ref }                   → remove a pitch
import { isAuthed } from '../_lib/auth.js';
import { listPitches, getPitch, savePitch, deletePitch } from '../_lib/store.js';
import { json, readJson, sameOriginJson, handle } from '../_lib/http.js';

const STATUSES = ['new', 'reviewing', 'accepted', 'rejected'];
const unauthorized = () => json({ error: 'Not signed in' }, 401);

export const GET = handle(async req => {
  if (!isAuthed(req)) return unauthorized();
  return json({ pitches: await listPitches() });
});

export const PATCH = handle(async req => {
  if (!isAuthed(req)) return unauthorized();
  if (!sameOriginJson(req)) return json({ error: 'Bad request' }, 400);
  const { ref, status, note } = await readJson(req);
  const p = typeof ref === 'string' && await getPitch(ref);
  if (!p) return json({ error: 'Not found' }, 404);
  if (status !== undefined) {
    if (!STATUSES.includes(status)) return json({ error: 'Bad status' }, 400);
    p.status = status;
  }
  if (note !== undefined) p.note = String(note).slice(0, 4000);
  p.updated = new Date().toISOString();
  await savePitch(p);
  return json({ pitch: p });
});

export const DELETE = handle(async req => {
  if (!isAuthed(req)) return unauthorized();
  if (!sameOriginJson(req)) return json({ error: 'Bad request' }, 400);
  const { ref } = await readJson(req);
  if (typeof ref !== 'string' || !(await getPitch(ref))) return json({ error: 'Not found' }, 404);
  await deletePitch(ref);
  return json({ ok: true });
});
