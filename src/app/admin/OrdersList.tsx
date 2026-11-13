
"use client";

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
  status: string;
  created_at: string;
  product_photo_url: string | null;
  product_photo_error: string | null;
};

export default function OrdersList({
  orders,
}: {
  orders: StoreOrder[];
}) {
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
        These are simulated orders only. No payments are collected, and no
        shipments are created.
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
                <strong>Payment status:</strong> No payment collected (demo)
              </p>
            </div>

            <div className="mt-5 border-t border-neutral-200 pt-5">
              <h4 className="font-semibold">Customer product photo</h4>
              {order.product_photo_url ? (
                <a
                  href={order.product_photo_url}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-3 inline-block"
                >
                  <img
                    src={order.product_photo_url}
                    alt={`Product photo submitted for order ${order.order_number}`}
                    referrerPolicy="no-referrer"
                    loading="lazy"
                    className="max-h-96 max-w-full rounded-xl object-contain"
                  />
                </a>
              ) : order.product_photo_error ? (
                <p role="alert" className="mt-3 text-sm text-red-700">
                  The product photo could not be loaded:{" "}
                  {order.product_photo_error}
                </p>
              ) : (
                <p className="mt-2 text-sm text-neutral-600">
                  No product photo was submitted.
                </p>
              )}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
