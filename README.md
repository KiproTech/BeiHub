# BeiHub

BeiHub is **one business**: an online catalogue and order-management website for a single store that sells products and delivers them to customers. (It is not a marketplace: there are no multiple shops.)

**Anyone can browse without an account:** products, categories, search and filters, prices, availability, delivery information and contact details. A customer **logs in (and must have a verified email) only to place an order**, then tracks it under **My orders**.

Ordering flow: Product > Add to Order List > Review order > Contact details > Confirm order > **Continue** > *Order Submitted Successfully* (status **Pending**). There is **no online payment**: our team contacts the customer, confirms the order and, if needed, collects a deposit of **up to 50%** (configurable) manually. The code is structured so M-Pesa can be added later (see section 10).

- **Frontend:** React 19 + Vite (no router or UI library dependencies)
- **Backend:** Supabase (PostgreSQL, Auth, Row Level Security, Storage)
- **Admin:** built in at `/admin` (dashboard, orders, products, categories, customers, delivery, media, business settings, audit logs)

> **One source of truth: Supabase.** Products, prices, availability, images, business information (phone, WhatsApp, email, address, hours...), orders, order statuses and notifications are stored **only** in your Supabase project. Every phone, tablet and computer reads the same data. There is **no demo mode** and nothing shared is kept in the browser: without the Supabase variables the site shows a setup screen. The browser only keeps this device's login session, the Order List being built and the typed-in contact details (cleared on log out).

### How changes reach every device

```
Admin saves  ->  validated in the browser AND by the database  ->  Supabase (source of truth)
                                                                        |
                       +-------------------------+----------------------+
                       v                         v                      v
                 phone reloads             laptop (open page)      tablet next week
              (always reads Supabase)   Realtime says "changed"   (always reads Supabase)
                                         -> page re-reads Supabase
```

- Every page load, tab focus and a timer re-read Supabase (requests use `cache: no-store`), so a page that missed a Realtime message still catches up.
- **Supabase Realtime** is an enhancement: open pages refresh within a second or so when the admin changes products, prices, availability, business info, images, or when an order / status / notification changes. If Realtime is blocked, the 30-second fallback timer takes over.
- Saving business settings sends **only the fields you edited**, and refuses to overwrite a field someone else changed meanwhile.
- Uploaded images get a new unique file name each time, so a replaced picture can never be shown from an old browser cache.

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

Copy `.env.example` to `.env` in the project root (it is git-ignored), or add the same two names in Vercel / Netlify. Both are required: the site will not start without them.

| Variable | Where to find it |
| --- | --- |
| `VITE_SUPABASE_URL` | Supabase Dashboard > Project Settings > API > **Project URL** |
| `VITE_SUPABASE_ANON_KEY` | Supabase Dashboard > Project Settings > API > **anon public** key |

**Never** put the `service_role` key in this project or in any `VITE_` variable. The `anon` key is designed to be public; Row Level Security protects the data.

## 4. Supabase setup

1. Create a new project at https://supabase.com/dashboard (choose a region close to Kenya, e.g. Europe/Frankfurt or the nearest available; save the database password somewhere safe).
2. **SQL Editor > New query:** run these files **in order** (each is safe to re-run and keeps existing data):

   | # | File | What it does |
   | --- | --- | --- |
   | 1 | `supabase/BeiHub_database.sql` | Original schema, storage bucket, sample products, settings |
   | 2 | `supabase/archive/01_marketplace_upgrade.sql` | Order lifecycle, timeline, notifications, audit log, site media, contact fields |
   | 3 | **`supabase/beihub_migration.sql`** | **Single-business upgrade:** validated business settings, removes the multi-shop logic, predefined cancellation reasons and customer updates, Realtime, admin-only write policies |

   **Already ran 1 and 2 on your project? Run only file 3.** It refuses to run if 1 and 2 are missing.
