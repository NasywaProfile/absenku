/**
 * SUMBER KEBENARAN TUNGGAL status kehadiran harian (presensi + perizinan).
 *
 * Semua layar (kalender beranda, kalender presensi, riwayat tim, riwayat pribadi, handler absen)
 * WAJIB memakai fungsi di file ini agar tidak ada lagi aturan ganda yang saling bertentangan.
 *
 * ATURAN BAKU:
 * 1. Hanya pengajuan berstatus APPROVED yang memengaruhi status. PENDING / REJECTED diabaikan.
 * 2. Cuti/Izin & Sakit  = OFF (bebas presensi, tidak dihitung hadir), SELALU menang atas record presensi.
 * 3. WFH & Dinas Luar   = status KERJA (tetap wajib presensi, hanya lokasinya remote).
 * 4. Jika ada beberapa pengajuan disetujui di hari yang sama (data lama), prioritas:
 *    Sakit > Cuti/Izin > Dinas Luar > WFH.
 * 5. Pengajuan baru tidak boleh bertabrakan tanggal dengan pengajuan lain (PENDING / APPROVED).
 */
import { AttendanceRecord, LeaveCategory, LeaveRequest } from '../types/index.ts';

export type DayStatusKey =
  | 'PRESENT'
  | 'LATE'
  | 'WFH'
  | 'BUSINESS_TRIP'
  | 'LEAVE'
  | 'SICK'
  | 'HOLIDAY'
  | 'ABSENT'
  | 'TODAY_PENDING'
  | 'FUTURE';

export type DayLocation = 'OFFICE' | 'OUT_OF_RANGE' | 'WFH' | 'BUSINESS_TRIP';

export interface UserRef {
  id: string;
  name: string;
}

export interface DailyStatus {
  key: DayStatusKey;
  /** Label dasar, mis. "Hadir (Kantor)", "WFH", "Sakit" */
  label: string;
  /** Label ringkas untuk sel matriks, mis. "Hadir", "Cuti / Izin" */
  shortLabel: string;
  /** Label lengkap termasuk keterlambatan, mis. "WFH (Terlambat)" */
  fullLabel: string;
  /** Cuti/Izin atau Sakit: bebas presensi */
  isOff: boolean;
  /** Karyawan benar-benar presensi masuk dan dihitung hadir */
  isPresent: boolean;
  isLate: boolean;
  lateMinutes: number;
  /** Pengajuan WFH/Dinas Luar disetujui tapi belum/tidak ada presensi (hari ini atau masa depan) */
  isPlanned: boolean;
  location: DayLocation | null;
  leave?: LeaveRequest;
  record?: AttendanceRecord;
}

export interface StatusStyle {
  /** Sel kalender */
  bg: string;
  border: string;
  text: string;
  /** Pill matriks / riwayat */
  pill: string;
}

export const STATUS_STYLES: Record<DayStatusKey | 'LATE_REMOTE', StatusStyle> = {
  PRESENT: {
    bg: 'bg-emerald-100',
    border: 'border-emerald-300',
    text: 'text-emerald-800',
    pill: 'bg-[#DCFCE7] text-[#15803D] hover:bg-[#BBF7D0]',
  },
  LATE: {
    bg: 'bg-amber-100',
    border: 'border-amber-300',
    text: 'text-amber-800',
    pill: 'bg-[#FEF3C7] text-[#B45309] hover:bg-[#FDE68A]',
  },
  LATE_REMOTE: {
    bg: 'bg-amber-100',
    border: 'border-amber-300',
    text: 'text-amber-800',
    pill: 'bg-[#FEF3C7] text-[#B45309] hover:bg-[#FDE68A]',
  },
  WFH: {
    bg: 'bg-indigo-100',
    border: 'border-indigo-300',
    text: 'text-indigo-800',
    pill: 'bg-[#E0E7FF] text-[#4338CA] hover:bg-[#C7D2FE]',
  },
  BUSINESS_TRIP: {
    bg: 'bg-purple-100',
    border: 'border-purple-300',
    text: 'text-purple-800',
    pill: 'bg-[#F3E8FF] text-[#7E22CE] hover:bg-[#E9D5FF]',
  },
  LEAVE: {
    bg: 'bg-sky-100',
    border: 'border-sky-300',
    text: 'text-sky-800',
    pill: 'bg-[#E0F2FE] text-[#0369A1] hover:bg-[#BAE6FD]',
  },
  SICK: {
    bg: 'bg-rose-100',
    border: 'border-rose-300',
    text: 'text-rose-800',
    pill: 'bg-[#FFE4E6] text-[#BE123C] hover:bg-[#FECDD3]',
  },
  HOLIDAY: {
    bg: 'bg-red-50/70',
    border: 'border-red-300',
    text: 'text-red-600',
    pill: 'bg-red-50 text-red-500',
  },
  ABSENT: {
    bg: 'bg-slate-200/80',
    border: 'border-slate-400',
    text: 'text-slate-700',
    pill: 'bg-slate-200 text-slate-700 hover:bg-slate-300',
  },
  TODAY_PENDING: {
    bg: 'bg-blue-50/80',
    border: 'border-blue-300',
    text: 'text-[#1E3A8A]',
    pill: 'bg-blue-50 text-[#1E3A8A]',
  },
  FUTURE: {
    bg: 'bg-slate-50/80',
    border: 'border-slate-200/80',
    text: 'text-slate-700',
    pill: 'bg-slate-100 text-slate-500',
  },
};

