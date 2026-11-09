
"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import {
  ORDER_CONFIRMATION_STORAGE_KEY,
} from "@/lib/order-confirmation";
import { saveOrderConfirmationPhoto } from "@/lib/order-confirmation-photo";
import {
  formatCurrency,
  getCheckoutPricing,
  isCheckoutCurrency,
  parseCurrencyPrice,
  parseCurrencyRate,
  type CheckoutCurrency,
  type CurrencyRates,
} from "@/lib/currency";

type Product = {
  id: string;
  name: string;
  description: string;
  recipient_name: string | null;
  price: number;
  price_gbp: number | null;
  price_eur: number | null;
  sale_price: number | null;
  sale_price_gbp: number | null;
  sale_price_eur: number | null;
  image_url: string | null;
  image_url_2: string | null;
  image_url_3: string | null;
};

type LoadedProduct = {
  id: string;
  name: string;
  description: string;
  recipient_name?: string | null;
  price: number | string;
  price_gbp?: number | string | null;
  price_eur?: number | string | null;
  sale_price?: number | string | null;
  sale_price_gbp?: number | string | null;
  sale_price_eur?: number | string | null;
  image_url: string | null;
  image_url_2: string | null;
  image_url_3: string | null;
};

const defaultProduct: Product = {
  id: "",
  name: "iPhone Pro",
  description: "Powerful performance. Beautifully designed.",
  recipient_name: null,
  price: 999,
  price_gbp: null,
  price_eur: null,
  sale_price: null,
  sale_price_gbp: null,
  sale_price_eur: null,
  image_url: null,
  image_url_2: null,
  image_url_3: null,
};

const inputClassName =
  "h-12 w-full rounded-xl border border-neutral-300 bg-white px-4 text-base text-[#1d1d1f] outline-none transition placeholder:text-neutral-500 focus:border-[#0071e3] focus:ring-2 focus:ring-blue-100";

function PhoneArtwork() {
  return (
    <div
      className="phone-scene"
      aria-label="Illustration of a premium smartphone"
    >
      <div className="phone-shadow" />
      <div className="phone">
        <div className="phone-frame">
          <div className="phone-screen">
            <div className="dynamic-island" />
            <div className="phone-orb orb-one" />
            <div className="phone-orb orb-two" />
            <div className="phone-orb orb-three" />
            <div className="screen-caption">PRO</div>
          </div>
        </div>
      </div>
      <div className="artwork-caption">Designed to stand out.</div>
    </div>
  );
}

