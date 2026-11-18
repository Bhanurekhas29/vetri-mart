# Vetri Mart: Project Plan

Status: PLANNING. Backend project scaffolded (Django + MySQL + Jazzmin admin), no app code yet. All 12 screen groups are confirmed, the questions document is done, and the database schema is built (accounts, catalog, orders, content), and the API endpoint list is confirmed. Next: build the API in slices.

## 1. Overview
- **Brand / app name:** Vetri Mart ("Vetri" = victory in Tamil)
- **Type:** Single-store e-commerce mobile app (Amazon/Flipkart-style), mixed product categories
- **Market:** India, currency INR
- **Purpose:** Client demo (NOT a Play Store release). Distributed as an APK link built with EAS Build.
- **Platform:** Android first, iOS later. No website.
- **Team:** Solo developer working with Claude.
- **All content is managed from the admin panel** (products, home sections, banners, offers, orders) and served to the app via API.

## 2. Tech stack
| Layer | Choice |
|---|---|
| Frontend | React Native with Expo |
| Backend | Python, Django (+ Django REST Framework) |
| Database | MySQL |
| Auth | JWT access + refresh tokens (stored in secure storage on the phone) |
| Media | Cloud storage (S3 or Cloudinary) behind a CDN. DB stores URLs only. |
| Payments | Razorpay, test mode for the demo (UPI, cards, net banking, wallets). COD later, not in the demo |
| Email (OTP/orders) | Gmail SMTP for the demo; Amazon SES/Brevo/Zoho later |
| Testing | Expo Go / web during development; EAS APK for the team lead |

### Backend setup (done)
- Python 3.14, virtualenv at `backend/venv/`, dependencies pinned in `backend/requirements.txt`.
- **Django 5.2 LTS** (not 6.x: Django 6 needs MySQL 8.4+, the local server is MySQL 8.0.45). Upgrade both later, MySQL first, after backing up the DB.
- Django REST Framework, `mysqlclient`, `python-dotenv`.
- Database: MySQL, name `vetri_mart_db` (utf8mb4), local app user `vetrimart_superuser` with rights on that database only. Settings are read from `backend/.env` (git-ignored); `backend/.env.example` is the template.
- Admin theme: **Jazzmin** with its standard colours (decision: do NOT use the brand navy/orange in the admin). Only the title/header text says "Vetri Mart". No logo yet.
- Dev admin login `admin` is for local use only; change the password before any real deployment. Staff can type the short name `admin` at the admin login (a small login alias in `accounts/backends.py` maps it to `admin@vetrimart.local`); customers and the app's own login are unaffected and use real emails.
- Run locally: `venv\Scripts\python manage.py runserver`, admin at `http://127.0.0.1:8000/admin/`.
- Django apps (all inside `backend/`): `accounts`, `catalog`, `content`, `orders`. Grouping: accounts = users, addresses, OTP codes; catalog = categories, brands, products, variants, images, bundles, reviews, product Q&A, wishlist; content = home sections, banners, deal windows, popular searches, notifications, FAQs, static pages; orders = cart, orders, order items, payments, coupons, serviceable pincodes, delivery settings.
- **`accounts` built:** custom `User` (email is the login, unique and stored lowercase; name; phone not unique; photo URL; two email preference flags; OTP-only users have no usable password), `Address` (per-address recipient name and phone, label, one default per user enforced in code because MySQL has no conditional unique index, soft delete), `OTPCode` (code stored hashed, 10-minute expiry, 5 wrong tries, used_at). Token revocation uses `djangorestframework-simplejwt` with its blacklist tables (access token 30 min, refresh 30 days, rotated and blacklisted). The database was reset once so the custom user could be created before any migration.
- Rate limit "5 OTP sends per hour per email" is checked by counting recent OTPCode rows (to be done in the API step).
- **`catalog` part 1 built:** Category (two levels, enforced in code), Brand, Colour and Size lookup tables, Product (`is_sponsored`, `is_active`; hidden, never deleted), ProductSpecification, ProductVariant (SKU unique; price and MRP DECIMAL(10,2); database checks: price above 0 and MRP at least price; discount percentage calculated), ProductImage (attached to the product with an optional colour; blank colour means shown for all variants), Bundle and BundleItem (specific variants, bundle price), Collection and CollectionItem. A variant with no colour or size is allowed once per product (checked in code because MySQL treats NULL values as distinct).
- **`orders` built:** CartItem (unique per user and variant, `saved_for_later`), DeliverySetting (single row; fee 40 and free above 499 are placeholder defaults, amounts still to be chosen), ServiceablePincode (delivery days min and max), Coupon (percent or flat, optional cap, minimum order, validity window, optional total usage limit; code stored uppercase), Order (sequential number `VM-000042`, status, address snapshot, coupon snapshot, coupon discount, delivery fee, total charged, courier and tracking), OrderStatusEvent (the tracking timeline and audit trail, with who changed it), OrderItem (snapshot of name, colour, size, SKU, image, price paid, MRP, quantity), Payment (one row per attempt; Razorpay ids unique; no card details). "Refunded" is calculated from the payment, not stored on the order. The product discount is calculated from item MRP and price.
- Rules left for the API step: stock is reduced when Razorpay confirms payment and returned on cancel; a coupon can be used once per user (counted from non-cancelled orders); the first timeline event is written when the order is created; invoice PDF is generated from the order on request.
- **`catalog` part 2 built:** Review (rating 1 to 5, title, body, `is_visible`; a real review links the user and a delivered order item of that product, one review per user per product, the customer can edit or delete their own, shown immediately and the admin can hide it; admin sample reviews have no user or order item and only a typed reviewer name; "Verified purchase" is calculated; average and count are calculated from visible reviews), ProductQuestion (admin writes the answer, only answered ones shown), WishlistItem (unique per user and product; stores the lowest active variant price at saving so "Price dropped" is calculated).
- **`content` built:** HomeSection (kind, order, active, item limit default 6, collection for product rows), Banner (image and at most one tap target: category, product or collection), Deal and DealItem (scheduled deals; the Home section shows the one active now), SearchTerm (normalised, counted; top terms become Popular searches), OnboardingSlide (admin-managed), Notification (created automatically by signals when an order status changes or a payment fails or is refunded; nothing for Pending payment), FAQ, ContactInfo (single row), StaticPage (Terms, Privacy, About). "Recently viewed" stays on the phone only; no table.
- **Database schema is complete for all 12 screen groups.** Emails for notifications are still to be sent in the API step.
- Next: list the API endpoints (step 4 of "Next steps").

Note: Expo Go cannot run the Razorpay native SDK. Payments are tested in an EAS development build or the APK.

