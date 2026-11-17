# Mini Project Demo Guide — 14 deliverables

Start the app (`npm run dev`, or double-click `Start BillDesk.bat` on Windows / `Start BillDesk.command` on a Mac), open http://localhost:3000. The sign-in code appears on screen in yellow (demo mode).

| Login | Password | Role |
| --- | --- | --- |
| `admin` | `admin123` | Admin |
| `staff` | `staff123` | Staff |
| `anita` | `customer123` | Customer |

**Before the demo:** run `npm run db:reset` in a second terminal so the data is fresh and the numbers below match. Keep a psql or pgAdmin window open on PostgreSQL (port 5433, database `billing_vendor_db`, user `postgres` / `postgres`) and MongoDB Compass on `mongodb://127.0.0.1:27018`.

---

## 1. ER Diagram
* **Show:** `docs/er-diagram.png` (Chen notation, legend in the bottom-left corner; source in `docs/er/`), also in the report. `docs/er-diagram-crowsfoot.png` is the same schema as tables.
* **Say:** 15 entity sets and 23 relationship sets (16 tables). Point out the M:N `STOCKED AT` relationship (product × branch) whose attributes `quantity` and `updated_at` become the `stock` table; the weak entities `ORDER_ITEM`, `PURCHASE_ITEM` and `INVOICE_SEQUENCE` (double rectangles) with their identifying relationships (double diamonds) and partial keys; the 1:1 `BILLED AS` (order → invoice); the **recursive** `PARENT OF` on `CATEGORY`; derived attributes such as `line_total` and `amount_paid` (dashed ovals); double lines for total participation (every order is placed by a customer, taken at a branch and created by a user).

## 2. Relational Schema with Keys, Relationships, Constraints
* **Show:** `docs/RELATIONAL_SCHEMA.md` (generated from the live catalog), section "Relationships" and "Kinds of constraints used".
* **Say:** composite PKs, 24 foreign keys, CHECK constraints at column and row level, a generated column, 3NF reasoning.

## 3. SQL Implementation – DDL with Constraints
* **Show:** `db/postgres/01_ddl.sql`. In psql: `\d+ order_items`, `\d categories`.
* **Prove a constraint:** `INSERT INTO products (sku, name, cost_price, selling_price, mrp) VALUES ('X1','Test',10,50,40);` → fails `selling_price <= mrp`.

## 4. NoSQL / Vector Database Creation
* **Show:** `db/mongo/init.js` — three collections, `$jsonSchema` validators, 7 indexes (compound, partial, sparse, unique, **TTL**).
* **In the app:** Admin → *MongoDB · WhatsApp Log* — the three cards list each collection's documents, validator and indexes, read live.
* **Vector part:** `db/mongo/embedding.js` turns product text into a 256-number vector; stored in `product_vectors`.

## 5. Technology Justification
* **Show:** `docs/TECH_JUSTIFICATION.md` — the "which data goes where" table is the 30-second answer.

## 6. DML Operations
* **Show:** `db/postgres/03_dml.sql` (INSERT, transaction with BEGIN/COMMIT, CALL, UPDATE, DELETE).
* **Live:** Staff → *New Bill*: add items, complete bill → INSERTs into orders, order_items, invoices, customer_payments in **one transaction** (`app/api/orders/route.js`). Orders → *Move to… packed* = UPDATE. *Cancelled* = UPDATE that returns stock.

