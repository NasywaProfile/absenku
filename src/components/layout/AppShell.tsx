import React, { useState, useEffect, useRef } from 'react';
import {
  LayoutDashboard,
  MapPin,
  History,
  CalendarDays,
  Calendar,
  Clock,
  Kanban,
  Building2,
  Sparkles,
  ChevronRight,
  FileCheck,
  Users,
  CheckSquare,
  Plus,
  ArrowUpRight,
  Shield,
  Layers,
  LogOut,
  User as UserIcon,
  WifiOff,
  RefreshCw,
  Menu,
  X,
  Settings,
  ChevronDown,
  Mail,
  Folder,
  FolderOpen,
  MessageSquare,
} from 'lucide-react';
import { User, OfficeConfig, AttendanceRecord } from '../../types/index.ts';
import { AppStorage } from '../../lib/storage.ts';
import { useOnlineStatus } from '../../lib/offline-sync.ts';
import { NavIcon } from '../common/NavIcons.tsx';
import { Tooltip } from '../ui/tooltip.tsx';

interface AppShellProps {
  currentUser: User;
  users: User[];
  officeConfig: OfficeConfig;
  activeTab: string;
  todayRecord?: AttendanceRecord | null;
  onTabChange: (tabId: string) => void;
  onSwitchUser?: (userId: string) => void;
  onResetData: () => void;
  onOpenSettingsModal: () => void;
  onLogout: () => void;
  pendingLeavesCount: number;
  pendingTasksCount: number;
  children: React.ReactNode;
}

