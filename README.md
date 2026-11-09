This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Supabase database migrations

Apply this migration in the Supabase SQL Editor:

[`supabase/migrations/20261101033000_product_image_gallery.sql`](./supabase/migrations/20261101033000_product_image_gallery.sql)
adds two additional product photo URL fields for the swipeable gallery.

Apply [`supabase/migrations/20261107000100_product_images_storage.sql`](./supabase/migrations/20261107000100_product_images_storage.sql)
to create the public `product-images` storage bucket and its upload policies.
Product photos are uploaded as JPG, PNG, or WebP files up to 5 MB each.

Apply [`supabase/migrations/20261102000100_checkout_currency_rates.sql`](./supabase/migrations/20261102000100_checkout_currency_rates.sql)
to add optional USD-to-GBP and USD-to-EUR rates to `store_settings`. Configure
these rates in `store_settings` for automatic currency conversion. The admin
dashboard no longer provides controls for editing exchange rates.
Apply [`supabase/migrations/20261105000100_product_currency_prices.sql`](./supabase/migrations/20261105000100_product_currency_prices.sql)
to add optional, admin-configurable GBP and EUR product prices. A configured
product price takes precedence over conversion; leave it blank to use the
corresponding exchange rate. Converted prices are rounded to cents. The product
and submitted database order remain priced in USD; the checkout currency is a
display-only demo because this site does not process payments.

Apply [`supabase/migrations/20261108000100_product_recipient_name.sql`](./supabase/migrations/20261108000100_product_recipient_name.sql)
to add an optional recipient name to products. Admins can set the name in each
product's details; it is prefilled on that product's checkout page and remains
editable by the customer.
Apply [`supabase/migrations/20261106000100_product_sale_prices.sql`](./supabase/migrations/20261106000100_product_sale_prices.sql)
to add optional sale prices in USD, GBP, and EUR. Set regular and sale prices
for each currency in the product's admin page. Sale prices must be lower than
the corresponding regular price; customers see the regular price crossed out
and the sale price as the current price. Blank GBP/EUR regular prices continue
to use the configured exchange rates.

Apply [`supabase/migrations/20261107000200_product_admin_ownership.sql`](./supabase/migrations/20261107000200_product_admin_ownership.sql)
to enable admin signup and separate product ownership. Existing products are
assigned to the existing Supabase Auth account; the migration stops if it
cannot safely identify exactly one existing account. Each admin can manage
only their own products, checkout
links, orders, and receipt images. Public product checkout links remain
readable. To allow new admin accounts, enable **Allow new users to sign up**
under **Authentication → Settings → User Signups** in the Supabase dashboard,
and ensure the Email provider is enabled. If signup is disabled, the admin login
page will show a specific message. Admin signup is open to anyone who can reach
the login page, so use this only if that is intended for your store.

Each admin dashboard lists only that admin's products. Its product setup form
creates a product with its name, description, up to three uploaded photos, and
regular/sale prices in USD, GBP, and EUR. Each product also has a settings page
for editing these details and a public checkout URL at `/products/<product-id>`;
that page keeps the existing checkout workflow while loading the selected
product.

The recipient checkout uses the existing `submit_store_order` function in the
database and stores the recipient's name, email, and phone in its customer
fields. No separate checkout-function migration is needed.
The admin dashboard reads orders and creates private receipt-image links with
the server-only `SUPABASE_SERVICE_ROLE_KEY`, then limits results to the signed-in
admin's products. Set this key in the server environment only; never expose it
with a `NEXT_PUBLIC_` prefix.

After an order is submitted, the confirmation page shows the delivery address
and a clearly labeled simulated payment and delivery flow. The site does not
process payment or start delivery; receipt details are stored in the submitting
browser session and are not included in the confirmation URL.

Checkout captures a new payment-receipt photo using the device camera for
manual verification only; customers cannot select an existing image. It
explicitly does not accept gift-card images or redemption details, and a
receipt photo does not itself confirm payment or start delivery.

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
