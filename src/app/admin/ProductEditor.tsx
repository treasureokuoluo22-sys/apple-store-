"use client";

import { useState, type FormEvent } from "react";
import { createClient } from "@/lib/supabase-browser";
import { parseCurrencyPrice } from "@/lib/currency";

type EditableProduct = {
  id: string;
  price: number;
  price_gbp: number | null;
  price_eur: number | null;
  sale_price: number | null;
  sale_price_gbp: number | null;
  sale_price_eur: number | null;
};

export default function ProductEditor({
  product,
}: {
  product: EditableProduct;
}) {
  const [usdPrice, setUsdPrice] = useState(String(product.price));
  const [gbpPrice, setGbpPrice] = useState(
    product.price_gbp === null ? "" : String(product.price_gbp)
  );
  const [eurPrice, setEurPrice] = useState(
    product.price_eur === null ? "" : String(product.price_eur)
  );
  const [usdSalePrice, setUsdSalePrice] = useState(
    product.sale_price === null ? "" : String(product.sale_price)
  );
  const [gbpSalePrice, setGbpSalePrice] = useState(
    product.sale_price_gbp === null ? "" : String(product.sale_price_gbp)
  );
  const [eurSalePrice, setEurSalePrice] = useState(
    product.sale_price_eur === null ? "" : String(product.sale_price_eur)
  );
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  async function savePrices(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");

    const parsedUsdPrice = parseCurrencyPrice(usdPrice.trim());
    const parsedGbpPrice = parseCurrencyPrice(gbpPrice.trim());
    const parsedEurPrice = parseCurrencyPrice(eurPrice.trim());
    const parsedUsdSalePrice = parseCurrencyPrice(usdSalePrice.trim());
    const parsedGbpSalePrice = parseCurrencyPrice(gbpSalePrice.trim());
    const parsedEurSalePrice = parseCurrencyPrice(eurSalePrice.trim());

    if (
      parsedUsdPrice === null ||
      (gbpPrice.trim() !== "" && parsedGbpPrice === null) ||
      (eurPrice.trim() !== "" && parsedEurPrice === null) ||
      (usdSalePrice.trim() !== "" && parsedUsdSalePrice === null) ||
      (gbpSalePrice.trim() !== "" && parsedGbpSalePrice === null) ||
      (eurSalePrice.trim() !== "" && parsedEurSalePrice === null)
    ) {
      setMessage(
        "Enter valid non-negative prices, or leave optional currency and sale prices blank."
      );
      return;
    }

    if (
      parsedUsdSalePrice !== null &&
      parsedUsdSalePrice >= parsedUsdPrice
    ) {
      setMessage("The USD sale price must be lower than its regular price.");
      return;
    }

    if (
      parsedGbpPrice !== null &&
      parsedGbpSalePrice !== null &&
      parsedGbpSalePrice >= parsedGbpPrice
    ) {
      setMessage("The GBP sale price must be lower than its regular price.");
      return;
    }

    if (
      parsedEurPrice !== null &&
      parsedEurSalePrice !== null &&
      parsedEurSalePrice >= parsedEurPrice
    ) {
      setMessage("The EUR sale price must be lower than its regular price.");
      return;
    }

    setSaving(true);

    try {
      const supabase = createClient();
      const { data: authData, error: authError } =
        await supabase.auth.getUser();

      if (authError || !authData.user) {
        setMessage("Your session expired. Please sign in again.");
        return;
      }

      const { data, error } = await supabase
        .from("products")
        .update({
          price: parsedUsdPrice,
          price_gbp: parsedGbpPrice,
          price_eur: parsedEurPrice,
          sale_price: parsedUsdSalePrice,
          sale_price_gbp: parsedGbpSalePrice,
          sale_price_eur: parsedEurSalePrice,
        })
        .eq("id", product.id)
        .select("id")
        .maybeSingle();

      if (error) {
        console.error("Could not save product prices:", error.message);
        setMessage(
          "Could not save prices. Apply the product currency prices and sale prices migrations, then check the admin product update policy."
        );
        return;
      }

      if (!data) {
        setMessage(
          "No product was updated. Check that the product exists and your admin update policy allows it."
        );
        return;
      }

      setMessage("Product prices saved.");
    } catch (error) {
      console.error("Could not save product prices:", error);
      setMessage("Something went wrong while saving product prices.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={savePrices} className="mt-5 space-y-4">
      <p className="text-sm leading-6 text-neutral-600">
        Set the regular price and an optional lower sale price for each
        currency. Leave a regular GBP or EUR price blank to use its exchange
        rate; leave a sale price blank when there is no discount.
      </p>

      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <div className="space-y-3">
            <label
              htmlFor="product-price-usd"
              className="block text-sm font-medium"
            >
              USD regular price
            </label>
            <input
              id="product-price-usd"
              type="number"
              min="0"
              step="0.01"
              inputMode="decimal"
              required
              value={usdPrice}
              onChange={(event) => setUsdPrice(event.target.value)}
              className="w-full rounded-xl border border-neutral-300 px-4 py-3 outline-none focus:border-neutral-800"
            />
            <label
              htmlFor="product-sale-price-usd"
              className="block text-sm font-medium"
            >
              USD sale price
            </label>
            <input
              id="product-sale-price-usd"
              type="number"
              min="0"
              step="0.01"
              inputMode="decimal"
              value={usdSalePrice}
              onChange={(event) => setUsdSalePrice(event.target.value)}
              placeholder="No discount"
              className="w-full rounded-xl border border-neutral-300 px-4 py-3 outline-none focus:border-neutral-800"
            />
          </div>
        </div>

        <div>
          <div className="space-y-3">
            <label
              htmlFor="product-price-gbp"
              className="block text-sm font-medium"
            >
              GBP regular price
            </label>
            <input
              id="product-price-gbp"
              type="number"
              min="0"
              step="0.01"
              inputMode="decimal"
              value={gbpPrice}
              onChange={(event) => setGbpPrice(event.target.value)}
              placeholder="Use exchange rate"
              className="w-full rounded-xl border border-neutral-300 px-4 py-3 outline-none focus:border-neutral-800"
            />
            <label
              htmlFor="product-sale-price-gbp"
              className="block text-sm font-medium"
            >
              GBP sale price
            </label>
            <input
              id="product-sale-price-gbp"
              type="number"
              min="0"
              step="0.01"
              inputMode="decimal"
              value={gbpSalePrice}
              onChange={(event) => setGbpSalePrice(event.target.value)}
              placeholder="No discount"
              className="w-full rounded-xl border border-neutral-300 px-4 py-3 outline-none focus:border-neutral-800"
            />
          </div>
        </div>

        <div>
          <div className="space-y-3">
            <label
              htmlFor="product-price-eur"
              className="block text-sm font-medium"
            >
              EUR regular price
            </label>
            <input
              id="product-price-eur"
              type="number"
              min="0"
              step="0.01"
              inputMode="decimal"
              value={eurPrice}
              onChange={(event) => setEurPrice(event.target.value)}
              placeholder="Use exchange rate"
              className="w-full rounded-xl border border-neutral-300 px-4 py-3 outline-none focus:border-neutral-800"
            />
            <label
              htmlFor="product-sale-price-eur"
              className="block text-sm font-medium"
            >
              EUR sale price
            </label>
            <input
              id="product-sale-price-eur"
              type="number"
              min="0"
              step="0.01"
              inputMode="decimal"
              value={eurSalePrice}
              onChange={(event) => setEurSalePrice(event.target.value)}
              placeholder="No discount"
              className="w-full rounded-xl border border-neutral-300 px-4 py-3 outline-none focus:border-neutral-800"
            />
          </div>
        </div>
      </div>

      <button
        type="submit"
        disabled={saving}
        className="rounded-xl bg-[#1d1d1f] px-5 py-3 text-sm font-medium text-white hover:bg-black disabled:cursor-not-allowed disabled:opacity-60"
      >
        {saving ? "Saving…" : "Save product prices"}
      </button>

      {message && (
        <p role="status" className="text-sm text-neutral-700">
          {message}
        </p>
      )}
    </form>
  );
}