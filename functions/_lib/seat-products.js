// Harga promo tetap untuk seat yang diundang ke email masing-masing.
// Nilai dari browser tidak dipercaya; API selalu mengambil harga dari katalog ini.
export const SEAT_PRODUCTS = {
  'claude-team-standard': { service_slug: 'claude', service_name: 'Claude', plan: 'Claude Team Standard Seat', amount: 257000 },
  'claude-team-premium': { service_slug: 'claude', service_name: 'Claude', plan: 'Claude Team Premium Seat', amount: 812000 },
  'chatgpt-business-standard': { service_slug: 'chatgpt', service_name: 'ChatGPT', plan: 'ChatGPT Business Standard Seat', amount: 73000 },
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

// Potongan harga USD hanya untuk paket tetap; nominal Custom tidak didiskon.
// Claude Pro juga dipakai sebagai dasar patungan, sehingga diskonnya dibagi empat
// agar jumlah potongan untuk satu grup sama dengan satu paket Claude Pro.
export const DISCOUNT_USD = { chatgpt: 2.12, claude: 3.56 };
export const CLAUDE_PLAN_DISCOUNT_USD = { Pro: 4.79, 'Max 5X': 9.12 };
export const DISCOUNT_MIN_USD = 20;

export function discountUsdForPlan(slug, plan) {
  slug = String(slug || '');
  plan = String(plan || '');
  if (slug === 'claude') {
    if (plan === 'Patungan Claude Pro (1/4)') return CLAUDE_PLAN_DISCOUNT_USD.Pro / 4;
    return CLAUDE_PLAN_DISCOUNT_USD[plan] || DISCOUNT_USD.claude;
  }
  return Object.hasOwn(DISCOUNT_USD, slug) ? DISCOUNT_USD[slug] : 0;
}

export function discountIdr(slug, plan, s) {
  const usd = discountUsdForPlan(slug, plan);
  const rate = Number(s.rate_USD);
  return usd > 0 && rate > 0 ? Math.round(usd * rate) : 0;
}

/** True bila paket tetap ini berhak diskon dolar. */
export function isPremiumPlan(slug, plan, amountIdr, s) {
  const rate = Number(s.rate_USD);
  if (String(plan || '') === 'Patungan Claude Pro (1/4)') return discountIdr(slug, plan, s) > 0;
  return discountIdr(slug, plan, s) > 0 && rate > 0 && amountIdr / rate > DISCOUNT_MIN_USD;
}

export function getPoProduct(key) {
  return Object.hasOwn(PO_PRODUCTS, String(key || '')) ? PO_PRODUCTS[key] : null;
}
