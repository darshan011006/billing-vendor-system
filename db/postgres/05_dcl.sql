-- ============ DCL: role-based access control inside PostgreSQL ============
-- The web app does NOT connect as a superuser. It logs in as bv_app, which has no table
-- rights of its own (NOINHERIT). For every request the app runs SET LOCAL ROLE to the
-- signed-in user's role, so PostgreSQL itself decides what that user may read or change:
--   erp_auth      not signed in yet: may only look up a login
--   erp_customer  a customer: sees only their own orders, invoices and payments (row-level security)
--   erp_staff     billing staff: sell, bill, take payments; no vendors, purchases or user admin
--   erp_admin     everything
-- Safe to run again.

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'erp_auth')     THEN CREATE ROLE erp_auth     NOLOGIN; END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'erp_customer') THEN CREATE ROLE erp_customer NOLOGIN; END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'erp_staff')    THEN CREATE ROLE erp_staff    NOLOGIN; END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'erp_admin')    THEN CREATE ROLE erp_admin    NOLOGIN; END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'bv_app') THEN
        CREATE ROLE bv_app LOGIN NOINHERIT PASSWORD 'bv_app_pw';
    END IF;
END $$;

GRANT erp_auth, erp_customer, erp_staff, erp_admin TO bv_app;   -- bv_app may only SET ROLE to these
GRANT USAGE ON SCHEMA public TO erp_auth, erp_customer, erp_staff, erp_admin;
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM PUBLIC;
REVOKE EXECUTE ON ALL PROCEDURES IN SCHEMA public FROM PUBLIC;

-- ---------- erp_auth: login lookup only ----------
GRANT SELECT ON users, branches TO erp_auth;
GRANT SELECT (customer_id, user_id) ON customers TO erp_auth;

-- ---------- erp_customer: read-only, own rows (see policies below) ----------
GRANT SELECT ON branches, categories, products, customers, orders, order_items, invoices, customer_payments TO erp_customer;
GRANT SELECT (user_id, full_name) ON users TO erp_customer;

-- ---------- erp_staff: billing counter ----------
GRANT SELECT ON branches, categories, products, stock, low_stock_alerts,
                customers, orders, order_items, invoices, customer_payments, v_daily_sales TO erp_staff;
GRANT SELECT (user_id, full_name, role, branch_id) ON users TO erp_staff;
GRANT INSERT, UPDATE (name, email, gstin) ON customers TO erp_staff;
GRANT INSERT, UPDATE (status) ON orders TO erp_staff;
GRANT INSERT ON order_items, customer_payments TO erp_staff;
GRANT UPDATE (status) ON invoices TO erp_staff;
GRANT UPDATE (quantity, updated_at) ON stock TO erp_staff;               -- cancelling an order returns stock
GRANT USAGE ON SEQUENCE customers_customer_id_seq, orders_order_id_seq, customer_payments_payment_id_seq TO erp_staff;
GRANT EXECUTE ON PROCEDURE sp_generate_invoice(INT, VARCHAR) TO erp_staff, erp_admin;
-- deliberately NOT granted to staff: vendors, purchases, purchase_items, vendor_payments,
-- invoice_sequences, users.password_hash, INSERT on products, sp_record_vendor_payment

-- ---------- erp_admin: everything ----------
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO erp_admin;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO erp_admin;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO erp_admin;
GRANT EXECUTE ON ALL PROCEDURES IN SCHEMA public TO erp_admin;

-- ---------- Business routines run with the owner's rights (SECURITY DEFINER) ----------
-- so a staff member can bill (which writes invoices, stock and alerts through triggers)
-- without being granted direct write access to those tables.
CREATE OR REPLACE FUNCTION app_customer_id() RETURNS INT
LANGUAGE sql STABLE AS $$ SELECT NULLIF(current_setting('app.customer_id', true), '')::INT $$;
GRANT EXECUTE ON FUNCTION app_customer_id() TO erp_customer, erp_staff, erp_admin, erp_auth;

ALTER FUNCTION  fn_next_invoice_no(INT, DATE)                                         SECURITY DEFINER SET search_path = public;
ALTER FUNCTION  fn_vendor_balance(INT)                                                SECURITY DEFINER SET search_path = public;
ALTER PROCEDURE sp_generate_invoice(INT, VARCHAR)                                     SECURITY DEFINER SET search_path = public;
ALTER PROCEDURE sp_record_vendor_payment(INT, INT, NUMERIC, VARCHAR, VARCHAR, INT)   SECURITY DEFINER SET search_path = public;
ALTER FUNCTION  trg_fn_order_item_stock()  SECURITY DEFINER SET search_path = public;
ALTER FUNCTION  trg_fn_low_stock()         SECURITY DEFINER SET search_path = public;
ALTER FUNCTION  trg_fn_invoice_status()    SECURITY DEFINER SET search_path = public;
ALTER FUNCTION  trg_fn_purchase_item()     SECURITY DEFINER SET search_path = public;
ALTER FUNCTION  trg_fn_vendor_payment()    SECURITY DEFINER SET search_path = public;

-- ---------- Row-level security: a customer sees only their own rows ----------
ALTER TABLE customers         ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders            ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items       ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices          ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS staff_all ON customers;         CREATE POLICY staff_all ON customers         FOR ALL TO erp_admin, erp_staff USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS staff_all ON orders;            CREATE POLICY staff_all ON orders            FOR ALL TO erp_admin, erp_staff USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS staff_all ON order_items;       CREATE POLICY staff_all ON order_items       FOR ALL TO erp_admin, erp_staff USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS staff_all ON invoices;          CREATE POLICY staff_all ON invoices          FOR ALL TO erp_admin, erp_staff USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS staff_all ON customer_payments; CREATE POLICY staff_all ON customer_payments FOR ALL TO erp_admin, erp_staff USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS login_lookup ON customers;
CREATE POLICY login_lookup ON customers FOR SELECT TO erp_auth USING (user_id IS NOT NULL);

DROP POLICY IF EXISTS own_rows ON customers;
CREATE POLICY own_rows ON customers FOR SELECT TO erp_customer USING (customer_id = app_customer_id());
DROP POLICY IF EXISTS own_rows ON orders;
CREATE POLICY own_rows ON orders FOR SELECT TO erp_customer USING (customer_id = app_customer_id());
DROP POLICY IF EXISTS own_rows ON order_items;
CREATE POLICY own_rows ON order_items FOR SELECT TO erp_customer USING (order_id IN (SELECT order_id FROM orders));
DROP POLICY IF EXISTS own_rows ON invoices;
CREATE POLICY own_rows ON invoices FOR SELECT TO erp_customer USING (order_id IN (SELECT order_id FROM orders));
DROP POLICY IF EXISTS own_rows ON customer_payments;
CREATE POLICY own_rows ON customer_payments FOR SELECT TO erp_customer USING (invoice_id IN (SELECT invoice_id FROM invoices));

-- Try it in psql:
--   SET ROLE erp_staff;     SELECT * FROM vendors;                -> ERROR: permission denied for table vendors
--   SET ROLE erp_customer;  SET app.customer_id = '1';  SELECT invoice_no FROM invoices;   -> only Anita's invoice
--   RESET ROLE;
