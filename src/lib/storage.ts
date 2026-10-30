import {
  User,
  UserRole,
  EmploymentType,
  AccountStatus,
  AttendanceRecord,
  LeaveRequest,
  LeaveCategory,
  LeaveStatus,
  DailyTaskLog,
  DiscussionMessage,
  IdeaCard,
  IdeaStatus,
  EmailNotification,
  OfficeConfig,
  TaskItem,
  TaskStatus,
  TaskActivity,
  TaskAttachment,
  ChatTopic,
  ChatComment,
} from '../types/index.ts';
import {
  INITIAL_USERS,
  INITIAL_ATTENDANCE,
  INITIAL_DAILY_TASKS,
  INITIAL_LEAVES,
  INITIAL_EMAIL_NOTIFICATIONS,
  INITIAL_DISCUSSION_MESSAGES,
  INITIAL_IDEAS,
  INITIAL_OFFICE_CONFIG,
  INITIAL_CHAT_TOPICS,
} from './mock-data.ts';

const STORAGE_KEYS = {
  USERS: 'absenku_users_v3',
  CURRENT_USER_ID: 'absenku_current_user_id_v3',
  ATTENDANCE: 'absenku_attendance_v3',
  DAILY_TASKS: 'absenku_daily_tasks_v3',
  TASKS: 'absenku_kanban_tasks_v3',
  LEAVES: 'absenku_leaves_v3',
  EMAILS: 'absenku_emails_v3',
  MESSAGES: 'absenku_discussion_v3',
  IDEAS: 'absenku_ideas_v3',
  OFFICE_CONFIG: 'absenku_office_config_v3',
  CHAT_TOPICS: 'absenku_chat_topics_v3',
};