## 3. Repository structure
Root folder: `e-commerce mobile app` (a hyphenated name such as `e-commerce-mobile-app` avoids problems with spaces in scripts; the user's choice stands).

```
e-commerce mobile app/
  PLAN.md
  CLAUDE.md
  frontend/    <- React Native (Expo)
  backend/     <- Django project `vetrimart`
```
Only two folders. Docs and config live as files at the root.

- Android app ID (demo): `com.vetrimart.app` (can be changed before any real release)

## 4. Brand (draft, not final)
| Role | Color | Hex |
|---|---|---|
| Primary (headers, nav) | Deep Navy | `#0B1F4B` |
| Accent (buttons, offers) | Vibrant Orange | `#F57C00` |
| Background | Soft Off-white | `#F7F8FC` |
| Text | Charcoal | `#1B1F2A` |
| Success / discount tags | Green | `#1E8E3E` |
| Error | Red | `#D93025` |

- Orange is for buttons and badges, not text on white (poor contrast).
- Logo directions: (a) bold "V" with a cart/tick, (b) "V" shaped like a shopping bag, (c) wordmark "Vetri" in navy + "Mart" in orange. Lean: (a) for the app icon, (c) for the header.

## 5. Auth and account decisions (confirmed)
- **Login methods now:** Email OTP and email + password. Google login later. Phone OTP later (needs DLT registration in India).
- **Guest browsing is allowed.** Users can browse and add to cart; login is required at checkout.
- **Identity:** verified email is the account identity.
- **Phone number:** collected at the first delivery address and mandatory there (the courier needs it). Used later for WhatsApp updates (needs WhatsApp Business API + customer opt-in; out of scope for the demo).
- After the first OTP login, ask the user to set an email/password (optional, can be skipped).
- **Multiple devices allowed.** Settings has "Log out from all devices".
- **Logout:** button in Profile, with a confirmation; clears tokens and returns to Login.
- **Account deletion:** not needed for the demo (was a Play Store requirement). Keep on the "later" list.
- **OTP rules:** 6 digits, 30-second resend timer, expiry, limit on wrong attempts, rate limiting.
- **Password storage:** Django's built-in hashing (PBKDF2/Argon2). Never stored in plain text.

### Entry flow (draft, to confirm in detail)
1. Splash: logo on navy while the app checks for an existing session.
2. Onboarding: 3 slides, shown once, with Skip.
3. Login: email field + "Send OTP", "Login with password", "Continue as guest".
4. OTP screen: 6-digit input, resend timer, "change email".
5. First-time registration: name (required), optional password.
6. Email + password login with a show/hide toggle and "Forgot password?" (reset via emailed OTP).

### Entry flow decisions (confirmed)
- **Mockup approved** for onboarding (3 slides, Skip, Next), Login (email, Send OTP, Login with password, Continue as guest), OTP verification (6 boxes, change email, resend timer), and Register (name required, optional password).
- **Session:** the user stays logged in until they log out. Refresh tokens last about 30 days and renew on use. Tokens are held in secure storage on the phone.
- **OTP rules:** 6 digits, expires in 10 minutes, 5 wrong tries, 5 sends per hour per email, 30-second resend timer. OTPs stored hashed.
- **Password rule:** 8+ characters with at least one letter and one number.
- **Guest:** "Continue as guest" opens Home. Browsing and the cart work without login. Checkout, wishlist and writing reviews ask the user to log in, then return them to where they were.

## 6. Delivery
- Demo: orders are handed to a courier such as ST Courier manually. The admin enters courier name and tracking number on the order.
- Later: Shiprocket integration when the client requests it.

## 7. Admin panel (Django admin to start)
Four roles, created as Django groups. Only Super Admin is used for now.
- **Super Admin:** everything, including users and roles.
- **Catalog Manager:** products, categories, images, prices, stock.
- **Order Manager:** view orders, change status, enter courier and tracking, refunds.
- **Content/Marketing Manager:** home sections, banners, coupons, bundles, featured/sponsored flags.

## 8. Product and feature rules (agreed so far)
- **Product vs Variant:** a Product (name, description, brand) has Variants/SKUs (size, color, price, stock).
- **Discount labels are calculated** from MRP and selling price ("20% off"), never stored.
- **"Featured"** (was "Sponsored", renamed 16 Nov 2026; a real "Sponsored" label is on the Later list) is an admin-controlled flag (single store): pins products higher and shows a "Featured" tag.
- **"Already purchased" highlighting** is derived from order history, not stored.
- **"Buy these together to save":** admin-created bundles first; automatic co-purchase suggestions later.
- **Order items snapshot the price** paid, so later price changes do not alter old orders.
- **Money is DECIMAL, never float.** Timestamps in UTC. (The admin panel shows and accepts India time, `Asia/Kolkata`, set 16 Nov 2026; the database and the API still use UTC.)

## 9. Database schema principles
- Normalised tables, no duplicated data; unique constraints on emails, SKUs, slugs.
- Foreign keys with sensible on-delete rules; indexes on lookup fields.
- Soft delete where history matters (products, addresses).
- Passwords hashed; OTPs stored hashed with expiry; refresh tokens revocable (needed for "log out from all devices").
- Media stored as URLs only.
- The actual tables will be designed after the screens are agreed.

## 10. Screens to plan (one by one, section by section)
| # | Group | Status |
|---|---|---|
| 1 | Splash and onboarding | CONFIRMED (see "Entry flow decisions") |
| 2 | Login / OTP / Register / Forgot password | CONFIRMED (see "Entry flow decisions") |
| 3 | Home (top bar, sections: deal of the day, recommended deals, categories, banners, discount labels, featured/sponsored cards) | CONFIRMED (see "Home page decisions") |
| 4 | Search and filters | CONFIRMED (see "Search decisions") |
| 5 | Category and product listing | CONFIRMED (see "Category listing decisions") |
| 6 | Product detail (images, video, variants, reviews, similar items) | CONFIRMED (see "Product detail decisions") |
| 7 | Cart | CONFIRMED (see "Cart decisions") |
| 8 | Checkout (address, payment, "buy together" suggestions, coupons) | CONFIRMED (see "Checkout decisions") |
| 9 | Order success, My Orders, order detail and tracking | CONFIRMED (see "Orders decisions") |
| 10 | Wishlist | CONFIRMED (see "Wishlist decisions") |
| 11 | Profile, addresses, settings | CONFIRMED (see "Profile and settings decisions") |
| 12 | Notifications and support | CONFIRMED (see "Notifications and support decisions") |

### Home page decisions (confirmed)
- **Layout control:** fixed section types (category strip, banner carousel, deal of the day, product row, mid-page banner). Admin picks a type, sets title, order and active flag; the app draws what the API returns in one call.
- **Navigation:** bottom tabs only (Home, Categories, Wishlist, Orders, Profile). No side menu.
- **Top bar:** logo/wordmark, search bar (opens Search), cart icon with count badge.
- **Extras in the demo:** deal-of-day countdown timer (end time set in admin), recently viewed row, pull-to-refresh with skeleton loaders, delivery pincode bar under the top bar.
- **Ratings on product cards:** yes, star rating and count. This means a reviews table is needed from the start; the average and count are calculated, not stored.
- **Home mockup approved** (top bar, pincode bar, category strip, banner carousel, deal of the day, recommended deals, recently viewed, bottom tabs).
- **Banner tap:** admin picks the target (a category, a product, or a collection) per banner.
- **Deal of the day:** admin picks products and a start and end time; the countdown runs to the end time and the section hides itself when the window ends.
- **Row size:** the number of items shown before "See all" is a field set per section in the admin.
- **Recommended deals:** products chosen manually by the admin; sponsored ones rank first. No algorithm for the demo.
- Draft order of sections: top bar, pincode bar, category strip, banner carousel, deal of the day, recommended deals, admin-defined rows, recently viewed.

### Product detail decisions (confirmed)
- **Layout (top to bottom):** top bar (back, share, cart), image gallery with thumbnails and an optional video, brand, name, rating summary, price block (price, MRP, calculated "% off", "inclusive of all taxes"), variant pickers, stock message, delivery check, description and specifications, ratings and reviews, similar items, sticky bottom bar.
- **Variants:** colour and size pickers only (fixed option types). Each colour/size combination is one variant with its own price, MRP, stock, SKU and images. Out-of-stock combinations are shown greyed out and struck through.
- **Reviews:** only verified buyers can write one; shows a "Verified purchase" tag. Delivery is handled manually by couriers, so the app cannot know when an order arrives: the admin manually marks the order as "Delivered" (confirming the customer received it), and only then can that customer review the products in it. Average and count are calculated, not stored. Admin can also enter sample reviews for the demo.
- **Bottom bar:** "Add to cart" and "Buy now". Buy now goes straight to checkout (login required).
- **Delivery check by pincode:** admin keeps a list of serviceable pincodes with delivery days; the app shows "Delivery in X to Y days" or "Not deliverable". Feeds the delivery-fee decision later.
- **Buy these together to save:** admin-created bundles (products plus a combined price); the saving is calculated.
- **Share button:** opens the phone's share sheet with product name, price and image link as text. Real deep links come after the demo.
- **Product Q&A:** customers ask, admin answers in the admin panel; only answered questions are shown. Built last.

### Category listing decisions (confirmed)
- **Layout:** top bar (back, category name, search, cart), subcategory chips ("All" plus subcategories), Sort and Filter bar with an active-filter count, product count, two-column product grid, bottom tabs (Categories tab highlighted).
- **Category tree:** two levels only (category and subcategory).
- **Product card:** image, discount tag (calculated), wishlist heart, name, star rating and count, price and MRP, "Featured" tag where flagged, "Out of stock" label instead of a rating when unavailable.
- **Sort:** Relevance (default: sponsored first, then admin order), price low to high, price high to low, newest first, discount highest first. (No sort by rating.)
- **Filters:** price range, in stock only, brand, minimum discount, colour and size. (No rating filter.)
- **Paging:** infinite scroll, 20 products per page.
- **Search results (screen 4)** reuse this same listing, grid, sort and filters.

### Search decisions (confirmed)
- **Search screen:** search field in the navy bar, "Recent searches" (with Clear) and "Popular searches" chips. While typing: prefix suggestions from product and category names (product suggestions show a thumbnail and its category).
- **Matches against:** product name, brand and category name only. Plain MySQL, no search engine. No typo correction (can be added later with a search engine).
- **Recent searches:** stored on the phone only (works for guests, no backend table).
- **Popular searches:** automatic, from real searches. The backend logs each search term (normalised, with a count); the top terms are shown. The block stays hidden until there is data, so a fresh demo may show none. (Fallback idea if the demo looks empty: seed some searches, or add an admin list. Not decided.)
- **Results page:** reuses the Category listing grid, sort and filters (screen 5).

### Cart decisions (confirmed)
- **Layout:** top bar ("My cart (N)"), delivery pincode row with Change, item cards (image, name, variant, price, MRP, calculated "% off", stock warning, quantity stepper, Save for later, Remove), Apply coupon row, Price details (price, discount, delivery, total, "You save"), sticky bottom bar with total and "Place order".
- **Guest cart:** kept on the phone for guests; at login it merges into the server cart (the same variant adds quantities). Logged-in carts live on the server and sync across devices.
- **Price and stock changes:** the cart always shows the current price. A notice appears when it changed ("Price changed from X") or stock is low ("Only N left"). Out-of-stock items are flagged and block Place order until removed.
- **Quantity:** limited only by available stock (no fixed cap per item).
- **Extras in the demo:** Save for later (excluded from the order total), coupons (admin-created: percent or flat, minimum order, expiry), "Buy together" bundle suggestion strip.
- **Not in the demo:** free-delivery progress bar (depends on the open delivery fee rule).
- Place order goes to Checkout (login required).

### Checkout decisions (confirmed)
- **Layout:** top bar, step indicator (Address, Payment, Done), delivery address card with Change and delivery estimate, order items summary (thumbnails, count, View), applied coupon row, payment method list, price details (price, discount, coupon, delivery, total), sticky "Pay amount" bar. Login is required to reach checkout.
- **Delivery fee:** flat fee set in the admin, free above an order-value threshold (also set in the admin). Not by weight or pincode. This also lets the cart show a "free delivery" progress bar later (not added to the cart yet).
- **Addresses:** saved address book, one default. Fields: name, phone (mandatory on the first address), pincode, city, state, address lines, label (Home/Work/Other). Add, edit, delete (soft delete). One address is chosen per order, and its details are copied onto the order as a snapshot.
- **Payment methods now:** UPI, Cards, Net banking and wallets, all through Razorpay test mode. **Cash on delivery is NOT in the demo**, to be added later (needs a COD rule such as limits or a fee).
- **Order flow:** tapping Pay creates the order as "Pending payment"; stock is reduced and the order becomes confirmed only when Razorpay confirms the payment. Failed or abandoned payments can be retried. Payment is verified on the server (signature check), never trusted from the app alone.
- **Coupons:** applied in the cart or checkout; the discount is shown as its own line and stored on the order.

### Profile and settings decisions (confirmed)
- **Profile tab:** header with avatar (photo, or initials if none), name, email and an edit icon; shortcuts (Orders, Wishlist, Addresses, Help); list: Edit profile, My reviews, Notifications, Settings, About Vetri Mart; Log out button (with confirmation) and app version.
- **Edit profile:** name, phone and profile photo. The photo is stored in cloud storage; the DB keeps only the URL. Email cannot be edited.
- **Change email:** left out of the demo (email is the verified identity).
- **Addresses (gifts):** the address book lets each address have its own recipient name and phone, so a user can add a new address to send a gift to someone else. At checkout "Change" lets the user pick or add an address. (Same address book as in Checkout decisions.)
- **Settings:** Account (set or change password, log out from all devices as already decided earlier), Notifications (email preferences: order updates, offers and deals; push notifications later), About (Terms and conditions, Privacy policy, About Vetri Mart; static text managed in the admin), **Dark mode**.
- **Dark mode:** included in the demo. It needs a dark colour set applied to every screen; the dark palette is still to be designed and confirmed. Orange stays for buttons and badges.
- **Not in the demo:** app language switch (English/Tamil), push notifications.

### Orders decisions (confirmed)
- **Order success screen:** green tick, "Order placed", order number, amount and method paid, delivery estimate, buttons "View order" and "Continue shopping". A confirmation email is sent.
- **My Orders:** list with filter chips (All, Active, Delivered); each card shows thumbnail, first item name (+N more), order number, date, a status badge, and "Rate and review" on delivered orders.
- **Order detail:** tracking timeline (Order placed, Confirmed, Shipped with courier name and tracking number, Delivered; each with a timestamp), items, delivery address (snapshot), price breakdown (item total, discounts, coupon, delivery, total paid), buttons Invoice and Cancel order.
- **Statuses:** Pending payment, Confirmed, Shipped, Delivered, Cancelled. The admin moves orders to Shipped (entering courier and tracking number) and Delivered by hand. Delivered unlocks reviews (see Product detail decisions). A "Refunded" marker is shown on cancelled paid orders once the admin has refunded.
- **Cancel:** the customer can cancel while the order is Pending payment or Confirmed; stock is returned. After Shipped, they must contact support.
- **Returns and refunds:** no return flow in the demo. The admin refunds manually in Razorpay for cancelled paid orders.
- **Invoice:** a downloadable PDF invoice (no GST fields unless the client provides them). Timestamps in UTC, shown in local time in the app.

### Wishlist decisions (confirmed)
- **Layout:** top bar "My wishlist (N)", two-column grid of cards (image, remove X, name, price and MRP, "Move to cart"), bottom tabs with Wishlist highlighted. Empty state: heart icon, "Save items you love", "Start shopping".
- **What is saved:** the product, not a specific variant (one heart per product, unique per user and product). "Move to cart" adds the product if it has a single variant, otherwise opens the product page to choose colour and size.
- **Labels on cards:** "Price dropped" (the current price is lower than the price when it was saved, so the price at the time of saving is stored with the wishlist entry), "Only N left" and "Out of stock". No push notification needed.
- **Out of stock:** the card is greyed with a disabled state. "Notify me" (back-in-stock alert) is NOT in the demo.
- **Guests:** tapping the heart asks the user to log in, then saves the product and returns them to where they were. No guest wishlist on the phone.
- The heart appears on product cards (Home, listings, search) and on the Product detail page.

### Notifications and support decisions (confirmed)
- **Notifications:** an in-app list plus email. The list shows title, message and time, with an unread dot and "Mark all read". The bell icon with an unread count sits on the Home top bar next to the cart. Emails follow the preferences in Settings. No push notifications in the demo (needs Firebase and a development build).
- **Events that create a notification now:** order confirmed, shipped, delivered, cancelled (created automatically when the order status changes), and payment failed or refunded.
- **Later (not in the demo):** admin announcements and offers, review reminder after delivery, push notifications.
- **Help and support:** a screen reached from the Profile shortcut "Help". It has FAQs (expandable questions and answers) and contact details (email, phone with hours), both managed in the admin. No message form, no live chat in the demo.
- Reviewing is still unlocked by the admin marking the order Delivered (see Product detail decisions).

### API endpoints (confirmed list; nothing built yet)
Base `/api/v1/`, JSON, JWT login where marked. Money as strings, UTC times, 20 per page, one error shape `{code, message, fields}`, OTP endpoints rate-limited. Admin stays on Django admin (no API).
- **Accounts:** `auth/otp/send`; `auth/otp/verify` (existing user gets tokens, new email gets a short-lived registration token); `auth/register` (name required, optional password); `auth/login`; `auth/token/refresh`; `auth/logout`, `auth/logout-all`; `auth/password/reset`; `auth/password/set` (login); `me` GET/PATCH (login); `addresses` list/create, `addresses/{id}` update/delete (login).
- **Browsing (guest OK):** `home` (the whole Home page in one call); `categories`; `products` (listing and search, sort, filters, paging); `products/filters?category=`; `products/{slug}` (variants, images, specs, rating summary, bundles, similar items); `search/suggestions?q=`; `search/popular`; `delivery/check?pincode=`. A search through `products?q=` also records the search term.
- **Reviews, Q&A, wishlist:** `products/{slug}/reviews` GET, POST (verified buyers), `reviews/{id}` PATCH/DELETE (own); `products/{slug}/questions` GET, POST; `wishlist` GET/POST, `wishlist/{product}` DELETE (login).
- **Cart, checkout, orders (login):** `cart`; `cart/items` and `cart/items/{id}`; `cart/merge` (guest cart at login); `checkout/summary`; `orders` POST (creates a Pending order and a Razorpay order); `orders/{id}/payment/verify`; `orders/{id}/payment/retry`; `payments/razorpay/webhook`; `orders` GET and `orders/{id}` GET; `orders/{id}/cancel`; `orders/{id}/invoice` (PDF).
- **Content and notifications:** `onboarding`, `faqs`, `contact`, `pages/{slug}` (guest OK); `notifications`, `notifications/unread-count`, `notifications/{id}/read`, `notifications/read-all` (login).
- **API decisions:** Home loads in one call returning every active section. A new user gets a registration token after the OTP and no account exists until the name is entered. Payments are confirmed by the app's verify call, with the Razorpay webhook as a backup (the webhook needs a public URL, so it may not work on a laptop-only demo). An auto-generated docs page at `/api/docs/` (drf-spectacular).
- Profile photo upload is not listed: it depends on the cloud storage choice (S3 or Cloudinary), still open. For now `PATCH me` takes a photo URL.
- Build order proposal: accounts and auth, then browsing, cart and wishlist, then checkout and orders, then content and notifications; each with test cases.

### Build approach and app stack (confirmed)
- **Build in slices, not the whole API first.** Each slice is a backend part plus the app screens that use it, tested together. Order: 0 Expo setup; 1 accounts and auth; 2 browsing (home, categories, products, search); 3 cart and wishlist; 4 checkout and orders with Razorpay test mode; 5 content and notifications. Dark mode and the hosting step come at the end. The admin panel (Django admin with Jazzmin) already exists for every table; only content entry is left.
- **App stack:** React Native with Expo, TypeScript, Expo Router (file-based screens), TanStack Query (server data, loading and error states), axios (API calls, attaches the login token), Expo SecureStore for tokens (simple storage fallback in the browser for testing only).
- **Testing devices:** Expo Go on the developer's Android phone, on the same Wi-Fi as the laptop (API address set to the laptop's Wi-Fi IP).
- **OTP email while developing:** the code is printed in the Django terminal (dummy). Real email (Gmail SMTP) is connected later, before the client demo. OTP hashing, expiry and limits are unchanged.
- The developer reads the generated code; Claude explains each file as it is created.

