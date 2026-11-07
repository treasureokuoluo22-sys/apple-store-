
export const CHECKOUT_CURRENCIES = ["USD", "GBP", "EUR"] as const;

export type CheckoutCurrency = (typeof CHECKOUT_CURRENCIES)[number];

export type CurrencyRates = {
  GBP: number | null;
  EUR: number | null;
};

export type ProductCurrencyPrices = {
  GBP: number | null;
  EUR: number | null;
};

export type ProductDiscountPrices = {
  USD: number | null;
  GBP: number | null;
  EUR: number | null;
};

export type CheckoutPricing = {
  price: number;
  regularPrice: number;
};

export function isCheckoutCurrency(value: unknown): value is CheckoutCurrency {
  return (
    typeof value === "string" &&
    CHECKOUT_CURRENCIES.includes(value as CheckoutCurrency)
  );
}

export function parseCurrencyRate(value: unknown): number | null {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const rate = Number(value);

  if (!Number.isFinite(rate) || rate <= 0) {
    return null;
  }

  return rate;
}

export function parseCurrencyPrice(value: unknown): number | null {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const price = Number(value);

  if (!Number.isFinite(price) || price < 0) {
    return null;
  }

  return price;
}

export function getCheckoutPrice(
  usdPrice: number,
  currency: CheckoutCurrency,
  rates: CurrencyRates,
  productPrices: ProductCurrencyPrices
): number | null {
  if (!Number.isFinite(usdPrice) || usdPrice < 0) {
    return null;
  }

  if (currency === "USD") {
    return usdPrice;
  }

  const productPrice = productPrices[currency];

  if (
    productPrice !== null &&
    Number.isFinite(productPrice) &&
    productPrice >= 0
  ) {
    return productPrice;
  }

  const rate = rates[currency];

  if (rate === null || !Number.isFinite(rate) || rate <= 0) {
    return null;
  }

  return Math.round((usdPrice * rate + Number.EPSILON) * 100) / 100;
}

export function getCheckoutPricing(
  usdPrice: number,
  currency: CheckoutCurrency,
  rates: CurrencyRates,
  productPrices: ProductCurrencyPrices,
  discountPrices: ProductDiscountPrices
): CheckoutPricing | null {
  const regularPrice = getCheckoutPrice(
    usdPrice,
    currency,
    rates,
    productPrices
  );

  if (regularPrice === null) {
    return null;
  }

  const discountPrice = discountPrices[currency];

  return discountPrice !== null &&
    Number.isFinite(discountPrice) &&
    discountPrice >= 0 &&
    discountPrice < regularPrice
    ? { price: discountPrice, regularPrice }
    : { price: regularPrice, regularPrice };
}

export function formatCurrency(
  amount: number,
  currency: CheckoutCurrency
): string {
  return new Intl.NumberFormat(
    currency === "GBP" ? "en-GB" : "en-US",
    {
      style: "currency",
      currency,
    }
  ).format(amount);
}
