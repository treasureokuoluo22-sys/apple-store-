import OrdersList from "./OrdersList";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { createClient } from "@/lib/supabase-server";
import Link from "next/link";
import NewProductForm from "./NewProductForm";
import CustomerUploadSettings from "./CustomerUploadSettings";
import { createAdminClient } from "@/lib/supabase-admin";
import type { StoreOrder } from "./OrdersList";

export const instant = false;

export default async function AdminDashboardPage() {
  await connection();

  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    redirect("/admin/login");
  }

  const { data: baseProducts, error: productsError } = await supabase
    .from("products")
    .select("id, name, description, price, image_url, updated_at")
    .eq("owner_id", user.id)
    .order("updated_at", { ascending: false });

  type ProductPricing = {
    id: string;
    price_gbp: number | null;
    price_eur: number | null;
    sale_price: number | null;
    sale_price_gbp: number | null;
    sale_price_eur: number | null;
  };

  let productPricing: ProductPricing[] = [];
  let productPricingNotice = "";

  if (!productsError) {
    const fullPricingResult = await supabase
      .from("products")
      .select(
        "id, price_gbp, price_eur, sale_price, sale_price_gbp, sale_price_eur"
      )
      .eq("owner_id", user.id);

    if (!fullPricingResult.error) {
      productPricing = fullPricingResult.data.map((product) => ({
        id: product.id,
        price_gbp: product.price_gbp,
        price_eur: product.price_eur,
        sale_price: product.sale_price,
        sale_price_gbp: product.sale_price_gbp,
        sale_price_eur: product.sale_price_eur,
      }));
    } else if (
      /column (?:products\.)?sale_price(?:_gbp|_eur)? does not exist/i.test(
        fullPricingResult.error.message
      )
    ) {
      const regularPricingResult = await supabase
        .from("products")
        .select("id, price_gbp, price_eur")
        .eq("owner_id", user.id);

      if (!regularPricingResult.error) {
        productPricing = regularPricingResult.data.map((product) => ({
          id: product.id,
          price_gbp: product.price_gbp,
          price_eur: product.price_eur,
          sale_price: null,
          sale_price_gbp: null,
          sale_price_eur: null,
        }));
        productPricingNotice =
          "Sale prices are unavailable until the product sale prices migration is applied.";
      } else if (
        /column (?:products\.)?price_(?:gbp|eur) does not exist/i.test(
          regularPricingResult.error.message
        )
      ) {
        productPricingNotice =
          "Product prices are available in USD. Apply the product currency prices and sale prices migrations to enable the other price fields.";
      } else {
        console.error(
          "Could not load optional product prices:",
          regularPricingResult.error.message
        );
        productPricingNotice =
          "Product listings loaded, but optional prices could not be loaded. Check the products table permissions.";
      }
    } else if (
      /column (?:products\.)?price_(?:gbp|eur) does not exist/i.test(
        fullPricingResult.error.message
      )
    ) {
      productPricingNotice =
        "Product prices are available in USD. Apply the product currency prices and sale prices migrations to enable the other price fields.";
    } else {
      console.error(
        "Could not load optional product prices:",
        fullPricingResult.error.message
      );
      productPricingNotice =
        "Product listings loaded, but optional prices could not be loaded. Check the products table permissions.";
    }
  }

  const pricingByProductId = new Map(
    productPricing.map((pricing) => [pricing.id, pricing])
  );
  const products = (baseProducts ?? []).map((product) => ({
    ...product,
    sale_price: pricingByProductId.get(product.id)?.sale_price ?? null,
  }));

  let orders: StoreOrder[] = [];
  let ordersErrorMessage: string | null = null;
  const productIds = (baseProducts ?? []).map((product) => product.id);

  if (productIds.length > 0) {
    try {
      const adminSupabase = createAdminClient();
      const { data: loadedOrders, error: ordersError } = await adminSupabase
        .from("orders")
        .select(
          "id, order_number, product_id, product_name, product_price, customer_name, customer_email, customer_phone, recipient_name, shipping_address, apartment, city, state, zip_code, country, landmark, delivery_instructions, preferred_delivery_time, gift_card_image_path, status, created_at"
        )
        .in("product_id", productIds)
        .order("created_at", { ascending: false });

      if (ordersError) {
        console.error("Could not load customer orders:", ordersError.message);
        ordersErrorMessage = ordersError.message;
      } else {
        orders = await Promise.all(
          (loadedOrders ?? []).map(async (order) => {
            const { gift_card_image_path: productPhotoPath, ...orderDetails } =
              order;
            let product_photo_url: string | null = null;
            let product_photo_error: string | null = null;

            if (productPhotoPath) {
              const photoBuckets = [
                "customer-uploads",
                "order-product-photos",
              ] as const;
              const photoErrors: string[] = [];

              for (const bucket of photoBuckets) {
                const { data, error } = await adminSupabase.storage
                  .from(bucket)
                  .createSignedUrl(productPhotoPath, 60 * 60);

                if (error) {
                  photoErrors.push(`${bucket}: ${error.message}`);
                  continue;
                }

                product_photo_url = data.signedUrl;
                break;
              }

              if (!product_photo_url && photoErrors.length > 0) {
                product_photo_error = photoErrors.join("; ");
                console.error(
                  `Could not load product photo for order ${order.order_number}:`,
                  product_photo_error
                );
              }
            }

            return {
              ...orderDetails,
              product_photo_url,
              product_photo_error,
            };
          })
        );
      }
    } catch (error) {
      ordersErrorMessage =
        error instanceof Error
          ? error.message
          : "Could not initialize the secure orders connection.";
      console.error("Could not initialize secure customer order access:", error);
    }
  }

  return (
    <main className="min-h-screen bg-[#f5f5f7] px-5 py-12 text-[#1d1d1f]">
      <div className="mx-auto max-w-4xl">
        <p className="text-sm font-medium text-neutral-500">
          Apple Store · Management
        </p>

        <h1 className="mt-3 text-3xl font-semibold tracking-tight">
          Admin dashboard
        </h1>

        <p className="mt-3 text-neutral-600">
          Signed in as {user.email}. You manage your own products and orders.
        </p>

        <section className="mt-8 rounded-2xl border border-black/5 bg-white p-6">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-xl font-semibold">Product catalog</h2>
              <p className="mt-2 text-sm text-neutral-600">
                Manage every product and its unique customer checkout link from
                this dashboard.
              </p>
            </div>
            <span className="text-sm text-neutral-500">
              {products?.length ?? 0} products
            </span>
          </div>

          {productsError ? (
            <p className="mt-5 rounded-xl bg-red-50 p-4 text-sm text-red-700">
              Could not load products. Check that the products table and its
              required columns exist and that the admin has permission to read
              it.
            </p>
          ) : productPricingNotice ? (
            <p
              role="status"
              className="mt-5 rounded-xl bg-amber-50 p-4 text-sm text-amber-900"
            >
              {productPricingNotice}
            </p>
          ) : null}

          {!productsError && products.length > 0 && (
            <ul className="mt-5 divide-y divide-neutral-200">
              {products.map((product) => (
                <li
                  key={product.id}
                  className="flex flex-col gap-4 py-5 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="flex min-w-0 items-center gap-4">
                    <div
                      aria-hidden="true"
                      className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl bg-neutral-100 text-xl font-semibold text-neutral-500"
                    >
                      {product.name.slice(0, 1).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <h3 className="truncate font-semibold">{product.name}</h3>
                      <p className="mt-1 text-sm text-neutral-600">
                        USD{" "}
                        {product.sale_price !== null &&
                        Number(product.sale_price) < Number(product.price) ? (
                          <>
                            <span className="line-through">
                              {Number(product.price).toFixed(2)}
                            </span>{" "}
                            <span className="font-semibold text-[#bf4800]">
                              {Number(product.sale_price).toFixed(2)}
                            </span>
                          </>
                        ) : (
                          Number(product.price).toFixed(2)
                        )}
                      </p>
                      <code className="mt-1 block truncate text-xs text-neutral-500">
                        /products/{product.id}
                      </code>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-3">
                    <Link
                      href={`/products/${product.id}`}
                      target="_blank"
                      className="rounded-xl border border-neutral-300 px-4 py-2 text-sm font-medium hover:bg-neutral-50"
                    >
                      Open checkout link
                    </Link>
                    <Link
                      href={`/admin/products/${product.id}`}
                      className="rounded-xl bg-[#1d1d1f] px-4 py-2 text-sm font-medium text-white hover:bg-black"
                    >
                      Edit product
                    </Link>
                  </div>
                </li>
              ))}
            </ul>
          )}

          {!productsError && !productPricingNotice && !products.length ? (
            <p className="mt-5 text-sm text-neutral-600">
              No products yet. Add your first product below.
            </p>
          ) : null}
        </section>

        <NewProductForm />

        <div className="mt-10">
          <h2 className="mb-5 text-2xl font-semibold">
            Customer orders
          </h2>

          {ordersErrorMessage ? (
            <p className="rounded-xl bg-red-50 p-4 text-sm text-red-700">
              Could not load customer orders: {ordersErrorMessage}
            </p>
          ) : (
            <OrdersList orders={orders} />
          )}
        </div>
        <CustomerUploadSettings />

        <form action="/admin/logout" method="post" className="mt-6">
          <button
            type="submit"
            className="rounded-xl bg-[#1d1d1f] px-5 py-3 text-sm font-medium text-white hover:bg-black"
          >
            Sign out
          </button>
        </form>
      </div>
    </main>
  );
}