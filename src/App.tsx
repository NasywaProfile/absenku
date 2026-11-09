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
import { User, OfficeConfig, AttendanceRecord, LeaveRequest, TaskItem, UserRole } from './types/index.ts';

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
    const curUser = AppStorage.getCurrentUser();
    const loadedConfig = AppStorage.getOfficeConfig();
    const loadedRecords = AppStorage.getAttendanceRecords();
    const loadedLeaves = AppStorage.getLeaveRequests();
    const loadedTasks = AppStorage.getTasks();

    setUsers(loadedUsers);
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
        const mergedUsers = [...localUsers];
        for (const su of serverUsers) {
          const idx = mergedUsers.findIndex(
            (u) => u.id === su.id || u.email.toLowerCase() === su.email.toLowerCase()
          );
          const mappedUser: User = {
            id: su.id,
            name: su.name || su.nama,
            email: su.email,
            role: (su.role || su.peran || 'EMPLOYEE') as UserRole,
            status: su.status || 'ACTIVE',
            employmentType: su.employment_type || su.tipe_kepegawaian || 'CONTRACT',
            department: su.department || su.divisi || 'Operasional',
            position: su.position || su.jabatan || 'Staf',
            avatar: su.avatar || su.foto_profil || '',
            phone: su.phone || su.nomor_telepon || '',
            joinDate: su.join_date || su.tanggal_bergabung || '',
            leaveBalance: su.leave_balance ?? su.sisa_cuti ?? 12,
            bankName: su.bank_name || su.nama_bank || '',
            bankAccountNumber: su.bank_account_number || su.nomor_rekening || '',
            bankAccountHolder: su.bank_account_holder || su.nama_pemilik_rekening || '',
            emergencyContactName: su.emergency_contact_name || su.nama_kontak_darurat || '',
            emergencyContactPhone: su.emergency_contact_phone || su.nomor_kontak_darurat || '',
            address: su.address || su.alamat || '',
            registeredAt: su.registered_at || su.waktu_daftar || '',
            isProfileComplete: Boolean(su.is_profile_complete ?? su.profil_lengkap),
          };
          if (idx >= 0) {
            mergedUsers[idx] = { ...mergedUsers[idx], ...mappedUser };
          } else {
            mergedUsers.push(mappedUser);
          }
        }
        AppStorage.saveUsers(mergedUsers);
        setUsers(mergedUsers);

        // Jika user yang sedang login mengalami update status (misal di-ACC admin di device lain), perbarui otomatis
        const activeUserId = AppStorage.getSessionUser()?.id;
        if (activeUserId) {
          const freshCurrent = mergedUsers.find((u) => u.id === activeUserId);
          if (freshCurrent) {
            setCurrentUser(freshCurrent);
            setSessionUser(freshCurrent);
          }
        }
      }

      // 2. Ambil data perizinan dari server
      const serverLeaves = await ApiClient.getLeaves().catch(() => null);
      if (Array.isArray(serverLeaves) && serverLeaves.length > 0) {
        const localLeaves = AppStorage.getLeaveRequests();
        const mergedLeaves = [...localLeaves];
        for (const sl of serverLeaves) {
          const idx = mergedLeaves.findIndex((l) => l.id === sl.id);
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
          const idx = mergedAtt.findIndex((a) => a.id === sa.id);
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
      if (Array.isArray(serverTasks) && serverTasks.length > 0) {
        const localTasks = AppStorage.getTasks();
        const mergedTasks = [...localTasks];
        for (const st of serverTasks) {
          const idx = mergedTasks.findIndex((t) => t.id === st.id);
          const mappedTask: TaskItem = {
            id: st.id,
            title: st.title || st.judul_tugas || '',
            description: st.description || st.deskripsi || '',
            status: st.status || st.status_tugas || 'TODO',
            priority: st.priority || st.prioritas || 'MEDIUM',
            assignedTo: st.assigned_to || st.ditugaskan_ke || '',
            assignedName: st.assigned_name || st.nama_petugas || '',
            assignedAvatar: st.assigned_avatar || st.foto_petugas || '',
            tags: Array.isArray(st.tags) ? st.tags : [],
            assignees: Array.isArray(st.assignees) ? st.assignees : [],
            dueDate: st.due_date || st.tenggat_waktu || '',
            createdBy: st.created_by || st.dibuat_oleh || 'usr_super_admin',
            createdAt: st.created_at || '',
            updatedAt: st.updated_at || '',
            activities: Array.isArray(st.activities) ? st.activities : [],
            attachments: Array.isArray(st.attachments) ? st.attachments : [],
            reviewNotes: st.review_notes,
            submissionNotes: st.submission_notes,
          };
          if (idx >= 0) {
            mergedTasks[idx] = { ...mergedTasks[idx], ...mappedTask };
          } else {
            mergedTasks.push(mappedTask);
          }
        }
        AppStorage.saveTasks(mergedTasks);
        setTasks(mergedTasks);
      }

      // 5. Ambil data ruang obrolan / topik chat dari server
      const serverTopics = await ApiClient.getChatTopics().catch(() => null);
      if (Array.isArray(serverTopics) && serverTopics.length > 0) {
        const localTopics = AppStorage.getChatTopics();
        const mergedTopics = [...localTopics];
        for (const st of serverTopics) {
          const idx = mergedTopics.findIndex((t) => t.id === st.id);
          const mappedTopic: ChatTopic = {
            id: st.id,
            title: st.title || st.judul_topik || '',
            status: st.status || st.status_topik || 'OPEN',
            taggedTeammateIds: Array.isArray(st.tagged_teammate_ids) ? st.tagged_teammate_ids : [],
            files: Array.isArray(st.files) ? st.files : [],
            links: Array.isArray(st.links) ? st.links : [],
            images: Array.isArray(st.images) ? st.images : [],
            shortNotes: st.short_notes || st.catatan_singkat || '',
            longNotes: st.long_notes || st.catatan_lengkap || '',
            authorId: st.dibuat_oleh_id || st.author_id || '',
            authorName: st.dibuat_oleh_nama || st.author_name || '',
            authorAvatar: st.dibuat_oleh_foto || '',
            comments: Array.isArray(st.comments) ? st.comments : (idx >= 0 ? mergedTopics[idx].comments : []),
            createdAt: st.created_at || '',
            updatedAt: st.updated_at || '',
          };
          if (idx >= 0) {
            mergedTopics[idx] = { ...mergedTopics[idx], ...mappedTopic };
          } else {
            mergedTopics.push(mappedTopic);
          }
        }
        AppStorage.saveChatTopics(mergedTopics);
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
    window.addEventListener('storage', handleSync);

    // Auto-sync berkala setiap 5 detik agar multi-device (Laptop & HP) selalu up-to-date realtime
    const timer = setInterval(() => {
      syncWithBackend();
    }, 5000);

    return () => {
      window.removeEventListener('absenku:leaves_updated', handleSync);
      window.removeEventListener('absenku:tasks_updated', handleSync);
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

  const handleUpdateEmployeeRole = (userId: string, newRole: UserRole) => {
    AppStorage.updateUserRole(userId, newRole);
    if (currentUser && currentUser.id === userId) {
      const updatedUser: User = { ...currentUser, role: newRole };
      AppStorage.updateUser(updatedUser);
      setCurrentUser(updatedUser);
      setSessionUser(updatedUser);
    }
    loadData();
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

  const handleDeleteEmployee = (userId: string) => {
    AppStorage.deleteUser(userId);
    loadData();
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
  const handleApproveRegistration = (userId: string, targetRole?: UserRole) => {
    if (!currentUser) return;
    AppStorage.approveRegistration(userId, currentUser.name, targetRole);
    if (targetRole) {
      AppStorage.updateUserRole(userId, targetRole);
    }
    loadData();
  };

  const handleRejectRegistration = (userId: string) => {
    AppStorage.rejectRegistration(userId);
    loadData();
  };

  // Handler Pengisian Wajib Data Diri Karyawan Baru
  const handleCompleteProfile = (updatedUser: User) => {
    AppStorage.updateUser(updatedUser);
    ApiClient.updateProfile({
      name: updatedUser.name,
      phone: updatedUser.phone,
      address: updatedUser.address,
      bank_name: updatedUser.bankName,
      bank_account_number: updatedUser.bankAccountNumber,
      bank_account_holder: updatedUser.bankAccountHolder,
      emergency_contact_name: updatedUser.emergencyContactName,
      emergency_contact_phone: updatedUser.emergencyContactPhone,
      is_profile_complete: true,
      profil_lengkap: true,
    }).catch(() => {});
    setCurrentUser(updatedUser);
    setSessionUser(updatedUser);
    loadData();
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

  // Karyawan belum melengkapi biodata jika:
  // - Role-nya adalah EMPLOYEE
  // - DAN (isProfileComplete !== true ATAU belum ada nomor whatsapp ATAU belum ada alamat)
  // Ini memastikan akun yang sudah dibuat dan masuk kembali TETAP MEMUNCULKAN POPUP
  // sampai biodatanya benar-benar diisi dan disimpan!
  const isEmployeeProfileIncomplete =
    !isAdmin &&
    (currentUser.isProfileComplete !== true ||
      !currentUser.phone ||
      !currentUser.address);

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
