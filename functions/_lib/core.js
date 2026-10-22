/**
 * Inti API untuk Cloudflare Pages Functions + D1.
 * Berisi: helper respons JSON, pembacaan input, waktu lokal, seed data awal,
 * settings, kalkulasi fee, format angka, dan helper percakapan/pesan.
 *
 * Konvensi: setiap handler menerima `ctx` = { env, request, url, db, input }.
 */
import { hashPassword, randomHex } from './password.js';

// ---------- Error terkontrol ----------
export class ApiError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}
export const fail = (msg, status = 400) => { throw new ApiError(msg, status); };

// ---------- Respons ----------
export function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...headers },
  });
}
export const ok = (data = {}, headers = {}) => json({ ok: true, ...data }, 200, headers);

// ---------- Input ----------
export async function readInput(request) {
  if (request.method !== 'POST') return {};
  const ct = request.headers.get('Content-Type') || '';
  try {
    if (ct.includes('application/json')) {
      const j = await request.json();
      return j && typeof j === 'object' ? j : {};
    }
    if (ct.includes('form')) return Object.fromEntries((await request.formData()).entries());
  } catch (_) { /* body tidak valid: perlakukan sebagai kosong */ }
  return {};
}

/** Ambil parameter dari body JSON, fallback ke query string. */
export function param(ctx, key, def = null) {
  if (ctx.input && Object.prototype.hasOwnProperty.call(ctx.input, key)) return ctx.input[key];
  const q = ctx.url.searchParams.get(key);
  return q !== null ? q : def;
}

export function strParam(ctx, key, max = 2000) {
  const v = param(ctx, key, '');
  return typeof v === 'string' ? v.trim().slice(0, max) : '';
}

export function requirePost(ctx) {
  if (ctx.request.method !== 'POST') fail('Metode tidak diizinkan.', 405);
}

// ---------- Waktu (format "YYYY-MM-DD HH:MM:SS" di zona waktu lokal) ----------
let TZ = 'Asia/Jakarta';
export const setTimezone = (tz) => { if (tz) TZ = tz; };

const dtf = () => new Intl.DateTimeFormat('en-CA', {
  timeZone: TZ, hourCycle: 'h23',
  year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit',
});

/** Format Date ke string lokal "YYYY-MM-DD HH:MM:SS". */
export function fmtLocal(date = new Date()) {
  const p = Object.fromEntries(dtf().formatToParts(date).map((x) => [x.type, x.value]));
  return `${p.year}-${p.month}-${p.day} ${p.hour}:${p.minute}:${p.second}`;
}
export const now = () => fmtLocal();
export const today = () => now().slice(0, 10);
export const daysAgo = (n) => fmtLocal(new Date(Date.now() - n * 86400000)).slice(0, 10);
export const secondsAgo = (n) => fmtLocal(new Date(Date.now() - n * 1000));

/** Parse "YYYY-MM-DD HH:MM:SS" (lokal) ke epoch ms, cukup akurat untuk selisih detik. */
export function parseLocal(s) {
  if (!s) return 0;
  // Ambil offset zona waktu saat ini (dalam menit) untuk konversi balik.
  const probe = new Date();
  const localStr = fmtLocal(probe);
  const asUtc = Date.parse(localStr.replace(' ', 'T') + 'Z');
  const offsetMs = asUtc - probe.getTime();
  return Date.parse(String(s).replace(' ', 'T') + 'Z') - offsetMs;
}

