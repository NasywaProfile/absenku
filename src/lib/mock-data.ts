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
} from '../types/index.ts';

// 1. DATA PENGGUNA (Hanya 1 Akun Tunggal: Super Admin)
export const INITIAL_USERS: User[] = [
  {
    id: 'usr_super_admin',
    name: 'Super Admin',
    email: 'superadmin@gmail.com',
    password: 'SuperAdminabsenkuMantap',
    role: 'SUPER_ADMIN',
    status: 'ACTIVE',
    employmentType: 'PERMANENT',
    department: 'Direksi Eksekutif',
    position: 'Super Administrator',
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=256&q=80',
    phone: '081288889999',
    joinDate: '2024-01-01',
    leaveBalance: 24,
    bankName: 'BCA (Bank Central Asia)',
    bankAccountNumber: '8830192831',
    bankAccountHolder: 'Super Admin',
    emergencyContactName: 'Kontak Darurat',
    emergencyContactPhone: '081299990000',
    address: 'Kantor Pusat',
    registeredAt: '2024-01-01 08:00',
    isProfileComplete: true,
  },
];

// 2. DATA PRESENSI (Kosong - Tanpa Dummy)
export const INITIAL_ATTENDANCE: AttendanceRecord[] = [];

// 3. LOG AKTIVITAS / DAILY TASKS (Kosong - Tanpa Dummy)
export const INITIAL_DAILY_TASKS: DailyTaskLog[] = [];

// 4. PERIZINAN & CUTI (Kosong - Tanpa Dummy)
export const INITIAL_LEAVES: LeaveRequest[] = [];

// 5. NOTIFIKASI EMAIL (Kosong - Tanpa Dummy)
export const INITIAL_EMAIL_NOTIFICATIONS: EmailNotification[] = [];

// 6. PESAN DISKUSI (Kosong - Tanpa Dummy)
export const INITIAL_DISCUSSION_MESSAGES: DiscussionMessage[] = [];

// 7. IDE & USULAN KARYAWAN (Kosong - Tanpa Dummy)
export const INITIAL_IDEAS: IdeaCard[] = [];

// 8. KONFIGURASI KANTOR (Koordinat GPS & Geofence Kantor)
export const INITIAL_OFFICE_CONFIG: OfficeConfig = {
  name: 'IndigoSpace Malang (Kantor Pusat)',
  address: 'Jl. Simpang Borobudur No. 1, Mojolangu, Kec. Lowokwaru, Kota Malang, Jawa Timur 65142',
  latitude: -7.9439,
  longitude: 112.6322,
  geofenceRadiusMeter: 100,
  workStartHour: '08:00',
  workEndHour: '17:00',
  gracePeriodMinutes: 15,
  isGeofenceActive: true,
};

// 9. TOPIK RUANG OBROLAN (Kosong - Tanpa Dummy)
export const INITIAL_CHAT_TOPICS: ChatTopic[] = [];