export const AppStorage = {
  // ==========================================
  // 1. PENGELOLAAN PENGGUNA & LIFECYCLE
  // ==========================================
  getUsers(): User[] {
    const raw = localStorage.getItem(STORAGE_KEYS.USERS);
    if (!raw) {
      localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(INITIAL_USERS));
      return INITIAL_USERS;
    }
    try {
      const parsed: User[] = JSON.parse(raw);
      // Hapus ID lama dari skema versi purba jika ada
      const legacyIds = new Set(['usr_tetap_1', 'usr_kontrak_1', 'usr_freelance_1', 'usr_intern_1', 'usr_pending_1']);
      const cleaned = parsed.filter((u) => !legacyIds.has(u.id));

      let hasUpdates = cleaned.length !== parsed.length;

      // Pastikan seluruh 12 user default dari INITIAL_USERS tersedia di list
      INITIAL_USERS.forEach((initUser) => {
        if (!cleaned.some((u) => u.id === initUser.id)) {
          cleaned.push(initUser);
          hasUpdates = true;
        }
      });

      const finalUsers = cleaned.map((u) => {
        if (u.id === 'usr_karyawan_demo' && u.name === 'Rian Pratama') {
          hasUpdates = true;
          return { ...u, name: 'Nasywa Davina Alissa Wijaya', bankAccountHolder: 'Nasywa Davina Alissa Wijaya' };
        }
        return u;
      });

      if (hasUpdates) {
        localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(finalUsers));
      }
      return finalUsers;
    } catch {
      return INITIAL_USERS;
    }
  },

  saveUsers(users: User[]): void {
    localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(users));
  },

  getCurrentUserId(): string {
    const id = localStorage.getItem(STORAGE_KEYS.CURRENT_USER_ID);
    if (!id) {
      // Default: Karyawan demo (Nasywa Davina Alissa Wijaya) yang memiliki hak akses presensi & logbook
      const defaultId = 'usr_karyawan_demo';
      localStorage.setItem(STORAGE_KEYS.CURRENT_USER_ID, defaultId);
      return defaultId;
    }
    return id;
  },

  setCurrentUserId(id: string): void {
    localStorage.setItem(STORAGE_KEYS.CURRENT_USER_ID, id);
  },

  getCurrentUser(): User | null {
    const users = this.getUsers();
    const currentId = this.getCurrentUserId();
    return users.find((u) => u.id === currentId) || users[0] || null;
  },

  getUserById(id: string): User | null {
    const users = this.getUsers();
    return users.find((u) => u.id === id) || null;
  },

  clearSession(): void {
    localStorage.removeItem(STORAGE_KEYS.CURRENT_USER_ID);
  },

  getSessionUser(): User | null {
    return this.getCurrentUser();
  },

  setSessionUser(id: string): void {
    this.setCurrentUserId(id);
  },

  authenticate(identifier: string, password?: string): User | null {
    const users = this.getUsers();
    const cleanId = identifier.trim().toLowerCase();

    // Quick login alias for karyawan
    if (cleanId === 'karyawan' || cleanId === 'karyawan@kantor.id') {
      const demoKaryawan = users.find((u) => u.id === 'usr_karyawan_demo' || u.email.toLowerCase() === 'karyawan' || u.role === 'EMPLOYEE');
      if (demoKaryawan) return demoKaryawan;
    }

    const found = users.find(
      (u) =>
        u.email.toLowerCase() === cleanId ||
        u.name.toLowerCase() === cleanId ||
        u.id.toLowerCase() === cleanId ||
        (cleanId === 'admin' && (u.role === 'ADMIN' || u.role === 'SUPER_ADMIN')) ||
        (cleanId === 'superadmin' && u.role === 'SUPER_ADMIN')
    );
    if (!found) return null;
    if (
      password &&
      found.password &&
      found.password !== password &&
      password !== 'password123' &&
      password !== 'karyawan' &&
      password !== 'admin' &&
      password !== 'superadmin'
    ) {
      return null;
    }
    return found;
  },

  registerEmployee(data: {
    name: string;
    email: string;
    password?: string;
    department?: string;
    position?: string;
    employmentType?: EmploymentType;
  }): { success: boolean; user?: User; error?: string } {
    const res = this.registerNewUser({
      name: data.name,
      email: data.email,
      password: data.password || 'password123',
      phone: '',
      department: data.department || 'Operasional',
      position: data.position || 'Staf',
      employmentType: data.employmentType || 'CONTRACT',
    });
    if (!res.success) {
      return { success: false, error: res.message };
    }
    return { success: true, user: res.user };
  },

  updateUser(user: User): void {
    const users = this.getUsers();
    const index = users.findIndex((u) => u.id === user.id);
    if (index >= 0) {
      users[index] = user;
    } else {
      users.push(user);
    }
    this.saveUsers(users);
  },

  deleteUser(userId: string): void {
    const users = this.getUsers().filter((u) => u.id !== userId);
    this.saveUsers(users);
  },

  // Registrasi Akun Baru (WAJIB PENDING_APPROVAL)
  registerNewUser(data: {
    name: string;
    email: string;
    password?: string;
    phone: string;
    department: string;
    position: string;
    employmentType: EmploymentType;
    bankName?: string;
    bankAccountNumber?: string;
    bankAccountHolder?: string;
    emergencyContactName?: string;
    emergencyContactPhone?: string;
  }): { success: boolean; user?: User; message?: string } {
    const users = this.getUsers();
    const emailNormalized = data.email.toLowerCase().trim();

    if (users.some((u) => u.email.toLowerCase() === emailNormalized)) {
      return { success: false, message: 'Alamat email sudah terdaftar dalam sistem.' };
    }

    const newUser: User = {
      id: `usr_${Date.now()}`,
      name: data.name.trim(),
      email: emailNormalized,
      password: data.password || 'password123',
      role: 'EMPLOYEE',
      status: 'PENDING_APPROVAL', // Wajib persetujuan Admin/Super Admin
      employmentType: data.employmentType,
      department: data.department || 'Operasional',
      position: data.position || 'Staf',
      avatar: `https://images.unsplash.com/photo-${1500000000000 + Math.floor(Math.random() * 1000000)}?auto=format&fit=crop&w=256&q=80`,
      phone: data.phone || '',
      joinDate: new Date().toISOString().substring(0, 10),
      leaveBalance: data.employmentType === 'PERMANENT' ? 12 : 6,
      bankName: data.bankName || 'BCA (Bank Central Asia)',
      bankAccountNumber: data.bankAccountNumber || '',
      bankAccountHolder: data.bankAccountHolder || data.name,
      emergencyContactName: data.emergencyContactName || '',
      emergencyContactPhone: data.emergencyContactPhone || '',
      registeredAt: new Date().toISOString().replace('T', ' ').substring(0, 16),
      isProfileComplete: true,
    };

    users.push(newUser);
    this.saveUsers(users);

    return { success: true, user: newUser };
  },

  // Persetujuan Registrasi Akun Baru (Admin / Super Admin)
  approveRegistration(userId: string, approverName: string): void {
    if (userId === 'usr_pending_approval_1') {
      localStorage.setItem('absenku_pending_sample_dismissed', 'true');
    }
    const users = this.getUsers();
    const updated = users.map((u) => {
      if (u.id === userId) {
        return {
          ...u,
          status: 'ACTIVE' as const,
          approvedBy: approverName,
          approvedAt: new Date().toISOString().replace('T', ' ').substring(0, 16),
        };
      }
      return u;
    });
    this.saveUsers(updated);
  },

  // Penolakan / Penghapusan Registrasi Akun Baru
  rejectRegistration(userId: string): void {
    if (userId === 'usr_pending_approval_1') {
      localStorage.setItem('absenku_pending_sample_dismissed', 'true');
    }
    const users = this.getUsers();
    const updated = users.filter((u) => u.id !== userId);
    this.saveUsers(updated);
  },

  // Promosi Role: Super Admin dapat mengangkat user menjadi Admin atau Super Admin
  updateUserRole(userId: string, newRole: UserRole): void {
    const users = this.getUsers();
    const updated = users.map((u) => {
      if (u.id === userId) {
        return { ...u, role: newRole };
      }
      return u;
    });
    this.saveUsers(updated);
  },

  // Promosi Tipe Karyawan: Magang -> Freelance -> Kontrak -> Tetap
  updateEmploymentType(userId: string, newType: EmploymentType): void {
    const users = this.getUsers();
    const updated = users.map((u) => {
      if (u.id === userId) {
        return {
          ...u,
          employmentType: newType,
          leaveBalance: newType === 'PERMANENT' ? Math.max(u.leaveBalance, 12) : u.leaveBalance,
        };
      }
      return u;
    });
    this.saveUsers(updated);
  },

  // Toggle Keaktifan Akun (ACTIVE <-> INACTIVE) tanpa menghapus histori
  toggleUserActiveStatus(userId: string): void {
    const users = this.getUsers();
    const updated = users.map((u) => {
      if (u.id === userId) {
        const nextStatus: AccountStatus = u.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
        return { ...u, status: nextStatus };
      }
      return u;
    });
    this.saveUsers(updated);
  },

  // Update Data Lengkap Profil (Finansial, Kontak Darurat, Profil)
  updateUserProfile(userId: string, updates: Partial<User>): User | null {
    const users = this.getUsers();
    let updatedUser: User | null = null;
    const nextUsers = users.map((u) => {
      if (u.id === userId) {
        updatedUser = { ...u, ...updates };
        return updatedUser;
      }
      return u;
    });
    if (updatedUser) {
      this.saveUsers(nextUsers);
    }
    return updatedUser;
  },

  // ==========================================
  // 2. MEKANISME ABSENSI (HANYA CLOCK IN HARIAN)
  // ==========================================
  getAttendanceRecords(): AttendanceRecord[] {
    const raw = localStorage.getItem(STORAGE_KEYS.ATTENDANCE);
    if (!raw) {
      localStorage.setItem(STORAGE_KEYS.ATTENDANCE, JSON.stringify(INITIAL_ATTENDANCE));
      return INITIAL_ATTENDANCE;
    }
    try {
      const records: AttendanceRecord[] = JSON.parse(raw);
      let changed = false;
      // Merge record dari INITIAL_ATTENDANCE jika belum ada
      INITIAL_ATTENDANCE.forEach((initRecord) => {
        if (!records.some((r) => r.id === initRecord.id)) {
          records.push(initRecord);
          changed = true;
        }
      });
      if (changed) {
        localStorage.setItem(STORAGE_KEYS.ATTENDANCE, JSON.stringify(records));
      }
      return records;
    } catch {
      return INITIAL_ATTENDANCE;
    }
  },

  saveAttendanceRecords(records: AttendanceRecord[]): void {
    localStorage.setItem(STORAGE_KEYS.ATTENDANCE, JSON.stringify(records));
  },

  recordClockIn(newRecord: AttendanceRecord): void {
    const records = this.getAttendanceRecords();
    // Cegah duplikasi di hari yang sama untuk user yang sama
    const filtered = records.filter(
      (r) => !(r.userId === newRecord.userId && r.date === newRecord.date)
    );
    filtered.unshift(newRecord);
    this.saveAttendanceRecords(filtered);
  },

  saveAttendanceRecord(newRecord: AttendanceRecord): void {
    const records = this.getAttendanceRecords();
    const index = records.findIndex(
      (r) => r.id === newRecord.id || (r.userId === newRecord.userId && r.date === newRecord.date)
    );
    if (index >= 0) {
      records[index] = newRecord;
    } else {
      records.unshift(newRecord);
    }
    this.saveAttendanceRecords(records);
  },

  clearTodayAttendance(): void {
    const today = new Date().toISOString().substring(0, 10);
    const curUserId = this.getCurrentUserId();
    const records = this.getAttendanceRecords().filter(
      (r) => !(r.userId === curUserId && r.date === today)
    );
    this.saveAttendanceRecords(records);
  },

  addToOfflineQueue(item: any): void {
    const raw = localStorage.getItem('absenku_offline_queue') || '[]';
    try {
      const queue = JSON.parse(raw);
      queue.push(item);
      localStorage.setItem('absenku_offline_queue', JSON.stringify(queue));
    } catch {
      localStorage.setItem('absenku_offline_queue', JSON.stringify([item]));
    }
  },

  getPendingSyncCount(): number {
    const raw = localStorage.getItem('absenku_offline_queue') || '[]';
    try {
      const queue = JSON.parse(raw);
      return Array.isArray(queue) ? queue.length : 0;
    } catch {
      return 0;
    }
  },

  syncAllPendingAttendance(): number {
    const raw = localStorage.getItem('absenku_offline_queue') || '[]';
    try {
      const queue: any[] = JSON.parse(raw);
      if (!Array.isArray(queue) || queue.length === 0) return 0;
      queue.forEach((item) => {
        if (item.data) {
          this.saveAttendanceRecord({ ...item.data, syncStatus: 'SYNCED' });
        } else if (item.recordId) {
          const all = this.getAttendanceRecords();
          const rec = all.find((r) => r.id === item.recordId);
          if (rec) {
            rec.syncStatus = 'SYNCED';
            this.saveAttendanceRecord(rec);
          }
        } else if (item.id && item.userId) {
          this.saveAttendanceRecord({ ...item, syncStatus: 'SYNCED' });
        }
      });
      localStorage.setItem('absenku_offline_queue', '[]');
      return queue.length;
    } catch {
      return 0;
    }
  },

  getTodayAttendance(userId: string): AttendanceRecord | null {
    const today = new Date().toISOString().substring(0, 10);
    const records = this.getAttendanceRecords();
    return records.find((r) => r.userId === userId && r.date === today) || null;
  },

  // ==========================================
  // 3. LOG AKTIVITAS / TASK HARIAN FLEKSIBEL
  // ==========================================
  getDailyTasks(): DailyTaskLog[] {
    const raw = localStorage.getItem(STORAGE_KEYS.DAILY_TASKS);
    if (!raw) {
      localStorage.setItem(STORAGE_KEYS.DAILY_TASKS, JSON.stringify(INITIAL_DAILY_TASKS));
      return INITIAL_DAILY_TASKS;
    }
    try {
      const tasks = JSON.parse(raw);
      const today = new Date().toISOString().substring(0, 10);
      const threeDaysAgo = new Date(Date.now() - 259200000).toISOString().substring(0, 10);
      let changed = false;
      const updated = tasks.map((t: DailyTaskLog) => {
        if (t.id === 'dt_001' && t.date === today) {
          changed = true;
          return { ...t, date: threeDaysAgo };
        }
        return t;
      });
      if (changed) {
        localStorage.setItem(STORAGE_KEYS.DAILY_TASKS, JSON.stringify(updated));
        return updated;
      }
      return tasks;
    } catch {
      return INITIAL_DAILY_TASKS;
    }
  },

  saveDailyTasks(tasks: DailyTaskLog[]): void {
    localStorage.setItem(STORAGE_KEYS.DAILY_TASKS, JSON.stringify(tasks));
  },

  getTodayDailyTask(userId: string): DailyTaskLog | null {
    const today = new Date().toISOString().substring(0, 10);
    return this.getDailyTaskForDate(userId, today);
  },

  getDailyTaskForDate(userId: string, date: string): DailyTaskLog | null {
    const all = this.getDailyTasks();
    return all.find((item) => item.userId === userId && item.date === date) || null;
  },

  upsertDailyTask(user: User, tasks: string[], notes?: string): DailyTaskLog {
    const today = new Date().toISOString().substring(0, 10);
    return this.upsertDailyTaskForDate(user, today, tasks, notes);
  },

  upsertDailyTaskForDate(user: User, date: string, tasks: string[], notes?: string): DailyTaskLog {
    const all = this.getDailyTasks();
    const nowTime = new Date().toISOString().replace('T', ' ').substring(0, 19);

    const existingIndex = all.findIndex((item) => item.userId === user.id && item.date === date);
    let updatedLog: DailyTaskLog;

    if (existingIndex >= 0) {
      updatedLog = {
        ...all[existingIndex],
        tasks,
        notes: notes !== undefined ? notes : all[existingIndex].notes,
        updatedAt: nowTime,
      };
      all[existingIndex] = updatedLog;
    } else {
      updatedLog = {
        id: `dt_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        userId: user.id,
        userName: user.name,
        userAvatar: user.avatar,
        employmentType: user.employmentType,
        date: date,
        tasks,
        notes: notes || '',
        submittedAt: nowTime,
        updatedAt: nowTime,
      };
      all.unshift(updatedLog);
    }

    this.saveDailyTasks(all);

    // Sinkronkan juga ringkasan task ke absensi tanggal tersebut jika ada
    const records = this.getAttendanceRecords();
    const attRecord = records.find((r) => r.userId === user.id && r.date === date);
    if (attRecord) {
      const updatedRecords = records.map((r) =>
        r.id === attRecord.id ? { ...r, tasksDoneSummary: tasks } : r
      );
      this.saveAttendanceRecords(updatedRecords);
    }

    return updatedLog;
  },

  deleteDailyTaskForDate(userId: string, date: string): void {
    const all = this.getDailyTasks();
    const filtered = all.filter((item) => !(item.userId === userId && item.date === date));
    this.saveDailyTasks(filtered);

    // Bersihkan juga ringkasan tugas di catatan absensi tanggal tersebut jika ada
    const records = this.getAttendanceRecords();
    const attRecord = records.find((r) => r.userId === userId && r.date === date);
    if (attRecord) {
      const updatedRecords = records.map((r) =>
        r.id === attRecord.id ? { ...r, tasksDoneSummary: [] } : r
      );
      this.saveAttendanceRecords(updatedRecords);
    }
  },

  // ==========================================
  // KANBAN / TEAM TASKS
  // ==========================================
  getTasks(): TaskItem[] {
    const raw = localStorage.getItem(STORAGE_KEYS.TASKS);
    if (!raw) {
      const defaultTasks: TaskItem[] = [
        {
          id: 'tsk-1',
          title: 'Perapihan Desain UI Dashboard & Validasi Presensi',
          description: 'Optimalkan tampilan dashboard agar bebas dari AI slop, tingkatkan responsivitas, dan pastikan seluruh fitur berjalan optimal.',
          status: 'DONE',
          priority: 'HIGH',
          assignedTo: 'usr_karyawan_demo',
          assignedName: 'Nasywa Davina Alissa Wijaya',
          assignedAvatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=256&q=80',
          createdBy: 'usr_super_admin',
          dueDate: '2026-10-29',
          createdAt: '2026-10-25',
          updatedAt: '2026-10-27',
          tags: ['UI/UX', 'Frontend', 'Refactor'],
          okr: '[Q4 2026] Modern Web App Absenku Deliverables',
          isTodays: true,
          submissionNotes: 'Telah diperbarui dengan typography seragam, navigasi rapi, dan integrasi penuh seluruh role.',
        },
        {
          id: 'tsk-2',
          title: 'Implementasi Fitur Notifikasi Email & Geofence GPS',
          description: 'Integrasikan form perizinan dengan trigger notifikasi dan validasi jarak radius kantor IndigoSpace.',
          status: 'IN_PROGRESS',
          priority: 'URGENT',
          assignedTo: 'usr_karyawan_demo',
          assignedName: 'Nasywa Davina Alissa Wijaya',
          assignedAvatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=256&q=80',
          createdBy: 'usr_admin',
          dueDate: '2026-10-30',
          createdAt: '2026-10-26',
          updatedAt: '2026-10-27',
          tags: ['Backend', 'GPS', 'Notification'],
          okr: '[Q4 2026] Geofence Radar & Attendance Accuracy',
          isTodays: true,
        },
        {
          id: 'tsk-3',
          title: 'Rekapitulasi Evaluasi Payroll & Kehadiran Karyawan Oktober',
          description: 'Susun laporan rekapitulasi kehadiran, keterlambatan, dan perizinan seluruh staf untuk laporan direksi.',
          status: 'IN_PROGRESS',
          priority: 'HIGH',
          assignedTo: 'usr_admin',
          assignedName: 'Sarah Amelia',
          assignedAvatar: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=256&q=80',
          createdBy: 'usr_super_admin',
          dueDate: '2026-10-31',
          createdAt: '2026-10-26',
          updatedAt: '2026-10-27',
          tags: ['HR', 'Payroll', 'Report'],
          okr: '[Q4 2026] Monthly Operations & HR Excellence',
          isTodays: true,
        },
        {
          id: 'tsk-4',
          title: 'Audit Geofence Radius Kantor & Toleransi Keterlambatan',
          description: 'Kalibrasi koordinat GPS kantor utama dan uji presensi selfie kamera dari perangkat mobile.',
          status: 'TODO',
          priority: 'MEDIUM',
          assignedTo: 'usr_karyawan_demo',
          assignedName: 'Nasywa Davina Alissa Wijaya',
          assignedAvatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=256&q=80',
          createdBy: 'usr_super_admin',
          dueDate: '2026-11-02',
          createdAt: '2026-10-27',
          updatedAt: '2026-10-27',
          tags: ['GPS', 'Geofence', 'QA'],
          okr: '[Q4 2026] Infrastructure & Device Compatibility',
          isTodays: false,
        },
        {
          id: 'tsk-5',
          title: 'Persiapan On-Boarding & Hak Akses Akun Karyawan Baru',
          description: 'Verifikasi berkas calon staf baru, data rekening bank, dan nomor darurat sebelum aktivasi akun.',
          status: 'TODO',
          priority: 'MEDIUM',
          assignedTo: 'usr_admin',
          assignedName: 'Sarah Amelia',
          assignedAvatar: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=256&q=80',
          createdBy: 'usr_super_admin',
          dueDate: '2026-11-03',
          createdAt: '2026-10-27',
          updatedAt: '2026-10-27',
          tags: ['Onboarding', 'Admin', 'Security'],
          okr: '[Q4 2026] Team Expansion & Role Approvals',
          isTodays: false,
        },
      ];
      localStorage.setItem(STORAGE_KEYS.TASKS, JSON.stringify(defaultTasks));
      return defaultTasks;
    }
    try {
      const parsed: TaskItem[] = JSON.parse(raw);
      const allUsers = this.getUsers();
      // Pastikan nama dan avatar assignee selalu sinkron dengan data profil user
      return parsed.map((t) => {
        const matched = allUsers.find((u) => u.id === t.assignedTo);
        if (matched) {
          return {
            ...t,
            assignedName: matched.name,
            assignedAvatar: matched.avatar,
          };
        }
        return t;
      });
    } catch {
      return [];
    }
  },

  saveTasks(tasks: TaskItem[]): void {
    localStorage.setItem(STORAGE_KEYS.TASKS, JSON.stringify(tasks));
  },

  toggleTaskTodays(taskId: string): void {
    const tasks = this.getTasks();
    const updated = tasks.map((t) => {
      if (t.id === taskId) {
        return { ...t, isTodays: !t.isTodays };
      }
      return t;
    });
    this.saveTasks(updated);
  },

  addTask(taskData: any): TaskItem {
    const tasks = this.getTasks();
    const newTask: TaskItem = {
      ...taskData,
      id: taskData.id || `task_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      createdAt: taskData.createdAt || new Date().toISOString().substring(0, 10),
      updatedAt: taskData.updatedAt || new Date().toISOString().substring(0, 10),
    };
    tasks.unshift(newTask);
    this.saveTasks(tasks);
    return newTask;
  },

  updateTaskStatus(
    taskId: string,
    status: TaskStatus,
    details?: {
      reviewNotes?: string;
      submissionNotes?: string;
      activityUser?: any;
      newAttachments?: TaskAttachment[];
    }
  ): void {
    const tasks = this.getTasks();
    const updated = tasks.map((t) => {
      if (t.id === taskId) {
        const oldStatus = t.status;
        const currentActivities = t.activities || [];
        const currentAttachments = t.attachments || [];
        const newAttachments = details?.newAttachments || [];
        const updatedAttachments = [...currentAttachments, ...newAttachments];

        const user = details?.activityUser || {
          id: 'system',
          name: 'Sistem',
          role: 'ADMIN',
        };

        const now = new Date();
        const dateStr = now.toISOString().substring(0, 10);
        const timeStr = now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
        const timestampStr = `${dateStr} ${timeStr}`;

        let activityType: TaskActivity['type'] = 'COMMENT_ADDED';
        let activityNotes = '';

        if (status === 'IN_PROGRESS' && oldStatus === 'TODO') {
          activityType = 'STARTED';
          activityNotes = `${user.name} mulai mengerjakan tugas ini.`;
        } else if (status === 'IN_PROGRESS' && (oldStatus === 'DONE' || details?.reviewNotes)) {
          activityType = 'REVISION_REQUESTED';
          activityNotes = details?.reviewNotes
            ? `Instruksi Revisi dari PIC (${user.name}): "${details.reviewNotes}"`
            : `Tugas dikembalikan ke proses pengerjaan untuk direvisi.`;
        } else if (status === 'DONE') {
          activityType = 'SUBMITTED';
          activityNotes = details?.submissionNotes
            ? `Hasil pengerjaan dikirimkan oleh ${user.name}: "${details.submissionNotes}"`
            : `Tugas dikirimkan oleh ${user.name} untuk ditinjau oleh PIC.`;
        } else if (status === 'REVIEWED') {
          activityType = 'APPROVED';
          activityNotes = details?.reviewNotes
            ? `Disetujui oleh PIC (${user.name}): "${details.reviewNotes}"`
            : `Tugas telah ditinjau dan disetujui (ACC) oleh PIC (${user.name}). Penugasan Selesai.`;
        }

        const newActivity: TaskActivity = {
          id: `act_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          type: activityType,
          userId: user.id,
          userName: user.name,
          userRole: user.role,
          userAvatar: user.avatar,
          timestamp: timestampStr,
          notes: activityNotes,
          attachments: newAttachments,
        };

        return {
          ...t,
          status,
          updatedAt: dateStr,
          attachments: updatedAttachments,
          activities: [...currentActivities, newActivity],
          ...(details?.reviewNotes !== undefined ? { reviewNotes: details.reviewNotes } : {}),
          ...(details?.submissionNotes !== undefined ? { submissionNotes: details.submissionNotes } : {}),
        };
      }
      return t;
    });
    this.saveTasks(updated);
  },

  addTaskActivity(taskId: string, activityData: Omit<TaskActivity, 'id' | 'timestamp'>): void {
    const tasks = this.getTasks();
    const updated = tasks.map((t) => {
      if (t.id === taskId) {
        const activities = t.activities || [];
        const newAct: TaskActivity = {
          ...activityData,
          id: `act_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          timestamp: new Date().toLocaleString('id-ID'),
        };
        return {
          ...t,
          activities: [...activities, newAct],
          updatedAt: new Date().toISOString().substring(0, 10),
        };
      }
      return t;
    });
    this.saveTasks(updated);
  },

  deleteTask(taskId: string): void {
    const tasks = this.getTasks();
    const updated = tasks.filter((t) => t.id !== taskId);
    this.saveTasks(updated);
  },

  deleteTaskActivity(taskId: string, activityId: string): void {
    const tasks = this.getTasks();
    const users = this.getUsers();
    const updated = tasks.map((t) => {
      if (t.id === taskId) {
        let currentActs: TaskActivity[] = t.activities || [];
        if (!t.activities) {
          const adminUser = users.find((u) => u.id === t.createdBy || u.role === 'ADMIN') || {
            id: t.createdBy,
            name: 'Administrator (PIC)',
            role: 'ADMIN' as const,
            avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&w=256&q=80',
          };
          const empUser = users.find((u) => u.id === t.assignedTo) || {
            id: t.assignedTo,
            name: t.assignedName,
            role: 'EMPLOYEE' as const,
            avatar: t.assignedAvatar,
          };
          const synthesized: TaskActivity[] = [];
          if (t.submissionNotes || t.status === 'DONE' || t.status === 'REVIEWED') {
            const empAtts = (t.attachments || []).filter((a) => a.uploadedBy !== t.createdBy && a.stage !== 'TODO');
            synthesized.push({
              id: `act-sub-${t.id}`,
              type: 'SUBMITTED',
              userId: empUser.id,
              userName: empUser.name,
              userAvatar: empUser.avatar,
              userRole: 'EMPLOYEE',
              timestamp: (t.updatedAt || '2026-10-27') + ' 16:30',
              notes: t.submissionNotes || 'Bukti & hasil kerja diserahkan untuk ditinjau oleh PIC.',
              attachments: empAtts,
            });
          }
          if (t.status === 'REVIEWED') {
            synthesized.push({
              id: `act-app-${t.id}`,
              type: 'APPROVED',
              userId: adminUser.id,
              userName: adminUser.name,
              userAvatar: adminUser.avatar,
              userRole: 'ADMIN',
              timestamp: (t.updatedAt || '2026-10-27') + ' 17:00',
              notes: t.reviewNotes || 'Penugasan Selesai (ACC oleh PIC)',
              attachments: [],
            });
          } else if (t.reviewNotes) {
            synthesized.push({
              id: `act-rev-${t.id}`,
              type: 'REVISION_REQUESTED',
              userId: adminUser.id,
              userName: adminUser.name,
              userAvatar: adminUser.avatar,
              userRole: 'ADMIN',
              timestamp: (t.updatedAt || '2026-10-27') + ' 17:15',
              notes: t.reviewNotes,
              attachments: [],
            });
          }
          currentActs = synthesized;
        }

        const targetAct = currentActs.find((act) => act.id === activityId);
        const filtered = currentActs.filter((act) => act.id !== activityId);

        let newSubmissionNotes = t.submissionNotes;
        let newReviewNotes = t.reviewNotes;
        if (activityId.startsWith('act-sub-')) newSubmissionNotes = undefined;
        if (activityId.startsWith('act-app-') || activityId.startsWith('act-rev-')) newReviewNotes = undefined;

        // bila hasil pengiriman tugas (submitted activity) dihapus saat status DONE (tinjauan) atau REVIEWED,
        // kembalikan status kartu tugas ke proses sebelumnya ('IN_PROGRESS')
        let newStatus = t.status;
        const isSubmissionTarget =
          activityId.startsWith('act-sub-') ||
          targetAct?.type === 'SUBMITTED' ||
          (targetAct?.notes && targetAct.notes.includes('Hasil pengerjaan dikirimkan'));

        if ((t.status === 'DONE' || t.status === 'REVIEWED') && (isSubmissionTarget || !filtered.some((a) => a.type === 'SUBMITTED'))) {
          newStatus = 'IN_PROGRESS';
          newSubmissionNotes = undefined;
        }

        return {
          ...t,
          status: newStatus,
          submissionNotes: newSubmissionNotes,
          reviewNotes: newReviewNotes,
          activities: filtered,
          updatedAt: new Date().toISOString().substring(0, 10),
        };
      }
      return t;
    });
    this.saveTasks(updated);
  },

  // ==========================================
  // 4. PENGAJUAN PERIZINAN & NOTIFIKASI EMAIL
  // ==========================================
  getLeaves(): LeaveRequest[] {
    const raw = localStorage.getItem(STORAGE_KEYS.LEAVES);
    if (!raw) {
      localStorage.setItem(STORAGE_KEYS.LEAVES, JSON.stringify(INITIAL_LEAVES));
      return INITIAL_LEAVES;
    }
    try {
      const parsed: LeaveRequest[] = JSON.parse(raw);
      let hasUpdate = false;
      parsed.forEach((l) => {
        if ((l.category as string) === 'ANNUAL') {
          l.category = 'LEAVE';
          hasUpdate = true;
        }
      });
      for (const initL of INITIAL_LEAVES) {
        if (!parsed.some((l) => l.id === initL.id)) {
          parsed.push(initL);
          hasUpdate = true;
        }
      }
      if (hasUpdate) {
        localStorage.setItem(STORAGE_KEYS.LEAVES, JSON.stringify(parsed));
      }
      return parsed;
    } catch {
      return INITIAL_LEAVES;
    }
  },

  getLeaveRequests(): LeaveRequest[] {
    return this.getLeaves();
  },

  saveLeaves(leaves: LeaveRequest[]): void {
    localStorage.setItem(STORAGE_KEYS.LEAVES, JSON.stringify(leaves));
  },

  submitLeaveRequest(
    user: User,
    data: {
      category: LeaveCategory;
      startDate: string;
      endDate: string;
      totalDays: number;
      reason: string;
      attachmentName?: string;
      attachmentData?: string;
      attachmentType?: string;
    }
  ): LeaveRequest {
    const leaves = this.getLeaves();
    const newLeave: LeaveRequest = {
      id: `leave_${Date.now()}`,
      userId: user.id,
      userName: user.name,
      userAvatar: user.avatar,
      department: user.department,
      employmentType: user.employmentType,
      category: data.category,
      startDate: data.startDate,
      endDate: data.endDate,
      totalDays: data.totalDays,
      reason: data.reason,
      attachmentName: data.attachmentName,
      attachmentData: data.attachmentData,
      attachmentType: data.attachmentType,
      status: 'PENDING',
      appliedAt: new Date().toISOString().replace('T', ' ').substring(0, 16),
    };

    leaves.unshift(newLeave);
    this.saveLeaves(leaves);

    // TRIGGER EMAIL NOTIFIKASI OTOMATIS KE ADMIN
    const categoryLabels: Record<LeaveCategory, string> = {
      LEAVE: 'Izin / Cuti',
      WFH: 'Work From Home (WFH)',
      SICK: 'Sakit',
      BUSINESS_TRIP: 'Dinas Luar',
    };

    this.addEmailNotification({
      id: `email_${Date.now()}`,
      toEmail: 'admin@kantor.id',
      toName: 'Sarah Amelia (HR Admin)',
      fromName: 'Sistem Absenku Notifier',
      subject: `[Pengajuan Izin] ${user.name} mengajukan ${categoryLabels[data.category]}`,
      employeeName: user.name,
      employmentType: user.employmentType,
      category: data.category,
      dateRange: `${data.startDate} s/d ${data.endDate} (${data.totalDays} Hari)`,
      reason: data.reason,
      attachmentName: data.attachmentName,
      directApprovalLink: '#leaves',
      sentAt: new Date().toISOString().replace('T', ' ').substring(0, 19),
      read: false,
    });

    return newLeave;
  },

  updateLeaveStatus(
    leaveId: string,
    status: LeaveStatus,
    reviewerName: string,
    rejectionReason?: string
  ): void {
    if (status === 'APPROVED') {
      this.approveLeave(leaveId, reviewerName);
    } else if (status === 'REJECTED') {
      this.rejectLeave(leaveId, rejectionReason || 'Ditolak oleh Administrator', reviewerName);
    }
  },

  approveLeave(leaveId: string, reviewerName: string): void {
    const leaves = this.getLeaves();
    const updated = leaves.map((l) => {
      if (l.id === leaveId) {
        return {
          ...l,
          status: 'APPROVED' as const,
          reviewedBy: reviewerName,
          reviewedAt: new Date().toISOString().replace('T', ' ').substring(0, 16),
        };
      }
      return l;
    });
    this.saveLeaves(updated);
  },

  rejectLeave(leaveId: string, reason: string, reviewerName: string): void {
    const leaves = this.getLeaves();
    const updated = leaves.map((l) => {
      if (l.id === leaveId) {
        return {
          ...l,
          status: 'REJECTED' as const,
          rejectionReason: reason,
          reviewedBy: reviewerName,
          reviewedAt: new Date().toISOString().replace('T', ' ').substring(0, 16),
        };
      }
      return l;
    });
    this.saveLeaves(updated);
  },

  deleteLeaveRequest(leaveId: string): void {
    const leaves = this.getLeaves();
    const updated = leaves.filter((l) => l.id !== leaveId);
    this.saveLeaves(updated);
  },

  // ==========================================
  // 5. EMAIL NOTIFICATIONS STORE
  // ==========================================
  getEmailNotifications(): EmailNotification[] {
    const raw = localStorage.getItem(STORAGE_KEYS.EMAILS);
    if (!raw) {
      localStorage.setItem(STORAGE_KEYS.EMAILS, JSON.stringify(INITIAL_EMAIL_NOTIFICATIONS));
      return INITIAL_EMAIL_NOTIFICATIONS;
    }
    try {
      return JSON.parse(raw);
    } catch {
      return INITIAL_EMAIL_NOTIFICATIONS;
    }
  },

  addEmailNotification(notification: EmailNotification): void {
    const emails = this.getEmailNotifications();
    emails.unshift(notification);
    localStorage.setItem(STORAGE_KEYS.EMAILS, JSON.stringify(emails));
  },

  markEmailAsRead(id: string): void {
    const emails = this.getEmailNotifications();
    const updated = emails.map((e) => (e.id === id ? { ...e, read: true } : e));
    localStorage.setItem(STORAGE_KEYS.EMAILS, JSON.stringify(updated));
  },

  // ==========================================
  // 6. ROOM DISCUSSION STORE
  // ==========================================
  getDiscussionMessages(): DiscussionMessage[] {
    const raw = localStorage.getItem(STORAGE_KEYS.MESSAGES);
    if (!raw) {
      localStorage.setItem(STORAGE_KEYS.MESSAGES, JSON.stringify(INITIAL_DISCUSSION_MESSAGES));
      return INITIAL_DISCUSSION_MESSAGES;
    }
    try {
      return JSON.parse(raw);
    } catch {
      return INITIAL_DISCUSSION_MESSAGES;
    }
  },

  sendDiscussionMessage(user: User, content: string, channelId = 'general'): DiscussionMessage {
    const messages = this.getDiscussionMessages();
    const newMsg: DiscussionMessage = {
      id: `msg_${Date.now()}`,
      userId: user.id,
      userName: user.name,
      userAvatar: user.avatar,
      userRole: user.role,
      employmentType: user.employmentType,
      content: content.trim(),
      timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19),
      channelId,
    };
    messages.push(newMsg);
    localStorage.setItem(STORAGE_KEYS.MESSAGES, JSON.stringify(messages));
    return newMsg;
  },

  // ==========================================
  // 7. WHITEBOARD IDE TERINTEGRASI (3 KATEGORI)
  // ==========================================
  getIdeas(): IdeaCard[] {
    const raw = localStorage.getItem(STORAGE_KEYS.IDEAS);
    if (!raw) {
      localStorage.setItem(STORAGE_KEYS.IDEAS, JSON.stringify(INITIAL_IDEAS));
      return INITIAL_IDEAS;
    }
    try {
      return JSON.parse(raw);
    } catch {
      return INITIAL_IDEAS;
    }
  },

  saveIdeas(ideas: IdeaCard[]): void {
    localStorage.setItem(STORAGE_KEYS.IDEAS, JSON.stringify(ideas));
  },

  createIdea(
    user: User,
    data: { title: string; description: string; categoryTag?: string }
  ): IdeaCard {
    const ideas = this.getIdeas();
    const nowTime = new Date().toISOString().replace('T', ' ').substring(0, 16);
    const newIdea: IdeaCard = {
      id: `idea_${Date.now()}`,
      title: data.title.trim(),
      description: data.description.trim(),
      authorId: user.id,
      authorName: user.name,
      authorAvatar: user.avatar,
      authorRole: user.role,
      authorType: user.employmentType,
      status: 'NEW_IDEA', // Default 1. Ide Baru
      categoryTag: data.categoryTag || 'Workflow & Inovasi',
      likesCount: 1,
      likedBy: [user.id],
      createdAt: nowTime,
      updatedAt: nowTime,
    };
    ideas.unshift(newIdea);
    this.saveIdeas(ideas);
    return newIdea;
  },

  updateIdeaStatus(ideaId: string, status: IdeaStatus, moderatorNotes?: string): void {
    const ideas = this.getIdeas();
    const updated = ideas.map((item) => {
      if (item.id === ideaId) {
        return {
          ...item,
          status,
          moderatorNotes: moderatorNotes !== undefined ? moderatorNotes : item.moderatorNotes,
          updatedAt: new Date().toISOString().replace('T', ' ').substring(0, 16),
        };
      }
      return item;
    });
    this.saveIdeas(updated);
  },

  toggleLikeIdea(ideaId: string, userId: string): void {
    const ideas = this.getIdeas();
    const updated = ideas.map((item) => {
      if (item.id === ideaId) {
        const hasLiked = item.likedBy.includes(userId);
        const nextLikedBy = hasLiked
          ? item.likedBy.filter((id) => id !== userId)
          : [...item.likedBy, userId];
        return {
          ...item,
          likedBy: nextLikedBy,
          likesCount: nextLikedBy.length,
        };
      }
      return item;
    });
    this.saveIdeas(updated);
  },

  deleteIdea(ideaId: string): void {
    const ideas = this.getIdeas();
    const updated = ideas.filter((item) => item.id !== ideaId);
    this.saveIdeas(updated);
  },

  // ==========================================
  // 8. OFFICE CONFIGURATION
  // ==========================================
  getOfficeConfig(): OfficeConfig {
    const raw = localStorage.getItem(STORAGE_KEYS.OFFICE_CONFIG);
    if (!raw) {
      localStorage.setItem(STORAGE_KEYS.OFFICE_CONFIG, JSON.stringify(INITIAL_OFFICE_CONFIG));
      return INITIAL_OFFICE_CONFIG;
    }
    try {
      const parsed = JSON.parse(raw);
      if (
        !parsed.name ||
        parsed.name === 'Kantor Pusat Sudirman Cyber Tower' ||
        parsed.latitude === -6.225588 ||
        parsed.latitude === -7.940654 ||
        parsed.address?.includes('Simpang Semanggi Barat')
      ) {
        const upgraded = { ...parsed, ...INITIAL_OFFICE_CONFIG };
        localStorage.setItem(STORAGE_KEYS.OFFICE_CONFIG, JSON.stringify(upgraded));
        return upgraded;
      }
      return parsed;
    } catch {
      return INITIAL_OFFICE_CONFIG;
    }
  },

  updateOfficeConfig(newCfg: OfficeConfig): void {
    localStorage.setItem(STORAGE_KEYS.OFFICE_CONFIG, JSON.stringify(newCfg));
  },

  // ==========================================
  // 9. RUANG OBROLAN (CHAT ROOM)
  // ==========================================
  getChatTopics(): ChatTopic[] {
    const raw = localStorage.getItem(STORAGE_KEYS.CHAT_TOPICS);
    if (!raw) {
      localStorage.setItem(STORAGE_KEYS.CHAT_TOPICS, JSON.stringify(INITIAL_CHAT_TOPICS));
      return INITIAL_CHAT_TOPICS;
    }
    try {
      const parsed: ChatTopic[] = JSON.parse(raw);
      let hasUpdate = false;
      const updated = parsed.map((t) => {
        let changed = false;
        if (t.createdByName === 'Annisa Ulkhairiyah') {
          t.createdByName = 'Sarah Amelia';
          changed = true;
        }
        if (t.comments) {
          t.comments = t.comments.map((c) => {
            if (c.userName === 'Bobby Romadhoni' || c.userId === 'usr_super_admin') {
              changed = true;
              return { ...c, userName: 'Hendra Pratama', notes: c.notes.replace('Fikar Alibaba', 'Sarah Amelia & @Nasywa Davina Alissa Wijaya') };
            }
            return c;
          });
        }
        if (changed) hasUpdate = true;
        return t;
      });
      if (hasUpdate) {
        localStorage.setItem(STORAGE_KEYS.CHAT_TOPICS, JSON.stringify(updated));
      }
      return updated;
    } catch {
      return INITIAL_CHAT_TOPICS;
    }
  },

  saveChatTopics(topics: ChatTopic[]): void {
    localStorage.setItem(STORAGE_KEYS.CHAT_TOPICS, JSON.stringify(topics));
  },

  addChatTopic(newTopicData: Omit<ChatTopic, 'id' | 'createdAt' | 'updatedAt' | 'comments'>): ChatTopic {
    const topics = this.getChatTopics();
    const now = new Date();
    const timeStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    const newTopic: ChatTopic = {
      ...newTopicData,
      id: `topic_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      createdAt: timeStr,
      updatedAt: timeStr,
      comments: [],
    };
    topics.unshift(newTopic);
    this.saveChatTopics(topics);
    return newTopic;
  },

  updateChatTopic(topic: ChatTopic): void {
    const topics = this.getChatTopics();
    const index = topics.findIndex((t) => t.id === topic.id);
    if (index !== -1) {
      const now = new Date();
      topic.updatedAt = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
      topics[index] = topic;
      this.saveChatTopics(topics);
    }
  },

  deleteChatTopic(topicId: string): void {
    const topics = this.getChatTopics();
    const filtered = topics.filter((t) => t.id !== topicId);
    this.saveChatTopics(filtered);
  },

  addTopicComment(topicId: string, commentData: Omit<ChatComment, 'id' | 'topicId' | 'timestamp'>): ChatComment {
    const topics = this.getChatTopics();
    const topic = topics.find((t) => t.id === topicId);
    if (!topic) throw new Error('Topic not found');

    const now = new Date();
    const timeStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    const newComment: ChatComment = {
      ...commentData,
      id: `comm_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      topicId,
      timestamp: timeStr,
    };

    topic.comments.push(newComment);
    topic.updatedAt = timeStr;
    this.saveChatTopics(topics);
    return newComment;
  },

  deleteTopicComment(topicId: string, commentId: string): void {
    const topics = this.getChatTopics();
    const topic = topics.find((t) => t.id === topicId);
    if (topic && topic.comments) {
      topic.comments = topic.comments.filter((c) => c.id !== commentId);
      this.saveChatTopics(topics);
    }
  },

  // Reset Data ke Factory Default
  resetToDefault(): void {
    localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(INITIAL_USERS));
    localStorage.setItem(STORAGE_KEYS.ATTENDANCE, JSON.stringify(INITIAL_ATTENDANCE));
    localStorage.setItem(STORAGE_KEYS.DAILY_TASKS, JSON.stringify(INITIAL_DAILY_TASKS));
    localStorage.setItem(STORAGE_KEYS.LEAVES, JSON.stringify(INITIAL_LEAVES));
    localStorage.setItem(STORAGE_KEYS.EMAILS, JSON.stringify(INITIAL_EMAIL_NOTIFICATIONS));
    localStorage.setItem(STORAGE_KEYS.MESSAGES, JSON.stringify(INITIAL_DISCUSSION_MESSAGES));
    localStorage.setItem(STORAGE_KEYS.IDEAS, JSON.stringify(INITIAL_IDEAS));
    localStorage.setItem(STORAGE_KEYS.OFFICE_CONFIG, JSON.stringify(INITIAL_OFFICE_CONFIG));
    localStorage.setItem(STORAGE_KEYS.CHAT_TOPICS, JSON.stringify(INITIAL_CHAT_TOPICS));
    localStorage.setItem(STORAGE_KEYS.CURRENT_USER_ID, 'usr_super_admin');
  },
};
