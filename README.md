# Billing & Vendor Management System with WhatsApp Notifications

Next.js 14 · PostgreSQL 16 · MongoDB 7 · WhatsApp Business Cloud API

## Run it

```bash
npm install
npm run dev
```

Open **http://localhost:3000** and sign in:

| Role | Username | Password |
| --- | --- | --- |
| Admin | `admin` | `admin123` |
| Staff | `staff` | `staff123` |
| Customer | `anita` | `customer123` |

`npm run dev` starts its own PostgreSQL (port 5433) and MongoDB (port 27018), keeps their data in `.data/`, creates the schema and sample data the first time, then starts Next.js. The first run downloads MongoDB (about 70 MB). Stop everything with **Ctrl + C**.

Login has two steps: password, then a 6-digit code sent on WhatsApp. Without WhatsApp API keys the app runs in **demo mode**: the code is shown on screen, and every message (bills, order updates, vendor payment slips, low-stock alerts) is printed in the terminal and logged to MongoDB.

## Useful commands

| Command | What it does |
| --- | --- |
| `npm run dev` | Start databases + app |
| `npm run db:reset` | Wipe and reload the sample data (while `npm run dev` is running, in a second terminal) |
| `npm run build && npm start` | Production build |

## Connect with pgAdmin / MongoDB Compass

* PostgreSQL: host `localhost`, port `5433`, database `billing_vendor_db`, user `postgres`, password `postgres`
* MongoDB: `mongodb://127.0.0.1:27018/billing_notifications`

To use databases you installed yourself instead, set `USE_EMBEDDED_DB=false` in `.env.local` and point `DATABASE_URL` / `MONGODB_URI` at them.

## Real WhatsApp messages

Put your Meta WhatsApp Cloud API token and phone-number ID in `.env.local` (`WA_TOKEN`, `WA_PHONE_NUMBER_ID`) and create these approved templates: `bill_receipt`, `order_update`, `vendor_paid_slip`, `login_otp` (authentication), `low_stock_alert`. Change the sample users' WhatsApp numbers on the Users screen to real ones.

## Where the database work lives

| What | Where |
| --- | --- |
| Tables, keys, constraints, indexes | `db/postgres/01_ddl.sql` |
| Functions, procedures, 5 triggers, 2 views | `db/postgres/02_plpgsql.sql` |
| Sample data + transaction | `db/postgres/03_dml.sql` |
| Report queries (joins, HAVING, subquery, window, CTE) | `db/postgres/04_queries.sql` |
| Roles and privileges | `db/postgres/05_dcl.sql` (run manually) |
| MongoDB validator + indexes (incl. TTL) | `db/mongo/init.js` |
| Order → invoice transaction | `app/api/orders/route.js` |
| Vendor payment (procedure call) | `app/api/vendors/[id]/payments/route.js` |
| WhatsApp send + MongoDB log | `lib/notify.js`, `lib/whatsapp.js` |
| `LISTEN low_stock` worker | `workers/lowStockListener.js` |
| Role-based access | `middleware.js` |
