import {
  User,
  AttendanceRecord,
  LeaveRequest,
  DailyTaskLog,
  DiscussionMessage,
  IdeaCard,
  EmailNotification,
  OfficeConfig,
  ChatTopic,
  TaskItem,
} from '../types/index.ts';

// 1. DATA PENGGUNA AWAL (Tanpa kredensial hardcoded di bundle publik; akun resmi dikelola backend MySQL)
export const INITIAL_USERS: User[] = [
  {
    id: 'usr_super_admin',
    name: 'Super Admin',
    email: 'admin@perusahaan.local',
    password: '',
    role: 'SUPER_ADMIN',
    status: 'ACTIVE',
    employmentType: 'PERMANENT',
    department: 'Direksi Eksekutif',
    position: 'Super Administrator',
    avatar: '',
    phone: '',
    joinDate: '2024-01-01',
    leaveBalance: 24,
    bankName: '',
    bankAccountNumber: '',
    bankAccountHolder: '',
    emergencyContactName: '',
    emergencyContactPhone: '',
    address: '',
    registeredAt: '2024-01-01 08:00',
    isProfileComplete: true,
  },
];

// 2. DATA RIWAYAT PRESENSI MASUK (Kosong / Bersih)
export const INITIAL_ATTENDANCE: AttendanceRecord[] = [];

// 3. LOG AKTIVITAS / TASK HARIAN (Kosong / Bersih)
export const INITIAL_DAILY_TASKS: DailyTaskLog[] = [];

// 4. DATA PENGAJUAN PERIZINAN & CUTI (Kosong / Bersih)
export const INITIAL_LEAVES: LeaveRequest[] = [];

// 5. DATA NOTIFIKASI EMAIL SIMULASI (Kosong / Bersih)
export const INITIAL_EMAIL_NOTIFICATIONS: EmailNotification[] = [];

// 6. TUGAS PROYEK (KANBAN BOARD) (Kosong / Bersih)
export const INITIAL_TASKS: TaskItem[] = [];

// 7. PESAN RUANG OBROLAN (ROOM DISCUSSION) (Kosong / Bersih)
export const INITIAL_DISCUSSION_MESSAGES: DiscussionMessage[] = [];

// 8. KARTU IDE (WHITEBOARD IDE) (Kosong / Bersih)
export const INITIAL_IDEAS: IdeaCard[] = [];

// 9. KONFIGURASI KANTOR (Koordinat GPS & Geofence Kantor)
export const INITIAL_OFFICE_CONFIG: OfficeConfig = {
  name: 'IndigoSpace Malang (Kantor Pusat)',
  address: 'Jl. Simpang Borobudur No. 1, Mojolangu, Kec. Lowokwaru, Kota Malang, Jawa Timur 65142',
  latitude: -7.9439,
  longitude: 112.6322,
  geofenceRadiusMeter: 100,
  workStartHour: '08:00',
  workEndHour: '17:00',
  gracePeriodMinutes: 0,
  isGeofenceActive: true,
};

// 10. TOPIK RUANG OBROLAN (Kosong / Bersih)
export const INITIAL_CHAT_TOPICS: ChatTopic[] = [];
