"""Relational schema diagram (Navathe style) generated from db/postgres/01_ddl.sql.

Each relation is drawn as its name above one row of attribute cells.
Primary-key attributes are underlined, foreign keys are shaded, and every
foreign key has an arrow to the primary key it references.

    python3 gen_schema.py ../../db/postgres/01_ddl.sql schema.dot
    dot -Tpng -Gdpi=150 schema.dot -o ../schema-diagram.png
"""
import re
import sys

ddl = open(sys.argv[1]).read()
ddl = re.sub(r'--[^\n]*', '', ddl)

tables = {}   # name -> {'cols': [...], 'pk': set(), 'fk': {col: (table, col)}, 'unique': set(), 'notnull': set()}
for m in re.finditer(r'CREATE TABLE (\w+)\s*\((.*?)\n\);', ddl, re.S):
    name, body = m.group(1), m.group(2)
    t = {'cols': [], 'pk': set(), 'fk': {}, 'unique': set(), 'notnull': set(), 'generated': set()}
    # split on commas at paren depth 0
    parts, depth, cur = [], 0, ''
    for ch in body:
        if ch == '(':
            depth += 1
        elif ch == ')':
            depth -= 1
        if ch == ',' and depth == 0:
            parts.append(cur); cur = ''
        else:
            cur += ch
    parts.append(cur)
    for p in (x.strip() for x in parts):
        if not p:
            continue
        up = p.upper()
        if up.startswith('PRIMARY KEY'):
            t['pk'] |= {c.strip() for c in re.search(r'\((.*)\)', p).group(1).split(',')}
        elif up.startswith('UNIQUE') or up.startswith('CHECK'):
            continue
        else:
            col = p.split()[0]
            t['cols'].append(col)
            if 'PRIMARY KEY' in up:
                t['pk'].add(col)
            if re.search(r'\bUNIQUE\b', up):
                t['unique'].add(col)
            if 'NOT NULL' in up or 'PRIMARY KEY' in up:
                t['notnull'].add(col)
            if 'GENERATED' in up:
                t['generated'].add(col)
            r = re.search(r'REFERENCES (\w+)\((\w+)\)', p)
            if r:
                t['fk'][col] = (r.group(1), r.group(2))
    tables[name] = t

n_fk = sum(len(t['fk']) for t in tables.values())
print(len(tables), 'tables,', n_fk, 'foreign keys', file=sys.stderr)


def esc(s):
    return s.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')


PK_BG, FK_BG, PKFK_BG, CELL_BG = '#cfe0fc', '#fdebc8', '#d9ecd0', '#ffffff'
L = ['digraph schema {',
     '  graph [rankdir=TB, splines=spline, nodesep=0.35, ranksep=0.9, newrank=true, pad=0.5, bgcolor=white,',
     '         fontname="Helvetica", fontsize=26, labelloc=t,',
     '         label=<<B>Billing &amp; Vendor Management System — Relational Schema Diagram</B><BR/><FONT POINT-SIZE="15">16 relations · 24 foreign keys · PostgreSQL 16</FONT><BR/> >];',
     '  node [shape=plaintext, fontname="Helvetica"];',
     '  edge [color="#33415c", penwidth=1.3, arrowsize=0.8, arrowhead=normal];']
for name, t in tables.items():
    cells = []
    for c in t['cols']:
        is_pk, is_fk = c in t['pk'], c in t['fk']
        bg = PKFK_BG if (is_pk and is_fk) else PK_BG if is_pk else FK_BG if is_fk else CELL_BG
        txt = esc(c)
        if is_pk:
            txt = f'<B><U>{txt}</U></B>'
        elif is_fk:
            txt = f'<I>{txt}</I>'
        if c in t['generated']:
            txt += '<FONT POINT-SIZE="9"> (gen)</FONT>'
        cells.append(f'<TD PORT="{c}" BGCOLOR="{bg}" CELLPADDING="5">{txt}</TD>')
    # the name sits above the non-key columns, so arrows into the primary key never cross it
    lead = 0
    while t['cols'][lead] in t['pk']:
        lead += 1
    label = (f'<<TABLE BORDER="0" CELLBORDER="1" CELLSPACING="0" COLOR="#555555">'
             f'<TR><TD COLSPAN="{lead}" BORDER="0"></TD><TD COLSPAN="{len(cells) - lead}" BORDER="0" ALIGN="LEFT" CELLPADDING="3"><B><FONT POINT-SIZE="15" COLOR="#1d3a73">{name.upper()}</FONT></B></TD></TR>'
             f'<TR>{"".join(cells)}</TR></TABLE>>')
    L.append(f'  "{name}" [label={label}, fontsize=12];')

# rows of the drawing (top to bottom); every foreign key points to a lower row
ROWS = [
    ['customer_payments', 'vendor_payments'],
    ['invoices', 'order_items', 'purchase_items'],
    ['orders', 'purchases', 'stock', 'low_stock_alerts'],
    ['customers', 'vendors', 'products'],
    ['users', 'invoice_sequences', 'categories'],
    ['branches'],
]
for i, row in enumerate(ROWS):
    L.append('  { rank=same; ' + ' '.join(f'"{n}";' for n in row) + ' }')
    if i + 1 < len(ROWS):   # keeps the rows in this order
        L.append(f'  "{row[0]}" -> "{ROWS[i + 1][0]}" [style=invis, weight=0];')
# one colour per referenced table, so each arrow can be followed to its target
PALETTE = ['#1f77b4', '#d62728', '#2ca02c', '#9467bd', '#e377c2', '#8c564b', '#ff7f0e', '#17becf', '#7f7f7f', '#bcbd22']
targets = sorted({rt for t in tables.values() for rt, _ in t['fk'].values()})
colour = {rt: PALETTE[i % len(PALETTE)] for i, rt in enumerate(targets)}
for name, t in tables.items():
    for col, (rt, rc) in t['fk'].items():
        if rt == name:   # self reference: loop under the table
            L.append(f'  "{name}":"{col}":s -> "{rt}":"{rc}":s [color="{colour[rt]}", constraint=false];')
        else:
            L.append(f'  "{name}":"{col}":s -> "{rt}":"{rc}":n [color="{colour[rt]}"];')

# legend
L.append('  legend [label=<<TABLE BORDER="1" CELLBORDER="0" CELLSPACING="4" CELLPADDING="4" COLOR="#777777">'
         '<TR><TD COLSPAN="2" ALIGN="LEFT"><B>Legend</B></TD></TR>'
         f'<TR><TD BORDER="1" BGCOLOR="{PK_BG}"><B><U>attr</U></B></TD><TD ALIGN="LEFT">Primary key</TD></TR>'
         f'<TR><TD BORDER="1" BGCOLOR="{FK_BG}"><I>attr</I></TD><TD ALIGN="LEFT">Foreign key</TD></TR>'
         f'<TR><TD BORDER="1" BGCOLOR="{PKFK_BG}"><B><U>attr</U></B></TD><TD ALIGN="LEFT">Part of the primary key and a foreign key</TD></TR>'
         '<TR><TD>──▶</TD><TD ALIGN="LEFT">Foreign key → the primary key it references<BR ALIGN="LEFT"/>(arrows into the same table share a colour)</TD></TR>'
         '<TR><TD><FONT POINT-SIZE="9">(gen)</FONT></TD><TD ALIGN="LEFT">Generated (derived) column</TD></TR>'
         '</TABLE>>, fontsize=12];')
L.append('}')
open(sys.argv[2], 'w').write('\n'.join(L))
