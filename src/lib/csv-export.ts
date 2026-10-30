/**
 * Simple & Clean Spreadsheet Export Utility for Absenku
 * Format:
 * - Font: Poppins (Google Fonts link disertakan + fallback sans-serif)
 * - Background judul: Biru Navy (#0F172A / #1E293B) dengan teks putih tebal.
 * - Header kolom tabel, baris data, dan baris total semuanya berlatar belakang putih (#FFFFFF).
 * - Garis tabel (border) abu-abu tipis rapi (#CBD5E1) tanpa warna-warni yang ramai.
 */

import { AttendanceRecord, LeaveRequest } from '../types/index.ts';

// Helper to format minutes to clean string (e.g. 8 Jam 30 Mnt)
export function formatMinutesFriendly(minutes: number = 0): string {
  if (!minutes || minutes <= 0) return '-';
  const hours = Math.floor(minutes / 60);
  const remainingMins = minutes % 60;
  if (hours > 0 && remainingMins > 0) {
    return `${hours} Jam ${remainingMins} Menit`;
  }
  if (hours > 0) {
    return `${hours} Jam`;
  }
  return `${remainingMins} Menit`;
}

// Translate attendance status simply
export function translateAttendanceStatus(status?: string): string {
  switch (status) {
    case 'ON_TIME':
      return 'Tepat Waktu';
    case 'LATE':
      return 'Terlambat';
    case 'EARLY_LEAVE':
      return 'Pulang Cepat';
    case 'OVERTIME':
      return 'Lembur';
    default:
      return status || '-';
  }
}

export interface ExportSpreadsheetOptions {
  filterDate?: string;
  filterStatus?: string;
  generatedBy?: string;
}

/**
 * Generates an ultra-clean Excel & Google Sheets-compatible Spreadsheet (.xls).
 * - Font: Poppins
 * - Background judul: Biru Navy (#0F172A)
 * - Semua elemen tabel lainnya background putih murni (#FFFFFF)
 */
