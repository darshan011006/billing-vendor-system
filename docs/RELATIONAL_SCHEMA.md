# Relational Schema

Generated from the live PostgreSQL catalog (`information_schema`, `pg_constraint`), so it matches `db/postgres/01_ddl.sql` exactly. 16 relations, all in third normal form.

**Notation:** <u>underlined</u> = primary key · *italic* = foreign key → referenced table · UK = unique

## Relations at a glance

- **BRANCHES** (<u>branch_id</u>, code, name, gstin, phone, address)
- **USERS** (<u>user_id</u>, *branch_id*, username, full_name, whatsapp_no, password_hash, role, is_active, created_at)
- **CUSTOMERS** (<u>customer_id</u>, *user_id*, name, whatsapp_no, email, gstin, customer_type, credit_limit)
- **CATEGORIES** (<u>category_id</u>, name, *parent_id*)
- **PRODUCTS** (<u>product_id</u>, *category_id*, sku, barcode, name, hsn_code, gst_rate, unit, cost_price, selling_price, mrp, low_stock_threshold)
- **STOCK** (*<u>product_id</u>*, *<u>branch_id</u>*, quantity, updated_at)
- **LOW_STOCK_ALERTS** (<u>alert_id</u>, *product_id*, *branch_id*, quantity, threshold, status, created_at)
- **ORDERS** (<u>order_id</u>, *branch_id*, *customer_id*, *created_by*, order_date, status)
- **ORDER_ITEMS** (*<u>order_id</u>*, <u>line_no</u>, *product_id*, quantity, unit_price, discount, gst_rate, line_total)
- **INVOICE_SEQUENCES** (*<u>branch_id</u>*, <u>fiscal_year</u>, last_seq)
- **INVOICES** (<u>invoice_id</u>, *order_id*, invoice_no, invoice_date, taxable_value, cgst, sgst, total_amount, amount_paid, status)
- **CUSTOMER_PAYMENTS** (<u>payment_id</u>, *invoice_id*, amount, mode, reference_no, paid_at, *received_by*)
- **VENDORS** (<u>vendor_id</u>, name, gstin, contact_person, whatsapp_no, email, opening_balance)
- **PURCHASES** (<u>purchase_id</u>, *vendor_id*, *branch_id*, vendor_invoice_no, purchase_date, total_amount, paid_amount, status)
- **PURCHASE_ITEMS** (*<u>purchase_id</u>*, <u>line_no</u>, *product_id*, quantity, unit_cost, gst_rate)
- **VENDOR_PAYMENTS** (<u>vendor_payment_id</u>, *vendor_id*, *purchase_id*, amount, mode, reference_no, payment_date, *paid_by*)

## Relations in detail

### branches

| Column | Type | Null | Key | Default / note |
| --- | --- | --- | --- | --- |
| branch_id | INTEGER | no | PK | serial (branches_branch_id_seq) |
| code | VARCHAR(10) | no | UK |  |
| name | VARCHAR(100) | no |  |  |
| gstin | CHAR(15) | yes |  |  |
| phone | VARCHAR(15) | yes |  |  |
| address | TEXT | yes |  |  |

### users

| Column | Type | Null | Key | Default / note |
| --- | --- | --- | --- | --- |
| user_id | INTEGER | no | PK | serial (users_user_id_seq) |
| branch_id | INTEGER | yes | FK → branches.branch_id |  |
| username | VARCHAR(50) | no | UK |  |
| full_name | VARCHAR(100) | no |  |  |
| whatsapp_no | VARCHAR(15) | no |  |  |
| password_hash | TEXT | no |  |  |
| role | VARCHAR(10) | no |  |  |
| is_active | BOOLEAN | no |  | true |
| created_at | TIMESTAMPTZ | no |  | now() |

Table constraints: `CHECK (((role)::text = ANY ((ARRAY['admin'::character varying, 'staff'::character varying, 'customer'::character varying])::text[])))`

### customers

| Column | Type | Null | Key | Default / note |
| --- | --- | --- | --- | --- |
| customer_id | INTEGER | no | PK | serial (customers_customer_id_seq) |
| user_id | INTEGER | yes | FK → users.user_id, UK |  |
| name | VARCHAR(100) | no |  |  |
| whatsapp_no | VARCHAR(15) | no | UK |  |
| email | VARCHAR(100) | yes |  |  |
| gstin | CHAR(15) | yes |  |  |
| customer_type | VARCHAR(10) | no |  | 'retail' |
| credit_limit | NUMERIC(12,2) | no |  | 0 |

