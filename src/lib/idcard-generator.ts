/**
 * ID Card Texture Generator for Lanyard
 * Generates a clean, high-resolution canvas DataURL for the 3D Lanyard ID Card badge.
 */

export function getFirstTwoNames(fullName: string): string {
  if (!fullName || !fullName.trim()) return 'Pengunjung';
  const parts = fullName.trim().split(/\s+/);
  if (parts.length <= 2) return parts.join(' ');
  return `${parts[0]} ${parts[1]}`;
}

export function generateIDCardDataUrl({
  name,
  position,
  department,
  role,
  avatarUrl,
  isGuest = false,
}: {
  name?: string;
  position?: string;
  department?: string;
  role?: string;
  avatarUrl?: string;
  isGuest?: boolean;
}): Promise<string> {
  return new Promise((resolve) => {
    const canvas = document.createElement('canvas');
    const width = 600;
    const height = 900;
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      resolve('');
      return;
    }

    // 1. Background Base Card (Clean Pure White with rounded accent gradient)
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, width, height);

    // Subtle Grid pattern on background
    ctx.strokeStyle = '#F1F5F9';
    ctx.lineWidth = 1.5;
    for (let x = 0; x < width; x += 30) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }
    for (let y = 0; y < height; y += 30) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }

    // 2. Header Banner (#1E3A8A Navy Blue)
    const headerGradient = ctx.createLinearGradient(0, 0, width, 220);
    headerGradient.addColorStop(0, '#1E3A8A');
    headerGradient.addColorStop(1, '#0F172A');
    ctx.fillStyle = headerGradient;
    ctx.fillRect(0, 0, width, 220);

    // Accent Stripe
    ctx.fillStyle = '#4F46E5';
    ctx.fillRect(0, 212, width, 8);

    // Brand Logo on Header
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 36px "Plus Jakarta Sans", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('absenku', width / 2, 70);

    ctx.fillStyle = '#93C5FD';
    ctx.font = '600 16px "Plus Jakarta Sans", sans-serif';
    ctx.letterSpacing = '3px';
    ctx.fillText('IDENTITY PASS', width / 2, 110);

    // 3. User Avatar Image
    const displayName = isGuest ? 'Pengunjung' : getFirstTwoNames(name || 'Pengunjung');
    const displayPos = isGuest ? 'Tamu / Pengunjung Akses' : (position || department || 'Staf Operasional');
    const displayRole = isGuest ? 'GUEST PASS' : (role === 'SUPER_ADMIN' ? 'SUPER ADMIN' : role === 'ADMIN' ? 'ADMIN HR' : 'STAFF MEMBER');

    const drawContentWithAvatar = (img: HTMLImageElement | null) => {
      // Avatar Outer Circle / Card Frame
      const avatarX = width / 2;
      const avatarY = 320;
      const avatarRadius = 90;

      ctx.save();
      ctx.beginPath();
      ctx.arc(avatarX, avatarY, avatarRadius + 6, 0, Math.PI * 2);
      ctx.fillStyle = '#FFFFFF';
      ctx.fill();
      ctx.shadowColor = 'rgba(0, 0, 0, 0.12)';
      ctx.shadowBlur = 15;
      ctx.shadowOffsetY = 6;
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(avatarX, avatarY, avatarRadius, 0, Math.PI * 2);
      ctx.clip();

      if (img) {
        ctx.drawImage(img, avatarX - avatarRadius, avatarY - avatarRadius, avatarRadius * 2, avatarRadius * 2);
      } else {
        // Fallback Default Visitor Avatar Icon background
        ctx.fillStyle = '#E2E8F0';
        ctx.fillRect(avatarX - avatarRadius, avatarY - avatarRadius, avatarRadius * 2, avatarRadius * 2);

        // Head circle
        ctx.fillStyle = '#64748B';
        ctx.beginPath();
        ctx.arc(avatarX, avatarY - 20, 36, 0, Math.PI * 2);
        ctx.fill();

        // Shoulder curve
        ctx.beginPath();
        ctx.arc(avatarX, avatarY + 80, 65, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();

      // 4. Role Chip Badge
      const badgeY = 460;
      ctx.fillStyle = isGuest ? '#F1F5F9' : '#EEF2FF';
      ctx.strokeStyle = isGuest ? '#CBD5E1' : '#C7D2FE';
      ctx.lineWidth = 2;
      
      const badgeWidth = 200;
      const badgeHeight = 36;
      ctx.beginPath();
      ctx.roundRect(width / 2 - badgeWidth / 2, badgeY, badgeWidth, badgeHeight, 18);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = isGuest ? '#475569' : '#4F46E5';
      ctx.font = 'extrabold 15px "Plus Jakarta Sans", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(displayRole, width / 2, badgeY + 23);

      // 5. Name (2 Words First Name)
      ctx.fillStyle = '#0F172A';
      ctx.font = 'extrabold 42px "Plus Jakarta Sans", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(displayName, width / 2, 550);

      // Position Subtitle
      ctx.fillStyle = '#64748B';
      ctx.font = '600 20px "Plus Jakarta Sans", sans-serif';
      ctx.fillText(displayPos, width / 2, 595);

      // Divider Line
      ctx.strokeStyle = '#E2E8F0';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(80, 640);
      ctx.lineTo(width - 80, 640);
      ctx.stroke();

      // 6. Footer Section: QR Code Placeholder & Security Hologram Effect
      ctx.fillStyle = '#0F172A';
      ctx.font = 'bold 14px monospace';
      ctx.fillText(`ID: #${isGuest ? 'GUEST-001' : 'PASS-2026'}`, width / 2, 675);

      // Fake QR Code Block
      const qrX = width / 2 - 60;
      const qrY = 705;
      const qrSize = 120;

      ctx.fillStyle = '#0F172A';
      ctx.fillRect(qrX, qrY, qrSize, qrSize);

      // White inner blocks for QR Code look
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(qrX + 10, qrY + 10, 30, 30);
      ctx.fillRect(qrX + qrSize - 40, qrY + 10, 30, 30);
      ctx.fillRect(qrX + 10, qrY + qrSize - 40, 30, 30);

      ctx.fillStyle = '#0F172A';
      ctx.fillRect(qrX + 18, qrY + 18, 14, 14);
      ctx.fillRect(qrX + qrSize - 32, qrY + 18, 14, 14);
      ctx.fillRect(qrX + 18, qrY + qrSize - 32, 14, 14);

      // Random QR Dots
      ctx.fillRect(qrX + 55, qrY + 20, 12, 12);
      ctx.fillRect(qrX + 55, qrY + 50, 15, 15);
      ctx.fillRect(qrX + 20, qrY + 55, 12, 12);
      ctx.fillRect(qrX + 80, qrY + 55, 18, 18);
      ctx.fillRect(qrX + 50, qrY + 85, 25, 12);
      ctx.fillRect(qrX + 85, qrY + 85, 15, 15);

      // Security Pass Text
      ctx.fillStyle = '#94A3B8';
      ctx.font = '500 12px "Plus Jakarta Sans", sans-serif';
      ctx.fillText('OFFICIAL DIGITAL PASS • ABSENKU', width / 2, 860);

      resolve(canvas.toDataURL('image/png'));
    };

    if (avatarUrl && !isGuest) {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => drawContentWithAvatar(img);
      img.onerror = () => drawContentWithAvatar(null);
      img.src = avatarUrl;
    } else {
      drawContentWithAvatar(null);
    }
  });
}
