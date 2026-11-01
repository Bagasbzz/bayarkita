/**
 * QRIS dinamis dari QRIS statis (standar EMVCo MPM yang dipakai QRIS Indonesia).
 *
 * Payload QRIS = deretan TLV: [tag 2 digit][panjang 2 digit][nilai].
 * Untuk membuat QR "langsung terisi nominal":
 *   1. Tag 01 (Point of Initiation) diubah dari "11" (statis) ke "12" (dinamis).
 *   2. Tag 54 (Transaction Amount) disisipkan dengan total pembayaran.
 *   3. Tag 63 (CRC) dihitung ulang: CRC-16/CCITT-FALSE atas seluruh payload + "6304".
 *
 * Catatan: ini tetap QRIS merchant yang sama (dana masuk ke akun yang sama);
 * konfirmasi pembayaran tetap manual oleh admin karena tidak ada webhook.
 */

const enc = new TextEncoder();

/** CRC-16/CCITT-FALSE (poly 0x1021, init 0xFFFF), hasil 4 hex uppercase. */
export function crc16(str) {
  let crc = 0xffff;
  for (const byte of enc.encode(str)) {
    crc ^= byte << 8;
    for (let i = 0; i < 8; i++) crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}

/** Pecah payload menjadi [{tag, value}]. Melempar Error bila format rusak. */
export function parseTlv(payload) {
  const out = [];
  let i = 0;
  while (i < payload.length) {
    const tag = payload.slice(i, i + 2);
    const lenStr = payload.slice(i + 2, i + 4);
    if (!/^\d{2}$/.test(tag) || !/^\d{2}$/.test(lenStr)) throw new Error(`TLV tidak valid di posisi ${i}`);
    const len = Number(lenStr);
    const value = payload.slice(i + 4, i + 4 + len);
    if (value.length !== len) throw new Error(`Panjang tag ${tag} tidak sesuai`);
    out.push({ tag, value });
    i += 4 + len;
  }
  return out;
}

const tlv = (tag, value) => tag + String(value.length).padStart(2, '0') + value;

/** Validasi payload QRIS: format TLV, header EMV, dan CRC. Mengembalikan pesan error atau ''. */
export function qrisError(payload) {
  const p = String(payload || '').trim();
  if (!p) return 'Payload QRIS kosong.';
  if (!p.startsWith('000201')) return 'Payload bukan QRIS/EMV (harus diawali 000201).';
  let items;
  try { items = parseTlv(p); } catch (e) { return 'Format QRIS rusak: ' + e.message; }
  if (/[^\x20-\x7E]/.test(p)) return 'Payload QRIS harus berisi karakter ASCII.';
  if (new Set(items.map((x) => x.tag)).size !== items.length) return 'Tag QRIS duplikat.';
  const get = (tag) => items.find((x) => x.tag === tag)?.value;
  if (!['11', '12'].includes(get('01'))) return 'Jenis QRIS (tag 01) tidak valid.';
  if (get('53') !== '360' || get('58') !== 'ID') return 'QRIS harus menggunakan Rupiah dan negara Indonesia.';
  const last = items[items.length - 1];
  if (!last || last.tag !== '63' || last.value.length !== 4) return 'Tag CRC (63) tidak ditemukan di akhir payload.';
  if (crc16(p.slice(0, -4)).toUpperCase() !== last.value.toUpperCase()) return 'CRC QRIS tidak cocok, payload kemungkinan salah salin.';
  return '';
}

/** Nama merchant (tag 59) untuk ditampilkan di halaman invoice. */
export function qrisMerchant(payload) {
  try { return (parseTlv(String(payload).trim()).find((x) => x.tag === '59') || {}).value || ''; } catch (_) { return ''; }
}

/**
 * Ubah QRIS statis menjadi dinamis dengan nominal `amount` (Rupiah, dibulatkan).
 * Urutan tag dipertahankan; tag 54 disisipkan sebelum tag pertama yang nomornya > 54.
 */
export function toDynamicQris(staticPayload, amount) {
  const p = String(staticPayload).trim();
  const err = qrisError(p);
  if (err) throw new Error(err);
  const value = String(Math.round(Number(amount)));
  if (!/^\d{1,13}$/.test(value) || value === '0') throw new Error('Nominal QRIS tidak valid.');

  const items = parseTlv(p).filter((x) => x.tag !== '63' && x.tag !== '54');
  for (const x of items) if (x.tag === '01') x.value = '12';
  const at = items.findIndex((x) => Number(x.tag) > 54);
  items.splice(at === -1 ? items.length : at, 0, { tag: '54', value });

  const body = items.map((x) => tlv(x.tag, x.value)).join('') + '6304';
  return body + crc16(body);
}
