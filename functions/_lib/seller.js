export const SELLER_DISCOUNT_PCT = 8;
export const SELLER_MIN_QUANTITY = 3;
export const MAX_ORDER_QUANTITY = 100;

export function sellerDiscount(accountType, quantity, unitTotal) {
  if (accountType !== 'seller' || quantity < SELLER_MIN_QUANTITY) return 0;
  return Math.round(Number(unitTotal) * quantity * SELLER_DISCOUNT_PCT / 100);
}
