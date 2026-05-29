import { NextResponse } from 'next/server';

export async function GET() {
  const apiKey = process.env.RESEND_API_KEY;

  // 1. Check API key
  if (!apiKey) {
    return NextResponse.json({ ok: false, error: 'RESEND_API_KEY is missing from .env' }, { status: 500 });
  }

  // 2. Send from the verified sourcinglaunch.com domain
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: 'Sourcing Launch <noreply@sourcinglaunch.com>',
      to: ['groupechannel@gmail.com'],
      subject: '✅ Test Email — Sourcing Launch',
      html: `
        <div style="font-family:Arial,sans-serif;max-width:500px;margin:0 auto;padding:32px;background:#f8fafc;border-radius:12px;">
          <div style="background:#0D47A1;padding:20px 24px;border-radius:8px;margin-bottom:24px;">
            <h1 style="margin:0;color:#fff;font-size:20px;">SOURCING LAUNCH</h1>
          </div>
          <h2 style="color:#0D47A1;margin:0 0 12px;">Email system is working ✓</h2>
          <p style="color:#475569;font-size:14px;">This is a test email from your Sourcing Launch platform.</p>
          <table style="width:100%;border-collapse:collapse;margin-top:16px;border-radius:8px;overflow:hidden;border:1px solid #e2e8f0;">
            <tr><td style="background:#E3F2FD;padding:8px 16px;font-size:11px;font-weight:700;color:#0D47A1;text-transform:uppercase;" colspan="2">Test Quotation</td></tr>
            <tr><td style="padding:10px 16px;font-size:13px;color:#64748b;border-bottom:1px solid #f1f5f9;">Quotation ID</td><td style="padding:10px 16px;font-size:13px;font-weight:600;color:#1e293b;border-bottom:1px solid #f1f5f9;">QT-TEST-123456</td></tr>
            <tr><td style="padding:10px 16px;font-size:13px;color:#64748b;border-bottom:1px solid #f1f5f9;">Product</td><td style="padding:10px 16px;font-size:13px;font-weight:600;color:#1e293b;border-bottom:1px solid #f1f5f9;">Wireless Bluetooth Earbuds</td></tr>
            <tr><td style="padding:10px 16px;font-size:13px;color:#64748b;border-bottom:1px solid #f1f5f9;">Quantity</td><td style="padding:10px 16px;font-size:13px;font-weight:600;color:#1e293b;border-bottom:1px solid #f1f5f9;">500 units</td></tr>
            <tr><td style="padding:10px 16px;font-size:13px;color:#64748b;">Status</td><td style="padding:10px 16px;"><span style="background:#D1FAE5;color:#065F46;padding:3px 10px;border-radius:20px;font-size:12px;font-weight:600;">Approved</span></td></tr>
          </table>
          <p style="margin-top:24px;font-size:12px;color:#94a3b8;text-align:center;">Sourcing Launch · noreply@sourcinglaunch.com</p>
        </div>
      `,
    }),
  });

  const data = await res.json();

  if (!res.ok) {
    return NextResponse.json({
      ok: false,
      status: res.status,
      resend_error: data,
      api_key_present: !!apiKey,
      api_key_prefix: apiKey.slice(0, 8) + '...',
    }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    message: 'Email sent! Check groupechannel@gmail.com (also check spam)',
    resend_id: data.id,
    api_key_prefix: apiKey.slice(0, 8) + '...',
  });
}
