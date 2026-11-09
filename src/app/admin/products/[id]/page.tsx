import Link from "next/link";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { createClient } from "@/lib/supabase-server";
import ProductEditor from "../../ProductEditor";
import ProductDetailsEditor from "../../ProductDetailsEditor";

export const instant = false;

export default async function AdminProductPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await connection();
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    redirect("/admin/login");
  }

  const { data: product, error } = await supabase
    .from("products")
    .select(
      "id, name, description, recipient_name, price, price_gbp, price_eur, sale_price, sale_price_gbp, sale_price_eur, image_url, image_url_2, image_url_3, updated_at"
    )
    .eq("id", id)
    .eq("owner_id", user.id)
    .maybeSingle();

  return (
    <main className="min-h-screen bg-[#f5f5f7] px-5 py-12 text-[#1d1d1f]">
      <div className="mx-auto max-w-3xl">
        <Link
          href="/admin"
          className="text-sm font-medium text-neutral-600 hover:text-black"
        >
          ← Back to dashboard
        </Link>

        {error ? (
          <section className="mt-6 rounded-2xl bg-white p-6">
            <h1 className="text-2xl font-semibold">Could not load product</h1>
            <p className="mt-3 text-sm text-red-700">
              Apply the product currency prices and sale prices migrations, then
              check the products table permissions.
            </p>
          </section>
        ) : !product ? (
          <section className="mt-6 rounded-2xl bg-white p-6">
            <h1 className="text-2xl font-semibold">Product not found</h1>
            <p className="mt-3 text-sm text-neutral-600">
              This product may have been removed.
            </p>
          </section>
        ) : (
          <>
            <header className="mt-6 rounded-2xl bg-white p-6">
              <p className="text-sm font-medium text-neutral-500">
                Product settings
              </p>
              <h1 className="mt-2 text-3xl font-semibold">{product.name}</h1>
              {product.description && (
                <p className="mt-3 whitespace-pre-line text-neutral-600">
                  {product.description}
                </p>
              )}
              <p className="mt-4 text-sm">
                Customer checkout link:{" "}
                <Link
                  href={`/products/${product.id}`}
                  target="_blank"
                  className="font-medium text-blue-700 underline"
                >
                  /products/{product.id}
                </Link>
              </p>
            </header>

            <section className="mt-6 rounded-2xl bg-white p-6">
              <h2 className="text-xl font-semibold">Product details</h2>
              <ProductDetailsEditor
                product={{
                  id: product.id,
                  name: product.name,
                  description: product.description,
                  recipient_name: product.recipient_name,
                  image_url: product.image_url,
                  image_url_2: product.image_url_2,
                  image_url_3: product.image_url_3,
                }}
              />
            </section>

            <section className="mt-6 rounded-2xl bg-white p-6">
              <h2 className="text-xl font-semibold">Prices and discounts</h2>
              <ProductEditor
                product={{
                  id: product.id,
                  price: Number(product.price),
                  price_gbp:
                    product.price_gbp === null
                      ? null
                      : Number(product.price_gbp),
                  price_eur:
                    product.price_eur === null
                      ? null
                      : Number(product.price_eur),
                  sale_price:
                    product.sale_price === null
                      ? null
                      : Number(product.sale_price),
                  sale_price_gbp:
                    product.sale_price_gbp === null
                      ? null
                      : Number(product.sale_price_gbp),
                  sale_price_eur:
                    product.sale_price_eur === null
                      ? null
                      : Number(product.sale_price_eur),
                }}
              />
            </section>
          </>
        )}
      </div>
    </main>
  );
}
