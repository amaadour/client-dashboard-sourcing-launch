const RESEND_API_KEY = process.env.RESEND_API_KEY!;
const FROM = 'Sourcing Launch <noreply@sourcinglaunch.com>';
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'ktkrimo553@gmail.com';
const CLIENT_URL = 'https://dashboard.sourcinglaunch.com';
const ADMIN_URL  = 'https://admin.sourcinglaunch.com';
const LOGO_URL   = 'https://dashboard.sourcinglaunch.com/images/logo/Logo2.png';

// ─── Types ────────────────────────────────────────────────────────────────────
export type EmailPayload =
  | { type: 'quotation_created'; quotation: QuotationEmailData; clientEmail: string }
  | { type: 'quotation_status';  quotation: QuotationEmailData; clientEmail: string }
  | { type: 'payment_created';   quotation: QuotationEmailData; payment: PaymentEmailData; clientEmail: string }
  | { type: 'shipping_update';   shipment: ShipmentEmailData;   clientEmail: string };

export interface QuotationEmailData {
  quotation_id: string;
  product_name: string;
  quantity: number | string;
  status: string;
  shipping_country: string;
  shipping_city?: string;
  receiver_name?: string;
  service_type?: string;
  created_at?: string;
  rejection_reason?: string | null;
}
export interface PaymentEmailData {
  reference_number: string;
  amount: number;
  method: string;
  status: string;
}
export interface ShipmentEmailData {
  tracking_number?: string;
  status: string;
  product_name?: string;
  destination?: string;
  quotation_id?: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
const statusBadge = (status: string) => {
  const map: Record<string, [string, string]> = {
    Pending:    ['#FEF3C7','#92400E'],
    Approved:   ['#D1FAE5','#065F46'],
    Rejected:   ['#FEE2E2','#991B1B'],
    Paid:       ['#DBEAFE','#1E40AF'],
    Shipped:    ['#EDE9FE','#5B21B6'],
    Delivered:  ['#D1FAE5','#065F46'],
    Processing: ['#FEF9C3','#854D0E'],
    'In Transit':['#E0F2FE','#075985'],
    'On Hold':  ['#FEE2E2','#991B1B'],
  };
  const [bg, color] = map[status] ?? ['#F1F5F9','#475569'];
  return `<span style="display:inline-block;padding:5px 14px;border-radius:99px;font-size:12px;font-weight:700;letter-spacing:0.3px;background:${bg};color:${color};">${status}</span>`;
};

const infoRow = (label: string, value: string) => `
  <tr>
    <td style="padding:11px 20px;font-size:13px;color:#64748b;font-weight:500;border-bottom:1px solid #F1F5F9;width:38%;vertical-align:top;">${label}</td>
    <td style="padding:11px 20px;font-size:13px;color:#0F172A;font-weight:600;border-bottom:1px solid #F1F5F9;">${value}</td>
  </tr>`;

const ctaBtn = (label: string, url: string) => `
  <table cellpadding="0" cellspacing="0" style="margin-top:28px;">
    <tr>
      <td style="background:#0D47A1;border-radius:8px;">
        <a href="${url}" style="display:inline-block;padding:13px 26px;font-size:14px;font-weight:600;color:#FFFFFF;text-decoration:none;">${label}</a>
      </td>
    </tr>
  </table>`;

// ─── Master layout ────────────────────────────────────────────────────────────
const layout = (title: string, preheader: string, body: string, quotationId?: string, productName?: string) => `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>${title}</title>
</head>
<body style="margin:0;padding:0;background:#F0F4F8;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">

  <div style="display:none;max-height:0;overflow:hidden;mso-hide:all;">${preheader}</div>

  <table width="100%" cellpadding="0" cellspacing="0" style="background:#F0F4F8;padding:48px 16px;">
  <tr><td align="center">
  <table width="520" cellpadding="0" cellspacing="0" style="max-width:520px;width:100%;">

    <!-- Logo -->
    <tr>
      <td style="text-align:center;padding-bottom:32px;">
        <img src="${LOGO_URL}" alt="Sourcing Launch" height="150" style="height:150px;display:inline-block;" />
      </td>
    </tr>

    <!-- Card -->
    <tr>
      <td style="background:#FFFFFF;border-radius:16px;border:1px solid #E2E8F0;padding:44px 48px 40px;">

        ${quotationId ? `
        <div style="margin-bottom:24px;">
          <span style="font-size:12px;font-weight:600;color:#64748B;font-family:ui-monospace,monospace;background:#F8FAFC;border:1px solid #E2E8F0;padding:5px 12px;border-radius:6px;">${quotationId}</span>
          ${productName ? `<span style="font-size:12px;color:#94A3B8;margin-left:10px;">${productName}</span>` : ''}
        </div>` : ''}

        <!-- Title -->
        <div style="font-size:22px;font-weight:700;color:#0F172A;letter-spacing:-0.3px;line-height:1.3;margin-bottom:20px;">${title}</div>

        ${body}

        <!-- Divider -->
        <div style="border-top:1px solid #F1F5F9;margin:36px 0 0;"></div>
        <div style="margin-top:18px;font-size:12px;color:#94A3B8;line-height:1.7;">
          Questions? Contact us at <a href="mailto:Mehdi@sourcinglaunch.com" style="color:#0D47A1;text-decoration:none;">Mehdi@sourcinglaunch.com</a>
        </div>

      </td>
    </tr>

    <!-- Footer -->
    <tr>
      <td style="text-align:center;padding-top:24px;">
        <div style="font-size:12px;color:#94A3B8;">
          © ${new Date().getFullYear()} Sourcing Launch &nbsp;·&nbsp;
          <a href="${CLIENT_URL}" style="color:#94A3B8;text-decoration:none;">sourcinglaunch.com</a>
        </div>
      </td>
    </tr>

  </table>
  </td></tr>
  </table>
</body>
</html>`;

// ─── Info card ────────────────────────────────────────────────────────────────
const infoCard = (heading: string, rows: string) => `
  <table width="100%" cellpadding="0" cellspacing="0" style="border-radius:10px;overflow:hidden;border:1px solid #E2E8F0;margin-bottom:20px;">
    <tr>
      <td colspan="2" style="background:#F8FAFC;padding:10px 16px;border-bottom:1px solid #E2E8F0;">
        <span style="font-size:11px;font-weight:700;color:#64748B;text-transform:uppercase;letter-spacing:1px;">${heading}</span>
      </td>
    </tr>
    ${rows}
  </table>`;

const alertBox = (title: string, text: string, bg: string, border: string, color: string) => `
  <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:20px;border-radius:8px;overflow:hidden;border-left:4px solid ${border};background:${bg};">
    <tr>
      <td style="padding:14px 16px;">
        <div style="font-size:13px;font-weight:700;color:${color};">${title}</div>
        <div style="font-size:13px;color:${color};margin-top:4px;opacity:0.85;">${text}</div>
      </td>
    </tr>
  </table>`;

// ─────────────────────────────────────────────────────────────────────────────
// TEMPLATE 1 — Quotation Created (client)
// ─────────────────────────────────────────────────────────────────────────────
function tplQuotationCreatedClient(q: QuotationEmailData): string {
  const body = `
    <p style="margin:0 0 20px;font-size:15px;color:#64748B;line-height:1.75;">
      We received your sourcing request for <strong>${q.product_name}</strong>. Our team will review it and prepare price options within <strong>24–48 hours</strong>.<br/><br/>You will be notified as soon as your quotation is ready.
    </p>

    ${infoCard('Quotation Details',
      infoRow('Quantity', `${q.quantity} units`) +
      infoRow('Destination', `${q.shipping_city ? q.shipping_city + ', ' : ''}${q.shipping_country}`) +
      (q.service_type ? infoRow('Service Type', q.service_type) : '') +
      (q.receiver_name ? infoRow('Receiver', q.receiver_name) : '') +
      infoRow('Status', statusBadge(q.status))
    )}

    ${ctaBtn('View My Quotation', `${CLIENT_URL}/quotation`)}
  `;
  return layout('Your quotation has been submitted.', `We received your quotation for ${q.product_name}.`, body, q.quotation_id, q.product_name);
}

// Template 1b — Admin notification
function tplQuotationCreatedAdmin(q: QuotationEmailData): string {
  const body = `
    <p style="margin:0 0 20px;font-size:15px;color:#64748B;line-height:1.75;">
      A client has submitted a new sourcing request for <strong>${q.product_name}</strong>. Please log in to the admin dashboard to review it and add price options.
    </p>

    ${infoCard('Quotation Details',
      infoRow('Quantity', `${q.quantity} units`) +
      infoRow('Destination', `${q.shipping_city ? q.shipping_city + ', ' : ''}${q.shipping_country}`) +
      (q.service_type ? infoRow('Service Type', q.service_type) : '') +
      (q.receiver_name ? infoRow('Receiver', q.receiver_name) : '') +
      infoRow('Status', statusBadge('Pending')) +
      infoRow('Submitted', q.created_at ? new Date(q.created_at).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }) : 'Today')
    )}

    ${ctaBtn('Review in Admin Dashboard', `${ADMIN_URL}/quotation`)}
  `;
  return layout('New quotation request.', `New quotation for ${q.product_name} requires your review.`, body, q.quotation_id, q.product_name);
}

// ─────────────────────────────────────────────────────────────────────────────
// TEMPLATE 2 — Quotation Status Change
// ─────────────────────────────────────────────────────────────────────────────
function tplQuotationStatus(q: QuotationEmailData): string {
  const isApproved = q.status === 'Approved';
  const isRejected = q.status === 'Rejected';

  const titleText = isApproved
    ? 'Your quotation has been approved.'
    : isRejected
    ? 'Your quotation was not approved.'
    : `Your quotation is now ${q.status}.`;

  const intro = isApproved
    ? `Great news — your sourcing request for <strong>${q.product_name}</strong> has been reviewed and approved. Price options are now available.<br/><br/>Log in to your dashboard to select an option and proceed to payment.`
    : isRejected
    ? `Unfortunately, your sourcing request for <strong>${q.product_name}</strong> could not be approved at this time.<br/><br/>Please log in to your dashboard to view the reason and submit a new request.`
    : `Your quotation for <strong>${q.product_name}</strong> status has been updated to <strong>${q.status}</strong>.`;

  const alert = isApproved
    ? alertBox('Ready for payment', 'Select your preferred price option and complete the payment to start your order.', '#F0FDF4', '#22C55E', '#166534')
    : isRejected && q.rejection_reason
    ? alertBox('Reason', q.rejection_reason, '#FFF7ED', '#F97316', '#9A3412')
    : '';

  const button = isApproved
    ? ctaBtn('Check Your Dashboard', `${CLIENT_URL}/quotation`)
    : ctaBtn('View Details', `${CLIENT_URL}/quotation`);

  const body = `
    <p style="margin:0 0 20px;font-size:15px;color:#64748B;line-height:1.75;">${intro}</p>
    ${alert}
    ${button}
  `;
  return layout(titleText, `Your quotation for ${q.product_name} is now ${q.status}.`, body, q.quotation_id, q.product_name);
}

// ─────────────────────────────────────────────────────────────────────────────
// TEMPLATE 3 — Payment Created
// ─────────────────────────────────────────────────────────────────────────────
function tplPaymentCreated(q: QuotationEmailData, p: PaymentEmailData): string {
  const body = `
    <p style="margin:0 0 20px;font-size:15px;color:#64748B;line-height:1.75;">
      Your payment for <strong>${q.product_name}</strong> has been submitted and is pending verification by our team.<br/><br/>This usually takes <strong>1–2 business days</strong>. You will receive a confirmation once it is approved.
    </p>

    ${infoCard('Payment Details',
      infoRow('Reference', `<span style="font-family:ui-monospace,monospace;background:#F8FAFC;border:1px solid #E2E8F0;padding:2px 8px;border-radius:4px;font-weight:600;">${p.reference_number}</span>`) +
      infoRow('Amount', `<strong style="color:#0D47A1;">$${Number(p.amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}</strong>`) +
      infoRow('Method', p.method) +
      infoRow('Status', statusBadge(p.status))
    )}

    ${ctaBtn('View Payment Status', `${CLIENT_URL}/payment`)}
  `;
  return layout('We received your payment.', `Your payment for ${q.product_name} is pending verification.`, body, q.quotation_id, q.product_name);
}

// ─────────────────────────────────────────────────────────────────────────────
// TEMPLATE 4 — Shipping Update
// ─────────────────────────────────────────────────────────────────────────────
function tplShippingUpdate(s: ShipmentEmailData): string {
  const messages: Record<string, string> = {
    'Processing':       'Your order is being processed and prepared for shipment.',
    'Shipped':          'Good news — your order has been dispatched and is now in transit to your destination.',
    'In Transit':       'Your shipment is currently in transit to the destination.',
    'Out for Delivery': 'Your shipment is out for delivery today.',
    'Delivered':        'Your order has been delivered successfully.',
    'On Hold':          'Your shipment is temporarily on hold. Our team will contact you shortly.',
  };
  const intro = messages[s.status] || `Your shipment status has been updated to <strong>${s.status}</strong>.`;

  const alertConfig: Record<string, [string, string, string, string, string]> = {
    Shipped:           ['Your order is on its way', 'Log in to your dashboard to track your shipment.', '#EFF6FF', '#3B82F6', '#1E40AF'],
    'In Transit':      ['In transit', 'Your package is moving toward its destination.', '#EFF6FF', '#3B82F6', '#1E40AF'],
    Delivered:         ['Delivered', 'We hope you are satisfied with your order. Thank you for choosing Sourcing Launch.', '#F0FDF4', '#22C55E', '#166534'],
    'Out for Delivery':['Almost there', 'Your package will arrive today.', '#FEF9C3', '#EAB308', '#854D0E'],
    'On Hold':         ['Shipment on hold', 'Our team will contact you with more details.', '#FFF7ED', '#F97316', '#9A3412'],
  };
  const cfg = alertConfig[s.status];

  const body = `
    <p style="margin:0 0 20px;font-size:15px;color:#64748B;line-height:1.75;">${intro}</p>

    ${infoCard('Shipment Details',
      infoRow('Status', statusBadge(s.status)) +
      (s.product_name    ? infoRow('Product',    s.product_name)   : '') +
      (s.tracking_number ? infoRow('Tracking #', `<span style="font-family:ui-monospace,monospace;background:#F8FAFC;border:1px solid #E2E8F0;padding:2px 8px;border-radius:4px;font-weight:600;">${s.tracking_number}</span>`) : '') +
      (s.destination     ? infoRow('Destination',s.destination)    : '')
    )}

    ${cfg ? alertBox(cfg[0], cfg[1], cfg[2], cfg[3], cfg[4]) : ''}
    ${ctaBtn('Track My Shipment', `${CLIENT_URL}/shipment-tracking`)}
  `;
  return layout(`Your order has been ${s.status.toLowerCase()}.`, `Your shipment status has been updated to ${s.status}.`, body, s.quotation_id, s.product_name);
}

// ─────────────────────────────────────────────────────────────────────────────
// SEND
// ─────────────────────────────────────────────────────────────────────────────
async function send(to: string | string[], subject: string, html: string) {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ from: FROM, to, subject, html }),
  });
  if (!res.ok) {
    const err = await res.text();
    console.error('[Resend] Error:', err);
    throw new Error(`Resend error: ${err}`);
  }
  return res.json();
}

export async function sendEmail(payload: EmailPayload) {
  switch (payload.type) {
    case 'quotation_created':
      await Promise.allSettled([
        send(payload.clientEmail, `Quotation submitted — ${payload.quotation.quotation_id}`, tplQuotationCreatedClient(payload.quotation)),
        send(ADMIN_EMAIL, `New quotation request — ${payload.quotation.quotation_id}`, tplQuotationCreatedAdmin(payload.quotation)),
      ]);
      break;
    case 'quotation_status':
      await send(payload.clientEmail, `Quotation ${payload.quotation.status.toLowerCase()} — ${payload.quotation.quotation_id}`, tplQuotationStatus(payload.quotation));
      break;
    case 'payment_created':
      await send(payload.clientEmail, `Payment received — ${payload.payment.reference_number}`, tplPaymentCreated(payload.quotation, payload.payment));
      break;
    case 'shipping_update':
      await send(payload.clientEmail, `Your order has been shipped — ${payload.shipment.quotation_id ?? payload.shipment.status}`, tplShippingUpdate(payload.shipment));
      break;
  }
}