Table constraints: `CHECK ((credit_limit >= (0)::numeric))` · `CHECK (((customer_type)::text = ANY ((ARRAY['retail'::character varying, 'wholesale'::character varying])::text[])))`

### categories

| Column | Type | Null | Key | Default / note |
| --- | --- | --- | --- | --- |
| category_id | INTEGER | no | PK | serial (categories_category_id_seq) |
| name | VARCHAR(60) | no | UK |  |
| parent_id | INTEGER | yes | FK → categories.category_id (on delete set null) |  |

Table constraints: `CHECK (((parent_id IS NULL) OR (parent_id <> category_id)))`

### products

| Column | Type | Null | Key | Default / note |
| --- | --- | --- | --- | --- |
| product_id | INTEGER | no | PK | serial (products_product_id_seq) |
| category_id | INTEGER | yes | FK → categories.category_id |  |
| sku | VARCHAR(30) | no | UK |  |
| barcode | VARCHAR(30) | yes | UK |  |
| name | VARCHAR(150) | no |  |  |
| hsn_code | VARCHAR(8) | yes |  |  |
| gst_rate | NUMERIC(4,2) | no |  | 0 |
| unit | VARCHAR(10) | no |  | 'pcs' |
| cost_price | NUMERIC(10,2) | no |  |  |
| selling_price | NUMERIC(10,2) | no |  |  |
| mrp | NUMERIC(10,2) | no |  |  |
| low_stock_threshold | INTEGER | no |  | 5 |

Table constraints: `CHECK ((selling_price <= mrp))` · `CHECK ((cost_price >= (0)::numeric))` · `CHECK ((gst_rate = ANY (ARRAY[(0)::numeric, (5)::numeric, (12)::numeric, (18)::numeric, (28)::numeric])))` · `CHECK ((selling_price >= (0)::numeric))`

### stock

| Column | Type | Null | Key | Default / note |
| --- | --- | --- | --- | --- |
| product_id | INTEGER | no | PK, FK → products.product_id |  |
| branch_id | INTEGER | no | PK, FK → branches.branch_id |  |
| quantity | NUMERIC(10,2) | no |  | 0 |
| updated_at | TIMESTAMPTZ | no |  | now() |

Table constraints: `CHECK ((quantity >= (0)::numeric))`

### low_stock_alerts

| Column | Type | Null | Key | Default / note |
| --- | --- | --- | --- | --- |
| alert_id | INTEGER | no | PK | serial (low_stock_alerts_alert_id_seq) |
| product_id | INTEGER | no | FK → products.product_id |  |
| branch_id | INTEGER | no | FK → branches.branch_id |  |
| quantity | NUMERIC(10,2) | no |  |  |
| threshold | INTEGER | no |  |  |
| status | VARCHAR(10) | no |  | 'open' |
| created_at | TIMESTAMPTZ | no |  | now() |

Table constraints: `CHECK (((status)::text = ANY ((ARRAY['open'::character varying, 'resolved'::character varying])::text[])))`

### orders

| Column | Type | Null | Key | Default / note |
| --- | --- | --- | --- | --- |
| order_id | INTEGER | no | PK | serial (orders_order_id_seq) |
| branch_id | INTEGER | no | FK → branches.branch_id |  |
| customer_id | INTEGER | no | FK → customers.customer_id |  |
| created_by | INTEGER | no | FK → users.user_id |  |
| order_date | TIMESTAMPTZ | no |  | now() |
| status | VARCHAR(12) | no |  | 'pending' |

Table constraints: `CHECK (((status)::text = ANY ((ARRAY['pending'::character varying, 'confirmed'::character varying, 'packed'::character varying, 'delivered'::character varying, 'cancelled'::character varying])::text[])))`

### order_items

| Column | Type | Null | Key | Default / note |
| --- | --- | --- | --- | --- |
| order_id | INTEGER | no | PK, FK → orders.order_id (on delete cascade) |  |
| line_no | SMALLINT | no | PK |  |
| product_id | INTEGER | no | FK → products.product_id |  |
| quantity | NUMERIC(10,2) | no |  |  |
| unit_price | NUMERIC(10,2) | no |  |  |
| discount | NUMERIC(10,2) | no |  | 0 |
| gst_rate | NUMERIC(4,2) | no |  |  |
| line_total | NUMERIC(12,2) | yes |  | generated: quantity × unit_price − discount |

Table constraints: `CHECK ((quantity > (0)::numeric))`

### invoice_sequences