// ---------- Data default ----------
export function defaultSettings() {
  return {
    fee_idr_base: 20000, fee_idr_pct: 4.5,
    fee_usd_min: 20000, fee_usd_min_threshold: 3, fee_usd_base: 28000, fee_usd_pct: 1,
    rate_USD: 18600, rate_EUR: 21500, rate_GBP: 24800, rate_JPY: 125, rate_CNY: 2600, rate_THB: 570, rate_MYR: 4400,
    min_order_idr: 20000, min_order_usd: 1,
    wa_number: '628127968494', telegram: 'fahmidev',
    chat_greeting: 'Halo! Ada yang bisa kami bantu? Tulis pesan Anda di sini, admin akan membalas secepatnya.',
    chat_offline_note: 'Admin sedang offline. Pesan Anda tetap tersimpan dan akan dibalas saat admin online.',
    order_auto_reply: 'Terima kasih, pesanan Anda sudah kami terima. Admin akan segera mengirimkan instruksi pembayaran di chat ini.',
    quick_replies: 'Halo, terima kasih sudah menghubungi Fahmidev. Ada yang bisa kami bantu?\nPesanan Anda sedang kami proses, mohon tunggu sebentar ya.\nSilakan transfer ke rekening berikut lalu kirim bukti transfernya di sini.\nPembayaran sudah kami terima, pesanan akan segera diproses.\nPesanan Anda sudah selesai. Terima kasih sudah menggunakan jasa Fahmidev!',
    admin_last_seen: '',
  };
}

export function defaultServices() {
  const p = (label, amount, currency, custom = false) => ({ label, amount, currency, custom });
  return [
    { slug: 'custom-merchant', name: 'Custom Merchant', description: 'Bayar merchant luar negeri sesuai kebutuhan', icon: 'assets/services/chatgpt-image-14-agu-2026-00-23-28-adcf0768-5f6b-4e92-8f12-6b5a97274040.png', currencies: ['IDR', 'USD', 'EUR', 'GBP', 'THB', 'MYR', 'JPY', 'CNY'], presets: [p('All Merchant', 0, 'IDR', true)] },
    { slug: 'patreon', name: 'Patreon', description: 'Dukung kreator favorit Anda', icon: 'assets/services/patreon-logo-icon-147253-9aa38885-ce2a-4135-a2fc-ada2aecb2991.webp', currencies: ['USD', 'EUR'], presets: [p('Custom', 0, 'USD', true), p('$1,1', 1.11, 'USD'), p('$2,2', 2.22, 'USD'), p('$3,3', 3.33, 'USD'), p('$4,4', 4.44, 'USD'), p('$5,5', 5.55, 'USD'), p('$6,6', 6.66, 'USD'), p('$7,7', 7.77, 'USD')] },
    { slug: 'jurnal-internasional', name: 'Jurnal Internasional', description: 'Akses jurnal dan publikasi akademik', icon: 'assets/services/chatgpt-image-14-agu-2026-00-27-21-429aa2c6-3d70-4c8e-9947-bead95ce8ccc.png', currencies: ['USD', 'EUR', 'GBP', 'JPY'], presets: [p('Custom', 0, 'USD', true)] },
    { slug: 'google-play-console', name: 'Google Play Console', description: 'Pembayaran pendaftaran Google Play Console', icon: 'assets/services/google-play-console-icon-16066820-fff9-4f4c-b1ad-0c4c7883033f.png', currencies: ['USD'], presets: [p('Google Play Console', 25, 'USD')] },
    { slug: 'shopify', name: 'Shopify', description: 'Bayar toko online berbasis Shopify', icon: 'assets/services/2945149-033ca954-48c8-4d7c-8cf8-d507ef0ed7ac.webp', currencies: ['USD', 'EUR', 'GBP'], presets: [p('Custom', 0, 'USD', true)] },
    { slug: 'chatgpt', name: 'ChatGPT', description: 'Akses AI terbaik untuk produktivitas', icon: 'assets/services/chatgpt-logo-svg-9bcbeaa5-9b91-448d-8116-1ca8e762d2ae.png', currencies: ['IDR', 'USD'], presets: [p('Go', 75000, 'IDR'), p('Plus', 349000, 'IDR'), p('Pro', 1889000, 'IDR'), p('Custom', 0, 'IDR', true)] },
    { slug: 'claude', name: 'Claude', description: 'Akses AI untuk kerja dan riset', icon: 'assets/services/claude-ai-symbol-svg-f7aaea3e-6fed-4222-b787-fd120f83196d.png', currencies: ['USD', 'EUR'], presets: [p('Pro', 22.2, 'USD'), p('Max 5X', 111, 'USD'), p('Max 20X', 222, 'USD'), p('Custom', 0, 'USD', true)] },
    { slug: 'ebay', name: 'eBay', description: 'Pembayaran tagihan belanja online di eBay, bantuan tracking paket tersedia', icon: 'assets/logos/ebay.png', currencies: ['IDR', 'USD', 'EUR', 'GBP', 'JPY'], presets: [p('Custom', 0, 'IDR', true)] },
  ];
}

