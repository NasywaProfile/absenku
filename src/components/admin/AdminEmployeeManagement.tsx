import React, { useState } from 'react';
import {
  Users,
  Plus,
  Maximize2,
  Minimize2,
  Search,
  Mail,
  Phone,
  Calendar,
  CreditCard,
  Shield,
  CheckCircle2,
  XCircle,
  MoreVertical,
  ChevronRight,
  ChevronDown,
  Clock,
  UserCheck,
  LayoutGrid,
  List,
  Lock,
  X,
  Check,
  Eye,
} from 'lucide-react';
import { User, EmploymentType, UserRole } from '../../types/index.ts';
import { EMPLOYMENT_TYPE_LABELS } from '../../lib/whatsapp-recap.ts';
import { EmployeeDetailDrawer } from './EmployeeDetailDrawer.tsx';
import { AppStorage } from '../../lib/storage.ts';
import { Tooltip } from '../ui/tooltip.tsx';
import { ModernConfirmDialog } from '../common/ModernConfirmDialog.tsx';

interface AdminEmployeeManagementProps {
  currentUser?: User;
  users: User[];
  leaves?: any;
  initialSubTab?: 'EMPLOYEES' | 'APPROVALS';
  onAddUser: (user: User) => void;
  onUpdateUser?: (user: User) => void;
  onDeleteUser?: (userId: string) => void;
  onUpdateRole?: (userId: string, newRole: UserRole) => void;
  onUpdateType?: (userId: string, newType: EmploymentType) => void;
  onToggleStatus?: (userId: string) => void;
}

