import { isCheckoutCurrency, type CheckoutCurrency } from "@/lib/currency";

export const ORDER_CONFIRMATION_STORAGE_KEY = "store-order-confirmation";

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
  city: string;
  state: string;
  zipCode: string;
};

export function isOrderConfirmation(
  value: unknown
): value is OrderConfirmation {
  if (!value || typeof value !== "object") {
    return false;
  }

  const confirmation = value as Record<string, unknown>;

  return (
    typeof confirmation.orderNumber === "string" &&
    (confirmation.productId === undefined ||
      typeof confirmation.productId === "string") &&
    typeof confirmation.productName === "string" &&
    typeof confirmation.productPrice === "number" &&
    (confirmation.currencyCode === undefined ||
      isCheckoutCurrency(confirmation.currencyCode)) &&
    typeof confirmation.recipientName === "string" &&
    typeof confirmation.recipientEmail === "string" &&
    typeof confirmation.recipientPhone === "string" &&
    typeof confirmation.shippingAddress === "string" &&
    typeof confirmation.city === "string" &&
    typeof confirmation.state === "string" &&
    typeof confirmation.zipCode === "string"
  );
}