/** Gaya efektif sebuah status (status kerja yang terlambat memakai warna amber). */
export function getStatusStyle(status: DailyStatus): StatusStyle {
  if ((status.key === 'WFH' || status.key === 'BUSINESS_TRIP') && status.isLate) {
    return STATUS_STYLES.LATE_REMOTE;
  }
  return STATUS_STYLES[status.key];
}

const LEAVE_PRIORITY: Record<LeaveCategory, number> = {
  SICK: 4,
  LEAVE: 3,
  BUSINESS_TRIP: 2,
  WFH: 1,
};

export const LEAVE_CATEGORY_LABEL: Record<LeaveCategory, string> = {
  LEAVE: 'Cuti / Izin',
  WFH: 'WFH',
  SICK: 'Sakit',
  BUSINESS_TRIP: 'Dinas Luar',
};

/** Cuti/Izin & Sakit = OFF (bebas presensi). WFH & Dinas Luar = tetap bekerja. */
export function isOffCategory(category?: LeaveCategory | string): boolean {
  return category === 'LEAVE' || category === 'SICK' || category === 'ANNUAL';
}

export function isRemoteWorkCategory(category?: LeaveCategory | string): boolean {
  return category === 'WFH' || category === 'BUSINESS_TRIP';
}

function sameUser(
  item: { userId?: string; userName?: string },
  user: UserRef
): boolean {
  if (item.userId && item.userId === user.id) return true;
  return (
    !!item.userName && !!user.name && item.userName.toLowerCase() === user.name.toLowerCase()
  );
}

export function isDateInRange(date: string, start: string, end: string): boolean {
  return date >= start && date <= end;
}

/** Dua rentang tanggal (YYYY-MM-DD) saling beririsan? */
export function dateRangesOverlap(
  aStart: string,
  aEnd: string,
  bStart: string,
  bEnd: string
): boolean {
  return aStart <= bEnd && bStart <= aEnd;
}

/**
 * Pengajuan APPROVED milik user pada tanggal tertentu.
 * Jika ada lebih dari satu (data lama), dipilih berdasarkan prioritas (bukan urutan array).
 */
export function getApprovedLeaveForDate(
  leaves: LeaveRequest[],
  user: UserRef,
  date: string
): LeaveRequest | undefined {
  let best: LeaveRequest | undefined;
  for (const l of leaves || []) {
    if (l.status !== 'APPROVED') continue;
    if (!sameUser(l, user)) continue;
    if (!isDateInRange(date, l.startDate, l.endDate)) continue;
    const cat = ((l.category as string) === 'ANNUAL' ? 'LEAVE' : l.category) as LeaveCategory;
    const bestCat = best
      ? (((best.category as string) === 'ANNUAL' ? 'LEAVE' : best.category) as LeaveCategory)
      : undefined;
    if (!best || LEAVE_PRIORITY[cat] > LEAVE_PRIORITY[bestCat!]) {
      best = l;
    }
  }
  return best;
}

