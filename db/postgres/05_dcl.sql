-- ============ DCL: database roles mirror application roles ============
CREATE ROLE erp_admin  LOGIN PASSWORD 'admin_pw';
CREATE ROLE erp_staff  LOGIN PASSWORD 'staff_pw';
CREATE ROLE erp_report LOGIN PASSWORD 'report_pw';

GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO erp_admin;
GRANT SELECT, INSERT, UPDATE ON orders, order_items, invoices, customer_payments, customers, stock TO erp_staff;
GRANT SELECT ON products, categories, branches TO erp_staff;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO erp_staff;
GRANT EXECUTE ON PROCEDURE sp_generate_invoice(INT, VARCHAR) TO erp_staff;
GRANT SELECT ON v_daily_sales, v_vendor_outstanding TO erp_report;
REVOKE ALL ON vendor_payments FROM erp_staff;
