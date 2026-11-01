/**
 * Halaman invoice publik (tanpa login; kode invoice acak berfungsi sebagai kunci akses).
 *   GET /api/invoice?code=FDV-...                 -> data invoice + metode pembayaran
 *   GET /api/invoice?code=FDV-...&action=status   -> { confirmed, status } (polling ringan)
 *   GET /api/invoice?code=FDV-...&action=qris     -> SVG QRIS dinamis berisi total pesanan
 */
import { ok, fail, settingsAll } from '../_lib/core.js';
import { invoiceView, isExpired, qrisAvailable, PAID_STATUSES } from '../_lib/payment.js';
import { toDynamicQris } from '../_lib/qris.js';
import qrcode from 'qrcode-generator';
import { getSeatProduct, getPoProduct } from '../_lib/seat-products.js';

const CODE_RE = /^FDV-\d{6}-[0-9A-F]{5,32}$/;

export async function onRequest({ data }) {
  const ctx = data.ctx;
  const { db, url } = ctx;
  if (ctx.request.method !== 'GET') fail('Metode tidak diizinkan.', 405);

  const code = String(url.searchParams.get('code') || '').trim().toUpperCase();
  if (!code) fail('Invoice wajib diisi.');
  if (!CODE_RE.test(code)) fail('Invoice tidak ditemukan.', 404);
  const order = await db.prepare('SELECT * FROM orders WHERE code = ?').bind(code).first();
  if (!order) fail('Invoice tidak ditemukan.', 404);
  const poGroup = order.po_group_id ? await db.prepare('SELECT product_name, status, member_count, target_size, deadline_at FROM po_groups WHERE id = ?').bind(order.po_group_id).first() : null;
  const poExpired = !!poGroup && poGroup.status === 'expired';

  const action = url.searchParams.get('action') || '';

  if (action === 'status') {
    const expired = isExpired(order) || poExpired;
    return ok({ confirmed: PAID_STATUSES.includes(order.status), status: expired ? 'kedaluwarsa' : order.status });
  }

  const s = await settingsAll(db);

  if (action === 'qris') {
    // Hentikan penyajian QR untuk invoice nonaktif. Salinan QR yang sudah disimpan
    // tidak bisa dicabut di sisi penyedia tanpa integrasi resmi dengan acquirer.
    if (order.status !== 'baru' || isExpired(order) || poExpired) fail('Invoice tidak dapat dibayar.', 410);
    if (!qrisAvailable(s, order.total)) fail('QRIS tidak tersedia untuk invoice ini.', 404);
    const payload = toDynamicQris(s.qris_payload, order.total);
    const qr = qrcode(0, 'M');
    qr.addData(payload);
    qr.make();
    const svg = qr.createSvgTag({ cellSize: 8, margin: 32, scalable: true });
    return new Response(svg, {
      headers: { 'Content-Type': 'image/svg+xml; charset=utf-8', 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' },
    });
  }

  const view = invoiceView(order, s);
  // Invoice memakai bearer URL, jadi jangan tampilkan email pribadi ke siapa pun
  // yang memiliki link. Email hanya tersedia di panel admin.
  delete view.customer_email;
  if (order.product_key) {
    const seatProduct = getSeatProduct(order.product_key);
    const poProduct = getPoProduct(order.product_key);
    if (seatProduct || poProduct) {
      view.fee = Number(order.fee);
      view.total = Number(order.total);
      view.amount = Number(order.amount);
      view.currency = order.currency;
    }
  }
  if (poGroup) view.po = {
    product_name: poGroup.product_name,
    status: poGroup.status,
    member_count: Number(poGroup.member_count),
    target_size: Number(poGroup.target_size),
    deadline_at: poGroup.deadline_at,
  };
  return ok({ order: view });
}
