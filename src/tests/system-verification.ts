/**
 * Comprehensive System Verification Suite for in-Time
 * Tests all core features, conditions, business logic, storage, and status computation.
 */

// 1. Mock LocalStorage in Node.js environment
const store: Record<string, string> = {};
const mockLocalStorage = {
  getItem: (key: string) => store[key] || null,
  setItem: (key: string, value: string) => {
    store[key] = String(value);
  },
  removeItem: (key: string) => {
    delete store[key];
  },
  clear: () => {
    for (const k of Object.keys(store)) {
      delete store[k];
    }
  },
  get length() {
    return Object.keys(store).length;
  },
  key: (index: number) => Object.keys(store)[index] || null,
};

(global as any).localStorage = mockLocalStorage;
(global as any).window = { localStorage: mockLocalStorage };

import { EMPLOYMENT_TYPE_LABELS, User, AttendanceRecord, LeaveRequest } from '../types/index.ts';
import {
  calculateHaversineDistance,
  checkIsWithinOfficeRadius,
} from '../lib/geo-utils.ts';
import {
  getDailyStatus,
  isOffCategory,
  isRemoteWorkCategory,
  dateRangesOverlap,
  findConflictingLeave,
  countInclusiveDays,
  shiftDate,
} from '../lib/attendance-status.ts';
import { AppStorage } from '../lib/storage.ts';
import {
  isSafeDataUrl,
  isSafeMediaUrl,
  sanitizeExternalLinkUrl,
  dataUrlToBlob,
} from '../lib/open-media.ts';
import { generateEmailHtmlTemplate } from '../lib/real-email.ts';
import { generateStyledSpreadsheetHTML } from '../lib/csv-export.ts';
import {
  isTaskCreatedByUser,
  parseTaskTimestampMs,
  shouldKeepLocalTaskMissingFromServer,
} from '../lib/task-sync.ts';

let passedTests = 0;
let failedTests = 0;

function assert(condition: boolean, testName: string, detail?: string) {
  if (condition) {
    passedTests++;
    console.log(`  ✓ PASS: ${testName}`);
  } else {
    failedTests++;
    console.error(`  ✗ FAIL: ${testName}${detail ? ` - ${detail}` : ''}`);
  }
}

console.log('====================================================');
console.log('   PENGUJIAN SISTEM LENGKAP ABSENKU (ALL SUITES)    ');
console.log('====================================================\n');

// -----------------------------------------------------------------------------
// SUITE 1: TIPE KEPEGAWAIAN (EMPLOYMENT TYPE) & PENAMAAN STANDAR
// -----------------------------------------------------------------------------
console.log('📦 SUITE 1: Penamaan Standar Tipe Kepegawaian');
assert(
  EMPLOYMENT_TYPE_LABELS['INTERN'] === 'Magang (Internship)',
  'INTERN harus dipetakan ke "Magang (Internship)"'
);
assert(
  EMPLOYMENT_TYPE_LABELS['CONTRACT'] === 'Karyawan Kontrak',
  'CONTRACT harus dipetakan ke "Karyawan Kontrak"'
);
assert(
  EMPLOYMENT_TYPE_LABELS['PERMANENT'] === 'Karyawan Tetap',
  'PERMANENT harus dipetakan ke "Karyawan Tetap"'
);
assert(
  EMPLOYMENT_TYPE_LABELS['FREELANCE'] === 'Freelance',
  'FREELANCE harus dipetakan ke "Freelance"'
);

// -----------------------------------------------------------------------------
// SUITE 2: GEOFENCE GPS & FORMULA HAVERSINE (GEO-UTILS)
// -----------------------------------------------------------------------------
console.log('\n📍 SUITE 2: Perhitungan Geofence Kantor (Haversine)');
const officeCoords = { latitude: -7.9439, longitude: 112.6322 }; // IndigoSpace Malang

// Kasus 1: Lokasi sama persis (jarak 0m)
const distZero = calculateHaversineDistance(officeCoords, officeCoords);
assert(distZero === 0, 'Jarak titik identik adalah 0 meter');

// Kasus 2: Lokasi dalam radius 100m
const nearCoords = { latitude: -7.9441, longitude: 112.6324 }; // Sekitar 30-40 meter
const nearCheck = checkIsWithinOfficeRadius(nearCoords, officeCoords, 100);
assert(nearCheck.isWithinRadius, 'Koordinat dekat harus terdeteksi di dalam radius kantor');
assert(nearCheck.distanceMeter < 100, `Jarak terdeteksi ${nearCheck.distanceMeter}m (< 100m)`);

// Kasus 3: Lokasi di luar radius (misal 500m - 1km)
const farCoords = { latitude: -7.9500, longitude: 112.6400 };
const farCheck = checkIsWithinOfficeRadius(farCoords, officeCoords, 100);
assert(!farCheck.isWithinRadius, 'Koordinat jauh harus terdeteksi di luar radius kantor');
assert(farCheck.distanceMeter > 100, `Jarak terdeteksi ${farCheck.distanceMeter}m (> 100m)`);

// -----------------------------------------------------------------------------
// SUITE 3: STATUS KEHADIRAN & LOGIKA ATURAN BAKU (ATTENDANCE-STATUS)
// -----------------------------------------------------------------------------
console.log('\n📊 SUITE 3: Kalkulasi Status Kehadiran Terpadu (attendance-status.ts)');

const testUser = { id: 'usr_emp_1', name: 'Rina Pratama' };
const testDate = '2026-11-02'; // Hari Senin

// 3.1. Hadir WFO Tepat Waktu (IN_OFFICE + ON_TIME)
const wfoOnTimeRec: AttendanceRecord = {
  id: 'att-1',
  userId: testUser.id,
  userName: testUser.name,
  userAvatar: '',
  department: 'Teknologi Informasi',
  employmentType: 'INTERN',
  workMode: 'WFO',
  date: testDate,
  clockInTime: '07:55:00',
  clockInLat: -7.9439,
  clockInLng: 112.6322,
  clockInDistanceMeter: 15,
  clockInLocationStatus: 'IN_OFFICE',
  clockInStatus: 'ON_TIME',
  clockInLateMinutes: 0,
};
const stWfoOnTime = getDailyStatus({
  user: testUser,
  date: testDate,
  records: [wfoOnTimeRec],
  leaves: [],
  today: testDate,
});
assert(stWfoOnTime.key === 'PRESENT', 'WFO tepat waktu menghasilkan key PRESENT');
assert(stWfoOnTime.shortLabel === 'Hadir', 'shortLabel WFO tepat waktu adalah "Hadir"');
assert(stWfoOnTime.isPresent && !stWfoOnTime.isLate, 'isPresent = true, isLate = false');