| Column | Type | Null | Key | Default / note |
| --- | --- | --- | --- | --- |
| branch_id | INTEGER | no | PK, FK → branches.branch_id |  |
| fiscal_year | CHAR(7) | no | PK |  |
| last_seq | INTEGER | no |  | 0 |

### invoices

| Column | Type | Null | Key | Default / note |
| --- | --- | --- | --- | --- |
| invoice_id | INTEGER | no | PK | serial (invoices_invoice_id_seq) |
| order_id | INTEGER | no | FK → orders.order_id, UK |  |
| invoice_no | VARCHAR(25) | no | UK |  |
| invoice_date | DATE | no |  | CURRENT_DATE |
| taxable_value | NUMERIC(12,2) | no |  |  |
| cgst | NUMERIC(12,2) | no |  | 0 |
| sgst | NUMERIC(12,2) | no |  | 0 |
| total_amount | NUMERIC(12,2) | no |  |  |
| amount_paid | NUMERIC(12,2) | no |  | 0 |
| status | VARCHAR(10) | no |  | 'unpaid' |

Table constraints: `CHECK (((status)::text = ANY ((ARRAY['unpaid'::character varying, 'partial'::character varying, 'paid'::character varying, 'cancelled'::character varying])::text[])))`

### customer_payments

| Column | Type | Null | Key | Default / note |
| --- | --- | --- | --- | --- |
| payment_id | INTEGER | no | PK | serial (customer_payments_payment_id_seq) |
| invoice_id | INTEGER | no | FK → invoices.invoice_id |  |
| amount | NUMERIC(12,2) | no |  |  |
| mode | VARCHAR(6) | no |  |  |
| reference_no | VARCHAR(40) | yes |  |  |
| paid_at | TIMESTAMPTZ | no |  | now() |
| received_by | INTEGER | yes | FK → users.user_id |  |

Table constraints: `CHECK ((amount > (0)::numeric))` · `CHECK (((mode)::text = ANY ((ARRAY['cash'::character varying, 'upi'::character varying, 'card'::character varying, 'bank'::character varying])::text[])))`

### vendors

| Column | Type | Null | Key | Default / note |
| --- | --- | --- | --- | --- |
| vendor_id | INTEGER | no | PK | serial (vendors_vendor_id_seq) |
| name | VARCHAR(120) | no |  |  |
| gstin | CHAR(15) | yes | UK |  |
| contact_person | VARCHAR(100) | yes |  |  |
| whatsapp_no | VARCHAR(15) | no |  |  |
| email | VARCHAR(100) | yes |  |  |
| opening_balance | NUMERIC(12,2) | no |  | 0 |

### purchases

| Column | Type | Null | Key | Default / note |
| --- | --- | --- | --- | --- |
| purchase_id | INTEGER | no | PK | serial (purchases_purchase_id_seq) |
| vendor_id | INTEGER | no | FK → vendors.vendor_id |  |
| branch_id | INTEGER | no | FK → branches.branch_id |  |
| vendor_invoice_no | VARCHAR(40) | no |  |  |
| purchase_date | DATE | no |  | CURRENT_DATE |
| total_amount | NUMERIC(12,2) | no |  | 0 |
| paid_amount | NUMERIC(12,2) | no |  | 0 |
| status | VARCHAR(8) | no |  | 'unpaid' |

Table constraints: `UNIQUE (vendor_id, vendor_invoice_no)` · `CHECK (((status)::text = ANY ((ARRAY['unpaid'::character varying, 'partial'::character varying, 'paid'::character varying])::text[])))`

### purchase_items

| Column | Type | Null | Key | Default / note |
| --- | --- | --- | --- | --- |
| purchase_id | INTEGER | no | PK, FK → purchases.purchase_id (on delete cascade) |  |
| line_no | SMALLINT | no | PK |  |
| product_id | INTEGER | no | FK → products.product_id |  |
| quantity | NUMERIC(10,2) | no |  |  |
| unit_cost | NUMERIC(10,2) | no |  |  |
| gst_rate | NUMERIC(4,2) | no |  |  |

Table constraints: `CHECK ((quantity > (0)::numeric))`

### vendor_payments

| Column | Type | Null | Key | Default / note |
| --- | --- | --- | --- | --- |
| vendor_payment_id | INTEGER | no | PK | serial (vendor_payments_vendor_payment_id_seq) |
| vendor_id | INTEGER | no | FK → vendors.vendor_id |  |
| purchase_id | INTEGER | yes | FK → purchases.purchase_id |  |
| amount | NUMERIC(12,2) | no |  |  |
| mode | VARCHAR(6) | no |  |  |
| reference_no | VARCHAR(40) | yes |  |  |
| payment_date | DATE | no |  | CURRENT_DATE |
| paid_by | INTEGER | no | FK → users.user_id |  |

