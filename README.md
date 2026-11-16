# Billing & Vendor Management System with WhatsApp Notifications

DBMS mini project · Next.js 14 · PostgreSQL 16 · MongoDB 7 · WhatsApp Business Cloud API

Small retail and wholesale shops bill customers, track stock and pay vendors by hand. This app does the whole order → invoice → payment → WhatsApp cycle, with the business rules (stock, invoice numbers, balances, alerts, access control) enforced inside the database.

## Run it

```bash
npm install
npm run dev
```

On a Mac you can instead double-click **`Start BillDesk.command`** (it also installs Node.js if needed).

Open **http://localhost:3000**:

| Role | Username | Password |
| --- | --- | --- |
| Admin | `admin` | `admin123` |
| Staff | `staff` | `staff123` |
| Customer | `anita` | `customer123` |

`npm run dev` starts its own PostgreSQL (port 5433) and MongoDB (port 27018), keeps their data in `.data/`, creates the schema and sample data on the first run, then starts Next.js. The first run downloads MongoDB (about 70 MB). Stop with **Ctrl + C**.

Sign-in is two steps: password, then a 6-digit WhatsApp code. Without WhatsApp API keys the app runs in **demo mode**: the code is shown on screen and every message is printed in the terminal and logged to MongoDB.

## What is inside

| Area | Highlights |
| --- | --- |
| PostgreSQL | 16 tables in 3NF, 24 foreign keys (incl. a self-referencing category tree), CHECK/UNIQUE/generated columns, 4 functions & procedures, 5 triggers, 2 views, `LISTEN/NOTIFY`, 14 report queries (joins, nested, correlated, recursive, CTE, window) |
| Database-level RBAC | App connects as `bv_app` (no rights) and runs `SET LOCAL ROLE erp_admin / erp_staff / erp_customer / erp_auth` per request; column-level GRANTs; row-level security so a customer only ever sees their own rows |
| MongoDB | `notification_logs` (validator, compound/partial/sparse indexes, aggregation), `otp_sessions` (TTL), `product_vectors` (256-d embeddings + cosine-similarity search) |
| Next.js | Admin / Staff / Customer screens, REST API in `app/api`, role middleware, WhatsApp delivery webhook |

## Documentation

| Document | For |
| --- | --- |
| [docs/DEMO_GUIDE.md](docs/DEMO_GUIDE.md) | What to show for each of the 14 demo deliverables |
| [docs/RELATIONAL_SCHEMA.md](docs/RELATIONAL_SCHEMA.md) | Relations, keys, relationships, constraints, normalisation |
| [docs/er-diagram.png](docs/er-diagram.png) | ER diagram (source: `docs/er-diagram.mmd`) |
| [docs/TECH_JUSTIFICATION.md](docs/TECH_JUSTIFICATION.md) | Why PostgreSQL + MongoDB + Next.js |
| [docs/VIVA_PREP.md](docs/VIVA_PREP.md) | Likely viva questions and live-modification tasks |
| [docs/CONTRIBUTIONS.md](docs/CONTRIBUTIONS.md) | Who did what |

## Commands

| Command | What it does |
| --- | --- |
| `npm run dev` | Start databases + app |
| `npm run db:reset` | Reload the sample data (in a second terminal while the app runs) |
| `npm run build && npm start` | Production build |

## Connect with pgAdmin / MongoDB Compass

* PostgreSQL: `localhost:5433`, database `billing_vendor_db`, user `postgres` / `postgres` (owner) — the app itself uses `bv_app` / `bv_app_pw`
* MongoDB: `mongodb://127.0.0.1:27018/billing_notifications`

To use your own installations, set `USE_EMBEDDED_DB=false` in `.env.local` and point `DATABASE_URL`, `APP_DATABASE_URL` and `MONGODB_URI` at them.

## Real WhatsApp messages

Set `WA_TOKEN` and `WA_PHONE_NUMBER_ID` (Meta WhatsApp Cloud API) in `.env.local` and create the approved templates `bill_receipt`, `order_update`, `vendor_paid_slip`, `login_otp` (authentication) and `low_stock_alert`. For delivery receipts, point the Meta webhook at `/api/webhooks/whatsapp` and set `WA_VERIFY_TOKEN` and `WA_APP_SECRET`. Put real WhatsApp numbers on the Users screen.

## Project layout

```text
app/            Next.js pages (admin, staff, customer, invoices) and API routes (app/api)
components/     UI pieces (billing cart, forms, vector search, sidebar)
lib/            db (pool + role switching), auth, mongo, notify, whatsapp, otp, vectors
workers/        LISTEN low_stock → WhatsApp, retry failed messages
db/postgres/    01_ddl · 02_plpgsql · 03_dml · 04_queries · 05_dcl (RBAC)
db/mongo/       init.js (collections, validators, indexes) · embedding.js
docs/           demo guide, schema, ER diagram, justification, viva prep
scripts/        dev runner (starts both databases) and setup
```
