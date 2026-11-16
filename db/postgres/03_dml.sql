-- ============ DML: sample data (logins: admin/admin123, staff/staff123, anita/customer123) ============
INSERT INTO branches (code, name, gstin, phone, address) VALUES
 ('BLR1', 'Jayanagar Branch',    '29ABCDE1234F1Z5', '9845012345', '4th Block, Jayanagar, Bengaluru 560011'),
 ('BLR2', 'Basavanagudi Branch', '29ABCDE1234F1Z5', '9845012346', 'DVG Road, Basavanagudi, Bengaluru 560004');

INSERT INTO users (branch_id, username, full_name, whatsapp_no, password_hash, role) VALUES
 (1,    'admin', 'Store Admin',  '919845000001', '$2a$10$p9t2cmLXQgb64aPu0t1Tw./Z6jG/SJtvn70qQk.iijpsrES5rPQbe', 'admin'),
 (1,    'staff', 'Ravi Kumar',   '919845000002', '$2a$10$Z0WgExW6qE5Xp9QeLSa6ZeezX24PXVAMuqxZzqtZHX7OEQsoteLm6', 'staff'),
 (NULL, 'anita', 'Anita Sharma', '919900011122', '$2a$10$PNZtHEE11Ztmq6Zfb7T02eLzrH044HKuQKjFSZO/mew2Bzby0pLru', 'customer');

INSERT INTO customers (user_id, name, whatsapp_no, customer_type, credit_limit) VALUES
 (3,    'Anita Sharma',      '919900011122', 'retail',    0),
 (NULL, 'Sri Ganesh Stores', '919900033344', 'wholesale', 50000),
 (NULL, 'Ramesh Rao',        '919845566778', 'retail',    0);

-- Category tree (self-referencing parent_id): Pooja Items > Incense > Dhoop & Cones, Groceries > Ghee & Oils
INSERT INTO categories (name, parent_id) VALUES
 ('Pooja Items', NULL), ('Lamps & Brassware', 1), ('Incense', 1), ('Groceries', NULL),
 ('Dhoop & Cones', 3), ('Ghee & Oils', 4);

INSERT INTO products (category_id, sku, barcode, name, hsn_code, gst_rate, cost_price, selling_price, mrp, low_stock_threshold) VALUES
 (1, 'PJ-KUM-100', '8901000000011', 'Kumkum 100 g',            '3304', 18,  22.00,   35.00,   40.00, 10),
 (2, 'LB-DIA-05',  '8901000000028', 'Brass Diya No.5',         '7418', 12, 180.00,  260.00,  300.00,  3),
 (3, 'IN-AGR-20',  '8901000000035', 'Agarbatti 20 sticks',     '3307',  5,  12.00,   20.00,   20.00, 20),
 (1, 'PJ-CAM-50',  '8901000000042', 'Camphor Tablets 50 g',    '2914', 18,  45.00,   70.00,   75.00, 15),
 (1, 'PJ-WIC-100', '8901000000059', 'Ghee Cotton Wicks (100)', '5601',  5,  18.00,   30.00,   30.00, 25),
 (2, 'LB-KAL-01',  '8901000000066', 'Silver Plated Kalash',    '7418', 12, 850.00, 1250.00, 1400.00,  2),
 (6, 'GR-GHE-500', '8901000000073', 'Cow Ghee 500 ml',         '0405', 12, 290.00,  365.00,  380.00,  8),
 (5, 'IN-DHP-12',  '8901000000080', 'Dhoop Cones (12)',        '3307',  5,  25.00,   40.00,   45.00, 10);

INSERT INTO vendors (name, gstin, contact_person, whatsapp_no, email, opening_balance) VALUES
 ('Shree Brass Works',           '29AAACS1111A1Z1', 'Mahesh',  '919811122233', 'sales@shreebrass.example',  5000),
 ('Mysore Agarbathi Co',         '29AAACM2222B1Z2', 'Prakash', '919822233344', 'orders@mysoreagar.example',    0),
 ('Sri Lakshmi Camphor Traders', '29AAACL3333C1Z3', 'Suresh',  '919833344455', NULL,                           0);

-- Purchases: trigger T4 adds stock to the branch and builds each purchase total
INSERT INTO purchases (vendor_id, branch_id, vendor_invoice_no) VALUES
 (1, 1, 'SBW/1187'), (2, 1, 'MAC/0042'), (3, 1, 'SLC/7781'), (2, 2, 'MAC/0051');
INSERT INTO purchase_items (purchase_id, line_no, product_id, quantity, unit_cost, gst_rate) VALUES
 (1, 1, 2,  12, 180.00, 12),
 (1, 2, 6,   6, 850.00, 12),
 (2, 1, 3, 150,  12.00,  5),
 (2, 2, 1,  60,  22.00, 18),
 (2, 3, 5,  80,  18.00,  5),
 (2, 4, 8,  30,  25.00,  5),
 (3, 1, 4,  40,  45.00, 18),
 (3, 2, 7,  20, 290.00, 12),
 (4, 1, 3,  80,  13.00,  5),   -- price went up: see query Q7
 (4, 2, 1,  30,  22.00, 18);

-- One vendor bill paid in full (trigger T5 marks it paid)
CALL sp_record_vendor_payment(1, 1, 8131.20, 'neft', 'NEFT20261101A', 1);

-- Two sample bills at Jayanagar
BEGIN;
  INSERT INTO orders (branch_id, customer_id, created_by) VALUES (1, 1, 2);
  INSERT INTO order_items (order_id, line_no, product_id, quantity, unit_price, gst_rate)
  VALUES (1, 1, 2, 2, 260.00, 12), (1, 2, 1, 2, 35.00, 18);
  CALL sp_generate_invoice(1, NULL);
COMMIT;
INSERT INTO customer_payments (invoice_id, amount, mode, reference_no, received_by) VALUES (1, 590.00, 'upi', 'UPI4471829', 2);

BEGIN;
  INSERT INTO orders (branch_id, customer_id, created_by) VALUES (1, 2, 2);
  INSERT INTO order_items (order_id, line_no, product_id, quantity, unit_price, gst_rate)
  VALUES (2, 1, 3, 40, 20.00, 5), (2, 2, 5, 30, 30.00, 5), (2, 3, 4, 10, 70.00, 18);
  CALL sp_generate_invoice(2, NULL);
COMMIT;
INSERT INTO customer_payments (invoice_id, amount, mode, received_by) VALUES (2, 1000.00, 'cash', 2);

-- UPDATE and DELETE
UPDATE orders    SET status = 'delivered'          WHERE order_id = 1;
UPDATE customers SET email  = 'anita@example.com'  WHERE customer_id = 1;
DELETE FROM low_stock_alerts WHERE status = 'resolved' AND created_at < now() - INTERVAL '90 days';
