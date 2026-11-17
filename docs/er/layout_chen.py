"""Two-phase Chen ER layout.
Phase 1: Graphviz neato lays out only entities + relationship diamonds (tries many seeds,
         keeps the one with the fewest crossings).
Phase 2: each entity's attributes are fanned out in the widest angular gap between its
         relationship lines (two staggered rings), so no attribute sits on a relationship line.
         The skeleton is spread apart until no two shapes overlap.
Output: a fully positioned DOT file rendered with `neato -n2`.
"""
import math, subprocess, sys, itertools, importlib.util

spec = importlib.util.spec_from_file_location('g', sys.argv[1])
g = importlib.util.module_from_spec(spec)
sys.argv_backup = sys.argv
sys.argv = ['x', '/dev/null']
spec.loader.exec_module(g)          # reuses the E (entities) and R (relationships) tables
sys.argv = sys.argv_backup
E, R = g.E, g.R
OUT = sys.argv[2]
SEEDS = int(sys.argv[3]) if len(sys.argv) > 3 else 60
import os
ROOM0=float(os.environ.get('ROOM0',0.8)); ROOMK=float(os.environ.get('ROOMK',0.2)); SEP=os.environ.get('SEP','+25')

# ---------- sizes (inches) ----------
def ent_size(n):  return (max(1.7, len(n) * 0.13 + 0.5), 0.55)
def rel_size(n):  return (max(1.7, len(n) * 0.11 + 0.9), 0.8)
def att_size(a, kind):
    extra = 0.45 if kind == 'pkey' else 0
    return (len(a) * 0.088 + 0.45 + extra, 0.42)

# ---------- phase 1: skeleton ----------
def skeleton(seed):
    lines = ['graph S { graph [model=subset, overlap=prism, sep="'+SEP+'"]; node [shape=box, fixedsize=true];']
    for e in E:
        w, h = ent_size(e); k = len(E[e][1]); room = ROOM0 + ROOMK * k
        lines.append(f'"{e}" [width={w+room}, height={h+room*0.8}];')   # room for attributes
    for r in R:
        w, h = rel_size(r[0]); lines.append(f'"{r[0]}" [width={w}, height={h}];')
    for name, ident, (a, *_), (b, *_), rattrs in R:
        lines.append(f'"{name}" -- "{a}" [len=1.6]; "{name}" -- "{b}" [len=1.6];')
    lines.append('}')
    out = subprocess.run(['neato', f'-Gstart={seed}', '-Tplain'], input='\n'.join(lines), capture_output=True, text=True).stdout
    pos = {}
    for ln in out.splitlines():
        p = ln.split()
        if p and p[0] == 'node':
            pos[p[1].strip('"')] = (float(p[2]), float(p[3]))
    return pos

def crosses(a, b, c, d):
    def ccw(p, q, r): return (r[1]-p[1])*(q[0]-p[0]) - (q[1]-p[1])*(r[0]-p[0])
    return ccw(c, d, a)*ccw(c, d, b) < 0 and ccw(a, b, c)*ccw(a, b, d) < 0

def skel_edges(pos):
    out = []
    for name, ident, (a, *_), (b, *_), _ in R:
        if a != b:
            out += [(name, a), (name, b)]
    return out

def n_cross(pos):
    segs = skel_edges(pos)
    return sum(1 for (u1, v1), (u2, v2) in itertools.combinations(segs, 2)
               if len({u1, v1, u2, v2}) == 4 and crosses(pos[u1], pos[v1], pos[u2], pos[v2]))