3. *(What file 3 does to existing shops: the first approved shop's contact details are copied into the business settings **only where those are still empty**. `products.shop_id` and `order_items.shop_id` are dropped. If your `shops` table contained rows it is kept as `legacy_shops_archive` (visible to the admin only) so nothing is lost; if it was empty it is dropped. Once you have checked it you can remove it with `drop table public.legacy_shops_archive;`.)*
4. Copy the Project URL and anon key into `.env` (section 3).
4b. **Realtime:** file 3 adds the shared tables to the `supabase_realtime` publication. Check under **Database > Replication** (or Realtime) that `products`, `product_variants`, `product_images`, `categories`, `store_settings`, `delivery_locations`, `site_media`, `orders`, `order_events` and `notifications` are enabled; switch any missing one on.
5. **Turn on email verification** (cannot be done in SQL): Dashboard > **Authentication > Sign In / Providers > Email** > enable **Confirm email**, and keep **Allow new users to sign up** ON (customers register themselves).
6. **Authentication > URL Configuration:** set **Site URL** to your website address and add it (and `http://localhost:5173` for local work) under **Redirect URLs**. Verification and password-reset links return to the site through these.
7. **Email delivery:** Supabase's built-in email sender allows only a few emails per hour and is meant for testing. Before launch add your own SMTP provider under **Project Settings > Authentication > SMTP Settings** (for example Resend, Brevo or Amazon SES). Optionally edit the **Confirm signup** and **Reset password** email templates under Authentication > Email Templates.

### Database structure

`profiles`, `categories`, `products`, `product_images`, `product_variants`, `orders`, `order_items`, `delivery_locations`, `store_settings` (the **one** business record), `site_media`, `order_events` (order timeline and internal notes), `notifications`, `audit_log`, and the predefined message tables `order_cancellation_reasons` and `order_update_templates`.

Key points:

- Prices, previous prices, stock, availability and SKU live on **`product_variants`**, so every size/capacity/model has its own values.
- **`order_items` copies the product name, variant label, SKU and unit price at the moment the order is placed.** Changing a price later never changes old orders.
- Customers cannot write orders directly. They submit through the `submit_order()` database function, which requires a **signed-in customer with a verified email who is not suspended**, **re-reads prices from the database**, applies stock rules, calculates delivery, deposit and balance, and saves the contact details **with the order** (a later profile change never alters it).
- Order statuses can only be changed by admins through database functions (`admin_set_order_status`, `admin_send_order_update`, `admin_set_payment_status`, `admin_add_order_note`) that enforce the allowed transitions and **require a predefined cancellation reason**. Customers can only cancel their own order while it is still pending (`customer_cancel_order`). Direct `UPDATE` on orders is blocked for everyone.
- Row Level Security: the public can only read live products, images, the business settings and active delivery fees. A customer reads only their own orders, their customer-visible timeline events and their own notifications. Internal admin notes live in the admin-only part of the timeline. The audit log is readable by admins only and written only by triggers/functions.
- Order numbers look like `BH-000001` (old numbers are kept).

### Storage setup

The SQL files create a **public** bucket named `product-images` (5 MB limit; JPEG, PNG, WebP, AVIF, GIF only; SVG is intentionally not allowed). Everyone can *view* images (they are public catalogue pictures); only admins can upload, replace or delete. Folders used: `products/`, `categories/`, `site/` (logo, favicon, hero, banners, about, defaults) and `branding/`. Verify under **Storage**: you should see `product-images` marked Public. Nothing else to configure.

Images are resized and compressed in the admin's browser before upload to save storage and customers' mobile data.

## 5. Create the admin account

1. Supabase Dashboard > **Authentication > Users > Add user > Create new user**. Enter your email and a strong password and tick **Auto Confirm User**.
2. In **SQL Editor** run (use your email):

```sql
update public.profiles set role = 'admin'
where id = (select id from auth.users where email = 'you@example.com');
```

3. Open `https://your-site/admin` and sign in.

Customers register themselves (keep sign-ups **on**). Only profiles you promote with the SQL above are admins; customers can never change their own role.

## 6. First things to do in the admin

1. **Business Settings > Contact information:** business phone, **WhatsApp number**, email, address, opening hours, **delivery information**, support contact, map link and social links. They are stored once in Supabase and shown automatically in the header, footer, Contact and About pages, order pages, printed orders and WhatsApp links. **Business & payment** holds the business name, tagline, about text, deposit % and payment instructions. Upload the logo under **Media**.
2. **Delivery:** choose Free / Fixed fee / By county / By town and enter your fees. The seeded county fees are only samples.
3. **Products:** delete or edit the sample products and add your own and set each status (Available, Out of stock, Hidden, Discontinued). Upload real photos (the sample images are illustrations).
4. **Media:** upload, replace, delete and choose the primary image for the logo, favicon, hero image, promotional banners, about image and default product picture. Deleting an image also removes the file from storage and never leaves a broken link behind.
5. **Prices & stock** tab (Products page): fast daily updates of current price, previous price, stock and availability.

### How variants work

A product such as **Water Tank** has variants **500 Litres, 1,000 Litres, 2,000 Litres...** Each variant has its own price, previous price, stock, availability, SKU and specifications. Customers choose a variant on the card or product page; the chosen variant appears in the Order List, the order, the admin order view, the WhatsApp message and the printed summary. Use **Add many** in the product editor to paste a list of capacities and prices in one go.

### Discounts

Set a **Previous price** higher than the **Current price**. The site automatically shows the crossed-out old price, the percentage badge and the saving. Clear the previous price to end the offer.

### Order workflow

```
PENDING > CONFIRMED > PAYMENT_PENDING > PROCESSING > READY_FOR_PICKUP (pickup) or WAITING_FOR_DELIVERY (delivery) > COMPLETED
                 any stage before COMPLETED  >  CANCELLED (predefined reason required, shown to the customer)
```

1. A customer submits an order: it is **Pending** and the customer gets a notification.
2. Open it in **Admin > Orders** (search by number, name, phone or email; filter by status or payment). Call, WhatsApp or email the customer using the buttons.
3. **Mark as confirmed**, then **payment pending** (the customer is told a deposit of up to the configured percentage is needed). Record the money you received with **Mark payment confirmed** (add the M-Pesa code as the note).
4. **Processing** needs the payment confirmed first (unless the deposit is 0). Then **ready for pickup / waiting for delivery**, then **completed**. Only admins can complete an order.
   - **Cancelling:** choose a reason from the list (out of stock, no longer available, customer requested, could not be reached, payment not completed, delivery location unavailable, order information incomplete, could not be confirmed, price/details need confirmation, business unable to process, duplicate order, **Other**). Only **Other** asks you to type ("Please specify"). The list lives in the table `order_cancellation_reasons`.
   - **Customer updates:** every status change (and the **Send update** button, which does not change the status) can attach a standard sentence such as "Your order has been dispatched." plus an optional custom message. The sentences live in `order_update_templates`; edit or add rows in the Supabase Table Editor to change the wording (set `is_active = false` to hide one).
5. Every change is saved in the order **timeline** with date and time, creates a customer notification, and is written to the **Audit log**. Internal notes (marked *Internal*) are never shown to the customer.

Customers follow progress in **My orders** (progress bar, timeline, cancellation reason) and in **Notifications**. Use **Print** for a delivery note with signature lines.

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
  App.jsx, main.jsx            app shell and routes (/products, /categories, /about, /contact, /account, /admin)
  lib/                         router, Supabase REST client, realtime, search, pricing, WhatsApp
    backends/supabase.js       the data layer (everything goes to Supabase)
    realtime.js                "something changed" signal + fallback refresh timer
  context/                     store (business info, catalogue), order list, auth, notifications, toasts
  components/                  header, footer, product card, search, shared UI, setup screen
  pages/                       Home, Products, Categories, Product, About, Contact, OrderList, Checkout, Confirmation,
                               Auth (login, register, verify, reset), Account (orders, notifications, profile)
  pages/admin/                 dashboard, orders, products, categories, customers, delivery, media, business settings, audit log
  lib/orderFlow.js             order statuses and allowed transitions (mirrors the database rules)
  data/catalog.js              sample catalogue (feeds the SQL seed)
supabase/
  schema.sql, seed.sql         source of the base script
  BeiHub_database.sql          schema + seed                       (run 1st)
  archive/01_marketplace_upgrade.sql   order lifecycle, audit, media (run 2nd, skip if already done)
  beihub_migration.sql         single-business upgrade             (run 3rd)
scripts/                       image generator and SQL builder
public/sample-products/        sample illustrations (replace with real photos)
```

## 9. Notes and limits

- Search and filters run in the browser over the live catalogue, which is fast for up to a few thousand products. For a much larger catalogue, move search to the database.
- Stock is **not** reduced automatically when an order arrives (orders are confirmed manually). Update stock in **Prices & stock** after confirming. The order form blocks quantities above stock for "In stock" items and blocks out-of-stock items.
- Order submission has a basic guard of 5 orders per customer/phone per 10 minutes. For heavy public traffic consider adding Cloudflare Turnstile / rate limiting in front of the site.
- Supabase blocks password login until the email is confirmed (when *Confirm email* is on). The database also refuses orders from unverified accounts, as a second line of defence.
- Sample brands, models and prices are illustrative only. Replace them with your real catalogue.
- BeiHub is an original design and is not affiliated with any other store.

## 10. Adding payments and messaging later

- **M-Pesa / another gateway:** orders already carry `payment_status` (`unpaid`, `pending`, `confirmed`) and the deposit amount. A future Edge Function (for example an M-Pesa STK-push callback) can call `admin_set_payment_status()` (or a service-role equivalent) to mark payments confirmed automatically. Nothing else in the order flow changes.
- **Email / SMS / WhatsApp notifications:** every notification is created in one database function, `queue_notification()`. The `notifications` table has `channel` (`in_app`, `email`, `sms`, `whatsapp`) and `delivery_status` columns. Add a Supabase Database Webhook or Edge Function on `notifications` insert to send the message through your provider. No frontend change is needed, and no external service is configured today.
