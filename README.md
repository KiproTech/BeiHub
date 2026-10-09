# BeiHub

BeiHub is **one business**: an online catalogue and order-management website for a single store that sells products and delivers them to customers. (It is not a marketplace: there are no multiple shops.)

**Anyone can browse without an account:** products, categories, search and filters, prices, availability, delivery information and contact details. A customer **logs in (and must have a verified email) only to place an order**, then tracks it under **My orders**.

Ordering flow: Product > Add to Order List > Review order > Contact details > Confirm order > **Continue** > *Order Submitted Successfully* (status **Pending**). There is **no online payment**: our team contacts the customer, confirms the order and, if needed, collects a deposit of **up to 50%** (configurable) manually. The code is structured so M-Pesa can be added later (see section 10).

- **Frontend:** React 19 + Vite (no router or UI library dependencies)
- **Backend:** Supabase (PostgreSQL, Auth, Row Level Security, Storage)
- **Admin:** built in at `/admin` (dashboard, orders, products, categories, customers, delivery, media, business settings, audit logs)

> **One source of truth: Supabase.** Products, prices, availability, images, business information (phone, WhatsApp, email, address, hours...), orders, order statuses and notifications are stored **only** in your Supabase project. Every phone, tablet and computer reads the same data. There is **no demo mode** and nothing shared is kept in the browser: without the Supabase variables the site shows a setup screen. The browser only keeps this device's login session, the Order List being built and the typed-in contact details (cleared on log out).

### Several people in one browser

Each browser **tab** has its own login, so one tab can be the Super Admin while another is a customer and a third is a second admin, all at once. Logging in, switching account or logging out in one tab never changes another tab. A login lasts as long as its tab (reloading keeps it, closing the tab ends it, a new tab starts logged out). See section 6b for how this works and why it is safe.

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
   | 3 | `supabase/archive/02_single_business_upgrade.sql` | Single business: validated business settings, no multi-shop logic, predefined cancellation reasons and customer updates, Realtime |
   | 4 | **`supabase/beihub_migration.sql`** | **Roles and permissions:** Super Admin, admin invitations, permission-based security rules, customer tracking, tamper-proof audit log, login tracking |

   **Already ran files 1 to 3 on your project? Run only file 4.** It refuses to run if the earlier files are missing. Every file is safe to run again.
