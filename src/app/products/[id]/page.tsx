import { Suspense } from "react";
import Home from "@/app/page";

export default function ProductCheckoutPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen bg-white p-8 text-neutral-700">
          Loading product…
        </main>
      }
    >
      {params.then(({ id }) => (
        <Home productId={id} />
      ))}
    </Suspense>
  );
}