### Build progress
- **Slice 0 (Expo setup): code written.** Brand theme, five tabs, API client, token storage, health check.
- **Slice 1 (accounts and auth): code written, not yet tested on a phone.** Backend: 12 auth and account endpoints (OTP send and verify, register, password login, token refresh, logout, logout from all devices, password reset and set, profile, address book) plus `GET onboarding/`; 71 automated checks passed. API docs at `/api/docs/`. OTP emails print in the Django terminal. App screens: onboarding, login, code check, sign-up, password login, forgot password, Profile tab, edit profile, settings, set password, address list and form. Typecheck, lint and an Android bundle all pass.
- From now on the work is done in small steps, one at a time, each checked on the phone before the next. Profile photo upload is still not built (cloud storage choice open).

### Images and media (decided while starting the Home page)
- Images are **uploaded in the admin panel** (upload button with a preview), not pasted as links. This changes the earlier "database holds URLs only" rule: the database now stores the uploaded file's path, and the API returns a full link for the app.
- **Alt text is required whenever an image is added** and is typed in the admin (product images, banners; category icons, brand logos and onboarding slides when they have a picture). The app uses it for screen readers and as the fallback text if a picture does not load.
- **Storage:** the server's own `backend/media/` folder (git-ignored), served by Django to the phone. **No Cloudinary.** `frontend/public` is not used: it exists only for web builds, and files inside the app would need a rebuild for every change. For the client demo the hosted backend serves the same folder; S3 stays an optional later choice, switched with one setting.
- Product videos and the profile photo stay as links for now.