/** Cari pengajuan (PENDING/APPROVED) milik user yang bertabrakan tanggal dengan rentang baru. */
export function findConflictingLeave(
  leaves: LeaveRequest[],
  user: UserRef,
  startDate: string,
  endDate: string,
  excludeId?: string
): LeaveRequest | undefined {
  return (leaves || []).find(
    (l) =>
      l.id !== excludeId &&
      (l.status === 'PENDING' || l.status === 'APPROVED') &&
      sameUser(l, user) &&
      dateRangesOverlap(startDate, endDate, l.startDate, l.endDate)
  );
}

export function findRecordForDate(
  records: AttendanceRecord[],
  user: UserRef,
  date: string
): AttendanceRecord | undefined {
  return (records || []).find((r) => r.date === date && sameUser(r, user));
}

export function isWeekendDate(date: string): boolean {
  const [y, m, d] = date.split('-').map((n) => parseInt(n, 10));
  if (!y || !m || !d) return false;
  const day = new Date(y, m - 1, d).getDay();
  return day === 0 || day === 6;
}

/** Hitung jumlah hari kalender inklusif antara dua tanggal YYYY-MM-DD. */
export function countInclusiveDays(start: string, end: string): number {
  const [sy, sm, sd] = start.split('-').map((n) => parseInt(n, 10));
  const [ey, em, ed] = end.split('-').map((n) => parseInt(n, 10));
  const s = Date.UTC(sy, sm - 1, sd);
  const e = Date.UTC(ey, em - 1, ed);
  if (e < s) return 1;
  return Math.round((e - s) / 86400000) + 1;
}

export function shiftDate(date: string, deltaDays: number): string {
  const [y, m, d] = date.split('-').map((n) => parseInt(n, 10));
  const t = new Date(Date.UTC(y, m - 1, d + deltaDays));
  return `${t.getUTCFullYear()}-${String(t.getUTCMonth() + 1).padStart(2, '0')}-${String(
    t.getUTCDate()
  ).padStart(2, '0')}`;
}

/** Lokasi kerja efektif sebuah record presensi (memperhitungkan izin WFH/Dinas Luar). */
function resolveRecordLocation(
  record: AttendanceRecord,
  leave?: LeaveRequest
): DayLocation {
  if (
    leave?.category === 'BUSINESS_TRIP' ||
    record.clockInLocationStatus === 'DINAS_APPROVED' ||
    record.workMode === 'DINAS'
  ) {
    return 'BUSINESS_TRIP';
  }
  if (
    leave?.category === 'WFH' ||
    record.clockInLocationStatus === 'WFH_APPROVED' ||
    record.workMode === 'WFH'
  ) {
    return 'WFH';
  }
  if (
    record.clockInLocationStatus === 'OUT_OF_RANGE' ||
    (record.clockInDistanceMeter !== undefined &&
      record.clockInDistanceMeter > 100 &&
      record.clockInLocationStatus !== 'IN_OFFICE')
  ) {
    return 'OUT_OF_RANGE';
  }
  return 'OFFICE';
}

function build(
  key: DayStatusKey,
  extra: Partial<DailyStatus> = {}
): DailyStatus {
  const labels: Record<DayStatusKey, { label: string; short: string }> = {
    PRESENT: { label: 'Hadir (Kantor)', short: 'Hadir' },
    LATE: { label: 'Terlambat', short: 'Terlambat' },
    WFH: { label: 'WFH', short: 'WFH' },
    BUSINESS_TRIP: { label: 'Dinas Luar', short: 'Dinas Luar' },
    LEAVE: { label: 'Cuti / Izin', short: 'Cuti / Izin' },
    SICK: { label: 'Sakit', short: 'Sakit' },
    HOLIDAY: { label: 'Libur (Sabtu & Minggu)', short: 'Libur' },
    ABSENT: { label: 'Tidak Hadir', short: 'Tidak Hadir' },
    TODAY_PENDING: { label: 'Hari Ini (Belum Presensi)', short: 'Belum Presensi' },
    FUTURE: { label: 'Hari Kerja', short: '—' },
  };
  const isLate = extra.isLate ?? false;
  const lateMinutes = extra.lateMinutes ?? 0;
  const base = labels[key];
  let fullLabel = base.label;
  if (isLate && (key === 'WFH' || key === 'BUSINESS_TRIP')) {
    fullLabel = `${base.label} (Terlambat${lateMinutes ? ` ${lateMinutes} mnt` : ''})`;
  } else if (isLate && key === 'LATE' && lateMinutes) {
    fullLabel = `Terlambat (${lateMinutes} mnt)`;
  }
  return {
    key,
    label: base.label,
    shortLabel: base.short,
    fullLabel,
    isOff: key === 'LEAVE' || key === 'SICK',
    isPresent: false,
    isLate,
    lateMinutes,
    isPlanned: false,
    location: null,
    ...extra,
  };
}

