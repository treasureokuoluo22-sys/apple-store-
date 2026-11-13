import CheckoutPage from "@/app/CheckoutPage";

export const instant = false;

export default async function ProductCheckoutPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <CheckoutPage productId={id} />;
}
