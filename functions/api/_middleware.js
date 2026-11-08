/**
 * Middleware untuk semua /api/*: siapkan konteks (db, url, input), seed awal,
 * dan ubah ApiError / error tak terduga menjadi respons JSON.
 */
import { ApiError, json, readInput, ensureSeed, setTimezone } from '../_lib/core.js';
import { detectLocale, tr } from '../_lib/i18n.js';

export async function onRequest(context) {
  const { request, env } = context;
  if (!env.DB) return json({ ok: false, error: 'Binding D1 "DB" belum dikonfigurasi.' }, 500);
  setTimezone(env.TIMEZONE);
  try {
    await ensureSeed(env);
    const url = new URL(request.url);
    const input = await readInput(request);
    const locale = detectLocale(request, input?.locale || url.searchParams.get('lang') || '');
    context.data.ctx = { env, request, db: env.DB, url, input, locale };
    return await context.next();
  } catch (e) {
    if (e instanceof ApiError) return json({ ok: false, error: e.message }, e.status);
    console.error('[goisiinn]', e && e.stack ? e.stack : e);
    const locale = context.data?.ctx?.locale || detectLocale(request);
    return json({ ok: false, error: tr(locale, 'server_error') }, 500);
  }
}
