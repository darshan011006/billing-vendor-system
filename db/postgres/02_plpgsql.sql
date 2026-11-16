-- ============ Stored functions / procedures ============

-- (1) Invoice numbering: <BRANCH>/<FY>/<6-digit seq>, gap-free per branch per fiscal year
CREATE OR REPLACE FUNCTION fn_next_invoice_no(p_branch_id INT, p_date DATE)
RETURNS VARCHAR AS $$
DECLARE
    v_fy   CHAR(7);
    v_seq  INT;
    v_code VARCHAR(10);
BEGIN
    v_fy := CASE WHEN EXTRACT(MONTH FROM p_date) >= 4
                 THEN EXTRACT(YEAR FROM p_date)::INT || '-' || LPAD(((EXTRACT(YEAR FROM p_date)::INT + 1) % 100)::TEXT, 2, '0')
                 ELSE (EXTRACT(YEAR FROM p_date)::INT - 1) || '-' || LPAD((EXTRACT(YEAR FROM p_date)::INT % 100)::TEXT, 2, '0')
            END;
    INSERT INTO invoice_sequences (branch_id, fiscal_year, last_seq)
    VALUES (p_branch_id, v_fy, 1)
    ON CONFLICT (branch_id, fiscal_year)
    DO UPDATE SET last_seq = invoice_sequences.last_seq + 1
    RETURNING last_seq INTO v_seq;               -- row lock makes this safe under concurrency

    SELECT code INTO v_code FROM branches WHERE branch_id = p_branch_id;
    RETURN v_code || '/' || v_fy || '/' || LPAD(v_seq::TEXT, 6, '0');
END;
$$ LANGUAGE plpgsql;

-- (2) Vendor balance = opening balance + purchases - payments
CREATE OR REPLACE FUNCTION fn_vendor_balance(p_vendor_id INT)
RETURNS NUMERIC AS $$
    SELECT v.opening_balance
         + COALESCE((SELECT SUM(total_amount) FROM purchases       WHERE vendor_id = v.vendor_id), 0)
         - COALESCE((SELECT SUM(amount)       FROM vendor_payments WHERE vendor_id = v.vendor_id), 0)
    FROM vendors v
    WHERE v.vendor_id = p_vendor_id;
$$ LANGUAGE sql STABLE;

-- (3) Generate an invoice from an order (totals computed in the DB)
CREATE OR REPLACE PROCEDURE sp_generate_invoice(p_order_id INT, INOUT p_invoice_no VARCHAR DEFAULT NULL)
LANGUAGE plpgsql AS $$
DECLARE
    v_branch  INT;
    v_taxable NUMERIC(12,2);
    v_tax     NUMERIC(12,2);
BEGIN
    SELECT branch_id INTO v_branch FROM orders WHERE order_id = p_order_id AND status = 'pending'
    FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Order % does not exist or is not pending', p_order_id;
    END IF;

    -- prices are GST-inclusive: taxable = total / (1 + rate/100)
    SELECT ROUND(SUM(line_total / (1 + gst_rate/100)), 2),
           ROUND(SUM(line_total - line_total / (1 + gst_rate/100)), 2)
      INTO v_taxable, v_tax
      FROM order_items WHERE order_id = p_order_id;
    IF v_taxable IS NULL THEN
        RAISE EXCEPTION 'Order % has no items', p_order_id;
    END IF;

    p_invoice_no := fn_next_invoice_no(v_branch, CURRENT_DATE);

    INSERT INTO invoices (order_id, invoice_no, taxable_value, cgst, sgst, total_amount)
    VALUES (p_order_id, p_invoice_no, v_taxable, ROUND(v_tax/2, 2), v_tax - ROUND(v_tax/2, 2), v_taxable + v_tax);

    UPDATE orders SET status = 'confirmed' WHERE order_id = p_order_id;
END;
$$;

-- (4) Record a vendor payment with an over-payment guard
CREATE OR REPLACE PROCEDURE sp_record_vendor_payment(
    p_vendor_id INT, p_purchase_id INT, p_amount NUMERIC, p_mode VARCHAR, p_ref VARCHAR, p_user INT)
LANGUAGE plpgsql AS $$
DECLARE v_balance NUMERIC := fn_vendor_balance(p_vendor_id);
BEGIN
    IF v_balance IS NULL THEN
        RAISE EXCEPTION 'Vendor % not found', p_vendor_id;
    ELSIF p_amount > v_balance THEN
        RAISE EXCEPTION 'Payment % exceeds outstanding balance %', p_amount, v_balance;
    END IF;
    INSERT INTO vendor_payments (vendor_id, purchase_id, amount, mode, reference_no, paid_by)
    VALUES (p_vendor_id, p_purchase_id, p_amount, p_mode, p_ref, p_user);
END;
$$;

-- ============ Triggers ============