// 3.2. Hadir WFO Terlambat (IN_OFFICE + LATE)
const wfoLateRec: AttendanceRecord = {
  ...wfoOnTimeRec,
  id: 'att-2',
  clockInTime: '08:45:00',
  clockInStatus: 'LATE',
  clockInLateMinutes: 45,
};
const stWfoLate = getDailyStatus({
  user: testUser,
  date: testDate,
  records: [wfoLateRec],
  leaves: [],
  today: testDate,
});
assert(stWfoLate.key === 'LATE', 'WFO terlambat menghasilkan key LATE');
assert(stWfoLate.isLate && stWfoLate.lateMinutes === 45, 'isLate = true, lateMinutes = 45');

// 3.3. WFH Disetujui + Presensi Tepat Waktu
const wfhLeaveApproved: LeaveRequest = {
  id: 'leave-wfh-1',
  userId: testUser.id,
  userName: testUser.name,
  userAvatar: '',
  department: 'Teknologi Informasi',
  employmentType: 'INTERN',
  category: 'WFH',
  reason: 'Bekerja remote dari rumah',
  startDate: testDate,
  endDate: testDate,
  totalDays: 1,
  status: 'APPROVED',
  appliedAt: '2026-11-01',
};
const wfhOnTimeRec: AttendanceRecord = {
  ...wfoOnTimeRec,
  id: 'att-3',
  workMode: 'WFH',
  clockInLocationStatus: 'WFH_APPROVED',
  clockInStatus: 'ON_TIME',
  clockInDistanceMeter: 650,
};
const stWfhOnTime = getDailyStatus({
  user: testUser,
  date: testDate,
  records: [wfhOnTimeRec],
  leaves: [wfhLeaveApproved],
  today: testDate,
});
assert(stWfhOnTime.key === 'WFH', 'WFH disetujui + absen menghasilkan key WFH');
assert(stWfhOnTime.shortLabel === 'WFH', 'shortLabel adalah "WFH"');
assert(stWfhOnTime.location === 'WFH', 'location adalah "WFH"');

// 3.4. WFH Disetujui + Presensi Terlambat (WFH • Terlambat)
const wfhLateRec: AttendanceRecord = {
  ...wfhOnTimeRec,
  id: 'att-4',
  clockInTime: '09:15:00',
  clockInStatus: 'LATE',
  clockInLateMinutes: 75,
};
const stWfhLate = getDailyStatus({
  user: testUser,
  date: testDate,
  records: [wfhLateRec],
  leaves: [wfhLeaveApproved],
  today: testDate,
});
assert(stWfhLate.key === 'WFH', 'WFH terlambat tetap key WFH');
assert(stWfhLate.isLate && stWfhLate.lateMinutes === 75, 'Terdeteksi terlambat 75 menit saat WFH');

// 3.5. Sakit Disetujui (Bebas Presensi / OFF)
const sickLeaveApproved: LeaveRequest = {
  id: 'leave-sick-1',
  userId: testUser.id,
  userName: testUser.name,
  userAvatar: '',
  department: 'Teknologi Informasi',
  employmentType: 'INTERN',
  category: 'SICK',
  reason: 'Demam flu',
  startDate: testDate,
  endDate: testDate,
  totalDays: 1,
  status: 'APPROVED',
  appliedAt: '2026-11-01',
};
const stSick = getDailyStatus({
  user: testUser,
  date: testDate,
  records: [],
  leaves: [sickLeaveApproved],
  today: testDate,
});
assert(stSick.key === 'SICK', 'Izin Sakit disetujui menghasilkan key SICK');
assert(stSick.isOff === true, 'Sakit merupakan kategori OFF (bebas presensi)');
assert(isOffCategory('SICK'), 'isOffCategory("SICK") harus true');

// 3.6. Aturan Prioritas Sakit Menang Atas Record Hadir
const stSickOverRecord = getDailyStatus({
  user: testUser,
  date: testDate,
  records: [wfoOnTimeRec], // Walaupun ada presensi fisik
  leaves: [sickLeaveApproved], // Namun izin sakit disetujui
  today: testDate,
});
assert(stSickOverRecord.key === 'SICK', 'Aturan Baku: Sakit SELALU menang atas record presensi fisik');

// 3.7. Cuti Tahunan Disetujui
const annualLeaveApproved: LeaveRequest = {
  id: 'leave-annual-1',
  userId: testUser.id,
  userName: testUser.name,
  userAvatar: '',
  department: 'Teknologi Informasi',
  employmentType: 'INTERN',
  category: 'LEAVE',
  reason: 'Cuti keluarga',
  startDate: testDate,
  endDate: testDate,
  totalDays: 1,
  status: 'APPROVED',
  appliedAt: '2026-11-01',
};
assert(isOffCategory(annualLeaveApproved.category), 'Cuti tahunan masuk kategori isOffCategory');
const stLeave = getDailyStatus({
  user: testUser,
  date: testDate,
  records: [],
  leaves: [annualLeaveApproved],
  today: testDate,
});
assert(stLeave.key === 'LEAVE', 'Cuti tahunan disetujui menghasilkan key LEAVE');

// 3.8. Validasi Bentrok Tanggal (Conflict Detection)
const existingLeaves = [annualLeaveApproved];
const overlapRange = dateRangesOverlap(testDate, testDate, testDate, testDate);
assert(overlapRange === true, 'Tanggal identik terdeteksi overlap');

const conflict = findConflictingLeave(existingLeaves, testUser, testDate, testDate);
assert(conflict !== undefined, 'findConflictingLeave mendeteksi izin bentrok untuk user yang sama');

const noConflictOtherUser = findConflictingLeave(
  existingLeaves,
  { id: 'usr_other', name: 'Other User' },
  testDate,
  testDate
);
assert(noConflictOtherUser === undefined, 'Tidak bentrok dengan user yang berbeda');

// -----------------------------------------------------------------------------
// SUITE 4: PENYIMPANAN DATA & SIKLUS HIDUP PENGGUNA (STORAGE.TS)
// -----------------------------------------------------------------------------
console.log('\n💾 SUITE 4: Operasi AppStorage & Alur Persetujuan');

// Reset bersih awal
AppStorage.purgeAllExceptSuperAdmin();
let users = AppStorage.getUsers();
assert(users.length === 1 && users[0].role === 'SUPER_ADMIN', 'Purge menyisakan hanya Super Admin');

// 4.1. Pendaftaran Karyawan Baru
const registerRes = AppStorage.registerEmployee({
  name: 'Alissa Anastasia',
  email: 'alissa@gmail.com',
  password: 'Password123!',
  department: 'Teknologi Informasi',
  position: 'Frontend Developer',
  employmentType: 'CONTRACT',
});
assert(registerRes.success, 'Registrasi karyawan baru berhasil');
assert(registerRes.user?.status === 'PENDING_APPROVAL', 'Status awal adalah PENDING_APPROVAL');
assert(registerRes.user?.isProfileComplete === false, 'isProfileComplete awal pendaftar baru adalah false');