## 7. Nested, Correlated, Recursive and Join Queries
* **Show:** Admin → *SQL Reports* — runs all 14 queries from `db/postgres/04_queries.sql` live; click *Show SQL* on each.
  * Joins: Q1 (5-table inner join), Q2 (left outer join), Q3 (**self join** on categories)
  * Nested: Q4 (`NOT IN`), Q5 (scalar subquery vs average)
  * Correlated: Q6 (`EXISTS`), Q7 (latest purchase cost per product — Agarbatti shows ₹13 vs ₹12), Q8 (above own category's average)
  * Recursive: Q9 (category tree with path), Q10 (all products under *Pooja Items* at any depth)
* **Also:** Admin → *Products* → "Category tree" card is the recursive CTE.

## 8. Advanced SQL – Procedures/Functions, Triggers, CTEs
* **Show:** `db/postgres/02_plpgsql.sql`.
  * Functions: `fn_next_invoice_no` (gap-free `BLR1/2026-27/000001` per branch per fiscal year), `fn_vendor_balance`
  * Procedures: `sp_generate_invoice` (GST split), `sp_record_vendor_payment` (rejects over-payment)
  * 5 triggers: stock deduction, low-stock alert (+ `pg_notify`), invoice status, purchase → stock, vendor payment → purchase status
* **Live trigger chain:** sell 8 × *Brass Diya No.5* (stock 10 → 2). Then show Admin → *Stock & Alerts* (alert opened by `trg_low_stock`), and the terminal / WhatsApp Log shows the admin's low-stock WhatsApp sent by the `LISTEN low_stock` worker.
* **Live procedure guard:** Vendors → *Mysore Agarbathi Co* → pay more than the balance → error raised inside PostgreSQL.
* **CTEs:** Q9, Q10 (recursive), Q12 (ordinary CTE) on *SQL Reports*.

## 9. NoSQL / Vector Features and RUD Operations
* **Read:** Admin → *MongoDB · WhatsApp Log* (`find` + filter by type, `$group` aggregation for the stat cards).
* **Update:** *Mark delivered* / *Mark read* (`findOneAndUpdate` with `$set` + `$push` history). Real delivery receipts arrive at `POST /api/webhooks/whatsapp` and update by `waMessageId`.
* **Delete:** *Delete* on a row (`deleteOne`), *Purge* (`deleteMany` older than N days); OTP sessions are deleted on verify and expire by **TTL**.
* **Vector search:** Admin → *Products* → "Find similar products": try `kalsh` (typo → Silver Plated Kalash), `dhoop incence`, `diya lamp`. Cosine similarity runs as an aggregation pipeline (`$reduce` over `$range`). Add a product → it is embedded automatically; *Rebuild vectors* re-embeds all (upsert).

## 10. Next.js Interface
* Walk through: Admin dashboard (7-day sales chart from `v_daily_sales`), New Bill, invoice (printable), Vendors ledger, Purchases, Stock & Alerts.
* App Router structure: `app/admin/*`, `app/staff/*`, `app/customer/*`, `app/invoices/[id]`.

## 11. Backend / API and Database Integration
* **Show:** `app/api/*` route handlers; `lib/db.js` (pool, transactions, role switching), `lib/mongo.js`, `lib/notify.js` (PostgreSQL row → WhatsApp → MongoDB log, linked by `ref.table/ref.id`).
* **Demo:** browser DevTools → Network while completing a bill: `POST /api/orders` → 201 with the invoice number.

## 12. Authentication + Roles + RBAC in the Database
* **Frontend:** `/login` (bcrypt password) → `/verify-otp` (WhatsApp OTP, stored hashed in MongoDB with TTL) → httpOnly JWT cookie.
* **Three roles in the app:** Admin, Staff, Customer — different menus; `middleware.js` blocks other roles' pages and APIs (try staff → `/admin/vendors` → sent back).
* **RBAC inside PostgreSQL (the important part):** Admin → *DB Security (RBAC)*:
  * the app logs in as `bv_app`, which has **no table rights**; every request does `SET LOCAL ROLE erp_admin | erp_staff | erp_customer | erp_auth`
  * the live test table: staff → `SELECT … FROM vendors` = *permission denied*; staff → `CALL sp_record_vendor_payment` = denied; customer → `SELECT COUNT(*) FROM invoices` = only their own (**row-level security**); customer → `UPDATE` = denied
  * privileges matrix and RLS policies read live from `pg_class`, `pg_policies`
  * source: `db/postgres/05_dcl.sql`
* **Customer view:** sign in as `anita` → sees 1 order; opening `/invoices/2` (someone else's) gives 404 because PostgreSQL returns no row.

## 13. Documentation and Git/GitHub
* `README.md` (run instructions), `docs/` (this guide, schema, technology justification, viva prep, contributions), the report document.
* GitHub repository with a commit history by feature; each member pushes their own changes (see `docs/CONTRIBUTIONS.md`).

## 14. Originality, Individual Contribution, Modification, Viva
* Original parts to point out: database-level RBAC with RLS, SECURITY DEFINER business routines, gap-free fiscal-year invoice numbering, `LISTEN/NOTIFY` → WhatsApp worker, hashed-trigram vector search without any external AI service.
* Each member explains the files they own (`docs/CONTRIBUTIONS.md`).
* Practise the modification tasks in `docs/VIVA_PREP.md`.