-- (T1) Selling reduces stock; overselling is rejected
CREATE OR REPLACE FUNCTION trg_fn_order_item_stock() RETURNS TRIGGER AS $$
BEGIN
    UPDATE stock s SET quantity = s.quantity - NEW.quantity, updated_at = now()
      FROM orders o
     WHERE o.order_id = NEW.order_id AND s.branch_id = o.branch_id AND s.product_id = NEW.product_id
       AND s.quantity >= NEW.quantity;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Insufficient stock for product %', NEW.product_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_order_item_stock
AFTER INSERT ON order_items
FOR EACH ROW EXECUTE FUNCTION trg_fn_order_item_stock();

-- (T2) Low-stock alert when quantity crosses the product threshold
CREATE OR REPLACE FUNCTION trg_fn_low_stock() RETURNS TRIGGER AS $$
DECLARE v_threshold INT;
BEGIN
    SELECT low_stock_threshold INTO v_threshold FROM products WHERE product_id = NEW.product_id;
    IF NEW.quantity <= v_threshold AND OLD.quantity > v_threshold THEN
        INSERT INTO low_stock_alerts (product_id, branch_id, quantity, threshold)
        VALUES (NEW.product_id, NEW.branch_id, NEW.quantity, v_threshold);
        PERFORM pg_notify('low_stock', json_build_object(
            'product_id', NEW.product_id, 'branch_id', NEW.branch_id, 'qty', NEW.quantity)::text);
    ELSIF NEW.quantity > v_threshold THEN
        UPDATE low_stock_alerts SET status = 'resolved'
         WHERE product_id = NEW.product_id AND branch_id = NEW.branch_id AND status = 'open';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_low_stock
AFTER UPDATE OF quantity ON stock
FOR EACH ROW EXECUTE FUNCTION trg_fn_low_stock();

-- (T3) Invoice status follows the payments recorded against it
CREATE OR REPLACE FUNCTION trg_fn_invoice_status() RETURNS TRIGGER AS $$
DECLARE v_inv INT := COALESCE(NEW.invoice_id, OLD.invoice_id);
BEGIN
    UPDATE invoices i
       SET amount_paid = p.paid,
           status = CASE WHEN p.paid = 0 THEN 'unpaid'
                         WHEN p.paid < i.total_amount THEN 'partial'
                         ELSE 'paid' END
      FROM (SELECT COALESCE(SUM(amount), 0) AS paid FROM customer_payments WHERE invoice_id = v_inv) p
     WHERE i.invoice_id = v_inv AND i.status <> 'cancelled';
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_invoice_status
AFTER INSERT OR UPDATE OR DELETE ON customer_payments
FOR EACH ROW EXECUTE FUNCTION trg_fn_invoice_status();

-- (T4) Purchases add stock (upsert) and the purchase total
CREATE OR REPLACE FUNCTION trg_fn_purchase_item() RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO stock (product_id, branch_id, quantity)
    SELECT NEW.product_id, p.branch_id, NEW.quantity FROM purchases p WHERE p.purchase_id = NEW.purchase_id
    ON CONFLICT (product_id, branch_id)
    DO UPDATE SET quantity = stock.quantity + EXCLUDED.quantity, updated_at = now();

    UPDATE purchases
       SET total_amount = total_amount + ROUND(NEW.quantity * NEW.unit_cost * (1 + NEW.gst_rate/100), 2)
     WHERE purchase_id = NEW.purchase_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_purchase_item
AFTER INSERT ON purchase_items
FOR EACH ROW EXECUTE FUNCTION trg_fn_purchase_item();

-- (T5) Vendor payment updates the purchase's paid amount and status
CREATE OR REPLACE FUNCTION trg_fn_vendor_payment() RETURNS TRIGGER AS $$
BEGIN
    IF NEW.purchase_id IS NOT NULL THEN
        UPDATE purchases
           SET paid_amount = paid_amount + NEW.amount,
               status = CASE WHEN paid_amount + NEW.amount >= total_amount THEN 'paid' ELSE 'partial' END
         WHERE purchase_id = NEW.purchase_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_vendor_payment
AFTER INSERT ON vendor_payments
FOR EACH ROW EXECUTE FUNCTION trg_fn_vendor_payment();

-- ============ Views ============
CREATE VIEW v_vendor_outstanding AS
SELECT v.vendor_id, v.name, v.whatsapp_no,
       COUNT(p.purchase_id) FILTER (WHERE p.status <> 'paid') AS open_bills,
       fn_vendor_balance(v.vendor_id)                         AS balance_due
FROM vendors v LEFT JOIN purchases p ON p.vendor_id = v.vendor_id
GROUP BY v.vendor_id;

CREATE VIEW v_daily_sales AS
SELECT o.branch_id, i.invoice_date, COUNT(*) AS bills,
       SUM(i.total_amount) AS revenue, SUM(i.cgst + i.sgst) AS gst_collected
FROM invoices i JOIN orders o ON o.order_id = i.order_id
WHERE i.status <> 'cancelled'
GROUP BY o.branch_id, i.invoice_date;