3. *(What file 3 did to existing shops: the first approved shop's contact details are copied into the business settings **only where those are still empty**. `products.shop_id` and `order_items.shop_id` are dropped. If your `shops` table contained rows it is kept as `legacy_shops_archive` (visible to the admin only) so nothing is lost; if it was empty it is dropped. Once you have checked it you can remove it with `drop table public.legacy_shops_archive;`.)*
4. Copy the Project URL and anon key into `.env` (section 3).
4b. **Realtime:** the migrations add the shared tables to the `supabase_realtime` publication. Check under **Database > Replication** (or Realtime) that `products`, `product_variants`, `product_images`, `categories`, `store_settings`, `delivery_locations`, `site_media`, `orders`, `order_events` and `notifications` are enabled; switch any missing one on.
5. **Turn on email verification** (cannot be done in SQL): Dashboard > **Authentication > Sign In / Providers > Email** > enable **Confirm email**, and keep **Allow new users to sign up** ON (customers register themselves).
6. **Authentication > URL Configuration:** set **Site URL** to your website address and add it (and `http://localhost:5173` for local work) under **Redirect URLs**. Verification and password-reset links return to the site through these.
7. **Email delivery:** Supabase's built-in email sender allows only a few emails per hour and is meant for testing. Before launch add your own SMTP provider under **Project Settings > Authentication > SMTP Settings** (for example Resend, Brevo or Amazon SES). Optionally edit the **Confirm signup** and **Reset password** email templates under Authentication > Email Templates.
8. **Administrator invitation e-mail** (needs SMTP from step 7 for real use). Invitations are sent through Supabase Auth as a one-time sign-in link, so edit the **Magic Link** template (Authentication > Email Templates) to read like an invitation, for example: *Subject:* `You have been invited to administer BeiHub`; *Body:* `You have been invited to become an administrator of BeiHub. <a href="{{ .ConfirmationURL }}">Accept invitation</a>. The link works once and expires.` Keep the `{{ .ConfirmationURL }}` placeholder. Customers never receive this template (they use password login).
9. **Redirect URLs for invitations:** under Authentication > URL Configuration > Redirect URLs also add `https://your-site/**` (and `http://localhost:5173/**` for local work), so the invitation link may return to `/admin/accept-invite`.

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

## 5. The Super Admin and your administrators

**The Super Admin is created automatically.** The database knows one owner e-mail (`akiprotichamos@gmail.com`, stored in the table `super_admin_bootstrap`, which no browser can read). To become Super Admin:

1. Open `https://your-site/register`, register with that e-mail and choose a password.
2. Click the verification link in the e-mail. **The role is granted only after Supabase has verified the address**, so nobody can get it by registering with that e-mail first.
3. Open `https://your-site/admin` and sign in. You now see the **Administrators** section.

(If that account already exists and is verified, running `supabase/beihub_migration.sql` promotes it immediately.) To use a different owner e-mail on a new project, change the e-mail in the `insert into public.super_admin_bootstrap` line of the migration before running it.

**Adding administrators:** Super Admin > **Administrators > Invite admin**. Enter name, phone, e-mail and tick the permissions. The person receives an e-mail with a one-time link (valid 7 days). They open it (this signs them in and verifies the e-mail), confirm name and phone, choose a password and only then become an administrator. A person who just registers on the website can never become an admin.

| Invitation status | Meaning |
| --- | --- |
| Pending | Sent, not yet used, not expired |
| Accepted | Used once; the admin exists |
| Expired | 7 days passed; press **Resend** for a fresh link |
| Revoked | Cancelled by the Super Admin |

**Resend** creates a new link and cancels the old one. The invitation token is shown to nobody in the app and only its hash is stored.

### Permissions

| Permission | Allows |
| --- | --- |
| Manage products | Create, edit, hide, delete products, variants, stock, categories |
| Manage prices | Change prices and previous prices |
| Manage product images | Upload, replace, delete product pictures |
| Manage orders | See orders, internal notes, payment status, send updates |
| Update order status | Move orders forward |
| Cancel orders | Cancel with a predefined reason |
| Manage customers | See customers and their orders, suspend / reactivate customer accounts |
| Manage business settings | Contact details, hours, delivery information and fees |
| Manage media | Logo, banners, favicon and other site pictures |
| View reports | Dashboard figures and order totals |
| View audit logs | Read the audit log |
| Manage notifications | Send customer updates |
| Manage administrators | Invite, suspend, change other admins. **Only the Super Admin can grant it.** |

Rules enforced by the database (not by the screens): nobody can change, suspend or remove the Super Admin; nobody can change their own permissions; an admin who was granted *Manage administrators* can only manage ordinary admins, can never grant that permission and can only grant permissions they hold themselves; only the Super Admin can delete orders. Changes apply immediately, even to someone who is already signed in. **Suspending** an admin cuts all access at once; **Revoke** turns them back into a normal customer.

**Transferring ownership** is a deliberate, separate action (Administrators > Transfer ownership): the new owner must be an active, verified admin and you must type their e-mail. The old owner becomes a normal admin without *Manage administrators*. There is only ever one Super Admin.

Customers register themselves (keep sign-ups **on**). Roles and account status can only be changed through these audited database functions: not by the browser, not by a customer, not by an admin editing a profile, and not even by the Super Admin through a plain table update.

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

## 6b. How sign-in works (several people in one browser)

- **Supabase Auth is the only authentication.** There are no separate admin or customer login systems and no `currentRole` / `currentUser` values anywhere.
- The login (a real Supabase token) is kept in the tab's `sessionStorage`, which browsers keep separately for every tab. That is why tabs do not overwrite each other. The older shared `localStorage` login is ignored and deleted.
- The token only proves *who* you are. **What you may do is decided by the database** on every request (Row Level Security + permission functions). The screens ask the database "what am I?" (`my_access()`) only to decide what to show. Editing storage, cookies or the page cannot make a customer an admin: a forged token fails its signature check and a customer's requests are refused by the database. This was tested.
- **Logout** ends only the tab you log out of (`scope=local`); other tabs and other devices stay signed in.
- A **duplicated tab** (browser "Duplicate") starts logged out, because it would otherwise share the original tab's refresh token.
- A login lasts as long as the tab. A brief internet drop no longer logs you out.
- The Order List (cart) is stored in the browser and shared by tabs; the contact details typed at checkout are kept per tab.
- **Last login / logout** are recorded for every account and shown to the Super Admin. **Failed sign-in attempts** are not available to the database in Supabase; see Authentication > Logs in the dashboard.

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
  pages/admin/                 dashboard, orders, products, categories, customers, delivery, media, business settings, audit log,
                               administrators (Super Admin), accept-invite
  lib/orderFlow.js             order statuses and allowed transitions (mirrors the database rules)
  data/catalog.js              sample catalogue (feeds the SQL seed)
supabase/
  schema.sql, seed.sql         source of the base script
  BeiHub_database.sql          schema + seed                       (run 1st)
  archive/01_marketplace_upgrade.sql   order lifecycle, audit, media (run 2nd, skip if already done)
  archive/02_single_business_upgrade.sql   single business     (run 3rd, skip if already done)
  beihub_migration.sql         roles, permissions, invitations, audit  (run 4th)
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
