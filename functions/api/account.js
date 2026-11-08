/** Akun pelanggan ringan berbasis token percakapan yang tersimpan di browser. */
import { ok, fail, strParam, requirePost, conversationByToken, addMessage } from '../_lib/core.js';
import { normalizeLocale, tr } from '../_lib/i18n.js';
import { SELLER_DISCOUNT_PCT, SELLER_MIN_QUANTITY } from '../_lib/seller.js';

export async function onRequest({ data }) {
  const ctx = data.ctx;
  const token = strParam(ctx, 'token', 64);
  const conv = await conversationByToken(ctx.db, token);
  if (!conv) fail('Sesi pelanggan tidak ditemukan.', 404);

  if (ctx.request.method === 'GET') {
    return ok({
      account_type: conv.account_type || 'customer',
      locale: normalizeLocale(conv.locale || ctx.locale),
      seller_discount_pct: SELLER_DISCOUNT_PCT,
      seller_min_quantity: SELLER_MIN_QUANTITY,
    });
  }

  requirePost(ctx);
  const locale = normalizeLocale(strParam(ctx, 'locale', 5) || conv.locale || ctx.locale);
  await ctx.db.prepare("UPDATE conversations SET account_type = 'seller', locale = ? WHERE id = ?")
    .bind(locale, conv.id).run();
  if ((conv.account_type || 'customer') !== 'seller') {
    await addMessage(ctx.db, conv.id, 'system', tr(locale, 'seller_upgraded'), { type: 'seller_upgrade' });
  }
  return ok({
    account_type: 'seller', locale,
    seller_discount_pct: SELLER_DISCOUNT_PCT,
    seller_min_quantity: SELLER_MIN_QUANTITY,
  });
}
