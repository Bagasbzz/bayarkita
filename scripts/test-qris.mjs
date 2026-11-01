// Uji lib QRIS: node scripts/test-qris.mjs  (lihat package.json "test")
import assert from 'node:assert/strict';
import { crc16, qrisError, qrisMerchant, toDynamicQris, parseTlv } from '../functions/_lib/qris.js';
import { defaultSettings } from '../functions/_lib/core.js';

// Vektor uji standar CRC-16/CCITT-FALSE.
assert.equal(crc16('123456789'), '29B1');

// Payload contoh berformat QRIS statis (merchant fiktif), CRC dihitung di sini.
const t = (tag, v) => tag + String(v.length).padStart(2, '0') + v;
const body = t('00', '01') + t('01', '11')
  + t('26', t('00', 'ID.DANA.WWW') + t('01', '936009150000000001') + t('02', '0000000001') + t('03', 'UMI'))
  + t('51', t('00', 'ID.CO.QRIS.WWW') + t('02', 'ID1020000000000') + t('03', 'UMI'))
  + t('52', '4814') + t('53', '360') + t('58', 'ID') + t('59', 'Toko Contoh') + t('60', 'Kota Jakarta') + t('61', '10120')
  + '6304';
const sample = body + crc16(body);

assert.equal(qrisError(sample), '');
assert.equal(qrisMerchant(sample), 'Toko Contoh');
assert.match(qrisError(sample.slice(0, -1) + '0'), /CRC|rusak/);

const dyn = toDynamicQris(sample, 123456.4);
assert.equal(qrisError(dyn), '', 'payload dinamis harus valid');
const tags = parseTlv(dyn);
assert.equal(tags.find((t) => t.tag === '01').value, '12');
assert.equal(tags.find((t) => t.tag === '54').value, '123456');
const order = tags.map((t) => Number(t.tag));
assert.ok(order.indexOf(54) === order.indexOf(53) + 1, 'tag 54 tepat setelah 53');
assert.equal(tags.at(-1).tag, '63');

// Payload dinamis diproses ulang: nominal diganti, bukan ditambah.
const dyn2 = toDynamicQris(dyn, 5000);
assert.equal(parseTlv(dyn2).filter((t) => t.tag === '54').length, 1);
assert.equal(parseTlv(dyn2).find((t) => t.tag === '54').value, '5000');

assert.throws(() => toDynamicQris(sample, 0));
assert.throws(() => toDynamicQris(sample, Infinity));
assert.throws(() => toDynamicQris(sample, -5000));

// QR asli: payload dari gambar harus valid dan identitas merchant tidak berubah.
const original = defaultSettings().qris_payload;
assert.equal(qrisError(original), '');
const dynamic = toDynamicQris(original, 145000);
assert.equal(dynamic.slice(-4), 'E4EB');
assert.equal(qrisMerchant(dynamic), qrisMerchant(original));
for (const tag of ['26', '51', '52', '53', '58', '59', '60', '61']) {
  assert.equal(parseTlv(dynamic).find((x) => x.tag === tag)?.value,
    parseTlv(original).find((x) => x.tag === tag)?.value);
}
console.log('qris: semua tes lulus');
