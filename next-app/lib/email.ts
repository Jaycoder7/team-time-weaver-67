import Resend from 'resend';
const resend = new Resend(process.env.RESEND_API_KEY || '');

export async function sendConfirmationEmail(to: string, subject: string, html: string) {
  if (!process.env.RESEND_API_KEY) {
    console.warn('RESEND_API_KEY not configured; skipping email');
    return;
  }
  await resend.emails.send({
    from: process.env.RESEND_FROM_EMAIL || 'no-reply@example.com',
    to,
    subject,
    html,
  });
}
