"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { loadDemoOrderPhoto } from "@/lib/demo-order-photo";
import {
  createDemoReviewDeadline,
  isOrderConfirmation,
  ORDER_CONFIRMATION_STORAGE_KEY,
} from "@/lib/order-confirmation";

function subscribeToOrderConfirmation() {
  return () => {};
}

function getSavedOrderConfirmation() {
  try {
    return sessionStorage.getItem(ORDER_CONFIRMATION_STORAGE_KEY);
  } catch (error) {
    console.error("Could not read order confirmation:", error);
    return null;
  }
}

function getServerOrderConfirmation() {
  return undefined;
}

async function fetchReceiptBlob(url: string) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Could not download receipt (${response.status}).`);
  }

  const blob = await response.blob();
  if (!blob.type.startsWith("image/")) {
    throw new Error("The receipt is not available as an image.");
  }

  return blob;
}

async function convertReceiptToPng(blob: Blob): Promise<Blob> {
  if (blob.type === "image/png") return blob;

  const objectUrl = URL.createObjectURL(blob);
  try {
    const image = new window.Image();
    image.src = objectUrl;
    await image.decode();

    const canvas = document.createElement("canvas");
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Could not prepare the receipt for copying.");

    context.drawImage(image, 0, 0);
    const png = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/png")
    );
    if (!png) throw new Error("Could not prepare the receipt for copying.");
    return png;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

export default function OrderReviewPage() {
  const savedConfirmation = useSyncExternalStore(
    subscribeToOrderConfirmation,
    getSavedOrderConfirmation,
    getServerOrderConfirmation
  );
  const loaded = savedConfirmation !== undefined;
  const confirmation = useMemo(() => {
    if (!savedConfirmation) return null;

    try {
      const parsed: unknown = JSON.parse(savedConfirmation);
      return isOrderConfirmation(parsed)
        ? {
            ...parsed,
            reviewEndsAt:
              parsed.reviewEndsAt ?? createDemoReviewDeadline(),
          }
        : null;
    } catch (error) {
      console.error("Could not parse order confirmation:", error);
      return null;
    }
  }, [savedConfirmation]);
  const [receiptPreview, setReceiptPreview] = useState<{
    orderNumber: string;
    url: string;
  } | null>(null);
  const [receiptLoadErrorFor, setReceiptLoadErrorFor] = useState<
    string | null
  >(null);
  const [receiptAction, setReceiptAction] = useState<
    "copy" | "download" | null
  >(null);
  const [receiptActionMessage, setReceiptActionMessage] = useState("");
  const [remainingMs, setRemainingMs] = useState(20_000);
  const reviewEndsAt = confirmation?.reviewEndsAt;
  const orderNumber = confirmation?.orderNumber;
  const receiptPhotoKey = confirmation?.receiptPhotoKey ?? orderNumber;
  const receiptCustomerEmail = confirmation?.recipientEmail;
  const receiptCustomerPhone = confirmation?.recipientPhone;
  const receiptCustomerName = confirmation?.recipientName;

  useEffect(() => {
    if (reviewEndsAt === undefined) return;

    const updateRemaining = () => {
      setRemainingMs(Math.max(0, reviewEndsAt - Date.now()));
    };

    const initialUpdate = window.setTimeout(updateRemaining, 0);
    const interval = window.setInterval(updateRemaining, 100);

    return () => {
      window.clearTimeout(initialUpdate);
      window.clearInterval(interval);
    };
  }, [reviewEndsAt]);

  useEffect(() => {
    if (
      !receiptPhotoKey ||
      !orderNumber ||
      receiptCustomerEmail === undefined ||
      !receiptCustomerPhone ||
      !receiptCustomerName
    ) {
      return;
    }

    let active = true;
    let objectUrl: string | null = null;
    const previewOrderNumber = orderNumber;
    const previewPhotoKey = receiptPhotoKey;
    const previewCustomerEmail = receiptCustomerEmail;
    const previewCustomerPhone = receiptCustomerPhone;
    const previewCustomerName = receiptCustomerName;

    async function loadReceiptPreview(
      targetOrderNumber: string,
      targetPhotoKey: string,
      customerEmail: string,
      customerPhone: string,
      customerName: string
    ) {
      const photoKeys = [...new Set([targetPhotoKey, targetOrderNumber])];
      const loadErrors: unknown[] = [];

      for (const photoKey of photoKeys) {
        try {
          const photo = await loadDemoOrderPhoto(photoKey);
          if (!active) return;
          if (!photo) continue;

          objectUrl = URL.createObjectURL(photo);
          setReceiptPreview({ orderNumber: targetOrderNumber, url: objectUrl });
          return;
        } catch (error) {
          loadErrors.push(error);
        }
      }

      if (!active) return;

      try {
        const response = await fetch("/api/order-receipt-preview", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            orderNumber: targetOrderNumber,
            customerEmail,
            customerPhone,
            customerName,
          }),
        });

        if (!response.ok) {
          throw new Error(`Receipt preview request failed (${response.status}).`);
        }

        const result: unknown = await response.json();
        if (
          !result ||
          typeof result !== "object" ||
          !("url" in result) ||
          typeof result.url !== "string"
        ) {
          throw new Error("Receipt preview response did not contain a URL.");
        }

        if (active) {
          setReceiptPreview({ orderNumber: targetOrderNumber, url: result.url });
        }
        return;
      } catch (error) {
        loadErrors.push(error);
      }

      if (!active) return;
      if (loadErrors.length > 0) {
        console.error("Could not load the receipt preview:", loadErrors);
      }
      setReceiptLoadErrorFor(targetOrderNumber);
    }

    void loadReceiptPreview(
      previewOrderNumber,
      previewPhotoKey,
      previewCustomerEmail,
      previewCustomerPhone,
      previewCustomerName
    );

    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [
    receiptCustomerEmail,
    receiptCustomerName,
    receiptCustomerPhone,
    orderNumber,
    receiptPhotoKey,
  ]);

  const reviewComplete = remainingMs <= 0;
  const receiptPreviewUrl =
    confirmation &&
    receiptPreview?.orderNumber === confirmation.orderNumber
      ? receiptPreview.url
      : null;
  const receiptUnavailable =
    receiptLoadErrorFor === confirmation?.orderNumber;

  const formattedPrice = confirmation
    ? new Intl.NumberFormat(undefined, {
        style: "currency",
        currency: confirmation.currencyCode ?? "USD",
      }).format(confirmation.productPrice)
    : "";

  async function copyReceipt() {
    if (!receiptPreviewUrl) return;
    setReceiptAction("copy");
    setReceiptActionMessage("");

    try {
      if (!navigator.clipboard?.write || typeof ClipboardItem === "undefined") {
        throw new Error("Copying images is not supported by this browser.");
      }

      const receipt = await fetchReceiptBlob(receiptPreviewUrl);
      const png = await convertReceiptToPng(receipt);
      await navigator.clipboard.write([
        new ClipboardItem({ "image/png": png }),
      ]);
      setReceiptActionMessage("Receipt copied to clipboard.");
    } catch (error) {
      console.error("Could not copy receipt:", error);
      setReceiptActionMessage(
        error instanceof Error
          ? error.message
          : "Could not copy the receipt. Try downloading it instead."
      );
    } finally {
      setReceiptAction(null);
    }
  }

  async function downloadReceipt() {
    if (!receiptPreviewUrl || !confirmation) return;
    setReceiptAction("download");
    setReceiptActionMessage("");

    try {
      const receipt = await fetchReceiptBlob(receiptPreviewUrl);
      const extension =
        receipt.type === "image/jpeg"
          ? "jpg"
          : receipt.type === "image/webp"
            ? "webp"
            : "png";
      const objectUrl = URL.createObjectURL(receipt);
      const link = document.createElement("a");
      link.href = objectUrl;
      link.download = `payment-receipt.${extension}`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
      setReceiptActionMessage("Receipt download started.");
    } catch (error) {
      console.error("Could not download receipt:", error);
      setReceiptActionMessage(
        error instanceof Error
          ? error.message
          : "Could not download the receipt. Please try again."
      );
    } finally {
      setReceiptAction(null);
    }
  }

  return (
    <main className="min-h-screen bg-[#f5f5f7] px-5 py-12 text-[#1d1d1f]">
      <div className="mx-auto max-w-2xl">
        <section className="rounded-3xl border border-black/5 bg-white p-7 text-center shadow-sm sm:p-10">
          {!loaded ? (
            <p className="text-sm text-neutral-600">
              Loading your order...
            </p>
          ) : confirmation ? (
            <>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-neutral-500">
                Apple Store
              </p>

              <h1 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">
                {reviewComplete
                  ? "Demo payment successful"
                  : "Payment pending"}
              </h1>

              <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-neutral-600">
                {reviewComplete
                  ? "Your demo checkout completed successfully. No real payment was processed."
                  : "Your uploaded receipt is being checked automatically. This demo checkout takes 20 seconds."}
              </p>

              <div className="mx-auto mt-10 w-full max-w-sm">
                <div className="relative aspect-[4/5] overflow-hidden rounded-2xl bg-neutral-200 shadow-xl">
                  {receiptPreviewUrl ? (
                    <Image
                      src={receiptPreviewUrl}
                      alt="Payment receipt submitted"
                      fill
                      unoptimized
                      sizes="(max-width: 640px) 100vw, 384px"
                      className="object-contain blur-[2px]"
                    />
                  ) : (
                    <div
                      aria-hidden="true"
                      className="absolute inset-0 animate-pulse bg-gradient-to-br from-neutral-300 via-neutral-100 to-neutral-400"
                    />
                  )}
                  <div
                    aria-live="polite"
                    aria-atomic="true"
                    className={`absolute inset-0 flex flex-col items-center justify-center px-6 text-center text-white backdrop-blur-[2px] ${
                      reviewComplete ? "bg-green-950/45" : "bg-black/45"
                    }`}
                  >
                    {reviewComplete ? (
                      <span className="mb-3 flex size-14 items-center justify-center rounded-full bg-green-500/90 text-3xl font-semibold shadow-lg">
                        ✓
                      </span>
                    ) : (
                      <span
                        aria-hidden="true"
                        className="mb-4 size-12 animate-spin rounded-full border-4 border-white/35 border-t-white"
                      />
                    )}
                    <p className="text-xl font-semibold">
                      {reviewComplete
                        ? "Demo payment successful"
                        : "Payment pending"}
                    </p>
                    <p className="mt-2 text-sm text-white/90">
                      {reviewComplete
                        ? "Your demo checkout is complete."
                        : `${Math.ceil(remainingMs / 1000)} seconds remaining`}
                    </p>
                  </div>
                  {!receiptPreviewUrl && !receiptUnavailable && (
                    <p
                      role="status"
                      className="absolute inset-x-3 bottom-3 z-10 rounded-lg bg-black/70 px-3 py-2 text-center text-sm text-white"
                    >
                      Loading submitted receipt…
                    </p>
                  )}
                  {receiptUnavailable && (
                    <p className="absolute inset-x-3 bottom-3 z-10 rounded-lg bg-black/70 px-3 py-2 text-center text-sm text-white">
                      Receipt submitted; preview unavailable.
                    </p>
                  )}
                </div>
                <p className="mt-3 text-center text-sm text-neutral-500">
                  Submitted payment receipt
                </p>
                <div className="mt-4 flex flex-wrap justify-center gap-3">
                  <button
                    type="button"
                    onClick={copyReceipt}
                    disabled={!receiptPreviewUrl || receiptAction !== null}
                    className="rounded-full border border-neutral-300 bg-white px-5 py-2.5 text-sm font-medium text-[#1d1d1f] transition hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {receiptAction === "copy" ? "Copying…" : "Copy receipt"}
                  </button>
                  <button
                    type="button"
                    onClick={downloadReceipt}
                    disabled={!receiptPreviewUrl || receiptAction !== null}
                    className="rounded-full bg-[#1d1d1f] px-5 py-2.5 text-sm font-medium text-white transition hover:bg-black disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {receiptAction === "download"
                      ? "Downloading…"
                      : "Download receipt"}
                  </button>
                </div>
                {receiptActionMessage && (
                  <p
                    className="mt-3 text-center text-sm text-neutral-600"
                    role="status"
                  >
                    {receiptActionMessage}
                  </p>
                )}
              </div>

              <div className="mx-auto mt-8 max-w-sm">
                <div className="flex items-center justify-between text-xs text-neutral-500">
                  <span>
                    {reviewComplete
                      ? "Demo checkout complete"
                      : "Processing demo checkout"}
                  </span>
                  <span aria-live="polite">
                    {reviewComplete
                      ? "Complete"
                      : `${Math.ceil(remainingMs / 1000)}s remaining`}
                  </span>
                </div>

              </div>

              <div className="mt-8 rounded-2xl border border-neutral-200 bg-neutral-50 p-5 text-left">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold">
                    Demo checkout status
                  </p>

                  <span
                    className={`rounded-full px-3 py-1 text-xs font-semibold ${
                      reviewComplete
                        ? "bg-green-100 text-green-800"
                        : "bg-amber-100 text-amber-800"
                    }`}
                  >
                    {reviewComplete ? "Payment successful" : "Payment pending"}
                  </span>
                </div>

                <div className="mt-4 space-y-2 text-sm text-neutral-600">
                  <p>
                    <span className="font-medium text-neutral-900">
                      Recipient:
                    </span>{" "}
                    {confirmation.recipientName}
                  </p>

                  <p>
                    <span className="font-medium text-neutral-900">
                      Product:
                    </span>{" "}
                    {confirmation.productName}
                  </p>

                  <p>
                    <span className="font-medium text-neutral-900">
                      Total:
                    </span>{" "}
                    {formattedPrice}
                  </p>
                </div>
              </div>

              <p className="mt-6 rounded-xl border border-amber-300 bg-amber-50 p-4 text-left text-xs leading-5 text-amber-950">
                DEMO ONLY: The payment-pending animation runs for 20 seconds
                before the demo shows success. It does not charge you, transfer
                money, verify a payment, or update the store order status.
              </p>

              <Link
                href="/"
                className="mt-7 inline-flex rounded-full bg-[#1d1d1f] px-6 py-3 text-sm font-medium text-white transition hover:bg-black"
              >
                Return to store
              </Link>
            </>
          ) : (
            <>
              <h1 className="text-3xl font-semibold tracking-tight">
                No order found
              </h1>

              <p className="mt-3 text-sm leading-6 text-neutral-600">
                We could not find an order submission in this browser.
                Please return to the store and try again.
              </p>

              <Link
                href="/"
                className="mt-6 inline-flex rounded-full bg-[#1d1d1f] px-5 py-3 text-sm font-medium text-white hover:bg-black"
              >
                Return to store
              </Link>
            </>
          )}
        </section>
      </div>
    </main>
  );
}