-- ============ Queries for the demo (each one is also shown live on Admin → SQL Reports) ============

-- ---------- JOIN queries ----------
-- Q1 Inner join (5 tables): every line of every invoice with its customer and product
SELECT i.invoice_no, c.name AS customer, p.name AS product, oi.quantity, oi.line_total, i.status
FROM invoices i
JOIN orders o       ON o.order_id = i.order_id
JOIN customers c    ON c.customer_id = o.customer_id
JOIN order_items oi ON oi.order_id = o.order_id
JOIN products p     ON p.product_id = oi.product_id
ORDER BY i.invoice_no, oi.line_no;

-- Q2 Left outer join: every product with its stock at each branch (products with no stock still appear)
SELECT p.sku, p.name, b.code AS branch, COALESCE(s.quantity, 0) AS quantity
FROM products p
CROSS JOIN branches b
LEFT JOIN stock s ON s.product_id = p.product_id AND s.branch_id = b.branch_id
ORDER BY p.name, b.code;

-- Q3 Self join: each category with its parent category
SELECT child.name AS category, parent.name AS parent_category
FROM categories child
LEFT JOIN categories parent ON parent.category_id = child.parent_id
ORDER BY parent.name NULLS FIRST, child.name;

-- ---------- Nested (non-correlated) subqueries ----------
-- Q4 Products that have never been sold
SELECT sku, name FROM products
WHERE product_id NOT IN (SELECT DISTINCT product_id FROM order_items);

-- Q5 Invoices bigger than the average invoice
SELECT invoice_no, total_amount FROM invoices
WHERE total_amount > (SELECT AVG(total_amount) FROM invoices WHERE status <> 'cancelled')
ORDER BY total_amount DESC;

-- ---------- Correlated subqueries ----------
-- Q6 EXISTS: customers who still owe money on at least one invoice
SELECT c.name, c.whatsapp_no
FROM customers c
WHERE EXISTS (SELECT 1 FROM orders o JOIN invoices i ON i.order_id = o.order_id
              WHERE o.customer_id = c.customer_id AND i.status IN ('unpaid', 'partial'));

-- Q7 Scalar correlated subquery: each product's latest purchase cost vs its catalogue cost
SELECT p.name, p.cost_price,
       (SELECT pi.unit_cost FROM purchase_items pi JOIN purchases pu ON pu.purchase_id = pi.purchase_id
         WHERE pi.product_id = p.product_id
         ORDER BY pu.purchase_date DESC, pu.purchase_id DESC LIMIT 1) AS last_purchase_cost
FROM products p
ORDER BY p.name;

-- Q8 Correlated in WHERE: products priced above the average of their own category
SELECT p.name, p.selling_price, c.name AS category
FROM products p JOIN categories c ON c.category_id = p.category_id
WHERE p.selling_price > (SELECT AVG(p2.selling_price) FROM products p2 WHERE p2.category_id = p.category_id)
ORDER BY p.selling_price DESC;

-- ---------- Recursive queries ----------
-- Q9 Recursive CTE: the whole category tree with level and path
WITH RECURSIVE tree AS (
    SELECT category_id, name, parent_id, 1 AS level, name::text AS path
    FROM categories WHERE parent_id IS NULL
  UNION ALL
    SELECT c.category_id, c.name, c.parent_id, t.level + 1, t.path || ' > ' || c.name
    FROM categories c JOIN tree t ON c.parent_id = t.category_id
)
SELECT level, path,
       (SELECT COUNT(*) FROM products p WHERE p.category_id = tree.category_id) AS products
FROM tree ORDER BY path;

-- Q10 Recursive CTE: every product anywhere under 'Pooja Items' (all sub-levels), with stock value
WITH RECURSIVE subtree AS (
    SELECT category_id FROM categories WHERE name = 'Pooja Items'
  UNION ALL
    SELECT c.category_id FROM categories c JOIN subtree s ON c.parent_id = s.category_id
)
SELECT p.name, c.name AS category, SUM(s.quantity) AS stock, SUM(s.quantity * p.cost_price) AS stock_value
FROM products p
JOIN categories c ON c.category_id = p.category_id
LEFT JOIN stock s ON s.product_id = p.product_id
WHERE p.category_id IN (SELECT category_id FROM subtree)
GROUP BY p.name, c.name ORDER BY stock_value DESC NULLS LAST;

-- ---------- Aggregation, CTE and window functions ----------
-- Q11 GROUP BY + HAVING: vendors with unpaid purchase bills
SELECT v.name, SUM(p.total_amount - p.paid_amount) AS unpaid, COUNT(*) AS bills
FROM vendors v JOIN purchases p ON p.vendor_id = v.vendor_id
GROUP BY v.name
HAVING SUM(p.total_amount - p.paid_amount) > 0
ORDER BY unpaid DESC;

-- Q12 CTE: stock value at cost per branch, with open low-stock alerts
WITH valued AS (
    SELECT s.branch_id, SUM(s.quantity * p.cost_price) AS stock_value
    FROM stock s JOIN products p ON p.product_id = s.product_id
    GROUP BY s.branch_id
)
SELECT b.code, v.stock_value,
       (SELECT COUNT(*) FROM low_stock_alerts a WHERE a.branch_id = b.branch_id AND a.status = 'open') AS open_alerts
FROM branches b LEFT JOIN valued v ON v.branch_id = b.branch_id;

-- Q13 Window function: rank products by revenue within each category
SELECT c.name AS category, p.name AS product, SUM(oi.line_total) AS revenue,
       RANK() OVER (PARTITION BY c.category_id ORDER BY SUM(oi.line_total) DESC) AS rank_in_category
FROM order_items oi
JOIN products p   ON p.product_id = oi.product_id
JOIN categories c ON c.category_id = p.category_id
GROUP BY c.category_id, c.name, p.name;

-- Q14 Function call: vendor balance from fn_vendor_balance()
SELECT name, fn_vendor_balance(vendor_id) AS balance FROM vendors ORDER BY balance DESC;
