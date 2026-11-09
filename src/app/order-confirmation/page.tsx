"use client";

import Link from "next/link";
import { jsPDF } from "jspdf";
import { useEffect, useState } from "react";
import {
  isOrderConfirmation,
  ORDER_CONFIRMATION_STORAGE_KEY,
  type OrderConfirmation,
} from "@/lib/order-confirmation";
import {
  formatCurrency,
  isCheckoutCurrency,
} from "@/lib/currency";
import { loadOrderConfirmationPhoto } from "@/lib/order-confirmation-photo";

export default function OrderConfirmationPage() {
  const [confirmation, setConfirmation] = useState<OrderConfirmation | null>(
    null
  );
  const [loaded, setLoaded] = useState(false);
  const [demoPaymentComplete, setDemoPaymentComplete] = useState(false);
  const [downloadError, setDownloadError] = useState("");
  const [receiptPhotoUrl, setReceiptPhotoUrl] = useState<string | null>(null);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      try {
        const savedConfirmation = sessionStorage.getItem(
          ORDER_CONFIRMATION_STORAGE_KEY
        );
        if (savedConfirmation) {
          const parsedConfirmation: unknown = JSON.parse(savedConfirmation);
          if (isOrderConfirmation(parsedConfirmation)) {
            setConfirmation(parsedConfirmation);
          }
        }
      } catch (error) {
        console.error("Could not read the order confirmation:", error);
      } finally {
        setLoaded(true);
      }
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, []);

  useEffect(() => {
    if (!confirmation) return;

    let active = true;
    let objectUrl: string | null = null;

    void loadOrderConfirmationPhoto(confirmation.orderNumber)
      .then((photo) => {
        if (active && photo) {
          objectUrl = URL.createObjectURL(photo);
          setReceiptPhotoUrl(objectUrl);
        }
      })
      .catch((error: unknown) => {
        console.error("Could not load the captured receipt photo:", error);
      });

    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [confirmation]);

  useEffect(() => {
    if (!confirmation) return;

    const timeoutId = window.setTimeout(() => {
      setDemoPaymentComplete(true);
    }, 20_000);

    return () => window.clearTimeout(timeoutId);
  }, [confirmation]);

  function downloadReceipt() {
    if (!confirmation) return;
    setDownloadError("");

    try {
      const pdf = new jsPDF({ unit: "pt", format: "letter" });
      const margin = 48;
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const textWidth = pageWidth - margin * 2;
      let y = margin;

      function addText(
        text: string,
        options: {
          size?: number;
          bold?: boolean;
          color?: [number, number, number];
        } = {}
      ) {
        const size = options.size ?? 11;
        const lineHeight = size * 1.45;
        pdf.setFont("helvetica", options.bold ? "bold" : "normal");
        pdf.setFontSize(size);
        pdf.setTextColor(...(options.color ?? [29, 29, 31]));

        const lines = pdf.splitTextToSize(text, textWidth) as string[];
        const blockHeight = lines.length * lineHeight;
        if (y + blockHeight > pageHeight - margin) {
          pdf.addPage();
          y = margin;
        }

        pdf.text(lines, margin, y);
        y += blockHeight + 8;
      }

      function addField(label: string, value: string) {
        addText(label, { size: 9, bold: true, color: [110, 110, 115] });
        addText(value, { size: 11, bold: true });
      }

      pdf.setFillColor(255, 247, 237);
      pdf.setDrawColor(217, 119, 6);
      pdf.roundedRect(margin, y, textWidth, 38, 6, 6, "FD");
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(11);
      pdf.setTextColor(124, 45, 18);
      

      addText("Order receipt", { size: 24, bold: true });
      
      addText("Order details", { size: 15, bold: true });
      addField("Product", confirmation.productName);
      const currencyCode = isCheckoutCurrency(confirmation.currencyCode)
        ? confirmation.currencyCode
        : "USD";
      addField(
        "Displayed order total",
        formatCurrency(confirmation.productPrice, currencyCode)
      );
      addField(
        "Payment status",
        demoPaymentComplete
          ? "DEMO - simulated success only"
          : "DEMO - payment simulation pending"
      );
      if (demoPaymentComplete) {
        addField("Payment method", "Apple Card (simulated)");
      }
      addField(
        "Delivery status",
        demoPaymentComplete
          ? "DEMO - simulated delivery in progress"
          : "DEMO - no shipment created"
      );

      y += 8;
      pdf.setDrawColor(229, 229, 231);
      pdf.line(margin, y, pageWidth - margin, y);
      y += 22;
      addText("Delivery address", { size: 15, bold: true });
      addText(confirmation.recipientName, { bold: true });
      addText(confirmation.shippingAddress);
      addText(
        `${confirmation.city}, ${confirmation.state} ${confirmation.zipCode}`
      );
      addText(confirmation.recipientEmail);
      addText(confirmation.recipientPhone);

      y += 8;
      pdf.setDrawColor(229, 229, 231);
      pdf.line(margin, y, pageWidth - margin, y);
      y += 20;
      addText(
        "Not proof of payment. No bank, payment processor, or delivery carrier was contacted.",
        { size: 9, color: [81, 81, 84] }
      );
      pdf.save("order-receipt.pdf");
    } catch (error) {
      console.error("Could not generate the receipt PDF:", error);
      setDownloadError("The receipt could not be downloaded. Please try again.");
    }
  }

  const currencyCode = isCheckoutCurrency(confirmation?.currencyCode)
    ? confirmation.currencyCode
    : "USD";
  const formattedPrice = confirmation
    ? formatCurrency(confirmation.productPrice, currencyCode)
    : "";

  return (
    <main className="min-h-screen bg-[#f5f5f7] px-5 py-12 text-[#1d1d1f]">
      <div className="mx-auto max-w-2xl">
        <section className="rounded-3xl border border-black/5 bg-white p-8 shadow-sm sm:p-10">
          {!loaded ? (
            <p className="text-sm text-neutral-600">
              Loading your order receipt…
            </p>
          ) : confirmation ? (
            <>
              <p className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm font-bold uppercase tracking-wide text-amber-950">
                Successful payment receipt 
              </p>
              <h1 className="mt-4 text-3xl font-semibold tracking-tight">
                Thank you for your order
              </h1>
              
              <div className="mt-8 rounded-2xl border border-neutral-200 p-6">
                <h2 className="text-lg font-semibold">Order receipt</h2>
                <dl className="mt-4 space-y-3 text-sm">
                  <div className="flex justify-between gap-4">
                    <dt className="text-neutral-500">Product</dt>
                    <dd className="text-right font-medium">
                      {confirmation.productName}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt className="text-neutral-500">Order total</dt>
                    <dd className="font-semibold">{formattedPrice}</dd>
                  </div>
                </dl>

                <div className="mt-6 border-t border-neutral-200 pt-5">
                  <h3 className="font-semibold">Delivery address</h3>
                  <address className="mt-2 space-y-1 text-sm not-italic text-neutral-700">
                    <p>{confirmation.recipientName}</p>
                    <p>{confirmation.shippingAddress}</p>
                    <p>
                      {confirmation.city}, {confirmation.state}{" "}
                      {confirmation.zipCode}
                    </p>
                    <p>{confirmation.recipientEmail}</p>
                    <p>{confirmation.recipientPhone}</p>
                  </address>
                </div>
              </div>

              <button
                type="button"
                onClick={downloadReceipt}
                className="mt-5 inline-flex rounded-full bg-[#1d1d1f] px-5 py-3 text-sm font-semibold text-white transition hover:bg-black focus:outline-none focus:ring-4 focus:ring-neutral-300"
              >
                Download receipt
              </button>
              {downloadError && (
                <p role="alert" className="mt-3 text-sm text-red-700">
                  {downloadError}
                </p>
              )}

              {!demoPaymentComplete ? (
                <div
                  className="mt-6 rounded-2xl border border-neutral-200 bg-[#f5f5f7] p-6 text-center"
                  aria-live="polite"
                >
                  
                  <h2 className="mt-2 text-xl font-semibold">
                    Processing Apple Card
                  </h2>
                  <div
                    className="demo-payment-card mx-auto mt-6 flex h-48 max-w-sm flex-col justify-between rounded-2xl p-5 text-left text-white shadow-xl"
                    role="img"
                    aria-label="Apple Card payment simulation showing your camera photo"
                  >
                    {receiptPhotoUrl && (
                      <>
                        <img
                          src={receiptPhotoUrl}
                          alt=""
                          aria-hidden="true"
                          className="pointer-events-none absolute inset-0 z-0 h-full w-full rounded-2xl object-cover"
                        />
                        <div
                          aria-hidden="true"
                          className="pointer-events-none absolute inset-0 z-[1] bg-black/30"
                        />
                      </>
                    )}
                    <div className="relative z-10 flex items-start justify-between">
                      <span className="text-lg font-semibold">Apple Card</span>
                      
                    </div>
                    <div className="relative z-10 flex items-end justify-between">
                      
                      <span className="demo-payment-spinner" aria-hidden="true" />
                    </div>
                  </div>
                  
                </div>
              ) : (
                <div className="mt-6 space-y-4" aria-live="polite">
                  <div className="rounded-2xl border border-green-300 bg-green-50 p-5 text-green-950">
                    <h2 className="font-bold"> payment successful</h2>
                    <p className="mt-1 text-sm leading-6">
                     Your Apple card payment review was successful. Your order will be delivered to you soon.
                    </p>
                  </div>

                  <div className="rounded-2xl border border-neutral-200 p-6">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <h2 className="text-lg font-semibold">
                        payment receipt
                      </h2>
                      
                    </div>
                    <dl className="mt-4 space-y-3 text-sm">
                      <div className="flex justify-between gap-4">
                        <dt className="text-neutral-500">Payment method</dt>
                        <dd className="text-right font-medium">
                          Apple Card 
                        </dd>
                      </div>
                      <div className="flex justify-between gap-4">
                        <dt className="text-neutral-500">Demo amount</dt>
                        <dd className="font-semibold">{formattedPrice}</dd>
                      </div>
                      <div className="flex justify-between gap-4">
                        <dt className="text-neutral-500">Payment status</dt>
                        <dd className="font-semibold text-green-800">
                          Success
                        </dd>
                      </div>
                    </dl>
                    
                  </div>

                  <div className="rounded-2xl border border-neutral-200 p-6">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <h2 className="text-lg font-semibold">
                        Delivery tracking
                      </h2>
                      
                    </div>
                    <p className="mt-3 font-semibold text-blue-900">
                      Delivery in progress
                    </p>
                    <ol className="mt-5 space-y-4 border-l-2 border-blue-200 pl-4 text-sm">
                      <li>
                        <p className="font-semibold">Order received</p>
                        <p className="mt-1 text-neutral-600">
                          Order recorded
                        </p>
                      </li>
                      <li>
                        
                        
                      </li>
                    </ol>
                  </div>
                </div>
              )}
            </>
          ) : (
            <>
              <h1 className="text-3xl font-semibold tracking-tight">
                No receipt found
              </h1>
              <p className="mt-3 text-neutral-600">
                Receipt details are available in the browser session where the
                order was submitted. Contact the store administrator if you
                already submitted an order.
              </p>
            </>
          )}

          <Link
            href={
              confirmation?.productId
                ? `/products/${confirmation.productId}`
                : "/admin"
            }
            className="mt-8 inline-flex rounded-full bg-[#1d1d1f] px-5 py-3 text-sm font-medium text-white hover:bg-black"
          >
            {confirmation?.productId ? "Return to product" : "Return to admin"}
          </Link>
        </section>
      </div>
    </main>
  );
}