export function generateStyledSpreadsheetHTML(
  records: AttendanceRecord[],
  options?: ExportSpreadsheetOptions
): string {
  const now = new Date();
  const dateFormatted = now.toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

  const totalRecords = records.length;
  const onTimeCount = records.filter((r) => r.clockInStatus === 'ON_TIME').length;
  const lateCount = records.filter((r) => r.clockInStatus === 'LATE').length;
  const totalWorkMinutes = records.reduce((acc, r) => acc + (r.workDurationMinutes || 0), 0);
  const totalWorkFormatted = formatMinutesFriendly(totalWorkMinutes);

  const periodeLabel = options?.filterDate || 'Semua Tanggal';

  return `
    <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
      <head>
        <meta http-equiv="Content-Type" content="text/html; charset=utf-8" />
        <link rel="preconnect" href="https://fonts.googleapis.com">
        <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
        <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700&display=swap" rel="stylesheet">
        <!--[if gte mso 9]>
        <xml>
          <x:ExcelWorkbook>
            <x:ExcelWorksheets>
              <x:ExcelWorksheet>
                <x:Name>Presensi</x:Name>
                <x:WorksheetOptions>
                  <x:DisplayGridlines/>
                </x:WorksheetOptions>
              </x:ExcelWorksheet>
            </x:ExcelWorksheets>
          </x:ExcelWorkbook>
        </xml>
        <![endif]-->
        <style>
          * {
            font-family: 'Poppins', Calibri, 'Segoe UI', Arial, sans-serif !important;
          }
          body {
            font-family: 'Poppins', Calibri, 'Segoe UI', Arial, sans-serif !important;
            margin: 16px;
            background-color: #ffffff;
            color: #0f172a;
          }
          table {
            border-collapse: collapse;
            width: 100%;
            background-color: #ffffff;
            font-family: 'Poppins', Calibri, 'Segoe UI', Arial, sans-serif !important;
          }
          th {
            background-color: #ffffff;
            color: #0f172a;
            font-family: 'Poppins', Calibri, 'Segoe UI', Arial, sans-serif !important;
            font-size: 10pt;
            font-weight: 600;
            padding: 9px 10px;
            border: 1px solid #cbd5e1;
            text-align: center;
          }
          td {
            padding: 8px 10px;
            border: 1px solid #cbd5e1;
            font-family: 'Poppins', Calibri, 'Segoe UI', Arial, sans-serif !important;
            font-size: 9.5pt;
            background-color: #ffffff;
            color: #0f172a;
          }
        </style>
      </head>
      <body style="font-family: 'Poppins', Calibri, 'Segoe UI', Arial, sans-serif;">
        <!-- Header Judul Berwarna Biru Navy Sesuai Gambar (#1E3A8A) -->
        <table style="margin-bottom: 12px; border-collapse: collapse; width: 100%; font-family: 'Poppins', Calibri, sans-serif;">
          <tr>
            <td colspan="10" style="background-color: #1E3A8A; color: #ffffff; font-family: 'Poppins', Calibri, sans-serif; font-size: 13.5pt; font-weight: 700; padding: 12px 14px; text-align: left; border: 1px solid #1E3A8A; letter-spacing: 0.5px;">
              DATA REKAP PRESENSI KARYAWAN
            </td>
          </tr>
          <tr>
            <td colspan="10" style="background-color: #ffffff; color: #475569; font-family: 'Poppins', Calibri, sans-serif; font-size: 9pt; padding: 7px 14px; border: 1px solid #cbd5e1;">
              Periode: <b style="color: #0F172A;">${periodeLabel}</b> &nbsp;|&nbsp; Tanggal Cetak: <b style="color: #0F172A;">${dateFormatted}</b> &nbsp;|&nbsp; Total: <b style="color: #0F172A;">${totalRecords} Data</b>
            </td>
          </tr>
        </table>

        <!-- Tabel Data: Font Poppins & Semua Putih Bersih -->
        <table style="border-collapse: collapse; width: 100%; font-family: 'Poppins', Calibri, sans-serif;">
          <thead>
            <tr style="background-color: #ffffff;">
              <th style="background-color: #ffffff; color: #0f172a; font-family: 'Poppins', Calibri, sans-serif; border: 1px solid #cbd5e1; width: 45px; text-align: center;">No</th>
              <th style="background-color: #ffffff; color: #0f172a; font-family: 'Poppins', Calibri, sans-serif; border: 1px solid #cbd5e1; text-align: left; width: 180px;">Nama Karyawan</th>
              <th style="background-color: #ffffff; color: #0f172a; font-family: 'Poppins', Calibri, sans-serif; border: 1px solid #cbd5e1; text-align: left; width: 140px;">Divisi</th>
              <th style="background-color: #ffffff; color: #0f172a; font-family: 'Poppins', Calibri, sans-serif; border: 1px solid #cbd5e1; width: 100px; text-align: center;">Tanggal</th>
              <th style="background-color: #ffffff; color: #0f172a; font-family: 'Poppins', Calibri, sans-serif; border: 1px solid #cbd5e1; width: 90px; text-align: center;">Masuk</th>
              <th style="background-color: #ffffff; color: #0f172a; font-family: 'Poppins', Calibri, sans-serif; border: 1px solid #cbd5e1; width: 110px; text-align: center;">Status</th>
              <th style="background-color: #ffffff; color: #0f172a; font-family: 'Poppins', Calibri, sans-serif; border: 1px solid #cbd5e1; width: 90px; text-align: center;">Terlambat</th>
              <th style="background-color: #ffffff; color: #0f172a; font-family: 'Poppins', Calibri, sans-serif; border: 1px solid #cbd5e1; width: 90px; text-align: center;">Pulang</th>
              <th style="background-color: #ffffff; color: #0f172a; font-family: 'Poppins', Calibri, sans-serif; border: 1px solid #cbd5e1; width: 100px; text-align: center;">Durasi</th>
              <th style="background-color: #ffffff; color: #0f172a; font-family: 'Poppins', Calibri, sans-serif; border: 1px solid #cbd5e1; text-align: left; width: 160px;">Catatan</th>
            </tr>
          </thead>
          <tbody>
            ${records
              .map((r, i) => {
                return `
                <tr style="background-color: #ffffff;">
                  <td style="background-color: #ffffff; font-family: 'Poppins', Calibri, sans-serif; text-align: center; border: 1px solid #cbd5e1;">${i + 1}</td>
                  <td style="background-color: #ffffff; font-family: 'Poppins', Calibri, sans-serif; font-weight: 600; color: #0f172a; border: 1px solid #cbd5e1;">${r.userName}</td>
                  <td style="background-color: #ffffff; font-family: 'Poppins', Calibri, sans-serif; border: 1px solid #cbd5e1;">${r.department || 'IT Development'}</td>
                  <td style="background-color: #ffffff; font-family: 'Poppins', Calibri, sans-serif; text-align: center; border: 1px solid #cbd5e1;">${r.date}</td>
                  <td style="background-color: #ffffff; font-family: 'Poppins', Calibri, sans-serif; text-align: center; border: 1px solid #cbd5e1;">${r.clockInTime ? `${r.clockInTime} WIB` : '-'}</td>
                  <td style="background-color: #ffffff; font-family: 'Poppins', Calibri, sans-serif; text-align: center; border: 1px solid #cbd5e1;">
                    ${translateAttendanceStatus(r.clockInStatus)}
                  </td>
                  <td style="background-color: #ffffff; font-family: 'Poppins', Calibri, sans-serif; text-align: center; border: 1px solid #cbd5e1;">
                    ${r.clockInLateMinutes > 0 ? formatMinutesFriendly(r.clockInLateMinutes) : '-'}
                  </td>
                  <td style="background-color: #ffffff; font-family: 'Poppins', Calibri, sans-serif; text-align: center; border: 1px solid #cbd5e1;">${r.clockOutTime ? `${r.clockOutTime} WIB` : '-'}</td>
                  <td style="background-color: #ffffff; font-family: 'Poppins', Calibri, sans-serif; text-align: center; border: 1px solid #cbd5e1;">
                    ${r.workDurationMinutes ? formatMinutesFriendly(r.workDurationMinutes) : '-'}
                  </td>
                  <td style="background-color: #ffffff; font-family: 'Poppins', Calibri, sans-serif; border: 1px solid #cbd5e1;">${r.notes || '-'}</td>
                </tr>`;
              })
              .join('')}
            <!-- Baris Total Bersih (Background Putih) -->
            <tr style="background-color: #ffffff; font-weight: 600;">
              <td colspan="4" style="background-color: #ffffff; font-family: 'Poppins', Calibri, sans-serif; text-align: right; padding: 9px 10px; border: 1px solid #cbd5e1;">Total Karyawan:</td>
              <td style="background-color: #ffffff; font-family: 'Poppins', Calibri, sans-serif; text-align: center; border: 1px solid #cbd5e1;">${totalRecords} Orang</td>
              <td style="background-color: #ffffff; font-family: 'Poppins', Calibri, sans-serif; text-align: center; border: 1px solid #cbd5e1;">${onTimeCount} Tepat / ${lateCount} Telat</td>
              <td style="background-color: #ffffff; font-family: 'Poppins', Calibri, sans-serif; text-align: center; border: 1px solid #cbd5e1;">-</td>
              <td style="background-color: #ffffff; font-family: 'Poppins', Calibri, sans-serif; text-align: right; padding: 9px 10px; border: 1px solid #cbd5e1;">Total Jam:</td>
              <td style="background-color: #ffffff; font-family: 'Poppins', Calibri, sans-serif; text-align: center; color: #0F172A; border: 1px solid #cbd5e1;">${totalWorkFormatted}</td>
              <td style="background-color: #ffffff; font-family: 'Poppins', Calibri, sans-serif; border: 1px solid #cbd5e1;"></td>
            </tr>
          </tbody>
        </table>
      </body>
    </html>
  `;
}

