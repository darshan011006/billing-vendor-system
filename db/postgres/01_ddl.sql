-- ============ DDL: database and tables ============
CREATE TABLE branches (
    branch_id     SERIAL PRIMARY KEY,
    code          VARCHAR(10)  NOT NULL UNIQUE,
    name          VARCHAR(100) NOT NULL,
    gstin         CHAR(15),
    phone         VARCHAR(15),
    address       TEXT
);

CREATE TABLE users (
    user_id       SERIAL PRIMARY KEY,
    branch_id     INT REFERENCES branches(branch_id),
    username      VARCHAR(50)  NOT NULL UNIQUE,
    full_name     VARCHAR(100) NOT NULL,
    whatsapp_no   VARCHAR(15)  NOT NULL,
    password_hash TEXT         NOT NULL,
    role          VARCHAR(10)  NOT NULL CHECK (role IN ('admin','staff','customer')),
    is_active     BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at    TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE TABLE customers (
    customer_id   SERIAL PRIMARY KEY,
    user_id       INT UNIQUE REFERENCES users(user_id),
    name          VARCHAR(100) NOT NULL,
    whatsapp_no   VARCHAR(15)  NOT NULL UNIQUE,
    email         VARCHAR(100),
    gstin         CHAR(15),
    customer_type VARCHAR(10)  NOT NULL DEFAULT 'retail' CHECK (customer_type IN ('retail','wholesale')),
    credit_limit  NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (credit_limit >= 0)
);

CREATE TABLE categories (
    category_id   SERIAL PRIMARY KEY,
    name          VARCHAR(60) NOT NULL UNIQUE,
    parent_id     INT REFERENCES categories(category_id) ON DELETE SET NULL,   -- self-reference: category tree
    CHECK (parent_id IS NULL OR parent_id <> category_id)
);

CREATE TABLE products (
    product_id          SERIAL PRIMARY KEY,
    category_id         INT REFERENCES categories(category_id),
    sku                 VARCHAR(30)  NOT NULL UNIQUE,
    barcode             VARCHAR(30)  UNIQUE,
    name                VARCHAR(150) NOT NULL,
    hsn_code            VARCHAR(8),
    gst_rate            NUMERIC(4,2) NOT NULL DEFAULT 0 CHECK (gst_rate IN (0,5,12,18,28)),
    unit                VARCHAR(10)  NOT NULL DEFAULT 'pcs',
    cost_price          NUMERIC(10,2) NOT NULL CHECK (cost_price >= 0),
    selling_price       NUMERIC(10,2) NOT NULL CHECK (selling_price >= 0),
    mrp                 NUMERIC(10,2) NOT NULL,
    low_stock_threshold INT NOT NULL DEFAULT 5,
    CHECK (selling_price <= mrp)
);

CREATE TABLE stock (
    product_id    INT NOT NULL REFERENCES products(product_id),
    branch_id     INT NOT NULL REFERENCES branches(branch_id),
    quantity      NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (quantity >= 0),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (product_id, branch_id)
);

CREATE TABLE low_stock_alerts (
    alert_id      SERIAL PRIMARY KEY,
    product_id    INT NOT NULL REFERENCES products(product_id),
    branch_id     INT NOT NULL REFERENCES branches(branch_id),
    quantity      NUMERIC(10,2) NOT NULL,
    threshold     INT NOT NULL,
    status        VARCHAR(10) NOT NULL DEFAULT 'open' CHECK (status IN ('open','resolved')),
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE orders (
    order_id      SERIAL PRIMARY KEY,
    branch_id     INT NOT NULL REFERENCES branches(branch_id),
    customer_id   INT NOT NULL REFERENCES customers(customer_id),
    created_by    INT NOT NULL REFERENCES users(user_id),
    order_date    TIMESTAMPTZ NOT NULL DEFAULT now(),
    status        VARCHAR(12) NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending','confirmed','packed','delivered','cancelled'))
);

CREATE TABLE order_items (
    order_id      INT NOT NULL REFERENCES orders(order_id) ON DELETE CASCADE,
    line_no       SMALLINT NOT NULL,
    product_id    INT NOT NULL REFERENCES products(product_id),
    quantity      NUMERIC(10,2) NOT NULL CHECK (quantity > 0),
    unit_price    NUMERIC(10,2) NOT NULL,
    discount      NUMERIC(10,2) NOT NULL DEFAULT 0,
    gst_rate      NUMERIC(4,2)  NOT NULL,
    line_total    NUMERIC(12,2) GENERATED ALWAYS AS (quantity * unit_price - discount) STORED,
    PRIMARY KEY (order_id, line_no)
);

CREATE TABLE invoice_sequences (
    branch_id     INT NOT NULL REFERENCES branches(branch_id),
    fiscal_year   CHAR(7) NOT NULL,           -- e.g. 2026-27
    last_seq      INT NOT NULL DEFAULT 0,
    PRIMARY KEY (branch_id, fiscal_year)
);

CREATE TABLE invoices (
    invoice_id    SERIAL PRIMARY KEY,
    order_id      INT NOT NULL UNIQUE REFERENCES orders(order_id),
    invoice_no    VARCHAR(25) NOT NULL UNIQUE,
    invoice_date  DATE NOT NULL DEFAULT CURRENT_DATE,
    taxable_value NUMERIC(12,2) NOT NULL,
    cgst          NUMERIC(12,2) NOT NULL DEFAULT 0,
    sgst          NUMERIC(12,2) NOT NULL DEFAULT 0,
    total_amount  NUMERIC(12,2) NOT NULL,
    amount_paid   NUMERIC(12,2) NOT NULL DEFAULT 0,
    status        VARCHAR(10) NOT NULL DEFAULT 'unpaid'
                  CHECK (status IN ('unpaid','partial','paid','cancelled'))
);

CREATE TABLE customer_payments (
    payment_id    SERIAL PRIMARY KEY,
    invoice_id    INT NOT NULL REFERENCES invoices(invoice_id),
    amount        NUMERIC(12,2) NOT NULL CHECK (amount > 0),
    mode          VARCHAR(6) NOT NULL CHECK (mode IN ('cash','upi','card','bank')),
    reference_no  VARCHAR(40),
    paid_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    received_by   INT REFERENCES users(user_id)
);

CREATE TABLE vendors (
    vendor_id       SERIAL PRIMARY KEY,
    name            VARCHAR(120) NOT NULL,
    gstin           CHAR(15) UNIQUE,
    contact_person  VARCHAR(100),
    whatsapp_no     VARCHAR(15) NOT NULL,
    email           VARCHAR(100),
    opening_balance NUMERIC(12,2) NOT NULL DEFAULT 0
);

CREATE TABLE purchases (
    purchase_id       SERIAL PRIMARY KEY,
    vendor_id         INT NOT NULL REFERENCES vendors(vendor_id),
    branch_id         INT NOT NULL REFERENCES branches(branch_id),
    vendor_invoice_no VARCHAR(40) NOT NULL,
    purchase_date     DATE NOT NULL DEFAULT CURRENT_DATE,
    total_amount      NUMERIC(12,2) NOT NULL DEFAULT 0,
    paid_amount       NUMERIC(12,2) NOT NULL DEFAULT 0,
    status            VARCHAR(8) NOT NULL DEFAULT 'unpaid' CHECK (status IN ('unpaid','partial','paid')),
    UNIQUE (vendor_id, vendor_invoice_no)
);

CREATE TABLE purchase_items (
    purchase_id   INT NOT NULL REFERENCES purchases(purchase_id) ON DELETE CASCADE,
    line_no       SMALLINT NOT NULL,
    product_id    INT NOT NULL REFERENCES products(product_id),
    quantity      NUMERIC(10,2) NOT NULL CHECK (quantity > 0),
    unit_cost     NUMERIC(10,2) NOT NULL,
    gst_rate      NUMERIC(4,2)  NOT NULL,
    PRIMARY KEY (purchase_id, line_no)
);

CREATE TABLE vendor_payments (
    vendor_payment_id SERIAL PRIMARY KEY,
    vendor_id     INT NOT NULL REFERENCES vendors(vendor_id),
    purchase_id   INT REFERENCES purchases(purchase_id),
    amount        NUMERIC(12,2) NOT NULL CHECK (amount > 0),
    mode          VARCHAR(6) NOT NULL CHECK (mode IN ('cash','upi','cheque','neft')),
    reference_no  VARCHAR(40),
    payment_date  DATE NOT NULL DEFAULT CURRENT_DATE,
    paid_by       INT NOT NULL REFERENCES users(user_id)
);

CREATE INDEX idx_orders_customer   ON orders(customer_id, order_date DESC);
CREATE INDEX idx_invoices_status   ON invoices(status) WHERE status <> 'paid';
CREATE INDEX idx_vpay_vendor       ON vendor_payments(vendor_id);
CREATE INDEX idx_purchases_vendor  ON purchases(vendor_id);