### Admin panel layout and site settings (decided)
- **Menu order:** Dashboard, then **Authentication and Authorization** (first group), then Accounts, Catalog, Orders, Content. The first group holds, in order: Users, Groups, SEO, Email settings, Payment settings, Brand. Internal groups (Site settings, Token blacklist) are hidden.
- **Icons:** Font Awesome (ships with the admin theme), one per menu item. This theme shows icons on items, not on the group headings.
- **New app `siteconfig`** with four single-record screens (the menu link opens the form directly; no Add or Delete):
  - **SEO:** meta title, meta description, primary keywords, secondary keywords. Stored now; nothing reads them yet.
  - **Email settings:** switch for real emails, SMTP host, port, security (TLS, SSL, none), username, app password, sender name and email, and a "send a test email" box. The mail sender uses these once switched on; until then OTP and other emails print in the Django terminal. If SMTP fails, the API answers a friendly 503 and the details go to the server log.
  - **Payment settings:** Razorpay key ID and key secret.
  - **Brand:** company name, company logo (upload, alt text required), credits info (default: "Designed and developed by vetriitsystems.com") with an optional link. The name and logo show in the admin header and login page, and the credits show in the admin footer.
- **Secrets rule (changes the earlier "secrets only in environment variables" rule for these two values):** the SMTP app password and the Razorpay key secret are typed in the admin and saved **encrypted** in the database. The encryption key is `SETTINGS_ENCRYPTION_KEY` in `backend/.env` (git-ignored). The admin shows them as dots, never prints them back, and a blank box keeps the saved value. The Django SECRET_KEY and the database password stay in `.env`.
- Not built yet: the Razorpay webhook secret (added when payments are built), and nothing in the app uses Brand or SEO yet.

### Home API (built, step A2)
- `GET /api/v1/home/` (guests allowed) returns `{ sections: [...] }` in the admin's order. Each section has `id`, `kind`, `title` plus its content: `category_strip` gives `categories` (active top-level, icon and alt text); `banner_carousel` and `mid_banner` give `banners` (image, alt text, optional `target` of type category, product or collection); `deal_of_day` gives the live `deal` (name, `ends_at`, `seconds_left` counted by the server, products); `product_row` gives its `collection` (slug, name), `products` and `has_more`.
- Empty or switched-off sections are left out: no active banners, no live deal, no products, a switched-off collection or section.
- **Product card:** id, slug, name, brand, image and alt text (first image by sort order), price and MRP (cheapest active variant, as text with two decimals), calculated `discount_percent`, `rating` and `rating_count` (visible reviews only), `is_sponsored`, `in_stock`. Products that are inactive, in a switched-off category or without an active variant never appear; out-of-stock products appear and are flagged.
- Product rows put sponsored products first, then follow the admin order, and stop at the section's item limit. A fixed number of database queries (13) no matter how many products.
- Next Home steps: A3 demo data, then the app screens B to G.

### Demo products (added while building Home)
- `python manage.py seed_demo_products` adds 10 sample products (boAt, Sony, Pentonic, Reynolds) with colour variants, specifications and prices across Headphones, Neckband, Earbuds, Gel Pens and Ball Pens. It adds no pictures (uploaded in the admin with alt text), needs the categories and brands to exist, and is safe to re-run: it only adds what is missing and never overwrites edited data. Two products are marked Featured (Sony MDR-EX15AP, Reynolds Jiffy) and one variant is out of stock (Sony MDR-EX15AP in white), to exercise those cases.

- `python manage.py seed_demo_home` (run after `seed_demo_products`) creates a "Recommended deals" collection of 8 products, a live "Deal of the day" with 4 products (30 days from the first run; change the dates in the admin), and the Home sections: category strip (order 1), deal of the day (3), recommended deals (4, limit 6). No banners, because a banner needs a picture; add banner sections and banners in the admin. Safe to re-run.
- Pictures are still to be uploaded in the admin; until then the app shows a placeholder tile wherever a product, category or banner has no picture.

### Home page in the app (step B built)
- The Home tab draws its own header: Vetri**Mart** wordmark, bell and cart icons (counts hidden until those features exist) and a search box, then the pincode bar, then the sections from `GET home/`. Sections not built yet are skipped. Search, cart, bell and category taps open simple "coming soon" pages.
- **Pincode bar:** shows "Deliver to 600001". The pincode is the one the user typed (remembered on the phone), else the default address pincode when logged in, else the bar says "Add your delivery pincode" and the question opens once automatically (closing it counts as asked). It only validates 6 digits for now; the delivery check against serviceable pincodes comes with Product detail.
- **Category strip:** round tiles from the admin's main categories; a tile without a picture shows a grey placeholder with an icon. The shared `Picture` component does the same for products and banners later.
- **Deal of the day (step D built):** a titled row of product cards with a live countdown (`HH:MM:SS`, or `Nd HH:MM:SS` when a day or more is left). The countdown runs from the moment the phone received the server's `seconds_left`, so the phone's own clock cannot make it wrong. At zero the app asks for fresh Home data, and the server then leaves the section out.
- **Product card (`ProductTile`):** picture fitted whole inside a square (grey cube placeholder when there is none), green "% off" badge, orange "Featured" badge, two-line name, star rating and count (when there are reviews) or a red "Out of stock", price and struck-through MRP. Prices use Indian grouping (₹1,23,456). Tapping a card opens a placeholder product page.
- **Product rows (step E built):** a titled row of the same product cards, in the server's order (sponsored first). "See all" with a chevron appears only when the collection has more products than the row shows, and opens a placeholder collection page for now.
- **Banner carousel (step C built):** full-width paged banners (2:1 pictures, rounded), moving on by itself every 4 seconds (pauses 8 seconds after the user swipes), dots below when there are 2 or more. A tap opens the banner's target (category, product or collection); a banner with no target does nothing. Mid-page banner sections use the same component. Two demo banners (Electronics sale, Recommended deals) were generated in the brand colours as stand-ins: replace them with real pictures in the admin (Home sections, Banners).
- **Pull to refresh and loading skeletons (step F built):** pulling down on Home reloads it; the first load shows pulsing grey blocks (categories, banner, product row) instead of a spinner.
- **Recently viewed (step F built):** the phone remembers only the slugs of the last 10 products opened (newest first, stored on the phone only). The row asks `GET home/recent/?slugs=a,b,c` for fresh cards, so price, stock and picture are never stale; products switched off or deleted are left out; the row is hidden when empty. Recorded when a product card is tapped (the real product page will record it too when built).
- **Announcements (moving line, added 16 Nov 2026):** a thin navy strip under the pincode bar on Home, text running right to left in one line, repeating (like an HTML marquee). Managed in the admin **Content > Announcements** (text up to 150 characters, Active tick, optional start and end time, order). Every message that is live right now runs together in the one line, separated by a dot, in the admin's order. Nothing live = the strip is hidden. Comes in the Home response as `announcements` (list of texts), so pull to refresh updates it. Stands still if the phone's "reduce motion" setting is on. **Speed and on/off** are set on one page, reached by the **"Ticker speed & on/off" button at the top of Content > Announcements** (no separate menu item) (Slow 35, Normal 55 (default), Fast 85 pixels per second; one speed for the whole line; a switch to hide the whole ticker). Called the "announcement ticker" in conversation; the menu stays "Announcements". **Decided: general announcements only; the separate "shipping information" message was dropped** (could return later, reading the amount from Delivery settings).
- The Home page is complete. Product, category and collection pages behind the taps are still placeholders (later slices).

