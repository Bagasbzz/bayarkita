// Harga promo tetap untuk seat yang diundang ke email masing-masing.
// Nilai dari browser tidak dipercaya; API selalu mengambil harga dari katalog ini.
export const SEAT_PRODUCTS = {
  'claude-team-standard': { service_slug: 'claude', service_name: 'Claude', plan: 'Claude Team Standard Seat', amount: 257000 },
  'claude-team-premium': { service_slug: 'claude', service_name: 'Claude', plan: 'Claude Team Premium Seat', amount: 812000 },
  'chatgpt-business-standard': { service_slug: 'chatgpt', service_name: 'ChatGPT', plan: 'ChatGPT Business Standard Seat', amount: 58000 },
  'chatgpt-business-premium': { service_slug: 'chatgpt', service_name: 'ChatGPT', plan: 'ChatGPT Business Premium Seat', amount: 316000 },
};

// Patungan paket umum per peserta; 4 pembeli membiayai 1 paket untuk 4 pengguna.
export const PO_PRODUCTS = {
  // Derived from the existing public plan presets: Claude Pro $22.20 / 4,
  // ChatGPT Plus Rp349.000 / 4. Patungan adds a Rp5.000 participant fee.
  'claude-pro-po-4': { service_slug: 'claude', service_name: 'Claude', plan: 'Patungan Claude Pro (1/4)', amount: 5.55, currency: 'USD', full_price: 22.2 },
  'chatgpt-plus-po-4': { service_slug: 'chatgpt', service_name: 'ChatGPT', plan: 'Patungan ChatGPT Plus (1/4)', amount: 87250, currency: 'IDR', full_price: 349000 },
};

export function getSeatProduct(key) {
  return Object.hasOwn(SEAT_PRODUCTS, String(key || '')) ? SEAT_PRODUCTS[key] : null;
}

// Potongan harga per layanan (USD), berlaku untuk semua paket tetap (preset, seat,
// patungan); tidak berlaku untuk nominal Custom. Dikonversi ke rupiah dengan kurs USD.
export const DISCOUNT_USD = { chatgpt: 2.12, claude: 3.56 };

export function discountIdr(slug, s) {
  const usd = Object.hasOwn(DISCOUNT_USD, String(slug || '')) ? DISCOUNT_USD[slug] : 0;
  const rate = Number(s.rate_USD);
  return usd > 0 && rate > 0 ? Math.round(usd * rate) : 0;
}

export function getPoProduct(key) {
  return Object.hasOwn(PO_PRODUCTS, String(key || '')) ? PO_PRODUCTS[key] : null;
}
