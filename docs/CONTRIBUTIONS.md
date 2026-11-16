# Team and Individual Contributions

| SRN | Name | Owns (modules / files) | Deliverables they demo |
| --- | --- | --- | --- |
| PES1UG24CS138 | Darshan GS | PostgreSQL: `db/postgres/01_ddl.sql`, `02_plpgsql.sql`, `03_dml.sql`, `04_queries.sql`, `05_dcl.sql`; `docs/er-diagram.*`, `docs/RELATIONAL_SCHEMA.md`; `app/admin/reports`, `app/admin/security`, `workers/lowStockListener.js` | 1 ER diagram · 2 Relational schema · 3 DDL · 6 DML · 7 Queries · 8 Procedures, triggers, CTEs · 12 RBAC in the database |
| PES1UG24CS143 | Deepak B | MongoDB and app: `db/mongo/*`, `lib/notify.js`, `lib/whatsapp.js`, `lib/vectors.js`, `lib/auth.js`, `lib/otp.js`, `middleware.js`, `app/(auth)`, `app/api/*`, billing / orders / invoices / vendors screens | 4 NoSQL / vector creation · 9 NoSQL features and RUD · 10 Next.js interface · 11 API and DB integration · 12 Login and roles in the app |
| Both | | `README.md`, `docs/TECH_JUSTIFICATION.md`, `docs/DEMO_GUIDE.md`, `docs/VIVA_PREP.md` | 5 Technology justification · 13 Documentation and Git · 14 Viva |

This is a suggested split. Change it to match who actually did what: each member must be able to explain, and live-modify, the files in their row, and their commits on GitHub should show the same split.

## Working with Git as a team

```bash
git clone https://github.com/darshan011006/billing-vendor-system.git
cd billing-vendor-system
npm install
npm run dev                                 # first run sets up both databases

git pull                                    # get the other member's latest work
git checkout -b feature/<what-you-change>   # one branch per change
# …edit, test with npm run dev…
git add -A
git commit -m "Add <what> to <where>"
git push -u origin feature/<what-you-change>
# open a Pull Request on GitHub; the other member reviews and merges
```

The repository owner (Darshan) adds Deepak under **Settings → Collaborators** so he can push.

**On Windows:** install [Git for Windows](https://git-scm.com/download/win) (or use [GitHub Desktop](https://desktop.github.com) for clone / commit / push without the command line), then run the same commands in *Git Bash* or *Command Prompt*. To start the app, double-click `Start BillDesk.bat`.