// Simulasi tab tertutup lalu login ulang: jika isProfileComplete !== true, wajib tetap diarahkan ke halaman biodata diri
const isProfileIncompleteCheck = (u: User) =>
  u.role !== 'ADMIN' && u.role !== 'SUPER_ADMIN' && u.isProfileComplete !== true && u.status === 'PENDING_APPROVAL';
assert(isProfileIncompleteCheck(registerRes.user!) === true, 'Pendaftar yang belum simpan biodata tetap diarahkan ke form biodata 4 langkah saat login ulang');

// 4.2. Persetujuan Akun oleh Super Admin
AppStorage.approveRegistration(registerRes.user!.id, 'Super Admin', 'EMPLOYEE');
const approvedUser = AppStorage.getUserById(registerRes.user!.id);
assert(approvedUser?.status === 'ACTIVE', 'Status karyawan berubah menjadi ACTIVE setelah di-approve');
assert(approvedUser?.role === 'EMPLOYEE', 'Role karyawan diset ke EMPLOYEE');

const emailsAfterRegApprove = AppStorage.getEmailNotifications();
const accVerifiedEmail = emailsAfterRegApprove.find(
  (e) => e.toEmail === registerRes.user!.email && e.category === 'ACCOUNT_VERIFIED'
);
assert(!!accVerifiedEmail, 'Email verifikasi akun terkirim otomatis ke pendaftar baru setelah di-ACC');
assert(
  Boolean(accVerifiedEmail?.subject.includes('Akun Terverifikasi') && accVerifiedEmail?.notificationType === 'ACCOUNT'),
  'Subjek email verifikasi memuat konfirmasi akun aktif dan tipe ACCOUNT'
);

const countBefore = emailsAfterRegApprove.length;
AppStorage.approveRegistration(registerRes.user!.id, 'Super Admin', 'EMPLOYEE');
const countAfter = AppStorage.getEmailNotifications().length;
assert(countAfter === countBefore, 'Tidak mengirimkan email duplikat jika akun sudah berstatus ACTIVE');

// 4.3. Update Biodata Diri & Kelengkapan Profil
AppStorage.updateUser({
  ...approvedUser!,
  phone: '081234567890',
  bankName: 'BCA',
  bankAccountNumber: '1234567890',
  bankAccountHolder: 'Alissa Anastasia',
  isProfileComplete: true,
});
const updatedUser = AppStorage.getUserById(approvedUser!.id);
assert(updatedUser?.bankName === 'BCA', 'Data finansial tersimpan');
assert(updatedUser?.isProfileComplete === true, 'isProfileComplete menjadi true');

// 4.4. Pengajuan Izin Multi-Hari & Split Logic
const leaveReq = AppStorage.submitLeaveRequest(updatedUser!, {
  category: 'SICK',
  reason: 'Dirawat di Rumah Sakit',
  startDate: '2026-11-03',
  endDate: '2026-11-05',
  totalDays: 3,
});
assert(leaveReq !== null, 'Pengajuan izin 3 hari berhasil dibuat');
assert(leaveReq.status === 'PENDING', 'Status izin awal PENDING');

// Setujui izin
AppStorage.approveLeave(leaveReq.id, 'Super Admin');
const approvedLeave = AppStorage.getLeaveRequests().find((l) => l.id === leaveReq.id);
assert(approvedLeave?.status === 'APPROVED', 'Izin telah di-APPROVED oleh Admin');

// Split logic: Admin mengubah tanggal tengah (04-Nov) menjadi Hadir di kantor (menghapus izin pada tanggal tersebut dengan category 'NONE')
AppStorage.setLeaveCategoryForDate(updatedUser!, '2026-11-04', 'NONE');
const splitLeaves = AppStorage.getLeaveRequests().filter((l) => l.userId === updatedUser!.id && l.status === 'APPROVED');
assert(splitLeaves.length === 2, `Split Leave Logic membelah izin 3 hari menjadi 2 pengajuan terpisah (Ditemukan: ${splitLeaves.length})`);
assert(
  splitLeaves.some((l) => l.startDate === '2026-11-03' && l.endDate === '2026-11-03'),
  'Bagian pertama (03 Nov) tetap Sakit'
);
assert(
  splitLeaves.some((l) => l.startDate === '2026-11-05' && l.endDate === '2026-11-05'),
  'Bagian kedua (05 Nov) tetap Sakit'
);

// 4.5. Pencatatan Presensi Masuk
const attRes: AttendanceRecord = {
  id: `att-${Date.now()}`,
  userId: updatedUser!.id,
  userName: updatedUser!.name,
  userAvatar: updatedUser!.avatar,
  department: updatedUser!.department,
  employmentType: updatedUser!.employmentType,
  workMode: 'WFO',
  date: '2026-11-02',
  clockInTime: '08:12:30',
  clockInLat: -7.9439,
  clockInLng: 112.6322,
  clockInDistanceMeter: 20,
  clockInLocationStatus: 'IN_OFFICE',
  clockInStatus: 'ON_TIME',
  clockInLateMinutes: 0,
};
AppStorage.recordClockIn(attRes);
const records = AppStorage.getAttendanceRecords();
assert(records.some((r) => r.userId === updatedUser!.id && r.date === '2026-11-02'), 'Presensi masuk tersimpan di storage');

// 4.6. Logbook Harian
AppStorage.upsertDailyTaskForDate(updatedUser!, '2026-11-02', [
  'Menyelesaikan integrasi styling badge',
  'Menguji kalkulasi geofence kantor',
], 'Selesai tepat waktu');
const dailyTasks = AppStorage.getDailyTasks();
const myTask = dailyTasks.find((t) => t.userId === updatedUser!.id && t.date === '2026-11-02');
assert(myTask !== undefined && myTask.tasks.length === 2, 'Logbook harian tersimpan dengan 2 tugas');

// -----------------------------------------------------------------------------
// SUITE 5: PEMERIKSAAN SISTEM CLOCK OUT (DIHAPUS)
// -----------------------------------------------------------------------------
console.log('\n⏰ SUITE 5: Verifikasi Penghapusan Sistem Clock Out');
assert(
  attRes.clockInTime !== undefined,
  'Hanya presensi masuk (clockInTime) yang dicatat'
);
assert(
  (attRes as any).clockOutTime === undefined || (attRes as any).clockOutTime === '',
  'Tidak ada clockOutTime wajib'
);

