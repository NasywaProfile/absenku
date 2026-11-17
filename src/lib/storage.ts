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
  getPriorityLabel,
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
  INITIAL_TASKS,
} from './mock-data.ts';
import {
  findConflictingLeave,
  getApprovedLeaveForDate,
  countInclusiveDays,
  shiftDate,
  isDateInRange,
  LEAVE_CATEGORY_LABEL,
} from './attendance-status.ts';
import { storeAttachmentInIDB } from './attachment-storage.ts';
import { hashPassword, verifyPassword, isPasswordEncrypted } from './crypto-utils.ts';
import { ApiClient } from './api-client.ts';
import { sendRealEmail, generateEmailHtmlTemplate } from './real-email.ts';
import { formatIndonesianDateShort } from './time-utils.ts';
import { getUserMatchIdentifiers, hasOtherChatParticipants } from './chat-visibility.ts';

const PENDING_TASK_SYNC_KEY = 'absenku_pending_task_sync_v10';
const PENDING_LEAVE_SYNC_KEY = 'absenku_pending_leave_sync_v10';
const HIDDEN_CHAT_TOPICS_KEY = 'absenku_hidden_chat_topics_v10';

function readPendingSyncIds(storageKey: string): string[] {
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      const now = Date.now();
      return Object.entries(parsed)
        .filter(([, ts]) => typeof ts === 'number' && now - ts < 10 * 60 * 1000)
        .map(([id]) => String(id));
    }
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

function markPendingSyncId(storageKey: string, id: string): void {
  try {
    const raw = localStorage.getItem(storageKey);
    const parsed = raw ? JSON.parse(raw) : {};
    const map: Record<string, number> =
      parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
    map[String(id)] = Date.now();
    localStorage.setItem(storageKey, JSON.stringify(map));
  } catch {}
}

function clearPendingSyncId(storageKey: string, id: string): void {
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return;
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      delete parsed[String(id)];
      localStorage.setItem(storageKey, JSON.stringify(parsed));
    }
  } catch {}
}

function dispatchSafeWindowEvent(eventName: string, detail?: any): void {
  if (typeof window === 'undefined' || typeof window.dispatchEvent !== 'function' || typeof CustomEvent !== 'function') {
    return;
  }
  window.dispatchEvent(new CustomEvent(eventName, detail !== undefined ? { detail } : undefined));
}

const STORAGE_KEYS = {
  USERS: 'absenku_users_v10',
  CURRENT_USER_ID: 'absenku_current_user_id_v10',
  ATTENDANCE: 'absenku_attendance_v10',
  DAILY_TASKS: 'absenku_daily_tasks_v10',
  TASKS: 'absenku_kanban_tasks_v10',
  LEAVES: 'absenku_leaves_v10',
  EMAILS: 'absenku_emails_v10',
  MESSAGES: 'absenku_discussion_v10',
  IDEAS: 'absenku_ideas_v10',
  OFFICE_CONFIG: 'absenku_office_config_v10',
  CHAT_TOPICS: 'absenku_chat_topics_v10',
};

/**
 * Safe wrapper untuk localStorage.setItem yang mampu menangani QuotaExceededError
 * secara otomatis dengan memindahkan berkas base64 besar ke IndexedDB.
 */
function safeSetItem(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch (err: any) {
    console.warn(`[AppStorage] LocalStorage kuota terlampaui saat menulis ke "${key}". Memulai mitigasi pembebasan kuota...`, err);

    if (key === STORAGE_KEYS.LEAVES) {
      try {
        const parsed: LeaveRequest[] = JSON.parse(value);
        const sanitized = parsed.map((l) => {
          if (l.attachmentData && l.attachmentData.length > 500) {
            const attId = `leave_att_${l.id}`;
            storeAttachmentInIDB(attId, l.attachmentData).catch(() => {});
            return {
              ...l,
              attachmentData: `idb:${attId}`,
            };
          }
          return l;
        });
        localStorage.setItem(key, JSON.stringify(sanitized));
        console.info('[AppStorage] Berhasil memangkas dan menyimpan leaves ke localStorage via IndexedDB.');
        return;
      } catch (e1) {
        try {
          const parsed: LeaveRequest[] = JSON.parse(value);
          const stripped = parsed.map((l) => ({ ...l, attachmentData: undefined }));
          localStorage.setItem(key, JSON.stringify(stripped));
          console.info('[AppStorage] Berhasil menyimpan stripped leaves ke localStorage.');
          return;
        } catch (e2) {}
      }
    }

    if (key === STORAGE_KEYS.ATTENDANCE) {
      try {
        const parsed: AttendanceRecord[] = JSON.parse(value);
        const stripped = parsed.map((a) => {
          if (a.clockInPhoto && a.clockInPhoto.length > 1000) {
            return { ...a, clockInPhoto: undefined };
          }
          return a;
        });
        localStorage.setItem(key, JSON.stringify(stripped));
        return;
      } catch (e3) {}
    }

    if (key === STORAGE_KEYS.USERS) {
      try {
        const parsed: User[] = JSON.parse(value);
        const sanitized = parsed.map((u) => {
          if (u.avatar && u.avatar.length > 50000 && u.avatar.startsWith('data:image/')) {
            const attId = `user_avatar_${u.id}`;
            storeAttachmentInIDB(attId, u.avatar).catch(() => {});
            return { ...u, avatar: `idb:${attId}` };
          }
          return u;
        });
        localStorage.setItem(key, JSON.stringify(sanitized));
        return;
      } catch (eUsers) {}
    }

    // Bersihkan temporary data dan key versi lama jika masih penuh
    try {
      localStorage.removeItem('absenku_offline_queue');
      // Bersihkan cache lama versi < 10
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith('absenku_') && (k.includes('_v1') || k.includes('_v2') || k.includes('_v3') || k.includes('_v4') || k.includes('_v5') || k.includes('_v6') || k.includes('_v7') || k.includes('_v8') || k.includes('_v9')) && !k.includes('_v10') && !k.includes('_v11')) {
          localStorage.removeItem(k);
        }
      }
      localStorage.setItem(key, value);
    } catch (finalErr) {
      console.error(`[AppStorage] Gagal menyelamatkan key "${key}":`, finalErr);
    }
  }
}

// Auto-sanitasi pada saat inisialisasi: bersihkan data base64 raksasa di absenku_leaves_v9 yang ada di browser pengguna saat ini
try {
  const existingLeavesRaw = localStorage.getItem(STORAGE_KEYS.LEAVES);
  if (existingLeavesRaw && (existingLeavesRaw.includes('data:application/pdf') || existingLeavesRaw.includes('data:image/'))) {
    const parsedLeaves: LeaveRequest[] = JSON.parse(existingLeavesRaw);
    let hasBig = false;
    const cleaned = parsedLeaves.map((l) => {
      if (l.attachmentData && l.attachmentData.startsWith('data:') && l.attachmentData.length > 500) {
        hasBig = true;
        const attId = `leave_att_${l.id}`;
        storeAttachmentInIDB(attId, l.attachmentData).catch(() => {});
        return { ...l, attachmentData: `idb:${attId}` };
      }
      return l;
    });
    if (hasBig) {
      localStorage.setItem(STORAGE_KEYS.LEAVES, JSON.stringify(cleaned));
      console.info('[AppStorage] Berhasil memindahkan lampiran base64 lama ke IndexedDB dan melegakan kuota LocalStorage.');
    }
  }
} catch (sanitiseErr) {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.LEAVES);
    if (raw) {
      const parsed: LeaveRequest[] = JSON.parse(raw);
      const stripped = parsed.map((l) => ({ ...l, attachmentData: undefined }));
      localStorage.setItem(STORAGE_KEYS.LEAVES, JSON.stringify(stripped));
    }
  } catch (_) {}
}

