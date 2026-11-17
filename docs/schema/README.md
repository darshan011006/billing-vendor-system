# Relational schema diagram source

Generated straight from `db/postgres/01_ddl.sql`, so it always matches the real tables.

```bash
cd docs/schema
python3 gen_schema.py ../../db/postgres/01_ddl.sql schema.dot   # relations, keys, foreign keys
python3 pack.py schema.dot packed.dot                           # compact row layout
neato -n2 -Tpng -Gdpi=150 packed.dot -o ../schema-diagram.png
neato -n2 -Tsvg packed.dot -o ../schema-diagram.svg
```

Needs Python 3 and Graphviz.
