"""Generate a Chen-notation ER diagram (Graphviz neato) for the Billing & Vendor system.

Notation:
  rectangle            strong entity        double rectangle   weak entity
  diamond              relationship         double diamond     identifying relationship
  oval                 attribute            underlined         key attribute
  dashed underline     partial key          dashed oval        derived attribute
  single line          partial participation
  double line          total participation  (labels 1 / N / M = cardinality)
Foreign keys are not drawn as attributes: in Chen notation they are the relationships.
"""
import sys

# entity name -> (weak?, [ (attribute, kind) ])  kind: key | pkey (partial key) | derived | plain
E = {
    'BRANCH': (False, [('branch_id', 'key'), ('code', 'plain'), ('name', 'plain'), ('gstin', 'plain'), ('phone', 'plain'), ('address', 'plain')]),
    'USER': (False, [('user_id', 'key'), ('username', 'plain'), ('full_name', 'plain'), ('whatsapp_no', 'plain'), ('password_hash', 'plain'), ('role', 'plain'), ('is_active', 'plain'), ('created_at', 'plain')]),
    'CUSTOMER': (False, [('customer_id', 'key'), ('name', 'plain'), ('whatsapp_no', 'plain'), ('email', 'plain'), ('gstin', 'plain'), ('customer_type', 'plain'), ('credit_limit', 'plain')]),
    'CATEGORY': (False, [('category_id', 'key'), ('name', 'plain')]),
    'PRODUCT': (False, [('product_id', 'key'), ('sku', 'plain'), ('barcode', 'plain'), ('name', 'plain'), ('hsn_code', 'plain'), ('gst_rate', 'plain'), ('unit', 'plain'), ('cost_price', 'plain'), ('selling_price', 'plain'), ('mrp', 'plain'), ('low_stock_threshold', 'plain')]),
    'LOW_STOCK_ALERT': (False, [('alert_id', 'key'), ('quantity', 'plain'), ('threshold', 'plain'), ('status', 'plain'), ('created_at', 'plain')]),
    'ORDER': (False, [('order_id', 'key'), ('order_date', 'plain'), ('status', 'plain')]),
    'ORDER_ITEM': (True, [('line_no', 'pkey'), ('quantity', 'plain'), ('unit_price', 'plain'), ('discount', 'plain'), ('gst_rate', 'plain'), ('line_total', 'derived')]),
    'INVOICE': (False, [('invoice_id', 'key'), ('invoice_no', 'plain'), ('invoice_date', 'plain'), ('taxable_value', 'plain'), ('cgst', 'plain'), ('sgst', 'plain'), ('total_amount', 'plain'), ('amount_paid', 'derived'), ('status', 'plain')]),
    'INVOICE_SEQUENCE': (True, [('fiscal_year', 'pkey'), ('last_seq', 'plain')]),
    'CUSTOMER_PAYMENT': (False, [('payment_id', 'key'), ('amount', 'plain'), ('mode', 'plain'), ('reference_no', 'plain'), ('paid_at', 'plain')]),
    'VENDOR': (False, [('vendor_id', 'key'), ('name', 'plain'), ('gstin', 'plain'), ('contact_person', 'plain'), ('whatsapp_no', 'plain'), ('email', 'plain'), ('opening_balance', 'plain')]),
    'PURCHASE': (False, [('purchase_id', 'key'), ('vendor_invoice_no', 'plain'), ('purchase_date', 'plain'), ('total_amount', 'derived'), ('paid_amount', 'derived'), ('status', 'plain')]),
    'PURCHASE_ITEM': (True, [('line_no', 'pkey'), ('quantity', 'plain'), ('unit_cost', 'plain'), ('gst_rate', 'plain')]),
    'VENDOR_PAYMENT': (False, [('vendor_payment_id', 'key'), ('amount', 'plain'), ('mode', 'plain'), ('reference_no', 'plain'), ('payment_date', 'plain')]),
}

