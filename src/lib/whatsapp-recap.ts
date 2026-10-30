import { AttendanceRecord, DailyTaskLog, LeaveRequest, User, EmploymentType } from '../types/index.ts';
import { formatIndonesianDate } from './time-utils.ts';

export const EMPLOYMENT_TYPE_LABELS: Record<EmploymentType, string> = {
  INTERN: 'Magang',
  FREELANCE: 'Freelance',
  CONTRACT: 'Kontrak',
  PERMANENT: 'Tetap',
};

/**
 * Format WhatsApp Rekap Sesuai Spesifikasi Poin 6:
 * -----------------------------------------
 * *LAPORAN KEHADIRAN & TASK HARIAN*
 * 📅 Tanggal : [Hari, Tanggal Bulan Tahun]
 * 👤 Nama    : [Nama Karyawan] ([Tipe Karyawan])
 * ⏰ Masuk   : [08:30 WIB] (Mode: WFO)
 * 
 * 📋 *Daftar Task yang Dikerjakan:*
 * 1. [Task 1]
 * 2. [Task 2]
 * 
 * Status Kehadiran: Tervalidasi
 * -----------------------------------------
 */
export function generateWhatsAppAttendanceRecap(params: {
  attendance?: AttendanceRecord | null;
  dailyTask?: DailyTaskLog | null;
  user: User;
  dateStr?: string;
}): string {
  const { attendance, dailyTask, user, dateStr } = params;
  const dateFormatted = formatIndonesianDate(dateStr || attendance?.date || new Date().toISOString().substring(0, 10));
  const typeLabel = EMPLOYMENT_TYPE_LABELS[user.employmentType] || 'Karyawan';
  
  const clockInDisplay = attendance?.clockInTime ? `${attendance.clockInTime} WIB` : '08:30 WIB';
  const modeDisplay = attendance?.workMode || 'WFO';

  // Daftar Task yang Dikerjakan
  const taskList = dailyTask?.tasks && dailyTask.tasks.length > 0
    ? dailyTask.tasks
    : attendance?.tasksDoneSummary && attendance.tasksDoneSummary.length > 0
    ? attendance.tasksDoneSummary
    : ['Menyelesaikan aktivitas kerja harian & koordinasi tim'];

  const formattedTasks = taskList
    .map((task, idx) => `${idx + 1}. ${task}`)
    .join('\n');

  return `*LAPORAN KEHADIRAN & TASK HARIAN*
📅 Tanggal : ${dateFormatted}
👤 Nama    : ${user.name} (${typeLabel})
⏰ Masuk   : ${clockInDisplay} (Mode: ${modeDisplay})

📋 *Daftar Task yang Dikerjakan:*
${formattedTasks}

Status Kehadiran: Tervalidasi
_Sistem Absenku Kantor Modern_`;
}

/**
 * Format WhatsApp Rekap Pengajuan Izin
 */
export function generateWhatsAppLeaveRecap(leave: LeaveRequest): string {
  const categoryLabels = {
    LEAVE: 'Izin / Cuti',
    WFH: 'Work From Home (WFH)',
    SICK: 'Sakit',
    BUSINESS_TRIP: 'Dinas Luar',
  };

  const typeLabel = EMPLOYMENT_TYPE_LABELS[leave.employmentType] || 'Karyawan';

  return `*PENGAJUAN PERIZINAN KARYAWAN*
👤 Nama      : ${leave.userName} (${typeLabel})
🏢 Divisi    : ${leave.department}
📌 Kategori  : ${categoryLabels[leave.category] || leave.category}
📅 Rentang   : ${leave.startDate} s/d ${leave.endDate} (${leave.totalDays} Hari)
📝 Alasan    : "${leave.reason}"
📎 Lampiran  : ${leave.attachmentName || 'Tidak Ada Lampiran'}
⚡ Status    : ${leave.status === 'APPROVED' ? 'Disetujui' : leave.status === 'REJECTED' ? 'Ditolak' : 'Menunggu Approval Admin'}

_Sistem Absenku Kantor Modern_`;
}

/**
 * Salin teks ke Clipboard browser dengan aman
 */
export async function copyTextToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator?.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
    // Fallback document.execCommand
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.left = '-999999px';
    document.body.appendChild(textArea);
    textArea.select();
    const successful = document.execCommand('copy');
    document.body.removeChild(textArea);
    return successful;
  } catch (err) {
    console.error('Gagal menyalin ke clipboard:', err);
    return false;
  }
}