### Product detail page (built 16 Nov 2026, except cart actions)
- **One call:** `GET products/<slug>/` returns everything (pictures, colours, sizes, variants with price, MRP, calculated discount and a stock message, specifications, first 3 reviews, answered questions, bundles, similar products). 404 for an unknown or switched-off product. Also `GET products/<slug>/reviews/?page=` (10 per page, newest first), `POST products/<slug>/questions/` (login needed; at most 3 unanswered questions per shopper per product) and `GET delivery/check/?pincode=` (serviceable pincode, delivery days, delivery fee and free-above amount).
- **Screen, top to bottom:** header (share, cart), picture gallery (swipe, thumbnails, "n / total", "Watch video" when a link is set), category path, brand, name, Featured tag, rating, price with struck MRP and calculated "% off", "Inclusive of all taxes", colour swatches and size chips (a choice with no stock is greyed and struck through but can still be tapped to see "Out of stock"), stock message ("In stock", "Only N left" when 5 or fewer, "Out of stock"), delivery check, description, specifications table, "Buy these together to save" bundles, ratings and reviews (average, bars, latest 3, "See all"), questions and answers with "Ask a question", similar products, sticky bottom bar (Add to cart, Buy now; one disabled "Out of stock" button when the chosen version has none).
- **Colour pictures:** picking a colour shows that colour's pictures first, then the general ones; if the colour has none, all pictures show.
- **Reviews:** sample reviews (typed by the admin, no buyer) have no tag; real reviews get "Verified purchase". Hidden reviews are not counted.
- **Bundles:** shown only when every item is active and in stock and the bundle really saves money (saving and % are calculated).
- **Picture zoom (added 16 Nov 2026):** tapping the big picture opens a full-screen black viewer: pinch to zoom (up to 3x), double-tap to zoom in (2x) and out, drag a zoomed picture around (kept inside its edges), swipe sideways to change picture (swiping pauses while zoomed), "n / total" counter, close button and Android back. Alt text stays on every picture. The sharpness is limited by the uploaded picture: product pictures were shrunk to 900 px, and several originals were only 200-550 px wide, so upload larger originals in the admin for sharper zoom.
- **Share:** the phone's share sheet with name, price and the first picture's link.
- **Opening a product** also adds it to "Recently viewed".
- **Not yet wired (next slice, cart and wishlist):** Add to cart, Buy now, Add bundle to cart (they show a "coming in the next step" message), and the wishlist heart.
- `python manage.py seed_demo_extras` (after the two other seed commands) adds 6 demo serviceable pincodes (including 600124), 12 sample reviews on 5 products and one "Pen starter combo" bundle. Safe to re-run.

### Admin top bar: bell and account menu (added 16 Nov 2026)
- **Bell** (every admin page for staff): a red count badge and a dropdown "Needs your attention" listing product questions to answer, orders to ship (status Confirmed) and shipped orders to mark delivered, each linking to the filtered list, plus the 3 latest unanswered questions. "All caught up" when nothing is waiting. It updates when a page loads (no live refresh yet).
- **Account menu:** avatar initial and name, a navy header card (name, Administrator/Staff), Change password, and a red **Log out** button (a POST form, as Django requires).
- Built in `templates/admin/base.html` (markup and styles) with the counts from `siteconfig/context_processors.py` (`admin_alerts`).

### Slice 3: Wishlist (built 16 Nov 2026)
- **Build order decided:** Wishlist first, then Cart in 3 steps: (1) server cart, Add to cart, cart screen with quantity, remove, price and stock notices (logged in); (2) guest cart on the phone that merges at login, plus Save for later; (3) coupons, price details and bundle add-to-cart. After **Add to cart** on the product page: stay on the page, show a small "Added to cart" bar with a **View cart** button, and update the cart icon count.
- **API (login needed):** `GET wishlist/` (newest first; switched-off products left out), `PUT wishlist/<slug>/` (save; safe to repeat), `DELETE wishlist/<slug>/` (remove; safe to repeat). Each entry stores the lowest price when saved; the list returns `price_dropped` (calculated: cheaper now than when saved), `only_left` (5 or fewer of the cheapest buyable version) and `single_variant_id` (for Move to cart).
- **Heart:** on every product card (Home rows, deal, similar products) and in the product page's top bar. Filled red = saved. Guests tapping it go to login; the product is saved right after they log in, and a heart tapped on a product page returns them to that page (the return request lasts 10 minutes).
- **Wishlist tab:** "My wishlist (N)" header, two-column grid, an X on each card to remove, labels "Price dropped from ₹X", "Only N left" and the usual "Out of stock" greying; guest state with a Log in button; empty state "Save items you love" with Start shopping; pull down to refresh.
- **"From" price on cards (added 16 Nov 2026):** a product card always shows its cheapest active version's price. When the versions have different prices the card says **From ₹X** (the API sends `price_from`). "Price dropped" and "Only N left" also follow the cheapest version; exact per-version price and stock are on the product page.
- **Not yet:** **Move to cart** on wishlist cards comes with the cart (step 1 of the cart).

