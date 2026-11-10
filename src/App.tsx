import { useState, useEffect, useCallback } from 'react';
import { AuthPage } from './components/auth/AuthPage.tsx';
import { AppShell } from './components/layout/AppShell.tsx';
import { NeoBrutalistDashboard } from './components/dashboard/NeoBrutalistDashboard.tsx';
import { AdminDashboard } from './components/admin/AdminDashboard.tsx';
import { AdminEmployeeManagement } from './components/admin/AdminEmployeeManagement.tsx';
import { AttendanceClockTab } from './components/attendance/AttendanceClockTab.tsx';
import { AttendanceHistory } from './components/attendance/AttendanceHistory.tsx';
import { LeaveManagement } from './components/leave/LeaveManagement.tsx';
import { MyLeaveRequests } from './components/leave/MyLeaveRequests.tsx';
import { TeamLeaveApprovals } from './components/leave/TeamLeaveApprovals.tsx';
import { KanbanBoard } from './components/tasks/KanbanBoard.tsx';
import { MyTasks } from './components/tasks/MyTasks.tsx';
import { TeamTaskManagement } from './components/tasks/TeamTaskManagement.tsx';
import { EmployeeBiodata } from './components/profile/EmployeeBiodata.tsx';
import { ChatRoom } from './components/chat/ChatRoom.tsx';
import { OfficeSettingsModal } from './components/admin/OfficeSettingsModal.tsx';
import { LocationGeofencePage } from './components/admin/LocationGeofencePage.tsx';
import { ClockInOutModal } from './components/attendance/ClockInOutModal.tsx';
import { CompleteProfileModal } from './components/employee/CompleteProfileModal.tsx';
import { PendingApprovalScreen } from './components/auth/PendingApprovalScreen.tsx';
import { ModernConfirmDialog } from './components/common/ModernConfirmDialog.tsx';
import { AppStorage } from './lib/storage.ts';
import { ApiClient } from './lib/api-client.ts';
import { getApprovedLeaveForDate, isOffCategory } from './lib/attendance-status.ts';
import { getCurrentDateString, getCurrentTimeString, calculateClockInPunctuality, calculateWorkDurationMinutes } from './lib/time-utils.ts';
import { calculateHaversineDistance } from './lib/geo-utils.ts';
import { saveAttendanceWithOfflineSupport } from './lib/offline-sync.ts';
import { User, OfficeConfig, AttendanceRecord, LeaveRequest, TaskItem, DailyTaskLog, UserRole, ChatTopic, ChatComment, safeParseJsonArray } from './types/index.ts';