base=None
# ---------- phase 2: attributes ----------
def fan(center, conn_angles, items, r0):
    """Spread attributes over every gap between relationship lines (bigger gaps get more),
    keeping a margin from each line. Two staggered rings when crowded."""
    n = len(items)
    if conn_angles:
        angs = sorted(a % (2*math.pi) for a in conn_angles)
        gaps = []
        for i in range(len(angs)):
            size = (angs[(i+1) % len(angs)] - angs[i]) % (2*math.pi) or 2*math.pi
            margin = min(math.radians(24), size * 0.22)
            if size - 2*margin > math.radians(25):
                gaps.append([angs[i] + margin, size - 2*margin])
        if not gaps:
            gaps = [[angs[0] + 0.3, 2*math.pi - 0.6]]
    else:
        gaps = [[math.pi/2, 2*math.pi]]
    total = sum(gw for _, gw in gaps)
    raw = [n * gw / total for _, gw in gaps]
    cnt = [int(x) for x in raw]
    for i in sorted(range(len(raw)), key=lambda i: raw[i] - cnt[i], reverse=True)[: n - sum(cnt)]:
        cnt[i] += 1
    angles = []
    for (a0, gw), c in zip(gaps, cnt):
        angles += [a0 + gw * (k + 0.5) / c for k in range(c)]
    angles.sort()
    out = {}
    for i, ((nid, w, h), t) in enumerate(zip(items, angles)):
        rr = r0 + (0.5 if (i % 2 and n > 5) else 0)
        rr += abs(math.cos(t)) * max(0, w / 2 - 0.45)
        out[nid] = (center[0] + rr * math.cos(t), center[1] + rr * math.sin(t))
    return out

PO_ANGLE=[0.0]
def build(scale):
    pos = {k: (x * scale, y * scale) for k, (x, y) in base.items()}
    size = {e: ent_size(e) for e in E}
    size.update({r[0]: rel_size(r[0]) for r in R})
    conns = {k: [] for k in pos}
    for name, a in skel_edges(pos):
        (x1, y1), (x2, y2) = pos[name], pos[a]
        conns[a].append(math.atan2(y1 - y2, x1 - x2))
        conns[name].append(math.atan2(y2 - y1, x2 - x1))
    # recursive PARENT_OF: diamond on the free axis (right/up/left/down) of CATEGORY
    cx, cy = pos['CATEGORY']
    def clearance(t):
        return min([abs(math.atan2(math.sin(t - a), math.cos(t - a))) for a in conns['CATEGORY']] or [math.pi])
    t = max([0, math.pi/2, math.pi, -math.pi/2], key=clearance)
    d = 2.7 if abs(math.cos(t)) > 0.5 else 1.9
    pos['PARENT_OF'] = (cx + d * math.cos(t), cy + d * math.sin(t))
    conns['CATEGORY'] += [t - 0.45, t, t + 0.45]
    PO_ANGLE[0] = t
    for e, (weak, attrs) in E.items():
        items = []
        for a, kind in attrs:
            w, h = att_size(a, kind); size[f'{e}.{a}'] = (w, h); items.append((f'{e}.{a}', w, h))
        r0 = 1.25
        while True:
            placed = fan(pos[e], conns[e], items, r0)
            sub_pos = dict(placed); sub_pos[e] = pos[e]
            sub_size = {k: size[k] for k in placed}; sub_size[e] = size[e]
            if overlaps(sub_pos, sub_size, pad=0.08) == 0 or r0 > 6:
                break
            r0 += 0.1
        pos.update(placed)
    for name, ident, _, _, rattrs in R:
        items = []
        for a in rattrs:
            w, h = att_size(a, 'plain'); size[f'{name}.{a}'] = (w, h); items.append((f'{name}.{a}', w, h))
        if items:
            pos.update(fan(pos[name], conns[name], items, 1.2))
    return pos, size

def group_of(k):
    return k.split('.')[0]

def overlaps(pos, size, pad=0.12, between_groups=False):
    keys = list(pos); n = 0
    for a, b in itertools.combinations(keys, 2):
        if between_groups and group_of(a) == group_of(b):
            continue
        (x1, y1), (w1, h1) = pos[a], size[a]
        (x2, y2), (w2, h2) = pos[b], size[b]
        if abs(x1 - x2) < (w1 + w2) / 2 + pad and abs(y1 - y2) < (h1 + h2) / 2 + pad:
            n += 1
    return n

def all_segs():
    segs = [(name, a) for name, a in skel_edges(None)]
    for e, (_, attrs) in E.items():
        segs += [(e, f'{e}.{a}') for a, _ in attrs]
    for name, _, _, _, rattrs in R:
        segs += [(name, f'{name}.{a}') for a in rattrs]
    return segs

