import { NextRequest, NextResponse } from 'next/server';
import { sendEmail, EmailPayload } from '@/lib/email';

export async function POST(req: NextRequest) {
  try {
    const payload: EmailPayload = await req.json();
    await sendEmail(payload);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[Email API]', err);
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