### Slice 3: Cart step 1 (built 16 Nov 2026)
- **Decided:** the cart remembers the price when an item was added (`price_when_added`) and shows only **"Price dropped from ₹X"**; price increases are not announced (the total always uses today's price). Guests tapping Add to cart go to login and the item is added right after (back on the product page); the phone-only guest cart is step 2. **Buy now** adds the item and opens the cart; it will go straight to checkout when checkout exists.
- **API (login needed):** `GET cart/`, `POST cart/items/` (`variant_id`, `quantity`; adding the same version adds to its quantity; never above stock; the answer says if it was limited), `PATCH cart/items/<id>/` (`quantity`), `DELETE cart/items/<id>/`. Every call returns the whole cart: lines, `count`, `summary` (MRP total, discount, subtotal, delivery fee, total, you save), `can_checkout`, `blocking_lines`.
- **Rules:** quantity limited only by that version's stock (max 99 per request). A line is flagged `out_of_stock`, `low_stock` (more in the cart than in stock) or `unavailable` (version, product or category switched off); flagged lines are left out of the totals and block Place order. Delivery fee is the placeholder in Delivery settings (flat fee, free from the free-delivery amount): the fee amounts are still to be chosen.
- **Cart screen:** "My cart (N)", delivery pincode bar, a card per line (picture, name, version, price, MRP, % off, "Price dropped", "Only N left" and red problem messages, quantity stepper, line total, Remove), Price details, sticky bar with total and Place order (disabled with a hint while a line has a problem; says checkout is coming until slice 4). Empty, guest and error states.
- **Elsewhere:** cart count on the Home cart icon and on the product page's cart icon; **Add to cart** shows a small "Added to cart · View cart" bar for 4 seconds; **Move to cart** on wishlist cards (adds a one-version product and removes it from the wishlist; a product with several versions shows "Choose options" and opens its page).
- **Decided 16 Nov 2026:** product cards get **no** Add to cart button (most products have colours, and the plan's card layout has none); shoppers add from the product page or use Move to cart on the wishlist. A small "+" for one-version products could be added later if the client asks.
- **Still to build:** step 3 coupons, bundle "Add to cart", and the "Buy together" suggestion strip.

### Slice 3: Cart step 2, guest cart and Save for later (built 16 Nov 2026)
- **Decided:** **Save for later stays in the demo** (the plan keeps it; it was briefly proposed for removal and you said no). A guest can use the cart without logging in; only Place order needs an account.
- **Guest cart:** kept on the phone as a short list of version, quantity and saved flag (at most 50 lines, compact so it fits the phone's secure store). The phone never keeps prices: `POST cart/preview/` (no login) prices the list with today's prices, pictures, stock and totals in the same shape as the logged-in cart. A guest line's `id` is its version's id. Versions that no longer exist are forgotten (`missing`).
- **Merge at login:** `POST cart/merge/` adds the phone's lines to the account's cart: the same version adds quantities (never above stock); sold-out or switched-off versions are skipped; a saved guest line for a version already in the account is left alone; then the phone's cart is cleared. If the merge fails it is tried again next time.
- **Save for later:** `POST cart/items/<id>/save/` moves a line below the cart ("Saved for later (N)"), out of the totals, the count and the Place order check; `DELETE cart/items/<id>/save/` moves it back (quantity lowered to the stock, price comparison restarts from today's price). A saved line can also be removed. Adding the same version again brings it back into the cart. The same works for guests on the phone.
- **Cart screen for guests:** a banner "Log in to keep this cart on all your devices", and the order button reads **Log in to order** (login, then back to the cart). Add to cart no longer sends guests to login.
- **Not kept for guests:** "Price dropped" (no stored price until they log in; the merge starts the comparison from the price at merge time).

### Category listing, collection page and Categories tab (built 16 Nov 2026)
- **Decided:** built in one step. **Categories tab:** a two-column grid of the main categories with their pictures and sub-category names; a tap opens that category's list. **Filters:** a bottom sheet with an **Apply** button (Clear all empties the choices; the bar shows how many kinds of filter are on).
- **API (open to guests):** `GET products/` (category or sub-category `category=<slug>`, collection `collection=<slug>`, search words `q=`, `sort`, `min_price`, `max_price`, `min_discount`, `in_stock=1`, `brand` (slugs), `colour` and `size` (ids), `page`; 20 per page) answers with `count`, `next_page`, the category info (name, main category and its sub-category chips), the collection name, the sort choices and the product cards. `GET products/filters/` gives the choices for the filter sheet (only brands, colours, sizes and the price range that exist in the current list). `GET categories/` gives the Categories tab. A bad filter value or sort gives our error shape (`invalid_filter`, `invalid_sort`); an unknown or switched-off category or collection gives 404.
- **Rules:** a main category lists products from all its sub-categories; a sub-category lists its own. Price, minimum discount and the discount sort all use the **cheapest active version**, the same version the card shows (so "30% or more" matches the percentage on the card). In stock = at least one active version with stock. Search words (`q`) must all match somewhere in the product name, brand name or category names (the search screen will reuse this). **Relevance** = Featured first, then newest (the product table has no admin order field); inside a collection, Featured first then the collection's own order.
- **Screens:** category and collection pages share one list component: sub-category chips ("All" plus the sub-categories; not shown for a collection), a Sort and Filter bar, the product count, a two-column grid with hearts, endless scrolling, pull to refresh, an empty state with "Clear filters". The top bar has search and cart (with count). The old list stays faded while a new sort or filter loads.
- **Next:** the Search screen will reuse this list with `q=`.

### Search screen (built 16 Nov 2026)
- **Decided:** demo "Popular searches" are seeded (`python manage.py seed_demo_searches`: earbuds, neckband, gel pen, sony, boat, headphones, ball pen, airdopes; safe to re-run; edit or delete in Content > Search terms). Tapping a **category** suggestion opens that category's list; a product suggestion opens the product; a plain search word opens the results.
- **API (open to guests):** `GET search/suggest/?q=` (2 or more letters; up to 5 products with picture and category, and up to 3 categories; matches the start of any word in a product name, brand name or category name; nothing is counted), `GET search/popular/` (the 8 most searched words that still find something; empty until there is data), `POST search/log/` (`q`; counts a submitted search only when it finds something, so typos never become "popular"; limited to 60 a minute). Results use `GET products/?q=` (the category list's sort, filters and paging).
- **Screen:** its own navy bar with back arrow and the text box (opens with the keyboard), a clear (x) button. Empty box: "Recent searches" (on this phone, last 8, with Clear) and "Popular searches" chips. While typing: a "Search for ..." row, category suggestions, then product suggestions with a thumbnail and "in Category". Pressing search on the keyboard, or tapping a chip, saves the word to recent searches, counts it, and opens the results list (the same list as a category: chips are not shown, sort, filters, grid, 20 at a time).
- The Home search box and the search icon in the list screens' top bars open this screen.

### Notifications screen (built 16 Nov 2026)
- **Decided:** sample notifications come from `python manage.py seed_demo_notifications` (4 samples for every customer account, or `--email x` for one; safe to re-run; more can be added in Content > Notifications). **Tapping** a notification marks it read and opens the **Orders tab** for now; when order pages exist it will open that exact order.
- **API (login needed):** `GET notifications/` (newest first, 20 a page, with `unread_count`), `GET notifications/unread-count/` (the bell's number), `POST notifications/<id>/read/` (safe to repeat; someone else's gives 404), `POST notifications/read-all/`. Real notifications are written by the server when an order changes status or a payment fails or is refunded (see `content/signals.py`).
- **Screen:** title, message and time ("Just now", "5 min ago", "Yesterday", then the date), an orange unread dot and a tinted row for unread ones, an icon for order or payment, **Mark all read** in the top bar (only while there are unread ones), pull to refresh, endless scrolling, an empty state, and a "Log in" state for guests.
- **Bell on Home:** shows the unread count (hidden at 0) and is checked again every minute while the app is open.
- Emails for these events and the per-event preferences come with orders and Settings; push notifications stay out of the demo.

### Checkout and orders, step 1: checkout, payment, order placed (built 16 Nov 2026)
- **Decided:** built in **3 steps**: (1) checkout, payment, success screen (this one); (2) My Orders tab, order detail with tracking, Cancel; (3) invoice PDF, order emails polish, "Rate and review". **Real Razorpay test checkout only, no demo mode** (the keys are saved in the admin's Payment settings; a ₹1 test order confirmed they work). The payment page opens **inside the app in a web view**, because Razorpay's phone SDK does not run in Expo Go.
- **API (login needed):** `GET checkout/summary/?address_id=` (items, the chosen or default address, delivery estimate, price details, `payments_ready`, `can_pay` and the reasons in `blockers`); `POST orders/` (`address_id`: checks the cart, stock and delivery, copies the address and items onto a new **Pending payment** order, asks Razorpay for an order id and returns what the app needs to open the payment page; the secret key is never sent); `POST orders/<id>/payment/verify/` (checks Razorpay's signature on the server, then confirms the order, reduces the stock, removes the paid items from the cart, writes the "Order confirmed" notification and sends the confirmation email; safe to repeat); `POST orders/<id>/payment/failed/` (records a failed attempt and notifies); `POST orders/<id>/payment/retry/` (a new attempt for an order still Pending payment).
- **Rules:** stock is not reduced until payment is verified. If the last items sell out while a shopper is paying, the order is cancelled with the note "Out of stock after payment: refund needed", the payment is kept as paid, and the shopper is told it will be refunded (the admin refunds in Razorpay). A payment that arrives after the order was cancelled is kept the same way. Starting a new checkout silently cancels the shopper's earlier unpaid order (no notification) so the Orders list does not fill with abandoned tries. A wrong or tampered signature is refused and changes nothing. Order pictures are kept as paths and given the server address when shown. Coupons: the order already has the fields (`coupon_discount`), the coupon row comes with cart step 3.
- **Screens:** **Checkout** (Address, Payment, Done indicator; delivery address card with Change (pick or add an address) and the delivery estimate; items thumbnails with View; "Pay securely with Razorpay: UPI, cards, net banking and wallets"; price details; sticky "Pay ₹X" bar with the reasons shown in red when it cannot proceed), **Payment** (Razorpay's page; "Confirming your payment" while our server checks it; clear screens for failed, closed and "could not confirm" with Try again or Back to cart) and **Order placed** (green tick, order number, amount, method, delivery estimate, View order, Continue shopping).
- **Not built yet:** the Razorpay **webhook** (needs a public web address, which the laptop does not have; the app's own verify call is what confirms orders for now), the Orders tab and order detail (step 2), invoice PDF (step 3).

### Checkout and orders, step 2: My Orders, order detail, Cancel (built 16 Nov 2026)
- **Decided:** the **Active** chip shows Pending payment, Confirmed and Shipped (Delivered has its own chip; Cancelled appears only under All). **Cancel** is a simple confirmation pop-up, no reason asked.
- **API (login needed):** `GET orders/?filter=all|active|delivered&page=` (newest first, 20 a page: number, status, total, first item name and "+N more", picture, flags for Pay now, refund pending, refunded and "can review"); `GET orders/<id>/` (items, delivery address copy, price breakdown, payment, timeline with timestamps, courier and tracking, and the flags `can_pay`, `can_cancel`, `can_review`, `refund_pending`, `is_refunded`); `POST orders/<id>/cancel/`.
- **Cancel rules:** allowed while **Pending payment** or **Confirmed**. A Confirmed order gives its stock back; an unpaid one changes no stock. A paid cancelled order shows **"Refund pending"** until the admin marks the payment Refunded in the admin, then **"Refunded"**. After Shipped the shopper is told to contact support. Cancelling twice is harmless. The shopper gets an "Order cancelled" notification. An unpaid order silently replaced by a newer checkout is hidden from the list (still visible in the admin). Order items now always come back in the order they were added.
- **Screens:** **Orders tab** (All / Active / Delivered chips; a card per order with picture, first item and "+N more", order number, date, status badge, total, "Refund pending" or "Payment not completed" notes; pull to refresh, endless scrolling, empty and guest states). **Order details** (status badge, number, total and date; refund and unpaid notes; a vertical **tracking timeline** (Order placed, Confirmed, Shipped with courier and tracking number, Delivered, each with its time; a cancelled order shows what happened, then Cancelled in red); items (tap opens the product); delivery address copy; payment; price details; sticky bar with **Pay ₹X** for an unpaid order and **Cancel order** while allowed).
- **Linked:** Order placed → View order opens the order (Back goes to the Orders tab); tapping a notification opens its order (or the Orders tab if it is not tied to one).
- **Step 3 still to build:** invoice PDF, order emails polish, and "Rate and review" for delivered orders.

### Checkout and orders, step 3: invoice, order emails, reviews (built 16 Nov 2026)
- **Decided:** the invoice opens in the **phone's browser or PDF viewer** through a private link (no new app packages); it shows the **company name** (Brand settings) with the **support email and phone** (the Help contact details in the admin; fill them in so they print), and no GST fields; reviews: **write, edit, delete and Profile > My reviews**.
- **Invoice:** `GET orders/<id>/invoice-link/` (login; only for Confirmed, Shipped or Delivered orders of that shopper) returns a signed link valid for **5 minutes**; `GET orders/invoice/<token>/` serves the PDF with no login (the link names one order and expires; a cancelled order's link stops working). The PDF has the seller, invoice number (the order number), date, bill-to/ship-to copy from the order, payment method and reference, items with SKU and version, price (MRP), discount, coupon, delivery and **Total paid**; amounts are written "Rs. 12,34,567.00" (the standard PDF font has no rupee sign). New backend package: `reportlab` (in `requirements.txt`; run `pip install -r requirements.txt` on a new machine).
- **Emails:** besides "Order confirmed" (sent when the payment is verified), emails now go out when an order is **Shipped** (with courier and tracking number), **Delivered** (invites a review), **Cancelled** (promises the refund when it was paid) and when a payment is marked **Refunded**. They follow the shopper's own "order updates" email setting, never block anything if sending fails, and are printed in the backend window until real email sending is set up in the admin.
- **Reviews:** `GET/PUT/DELETE products/<slug>/my-review/` (login; PUT writes or changes the review; one per product) and `GET me/reviews/`. Only a shopper with a **Delivered** order containing that product can write one; it is then linked to that order line (shown as "Verified purchase"). Rating 1 to 5 (required), optional title (120) and text (2000). The admin can hide any review (Catalog > Reviews > Is visible); the writer still sees and can edit their own. Rating averages and counts are still calculated from visible reviews only. (This replaces the earlier draft `POST products/{slug}/reviews` and `reviews/{id}` endpoints.)
- **Screens:** Order details: **Invoice** row and, on a delivered order, "Rate and review" (or "Your review: N stars. Edit") for each item; **Rate and review** screen (product, five tappable stars with a word for each, optional title and text, Submit / Update, Delete); Orders list: "Rate and review" on a delivered order that still has an unreviewed item; **Profile > My reviews** (list; tap to edit).

### Admin: moving orders along (changed 16 Nov 2026)
- **Shipped and Delivered are set by hand in the admin** (no courier integration): Orders > open the order > Status > Save. Saving writes the timeline step, notifies the shopper, emails them, and (Delivered) unlocks reviews.
- **Allowed moves (the Status box offers only these):** Pending payment can only be **Cancelled**; Confirmed can become **Shipped** or **Cancelled**; Shipped can become **Delivered** or **Cancelled**; Delivered and Cancelled are final. **Confirmed is never set by hand** (only a verified payment confirms an order). **Shipped needs a courier name** (tracking number recommended).
- **Cancelling in the admin:** a **Confirmed** order's stock is put back automatically; a **Shipped** order's stock is **not** changed (the items may never come back), and the admin is told to add stock back by hand if they do; a paid order shows a reminder to refund in Razorpay and then mark the payment **Refunded** in the Payments box. The timeline note says "Cancelled by admin".
- **Marking a refund:** after refunding the money in Razorpay, open the order and in the **Payments (refund here)** box change a **Paid** payment's Status to **Refunded** (and optionally type the Razorpay refund id `rfnd_...`), then Save. The refund time is stamped, the shopper gets a "Refund processed" notification and email, and the app changes "Refund pending" to "Refunded". Only a Paid payment can become Refunded; everything else in the box is read-only. (An earlier version of this page had no way to do this; fixed 16 Nov 2026.)
- **Order page layout:** Items is a short table (picture, item with version and SKU, quantity, price each, total); Payments is one block per attempt; the timeline box is called Timeline.
- **Returns:** not built (decided: no return flow in the demo; listed under later work).

### Admin dashboard, bell and menu (changed 16 Nov 2026)
- **Orders sits directly under Dashboard** in the side menu, in its own **Quick access** group (removed from the Orders group so it appears once). The other Orders items (Cart items, Coupons, Delivery settings, Serviceable pincodes) stay in the Orders group.
- **Stats cards** on the Dashboard (each opens the list behind it): Orders today (paid ones, with yesterday), Revenue this month (with today), Orders to ship (Confirmed), Out for delivery (Shipped), Questions to answer, Low or out of stock (active versions with 5 or fewer), Customers (with new this week), Live products (with how many are switched off). Worked out only on the Dashboard page.
- **Bell "Mark all as read":** the red number counts only **new** things since this admin last pressed the button (a new unanswered question, an order newly paid, an order newly shipped). Pressing it clears the red number and the "new" tags; **nothing is hidden or resolved**, the waiting jobs stay listed (with grey counts) until they are done. Each staff member has their own marker (`alerts_seen_at` on the user).

### Help, text pages, profile and welcome slides (built 16 Nov 2026)
- **Decided:** **dark mode is left out of the demo** (about 590 colour uses across 55 screens; no dark row in Settings). It stays on the Later list; doing it properly means re-checking every screen. **Cart step 3** (coupons, bundle add-to-cart, buy-together strip) waits for a discussion of the money rules.
- **Help** (`GET help/`, open to guests; reached from Profile shortcut "Help", Settings, and the guest Profile): contact card (tap to call or email; shows only what is filled in under Content > Contact info) and the active **FAQs** as tap-to-open questions, in the admin's order. `python manage.py seed_demo_content` adds 9 sample FAQs (tracking, delivery, charges, payment, failed payment, cancel, refund, returns, invoice) and the three pages; safe to re-run, never overwrites edits.
- **Text pages** (`GET pages/<slug>/`, open to guests): Terms (`terms`), Privacy (`privacy`) and About (`about`), edited in the admin under Content > Static pages. A blank line starts a paragraph and a line beginning with `# ` is a heading. The sample wording is **placeholder text: replace it with the client's real terms and privacy policy**.
- **Settings:** a new "Help and information" section (Help, Terms and conditions, Privacy policy, About Vetri Mart). Password, log out of all devices and email preferences were already there.
- **Profile photo:** `POST me/photo/` (form field `photo`) and `DELETE me/photo/`. The picture is chosen from the gallery and cropped square in the app, checked on the server (a real picture, under 5 MB), turned upright, shrunk to at most 512 px and saved as a small JPEG in the server's media folder (replacing the old one). The profile's `photo_url` is now a full web address (empty when none); the old text-link field was removed. New app package: `expo-image-picker`.
- **Profile tab:** photo or initials, name, email and an edit button; four shortcuts (Orders, Wishlist, Addresses, Help); list (Edit profile, My reviews, Notifications, Settings, About Vetri Mart); Log out with confirmation; app version.
- **Welcome slides:** the three slides now have stand-in illustrations (a shopping bag, a price tag with a percent sign, a delivery truck) drawn in the brand colours, with alt text; replace them in the admin (Content > Onboarding slides) whenever real pictures are ready.

### Cart step 3: coupons and bundles (built 16 Nov 2026)
- **Decided (your picks):** a coupon code can be used **once per shopper** (orders they cancelled do not count; unpaid orders do not count); **one coupon per order** (a new code replaces the old one); **free delivery is judged before the coupon**; **bundle savings are automatic**.
- **Order of the maths:** Price (what the shopper pays per item) minus **bundle savings** = *items total*. The **delivery fee is judged on the items total, before the coupon**. Minus the **coupon** (taken off the items total). **Total = items total - coupon + delivery fee.** The coupon never takes the total below Rs 1 (a payment is always possible).
- **Bundles:** when every item of an active bundle is in the cart (at least the bundle's quantities), its saving applies once per complete set, however the items got there; a bundle with an unavailable item, switched off, or that no longer saves money is ignored; bundles sharing an item are applied best saving first, each unit used once; items saved for later do not count; prices are read fresh, so a price change changes the saving. The cart shows a **Bundle savings** line, and **suggestions** ("Complete the Pen starter combo and save ₹14", with the missing items and an Add button) for bundles the cart has started and that can be completed (at most 2). **Add bundle to cart** on the product page adds every item. Guests get bundle savings too.
- **Coupons:** `POST cart/coupon/` (`code`, any letter case, spaces ignored) puts a coupon on a logged-in shopper's cart; `DELETE cart/coupon/` removes it. Checks: code exists and is active, started, not expired, cart reaches the minimum order (the message says how much to add), the total usage limit is not reached (counted from paid orders), the shopper has not used it before. Percent coupons respect their cap. The cart checks the coupon again every time it is shown: if it stops applying (items removed under the minimum, expired) it shows why, takes no discount off, and applies again by itself when it can. Guests see "Log in to use a coupon". A coupon that stops being valid before payment is dropped, not charged.
- **Orders:** an order stores the coupon, its code and discount, the new **bundle discount**, the delivery fee and the total (the same numbers the cart showed). Order lines keep the list price per unit; the savings are separate lines. The checkout, order detail and invoice show **Bundle savings** and **Coupon CODE** lines. The coupon leaves the cart once the order is paid, and then counts as used.
- **Demo coupons** (`python manage.py seed_demo_coupons`, valid 60 days): `WELCOME10` (10% off, up to Rs 100, minimum Rs 299), `FLAT50` (Rs 50 off, minimum Rs 499), `FESTIVE20` (20% off, up to Rs 200, minimum Rs 999). Manage coupons in Orders > Coupons (the list shows how many times each has been used).

### Later list (things you said to do later; add to this whenever you say "later")
| Item | Notes |
|---|---|
| A real "Sponsored" label | The tag on cards now says **Featured**. Add an actual "Sponsored" (advertisement style) label later. The internal setting is still called `is_sponsored`, so this needs no rework. |
| Word document of every table and column | A plain-words list of all 36 tables and their columns, like the questions documents. You will ask for it. |
| Real email sending | Fill in Email settings (SMTP host, username, app password, sender) and use the "send a test email" box. Until then OTP codes print in the backend log. |
| Real banner pictures and missing colour pictures | Demo banners are generated stand-ins; replace them in the admin. Product pictures are uploaded for all 10 products; colours without their own picture (Airdopes Blue, Rockerz Blue, Pentonic Ball Pen Black/Blue, Jiffy Black, Sony WI-C100 Blue version) show the main picture. The WF-C500 and BassHeads Black pictures are loose matches; swap when better ones are found. |
| Everything in the "Later and future work" table | In the Word document `Vetri-Mart-Planning-Questions.docx` (cash on delivery, push notifications, language switch, returns, admin announcements, and more). |
| Hosting for the client demo | The backend must be online for the client demo; uploaded pictures are served from its media folder. |
| Dark mode | Left out of the demo on 16 Nov 2026. Needs a dark colour set, separate "surface" and "text on colour" colours, and a check of all 55 screens. |
| Delivery fee amounts | Placeholder ₹40, free from ₹499 (Delivery settings in the admin). |
| Contact details | Fill in Content > Contact info (support email, phone, hours) so Help and the invoice show them. |
| Real Terms, Privacy and About text, and real FAQs | The sample text from `seed_demo_content` must be replaced in the admin. |

Suggested by Claude, not decided yet: install Node 22 LTS (lets Expo reload by itself and stop needing restarts), add a Windows Defender exclusion for `frontend\node_modules` (faster Expo starts), and update the older secrets and media wording in `CLAUDE.md`.

### Admin form layout (decided 16 Nov 2026)
- Forms with extra sections show as **one page, sections stacked in order** (no tabs): for a product, the details, then Product variants, then Images, then Specifications. Variants, images and home banners are laid out as stacked blocks (fields one under another) so there is no sideways scrolling.
- **Product variants stays its own menu item**, next to Products, so every SKU, price and stock can be seen in one list (you also edit the same variants inside each product). Catalog menu order: Categories, Brands, Colours, Sizes, Products, Product variants, Collections, Bundles, Reviews, Product questions, Wishlist items.
- If "vertical" was meant as vertical tabs (tabs down the left side) or labels above the fields, say so: it is one setting (`changeform_format`) in `settings.py`.
- **Product form (decided 16 Nov 2026, follows the mockup):** numbered sections with Required and Optional tags: 1 Basic details (category, brand, name, slug, description), 2 Prices and stock (one stacked block per "version", at least one required), 3 Pictures, 4 Specifications, then a folded "Extras (optional)" box (video link, featured, active) at the bottom. No pencil, plus, cross or eye icon buttons beside dropdowns. Help text under the fields.
- **Brand and category rules:** each brand lists the **main categories** it sells in (a brand with none ticked sells everywhere); the Brand dropdown on the product form narrows to matching brands as soon as a category is chosen, and saving a wrong combination is refused with a clear message. A product must go in a category that has **no sub-categories** (Earbuds, Gel Pens), never in a main category such as Electronics. Saving a product with no version is refused.
- Test scripts: each now empties the shop tables inside its own rolled-back transaction, so tests never collide with real data.
- **Product form restyled to match the mockup (16 Nov 2026):** all four section titles share one bold style with a coloured tag (Required in red, Recommended in amber, Optional in green) and a one-line help text; a "Version 1, Version 2" card shows SKU, selling price and MRP on the first row and stock, colour and size on the second, with labels above the boxes; a "Picture 1" card has image, alt text and optional colour; specifications are just Name and Value; "+ Add another version / picture / specification" links; Extras folded at the bottom. There is no sort-order box for pictures or specifications: they keep the order they were added in, so the first picture is the main one. The look lives in `catalog/static/catalog/product_form.css` and `product_form.js`.
- Everything on the product page belongs to the one product being created or edited, and is saved together by one Save: versions, pictures and specifications are linked to it automatically, and a mistake in any block stops the whole save (nothing is half-saved).

### Decisions changed on 16 Nov 2026
- The promotion tag on product cards says **Featured**, not "Sponsored". The admin tick box is called "Featured". Behaviour is unchanged: featured products come first in Recommended deals and in lists, and the Deal of the day row keeps the admin's own order (the tag still shows there).

## 11. Open questions
- Home page sections and their order.
- Top navbar and side bar contents; profile dropdown contents.
- Which "later" features are in the demo: reviews and ratings, coupons, returns and refunds, order tracking, push notifications, product Q&A, multi-language.
- Delivery fee rule: RESOLVED, flat fee with a free-above threshold (see Checkout decisions). Fee and threshold amounts still to be chosen.
- Final brand colors and logo direction.
- Whether the demo needs real sample product data (images/videos) and who supplies it.

## 12. Next steps
1. Plan the **Home page** screen section by section.
2. Continue through the screen groups above.
3. Design the database schema from the agreed screens.
4. List the API endpoints.
5. Build in milestones, with test cases listed for each before moving on.


## Deployment (17 Nov 2026)
- Backend goes online on PythonAnywhere (paid plan, MySQL on the host, https, free tier unusable: no MySQL, outside sites blocked). Steps are in `backend/DEPLOY.md`.
- Code prepared: `STATIC_ROOT`, `DJANGO_CSRF_TRUSTED_ORIGINS`, `DJANGO_HTTPS` (https links, secure cookies), optional `DB_SSL_CA` (TiDB Cloud), production block in `.env.example`. Local work is unchanged.
- Pictures served by the host's `/media/` mapping; admin files by `/static/`. Cloud storage is still a later change.
- Data moves with `dumpdata`/`loaddata`; the server must use the same `SETTINGS_ENCRYPTION_KEY` as the laptop.
- TiDB Cloud stays an optional experiment (database only).
- Email: Gmail SMTP works (OTP emails confirmed); the app introduces itself to the mail server as `localhost` (Gmail rejected this PC's name).
- Next: APK through EAS Build after the backend has an https address.

### Deployment decisions, update (17 Nov 2026)
- Hosting changed from PythonAnywhere to **Render (free) + TiDB Cloud (free)**, because PythonAnywhere's free plan has no MySQL and blocks outside sites. Steps: `backend/DEPLOY.md`, build file: `render.yaml`.
- **Local work stays on MySQL (mysqlclient).** Only the online copy uses TiDB Cloud (MySQL compatible, PyMySQL driver, encrypted connection, port 4000).
- **Rule change (asked and agreed): online, pictures are kept in the database** (`MEDIA_IN_DATABASE=True`, `siteconfig.MediaFile`), because Render's free disk is wiped on restart and no cloud picture service is to be used. On the laptop pictures stay in `backend/media`.
- **Emails online go through Brevo's web API** (`BREVO_API_KEY`), because Render's free plan blocks SMTP. On the laptop, Gmail SMTP from Admin → Email settings is unchanged.
- Render's free service sleeps after 15 minutes idle; a free uptime monitor on `/api/v1/health/` keeps it awake.


### Checkout address vs Home pincode (17 Nov 2026)
- The pincode chosen on Home and the saved checkout address are different things: changing Home never edits a saved address.
- Checkout now (a) picks a saved address in the Home pincode automatically, unless the shopper chose an address by hand, and (b) when the selected address is in another pincode, shows a note with "Add address for <Home pincode>" (opens the address form with that pincode filled in) and "Use <address pincode> instead" (sets the Home pincode to the address's).
- All 2,040 Tamil Nadu pincodes are in Serviceable pincodes (`manage.py import_pincodes`; Chennai 600xxx 2 to 3 days, others 3 to 5). For the live database use `backend/run-on-tidb.ps1 import_pincodes`.
- Web version of the app (browser demo): CORS added for /api/ only; `app.json` web output set to "single". Not finished or tested yet.


### Coupon offers, cart reminder, login fix, order emails (18 Nov 2026)
- **Available offers:** a coupon has "Show in app" and a short "Description" (Admin > Orders > Coupons). The cart's coupon box lists them (`GET /api/v1/coupons/available/`): usable ones show the saving and an Apply button, others show why not (for example "Add Rs 200 more"), used or fully claimed ones are hidden, guests see them with "Log in". The **minimum order amount** is the existing "Min order amount" field of each coupon (items total after bundle savings, before delivery).
- **Cart is waiting:** Home shows one friendly line when a logged-in shopper's cart item is more than 24 hours old (cart items now carry `added_at`); after View cart or close it stays quiet for 3 days. In-app only: no push, no email yet.
- **Login flash:** `finishAuth` closes the login screens in one move (`dismissTo`), and double taps on Send OTP and Log in are ignored. Cause of the flash was not reproduced here: to be confirmed on the phone.
- **Order emails:** order confirmed, shipped, delivered, cancelled and refund emails are branded HTML with a text copy; online they are sent in a background thread.
- **Pincodes:** Tamil Nadu only for now (2,040). All-India later.

## Later list, additions (18 Nov 2026)
- All-India pincodes (the data file is ready; load with `import_pincodes --file`, delivery days by distance).
- WhatsApp messages for order placed and cancelled (skipped for the demo: needs a Meta business account, approved templates and customer consent).
- Real push notification and an email reminder for the waiting cart (needs push set-up and a daily timer).
- Razorpay: UPI ID entry is not offered on Android in test mode; with live keys UPI works normally. Net banking test failed once ("Please use another method"): check Netbanking is enabled in the Razorpay dashboard.
