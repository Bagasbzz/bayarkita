/** Locale publik: Indonesia (id) dan Bahasa Melayu Malaysia (ms). */
export const SUPPORTED_LOCALES = ['id', 'ms'];

export function normalizeLocale(value, fallback = 'id') {
  const v = String(value || '').trim().toLowerCase().replace('_', '-');
  if (v === 'ms' || v.startsWith('ms-')) return 'ms';
  if (v === 'id' || v.startsWith('id-') || v === 'in' || v.startsWith('in-')) return 'id';
  return fallback;
}

function cookieLocale(request) {
  const cookie = request.headers.get('Cookie') || '';
  const part = cookie.split(';').map((x) => x.trim()).find((x) => x.startsWith('goisiinn_locale='));
  return part ? normalizeLocale(part.slice('goisiinn_locale='.length), '') : '';
}

/** Prioritas: pilihan eksplisit -> cookie -> negara Cloudflare -> Accept-Language. */
export function detectLocale(request, preferred = '') {
  const explicit = normalizeLocale(preferred, '');
  if (explicit) return explicit;
  const saved = cookieLocale(request);
  if (saved) return saved;
  const country = String(request.cf?.country || request.headers.get('CF-IPCountry') || '').toUpperCase();
  if (country === 'MY') return 'ms';
  if (country === 'ID') return 'id';
  return normalizeLocale(request.headers.get('Accept-Language'), 'id');
}

export const countryForLocale = (locale) => normalizeLocale(locale) === 'ms' ? 'MY' : 'ID';

const TEXT = {
  id: {
    server_error: 'Terjadi kesalahan pada server.',
    connected: (agent) => `Anda terhubung dengan ${agent}.`,
    static_greeting: 'Halo! Ada yang bisa kami bantu? Tulis pesan Anda di sini, admin akan membalas secepatnya.',
    order_auto_reply: 'Terima kasih, pesanan Anda sudah kami terima. Silakan selesaikan pembayaran lewat halaman invoice, lalu konfirmasi ke admin melalui chat web.',
    seller_upgraded: 'Akun Seller Anda sudah aktif. Diskon 8% berlaku otomatis untuk pemesanan minimal 3 produk dalam satu checkout.',
    invalid_phone: 'Nomor WhatsApp Indonesia atau Malaysia tidak valid.',
  },
  ms: {
    server_error: 'Ralat telah berlaku pada pelayan.',
    connected: (agent) => `Anda telah disambungkan dengan ${agent}.`,
    static_greeting: 'Hai! Ada yang boleh kami bantu? Tulis mesej anda di sini dan admin akan membalas secepat mungkin.',
    order_auto_reply: 'Terima kasih, pesanan anda telah kami terima. Sila lengkapkan pembayaran melalui halaman invois, kemudian sahkan kepada admin melalui chat web.',
    seller_upgraded: 'Akaun Seller anda kini aktif. Diskaun 8% digunakan secara automatik untuk pesanan minimum 3 produk dalam satu checkout.',
    invalid_phone: 'Nombor WhatsApp Indonesia atau Malaysia tidak sah.',
  },
};

export function tr(locale, key, ...args) {
  const lang = normalizeLocale(locale);
  const value = TEXT[lang]?.[key] ?? TEXT.id[key] ?? key;
  return typeof value === 'function' ? value(...args) : value;
}
