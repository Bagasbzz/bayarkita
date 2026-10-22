/** GET /api/settings[?services=1]: setting publik (fee, kurs, kontak) untuk kalkulator & widget. */
import { ok, settingsAll, publicSettings, parseJsonArr } from '../_lib/core.js';

export async function onRequestGet({ data }) {
  const ctx = data.ctx;
  const out = publicSettings(await settingsAll(ctx.db));
  if (ctx.url.searchParams.has('services')) {
    const rows = (await ctx.db.prepare('SELECT slug, name, description, icon, currencies, presets FROM services WHERE active = 1 ORDER BY sort_order, id').all()).results;
    out.services = rows.map((r) => ({ ...r, currencies: parseJsonArr(r.currencies), presets: parseJsonArr(r.presets) }));
  }
  return ok(out);
}
