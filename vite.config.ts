import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import {fileURLToPath} from 'url';
import {defineConfig, Plugin} from 'vite';
import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

dotenv.config();

const emailApiPlugin = (): Plugin => ({
  name: 'email-api-server',
  configureServer(server) {
    server.middlewares.use('/api/send-email', (req, res) => {
      if (req.method !== 'POST') {
        res.statusCode = 405;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ error: 'Method Not Allowed' }));
        return;
      }

      let body = '';
      req.on('data', (chunk) => {
        body += chunk;
      });

      req.on('end', async () => {
        try {
          const { to, subject, html, text } = JSON.parse(body || '{}');
          if (!to || !subject) {
            res.statusCode = 400;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: 'to and subject are required' }));
            return;
          }

          const resendApiKey = process.env.RESEND_API_KEY;
          const brevoApiKey = process.env.BREVO_API_KEY;
          const smtpUser = process.env.SMTP_USER || '';
          const smtpPass = process.env.SMTP_PASS || '';
          const fromName = 'in-Time';

          // 1. Opsi Utama: Resend REST API (Deliverability tertinggi saat domain resmi terverifikasi)
          // Catatan: Jika domain masih sandbox 'onboarding@resend.dev', Resend membatasi penerima hanya ke allowlist di env.
          const isSandbox = !process.env.RESEND_FROM_EMAIL || process.env.RESEND_FROM_EMAIL === 'onboarding@resend.dev';
          const sandboxAllowlist = (process.env.RESEND_SANDBOX_ALLOWLIST || '')
            .split(',')
            .map((s) => s.trim().toLowerCase())
            .filter(Boolean);
          const isAllowedByResend = !isSandbox || sandboxAllowlist.includes(to.toLowerCase());

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
                res.statusCode = 200;
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ success: true, provider: 'resend', id: data?.id }));
                return;
              } else {
                console.warn('[Resend Warning - Fallback ke SMTP]:', data?.message || data);
              }
            } catch (resendErr) {
              console.warn('[Resend Network Error - Fallback ke SMTP]:', resendErr);
            }
          }

          // 2. Opsi Kedua: Brevo REST API (Kuota besar 300/hari)
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
              throw new Error(data?.message || 'Gagal mengirim email via Brevo API');
            }

            console.log(`[Email Sent via Brevo] To: ${to} | ID: ${data?.messageId}`);
            res.statusCode = 200;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ success: true, provider: 'brevo', id: data?.messageId }));
            return;
          }

          // 3. Fallback: Nodemailer Gmail SMTP
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
          res.statusCode = 200;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ success: true, provider: 'smtp', messageId: info.messageId }));
        } catch (err: any) {
          console.error('[Email Send Error]', err);
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: err.message || 'Failed to send email' }));
        }
      });
    });
  },
});

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss(), emailApiPlugin()],
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
      },
    },
    server: {
      host: '0.0.0.0',
      port: 3000,
      allowedHosts: true as const,
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
