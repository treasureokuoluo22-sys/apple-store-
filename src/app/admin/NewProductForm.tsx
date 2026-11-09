"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase-browser";
import {
  getCheckoutPrice,
  parseCurrencyPrice,
  parseCurrencyRate,
} from "@/lib/currency";
import {
  uploadProductImages,
  validateProductImage,
} from "@/lib/product-images";

const fieldClassName =
  "w-full rounded-xl border border-neutral-300 px-4 py-3 font-normal outline-none focus:border-neutral-800";

export default function NewProductForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [recipientName, setRecipientName] = useState("");
  const [photoFiles, setPhotoFiles] = useState<(File | null)[]>([
    null,
    null,
    null,
  ]);
  const photoPreviews = useMemo(
    () =>
      photoFiles.map((file) => (file ? URL.createObjectURL(file) : null)),
    [photoFiles]
  );
  const [price, setPrice] = useState("");
  const [priceGbp, setPriceGbp] = useState("");
  const [priceEur, setPriceEur] = useState("");
  const [salePrice, setSalePrice] = useState("");
  const [salePriceGbp, setSalePriceGbp] = useState("");
  const [salePriceEur, setSalePriceEur] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [createdProduct, setCreatedProduct] = useState<{
    id: string;
    checkoutUrl: string;
  } | null>(null);
  const [copyMessage, setCopyMessage] = useState("");

  useEffect(
    () => () => {
      photoPreviews.forEach((preview) => {
        if (preview) URL.revokeObjectURL(preview);
      });
    },
    [photoPreviews]
  );

  async function copyCheckoutLink(checkoutUrl: string) {
    try {
      await navigator.clipboard.writeText(checkoutUrl);
      setCopyMessage("Checkout link copied to clipboard.");
    } catch (error) {
      console.error("Could not copy product checkout link:", error);
      setCopyMessage(
        "The link could not be copied automatically. Select and copy the URL below."
      );
    }
  }

  async function createProduct(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    const parsedPrice = parseCurrencyPrice(price.trim());
    const parsedPriceGbp = parseCurrencyPrice(priceGbp.trim());
    const parsedPriceEur = parseCurrencyPrice(priceEur.trim());
    const parsedSalePrice = parseCurrencyPrice(salePrice.trim());
    const parsedSalePriceGbp = parseCurrencyPrice(salePriceGbp.trim());
    const parsedSalePriceEur = parseCurrencyPrice(salePriceEur.trim());

    if (
      !name.trim() ||
      parsedPrice === null ||
      (priceGbp.trim() !== "" && parsedPriceGbp === null) ||
      (priceEur.trim() !== "" && parsedPriceEur === null) ||
      (salePrice.trim() !== "" && parsedSalePrice === null) ||
      (salePriceGbp.trim() !== "" && parsedSalePriceGbp === null) ||
      (salePriceEur.trim() !== "" && parsedSalePriceEur === null)
    ) {
      setMessage("Enter a product name and valid non-negative prices.");
      return;
    }

    const invalidFile = photoFiles.find(
      (file): file is File =>
        file !== null && validateProductImage(file) !== null
    );
    if (invalidFile) {
      setMessage(validateProductImage(invalidFile) ?? "Invalid product photo.");
      return;
    }

    if (parsedSalePrice !== null && parsedSalePrice >= parsedPrice) {
      setMessage("The USD sale price must be lower than its regular price.");
      return;
    }

    if (
      parsedPriceGbp !== null &&
      parsedSalePriceGbp !== null &&
      parsedSalePriceGbp >= parsedPriceGbp
    ) {
      setMessage("The GBP sale price must be lower than its regular price.");
      return;
    }

    if (
      parsedPriceEur !== null &&
      parsedSalePriceEur !== null &&
      parsedSalePriceEur >= parsedPriceEur
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

      const needsExchangeRates =
        (parsedSalePriceGbp !== null && parsedPriceGbp === null) ||
        (parsedSalePriceEur !== null && parsedPriceEur === null);
      let rates = { GBP: null as number | null, EUR: null as number | null };

      if (needsExchangeRates) {
        const { data: settings, error: settingsError } = await supabase
          .from("store_settings")
          .select("usd_to_gbp, usd_to_eur")
          .eq("id", 1)
          .maybeSingle();

        if (settingsError) {
          console.error(
            "Could not validate sale prices against exchange rates:",
            settingsError.message
          );
          setMessage(
            "Could not verify the GBP/EUR sale price. Set a fixed regular price for that currency or check the configured exchange rates."
          );
          return;
        }

        rates = {
          GBP: parseCurrencyRate(settings?.usd_to_gbp),
          EUR: parseCurrencyRate(settings?.usd_to_eur),
        };
      }

      const regularGbpPrice = getCheckoutPrice(
        parsedPrice,
        "GBP",
        rates,
        { GBP: parsedPriceGbp, EUR: parsedPriceEur }
      );
      const regularEurPrice = getCheckoutPrice(
        parsedPrice,
        "EUR",
        rates,
        { GBP: parsedPriceGbp, EUR: parsedPriceEur }
      );

      if (
        parsedSalePriceGbp !== null &&
        (regularGbpPrice === null || parsedSalePriceGbp >= regularGbpPrice)
      ) {
        setMessage(
          "The GBP sale price must be lower than its fixed or converted regular price."
        );
        return;
      }

      if (
        parsedSalePriceEur !== null &&
        (regularEurPrice === null || parsedSalePriceEur >= regularEurPrice)
      ) {
        setMessage(
          "The EUR sale price must be lower than its fixed or converted regular price."
        );
        return;
      }

      const { data, error } = await supabase
        .from("products")
        .insert({
          owner_id: authData.user.id,
          name: name.trim(),
          description: description.trim(),
          recipient_name: recipientName.trim() || null,
          price: parsedPrice,
          price_gbp: parsedPriceGbp,
          price_eur: parsedPriceEur,
          sale_price: parsedSalePrice,
          sale_price_gbp: parsedSalePriceGbp,
          sale_price_eur: parsedSalePriceEur,
        })
        .select("id")
        .single();

      if (error) {
        console.error("Could not create product:", error.message);
        const missingColumnMatch = error.message.match(
          /column (?:products\.)?([a-z_]+) does not exist|could not find the ['"]([a-z_]+)['"] column/i
        );
        const missingColumn =
          missingColumnMatch?.[1] ?? missingColumnMatch?.[2];
        setMessage(
          missingColumn
            ? `Could not create the product because the "${missingColumn}" column is missing. Apply the relevant product migrations, then try again.`
            : "Could not create the product. Check the products table insert policy and required fields."
        );
        return;
      }

      const { id } = data;
      const checkoutUrl = `${window.location.origin}/products/${id}`;
      setCreatedProduct({ id, checkoutUrl });

      if (photoFiles.some(Boolean)) {
        const { urls, paths } = await uploadProductImages(
          supabase,
          photoFiles,
          authData.user.id,
          id
        );
        const { data: photoUpdate, error: photoUpdateError } = await supabase
          .from("products")
          .update({
            image_url: urls[0],
            image_url_2: urls[1],
            image_url_3: urls[2],
          })
          .eq("id", id)
          .select("id")
          .maybeSingle();

        if (photoUpdateError || !photoUpdate) {
          const { error: cleanupError } = await supabase.storage
            .from("product-images")
            .remove(paths);
          if (cleanupError) {
            console.error(
              "Could not clean up product photos after saving failed:",
              cleanupError.message
            );
          }
          if (photoUpdateError) {
            console.error(
              "Could not save product photos:",
              photoUpdateError.message
            );
          }
          setMessage(
            "Product created, but its photos could not be saved. Check the product image columns, admin update policy, and storage migration, then add photos from the product editor."
          );
        }
      }

    } catch (error) {
      console.error("Could not create product:", error);
      setMessage(
        error instanceof Error
          ? error.message
          : "Something went wrong while creating the product."
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="mt-8 rounded-2xl border border-black/5 bg-white p-6">
      <h2 className="text-lg font-semibold">Add a product</h2>
      <p className="mt-2 text-sm text-neutral-600">
        Set up the product and its checkout price in one place.
      </p>

      {createdProduct ? (
        <div className="mt-5 rounded-xl border border-green-200 bg-green-50 p-4">
          <p className="font-medium text-green-900">Product created.</p>
          {copyMessage && (
            <p role="status" className="mt-1 text-sm text-green-800">
              {copyMessage}
            </p>
          )}
          <label className="mt-4 block space-y-2 text-sm font-medium">
            Customer checkout link
            <input
              readOnly
              value={createdProduct.checkoutUrl}
              onFocus={(event) => event.currentTarget.select()}
              className={fieldClassName}
            />
          </label>
          <div className="mt-4 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => void copyCheckoutLink(createdProduct.checkoutUrl)}
              className="rounded-xl bg-[#1d1d1f] px-4 py-2 text-sm font-medium text-white hover:bg-black"
            >
              Copy to clipboard
            </button>
            <button
              type="button"
              onClick={() =>
                router.push(`/admin/products/${createdProduct.id}`)
              }
              className="rounded-xl border border-neutral-300 px-4 py-2 text-sm font-medium hover:bg-white"
            >
              Continue editing product
            </button>
            <button
              type="button"
              onClick={() => {
                setName("");
                setDescription("");
                setRecipientName("");
                setPhotoFiles([null, null, null]);
                setPrice("");
                setPriceGbp("");
                setPriceEur("");
                setSalePrice("");
                setSalePriceGbp("");
                setSalePriceEur("");
                setCreatedProduct(null);
                setCopyMessage("");
              }}
              className="rounded-xl border border-neutral-300 px-4 py-2 text-sm font-medium hover:bg-white"
            >
              Add another product
            </button>
          </div>
        </div>
      ) : (
      <form onSubmit={createProduct} className="mt-5 grid gap-4 sm:grid-cols-2">
        <label className="space-y-2 text-sm font-medium">
          Product name
          <input
            required
            value={name}
            onChange={(event) => setName(event.target.value)}
            className="w-full rounded-xl border border-neutral-300 px-4 py-3 font-normal outline-none focus:border-neutral-800"
          />
        </label>

        <label className="space-y-2 text-sm font-medium">
          Regular USD price
          <input
            required
            type="number"
            min="0"
            step="0.01"
            inputMode="decimal"
            value={price}
            onChange={(event) => setPrice(event.target.value)}
            className={fieldClassName}
          />
        </label>

        <label className="space-y-2 text-sm font-medium sm:col-span-2">
          Description
          <textarea
            rows={3}
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            className={fieldClassName}
          />
        </label>

        <label className="space-y-2 text-sm font-medium sm:col-span-2">
          Recipient name shown at checkout
          <input
            value={recipientName}
            onChange={(event) => setRecipientName(event.target.value)}
            placeholder="Leave blank for the customer to enter a name"
            className={fieldClassName}
          />
          <span className="block font-normal text-neutral-600">
            This name will appear in the customer&apos;s “Buy for” section and
            prefill the recipient name field. Customers can still edit it.
          </span>
        </label>

        <fieldset className="space-y-4 sm:col-span-2">
          <legend className="text-sm font-semibold">Product photos</legend>
          <p className="text-sm text-neutral-600">
            Upload up to three JPG, PNG, or WebP photos, up to 5 MB each.
          </p>
          {photoFiles.map((file, index) => {
            const id = `new-product-photo-url-${index + 1}`;

            return (
              <label key={id} className="block space-y-2 text-sm font-medium">
                Photo {index + 1}
                <input
                  id={id}
                  key={`${id}-${file?.name ?? "empty"}`}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={(event) => {
                    const selectedFile = event.target.files?.[0] ?? null;
                    setPhotoFiles((currentFiles) =>
                      currentFiles.map((currentFile, photoIndex) =>
                        photoIndex === index ? selectedFile : currentFile
                      )
                    );
                  }}
                  className="block w-full text-sm file:mr-4 file:rounded-lg file:border-0 file:bg-neutral-100 file:px-4 file:py-2 file:font-medium"
                />
                {photoPreviews[index] && (
                  <img
                    src={photoPreviews[index]}
                    alt={`Selected product photo ${index + 1} preview`}
                    className="mt-3 h-28 w-28 rounded-lg border border-neutral-200 object-contain"
                  />
                )}
                {file && (
                  <span className="block text-xs font-normal text-neutral-500">
                    {file.name}
                  </span>
                )}
              </label>
            );
          })}
        </fieldset>

        <fieldset className="space-y-4 sm:col-span-2">
          <legend className="text-sm font-semibold">Prices and discounts</legend>
          <p className="text-sm text-neutral-600">
            USD regular price is required. Leave GBP or EUR regular prices
            blank to use their configured exchange rates. Sale prices are
            optional and must be lower than the regular price.
          </p>

          <div className="grid gap-4 sm:grid-cols-3">
            {[
              {
                currency: "USD",
                regular: price,
                setRegular: setPrice,
                sale: salePrice,
                setSale: setSalePrice,
                regularRequired: true,
                regularPlaceholder: "",
              },
              {
                currency: "GBP",
                regular: priceGbp,
                setRegular: setPriceGbp,
                sale: salePriceGbp,
                setSale: setSalePriceGbp,
                regularRequired: false,
                regularPlaceholder: "Use exchange rate",
              },
              {
                currency: "EUR",
                regular: priceEur,
                setRegular: setPriceEur,
                sale: salePriceEur,
                setSale: setSalePriceEur,
                regularRequired: false,
                regularPlaceholder: "Use exchange rate",
              },
            ].map((item) => (
              <div key={item.currency} className="space-y-3">
                <label
                  htmlFor={`new-product-price-${item.currency.toLowerCase()}`}
                  className="block space-y-2 text-sm font-medium"
                >
                  {item.currency} regular price
                  <input
                    id={`new-product-price-${item.currency.toLowerCase()}`}
                    type="number"
                    min="0"
                    step="0.01"
                    inputMode="decimal"
                    required={item.regularRequired}
                    value={item.regular}
                    onChange={(event) => item.setRegular(event.target.value)}
                    placeholder={item.regularPlaceholder}
                    className={fieldClassName}
                  />
                </label>
                <label
                  htmlFor={`new-product-sale-price-${item.currency.toLowerCase()}`}
                  className="block space-y-2 text-sm font-medium"
                >
                  {item.currency} sale price
                  <input
                    id={`new-product-sale-price-${item.currency.toLowerCase()}`}
                    type="number"
                    min="0"
                    step="0.01"
                    inputMode="decimal"
                    value={item.sale}
                    onChange={(event) => item.setSale(event.target.value)}
                    placeholder="No discount"
                    className={fieldClassName}
                  />
                </label>
              </div>
            ))}
          </div>
        </fieldset>

        <button
          type="submit"
          disabled={saving}
          className="w-fit rounded-xl bg-[#1d1d1f] px-5 py-3 text-sm font-medium text-white hover:bg-black disabled:cursor-not-allowed disabled:opacity-60"
        >
          {saving ? "Creating…" : "Create product"}
        </button>
      </form>
      )}

      {message && (
        <p role="status" className="mt-4 text-sm text-neutral-700">
          {message}
        </p>
      )}
    </section>
  );
}
