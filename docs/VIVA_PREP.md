# Viva Preparation

## Likely questions

**Why two databases?** Money and stock need ACID transactions, foreign keys and triggers (PostgreSQL). WhatsApp logs have a different shape per message type, are append-heavy, and OTPs must expire automatically (MongoDB with TTL). See `docs/TECH_JUSTIFICATION.md`.

**What happens in the database when a bill is made?** One transaction: INSERT order → INSERT each line (trigger `trg_order_item_stock` subtracts stock, and `trg_low_stock` may raise an alert + `pg_notify`) → `CALL sp_generate_invoice` (numbers the invoice via `fn_next_invoice_no`, splits GST into CGST/SGST) → INSERT payment (trigger `trg_invoice_status` sets unpaid/partial/paid) → COMMIT. Any error (e.g. not enough stock) rolls the whole bill back.

**How is the invoice number gap-free under concurrency?** `INSERT … ON CONFLICT (branch_id, fiscal_year) DO UPDATE SET last_seq = last_seq + 1 RETURNING last_seq` takes a row lock on that branch's counter, so two cashiers cannot get the same number; it runs inside the bill's transaction, so a rolled-back bill does not use up a number.

**Why does `order_items` store `unit_price` and `gst_rate` when products already have them?** They are the price and tax at the moment of sale. If the product price changes tomorrow, old invoices must not change. This is not a 3NF violation: they depend on the order line, not on the product.

**Where is RBAC enforced?** Twice. In the app (`middleware.js` + `requireRole`) and in PostgreSQL: the app connects as `bv_app` (no rights) and runs `SET LOCAL ROLE erp_staff` etc. per request. GRANTs limit tables and columns; row-level-security policies limit a customer to rows where `customer_id = app_customer_id()`. Shown live on Admin → DB Security.

**Why are the procedures SECURITY DEFINER?** Staff must be able to bill, which writes invoices, stock and alerts, but they should not be able to UPDATE those tables freely. SECURITY DEFINER runs the routine with the owner's rights; staff only get EXECUTE on `sp_generate_invoice`. `search_path` is pinned to avoid hijacking.

**What is a correlated subquery here?** Q7: for each product row, the inner query finds that product's latest purchase cost (`WHERE pi.product_id = p.product_id`), so it runs once per outer row. Q6 uses `EXISTS` the same way.

**How does the recursive query work?** Anchor = categories with `parent_id IS NULL`; recursive step joins children to rows already found (`c.parent_id = t.category_id`), adding `level + 1` and the path. It stops when a step returns no rows.

**How does vector search work without an AI API?** Each word and 3-letter piece of a word is hashed into one of 256 slots; the vector is normalised to length 1. Similar spellings share slots, so the dot product (= cosine similarity) is high. That is why the typo "kalsh" still finds "Kalash". A real embedding model could replace `embed()` with no change to MongoDB.

**What do the MongoDB indexes do?** `{type, status, createdAt}` for the dashboard filter; `{ref.table, ref.id}` to find all messages about one invoice; partial index on failed messages for the retry worker; sparse `waMessageId` for webhook updates; TTL `createdAt` on `otp_sessions` deletes codes after 300 s; unique `productId` on vectors.

**Why `NUMERIC(12,2)` and not FLOAT for money?** FLOAT cannot represent 0.1 exactly; NUMERIC is exact decimal arithmetic.

**What if MongoDB is down?** Billing still works; `tryMongo()` returns null, messages are printed instead of logged. PostgreSQL is the system of record.

## Modification tasks you may be asked to do live

| Ask | Where to change | Steps |
| --- | --- | --- |
| Add a column (e.g. customer address) | `01_ddl.sql` | `ALTER TABLE customers ADD COLUMN address TEXT;` then show it in a page query. Add to `01_ddl.sql` so `db:reset` keeps it. |
| Add a CHECK constraint | psql | `ALTER TABLE products ADD CONSTRAINT chk_cost CHECK (cost_price <= selling_price);` |
| New trigger (e.g. audit price changes) | `02_plpgsql.sql` | Create `price_history` table; `CREATE FUNCTION … RETURNS TRIGGER` inserting OLD/NEW price; `CREATE TRIGGER … AFTER UPDATE OF selling_price ON products FOR EACH ROW`. |
| New query on SQL Reports | `04_queries.sql` | Add `-- Q15 Title` followed by the SQL under any `-- ---------- Section ----------`; refresh the page — it appears automatically. |
| Give staff read access to vendors | `05_dcl.sql` | `GRANT SELECT ON vendors TO erp_staff;` — refresh DB Security; the test row flips to allowed. Revoke to undo. |
| New MongoDB index / field | `db/mongo/init.js` | `db.notification_logs.createIndex({ to: 1, createdAt: -1 })` in mongosh; shows on the WhatsApp Log page cards. |
| Change low-stock level | Products / psql | `UPDATE products SET low_stock_threshold = 15 WHERE sku = 'PJ-CAM-50';` then sell some to trigger the alert. |
| Add a new role (e.g. accountant) | `05_dcl.sql`, `middleware.js`, `lib/db.js` | `CREATE ROLE erp_accountant NOLOGIN; GRANT erp_accountant TO bv_app; GRANT SELECT ON invoices, vendor_payments …` then add `'accountant'` to the role maps. |

## Handy psql for the viva

```sql
\dt                        -- tables
\d+ invoices               -- columns, constraints, indexes, policies
\df                        -- functions and procedures
SELECT * FROM pg_policies; -- row-level security
SET ROLE erp_staff; SELECT * FROM vendors; RESET ROLE;   -- permission denied
SET ROLE erp_customer; SET app.customer_id = '1'; SELECT invoice_no FROM invoices; RESET ROLE;
```