export default function App() {
  const [sessionUser, setSessionUser] = useState<User | null>(() => AppStorage.getSessionUser());
  const [users, setUsers] = useState<User[]>([]);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [officeConfig, setOfficeConfig] = useState<OfficeConfig | null>(null);
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [leaves, setLeaves] = useState<LeaveRequest[]>([]);
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [showSettingsModal, setShowSettingsModal] = useState<boolean>(false);
  const [showResetAppModal, setShowResetAppModal] = useState<boolean>(false);
  const [accessDeniedMessage, setAccessDeniedMessage] = useState<string | null>(null);
  const [isClockInModalOpen, setIsClockInModalOpen] = useState<boolean>(false);

  // Muat state dari persistent local storage
  const loadData = useCallback(() => {
    const loadedUsers = AppStorage.getUsers();
    // Deduplikasi users: utamakan akun ACTIVE agar jika ada antrean pending lama dengan nama/email sama langsung tertimpa
    const sorted = [...loadedUsers].sort((a, b) => {
      if (a.status === 'ACTIVE' && b.status !== 'ACTIVE') return -1;
      if (a.status !== 'ACTIVE' && b.status === 'ACTIVE') return 1;
      return 0;
    });
    const dedupedUsers: User[] = [];
    const seen = new Set<string>();
    const seenNames = new Set<string>();
    for (const u of sorted) {
      const emailKey = u.email ? u.email.trim().toLowerCase() : '';
      const nameKey = u.name ? u.name.trim().toLowerCase() : '';
      const idKey = u.id;
      if (emailKey && seen.has(emailKey)) continue;
      if (nameKey && seenNames.has(nameKey)) continue;
      if (idKey && seen.has(idKey)) continue;

      if (emailKey) seen.add(emailKey);
      if (nameKey) seenNames.add(nameKey);
      if (idKey) seen.add(idKey);
      dedupedUsers.push(u);
    }
    const curUser = AppStorage.getCurrentUser();
    const loadedConfig = AppStorage.getOfficeConfig();
    const loadedRecords = AppStorage.getAttendanceRecords();
    const loadedLeaves = AppStorage.getLeaveRequests();
    const loadedTasks = AppStorage.getTasks();

    setUsers(dedupedUsers);
    setSessionUser(AppStorage.getSessionUser());
    setCurrentUser(curUser);
    setOfficeConfig(loadedConfig);
    setRecords(loadedRecords);
    setLeaves(loadedLeaves);
    setTasks(loadedTasks);
  }, []);

  // Sinkronisasi data dari backend API (MySQL di server VPS)
  const syncWithBackend = useCallback(async () => {
    try {
      const token = ApiClient.getToken();
      if (!token) return;

      // 1. Ambil data users dari server
      const serverUsers = await ApiClient.getUsers().catch(() => null);
      if (Array.isArray(serverUsers) && serverUsers.length > 0) {
        const localUsers = AppStorage.getUsers();
        const serverUserIds = new Set(serverUsers.map((su) => su.id));
        const serverUserEmails = new Set(serverUsers.map((su) => (su.email || '').toLowerCase()));

        // Prune users yang sudah dihapus dari database server
        const validLocalUsers = localUsers.filter((u) => {
          if (u.id === 'usr_super_admin' || u.role === 'SUPER_ADMIN') return true;
          return serverUserIds.has(u.id) || serverUserEmails.has((u.email || '').toLowerCase());
        });

        const mergedUsers = [...validLocalUsers];
        for (const su of serverUsers) {
          // Proteksi: usr_super_admin hanya boleh dicocokkan dengan usr_super_admin, tidak boleh tertimpa pendaftar lain
          const idx = mergedUsers.findIndex((u) => {
            if (su.id === 'usr_super_admin') return u.id === 'usr_super_admin';
            if (u.id === 'usr_super_admin') return false;
            return u.id === su.id || (u.email && su.email && u.email.toLowerCase() === su.email.toLowerCase());
          });
          const existingLocal = idx >= 0 ? mergedUsers[idx] : null;
          const mappedRole =
            su.id === 'usr_super_admin'
              ? 'SUPER_ADMIN'
              : ((su.role || su.peran || (existingLocal ? existingLocal.role : 'EMPLOYEE')) as UserRole);
          const mappedStatus =
            su.id === 'usr_super_admin'
              ? 'ACTIVE'
              : (su.status || (existingLocal ? existingLocal.status : 'ACTIVE'));

          const mappedUser: User = {
            id: su.id,
            name: su.name || su.nama || (existingLocal ? existingLocal.name : ''),
            email: su.email || (existingLocal ? existingLocal.email : ''),
            role: mappedRole,
            status: mappedStatus,
            employmentType: su.employment_type || su.tipe_kepegawaian || (existingLocal ? existingLocal.employmentType : 'CONTRACT'),
            department: su.department || su.divisi || (existingLocal ? existingLocal.department : 'Operasional'),
            position: su.position || su.jabatan || (existingLocal ? existingLocal.position : 'Staf'),
            avatar: su.avatar || su.foto_profil || (existingLocal ? existingLocal.avatar : '') || '',
            phone: su.phone || su.nomor_telepon || (existingLocal ? existingLocal.phone : '') || '',
            gender: (su.gender || su.jenis_kelamin || (existingLocal ? existingLocal.gender : 'L')) as 'L' | 'P',
            birthDate: su.birthDate || su.birth_date || su.tanggal_lahir || (existingLocal ? existingLocal.birthDate : '2000-01-01'),
            joinDate: su.join_date || su.tanggal_bergabung || (existingLocal ? existingLocal.joinDate : '') || '',
            leaveBalance: su.leave_balance ?? su.sisa_cuti ?? (existingLocal ? existingLocal.leaveBalance : 12),
            bankName: su.bank_name || su.nama_bank || (existingLocal ? existingLocal.bankName : '') || '',
            bankAccountNumber: su.bank_account_number || su.nomor_rekening || (existingLocal ? existingLocal.bankAccountNumber : '') || '',
            bankAccountHolder: su.bank_account_holder || su.nama_pemilik_rekening || (existingLocal ? existingLocal.bankAccountHolder : '') || '',
            emergencyContactName: su.emergency_contact_name || su.nama_kontak_darurat || (existingLocal ? existingLocal.emergencyContactName : '') || '',
            emergencyContactPhone: su.emergency_contact_phone || su.nomor_kontak_darurat || (existingLocal ? existingLocal.emergencyContactPhone : '') || '',
            address: su.address || su.alamat || (existingLocal ? existingLocal.address : '') || '',
            registeredAt: su.registered_at || su.waktu_daftar || (existingLocal ? existingLocal.registeredAt : '') || '',
            isProfileComplete: Boolean(
              su.is_profile_complete ??
              su.profil_lengkap ??
              (existingLocal ? existingLocal.isProfileComplete : false)
            ),
          };
          if (idx >= 0) {
            mergedUsers[idx] = { ...mergedUsers[idx], ...mappedUser };
          } else {
            mergedUsers.push(mappedUser);
          }
        }

        // Deduplikasi users agar tidak ada akun ganda di seluruh aplikasi (utamakan akun ACTIVE jika ada duplikat)
        mergedUsers.sort((a, b) => {
          if (a.status === 'ACTIVE' && b.status !== 'ACTIVE') return -1;
          if (a.status !== 'ACTIVE' && b.status === 'ACTIVE') return 1;
          return 0;
        });

        const dedupedMerged: User[] = [];
        const seenEmails = new Set<string>();
        const seenNames = new Set<string>();
        const seenIds = new Set<string>();

        for (const u of mergedUsers) {
          const uId = u.id;
          const emailKey = u.email ? u.email.trim().toLowerCase() : '';
          const nameKey = u.name ? u.name.trim().toLowerCase() : '';

          if (uId && seenIds.has(uId)) continue;
          if (emailKey && seenEmails.has(emailKey)) continue;
          if (nameKey && seenNames.has(nameKey)) continue;

          if (uId) seenIds.add(uId);
          if (emailKey) seenEmails.add(emailKey);
          if (nameKey) seenNames.add(nameKey);

          dedupedMerged.push(u);
        }
        AppStorage.saveUsers(dedupedMerged);
        setUsers(dedupedMerged);

        // Jika user yang sedang login mengalami update status atau tipe kepegawaian (misal di-update admin di device lain), perbarui otomatis
        const activeUser = AppStorage.getSessionUser() || AppStorage.getCurrentUser();
        const activeUserId = activeUser?.id;
        const activeUserEmail = activeUser?.email ? activeUser.email.trim().toLowerCase() : '';
        if (activeUserId || activeUserEmail) {
          const freshCurrent = dedupedMerged.find(
            (u) =>
              (activeUserId && u.id === activeUserId) ||
              (activeUserEmail && u.email && u.email.trim().toLowerCase() === activeUserEmail)
          );
          if (freshCurrent) {
            setCurrentUser(freshCurrent);
            setSessionUser(freshCurrent);
            AppStorage.saveCurrentUser(freshCurrent);
          } else if (activeUserId !== 'usr_super_admin') {
            // User sudah dihapus oleh Super Admin
            handleLogout();
          }
        }
      }

      // 2. Ambil data perizinan dari server
      const serverLeaves = await ApiClient.getLeaves().catch(() => null);
      if (Array.isArray(serverLeaves) && serverLeaves.length > 0) {
        const localLeaves = AppStorage.getLeaveRequests();
        const mergedLeaves = [...localLeaves];
        for (const sl of serverLeaves) {
          const mappedLeave: LeaveRequest = {
            id: sl.id,
            userId: sl.user_id || sl.pengguna_id || sl.userId,
            userName: sl.user_name || sl.nama_karyawan || sl.userName || '',
            userAvatar: sl.user_avatar || sl.foto_karyawan || '',
            department: sl.department || sl.divisi || 'Operasional',
            employmentType: sl.employment_type || sl.tipe_kepegawaian || 'CONTRACT',
            category: (sl.category || sl.kategori_izin || 'LEAVE') as any,
            startDate: sl.start_date || sl.tanggal_mulai || sl.startDate,
            endDate: sl.end_date || sl.tanggal_selesai || sl.endDate,
            totalDays: sl.total_days || sl.jumlah_hari || 1,
            reason: sl.reason || sl.alasan || '',
            attachmentName: sl.attachment_name || sl.nama_lampiran,
            attachmentData: sl.attachment_data || sl.data_lampiran,
            attachmentType: sl.attachment_type || sl.tipe_lampiran,
            status: sl.status || sl.status_pengajuan || 'PENDING',
            appliedAt: sl.applied_at || sl.waktu_pengajuan || sl.appliedAt || '',
            reviewedBy: sl.reviewed_by || sl.disetujui_oleh,
            reviewedAt: sl.reviewed_at || sl.waktu_persetujuan,
            rejectionReason: sl.rejection_reason || sl.alasan_penolakan,
          };
          const idx = mergedLeaves.findIndex(
            (l) => l.id === sl.id || (l.userId === mappedLeave.userId && l.startDate === mappedLeave.startDate && l.category === mappedLeave.category)
          );
          if (idx >= 0) {
            mergedLeaves[idx] = { ...mergedLeaves[idx], ...mappedLeave };
          } else {
            mergedLeaves.push(mappedLeave);
          }
        }
        AppStorage.saveLeaves(mergedLeaves);
        setLeaves(mergedLeaves);
      }

      // 3. Ambil data presensi dari server
      const serverAtt = await ApiClient.getAttendance().catch(() => null);
      if (Array.isArray(serverAtt) && serverAtt.length > 0) {
        const localAtt = AppStorage.getAttendanceRecords();
        const mergedAtt = [...localAtt];
        for (const sa of serverAtt) {
          const mappedAtt: AttendanceRecord = {
            id: sa.id,
            userId: sa.user_id || sa.pengguna_id || sa.userId,
            userName: sa.user_name || sa.nama_karyawan || sa.userName || '',
            userAvatar: sa.user_avatar || sa.foto_karyawan || sa.userAvatar || '',
            department: sa.department || sa.divisi || 'Operasional',
            employmentType: sa.employment_type || sa.tipe_kepegawaian || 'CONTRACT',
            date: sa.date || sa.tanggal,
            clockInTime: sa.clock_in_time || sa.jam_masuk || '',
            clockInLat: sa.clock_in_lat ?? sa.latitude ?? 0,
            clockInLng: sa.clock_in_lng ?? sa.longitude ?? 0,
            clockInDistanceMeter: sa.clock_in_distance_meter ?? sa.jarak_meter ?? 0,
            clockInLocationStatus: sa.clock_in_location_status || sa.status_lokasi || 'IN_OFFICE',
            clockInStatus: sa.clock_in_status || sa.status_kehadiran || 'ON_TIME',
            clockInLateMinutes: sa.clock_in_late_minutes ?? sa.menit_keterlambatan ?? 0,
            workMode: sa.work_mode || sa.mode_kerja || 'WFO',
            notes: sa.notes || sa.catatan || '',
            syncStatus: 'SYNCED',
          };
          const idx = mergedAtt.findIndex(
            (a) => a.id === sa.id || (a.userId === mappedAtt.userId && a.date === mappedAtt.date)
          );
          if (idx >= 0) {
            mergedAtt[idx] = { ...mergedAtt[idx], ...mappedAtt };
          } else {
            mergedAtt.push(mappedAtt);
          }
        }
        AppStorage.saveAttendanceRecords(mergedAtt);
        setRecords(mergedAtt);
      }

      // 4. Ambil data tugas Kanban dari server
      const serverTasks = await ApiClient.getKanbanTasks().catch(() => null);
      if (Array.isArray(serverTasks)) {
        const localTasks = AppStorage.getTasks();
        const serverTaskIds = new Set(serverTasks.map((st) => String(st.id)));
        const deletedIds = new Set(AppStorage.getDeletedTaskIds());

        // Prune tugas yang telah dihapus oleh PIC di server:
        // Tugas lokal yang tidak ada lagi di serverTasks otomatis dibersihkan dari layar pelaksana
        const validLocalTasks = localTasks.filter((t) => {
          const tId = String(t.id);
          if (deletedIds.has(tId)) return false;
          if (!serverTaskIds.has(tId)) {
            const isVeryRecent =
              t.id.startsWith('task_') &&
              Date.now() - parseInt(t.id.split('_')[1] || '0', 10) < 10000;
            if (!isVeryRecent) return false;
          }
          return true;
        });

        const mergedTasks = [...validLocalTasks];
        for (const st of serverTasks) {
          if (deletedIds.has(String(st.id))) continue;
          const idx = mergedTasks.findIndex((t) => String(t.id) === String(st.id));
          const existingTask = idx >= 0 ? mergedTasks[idx] : null;
          const serverAttachments = Array.isArray(st.attachments) && st.attachments.length > 0
            ? st.attachments
            : (Array.isArray(st.lampiran) && st.lampiran.length > 0 ? st.lampiran : []);

          const mappedTask: TaskItem = {
            id: String(st.id),
            title: st.title || st.judul_tugas || '',
            description: st.description || st.deskripsi || '',
            status: st.status || st.status_tugas || 'TODO',
            priority: st.priority || st.prioritas || 'MEDIUM',
            assignedTo: st.assigned_to || st.ditugaskan_ke || '',
            assignedName: st.assigned_name || st.nama_petugas || '',
            assignedAvatar: st.assigned_avatar || st.foto_petugas || '',
            tags: Array.isArray(st.tags) ? st.tags : [],
            assignees: Array.isArray(st.assignees) ? st.assignees : (st.daftar_anggota || []),
            dueDate: st.due_date || st.tenggat_waktu || '',
            createdBy: st.created_by || st.dibuat_oleh || 'usr_super_admin',
            createdAt: st.created_at || (existingTask?.createdAt || ''),
            updatedAt: st.updated_at || (existingTask?.updatedAt || ''),
            activities: Array.isArray(st.activities) && st.activities.length > 0 ? st.activities : (existingTask?.activities || []),
            attachments: serverAttachments.length > 0 ? serverAttachments : (existingTask?.attachments || []),
            reviewNotes: st.review_notes || existingTask?.reviewNotes,
            submissionNotes: st.submission_notes || existingTask?.submissionNotes,
          };
          if (idx >= 0) {
            mergedTasks[idx] = { ...mergedTasks[idx], ...mappedTask };
          } else {
            mergedTasks.push(mappedTask);
          }
        }
        mergedTasks.sort((a, b) => {
          const timeA = a.createdAt || '';
          const timeB = b.createdAt || '';
          if (timeA !== timeB) return timeB.localeCompare(timeA);
          return (b.id || '').localeCompare(a.id || '');
        });
        AppStorage.saveTasks(mergedTasks);
        setTasks(mergedTasks);
      }

      // 4b. Ambil data logbook harian dari server (agar semua akun dapat saling melihat)
      const serverLogs = await ApiClient.getDailyLogs().catch(() => null);
      if (Array.isArray(serverLogs) && serverLogs.length > 0) {
        const localLogs = AppStorage.getDailyTasks();
        const mergedLogs = [...localLogs];
        for (const sl of serverLogs) {
          const mappedTasks = Array.isArray(sl.tasks)
            ? sl.tasks
            : (Array.isArray(sl.daftar_tugas) ? sl.daftar_tugas : []);
          const uId = sl.userId || sl.pengguna_id || sl.user_id;
          const tDate = sl.date || sl.tanggal;
          if (!uId || !tDate) continue;
          const idx = mergedLogs.findIndex(
            (l) => (l.id && l.id === sl.id) || (l.userId === uId && l.date === tDate)
          );
          const mappedLog: DailyTaskLog = {
            id: sl.id ? String(sl.id) : `dt_${uId}_${tDate}`,
            userId: uId,
            userName: sl.userName || sl.nama_karyawan || sl.user_name || '',
            date: tDate,
            tasks: mappedTasks,
            notes: sl.notes || sl.catatan || '',
            submittedAt: sl.submittedAt || sl.created_at || '',
            updatedAt: sl.updatedAt || sl.updated_at || '',
          };
          if (idx >= 0) {
            mergedLogs[idx] = { ...mergedLogs[idx], ...mappedLog };
          } else {
            mergedLogs.push(mappedLog);
          }
        }
        AppStorage.saveDailyTasks(mergedLogs);
      }

      // 5. Ambil data ruang obrolan / topik chat dari server
      const serverTopics = await ApiClient.getChatTopics().catch(() => null);
      if (Array.isArray(serverTopics) && serverTopics.length > 0) {
        const localTopics = AppStorage.getChatTopics();
        const mergedTopics = [...localTopics];
        for (const st of serverTopics) {
          const idx = mergedTopics.findIndex((t) => t.id === st.id);
          const mappedComments: ChatComment[] = Array.isArray(st.comments)
            ? st.comments.map((c: any) => ({
                id: c.id,
                topicId: c.topicId || c.topik_id || st.id,
                userId: c.userId || c.pengguna_id || '',
                userName: c.userName || c.nama_pengirim || '',
                userAvatar: c.userAvatar || c.foto_pengirim || '',
                userRole: c.userRole || c.peran_pengirim || 'EMPLOYEE',
                timestamp: c.timestamp || c.waktu_kirim || '',
                notes: c.notes || c.isi_pesan || '',
                attachments: Array.isArray(c.attachments) ? c.attachments : (Array.isArray(c.lampiran) ? c.lampiran : []),
                type: 'COMMENT' as const,
              }))
            : (idx >= 0 ? mergedTopics[idx].comments : []);

          const mappedTopic: ChatTopic = {
            id: st.id,
            title: st.title || st.judul_topik || '',
            status: (st.status || st.status_topik || 'NEED_COMMENTS') as any,
            taggedTeammateIds: safeParseJsonArray(st.taggedTeammateIds ?? st.id_anggota_ditandai ?? st.tagged_teammate_ids),
            files: Array.isArray(st.files) ? st.files : (Array.isArray(st.berkas) ? st.berkas : []),
            links: Array.isArray(st.links) ? st.links : (Array.isArray(st.tautan) ? st.tautan : []),
            images: Array.isArray(st.images) ? st.images : (Array.isArray(st.gambar) ? st.gambar : []),
            shortNotes: st.shortNotes || st.short_notes || st.catatan_singkat || '',
            longNotes: st.longNotes || st.long_notes || st.catatan_lengkap || '',
            createdBy: st.createdBy || st.created_by || st.dibuat_oleh_id || '',
            createdByName: st.createdByName || st.created_by_name || st.dibuat_oleh_nama || '',
            createdByAvatar: st.createdByAvatar || st.created_by_avatar || st.dibuat_oleh_foto || '',
            comments: mappedComments,
            createdAt: st.createdAt || st.created_at || '',
            updatedAt: st.updatedAt || st.updated_at || '',
          };
          if (idx >= 0) {
            mergedTopics[idx] = { ...mergedTopics[idx], ...mappedTopic };
          } else {
            mergedTopics.push(mappedTopic);
          }
        }
        mergedTopics.sort((a, b) => {
          const timeA = a.updatedAt || a.createdAt || '';
          const timeB = b.updatedAt || b.createdAt || '';
          if (timeA !== timeB) return timeB.localeCompare(timeA);
          return (b.id || '').localeCompare(a.id || '');
        });
        AppStorage.saveChatTopics(mergedTopics);
        window.dispatchEvent(new CustomEvent('absenku:chat_updated'));
      }

      // 6. Ambil konfigurasi kantor dari server
      const serverConfig = await ApiClient.getOfficeConfig().catch(() => null);
      if (serverConfig && (serverConfig.name || serverConfig.nama_kantor)) {
        const mappedCfg: OfficeConfig = {
          name: serverConfig.name || serverConfig.nama_kantor,
          address: serverConfig.address || serverConfig.alamat_kantor,
          latitude: serverConfig.latitude,
          longitude: serverConfig.longitude,
          geofenceRadiusMeter: serverConfig.geofence_radius_meter || serverConfig.radius_geofence_meter,
          workStartHour: serverConfig.work_start_hour || serverConfig.jam_masuk,
          workEndHour: serverConfig.work_end_hour || serverConfig.jam_pulang,
          gracePeriodMinutes: serverConfig.grace_period_minutes || serverConfig.toleransi_keterlambatan_menit,
          isGeofenceActive: serverConfig.is_geofence_active ?? serverConfig.status_geofence_aktif ?? true,
        };
        AppStorage.updateOfficeConfig(mappedCfg);
        setOfficeConfig(mappedCfg);
      }

      loadData();
    } catch {
      // offline / abaikan jika jaringan tidak stabil
    }
  }, [loadData]);

  // Muat data awal saat pertama dibuka & dengarkan perubahan perizinan/storage/sinkronisasi
  useEffect(() => {
    loadData();
    syncWithBackend();

    const handleSync = () => {
      loadData();
      syncWithBackend();
    };

    window.addEventListener('absenku:leaves_updated', handleSync);
    window.addEventListener('absenku:tasks_updated', handleSync);
    window.addEventListener('absenku:users_updated', handleSync);
    window.addEventListener('absenku:attendance_updated', handleSync);
    window.addEventListener('storage', handleSync);

    // Auto-sync berkala setiap 5 detik agar multi-device (Laptop & HP) selalu up-to-date realtime
    const timer = setInterval(() => {
      syncWithBackend();
    }, 5000);

    return () => {
      window.removeEventListener('absenku:leaves_updated', handleSync);
      window.removeEventListener('absenku:tasks_updated', handleSync);
      window.removeEventListener('absenku:users_updated', handleSync);
      window.removeEventListener('absenku:attendance_updated', handleSync);
      window.removeEventListener('storage', handleSync);
      clearInterval(timer);
    };
  }, [loadData, syncWithBackend]);

  // Handler reset presensi hari ini
  const handleResetTodayAttendance = () => {
    AppStorage.clearTodayAttendance();
    loadData();
  };

  // Handler hapus seluruh histori presensi
  const handleClearAllAttendance = () => {
    AppStorage.clearAllAttendance();
    loadData();
  };

  // Handler pergantian akun aktif (Admin vs Karyawan)
  const handleSwitchUser = (userId: string) => {
    AppStorage.setCurrentUserId(userId);
    setActiveTab('dashboard');
    loadData();
  };

  const handleUpdateEmployeeRole = async (userId: string, newRole: UserRole) => {
    const targetUser = users.find((u) => u.id === userId);
    AppStorage.updateUserRole(userId, newRole);
    if (currentUser && currentUser.id === userId) {
      const updatedUser: User = { ...currentUser, role: newRole };
      AppStorage.updateUser(updatedUser);
      setCurrentUser(updatedUser);
      setSessionUser(updatedUser);
    }
    setUsers((prev) =>
      prev.map((u) => (u.id === userId || (targetUser?.email && u.email?.toLowerCase() === targetUser.email.toLowerCase()) ? { ...u, role: newRole } : u))
    );
    loadData();

    try {
      await ApiClient.updateUserRole(userId, newRole, targetUser?.email);
    } catch (err) {
      console.warn('Gagal update role ke backend:', err);
    }
    syncWithBackend();
  };

  // Handler Logout
  const handleLogout = () => {
    AppStorage.clearSession();
    setActiveTab('dashboard');
    setSessionUser(null);
  };

  // Sinkronisasi tab saat login/berganti akun berdasarkan Hierarki RBAC:
  // - Super Admin: Memiliki kontrol tertinggi termasuk 'settings' (Lokasi Kantor & Radius Geofence)
  // - Admin Operasional: Mengelola persetujuan izin, tugas, rekap absensi, & data karyawan (TANPA 'settings')
  // - Karyawan: Presensi, log tugas, riwayat pribadi, & pengajuan izin
  useEffect(() => {
    if (currentUser) {
      const superAdminTabs = ['dashboard', 'clock', 'history', 'tasks_team', 'tasks_my', 'tasks', 'chat_room', 'chat', 'leaves_approval', 'leaves_my', 'leaves', 'employees', 'employee_approvals', 'profile', 'settings'];
      const adminTabs = ['dashboard', 'clock', 'leaves_my', 'leaves_approval', 'leaves', 'tasks_my', 'tasks_team', 'tasks', 'chat_room', 'chat', 'history', 'employees', 'employee_approvals', 'profile'];
      const employeeTabs = ['dashboard', 'clock', 'leaves_my', 'leaves', 'tasks_my', 'tasks', 'chat_room', 'chat', 'history', 'profile'];

      const validTabs =
        currentUser.role === 'SUPER_ADMIN'
          ? superAdminTabs
          : currentUser.role === 'ADMIN'
          ? adminTabs
          : employeeTabs;

      if (!validTabs.includes(activeTab)) {
        setActiveTab('dashboard');
      }
    }
  }, [currentUser, activeTab]);

  // Handler reset data aplikasi
  const handleResetData = () => {
    setShowResetAppModal(true);
  };

  const executeResetData = () => {
    AppStorage.resetToDefault();
    loadData();
  };

  const handleSaveOfficeConfig = (newCfg: OfficeConfig) => {
    AppStorage.updateOfficeConfig(newCfg);
    setShowSettingsModal(false);
    loadData();
  };

  // Handler CRUD Karyawan (Admin Only)
  const handleAddEmployee = (_newUser: User) => {
    loadData();
  };

  const handleUpdateEmployee = (updatedUser: User) => {
    AppStorage.updateUser(updatedUser);
    loadData();
  };

  const handleUpdateAttendanceRecord = (updatedRecord: AttendanceRecord) => {
    AppStorage.saveAttendanceRecord(updatedRecord);
    loadData();
  };

  const handleDeleteEmployee = async (userId: string) => {
    // 1. Update state dan localStorage langsung agar UI seketika terupdate tanpa delay
    AppStorage.deleteUser(userId);
    setUsers((prev) => prev.filter((u) => u.id !== userId));
    loadData();

    // 2. Kirim perintah DELETE ke server backend
    try {
      await ApiClient.deleteUser(userId);
    } catch (e: any) {
      console.warn('Gagal menghapus user dari server backend:', e);
      const msg = e?.message || 'Gagal menghapus karyawan dari server database.';
      setAccessDeniedMessage(msg);
    }

    // 3. Sinkronisasi ulang dengan backend
    syncWithBackend();
  };

  const handlePurgeAllExceptSuperAdmin = () => {
    AppStorage.purgeAllExceptSuperAdmin();
    const freshUser = AppStorage.getCurrentUser();
    if (freshUser) {
      setCurrentUser(freshUser);
      setSessionUser(freshUser);
    }
    loadData();
    setActiveTab('employees');
  };

  // Handler ACC Izin Cuti oleh Admin
  const handleApproveLeave = (leaveId: string) => {
    if (!currentUser) return;
    AppStorage.updateLeaveStatus(leaveId, 'APPROVED', currentUser.name);
    loadData();
  };

  const handleRejectLeave = (leaveId: string, reason: string) => {
    if (!currentUser) return;
    AppStorage.updateLeaveStatus(leaveId, 'REJECTED', currentUser.name, reason);
    loadData();
  };

  const handleDeleteLeave = async (leaveId: string) => {
    AppStorage.deleteLeaveRequest(leaveId);
    loadData();
    try {
      await ApiClient.deleteLeave(leaveId);
    } catch (e) {
      console.warn('Gagal menghapus izin dari server:', e);
    }
    syncWithBackend();
  };

  // Handler ACC Review Tugas oleh Admin
  const handleApproveTask = (taskId: string, reviewNotes: string) => {
    AppStorage.updateTaskStatus(taskId, 'REVIEWED', { reviewNotes });
    loadData();
  };

  const handleRequestTaskRevision = (taskId: string, revisionNotes: string) => {
    AppStorage.updateTaskStatus(taskId, 'IN_PROGRESS', { reviewNotes: revisionNotes });
    loadData();
  };

  const handleDeleteTask = (taskId: string) => {
    AppStorage.deleteTask(taskId);
    loadData();
  };

  // Handler ACC Pendaftaran Akun Baru oleh Admin / Super Admin
  const handleApproveRegistration = async (userId: string, targetRole?: UserRole) => {
    if (!currentUser) return;
    const targetUser = users.find((u) => u.id === userId);
    const finalRole = targetRole || targetUser?.role || 'EMPLOYEE';
    AppStorage.approveRegistration(userId, currentUser.name, finalRole);
    AppStorage.updateUserRole(userId, finalRole);
    setUsers((prev) =>
      prev.map((u) => (u.id === userId || (targetUser?.email && u.email?.toLowerCase() === targetUser.email.toLowerCase()) ? { ...u, status: 'ACTIVE', role: finalRole } : u))
    );
    loadData();

    try {
      await ApiClient.approveUser(userId, finalRole, targetUser?.email);
      await ApiClient.updateUserRole(userId, finalRole, targetUser?.email);
    } catch (err) {
      console.warn('Gagal sinkron approval akun ke server:', err);
    }
    syncWithBackend();
  };

  const handleRejectRegistration = async (userId: string) => {
    AppStorage.rejectRegistration(userId);
    setUsers((prev) => prev.filter((u) => u.id !== userId));
    loadData();

    try {
      await ApiClient.deleteUser(userId);
    } catch {
      await ApiClient.rejectUser(userId).catch(() => {});
    }

    syncWithBackend();
  };

  // Handler Pengisian Wajib Data Diri Karyawan Baru
  const handleCompleteProfile = async (updatedUser: User) => {
    AppStorage.updateUser(updatedUser);
    setCurrentUser(updatedUser);
    setSessionUser(updatedUser);

    try {
      await ApiClient.updateProfile({
        id: updatedUser.id,
        user_id: updatedUser.id,
        email: updatedUser.email,
        current_email: updatedUser.email,
        name: updatedUser.name,
        nama: updatedUser.name,
        gender: updatedUser.gender,
        jenis_kelamin: updatedUser.gender,
        birthDate: updatedUser.birthDate,
        birth_date: updatedUser.birthDate,
        tanggal_lahir: updatedUser.birthDate,
        department: updatedUser.department,
        divisi: updatedUser.department,
        position: updatedUser.position,
        jabatan: updatedUser.position,
        employment_type: updatedUser.employmentType,
        tipe_kepegawaian: updatedUser.employmentType,
        avatar: updatedUser.avatar,
        foto_profil: updatedUser.avatar,
        phone: updatedUser.phone,
        nomor_telepon: updatedUser.phone,
        address: updatedUser.address,
        alamat: updatedUser.address,
        bank_name: updatedUser.bankName,
        nama_bank: updatedUser.bankName,
        bank_account_number: updatedUser.bankAccountNumber,
        nomor_rekening: updatedUser.bankAccountNumber,
        bank_account_holder: updatedUser.bankAccountHolder,
        nama_pemilik_rekening: updatedUser.bankAccountHolder,
        emergency_contact_name: updatedUser.emergencyContactName,
        nama_kontak_darurat: updatedUser.emergencyContactName,
        emergency_contact_phone: updatedUser.emergencyContactPhone,
        nomor_kontak_darurat: updatedUser.emergencyContactPhone,
        is_profile_complete: true,
        profil_lengkap: true,
      });
    } catch (err) {
      console.warn('Gagal update biodata ke server:', err);
    }

    loadData();
    syncWithBackend();
  };

  // Auto-detect pergantian hari (00.01 Pagi / lewat tengah malam) untuk mereset tombol presensi masuk otomatis
  useEffect(() => {
    let lastDate = getCurrentDateString();
    const timer = setInterval(() => {
      const currentDate = getCurrentDateString();
      if (currentDate !== lastDate) {
        lastDate = currentDate;
        loadData(); // Memuat ulang data untuk tanggal baru dan mereset status presensi
      }
    }, 5000);

    return () => clearInterval(timer);
  }, [loadData]);

  // Handler Presensi Langsung (Tanpa Popup Modal) saat tombol diklik di beranda
  const handleDirectClockAction = () => {
    if (!currentUser || !officeConfig) return;

    const currentTime = getCurrentTimeString();
    const currentDate = getCurrentDateString();

    // HANYA BISA ABSEN SEKALI PER HARI (Jika sudah presensi masuk hari ini, hentikan)
    if (todayRecord?.clockInTime) {
      return;
    }

    const userLeaves = AppStorage.getLeaveRequests();
    const todayApprovedLeave = getApprovedLeaveForDate(
      userLeaves,
      { id: currentUser.id, name: currentUser.name },
      currentDate
    );
    const isOffToday = Boolean(todayApprovedLeave && isOffCategory(todayApprovedLeave.category));
    if (isOffToday) {
      alert(`Hari ini Anda berstatus OFF (${todayApprovedLeave?.category === 'SICK' ? 'Sakit' : 'Cuti / Izin'}) sehingga bebas presensi.`);
      return;
    }

    const punctuality = calculateClockInPunctuality(
      currentTime,
      officeConfig.workStartHour || '08:00',
      officeConfig.gracePeriodMinutes || 0
    );

    const executeSave = (lat: number, lng: number) => {
      const officeCoords = {
        latitude: officeConfig.latitude || -7.9439,
        longitude: officeConfig.longitude || 112.6322,
      };
      const dist = calculateHaversineDistance({ latitude: lat, longitude: lng }, officeCoords);
      const isGeofenceActive = officeConfig.isGeofenceActive ?? true;
      const radiusMeters = officeConfig.geofenceRadiusMeter || 100;
      const withinRadius = isGeofenceActive ? dist <= radiusMeters : true;

      const isWfhApproved = todayApprovedLeave?.category === 'WFH';
      const isBusinessTripApproved = todayApprovedLeave?.category === 'BUSINESS_TRIP';
      const isFreelance = currentUser.employmentType === 'FREELANCE';

      const locationStatus = isBusinessTripApproved
        ? 'DINAS_APPROVED'
        : isWfhApproved
        ? 'WFH_APPROVED'
        : withinRadius
        ? 'IN_OFFICE'
        : isFreelance
        ? 'WFH_APPROVED'
        : 'OUT_OF_RANGE';

      const effectiveWorkMode =
        locationStatus === 'DINAS_APPROVED'
          ? 'DINAS'
          : locationStatus === 'WFH_APPROVED'
          ? 'WFH'
          : isFreelance
          ? (withinRadius ? 'WFO' : 'WFH')
          : 'WFO';

      const newRecord: AttendanceRecord = {
        id: `att-${Date.now()}`,
        userId: currentUser.id,
        userName: currentUser.name,
        userAvatar: currentUser.avatar,
        department: currentUser.department,
        employmentType: currentUser.employmentType || 'CONTRACT',
        workMode: effectiveWorkMode,
        date: currentDate,
        clockInTime: currentTime,
        clockInLat: lat,
        clockInLng: lng,
        clockInDistanceMeter: dist,
        clockInLocationStatus: locationStatus,
        clockInStatus: punctuality.status,
        clockInLateMinutes: punctuality.lateMinutes,
      };

      saveAttendanceWithOfflineSupport(newRecord, 'CLOCK_IN');
      loadData();
    };

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => executeSave(pos.coords.latitude, pos.coords.longitude),
        () => executeSave(officeConfig.latitude || -7.978645, officeConfig.longitude || 112.630541),
        { timeout: 3000, enableHighAccuracy: true }
      );
    } else {
      executeSave(officeConfig.latitude || -7.978645, officeConfig.longitude || 112.630541);
    }
  };

  // JIKA BELUM LOGIN: TAMPILKAN AUTH GATEWAY (LOGIN / REGISTER KARYAWAN)
  if (!sessionUser) {
    return (
      <AuthPage
        onLoginSuccess={(loggedInUser) => {
          setActiveTab('dashboard'); // Selalu arahkan langsung ke halaman beranda saat login
          setSessionUser(loggedInUser);
          setCurrentUser(loggedInUser);
          loadData();
          syncWithBackend();
        }}
      />
    );
  }

  if (!currentUser || !officeConfig) {
    return (
      <div className="min-h-screen bg-[#F3F4F4] flex items-center justify-center p-4 text-slate-800">
        <div className="text-center space-y-4">
          <img
            src="/assets/in-time-logo.png"
            alt="in-Time indekraf presence system"
            className="h-10 w-auto mx-auto object-contain select-none"
          />
          <div className="w-7 h-7 border-2 border-[#1E3A8A] border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-xs font-semibold text-slate-500">Memuat Sesi Aplikasi...</p>
        </div>
      </div>
    );
  }

  const isAdmin = currentUser.role === 'ADMIN' || currentUser.role === 'SUPER_ADMIN';

  // Karyawan diarahkan ke form onboarding biodata HANYA jika akun belum aktif dan belum pernah mengisi biodata
  const isEmployeeProfileIncomplete =
    !isAdmin &&
    currentUser.status !== 'ACTIVE' &&
    currentUser.isProfileComplete !== true;

  // 1. JIKA KARYAWAN BELUM MELENGKAPI BIODATA DIRI: TAMPILKAN HALAMAN BIODATA DIRI SEBAGAI HALAMAN UTAMA
  if (isEmployeeProfileIncomplete) {
    return (
      <CompleteProfileModal
        currentUser={currentUser}
        onComplete={handleCompleteProfile}
        onLogout={handleLogout}
      />
    );
  }

  // 2. JIKA STATUS AKUN MASIH PENDING APPROVAL (Setelah biodata diisi, tampilkan Halaman Menyinkronkan Akun)
  if (currentUser.status === 'PENDING_APPROVAL') {
    return (
      <PendingApprovalScreen
        currentUser={currentUser}
        onApproved={(approvedUser) => {
          setCurrentUser(approvedUser);
          setSessionUser(approvedUser);
          loadData();
        }}
        onLogout={handleLogout}
      />
    );
  }

  const todayStr = getCurrentDateString();
  const todayRecord = records.find(
    (r) => r.userId === currentUser.id && r.date === todayStr
  );

  const pendingLeavesCount = leaves.filter((l) => l.status === 'PENDING').length;
  const pendingTasksCount = tasks.filter((t) => t.status === 'DONE').length;

  return (
    <>
      <AppShell
        currentUser={currentUser}
        users={users}
        officeConfig={officeConfig}
        activeTab={activeTab}
        todayRecord={todayRecord}
        onTabChange={(tab) => {
          if (tab === 'settings') {
            if (currentUser.role === 'SUPER_ADMIN') {
              setShowSettingsModal(true);
            } else {
              setAccessDeniedMessage('Akses Ditolak: Pengaturan Lokasi Kantor hanya dapat dikelola oleh Super Admin.');
            }
          } else {
            setActiveTab(tab);
          }
        }}
        onSwitchUser={handleSwitchUser}
        onResetData={handleResetData}
        onOpenSettingsModal={() => {
          if (currentUser.role === 'SUPER_ADMIN') {
            setShowSettingsModal(true);
          } else {
            setAccessDeniedMessage('Akses Ditolak: Pengaturan Lokasi Kantor hanya dapat dikelola oleh Super Admin.');
          }
        }}
        onLogout={handleLogout}
        pendingLeavesCount={pendingLeavesCount}
        pendingTasksCount={pendingTasksCount}
      >
        {/* ======================================================== */}
        {/* VIEW KONTROL KHUSUS ADMINISTRATOR */}
        {/* ======================================================== */}
        {isAdmin ? (
          <>
            {/* 1. Beranda Admin & Ringkasan Presensi Tim */}
            {activeTab === 'dashboard' && (
              <AdminDashboard
                currentUser={currentUser}
                users={users}
                records={records}
                leaves={leaves}
                tasks={tasks}
                officeConfig={officeConfig}
                onApproveLeave={handleApproveLeave}
                onRejectLeave={handleRejectLeave}
                onApproveRegistration={handleApproveRegistration}
                onRejectRegistration={handleRejectRegistration}
                onApproveTask={handleApproveTask}
                onRequestTaskRevision={handleRequestTaskRevision}
                onDeleteTask={handleDeleteTask}
                todayRecord={todayRecord}
                onOpenClockModal={() => setIsClockInModalOpen(true)}
                onNavigateTab={(tab) => setActiveTab(tab)}
                onOpenSettingsModal={() => setShowSettingsModal(true)}
                onUpdateUser={handleUpdateEmployee}
                onUpdateRole={handleUpdateEmployeeRole}
                onUpdateAttendanceRecord={handleUpdateAttendanceRecord}
                onRefreshData={loadData}
              />
            )}

            {/* Presensi Kamera WebCam & GPS Geofence (Admin / PM Operasional) */}
            {activeTab === 'clock' && (
              <AttendanceClockTab
                currentUser={currentUser}
                officeConfig={officeConfig}
                todayRecord={todayRecord}
                onRefreshData={loadData}
              />
            )}

            {/* 2. Pengajuan Izin Saya (Admin) */}
            {activeTab === 'leaves_my' && (
              <MyLeaveRequests
                currentUser={currentUser}
                leaves={leaves}
                onRefresh={loadData}
              />
            )}

            {/* 3. Persetujuan Izin Tim (Admin) */}
            {(activeTab === 'leaves_approval' || activeTab === 'leaves') && (
              <TeamLeaveApprovals
                currentUser={currentUser}
                leaves={leaves}
                onRefresh={loadData}
                onDelete={handleDeleteLeave}
              />
            )}

            {/* 4. Tugas Saya (Admin) */}
            {activeTab === 'tasks_my' && (
              <MyTasks
                tasks={tasks}
                users={users}
                currentUser={currentUser}
                userRole={currentUser.role}
                onRefresh={loadData}
              />
            )}

            {/* 5. Memberikan Tugas Tim (Admin) */}
            {(activeTab === 'tasks_team' || activeTab === 'tasks') && (
              <TeamTaskManagement
                tasks={tasks}
                users={users}
                currentUser={currentUser}
                userRole={currentUser.role}
                onRefresh={loadData}
              />
            )}

            {/* 6. Rekap Seluruh Presensi Staf */}
            {activeTab === 'history' && (
              <AttendanceHistory
                currentUser={currentUser}
                users={users}
                attendanceRecords={records}
                leaves={leaves}
                dailyTasks={AppStorage.getDailyTasks()}
                onUpdateRole={(uid, r) => {
                  const u = users.find(x => x.id === uid);
                  if (u) handleUpdateEmployee({ ...u, role: r });
                }}
                onUpdateType={(uid, t) => {
                  const u = users.find(x => x.id === uid);
                  if (u) handleUpdateEmployee({ ...u, employmentType: t });
                }}
                onToggleStatus={(uid) => {
                  const u = users.find(x => x.id === uid);
                  if (u) handleUpdateEmployee({ ...u, status: u.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE' });
                }}
                onUpdateRecord={handleUpdateAttendanceRecord}
                onClearAllAttendance={handleClearAllAttendance}
              />
            )}

            {/* Ruang Obrolan */}
            {(activeTab === 'chat_room' || activeTab === 'chat') && (
              <ChatRoom
                currentUser={currentUser}
                users={users}
                userRole={currentUser.role}
                onRefresh={loadData}
              />
            )}

            {/* 7. Kelola Karyawan (CRUD Data Karyawan & Persetujuan Akun Baru) */}
            {(activeTab === 'employees' || activeTab === 'employee_approvals') && (
              <AdminEmployeeManagement
                currentUser={currentUser}
                users={users}
                leaves={leaves}
                initialSubTab={activeTab === 'employee_approvals' ? 'APPROVALS' : 'EMPLOYEES'}
                onAddUser={handleAddEmployee}
                onUpdateUser={handleUpdateEmployee}
                onUpdateRole={handleUpdateEmployeeRole}
                onDeleteUser={handleDeleteEmployee}
                onApproveRegistration={handleApproveRegistration}
                onRejectRegistration={handleRejectRegistration}
                onPurgeAllExceptSuperAdmin={handlePurgeAllExceptSuperAdmin}
              />
            )}

            {/* 8. Biodata Diri Karyawan / Admin */}
            {activeTab === 'profile' && (
              <EmployeeBiodata
                currentUser={currentUser}
                onUserUpdated={(updatedUser) => {
                  setSessionUser(updatedUser);
                  setCurrentUser(updatedUser);
                  loadData();
                }}
              />
            )}

            {/* 9. Pengaturan Lokasi Kantor & Status Geofence Radar (Super Admin) */}
            {activeTab === 'settings' && (
              <LocationGeofencePage
                officeConfig={officeConfig}
                onSaveConfig={handleSaveOfficeConfig}
              />
            )}
          </>
        ) : (
          /* ======================================================== */
          /* VIEW KARYAWAN (PRESENSI, AJUKAN IZIN, MENGERJAKAN TUGAS) */
          /* ======================================================== */
          <>
            {/* 1. Dashboard Pribadi Karyawan */}
            {activeTab === 'dashboard' && (
              <NeoBrutalistDashboard
                currentUser={currentUser}
                users={users}
                officeConfig={officeConfig}
                todayRecord={todayRecord}
                records={records}
                tasks={tasks}
                leaves={leaves}
                onOpenClockModal={() => setIsClockInModalOpen(true)}
                onNavigateTab={(tab) => setActiveTab(tab)}
                onSwitchUser={handleSwitchUser}
                onResetTodayAttendance={handleResetTodayAttendance}
                onRefreshData={loadData}
              />
            )}

            {/* 2. Presensi Kamera WebCam & GPS Geofence */}
            {activeTab === 'clock' && (
              <AttendanceClockTab
                currentUser={currentUser}
                officeConfig={officeConfig}
                todayRecord={todayRecord}
                onRefreshData={loadData}
              />
            )}

            {/* 3. Riwayat Absensi Saya */}
            {activeTab === 'history' && (
              <AttendanceHistory
                currentUser={currentUser}
                users={users}
                attendanceRecords={records}
                leaves={leaves}
                dailyTasks={AppStorage.getDailyTasks()}
                onUpdateRecord={handleUpdateAttendanceRecord}
                onClearAllAttendance={handleClearAllAttendance}
              />
            )}

            {/* 4. Pengajuan Cuti / Izin Sakit Saya */}
            {(activeTab === 'leaves_my' || activeTab === 'leaves') && (
              <MyLeaveRequests
                currentUser={currentUser}
                leaves={leaves}
                onRefresh={loadData}
              />
            )}

            {/* 5. Tugas Saya */}
            {(activeTab === 'tasks_my' || activeTab === 'tasks') && (
              <MyTasks
                tasks={tasks}
                users={users}
                currentUser={currentUser}
                userRole={currentUser.role}
                onRefresh={loadData}
              />
            )}

            {/* Ruang Obrolan */}
            {(activeTab === 'chat_room' || activeTab === 'chat') && (
              <ChatRoom
                currentUser={currentUser}
                users={users}
                userRole={currentUser.role}
                onRefresh={loadData}
              />
            )}

            {/* 6. Biodata Diri Karyawan */}
            {activeTab === 'profile' && (
              <EmployeeBiodata
                currentUser={currentUser}
                onUserUpdated={(updatedUser) => {
                  setSessionUser(updatedUser);
                  setCurrentUser(updatedUser);
                  loadData();
                }}
              />
            )}
          </>
        )}
      </AppShell>

      {/* Clock In Modal Popup */}
      {isClockInModalOpen && (
        <ClockInOutModal
          type="CLOCK_IN"
          currentUser={currentUser}
          officeConfig={officeConfig}
          existingTodayRecord={todayRecord}
          onClose={() => setIsClockInModalOpen(false)}
          onSuccess={() => {
            setIsClockInModalOpen(false);
            loadData();
          }}
        />
      )}

      {/* Office Settings Modal (CRUD Master Kantor & Geofence) */}
      {showSettingsModal && (
        <OfficeSettingsModal
          currentConfig={officeConfig}
          onSave={handleSaveOfficeConfig}
          onClose={() => setShowSettingsModal(false)}
        />
      )}

      {/* Onboarding Wajib Isi Data Diri: Tetap muncul saat login dengan akun yang sama jika belum isi biodata */}
      {isEmployeeProfileIncomplete && (
        <CompleteProfileModal
          currentUser={currentUser}
          onComplete={handleCompleteProfile}
          onLogout={handleLogout}
        />
      )}

      {/* Dialog Akses Ditolak */}
      <ModernConfirmDialog
        isOpen={!!accessDeniedMessage}
        variant="warning"
        title="Akses Dibatasi"
        message={accessDeniedMessage || ''}
        confirmText="Mengerti"
        hideCancel={true}
        onConfirm={() => setAccessDeniedMessage(null)}
        onCancel={() => setAccessDeniedMessage(null)}
      />

      {/* Modern Confirm Dialog Reset Data Aplikasi */}
      <ModernConfirmDialog
        isOpen={showResetAppModal}
        variant="danger"
        title="Reset Seluruh Data Aplikasi"
        message="Apakah Anda yakin ingin mengatur ulang seluruh data presensi, tugas, dan perizinan ke kondisi data awal pabrik?"
        confirmText="Ya, Reset Data"
        cancelText="Batal"
        onConfirm={() => {
          setShowResetAppModal(false);
          executeResetData();
        }}
        onCancel={() => setShowResetAppModal(false)}
      />
    </>
  );
}
