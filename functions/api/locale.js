/** Locale default berdasarkan negara Cloudflare; dapat dioverride dengan ?lang=id|ms. */
import { ok } from '../_lib/core.js';
import { detectLocale, countryForLocale } from '../_lib/i18n.js';

export async function onRequestGet({ data }) {
  const ctx = data.ctx;
  const locale = detectLocale(ctx.request, ctx.url.searchParams.get('lang') || '');
  return ok({ locale, country: countryForLocale(locale), supported: ['id', 'ms'] });
}
