import assert from 'node:assert/strict';
import fs from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { normalizePhone, supportedPhone } from '../functions/_lib/core.js';
import { detectLocale, normalizeLocale } from '../functions/_lib/i18n.js';
import { sellerDiscount, SELLER_DISCOUNT_PCT, SELLER_MIN_QUANTITY } from '../functions/_lib/seller.js';
import { greetingFor } from '../functions/_lib/ai.js';
import { displayCurrency, displayRate, idrToDisplay, fmtDisplayIdr } from '../functions/_lib/currency.js';
import { invoiceView } from '../functions/_lib/payment.js';

assert.equal(SELLER_DISCOUNT_PCT, 8);
assert.equal(SELLER_MIN_QUANTITY, 3);
assert.equal(sellerDiscount('seller', 3, 100_000), 24_000);
assert.equal(sellerDiscount('seller', 2, 100_000), 0);
assert.equal(sellerDiscount('customer', 10, 100_000), 0);

assert.equal(normalizePhone('0812-3456-7890', 'id'), '6281234567890');
assert.equal(normalizePhone('812 3456 7890', 'id'), '6281234567890');
assert.equal(normalizePhone('012-345 6789', 'ms'), '60123456789');
assert.equal(normalizePhone('+60 12-345 6789', 'ms'), '60123456789');
assert.equal(normalizePhone('012-345 6789', 'id'), '60123456789');
assert.equal(normalizePhone('0812-3456-7890', 'ms'), '6281234567890');
assert.ok(supportedPhone('6281234567890'));
assert.ok(supportedPhone('60123456789'));
assert.ok(!supportedPhone('608123456789'));
assert.ok(!supportedPhone('12345'));

assert.equal(displayCurrency('id'), 'IDR');
assert.equal(displayCurrency('ms-MY'), 'MYR');
assert.equal(displayRate({ rate_MYR: 4500 }, 'ms'), 4500);
assert.equal(idrToDisplay(45_000, 'MYR', 4500), 10);
assert.equal(fmtDisplayIdr(45_000, 'MYR', 4500), 'RM 10.00');
const malaysiaInvoice = invoiceView({
  code: 'FDV-261109-ABCDE', customer_name: 'Aisyah', service_name: 'ChatGPT', plan: 'Go',
  amount: 45_000, unit_amount: 45_000, quantity: 1, currency: 'IDR', amount_idr: 45_000,
  unit_amount_idr: 45_000, fee: 4_500, discount: 0, seller_discount: 0, total: 49_500,
  status: 'baru', locale: 'ms', display_currency: 'MYR', display_rate: 4500,
  created_at: '2026-11-09 00:00:00', expires_at: '2099-01-01 00:00:00',
}, { rate_MYR: 4500, qris_payload: '', qris_max: 1_000_000, wa_number: '', payment_accounts: '' });
assert.equal(malaysiaInvoice.display.amount, 10);
assert.equal(malaysiaInvoice.display.fee, 1);
assert.equal(malaysiaInvoice.display.total, 11);

assert.equal(normalizeLocale('ms-MY'), 'ms');
assert.equal(normalizeLocale('id-ID'), 'id');
assert.equal(detectLocale({ headers: new Headers({ 'CF-IPCountry': 'MY' }) }), 'ms');
assert.equal(detectLocale({ headers: new Headers({ 'CF-IPCountry': 'ID' }) }), 'id');
assert.match(greetingFor('Nadira', 'Aisyah', 'ms'), /boleh saya bantu/i);
assert.match(greetingFor('Nadira', 'Asep', 'id'), /bisa saya bantu/i);

// Migrasi harus menambahkan snapshot Seller/locale ke skema lama.
const db = new DatabaseSync(':memory:');
db.exec('CREATE TABLE conversations (id INTEGER PRIMARY KEY); CREATE TABLE orders (id INTEGER PRIMARY KEY); CREATE TABLE settings (skey TEXT PRIMARY KEY, svalue TEXT);');
db.prepare('INSERT INTO settings VALUES (?, ?)').run('rate_MYR', '4500');
db.exec(fs.readFileSync('migrations/011_seller_locale.sql', 'utf8'));
db.prepare("INSERT INTO orders (id, locale) VALUES (1, 'ms')").run();
db.exec(fs.readFileSync('migrations/012_malaysia_ringgit_display.sql', 'utf8'));
const convColumns = new Set(db.prepare('PRAGMA table_info(conversations)').all().map((row) => row.name));
const orderColumns = new Set(db.prepare('PRAGMA table_info(orders)').all().map((row) => row.name));
for (const name of ['account_type', 'locale']) assert.ok(convColumns.has(name), `Missing conversations.${name}`);
for (const name of ['quantity', 'unit_amount', 'unit_amount_idr', 'seller_discount', 'locale', 'display_currency', 'display_rate']) assert.ok(orderColumns.has(name), `Missing orders.${name}`);
const migratedOrder = db.prepare('SELECT display_currency, display_rate FROM orders WHERE id = 1').get();
assert.equal(migratedOrder.display_currency, 'MYR');
assert.equal(migratedOrder.display_rate, 4500);

console.log('seller-locale: diskon, nomor ID/MY, deteksi bahasa, sapaan AI, dan migrasi lulus');