def seg_crossings(pos):
    segs = all_segs(); n = 0
    for (u1, v1), (u2, v2) in itertools.combinations(segs, 2):
        if len({u1, v1, u2, v2}) == 4 and crosses(pos[u1], pos[v1], pos[u2], pos[v2]):
            n += 1
    return n

def line_hits(pos, size):
    """relationship/attribute lines that pass over some other shape"""
    segs = all_segs()
    hits = 0
    for u, v in segs:
        (x1, y1), (x2, y2) = pos[u], pos[v]
        for k, (x, y) in pos.items():
            if k in (u, v): continue
            w, h = size[k]
            for i in range(1, 30):
                t = i / 30; px, py = x1 + (x2-x1)*t, y1 + (y2-y1)*t
                if abs(px - x) < w/2*0.85 and abs(py - y) < h/2*0.85:
                    hits += 1; break
    return hits

def bbox_area(pos, size):
    xs=[pos[k][0]-size[k][0]/2 for k in pos]+[pos[k][0]+size[k][0]/2 for k in pos]
    ys=[pos[k][1]-size[k][1]/2 for k in pos]+[pos[k][1]+size[k][1]/2 for k in pos]
    return (max(xs)-min(xs))*(max(ys)-min(ys)), (max(xs)-min(xs))/(max(ys)-min(ys))

def evaluate(seed):
    global base
    base = skeleton(seed)
    cr = n_cross(base)
    sc = 0.5
    while sc < 2.0:
        p_, s_ = build(sc)
        if overlaps(p_, s_, pad=0.15, between_groups=True) == 0:
            break
        sc += 0.05
    lh = line_hits(p_, s_)
    xc = seg_crossings(p_)
    area, ar = bbox_area(p_, s_)
    score = xc * 25 + lh * 120 + area / 10 + 30 * max(0, abs(math.log(ar / 1.3)) - 0.15)
    return score, xc, lh, round(area), round(ar, 2), round(sc, 2)

_seed = os.environ.get('SEED')
if _seed:
    seed = int(_seed)
else:
    res = sorted((evaluate(sd), sd) for sd in range(1, SEEDS + 1))
    for r, sd in res[:8]: print('seed', sd, 'score/cross/hits/area/aspect/scale', r)
    seed = res[0][1]
r = evaluate(seed); scale = r[5]
pos, size = build(scale)
ov = overlaps(pos, size, pad=0.15, between_groups=True)
print('chosen seed', seed, r)
print('inside-fan overlaps', overlaps(pos, size) - overlaps(pos, size, between_groups=True))
print(f'scale {scale:.2f}  overlaps {ov}  lines over shapes {line_hits(pos, size)}')

# ---------- write positioned DOT ----------
def esc(s): return s.replace('&', '&amp;').replace('<', '&lt;')
def label(a, kind):
    if kind == 'key': return f'<<U>{esc(a)}</U>>'
    if kind == 'pkey': return f'<<U>{esc(a)}</U><FONT POINT-SIZE="8"> (partial key)</FONT>>'
    return f'"{a}"'
P = lambda k: f'{pos[k][0]*72:.1f},{pos[k][1]*72:.1f}!'
L = ['graph ER {',
     '  graph [splines=line, outputorder=edgesfirst, bgcolor=white, pad=0.5, fontname="Helvetica", fontsize=28, labelloc=t,',
     '         label=<<B>Billing &amp; Vendor Management System — ER Diagram (Chen notation)</B><BR/> >];',
     '  node [fontname="Helvetica", fontsize=12, style=filled, penwidth=1.4];',
     '  edge [fontname="Helvetica", fontsize=14, penwidth=1.2];']
for e, (weak, attrs) in E.items():
    w, h = ent_size(e)
    L.append(f'  "{e}" [shape=box, label=<<B>{e}</B>>, fontsize=14, fillcolor="#dfe8fb", pos="{P(e)}", width={w}, height={h}, fixedsize=true{", peripheries=2" if weak else ""}];')
    for a, kind in attrs:
        nid = f'{e}.{a}'
        L.append(f'  "{nid}" [shape=ellipse, label={label(a, kind)}, style="{"filled,dashed" if kind == "derived" else "filled"}", fillcolor="#fffbea", pos="{P(nid)}", margin="0.05,0.02"];')
        L.append(f'  "{e}" -- "{nid}";')
