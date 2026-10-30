// 17 Spesifikasi Teknis: Hierarki Role, Lifecycle Karyawan, Absensi, Perizinan, Kolaborasi

export type UserRole = 'SUPER_ADMIN' | 'ADMIN' | 'EMPLOYEE';

export type AccountStatus = 'PENDING_APPROVAL' | 'ACTIVE' | 'INACTIVE';

export type EmploymentType = 'INTERN' | 'FREELANCE' | 'CONTRACT' | 'PERMANENT';
// Magang (Intern), Freelance, Karyawan Sementara (Kontrak), Karyawan Tetap

export interface User {
  id: string;
  name: string;
  email: string;
  password?: string;
  role: UserRole;
  status: AccountStatus;
  employmentType: EmploymentType;
  department: string;
  position: string;
  avatar: string;
  phone: string; // WhatsApp / Telepon
  joinDate: string;
  leaveBalance: number; // Hak sisa cuti tahunan
  isProfileComplete?: boolean;
  
  // Data Finansial
  bankName?: string;
  bankAccountNumber?: string;
  bankAccountHolder?: string;

  // Kontak Darurat
  emergencyContactName?: string;
  emergencyContactPhone?: string;

  // Metadata Opsional
  nik?: string;
  gender?: 'L' | 'P';
  birthDate?: string;
  address?: string;
  skills?: string[];
  registeredAt?: string;
  approvedBy?: string;
  approvedAt?: string;
}

// Mode Kerja Absensi Masuk (Clock Out DIHAPUS sesuai spesifikasi)
export type WorkMode = 'WFO' | 'WFH';

export type AttendanceStatus = 'ON_TIME' | 'LATE';

export type LocationStatus = 'IN_OFFICE' | 'OUT_OF_RANGE' | 'WFH_APPROVED';

export type AttendanceType = 'CLOCK_IN' | 'CLOCK_OUT';

export interface AttendanceRecord {
  id: string;
  userId: string;
  userName: string;
  userAvatar: string;
  department: string;
  employmentType: EmploymentType;
  date: string; // YYYY-MM-DD
  clockInTime: string; // HH:mm:ss
  clockInPhoto?: string; // Base64 snapshot
  clockInLat: number;
  clockInLng: number;
  clockInDistanceMeter: number;
  clockInLocationStatus: LocationStatus;
  clockInStatus: AttendanceStatus;
  clockInLateMinutes: number; // 0 if on time
  workMode: WorkMode;
  notes?: string;
  tasksDoneSummary?: string[]; // Ringkasan task yang dikerjakan hari ini
  syncStatus?: 'SYNCED' | 'PENDING_SYNC';
  offlineLoggedAt?: string;
  clockOutTime?: string;
  clockOutLat?: number;
  clockOutLng?: number;
  clockOutDistanceMeter?: number;
  clockOutLocationStatus?: LocationStatus;
  workDurationMinutes?: number;
}

// 4 Kategori Perizinan Sesuai Spesifikasi:
// 1. Izin / Cuti
// 2. WFH (Work From Home)
// 3. Sakit
// 4. Dinas Luar
export type LeaveCategory = 'LEAVE' | 'WFH' | 'SICK' | 'BUSINESS_TRIP';

export type LeaveStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export interface LeaveRequest {
  id: string;
  userId: string;
  userName: string;
  userAvatar: string;
  department: string;
  employmentType: EmploymentType;
  category: LeaveCategory;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  totalDays: number;
  reason: string;
  attachmentName?: string;
  attachmentData?: string; // Base64 Data URL (PDF/JPG/PNG)
  attachmentType?: string;
  status: LeaveStatus;
  appliedAt: string;
  reviewedBy?: string;
  reviewedAt?: string;
  rejectionReason?: string;
}

// Task Submission Harian Fleksibel (Bisa diisi/diupdate kapan saja: pagi, siang, sore)
export interface DailyTaskLog {
  id: string;
  userId: string;
  userName: string;
  userAvatar: string;
  employmentType: EmploymentType;
  date: string; // YYYY-MM-DD
  tasks: string[]; // Daftar item pekerjaan
  submittedAt: string;
  updatedAt: string;
  notes?: string;
}

// Simulasi Notifikasi Email Otomatis ke Admin saat User Submit Izin
export interface EmailNotification {
  id: string;
  toEmail: string;
  toName: string;
  fromName: string;
  subject: string;
  employeeName: string;
  employmentType: EmploymentType;
  category: LeaveCategory;
  dateRange: string;
  reason: string;
  attachmentName?: string;
  directApprovalLink: string;
  sentAt: string;
  read: boolean;
}

// Fitur Kolaborasi: Room Discussion
export interface DiscussionMessage {
  id: string;
  userId: string;
  userName: string;
  userAvatar: string;
  userRole: UserRole;
  employmentType: EmploymentType;
  content: string;
  timestamp: string; // YYYY-MM-DD HH:mm:ss
  channelId?: string; // e.g., 'general', 'project', 'announcement'
  attachments?: {
    name: string;
    url: string;
    type: 'FILE' | 'LINK';
  }[];
}

