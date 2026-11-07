
"use client";

import { useState } from "react";

export type StoreOrder = {
  id: string;
  order_number: number;
  product_name: string;
  product_price: number;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  recipient_name: string | null;
  shipping_address: string;
  apartment: string | null;
  city: string;
  state: string;
  zip_code: string;
  country: string;
  landmark: string | null;
  delivery_instructions: string | null;
  preferred_delivery_time: string | null;
  gift_card_image_path: string | null;
  status: string;
  payment_status: string;
  created_at: string;
  gift_card_image_url: string | null;
  gift_card_image_error: string | null;
};

export default function OrdersList({
  orders,
}: {
  orders: StoreOrder[];
}) {
  const [selectedImages, setSelectedImages] = useState<
    Record<string, boolean>
  >({});

  if (orders.length === 0) {
    return (
      <section className="mt-8 rounded-2xl border border-black/5 bg-white p-6">
        <h2 className="text-lg font-semibold">Customer orders</h2>
        <p className="mt-3 text-sm text-neutral-600">
          No orders have been submitted yet.
        </p>
      </section>
    );
  }

  return (
    <section className="mt-8 rounded-2xl border border-black/5 bg-white p-6">
      <h2 className="text-xl font-semibold">Customer orders</h2>

      <p className="mt-2 text-sm text-neutral-500">
        Review submitted orders and their payment receipt attachments.
        Uploaded images do not confirm payment.
      </p>

      <div className="mt-6 space-y-6">
        {orders.map((order) => (
          <article
            key={order.id}
            className="rounded-xl border border-neutral-200 p-5"
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h3 className="font-semibold">
                Order #{order.order_number}
              </h3>

              <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-800">
                {order.status}
              </span>
            </div>

            <p className="mt-2 text-xs text-neutral-500">
              {new Date(order.created_at).toLocaleString()}
            </p>

            <div className="mt-5 grid gap-5 sm:grid-cols-2">
              <div className="space-y-2 text-sm">
                <h4 className="font-semibold">Buy for</h4>
                <p>{order.recipient_name || order.customer_name}</p>
                <p>{order.customer_email}</p>
                <p>{order.customer_phone}</p>
              </div>

              <div className="space-y-2 text-sm">
                <h4 className="font-semibold">Recipient delivery address</h4>
                <p>{order.shipping_address}</p>
                {order.apartment && <p>{order.apartment}</p>}
                <p>
                  {order.city}, {order.state} {order.zip_code}
                </p>
                <p>{order.country}</p>
                {order.landmark && <p>Landmark: {order.landmark}</p>}
                {order.preferred_delivery_time && (
                  <p>Preferred time: {order.preferred_delivery_time}</p>
                )}
                {order.delivery_instructions && (
                  <p>Instructions: {order.delivery_instructions}</p>
                )}
              </div>
            </div>

            <div className="mt-5 border-t border-neutral-200 pt-4 text-sm">
              <p>
                <strong>Product:</strong> {order.product_name}
              </p>
              <p className="mt-1">
                <strong>Price:</strong>{" "}
                {new Intl.NumberFormat("en-US", {
                  style: "currency",
                  currency: "USD",
                }).format(Number(order.product_price))}
              </p>
              <p className="mt-1">
                <strong>Payment status:</strong> {order.payment_status}
              </p>
            </div>

            <div className="mt-6 border-t border-neutral-200 pt-6">
  <h4 className="text-base font-semibold text-neutral-900">
    Payment receipt image
  </h4>

  {order.gift_card_image_url ? (
    <div className="mt-4 rounded-2xl border border-neutral-200 bg-white p-4">
      <img
        src={order.gift_card_image_url}
        alt={`Payment receipt for order ${order.order_number}`}
        className="w-full rounded-xl object-contain"
      />

      <p className="mt-3 text-xs text-neutral-500">
        Uploaded by the customer for manual review.
      </p>
    </div>
  ) : order.gift_card_image_error ? (
    <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4">
      <p className="text-sm text-amber-900">
        The receipt image could not be loaded: {order.gift_card_image_error}
      </p>
    </div>
  ) : (
    <div className="mt-4 rounded-2xl border border-dashed border-neutral-300 bg-neutral-50 p-6 text-center">
      <p className="text-sm font-medium text-neutral-700">
        No payment receipt image submitted.
      </p>
    </div>
  )}
</div>
    

  <p className="mt-3 text-xs text-neutral-500">
    Images are for manual review only. They do not confirm payment
    or redemption.
  </p>

          </article>
        ))}
      </div>
    </section>
  );
}