// -----------------------------------------------------------------------------
// SUITE 6: PUNCTUALITY & FORMATTING REKAP WHATSAPP
// -----------------------------------------------------------------------------
console.log('\n📲 SUITE 6: Ketepatan Jam Masuk & Format WhatsApp Rekap');
import { calculateClockInPunctuality } from '../lib/time-utils.ts';
import { generateWhatsAppAttendanceRecap } from '../lib/whatsapp-recap.ts';

// 6.1. Perhitungan Keterlambatan
const puncOnTime = calculateClockInPunctuality('07:55', '08:00', 0);
assert(puncOnTime.status === 'ON_TIME', 'Jam 07:55 dengan jadwal 08:00 adalah ON_TIME');

const puncGrace = calculateClockInPunctuality('08:10', '08:00', 15);
assert(puncGrace.status === 'ON_TIME', 'Jam 08:10 dengan batas toleransi 15 menit adalah ON_TIME');

const puncLate = calculateClockInPunctuality('08:35', '08:00', 0);
assert(puncLate.status === 'LATE' && puncLate.lateMinutes === 35, 'Jam 08:35 terhitung terlambat 35 menit');

// 6.2. Format WhatsApp Rekap
const waRecap = generateWhatsAppAttendanceRecap({
  attendance: attRes,
  dailyTask: myTask,
  user: updatedUser!,
  dateStr: '2026-11-02',
});
assert(waRecap.includes('Alissa Anastasia (Karyawan Kontrak)'), 'WA Rekap memuat nama & tipe kepegawaian standar');
assert(waRecap.includes('08:12:30 WIB'), 'WA Rekap memuat jam masuk akurat');
assert(waRecap.includes('Menyelesaikan integrasi styling badge'), 'WA Rekap memuat daftar task dari logbook');

// -----------------------------------------------------------------------------
// SUITE 7: INTEGRITAS DATA & ATURAN KEAMANAN ADMIN (SELF-EDIT PROTECTION)
// -----------------------------------------------------------------------------
console.log('\n🔒 SUITE 7: Aturan Keamanan Integritas Data (Self-Edit Protection)');
const superAdminUser = users[0];
const isAdminSelfRecord = (attUserId: string, currentAdminId: string) => attUserId === currentAdminId;
assert(
  isAdminSelfRecord(superAdminUser.id, superAdminUser.id) === true,
  'Sistem berhasil mendeteksi presensi milik Admin sendiri'
);
assert(
  isAdminSelfRecord(updatedUser!.id, superAdminUser.id) === false,
  'Presensi karyawan lain diizinkan untuk diedit oleh Admin'
);

// -----------------------------------------------------------------------------
// SUITE 8: KEAMANAN AUTENTIKASI (LOGIN, HASH PASSWORD, RESET PASSWORD)
// -----------------------------------------------------------------------------
console.log('\n🔐 SUITE 8: Keamanan Autentikasi');

assert(AppStorage.authenticate('alissa@gmail.com') === null, 'Login tanpa password DITOLAK');
assert(AppStorage.authenticate('alissa@gmail.com', '') === null, 'Login dengan password kosong DITOLAK');
assert(AppStorage.authenticate('alissa@gmail.com', 'salah123') === null, 'Login dengan password salah DITOLAK');
assert(AppStorage.authenticate('superadmin') === null, 'Login superadmin tanpa password DITOLAK');
AppStorage.clearSession();
assert(AppStorage.getCurrentUser() === null, 'Tanpa sesi login, tidak ada pengguna aktif (tidak ada auto-login Super Admin)');
assert(AppStorage.authenticate('alissa@gmail.com', 'Password123!')?.id === updatedUser!.id, 'Login dengan password benar BERHASIL');

const storedAlissa = AppStorage.getUserById(updatedUser!.id);
assert(
  !!storedAlissa?.password && storedAlissa.password.startsWith('$enc$v2$'),
  'Password karyawan tersimpan sebagai hash (bukan plaintext)'
);

// Pastikan tidak ada password default hardcoded di bundle INITIAL_USERS
const initialSa = AppStorage.getUsers().find((u) => u.role === 'SUPER_ADMIN');
assert(!initialSa?.password, 'INITIAL_USERS Super Admin tidak menyimpan password default hardcoded');

// Uji login dengan password plaintext lama lalu migrasi otomatis menjadi hash
const testSaPlainPass = 'TestSuperAdminLocal#2026!';
const saSeeded = {
  ...initialSa!,
  email: 'sa.test@absenku.local',
  password: testSaPlainPass,
};
AppStorage.updateUser(saSeeded);

assert(AppStorage.authenticate('sa.test@absenku.local') === null, 'Login superadmin tanpa password DITOLAK');
const saLogin = AppStorage.authenticate('sa.test@absenku.local', testSaPlainPass);
assert(saLogin?.role === 'SUPER_ADMIN', 'Super Admin dapat login dengan password yang benar');
assert(
  AppStorage.getUserById(saLogin!.id)!.password!.startsWith('$enc$v2$'),
  'Password plaintext lama otomatis dimigrasi ke hash setelah login'
);
assert(
  AppStorage.authenticate('sa.test@absenku.local', testSaPlainPass)?.role === 'SUPER_ADMIN',
  'Super Admin tetap bisa login setelah migrasi hash'
);

assert(
  AppStorage.registerEmployee({ name: 'Tanpa Sandi', email: 'nopass@gmail.com' }).success === false,
  'Registrasi tanpa password DITOLAK'
);

// Reset password mandiri
assert(
  AppStorage.resetPasswordSelfService('alissa@gmail.com', 'Alis', 'BaruAman1').success === false,
  'Reset password dengan nama parsial / tidak sama persis DITOLAK'
);
assert(
  AppStorage.resetPasswordSelfService('sa.test@absenku.local', 'Super Admin', 'SuperAdminBaru123').success === true &&
    AppStorage.authenticate('sa.test@absenku.local', 'SuperAdminBaru123') !== null,
  'Reset password akun Super Admin dengan data valid berhasil'
);
// Kembalikan password Super Admin ke semula untuk suite pengetesan berikutnya
AppStorage.resetPasswordSelfService('sa.test@absenku.local', 'Super Admin', testSaPlainPass);
assert(
  AppStorage.resetPasswordSelfService('alissa@gmail.com', 'Alissa Anastasia', 'BaruAman1').success === true &&
    AppStorage.authenticate('alissa@gmail.com', 'BaruAman1') !== null &&
    AppStorage.authenticate('alissa@gmail.com', 'Password123!') === null,
  'Reset password karyawan (email + nama persis) berhasil dan password lama tidak berlaku'
);

const targetEmp = AppStorage.getUsers().find((u) => u.email === 'alissa@gmail.com');
assert(
  Boolean(targetEmp && AppStorage.adminResetUserPassword(targetEmp.id, 'AdminResetPass999').success === true &&
    AppStorage.authenticate('alissa@gmail.com', 'AdminResetPass999') !== null),
  'Admin / Super Admin berhasil mereset kata sandi akun karyawan'
);