// ---------- Seed (idempotent, dijalankan sekali per isolate) ----------
let seeded = false;
export async function ensureSeed(env) {
  if (seeded) return;
  const db = env.DB;
  const ts = now();

  const adminCount = await db.prepare('SELECT COUNT(*) AS c FROM admins').first('c');
  if (!adminCount) {
    const hash = await hashPassword(env.ADMIN_PASSWORD || 'admin');
    await db.prepare('INSERT INTO admins (username, password_hash, created_at) VALUES (?,?,?)')
      .bind(env.ADMIN_USERNAME || 'admin', hash, ts).run();
  }

  const have = new Set((await db.prepare('SELECT skey FROM settings').all()).results.map((r) => r.skey));
  const defs = defaultSettings();
  const missing = Object.keys(defs).filter((k) => !have.has(k));
  if (missing.length) {
    await db.batch(missing.map((k) => db.prepare('INSERT INTO settings (skey, svalue) VALUES (?,?)').bind(k, String(defs[k]))));
  }

  const svcCount = await db.prepare('SELECT COUNT(*) AS c FROM services').first('c');
  if (!svcCount) {
    await db.batch(defaultServices().map((s, i) =>
      db.prepare('INSERT INTO services (slug, name, description, icon, currencies, presets, active, sort_order, created_at, updated_at) VALUES (?,?,?,?,?,?,1,?,?,?)')
        .bind(s.slug, s.name, s.description, s.icon, JSON.stringify(s.currencies), JSON.stringify(s.presets), i, ts, ts)));
  }
  seeded = true;
}

// ---------- Settings ----------
export async function settingsAll(db) {
  const rows = (await db.prepare('SELECT skey, svalue FROM settings').all()).results;
  const out = defaultSettings();
  for (const r of rows) out[r.skey] = r.svalue;
  return out;
}

export async function setSetting(db, key, value) {
  await db.prepare('INSERT INTO settings (skey, svalue) VALUES (?,?) ON CONFLICT(skey) DO UPDATE SET svalue = excluded.svalue')
    .bind(key, String(value)).run();
}

/** Setting publik untuk kalkulator & widget chat. */
export function publicSettings(s) {
  const rates = {};
  for (const k of Object.keys(s)) if (k.startsWith('rate_')) rates[k.slice(5)] = Number(s[k]);
  const lastSeen = s.admin_last_seen ? parseLocal(s.admin_last_seen) : 0;
  return {
    fee: {
      idr_base: Number(s.fee_idr_base), idr_pct: Number(s.fee_idr_pct),
      usd_min: Number(s.fee_usd_min), usd_min_threshold: Number(s.fee_usd_min_threshold),
      usd_base: Number(s.fee_usd_base), usd_pct: Number(s.fee_usd_pct),
    },
    rates,
    min_order: { IDR: Number(s.min_order_idr), USD: Number(s.min_order_usd) },
    wa_number: s.wa_number, telegram: s.telegram,
    chat_greeting: s.chat_greeting, chat_offline_note: s.chat_offline_note,
    admin_online: lastSeen > 0 && Date.now() - lastSeen < 90000,
  };
}

