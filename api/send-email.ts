import crypto from 'crypto';
import nodemailer from 'nodemailer';

function getAllowedOrigins(): string[] {
  const raw = process.env.ALLOWED_ORIGINS || process.env.CORS_ALLOWED_ORIGINS || '';
  return raw
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);
}

function constantTimeEquals(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

async function isAuthorizedRequest(req: any): Promise<boolean> {
  const internalSecret = process.env.INTERNAL_EMAIL_SECRET;
  const providedSecret = String(req.headers?.['x-internal-email-secret'] || '');
  if (internalSecret && providedSecret && constantTimeEquals(providedSecret, internalSecret)) {
    return true;
  }

  const authHeader = String(req.headers?.authorization || '');
  if (!authHeader.startsWith('Bearer ')) {
    return false;
  }
  const token = authHeader.slice(7).trim();
  if (!token) {
    return false;
  }

  const rawBackendUrl =
    process.env.BACKEND_API_URL ||
    (process.env.VITE_API_URL && /^https?:\/\//i.test(process.env.VITE_API_URL) ? process.env.VITE_API_URL : '');

  if (!rawBackendUrl) {
    return false;
  }

  const verifyEndpoint = rawBackendUrl.endsWith('/api')
    ? `${rawBackendUrl}/me`
    : rawBackendUrl.endsWith('/')
      ? `${rawBackendUrl}me`
      : `${rawBackendUrl}/api/me`;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    const verifyRes = await fetch(verifyEndpoint, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${token}`,
      },
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (!verifyRes.ok) {
      return false;
    }
    const me = (await verifyRes.json().catch(() => null)) as any;
    const status = String(me?.data?.status || me?.status || '').toUpperCase();
    return !status || status === 'ACTIVE';
  } catch {
    return false;
  }
}

/**
 * Serverless Email Dispatcher (Ready for Vercel / Netlify / Production)
 * Prioritas Provider:
 * 1. Resend (Terbaik & Standar Industri Modern: 3.000 email/bln free)
 * 2. Brevo (Alternatif Kuota Besar: 300 email/hari free = 9.000/bln)
 * 3. Nodemailer SMTP (Fallback Gmail App Password)
 */
export default async function handler(req: any, res: any) {
  const origin = String(req.headers?.origin || '');
  const allowedOrigins = getAllowedOrigins();
  if (origin && allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Vary', 'Origin');
  }
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'Accept, Content-Type, Authorization, X-Requested-With, X-Internal-Email-Secret'
  );

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method Not Allowed' });
    return;
  }

  const authorized = await isAuthorizedRequest(req);
  if (!authorized) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {};
    const to = typeof body.to === 'string' ? body.to.trim() : '';
    const rawSubject = typeof body.subject === 'string' ? body.subject : '';
    const subject = rawSubject.replace(/[\r\n]+/g, ' ').trim();
    const html = typeof body.html === 'string' ? body.html : '';
    const text = typeof body.text === 'string' ? body.text : '';

    if (!to || !subject || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
      res.status(400).json({ error: 'Valid to and subject are required' });
      return;
    }

    const resendApiKey = process.env.RESEND_API_KEY;
    const brevoApiKey = process.env.BREVO_API_KEY;
    const smtpUser = process.env.SMTP_USER || '';
    const smtpPass = process.env.SMTP_PASS || '';
    const rawFromName = process.env.SMTP_FROM_NAME || process.env.MAIL_FROM_NAME || 'in-Time';
    const fromName = (!rawFromName || rawFromName.toLowerCase() === 'laravel') ? 'in-Time' : rawFromName;

    // 1. OPSI UTAMA: RESEND REST API (Sangat Direkomendasikan untuk Production dengan Custom Domain)
    const isSandbox = !process.env.RESEND_FROM_EMAIL || process.env.RESEND_FROM_EMAIL === 'onboarding@resend.dev';

    if (resendApiKey && !isSandbox) {
      try {
        const fromEmail = process.env.RESEND_FROM_EMAIL as string;
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
            html,
            text,
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
          htmlContent: html,
          textContent: text,
        }),
      });

      const data = (await response.json().catch(() => null)) as any;
      if (!response.ok) {
        console.error('[Brevo Error]', data);
        throw new Error('Gagal mengirim email via Brevo');
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
      text,
      html,
      headers: {
        'X-Entity-Ref-ID': `intime-${Date.now()}`,
        'X-Auto-Response-Suppress': 'OOF, AutoReply',
      },
    });

    console.log(`[Email Sent via SMTP] To: ${to} | Subject: ${subject} | ID: ${info.messageId}`);
    res.status(200).json({ success: true, provider: 'smtp', messageId: info.messageId });
  } catch (error) {
    console.error('[SendEmail Serverless Error]', error);
    res.status(500).json({ error: 'Failed to send email' });
  }
}