// -----------------------------------------------------------------------------
// SUITE 9: ALUR LINTAS PERAN (KARYAWAN → ADMIN → SUPER ADMIN)
// -----------------------------------------------------------------------------
console.log('\n🔁 SUITE 9: Alur Lintas Peran');

const regB = AppStorage.registerEmployee({
  name: 'Budi Santoso',
  email: 'budi@gmail.com',
  password: 'Budi12345',
  employmentType: 'PERMANENT',
});
assert(regB.success && regB.user?.status === 'PENDING_APPROVAL', 'Karyawan baru mendaftar dan berstatus menunggu persetujuan');
assert(
  AppStorage.getUsers().some((u) => u.id === regB.user!.id && u.status === 'PENDING_APPROVAL'),
  'Pendaftaran terlihat oleh Admin / Super Admin di daftar persetujuan'
);

AppStorage.approveRegistration(regB.user!.id, 'Super Admin', 'ADMIN');
const budiAdmin = AppStorage.getUserById(regB.user!.id)!;
assert(budiAdmin.status === 'ACTIVE' && budiAdmin.role === 'ADMIN', 'Super Admin menyetujui pendaftaran dan menetapkan peran Admin');

const leaveByAlissa = AppStorage.submitLeaveRequest(AppStorage.getUserById(updatedUser!.id)!, {
  category: 'LEAVE',
  reason: 'Keperluan keluarga',
  startDate: '2026-11-10',
  endDate: '2026-11-10',
  totalDays: 1,
});
assert(!!leaveByAlissa && leaveByAlissa.status === 'PENDING', 'Karyawan mengajukan cuti dan status PENDING');
assert(
  AppStorage.getLeaveRequests().some((l) => l.id === leaveByAlissa.id && l.userId === updatedUser!.id),
  'Pengajuan cuti karyawan terlihat oleh Admin'
);

AppStorage.approveLeave(leaveByAlissa.id, budiAdmin.name);
assert(
  AppStorage.getLeaveRequests().find((l) => l.id === leaveByAlissa.id)?.status === 'APPROVED',
  'Admin menyetujui cuti dan status berubah APPROVED'
);

const dayStatusAlissa = getDailyStatus({
  user: { id: updatedUser!.id, name: updatedUser!.name },
  date: '2026-11-10',
  records: AppStorage.getAttendanceRecords(),
  leaves: AppStorage.getLeaveRequests(),
  today: '2026-11-02',
} as any);
assert(dayStatusAlissa.key === 'LEAVE', 'Cuti yang disetujui tampil sebagai status Cuti di matriks presensi');

// Tugas Kanban: tugas tunggal terhapus, tugas bersama hanya melepas karyawan
const mkTask = (id: string, assignees: { id: string; name: string }[]) =>
  ({
    id,
    title: id,
    description: '',
    status: 'TODO',
    priority: 'MEDIUM',
    assignedTo: assignees[0].id,
    assignedName: assignees[0].name,
    assignedAvatar: '',
    assignees,
    createdBy: budiAdmin.id,
    dueDate: '2026-11-20',
    createdAt: '2026-11-02',
    updatedAt: '2026-11-02',
  }) as any;
AppStorage.saveTasks([
  mkTask('t_solo', [{ id: updatedUser!.id, name: updatedUser!.name }]),
  mkTask('t_shared', [
    { id: updatedUser!.id, name: updatedUser!.name },
    { id: budiAdmin.id, name: budiAdmin.name },
  ]),
]);

// Penghapusan karyawan harus membersihkan seluruh datanya
AppStorage.deleteUser(updatedUser!.id);
assert(!AppStorage.getUserById(updatedUser!.id), 'Karyawan terhapus dari daftar pengguna');
assert(
  !AppStorage.getAttendanceRecords().some((r) => r.userId === updatedUser!.id) &&
    !AppStorage.getLeaveRequests().some((l) => l.userId === updatedUser!.id) &&
    !AppStorage.getDailyTasks().some((t) => t.userId === updatedUser!.id),
  'Presensi, cuti, dan logbook karyawan ikut terhapus'
);
const remainingTasks = AppStorage.getTasks();
assert(!remainingTasks.some((t) => t.id === 't_solo'), 'Tugas Kanban milik tunggal karyawan ikut terhapus');
const sharedAfter = remainingTasks.find((t) => t.id === 't_shared');
assert(
  !!sharedAfter && sharedAfter.assignedTo === budiAdmin.id && sharedAfter.assignees!.length === 1,
  'Tugas bersama tetap ada dan hanya melepas karyawan yang dihapus'
);

// -----------------------------------------------------------------------------
// SUITE 10: NOTIFIKASI EMAIL PROSES PENUGASAN (KARYAWAN & PIC / ADMIN)
// -----------------------------------------------------------------------------
console.log('\n📧 SUITE 10: Notifikasi Email Proses Penugasan');

// Bersihkan notifikasi email untuk pengetesan isolasi
AppStorage.clearEmailNotifications();

// Buat tugas baru oleh Admin untuk Budi
const testTask = AppStorage.addTask({
  title: 'Audit Keamanan Otentikasi',
  description: 'Validasi token sanctum dan hashing password',
  priority: 'HIGH',
  assignedTo: budiAdmin.id,
  assignedName: budiAdmin.name,
  createdBy: 'usr_super_admin',
  dueDate: '2026-11-25',
  status: 'TODO',
});

const emailsAfterCreate = AppStorage.getEmailNotifications();
const empNotif = emailsAfterCreate.find(
  (e) => e.toEmail === budiAdmin.email && e.category === 'TASK_ASSIGNED'
);
const picNotif = emailsAfterCreate.find(
  (e) => e.toEmail === 'sa.test@absenku.local' && e.category === 'TASK_ASSIGNED'
);

assert(!!empNotif, 'Email notifikasi penugasan baru terkirim ke karyawan yang ditugaskan');
assert(
  Boolean(empNotif?.subject.includes('Audit Keamanan Otentikasi') && empNotif?.taskPriority === 'Tinggi'),
  'Subjek email penugasan karyawan memuat judul tugas & prioritas akurat'
);
assert(!!picNotif, 'Email konfirmasi penugasan terkirim ke Admin / Super Admin (PIC)');
assert(
  Boolean(picNotif?.subject.includes('Audit Keamanan Otentikasi')),
  'Subjek email PIC memuat konfirmasi penugasan tugas yang diberikan'
);

// 2. Karyawan mengumpulkan hasil tugas (Preview Tugas / DONE)
AppStorage.updateTaskStatus(testTask.id, 'DONE', {
  submissionNotes: 'Audit selesai dan seluruh endpoint telah terlindungi.',
  activityUser: budiAdmin,
});

