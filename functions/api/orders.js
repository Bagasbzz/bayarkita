/**
 * POST /api/orders: pesanan dari popup checkout (publik).
 *   {name, phone, service_slug, service_name, plan, amount, currency, token?}
 *   -> membuat/memakai percakapan chat, menyimpan pesanan, dan mengirim
 *      ringkasan pesanan sebagai pesan ke chat web.
 */
import {
  ok, fail, param, strParam, now, normalizePhone, settingsAll, calcOrder, fmtRp, fmtAmount,
  conversationByToken, createConversation, addMessage,
} from '../_lib/core.js';
import { randomHex } from '../_lib/password.js';

export async function onRequest({ data }) {
  const ctx = data.ctx;
  const { db } = ctx;
  if (ctx.request.method !== 'POST') fail('Metode tidak diizinkan.', 405);

  const name = strParam(ctx, 'name', 120);
  const phone = normalizePhone(strParam(ctx, 'phone', 40));
  const serviceSlug = strParam(ctx, 'service_slug', 80);
  const serviceName = strParam(ctx, 'service_name', 160);
  const plan = strParam(ctx, 'plan', 120);
  const currency = strParam(ctx, 'currency', 5).toUpperCase();
  const amount = Number(param(ctx, 'amount', 0)) || 0;
  const token = strParam(ctx, 'token', 64);

  if (name.length < 2) fail('Nama wajib diisi.');
  if (phone.length < 9 || phone.length > 15) fail('Nomor WhatsApp tidak valid.');
  if (!serviceName) fail('Layanan tidak valid.');
  if (!/^[A-Z]{3}$/.test(currency)) fail('Mata uang tidak valid.');
  if (amount <= 0) fail('Jumlah tidak valid.');

  const s = await settingsAll(db);
  const min = currency === 'IDR' ? Number(s.min_order_idr) : Number(s.min_order_usd);
  if (amount < min) fail('Jumlah di bawah minimum pemesanan.');

  const calc = calcOrder(s, amount, currency);

  // Pakai percakapan yang sudah ada di browser ini bila masih valid, kalau tidak buat baru.
  let conv = await conversationByToken(db, token);
  if (!conv) {
    conv = await createConversation(db, s, name, phone);
  } else {
    await db.prepare('UPDATE conversations SET name = ?, phone = ? WHERE id = ?').bind(name, phone, conv.id).run();
  }
  const convId = Number(conv.id);

  const ymd = now().slice(2, 10).replace(/-/g, '');
  const code = `FDV-${ymd}-${randomHex(3).slice(0, 5).toUpperCase()}`;
  const ts = now();
  const res = await db.prepare(
    'INSERT INTO orders (code, conversation_id, service_slug, service_name, plan, amount, currency, rate, amount_idr, fee, total, status, customer_name, phone, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)'
  ).bind(code, convId, serviceSlug, serviceName, plan, amount, currency, calc.rate, calc.amount_idr, calc.fee, calc.total, 'baru', name, phone, ts, ts).run();
  const orderId = Number(res.meta.last_row_id);

  const summary = `Pesanan baru #${code}\n` +
    `Layanan: ${serviceName}${plan ? ` (${plan})` : ''}\n` +
    `Harga: ${fmtAmount(amount, currency)}${currency !== 'IDR' ? ' ≈ ' + fmtRp(calc.amount_idr) : ''}\n` +
    `Biaya fee: ${fmtRp(calc.fee)}\n` +
    `Total: ${fmtRp(calc.total)}`;
  await addMessage(db, convId, 'system', summary, {
    type: 'order', order_id: orderId, code, status: 'baru',
    service_name: serviceName, plan, amount, currency,
    amount_idr: calc.amount_idr, fee: calc.fee, total: calc.total,
  });
  if (s.order_auto_reply) await addMessage(db, convId, 'system', s.order_auto_reply);

  return ok({ token: conv.token, order: { id: orderId, code, total: calc.total, fee: calc.fee } });
}
