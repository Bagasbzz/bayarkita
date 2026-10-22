/**
 * Middleware untuk semua /api/*: siapkan konteks (db, url, input), seed awal,
 * dan ubah ApiError / error tak terduga menjadi respons JSON.
 */
import { ApiError, json, readInput, ensureSeed, setTimezone } from '../_lib/core.js';

export async function onRequest(context) {
  const { request, env } = context;
  if (!env.DB) return json({ ok: false, error: 'Binding D1 "DB" belum dikonfigurasi.' }, 500);
  setTimezone(env.TIMEZONE);
  try {
    await ensureSeed(env);
    context.data.ctx = { env, request, db: env.DB, url: new URL(request.url), input: await readInput(request) };
    return await context.next();
  } catch (e) {
    if (e instanceof ApiError) return json({ ok: false, error: e.message }, e.status);
    console.error('[bayarkita]', e && e.stack ? e.stack : e);
    return json({ ok: false, error: 'Terjadi kesalahan pada server.' }, 500);
  }
}
