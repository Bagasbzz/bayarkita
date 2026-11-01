/**
 * Logika pembayaran & invoice: status pesanan, masa berlaku, dan daftar
 * metode pembayaran (rekening/e-wallet dari setting + QRIS dinamis).
 */
import { now, fmtLocal, parseLocal } from './core.js';
import { qrisError, qrisMerchant } from './qris.js';

// baru = menunggu pembayaran; dibayar = sudah dikonfirmasi admin.
export const ORDER_STATUSES = ['baru', 'dibayar', 'diproses', 'selesai', 'batal'];
export const STATUS_LABELS = { baru: 'Menunggu Pembayaran', dibayar: 'Dibayar', diproses: 'Diproses', selesai: 'Selesai', batal: 'Dibatalkan' };
export const PAID_STATUSES = ['dibayar', 'diproses', 'selesai'];

// Kode di setting payment_accounts -> nama tampilan & logo.
export const PAYMENT_BRANDS = {
  bca: { name: 'BCA', type: 'bank', logo: 'bca.png' },
  bni: { name: 'BNI', type: 'bank', logo: 'bni.png' },
  mandiri: { name: 'Mandiri', type: 'bank', logo: 'mandiri.png' },
  cimb: { name: 'CIMB Niaga', type: 'bank', logo: 'cimb-niaga-new.png' },
  jenius: { name: 'Jenius', type: 'bank', logo: 'jenius.png' },
  permata: { name: 'Permata Bank', type: 'bank', logo: 'permata.png' },
  dana: { name: 'DANA', type: 'ewallet', logo: 'dana.png' },
  gopay: { name: 'GoPay', type: 'ewallet', logo: 'gopay.png' },
  ovo: { name: 'OVO', type: 'ewallet', logo: 'ovo.png' },
  shopeepay: { name: 'ShopeePay', type: 'ewallet', logo: 'shopeepay.png' },
};

/** Batas bayar untuk pesanan baru. */
export function invoiceExpiry(settings) {
  const hours = Math.max(1, Number(settings.invoice_hours) || 24);
  return fmtLocal(new Date(Date.now() + hours * 3600000));
}

export const isExpired = (order) => order.status === 'baru' && !!order.expires_at && order.expires_at < now();

/**
 * Parse setting payment_accounts. Satu baris per akun: "kode | nomor | atas nama".
 * Baris dengan kode tak dikenal / nomor kosong diabaikan.
 */
export function parseAccounts(text) {
  return String(text || '').split('\n').map((line) => line.split('|').map((s) => s.trim()))
    .filter(([code, number]) => Object.hasOwn(PAYMENT_BRANDS, String(code).toLowerCase()) && number)
    .map(([code, number, owner]) => {
      const brand = PAYMENT_BRANDS[code.toLowerCase()];
      return {
        code: code.toLowerCase(), type: brand.type, name: brand.name, logo: `/assets/payment-methods/${brand.logo}`,
        number: number.slice(0, 40), owner: (owner || '').slice(0, 80),
        label: brand.type === 'bank' ? 'No Rekening' : 'No ' + brand.name,
      };
    });
}

/** Validasi isi payment_accounts sebelum disimpan. Mengembalikan pesan error atau ''. */
export function accountsError(text) {
  const lines = String(text || '').split('\n').map((l) => l.trim()).filter(Boolean);
  const seen = new Set();
  for (const line of lines) {
    const [code, number] = line.split('|').map((s) => s.trim());
    if (!Object.hasOwn(PAYMENT_BRANDS, String(code).toLowerCase())) return `Kode "${code}" tidak dikenal. Pakai: ${Object.keys(PAYMENT_BRANDS).join(', ')}.`;
    if (!number) return `Nomor untuk "${code}" kosong.`;
    if (seen.has(code.toLowerCase())) return `Kode "${code}" hanya boleh diisi sekali.`;
    seen.add(code.toLowerCase());
  }
  return '';
}

/** QRIS tersedia jika payload valid dan total tidak melebihi batas. */
export function qrisAvailable(settings, total) {
  if (!Number.isFinite(Number(total)) || Number(total) <= 0) return false;
  if (!settings.qris_payload || qrisError(settings.qris_payload)) return false;
  const max = Number(settings.qris_max) || 0;
  return !(max > 0 && Number(total) > max);
}

/** Data publik untuk halaman invoice (tanpa nomor WhatsApp pelanggan). */
export function invoiceView(order, settings) {
  const expired = isExpired(order);
  const confirmed = PAID_STATUSES.includes(order.status);
  const payable = order.status === 'baru' && !expired;
  const max = Number(settings.qris_max) || 0;
  const qrisValid = !!settings.qris_payload && !qrisError(settings.qris_payload);
  return {
    invoice: order.code,
    name: order.customer_name,
    service: order.service_name,
    plan: order.plan || '',
    amount: Number(order.amount),
    currency: order.currency,
    amount_idr: Number(order.amount_idr),
    fee: Number(order.fee),
    total: Number(order.total),
    status: expired ? 'kedaluwarsa' : order.status,
    status_label: expired ? 'Kedaluwarsa' : STATUS_LABELS[order.status] || order.status,
    confirmed,
    payable,
    created_at: order.created_at,
    expires_at: order.expires_at,
    // Epoch ms agar klien tidak perlu tahu zona waktu server.
    expires_ts: order.expires_at ? parseLocal(order.expires_at) : 0,
    wa_number: String(settings.wa_number || '').replace(/\D/g, ''),
    qris: qrisValid ? {
      available: qrisAvailable(settings, order.total),
      merchant: qrisMerchant(settings.qris_payload),
      max,
    } : null,
    accounts: parseAccounts(settings.payment_accounts),
    product_key: order.product_key || '',
  };
}
