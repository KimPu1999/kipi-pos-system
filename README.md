# Kipi POS

A local point-of-sale project with a React + TypeScript frontend and Laravel 12 PHP API. SQLite is the default database; MySQL configuration is included.

## Features

- Registration, login and logout with server-side cookie sessions and CSRF protection.
- Search catalog by name or SKU; filter by category.
- Add products to the current order, edit quantities directly or with +/−, delete items, and clear the order.
- Stock limits, cash/card payment recording, cash received and calculated change. Blank cash received means exact payment. Click Payment to review the total, then Complete payment to save the sale. Cancel returns to the unchanged order without saving a sale or changing stock. Cancel order discards the unpaid cart. Card payments require confirmation that the external terminal approved payment. After payment, Done closes the receipt; the cart is already empty for the next sale. Completed receipts are retained in Sales history.
- Transactional checkout with server-calculated integer-cent totals and atomic stock updates.
- Product creation and inventory overview.
- Persistent sales history and printable receipts.
- Seeded café catalog; responsive register layout.

This is a local development MVP. POS API routes require authentication. Keep the API bound to localhost during development. Before production, add staff roles, restrict public registration, configure HTTPS and SESSION_SECURE_COOKIE=true, and add tax rules, returns, auditing, backups and deployment configuration. This is one store. Admins manage store products and sales; customers see only their own orders. Card checkout records a payment made on an external terminal; it does not charge a card. Currency defaults to MMK and tax is zero.

## Requirements

PHP 8.4+ (for the locked dependencies), Composer, PDO SQLite, Node.js 20.17+ and npm. Internet access is needed to install dependencies.

## Run the API

```sh
cd backend
composer install
cp .env.example .env
php artisan key:generate
# Create database/database.sqlite if it does not exist.
php artisan migrate --seed
php artisan serve --host=127.0.0.1 --port=8000
```

## Run the frontend (second terminal)

```sh
cd frontend
npm install
npm run dev
```

Open http://127.0.0.1:5173. Use **Register** to create an account, then access the customer store. Admin accounts open the admin workspace. Existing accounts use **Log in**. The sidebar **Log out** button ends the session. No default account is seeded. Vite proxies `/api` to the Laravel server; start both processes. The frontend displays a connection error if the API is unavailable and does not substitute fake sales.

## Checks

```sh
cd frontend
npm run build
cd ../backend
vendor/bin/phpunit
```

Checkout tests cover server pricing, stock deduction, rollback on insufficient stock, duplicate lines, invalid payment methods and unique SKUs.

## Authentication

Run `php artisan migrate` after pulling these changes to create the users table. Session cookies persist through page refreshes and expire after 120 minutes of inactivity. Logout clears the server session. React restores the current user at startup and returns to login when the API reports an expired session.

The frontend obtains a CSRF token from `GET /api/auth/csrf` before each mutation. API consumers must preserve cookies and send that token in `X-CSRF-TOKEN`. Do not mix `localhost` and `127.0.0.1` when opening the frontend.

| Method | Endpoint             | Purpose                                                                           |
| ------ | -------------------- | --------------------------------------------------------------------------------- |
| GET    | `/api/auth/csrf`     | Start session and obtain CSRF token                                               |
| POST   | `/api/auth/register` | Create account and sign in (`name`, `email`, `password`, `password_confirmation`) |
| POST   | `/api/auth/login`    | Sign in (`email`, `password`)                                                     |
| GET    | `/api/auth/user`     | Current signed-in user                                                            |
| POST   | `/api/auth/logout`   | Invalidate current session                                                        |

