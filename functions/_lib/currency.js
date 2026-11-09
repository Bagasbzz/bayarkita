import { normalizeLocale } from './i18n.js';

export const DEFAULT_MYR_RATE = 4400;

/** Mata uang tampilan pelanggan. Nilai pembukuan dan settlement tetap IDR. */
export function displayCurrency(locale) {
  return normalizeLocale(locale) === 'ms' ? 'MYR' : 'IDR';
}

/** Snapshot kurs IDR per 1 unit mata uang tampilan saat pesanan dibuat. */
export function displayRate(settings, locale) {
  if (displayCurrency(locale) !== 'MYR') return 1;
  const rate = Number(settings?.rate_MYR);
  return rate > 0 ? rate : DEFAULT_MYR_RATE;
}

export function idrToDisplay(idr, currency, rate) {
  const value = Number(idr) || 0;
  if (currency !== 'MYR') return Math.round(value);
  const divisor = Number(rate) > 0 ? Number(rate) : DEFAULT_MYR_RATE;
  return Math.round(value / divisor * 100) / 100;
}

export function fmtDisplayIdr(idr, currency, rate) {
  const value = idrToDisplay(idr, currency, rate);
  if (currency === 'MYR') return 'RM ' + value.toLocaleString('ms-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return 'Rp ' + Math.round(value).toLocaleString('id-ID');
}