export function AdminEmployeeManagement({
  currentUser: propCurrentUser,
  users,
  leaves,
  initialSubTab,
  onAddUser,
  onUpdateUser,
  onDeleteUser,
  onUpdateRole = (userId, newRole) => AppStorage.updateUserRole(userId, newRole),
  onUpdateType = (userId, newType) => AppStorage.updateEmploymentType(userId, newType),
  onToggleStatus = (userId) => AppStorage.toggleUserActiveStatus(userId),
}: AdminEmployeeManagementProps) {
  const currentUser = propCurrentUser || AppStorage.getCurrentUser() || users[0];
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<string>('ALL');
  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  const [isMobileFilterOpen, setIsMobileFilterOpen] = useState(false);
  const hasActiveFilters = filterType !== 'ALL' || filterStatus !== 'ALL';
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [isAddModalFullScreen, setIsAddModalFullScreen] = useState(false);
  const [dialogMessage, setDialogMessage] = useState<{ title: string; message: string; variant: 'warning' | 'danger' | 'info' | 'success' } | null>(null);

  // Form Tambah Karyawan Baru
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newDept, setNewDept] = useState('Teknologi & Engineering');
  const [newPosition, setNewPosition] = useState('Software Engineer');
  const [newType, setNewType] = useState<EmploymentType>('CONTRACT');
  const [newBankName, setNewBankName] = useState('BCA (Bank Central Asia)');
  const [newBankAccount, setNewBankAccount] = useState('');
  const [newEmergencyName, setNewEmergencyName] = useState('');
  const [newEmergencyPhone, setNewEmergencyPhone] = useState('');

  const isSuperAdmin = currentUser.role === 'SUPER_ADMIN';

  const handleUpdateRole = (userId: string, newRole: UserRole) => {
    AppStorage.updateUserRole(userId, newRole);
    const updated = AppStorage.getUserById(userId);
    if (updated) {
      if (onUpdateUser) onUpdateUser(updated);
      setSelectedUser(updated);
    }
  };

  const handleUpdateType = (userId: string, newType: EmploymentType) => {
    AppStorage.updateEmploymentType(userId, newType);
    const updated = AppStorage.getUserById(userId);
    if (updated) {
      if (onUpdateUser) onUpdateUser(updated);
      setSelectedUser(updated);
    }
  };

  const handleToggleStatus = (userId: string) => {
    AppStorage.toggleUserActiveStatus(userId);
    const updated = AppStorage.getUserById(userId);
    if (updated) {
      if (onUpdateUser) onUpdateUser(updated);
      setSelectedUser(updated);
    }
  };

  const filteredUsers = users.filter((u) => {
    // Permintaan akun baru (PENDING_APPROVAL) belum di-ACC, jadi BELUM masuk ke Data Karyawan
    if (u.status === 'PENDING_APPROVAL') return false;

    if (filterType !== 'ALL' && u.employmentType !== filterType) return false;
    if (filterStatus !== 'ALL' && u.status !== filterStatus) return false;

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const matchName = u.name.toLowerCase().includes(q);
      const matchEmail = u.email.toLowerCase().includes(q);
      const matchDept = u.department?.toLowerCase().includes(q);
      const matchPos = u.position?.toLowerCase().includes(q);
      if (!matchName && !matchEmail && !matchDept && !matchPos) return false;
    }

    return true;
  });

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim() || !newEmail.trim()) return;

    const res = AppStorage.registerNewUser({
      name: newName,
      email: newEmail,
      phone: newPhone,
      department: newDept,
      position: newPosition,
      employmentType: newType,
      bankName: newBankName,
      bankAccountNumber: newBankAccount,
      bankAccountHolder: newName,
      emergencyContactName: newEmergencyName,
      emergencyContactPhone: newEmergencyPhone,
    });

    if (res.success && res.user) {
      // Auto-approve if created directly from Admin panel
      AppStorage.approveRegistration(res.user.id, currentUser.name);
      onAddUser(res.user);
      setShowAddModal(false);
      setNewName('');
      setNewEmail('');
      setNewPhone('');
      setNewBankAccount('');
      setNewEmergencyName('');
      setNewEmergencyPhone('');
    } else {
      setDialogMessage({
        title: 'Pendaftaran Gagal',
        message: res.message || 'Gagal menambahkan data karyawan.',
        variant: 'warning',
      });
    }
  };

  const pendingUsers = React.useMemo(() => {
    return users
      .filter((u) => u.status === 'PENDING_APPROVAL')
      .sort((a, b) => {
        const dateA = a.registeredAt || a.id || '';
        const dateB = b.registeredAt || b.id || '';
        return dateB.localeCompare(dateA);
      });
  }, [users]);
  const [activeSubTab, setActiveSubTab] = useState<'EMPLOYEES' | 'APPROVALS'>(
    initialSubTab || 'EMPLOYEES'
  );

  React.useEffect(() => {
    if (initialSubTab) {
      setActiveSubTab(initialSubTab);
    }
  }, [initialSubTab]);

  const handleApprove = (userId: string) => {
    AppStorage.approveRegistration(userId, currentUser.name);
    if (onUpdateUser) {
      const allFresh = AppStorage.getUsers();
      const updated = allFresh.find((u) => u.id === userId);
      if (updated) onUpdateUser(updated);
    }
  };

  const handleReject = (userId: string) => {
    AppStorage.rejectRegistration(userId);
    if (onDeleteUser) onDeleteUser(userId);
  };

  return (
    <div className="space-y-5 font-sans antialiased">
      {activeSubTab === 'EMPLOYEES' && (
        <div className="space-y-5">
          {/* Filter & Search Toolbar */}
          <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs p-3 sm:p-3.5 space-y-2.5 md:space-y-0 md:flex md:items-center md:justify-between md:gap-3">
            {/* Search Input Bar (Di Mobile berada di atas dengan panah arrow toggle filter; di Desktop berada di sisi kanan) */}
            <div className="order-1 md:order-2 w-full md:w-80">
              <div className="relative w-full flex items-center">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 pointer-events-none" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Cari nama, email, divisi, jabatan..."
                  className="w-full pl-10 pr-12 md:pr-8 h-12 md:h-10 bg-slate-50 hover:bg-white focus:bg-white border border-slate-200 rounded-xl text-xs text-slate-800 font-medium focus:outline-hidden focus:ring-2 focus:ring-[#1E3A8A] transition-colors shadow-2xs"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="absolute right-10 md:right-3 text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
                    title="Hapus pencarian"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
                {/* Tombol Panah Buka/Tutup Filter Khusus Mobile */}
                <button
                  type="button"
                  onClick={() => setIsMobileFilterOpen(!isMobileFilterOpen)}
                  className={`md:hidden absolute right-1.5 top-1/2 -translate-y-1/2 h-9 px-2.5 rounded-xl flex items-center justify-center transition-all cursor-pointer ${
                    isMobileFilterOpen
                      ? 'bg-[#1E3A8A] text-white shadow-2xs'
                      : hasActiveFilters
                      ? 'bg-blue-100 text-[#1E3A8A] font-bold'
                      : 'text-slate-500 hover:text-slate-800 hover:bg-slate-200/60'
                  }`}
                  title={isMobileFilterOpen ? "Sembunyikan filter" : "Tampilkan filter"}
                  aria-label="Toggle Filter"
                >
                  <ChevronDown
                    className={`w-4 h-4 transition-transform duration-200 ${
                      isMobileFilterOpen ? 'rotate-180' : ''
                    }`}
                  />
                </button>
              </div>
            </div>

            {/* Filter Strip (Mobile: hanya tampil jika panah filter diklik; Desktop: selalu tampil di sisi kiri) */}
            <div
              className={`order-2 md:order-1 ${
                isMobileFilterOpen ? 'flex' : 'hidden'
              } md:flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 sm:gap-3 w-full md:w-auto text-xs animate-in fade-in slide-in-from-top-1 duration-150`}
            >
              {/* Filter Type */}
              <div className="relative inline-flex items-center w-full sm:w-auto min-w-[170px]">
                <select
                  value={filterType}
                  onChange={(e) => setFilterType(e.target.value)}
                  className="appearance-none w-full h-12 md:h-10 px-4 pr-9 bg-slate-50 hover:bg-white border border-slate-200 rounded-xl text-xs text-slate-800 font-semibold focus:outline-hidden focus:ring-2 focus:ring-[#1E3A8A] cursor-pointer shadow-2xs transition-colors"
                >
                  <option value="ALL">Semua Tipe Karyawan</option>
                  <option value="INTERN">Magang (Intern)</option>
                  <option value="FREELANCE">Freelance</option>
                  <option value="CONTRACT">Karyawan Sementara (Kontrak)</option>
                  <option value="PERMANENT">Karyawan Tetap</option>
                </select>
                <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3 pointer-events-none" />
              </div>

              {/* Filter Status */}
              <div className="relative inline-flex items-center w-full sm:w-auto min-w-[150px]">
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="appearance-none w-full h-12 md:h-10 px-4 pr-9 bg-slate-50 hover:bg-white border border-slate-200 rounded-xl text-xs text-slate-800 font-semibold focus:outline-hidden focus:ring-2 focus:ring-[#1E3A8A] cursor-pointer shadow-2xs transition-colors"
                >
                  <option value="ALL">Semua Status</option>
                  <option value="ACTIVE">Aktif</option>
                  <option value="PENDING_APPROVAL">Menunggu Persetujuan</option>
                  <option value="INACTIVE">Non-Aktif</option>
                </select>
                <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3 pointer-events-none" />
              </div>
            </div>
          </div>

          {/* Employee Cards Grid (Designed matching reference image) */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredUsers.map((user) => (
              <div
                key={user.id}
                className="bg-white rounded-[30px] border border-slate-200/90 p-3 sm:p-3.5 shadow-2xs hover:shadow-md transition-all flex flex-col justify-between space-y-3 font-sans overflow-hidden group"
              >
                <div>
                  {/* Top Header Banner with Blue Contour Graphic */}
                  <div
                    className="h-28 sm:h-32 rounded-[22px] relative overflow-hidden bg-[#0047AB] shadow-2xs bg-cover bg-center"
                    style={{
                      backgroundImage: `url('/assets/bgcard.jpg')`,
                    }}
                  >
                    {/* Subtle Overlay */}
                    <div className="absolute inset-0 bg-blue-950/10" />
                  </div>

                  {/* Centered Avatar with Rainbow Gradient Ring */}
                  <div className="flex justify-center -mt-11 sm:-mt-12 relative z-10">
                    <div className="p-[2.5px] rounded-full bg-gradient-to-tr from-[#f43f5e] via-[#eab308] via-[#10b981] via-[#06b6d4] to-[#6366f1] shadow-md">
                      <div className="p-0.5 bg-white rounded-full">
                        <img
                          src={user.avatar}
                          alt={user.name}
                          className="w-18 h-18 sm:w-20 sm:h-20 rounded-full object-cover bg-white shrink-0"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Centered Name, Position & Status Info */}
                  <div className="text-center pt-2 px-2 space-y-1">
                    <h3 className="font-extrabold text-slate-900 text-base sm:text-lg leading-snug truncate group-hover:text-indigo-700 transition-colors">
                      {user.name}
                    </h3>
                    <p className="text-xs text-slate-500 font-medium leading-relaxed max-w-[260px] mx-auto truncate">
                      {user.position || 'Staf Operasional'}
                    </p>

                    {/* Status Badge */}
                    <div className="flex items-center justify-center pt-0.5">
                      <span
                        className={`text-[10px] font-extrabold px-2.5 py-0.5 rounded-full border flex items-center gap-1.5 ${
                          user.status === 'ACTIVE'
                            ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                            : user.status === 'PENDING_APPROVAL'
                            ? 'bg-amber-50 text-amber-900 border-amber-200'
                            : 'bg-slate-100 text-slate-700 border-slate-200'
                        }`}
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${
                            user.status === 'ACTIVE'
                              ? 'bg-emerald-500'
                              : user.status === 'PENDING_APPROVAL'
                              ? 'bg-amber-500'
                              : 'bg-slate-400'
                          }`}
                        />
                        <span>
                          {user.status === 'ACTIVE'
                            ? 'Aktif'
                            : user.status === 'PENDING_APPROVAL'
                            ? 'Menunggu'
                            : 'Non-Aktif'}
                        </span>
                      </span>
                    </div>
                  </div>

                  {/* Core 3-Stat Metric Box (Values on Top, Labels on Bottom like Reference) */}
                  <div className="bg-slate-50/90 border border-slate-150 rounded-2xl p-3 grid grid-cols-3 gap-1 text-center my-3 shadow-2xs">
                    {/* Stat 1: Tipe */}
                    <div className="px-1 border-r border-slate-200/60">
                      <p className="text-xs sm:text-sm font-extrabold text-slate-900 truncate">
                        {EMPLOYMENT_TYPE_LABELS[user.employmentType]}
                      </p>
                      <p className="text-[10px] font-semibold text-slate-400 mt-0.5">Tipe</p>
                    </div>

                    {/* Stat 2: Peran */}
                    <div className="px-1 border-r border-slate-200/60">
                      <p className="text-xs sm:text-sm font-extrabold text-slate-900 truncate">
                        {user.role === 'SUPER_ADMIN' ? 'Direksi' : user.role === 'ADMIN' ? 'Admin' : 'Staf'}
                      </p>
                      <p className="text-[10px] font-semibold text-slate-400 mt-0.5">Peran</p>
                    </div>

                    {/* Stat 3: Sisa Cuti */}
                    <div className="px-1">
                      <p className="text-xs sm:text-sm font-extrabold text-slate-900 truncate">
                        {user.leaveBalance} Hari
                      </p>
                      <p className="text-[10px] font-semibold text-slate-400 mt-0.5">Sisa Cuti</p>
                    </div>
                  </div>
                </div>

                {/* Bottom Dark Navy Primary Action Button */}
                <Tooltip content="Buka panel detail profil, kontak lengkap, dan mutasi data staf" position="top" className="w-full">
                  <button
                    type="button"
                    onClick={() => setSelectedUser(user)}
                    className="w-full py-2.5 bg-[#1E3A8A] hover:bg-[#172554] text-white rounded-2xl font-bold text-xs shadow-2xs transition-all flex items-center justify-center gap-2 active:scale-[0.98] cursor-pointer"
                  >
                    <span>Kelola &amp; Inspeksi Staf</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </Tooltip>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* SUBFOLDER TAB 2: PERSETUJUAN AKUN BARU (Tampilan seperti Rekap Presensi) */}
      {activeSubTab === 'APPROVALS' && (
        <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs overflow-hidden">
          {/* Table Header Banner */}
          <div className="p-3.5 sm:p-4 bg-slate-50/80 border-b border-slate-100 flex items-center justify-end">
            <span className="px-3 py-1 rounded-full text-xs font-bold bg-white text-slate-800 border border-slate-200 shadow-2xs">
              {pendingUsers.length} Antrean Approval
            </span>
          </div>

          {/* Table Container (Sesuai Data Biodata Diri User) */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs min-w-[820px]">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-400 font-bold uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="py-3.5 px-5 w-[28%]">Foto Profile &amp; Nama</th>
                  <th className="py-3.5 px-5 w-[26%]">Divisi</th>
                  <th className="py-3.5 px-5 w-[18%]">Tipe Kepegawaian</th>
                  <th className="py-3.5 px-5 w-[16%]">Kontak WA</th>
                  <th className="py-3.5 px-5 w-[12%] text-center">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                {pendingUsers.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-12 text-center text-slate-400">
                      <UserCheck className="w-8 h-8 mx-auto mb-2 opacity-40 text-slate-400" />
                      <p className="font-semibold text-xs text-slate-600">Tidak Ada Antrean Persetujuan Akun Baru</p>
                      <p className="text-[11px] text-slate-400 pt-0.5">
                        Semua pendaftaran pendaftar staf telah ditinjau dan disetujui.
                      </p>
                    </td>
                  </tr>
                ) : (
                  pendingUsers.map((user) => (
                    <tr
                      key={user.id}
                      className="hover:bg-slate-50/80 transition-colors"
                    >
                      {/* 1. Foto Profile & Nama */}
                      <td className="py-4 px-5">
                        <div className="flex items-center gap-3">
                          <img
                            src={user.avatar}
                            alt={user.name}
                            onError={(e) => {
                              (e.currentTarget as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name)}&background=1E3A8A&color=ffffff&bold=true`;
                            }}
                            className="w-10 h-10 rounded-full object-cover border-2 border-[#1E3A8A] shrink-0 shadow-2xs"
                          />
                          <div>
                            <p className="font-bold text-slate-900 text-xs sm:text-sm whitespace-normal break-words">{user.name}</p>
                            <p className="text-[11px] text-slate-500 font-mono whitespace-normal break-all">{user.email}</p>
                          </div>
                        </div>
                      </td>

                      {/* 2. Divisi */}
                      <td className="py-4 px-5">
                        <p className="font-bold text-slate-800 text-xs sm:text-sm whitespace-normal break-words leading-snug">{user.department || 'Operasional'}</p>
                      </td>

                      {/* 3. Tipe Kepegawaian */}
                      <td className="py-4 px-5">
                        <span className="inline-block px-2.5 py-1 rounded-lg text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-200 whitespace-nowrap">
                          {EMPLOYMENT_TYPE_LABELS[user.employmentType] || user.employmentType}
                        </span>
                      </td>

                      {/* 4. Kontak WA */}
                      <td className="py-4 px-5">
                        <p className="font-bold text-slate-800 text-xs sm:text-sm font-mono whitespace-nowrap">
                          {user.phone || '-'}
                        </p>
                      </td>

                      {/* 5. Aksi */}
                      <td className="py-4 px-5 text-center whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-center gap-1.5">
                          <Tooltip content="Setujui pendaftaran dan aktifkan akun staf" position="top">
                            <button
                              type="button"
                              onClick={() => handleApprove(user.id)}
                              className="w-8.5 h-8.5 rounded-xl bg-emerald-100 hover:bg-emerald-200 text-emerald-800 border border-emerald-300/80 flex items-center justify-center transition-all cursor-pointer active:scale-95 shadow-2xs"
                              title="Setujui (ACC)"
                            >
                              <Check className="w-4 h-4 text-emerald-700 stroke-[2.5]" />
                            </button>
                          </Tooltip>

                          <Tooltip content="Tolak pendaftaran akun dan hapus dari antrean" position="top">
                            <button
                              type="button"
                              onClick={() => handleReject(user.id)}
                              className="w-8.5 h-8.5 rounded-xl bg-rose-100 hover:bg-rose-200 text-rose-800 border border-rose-300/80 flex items-center justify-center transition-all cursor-pointer active:scale-95 shadow-2xs"
                              title="Tolak Pendaftaran"
                            >
                              <X className="w-4 h-4 text-rose-700 stroke-[2.5]" />
                            </button>
                          </Tooltip>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Slide-over Detail Profil Drawer */}
      <EmployeeDetailDrawer
        isOpen={!!selectedUser}
        onClose={() => setSelectedUser(null)}
        employee={selectedUser}
        currentUser={currentUser}
        attendanceHistory={AppStorage.getAttendanceRecords()}
        dailyTasks={AppStorage.getDailyTasks()}
        onUpdateRole={handleUpdateRole}
        onUpdateType={handleUpdateType}
        onToggleStatus={handleToggleStatus}
      />

      {/* Modal Tambah Karyawan Baru */}
      {showAddModal && (
        <div
          className={`fixed inset-0 z-50 flex animate-in fade-in duration-200 font-sans ${
            isAddModalFullScreen
              ? 'items-center justify-center p-0'
              : 'justify-end items-center p-2.5 sm:p-4 md:p-5'
          }`}
        >
          <div
            className="fixed inset-0 bg-slate-950/40 backdrop-blur-xs transition-opacity cursor-pointer"
            onClick={() => setShowAddModal(false)}
          />
          <div
            className={`relative z-10 bg-white shadow-2xl flex flex-col min-h-0 overflow-hidden transition-all duration-300 font-sans ${
              isAddModalFullScreen
                ? 'w-full h-full max-w-none max-h-none rounded-none border-0'
                : 'w-full max-w-md sm:max-w-lg h-full max-h-[calc(100vh-1.25rem)] sm:max-h-[calc(100vh-2rem)] rounded-3xl border border-slate-200/80 animate-in slide-in-from-right duration-300 ease-out'
            }`}
          >
            <div className="px-6 py-5 border-b border-slate-100 bg-white flex items-center justify-between gap-3 shrink-0">
              <div className="flex items-center gap-3 min-w-0">
                {/* Zoom Button di pojok kiri atas */}
                <button
                  type="button"
                  onClick={() => setIsAddModalFullScreen(!isAddModalFullScreen)}
                  className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl border border-slate-200/80 transition-colors cursor-pointer shrink-0"
                  title={isAddModalFullScreen ? "Perkecil Tampilan" : "Perbesar Layar Penuh"}
                >
                  {isAddModalFullScreen ? (
                    <Minimize2 className="w-4 h-4 text-slate-600" />
                  ) : (
                    <Maximize2 className="w-4 h-4 text-slate-600" />
                  )}
                </button>
                <div>
                  <h3 className="font-bold text-base text-slate-900">
                    Pendaftaran Karyawan Baru
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Lengkapi data profil dan akun kerja karyawan baru
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full border border-slate-200 transition-colors cursor-pointer shrink-0"
                title="Tutup"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} className="flex-1 flex flex-col min-h-0">
              <div className="flex-1 overflow-y-auto p-6 space-y-4 text-xs sm:text-sm">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-800 mb-1">
                    Nama Lengkap
                  </label>
                  <input
                    type="text"
                    required
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="Contoh: Pratama Arhan"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-900"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-800 mb-1">
                    Email Kantor
                  </label>
                  <input
                    type="email"
                    required
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    placeholder="nama@kantor.id"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-900 font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-800 mb-1">
                    No. WhatsApp / Telepon
                  </label>
                  <input
                    type="tel"
                    required
                    value={newPhone}
                    onChange={(e) => setNewPhone(e.target.value)}
                    placeholder="081234567890"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-900 font-mono"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-800 mb-1">
                    Tipe Kepegawaian
                  </label>
                  <select
                    value={newType}
                    onChange={(e) => setNewType(e.target.value as EmploymentType)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-900 font-bold"
                  >
                    <option value="INTERN">Magang (Intern)</option>
                    <option value="FREELANCE">Freelance</option>
                    <option value="CONTRACT">Karyawan Sementara (Kontrak)</option>
                    <option value="PERMANENT">Karyawan Tetap</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-800 mb-1">
                    Divisi / Departemen
                  </label>
                  <input
                    type="text"
                    required
                    value={newDept}
                    onChange={(e) => setNewDept(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-900"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-800 mb-1">
                    Jabatan / Posisi
                  </label>
                  <input
                    type="text"
                    required
                    value={newPosition}
                    onChange={(e) => setNewPosition(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-900"
                  />
                </div>
              </div>

              {/* Data Finansial */}
              <div className="pt-2 border-t border-slate-100 space-y-2">
                <p className="font-bold text-xs text-slate-800 uppercase tracking-wider">
                  Data Finansial Rekening
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-700 font-semibold mb-1">Nama Bank</label>
                    <select
                      value={newBankName}
                      onChange={(e) => setNewBankName(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                    >
                      <option value="BCA (Bank Central Asia)">BCA</option>
                      <option value="Bank Mandiri">Mandiri</option>
                      <option value="Bank BNI">BNI</option>
                      <option value="Bank BRI">BRI</option>
                      <option value="Bank Jago">Bank Jago</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-slate-700 font-semibold mb-1">Nomor Rekening</label>
                    <input
                      type="text"
                      value={newBankAccount}
                      onChange={(e) => setNewBankAccount(e.target.value)}
                      placeholder="Contoh: 5220819234"
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono"
                    />
                  </div>
                </div>
              </div>

              {/* Kontak Darurat */}
              <div className="pt-2 border-t border-slate-100 space-y-2">
                <p className="font-bold text-xs text-slate-800 uppercase tracking-wider">
                  Kontak Darurat
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-700 font-semibold mb-1">Nama Kerabat</label>
                    <input
                      type="text"
                      value={newEmergencyName}
                      onChange={(e) => setNewEmergencyName(e.target.value)}
                      placeholder="Contoh: Budi (Orang Tua)"
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-700 font-semibold mb-1">Nomor Telepon Darurat</label>
                    <input
                      type="tel"
                      value={newEmergencyPhone}
                      onChange={(e) => setNewEmergencyPhone(e.target.value)}
                      placeholder="081299887766"
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono"
                    />
                  </div>
                </div>
              </div>

              </div>

              <div className="px-6 py-4.5 border-t border-slate-100 bg-white flex items-center justify-between gap-3 shrink-0">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl text-xs cursor-pointer transition-colors"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 bg-[#1E3A8A] hover:bg-[#172554] text-white font-bold rounded-xl text-xs shadow-xs cursor-pointer transition-all active:scale-95"
                >
                  Simpan &amp; Aktifkan Akun
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Pop Up Dialog Pesan Simpel */}
      <ModernConfirmDialog
        isOpen={!!dialogMessage}
        title={dialogMessage?.title || ''}
        message={dialogMessage?.message || ''}
        variant={dialogMessage?.variant || 'warning'}
        confirmText="Mengerti"
        hideCancel={true}
        onConfirm={() => setDialogMessage(null)}
        onCancel={() => setDialogMessage(null)}
      />
    </div>
  );
}
