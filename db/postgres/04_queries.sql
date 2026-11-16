-- Q1 Join: invoice with customer and line items
SELECT i.invoice_no, c.name AS customer, p.name AS product, oi.quantity, oi.line_total, i.status
FROM invoices i
JOIN orders o       ON o.order_id = i.order_id
JOIN customers c    ON c.customer_id = o.customer_id
JOIN order_items oi ON oi.order_id = o.order_id
JOIN products p     ON p.product_id = oi.product_id
ORDER BY oi.line_no;

-- Q2 Aggregate + HAVING: vendors with unpaid purchase bills
SELECT v.name, SUM(p.total_amount - p.paid_amount) AS unpaid, COUNT(*) AS bills
FROM vendors v JOIN purchases p ON p.vendor_id = v.vendor_id
GROUP BY v.name
HAVING SUM(p.total_amount - p.paid_amount) > 0;

-- Q3 Nested subquery: products that have never been sold
SELECT sku, name FROM products
WHERE product_id NOT IN (SELECT DISTINCT product_id FROM order_items);

-- Q4 Window function: rank products by revenue within each category
SELECT c.name AS category, p.name AS product, SUM(oi.line_total) AS revenue,
       RANK() OVER (PARTITION BY c.category_id ORDER BY SUM(oi.line_total) DESC) AS rank_in_category
FROM order_items oi
JOIN products p   ON p.product_id = oi.product_id
JOIN categories c ON c.category_id = p.category_id
GROUP BY c.category_id, c.name, p.name;

-- Q5 CTE: stock value at cost per branch, with open low-stock alerts
WITH valued AS (
    SELECT s.branch_id, SUM(s.quantity * p.cost_price) AS stock_value
    FROM stock s JOIN products p ON p.product_id = s.product_id
    GROUP BY s.branch_id
)
SELECT b.code, v.stock_value,
       (SELECT COUNT(*) FROM low_stock_alerts a WHERE a.branch_id = b.branch_id AND a.status = 'open') AS open_alerts
FROM branches b LEFT JOIN valued v ON v.branch_id = b.branch_id;

-- Q6 Function call
SELECT name, fn_vendor_balance(vendor_id) AS balance FROM vendors;
