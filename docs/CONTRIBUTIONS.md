# Team and Individual Contributions

Fill in one row per member before submission. Each member should be able to explain, and live-modify, the files in their row. Their commits on GitHub should show the same split.

| SRN | Name | Owns (modules / files) | Deliverables they will demo |
| --- | --- | --- | --- |
| PES1UG24CS___ | Bhuvan | | |
| PES1UG24CS___ | | | |
| PES1UG24CS___ | | | |
| PES1UG24CS___ | | | |

## Suggested split (four members)

| Area | Files | Rubric items |
| --- | --- | --- |
| Schema, ER, constraints, DML | `db/postgres/01_ddl.sql`, `03_dml.sql`, `docs/er-diagram.*`, `docs/RELATIONAL_SCHEMA.md` | 1, 2, 3, 6 |
| Advanced SQL and queries | `db/postgres/02_plpgsql.sql`, `04_queries.sql`, `app/admin/reports`, `workers/lowStockListener.js` | 7, 8 |
| MongoDB, vectors, WhatsApp | `db/mongo/*`, `lib/notify.js`, `lib/whatsapp.js`, `lib/vectors.js`, `app/admin/notifications`, `app/api/webhooks` | 4, 9 |
| Auth, RBAC, Next.js screens | `db/postgres/05_dcl.sql`, `lib/auth.js`, `lib/db.js`, `middleware.js`, `app/(auth)`, `app/admin/security`, billing screens | 10, 11, 12 |

## Working with Git as a team

```bash
git pull                                  # get everyone's latest work
git checkout -b feature/<what-you-change>  # one branch per change
# …edit, test with npm run dev…
git add -A
git commit -m "Add <what> to <where>"
git push -u origin feature/<what-you-change>
# open a Pull Request on GitHub, a teammate reviews and merges
```
