# BeiHub

BeiHub is a Kenyan online catalogue and order-management website for electronics, appliances, water tanks, solar and power equipment, computers, CCTV and networking.

Customers **browse, search, filter, view a product, choose a size/variant, add it to an Order List, enter delivery details and submit an order**. There is **no online payment**: the business owner confirms every order manually. Payment terms are **50% deposit to confirm, 50% balance on delivery** (the percentage is configurable).

- **Frontend:** React 19 + Vite (no router or UI library dependencies)
- **Backend:** Supabase (PostgreSQL, Auth, Row Level Security, Storage)
- **Admin:** built in at `/admin` (products, variants, images, prices, stock, categories, orders, customers, delivery, settings)

> **Try it first, no setup:** if the Supabase variables are empty the site runs in **Demo mode** with the sample catalogue stored in your browser. Admin login in demo mode: `admin@beihub.co.ke` / `admin123`. Never deploy demo mode to customers, it is for previewing only.

---

## 1. Requirements

- Node.js 20 or newer (`node -v`)
- A free Supabase account: https://supabase.com
- A hosting account for the website (Vercel or Netlify recommended; both have free tiers)

## 2. Install and run locally

```bash
npm install
cp .env.example .env      # then fill in the two values (see section 3)
npm run dev               # http://localhost:5173
```

Other commands:

| Command | What it does |
| --- | --- |
| `npm run dev` | Local development server |
| `npm run build` | Production build into `dist/` |
| `npm run preview` | Serve the production build locally |
| `npm run lint` | Run oxlint |
| `npm run generate:images` | Re-create the sample product artwork in `public/sample-products/` |
| `npm run generate:sql` | Rebuild `supabase/BeiHub_database.sql` from `supabase/schema.sql` + `src/data/catalog.js` |

## 3. Environment variables

Create a file named `.env` in the project root (it is git-ignored). Names only are shown in `.env.example`.

| Variable | Where to find it |
| --- | --- |
| `VITE_SUPABASE_URL` | Supabase Dashboard > Project Settings > API > **Project URL** |
| `VITE_SUPABASE_ANON_KEY` | Supabase Dashboard > Project Settings > API > **anon public** key |
| `VITE_DEMO_MODE` *(optional)* | `true` forces demo mode even when keys are set |

**Never** put the `service_role` key in this project or in any `VITE_` variable. The `anon` key is designed to be public; Row Level Security protects the data.

## 4. Supabase setup

1. Create a new project at https://supabase.com/dashboard (choose a region close to Kenya, e.g. Europe/Frankfurt or the nearest available; save the database password somewhere safe).
2. Open **SQL Editor > New query**, paste the entire contents of **`BeiHub_database.sql`** (also at `supabase/BeiHub_database.sql`) and press **Run**.
   This creates all tables, relationships, constraints, indexes, triggers, functions, Row Level Security policies, the storage bucket and its policies, and loads sample categories, products, variants, delivery fees and settings.
   The script is safe to run again: it never overwrites rows you have edited.
3. Copy the Project URL and anon key into `.env` (section 3).

### Database structure

`profiles`, `categories`, `products`, `product_images`, `product_variants`, `orders`, `order_items`, `delivery_locations`, `store_settings`.

Key points:

- Prices, previous prices, stock, availability and SKU live on **`product_variants`**, so every size/capacity/model has its own values.
- **`order_items` copies the product name, variant label, SKU and unit price at the moment the order is placed.** Changing a price later never changes old orders.
- Customers cannot read or write tables directly. They submit orders through the `submit_order()` database function, which **re-reads prices from the database**, applies stock rules, calculates delivery, deposit and balance, and returns the saved order. A tampered browser cannot change prices.
- Row Level Security: the public can only read live categories/products/variants/images, settings and active delivery fees. Orders, order items and profiles are admin-only (a signed-in customer could only ever read their own orders). All writes require an admin profile.

### Storage setup

The SQL file creates a **public** bucket named `product-images` (5 MB limit; JPEG, PNG, WebP, AVIF, GIF only; SVG is intentionally not allowed). Only admins can upload, replace or delete. Verify under **Storage**: you should see `product-images` marked Public. Nothing else to configure.