# relationship: (name, identifying?, (entityA, cardA, totalA), (entityB, cardB, totalB), [relationship attributes])
# totalX = True when every X takes part (double line between X and the diamond)
R = [
    ('EMPLOYS', False, ('BRANCH', '1', False), ('USER', 'N', False), []),
    ('LOGS_IN_AS', False, ('USER', '1', False), ('CUSTOMER', '1', False), []),
    ('PARENT_OF', False, ('CATEGORY', '1', False), ('CATEGORY', 'N', False), []),
    ('BELONGS_TO', False, ('PRODUCT', 'N', False), ('CATEGORY', '1', False), []),
    ('STOCKED_AT', False, ('PRODUCT', 'M', False), ('BRANCH', 'N', False), ['quantity', 'updated_at']),
    ('ALERT_ON', False, ('LOW_STOCK_ALERT', 'N', True), ('PRODUCT', '1', False), []),
    ('ALERT_AT', False, ('LOW_STOCK_ALERT', 'N', True), ('BRANCH', '1', False), []),
    ('PLACES', False, ('CUSTOMER', '1', False), ('ORDER', 'N', True), []),
    ('TAKES', False, ('BRANCH', '1', False), ('ORDER', 'N', True), []),
    ('CREATES', False, ('USER', '1', False), ('ORDER', 'N', True), []),
    ('CONTAINS', True, ('ORDER', '1', True), ('ORDER_ITEM', 'N', True), []),
    ('SOLD_AS', False, ('ORDER_ITEM', 'N', True), ('PRODUCT', '1', False), []),
    ('BILLED_AS', False, ('ORDER', '1', False), ('INVOICE', '1', True), []),
    ('SETTLES', False, ('CUSTOMER_PAYMENT', 'N', True), ('INVOICE', '1', False), []),
    ('RECEIVES', False, ('USER', '1', False), ('CUSTOMER_PAYMENT', 'N', False), []),
    ('NUMBERS', True, ('BRANCH', '1', False), ('INVOICE_SEQUENCE', 'N', True), []),
    ('SUPPLIES', False, ('VENDOR', '1', False), ('PURCHASE', 'N', True), []),
    ('RECEIVED_AT', False, ('BRANCH', '1', False), ('PURCHASE', 'N', True), []),
    ('HAS_LINE', True, ('PURCHASE', '1', True), ('PURCHASE_ITEM', 'N', True), []),
    ('BOUGHT_AS', False, ('PURCHASE_ITEM', 'N', True), ('PRODUCT', '1', False), []),
    ('PAID_TO', False, ('VENDOR_PAYMENT', 'N', True), ('VENDOR', '1', False), []),
    ('PAYS_FOR', False, ('VENDOR_PAYMENT', 'N', False), ('PURCHASE', '1', False), []),
    ('PAID_BY', False, ('VENDOR_PAYMENT', 'N', True), ('USER', '1', False), []),
]

# Grid position (column, row) of every entity and relationship; row 0 is the top.
POS = {
    'VENDOR': (0, 0), 'SUPPLIES': (0, 1), 'PURCHASE': (0, 2), 'HAS_LINE': (1, 2), 'PURCHASE_ITEM': (2, 2),
    'PAID_TO': (-1, 1), 'VENDOR_PAYMENT': (-1, 3), 'PAYS_FOR': (-0.5, 2.6), 'PAID_BY': (-1, 4.6),
    'CATEGORY': (3, 0), 'PARENT_OF': (4.1, 0), 'BELONGS_TO': (3, 1), 'PRODUCT': (3, 2), 'BOUGHT_AS': (2.5, 2.9),
    'SOLD_AS': (3.5, 2.9), 'ORDER_ITEM': (4, 2), 'CONTAINS': (5, 2), 'ORDER': (6, 2),
    'CUSTOMER': (6, 0), 'PLACES': (6, 1), 'BILLED_AS': (7, 2), 'INVOICE': (8, 2), 'SETTLES': (8, 3), 'CUSTOMER_PAYMENT': (8, 4.3),
    'STOCKED_AT': (3, 3.4), 'BRANCH': (3, 4.6), 'ALERT_ON': (1.9, 3.4), 'LOW_STOCK_ALERT': (1.4, 4.6), 'ALERT_AT': (2.2, 4.6),
    'RECEIVED_AT': (0.7, 3.6), 'NUMBERS': (3, 5.8), 'INVOICE_SEQUENCE': (3, 6.9),
    'TAKES': (4.6, 3.4), 'EMPLOYS': (4.5, 5.6), 'USER': (6, 5.6), 'CREATES': (6, 3.8), 'LOGS_IN_AS': (7.3, 4.6), 'RECEIVES': (7.3, 5.6),
}
SX, SY = 3.2, 2.7  # inches per grid step