// Fitur Kolaborasi: Whiteboard Ide Terintegrasi (3 Kategori)
// 1. Ide Baru (NEW_IDEA)
// 2. Sedang Direview (IN_REVIEW)
// 3. Eksekusi (EXECUTED)
export type IdeaStatus = 'NEW_IDEA' | 'IN_REVIEW' | 'EXECUTED';

export interface IdeaCard {
  id: string;
  title: string;
  description: string;
  authorId: string;
  authorName: string;
  authorAvatar: string;
  authorRole: UserRole;
  authorType: EmploymentType;
  status: IdeaStatus;
  categoryTag: string; // e.g., 'Operasional', 'Teknologi', 'Workflow', 'Karyawan'
  likesCount: number;
  likedBy: string[]; // userIds
  moderatorNotes?: string;
  createdAt: string;
  updatedAt: string;
}

// Konfigurasi Kantor & Geofence
export interface OfficeConfig {
  name: string;
  latitude: number;
  longitude: number;
  geofenceRadiusMeter: number;
  workStartHour: string; // '08:30'
  workEndHour: string; // '17:30'
  gracePeriodMinutes: number; // e.g. 15 minutes tolerance
  address?: string;
  isGeofenceActive?: boolean; // Status Geofence Radar (Active / Inactive)
  photo?: string;
}

// Offline Sync Type
export interface OfflineSyncItem {
  id: string;
  recordId?: string;
  userId?: string;
  type?: 'CLOCK_IN' | 'CLOCK_OUT';
  timestamp: string;
  date?: string;
  data?: AttendanceRecord;
  status?: 'PENDING' | 'SYNCED' | 'FAILED';
}

export interface TaskAttachment {
  id?: string;
  name: string;
  url: string;
  type: string;
  uploadedBy?: string;
  uploadedByName?: string;
  uploadedAt?: string;
  stage?: string;
  size?: number;
  fileType?: string;
  fileSize?: string;
}

export interface TaskActivity {
  id: string;
  type: 'CREATED' | 'STARTED' | 'SUBMITTED' | 'REVISION_REQUESTED' | 'APPROVED' | 'COMMENT_ADDED';
  userId: string;
  userName: string;
  userAvatar?: string;
  userRole?: string;
  timestamp: string;
  notes?: string;
  attachments?: TaskAttachment[];
}

// Legacy task types support jika dibutuhkan
export type TaskStatus = 'TODO' | 'IN_PROGRESS' | 'DONE' | 'REVIEWED';
export type TaskPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';

export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  TODO: 'Penugasan',
  IN_PROGRESS: 'Dalam Proses',
  DONE: 'Preview Tugas',
  REVIEWED: 'Selesai',
};

export const PRIORITY_LABELS: Record<TaskPriority, string> = {
  URGENT: 'Mendesak',
  HIGH: 'Tinggi',
  MEDIUM: 'Sedang',
  LOW: 'Rendah',
};

export const getPriorityLabel = (priority: TaskPriority | string | undefined): string => {
  if (!priority) return '';
  switch (priority) {
    case 'URGENT':
    case 'Urgent':
      return 'Mendesak';
    case 'HIGH':
    case 'High':
      return 'Tinggi';
    case 'MEDIUM':
    case 'Medium':
      return 'Sedang';
    case 'LOW':
    case 'Low':
      return 'Rendah';
    default:
      return priority;
  }
};
export interface TaskAssignee {
  id: string;
  name: string;
  avatar?: string;
  department?: string;
}

export interface TaskItem {
  id: string;
  title: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  assignedTo: string;
  assignedName: string;
  assignedAvatar: string;
  assignees?: TaskAssignee[];
  createdBy: string;
  dueDate: string;
  createdAt: string;
  updatedAt: string;
  tags: string[];
  okr?: string;
  isTodays?: boolean;
  activities?: TaskActivity[];
  attachments?: TaskAttachment[];
  submissionNotes?: string;
  reviewNotes?: string;
}

// Ruang Obrolan (Chat Room) Types
export type ChatTopicStatus = 'NEED_COMMENTS' | 'CLOSED' | 'IN_PROGRESS' | 'OPEN';

export interface ChatComment {
  id: string;
  topicId: string;
  userId: string;
  userName: string;
  userAvatar?: string;
  userRole?: string;
  timestamp: string;
  notes: string;
  attachments?: TaskAttachment[];
  mentions?: string[];
  type?: 'COMMENT' | 'SYSTEM_EVENT';
}

export interface ChatTopic {
  id: string;
  title: string;
  status: ChatTopicStatus;
  taggedTeammateIds: string[];
  files?: TaskAttachment[];
  links?: { title: string; url: string }[];
  images?: string[];
  shortNotes?: string;
  longNotes?: string;
  createdBy: string;
  createdByName: string;
  createdByAvatar?: string;
  createdAt: string;
  updatedAt: string;
  comments: ChatComment[];
}