Login and registration are limited to 10 requests per minute per client IP. Passwords require at least 8 characters on registration. Authentication follows [Laravel’s session authentication guidance](https://laravel.com/docs/12.x/authentication).

## API

| Method | Endpoint        | Purpose                       |
| ------ | --------------- | ----------------------------- |
| GET    | `/api/products` | List products                 |
| POST   | `/api/products` | Create a product              |
| GET    | `/api/sales`    | List receipts with line items |
| POST   | `/api/sales`    | Complete a sale               |

Example checkout body:

```json
{
  "payment_method": "cash",
  "amount_received_cents": 1000,
  "items": [{ "product_id": 1, "quantity": 2 }]
}
```

Product body:

```json
{
  "name": "Flat white",
  "sku": "COF-010",
  "category": "Coffee",
  "price_cents": 450,
  "stock": 30,
  "emoji": "☕"
}
```

Validation failures return HTTP 422. Prices and receipt lines are copied from the database at checkout so later product changes do not rewrite historical receipts.

## MySQL

Set `DB_CONNECTION=mysql`, `DB_HOST`, `DB_PORT`, `DB_DATABASE`, `DB_USERNAME`, and `DB_PASSWORD` in `backend/.env`, create the database, then run migrations and seed. SQLite and MySQL support the same migrations. Runtime configuration uses UTC; the browser displays receipt dates in its local timezone.
hello
## Layout

- `frontend/src/`: typed React screens, API client and styles.
- `backend/app/Http/Controllers/PosController.php`: API validation and checkout transaction.
- `backend/database/migrations/`: products, sales and immutable receipt line schema.
- `backend/database/seeders/`: starter catalog.
- `backend/tests/Feature/`: API correctness tests.

Framework setup references: [React TypeScript](https://react.dev/learn/typescript), [Vite](https://vite.dev/guide/), [Laravel routing](https://laravel.com/docs/12.x/routing).

## Admin and customer portals

After updating, run `php artisan migrate` in `backend`. Existing operator accounts become admins during this migration; new public registrations always become customers. Clients cannot choose an admin role during registration.

To grant admin access to a registered account from your trusted terminal:

```sh
cd backend
php artisan pos:make-admin your-email@example.com
```

Sign out and back in after promotion. There is no default admin password.

**Admin workspace:** revenue and sales metrics, open customer orders, low-stock alerts, product creation/editing/archiving, customer directory, and the existing POS register with receipts and sales history. Archived products retain historical receipts and can be reactivated through Edit.

**Customer store:** searchable catalog, category filters, pickup cart with quantity editing, order notes, personal order history/status, pending-order cancellation, and account details. Checkout places an unpaid pickup order; it does not charge a card or record revenue.

Order workflow: pending → confirmed → ready → completed. Stock is reserved when an order is placed. Cancelling restores reserved quantities exactly once. Customers can cancel their own pending orders; admins can cancel pending, confirmed or ready orders. Admins complete ready orders only after confirming receipt of the exact total in cash. Completion creates a paid sale and receipt lines, counts toward revenue, and does not deduct reserved stock again. Completed/cancelled orders cannot be changed.

Stock shown in product management is the quantity available for new orders, excluding reserved units. Orders refresh when opened, every 10 seconds while visible, and when the window regains focus. Refresh also retrieves current status and stock. Order status filters are independent of shop categories. Admin pickup payments support cash received and change; insufficient payment leaves the order ready and creates no sale. Browser visual verification has not been performed in this environment.

Additional endpoints: `GET /api/catalog`, `GET/POST /api/orders`, `PATCH /api/orders/{id}`. Admin-only endpoints: `GET /api/admin/dashboard`, `PUT/DELETE /api/products/{id}`, and the POS products/sales APIs. DELETE archives a product rather than removing historical data.

## Product image uploads

In Admin → Products → Add product or Edit, choose a JPG, PNG or WebP file up to 2 MB and save. The POS inventory form also supports uploads. Images replace the emoji on customer and POS catalog cards; products without images keep their emoji. Editing without selecting a new file preserves the current image. Replacing an image removes the old file after the database update succeeds.

Files are stored under `backend/storage/app/private/products` and served to signed-in users through `/api/products/{id}/image`; no storage symlink is needed. Include this directory in production backups. PHP's `upload_max_filesize` must allow 2 MB, and `post_max_size` must exceed the upload plus form data.

Product status controls: Admin → Products provides Activate/Deactivate actions. Edit opens the selected product form; Save product persists its fields and Active checkbox. Inactive products remain editable in admin but are hidden from the customer catalog and POS. Deactivation preserves historical orders and receipts.

Customers can edit items, quantities and notes in My orders while an order is pending. Saving recalculates current catalog prices and adjusts reservations in one transaction. Failed edits leave the old order and stock intact. Confirm my order records customer approval without changing store preparation status; editing clears that approval. The admin still accepts the order and controls readiness/payment. Once the store confirms an order, customer editing and cancellation are disabled.

The customer landing page is Dashboard: personal order counts, active pickup progress, ready-order notices, available product recommendations and account shortcuts. Dashboard and My orders refresh every 10 seconds while visible. All summaries use the signed-in customer’s own orders. The theme uses #d96700 orange with cream surfaces and responsive card layouts.

Customer checkout collects name, email, phone, location/address and ZIP/postal code. Name/email default to the signed-in account. Contact information is saved as an order snapshot and shown to its owner and store admins; pending-order editing also allows updating it. ZIP codes accept text so leading zeros and international formats are preserved. These remain pickup orders; supplying an address does not enable delivery.

Customers choose Dine in or Takeaway at checkout. The selection is saved on the order, displayed to customer/admin, and editable while pending. Existing orders default to Takeaway. Both options use cash payment in store; delivery is not enabled.

The customer details form appears only for Takeaway, at checkout and during pending-order editing. Dine in uses the signed-in account without requiring phone/address/ZIP. Switching an existing order to Dine in clears its takeaway contact fields.

## Promotions and discounts

Admins create percentage codes (1–100%) in Promotions, optionally set a UTC expiry date, and activate/deactivate codes. Customers enter a code at checkout; one code applies per order. The API validates eligibility and calculates rounded integer-cent discounts from database prices, ignoring client totals. Discounts cannot exceed the subtotal. Orders, paid sales and receipts retain the discount snapshot even after a promotion is disabled. Pending-order edits revalidate and recalculate the code; clear an expired/disabled code in Edit order to continue. Promotions currently apply to customer orders, not new POS-register sales.

## Sales and inventory reports

Admin → Reports offers Daily, Monthly and Yearly sales views with a date selector, net paid revenue, discounts, transaction count, quantities sold, an amount chart and item totals before discounts. Reporting boundaries use Asia/Yangon (UTC+6:30); only paid POS sales and completed paid customer orders count. Inventory is a current snapshot showing available/reserved quantities and selling-price value, not historical inventory or profit. Reserved quantities come from pending, confirmed and ready customer orders. The admin-only endpoint is `GET /api/admin/reports?period=day|month|year&date=YYYY-MM-DD`.

POS → Inventory lists active and inactive products and provides Edit stock. Enter the new available quantity and Save stock. Reserved customer-order quantities remain unchanged. A stale stock edit is rejected with HTTP 409; close the dialog, Refresh, and reopen it. The admin endpoint is `PATCH /api/products/{id}/stock` with `stock` and `expected_stock`.

Promotion images: upload JPG, PNG or WebP up to 2 MB when creating a promotion, or use Upload/Change image in the promotions table. Active, unexpired offers appear as banners on the customer Dashboard and Shop; Use this offer selects its code at checkout. Images are stored privately under storage/app/private/promotions and served through authenticated routes. No image uses a discount graphic fallback. Include promotion images in backups.

Promotion actions: Edit updates the name, code, percentage, expiry and optional image; Confirm activates an inactive offer; Deactivate pauses it; Delete hides it permanently using soft deletion. Codes stay reserved after deletion and historical order/sale discounts are preserved. Expired offers must have their expiry corrected before confirmation. Changing a code or deleting it can require customers to clear that code when editing a pending order.

Promotions can target products: select Eligible products in Create/Edit promotion. Leaving all unchecked applies the offer store-wide. Discount calculations include only selected product line totals; orders without an eligible item cannot use the code. Customer banners list qualifying products and product cards show linked codes. Existing promotions remain store-wide.

## Takeaway delivery tracking

Admin → Orders → Ready → Assign delivery collects driver name/phone, delivery destination and estimated arrival time. Save Assigned, then update to Out for delivery and Delivered. Customers see delivery details, recipient/contact information and timestamps in My orders; updates refresh every 10 seconds. Admins record cash/payment completion after delivery is marked Delivered. Pickup orders without a delivery assignment retain the normal pickup payment flow.

Tracking is manual and does not connect to an external courier or GPS service, send messages, or add a delivery fee. Estimated arrival is an admin estimate; the form uses the browser timezone and the API stores UTC. Assigned deliveries must initially have a future ETA. Delivery is available only for ready takeaway orders. The admin endpoint is `PATCH /api/orders/{id}/delivery`.

### Purchases and stock receiving

Admins can open **Purchases**, enter the supplier, invoice reference and received date, then add products, received quantities and unit costs. **Receive purchase & add stock** records the purchase and increases available inventory in one database transaction. Purchase history shows item costs and totals; purchase costs do not change product selling prices. Only record goods actually received. Received purchases are permanent records; this section does not process supplier payments or purchase returns.

### Employees and working hours

Admins can open **Employees** to add or edit employee IDs, names, active status and monthly salary (MMK). Record work date, start/end time and unpaid break minutes to calculate working hours. Select **Ends the next day** for overnight shifts. Times use Myanmar time; overlapping shifts and invalid breaks are rejected. The month selector shows shifts and total hours by starting month. Delete an incorrect shift and enter the corrected one. Salary is the current monthly amount; this feature does not calculate deductions or process payroll payments. Employee records do not create login accounts.

Employee attendance: admins use **Check in** beside an active employee to save the server time. **Check out** accepts unpaid break minutes and creates a completed shift, updating monthly working hours. Open attendance persists after refresh and duplicate check-ins/check-outs are rejected. Completed attendance must last at least one minute. These buttons are admin-managed; employees do not receive login accounts.

### Order email notifications

The existing bell shows in-app order updates. For email, configure the mail variables listed in `backend/.env.example` in your private `backend/.env`: set `MAIL_MAILER=smtp`, SMTP host/port/username/password, a verified `MAIL_FROM_ADDRESS`, `FRONTEND_URL`, and `ORDER_EMAIL_ENABLED=true`. `MAIL_SCHEME=smtp` supports STARTTLS on port 587; use `smtps` for implicit TLS on port 465. `ORDER_ADMIN_EMAIL` optionally receives store copies. Customer mail goes to the account email, not the editable checkout contact email. Run `php artisan config:clear` after configuration.

Orders and delivery updates write pending email records in the same transaction. Start `php artisan schedule:work` from `backend` during development; production should run Laravel's scheduler every minute. You can send pending mail manually with `php artisan pos:send-order-emails`. Run only one sender/scheduler instance. Failed messages retry up to five times; inspect Laravel logs for failures. SMTP is disabled by default, so no external email is sent until configured. Email delivery is not guaranteed and a rare crash after sending can cause a duplicate on retry.

### Customer points and buying records

Customers open **Points & purchases** to see paid receipts, purchased items, total spending and loyalty points. Admins select a customer in **Customers** to review the same records. Each completed customer order earns 1 point per whole MMK of its paid total after discounts, rounded down per receipt. Points are recorded once per sale, including existing completed customer orders. Pending/cancelled orders and anonymous POS sales earn no points. Points redemption and refunds are not implemented.

Currency: all current amounts use MMK (Myanmar kyat). Internal API/database fields retain their `_cents` names and store 100 minor units per kyat. Existing numeric amounts are preserved, with no foreign-exchange conversion. Amounts can include two decimal places for discounts. Loyalty awards remain 1 point per whole MMK paid per customer order.

### Excel archives

Admin **Reports → Excel archive → Download Excel** exports a multi-sheet `.xlsx` workbook. Choose the last 30 calendar days (including today), a selected month, records older than that window, or all dates. Date boundaries use Asia/Yangon; amounts are MMK. Sheets include orders, order items, bills/receipts, receipt items, purchases, purchase items, and a current inventory snapshot. The download keeps database records; no automatic deletion runs. Previously deleted records are only in the private database backups and are not included in current exports.

### Automatic Google Sheets sync

1. In Google Cloud, enable the Google Sheets API and create a service account with a JSON key.
2. Create a Google spreadsheet and share it with the JSON key's `client_email` as Editor.
3. Save the key privately at `backend/storage/app/private/google/service-account.json`. Do not put it in the frontend or commit it.
4. In `backend/.env`, set `GOOGLE_SHEETS_ENABLED=true` and `GOOGLE_SHEETS_SPREADSHEET_ID` to the ID between `/d/` and `/edit` in the sheet URL. Leave `GOOGLE_SHEETS_CREDENTIALS_PATH` empty for the default private path, or provide an absolute path.
5. Run `php backend/artisan config:clear`, then `php backend/artisan pos:sync-google-sheets`.
6. Keep `php backend/artisan schedule:work` running locally (use Laravel's scheduler cron in production). Sync runs every five minutes.

The sync owns tabs named Kipi Orders, Kipi Receipts, Kipi Order Items, Kipi Receipt Items, and Kipi Inventory. Use a dedicated spreadsheet and avoid editing these tabs. Existing record IDs are updated, previously archived rows are kept, and database records are never deleted. Values use MMK and Myanmar timestamps. This is one-way syncing, not editing POS data from Google Sheets. Records deleted before their first sync cannot be archived automatically. No Google connection is active until credentials and a sheet ID are configured.
