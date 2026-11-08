import type { IncomingMessage, ServerResponse } from 'http';
import nodemailer from 'nodemailer';

/**
 * Serverless Email Dispatcher (Ready for Vercel / Netlify / Production)
 * Prioritas Provider:
 * 1. Resend (Terbaik & Standar Industri Modern: 3.000 email/bln free)
 * 2. Brevo (Alternatif Kuota Besar: 300 email/hari free = 9.000/bln)
 * 3. Nodemailer SMTP (Fallback Gmail App Password)
 */
export default async function handler(req: any, res: any) {
  // Setup CORS headers agar aman dipanggil dari frontend saat dipublish
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method Not Allowed' });
    return;
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {};
    const { to, subject, html, text } = body;

    if (!to || !subject) {
      res.status(400).json({ error: 'to and subject are required' });
      return;
    }

    const resendApiKey = process.env.RESEND_API_KEY;
    const brevoApiKey = process.env.BREVO_API_KEY;
    const smtpUser = process.env.SMTP_USER || '';
    const smtpPass = process.env.SMTP_PASS || '';
    const fromName = process.env.SMTP_FROM_NAME || 'in-Time Notifikasi';

    // 1. OPSI UTAMA: RESEND REST API (Sangat Direkomendasikan untuk Production dengan Custom Domain)
    const isSandbox = !process.env.RESEND_FROM_EMAIL || process.env.RESEND_FROM_EMAIL === 'onboarding@resend.dev';
    const isAllowedByResend = !isSandbox || to.toLowerCase() === 'naswa.wijaya31@gmail.com';

    if (resendApiKey && !isSandbox && isAllowedByResend) {
      try {
        const fromEmail = process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev';
        const response = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${resendApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: `"${fromName}" <${fromEmail}>`,
            to: [to],
            subject,
            html: html || '',
            text: text || '',
          }),
        });

        const data = (await response.json().catch(() => null)) as any;
        if (response.ok) {
          console.log(`[Email Sent via Resend] To: ${to} | ID: ${data?.id}`);
          res.status(200).json({ success: true, provider: 'resend', id: data?.id });
          return;
        } else {
          console.warn('[Resend Warning - Fallback ke SMTP]:', data?.message || data);
        }
      } catch (resendErr) {
        console.warn('[Resend Error - Fallback ke SMTP]:', resendErr);
      }
    }

    // 2. OPSI KEDUA: BREVO REST API (Alternatif Kuota 300/hari)
    if (brevoApiKey) {
      const fromEmail = process.env.BREVO_FROM_EMAIL || smtpUser;
      const response = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: {
          'api-key': brevoApiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sender: { name: fromName, email: fromEmail },
          to: [{ email: to }],
          subject,
          htmlContent: html || '',
          textContent: text || '',
        }),
      });

      const data = (await response.json().catch(() => null)) as any;
      if (!response.ok) {
        console.error('[Brevo Error]', data);
        throw new Error(data?.message || 'Gagal mengirim email via Brevo');
      }

      console.log(`[Email Sent via Brevo] To: ${to} | ID: ${data?.messageId}`);
      res.status(200).json({ success: true, provider: 'brevo', id: data?.messageId });
      return;
    }

    // 3. FALLBACK: NODEMAILER GMAIL SMTP
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: smtpUser,
        pass: smtpPass,
      },
    });

    const cleanFromName = (fromName || 'in-Time').replace(/Notifikasi/gi, '').trim() || 'in-Time';
    const info = await transporter.sendMail({
      from: `"${cleanFromName}" <${smtpUser}>`,
      replyTo: smtpUser,
      to,
      subject,
      text: text || '',
      html: html || '',
      headers: {
        'X-Entity-Ref-ID': `intime-${Date.now()}`,
        'X-Auto-Response-Suppress': 'OOF, AutoReply',
      },
    });

    console.log(`[Email Sent via SMTP] To: ${to} | Subject: ${subject} | ID: ${info.messageId}`);
    res.status(200).json({ success: true, provider: 'smtp', messageId: info.messageId });
  } catch (error: any) {
    console.error('[SendEmail Serverless Error]', error);
    res.status(500).json({ error: error.message || 'Failed to send email' });
  }
}
