# Changes

## Single business + one source of truth (this release)

**Synchronisation**
- Removed the browser-only demo backend (`demo.js`, `VITE_DEMO_MODE`). It silently switched on whenever the Supabase keys were missing, giving every device its own private copy of the shop. The site now shows a setup screen instead.
- All shared data is read from Supabase on every load; requests use `cache: no-store`; out-of-order responses can no longer replace newer data.
- Supabase Realtime (lazy-loaded) refreshes open pages when products, prices, availability, images, business settings, orders, statuses or notifications change. Focus/timer refresh is the fallback.
- Order confirmation page is read from the database (no `localStorage` copy). Draft contact details are cleared on log out.
- Business Settings save only the edited fields and refuse to overwrite a field changed elsewhere. The Delivery page no longer re-saves the whole (possibly stale) settings object.
- Server-side validation of business information (phone, WhatsApp digits, email, http(s) links).

**Single business**
- Removed shops everywhere: pages, nav, cards, filters, distance search, comparison, admin section, `shop_id` columns, shop RLS/storage policies and functions. Old rows are archived, not deleted.
- New customer navigation: Home, Products, Categories, My Orders, About, Contact. `/shop` and `/shops` redirect to `/products`.
- New admin navigation: Dashboard, Orders, Products, Categories, Customers, Delivery, Media, Business Settings, Audit Logs.

**Orders**
- Predefined cancellation reasons (with "Other, please specify") and predefined customer update messages, stored in the database; new `admin_send_order_update()`.
- Admin sees new orders live (toast + badge).

**Database:** see `supabase/beihub_migration.sql`.

---

# BeiHub upgrade: what changed

Run `supabase/beihub_migration.sql` after `supabase/BeiHub_database.sql` (see README section 4).

## Customers
- Browse everything without an account: shops, products, search/filters (name, category, price, availability, shop, county, optional distance), price comparison across shops, shop pages with location and contact.
- Register / log in / log out, email verification (+ resend), forgot/reset password, unverified-account warning.
- Order flow: Order List > Review > Contact details > Confirm (deposit notice + Continue) > "Order Submitted Successfully" (Pending).
- Contact details (name, phone, alternative phone, email, preferred contact, notes) are stored on the order itself.
- My orders: number, date, products, total, status, last update, detail page with progress bar, timeline and cancellation reason. In-system notifications (bell + page).

## Admin
- Orders: search (number/name/phone/email), filters, lifecycle actions, payment tracking, cancellation with required reason, internal notes, full timeline.
- Shops (approve / reject / suspend / hide / edit / images / products / orders), product statuses, Images & media (logo, favicon, hero, banners, about, defaults), Audit log, System settings > Contact information.

## Database (beihub_migration.sql)
- New: shops, site_media, order_events, notifications, audit_log. Extended: profiles, products, orders, order_items, store_settings.
- Order statuses/transitions/numbers (BH-000001), RLS, storage policies, audit triggers. `orders.admin_notes` moved into admin-only timeline notes (customers could have read it).

## Not included (by design)
- No online payment or external email/SMS/WhatsApp sending (hooks are in place: README section 10).
- No shop-owner dashboard UI (database permissions for owners exist; admins manage shops).
