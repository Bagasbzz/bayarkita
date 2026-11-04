/**
 * POST /api/orders: pesanan dari popup checkout (publik).
 *   {name, phone, service_slug, service_name, plan, amount, currency, token?}
 *   -> membuat/memakai percakapan chat, menyimpan pesanan (status "baru" = menunggu
 *      pembayaran, berlaku invoice_hours jam), mengirim ringkasan ke chat web, dan
 *      mengembalikan redirectUrl ke halaman invoice /inv/{kode}.
 */
import {
  ok, fail, param, strParam, now, fmtLocal, normalizePhone, settingsAll, calcOrder, fmtRp, fmtAmount, parseJsonArr,
  conversationByToken, createConversation, addMessage,
} from '../_lib/core.js';
import { randomHex } from '../_lib/password.js';
import { pickAgent, scheduleAiReply } from '../_lib/ai.js';
import { invoiceExpiry } from '../_lib/payment.js';
import { getSeatProduct, getPoProduct, discountIdr } from '../_lib/seat-products.js';

export async function onRequest(context) {
  const { data, env } = context;
  const ctx = data.ctx;
  const { db } = ctx;
  if (ctx.request.method !== 'POST') fail('Metode tidak diizinkan.', 405);

  const name = strParam(ctx, 'name', 120);
  const phone = normalizePhone(strParam(ctx, 'phone', 40));
  const serviceSlug = strParam(ctx, 'service_slug', 80);
  const serviceName = strParam(ctx, 'service_name', 160);
  let plan = strParam(ctx, 'plan', 120);
  const productKey = strParam(ctx, 'product_key', 80);
  const poKey = strParam(ctx, 'po_key', 80);
  const customerEmail = strParam(ctx, 'customer_email', 254).toLowerCase();
  const currency = strParam(ctx, 'currency', 5).toUpperCase();
  const amount = Number(param(ctx, 'amount', 0)) || 0;
  const token = strParam(ctx, 'token', 64);

  if (name.length < 2) fail('Nama wajib diisi.');
  if (phone.length < 9 || phone.length > 15) fail('Nomor WhatsApp tidak valid.');
  if (!serviceName) fail('Layanan tidak valid.');
  if (!/^[A-Z]{3}$/.test(currency)) fail('Mata uang tidak valid.');
  if (!Number.isFinite(amount) || amount <= 0) fail('Jumlah tidak valid.');

  const s = await settingsAll(db);
  const seatProduct = getSeatProduct(productKey);
  const poProduct = getPoProduct(poKey);
  if (productKey && !seatProduct) fail('Paket seat tidak valid.');
  if (poKey && !poProduct) fail('Paket patungan tidak valid.');
  if (seatProduct && poProduct) fail('Pilih satu jenis produk.');
  const fixedProduct = seatProduct || poProduct;
  if (fixedProduct) {
    if (serviceSlug !== fixedProduct.service_slug || serviceName !== fixedProduct.service_name || plan !== fixedProduct.plan) fail('Detail paket tidak sesuai.');
    if (currency !== (seatProduct ? 'IDR' : poProduct.currency) || amount !== fixedProduct.amount) fail('Harga paket tidak sesuai.');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i.test(customerEmail) || customerEmail.length > 254) fail('Email tidak valid.');
  } else {
    const min = currency === 'IDR' ? Number(s.min_order_idr) : Number(s.min_order_usd);
    if (amount < min) fail('Jumlah di bawah minimum pemesanan.');
    if (amount > 1e9) fail('Jumlah terlalu besar.');
  }

  const calc = calcOrder(s, amount, currency);
  const emailProduct = seatProduct || poProduct;
  const orderRate = seatProduct || poProduct ? 1 : calc.rate;
  const orderAmountIdr = seatProduct ? seatProduct.amount : poProduct ? (poProduct.currency === 'IDR' ? poProduct.amount : calc.amount_idr) : calc.amount_idr;
  const orderFee = seatProduct ? 0 : poProduct ? 5000 : calc.fee;
  // Diskon hanya untuk paket tetap (seat, patungan, atau preset non-Custom yang cocok
  // persis dengan katalog layanan di database). Nominal Custom tidak didiskon.
  let isFixedPlan = !!fixedProduct;
  if (!isFixedPlan && discountIdr(serviceSlug, s) > 0) {
    const svc = await db.prepare('SELECT presets FROM services WHERE slug = ? AND active = 1').bind(serviceSlug).first();
    isFixedPlan = !!svc && parseJsonArr(svc.presets).some((p) => !p.custom && p.label === plan && Number(p.amount) === amount && String(p.currency).toUpperCase() === currency);
  }
  const orderDiscount = isFixedPlan ? Math.min(discountIdr(serviceSlug, s), Math.round(orderAmountIdr)) : 0;
  const orderTotal = (seatProduct ? seatProduct.amount : poProduct ? orderAmountIdr + orderFee : calc.total) - orderDiscount;
  const invoiceAmount = seatProduct || poProduct ? orderAmountIdr : amount;
  const invoiceCurrency = seatProduct || poProduct ? 'IDR' : currency;

  // Pakai percakapan yang sudah ada di browser ini bila masih valid, kalau tidak buat baru.
  // Pelanggan yang datang dari checkout langsung tersambung ke agen (tanpa antrian).
  const ai = String(s.ai_enabled) === '1' && !!env.AI_API_KEY;
  let conv = await conversationByToken(db, token);
  if (!conv) {
    conv = await createConversation(db, s, name, phone, ai ? pickAgent() : null, ai ? now() : null);
  } else {
    await db.prepare('UPDATE conversations SET name = ?, phone = ? WHERE id = ?').bind(name, phone, conv.id).run();
  }
  const convId = Number(conv.id);

  const ymd = now().slice(2, 10).replace(/-/g, '');
  // Kode merupakan kunci akses invoice publik, gunakan 128 bit acak.
  const code = `FDV-${ymd}-${randomHex(16).toUpperCase()}`;
  const ts = now();
  const expiresAt = invoiceExpiry(s);
  const res = await db.prepare(
    'INSERT INTO orders (code, conversation_id, service_slug, service_name, plan, amount, currency, rate, amount_idr, fee, total, status, customer_name, phone, created_at, updated_at, expires_at, customer_email, product_key, po_group_id, discount) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)'
  ).bind(code, convId, serviceSlug, serviceName, plan, invoiceAmount, invoiceCurrency, orderRate, orderAmountIdr, orderFee, orderTotal, 'baru', name, phone, ts, ts, expiresAt, emailProduct ? customerEmail : null, seatProduct ? productKey : poProduct ? poKey : null, null, orderDiscount).run();
  const orderId = Number(res.meta.last_row_id);
  let poGroup = null;
  if (poProduct) {
    const groupName = poProduct.plan.replace(/ \(1\/4\)$/, '');
    await db.prepare("UPDATE po_groups SET status = 'expired', updated_at = ? WHERE status = 'open' AND deadline_at <= ?").bind(ts, ts).run();
    let group = await db.prepare("SELECT * FROM po_groups WHERE product_key = ? AND status = 'open' AND deadline_at > ? ORDER BY id LIMIT 1").bind(poKey, ts).first();
    if (!group) {
      const deadlineAt = fmtLocal(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000));
      const created = await db.prepare("INSERT INTO po_groups (product_key, product_name, status, target_size, member_count, deadline_at, created_at, updated_at) VALUES (?,?,'open',4,0,?,?,?)").bind(poKey, groupName, deadlineAt, ts, ts).run();
      group = await db.prepare('SELECT * FROM po_groups WHERE id = ?').bind(created.meta.last_row_id).first();
    }
    if (Number(group.member_count) >= 4) fail('Grup patungan ini sudah penuh. Silakan coba lagi untuk masuk ke grup berikutnya.');
    const slot = Number(group.member_count) + 1;
    await db.prepare('INSERT INTO po_group_members (group_id, order_id, slot, created_at) VALUES (?,?,?,?)').bind(group.id, orderId, slot, ts).run();
    const nextCount = slot;
    const nextStatus = nextCount === 4 ? 'full' : 'open';
    await db.prepare('UPDATE po_groups SET member_count = ?, status = ?, updated_at = ? WHERE id = ?').bind(nextCount, nextStatus, ts, group.id).run();
    await db.prepare('UPDATE orders SET po_group_id = ?, plan = ? WHERE id = ?').bind(group.id, `${groupName} (${nextCount}/4)`, orderId).run();
    poGroup = { id: Number(group.id), product_key: poKey, member_count: nextCount, target_size: 4, deadline_at: group.deadline_at, status: nextStatus };
    plan = `${groupName} (${nextCount}/4)`;
  }
  const redirectUrl = `/inv/${code}`;

  const summary = `Pesanan baru #${code}\n` +
    `Layanan: ${serviceName}${plan ? ` - ${plan}` : ''}\n` +
    `Harga: ${fmtAmount(invoiceAmount, invoiceCurrency)}${invoiceCurrency !== 'IDR' ? ' ≈ ' + fmtRp(orderAmountIdr) : ''}\n` +
    `Biaya fee: ${fmtRp(orderFee)}\n` +
    (orderDiscount ? `Diskon: -${fmtRp(orderDiscount)}\n` : '') +
    `Total: ${fmtRp(orderTotal)}\n` +
    (poGroup ? 'Grup patungan dibuka/diikuti. Info peserta dan progres hanya tampil di invoice setelah pembayaran Anda dikonfirmasi.\n' : '') +
    `Invoice: ${redirectUrl}`;
  await addMessage(db, convId, 'system', summary, {
    type: 'order', order_id: orderId, code, status: 'baru',
    service_name: serviceName, plan, amount: invoiceAmount, currency: invoiceCurrency,
    amount_idr: orderAmountIdr, fee: orderFee, discount: orderDiscount, total: orderTotal, invoice_url: redirectUrl,
    product_key: seatProduct ? productKey : poProduct ? poKey : undefined,
  });
  if (s.order_auto_reply) await addMessage(db, convId, 'system', s.order_auto_reply);
  // Agen AI menyusul dengan panduan langkah pembayaran.
  if (ai && Number(conv.ai_enabled) === 1) context.waitUntil(scheduleAiReply(env, convId).catch((e) => console.error('[ai]', e)));

  return ok({ token: conv.token, redirectUrl, order: { id: orderId, code, total: orderTotal, fee: orderFee, expires_at: expiresAt } });
}