for name, ident, (a, ca, ta), (b, cb, tb), rattrs in R:
    w, h = rel_size(name)
    L.append(f'  "{name}" [shape=diamond, label=<<B>{name.replace("_", " ")}</B>>, fontsize=11, fillcolor="#fde4e1", pos="{P(name)}", width={w}, height={h}, fixedsize=true{", peripheries=2" if ident else ""}];')
    for ent, card, total in ((a, ca, ta), (b, cb, tb)):
        role = ''
        ports = ''
        color = '"black:invis:black"' if total else 'black'
        if name == 'PARENT_OF':
            t = PO_ANGLE[0]
            if abs(math.cos(t)) > 0.5:
                side = 'e' if math.cos(t) > 0 else 'w'
                tp, hp = ('n', 'n' + side) if card == '1' else ('s', 's' + side)
            else:
                side = 'n' if math.sin(t) > 0 else 's'
                tp, hp = ('w', side + 'w') if card == '1' else ('e', side + 'e')
            role = ' (parent)' if card == '1' else ' (child)'
            L.append(f'  "{name}" -- "{ent}" [color={color}, penwidth=1.4, tailport={tp}, headport={hp}, label=<<B>{card}</B>{role}>, fontsize=12];')
            continue
        L.append(f'  "{name}" -- "{ent}" [color={color}, penwidth=1.4, headlabel=<<B>{card}</B>>, labeldistance=2.0, labelangle=28];')
    for ra in rattrs:
        nid = f'{name}.{ra}'
        L.append(f'  "{nid}" [shape=ellipse, label="{ra}", fillcolor="#fffbea", pos="{P(nid)}", margin="0.05,0.02"];')
        L.append(f'  "{name}" -- "{nid}";')
# ---------- legend ----------
def seg_rect(p, q, r):
    x0, y0, x1, y1 = r
    for i in range(41):
        t = i / 40; x = p[0] + (q[0]-p[0])*t; y = p[1] + (q[1]-p[1])*t
        if x0 <= x <= x1 and y0 <= y <= y1: return True
    return False

LW, LH = 8.9, 4.4
xs = [pos[k][0] - size[k][0]/2 for k in pos] + [pos[k][0] + size[k][0]/2 for k in pos]
ys = [pos[k][1] - size[k][1]/2 for k in pos] + [pos[k][1] + size[k][1]/2 for k in pos]
X0, X1, Y0, Y1 = min(xs), max(xs), min(ys), max(ys)
segs_xy = [(pos[u], pos[v]) for u, v in all_segs()] + [(pos['PARENT_OF'], pos['CATEGORY'])]

def free(r):
    x0, y0, x1, y1 = r
    for k in pos:
        (x, y), (w, h) = pos[k], size[k]
        if x + w/2 > x0 - 0.2 and x - w/2 < x1 + 0.2 and y + h/2 > y0 - 0.2 and y - h/2 < y1 + 0.2:
            return False
    return not any(seg_rect(p, q, (x0-0.1, y0-0.1, x1+0.1, y1+0.1)) for p, q in segs_xy)

cands = []
yy = Y0
while yy + LH <= Y1:
    xx = X0
    while xx + LW <= X1:
        cands.append((xx, yy)); xx += 0.25
    yy += 0.25
corners = [(X0, Y0), (X1 - LW, Y0), (X0, Y1 - LH), (X1 - LW, Y1 - LH)]
cands.sort(key=lambda c: min(abs(c[0]-a) + abs(c[1]-b) for a, b in corners))
spot = next((c for c in cands if free((c[0], c[1], c[0] + LW, c[1] + LH))), None)
if spot is None:
    spot = ((X0 + X1) / 2 - LW / 2, Y0 - LH - 0.6)
print('legend at', spot, 'inside' if spot[1] >= Y0 else 'below')
lx, ly = spot

