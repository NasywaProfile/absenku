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
import { getCurrentDateString } from './lib/time-utils.ts';
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
  const [clockModalType, setClockModalType] = useState<'CLOCK_IN' | 'CLOCK_OUT' | null>(null);

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

  // Muat data awal saat pertama dibuka
  useEffect(() => {
    loadData();
  }, [loadData]);

  // Handler reset presensi hari ini
  const handleResetTodayAttendance = () => {
    AppStorage.clearTodayAttendance();
    loadData();
  };

  // Handler pergantian akun aktif (Admin vs Karyawan)
  const handleSwitchUser = (userId: string) => {
    AppStorage.setCurrentUserId(userId);
    setActiveTab('dashboard');
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
    AppStorage.approveRegistration(userId, currentUser.name);
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
    setCurrentUser(updatedUser);
    setSessionUser(updatedUser);
    loadData();
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
        }}
      />
    );
  }

  if (!currentUser || !officeConfig) {
    return (
      <div className="min-h-screen bg-[#F3F4F4] flex items-center justify-center p-4 text-slate-800">
        <div className="text-center space-y-3">
          <div className="w-8 h-8 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-xs font-semibold text-slate-600">Memuat Sesi <span className="font-extrabold text-[#1E3A8A] lowercase">absenku</span>...</p>
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
        onSwitchToAdmin={() => {
          const adminUser = users.find((u) => u.role === 'SUPER_ADMIN' || u.role === 'ADMIN') || users[0];
          if (adminUser) {
            AppStorage.setSessionUser(adminUser.id);
            AppStorage.setCurrentUserId(adminUser.id);
            setSessionUser(adminUser);
            setCurrentUser(adminUser);
            setActiveTab('dashboard');
            loadData();
          }
        }}
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
                onNavigateTab={(tab) => setActiveTab(tab)}
                onOpenSettingsModal={() => setShowSettingsModal(true)}
                onUpdateUser={handleUpdateEmployee}
                onUpdateAttendanceRecord={handleUpdateAttendanceRecord}
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
                onDeleteUser={handleDeleteEmployee}
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
                onOpenClockModal={(type) => setClockModalType(type)}
                onNavigateTab={(tab) => setActiveTab(tab)}
                onSwitchUser={handleSwitchUser}
                onResetTodayAttendance={handleResetTodayAttendance}
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

      {/* Clock In / Out Modal Popup */}
      {clockModalType && (
        <ClockInOutModal
          type={clockModalType}
          currentUser={currentUser}
          officeConfig={officeConfig}
          existingTodayRecord={todayRecord}
          onClose={() => setClockModalType(null)}
          onSuccess={() => {
            setClockModalType(null);
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