/**
 * Menyimpulkan status satu karyawan pada satu tanggal. Inilah satu-satunya tempat aturan status.
 */
export function getDailyStatus(params: {
  user: UserRef;
  date: string;
  records: AttendanceRecord[];
  leaves: LeaveRequest[];
  /** YYYY-MM-DD hari ini */
  today: string;
}): DailyStatus {
  const { user, date, records, leaves, today } = params;
  const record = findRecordForDate(records, user, date);
  const leave = getApprovedLeaveForDate(leaves, user, date);

  // 1. OFF (Sakit / Cuti-Izin) selalu menang, record presensi (jika ada) hanya jadi arsip.
  if (leave && isOffCategory(leave.category)) {
    return build(leave.category === 'SICK' ? 'SICK' : 'LEAVE', { leave, record });
  }

  // 2. Ada presensi masuk
  if (record && record.clockInTime) {
    const isLate =
      record.clockInStatus === 'LATE' ||
      (record.clockInLateMinutes !== undefined && record.clockInLateMinutes > 0);
    const lateMinutes = record.clockInLateMinutes || 0;
    const location = resolveRecordLocation(record, leave);
    if (location === 'BUSINESS_TRIP') {
      return build('BUSINESS_TRIP', { isPresent: true, isLate, lateMinutes, location, leave, record });
    }
    if (location === 'WFH') {
      return build('WFH', { isPresent: true, isLate, lateMinutes, location, leave, record });
    }
    return build(isLate ? 'LATE' : 'PRESENT', {
      isPresent: true,
      isLate,
      lateMinutes,
      location,
      leave,
      record,
    });
  }

  // 3. WFH / Dinas Luar disetujui tapi belum ada presensi
  if (leave && isRemoteWorkCategory(leave.category)) {
    const key: DayStatusKey = leave.category === 'WFH' ? 'WFH' : 'BUSINESS_TRIP';
    if (date >= today) {
      return build(key, {
        isPlanned: true,
        location: leave.category === 'WFH' ? 'WFH' : 'BUSINESS_TRIP',
        leave,
        record,
      });
    }
    // Hari sudah lewat dan tidak ada presensi: tidak dihitung hadir.
    return build('ABSENT', { leave, record });
  }

  // 4. Tanpa presensi & tanpa pengajuan
  if (isWeekendDate(date)) return build('HOLIDAY');
  if (date === today) return build('TODAY_PENDING');
  if (date > today) return build('FUTURE');
  return build('ABSENT');
}

/**
 * Tampilan sel kalender (beranda & presensi). Hari kerja lampau tanpa presensi & tanpa pengajuan
 * dibiarkan netral ("Hari Kerja") agar tidak menandai hari sebelum karyawan bergabung sebagai alpa.
 */
export function getCalendarCell(status: DailyStatus): {
  label: string;
  bg: string;
  border: string;
  text: string;
  isPlanned: boolean;
} {
  if (status.key === 'ABSENT' && !status.leave) {
    const s = STATUS_STYLES.FUTURE;
    return { label: 'Hari Kerja', bg: s.bg, border: s.border, text: s.text, isPlanned: false };
  }
  const s = getStatusStyle(status);
  return {
    label: status.isPlanned ? `${status.fullLabel} (Rencana, belum presensi)` : status.fullLabel,
    bg: s.bg,
    border: s.border,
    text: s.text,
    isPlanned: status.isPlanned,
  };
}
