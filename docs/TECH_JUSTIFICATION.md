# Technology Justification

The system has two kinds of data, so it uses two databases: money and stock need strict integrity (PostgreSQL); the WhatsApp message log and product vectors are high-volume, differently-shaped documents (MongoDB). Next.js gives one codebase for the screens and the API.

## The choices

| Layer | Chosen | Why this fits the problem | Alternatives considered |
| --- | --- | --- | --- |
| Transactional data | **PostgreSQL 16** | Orders, invoices, stock and payments must never disagree: ACID transactions, foreign keys, CHECK constraints, triggers and PL/pgSQL procedures keep them consistent *inside* the database. Also gives row-level security and roles for access control, `LISTEN/NOTIFY` for low-stock events, recursive CTEs and window functions for reports. | **MySQL**: no row-level security, weaker CHECK/procedure support for our needs. **SQLite** (what the original ERP used): no concurrent writers, no roles, no `LISTEN/NOTIFY`. |
| Notification log + vectors | **MongoDB 7** | Each WhatsApp message type carries a different payload (a bill has an invoice number and PDF link, a vendor slip has a UTR and balance, an OTP has nothing stored). A document per message avoids a sparse table or an EAV design. Logs are append-heavy, need TTL expiry (OTPs) and grouping (`$group` delivery reports). Product embeddings are arrays of 256 numbers — natural as a document field, queried with an aggregation pipeline. | **PostgreSQL JSONB**: possible, but would mix high-volume logs into the transactional database and its backups. **Redis**: no durable querying/aggregation. **A vector DB (Pinecone, pgvector)**: unnecessary extra service at this scale; MongoDB Atlas `$vectorSearch` is the drop-in upgrade path. |
| Web app + API | **Next.js 14 (App Router)** | Server components query the database directly for pages; route handlers (`app/api/*`) give a REST API for the same app; `middleware.js` checks the role before any page or API runs; one language (JavaScript) end to end. | **Express + React (the original ERP)**: two separate projects, a separate build, no server components. **Django**: different language from the frontend. |
| Styling | **Tailwind CSS** | Consistent, fast UI work with no custom CSS files to maintain. | Bootstrap, plain CSS |
| DB drivers | **node-postgres (`pg`)**, **official MongoDB driver** | Parameterised queries (no SQL injection), connection pooling, `SET LOCAL ROLE` per transaction. | An ORM (Prisma/Sequelize): would hide the SQL that this DBMS project is meant to show. |
| Authentication | **bcrypt + JWT cookie + WhatsApp OTP** | Passwords stored only as bcrypt hashes; a signed, httpOnly cookie carries the role; the second factor arrives on the same WhatsApp the business already uses. Database roles enforce the same permissions a second time. | NextAuth: more setup for a two-step username + OTP flow. |
| Messaging | **WhatsApp Business Cloud API** | Indian small businesses and their customers already live on WhatsApp; template messages are the approved way to send bills, updates and OTPs. Demo mode logs instead of sending, so the project runs without a Meta account. | SMS (cost per message, lower open rates), email (rarely read by these customers). |
| Local run | **embedded-postgres + mongodb-memory-server** | `npm run dev` starts both databases with no installation, so any team member's laptop can run the demo. Real installations can be used instead (`USE_EMBEDDED_DB=false`). | Docker Compose: needs Docker installed and running. |

## Which data goes where

| Data | Store | Reason |
| --- | --- | --- |
| Users, branches, customers, vendors | PostgreSQL | Referenced by foreign keys everywhere |
| Products, categories (tree), stock, low-stock alerts | PostgreSQL | Stock must change in the same transaction as the sale |
| Orders, order items, invoices, customer payments | PostgreSQL | Money: ACID + triggers + procedures |
| Purchases, purchase items, vendor payments | PostgreSQL | Vendor balance must be exact (`fn_vendor_balance`) |
| WhatsApp messages and their delivery status | MongoDB `notification_logs` | Varying payloads, high volume, status updated later by webhook |
| Login OTP sessions | MongoDB `otp_sessions` | Short-lived; a TTL index deletes them after 5 minutes |
| Product embeddings | MongoDB `product_vectors` | 256-number arrays for similarity search |

The two stores are linked by reference: every MongoDB log document carries `ref: { table, id }` pointing at the PostgreSQL row it is about (for example `invoices#3`).