def esc(s):
    return s.replace('&', '&amp;').replace('<', '&lt;')


def label(name, kind):
    if kind == 'key':
        return f'<<U>{esc(name)}</U>>'
    if kind == 'pkey':  # dashed underline is not supported; dotted-looking underline via spacing
        return f'<<U>{esc(name)}</U><FONT POINT-SIZE="8"> (partial)</FONT>>'
    return f'"{name}"'


out = []
w = out.append
w('graph ER {')
w('  graph [layout=neato, model=subset, overlap=prism, sep="+12", splines=line, outputorder=edgesfirst, bgcolor=white, pad=0.4,')
w('         fontname="Helvetica", label=<<B>Billing &amp; Vendor Management System — ER diagram (Chen notation)</B>>, labelloc=t, fontsize=26];')
w('  node [fontname="Helvetica", fontsize=12, style=filled, fillcolor=white, penwidth=1.4];')
w('  edge [fontname="Helvetica", fontsize=13, penwidth=1.2, len=0.9];')

for ent, (weak, attrs) in E.items():
    x, y = POS[ent]
    w(f'  "{ent}" [shape=box, label=<<B>{ent}</B>>, fontsize=14, fillcolor="#e8eefc", '
      f'width=1.9, height=0.55{", peripheries=2" if weak else ""}];')
    for a, kind in attrs:
        nid = f'{ent}.{a}'
        style = 'filled,dashed' if kind == 'derived' else 'filled'
        w(f'  "{nid}" [shape=ellipse, label={label(a, kind)}, style="{style}", fillcolor="#fffdf3", margin="0.04,0.02"];')
        w(f'  "{ent}" -- "{nid}" [len=0.85];')

for name, ident, (a, ca, ta), (b, cb, tb), rattrs in R:
    x, y = POS[name]
    w(f'  "{name}" [shape=diamond, label=<<B>{name.replace("_", " ")}</B>>, fontsize=11, fillcolor="#fde9e7", '
      f'width=1.9, height=0.8{", peripheries=2" if ident else ""}];')
    for ent, card, total in ((a, ca, ta), (b, cb, tb)):
        color = '"black:invis:black"' if total else 'black'
        role = ''
        if name == 'PARENT_OF':
            role = ' (parent)' if card == '1' else ' (child)'
        ports = ''
        if name == 'PARENT_OF':
            ports = ', tailport=w, headport=e' if card == '1' else ', tailport=s, headport=n'
        w(f'  "{name}" -- "{ent}" [color={color}, label=<<B>{card}</B>{role}>, len=2.3, penwidth=1.3{ports}];')
    for ra in rattrs:
        nid = f'{name}.{ra}'
        w(f'  "{nid}" [shape=ellipse, label="{ra}", fillcolor="#fffdf3", margin="0.04,0.02"];')
        w(f'  "{name}" -- "{nid}" [len=0.9];')

w('}')
open(sys.argv[1], 'w').write('\n'.join(out))
print(len(E), 'entities,', len(R), 'relationships,', sum(len(v[1]) for v in E.values()), 'attributes')