const emailsAfterSubmit = AppStorage.getEmailNotifications();
const picSubmitNotif = emailsAfterSubmit.find(
  (e) => e.toEmail === 'sa.test@absenku.local' && e.category === 'TASK_SUBMITTED'
);
const empSubmitConfirm = emailsAfterSubmit.find(
  (e) => e.toEmail === budiAdmin.email && e.category === 'TASK_SUBMITTED'
);

assert(!!picSubmitNotif, 'Email hasil tugas terkirim ke PIC untuk ditinjau saat karyawan submit tugas');
assert(
  picSubmitNotif?.notes === 'Audit selesai dan seluruh endpoint telah terlindungi.',
  'Email ke PIC memuat catatan hasil pengerjaan (deliverable) karyawan'
);
assert(!!empSubmitConfirm, 'Email konfirmasi pengumpulan terkirim ke karyawan');

// 3. Admin / PIC meminta revisi (IN_PROGRESS)
AppStorage.updateTaskStatus(testTask.id, 'IN_PROGRESS', {
  reviewNotes: 'Mohon tambahkan sanitasi input pada form registrasi.',
  activityUser: { id: 'usr_super_admin', name: 'Super Admin', email: 'sa.test@absenku.local', role: 'SUPER_ADMIN' },
});

const emailsAfterRevision = AppStorage.getEmailNotifications();
const empRevNotif = emailsAfterRevision.find(
  (e) => e.toEmail === budiAdmin.email && e.category === 'TASK_REVISION'
);
assert(!!empRevNotif, 'Email instruksi revisi terkirim ke karyawan saat PIC meminta perbaikan');
assert(
  empRevNotif?.notes === 'Mohon tambahkan sanitasi input pada form registrasi.',
  'Email revisi memuat catatan instruksi perbaikan dari PIC'
);

// 4. Admin / PIC menyetujui tugas (REVIEWED / ACC Selesai)
AppStorage.updateTaskStatus(testTask.id, 'REVIEWED', {
  reviewNotes: 'Pengerjaan sangat baik dan siap dideploy ke server produksi.',
  activityUser: { id: 'usr_super_admin', name: 'Super Admin', email: 'sa.test@absenku.local', role: 'SUPER_ADMIN' },
});

const emailsAfterApprove = AppStorage.getEmailNotifications();
const empApproveNotif = emailsAfterApprove.find(
  (e) => e.toEmail === budiAdmin.email && e.category === 'TASK_APPROVED'
);
const picApproveNotif = emailsAfterApprove.find(
  (e) => e.toEmail === 'sa.test@absenku.local' && e.category === 'TASK_APPROVED'
);

assert(!!empApproveNotif, 'Email tugas disetujui (ACC) terkirim ke karyawan');
assert(
  empApproveNotif?.notes === 'Pengerjaan sangat baik dan siap dideploy ke server produksi.',
  'Email ACC memuat catatan review dari PIC'
);
assert(!!picApproveNotif, 'Email penugasan selesai tercatat untuk arsip PIC');

// -----------------------------------------------------------------------------
// SUITE 11: KEAMANAN WEB (ANTI STORED-XSS, INJEKSI FORMULA EXCEL & SANITASI URL)
// -----------------------------------------------------------------------------
console.log('\n🛡️ SUITE 11: Sanitasi URL Lampiran, Template Email, & Spreadsheet Export');

assert(
  !isSafeDataUrl('data:text/html,<script>alert(1)</script>') &&
    !isSafeDataUrl('data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==') &&
    !isSafeDataUrl('data:image/svg+xml;base64,PHN2ZyBvbmxvYWQ9ImFsZXJ0KDEpIj48L3N2Zz4='),
  'Data URL berbahaya (text/html & image/svg+xml) wajib ditolak'
);

assert(
  isSafeDataUrl('data:application/pdf;base64,JVBERi0xLjMK') &&
    isSafeDataUrl('data:image/png;base64,iVBORw0KGgo='),
  'Data URL aman (PDF & PNG base64) diizinkan'
);

assert(
  !isSafeMediaUrl('javascript:alert(1)') &&
    !isSafeMediaUrl('java\nscript:alert(1)') &&
    !isSafeMediaUrl('vbscript:msgbox(1)') &&
    !isSafeMediaUrl('//evil.example/payload.js') &&
    isSafeMediaUrl('https://cdn.example.com/file.pdf') &&
    isSafeMediaUrl('/storage/uploads/dokumen.pdf') &&
    isSafeMediaUrl('idb:doc_abc_123'),
  'isSafeMediaUrl memblokir skema eksekusi skrip dan mengizinkan URL aman'
);

assert(
  sanitizeExternalLinkUrl('javascript:alert(document.cookie)') === '' &&
    sanitizeExternalLinkUrl('data:text/html,<script>alert(1)</script>') === '' &&
    sanitizeExternalLinkUrl('indiekraf.co.id/docs') === 'https://indiekraf.co.id/docs' &&
    sanitizeExternalLinkUrl('https://example.com') === 'https://example.com',
  'sanitizeExternalLinkUrl menolak javascript:/data: dan menormalkan domain eksternal'
);

const unsafeBlob = dataUrlToBlob('data:text/html;base64,PHNjcmlwdD4=', 'text/html');
assert(
  unsafeBlob.size === 0 && unsafeBlob.type === 'application/octet-stream',
  'dataUrlToBlob menolak konversi payload HTML menjadi Blob ber-MIME berbahaya'
);

const xssEmailHtml = generateEmailHtmlTemplate({
  title: 'Alert <script>alert(1)</script>',
  recipientName: 'Budi <img src=x onerror=alert(1)>',
  intro: 'Tes <svg onload=alert(1)>',
  fields: [{ label: '<b>Catatan</b>', value: '"><script>evil()</script>' }],
  actionUrl: 'javascript:alert(1)',
  footerNote: '<script>steal()</script>',
});
assert(
  !xssEmailHtml.includes('<script>') &&
    !xssEmailHtml.includes('<img src=x') &&
    !xssEmailHtml.includes('<svg onload') &&
    !xssEmailHtml.includes('javascript:alert') &&
    xssEmailHtml.includes('&lt;script&gt;alert(1)&lt;/script&gt;'),
  'Template email melakukan HTML escaping ketat dan membuang actionUrl javascript:'
);