/** Hitung fee & total di server agar nilai pesanan tidak bisa dimanipulasi klien. */
export function calcOrder(s, amount, currency) {
  currency = currency.toUpperCase();
  let rate, idr, fee;
  if (currency === 'IDR') {
    rate = 1;
    idr = amount;
    fee = Number(s.fee_idr_base) + idr * Number(s.fee_idr_pct) / 100;
  } else {
    rate = Number(s['rate_' + currency] ?? s.rate_USD);
    idr = amount * rate;
    const usdEquiv = idr / Number(s.rate_USD);
    fee = usdEquiv < Number(s.fee_usd_min_threshold)
      ? Number(s.fee_usd_min)
      : Number(s.fee_usd_base) + idr * Number(s.fee_usd_pct) / 100;
  }
  return { rate, amount_idr: Math.round(idr * 100) / 100, fee: Math.round(fee), total: Math.round(idr + fee) };
}

// ---------- Format ----------
const numId = (n, dec = 0) => Number(n).toLocaleString('id-ID', { minimumFractionDigits: dec, maximumFractionDigits: dec });
export const fmtRp = (n) => 'Rp ' + numId(Math.round(n));
export function fmtAmount(n, cur) {
  if (cur === 'IDR') return 'IDR ' + numId(n);
  const sym = { USD: '$', EUR: '€', GBP: '£', JPY: '¥', CNY: '¥', THB: '฿', MYR: 'RM' }[cur] ?? cur + ' ';
  const dec = Math.floor(n) === n ? 0 : 2;
  return sym + Number(n).toLocaleString('en-US', { minimumFractionDigits: dec, maximumFractionDigits: dec });
}

export function normalizePhone(phone) {
  let d = String(phone).replace(/\D+/g, '');
  if (d.startsWith('0')) d = '62' + d.slice(1);
  if (d.startsWith('8')) d = '62' + d;
  return d;
}

// ---------- Percakapan & pesan ----------
export async function conversationByToken(db, token) {
  if (!token) return null;
  return (await db.prepare('SELECT * FROM conversations WHERE token = ?').bind(token).first()) || null;
}

export async function createConversation(db, settings, name, phone) {
  const token = randomHex();
  const ts = now();
  await db.prepare('INSERT INTO conversations (token, name, phone, status, created_at, customer_seen_at) VALUES (?,?,?,?,?,?)')
    .bind(token, name, phone, 'open', ts, ts).run();
  const conv = await conversationByToken(db, token);
  await addMessage(db, conv.id, 'system', settings.chat_greeting);
  return conv;
}

export async function addMessage(db, convId, sender, body, meta = null) {
  const ts = now();
  const res = await db.prepare('INSERT INTO messages (conversation_id, sender, body, meta, created_at) VALUES (?,?,?,?,?)')
    .bind(convId, sender, body, meta ? JSON.stringify(meta) : null, ts).run();
  // Pesan sistem/admin menambah unread pelanggan; pesan pelanggan menambah unread admin.
  const col = sender === 'customer' ? 'unread_admin' : 'unread_customer';
  await db.prepare(`UPDATE conversations SET last_message = ?, last_sender = ?, last_at = ?, status = 'open', ${col} = ${col} + 1 WHERE id = ?`)
    .bind(body.slice(0, 160), sender, ts, convId).run();
  return Number(res.meta.last_row_id);
}

export async function messagesSince(db, convId, since, limit = 200) {
  const rows = (await db.prepare('SELECT id, sender, body, meta, created_at FROM messages WHERE conversation_id = ? AND id > ? ORDER BY id ASC LIMIT ?')
    .bind(convId, since, limit).all()).results;
  return rows.map((r) => ({ ...r, id: Number(r.id), meta: r.meta ? JSON.parse(r.meta) : null }));
}

export const parseJsonArr = (s) => { try { const v = JSON.parse(s || '[]'); return Array.isArray(v) ? v : []; } catch (_) { return []; } };