Images are resized and compressed in the admin's browser before upload to save storage and customers' mobile data.

## 5. Create the admin account

1. Supabase Dashboard > **Authentication > Users > Add user > Create new user**. Enter your email and a strong password and tick **Auto Confirm User**.
2. In **SQL Editor** run (use your email):

```sql
update public.profiles set role = 'admin'
where id = (select id from auth.users where email = 'you@example.com');
```

3. Open `https://your-site/admin` and sign in.

Recommended: Authentication > Providers > Email: turn **off** "Allow new users to sign up" (Authentication > Sign In / Providers > "Allow new users to sign up") so nobody else can create accounts. Customers do not need accounts to order.

## 6. First things to do in the admin

1. **Settings:** business name, logo, phone, **WhatsApp number**, email, address, hours, deposit % and payment instructions (for example your M-Pesa Till/Paybill text).
2. **Delivery:** choose Free / Fixed fee / By county / By town and enter your fees. The seeded county fees are only samples.
3. **Products:** delete or edit the sample products and add your own. Upload real photos (the sample images are illustrations).
4. **Prices & stock** tab (Products page): fast daily updates of current price, previous price, stock and availability.

### How variants work

A product such as **Water Tank** has variants **500 Litres, 1,000 Litres, 2,000 Litres...** Each variant has its own price, previous price, stock, availability, SKU and specifications. Customers choose a variant on the card or product page; the chosen variant appears in the Order List, the order, the admin order view, the WhatsApp message and the printed summary. Use **Add many** in the product editor to paste a list of capacities and prices in one go.

### Discounts

Set a **Previous price** higher than the **Current price**. The site automatically shows the crossed-out old price, the percentage badge and the saving. Clear the previous price to end the offer.

### Order workflow

New order > call/WhatsApp the customer (button on the order page) > mark **Confirmed** > customer pays the deposit > mark **Deposit received** > **Out for delivery** > **Delivered**. Use **Print order** for a delivery note with signature lines.

## 7. Production deployment

### Vercel

1. Push the project to GitHub (do not commit `.env`).
2. Vercel > Add New Project > import the repo. Framework preset: **Vite**.
3. Add environment variables `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.
4. Deploy. `vercel.json` already rewrites all routes to `index.html`.

### Netlify

1. New site from Git. Build command `npm run build`, publish directory `dist` (set in `netlify.toml`).
2. Add the same two environment variables. `public/_redirects` handles page routes.

### Custom domain

Add your domain in the host's dashboard and follow its DNS instructions. Then in Supabase > Authentication > URL Configuration set **Site URL** to your domain.

## 8. Project structure

```
src/
  App.jsx, main.jsx            app shell and routes
  lib/                         router, Supabase REST client, search, pricing, WhatsApp, backends
    backends/supabase.js       production data layer
    backends/demo.js           in-browser demo data layer (same interface)
  context/                     store, order list, auth, toasts
  components/                  header, footer, product card, search, shared UI
  pages/                       Home, Shop, Product, OrderList, Checkout, Confirmation
  pages/admin/                 admin dashboard and management screens
  data/catalog.js              sample catalogue (feeds the SQL seed and demo mode)
supabase/
  schema.sql                   tables, RLS, functions, storage
  seed.sql                     sample data
  BeiHub_database.sql          schema + seed (what you run)
scripts/                       image generator and SQL builder
public/sample-products/        sample illustrations (replace with real photos)
```

## 9. Notes and limits

- Search and filters run in the browser over the live catalogue, which is fast for up to a few thousand products. For a much larger catalogue, move search to the database.
- Stock is **not** reduced automatically when an order arrives (orders are confirmed manually). Update stock in **Prices & stock** after confirming. The order form blocks quantities above stock for "In stock" items and blocks out-of-stock items.
- Order submission has a basic guard of 5 orders per phone number per 10 minutes. For heavy public traffic consider adding Cloudflare Turnstile / rate limiting in front of the site.
- Sample brands, models and prices are illustrative only. Replace them with your real catalogue.
- BeiHub is an original design and is not affiliated with any other store.
# BeiHub
