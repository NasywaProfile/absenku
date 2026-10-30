/**
 * Time Utilities & Attendance Calculation
 * Mengkalkulasi status ketepatan waktu (Tepat Waktu / Terlambat / Pulang Cepat),
 * durasi jam kerja, dan toleransi keterlambatan (grace period).
 */

import { AttendanceStatus } from '../types/index.ts';

/**
 * Parsing string waktu "HH:mm" atau "HH:mm:ss" menjadi total menit sejak tengah malam (00:00)
 */
export function timeStringToMinutes(timeStr: string): number {
  const parts = timeStr.split(':');
  const hours = parseInt(parts[0], 10) || 0;
  const minutes = parseInt(parts[1], 10) || 0;
  return hours * 60 + minutes;
}

/**
 * Hitung status keterlambatan absensi masuk (Clock In)
 * 
 * Aturan Logika:
 * - Jam masuk kantor: Misal 08:30 (510 menit)
 * - Toleransi keterlambatan (Grace Period): Misal 15 menit (sehingga batas maksimal 08:45)
 * - Jika karyawan absen <= 08:45: Dianggap ON_TIME (Tepat Waktu)
 * - Jika karyawan absen > 08:45: Dihitung TERLAMBAT, dengan selisih menit dihitung dari jam masuk awal (08:30)
 * 
 * @param clockInTimeStr Waktu absensi masuk dalam format "HH:mm:ss" atau "HH:mm"
 * @param workStartTimeStr Jam masuk wajib kantor, misal "08:30"
 * @param gracePeriodMinutes Menit toleransi keterlambatan, misal 15 menit
 */
export function calculateClockInPunctuality(
  clockInTimeStr: string,
  workStartTimeStr: string = '08:30',
  gracePeriodMinutes: number = 15
): {
  status: AttendanceStatus;
  lateMinutes: number;
  remarks: string;
} {
  const actualMinutes = timeStringToMinutes(clockInTimeStr);
  const scheduledMinutes = timeStringToMinutes(workStartTimeStr);
  const cutoffMinutes = scheduledMinutes + gracePeriodMinutes;

  // Absen sebelum atau sama dengan batas toleransi
  if (actualMinutes <= cutoffMinutes) {
    const diff = actualMinutes - scheduledMinutes;
    return {
      status: 'ON_TIME',
      lateMinutes: 0,
      remarks: actualMinutes <= scheduledMinutes
        ? 'Tepat Waktu'
        : `Dalam Batas Toleransi (${diff > 0 ? formatDurationHuman(diff) : '0 Menit'})`,
    };
  }

  // Absen melewati batas toleransi -> Dihitung terlambat terhadap jam kerja awal
  const lateMinutes = actualMinutes - scheduledMinutes;
  return {
    status: 'LATE',
    lateMinutes,
    remarks: `Terlambat ${formatDurationHuman(lateMinutes)}`,
  };
}

/**
 * Hitung durasi jam kerja antara Clock In dan Clock Out dalam menit
 */
export function calculateWorkDurationMinutes(
  clockInTimeStr: string,
  clockOutTimeStr: string
): number {
  const inMinutes = timeStringToMinutes(clockInTimeStr);
  const outMinutes = timeStringToMinutes(clockOutTimeStr);
  if (outMinutes < inMinutes) {
    // Lewat tengah malam / shift malam
    return 1440 - inMinutes + outMinutes;
  }
  return Math.max(0, outMinutes - inMinutes);
}

/**
 * Format durasi menit ke tampilan jam dan menit ramah pengguna
 * Contoh: 75 menit -> "1 Jam 15 Menit", 120 menit -> "2 Jam", 25 menit -> "25 Menit"
 */
export function formatDurationHuman(minutes: number): string {
  if (!minutes || minutes <= 0) return '0 Menit';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m} Menit`;
  if (m === 0) return `${h} Jam`;
  return `${h} Jam ${m} Menit`;
}

/**
 * Format tanggal format Indonesia (WIB)
 * Contoh: "Kamis, 1 Okt 2026"
 */
export function formatIndonesianDate(dateString: string): string {
  if (!dateString) return '';
  try {
    const parts = dateString.split('-');
    let date: Date;
    if (parts.length === 3) {
      date = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
    } else {
      date = new Date(dateString);
    }
    const formatted = new Intl.DateTimeFormat('id-ID', {
      weekday: 'long',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    }).format(date);
    // Replace non-breaking spaces, multiple spaces, and normalize comma spacing
    return formatted.replace(/[\u202f\u00a0\s]+/g, ' ').replace(/\s*,\s*/g, ', ').trim();
  } catch {
    return dateString;
  }
}

/**
 * Format tanggal ringkas tanpa nama hari
 * Contoh: "26 Okt 2026"
 */
export function formatIndonesianDateShort(dateString: string): string {
  if (!dateString) return '';
  try {
    const parts = dateString.split('-');
    let date: Date;
    if (parts.length === 3) {
      date = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
    } else {
      date = new Date(dateString);
    }
    const formatted = new Intl.DateTimeFormat('id-ID', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    }).format(date);
    return formatted.replace(/[\u202f\u00a0\s]+/g, ' ').trim();
  } catch {
    return dateString;
  }
}

/**
 * Ambil waktu saat ini dalam format "HH:mm:ss"
 */
export function getCurrentTimeString(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
}

/**
 * Ambil tanggal saat ini dalam format "YYYY-MM-DD"
 */
export function getCurrentDateString(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}