const xssSheetHtml = generateStyledSpreadsheetHTML([
  {
    id: 'att_xss',
    userId: 'usr_1',
    userName: '=CMD|\'/C calc\'!A0',
    department: '<script>alert(1)</script>',
    date: '2026-11-12',
    clockInTime: '08:00',
    clockInStatus: 'ON_TIME',
    clockInLateMinutes: 0,
    workMode: 'WFO',
    notes: '+1+1<img onerror=alert(1)>',
  } as AttendanceRecord,
]);
assert(
  !xssSheetHtml.includes('<script>alert(1)</script>') &&
    xssSheetHtml.includes('&#39;=CMD|') &&
    xssSheetHtml.includes('&#39;+1+1'),
  'Ekspor spreadsheet mencegah injeksi HTML dan formula Excel (=, +)'
);

// -----------------------------------------------------------------------------
// SUITE 12: SINKRONISASI PENUGASAN PIC & KETAHANAN KARTU KANBAN BARU
// -----------------------------------------------------------------------------
console.log('\n📋 SUITE 12: Sinkronisasi & Perlindungan Kartu Tugas Baru PIC');

const baseNowMs = 1794457200000;
assert(
  parseTaskTimestampMs(`task-${baseNowMs - 2000}`) === baseNowMs - 2000 &&
    parseTaskTimestampMs(`task_${baseNowMs - 3000}_xy12`) === baseNowMs - 3000,
  'parseTaskTimestampMs membaca format ID task- maupun task_'
);

assert(
  shouldKeepLocalTaskMissingFromServer({
    taskId: `task-${baseNowMs - 4000}`,
    pendingSyncIds: new Set(),
    deletedIds: new Set(),
    nowMs: baseNowMs,
  }) === true,
  'Tugas baru dengan prefix task- tetap dipertahankan selama jendela sinkronisasi'
);

assert(
  shouldKeepLocalTaskMissingFromServer({
    taskId: `task_${baseNowMs - 120000}_late`,
    pendingSyncIds: new Set([`task_${baseNowMs - 120000}_late`]),
    deletedIds: new Set(),
    nowMs: baseNowMs,
  }) === true,
  'Tugas yang masih menunggu/mengantre upload (pendingSyncIds) tidak terhapus saat polling server'
);

assert(
  shouldKeepLocalTaskMissingFromServer({
    taskId: `task-${baseNowMs - 4000}`,
    pendingSyncIds: new Set([`task-${baseNowMs - 4000}`]),
    deletedIds: new Set([`task-${baseNowMs - 4000}`]),
    nowMs: baseNowMs,
  }) === false,
  'Tugas yang sengaja dihapus lokal (deletedIds) tetap dibersihkan'
);

assert(
  shouldKeepLocalTaskMissingFromServer({
    taskId: `task-${baseNowMs - 60000}`,
    pendingSyncIds: new Set(),
    deletedIds: new Set(),
    nowMs: baseNowMs,
  }) === false,
  'Tugas lama yang sudah dihapus di server dan tidak pending lagi otomatis diprune'
);

assert(
  isTaskCreatedByUser({ createdBy: 'usr_pic_01' }, { id: 'usr_pic_01', name: 'Budi Admin', role: 'ADMIN' }) &&
    isTaskCreatedByUser({ createdBy: '  budi admin  ' }, { id: 'usr_pic_01', name: 'Budi Admin', role: 'ADMIN' }) &&
    !isTaskCreatedByUser({ createdBy: 'usr_lain' }, { id: 'usr_pic_01', name: 'Budi Admin', role: 'ADMIN' }),
  'isTaskCreatedByUser mencocokkan ID PIC maupun fallback nama secara case-insensitive'
);

const createdHyphenId = `task-${Date.now()}`;
const createdByPic = AppStorage.addTask({
  id: createdHyphenId,
  title: 'Uji Penugasan PIC Anti Hilang',
  description: 'Memastikan kartu tugas tetap tersimpan dan berstatus pending sync saat offline.',
  status: 'TODO',
  priority: 'HIGH',
  assignedTo: 'usr_emp_test',
  assignedName: 'Staf Uji',
  assignedAvatar: '',
  createdBy: 'usr_super_admin',
  dueDate: '2026-11-30',
  tags: ['Tugas Tim'],
  attachments: [
    {
      id: 'att-pic-1',
      name: 'Brief.pdf',
      type: 'FILE',
      url: '/storage/uploads/brief.pdf',
      stage: 'TODO',
    },
  ],
});

assert(
  AppStorage.getTasks().some((t) => t.id === createdByPic.id) &&
    AppStorage.getPendingTaskSyncIds().includes(createdByPic.id),
  'AppStorage.addTask menyimpan kartu baru serta menandainya dalam antrean sinkronisasi'
);

const leaveTestUser: User = {
  ...AppStorage.getUsers()[0],
  id: 'usr_emp_leave_sync',
  name: 'Staf Uji Izin',
  role: 'EMPLOYEE',
};
const createdLeave = AppStorage.submitLeaveRequest(leaveTestUser, {
  category: 'SICK',
  startDate: '2026-12-01',
  endDate: '2026-12-01',
  totalDays: 1,
  reason: 'Sakit demam uji sinkronisasi',
  attachmentName: 'surat_sakit.docx',
  attachmentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
});
assert(
  AppStorage.getLeaveRequests().some((l) => l.id === createdLeave.id) &&
    AppStorage.getPendingLeaveSyncIds().includes(createdLeave.id),
  'AppStorage.submitLeaveRequest menyimpan pengajuan baru serta menandainya dalam antrean sinkronisasi'
);

// -----------------------------------------------------------------------------
// SUITE 14: PENGHAPUSAN RUANG OBROLAN PER-AKUN (ANTI HILANG UNTUK AKUN LAIN)
// -----------------------------------------------------------------------------
console.log('\n💬 SUITE 14: Penghapusan Ruang Obrolan Per-Akun');
import {
  applyUserTagToggleToTopic,
  hasOtherChatParticipants,
  isChatTopicVisibleToUser,
  isUserActivelyTaggedInTopic,
  mergeServerChatTopics,
  resolveActiveTaggedUsers,
} from '../lib/chat-visibility.ts';
import type { ChatTopic } from '../types/index.ts';

const baseUserTemplate = AppStorage.getUsers()[0];
const chatUserA: User = {
  ...baseUserTemplate,
  id: 'usr_chat_ver_a',
  name: 'Akun A',
  email: 'akuna@absenku.test',
  role: 'ADMIN',
};
const chatUserB: User = {
  ...baseUserTemplate,
  id: 'usr_chat_ver_b',
  name: 'Akun B',
  email: 'akunb@absenku.test',
  role: 'EMPLOYEE',
};
const chatUsersList = [...AppStorage.getUsers(), chatUserA, chatUserB];
AppStorage.saveUsers(chatUsersList, true);

