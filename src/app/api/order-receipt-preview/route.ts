import { createAdminClient } from "@/lib/supabase-admin";

type ReceiptLookup = {
  orderNumber: string;
  customerEmail: string;
  customerPhone: string;
  customerName: string;
};

function isReceiptLookup(value: unknown): value is ReceiptLookup {
  if (!value || typeof value !== "object") return false;
  const item = value as Record<string, unknown>;

  return (
    typeof item.orderNumber === "string" &&
    /^\d{1,12}$/.test(item.orderNumber) &&
    typeof item.customerEmail === "string" &&
    item.customerEmail.length <= 254 &&
    (item.customerEmail === "" ||
      /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(item.customerEmail)) &&
    typeof item.customerPhone === "string" &&
    item.customerPhone.trim().length > 0 &&
    item.customerPhone.length <= 50 &&
    typeof item.customerName === "string" &&
    item.customerName.trim().length > 0 &&
    item.customerName.length <= 200
  );
}

export async function POST(request: Request) {
  let payload: unknown;

  try {
    payload = await request.json();
  } catch {
    return Response.json({ error: "Invalid request." }, { status: 400 });
  }

  if (!isReceiptLookup(payload)) {
    return Response.json({ error: "Invalid request." }, { status: 400 });
  }

  const adminSupabase = createAdminClient();
  let orderQuery = adminSupabase
    .from("orders")
    .select("gift_card_image_path")
    .eq("order_number", Number(payload.orderNumber))
    .eq("customer_name", payload.customerName.trim())
    .eq("customer_phone", payload.customerPhone.trim())
    .limit(1);
  if (payload.customerEmail.trim()) {
    orderQuery = orderQuery.eq("customer_email", payload.customerEmail.trim());
  }
  const { data: order, error: orderError } = await orderQuery.maybeSingle();

  if (orderError) {
    console.error("Could not look up receipt preview:", orderError.message);
    return Response.json(
      { error: "Could not load the receipt preview." },
      { status: 500 }
    );
  }

  if (!order?.gift_card_image_path) {
    return Response.json(
      { error: "Receipt preview not found." },
      { status: 404 }
    );
  }

  const bucketErrors: string[] = [];
  for (const bucket of ["customer-uploads", "order-product-photos"] as const) {
    const { data, error } = await adminSupabase.storage
      .from(bucket)
      .createSignedUrl(order.gift_card_image_path, 60 * 60);

    if (error) {
      bucketErrors.push(`${bucket}: ${error.message}`);
      continue;
    }

    return Response.json(
      { url: data.signedUrl },
      { headers: { "Cache-Control": "no-store" } }
    );
  }

  console.error("Could not sign order receipt preview:", bucketErrors);
  return Response.json(
    { error: "Could not load the receipt preview." },
    { status: 404 }
  );
}