export default function CheckoutPage({ productId }: { productId: string }) {
  const router = useRouter();
  const [product, setProduct] = useState<Product>(defaultProduct);
  const [productLoadError, setProductLoadError] = useState("");
  const [failedProductImages, setFailedProductImages] = useState<
    Record<string, boolean>
  >({});
  const [activeProductImage, setActiveProductImage] = useState(0);
  const [showCheckout, setShowCheckout] = useState(false);
  const [showOrderSummary, setShowOrderSummary] = useState(false);
  const [currencyRates, setCurrencyRates] = useState<CurrencyRates>({
    GBP: null,
    EUR: null,
  });
  const [currencyRatesLoaded, setCurrencyRatesLoaded] = useState(false);
  const [currencyRatesError, setCurrencyRatesError] = useState("");
  const [selectedCurrency, setSelectedCurrency] =
    useState<CheckoutCurrency>("USD");
  const productGalleryRef = useRef<HTMLDivElement>(null);
  const checkoutRef = useRef<HTMLElement>(null);
  const receiptCameraRef = useRef<HTMLVideoElement>(null);
  const receiptCameraStreamRef = useRef<MediaStream | null>(null);
  const [receiptCameraActive, setReceiptCameraActive] = useState(false);
  const [receiptCameraError, setReceiptCameraError] = useState("");
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [receiptPreviewUrl, setReceiptPreviewUrl] = useState<string | null>(
    null
  );

  const [recipientName, setRecipientName] = useState("");
  const [recipientEmail, setRecipientEmail] = useState("");
  const [recipientPhone, setRecipientPhone] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [zipCode, setZipCode] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [orderError, setOrderError] = useState("");

  const productImages = [
    product.image_url,
    product.image_url_2,
    product.image_url_3,
  ].filter(
    (imageUrl): imageUrl is string =>
      Boolean(imageUrl) && !failedProductImages[imageUrl as string]
  );

  const selectedPricing = getCheckoutPricing(
    product.price,
    selectedCurrency,
    currencyRates,
    {
      GBP: product.price_gbp,
      EUR: product.price_eur,
    },
    {
      USD: product.sale_price,
      GBP: product.sale_price_gbp,
      EUR: product.sale_price_eur,
    }
  );
  const selectedPrice = selectedPricing?.price ?? null;
  const hasSelectedDiscount =
    selectedPricing !== null &&
    selectedPricing.price < selectedPricing.regularPrice;

  useEffect(() => {
    let active = true;

    async function loadProduct() {
      let productQuery = supabase
        .from("products")
        .select(
          "id, name, description, recipient_name, price, price_gbp, price_eur, sale_price, sale_price_gbp, sale_price_eur, image_url, image_url_2, image_url_3"
        );
      if (productId) {
        productQuery = productQuery.eq("id", productId);
      }
      const initialResult = await productQuery
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      let data: LoadedProduct | null = initialResult.data;
      let error = initialResult.error;
      let recipientNameUnavailable = false;
      let currencyPricesUnavailable = false;
      let discountPricesUnavailable = false;

      if (
        error &&
        /column (?:products\.)?recipient_name does not exist/i.test(
          error.message
        )
      ) {
        console.warn(
          "Product recipient names are unavailable. Apply the product recipient name migration."
        );
        let legacyRecipientQuery = supabase
          .from("products")
          .select(
            "id, name, description, price, price_gbp, price_eur, sale_price, sale_price_gbp, sale_price_eur, image_url, image_url_2, image_url_3"
          );
        if (productId) {
          legacyRecipientQuery = legacyRecipientQuery.eq("id", productId);
        }
        const legacyRecipientResult = await legacyRecipientQuery
          .order("updated_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        data = legacyRecipientResult.data;
        error = legacyRecipientResult.error;
        recipientNameUnavailable = !error;
      }

      if (
        error &&
        /column (?:products\.)?sale_price(?:_gbp|_eur)? does not exist/i.test(
          error.message
        )
      ) {
        console.warn(
          "Product sale-price columns are missing. Apply the product sale prices migration."
        );
        let regularPriceResult;
        if (recipientNameUnavailable) {
          let regularPriceQuery = supabase
            .from("products")
            .select(
              "id, name, description, price, price_gbp, price_eur, image_url, image_url_2, image_url_3"
            );
          if (productId) {
            regularPriceQuery = regularPriceQuery.eq("id", productId);
          }
          regularPriceResult = await regularPriceQuery
            .order("updated_at", { ascending: false })
            .limit(1)
            .maybeSingle();
        } else {
          let regularPriceQuery = supabase
            .from("products")
            .select(
              "id, name, description, recipient_name, price, price_gbp, price_eur, image_url, image_url_2, image_url_3"
            );
          if (productId) {
            regularPriceQuery = regularPriceQuery.eq("id", productId);
          }
          regularPriceResult = await regularPriceQuery
            .order("updated_at", { ascending: false })
            .limit(1)
            .maybeSingle();
        }
        data = regularPriceResult.data;
        error = regularPriceResult.error;
        discountPricesUnavailable = !error;
      }

      if (
        error &&
        /column (?:products\.)?price_(?:gbp|eur) does not exist/i.test(
          error.message
        )
      ) {
        console.warn(
          "Product currency-price columns are missing. Apply the product currency prices migration."
        );
        let legacyResult;
        if (recipientNameUnavailable) {
          let legacyQuery = supabase
            .from("products")
            .select(
              "id, name, description, price, image_url, image_url_2, image_url_3"
            );
          if (productId) {
            legacyQuery = legacyQuery.eq("id", productId);
          }
          legacyResult = await legacyQuery
            .order("updated_at", { ascending: false })
            .limit(1)
            .maybeSingle();
        } else {
          let legacyQuery = supabase
            .from("products")
            .select(
              "id, name, description, recipient_name, price, image_url, image_url_2, image_url_3"
            );
          if (productId) {
            legacyQuery = legacyQuery.eq("id", productId);
          }
          legacyResult = await legacyQuery
            .order("updated_at", { ascending: false })
            .limit(1)
            .maybeSingle();
        }

        data = legacyResult.data;
        error = legacyResult.error;
        currencyPricesUnavailable = !error;
        discountPricesUnavailable = !error;
      }

      if (!active) return;

      if (error) {
        console.error("Could not load product:", error.message);
        setProductLoadError(
          "Product information could not be loaded from the database."
        );
        return;
      }

      if (data) {
        const configuredRecipientName = recipientNameUnavailable
          ? null
          : data.recipient_name?.trim() || null;
        setProduct({
          id: data.id,
          name: data.name,
          description: data.description,
          recipient_name: configuredRecipientName,
          price: Number(data.price),
          price_gbp: currencyPricesUnavailable
            ? null
            : parseCurrencyPrice(data.price_gbp),
          price_eur: currencyPricesUnavailable
            ? null
            : parseCurrencyPrice(data.price_eur),
          sale_price: discountPricesUnavailable
            ? null
            : parseCurrencyPrice(data.sale_price),
          sale_price_gbp: discountPricesUnavailable
            ? null
            : parseCurrencyPrice(data.sale_price_gbp),
          sale_price_eur: discountPricesUnavailable
            ? null
            : parseCurrencyPrice(data.sale_price_eur),
          image_url: data.image_url,
          image_url_2: data.image_url_2,
          image_url_3: data.image_url_3,
        });
        setRecipientName(configuredRecipientName ?? "");
        setProductLoadError("");
      } else {
        setProductLoadError(
          productId
            ? "This product link could not be found. Check the link or contact the store administrator."
            : "No product is currently available."
        );
      }
    }

    void loadProduct();

    return () => {
      active = false;
    };
  }, [productId]);

  useEffect(() => {
    let active = true;

    async function loadCurrencyRates() {
      const { data, error } = await supabase
        .from("store_settings")
        .select("usd_to_gbp, usd_to_eur")
        .eq("id", 1)
        .maybeSingle();

      if (!active) return;

      if (error) {
        console.error("Could not load checkout currency rates:", error.message);
        setCurrencyRatesError(
          "Exchange rates could not be loaded. Admin-set GBP/EUR prices may still be available; USD remains available."
        );
      } else if (data) {
        setCurrencyRates({
          GBP: parseCurrencyRate(data.usd_to_gbp),
          EUR: parseCurrencyRate(data.usd_to_eur),
        });
        setCurrencyRatesError("");
      } else {
        setCurrencyRatesError(
          "No exchange rates are configured. Admin-set GBP/EUR prices may still be available; USD remains available."
        );
      }

      setCurrencyRatesLoaded(true);
    }

    void loadCurrencyRates();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (showCheckout) {
      checkoutRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [showCheckout]);

  useEffect(() => {
    if (receiptCameraActive && receiptCameraRef.current) {
      receiptCameraRef.current.srcObject = receiptCameraStreamRef.current;
      void receiptCameraRef.current.play().catch((error: unknown) => {
        console.error("Could not start receipt camera preview:", error);
        setReceiptCameraError(
          "The camera preview could not start. Check camera permission and try again."
        );
      });
    }
  }, [receiptCameraActive]);

  useEffect(
    () => () => {
      receiptCameraStreamRef.current?.getTracks().forEach((track) => {
        track.stop();
      });
    },
    []
  );

  useEffect(
    () => () => {
      if (receiptPreviewUrl) URL.revokeObjectURL(receiptPreviewUrl);
    },
    [receiptPreviewUrl]
  );

  function stopReceiptCamera() {
    receiptCameraStreamRef.current?.getTracks().forEach((track) => {
      track.stop();
    });
    receiptCameraStreamRef.current = null;
    setReceiptCameraActive(false);
  }

  async function startReceiptCamera() {
    setReceiptCameraError("");

    if (!navigator.mediaDevices?.getUserMedia) {
      setReceiptCameraError(
        "Camera capture is unavailable in this browser. Use a supported browser over HTTPS or localhost."
      );
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: { facingMode: { ideal: "environment" } },
      });
      receiptCameraStreamRef.current = stream;
      setReceiptCameraActive(true);
    } catch (error) {
      console.error("Could not access receipt camera:", error);
      setReceiptCameraError(
        "Could not access the camera. Allow camera permission and try again."
      );
    }
  }

  async function captureReceiptPhoto() {
    const video = receiptCameraRef.current;

    if (!video || video.videoWidth === 0 || video.videoHeight === 0) {
      setReceiptCameraError(
        "The camera is not ready yet. Wait for the preview, then try again."
      );
      return;
    }

    const canvas = document.createElement("canvas");
    const scale = Math.min(
      1,
      1600 / Math.max(video.videoWidth, video.videoHeight)
    );
    canvas.width = Math.round(video.videoWidth * scale);
    canvas.height = Math.round(video.videoHeight * scale);

    const context = canvas.getContext("2d");

    if (!context) {
      setReceiptCameraError("The camera photo could not be captured.");
      return;
    }

    context.drawImage(video, 0, 0, canvas.width, canvas.height);

    const photo = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, "image/jpeg", 0.85);
    });

    if (!photo) {
      setReceiptCameraError("The camera photo could not be saved.");
      return;
    }

    setReceiptFile(
      new File([photo], `payment-receipt-${Date.now()}.jpg`, {
        type: "image/jpeg",
      })
    );

    setReceiptPreviewUrl(URL.createObjectURL(photo));
    setReceiptCameraError("");
    stopReceiptCamera();
  }

  async function submitOrder(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setOrderError("");

    if (!product.id) {
      setOrderError(
        "The product has not loaded from the database. Please refresh and try again."
      );
      return;
    }

    if (selectedPrice === null) {
      setOrderError(
        "The selected currency has no configured product price or exchange rate. Choose another currency or contact the store administrator."
      );
      return;
    }

    if (!receiptFile) {
      setOrderError("Take a photo of your payment receipt before continuing.");
      return;
    }

    if (!["image/jpeg", "image/png", "image/webp"].includes(receiptFile.type)) {
      setOrderError("The receipt photo must be a JPG, PNG, or WebP image.");
      return;
    }

    if (receiptFile.size > 5 * 1024 * 1024) {
      setOrderError("The receipt photo must be 5 MB or smaller.");
      return;
    }

    setSubmitting(true);

    try {
      const extensionByType: Record<string, string> = {
        "image/jpeg": "jpg",
        "image/png": "png",
        "image/webp": "webp",
      };

      const path = `submissions/${crypto.randomUUID()}.${extensionByType[receiptFile.type]}`;

      const { error: uploadError } = await supabase.storage
        .from("customer-uploads")
        .upload(path, receiptFile, {
          contentType: receiptFile.type,
          upsert: false,
        });

      if (uploadError) {
        console.error("Checkout receipt upload failed:", uploadError);
        throw new Error(`Receipt photo upload failed: ${uploadError.message}`);
      }

      const { data, error } = await supabase.rpc("submit_store_order", {
        p_product_id: product.id,
        p_customer_name: recipientName.trim(),
        p_customer_email: recipientEmail.trim(),
        p_customer_phone: recipientPhone.trim(),
        p_shipping_address: address.trim(),
        p_apartment: null,
        p_city: city.trim(),
        p_state: state.trim(),
        p_zip_code: zipCode.trim(),
        p_gift_card_image_path: path,
        p_landmark: null,
        p_delivery_instructions: null,
        p_recipient_name: recipientName.trim(),
        p_alternative_phone: null,
        p_preferred_delivery_time: null,
      });

      if (error) {
        console.error("Order submission failed:", error.message);
        throw new Error(
          "Your order could not be submitted. Please check your details and try again."
        );
      }

      try {
        try {
          await saveOrderConfirmationPhoto(String(data), receiptFile);
        } catch (photoStorageError) {
          console.error(
            "Could not transfer the captured receipt photo to the confirmation page:",
            photoStorageError
          );
        }

        sessionStorage.setItem(
          ORDER_CONFIRMATION_STORAGE_KEY,
          JSON.stringify({
            orderNumber: String(data),
            productId: product.id,
            productName: product.name,
            productPrice: selectedPrice,
            currencyCode: selectedCurrency,
            recipientName: recipientName.trim(),
            recipientEmail: recipientEmail.trim(),
            recipientPhone: recipientPhone.trim(),
            shippingAddress: address.trim(),
            city: city.trim(),
            state: state.trim(),
            zipCode: zipCode.trim(),
          })
        );
      } catch (storageError) {
        console.error("Could not save order confirmation:", storageError);
        setOrderError(
          "Your order was submitted, but this browser could not save the receipt details. Please contact the store administrator and do not submit the order again."
        );
        return;
      }

      router.push("/order-confirmation");
    } catch (error) {
      setOrderError(
        error instanceof Error
          ? error.message
          : "Something went wrong while submitting your order."
      );
    } finally {
      setSubmitting(false);
    }
  }

  function openCheckout() {
    setShowCheckout(true);
  }

  if (showCheckout) {
    return (
      <main
        ref={checkoutRef}
        className="min-h-screen bg-white text-[#1d1d1f]"
      >
        <nav className="bg-[#333336] text-white">
          <div className="mx-auto flex h-10 max-w-6xl items-center justify-between gap-5 overflow-x-auto px-6 text-xs text-white/85">
            <span className="shrink-0 text-lg" aria-label="Apple Store">
              
            </span>
            <span>Mac</span>
            <span>iPad</span>
            <span>iPhone</span>
            <span>Watch</span>
            <span>TV</span>
            <span>Music</span>
            <span>Support</span>
            <span className="shrink-0">Bag</span>
          </div>
        </nav>

        <div className="mx-auto max-w-5xl px-6 pb-16">
          <div className="flex items-center justify-between border-b border-neutral-200 py-3">
            <h1 className="text-xl font-semibold">Checkout</h1>
            <button
              type="button"
              onClick={() => setShowOrderSummary((visible) => !visible)}
              className="text-sm font-medium text-[#06c] hover:underline"
              aria-expanded={showOrderSummary}
            >
              {showOrderSummary ? "Hide" : "Show"} Order Summary:{" "}
              {formatCurrency(selectedPrice ?? product.price, selectedCurrency)}
            </button>
          </div>

          {showOrderSummary && (
            <div className="border-b border-neutral-200 py-5 text-sm">
              <div className="flex justify-between gap-4">
                <span>{product.name} · Quantity 1</span>
                <span className="flex flex-col items-end font-semibold">
                  {hasSelectedDiscount && selectedPricing && (
                    <span className="text-sm font-normal text-neutral-500 line-through">
                      {formatCurrency(
                        selectedPricing.regularPrice,
                        selectedCurrency
                      )}
                    </span>
                  )}
                  <span>
                    {formatCurrency(
                      selectedPrice ?? product.price,
                      selectedCurrency
                    )}
                  </span>
                </span>
              </div>
              <div className="mt-3 flex justify-between border-t border-neutral-200 pt-3 font-semibold">
                <span>Total</span>
                <span className="flex flex-col items-end">
                  {hasSelectedDiscount && selectedPricing && (
                    <span className="text-sm font-normal text-neutral-500 line-through">
                      {formatCurrency(
                        selectedPricing.regularPrice,
                        selectedCurrency
                      )}
                    </span>
                  )}
                  {formatCurrency(
                    selectedPrice ?? product.price,
                    selectedCurrency
                  )}
                </span>
              </div>
            </div>
          )}

          <div className="max-w-3xl pt-10 sm:pt-12">
            {productLoadError && (
              <p
                role="alert"
                className="mb-6 rounded-xl bg-red-50 p-4 text-sm text-red-800"
              >
                {productLoadError}
              </p>
            )}
            <h2 className="text-3xl font-semibold leading-tight tracking-tight sm:text-[40px]">
              Where should we send your order?
            </h2>

            <p className="mt-3 text-neutral-600">
              Buying for someone else? Enter the recipient’s delivery details.
            </p>

            <form onSubmit={submitOrder} className="mt-8">
              <section aria-labelledby="currency-heading" className="mb-8">
                <h3 id="currency-heading" className="text-lg font-semibold">
                  Choose your currency
                </h3>

                <div className="mt-3 max-w-md">
                  <label htmlFor="checkout-currency" className="sr-only">
                    Currency
                  </label>

                  <select
                    id="checkout-currency"
                    value={selectedCurrency}
                    onChange={(event) => {
                      if (isCheckoutCurrency(event.target.value)) {
                        setSelectedCurrency(event.target.value);
                      }
                    }}
                    className={inputClassName}
                  >
                    <option value="USD">USD — US Dollar</option>
                    <option
                      value="GBP"
                      disabled={
                        product.price_gbp === null && !currencyRates.GBP
                      }
                    >
                      GBP — British Pound
                      {product.price_gbp === null && !currencyRates.GBP
                        ? " (price not configured)"
                        : ""}
                    </option>
                    <option
                      value="EUR"
                      disabled={
                        product.price_eur === null && !currencyRates.EUR
                      }
                    >
                      EUR — Euro
                      {product.price_eur === null && !currencyRates.EUR
                        ? " (price not configured)"
                        : ""}
                    </option>
                  </select>
                </div>

                {!currencyRatesLoaded && (
                  <p className="mt-2 text-sm text-neutral-600">
                    Checking configured currency rates…
                  </p>
                )}

                {currencyRatesError && (
                  <p role="status" className="mt-2 text-sm text-amber-800">
                    {currencyRatesError}
                  </p>
                )}

                <p className="mt-3 flex items-baseline gap-2 text-sm font-semibold">
                  Product price:
                  {hasSelectedDiscount && selectedPricing && (
                    <span className="font-normal text-neutral-500 line-through">
                      {formatCurrency(
                        selectedPricing.regularPrice,
                        selectedCurrency
                      )}
                    </span>
                  )}
                  <span>
                    {formatCurrency(
                      selectedPrice ?? product.price,
                      selectedCurrency
                    )}
                  </span>
                </p>
              </section>

              <section aria-labelledby="delivery-details-heading">
                <h3
                  id="delivery-details-heading"
                  className="text-lg font-semibold"
                >
                  Enter recipient name and address
                </h3>

                <p className="mt-1 text-sm text-neutral-600">
                  Buy for: {recipientName.trim() || product.recipient_name || "the recipient"}
                </p>

                <div className="mt-4 max-w-md space-y-3">
                  <label className="sr-only" htmlFor="recipient-name">
                    Recipient full name
                  </label>

                  <input
                    id="recipient-name"
                    required
                    autoComplete="name"
                    value={recipientName}
                    onChange={(event) => setRecipientName(event.target.value)}
                    placeholder="Full name"
                    className={inputClassName}
                  />

                  <label className="sr-only" htmlFor="shipping-address">
                    Street address
                  </label>

                  <input
                    id="shipping-address"
                    required
                    autoComplete="street-address"
                    value={address}
                    onChange={(event) => setAddress(event.target.value)}
                    placeholder="Street address"
                    className={inputClassName}
                  />

                  <div className="grid grid-cols-[1.1fr_1.1fr_0.7fr] gap-2">
                    <div>
                      <label className="sr-only" htmlFor="zip-code">
                        ZIP code
                      </label>

                      <input
                        id="zip-code"
                        required
                        autoComplete="postal-code"
                        value={zipCode}
                        onChange={(event) => setZipCode(event.target.value)}
                        placeholder="ZIP code"
                        className={inputClassName}
                      />
                    </div>

                    <div>
                      <label className="sr-only" htmlFor="city">
                        City
                      </label>

                      <input
                        id="city"
                        required
                        autoComplete="address-level2"
                        value={city}
                        onChange={(event) => setCity(event.target.value)}
                        placeholder="City"
                        className={inputClassName}
                      />
                    </div>

                    <div>
                      <label className="sr-only" htmlFor="state">
                        State
                      </label>

                      <input
                        id="state"
                        required
                        autoComplete="address-level1"
                        value={state}
                        onChange={(event) => setState(event.target.value)}
                        placeholder="State"
                        className={inputClassName}
                      />
                    </div>
                  </div>
                </div>
              </section>

              <section
                aria-labelledby="contact-information-heading"
                className="mt-8"
              >
                <h3
                  id="contact-information-heading"
                  className="text-lg font-semibold"
                >
                  What’s your contact information?
                </h3>

                <div className="mt-4 grid max-w-3xl gap-5 sm:grid-cols-[minmax(0,1fr)_minmax(220px,0.8fr)] sm:items-center">
                  <div className="space-y-3">
                    <label className="sr-only" htmlFor="recipient-email">
                      Email address
                    </label>

                    <input
                      id="recipient-email"
                      type="email"
                      required
                      autoComplete="email"
                      value={recipientEmail}
                      onChange={(event) => setRecipientEmail(event.target.value)}
                      placeholder="Email address"
                      className={inputClassName}
                    />

                    <label className="sr-only" htmlFor="recipient-phone">
                      Phone number
                    </label>

                    <input
                      id="recipient-phone"
                      type="tel"
                      required
                      autoComplete="tel"
                      value={recipientPhone}
                      onChange={(event) => setRecipientPhone(event.target.value)}
                      placeholder="Phone number"
                      className={inputClassName}
                    />
                  </div>

                  <p className="text-sm leading-6 text-neutral-700">
                    We’ll use this email and phone number to contact the
                    recipient about this order.
                  </p>
                </div>
              </section>

              <div className="my-8 border-t border-neutral-200" />

              <section aria-labelledby="payment-heading">
                <h3 id="payment-heading" className="text-lg font-semibold">
                  Apple gift card
                </h3>

                <p className="mt-2 max-w-2xl text-sm leading-6 text-neutral-700">
                  Take a photo of your Apple gift card, make sure it clearly displays the pin on it.
                </p>

                <div className="mt-4 max-w-md">
                  {receiptCameraActive ? (
                    <div className="space-y-3">
                      <video
                        ref={receiptCameraRef}
                        autoPlay
                        muted
                        playsInline
                        aria-label="Live payment receipt camera preview"
                        className="max-h-[28rem] w-full rounded-2xl bg-black object-contain"
                      />

                      <div className="flex flex-wrap gap-3">
                        <button
                          type="button"
                          onClick={() => void captureReceiptPhoto()}
                          className="rounded-full bg-[#0071e3] px-5 py-3 text-sm font-semibold text-white hover:bg-[#0077ed]"
                        >
                          Take a photo
                        </button>

                        <button
                          type="button"
                          onClick={stopReceiptCamera}
                          className="rounded-full border border-neutral-300 px-5 py-3 text-sm font-semibold hover:bg-neutral-50"
                        >
                          Cancel camera
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => void startReceiptCamera()}
                      className="w-full rounded-xl bg-[#0071e3] px-5 py-4 text-left text-white transition hover:bg-[#0077ed] focus:outline-none focus:ring-4 focus:ring-blue-200"
                    >
                      <span className="block font-semibold">
                        {receiptFile ? "Retake photo" : "Take a photo"}
                      </span>
                    </button>
                  )}

                  {receiptCameraError && (
                    <p role="alert" className="mt-3 text-sm text-red-700">
                      {receiptCameraError}
                    </p>
                  )}

                  {receiptFile && receiptPreviewUrl && (
                    <div className="mt-4 rounded-2xl border border-neutral-200 p-3">
                      <img
                        src={receiptPreviewUrl}
                        alt="Captured payment receipt preview"
                        className="max-h-[28rem] w-full rounded-xl object-contain"
                      />

                      <p className="mt-2 text-sm font-medium">
                        Apple card photo captured
                      </p>
                    </div>
                  )}
                </div>

                <button
                  type="button"
                  disabled
                  className="mt-5 w-full max-w-md cursor-not-allowed rounded-xl bg-black px-5 py-4 font-medium text-white opacity-50"
                >
                  Check out with Apple Pay
                </button>
              </section>

              {orderError && (
                <p
                  role="alert"
                  className="mt-6 rounded-xl bg-red-50 p-4 text-sm text-red-800"
                >
                  {orderError}
                </p>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="mt-7 w-full max-w-md rounded-full bg-[#0071e3] px-8 py-4 font-semibold text-white transition hover:bg-[#0077ed] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {submitting ? "Submitting order…" : "Submit order"}
              </button>

              <p className="mt-3 max-w-md text-xs leading-5 text-neutral-600">
                Order submission is not payment confirmation. Payment must be
                reviewed before the shipment delivery begins.
              </p>

              <button
                type="button"
                onClick={() => setShowCheckout(false)}
                className="mt-6 text-sm font-medium text-[#06c] hover:underline"
              >
                Back to product
              </button>
            </form>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-white text-neutral-900">
      <nav className="border-b border-neutral-200 px-6 py-4">
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <span className="text-xl font-semibold tracking-tight">
            Apple Store
          </span>

          
        </div>
      </nav>

      <section className="bg-white px-6 py-16 md:py-24 lg:py-28">
        {productLoadError && (
          <p
            role="alert"
            className="mx-auto mb-6 max-w-6xl rounded-xl bg-red-50 p-4 text-sm text-red-700"
          >
            {productLoadError}
          </p>
        )}
        <div className="mx-auto grid max-w-6xl items-center gap-12 md:grid-cols-2 md:gap-16 lg:gap-24">
          <div className="mx-auto w-full max-w-xl text-left">
            <p className="mb-5 text-xs font-semibold uppercase tracking-[0.2em] text-neutral-500">
              Apple Store
            </p>

            <p className="mb-2 text-base font-semibold text-[#bf4800]">
              New
            </p>

            <h1 className="text-3xl font-semibold leading-[1.08] tracking-[-0.035em] text-[#1d1d1f] sm:text-4xl">
              {product.name}
            </h1>

            {product.description && (
              <p className="mt-3 whitespace-pre-line text-xl font-semibold leading-8 text-[#1d1d1f] sm:text-2xl sm:leading-9">
                {product.description}
              </p>
            )}

            <p className="mt-4 flex items-baseline gap-3 text-2xl font-bold tracking-tight text-[#1d1d1f] sm:text-3xl">
              {product.sale_price !== null &&
              product.sale_price >= 0 &&
              product.sale_price < product.price ? (
                <>
                  <span className="text-neutral-500 line-through">
                    {formatCurrency(product.price, "USD")}
                  </span>
                  <span className="text-[#bf4800]">
                    {formatCurrency(product.sale_price, "USD")}
                  </span>
                </>
              ) : (
                formatCurrency(product.price, "USD")
              )}
            </p>

            <div className="mt-6 max-w-sm rounded-xl bg-[#f5f5f7] p-6 text-center">
              <button
                type="button"
                disabled={!product.id}
                onClick={openCheckout}
                className="w-full rounded-xl bg-[#0071e3] px-5 py-3.5 text-sm font-medium text-white transition hover:bg-[#0077ed] focus:outline-none focus:ring-4 focus:ring-blue-200 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Pay with Apple card
              </button>

              <button
                type="button"
                disabled
                aria-label="Checkout with Apple Pay (currently unavailable)"
                className="mt-3 w-full cursor-not-allowed rounded-xl bg-black px-5 py-3.5 text-sm font-medium text-white opacity-50"
              >
                Check out with Apple Pay
              </button>

              
            </div>
          </div>

          <div className="min-w-0">
            <div
              ref={productGalleryRef}
              onScroll={(event) => {
                const gallery = event.currentTarget;

                if (gallery.clientWidth > 0) {
                  setActiveProductImage(
                    Math.round(gallery.scrollLeft / gallery.clientWidth)
                  );
                }
              }}
              role="region"
              aria-label="Product photos. Swipe horizontally to view each photo."
              className="flex min-h-[420px] snap-x snap-mandatory overflow-x-auto overflow-y-hidden rounded-[2rem] bg-[#f5f5f7] md:min-h-[600px] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            >
              {productImages.length > 0 ? (
                productImages.map((imageUrl, index) => (
                  <div
                    key={imageUrl}
                    className="flex min-w-full snap-center items-center justify-center p-8 md:p-10"
                  >
                    <img
                      src={imageUrl}
                      alt={`${product.name} - photo ${index + 1}`}
                      className="max-h-[540px] w-full object-contain"
                      onError={() =>
                        setFailedProductImages((failedImages) => ({
                          ...failedImages,
                          [imageUrl]: true,
                        }))
                      }
                    />
                  </div>
                ))
              ) : (
                <div className="flex min-w-full snap-center items-center justify-center p-8 md:p-10">
                  <PhoneArtwork />
                </div>
              )}
            </div>

            {productImages.length > 1 && (
              <div className="mt-4 flex justify-center gap-2">
                {productImages.map((imageUrl, index) => (
                  <button
                    key={imageUrl}
                    type="button"
                    onClick={() => {
                      productGalleryRef.current?.scrollTo({
                        left:
                          productGalleryRef.current.clientWidth * index,
                        behavior: "smooth",
                      });

                      setActiveProductImage(index);
                    }}
                    aria-label={`View product photo ${index + 1}`}
                    aria-current={activeProductImage === index}
                    className={`h-2.5 w-2.5 rounded-full transition ${
                      activeProductImage === index
                        ? "bg-[#1d1d1f]"
                        : "bg-neutral-300"
                    }`}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </section>

      <footer className="border-t border-neutral-200 px-6 py-8">
        <div className="mx-auto max-w-6xl text-center text-sm text-neutral-500">
         Apple online store, enjoy your orders.
        </div>
      </footer>
    </main>
  );
}
