import { EmailPayload } from './email';

export async function sendEmailClient(payload: EmailPayload): Promise<void> {
  try {
    await fetch('/api/email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  } catch (err) {
    console.error('[sendEmailClient]', err);
  }
}