def LP(x, y):
    return f'{(lx + x)*72:.1f},{(ly + y)*72:.1f}!'

L.append(f'  "lg_frame" [shape=box, style="rounded", color="#777777", penwidth=1.2, label="", pos="{LP(LW/2, LH/2)}", width={LW}, height={LH}, fixedsize=true];')
L.append(f'  "lg_title" [shape=plaintext, style="", label=<<B>Notation</B>>, fontsize=16, pos="{LP(LW/2, LH-0.32)}"];')
rows = [
    ('box', 'ENTITY', 'Strong entity'),
    ('box2', 'ENTITY', 'Weak entity'),
    ('diamond', 'REL', 'Relationship'),
    ('diamond2', 'REL', 'Identifying relationship'),
    ('ellipse', 'attribute', 'Attribute'),
    ('key', 'key', 'Key attribute'),
    ('pkey', 'line_no', 'Partial key (weak entity)'),
    ('derived', 'derived', 'Derived attribute'),
    ('single', '', 'Partial participation'),
    ('double', '', 'Total participation'),
    ('card', '', 'Cardinality (1:1, 1:N, M:N)'),
]
col_w = LW / 2
for i, (kind, sym, text) in enumerate(rows):
    col, row = (0, i) if i < 6 else (1, i - 6)
    x = col * col_w + 0.95
    y = LH - 0.9 - row * 0.6
    nid = f'lg_{i}'
    at = f'pos="{LP(x, y)}"'
    if kind in ('box', 'box2'):
        L.append(f'  "{nid}" [shape=box, {"peripheries=2, " if kind == "box2" else ""}label=<<B>{sym}</B>>, fillcolor="#dfe8fb", width=1.25, height=0.4, fixedsize=true, fontsize=10, {at}];')
    elif kind in ('diamond', 'diamond2'):
        L.append(f'  "{nid}" [shape=diamond, {"peripheries=2, " if kind == "diamond2" else ""}label=<<B>{sym}</B>>, fillcolor="#fde4e1", width=1.25, height=0.5, fixedsize=true, fontsize=9, {at}];')
    elif kind == 'ellipse':
        L.append(f'  "{nid}" [shape=ellipse, label="{sym}", fillcolor="#fffbea", fontsize=11, {at}];')
    elif kind == 'key':
        L.append(f'  "{nid}" [shape=ellipse, label=<<U>{sym}</U>>, fillcolor="#fffbea", fontsize=11, {at}];')
    elif kind == 'pkey':
        L.append(f'  "{nid}" [shape=ellipse, label=<<U>{sym}</U><FONT POINT-SIZE="8"> (partial key)</FONT>>, fillcolor="#fffbea", fontsize=11, {at}];')
    elif kind == 'derived':
        L.append(f'  "{nid}" [shape=ellipse, style="filled,dashed", label="{sym}", fillcolor="#fffbea", fontsize=11, {at}];')
    elif kind in ('single', 'double'):
        L.append(f'  "{nid}a" [shape=point, width=0.02, pos="{LP(x-0.6, y)}"]; "{nid}b" [shape=point, width=0.02, pos="{LP(x+0.6, y)}"];')
        L.append(f'  "{nid}a" -- "{nid}b" [color={chr(34)}black:invis:black{chr(34) if kind == "double" else ""}{"" if kind == "double" else ""}, penwidth=1.4];' if kind == 'double'
                 else f'  "{nid}a" -- "{nid}b" [color=black, penwidth=1.4];')
    elif kind == 'card':
        L.append(f'  "{nid}" [shape=plaintext, style="", label=<<B>1    N    M</B>>, fontsize=14, {at}];')
    L.append(f'  "{nid}t" [shape=plaintext, style="", margin=0, label=<<TABLE BORDER="0" CELLPADDING="0" FIXEDSIZE="TRUE" WIDTH="195" HEIGHT="20"><TR><TD ALIGN="LEFT">{text}</TD></TR></TABLE>>, fontsize=13, pos="{LP(x + 1.0 + 195/72/2, y)}"];')
L.append('}')
open(OUT, 'w').write('\n'.join(L))