/**
 * Unified Single Spreadsheet Downloader
 * Downloads clean, minimalist Excel/Sheets-compatible spreadsheet (.xls)
 */
export function downloadAttendanceSpreadsheet(
  records: AttendanceRecord[],
  filenamePrefix = 'Laporan_Presensi_Absenku',
  options?: ExportSpreadsheetOptions
): void {
  const htmlContent = generateStyledSpreadsheetHTML(records, options);
  const blob = new Blob(['\uFEFF' + htmlContent], {
    type: 'application/vnd.ms-excel;charset=utf-8',
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  const dateStr = options?.filterDate || new Date().toISOString().substring(0, 10);
  link.setAttribute('href', url);
  link.setAttribute('download', `${filenamePrefix}_${dateStr}.xls`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export interface PersonalAttendanceExportItem {
  dateStr: string;
  hasCheckmark?: boolean;
  clockIn: string;
  clockOut: string;
  statusText: string;
  locationMode: string;
  taskSummary: string;
}

/**
 * Generates an Excel-compatible HTML spreadsheet for Personal Attendance
 */
export function generatePersonalSpreadsheetHTML(
  employeeName: string,
  department: string,
  rows: PersonalAttendanceExportItem[],
  filterCategoryLabel = 'Semua Status'
): string {
  const now = new Date();
  const dateFormatted = now.toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

  const totalRows = rows.length;
  const hadirCount = rows.filter((r) => r.statusText === 'Hadir' || r.statusText === 'Terlambat').length;
  const cutiCount = rows.filter((r) => r.statusText.includes('Cuti') || r.statusText.includes('Izin')).length;
  const wfhCount = rows.filter((r) => r.statusText === 'WFH' || r.locationMode.includes('WFH')).length;
  const dinasCount = rows.filter((r) => r.statusText === 'Dinas Luar' || r.locationMode.includes('Dinas Luar')).length;
  const liburCount = rows.filter((r) => r.statusText === 'Libur').length;

  return `
    <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
      <head>
        <meta http-equiv="Content-Type" content="text/html; charset=utf-8" />
        <link rel="preconnect" href="https://fonts.googleapis.com">
        <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
        <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700&display=swap" rel="stylesheet">
        <!--[if gte mso 9]>
        <xml>
          <x:ExcelWorkbook>
            <x:ExcelWorksheets>
              <x:ExcelWorksheet>
                <x:Name>Presensi Pribadi</x:Name>
                <x:WorksheetOptions>
                  <x:DisplayGridlines/>
                </x:WorksheetOptions>
              </x:ExcelWorksheet>
            </x:ExcelWorksheets>
          </x:ExcelWorkbook>
        </xml>
        <![endif]-->
        <style>
          * {
            font-family: 'Poppins', Calibri, 'Segoe UI', Arial, sans-serif !important;
          }
          body {
            font-family: 'Poppins', Calibri, 'Segoe UI', Arial, sans-serif !important;
            margin: 16px;
            background-color: #ffffff;
            color: #0f172a;
          }
          table {
            border-collapse: collapse;
            width: 100%;
            background-color: #ffffff;
          }
          th {
            background-color: #ffffff;
            color: #0f172a;
            font-size: 10pt;
            font-weight: 600;
            padding: 9px 10px;
            border: 1px solid #cbd5e1;
            text-align: center;
          }
          td {
            padding: 8px 10px;
            border: 1px solid #cbd5e1;
            font-size: 9.5pt;
            background-color: #ffffff;
            color: #0f172a;
          }
        </style>
      </head>
      <body>
        <!-- Header Judul Biru Navy (#1E3A8A) -->
        <table style="margin-bottom: 12px; border-collapse: collapse; width: 100%;">
          <tr>
            <td colspan="8" style="background-color: #1E3A8A; color: #ffffff; font-size: 13.5pt; font-weight: 700; padding: 12px 14px; text-align: left; border: 1px solid #1E3A8A;">
              DATA REKAP PRESENSI PRIBADI KARYAWAN
            </td>
          </tr>
          <tr>
            <td colspan="8" style="background-color: #ffffff; color: #475569; font-size: 9pt; padding: 7px 14px; border: 1px solid #cbd5e1;">
              Nama Karyawan: <b style="color: #0F172A;">${employeeName}</b> &nbsp;|&nbsp;
              Divisi: <b style="color: #0F172A;">${department}</b> &nbsp;|&nbsp;
              Kategori: <b style="color: #0F172A;">${filterCategoryLabel}</b> &nbsp;|&nbsp;
              Tanggal Cetak: <b style="color: #0F172A;">${dateFormatted}</b> &nbsp;|&nbsp;
              Total Data: <b style="color: #0F172A;">${totalRows} Hari</b>
            </td>
          </tr>
        </table>

        <!-- Tabel Data -->
        <table style="border-collapse: collapse; width: 100%;">
          <thead>
            <tr>
              <th style="width: 45px; text-align: center;">No</th>
              <th style="width: 110px; text-align: center;">Tanggal</th>
              <th style="width: 80px; text-align: center;">Presensi</th>
              <th style="width: 95px; text-align: center;">Jam Masuk</th>
              <th style="width: 95px; text-align: center;">Jam Pulang</th>
              <th style="width: 120px; text-align: center;">Status Kehadiran</th>
              <th style="width: 130px; text-align: center;">Lokasi / Mode</th>
              <th style="text-align: left; width: 220px;">Catatan / Ringkasan Tugas</th>
            </tr>
          </thead>
          <tbody>
            ${rows
              .map((r, i) => {
                return `
                <tr>
                  <td style="text-align: center;">${i + 1}</td>
                  <td style="text-align: center; font-weight: 500;">${r.dateStr}</td>
                  <td style="text-align: center;">${r.hasCheckmark ? 'Hadir' : '-'}</td>
                  <td style="text-align: center;">${r.clockIn}</td>
                  <td style="text-align: center;">${r.clockOut}</td>
                  <td style="text-align: center; font-weight: 600;">${r.statusText}</td>
                  <td style="text-align: center;">${r.locationMode}</td>
                  <td>${r.taskSummary}</td>
                </tr>`;
              })
              .join('')}
            <!-- Baris Total -->
            <tr style="font-weight: 600;">
              <td colspan="3" style="text-align: right; padding: 9px 10px;">Ringkasan Data:</td>
              <td colspan="2" style="text-align: center;">${hadirCount} Hadir &bull; ${cutiCount} Cuti/Izin</td>
              <td colspan="2" style="text-align: center;">${wfhCount} WFH &bull; ${dinasCount} Dinas Luar</td>
              <td style="text-align: left;">${liburCount} Hari Libur (Total ${totalRows} Hari)</td>
            </tr>
          </tbody>
        </table>
      </body>
    </html>
  `;
}

/**
 * Downloads Spreadsheet (.xls) for Personal Attendance
 */
export function downloadPersonalAttendanceSpreadsheet(
  employeeName: string,
  department: string,
  rows: PersonalAttendanceExportItem[],
  filterCategoryLabel = 'Semua Status'
): void {
  const htmlContent = generatePersonalSpreadsheetHTML(employeeName, department, rows, filterCategoryLabel);
  const blob = new Blob(['\uFEFF' + htmlContent], {
    type: 'application/vnd.ms-excel;charset=utf-8',
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  const dateStr = new Date().toISOString().substring(0, 10);
  const safeName = employeeName.replace(/[^a-zA-Z0-9]/g, '_');
  link.setAttribute('href', url);
  link.setAttribute('download', `Laporan_Presensi_Pribadi_${safeName}_${dateStr}.xls`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// Backward compatibility aliases
export const downloadAttendanceCSV = downloadAttendanceSpreadsheet;
export const downloadExcelStyledSpreadsheet = downloadAttendanceSpreadsheet;

/**
 * Downloads Spreadsheet (.xls) for Leave Requests (Pengajuan Perizinan & Cuti)
 */
export function downloadLeaveSpreadsheet(
  leaves: LeaveRequest[],
  filterCategoryLabel = 'Semua Kategori'
): void {
  const now = new Date();
  const dateFormatted = now.toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
  const approvedCount = leaves.filter((l) => l.status === 'APPROVED').length;
  const pendingCount = leaves.filter((l) => l.status === 'PENDING').length;
  const rejectedCount = leaves.filter((l) => l.status === 'REJECTED').length;

  const categoryMap: Record<string, string> = {
    LEAVE: 'Izin / Cuti',
    WFH: 'Work From Home (WFH)',
    SICK: 'Sakit',
    BUSINESS_TRIP: 'Dinas Luar',
  };

  const statusMap: Record<string, string> = {
    APPROVED: 'Disetujui',
    PENDING: 'Menunggu Approval',
    REJECTED: 'Ditolak',
  };

  const html = `
    <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
      <head>
        <meta http-equiv="Content-Type" content="text/html; charset=utf-8" />
        <link rel="preconnect" href="https://fonts.googleapis.com">
        <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
        <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700&display=swap" rel="stylesheet">
        <style>
          * { font-family: 'Poppins', Calibri, 'Segoe UI', Arial, sans-serif !important; }
          body { font-family: 'Poppins', Calibri, 'Segoe UI', Arial, sans-serif !important; margin: 16px; background-color: #ffffff; color: #0f172a; }
          table { border-collapse: collapse; width: 100%; background-color: #ffffff; }
          th { background-color: #ffffff; color: #0f172a; font-size: 10pt; font-weight: 600; padding: 9px 10px; border: 1px solid #cbd5e1; text-align: center; }
          td { padding: 8px 10px; border: 1px solid #cbd5e1; font-size: 9.5pt; background-color: #ffffff; color: #0f172a; }
        </style>
      </head>
      <body>
        <table style="margin-bottom: 12px; border-collapse: collapse; width: 100%;">
          <tr>
            <td colspan="9" style="background-color: #1E3A8A; color: #ffffff; font-size: 13.5pt; font-weight: 700; padding: 12px 14px; text-align: left; border: 1px solid #1E3A8A;">
              DATA REKAP PENGAJUAN PERIZINAN &amp; CUTI KARYAWAN
            </td>
          </tr>
          <tr>
            <td colspan="9" style="background-color: #ffffff; color: #475569; font-size: 9pt; padding: 7px 14px; border: 1px solid #cbd5e1;">
              Kategori: <b style="color: #0F172A;">${filterCategoryLabel}</b> &nbsp;|&nbsp; Tanggal Cetak: <b style="color: #0F172A;">${dateFormatted}</b> &nbsp;|&nbsp; Total: <b style="color: #0F172A;">${leaves.length} Pengajuan</b>
            </td>
          </tr>
        </table>
        <table>
          <thead>
            <tr>
              <th style="width: 35px;">No</th>
              <th style="width: 140px;">Nama Karyawan</th>
              <th style="width: 110px;">Departemen</th>
              <th style="width: 100px;">Kategori</th>
              <th style="width: 160px;">Rentang Waktu</th>
              <th style="width: 60px;">Durasi</th>
              <th>Alasan Pengajuan</th>
              <th style="width: 110px;">Status</th>
              <th style="width: 100px;">Tgl Diajukan</th>
            </tr>
          </thead>
          <tbody>
            ${leaves
              .map(
                (l, i) => `
                <tr>
                  <td style="text-align: center;">${i + 1}</td>
                  <td style="font-weight: 600;">${l.userName}</td>
                  <td>${l.department || '-'}</td>
                  <td style="text-align: center;">${categoryMap[l.category] || l.category}</td>
                  <td style="text-align: center;">${l.startDate} s/d ${l.endDate}</td>
                  <td style="text-align: center;">${l.totalDays} Hari</td>
                  <td>${l.reason}</td>
                  <td style="text-align: center; font-weight: 600;">${statusMap[l.status] || l.status}</td>
                  <td style="text-align: center;">${l.appliedAt || '-'}</td>
                </tr>
              `
              )
              .join('')}
            <tr style="font-weight: 600;">
              <td colspan="4" style="text-align: right; padding: 9px 10px;">Ringkasan Data:</td>
              <td colspan="3" style="text-align: center;">${approvedCount} Disetujui &bull; ${pendingCount} Menunggu &bull; ${rejectedCount} Ditolak</td>
              <td colspan="2" style="text-align: left;">Total: ${leaves.length} Pengajuan</td>
            </tr>
          </tbody>
        </table>
      </body>
    </html>
  `;

  const blob = new Blob(['\uFEFF' + html], {
    type: 'application/vnd.ms-excel;charset=utf-8',
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  const dateStr = now.toISOString().substring(0, 10);
  link.setAttribute('href', url);
  link.setAttribute('download', `Laporan_Pengajuan_Izin_Cuti_${dateStr}.xls`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
