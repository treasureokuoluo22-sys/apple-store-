import {
  isCheckoutCurrency,
  type CheckoutCurrency,
} from "@/lib/currency";

export const ORDER_CONFIRMATION_STORAGE_KEY =
  "store-demo-order-confirmation";
export const DEMO_REVIEW_DURATION_MS = 20_000;

export function createDemoReviewDeadline() {
  return Date.now() + DEMO_REVIEW_DURATION_MS;
}

export type OrderConfirmation = {
  orderNumber: string;
  productId?: string;
  productName: string;
  productPrice: number;
  currencyCode?: CheckoutCurrency;
  recipientName: string;
  recipientEmail: string;
  recipientPhone: string;
  shippingAddress: string;
  apartment?: string;
  city: string;
  state: string;
  zipCode: string;
  country?: string;
  reviewEndsAt?: number;
  receiptPhotoKey?: string;
};

export function isOrderConfirmation(
  value: unknown
): value is OrderConfirmation {
  if (!value || typeof value !== "object") return false;

  const item = value as Record<string, unknown>;

  return (
    typeof item.orderNumber === "string" &&
    item.orderNumber.length > 0 &&
    (item.productId === undefined ||
      typeof item.productId === "string") &&
    typeof item.productName === "string" &&
    typeof item.productPrice === "number" &&
    Number.isFinite(item.productPrice) &&
    (item.currencyCode === undefined ||
      isCheckoutCurrency(item.currencyCode)) &&
    typeof item.recipientName === "string" &&
    typeof item.recipientEmail === "string" &&
    typeof item.recipientPhone === "string" &&
    typeof item.shippingAddress === "string" &&
    (item.apartment === undefined ||
      typeof item.apartment === "string") &&
    typeof item.city === "string" &&
    typeof item.state === "string" &&
    typeof item.zipCode === "string" &&
    (item.country === undefined ||
      typeof item.country === "string") &&
    (item.reviewEndsAt === undefined ||
      (typeof item.reviewEndsAt === "number" &&
        Number.isFinite(item.reviewEndsAt))) &&
    (item.receiptPhotoKey === undefined ||
      typeof item.receiptPhotoKey === "string")
  );
}