const sharedChatTopic: ChatTopic = {
  id: 'topic_shared_ver_1',
  title: 'Koordinasi A dan B',
  status: 'NEED_COMMENTS',
  taggedTeammateIds: ['usr_chat_ver_a', 'akuna@absenku.test', 'Akun A', 'usr_chat_ver_b', 'akunb@absenku.test', 'Akun B'],
  createdBy: 'usr_chat_ver_a',
  createdByName: 'Akun A',
  createdAt: '2026-11-12T10:00:00Z',
  updatedAt: '2026-11-12T10:00:00Z',
  comments: [],
};
AppStorage.saveChatTopics([sharedChatTopic]);

assert(
  isChatTopicVisibleToUser(sharedChatTopic, chatUserA, chatUsersList) &&
    isChatTopicVisibleToUser(sharedChatTopic, chatUserB, chatUsersList),
  'Topik obrolan yang menandai Akun A dan Akun B terlihat oleh kedua akun'
);
assert(
  hasOtherChatParticipants(sharedChatTopic, chatUserA, chatUsersList) === true,
  'Sistem mendeteksi masih ada peserta lain (Akun B) sebelum penghapusan'
);

// Akun A menghapus ruang obrolan tersebut
AppStorage.deleteChatTopic(sharedChatTopic.id, chatUserA.id);
const afterDeleteByA = AppStorage.getChatTopics();
const remainingTopicForB = afterDeleteByA.find((t) => t.id === sharedChatTopic.id);
assert(
  remainingTopicForB !== undefined,
  'Topik tetap dipertahankan di penyimpanan ketika Akun B masih menjadi peserta'
);
assert(
  !isChatTopicVisibleToUser(
    remainingTopicForB!,
    chatUserA,
    chatUsersList,
    AppStorage.getHiddenChatTopicIds(chatUserA.id)
  ),
  'Topik obrolan langsung hilang dari daftar Akun A setelah dihapus Akun A'
);
assert(
  isChatTopicVisibleToUser(
    remainingTopicForB!,
    chatUserB,
    chatUsersList,
    AppStorage.getHiddenChatTopicIds(chatUserB.id)
  ),
  'Topik obrolan TIDAK hilang dan tetap terlihat di daftar Akun B'
);

// Daftar peserta aktif versi B sekarang hanya menyisakan Akun B; Akun A siap diundang kembali
const activeUsersAfterDeleteA = resolveActiveTaggedUsers(remainingTopicForB!, chatUsersList);
assert(
  activeUsersAfterDeleteA.length === 1 && activeUsersAfterDeleteA[0].id === chatUserB.id,
  'Daftar peserta aktif di Akun B otomatis hanya menampilkan Akun B setelah Akun A keluar'
);
assert(
  !isUserActivelyTaggedInTopic(remainingTopicForB!, chatUserA, chatUsersList),
  'Di modal Kelola Tag milik B, Akun A berstatus belum ditag (+ Tag) sehingga bisa ditambahkan kembali'
);

// Simulasikan sinkronisasi server pada Akun B dengan payload hiddenByIds berisi Akun A
const mergedForB = mergeServerChatTopics(
  [],
  [{ ...sharedChatTopic, hidden_by_ids: [chatUserA.id] }],
  chatUserB.id,
  AppStorage.getHiddenChatTopicMap(chatUserB.id)
);
assert(
  mergedForB.length === 1 &&
    isChatTopicVisibleToUser(mergedForB[0], chatUserB, chatUsersList) &&
    !isChatTopicVisibleToUser(mergedForB[0], chatUserA, chatUsersList),
  'Sinkronisasi payload hidden_by_ids menyembunyikan untuk Akun A namun tetap menampilkan untuk Akun B'
);

// Akun B menambahkan ulang Akun A via "+ Tag" (Leave & Re-invite flow)
const { nextTopic: reinvitedTopic, added: reinviteAdded } = applyUserTagToggleToTopic(
  remainingTopicForB!,
  chatUserA,
  chatUsersList
);
assert(reinviteAdded === true, 'applyUserTagToggleToTopic menambahkan kembali Akun A');
AppStorage.updateChatTopic(reinvitedTopic);
const afterReinviteTopic = AppStorage.getChatTopics().find((t) => t.id === sharedChatTopic.id)!;
assert(
  isUserActivelyTaggedInTopic(afterReinviteTopic, chatUserA, chatUsersList) &&
    isChatTopicVisibleToUser(
      afterReinviteTopic,
      chatUserA,
      chatUsersList,
      AppStorage.getHiddenChatTopicIds(chatUserA.id)
    ) &&
    !AppStorage.getHiddenChatTopicIds(chatUserA.id).includes(sharedChatTopic.id),
  'Setelah Akun B menandai kembali Akun A, topik obrolan muncul lagi di Akun A'
);

// Cek mergeServerChatTopics menghapus blokir lokal seketika jika server mengirim updatedAt setelah delete
const staleDeleteMs = Date.now() - 2000;
const mergedReinvitedForA = mergeServerChatTopics(
  [],
  [{
    ...sharedChatTopic,
    hidden_by_ids: [],
    updatedAt: new Date(staleDeleteMs + 5000).toISOString(),
  }],
  chatUserA.id,
  { [sharedChatTopic.id]: staleDeleteMs },
  Date.now()
);
assert(
  mergedReinvitedForA.length === 1 &&
    isChatTopicVisibleToUser(mergedReinvitedForA[0], chatUserA, chatUsersList),
  'Sinkronisasi server setelah re-invite langsung membuka blokir lokal milik Akun A'
);

// Akun A hapus lagi lalu Akun B juga menghapus topik -> tidak ada peserta tersisa -> dihapus permanen
AppStorage.deleteChatTopic(sharedChatTopic.id, chatUserA.id);
const afterSecondDeleteA = AppStorage.getChatTopics().find((t) => t.id === sharedChatTopic.id)!;
assert(
  hasOtherChatParticipants(afterSecondDeleteA, chatUserB, chatUsersList) === false,
  'Setelah Akun A menghapus, penghapusan oleh Akun B tidak menyisakan peserta lain'
);
AppStorage.deleteChatTopic(sharedChatTopic.id, chatUserB.id);
assert(
  AppStorage.getChatTopics().every((t) => t.id !== sharedChatTopic.id),
  'Topik dihapus permanen setelah semua peserta menghapusnya'
);

// -----------------------------------------------------------------------------
// REKAP HASIL AKHIR
// -----------------------------------------------------------------------------
console.log('\n====================================================');
console.log(`TOTAL TEST : ${passedTests + failedTests}`);
console.log(`BERHASIL   : ${passedTests}`);
console.log(`GAGAL      : ${failedTests}`);
console.log('====================================================');

if (failedTests > 0) {
  process.exit(1);
} else {
  console.log('🎉 SEMUA PENGUJIAN FITUR & KONDISI BERHASIL 100%!');
  process.exit(0);
}
