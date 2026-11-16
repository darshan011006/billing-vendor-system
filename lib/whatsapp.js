// WhatsApp Business Cloud API (Meta). Business-initiated messages must use approved templates.
// With no WA_TOKEN / WA_PHONE_NUMBER_ID set, runs in demo mode: the message is printed in
// the terminal and logged to MongoDB as sent with simulated: true.

const TEMPLATE_TEXT = {
  bill_receipt: (p) => `Hi ${p.customer}, thank you for shopping with us. Your bill ${p.invoiceNo} for Rs ${p.amount} is ready.`,
  order_update: (p) => `Your order #${p.orderId} is now ${String(p.to).toUpperCase()}.`,
  vendor_paid_slip: (p) => `Dear ${p.vendor}, we have paid Rs ${p.amount} by ${String(p.mode).toUpperCase()} (ref ${p.utr || '-'}). Balance due to you: Rs ${p.balanceAfter}.`,
  login_otp: (p) => `${p.code} is your login code. It expires in 5 minutes. Do not share it.`,
  low_stock_alert: (p) => `Low stock: ${p.product} at ${p.branch} is down to ${p.qty} (alert level ${p.threshold}).`,
};

const BODY_PARAMS = {
  bill_receipt: (p) => [p.customer, p.invoiceNo, String(p.amount)],
  order_update: (p) => [String(p.orderId), p.to],
  vendor_paid_slip: (p) => [p.vendor, String(p.amount), p.mode, p.utr || '-', String(p.balanceAfter)],
  login_otp: (p) => [p.code],
  low_stock_alert: (p) => [p.product, p.branch, String(p.qty), String(p.threshold)],
};

export const isDemoMode = () => !(process.env.WA_TOKEN && process.env.WA_PHONE_NUMBER_ID);

export function previewText(template, params) {
  return (TEMPLATE_TEXT[template] || (() => JSON.stringify(params)))(params);
}

export async function sendTemplate({ to, template, params }) {
  if (isDemoMode()) {
    console.log(`\n[WhatsApp demo] to +${to} (${template}): ${previewText(template, params)}\n`);
    return { messageId: `sim-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`, simulated: true };
  }

  const body = {
    messaging_product: 'whatsapp',
    to,
    type: 'template',
    template: {
      name: template,
      language: { code: process.env.WA_LANGUAGE || 'en' },
      components: [{ type: 'body', parameters: (BODY_PARAMS[template] || (() => []))(params).map((text) => ({ type: 'text', text: String(text) })) }],
    },
  };
  if (template === 'login_otp') {
    // Authentication templates also need the code on the copy-code button
    body.template.components.push({ type: 'button', sub_type: 'url', index: '0', parameters: [{ type: 'text', text: String(params.code) }] });
  }

  const res = await fetch(`https://graph.facebook.com/v20.0/${process.env.WA_PHONE_NUMBER_ID}/messages`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.WA_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const e = new Error(data?.error?.message || `WhatsApp API error ${res.status}`);
    e.waCode = data?.error?.code;
    throw e;
  }
  return { messageId: data.messages?.[0]?.id, simulated: false };
}
