/**
 * Real Email Dispatcher via Nodemailer Endpoint (/api/send-email)
 * Mengirimkan email sungguhan langsung ke Gmail inbox penerima
 */

import { ApiClient } from './api-client';

export interface RealEmailPayload {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

const API_BASE =
  (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_API_URL) ||
  '/api';

export async function sendRealEmail(payload: RealEmailPayload): Promise<boolean> {
  if (!payload.to || !payload.to.includes('@')) {
    console.warn('[RealEmail] Alamat email tujuan tidak valid:', payload.to);
    return false;
  }

  const token = ApiClient.getToken();
  if (!token) {
    return false;
  }

  try {
    const targetUrl = API_BASE.endsWith('/') ? `${API_BASE}send-email` : `${API_BASE}/send-email`;
    const response = await fetch(targetUrl, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => null);
      console.warn('[RealEmail] Gagal mengirim email:', err);
      return false;
    }

    const result = await response.json().catch(() => null);
    console.log('[RealEmail] Berhasil terkirim:', payload.to, result?.message || result?.messageId);
    return true;
  } catch (error) {
    console.warn('[RealEmail] Network error saat dispatch email:', error);
    return false;
  }
}

function escapeHtmlText(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function sanitizeActionUrl(url?: string): string | null {
  if (!url) return null;
  const trimmed = url.replace(/[\u0000-\u001f\u007f]/g, '').trim();
  if (!/^https?:\/\//i.test(trimmed)) return null;
  if (trimmed.includes('localhost') || trimmed.includes('127.0.0.1')) return null;
  return escapeHtmlText(trimmed);
}

/**
 * Format HTML template profesional untuk notifikasi perizinan & tugas
 * Dioptimalkan untuk lolos filter anti-spam tanpa tautan localhost mencurigakan
 */
export function generateEmailHtmlTemplate(params: {
  title: string;
  recipientName: string;
  intro: string;
  fields: Array<{ label: string; value: string }>;
  actionUrl?: string;
  actionText?: string;
  footerNote?: string;
}): string {
  const { title, recipientName, intro, fields, actionUrl, actionText = 'Buka Aplikasi in-Time', footerNote } = params;

  const safeTitle = escapeHtmlText(title);
  const safeRecipientName = escapeHtmlText(recipientName);
  const safeIntro = escapeHtmlText(intro);
  const safeActionText = escapeHtmlText(actionText);
  const safeFooterNote = footerNote ? escapeHtmlText(footerNote) : '';
  const safeHref = sanitizeActionUrl(actionUrl);

  const rows = fields
    .map(
      (f) => `
      <tr style="border-bottom: 1px solid #f1f5f9;">
        <td style="padding: 10px 0; font-weight: 600; color: #475569; width: 35%; font-size: 13px;">${escapeHtmlText(f.label)}:</td>
        <td style="padding: 10px 0; color: #0f172a; font-size: 13px;">${escapeHtmlText(f.value)}</td>
      </tr>
    `
    )
    .join('');

  // Hindari URL localhost langsung di dalam email karena filter spam mendeteksinya sebagai phishing/bot test
  const safeButtonHtml = safeHref
    ? `
      <div style="text-align: center; margin: 28px 0 16px 0;">
        <a href="${safeHref}" style="background-color: #1E3A8A; color: #ffffff; padding: 12px 26px; font-size: 13px; font-weight: 700; text-decoration: none; border-radius: 10px; display: inline-block;">
          ${safeActionText} &rarr;
        </a>
      </div>
    `
    : `
      <div style="text-align: center; margin: 24px 0 16px 0;">
        <span style="font-size: 12px; color: #64748b;">
          Silakan akses portal in-Time untuk meninjau informasi ini.
        </span>
      </div>
    `;

  return `
    <!DOCTYPE html>
    <html lang="id">
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${safeTitle}</title>
      </head>
      <body style="margin: 0; padding: 24px; background-color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1e293b;">
        <div style="max-width: 580px; margin: 0 auto; background-color: #ffffff; border-radius: 16px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);">
          
          <!-- Header Biru in-Time -->
          <div style="background-color: #1E3A8A; padding: 20px 28px; text-align: left;">
            <div style="color: #bfdbfe; font-size: 12px; font-weight: 700; margin-bottom: 4px;">in-Time</div>
            <h1 style="margin: 0; color: #ffffff; font-size: 18px; font-weight: 700; line-height: 1.3;">${safeTitle}</h1>
          </div>

          <!-- Body Konten -->
          <div style="padding: 28px;">
            <p style="margin-top: 0; font-size: 14px; line-height: 1.6; color: #334155;">
              Halo <strong>${safeRecipientName}</strong>,
            </p>
            <p style="font-size: 13px; line-height: 1.6; color: #475569; margin-bottom: 20px;">
              ${safeIntro}
            </p>

            <!-- Tabel Rincian Data -->
            <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
              ${rows}
            </table>

            <!-- Petunjuk Akses -->
            ${safeButtonHtml}

            ${
              safeFooterNote
                ? `<p style="font-size: 12px; color: #64748b; line-height: 1.5; margin-top: 20px; padding: 10px 14px; background-color: #f1f5f9; border-radius: 8px;">${safeFooterNote}</p>`
                : ''
            }
          </div>

          <!-- Footer Bawah -->
          <div style="padding: 16px 28px; background-color: #f8fafc; border-top: 1px solid #f1f5f9; text-align: center;">
            <p style="margin: 0; font-size: 11px; color: #94a3b8;">
              &copy; in-Time. Seluruh hak cipta dilindungi.
            </p>
          </div>
        </div>
      </body>
    </html>
  `;
}
