"""Compact the schema diagram: keep dot's left-to-right order inside each row
(it minimises crossings) but pack the tables of each row tightly and centre the
rows, then route the arrows with neato -n2 (splines avoid the tables).

    python3 pack.py schema.dot packed.dot
    neato -n2 -Tpng -Gdpi=150 packed.dot -o schema-diagram.png
"""
import re
import subprocess
import sys

src, out = sys.argv[1], sys.argv[2]
dot = open(src).read()
plain = subprocess.run(['dot', '-Tplain', src], capture_output=True, text=True, check=True).stdout
geo = {}
for ln in plain.splitlines():
    p = ln.split()
    if p[0] == 'node':
        geo[p[1].strip('"')] = (float(p[2]), float(p[3]), float(p[4]), float(p[5]))   # x y w h (inches)

rows = [re.findall(r'"(\w+)";', m) for m in re.findall(r'\{ rank=same; (.*?) \}', dot)]
rows[-1].append('legend')         # legend sits beside the single table of the last row
GAP, ROW_GAP = 0.55, 0.85
pos = {}
y = 0.0
for row in rows:
    row.sort(key=lambda n: geo[n][0])
    total = sum(geo[n][2] for n in row) + GAP * (len(row) - 1)
    x = -total / 2
    h = max(geo[n][3] for n in row)
    for n in row:
        w = geo[n][2]
        pos[n] = (x + w / 2, y - geo[n][3] / 2)          # tops of a row line up
        x += w + GAP
    y -= h + ROW_GAP

lines = []
for ln in dot.splitlines():
    m = re.match(r'  "(\w+)" \[label=', ln) or re.match(r'  (legend) \[label=', ln)
    if m and m.group(1) in pos:
        x, yy = pos[m.group(1)]
        ln = ln.replace('[label=', f'[pos="{x * 72:.1f},{yy * 72:.1f}!", label=', 1)
    if 'style=invis' in ln or 'rank=same' in ln:
        continue
    lines.append(ln)
txt = '\n'.join(lines).replace('splines=spline', 'splines=true, overlap=true')
open(out, 'w').write(txt)