Table constraints: `CHECK ((amount > (0)::numeric))` · `CHECK (((mode)::text = ANY ((ARRAY['cash'::character varying, 'upi'::character varying, 'cheque'::character varying, 'neft'::character varying])::text[])))`
## Relationships

| Relationship | Cardinality | Implemented by |
| --- | --- | --- |
| Branch employs Users | 1 : N (a customer login has no branch) | `users.branch_id` → branches |
| User logs in as Customer | 1 : 0..1 | `customers.user_id` UNIQUE, nullable |
| Category is parent of Category | 1 : N, **recursive** (self-reference) | `categories.parent_id` → categories, `CHECK (parent_id <> category_id)` |
| Category groups Products | 1 : N | `products.category_id` |
| Product is stocked at Branch | M : N, with attribute *quantity* | `stock` (composite PK product_id + branch_id) |
| Customer places Orders | 1 : N | `orders.customer_id` |
| User (staff) creates Orders | 1 : N | `orders.created_by` |
| Order contains Order items | 1 : N, **weak entity** (deleted with the order) | `order_items` PK (order_id, line_no), `ON DELETE CASCADE` |
| Order is billed as Invoice | 1 : 0..1 | `invoices.order_id` UNIQUE |
| Invoice is settled by Customer payments | 1 : N | `customer_payments.invoice_id` |
| Branch numbers Invoices per fiscal year | 1 : N | `invoice_sequences` PK (branch_id, fiscal_year) |
| Vendor supplies Purchases | 1 : N | `purchases.vendor_id`, UNIQUE (vendor_id, vendor_invoice_no) |
| Purchase contains Purchase items | 1 : N, **weak entity** | `purchase_items` PK (purchase_id, line_no), `ON DELETE CASCADE` |
| Vendor is paid via Vendor payments | 1 : N | `vendor_payments.vendor_id` |
| Purchase is settled by Vendor payments | 1 : N (optional: a payment can be "on account") | `vendor_payments.purchase_id` nullable |
| Product / Branch raise Low-stock alerts | 1 : N | `low_stock_alerts` (written only by trigger `trg_low_stock`) |

## Kinds of constraints used

| Constraint | Examples |
| --- | --- |
| PRIMARY KEY | single (`orders.order_id`), composite (`stock`, `order_items`, `purchase_items`, `invoice_sequences`) |
| FOREIGN KEY | 24 foreign keys, incl. a self-reference and `ON DELETE CASCADE` / `SET NULL` |
| UNIQUE | `users.username`, `customers.whatsapp_no`, `invoices.invoice_no`, `invoices.order_id`, `(vendor_id, vendor_invoice_no)` |
| NOT NULL | every amount, status and name column |
| CHECK (domain) | `role IN ('admin','staff','customer')`, `gst_rate IN (0,5,12,18,28)`, `status` enums, `mode` enums |
| CHECK (value) | `quantity > 0`, `amount > 0`, `stock.quantity >= 0` (no negative stock), `credit_limit >= 0` |
| CHECK (row) | `selling_price <= mrp`, `parent_id <> category_id` |
| DEFAULT | `now()`, `CURRENT_DATE`, `'pending'`, `'unpaid'`, `0` |
| GENERATED column | `order_items.line_total = quantity × unit_price − discount` |
| Partial index | `idx_invoices_status ON invoices(status) WHERE status <> 'paid'` |

## Normalisation (why 3NF)

* **1NF** — every column is atomic; an order's lines are rows in `order_items`, not a list in `orders`.
* **2NF** — tables with composite keys (`stock`, `order_items`, `purchase_items`, `invoice_sequences`) hold only facts about the whole key: a line's `quantity` depends on (order_id, line_no), never on product_id alone.
* **3NF** — no transitive dependencies: a customer's name lives only in `customers`, a product's price only in `products`; an order line keeps `unit_price` and `gst_rate` deliberately, because they are the price *at the time of sale* (a historical fact), not a copy of the current price.
* **Derived values stored on purpose** — `invoices.amount_paid` and `purchases.total_amount` are kept in step by triggers (`trg_invoice_status`, `trg_purchase_item`) for fast dashboards; the source rows remain the single truth.