export function AppShell({
  currentUser,
  users,
  officeConfig,
  activeTab,
  todayRecord,
  onTabChange,
  onSwitchUser,
  onResetData,
  onOpenSettingsModal,
  onLogout,
  pendingLeavesCount,
  pendingTasksCount,
  children,
}: AppShellProps) {
  const isAdmin = currentUser.role === 'ADMIN' || currentUser.role === 'SUPER_ADMIN';
  const { isOnline, pendingCount, triggerSync, isSyncing } = useOnlineStatus();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);
  const pendingUsersCount = users.filter((u) => u.status === 'PENDING_APPROVAL').length;
  const mainContentRef = useRef<HTMLElement>(null);
  const [openFolders, setOpenFolders] = useState<Record<string, boolean>>({
    absensi_folder: true,
    tugas_folder: true,
    pengajuan_folder: true,
    karyawan_folder: true,
  });

  // Otomatis scroll ke bagian paling atas halaman setiap kali berpindah tab/halaman
  useEffect(() => {
    if (mainContentRef.current) {
      mainContentRef.current.scrollTo({ top: 0, left: 0, behavior: 'instant' });
      mainContentRef.current.scrollTop = 0;
    }
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
  }, [activeTab]);

  const toggleFolder = (folderId: string) => {
    setOpenFolders((prev) => ({ ...prev, [folderId]: !prev[folderId] }));
  };

  // Helper untuk menampilkan Role & Tipe Kepegawaian sesuai data Biodata Diri
  const getRoleAndTypeLabel = () => {
    if (currentUser.role === 'SUPER_ADMIN') return 'Super Admin';
    if (currentUser.role === 'ADMIN') return 'Administrator';
    switch (currentUser.employmentType) {
      case 'INTERN':
        return 'Magang';
      case 'FREELANCE':
        return 'Freelance';
      case 'CONTRACT':
        return 'Karyawan Kontrak';
      case 'PERMANENT':
      default:
        return 'Karyawan Tetap';
    }
  };


  interface NavSubItem {
    id: string;
    label: string;
    badge?: number | null;
    badgeColor?: string;
  }

  interface NavItem {
    id: string;
    label: string;
    icon: any;
    badge?: number | null;
    badgeColor?: string;
    isFolder?: boolean;
    children?: NavSubItem[];
  }

  // 1. Sidebar Khusus SUPER ADMIN (Hanya fitur kontrol & pemantauan tim)
  const superAdminSidebarItems: NavItem[] = [
    {
      id: 'dashboard',
      label: 'Beranda',
      icon: LayoutDashboard,
      badge: null,
    },
    {
      id: 'history',
      label: 'Presensi Karyawan',
      icon: History,
      badge: null,
    },
    {
      id: 'tasks_team',
      label: 'Tugas Tim',
      icon: Kanban,
      badge: pendingTasksCount > 0 ? pendingTasksCount : null,
      badgeColor: 'bg-blue-100 text-[#1E3A8A] border border-blue-200',
    },
    {
      id: 'chat_room',
      label: 'Ruang Obrolan',
      icon: MessageSquare,
      badge: null,
    },
    {
      id: 'leaves_approval',
      label: 'Persetujuan Izin Tim',
      icon: CalendarDays,
      badge: pendingLeavesCount > 0 ? pendingLeavesCount : null,
      badgeColor: 'bg-blue-100 text-[#1E3A8A] border border-blue-200',
    },
    {
      id: 'karyawan_folder',
      label: 'Karyawan',
      icon: Folder,
      isFolder: true,
      badge: pendingUsersCount > 0 ? pendingUsersCount : null,
      badgeColor: 'bg-blue-100 text-[#1E3A8A] border border-blue-200',
      children: [
        {
          id: 'employees',
          label: 'Data Karyawan',
          badge: null,
        },
        {
          id: 'employee_approvals',
          label: 'Persetujuan Akun Baru',
          badge: pendingUsersCount > 0 ? pendingUsersCount : null,
          badgeColor: 'bg-blue-100 text-[#1E3A8A] border border-blue-200',
        },
      ],
    },
    {
      id: 'settings',
      label: 'Lokasi & Geofence',
      icon: MapPin,
      badge: null,
    },
  ];

  // 2. Sidebar Khusus ADMIN OPERASIONAL
  const adminSidebarItems: NavItem[] = [
    {
      id: 'dashboard',
      label: 'Beranda',
      icon: LayoutDashboard,
      badge: null,
    },
    {
      id: 'absensi_folder',
      label: 'Presensi',
      icon: Folder,
      isFolder: true,
      children: [
        {
          id: 'clock',
          label: 'Presensi Sekarang',
          badge: null,
        },
        {
          id: 'history',
          label: 'Rekap Presensi Tim',
          badge: null,
        },
      ],
    },
    {
      id: 'tugas_folder',
      label: 'Tugas Saya & Tim',
      icon: Folder,
      isFolder: true,
      badge: pendingTasksCount > 0 ? pendingTasksCount : null,
      badgeColor: 'bg-blue-100 text-[#1E3A8A] border border-blue-200',
      children: [
        {
          id: 'tasks_my',
          label: 'Tugas Saya',
          badge: null,
        },
        {
          id: 'tasks_team',
          label: 'Memberikan Tugas Tim',
          badge: pendingTasksCount > 0 ? pendingTasksCount : null,
          badgeColor: 'bg-blue-100 text-[#1E3A8A] border border-blue-200',
        },
      ],
    },
    {
      id: 'chat_room',
      label: 'Ruang Obrolan',
      icon: MessageSquare,
      badge: null,
    },
    {
      id: 'pengajuan_folder',
      label: 'Pengajuan & Izin',
      icon: Folder,
      isFolder: true,
      badge: pendingLeavesCount > 0 ? pendingLeavesCount : null,
      badgeColor: 'bg-blue-100 text-[#1E3A8A] border border-blue-200',
      children: [
        {
          id: 'leaves_my',
          label: 'Pengajuan Izin Saya',
          badge: null,
        },
        {
          id: 'leaves_approval',
          label: 'Persetujuan Izin Tim',
          badge: pendingLeavesCount > 0 ? pendingLeavesCount : null,
          badgeColor: 'bg-blue-100 text-[#1E3A8A] border border-blue-200',
        },
      ],
    },
    {
      id: 'karyawan_folder',
      label: 'Karyawan',
      icon: Folder,
      isFolder: true,
      badge: pendingUsersCount > 0 ? pendingUsersCount : null,
      badgeColor: 'bg-blue-100 text-[#1E3A8A] border border-blue-200',
      children: [
        {
          id: 'employees',
          label: 'Data Karyawan',
          badge: null,
        },
        {
          id: 'employee_approvals',
          label: 'Persetujuan Akun Baru',
          badge: pendingUsersCount > 0 ? pendingUsersCount : null,
          badgeColor: 'bg-blue-100 text-[#1E3A8A] border border-blue-200',
        },
      ],
    },
  ];

  // 3. Sidebar Khusus KARYAWAN
  const employeeSidebarItems: NavItem[] = [
    {
      id: 'dashboard',
      label: 'Beranda',
      icon: LayoutDashboard,
      badge: null,
    },
    {
      id: 'absensi_folder',
      label: 'Presensi',
      icon: Folder,
      isFolder: true,
      children: [
        {
          id: 'clock',
          label: 'Presensi Sekarang',
          badge: null,
        },
        {
          id: 'history',
          label: 'Riwayat Presensi',
          badge: null,
        },
      ],
    },
    {
      id: 'tasks_my',
      label: 'Tugas Saya',
      icon: CheckSquare,
      badge: null,
    },
    {
      id: 'chat_room',
      label: 'Ruang Obrolan',
      icon: MessageSquare,
      badge: null,
    },
    {
      id: 'leaves_my',
      label: 'Pengajuan Izin Saya',
      icon: CalendarDays,
      badge: null,
    },
  ];

  const isSuperAdmin = currentUser.role === 'SUPER_ADMIN';

  const currentSidebarItems = isSuperAdmin
    ? superAdminSidebarItems
    : isAdmin
    ? adminSidebarItems
    : employeeSidebarItems;

  // Helper agar menu navbar otomatis aktif saat dinavigasikan dari card/tombol halaman lain
  const isTabActive = (itemId: string, currentTab: string): boolean => {
    if (itemId === currentTab) return true;
    if (itemId === 'chat_room' && (currentTab === 'chat' || currentTab === 'chat_room')) return true;
    if (itemId === 'leaves_approval' && (currentTab === 'leaves_approval' || (currentTab === 'leaves' && isAdmin))) return true;
    if (itemId === 'leaves_my' && (currentTab === 'leaves_my' || (currentTab === 'leaves' && !isAdmin))) return true;
    if (itemId === 'tasks_team' && (currentTab === 'tasks_team' || (currentTab === 'tasks' && isAdmin))) return true;
    if (itemId === 'tasks_my' && (currentTab === 'tasks_my' || (currentTab === 'tasks' && !isAdmin))) return true;
    if (itemId === 'history' && (currentTab === 'history' || currentTab === 'attendance_history')) return true;
    if (itemId === 'clock' && (currentTab === 'clock' || currentTab === 'attendance')) return true;
    if (itemId === 'employees' && currentTab === 'employees') return true;
    if (itemId === 'employee_approvals' && (currentTab === 'employee_approvals' || currentTab === 'approvals')) return true;
    return false;
  };

  // Ref untuk melacak perubahan activeTab agar toggle manual folder tidak dipaksa terbuka kembali
  const prevActiveTabRef = useRef(activeTab);

  // Otomatis buka folder parent HANYA saat pengguna berpindah tab/halaman baru
  useEffect(() => {
    if (prevActiveTabRef.current !== activeTab) {
      prevActiveTabRef.current = activeTab;
      currentSidebarItems.forEach((item) => {
        if (item.isFolder && item.children?.some((c) => isTabActive(c.id, activeTab))) {
          setOpenFolders((prev) => ({ ...prev, [item.id]: true }));
        }
      });
    }
  }, [activeTab]);

  // Bottom Navigation Items on Mobile (Urutan: Beranda, Presensi, Tugas Saya, Ruang Obrolan, Pengajuan)
  const mobileBottomItems = isSuperAdmin
    ? [
        { id: 'dashboard', label: 'Beranda', badge: null },
        { id: 'history', label: 'Presensi', badge: null },
        { id: 'tasks_team', label: 'Tugas Tim', badge: pendingTasksCount },
        { id: 'chat_room', label: 'Ruang Obrolan', badge: null },
        { id: 'leaves_approval', label: 'Izin Tim', badge: pendingLeavesCount },
      ]
    : isAdmin
    ? [
        { id: 'dashboard', label: 'Beranda', badge: null },
        { id: 'clock', label: 'Presensi', badge: null },
        { id: 'tasks_team', label: 'Tugas Tim', badge: pendingTasksCount },
        { id: 'chat_room', label: 'Ruang Obrolan', badge: null },
        { id: 'leaves_approval', label: 'Izin Tim', badge: pendingLeavesCount },
      ]
    : [
        { id: 'dashboard', label: 'Beranda', badge: null },
        { id: 'clock', label: 'Presensi', badge: null },
        { id: 'tasks_my', label: 'Tugas Saya', badge: null },
        { id: 'chat_room', label: 'Ruang Obrolan', badge: null },
        { id: 'leaves_my', label: 'Pengajuan', badge: null },
      ];

  const currentActiveItem = currentSidebarItems
    .flatMap((item) => (item.isFolder ? (item.children || []) : [item]))
    .find((item) => isTabActive(item.id, activeTab)) || (activeTab === 'profile' ? { id: 'profile', label: 'Biodata Diri' } : undefined);

  const handleTabClick = (tabId: string) => {
    if (tabId === activeTab) {
      if (mainContentRef.current) {
        mainContentRef.current.scrollTo({ top: 0, left: 0, behavior: 'smooth' });
        mainContentRef.current.scrollTop = 0;
      }
      window.scrollTo({ top: 0, left: 0, behavior: 'smooth' });
    } else {
      onTabChange(tabId);
    }
  };

  const handleMobileNavClick = (tabId: string) => {
    if (tabId === activeTab) {
      if (mainContentRef.current) {
        mainContentRef.current.scrollTo({ top: 0, left: 0, behavior: 'smooth' });
        mainContentRef.current.scrollTop = 0;
      }
      window.scrollTo({ top: 0, left: 0, behavior: 'smooth' });
    } else {
      onTabChange(tabId);
    }
    setMobileMenuOpen(false);
  };

  const todayFormatted = new Intl.DateTimeFormat('id-ID', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(new Date());

  const todayDatePill = new Intl.DateTimeFormat('id-ID', {
    weekday: 'long',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date());

  return (
    // FULL SCREEN LAYOUT (Edge-to-edge matching ChronoTask style)
    <div className="h-screen w-full overflow-hidden bg-[#F8FAFC] text-slate-800 flex flex-col md:flex-row font-sans antialiased selection:bg-slate-900 selection:text-white relative">
      
      {/* DESKTOP/TABLET SIDEBAR NAVIGATION (Matching left sidebar from screenshot) */}
      <aside className="hidden md:flex w-52 lg:w-56 h-full bg-white border-r border-slate-200/80 shrink-0 flex flex-col justify-between p-3 sm:p-4 select-none min-h-0 overflow-y-auto">
          
          <div className="space-y-4">
            {/* Brand Logo Header */}
            <div className="flex items-center gap-2.5 pb-2 px-3">
              <span className="font-extrabold text-[#1E3A8A] text-xl tracking-tight select-none">
                absenku
              </span>
            </div>

            {/* Section: Menu with Colored Icons & Folders */}
            <div className="space-y-1">
              {currentSidebarItems.map((item) => {
                if (item.isFolder) {
                  const isFolderActive = item.children?.some((c) => isTabActive(c.id, activeTab));
                  const isOpen = openFolders[item.id] ?? true;

                  return (
                    <div key={item.id} className="space-y-1 pt-0.5">
                      {/* Parent Folder Button dengan Tooltip & Icon Spesifik */}
                      <Tooltip content={item.label} position="top" className="w-full block">
                        <button
                          type="button"
                          onClick={() => toggleFolder(item.id)}
                          title={item.label}
                          className={`group w-full flex items-center justify-between px-3 py-2 text-xs font-semibold rounded-2xl transition-all duration-200 cursor-pointer select-none ${
                            isFolderActive
                              ? 'bg-slate-100/90 text-slate-900 font-bold shadow-2xs'
                              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                          }`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <NavIcon tabId={item.id} isActive={isFolderActive} className="w-7 h-7 shrink-0" />
                            <span className="tracking-tight text-xs font-semibold truncate">
                              {item.label}
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            {item.badge !== null && item.badge !== undefined && !isOpen && (
                              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${item.badgeColor || 'bg-amber-100 text-amber-800 border border-amber-200'}`}>
                                {item.badge}
                              </span>
                            )}
                            <ChevronRight
                              className={`w-3.5 h-3.5 text-slate-400 group-hover:text-slate-600 transition-transform duration-200 ${
                                isOpen ? 'rotate-90 text-[#1E3A8A]' : ''
                              }`}
                            />
                          </div>
                        </button>
                      </Tooltip>

                      {/* Subfolder Children dengan Tooltip agar menu yang terpotong terlihat jelas */}
                      {isOpen && (
                        <div className="ml-5 pl-2.5 border-l-2 border-slate-200 space-y-1 py-1 animate-in fade-in duration-150">
                          {item.children?.map((child) => {
                            const isChildActive = isTabActive(child.id, activeTab);
                            return (
                              <Tooltip key={child.id} content={child.label} position="top" className="w-full block">
                                <button
                                  type="button"
                                  onClick={() => handleTabClick(child.id)}
                                  title={child.label}
                                  className={`w-full flex items-center justify-between px-2.5 py-1.5 text-xs rounded-xl transition-all cursor-pointer ${
                                    isChildActive
                                      ? 'bg-blue-50 text-[#1E3A8A] font-bold border border-blue-200/80 shadow-2xs'
                                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50 font-medium'
                                  }`}
                                >
                                  <div className="flex items-center gap-2 min-w-0">
                                    <NavIcon
                                      tabId={child.id}
                                      isActive={isChildActive}
                                      className="w-5 h-5 rounded-lg shrink-0"
                                      iconClassName="w-3 h-3 stroke-[2]"
                                    />
                                    <span className="truncate">{child.label}</span>
                                  </div>
                                  {child.badge !== null && child.badge !== undefined && (
                                    <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded-full ${child.badgeColor || 'bg-blue-100 text-[#1E3A8A] border border-blue-200'}`}>
                                      {child.badge}
                                    </span>
                                  )}
                                </button>
                              </Tooltip>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                }

                const isActive = isTabActive(item.id, activeTab);

                return (
                  <Tooltip key={item.id} content={item.label} position="top" className="w-full block">
                    <button
                      type="button"
                      onClick={() => handleTabClick(item.id)}
                      title={item.label}
                      className={`group w-full flex items-center justify-between px-3 py-2 text-xs font-semibold rounded-2xl transition-all duration-200 whitespace-nowrap shrink-0 cursor-pointer ${
                        isActive
                          ? 'bg-slate-100 text-slate-900 font-bold shadow-2xs'
                          : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <NavIcon tabId={item.id} isActive={isActive} className="w-7 h-7 shrink-0" />
                        <span className="tracking-tight text-xs font-medium truncate">{item.label}</span>
                      </div>

                      {item.badge !== null && item.badge !== undefined && (
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                          item.badgeColor || 'bg-blue-100 text-[#1E3A8A] border border-blue-200'
                        }`}>
                          {item.badge}
                        </span>
                      )}
                    </button>
                  </Tooltip>
                );
              })}
            </div>
          </div>

          {/* 5. Bottom Logout Link dengan Tooltip */}
          <div className="border-t border-slate-150 pt-3 space-y-1 text-xs">
            <Tooltip content="Keluar dari sesi akun Anda" position="top" className="w-full block">
              <button
                type="button"
                onClick={onLogout}
                title="Keluar dari Akun"
                className="w-full flex items-center gap-2.5 px-3 py-2 text-rose-600 hover:text-rose-700 hover:bg-rose-50/70 rounded-xl transition-colors cursor-pointer font-medium"
              >
                <LogOut className="w-4 h-4 text-rose-400" />
                <span>Keluar dari Akun</span>
              </button>
            </Tooltip>
          </div>
        </aside>

        {/* RIGHT WORKSPACE AREA */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden glass-page-bg relative">
          {/* TOP PERSISTENT NAVBAR HEADER */}
          <header className="h-14 bg-white border-b border-slate-200/80 px-4 sm:px-5 lg:px-6 flex items-center justify-between shrink-0 relative z-20">
            {/* Left: Mobile hamburger + Active Tab Title & Colored Icon + Date Pill */}
            <div className="flex items-center gap-3 min-w-0">
              <button
                type="button"
                onClick={() => setMobileMenuOpen(true)}
                className="md:hidden p-2 -ml-1 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
                title="Buka Menu Navigasi"
                aria-label="Buka Menu"
              >
                <Menu className="w-5 h-5" />
              </button>

              {/* Date Capsule Pill (Posisi di Navbar) dengan Tooltip */}
              <Tooltip content={`Hari & Tanggal: ${todayFormatted}`} position="bottom">
                <div
                  title={`Hari & Tanggal: ${todayFormatted}`}
                  className="flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1 sm:py-1.5 bg-white border border-slate-200/90 rounded-full shadow-2xs text-[11px] sm:text-xs font-semibold text-slate-700 max-w-[160px] xs:max-w-none cursor-default"
                >
                  <Calendar className="w-3.5 h-3.5 text-[#1E3A8A] shrink-0" />
                  <span className="truncate">{todayDatePill}</span>
                </div>
              </Tooltip>
            </div>

            {/* Right: Offline status + User Profile Photo & Name */}
            <div className="flex items-center gap-3">
              {!isOnline && (
                <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-50 border border-amber-200 text-amber-700 text-xs font-medium">
                  <WifiOff className="w-3.5 h-3.5" />
                  <span>Mode Offline</span>
                </div>
              )}

              {/* Profile User Dropdown Pill in Navbar dengan Tooltip */}
              <div className="relative">
                <Tooltip
                  content={`${currentUser.name} • ${getRoleAndTypeLabel()} (${currentUser.position || currentUser.department || 'Karyawan'})`}
                  position="bottom"
                  disabled={profileDropdownOpen}
                >
                  <button
                    type="button"
                    onClick={() => setProfileDropdownOpen(!profileDropdownOpen)}
                    title={`${currentUser.name} • ${getRoleAndTypeLabel()}`}
                    className="flex items-center gap-2.5 p-1 sm:pl-1.5 sm:pr-3 sm:py-1 rounded-full bg-slate-50 hover:bg-slate-100/90 border border-slate-200/90 transition-all cursor-pointer group shadow-2xs"
                    aria-label="Menu Profil Pengguna"
                  >
                    {/* Foto Profile */}
                    <div className="relative shrink-0">
                      {currentUser.avatar ? (
                        <img
                          src={currentUser.avatar}
                          alt={currentUser.name}
                          className="w-8 h-8 rounded-full object-cover border border-slate-200 shadow-2xs"
                        />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-indigo-50 border border-indigo-200 text-indigo-700 flex items-center justify-center font-bold text-xs">
                          {currentUser.name.charAt(0)}
                        </div>
                      )}
                    </div>

                    {/* Nama Pengguna & Tanggal (Menggantikan teks biodata/posisi) */}
                    <div className="text-left hidden sm:block max-w-[130px] md:max-w-[170px]">
                      <p className="text-xs font-semibold text-slate-800 group-hover:text-slate-900 truncate leading-tight">
                        {currentUser.name}
                      </p>
                      <p className="text-[10px] text-slate-400 group-hover:text-slate-500 truncate leading-tight capitalize flex items-center gap-1">
                        <Calendar className="w-3 h-3 text-slate-400 shrink-0" />
                        <span className="truncate">{todayFormatted}</span>
                      </p>
                    </div>

                    <ChevronDown
                      className={`w-3.5 h-3.5 text-slate-400 group-hover:text-slate-600 transition-transform duration-200 ${
                        profileDropdownOpen ? 'rotate-180' : ''
                      }`}
                    />
                  </button>
                </Tooltip>

                {/* Profile Dropdown Popover matching image_b46ecaf3.png & image_b8bd08d5.png */}
                {profileDropdownOpen && (
                  <>
                    <div
                      className="fixed inset-0 z-40"
                      onClick={() => setProfileDropdownOpen(false)}
                    />
                    <div className="absolute right-0 mt-2.5 w-[calc(100vw-1.5rem)] max-w-[340px] sm:max-w-none sm:w-96 bg-white/95 backdrop-blur-xl rounded-[28px] shadow-[0_20px_50px_rgba(15,23,42,0.22)] border border-white/80 p-4 sm:p-6 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
                      {/* Top Bar: Administrator di Kiri (tanpa icon, bg putih, tulisan hitam), Posisi/Jabatan di Kanan */}
                      <div className="flex items-center justify-between gap-2 pb-3 text-xs border-b border-slate-100">
                        {/* Role: background putih, font hitam seperti posisi */}
                        <span className="px-2.5 py-0.5 rounded-full bg-white text-slate-800 border border-slate-200/90 font-semibold text-xs shrink-0 shadow-2xs">
                          {getRoleAndTypeLabel()}
                        </span>

                        {/* Posisi/Jabatan di Kanan dengan Tooltip */}
                        <Tooltip content={currentUser.position || currentUser.department || 'Staf Operasional'} position="top">
                          <span
                            className="truncate max-w-[170px] sm:max-w-[200px] text-slate-600 font-semibold tracking-tight text-right block"
                            title={currentUser.position || currentUser.department || 'Posisi'}
                          >
                            {currentUser.position || currentUser.department || 'Staf Operasional'}
                          </span>
                        </Tooltip>
                      </div>

                      {/* Middle Row: Large Avatar dengan Green Online Dot, User Name, dan Email (Tanpa Divisi) */}
                      <div className="flex items-center gap-3.5 my-4">
                        <div className="relative shrink-0">
                          {currentUser.avatar ? (
                            <img
                              src={currentUser.avatar}
                              alt={currentUser.name}
                              className="w-14 h-14 sm:w-16 sm:h-16 rounded-full object-cover border-2 border-white shadow-md ring-2 ring-slate-100"
                            />
                          ) : (
                            <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-[#1E3A8A] text-white font-extrabold text-xl flex items-center justify-center border-2 border-white shadow-md ring-2 ring-slate-100">
                              {currentUser.name.charAt(0)}
                            </div>
                          )}
                          {/* Green Online Dot Status Indicator */}
                          <span className="absolute bottom-0 right-0 w-3.5 h-3.5 rounded-full bg-emerald-500 ring-2 ring-white shadow-2xs" />
                        </div>

                        <div className="min-w-0 flex-1">
                          <Tooltip content={currentUser.name} position="top" className="block max-w-full">
                            <h3
                              className="text-base sm:text-lg font-bold text-slate-900 truncate leading-snug tracking-tight"
                              title={currentUser.name}
                            >
                              {currentUser.name}
                            </h3>
                          </Tooltip>

                          <Tooltip content={currentUser.email} position="bottom" className="block max-w-full">
                            <div
                              className="flex items-center gap-1.5 mt-1 text-xs text-slate-500 font-medium truncate"
                              title={currentUser.email}
                            >
                              <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                              <span className="truncate">{currentUser.email}</span>
                            </div>
                          </Tooltip>
                        </div>
                      </div>

                      {/* Action Row: Biodata Diri Saja */}
                      <div className="pt-2.5">
                        <button
                          type="button"
                          onClick={() => {
                            setProfileDropdownOpen(false);
                            handleTabClick('profile');
                          }}
                          className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-slate-100/90 hover:bg-slate-200/80 active:scale-[0.98] border border-slate-200/80 text-slate-800 font-semibold text-xs transition-all cursor-pointer shadow-2xs"
                        >
                          <UserIcon className="w-3.5 h-3.5 text-slate-600 shrink-0" />
                          <span>Biodata Diri</span>
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          </header>

          {/* MAIN SCROLLABLE CONTENT AREA WITH COLORLESS CLEAR GLASS CANVAS */}
          <main
            ref={mainContentRef}
            className="flex-1 min-w-0 overflow-y-auto p-3 sm:p-5 lg:p-8 pb-20 md:pb-8 min-h-0 glass-page-bg relative"
          >
            <div>
              {children}
            </div>
          </main>
        </div>

      {/* 3. MOBILE BOTTOM NAVIGATION BAR (Thumb-friendly for Smartphones with Safe Area) */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 bg-white/95 backdrop-blur-md border-t border-slate-200/90 z-40 px-1 xs:px-2 pt-1.5 pb-[max(0.5rem,env(safe-area-inset-bottom))] flex items-center justify-around shadow-lg">
        {mobileBottomItems.map((item) => {
          const isActive = isTabActive(item.id, activeTab);

          return (
            <Tooltip key={item.id} content={item.label} position="top" className="flex-1 min-w-0">
              <button
                type="button"
                onClick={() => handleMobileNavClick(item.id)}
                title={item.label}
                className={`relative flex flex-col items-center justify-center w-full py-1 px-0.5 rounded-xl transition-colors cursor-pointer ${
                  isActive ? 'text-slate-900 font-bold' : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                <div className="relative">
                  <NavIcon tabId={item.id} isActive={isActive} className="w-6.5 h-6.5 xs:w-7 xs:h-7" />
                  {item.badge && item.badge > 0 ? (
                    <span className="absolute -top-1 -right-2 px-1 py-0.5 rounded-full text-[10px] font-bold bg-[#1E3A8A] text-white min-w-[14px] text-center leading-none">
                      {item.badge}
                    </span>
                  ) : null}
                </div>
                <span className={`text-[10px] xs:text-[11px] mt-0.5 tracking-tight truncate max-w-[70px] xs:max-w-[80px] text-center ${isActive ? 'font-bold text-slate-900' : 'font-medium text-slate-500'}`}>
                  {item.label}
                </span>
              </button>
            </Tooltip>
          );
        })}
      </nav>

      {/* 4. MOBILE SLIDE-OVER DRAWER (Muncul dari Sisi Kiri dengan Animasi Slide In & Out Halus) */}
      <div
        className={`md:hidden fixed inset-0 z-50 flex transition-visibility duration-300 ${
          mobileMenuOpen ? 'pointer-events-auto visible' : 'pointer-events-none invisible'
        }`}
      >
        {/* Backdrop (Fade in / Fade out) */}
        <div
          className={`fixed inset-0 bg-slate-950/50 backdrop-blur-xs transition-opacity duration-300 ease-in-out ${
            mobileMenuOpen ? 'opacity-100' : 'opacity-0'
          }`}
          onClick={() => setMobileMenuOpen(false)}
        />

        {/* Drawer Sheet (Muncul dari KIRI dengan Slide In / Out) */}
        <div
          className={`relative mr-auto w-full max-w-[280px] xs:max-w-xs bg-white h-full shadow-2xl flex flex-col z-10 transition-transform duration-300 ease-out transform ${
            mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
        >
          {/* Drawer Header (Brand Logo & Tombol Tutup Menu) */}
          <div className="p-4 sm:p-5 border-b border-slate-200 flex items-center justify-between">
            <span className="font-extrabold text-[#1E3A8A] text-2xl tracking-tight select-none">
              absenku
            </span>
            <button
              type="button"
              onClick={() => setMobileMenuOpen(false)}
              className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
              title="Tutup Menu"
              aria-label="Tutup Menu"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* User Info Card inside Drawer */}
          <div className="p-4 bg-slate-50 border-b border-slate-200 space-y-3">
            <div className="flex items-center gap-3">
              {!isAdmin && currentUser.avatar ? (
                <img
                  src={currentUser.avatar}
                  alt={currentUser.name}
                  className="w-11 h-11 rounded-full object-cover border border-slate-200 shrink-0"
                />
              ) : (
                <div className="w-11 h-11 rounded-full bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-700 font-bold shrink-0">
                  <UserIcon className="w-5 h-5" />
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="font-bold text-sm text-slate-900 truncate">{currentUser.name}</p>
                <p className="text-xs text-slate-500 truncate">{currentUser.department || (isAdmin ? 'Administrator' : getRoleAndTypeLabel())}</p>
              </div>
            </div>

            {/* Quick Access to Biodata Diri from Drawer */}
            <button
              type="button"
              onClick={() => {
                setMobileMenuOpen(false);
                handleTabClick('profile');
              }}
              className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-white hover:bg-slate-100 active:scale-[0.98] border border-slate-200 text-slate-700 font-semibold text-xs transition-all cursor-pointer shadow-2xs"
            >
              <UserIcon className="w-3.5 h-3.5 text-slate-600 shrink-0" />
              <span>Biodata Diri</span>
            </button>
          </div>

          {/* Navigation Links */}
          <div className="flex-1 overflow-y-auto p-3.5 space-y-1.5 custom-scrollbar">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider px-2 py-1">
              Semua Menu
            </p>
            {currentSidebarItems.map((item) => {
              if (item.isFolder) {
                const isFolderActive = item.children?.some((c) => isTabActive(c.id, activeTab));
                const isOpen = openFolders[item.id] ?? true;

                return (
                  <div key={item.id} className="space-y-1">
                    <Tooltip content={item.label} position="top" className="w-full block">
                      <button
                        type="button"
                        onClick={() => toggleFolder(item.id)}
                        title={item.label}
                        className={`w-full flex items-center justify-between px-3.5 py-2.5 text-sm font-semibold rounded-2xl transition-colors cursor-pointer min-h-[48px] ${
                          isFolderActive
                            ? 'bg-slate-100/90 text-slate-900 font-bold border border-slate-200/80 shadow-xs'
                            : 'text-slate-700 hover:bg-slate-100'
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <NavIcon tabId={item.id} isActive={isFolderActive} className="w-8 h-8 shrink-0" />
                          <span className="tracking-tight truncate">{item.label}</span>
                        </div>
                        <ChevronRight
                          className={`w-4 h-4 text-slate-400 shrink-0 transition-transform duration-200 ${
                            isOpen ? 'rotate-90 text-[#1E3A8A]' : ''
                          }`}
                        />
                      </button>
                    </Tooltip>

                    {isOpen && (
                      <div className="ml-6 pl-3 border-l-2 border-slate-200 space-y-1.5 py-1">
                        {item.children?.map((child) => {
                          const isChildActive = isTabActive(child.id, activeTab);
                          return (
                            <Tooltip key={child.id} content={child.label} position="top" className="w-full block">
                              <button
                                key={child.id}
                                type="button"
                                onClick={() => handleMobileNavClick(child.id)}
                                title={child.label}
                                className={`w-full flex items-center justify-between px-3 py-2 text-sm rounded-xl transition-colors cursor-pointer ${
                                  isChildActive
                                    ? 'bg-blue-50 text-[#1E3A8A] font-bold border border-blue-200'
                                    : 'text-slate-600 hover:bg-slate-100'
                                }`}
                              >
                                <div className="flex items-center gap-2.5 min-w-0">
                                  <NavIcon
                                    tabId={child.id}
                                    isActive={isChildActive}
                                    className="w-6 h-6 rounded-lg shrink-0"
                                    iconClassName="w-3.5 h-3.5 stroke-[2]"
                                  />
                                  <span className="truncate">{child.label}</span>
                                </div>
                                {child.badge !== null && child.badge !== undefined && (
                                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full shrink-0 ${child.badgeColor || 'bg-amber-100 text-amber-800 border border-amber-200'}`}>
                                    {child.badge}
                                  </span>
                                )}
                              </button>
                            </Tooltip>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              }

              const isActive = isTabActive(item.id, activeTab);

              return (
                <Tooltip key={item.id} content={item.label} position="top" className="w-full block">
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleMobileNavClick(item.id)}
                    title={item.label}
                    className={`w-full flex items-center justify-between px-3.5 py-2.5 text-sm font-semibold rounded-2xl transition-colors cursor-pointer min-h-[48px] ${
                      isActive
                        ? 'bg-slate-100/90 text-slate-900 font-bold border border-slate-200/80 shadow-xs'
                        : 'text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <NavIcon tabId={item.id} isActive={isActive} className="w-8 h-8 shrink-0" />
                      <span className="tracking-tight truncate">{item.label}</span>
                    </div>

                    {item.badge !== null && item.badge !== undefined && (
                      <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-200 shrink-0">
                        {item.badge}
                      </span>
                    )}
                  </button>
                </Tooltip>
              );
            })}
          </div>

          {/* Drawer Footer Actions */}
          <div className="p-4 border-t border-slate-200 bg-slate-50 space-y-2">
            <button
              type="button"
              onClick={() => {
                setMobileMenuOpen(false);
                onLogout();
              }}
              className="w-full flex items-center justify-center gap-2 py-3 bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold rounded-xl text-sm transition-colors border border-rose-200 cursor-pointer min-h-[44px]"
            >
              <LogOut className="w-4 h-4" />
              <span>Keluar dari Akun</span>
            </button>
          </div>
        </div>
      </div>

    </div>
  );
}