// Bersihkan semua data dummy karyawan dan seluruh historinya (hanya sisakan Super Admin, WAJIB LOGIN DULU)
const PURGE_FLAG = 'absenku_clean_fresh_start_20261110_v7_require_login_first';
try {
  const isPurged = localStorage.getItem(PURGE_FLAG);
  if (!isPurged) {
    // Inisialisasi bersih: hanya Super Admin, seluruh histori dummy dibersihkan total
    localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(INITIAL_USERS));
    // WAJIB: Jangan set CURRENT_USER_ID agar siapa pun yang membuka web langsung ke halaman login!
    localStorage.removeItem(STORAGE_KEYS.CURRENT_USER_ID);
    localStorage.removeItem('absenku_current_user_id_v10');
    localStorage.setItem(STORAGE_KEYS.ATTENDANCE, JSON.stringify([]));
    localStorage.setItem(STORAGE_KEYS.DAILY_TASKS, JSON.stringify([]));
    localStorage.setItem(STORAGE_KEYS.TASKS, JSON.stringify([]));
    localStorage.setItem(STORAGE_KEYS.LEAVES, JSON.stringify([]));
    localStorage.setItem(STORAGE_KEYS.EMAILS, JSON.stringify([]));
    localStorage.setItem(STORAGE_KEYS.MESSAGES, JSON.stringify([]));
    localStorage.setItem(STORAGE_KEYS.IDEAS, JSON.stringify([]));
    localStorage.setItem(STORAGE_KEYS.CHAT_TOPICS, JSON.stringify([]));
    localStorage.removeItem('absenku_offline_queue');
    localStorage.removeItem('absenku_deleted_task_ids');
    localStorage.removeItem('absenku_auth_token');

    if (!localStorage.getItem(STORAGE_KEYS.OFFICE_CONFIG)) {
      localStorage.setItem(STORAGE_KEYS.OFFICE_CONFIG, JSON.stringify(INITIAL_OFFICE_CONFIG));
    }

    localStorage.setItem(PURGE_FLAG, 'true');
  }
} catch (_) {}

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
      let parsed: User[] = JSON.parse(raw);
      let changed = false;

      // Hapus duplikasi dummy superadmin@gmail.com jika ada
      parsed = parsed.filter(
        (u) => !(u.email === 'superadmin@gmail.com' && u.id !== 'usr_super_admin')
      );

      // Pastikan akun Super Admin tunggal selalu tersedia dengan default yang tepat
      const saIndex = parsed.findIndex(
        (u) => u.role === 'SUPER_ADMIN' || u.id === 'usr_super_admin'
      );

      if (saIndex === -1) {
        parsed.unshift(INITIAL_USERS[0]);
        changed = true;
      } else {
        const sa = parsed[saIndex];
        sa.role = 'SUPER_ADMIN';
        sa.status = 'ACTIVE';
        // Pastikan email superadmin terisi jika kosong
        if (!sa.email) {
          sa.email = INITIAL_USERS[0].email;
          changed = true;
        }
      }

      // Sinkronkan joinDate setiap akun dengan tanggal pembuatan akun (registeredAt / id timestamp)
      parsed = parsed.map((u) => {
        let creationDate = '';
        if (u.registeredAt && u.registeredAt.trim().length >= 10) {
          creationDate = u.registeredAt.trim().substring(0, 10);
        } else if (u.id && u.id.startsWith('usr_')) {
          const ts = parseInt(u.id.replace('usr_', ''), 10);
          if (!isNaN(ts) && ts > 1000000000000) {
            const d = new Date(ts);
            const y = d.getFullYear();
            const m = String(d.getMonth() + 1).padStart(2, '0');
            const day = String(d.getDate()).padStart(2, '0');
            creationDate = `${y}-${m}-${day}`;
          }
        }

        if (u.id !== 'usr_super_admin') {
          if (creationDate) {
            if (!u.joinDate || u.joinDate === '2024-01-01' || u.joinDate !== creationDate) {
              u.joinDate = creationDate;
              changed = true;
            }
            if (!u.registeredAt) {
              u.registeredAt = `${creationDate} 08:00`;
              changed = true;
            }
          }
        }
        return u;
      });

      // Hapus data dummy 'Rekan Tim' jika masih tersisa
      const beforeFilterCount = parsed.length;
      parsed = parsed.filter(
        (u) => !u.name || !u.name.toLowerCase().includes('rekan tim')
      );
      if (parsed.length !== beforeFilterCount) {
        changed = true;
      }

      // Deduplikasi ketat: jika suatu akun sudah ACTIVE, hapus duplikat atau status PENDING_APPROVAL untuk email yang sama
      const activeEmails = new Set<string>();
      for (const u of parsed) {
        if (u.status === 'ACTIVE' && u.email) {
          activeEmails.add(u.email.trim().toLowerCase());
        }
      }

      const deduped: User[] = [];
      const seenEmails = new Set<string>();
      const seenIds = new Set<string>();

      // Utamakan akun ACTIVE
      const sorted = [...parsed].sort((a, b) => {
        if (a.status === 'ACTIVE' && b.status !== 'ACTIVE') return -1;
        if (a.status !== 'ACTIVE' && b.status === 'ACTIVE') return 1;
        return 0;
      });

      for (const u of sorted) {
        const uId = u.id;
        const uEmail = u.email ? u.email.trim().toLowerCase() : '';

        // Jika u berstatus PENDING_APPROVAL tapi sudah ada akun ACTIVE dengan email yang sama, lewati
        if (u.status === 'PENDING_APPROVAL' && uEmail && activeEmails.has(uEmail)) {
          changed = true;
          continue;
        }

        if (uId && seenIds.has(uId)) {
          changed = true;
          continue;
        }
        if (uEmail && seenEmails.has(uEmail)) {
          changed = true;
          continue;
        }

        if (uId) seenIds.add(uId);
        if (uEmail) seenEmails.add(uEmail);
        deduped.push(u);
      }
      parsed = deduped;

      if (changed) {
        safeSetItem(STORAGE_KEYS.USERS, JSON.stringify(parsed));
      }
      return parsed;
    } catch {
      safeSetItem(STORAGE_KEYS.USERS, JSON.stringify(INITIAL_USERS));
      return INITIAL_USERS;
    }
  },

  saveUsers(users: User[], silent: boolean = false): void {
    safeSetItem(STORAGE_KEYS.USERS, JSON.stringify(users));
    if (!silent && typeof window !== 'undefined' && typeof window.dispatchEvent === 'function' && typeof CustomEvent === 'function') {
      window.dispatchEvent(new CustomEvent('absenku:users_updated'));
    }
  },

  getCurrentUserId(): string | null {
    return localStorage.getItem(STORAGE_KEYS.CURRENT_USER_ID);
  },

  setCurrentUserId(id: string): void {
    localStorage.setItem(STORAGE_KEYS.CURRENT_USER_ID, id);
  },

  getCurrentUser(): User | null {
    // Tanpa sesi aktif => tidak ada pengguna (WAJIB login). Tidak boleh ada fallback otomatis
    // ke Super Admin karena itu melewati halaman login.
    const currentId = this.getCurrentUserId();
    if (!currentId) return null;
    const found = this.getUsers().find((u) => u.id === currentId);
    if (!found) {
      localStorage.removeItem(STORAGE_KEYS.CURRENT_USER_ID);
      return null;
    }
    return found;
  },

  purgeAllExceptSuperAdmin(): void {
    const users = this.getUsers();
    let superAdmin = users.find((u) => u.role === 'SUPER_ADMIN');
    if (!superAdmin) {
      superAdmin = INITIAL_USERS.find((u) => u.role === 'SUPER_ADMIN') || INITIAL_USERS[0];
    }
    const superAdminOnly = [superAdmin];
    localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(superAdminOnly));
    localStorage.removeItem(STORAGE_KEYS.CURRENT_USER_ID);
    localStorage.removeItem('absenku_current_user_id_v10');
    localStorage.setItem(STORAGE_KEYS.ATTENDANCE, JSON.stringify([]));
    localStorage.setItem(STORAGE_KEYS.DAILY_TASKS, JSON.stringify([]));
    localStorage.setItem(STORAGE_KEYS.TASKS, JSON.stringify([]));
    localStorage.setItem(STORAGE_KEYS.LEAVES, JSON.stringify([]));
    localStorage.setItem(STORAGE_KEYS.EMAILS, JSON.stringify([]));
    localStorage.setItem(STORAGE_KEYS.MESSAGES, JSON.stringify([]));
    localStorage.setItem(STORAGE_KEYS.IDEAS, JSON.stringify([]));
    localStorage.setItem(STORAGE_KEYS.CHAT_TOPICS, JSON.stringify([]));
    localStorage.removeItem('absenku_offline_queue');
    localStorage.removeItem('absenku_deleted_task_ids');
    localStorage.removeItem('absenku_auth_token');
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

    const found = users.find(
      (u) =>
        u.email.toLowerCase() === cleanId ||
        u.id.toLowerCase() === cleanId
    );
    if (!found) return null;
    // Password WAJIB diisi dan harus cocok (tidak ada lagi bypass dengan password kosong)
    if (!password || !found.password || !verifyPassword(password, found.password)) {
      return null;
    }
    // Migrasi otomatis password plaintext lama menjadi hash
    if (!isPasswordEncrypted(found.password)) {
      found.password = hashPassword(password);
      this.updateUser(found);
    }
    return found;
  },

  /**
   * Reset password mandiri. Hanya untuk akun karyawan biasa dengan email DAN nama lengkap
   * yang sama persis. Akun ADMIN / SUPER_ADMIN tidak dapat direset lewat jalur ini.
   * (Catatan: reset aman sepenuhnya memerlukan verifikasi email dari backend.)
   */
  /**
   * Reset Password Mandiri: Berdasarkan email terdaftar (dan verifikasi nama lengkap jika diisi).
   * Mendukung reset password untuk seluruh akun terdaftar (Super Admin, Admin, dan Karyawan).
   */
  resetPasswordSelfService(
    email: string,
    fullName?: string,
    newPassword?: string
  ): { success: boolean; message?: string } {
    if (!newPassword || newPassword.length < 6) {
      return { success: false, message: 'Password baru minimal terdiri dari 6 karakter.' };
    }
    const cleanEmail = email.trim().toLowerCase();
    const cleanName = (fullName || '').trim().toLowerCase();
    const users = this.getUsers();
    const matched = users.find(
      (u) => u.email.toLowerCase() === cleanEmail
    );
    if (!matched) {
      return { success: false, message: 'Data yang dimasukkan tidak cocok dengan akun terdaftar.' };
    }
    // Jika nama lengkap diberikan, pastikan sesuai dengan data akun
    if (cleanName && cleanName.length > 0 && matched.name.trim().toLowerCase() !== cleanName) {
      return { success: false, message: 'Data yang dimasukkan tidak cocok dengan akun terdaftar.' };
    }
    matched.password = hashPassword(newPassword.trim());
    this.updateUser(matched);
    return { success: true };
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
      password: data.password,
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
    const att = this.getAttendanceRecords().filter((a: AttendanceRecord) => a.userId !== userId);
    this.saveAttendanceRecords(att);
    const leaves = this.getLeaves().filter((l: LeaveRequest) => l.userId !== userId);
    this.saveLeaves(leaves);
    const tasks = this.getDailyTasks().filter((t: DailyTaskLog) => t.userId !== userId);
    this.saveDailyTasks(tasks);

    // Kirim perintah DELETE ke backend Laravel & MySQL
    ApiClient.deleteUser(userId).catch((err) => {
      console.warn('Gagal menghapus user dari backend:', err);
    });

    // Bersihkan tugas Kanban: hapus tugas yang hanya ditugaskan ke karyawan ini,
    // dan lepaskan karyawan dari tugas yang dikerjakan bersama.
    const cleanedKanban: TaskItem[] = [];
    for (const t of this.getTasks()) {
      const assignees = t.assignees && t.assignees.length > 0 ? t.assignees : undefined;
      if (assignees) {
        const remaining = assignees.filter((a) => a.id !== userId);
        if (remaining.length === 0) continue;
        if (remaining.length !== assignees.length) {
          cleanedKanban.push({
            ...t,
            assignees: remaining,
            assignedTo: t.assignedTo === userId ? remaining[0].id : t.assignedTo,
            assignedName: t.assignedTo === userId ? remaining[0].name : t.assignedName,
            assignedAvatar: t.assignedTo === userId ? remaining[0].avatar || '' : t.assignedAvatar,
          });
          continue;
        }
      } else if (t.assignedTo === userId) {
        continue;
      }
      cleanedKanban.push(t);
    }
    this.saveTasks(cleanedKanban);
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

    if (!data.password || data.password.length < 6) {
      return { success: false, message: 'Password wajib diisi minimal 6 karakter.' };
    }

    if (users.some((u) => u.email.toLowerCase() === emailNormalized)) {
      return { success: false, message: 'Alamat email sudah terdaftar dalam sistem.' };
    }

    const now = new Date();
    const localYear = now.getFullYear();
    const localMonth = String(now.getMonth() + 1).padStart(2, '0');
    const localDay = String(now.getDate()).padStart(2, '0');
    const localDateStr = `${localYear}-${localMonth}-${localDay}`;
    const localHours = String(now.getHours()).padStart(2, '0');
    const localMinutes = String(now.getMinutes()).padStart(2, '0');
    const localTimeStr = `${localDateStr} ${localHours}:${localMinutes}`;

    const newUser: User = {
      id: `usr_${Date.now()}`,
      name: data.name.trim(),
      email: emailNormalized,
      password: hashPassword(data.password),
      role: 'EMPLOYEE',
      status: 'PENDING_APPROVAL', // Wajib persetujuan Admin/Super Admin
      employmentType: data.employmentType,
      department: data.department || 'Operasional',
      position: data.position || 'Staf',
      avatar: `https://images.unsplash.com/photo-${1500000000000 + Math.floor(Math.random() * 1000000)}?auto=format&fit=crop&w=256&q=80`,
      phone: data.phone || '',
      joinDate: localDateStr,
      leaveBalance: data.employmentType === 'PERMANENT' ? 12 : 6,
      bankName: data.bankName || 'BCA (Bank Central Asia)',
      bankAccountNumber: data.bankAccountNumber || '',
      bankAccountHolder: data.bankAccountHolder || data.name,
      emergencyContactName: data.emergencyContactName || '',
      emergencyContactPhone: data.emergencyContactPhone || '',
      registeredAt: localTimeStr,
      isProfileComplete: false,
    };

    users.push(newUser);
    this.saveUsers(users);

    // Sinkronisasi pendaftaran ke API backend MySQL
    ApiClient.register({
      name: newUser.name,
      email: newUser.email,
      password: data.password,
      department: newUser.department,
      position: newUser.position,
      employment_type: newUser.employmentType,
      phone: newUser.phone,
    }).catch(() => {});

    return { success: true, user: newUser };
  },

  // Persetujuan Registrasi Akun Baru (Admin / Super Admin)
  approveRegistration(userId: string, approverName: string, role?: UserRole): void {
    if (userId === 'usr_pending_approval_1') {
      localStorage.setItem('absenku_pending_sample_dismissed', 'true');
    }
    const users = this.getUsers();
    let approvedUser: User | null = null;

    const updated = users.map((u) => {
      if (u.id === userId) {
        if (u.status === 'ACTIVE') {
          return u;
        }
        const joinDate = u.joinDate || u.registeredAt?.substring(0, 10) || new Date().toISOString().substring(0, 10);
        const resolvedRole = role || u.role || 'EMPLOYEE';
        approvedUser = {
          ...u,
          joinDate,
          status: 'ACTIVE' as const,
          role: resolvedRole,
          approvedBy: approverName,
          approvedAt: new Date().toISOString().replace('T', ' ').substring(0, 16),
        };
        return approvedUser;
      }
      return u;
    });

    if (!approvedUser) {
      return;
    }

    this.saveUsers(updated);
    ApiClient.approveUser(userId, (approvedUser as User).role).catch(() => {});

    // Kirim notifikasi email ke pendaftar yang akunnya baru disetujui / diverifikasi
    try {
      const targetUser = approvedUser as User;
      if (targetUser && targetUser.email) {
        const approvalTime = targetUser.approvedAt || new Date().toISOString().replace('T', ' ').substring(0, 16);
        const roleText =
          targetUser.role === 'SUPER_ADMIN'
            ? 'Superadmin'
            : targetUser.role === 'ADMIN'
            ? 'Admin'
            : 'Karyawan';

        const emailNotification: EmailNotification = {
          id: `email_acc_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
          toEmail: targetUser.email,
          toName: targetUser.name,
          fromName: approverName || 'Administrator in-Time',
          fromEmail: 'admin@intime.id',
          subject: `Akun Terverifikasi: Selamat Datang di in-Time, ${targetUser.name}!`,
          employeeName: targetUser.name,
          employmentType: targetUser.employmentType,
          category: 'ACCOUNT_VERIFIED',
          notificationType: 'ACCOUNT',
          dateRange: approvalTime,
          reason: `Pendaftaran akun Anda telah diverifikasi dan disetujui dengan hak akses ${roleText}.`,
          notes: 'Kabar baik! Pendaftaran akun Anda di sistem in-Time telah resmi disetujui dan diverifikasi. Akun Anda saat ini sudah aktif dan dapat langsung digunakan untuk presensi dan manajemen tugas.',
          directApprovalLink: '/login',
          sentAt: approvalTime,
          read: false,
          recipientRole: targetUser.role,
        };

        this.addEmailNotification(emailNotification);
      }
    } catch (err) {
      console.warn('Gagal memicu email verifikasi akun:', err);
    }
  },

  // Penolakan / Penghapusan Registrasi Akun Baru
  rejectRegistration(userId: string): void {
    if (userId === 'usr_pending_approval_1') {
      localStorage.setItem('absenku_pending_sample_dismissed', 'true');
    }
    const users = this.getUsers();
    const updated = users.filter((u) => u.id !== userId);
    this.saveUsers(updated);
    ApiClient.rejectUser(userId).catch(() => {});
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
    ApiClient.updateUserRole(userId, newRole).catch(() => {});
  },

  // Promosi Tipe Karyawan: Magang -> Freelance -> Kontrak -> Tetap
  updateEmploymentType(userId: string, newType: EmploymentType): void {
    const users = this.getUsers();
    let targetUser: User | undefined;
    const updated = users.map((u) => {
      if (u.id === userId) {
        targetUser = {
          ...u,
          employmentType: newType,
          leaveBalance: newType === 'PERMANENT' ? Math.max(u.leaveBalance, 12) : u.leaveBalance,
        };
        return targetUser;
      }
      return u;
    });
    this.saveUsers(updated);
    ApiClient.updateEmploymentType(userId, newType, targetUser?.email).catch(() => {});
    if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
      window.dispatchEvent(new CustomEvent('absenku:users_updated'));
    }
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
      const isTarget =
        u.id === userId ||
        (updates.email && u.email && u.email.toLowerCase() === updates.email.toLowerCase()) ||
        (userId === 'usr_super_admin' && (u.role === 'SUPER_ADMIN' || u.id === 'usr_super_admin'));

      if (isTarget) {
        const finalUpdates = { ...updates };
        if (finalUpdates.password && !isPasswordEncrypted(finalUpdates.password)) {
          finalUpdates.password = hashPassword(finalUpdates.password);
        }
        updatedUser = { ...u, ...finalUpdates };
        return updatedUser;
      }
      return u;
    });

    if (updatedUser) {
      this.saveUsers(nextUsers);
      ApiClient.updateProfile(updates).catch(() => {});
    } else {
      const finalUpdates = { ...updates };
      if (finalUpdates.password && !isPasswordEncrypted(finalUpdates.password)) {
        finalUpdates.password = hashPassword(finalUpdates.password);
      }
      updatedUser = {
        id: userId,
        name: updates.name || 'User',
        email: updates.email || '',
        role: 'EMPLOYEE',
        status: 'ACTIVE',
        employmentType: 'CONTRACT',
        department: 'Operasional',
        position: 'Staf',
        avatar: '',
        phone: '',
        joinDate: '',
        leaveBalance: 12,
        isProfileComplete: true,
        ...finalUpdates,
      } as User;
      this.saveUsers([...users, updatedUser]);
      ApiClient.updateProfile(updates).catch(() => {});
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
      // Exclude Super Admin records
      const activeRecords = records.filter(
        (r) => r.userId !== 'usr_super_admin' && r.userName?.toLowerCase() !== 'super admin'
      );
      if (activeRecords.length !== records.length) {
        changed = true;
      }
      // Merge record dari INITIAL_ATTENDANCE jika belum ada
      INITIAL_ATTENDANCE.forEach((initRecord) => {
        if (!activeRecords.some((r) => r.id === initRecord.id) && initRecord.userId !== 'usr_super_admin') {
          activeRecords.push(initRecord);
          changed = true;
        }
      });
      if (changed) {
        localStorage.setItem(STORAGE_KEYS.ATTENDANCE, JSON.stringify(activeRecords));
      }
      return activeRecords;
    } catch {
      return INITIAL_ATTENDANCE;
    }
  },

  saveAttendanceRecords(records: AttendanceRecord[], silent: boolean = false): void {
    const filtered = records.filter(
      (r) => r.userId !== 'usr_super_admin' && (r.userName || '').toLowerCase() !== 'super admin'
    );
    safeSetItem(STORAGE_KEYS.ATTENDANCE, JSON.stringify(filtered));
    if (!silent && typeof window !== 'undefined' && typeof window.dispatchEvent === 'function' && typeof CustomEvent === 'function') {
      window.dispatchEvent(new CustomEvent('absenku:attendance_updated'));
    }
  },

  syncAttendanceToServer(newRecord: AttendanceRecord): void {
    // Kirim presensi ke Laravel Backend & MySQL lalu sinkronkan nilai otoritatif dari server
    ApiClient.clockIn({
      id: newRecord.id,
      user_id: newRecord.userId,
      pengguna_id: newRecord.userId,
      date: newRecord.date,
      clock_in_time: newRecord.clockInTime,
      clock_in_lat: newRecord.clockInLat,
      clock_in_lng: newRecord.clockInLng,
      clock_in_distance_meter: newRecord.clockInDistanceMeter,
      clock_in_location_status: newRecord.clockInLocationStatus,
      clock_in_status: newRecord.clockInStatus,
      clock_in_late_minutes: newRecord.clockInLateMinutes,
      work_mode: newRecord.workMode,
      notes: newRecord.notes,
    })
      .then((res: any) => {
        const srv = res?.record;
        if (!srv) return;
        const currentRecords = this.getAttendanceRecords();
        const synced = currentRecords.map((r) => {
          if (r.userId === newRecord.userId && r.date === newRecord.date) {
            return {
              ...r,
              id: srv.id || r.id,
              clockInTime: srv.jam_masuk || srv.clock_in_time || r.clockInTime,
              clockInDistanceMeter: srv.jarak_meter ?? srv.clock_in_distance_meter ?? r.clockInDistanceMeter,
              clockInLocationStatus: (srv.status_lokasi || srv.clock_in_location_status || r.clockInLocationStatus) as any,
              clockInStatus: (srv.status_kehadiran || srv.clock_in_status || r.clockInStatus) as any,
              clockInLateMinutes: srv.menit_keterlambatan ?? srv.clock_in_late_minutes ?? r.clockInLateMinutes,
              workMode: (srv.mode_kerja || srv.work_mode || r.workMode) as any,
              syncStatus: 'SYNCED' as const,
            };
          }
          return r;
        });
        this.saveAttendanceRecords(synced);
        if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
          window.dispatchEvent(new CustomEvent('absenku:attendance_updated'));
        }
      })
      .catch((err: any) => {
        // Jika server menolak presensi (403/409/422), batalkan record lokal palsu & pakai record otoritatif server jika ada
        if (err && [403, 409, 422].includes(err.status)) {
          const currentRecords = this.getAttendanceRecords();
          const srv = err.data?.record;
          let reconciled: AttendanceRecord[];
          if (err.status === 409 && srv) {
            reconciled = currentRecords.map((r) =>
              r.userId === newRecord.userId && r.date === newRecord.date
                ? {
                    ...r,
                    id: srv.id || r.id,
                    clockInTime: srv.jam_masuk || srv.clock_in_time || r.clockInTime,
                    clockInDistanceMeter: srv.jarak_meter ?? srv.clock_in_distance_meter ?? r.clockInDistanceMeter,
                    clockInLocationStatus: (srv.status_lokasi || srv.clock_in_location_status || r.clockInLocationStatus) as any,
                    clockInStatus: (srv.status_kehadiran || srv.clock_in_status || r.clockInStatus) as any,
                    clockInLateMinutes: srv.menit_keterlambatan ?? srv.clock_in_late_minutes ?? r.clockInLateMinutes,
                    workMode: (srv.mode_kerja || srv.work_mode || r.workMode) as any,
                    syncStatus: 'SYNCED' as const,
                  }
                : r
            );
          } else {
            reconciled = currentRecords.filter(
              (r) => !(r.userId === newRecord.userId && r.date === newRecord.date && r.id === newRecord.id)
            );
          }
          this.saveAttendanceRecords(reconciled);
          if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function' && typeof CustomEvent === 'function') {
            window.dispatchEvent(
              new CustomEvent('absenku:attendance_error', {
                detail: { message: err.message || 'Presensi ditolak oleh server.' },
              })
            );
          }
        }
      });
  },

  recordClockIn(newRecord: AttendanceRecord): void {
    if (newRecord.userId === 'usr_super_admin' || newRecord.userName?.toLowerCase() === 'super admin') {
      return;
    }
    const records = this.getAttendanceRecords();
    // Cegah duplikasi di hari yang sama untuk user yang sama
    const filtered = records.filter(
      (r) => !(r.userId === newRecord.userId && r.date === newRecord.date)
    );
    filtered.unshift(newRecord);
    this.saveAttendanceRecords(filtered);
    this.syncAttendanceToServer(newRecord);
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
    this.syncAttendanceToServer(newRecord);
  },

  clearTodayAttendance(): void {
    const today = new Date().toISOString().substring(0, 10);
    const curUserId = this.getCurrentUserId();
    const records = this.getAttendanceRecords().filter(
      (r) => !(r.userId === curUserId && r.date === today)
    );
    this.saveAttendanceRecords(records);
    if (curUserId) {
      ApiClient.deleteAttendance({ date: today, user_id: curUserId }).catch(() => {});
    }
    if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
      window.dispatchEvent(new CustomEvent('absenku:attendance_updated'));
    }
  },

  deleteAttendanceByDate(date: string, userId?: string): void {
    const curUserId = userId || this.getCurrentUserId();
    const records = this.getAttendanceRecords().filter(
      (r) => !(r.date === date && (!curUserId || r.userId === curUserId))
    );
    this.saveAttendanceRecords(records);
    if (curUserId) {
      ApiClient.deleteAttendance({ date, user_id: curUserId }).catch(() => {});
    }
    if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
      window.dispatchEvent(new CustomEvent('absenku:attendance_updated'));
    }

    // Bersihkan juga dari antrean offline jika ada
    try {
      const queueRaw = localStorage.getItem('absenku_offline_queue');
      if (queueRaw) {
        const queue = JSON.parse(queueRaw);
        const filteredQueue = queue.filter(
          (item: any) => !(item.type === 'ATTENDANCE' && item.data?.date === date && (!curUserId || item.data?.userId === curUserId))
        );
        localStorage.setItem('absenku_offline_queue', JSON.stringify(filteredQueue));
      }
    } catch (e) {}
  },

  clearAllAttendance(): void {
    this.saveAttendanceRecords([]);
  },

  clearPastTestHistory(): void {
    const today = new Date().toISOString().substring(0, 10);

    // 1. Bersihkan riwayat presensi lampau (sebelum hari ini)
    const records = this.getAttendanceRecords();
    const todayRecords = records.filter((r) => r.date >= today);
    this.saveAttendanceRecords(todayRecords);

    // 2. Bersihkan riwayat pengajuan izin/WFH lampau (sebelum hari ini)
    const leaves = this.getLeaves();
    const todayLeaves = leaves.filter((l) => l.endDate >= today);
    this.saveLeaves(todayLeaves);
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

    // Kirim logbook harian ke API backend MySQL
    ApiClient.saveDailyLog({
      date,
      tasks,
      notes,
    }).catch(() => {});

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
      const defaultTasks: TaskItem[] = INITIAL_TASKS;
      localStorage.setItem(STORAGE_KEYS.TASKS, JSON.stringify(defaultTasks));
      return defaultTasks;
    }
    try {
      const parsed: TaskItem[] = JSON.parse(raw);
      const deletedIds = new Set(this.getDeletedTaskIds());
      const activeTasks = parsed.filter((t) => !deletedIds.has(String(t.id)));
      const allUsers = this.getUsers();
      // Pastikan nama dan avatar assignee selalu sinkron dengan data profil user
      return activeTasks.map((t) => {
        const matched = allUsers.find((u) => u.id === t.assignedTo);
        const filteredActivities = (t.activities || [])
          .filter((act) => {
            if (act.type === 'STARTED' || /mulai mengerjakan tugas ini/i.test(act.notes || '')) {
              return false;
            }
            if (
              !act.attachments?.length &&
              (act.notes === 'Hasil preview tugas dilampirkan untuk ditinjau oleh PIC.' ||
                act.notes === 'Tugas dikembalikan ke proses pengerjaan untuk direvisi.' ||
                act.notes === 'Penugasan Selesai (ACC oleh PIC)' ||
                act.notes === 'Mohon disempurnakan kembali sesuai catatan arahan dari PIC.' ||
                act.notes === 'Catatan arahan dari PIC.' ||
                /Tugas dikirimkan oleh .* untuk ditinjau oleh PIC\./i.test(act.notes || '') ||
                /Tugas telah ditinjau dan disetujui \(ACC\) oleh PIC .* Penugasan Selesai\./i.test(act.notes || ''))
            ) {
              return false;
            }
            return true;
          })
          .map((act) => {
            let cleanNotes = act.notes || '';
            const subMatch = cleanNotes.match(/^Hasil pengerjaan dikirimkan oleh [^:]+:\s*"?(.*?)"?$/s);
            if (subMatch) cleanNotes = subMatch[1];
            const revMatch = cleanNotes.match(/^Instruksi Revisi dari PIC \([^)]+\):\s*"?(.*?)"?$/s);
            if (revMatch) cleanNotes = revMatch[1];
            const appMatch = cleanNotes.match(/^Disetujui oleh PIC \([^)]+\):\s*"?(.*?)"?$/s);
            if (appMatch) cleanNotes = appMatch[1];
            return {
              ...act,
              notes: cleanNotes,
            };
          });

        // Pastikan task.attachments hanya berisi lampiran awal dari PIC saat penugasan dibuat
        const initialTaskAttachments = (t.attachments || []).filter(
          (a) => a.stage === 'TODO' || !a.stage || a.uploadedBy === t.createdBy
        );

        return {
          ...t,
          attachments: initialTaskAttachments,
          activities: filteredActivities,
          ...(matched
            ? {
                assignedName: matched.name,
                assignedAvatar: matched.avatar,
              }
            : {}),
        };
      }).sort((a, b) => {
        const timeA = a.createdAt || '';
        const timeB = b.createdAt || '';
        if (timeA !== timeB) return timeB.localeCompare(timeA);
        return (b.id || '').localeCompare(a.id || '');
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
    this.markTaskPendingSync(newTask.id);
    tasks.unshift(newTask);
    this.saveTasks(tasks);
    dispatchSafeWindowEvent('absenku:tasks_updated');

    // Kirim tugas baru ke API backend MySQL
    ApiClient.createKanbanTask({
      id: newTask.id,
      title: newTask.title,
      description: newTask.description,
      status: newTask.status,
      priority: newTask.priority,
      assigned_to: newTask.assignedTo,
      assigned_name: newTask.assignedName,
      assigned_avatar: newTask.assignedAvatar,
      assignees: newTask.assignees,
      due_date: newTask.dueDate,
      attachments: newTask.attachments || [],
      lampiran: newTask.attachments || [],
      created_by: newTask.createdBy,
    })
      .then(() => {
        this.clearTaskPendingSync(newTask.id);
      })
      .catch((err: any) => {
        const status = Number(err?.status || 0);
        if (status >= 400) {
          this.clearTaskPendingSync(newTask.id);
          const remaining = this.getTasks().filter((t) => String(t.id) !== String(newTask.id));
          this.saveTasks(remaining);
          dispatchSafeWindowEvent('absenku:tasks_updated');
          dispatchSafeWindowEvent('absenku:task_sync_error', {
            taskId: newTask.id,
            title: newTask.title,
            message: err?.message || 'Gagal menyimpan penugasan ke server.',
          });
        }
      });

    // Otomatis kirim notifikasi email penugasan ke karyawan & admin/PIC
    try {
      const curUser = this.getCurrentUser();
      this.sendTaskEmailNotifications({
        type: 'ASSIGNED',
        task: newTask,
        actor: {
          id: curUser?.id || newTask.createdBy || 'usr_super_admin',
          name: curUser?.name || 'Super Admin',
          email: curUser?.email || this.getUsers().find((u) => u.role === 'SUPER_ADMIN')?.email || 'admin@perusahaan.local',
          role: curUser?.role || 'SUPER_ADMIN',
        },
        notes: newTask.description,
        attachments: newTask.attachments,
      });
    } catch (err) {
      console.warn('Gagal memicu pengiriman notifikasi email penugasan:', err);
    }

    return newTask;
  },

  updateTask(taskId: string, updates: Partial<TaskItem>): TaskItem | null {
    const tasks = this.getTasks();
    let updatedTask: TaskItem | null = null;
    const oldTask = tasks.find((t) => t.id === taskId);

    const updated = tasks.map((t) => {
      if (t.id === taskId) {
        updatedTask = {
          ...t,
          ...updates,
          updatedAt: new Date().toISOString().substring(0, 10),
        };
        return updatedTask;
      }
      return t;
    });

    if (updatedTask) {
      this.markTaskPendingSync(taskId);
      this.saveTasks(updated);
      ApiClient.updateKanbanTask(taskId, {
        ...updates,
        attachments: (updatedTask as TaskItem).attachments || [],
        lampiran: (updatedTask as TaskItem).attachments || [],
      })
        .then(() => {
          this.clearTaskPendingSync(taskId);
        })
        .catch((err: any) => {
          const status = Number(err?.status || 0);
          if (status >= 400) {
            this.clearTaskPendingSync(taskId);
            dispatchSafeWindowEvent('absenku:task_sync_error', {
              taskId,
              message: err?.message || 'Gagal memperbarui tugas ke server.',
            });
          }
        });

      // Jika ada perubahan penugasan (assignee), kirim email penugasan baru
      if (oldTask && updates.assignedTo && updates.assignedTo !== oldTask.assignedTo) {
        try {
          const curUser = this.getCurrentUser();
          this.sendTaskEmailNotifications({
            type: 'ASSIGNED',
            task: updatedTask,
            actor: {
              id: curUser?.id || (updatedTask as TaskItem).createdBy || 'usr_super_admin',
              name: curUser?.name || 'Super Admin',
              email: curUser?.email || this.getUsers().find((u) => u.role === 'SUPER_ADMIN')?.email || 'admin@perusahaan.local',
              role: curUser?.role || 'SUPER_ADMIN',
            },
            notes: (updatedTask as TaskItem).description,
          });
        } catch (err) {
          console.warn('Gagal memicu email perubahan penugasan:', err);
        }
      }
    }

    return updatedTask;
  },

  // Trigger Pengiriman Notifikasi Email Otomatis untuk Setiap Proses Penugasan
  sendTaskEmailNotifications(params: {
    type: 'ASSIGNED' | 'IN_PROGRESS' | 'SUBMITTED' | 'REVISION' | 'APPROVED';
    task: TaskItem;
    actor: { id: string; name: string; email?: string; role?: string };
    notes?: string;
    attachments?: TaskAttachment[];
  }): void {
    const { type, task, actor, notes, attachments } = params;
    const users = this.getUsers();
    const nowStr = new Date().toISOString().replace('T', ' ').substring(0, 19);

    // Dapatkan data PIC / Pembuat Tugas
    const picUser =
      users.find((u) => u.id === task.createdBy) ||
      users.find((u) => u.role === 'SUPER_ADMIN') ||
      users.find((u) => u.role === 'ADMIN') || {
        id: 'usr_super_admin',
        name: 'Super Admin',
        email: 'admin@perusahaan.local',
        role: 'SUPER_ADMIN' as const,
      };

    // Kumpulkan seluruh data karyawan yang ditugaskan
    const assigneeIds = new Set<string>();
    if (task.assignedTo) assigneeIds.add(task.assignedTo);
    if (Array.isArray(task.assignees)) {
      task.assignees.forEach((a) => a.id && assigneeIds.add(a.id));
    }

    let assignedUsers = users.filter((u) => assigneeIds.has(u.id));
    if (assignedUsers.length === 0) {
      // Cari kecocokan berdasarkan nama jika ID tidak cocok
      assignedUsers = users.filter(
        (u) =>
          (u.name && task.assignedName && u.name.toLowerCase() === task.assignedName.toLowerCase()) ||
          task.assignees?.some((a) => a.name && u.name.toLowerCase() === a.name.toLowerCase())
      );
    }

    if (assignedUsers.length === 0) {
      // Ambil user karyawan nyata pertama yang ada di sistem
      const realEmployee = users.find((u) => u.role === 'EMPLOYEE');
      if (realEmployee) {
        assignedUsers = [realEmployee];
      } else {
        assignedUsers = [
          {
            id: task.assignedTo || 'usr_emp_01',
            name: task.assignedName || 'Karyawan Pelaksana',
            email: 'karyawan@perusahaan.local',
            role: 'EMPLOYEE' as const,
            status: 'ACTIVE' as const,
            employmentType: 'PERMANENT' as const,
            department: 'Operasional',
            position: 'Staf',
            avatar: task.assignedAvatar || '',
            phone: '',
            joinDate: '',
            leaveBalance: 12,
          },
        ];
      }
    }

    const priorityLabel = getPriorityLabel(task.priority);
    const attachmentNames =
      attachments && attachments.length > 0
        ? attachments.map((a) => a.name).join(', ')
        : task.attachments && task.attachments.length > 0
        ? task.attachments.map((a) => a.name).join(', ')
        : undefined;

    switch (type) {
      case 'ASSIGNED': {
        // 1. Notifikasi ke SEMUA Karyawan yang Ditugaskan
        assignedUsers.forEach((employee) => {
          this.addEmailNotification({
            id: `email_task_assign_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
            toEmail: employee.email,
            toName: employee.name,
            fromName: `${actor.name} (${actor.role === 'SUPER_ADMIN' ? 'Super Admin' : actor.role === 'ADMIN' ? 'Admin' : 'PIC'})`,
            fromEmail: actor.email || picUser.email,
            subject: `Penugasan Baru: ${task.title}`,
            category: 'TASK_ASSIGNED',
            notificationType: 'TASK',
            employeeName: employee.name,
            employmentType: employee.employmentType,
            dateRange: task.dueDate ? `Batas Waktu: ${task.dueDate}` : undefined,
            reason: task.description,
            attachmentName: attachmentNames,
            directApprovalLink: '#tasks_my',
            sentAt: nowStr,
            read: false,
            taskId: task.id,
            taskTitle: task.title,
            taskPriority: priorityLabel,
            dueDate: task.dueDate,
            picName: picUser.name,
            picEmail: picUser.email,
            notes: task.description,
            recipientRole: 'EMPLOYEE',
          });
        });

        // 2. Notifikasi Konfirmasi / Arsip ke Admin / Super Admin / PIC yang Memberikan Tugas
        this.addEmailNotification({
          id: `email_task_pic_confirm_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          toEmail: picUser.email,
          toName: picUser.name,
          fromName: 'Sistem in-Time Notifier',
          fromEmail: 'system@in-time.id',
          subject: `Konfirmasi Penugasan: ${task.title}`,
          category: 'TASK_ASSIGNED',
          notificationType: 'TASK',
          employeeName: assignedUsers.map((e) => e.name).join(', '),
          employmentType: assignedUsers[0]?.employmentType,
          dateRange: task.dueDate ? `Batas Waktu: ${task.dueDate}` : undefined,
          reason: task.description,
          attachmentName: attachmentNames,
          directApprovalLink: '#tasks_team',
          sentAt: nowStr,
          read: false,
          taskId: task.id,
          taskTitle: task.title,
          taskPriority: priorityLabel,
          dueDate: task.dueDate,
          picName: picUser.name,
          picEmail: picUser.email,
          notes: task.description,
          recipientRole: picUser.role as any,
        });
        break;
      }

      case 'IN_PROGRESS': {
        // 1. Notifikasi ke Pelaksana (Karyawan)
        assignedUsers.forEach((employee) => {
          this.addEmailNotification({
            id: `email_task_start_emp_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
            toEmail: employee.email,
            toName: employee.name,
            fromName: `${picUser.name} (PIC)`,
            fromEmail: picUser.email,
            subject: `Pemberitahuan Pengerjaan: ${task.title} - Dalam Proses`,
            category: 'TASK_IN_PROGRESS',
            notificationType: 'TASK',
            employeeName: employee.name,
            employmentType: employee.employmentType,
            dateRange: task.dueDate ? `Batas Waktu: ${task.dueDate}` : undefined,
            reason: `Tugas "${task.title}" telah dipindahkan ke status pengerjaan aktif (In Progress).`,
            directApprovalLink: '#tasks_my',
            sentAt: nowStr,
            read: false,
            taskId: task.id,
            taskTitle: task.title,
            taskPriority: priorityLabel,
            dueDate: task.dueDate,
            picName: picUser.name,
            picEmail: picUser.email,
            notes: task.description,
            recipientRole: 'EMPLOYEE',
          });
        });

        // 2. Notifikasi ke PIC saat pengerjaan tugas dimulai oleh karyawan
        this.addEmailNotification({
          id: `email_task_start_pic_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          toEmail: picUser.email,
          toName: picUser.name,
          fromName: `${actor.name} (Karyawan)`,
          fromEmail: actor.email,
          subject: `Pengerjaan Dimulai: ${actor.name} - ${task.title}`,
          category: 'TASK_IN_PROGRESS',
          notificationType: 'TASK',
          employeeName: actor.name,
          dateRange: task.dueDate ? `Batas Waktu: ${task.dueDate}` : undefined,
          reason: `Karyawan telah memulai proses pengerjaan aktif untuk tugas "${task.title}".`,
          directApprovalLink: '#tasks_team',
          sentAt: nowStr,
          read: false,
          taskId: task.id,
          taskTitle: task.title,
          taskPriority: priorityLabel,
          dueDate: task.dueDate,
          picName: picUser.name,
          recipientRole: picUser.role as any,
        });
        break;
      }

      case 'SUBMITTED': {
        // 1. Notifikasi ke Admin / PIC bahwa tugas telah dikumpulkan untuk direview
        this.addEmailNotification({
          id: `email_task_submit_pic_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          toEmail: picUser.email,
          toName: picUser.name,
          fromName: `${actor.name} (Karyawan)`,
          fromEmail: actor.email,
          subject: `Pengumpulan Tugas: ${actor.name} - ${task.title}`,
          category: 'TASK_SUBMITTED',
          notificationType: 'TASK',
          employeeName: actor.name,
          dateRange: task.dueDate ? `Batas Waktu: ${task.dueDate}` : undefined,
          reason: notes || 'Hasil pengerjaan tugas telah dikirimkan dan menunggu peninjauan/ACC dari PIC.',
          attachmentName: attachmentNames,
          directApprovalLink: '#tasks_team',
          sentAt: nowStr,
          read: false,
          taskId: task.id,
          taskTitle: task.title,
          taskPriority: priorityLabel,
          dueDate: task.dueDate,
          picName: picUser.name,
          notes: notes,
          recipientRole: picUser.role as any,
        });

        // 2. Notifikasi Konfirmasi Pengumpulan ke Karyawan
        this.addEmailNotification({
          id: `email_task_submit_emp_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          toEmail: actor.email || assignedUsers[0]?.email || 'karyawan@in-time.id',
          toName: actor.name,
          fromName: 'Sistem in-Time Notifier',
          fromEmail: 'system@in-time.id',
          subject: `Konfirmasi Pengumpulan Tugas: ${task.title}`,
          category: 'TASK_SUBMITTED',
          notificationType: 'TASK',
          employeeName: actor.name,
          dateRange: task.dueDate ? `Batas Waktu: ${task.dueDate}` : undefined,
          reason: notes || 'Hasil pengerjaan tugas telah berhasil diteruskan ke PIC untuk ditinjau.',
          attachmentName: attachmentNames,
          directApprovalLink: '#tasks_my',
          sentAt: nowStr,
          read: false,
          taskId: task.id,
          taskTitle: task.title,
          taskPriority: priorityLabel,
          dueDate: task.dueDate,
          picName: picUser.name,
          notes: notes,
          recipientRole: 'EMPLOYEE',
        });
        break;
      }

      case 'REVISION': {
        // 1. Notifikasi Catatan Revisi ke Karyawan yang Ditugaskan
        assignedUsers.forEach((employee) => {
          this.addEmailNotification({
            id: `email_task_rev_emp_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
            toEmail: employee.email,
            toName: employee.name,
            fromName: `${actor.name} (${actor.role === 'SUPER_ADMIN' ? 'Super Admin' : actor.role === 'ADMIN' ? 'Admin' : 'PIC'})`,
            fromEmail: actor.email || picUser.email,
            subject: `Permintaan Revisi Tugas: ${task.title}`,
            category: 'TASK_REVISION',
            notificationType: 'TASK',
            employeeName: employee.name,
            employmentType: employee.employmentType,
            dateRange: task.dueDate ? `Batas Waktu: ${task.dueDate}` : undefined,
            reason: notes || 'Terdapat perbaikan yang perlu disesuaikan pada tugas ini.',
            attachmentName: attachmentNames,
            directApprovalLink: '#tasks_my',
            sentAt: nowStr,
            read: false,
            taskId: task.id,
            taskTitle: task.title,
            taskPriority: priorityLabel,
            dueDate: task.dueDate,
            picName: picUser.name,
            notes: notes,
            recipientRole: 'EMPLOYEE',
          });
        });

        // 2. Notifikasi Konfirmasi ke PIC
        this.addEmailNotification({
          id: `email_task_rev_pic_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          toEmail: picUser.email,
          toName: picUser.name,
          fromName: 'Sistem in-Time Notifier',
          fromEmail: 'system@in-time.id',
          subject: `Konfirmasi Instruksi Revisi: ${task.title}`,
          category: 'TASK_REVISION',
          notificationType: 'TASK',
          employeeName: assignedUsers.map((e) => e.name).join(', '),
          dateRange: task.dueDate ? `Batas Waktu: ${task.dueDate}` : undefined,
          reason: notes || 'Instruksi revisi telah tercatat.',
          directApprovalLink: '#tasks_team',
          sentAt: nowStr,
          read: false,
          taskId: task.id,
          taskTitle: task.title,
          picName: picUser.name,
          notes: notes,
          recipientRole: picUser.role as any,
        });
        break;
      }

      case 'APPROVED': {
        // 1. Notifikasi ACC / Selesai ke Karyawan
        assignedUsers.forEach((employee) => {
          this.addEmailNotification({
            id: `email_task_acc_emp_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
            toEmail: employee.email,
            toName: employee.name,
            fromName: `${actor.name} (${actor.role === 'SUPER_ADMIN' ? 'Super Admin' : actor.role === 'ADMIN' ? 'Admin' : 'PIC'})`,
            fromEmail: actor.email || picUser.email,
            subject: `Pemberitahuan Tugas Selesai: ${task.title}`,
            category: 'TASK_APPROVED',
            notificationType: 'TASK',
            employeeName: employee.name,
            employmentType: employee.employmentType,
            dateRange: task.dueDate ? `Batas Waktu: ${task.dueDate}` : undefined,
            reason: notes || 'Tugas telah ditinjau dan disetujui (ACC) oleh PIC. Penugasan Selesai.',
            directApprovalLink: '#tasks_my',
            sentAt: nowStr,
            read: false,
            taskId: task.id,
            taskTitle: task.title,
            taskPriority: priorityLabel,
            dueDate: task.dueDate,
            picName: picUser.name,
            notes: notes,
            recipientRole: 'EMPLOYEE',
          });
        });

        // 2. Notifikasi Penyelesaian Tugas ke PIC
        this.addEmailNotification({
          id: `email_task_acc_pic_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          toEmail: picUser.email,
          toName: picUser.name,
          fromName: 'Sistem in-Time Notifier',
          fromEmail: 'system@in-time.id',
          subject: `Konfirmasi Penyelesaian Tugas: ${task.title}`,
          category: 'TASK_APPROVED',
          notificationType: 'TASK',
          employeeName: assignedUsers.map((e) => e.name).join(', '),
          dateRange: task.dueDate ? `Batas Waktu: ${task.dueDate}` : undefined,
          reason: notes || 'Tugas telah disetujui dan ditandai selesai.',
          directApprovalLink: '#tasks_team',
          sentAt: nowStr,
          read: false,
          taskId: task.id,
          taskTitle: task.title,
          picName: picUser.name,
          notes: notes,
          recipientRole: picUser.role as any,
        });
        break;
      }
    }
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
    const existingTask = tasks.find((t) => t.id === taskId);
    const oldStatusTarget: TaskStatus | undefined = existingTask?.status;
    let updatedTargetTask: TaskItem | null = null;
    let actorUser: any = null;

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
        actorUser = user;

        const now = new Date();
        const dateStr = now.toISOString().substring(0, 10);
        const timeStr = now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
        const timestampStr = `${dateStr} ${timeStr}`;

        let activityType: TaskActivity['type'] = 'COMMENT_ADDED';
        let activityNotes = '';

        if (status === 'IN_PROGRESS' && oldStatus === 'TODO') {
          // Ketika mulai mengerjakan tugas, JANGAN buat template chat room
          activityNotes = '';
        } else if (status === 'IN_PROGRESS' && (oldStatus === 'DONE' || details?.reviewNotes)) {
          activityType = 'REVISION_REQUESTED';
          // PURE dari yang diketikkan, tanpa wrapper template
          activityNotes = (details?.reviewNotes || '').trim();
        } else if (status === 'DONE') {
          activityType = 'SUBMITTED';
          // PURE dari yang diketikkan, tanpa wrapper template
          activityNotes = (details?.submissionNotes || '').trim();
        } else if (status === 'REVIEWED') {
          activityType = 'APPROVED';
          // PURE dari yang diketikkan, tanpa wrapper template
          activityNotes = (details?.reviewNotes || '').trim();
        }

        // HANYA buat pesan activity chat jika pengguna benar-benar mengetikkan pesan atau mengunggah lampiran!
        const newActivities = [...currentActivities];
        if (activityNotes || newAttachments.length > 0) {
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
          newActivities.push(newActivity);
        }

        const resTask: TaskItem = {
          ...t,
          status,
          updatedAt: dateStr,
          attachments: currentAttachments, // Hanya lampiran penugasan awal dari PIC! Berkas chat tetap berada di room chat
          activities: newActivities,
          ...(details?.reviewNotes !== undefined ? { reviewNotes: details.reviewNotes } : {}),
          ...(details?.submissionNotes !== undefined ? { submissionNotes: details.submissionNotes } : {}),
        };
        updatedTargetTask = resTask;
        return resTask;
      }
      return t;
    });

    this.markTaskPendingSync(taskId);
    this.saveTasks(updated);

    ApiClient.updateKanbanTask(taskId, {
      status,
      review_notes: details?.reviewNotes,
      submission_notes: details?.submissionNotes,
      activities: (updatedTargetTask as TaskItem | null)?.activities || [],
      attachments: (updatedTargetTask as TaskItem | null)?.attachments || [],
      lampiran: (updatedTargetTask as TaskItem | null)?.attachments || [],
    })
      .then(() => {
        this.clearTaskPendingSync(taskId);
      })
      .catch((err: any) => {
        const code = Number(err?.status || 0);
        if (code >= 400) {
          this.clearTaskPendingSync(taskId);
          dispatchSafeWindowEvent('absenku:task_sync_error', {
            taskId,
            message: err?.message || 'Gagal memperbarui status tugas ke server.',
          });
        }
      });

    // Memicu notifikasi email otomatis untuk setiap proses penugasan (pengerjaan, submit, revisi, ACC)
    if (updatedTargetTask) {
      try {
        const cur = this.getCurrentUser();
        const actor = {
          id: actorUser?.id || cur?.id || 'usr_super_admin',
          name: actorUser?.name || cur?.name || 'Super Admin',
          email: actorUser?.email || cur?.email || this.getUsers().find((u) => u.role === 'SUPER_ADMIN')?.email || 'admin@perusahaan.local',
          role: actorUser?.role || cur?.role || 'SUPER_ADMIN',
        };
        if (status === 'IN_PROGRESS' && oldStatusTarget === 'TODO') {
          this.sendTaskEmailNotifications({
            type: 'IN_PROGRESS',
            task: updatedTargetTask,
            actor,
          });
        } else if (status === 'IN_PROGRESS' && (oldStatusTarget === 'DONE' || details?.reviewNotes)) {
          this.sendTaskEmailNotifications({
            type: 'REVISION',
            task: updatedTargetTask,
            actor,
            notes: details?.reviewNotes,
          });
        } else if (status === 'DONE') {
          this.sendTaskEmailNotifications({
            type: 'SUBMITTED',
            task: updatedTargetTask,
            actor,
            notes: details?.submissionNotes,
            attachments: details?.newAttachments,
          });
        } else if (status === 'REVIEWED') {
          this.sendTaskEmailNotifications({
            type: 'APPROVED',
            task: updatedTargetTask,
            actor,
            notes: details?.reviewNotes,
          });
        }
      } catch (err) {
        console.warn('Gagal memicu email status penugasan:', err);
      }
    }
  },

  addTaskActivity(taskId: string, activityData: Omit<TaskActivity, 'id' | 'timestamp'>): void {
    const tasks = this.getTasks();
    let targetTask: TaskItem | null = null;
    const updated = tasks.map((t) => {
      if (t.id === taskId) {
        const activities = t.activities || [];
        const newAct: TaskActivity = {
          ...activityData,
          id: `act_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          timestamp: new Date().toLocaleString('id-ID'),
        };
        const resTask: TaskItem = {
          ...t,
          activities: [...activities, newAct],
          updatedAt: new Date().toISOString().substring(0, 10),
        };
        targetTask = resTask;
        return resTask;
      }
      return t;
    });
    this.saveTasks(updated);

    if (targetTask) {
      this.markTaskPendingSync(taskId);
      ApiClient.updateKanbanTask(taskId, {
        activities: (targetTask as TaskItem).activities || [],
      })
        .then(() => {
          this.clearTaskPendingSync(taskId);
        })
        .catch((err) => {
          console.warn('Gagal sinkronisasi obrolan tugas ke backend:', err);
        });
    }
  },

  getPendingTaskSyncIds(): string[] {
    return readPendingSyncIds(PENDING_TASK_SYNC_KEY);
  },

  markTaskPendingSync(taskId: string): void {
    markPendingSyncId(PENDING_TASK_SYNC_KEY, taskId);
  },

  clearTaskPendingSync(taskId: string): void {
    clearPendingSyncId(PENDING_TASK_SYNC_KEY, taskId);
  },

  getPendingLeaveSyncIds(): string[] {
    return readPendingSyncIds(PENDING_LEAVE_SYNC_KEY);
  },

  markLeavePendingSync(leaveId: string): void {
    markPendingSyncId(PENDING_LEAVE_SYNC_KEY, leaveId);
  },

  clearLeavePendingSync(leaveId: string): void {
    clearPendingSyncId(PENDING_LEAVE_SYNC_KEY, leaveId);
  },

  getDeletedTaskIds(): string[] {
    try {
      const raw = localStorage.getItem('absenku_deleted_task_ids');
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  },

  recordDeletedTaskId(taskId: string): void {
    try {
      const list = this.getDeletedTaskIds();
      const sId = String(taskId);
      if (!list.includes(sId)) {
        list.push(sId);
        localStorage.setItem('absenku_deleted_task_ids', JSON.stringify(list.slice(-200)));
      }
    } catch {}
  },

  deleteTask(taskId: string): void {
    const tasks = this.getTasks();
    const updated = tasks.filter((t) => String(t.id) !== String(taskId));
    this.saveTasks(updated);
    this.recordDeletedTaskId(taskId);
    ApiClient.deleteKanbanTask(taskId).catch(() => {});
    window.dispatchEvent(new CustomEvent('absenku:tasks_updated'));
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

    const updatedTarget = updated.find((t) => t.id === taskId);
    if (updatedTarget) {
      this.markTaskPendingSync(taskId);
      ApiClient.updateKanbanTask(taskId, {
        status: updatedTarget.status,
        activities: updatedTarget.activities || [],
        review_notes: updatedTarget.reviewNotes,
        submission_notes: updatedTarget.submissionNotes,
      })
        .then(() => {
          this.clearTaskPendingSync(taskId);
        })
        .catch((err) => {
          console.warn('Gagal sinkronisasi hapus obrolan tugas ke backend:', err);
        });
    }
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
      const activeLeaves = parsed.filter(
        (l) => l.userId !== 'usr_super_admin' && l.userName?.toLowerCase() !== 'super admin'
      );
      if (activeLeaves.length !== parsed.length) {
        hasUpdate = true;
      }
      activeLeaves.forEach((l) => {
        if ((l.category as string) === 'ANNUAL') {
          l.category = 'LEAVE';
          hasUpdate = true;
        }
      });
      for (const initL of INITIAL_LEAVES) {
        if (!activeLeaves.some((l) => l.id === initL.id) && initL.userId !== 'usr_super_admin') {
          activeLeaves.push(initL);
          hasUpdate = true;
        }
      }
      if (hasUpdate) {
        localStorage.setItem(STORAGE_KEYS.LEAVES, JSON.stringify(activeLeaves));
      }
      return activeLeaves;
    } catch {
      return INITIAL_LEAVES;
    }
  },

  getLeaveRequests(): LeaveRequest[] {
    return this.getLeaves();
  },

  saveLeaves(leaves: LeaveRequest[], silent: boolean = false): void {
    const sanitized = leaves.map((l) => {
      if (l.attachmentData && l.attachmentData.startsWith('data:') && l.attachmentData.length > 500) {
        const attId = `leave_att_${l.id}`;
        storeAttachmentInIDB(attId, l.attachmentData).catch(() => {});
        return {
          ...l,
          attachmentData: `idb:${attId}`,
        };
      }
      return l;
    });
    safeSetItem(STORAGE_KEYS.LEAVES, JSON.stringify(sanitized));
    if (!silent && typeof window !== 'undefined' && typeof window.dispatchEvent === 'function' && typeof CustomEvent === 'function') {
      window.dispatchEvent(new CustomEvent('absenku:leaves_updated'));
    }
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

    // VALIDASI 1: tanggal akhir tidak boleh sebelum tanggal mulai
    if (!data.startDate || !data.endDate || data.endDate < data.startDate) {
      throw new Error('Tanggal selesai tidak boleh lebih awal dari tanggal mulai.');
    }

    // VALIDASI 2: tidak boleh bertabrakan dengan pengajuan lain (menunggu / disetujui)
    const conflict = findConflictingLeave(leaves, { id: user.id, name: user.name }, data.startDate, data.endDate);
    if (conflict) {
      const conflictLabel = LEAVE_CATEGORY_LABEL[conflict.category] || conflict.category;
      const conflictStatus = conflict.status === 'APPROVED' ? 'sudah disetujui' : 'masih menunggu persetujuan';
      throw new Error(
        `Tanggal bertabrakan dengan pengajuan ${conflictLabel} (${conflict.startDate}${
          conflict.endDate !== conflict.startDate ? ` s/d ${conflict.endDate}` : ''
        }) yang ${conflictStatus}. Batalkan pengajuan tersebut atau pilih tanggal lain.`
      );
    }

    // Cegah duplikasi perizinan pending yang persis sama
    const duplicate = leaves.find(
      (l) => l.userId === user.id && l.startDate === data.startDate && l.endDate === data.endDate && l.category === data.category && l.status === 'PENDING'
    );
    if (duplicate) {
      return duplicate;
    }

    const id = `leave_${Date.now()}`;
    let finalAttachmentData = data.attachmentData;
    if (data.attachmentData && data.attachmentData.startsWith('data:') && data.attachmentData.length > 500) {
      const attId = `leave_att_${id}`;
      storeAttachmentInIDB(attId, data.attachmentData).catch(() => {});
      finalAttachmentData = `idb:${attId}`;
    }

    const newLeave: LeaveRequest = {
      id,
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
      attachmentData: finalAttachmentData,
      attachmentType: data.attachmentType,
      status: 'PENDING',
      appliedAt: new Date().toISOString().replace('T', ' ').substring(0, 16),
    };

    leaves.unshift(newLeave);
    this.saveLeaves(leaves);
    this.markLeavePendingSync(newLeave.id);

    // Kirim pengajuan ke Laravel Backend & MySQL
    ApiClient.createLeave({
      id: newLeave.id,
      category: newLeave.category,
      start_date: newLeave.startDate,
      end_date: newLeave.endDate,
      total_days: newLeave.totalDays,
      reason: newLeave.reason,
      attachment_name: newLeave.attachmentName,
      attachment_data: newLeave.attachmentData,
      attachment_type: newLeave.attachmentType,
    })
      .then(() => {
        this.clearLeavePendingSync(newLeave.id);
      })
      .catch((err: any) => {
        const status = Number(err?.status || 0);
        if (status >= 400) {
          this.clearLeavePendingSync(newLeave.id);
          const remaining = this.getLeaves().filter((l) => String(l.id) !== String(newLeave.id));
          this.saveLeaves(remaining);
          dispatchSafeWindowEvent('absenku:leaves_updated');
          dispatchSafeWindowEvent('absenku:leave_sync_error', {
            leaveId: newLeave.id,
            message: err?.message || 'Gagal mengirim pengajuan izin ke server.',
          });
        }
      });

    // TRIGGER EMAIL NOTIFIKASI OTOMATIS KE SEMUA ADMIN & SUPER ADMIN (WEB & EMAIL ASLI)
    const categoryLabels: Record<LeaveCategory, string> = {
      LEAVE: 'Izin / Cuti',
      WFH: 'Work From Home (WFH)',
      SICK: 'Sakit',
      BUSINESS_TRIP: 'Dinas Luar',
    };

    const adminUsers = this.getUsers().filter(
      (u) => (u.role === 'SUPER_ADMIN' || u.role === 'ADMIN') && u.status === 'ACTIVE'
    );
    const targetAdmins =
      adminUsers.length > 0
        ? adminUsers
        : [{ id: 'usr_super_admin', email: 'admin@perusahaan.local', name: 'Super Admin', role: 'SUPER_ADMIN' as const, employmentType: 'PERMANENT' as const }];

    targetAdmins.forEach((admin) => {
      this.addEmailNotification({
        id: `email_leave_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        toEmail: admin.email,
        toName: admin.name,
        fromName: `${user.name} (Pengajuan Izin)`,
        fromEmail: user.email,
        subject: `Pengajuan Izin: ${user.name} - ${categoryLabels[data.category]}`,
        employeeName: user.name,
        employmentType: user.employmentType,
        category: data.category,
        notificationType: 'LEAVE',
        recipientRole: admin.role,
        dateRange: `${data.startDate} s/d ${data.endDate} (${data.totalDays} Hari)`,
        reason: data.reason,
        notes: `Pengajuan ${categoryLabels[data.category]} dari ${user.name} memerlukan persetujuan Administrator.`,
        attachmentName: data.attachmentName,
        directApprovalLink: '#leaves_approval',
        sentAt: new Date().toISOString().replace('T', ' ').substring(0, 19),
        read: false,
      });
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

  /**
   * Menyelaraskan record presensi seorang karyawan dengan pengajuan WFH / Dinas Luar yang DISETUJUI.
   * - Hari yang tertutup izin WFH  -> record ditandai WFH (WFH_APPROVED)
   * - Hari yang tertutup Dinas Luar -> record ditandai Dinas Luar (DINAS_APPROVED)
   * - Hari yang sebelumnya bertanda remote tetapi izinnya sudah tidak ada -> dikembalikan ke kantor / luar radius
   * Dipanggil setiap kali pengajuan disetujui, ditolak, dibatalkan, atau dipecah.
   */
  reconcileRemoteRecords(user: { id: string; name: string }): void {
    const leaves = this.getLeaves();
    const records = this.getAttendanceRecords();
    let changed = false;

    const next = records.map((r) => {
      const isTarget =
        r.userId === user.id || r.userName?.toLowerCase() === user.name?.toLowerCase();
      if (!isTarget) return r;

      const leave = getApprovedLeaveForDate(leaves, user, r.date);
      const isRemoteFlagged =
        r.clockInLocationStatus === 'WFH_APPROVED' ||
        r.clockInLocationStatus === 'DINAS_APPROVED' ||
        r.workMode === 'WFH' ||
        r.workMode === 'DINAS';

      // Izin OFF menang: record dibiarkan sebagai arsip
      if (leave && (leave.category === 'LEAVE' || leave.category === 'SICK')) return r;

      if (leave && leave.category === 'WFH') {
        if (r.workMode === 'WFH' && r.clockInLocationStatus === 'WFH_APPROVED') return r;
        changed = true;
        return { ...r, workMode: 'WFH' as const, clockInLocationStatus: 'WFH_APPROVED' as const };
      }

      if (leave && leave.category === 'BUSINESS_TRIP') {
        if (r.workMode === 'DINAS' && r.clockInLocationStatus === 'DINAS_APPROVED') return r;
        changed = true;
        return { ...r, workMode: 'DINAS' as const, clockInLocationStatus: 'DINAS_APPROVED' as const };
      }

      // Tidak ada izin remote lagi, tetapi record masih bertanda remote -> kembalikan
      if (isRemoteFlagged) {
        changed = true;
        const outOfRange = r.clockInDistanceMeter !== undefined && r.clockInDistanceMeter > 100;
        return {
          ...r,
          workMode: 'WFO' as const,
          clockInLocationStatus: outOfRange ? ('OUT_OF_RANGE' as const) : ('IN_OFFICE' as const),
        };
      }
      return r;
    });

    if (changed) this.saveAttendanceRecords(next);
  },

  approveLeave(leaveId: string, reviewerName: string): void {
    const leaves = this.getLeaves();
    let approvedLeave: LeaveRequest | undefined;
    const updated = leaves.map((l) => {
      if (l.id === leaveId) {
        approvedLeave = {
          ...l,
          status: 'APPROVED' as const,
          reviewedBy: reviewerName,
          reviewedAt: new Date().toISOString().replace('T', ' ').substring(0, 16),
        };
        return approvedLeave;
      }
      return l;
    });
    this.saveLeaves(updated);

    if (approvedLeave) {
      this.reconcileRemoteRecords({ id: approvedLeave.userId, name: approvedLeave.userName });
      ApiClient.approveLeave(leaveId).catch(() => {});

      // Kirim email notifikasi persetujuan ke email karyawan pemohon izin
      const targetUser = this.getUsers().find((u) => u.id === approvedLeave?.userId);
      const empEmail = targetUser?.email || '';
      const categoryLabel =
        approvedLeave.category === 'BUSINESS_TRIP'
          ? 'Dinas Luar'
          : LEAVE_CATEGORY_LABEL[approvedLeave.category] || approvedLeave.category;
      this.addEmailNotification({
        id: `email_leave_app_${Date.now()}`,
        toEmail: empEmail,
        toName: approvedLeave.userName,
        fromName: `${reviewerName} (PIC / Admin)`,
        subject: `Pengajuan Disetujui: ${categoryLabel} - ${approvedLeave.userName}`,
        employeeName: approvedLeave.userName,
        category: categoryLabel,
        dateRange: `${approvedLeave.startDate} s/d ${approvedLeave.endDate} (${approvedLeave.totalDays} Hari)`,
        reason: approvedLeave.reason,
        notes: `Pengajuan telah resmi disetujui oleh ${reviewerName}.`,
        directApprovalLink: '#leaves',
        sentAt: new Date().toISOString().replace('T', ' ').substring(0, 19),
        read: false,
      });
    }
  },

  rejectLeave(leaveId: string, reason: string, reviewerName: string): void {
    const leaves = this.getLeaves();
    let rejectedLeave: LeaveRequest | undefined;
    const updated = leaves.map((l) => {
      if (l.id === leaveId) {
        rejectedLeave = {
          ...l,
          status: 'REJECTED' as const,
          rejectionReason: reason,
          reviewedBy: reviewerName,
          reviewedAt: new Date().toISOString().replace('T', ' ').substring(0, 16),
        };
        return rejectedLeave;
      }
      return l;
    });
    this.saveLeaves(updated);

    if (rejectedLeave) {
      this.reconcileRemoteRecords({ id: rejectedLeave.userId, name: rejectedLeave.userName });
      ApiClient.rejectLeave(leaveId, reason).catch(() => {});

      // Kirim email notifikasi penolakan ke email karyawan pemohon izin
      const targetUser = this.getUsers().find((u) => u.id === rejectedLeave?.userId);
      const empEmail = targetUser?.email || '';
      const categoryLabel =
        rejectedLeave.category === 'BUSINESS_TRIP'
          ? 'Dinas Luar'
          : LEAVE_CATEGORY_LABEL[rejectedLeave.category] || rejectedLeave.category;
      this.addEmailNotification({
        id: `email_leave_rej_${Date.now()}`,
        toEmail: empEmail,
        toName: rejectedLeave.userName,
        fromName: `${reviewerName} (PIC / Admin)`,
        subject: `Pemberitahuan Penolakan Pengajuan: ${categoryLabel} - ${rejectedLeave.userName}`,
        employeeName: rejectedLeave.userName,
        category: categoryLabel,
        dateRange: `${rejectedLeave.startDate} s/d ${rejectedLeave.endDate} (${rejectedLeave.totalDays} Hari)`,
        reason: rejectedLeave.reason,
        notes: `Catatan Penolakan: ${reason} (Ditinjau oleh ${reviewerName})`,
        directApprovalLink: '#leaves',
        sentAt: new Date().toISOString().replace('T', ' ').substring(0, 19),
        read: false,
      });
    }
  },

  deleteLeaveRequest(leaveId: string): void {
    const leaves = this.getLeaves();
    const target = leaves.find((l) => l.id === leaveId);
    const updated = leaves.filter((l) => l.id !== leaveId);
    this.saveLeaves(updated);
    ApiClient.deleteLeave(leaveId).catch(() => {});

    // Jika yang dibatalkan adalah izin yang sudah disetujui, kembalikan record presensi terkait
    if (target) {
      this.reconcileRemoteRecords({ id: target.userId, name: target.userName });
    }
  },

  /**
   * Menetapkan status perizinan untuk SATU HARI saja (dipakai Edit Presensi oleh Admin).
   * Pengajuan multi-hari yang menutupi hari tersebut DIPECAH menjadi "sebelum" dan "sesudah",
   * sehingga hari-hari lain pada pengajuan yang sama tidak ikut berubah / terhapus.
   * category = 'NONE' berarti menghapus izin pada hari itu saja.
   */
  setLeaveCategoryForDate(
    user: { id: string; name: string; avatar?: string; department?: string; employmentType?: any },
    date: string,
    category: LeaveCategory | 'NONE',
    options: { reason?: string; reviewerName?: string } = {}
  ): void {
    const reviewerName = options.reviewerName || 'Administrator';
    const stamp = new Date().toISOString().replace('T', ' ').substring(0, 16);
    const leaves = this.getLeaves();

    const isTarget = (l: LeaveRequest) =>
      l.userId === user.id || l.userName?.toLowerCase() === user.name?.toLowerCase();

    const covering = leaves.filter(
      (l) => isTarget(l) && l.status === 'APPROVED' && isDateInRange(date, l.startDate, l.endDate)
    );
    const sameCategory = category !== 'NONE' ? covering.find((l) => l.category === category) : undefined;

    const result: LeaveRequest[] = leaves.filter((l) => !covering.includes(l));
    let seq = 0;

    covering.forEach((l) => {
      if (l === sameCategory) {
        // Kategori sama: pertahankan apa adanya (hanya perbarui alasan bila diisi admin)
        result.push(options.reason?.trim() ? { ...l, reason: options.reason.trim() } : l);
        return;
      }
      // Pecah: sebelum hari ini & sesudah hari ini tetap memakai kategori semula
      if (l.startDate < date) {
        const endBefore = shiftDate(date, -1);
        result.push({
          ...l,
          id: `${l.id}_a${seq++}`,
          endDate: endBefore,
          totalDays: countInclusiveDays(l.startDate, endBefore),
        });
      }
      if (l.endDate > date) {
        const startAfter = shiftDate(date, 1);
        result.push({
          ...l,
          id: `${l.id}_b${seq++}`,
          startDate: startAfter,
          totalDays: countInclusiveDays(startAfter, l.endDate),
        });
      }
    });

    if (category !== 'NONE' && !sameCategory) {
      const template = covering[0];
      const newLeaveId = `leave_adm_${Date.now()}`;
      const newLeave: LeaveRequest = {
        id: newLeaveId,
        userId: user.id,
        userName: user.name,
        userAvatar: user.avatar || template?.userAvatar || '',
        department: user.department || template?.department || 'Divisi Operasional',
        employmentType: user.employmentType || template?.employmentType || 'CONTRACT',
        category,
        startDate: date,
        endDate: date,
        totalDays: 1,
        reason:
          options.reason?.trim() ||
          `Perizinan ${LEAVE_CATEGORY_LABEL[category]} ditetapkan oleh ${reviewerName}`,
        status: 'APPROVED',
        appliedAt: stamp,
        reviewedBy: reviewerName,
        reviewedAt: stamp,
      };
      result.push(newLeave);

      ApiClient.createLeave({
        id: newLeave.id,
        user_id: user.id,
        pengguna_id: user.id,
        category: newLeave.category,
        start_date: newLeave.startDate,
        end_date: newLeave.endDate,
        total_days: newLeave.totalDays,
        reason: newLeave.reason,
      }).then(() => {
        ApiClient.approveLeave(newLeave.id).catch(() => {});
      }).catch(() => {});
    } else if (category === 'NONE') {
      covering.forEach((cov) => {
        ApiClient.deleteLeave(cov.id).catch(() => {});
      });
    }

    this.saveLeaves(result);
    this.reconcileRemoteRecords({ id: user.id, name: user.name });
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
      const list: EmailNotification[] = JSON.parse(raw);
      return list.map((e) => ({
        ...e,
        subject: (e.subject || '').replace(/BUSINESS_TRIP/g, 'Dinas Luar'),
        category: e.category === 'BUSINESS_TRIP' ? 'Dinas Luar' : e.category,
      }));
    } catch {
      return INITIAL_EMAIL_NOTIFICATIONS;
    }
  },

  addEmailNotification(notification: EmailNotification): void {
    const cleanSubject = (notification.subject || '')
      .replace(/BUSINESS_TRIP/g, 'Dinas Luar')
      .replace(/business_trip/gi, 'Dinas Luar');
    const cleanCategory =
      notification.category === 'BUSINESS_TRIP'
        ? 'Dinas Luar'
        : notification.category === 'LEAVE'
        ? 'Cuti / Izin'
        : notification.category === 'SICK'
        ? 'Sakit'
        : notification.category;

    const sanitizedNotification: EmailNotification = {
      ...notification,
      subject: cleanSubject,
      category: cleanCategory,
    };

    const emails = this.getEmailNotifications();
    emails.unshift(sanitizedNotification);
    localStorage.setItem(STORAGE_KEYS.EMAILS, JSON.stringify(emails));
    if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function' && typeof CustomEvent === 'function') {
      window.dispatchEvent(
        new CustomEvent('absenku:email_notification', { detail: sanitizedNotification })
      );
    }

    // DISPATCH REAL EMAIL VIA NODEMAILER (GMAIL SMTP)
    try {
      const users = this.getUsers();
      let rawTo = sanitizedNotification.toEmail?.trim();

      // Jika alamat email dummy / contoh yang tidak bisa menerima email asli:
      const superAdminEmail = users.find((u) => u.role === 'SUPER_ADMIN')?.email || '';
      if (
        !rawTo ||
        !rawTo.includes('@') ||
        rawTo.toLowerCase() === 'superadmin@gmail.com' ||
        rawTo.toLowerCase().endsWith('@kantor.id') ||
        rawTo.toLowerCase().endsWith('@absenku.id') ||
        rawTo.toLowerCase().endsWith('.local')
      ) {
        // Coba cari dari nama / ID user di biodata diri yang sudah diinputkan
        const matchedUser =
          users.find((u) => u.name?.toLowerCase() === sanitizedNotification.toName?.toLowerCase()) ||
          users.find((u) => u.name?.toLowerCase() === sanitizedNotification.employeeName?.toLowerCase());

        if (
          matchedUser &&
          matchedUser.email &&
          matchedUser.email.includes('@') &&
          matchedUser.email.toLowerCase() !== 'superadmin@gmail.com' &&
          !matchedUser.email.toLowerCase().endsWith('@kantor.id') &&
          !matchedUser.email.toLowerCase().endsWith('@absenku.id') &&
          !matchedUser.email.toLowerCase().endsWith('.local')
        ) {
          rawTo = matchedUser.email.trim();
        } else {
          // Bedakan peran penerima agar email Pelaksana dan PIC tidak tertukar
          if (sanitizedNotification.recipientRole === 'EMPLOYEE') {
            const realEmp = users.find(
              (u) =>
                u.role === 'EMPLOYEE' &&
                u.email &&
                u.email.includes('@') &&
                !u.email.toLowerCase().endsWith('@kantor.id') &&
                !u.email.toLowerCase().endsWith('@absenku.id') &&
                !u.email.toLowerCase().endsWith('.local')
            );
            rawTo = realEmp?.email || superAdminEmail;
          } else {
            const realPic = users.find(
              (u) =>
                (u.role === 'SUPER_ADMIN' || u.role === 'ADMIN') &&
                u.email &&
                u.email.includes('@') &&
                u.email.toLowerCase() !== 'superadmin@gmail.com' &&
                !u.email.toLowerCase().endsWith('.local')
            );
            rawTo = realPic?.email || superAdminEmail;
          }
        }
      }

      const recipientEmail = rawTo;

      const isTaskEmail =
        sanitizedNotification.notificationType === 'TASK' ||
        Boolean(sanitizedNotification.taskId) ||
        (sanitizedNotification.category && sanitizedNotification.category.startsWith('TASK_'));

      const isAccountEmail =
        sanitizedNotification.notificationType === 'ACCOUNT' ||
        sanitizedNotification.category === 'ACCOUNT_VERIFIED';

      const isPelaksana = sanitizedNotification.recipientRole === 'EMPLOYEE';

      const fields: Array<{ label: string; value: string }> = [];
      let emailIntro = sanitizedNotification.notes || 'Pemberitahuan aktivitas terbaru di sistem in-Time:';
      let actionText = 'Buka Aplikasi in-Time';
      let actionUrl = typeof window !== 'undefined' && window.location ? window.location.origin : '';
      let footerNote = '';

      if (isAccountEmail) {
        actionText = 'Masuk ke Aplikasi in-Time';
        emailIntro =
          sanitizedNotification.notes ||
          'Kabar baik! Pendaftaran akun Anda di sistem in-Time telah resmi disetujui dan diverifikasi. Akun Anda saat ini sudah aktif dan dapat langsung digunakan untuk presensi dan manajemen tugas.';
        footerNote = '';

        if (sanitizedNotification.employeeName) {
          fields.push({ label: 'Nama Pengguna', value: sanitizedNotification.employeeName });
        }
        if (sanitizedNotification.toEmail) {
          fields.push({ label: 'Email Terdaftar', value: sanitizedNotification.toEmail });
        }
        const roleLabel =
          sanitizedNotification.recipientRole === 'SUPER_ADMIN'
            ? 'Superadmin'
            : sanitizedNotification.recipientRole === 'ADMIN'
            ? 'Admin'
            : 'Karyawan';
        fields.push({ label: 'Hak Akses / Peran', value: roleLabel });
        fields.push({ label: 'Status Akun', value: 'Aktif (Terverifikasi)' });
      } else if (isTaskEmail) {
        // Pemetaan kategori tugas ke status bahasa Indonesia yang ringkas & jelas
        let statusText = 'Penugasan';
        if (sanitizedNotification.category === 'TASK_IN_PROGRESS') {
          statusText = 'Dalam Proses';
        } else if (sanitizedNotification.category === 'TASK_SUBMITTED') {
          statusText = 'Tinjauan Tugas';
        } else if (sanitizedNotification.category === 'TASK_REVISION') {
          statusText = 'Perlu Revisi';
        } else if (sanitizedNotification.category === 'TASK_APPROVED') {
          statusText = 'Selesai';
        }

        // Tentukan kalimat pembuka ringkas sesuai peran (Pelaksana vs PIC)
        if (isPelaksana) {
          switch (sanitizedNotification.category) {
            case 'TASK_ASSIGNED':
              emailIntro = 'Anda menerima penugasan baru dari PIC dengan rincian berikut:';
              break;
            case 'TASK_IN_PROGRESS':
              emailIntro = 'Status pengerjaan tugas Anda saat ini telah masuk ke tahap Dalam Proses:';
              break;
            case 'TASK_SUBMITTED':
              emailIntro = 'Tugas Anda telah dikumpulkan dan sedang menunggu tinjauan dari PIC:';
              break;
            case 'TASK_REVISION':
              emailIntro = 'Terdapat instruksi/catatan revisi dari PIC untuk tugas Anda:';
              break;
            case 'TASK_APPROVED':
              emailIntro = 'Selamat! Tugas Anda telah disetujui (ACC) oleh PIC dan resmi selesai:';
              break;
            default:
              emailIntro = 'Berikut informasi ringkas penugasan Anda:';
              break;
          }
        } else {
          switch (sanitizedNotification.category) {
            case 'TASK_ASSIGNED':
              emailIntro = 'Konfirmasi penugasan yang Anda berikan kepada pelaksana:';
              break;
            case 'TASK_IN_PROGRESS':
              emailIntro = 'Pelaksana telah memulai pengerjaan aktif untuk tugas berikut:';
              break;
            case 'TASK_SUBMITTED':
              emailIntro = 'Tugas telah dikumpulkan oleh pelaksana dan siap untuk Anda tinjau:';
              break;
            case 'TASK_REVISION':
              emailIntro = 'Instruksi revisi tugas berhasil dikirimkan kepada pelaksana:';
              break;
            case 'TASK_APPROVED':
              emailIntro = 'Tugas telah Anda setujui dan resmi dinyatakan selesai:';
              break;
            default:
              emailIntro = 'Berikut informasi ringkas penugasan tim:';
              break;
          }
        }

        // 1. Penugasan (Judul Tugas)
        const taskName =
          sanitizedNotification.taskTitle ||
          (sanitizedNotification.subject || '')
            .replace(/^(Penugasan Baru:|Konfirmasi Penugasan:|Pemberitahuan Pengerjaan:|Pengerjaan Dimulai:|Pengumpulan Tugas:|Konfirmasi Pengumpulan Tugas:|Permintaan Revisi Tugas:|Konfirmasi Instruksi Revisi:|Pemberitahuan Tugas Selesai:|Konfirmasi Penyelesaian Tugas:)\s*/i, '')
            .trim() ||
          'Penugasan Tim';
        fields.push({ label: 'Penugasan', value: taskName });

        // 2. Kategori / Status (Penugasan, Dalam Proses, Tinjauan Tugas, Selesai)
        fields.push({ label: 'Kategori / Status', value: statusText });

        // 3. Tenggat Waktu (Deadline)
        const rawDue =
          sanitizedNotification.dueDate ||
          (sanitizedNotification.dateRange ? sanitizedNotification.dateRange.replace(/^Batas Waktu:\s*/i, '').trim() : '');
        const formattedDue = rawDue
          ? rawDue.includes('-')
            ? formatIndonesianDateShort(rawDue)
            : rawDue
          : 'Tidak ada tenggat waktu';
        fields.push({ label: 'Tenggat Waktu', value: formattedDue });

        // 4. Sesuaikan ke Pelaksana atau PIC
        if (isPelaksana) {
          fields.push({
            label: 'PIC Penugasan',
            value: sanitizedNotification.picName || 'Administrator',
          });
          if (
            sanitizedNotification.notes &&
            sanitizedNotification.notes !== sanitizedNotification.taskTitle &&
            !sanitizedNotification.notes.startsWith('Tugas telah ditinjau dan disetujui') &&
            !sanitizedNotification.notes.startsWith('Hasil pengerjaan tugas telah dikirimkan')
          ) {
            fields.push({
              label: 'Catatan PIC',
              value: sanitizedNotification.notes,
            });
          }
        } else {
          fields.push({
            label: 'Pelaksana',
            value: sanitizedNotification.employeeName || 'Karyawan',
          });
          if (
            sanitizedNotification.notes &&
            sanitizedNotification.notes !== sanitizedNotification.taskTitle &&
            !sanitizedNotification.notes.startsWith('Tugas telah disetujui') &&
            !sanitizedNotification.notes.startsWith('Hasil pengerjaan tugas telah dikirimkan')
          ) {
            fields.push({
              label: 'Catatan Pelaksana',
              value: sanitizedNotification.notes,
            });
          }
        }
      } else {
        // NON-TASK NOTIFICATION (Perizinan / Cuti / Sakit / WFH / Dinas Luar)
        if (sanitizedNotification.employeeName) {
          fields.push({ label: 'Nama Karyawan', value: sanitizedNotification.employeeName });
        }
        if (sanitizedNotification.category) {
          const catLabel =
            sanitizedNotification.category === 'BUSINESS_TRIP'
              ? 'Dinas Luar'
              : sanitizedNotification.category === 'LEAVE'
              ? 'Cuti / Izin'
              : sanitizedNotification.category === 'SICK'
              ? 'Sakit'
              : sanitizedNotification.category;
          fields.push({ label: 'Kategori / Status', value: catLabel });
        }
        if (sanitizedNotification.dateRange) {
          fields.push({ label: 'Periode / Tanggal', value: sanitizedNotification.dateRange });
        }
        if (sanitizedNotification.reason) {
          fields.push({ label: 'Alasan / Keterangan', value: sanitizedNotification.reason });
        }
        if (
          sanitizedNotification.notes &&
          sanitizedNotification.notes !== sanitizedNotification.reason &&
          !sanitizedNotification.notes.startsWith('Pengajuan telah resmi disetujui')
        ) {
          fields.push({ label: 'Catatan', value: sanitizedNotification.notes });
        }
      }

      const html = generateEmailHtmlTemplate({
        title: cleanSubject,
        recipientName: sanitizedNotification.toName || sanitizedNotification.employeeName || 'Rekan Tim',
        intro: emailIntro,
        fields,
        actionUrl,
        actionText,
        footerNote: footerNote || undefined,
      });

      const plainTextFields = fields.map((f) => `- ${f.label}: ${f.value}`).join('\n');
      const closingNote = footerNote
        ? `\n\n${footerNote}`
        : isTaskEmail
        ? '\n\nSilakan akses portal web in-Time untuk meninjau detail penugasan.'
        : '';
      const plainText = `${cleanSubject}\n\nHalo ${sanitizedNotification.toName || sanitizedNotification.employeeName || 'Rekan Tim'},\n\n${emailIntro}\n\n${plainTextFields}${closingNote}\n\nSalam,\nTim in-Time`;

      sendRealEmail({
        to: recipientEmail,
        subject: cleanSubject,
        html,
        text: plainText,
      });
    } catch (err) {
      console.warn('Gagal memicu pengiriman real email:', err);
    }
  },

  markEmailAsRead(id: string): void {
    const emails = this.getEmailNotifications();
    const updated = emails.map((e) => (e.id === id ? { ...e, read: true } : e));
    localStorage.setItem(STORAGE_KEYS.EMAILS, JSON.stringify(updated));
    if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function' && typeof CustomEvent === 'function') {
      window.dispatchEvent(new CustomEvent('absenku:emails_updated'));
    }
  },

  markAllEmailsAsRead(): void {
    const emails = this.getEmailNotifications();
    const updated = emails.map((e) => ({ ...e, read: true }));
    localStorage.setItem(STORAGE_KEYS.EMAILS, JSON.stringify(updated));
    if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function' && typeof CustomEvent === 'function') {
      window.dispatchEvent(new CustomEvent('absenku:emails_updated'));
    }
  },

  clearEmailNotifications(): void {
    localStorage.setItem(STORAGE_KEYS.EMAILS, JSON.stringify([]));
    if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function' && typeof CustomEvent === 'function') {
      window.dispatchEvent(new CustomEvent('absenku:emails_updated'));
    }
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
      if (!parsed || typeof parsed !== 'object' || !parsed.name) {
        localStorage.setItem(STORAGE_KEYS.OFFICE_CONFIG, JSON.stringify(INITIAL_OFFICE_CONFIG));
        return INITIAL_OFFICE_CONFIG;
      }
      return {
        ...INITIAL_OFFICE_CONFIG,
        ...parsed,
        latitude: Number(parsed.latitude ?? INITIAL_OFFICE_CONFIG.latitude),
        longitude: Number(parsed.longitude ?? INITIAL_OFFICE_CONFIG.longitude),
        geofenceRadiusMeter: Number(parsed.geofenceRadiusMeter ?? INITIAL_OFFICE_CONFIG.geofenceRadiusMeter),
        isGeofenceActive: Boolean(parsed.isGeofenceActive ?? INITIAL_OFFICE_CONFIG.isGeofenceActive),
      };
    } catch {
      return INITIAL_OFFICE_CONFIG;
    }
  },

  saveOfficeConfigLocally(newCfg: OfficeConfig): void {
    localStorage.setItem(STORAGE_KEYS.OFFICE_CONFIG, JSON.stringify(newCfg));
  },

  updateOfficeConfig(newCfg: OfficeConfig): void {
    this.saveOfficeConfigLocally(newCfg);
    ApiClient.updateOfficeConfig({
      name: newCfg.name,
      nama_kantor: newCfg.name,
      address: newCfg.address,
      alamat_kantor: newCfg.address,
      latitude: newCfg.latitude,
      longitude: newCfg.longitude,
      geofence_radius_meter: newCfg.geofenceRadiusMeter,
      radius_geofence_meter: newCfg.geofenceRadiusMeter,
      geofenceRadiusMeter: newCfg.geofenceRadiusMeter,
      work_start_hour: newCfg.workStartHour,
      jam_masuk: newCfg.workStartHour,
      workStartHour: newCfg.workStartHour,
      work_end_hour: newCfg.workEndHour,
      jam_pulang: newCfg.workEndHour,
      workEndHour: newCfg.workEndHour,
      grace_period_minutes: newCfg.gracePeriodMinutes,
      toleransi_keterlambatan_menit: newCfg.gracePeriodMinutes,
      gracePeriodMinutes: newCfg.gracePeriodMinutes,
      is_geofence_active: newCfg.isGeofenceActive,
      status_geofence_aktif: newCfg.isGeofenceActive,
      isGeofenceActive: newCfg.isGeofenceActive,
    })
      .then((res: any) => {
        window.dispatchEvent(new CustomEvent('absenku:office_config_updated', { detail: res?.config || newCfg }));
      })
      .catch((err) => {
        console.warn('Gagal menyinkronkan office config ke server:', err);
      });
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
              return { ...c, userName: 'Hendra Pratama', notes: c.notes.replace('Fikar Alibaba', 'Sarah Amelia & @Tim Operasional') };
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
      return updated.sort((a, b) => {
        const timeA = a.updatedAt || a.createdAt || '';
        const timeB = b.updatedAt || b.createdAt || '';
        if (timeA !== timeB) return timeB.localeCompare(timeA);
        return (b.id || '').localeCompare(a.id || '');
      });
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

    ApiClient.createChatTopic({
      id: newTopic.id,
      title: newTopic.title,
      status: newTopic.status,
      shortNotes: newTopic.shortNotes,
      longNotes: newTopic.longNotes,
      taggedTeammateIds: newTopic.taggedTeammateIds,
      files: newTopic.files,
      links: newTopic.links,
      images: newTopic.images,
      createdBy: newTopic.createdBy,
      createdByName: newTopic.createdByName,
      createdByAvatar: newTopic.createdByAvatar,
    }).catch(() => {});

    return newTopic;
  },

  updateChatTopic(topic: ChatTopic): void {
    const topics = this.getChatTopics();
    const index = topics.findIndex((t) => t.id === topic.id);
    if (index !== -1) {
      const now = new Date();
      topic.updatedAt = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

      // Any user explicitly present in taggedTeammateIds is active again -> clear hidden flags for them.
      const normalizedTags = new Set(
        (topic.taggedTeammateIds || []).map((tag) => String(tag || '').trim().toLowerCase()).filter(Boolean)
      );
      const reinvitedUserIds = new Set<string>();
      this.getUsers().forEach((u) => {
        if (getUserMatchIdentifiers(u).some((id) => normalizedTags.has(id))) {
          reinvitedUserIds.add(String(u.id).trim());
          this.clearHiddenChatTopicId(u.id, topic.id);
        }
      });

      const sanitizedTopic: ChatTopic = {
        ...topic,
        hiddenByIds: (topic.hiddenByIds || [])
          .map((id) => String(id).trim())
          .filter((id) => id && !reinvitedUserIds.has(id)),
      };

      topics[index] = sanitizedTopic;
      this.saveChatTopics(topics);

      ApiClient.updateChatTopic(sanitizedTopic.id, {
        title: sanitizedTopic.title,
        status: sanitizedTopic.status,
        shortNotes: sanitizedTopic.shortNotes,
        longNotes: sanitizedTopic.longNotes,
        taggedTeammateIds: sanitizedTopic.taggedTeammateIds,
        id_anggota_ditandai: sanitizedTopic.taggedTeammateIds,
        files: sanitizedTopic.files,
        links: sanitizedTopic.links,
        images: sanitizedTopic.images,
      }).catch(() => {});
    }
  },

  getHiddenChatTopicMap(userId?: string | null): Record<string, number> {
    const normalizedUserId = String(userId || '').trim();
    if (!normalizedUserId) return {};
    try {
      const raw = localStorage.getItem(HIDDEN_CHAT_TOPICS_KEY);
      if (!raw) return {};
      const parsed = JSON.parse(raw);
      const entry = parsed && typeof parsed === 'object' ? parsed[normalizedUserId] : null;
      const now = Date.now();
      if (Array.isArray(entry)) {
        const result: Record<string, number> = {};
        entry.forEach((id: unknown) => {
          const clean = String(id).trim();
          if (clean) result[clean] = now;
        });
        return result;
      }
      if (entry && typeof entry === 'object') {
        const result: Record<string, number> = {};
        Object.entries(entry).forEach(([tid, ts]) => {
          const cleanTid = String(tid).trim();
          const numTs = Number(ts);
          if (cleanTid && !Number.isNaN(numTs) && now - numTs < 60_000) {
            result[cleanTid] = numTs;
          }
        });
        return result;
      }
      return {};
    } catch {
      return {};
    }
  },

  getHiddenChatTopicIds(userId?: string | null): string[] {
    return Object.keys(this.getHiddenChatTopicMap(userId));
  },

  recordHiddenChatTopicId(userId: string, topicId: string): void {
    const normalizedUserId = String(userId || '').trim();
    const normalizedTopicId = String(topicId || '').trim();
    if (!normalizedUserId || !normalizedTopicId) return;
    try {
      const raw = localStorage.getItem(HIDDEN_CHAT_TOPICS_KEY);
      const parsed = raw ? JSON.parse(raw) : {};
      const store: Record<string, Record<string, number> | string[]> =
        parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
      const currentMap = this.getHiddenChatTopicMap(normalizedUserId);
      currentMap[normalizedTopicId] = Date.now();
      store[normalizedUserId] = currentMap;
      localStorage.setItem(HIDDEN_CHAT_TOPICS_KEY, JSON.stringify(store));
    } catch {
      // Ignore storage quota / parse failures
    }
  },

  clearHiddenChatTopicId(userId: string, topicId: string): void {
    const normalizedUserId = String(userId || '').trim();
    const normalizedTopicId = String(topicId || '').trim();
    if (!normalizedUserId || !normalizedTopicId) return;
    try {
      const raw = localStorage.getItem(HIDDEN_CHAT_TOPICS_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return;
      const currentMap = this.getHiddenChatTopicMap(normalizedUserId);
      if (Object.prototype.hasOwnProperty.call(currentMap, normalizedTopicId)) {
        delete currentMap[normalizedTopicId];
        parsed[normalizedUserId] = currentMap;
        localStorage.setItem(HIDDEN_CHAT_TOPICS_KEY, JSON.stringify(parsed));
      }
    } catch {
      // Ignore storage quota / parse failures
    }
  },

  deleteChatTopic(topicId: string, currentUserId?: string): void {
    const topics = this.getChatTopics();
    const normalizedUserId = String(currentUserId || '').trim();

    if (normalizedUserId) {
      this.recordHiddenChatTopicId(normalizedUserId, topicId);
      const targetTopic = topics.find((t) => t.id === topicId);
      const allUsers = this.getUsers();
      if (targetTopic && hasOtherChatParticipants(targetTopic, normalizedUserId, allUsers)) {
        const actingUser = allUsers.find((u) => u.id === normalizedUserId) || { id: normalizedUserId };
        const actingIdentifiers = new Set(getUserMatchIdentifiers(actingUser));

        const nextTopics = topics.map((t) => {
          if (t.id !== topicId) return t;
          const hiddenByIds = Array.from(
            new Set([...(t.hiddenByIds || []).map((id) => String(id).trim()), normalizedUserId].filter(Boolean))
          );
          const taggedTeammateIds = (t.taggedTeammateIds || []).filter(
            (tag) => !actingIdentifiers.has(String(tag || '').trim().toLowerCase())
          );
          return { ...t, taggedTeammateIds, hiddenByIds };
        });
        this.saveChatTopics(nextTopics);
        ApiClient.deleteChatTopic(topicId).catch(() => {});
        return;
      }
    }

    const filtered = topics.filter((t) => t.id !== topicId);
    this.saveChatTopics(filtered);
    ApiClient.deleteChatTopic(topicId).catch(() => {});
  },

  addTopicComment(topicId: string, commentData: Omit<ChatComment, 'id' | 'topicId' | 'timestamp'>): ChatComment {
    const topics = this.getChatTopics();
    const targetIdStr = String(topicId);
    let topic = topics.find((t) => String(t.id) === targetIdStr);

    const now = new Date();
    const timeStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    const newComment: ChatComment = {
      ...commentData,
      id: `comm_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      topicId: targetIdStr,
      timestamp: timeStr,
    };

    if (!topic) {
      // Fallback: buat topic container jika tidak ditemukan di storage lokal agar tidak melempar error crash
      topic = {
        id: targetIdStr,
        title: 'Topik Obrolan',
        status: 'NEED_COMMENTS',
        taggedTeammateIds: [],
        files: [],
        links: [],
        images: [],
        shortNotes: '',
        longNotes: '',
        createdBy: commentData.userId,
        createdByName: commentData.userName,
        createdByAvatar: commentData.userAvatar,
        comments: [newComment],
        createdAt: timeStr,
        updatedAt: timeStr,
      };
      topics.unshift(topic);
    } else {
      if (!Array.isArray(topic.comments)) topic.comments = [];
      topic.comments.push(newComment);
      topic.updatedAt = timeStr;
    }

    this.saveChatTopics(topics);

    ApiClient.sendChatMessage({
      id: newComment.id,
      topic_id: targetIdStr,
      user_id: newComment.userId,
      user_name: newComment.userName,
      user_avatar: newComment.userAvatar,
      user_role: newComment.userRole,
      content: newComment.notes || (newComment as any).content || '',
      notes: newComment.notes || '',
      attachments: newComment.attachments || [],
    }).catch(() => {});

    return newComment;
  },

  deleteTopicComment(topicId: string, commentId: string): void {
    const topics = this.getChatTopics();
    const topic = topics.find((t) => t.id === topicId);
    if (topic && topic.comments) {
      topic.comments = topic.comments.filter((c) => c.id !== commentId);
      this.saveChatTopics(topics);
      ApiClient.deleteChatMessage(commentId).catch(() => {});
    }
  },

  // Reset Data ke Factory Default
  resetToDefault(): void {
    this.purgeAllExceptSuperAdmin();
    localStorage.setItem(STORAGE_KEYS.OFFICE_CONFIG, JSON.stringify(INITIAL_OFFICE_CONFIG));
  },
};
