import React, { useState, useMemo } from 'react';
import {
  Search,
  Maximize2,
  Minimize2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  X,
  Check,
  FileSpreadsheet,
  Clock,
  Calendar,
  AlertCircle,
  Building2,
  Laptop,
  CalendarDays,
  LayoutGrid,
  ListFilter,
  User as UserIcon,
  Edit3,
  MapPin,
} from 'lucide-react';
import {
  AttendanceRecord,
  User,
  LeaveRequest,
  DailyTaskLog,
  UserRole,
  EmploymentType,
} from '../../types/index.ts';
import {
  downloadAttendanceSpreadsheet,
  downloadPersonalAttendanceSpreadsheet,
} from '../../lib/csv-export.ts';
import { formatIndonesianDate, getCurrentDateString } from '../../lib/time-utils.ts';
import { AppStorage } from '../../lib/storage.ts';
import { Tooltip } from '../ui/tooltip.tsx';
import { SimpleProfileModal, SimpleProfileData } from '../common/SimpleProfileModal.tsx';
import { TeamMembersModal, TeamMemberItem } from '../common/TeamMembersModal.tsx';
import { EditAttendanceModal } from '../admin/EditAttendanceModal.tsx';

interface AttendanceHistoryProps {
  currentUser?: User;
  users?: User[];
  attendanceRecords?: AttendanceRecord[];
  records?: AttendanceRecord[];
  leaves?: LeaveRequest[];
  dailyTasks?: DailyTaskLog[];
  userRole?: UserRole;
  currentUserId?: string;
  onUpdateRecord?: (rec: AttendanceRecord) => void;
  onUpdateRole?: (userId: string, newRole: UserRole) => void;
  onUpdateType?: (userId: string, newType: EmploymentType) => void;
  onToggleStatus?: (userId: string) => void;
}

// Data row untuk Tampilan Matriks Grid Kehadiran sesuai referensi gambar screenshot (image_5f53700d.png)
interface MatrixRow {
  index: number;
  dateStr: string; // "21/10/2026"
  rawDate: string; // "2026-10-21"
  isHoliday: boolean; // Sabtu/Minggu atau hari libur
  checkIn: {
    hasCheckmark: boolean;
    avatars: string[];
    countBadge?: string; // "+10", "+14", "+17"
    isPurple?: boolean; // Border ungu jika check-in aktif
  };
  cutiAvatars: string[]; // Foto avatar karyawan yang sedang cuti/izin
  statuses: Record<string, 'Hadir' | 'Tidak Hadir' | 'Cuti/Izin' | 'Libur'>;
}

export function AttendanceHistory({
  currentUser: propCurrentUser,
  users: propUsers,
  attendanceRecords: propAttendanceRecords,
  records: propRecords,
  leaves: propLeaves,
  dailyTasks: propDailyTasks,
  userRole,
  onUpdateRecord,
}: AttendanceHistoryProps) {
  const currentUser = propCurrentUser || AppStorage.getCurrentUser() || ({} as User);
  const users = propUsers || AppStorage.getUsers() || [];
  const attendanceRecords = propAttendanceRecords || propRecords || AppStorage.getAttendanceRecords() || [];
  const leaves = propLeaves || AppStorage.getLeaveRequests() || [];
  const dailyTasks = propDailyTasks || AppStorage.getDailyTasks() || [];

  const isAdmin =
    userRole === 'ADMIN' ||
    userRole === 'SUPER_ADMIN' ||
    currentUser.role === 'ADMIN' ||
    currentUser.role === 'SUPER_ADMIN';

  // State tampilan & filter
  const [viewMode, setViewMode] = useState<'matrix' | 'classic'>(() =>
    currentUser.role === 'SUPER_ADMIN' ? 'matrix' : 'matrix'
  );
  const [editingRecord, setEditingRecord] = useState<AttendanceRecord | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [dateFilterOpen, setDateFilterOpen] = useState(false);
  const [specificDateFilter, setSpecificDateFilter] = useState('');
  const [sortOrder, setSortOrder] = useState<'DESC' | 'ASC'>('DESC');
  const [filterType, setFilterType] = useState<'ALL' | 'WORKDAY' | 'HOLIDAY'>('ALL');
  const [personalCategoryFilter, setPersonalCategoryFilter] = useState<
    'ALL' | 'LEAVE' | 'WFH' | 'SICK' | 'BUSINESS_TRIP'
  >('ALL');
  const [selectedCellInfo, setSelectedCellInfo] = useState<{
    name: string;
    date: string;
    status: string;
  } | null>(null);
  const [isCellInfoModalFullScreen, setIsCellInfoModalFullScreen] = useState(false);
  const [simpleProfilePopup, setSimpleProfilePopup] = useState<SimpleProfileData | null>(null);

  // Pop Up Multi-Profil untuk Presensi Masuk & Cuti/Izin Tim
  const [teamMembersModalData, setTeamMembersModalData] = useState<{
    isOpen: boolean;
    title: string;
    subtitle?: string;
    date?: string;
    members: TeamMemberItem[];
  }>({
    isOpen: false,
    title: '',
    members: [],
  });
  const [returnToTeamModalOnClose, setReturnToTeamModalOnClose] = useState(false);

  // Roster tim lengkap untuk melengkapi daftar presensi masuk sesuai countBadge
  const fullTeamRoster: TeamMemberItem[] = [
    {
      name: 'Nasywa Davina Alissa Wijaya',
      avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=256&q=80',
      department: 'Teknologi & Engineering',
      role: 'UI/UX Designer',
      statusBadge: 'Hadir (08:00)',
      statusColor: 'emerald',
    },
    {
      name: 'Hendra Pratama',
      avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=256&q=80',
      department: 'Direksi Eksekutif',
      role: 'Chief Executive Officer (CEO)',
      statusBadge: 'Hadir (08:02)',
      statusColor: 'emerald',
    },
    {
      name: 'Sarah Amelia',
      avatar: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=256&q=80',
      department: 'People & Culture (HR)',
      role: 'HR & Operations Manager',
      statusBadge: 'Hadir (08:05)',
      statusColor: 'emerald',
    },
    {
      name: 'Ella Siregar',
      avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=256&q=80',
      department: 'Teknologi & Engineering',
      role: 'Frontend Developer',
      statusBadge: 'Hadir (08:10)',
      statusColor: 'emerald',
    },
    {
      name: 'Fanny Maharani',
      avatar: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=256&q=80',
      department: 'Quality Assurance',
      role: 'QA Engineer',
      statusBadge: 'Hadir (08:12)',
      statusColor: 'emerald',
    },
    {
      name: 'Fida Salsabila',
      avatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=256&q=80',
      department: 'Finance & Accounting',
      role: 'Finance Specialist',
      statusBadge: 'Hadir (08:15)',
      statusColor: 'emerald',
    },
    {
      name: 'Budi Santoso',
      avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=256&q=80',
      department: 'Teknologi & Engineering',
      role: 'Junior Frontend Developer',
      statusBadge: 'Hadir (08:16)',
      statusColor: 'emerald',
    },
    {
      name: 'Awang Darmawan',
      avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=256&q=80',
      department: 'Teknologi & Engineering',
      role: 'Fullstack Developer',
      statusBadge: 'Hadir (08:18)',
      statusColor: 'emerald',
    },
    {
      name: 'Fikar Ramadhan',
      avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=256&q=80',
      department: 'Teknologi & Engineering',
      role: 'Backend Engineer',
      statusBadge: 'Hadir (08:20)',
      statusColor: 'emerald',
    },
    {
      name: 'Rian Pratama',
      avatar: 'https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?auto=format&fit=crop&w=256&q=80',
      department: 'Infrastruktur & DevOps',
      role: 'DevOps Specialist',
      statusBadge: 'Hadir (08:22)',
      statusColor: 'emerald',
    },
    {
      name: 'Dewi Lestari',
      avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=256&q=80',
      department: 'Product Management',
      role: 'Product Lead',
      statusBadge: 'Hadir (08:25)',
      statusColor: 'emerald',
    },
    {
      name: 'Dimas Anggara',
      avatar: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?auto=format&fit=crop&w=256&q=80',
      department: 'Teknologi & Engineering',
      role: 'Mobile Developer',
      statusBadge: 'Hadir (08:26)',
      statusColor: 'emerald',
    },
    {
      name: 'Siti Rahma',
      avatar: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?auto=format&fit=crop&w=256&q=80',
      department: 'Marketing & Komunikasi',
      role: 'Content Strategist',
      statusBadge: 'Hadir (08:28)',
      statusColor: 'emerald',
    },
    {
      name: 'Kevin Sanjaya',
      avatar: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=256&q=80',
      department: 'Data Analytics',
      role: 'Data Analyst',
      statusBadge: 'Hadir (08:30)',
      statusColor: 'emerald',
    },
    {
      name: 'Aulia Putri',
      avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=256&q=80',
      department: 'Operasional & CS',
      role: 'Customer Support Lead',
      statusBadge: 'Hadir (08:31)',
      statusColor: 'emerald',
    },
    {
      name: 'Bagus Wicaksono',
      avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&w=256&q=80',
      department: 'IT Support',
      role: 'System Administrator',
      statusBadge: 'Hadir (08:33)',
      statusColor: 'emerald',
    },
    {
      name: 'Mega Utami',
      avatar: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=256&q=80',
      department: 'Finance & Accounting',
      role: 'Senior Accountant',
      statusBadge: 'Hadir (08:35)',
      statusColor: 'emerald',
    },
    {
      name: 'Reza Rahadian',
      avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=256&q=80',
      department: 'Bisnis & Kemitraan',
      role: 'Business Development',
      statusBadge: 'Hadir (08:38)',
      statusColor: 'emerald',
    },
  ];

  // Helper untuk membuka pop-up semua orang yang presensi masuk pada tanggal tersebut
  const handleOpenCheckInMembersModal = (row: MatrixRow) => {
    const list: TeamMemberItem[] = [];
    const addedNames = new Set<string>();

    const isOutOfRangeDate = row.rawDate === '2026-10-15' || row.rawDate === '2026-10-20';

    // 1. Ambil dari kolom matriks yang statusnya 'Hadir'
    employeeColumns.forEach((colName) => {
      if (row.statuses[colName] === 'Hadir') {
        const fullName = employeeNamesMap[colName] || colName;
        const avatar = employeeAvatarMap[colName] || sampleAvatars[0];
        list.push({
          name: fullName,
          avatar,
          department: 'Divisi Operasional',
          role: 'Karyawan',
          statusBadge: 'Hadir (08:00)',
          statusColor: 'emerald',
          locationBadge: isOutOfRangeDate ? 'Di Luar Kantor' : 'Di Kantor',
          locationColor: isOutOfRangeDate ? 'amber' : 'emerald',
        });
        addedNames.add(fullName);
      }
    });

    // 2. Ambil dari attendance records riil jika ada
    const allRecords = attendanceRecords || [];
    allRecords
      .filter((rec) => rec.date === row.rawDate && rec.clockInTime)
      .forEach((rec) => {
        if (!addedNames.has(rec.userName)) {
          const isOutOfRange = rec.clockInLocationStatus === 'OUT_OF_RANGE' || rec.workMode === 'WFH';
          list.push({
            name: rec.userName,
            avatar: rec.userAvatar,
            department: 'Divisi Operasional',
            role: 'Karyawan',
            statusBadge: `Hadir (${rec.clockInTime})`,
            statusColor: 'emerald',
            locationBadge: isOutOfRange ? 'Di Luar Kantor' : 'Di Kantor',
            locationColor: isOutOfRange ? 'amber' : 'emerald',
          });
          addedNames.add(rec.userName);
        }
      });

    // 3. Lengkapi dari daftar tim sesuai countBadge jika ada (misal +10, +14, +17)
    let targetCount = list.length;
    if (row.checkIn.countBadge) {
      const matchNum = row.checkIn.countBadge.match(/\d+/);
      if (matchNum) {
        targetCount = Math.max(targetCount, (row.checkIn.avatars?.length || 3) + parseInt(matchNum[0], 10));
      }
    }

    fullTeamRoster.forEach((member) => {
      if (list.length < targetCount && !addedNames.has(member.name)) {
        const isCuti = employeeColumns.some(
          (col) => employeeNamesMap[col] === member.name && row.statuses[col] === 'Cuti/Izin'
        );
        if (!isCuti) {
          list.push({
            ...member,
            statusBadge: 'Hadir (08:00)',
            statusColor: 'emerald',
            locationBadge: 'Di Kantor',
            locationColor: 'emerald',
          });
          addedNames.add(member.name);
        }
      }
    });

    setTeamMembersModalData({
      isOpen: true,
      title: 'Daftar Presensi Masuk',
      subtitle: `Tanggal ${row.dateStr} • ${list.length} Karyawan Hadir`,
      date: row.rawDate,
      members: list,
    });
  };

  // Helper untuk membuka pop-up semua orang yang cuti / izin pada tanggal tersebut
  const handleOpenCutiMembersModal = (row: MatrixRow) => {
    const list: TeamMemberItem[] = [];
    const addedNames = new Set<string>();

    // 1. Kolom matriks yang statusnya 'Cuti/Izin'
    employeeColumns.forEach((colName) => {
      if (row.statuses[colName] === 'Cuti/Izin') {
        const fullName = employeeNamesMap[colName] || colName;
        const avatar = employeeAvatarMap[colName] || cutiAvatarAwang;
        list.push({
          name: fullName,
          avatar,
          department: 'Divisi Operasional',
          role: 'Karyawan',
          statusBadge: 'Cuti / Izin',
          statusColor: 'amber',
        });
        addedNames.add(fullName);
      }
    });

    // 2. Ambil dari leaves yang disetujui untuk tanggal ini
    (leaves || [])
      .filter((l) => l.status === 'APPROVED' && row.rawDate >= l.startDate && row.rawDate <= l.endDate)
      .forEach((l) => {
        if (!addedNames.has(l.userName)) {
          list.push({
            name: l.userName,
            avatar: l.userAvatar,
            department: l.department || 'Divisi Operasional',
            role: 'Karyawan',
            statusBadge: l.category === 'SICK' ? 'Sakit' : 'Cuti Tahunan',
            statusColor: 'amber',
          });
          addedNames.add(l.userName);
        }
      });

    // 3. Dari cutiAvatars jika belum masuk
    row.cutiAvatars.forEach((cav) => {
      const user = findUserByAvatar(cav);
      if (!addedNames.has(user.name)) {
        list.push({
          name: user.name,
          avatar: user.avatar,
          department: 'Divisi Operasional',
          role: 'Karyawan',
          statusBadge: 'Cuti / Izin',
          statusColor: 'amber',
        });
        addedNames.add(user.name);
      }
    });

    setTeamMembersModalData({
      isOpen: true,
      title: 'Daftar Karyawan Cuti / Izin',
      subtitle: `Tanggal ${row.dateStr} • ${list.length} Karyawan Cuti / Izin`,
      members: list,
    });
  };

  // Mapping nama lengkap & foto profil karyawan untuk kolom matriks
  const employeeNamesMap: Record<string, string> = {
    Alis: 'Nasywa Davina Alissa Wijaya',
    Awang: 'Awang Darmawan',
    Ella: 'Ella Siregar',
    Fanny: 'Fanny Maharani',
    Fida: 'Fida Salsabila',
    Fikar: 'Fikar Ramadhan',
  };

  const employeeAvatarMap: Record<string, string> = {
    Alis: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=256&q=80',
    Awang: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=256&q=80',
    Ella: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=256&q=80',
    Fanny: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=256&q=80',
    Fida: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=256&q=80',
    Fikar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=256&q=80',
  };

  const findUserByAvatar = (avatarUrl: string): SimpleProfileData => {
    const matched = users.find((u) => u.avatar === avatarUrl);
    if (matched) return { name: matched.name, avatar: matched.avatar };

    if (avatarUrl.includes('photo-1534528741775') || avatarUrl === sampleAvatars[0]) {
      return { name: 'Nasywa Davina Alissa Wijaya', avatar: avatarUrl };
    }
    if (avatarUrl.includes('photo-1507003211169') || avatarUrl === sampleAvatars[1]) {
      return { name: 'Hendra Pratama', avatar: avatarUrl };
    }
    if (avatarUrl.includes('photo-1494790108377') || avatarUrl === sampleAvatars[2]) {
      return { name: 'Ella Siregar', avatar: avatarUrl };
    }
    if (avatarUrl.includes('photo-1517841905240') || avatarUrl === sampleAvatars[3]) {
      return { name: 'Fanny Maharani', avatar: avatarUrl };
    }
    if (avatarUrl === cutiAvatarAwang || avatarUrl.includes('photo-1500648767791')) {
      return { name: 'Awang Darmawan', avatar: avatarUrl };
    }
    if (avatarUrl === cutiAvatarFikar || avatarUrl.includes('photo-1535713875002')) {
      return { name: 'Fikar Ramadhan', avatar: avatarUrl };
    }
    return { name: 'Karyawan Presensi', avatar: avatarUrl };
  };

  // Pagination State: 10 teratas per halaman
  const [matrixPage, setMatrixPage] = useState(1);
  const [personalPage, setPersonalPage] = useState(1);
  const ITEMS_PER_PAGE = 10;

  // Daftar nama karyawan di kolom matriks (sesuai screenshot: Alis, Awang, Ella, Fanny, Fida, Fikar)
  const employeeColumns = ['Alis', 'Awang', 'Ella', 'Fanny', 'Fida', 'Fikar'];

  // Avatar foto profil realistis untuk check-in avatar stack
  const sampleAvatars = [
    'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=80&q=80',
    'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=80&q=80',
    'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=80&q=80',
    'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=80&q=80',
  ];

  const cutiAvatarAwang =
    'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=80&q=80';
  const cutiAvatarFikar =
    'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=80&q=80';

  // Dataset Baris Matriks Sesuai Persis dengan Screenshot (image_5f53700d.png)
  const baseMatrixRows: MatrixRow[] = [
    {
      index: 1,
      dateStr: '21/10/2026',
      rawDate: '2026-10-21',
      isHoliday: false,
      checkIn: {
        hasCheckmark: true,
        avatars: [sampleAvatars[0], sampleAvatars[1], sampleAvatars[2]],
        countBadge: '+10',
        isPurple: false,
      },
      cutiAvatars: [],
      statuses: {
        Alis: 'Hadir',
        Awang: 'Tidak Hadir',
        Ella: 'Hadir',
        Fanny: 'Hadir',
        Fida: 'Tidak Hadir',
        Fikar: 'Tidak Hadir',
      },
    },
    {
      index: 2,
      dateStr: '20/10/2026',
      rawDate: '2026-10-20',
      isHoliday: false,
      checkIn: {
        hasCheckmark: true,
        avatars: [sampleAvatars[1], sampleAvatars[0], sampleAvatars[3]],
        countBadge: '+14',
        isPurple: false,
      },
      cutiAvatars: [cutiAvatarAwang],
      statuses: {
        Alis: 'Hadir',
        Awang: 'Cuti/Izin',
        Ella: 'Hadir',
        Fanny: 'Hadir',
        Fida: 'Hadir',
        Fikar: 'Tidak Hadir',
      },
    },
    {
      index: 3,
      dateStr: '19/10/2026',
      rawDate: '2026-10-19',
      isHoliday: false,
      checkIn: {
        hasCheckmark: true,
        avatars: [sampleAvatars[2], sampleAvatars[0], sampleAvatars[1]],
        countBadge: '+17',
        isPurple: true,
      },
      cutiAvatars: [cutiAvatarAwang],
      statuses: {
        Alis: 'Hadir',
        Awang: 'Cuti/Izin',
        Ella: 'Hadir',
        Fanny: 'Hadir',
        Fida: 'Hadir',
        Fikar: 'Hadir',
      },
    },
    {
      index: 4,
      dateStr: '18/10/2026',
      rawDate: '2026-10-18',
      isHoliday: true, // Libur Akhir Pekan (Row Merah Lembut)
      checkIn: {
        hasCheckmark: true,
        avatars: [],
      },
      cutiAvatars: [],
      statuses: {
        Alis: 'Libur',
        Awang: 'Libur',
        Ella: 'Libur',
        Fanny: 'Libur',
        Fida: 'Libur',
        Fikar: 'Libur',
      },
    },
    {
      index: 5,
      dateStr: '17/10/2026',
      rawDate: '2026-10-17',
      isHoliday: true, // Libur Akhir Pekan (Row Merah Lembut)
      checkIn: {
        hasCheckmark: true,
        avatars: [sampleAvatars[0], sampleAvatars[1]],
      },
      cutiAvatars: [],
      statuses: {
        Alis: 'Libur',
        Awang: 'Libur',
        Ella: 'Libur',
        Fanny: 'Libur',
        Fida: 'Libur',
        Fikar: 'Libur',
      },
    },
    {
      index: 6,
      dateStr: '16/10/2026',
      rawDate: '2026-10-16',
      isHoliday: false,
      checkIn: {
        hasCheckmark: true,
        avatars: [sampleAvatars[1], sampleAvatars[2], sampleAvatars[0]],
        countBadge: '+17',
        isPurple: true,
      },
      cutiAvatars: [],
      statuses: {
        Alis: 'Hadir',
        Awang: 'Hadir',
        Ella: 'Hadir',
        Fanny: 'Hadir',
        Fida: 'Hadir',
        Fikar: 'Hadir',
      },
    },
    {
      index: 7,
      dateStr: '15/10/2026',
      rawDate: '2026-10-15',
      isHoliday: false,
      checkIn: {
        hasCheckmark: true,
        avatars: [sampleAvatars[0], sampleAvatars[3], sampleAvatars[1]],
        countBadge: '+17',
        isPurple: false,
      },
      cutiAvatars: [],
      statuses: {
        Alis: 'Hadir',
        Awang: 'Hadir',
        Ella: 'Hadir',
        Fanny: 'Hadir',
        Fida: 'Hadir',
        Fikar: 'Hadir',
      },
    },
    {
      index: 8,
      dateStr: '14/10/2026',
      rawDate: '2026-10-14',
      isHoliday: false,
      checkIn: {
        hasCheckmark: true,
        avatars: [sampleAvatars[0], sampleAvatars[2], sampleAvatars[3]],
        countBadge: '+17',
        isPurple: false,
      },
      cutiAvatars: [cutiAvatarFikar],
      statuses: {
        Alis: 'Hadir',
        Awang: 'Hadir',
        Ella: 'Hadir',
        Fanny: 'Hadir',
        Fida: 'Hadir',
        Fikar: 'Cuti/Izin',
      },
    },
    {
      index: 9,
      dateStr: '13/10/2026',
      rawDate: '2026-10-13',
      isHoliday: false,
      checkIn: {
        hasCheckmark: true,
        avatars: [sampleAvatars[0], sampleAvatars[1], sampleAvatars[2]],
        countBadge: '+17',
        isPurple: false,
      },
      cutiAvatars: [cutiAvatarFikar],
      statuses: {
        Alis: 'Hadir',
        Awang: 'Hadir',
        Ella: 'Hadir',
        Fanny: 'Hadir',
        Fida: 'Hadir',
        Fikar: 'Cuti/Izin',
      },
    },
    {
      index: 10,
      dateStr: '12/10/2026',
      rawDate: '2026-10-12',
      isHoliday: false,
      checkIn: {
        hasCheckmark: true,
        avatars: [sampleAvatars[1], sampleAvatars[3], sampleAvatars[0]],
        countBadge: '+17',
        isPurple: false,
      },
      cutiAvatars: [cutiAvatarFikar],
      statuses: {
        Alis: 'Hadir',
        Awang: 'Hadir',
        Ella: 'Hadir',
        Fanny: 'Hadir',
        Fida: 'Hadir',
        Fikar: 'Cuti/Izin',
      },
    },
    {
      index: 11,
      dateStr: '11/10/2026',
      rawDate: '2026-10-11',
      isHoliday: true, // Libur Akhir Pekan (Row Merah Lembut)
      checkIn: {
        hasCheckmark: true,
        avatars: [],
      },
      cutiAvatars: [],
      statuses: {
        Alis: 'Libur',
        Awang: 'Libur',
        Ella: 'Libur',
        Fanny: 'Libur',
        Fida: 'Libur',
        Fikar: 'Libur',
      },
    },
    {
      index: 12,
      dateStr: '10/10/2026',
      rawDate: '2026-10-10',
      isHoliday: true, // Libur Akhir Pekan (Row Merah Lembut)
      checkIn: {
        hasCheckmark: true,
        avatars: [sampleAvatars[2], sampleAvatars[3]],
      },
      cutiAvatars: [],
      statuses: {
        Alis: 'Libur',
        Awang: 'Libur',
        Ella: 'Libur',
        Fanny: 'Libur',
        Fida: 'Libur',
        Fikar: 'Libur',
      },
    },
    {
      index: 13,
      dateStr: '09/10/2026',
      rawDate: '2026-10-09',
      isHoliday: false,
      checkIn: {
        hasCheckmark: true,
        avatars: [sampleAvatars[0], sampleAvatars[1], sampleAvatars[2]],
        countBadge: '+17',
        isPurple: true,
      },
      cutiAvatars: [],
      statuses: {
        Alis: 'Hadir',
        Awang: 'Hadir',
        Ella: 'Hadir',
        Fanny: 'Hadir',
        Fida: 'Hadir',
        Fikar: 'Hadir',
      },
    },
    {
      index: 14,
      dateStr: '08/10/2026',
      rawDate: '2026-10-08',
      isHoliday: false,
      checkIn: {
        hasCheckmark: true,
        avatars: [sampleAvatars[1], sampleAvatars[2], sampleAvatars[3]],
        countBadge: '+17',
        isPurple: false,
      },
      cutiAvatars: [],
      statuses: {
        Alis: 'Hadir',
        Awang: 'Hadir',
        Ella: 'Hadir',
        Fanny: 'Hadir',
        Fida: 'Hadir',
        Fikar: 'Hadir',
      },
    },
    {
      index: 15,
      dateStr: '07/10/2026',
      rawDate: '2026-10-07',
      isHoliday: false,
      checkIn: {
        hasCheckmark: true,
        avatars: [sampleAvatars[0], sampleAvatars[3], sampleAvatars[1]],
        countBadge: '+17',
        isPurple: true,
      },
      cutiAvatars: [],
      statuses: {
        Alis: 'Hadir',
        Awang: 'Hadir',
        Ella: 'Tidak Hadir',
        Fanny: 'Hadir',
        Fida: 'Hadir',
        Fikar: 'Hadir',
      },
    },
  ];

  // Integrasi presensi real-time dari attendanceRecords jika ada data hari ini
  const allMatrixRows = useMemo(() => {
    const today = new Date().toISOString().substring(0, 10);
    const hasTodayInBase = baseMatrixRows.some((r) => r.rawDate === today);

    // Cek apakah ada record presensi tersimpan hari ini
    const todayRecord = attendanceRecords.find((r) => r.date === today);

    if (!hasTodayInBase && todayRecord) {
      const dParts = today.split('-');
      const todayFormatted = `${dParts[2]}/${dParts[1]}/${dParts[0]}`;
      const dayOfWeek = new Date().getDay();
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

      const dynamicRow: MatrixRow = {
        index: 0,
        dateStr: todayFormatted,
        rawDate: today,
        isHoliday: isWeekend,
        checkIn: {
          hasCheckmark: true,
          avatars: [todayRecord.userAvatar || sampleAvatars[0], sampleAvatars[1], sampleAvatars[2]],
          countBadge: '+12',
          isPurple: true,
        },
        cutiAvatars: [],
        statuses: {
          Alis: 'Hadir',
          Awang: 'Hadir',
          Ella: 'Hadir',
          Fanny: 'Hadir',
          Fida: 'Hadir',
          Fikar: 'Hadir',
        },
      };

      return [dynamicRow, ...baseMatrixRows];
    }

    return baseMatrixRows;
  }, [attendanceRecords]);

  // Filter & Urutan Data
  const displayedRows = useMemo(() => {
    let result = [...allMatrixRows];

    // Filter Tipe Hari (Semua / Hari Kerja / Hari Libur)
    if (filterType === 'WORKDAY') {
      result = result.filter((r) => !r.isHoliday);
    } else if (filterType === 'HOLIDAY') {
      result = result.filter((r) => r.isHoliday);
    }

    // Filter Pencarian Tanggal Spesifik (Cari By Tanggal)
    if (specificDateFilter) {
      const formattedInput = specificDateFilter.split('-').reverse().join('/'); // YYYY-MM-DD -> DD/MM/YYYY
      result = result.filter(
        (r) => r.rawDate === specificDateFilter || r.dateStr === formattedInput
      );
    }

    // Filter Pencarian Teks
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter((r) => {
        if (r.dateStr.toLowerCase().includes(q)) return true;
        if (r.rawDate.toLowerCase().includes(q)) return true;
        // Cek nama kolom atau status
        for (const [employee, status] of Object.entries(r.statuses)) {
          if (employee.toLowerCase().includes(q) && status.toLowerCase() === 'hadir') return true;
          if (status.toLowerCase().includes(q)) return true;
        }
        return false;
      });
    }

    // Sorting
    if (sortOrder === 'ASC') {
      result.reverse();
    }

    return result;
  }, [allMatrixRows, filterType, specificDateFilter, searchQuery, sortOrder]);

  // Data Baris untuk Tampilan Absensi Pribadi (Desain persis Kehadiran Tim cuman khusus perorangan)
  const personalRows = useMemo(() => {
    return displayedRows.map((row) => {
      const isWeekendHoliday = row.isHoliday;
      const myRecord = attendanceRecords.find(
        (r) => r.userId === currentUser.id && r.date === row.rawDate
      );
      const myLeave = leaves.find(
        (l) =>
          l.userId === currentUser.id &&
          l.status === 'APPROVED' &&
          row.rawDate >= l.startDate &&
          row.rawDate <= l.endDate
      );
      const myTaskLog = dailyTasks?.find(
        (t) => t.userId === currentUser.id && t.date === row.rawDate
      );

      let statusText = 'Tidak Hadir';
      let statusBadgeClass = 'bg-[#FFE4E6] text-[#E11D48] hover:bg-[#FECDD3]';
      let clockIn = '—';
      let clockOut = '—';
      let locationMode = '—';
      let taskSummary = 'Tanpa Keterangan';
      let hasCheckmark = false;
      let category: 'LEAVE' | 'WFH' | 'SICK' | 'BUSINESS_TRIP' | undefined = undefined;

      if (isWeekendHoliday) {
        statusText = 'Libur';
        hasCheckmark = false;
        clockIn = '-';
        locationMode = 'Libur Akhir Pekan';
        taskSummary = 'Hari Libur';
      } else if (myLeave) {
        category = myLeave.category;
        if (myLeave.category === 'LEAVE') {
          statusText = 'Izin / Cuti';
          statusBadgeClass = 'bg-[#DCFCE7] text-[#15803D] hover:bg-[#BBF7D0]';
          locationMode = 'Izin Resmi';
        } else if (myLeave.category === 'WFH') {
          statusText = 'WFH';
          statusBadgeClass = 'bg-[#FEF3C7] text-[#B45309] hover:bg-[#FDE68A]';
          locationMode = 'WFH (Remote)';
        } else if (myLeave.category === 'SICK') {
          statusText = 'Sakit';
          statusBadgeClass = 'bg-[#FFEDD5] text-[#C2410C] hover:bg-[#FED7AA]';
          locationMode = 'Surat Dokter';
        } else if (myLeave.category === 'BUSINESS_TRIP') {
          statusText = 'Dinas Luar';
          statusBadgeClass = 'bg-[#E0E7FF] text-[#4338CA] hover:bg-[#C7D2FE]';
          locationMode = 'Kunjungan Dinas Luar';
        }
        taskSummary = myLeave.reason || 'Pengajuan Perizinan Disetujui';
      } else if (myRecord) {
        hasCheckmark = true;
        clockIn = myRecord.clockInTime ? `${myRecord.clockInTime} WIB` : '08:15 WIB';
        clockOut = myRecord.clockOutTime ? `${myRecord.clockOutTime} WIB` : '17:30 WIB';
        if (myRecord.workMode === 'WFH') {
          category = 'WFH';
          locationMode = 'WFH (Remote)';
        } else {
          locationMode = 'WFO Kantor';
        }
        taskSummary =
          myRecord.tasksDoneSummary && myRecord.tasksDoneSummary.length > 0
            ? myRecord.tasksDoneSummary.join(', ')
            : myTaskLog?.tasks && myTaskLog.tasks.length > 0
            ? myTaskLog.tasks.join(', ')
            : 'Selesai bertugas operasional';

        if (myRecord.clockInStatus === 'LATE') {
          statusText = 'Terlambat';
          statusBadgeClass = 'bg-[#FEF3C7] text-[#B45309] hover:bg-[#FDE68A]';
        } else {
          statusText = 'Hadir';
          statusBadgeClass = 'bg-[#E0F2FE] text-[#0369A1] hover:bg-[#BAE6FD]';
        }
      } else {
        // Riwayat data historis demo untuk 4 kategori: Izin/Cuti, WFH, Sakit, & Dinas Luar
        if (row.rawDate === '2026-10-20' || row.rawDate === '2026-10-19') {
          category = 'LEAVE';
          statusText = 'Izin / Cuti';
          statusBadgeClass = 'bg-[#DCFCE7] text-[#15803D] hover:bg-[#BBF7D0]';
          locationMode = 'Izin Resmi';
          taskSummary = 'Cuti Tahunan & Keperluan Keluarga';
        } else if (row.rawDate === '2026-10-15') {
          category = 'WFH';
          hasCheckmark = true;
          clockIn = '08:00 WIB';
          clockOut = '17:00 WIB';
          statusText = 'WFH';
          statusBadgeClass = 'bg-[#FEF3C7] text-[#B45309] hover:bg-[#FDE68A]';
          locationMode = 'WFH (Remote)';
          taskSummary = 'Penyusunan Dokumentasi Sistem & Monitoring Server';
        } else if (row.rawDate === '2026-10-13' || row.rawDate === '2026-10-14') {
          category = 'BUSINESS_TRIP';
          hasCheckmark = true;
          clockIn = '08:30 WIB';
          clockOut = '17:30 WIB';
          statusText = 'Dinas Luar';
          statusBadgeClass = 'bg-[#E0E7FF] text-[#4338CA] hover:bg-[#C7D2FE]';
          locationMode = 'Kunjungan Luar Kota';
          taskSummary = 'Penugasan Lapangan & Koordinasi Proyek Mitra';
        } else if (row.rawDate === '2026-10-08') {
          category = 'SICK';
          statusText = 'Sakit';
          statusBadgeClass = 'bg-[#FFEDD5] text-[#C2410C] hover:bg-[#FED7AA]';
          locationMode = 'Surat Dokter';
          taskSummary = 'Pemeriksaan Kesehatan dan Rawat Jalan';
        } else {
          const demoHadir = row.statuses['Alis'] === 'Hadir' || row.statuses['Ella'] === 'Hadir';
          if (demoHadir) {
            hasCheckmark = true;
            clockIn = '08:15 WIB';
            clockOut = '17:30 WIB';
            statusText = 'Hadir';
            statusBadgeClass = 'bg-[#E0F2FE] text-[#0369A1] hover:bg-[#BAE6FD]';
            locationMode = 'WFO Kantor';
            taskSummary = 'Penyelesaian aktivitas operasional harian';
          } else {
            statusText = 'Tidak Hadir';
            statusBadgeClass = 'bg-[#FFE4E6] text-[#E11D48] hover:bg-[#FECDD3]';
            locationMode = '—';
            taskSummary = 'Tidak ada presensi tercatat';
          }
        }
      }

      return {
        ...row,
        statusText,
        statusBadgeClass,
        clockIn,
        clockOut,
        locationMode,
        taskSummary,
        hasCheckmark,
        category,
      };
    });
  }, [displayedRows, attendanceRecords, leaves, dailyTasks, currentUser.id]);

  // Hitung total angka riwayat absensi pribadi per kategori
  const personalCategoryCounts = useMemo(() => {
    let leave = 0;
    let wfh = 0;
    let sick = 0;
    let businessTrip = 0;

    personalRows.forEach((r) => {
      if (r.category === 'LEAVE' || r.statusText === 'Izin / Cuti') leave++;
      else if (r.category === 'WFH' || r.statusText === 'WFH') wfh++;
      else if (r.category === 'SICK' || r.statusText === 'Sakit') sick++;
      else if (r.category === 'BUSINESS_TRIP' || r.statusText === 'Dinas Luar') businessTrip++;
    });

    return { leave, wfh, sick, businessTrip };
  }, [personalRows]);

  // Filter Absensi Pribadi berdasarkan Kategori (1. Izin / Cuti s/d 4. Dinas Luar)
  const filteredPersonalRows = useMemo(() => {
    let result = personalRows;
    if (personalCategoryFilter !== 'ALL') {
      result = result.filter((r) => r.category === personalCategoryFilter);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter((r) => {
        if (r.dateStr.toLowerCase().includes(q)) return true;
        if (r.statusText.toLowerCase().includes(q)) return true;
        if (r.taskSummary.toLowerCase().includes(q)) return true;
        if (r.locationMode.toLowerCase().includes(q)) return true;
        return false;
      });
    }
    return result;
  }, [personalRows, personalCategoryFilter, searchQuery]);

  // Reset pagination saat filter berubah
  React.useEffect(() => {
    setMatrixPage(1);
  }, [filterType, specificDateFilter, searchQuery, sortOrder]);

  React.useEffect(() => {
    setPersonalPage(1);
  }, [personalCategoryFilter, specificDateFilter, searchQuery, sortOrder]);

  // Pagination Kehadiran Tim (10 teratas)
  const totalMatrixPages = Math.max(1, Math.ceil(displayedRows.length / ITEMS_PER_PAGE));
  const paginatedMatrixRows = useMemo(() => {
    const start = (matrixPage - 1) * ITEMS_PER_PAGE;
    return displayedRows.slice(start, start + ITEMS_PER_PAGE);
  }, [displayedRows, matrixPage]);

  // Pagination Absensi Pribadi (10 teratas)
  const totalPersonalPages = Math.max(1, Math.ceil(filteredPersonalRows.length / ITEMS_PER_PAGE));
  const paginatedPersonalRows = useMemo(() => {
    const start = (personalPage - 1) * ITEMS_PER_PAGE;
    return filteredPersonalRows.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredPersonalRows, personalPage]);

  // Ekspor Data Spreadsheet Khusus Absensi Pribadi
  const handleExportPersonal = () => {
    const categoryLabels: Record<string, string> = {
      ALL: 'Semua Status',
      LEAVE: '1. Izin / Cuti',
      WFH: '2. WFH',
      SICK: '3. Sakit',
      BUSINESS_TRIP: '4. Dinas Luar',
    };
    downloadPersonalAttendanceSpreadsheet(
      currentUser.name,
      currentUser.department || 'Teknologi Informasi',
      filteredPersonalRows,
      categoryLabels[personalCategoryFilter] || 'Semua Status'
    );
  };

  const handleExport = () => {
    if (viewMode === 'classic') {
      handleExportPersonal();
    } else {
      downloadAttendanceSpreadsheet(attendanceRecords);
    }
  };

  return (
    <div className={`space-y-4 font-sans antialiased ${isFullscreen ? 'fixed inset-0 z-50 bg-[#F8FAFC] p-4 sm:p-8 overflow-y-auto' : ''}`}>
      
      {/* TOOLBAR FILTERS */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs relative z-20 p-2.5 sm:p-3.5">
        {/* TAMPILAN DESKTOP & TABLET (1 Baris Horisontal sesuai Referensi) */}
        <div className="hidden md:flex md:items-center md:gap-3 w-full">
          {/* 1. Fullscreen / Zoom Toggle */}
          <Tooltip content={isFullscreen ? 'Keluar dari layar penuh' : 'Buka tampilan layar penuh'} position="bottom">
            <button
              type="button"
              onClick={() => setIsFullscreen(!isFullscreen)}
              className="h-10 w-10 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-full transition-colors cursor-pointer shrink-0 border border-slate-200 bg-slate-50 flex items-center justify-center"
              aria-label={isFullscreen ? 'Keluar Layar Penuh' : 'Layar Penuh'}
            >
              {isFullscreen ? <Minimize2 className="w-4.5 h-4.5" /> : <Maximize2 className="w-4.5 h-4.5" />}
            </button>
          </Tooltip>

          {/* 2. Pilih Tanggal Dropdown */}
          <div className="relative shrink-0">
            <Tooltip content="Pilih atau cari berdasarkan tanggal spesifik" position="bottom" disabled={dateFilterOpen}>
              <button
                type="button"
                onClick={() => setDateFilterOpen(!dateFilterOpen)}
                className="h-9 px-3 flex items-center justify-center gap-1.5 bg-white hover:bg-slate-50 text-slate-800 font-bold text-xs rounded-xl transition-all cursor-pointer shadow-2xs border border-slate-200 whitespace-nowrap shrink-0"
              >
                <Calendar className="w-3.5 h-3.5 text-[#1E3A8A] shrink-0" />
                <span>
                  {specificDateFilter
                    ? `Tanggal: ${specificDateFilter.split('-').reverse().join('/')}`
                    : 'Pilih Tanggal'}
                </span>
                <ChevronDown
                  className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 shrink-0 ${
                    dateFilterOpen ? 'rotate-180' : ''
                  }`}
                />
              </button>
            </Tooltip>

            {/* Dropdown menu */}
            {dateFilterOpen && (
              <>
                <div
                  className="fixed inset-0 z-30"
                  onClick={() => setDateFilterOpen(false)}
                />
                <div className="absolute left-0 mt-2 w-64 bg-white rounded-2xl border border-slate-200 shadow-xl p-3 z-40 text-xs animate-in fade-in zoom-in-95 duration-150 space-y-2.5">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                      Cari Berdasarkan Tanggal
                    </label>
                    <div className="flex items-center gap-1.5">
                      <input
                        type="date"
                        value={specificDateFilter}
                        onChange={(e) => {
                          setSpecificDateFilter(e.target.value);
                        }}
                        className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-50 font-medium cursor-pointer"
                      />
                      {specificDateFilter && (
                        <button
                          type="button"
                          onClick={() => setSpecificDateFilter('')}
                          className="px-2 py-1 text-[11px] font-bold text-rose-600 hover:bg-rose-50 rounded-lg cursor-pointer whitespace-nowrap"
                          title="Hapus Tanggal"
                        >
                          Reset
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="border-t border-slate-100 pt-1" />
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    Urutan Tanggal
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setSortOrder('DESC');
                      setDateFilterOpen(false);
                    }}
                    className={`w-full text-left px-2.5 py-1.5 rounded-lg font-semibold transition-colors cursor-pointer ${
                      sortOrder === 'DESC' ? 'bg-slate-100 text-slate-900 font-bold' : 'text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    Terbaru ke Terlama
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setSortOrder('ASC');
                      setDateFilterOpen(false);
                    }}
                    className={`w-full text-left px-2.5 py-1.5 rounded-lg font-semibold transition-colors cursor-pointer ${
                      sortOrder === 'ASC' ? 'bg-slate-100 text-slate-900 font-bold' : 'text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    Terlama ke Terbaru
                  </button>

                  <div className="border-t border-slate-100 pt-1" />
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    Filter Hari
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setFilterType('ALL');
                      setSpecificDateFilter('');
                      setDateFilterOpen(false);
                    }}
                    className={`w-full text-left px-2.5 py-1.5 rounded-lg font-semibold transition-colors cursor-pointer ${
                      filterType === 'ALL' && !specificDateFilter ? 'bg-slate-100 text-slate-900 font-bold' : 'text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    Semua Tanggal
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setFilterType('WORKDAY');
                      setDateFilterOpen(false);
                    }}
                    className={`w-full text-left px-2.5 py-1.5 rounded-lg font-semibold transition-colors cursor-pointer ${
                      filterType === 'WORKDAY' ? 'bg-slate-100 text-slate-900 font-bold' : 'text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    Hanya Hari Kerja (Senin - Jumat)
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setFilterType('HOLIDAY');
                      setDateFilterOpen(false);
                    }}
                    className={`w-full text-left px-2.5 py-1.5 rounded-lg font-semibold transition-colors cursor-pointer ${
                      filterType === 'HOLIDAY' ? 'bg-slate-100 text-slate-900 font-bold' : 'text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    Hanya Hari Libur (Sabtu - Minggu)
                  </button>
                </div>
              </>
            )}
          </div>

          {/* 3. Search Bar (Tengah, Flex-1) */}
          <Tooltip content="Ketik tanggal untuk menyaring riwayat presensi" position="bottom" className="flex-1">
            <div className="relative flex items-center w-full">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cari tanggal..."
                className="h-10 pl-10 pr-8 w-full bg-[#F8FAFC] hover:bg-white focus:bg-white border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-800 placeholder-slate-400 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all font-medium"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 text-slate-400 hover:text-slate-600 cursor-pointer p-0.5"
                  title="Hapus pencarian"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </Tooltip>

          {/* 4. Tab Switcher Presensi Tim & Presensi Saya */}
          {currentUser.role !== 'SUPER_ADMIN' && (
            <div className="inline-flex items-center p-0.5 bg-slate-100/90 rounded-xl border border-slate-200/90 h-9 text-xs font-semibold shrink-0">
              <button
                type="button"
                onClick={() => setViewMode('matrix')}
                className={`h-8 px-3 rounded-lg transition-all cursor-pointer whitespace-nowrap flex items-center justify-center text-center font-bold text-xs ${
                  viewMode === 'matrix'
                    ? 'bg-[#1E3A8A] text-white shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Presensi Tim
              </button>
              <button
                type="button"
                onClick={() => setViewMode('classic')}
                className={`h-8 px-3 rounded-lg transition-all cursor-pointer whitespace-nowrap flex items-center justify-center text-center font-bold text-xs ${
                  viewMode === 'classic'
                    ? 'bg-[#1E3A8A] text-white shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Presensi Saya
              </button>
            </div>
          )}

          {/* 5. Icon Export Spreadsheet */}
          <Tooltip content="Ekspor seluruh rekap presensi tim ke dokumen spreadsheet (.CSV)" position="bottom">
            <button
              type="button"
              onClick={handleExport}
              aria-label="Ekspor Rekap Spreadsheet"
              className="h-10 w-10 bg-[#1E3A8A] hover:bg-[#172554] text-white rounded-xl transition-all shadow-2xs cursor-pointer shrink-0 flex items-center justify-center active:scale-95 border border-[#1E3A8A]"
            >
              <FileSpreadsheet className="w-4 h-4" />
            </button>
          </Tooltip>
        </div>

        {/* TAMPILAN MOBILE (Tetap seperti sebelumnya) */}
        <div className="block md:hidden space-y-2.5">
          {/* BARIS 1 (ATAS MOBILE) */}
          <div className="flex items-center justify-between gap-2.5 pb-2.5 border-b border-slate-100">
            <Tooltip content={isFullscreen ? 'Keluar dari layar penuh' : 'Buka tampilan layar penuh'} position="bottom">
              <button
                type="button"
                onClick={() => setIsFullscreen(!isFullscreen)}
                className="h-9.5 w-9.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer shrink-0 border border-slate-200/80 bg-slate-50/70 flex items-center justify-center"
                aria-label={isFullscreen ? 'Keluar Layar Penuh' : 'Layar Penuh'}
              >
                {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
              </button>
            </Tooltip>

            <Tooltip content="Ketik tanggal untuk menyaring riwayat presensi" position="bottom" className="flex-1 mx-2 max-w-2xl">
              <div className="relative flex items-center w-full">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 pointer-events-none" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Cari tanggal..."
                  className="h-9.5 pl-10 pr-8 w-full bg-[#F8FAFC] hover:bg-white focus:bg-white border border-slate-200/90 rounded-xl text-xs text-slate-800 placeholder-slate-400 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all font-medium"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2.5 text-slate-400 hover:text-slate-600 cursor-pointer p-0.5"
                    title="Hapus pencarian"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </Tooltip>

            <Tooltip content="Ekspor seluruh rekap presensi tim ke dokumen spreadsheet (.CSV)" position="bottom">
              <button
                type="button"
                onClick={handleExport}
                aria-label="Ekspor Rekap Spreadsheet"
                className="h-9.5 w-9.5 bg-[#1E3A8A] hover:bg-[#172554] text-white rounded-xl transition-all shadow-2xs cursor-pointer shrink-0 flex items-center justify-center active:scale-95 border border-[#1E3A8A]"
              >
                <FileSpreadsheet className="w-4 h-4" />
              </button>
            </Tooltip>
          </div>

          {/* BARIS 2 (BAWAH MOBILE) */}
          <div className={`flex items-center gap-1.5 sm:gap-2.5 w-full pt-0.5 ${currentUser.role === 'SUPER_ADMIN' ? '' : 'overflow-x-auto scrollbar-none flex-nowrap'}`}>
            <div className={`relative ${currentUser.role === 'SUPER_ADMIN' ? 'w-full' : 'shrink-0'}`}>
              <Tooltip
                content="Pilih atau cari berdasarkan tanggal spesifik"
                position="bottom"
                disabled={dateFilterOpen}
                className={currentUser.role === 'SUPER_ADMIN' ? 'w-full block' : ''}
              >
                <button
                  type="button"
                  onClick={() => setDateFilterOpen(!dateFilterOpen)}
                  className={`flex items-center gap-2 bg-white hover:bg-slate-50 text-slate-800 font-bold rounded-xl transition-all cursor-pointer shadow-2xs border border-slate-200/90 whitespace-nowrap ${
                    currentUser.role === 'SUPER_ADMIN'
                      ? 'w-full h-10 px-3.5 justify-between text-xs'
                      : 'h-8 px-2.5 justify-center shrink-0 text-[11px]'
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <Calendar className="w-4 h-4 text-[#1E3A8A] shrink-0" />
                    <span className="truncate">
                      {specificDateFilter
                        ? `Tanggal: ${specificDateFilter.split('-').reverse().join('/')}`
                        : 'Pilih Tanggal'}
                    </span>
                  </div>
                  <ChevronDown
                    className={`w-4 h-4 text-slate-400 transition-transform duration-200 shrink-0 ${
                      dateFilterOpen ? 'rotate-180' : ''
                    }`}
                  />
                </button>
              </Tooltip>

              {dateFilterOpen && (
                <>
                  <div
                    className="fixed inset-0 z-30"
                    onClick={() => setDateFilterOpen(false)}
                  />
                  <div className={`absolute left-0 mt-2 bg-white rounded-2xl border border-slate-200 shadow-xl p-3 z-40 text-xs animate-in fade-in zoom-in-95 duration-150 space-y-2.5 ${
                    currentUser.role === 'SUPER_ADMIN' ? 'w-full right-0 max-w-sm' : 'w-64'
                  }`}>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                        Cari Berdasarkan Tanggal
                      </label>
                      <div className="flex items-center gap-1.5">
                        <input
                          type="date"
                          value={specificDateFilter}
                          onChange={(e) => {
                            setSpecificDateFilter(e.target.value);
                          }}
                          className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-50 font-medium cursor-pointer"
                        />
                        {specificDateFilter && (
                          <button
                            type="button"
                            onClick={() => setSpecificDateFilter('')}
                            className="px-2 py-1 text-[11px] font-bold text-rose-600 hover:bg-rose-50 rounded-lg cursor-pointer whitespace-nowrap"
                            title="Hapus Tanggal"
                          >
                            Reset
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="border-t border-slate-100 pt-1" />
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                      Urutan Tanggal
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        setSortOrder('DESC');
                        setDateFilterOpen(false);
                      }}
                      className={`w-full text-left px-2.5 py-1.5 rounded-lg font-semibold transition-colors cursor-pointer ${
                        sortOrder === 'DESC' ? 'bg-slate-100 text-slate-900 font-bold' : 'text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      Terbaru ke Terlama
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setSortOrder('ASC');
                        setDateFilterOpen(false);
                      }}
                      className={`w-full text-left px-2.5 py-1.5 rounded-lg font-semibold transition-colors cursor-pointer ${
                        sortOrder === 'ASC' ? 'bg-slate-100 text-slate-900 font-bold' : 'text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      Terlama ke Terbaru
                    </button>

                    <div className="border-t border-slate-100 pt-1" />
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                      Filter Hari
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        setFilterType('ALL');
                        setSpecificDateFilter('');
                        setDateFilterOpen(false);
                      }}
                      className={`w-full text-left px-2.5 py-1.5 rounded-lg font-semibold transition-colors cursor-pointer ${
                        filterType === 'ALL' && !specificDateFilter ? 'bg-slate-100 text-slate-900 font-bold' : 'text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      Semua Tanggal
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setFilterType('WORKDAY');
                        setDateFilterOpen(false);
                      }}
                      className={`w-full text-left px-2.5 py-1.5 rounded-lg font-semibold transition-colors cursor-pointer ${
                        filterType === 'WORKDAY' ? 'bg-slate-100 text-slate-900 font-bold' : 'text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      Hanya Hari Kerja (Senin - Jumat)
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setFilterType('HOLIDAY');
                        setDateFilterOpen(false);
                      }}
                      className={`w-full text-left px-2.5 py-1.5 rounded-lg font-semibold transition-colors cursor-pointer ${
                        filterType === 'HOLIDAY' ? 'bg-slate-100 text-slate-900 font-bold' : 'text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      Hanya Hari Libur (Sabtu - Minggu)
                    </button>
                  </div>
                </>
              )}
            </div>

            {currentUser.role !== 'SUPER_ADMIN' && (
              <div className="inline-flex items-center p-0.5 bg-slate-100/90 rounded-xl border border-slate-200/90 h-8 text-[11px] font-semibold shrink-0">
                <button
                  type="button"
                  onClick={() => setViewMode('matrix')}
                  className={`h-7 px-2.5 rounded-lg transition-all cursor-pointer whitespace-nowrap flex items-center justify-center text-center font-bold text-[11px] ${
                    viewMode === 'matrix'
                      ? 'bg-[#1E3A8A] text-white shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Presensi Tim
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('classic')}
                  className={`h-7 px-2.5 rounded-lg transition-all cursor-pointer whitespace-nowrap flex items-center justify-center text-center font-bold text-[11px] ${
                    viewMode === 'classic'
                      ? 'bg-[#1E3A8A] text-white shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Presensi Saya
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* VIEW UTAMA 1: TAMPILAN KEHADIRAN TIM */}
      {viewMode === 'matrix' ? (
        <div className="bg-white rounded-3xl border border-slate-200/90 shadow-sm overflow-hidden select-none">
          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full border-collapse text-left text-xs min-w-[760px]">
              {/* TABLE HEADER */}
              <thead>
                <tr className="border-b border-slate-200/80 bg-white text-slate-600 font-semibold text-xs">
                  {/* Kolom Tanggal (Bahasa Indonesia) */}
                  <th className="py-3 px-4 font-semibold text-slate-600 w-28">Tanggal</th>

                  {/* Kolom Presensi Masuk (Summary pill) */}
                  <th className="py-3 px-4 font-semibold text-slate-600 w-36">Presensi Masuk</th>

                  {/* Kolom Keterangan Lokasi */}
                  <th className="py-3 px-4 font-semibold text-slate-600 w-36">Keterangan Lokasi</th>

                  {/* Kolom Cuti/Izin */}
                  <th className="py-3 px-4 font-semibold text-slate-600 w-24">Cuti/Izin</th>

                  {/* Kolom Tiap Karyawan */}
                  {employeeColumns.map((colName) => (
                    <th
                      key={colName}
                      onClick={() => {
                        const fullName = employeeNamesMap[colName] || colName;
                        const avatar = employeeAvatarMap[colName] || users.find((u) => u.name.toLowerCase().includes(colName.toLowerCase()))?.avatar;
                        setSimpleProfilePopup({
                          name: fullName,
                          avatar: avatar,
                        });
                      }}
                      className="py-3 px-4 font-semibold text-slate-700 hover:text-[#1E3A8A] hover:bg-blue-50/60 min-w-[100px] text-center cursor-pointer transition-colors"
                      title="Klik untuk melihat profil"
                    >
                      {colName}
                    </th>
                  ))}
                </tr>
              </thead>

              {/* TABLE BODY ROWS */}
              <tbody className="divide-y divide-slate-100">
                {displayedRows.length === 0 ? (
                  <tr>
                    <td colSpan={4 + employeeColumns.length} className="py-16 text-center text-slate-400">
                      Tidak ada data riwayat presensi yang cocok dengan kata kunci pencarian.
                    </td>
                  </tr>
                ) : (
                  paginatedMatrixRows.map((row) => {
                    const isWeekendHoliday = row.isHoliday;

                    return (
                      <tr
                        key={row.dateStr}
                        className={`transition-colors duration-150 ${
                          isWeekendHoliday
                            ? 'bg-[#FEECEB] hover:bg-[#FEDCDA]'
                            : 'bg-white hover:bg-slate-50/70'
                        }`}
                      >
                        {/* 1. Date Column */}
                        <td
                          className={`py-3 px-4 font-semibold text-xs whitespace-nowrap ${
                            isWeekendHoliday ? 'text-rose-600 font-bold' : 'text-slate-800'
                          }`}
                        >
                          {row.dateStr}
                        </td>

                        {/* 3. Check-in Column (Pill Container) */}
                        <td className="py-3 px-4 whitespace-nowrap">
                          {isWeekendHoliday ? (
                            <span className="text-slate-400 font-bold text-xs pl-2">-</span>
                          ) : (
                            // Tampilan Check-in Hari Kerja: Centang + Tumpukan Foto Avatar (3 teratas) + Badge +N
                            <div
                              onClick={() => handleOpenCheckInMembersModal(row)}
                              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full shadow-2xs transition-all shrink-0 cursor-pointer hover:scale-105 active:scale-95 ${
                                row.checkIn.isPurple
                                  ? 'bg-[#FAF5FF] border border-purple-200 ring-1 ring-purple-100 text-purple-700 hover:bg-[#F3E8FF]'
                                  : 'bg-white border border-slate-200/90 text-slate-700 hover:bg-slate-50'
                              }`}
                              title="Klik untuk melihat semua foto & nama yang presensi masuk"
                            >
                              <div className="w-5 h-5 min-w-[20px] min-h-[20px] rounded-full bg-emerald-500 text-white flex items-center justify-center shrink-0 shadow-2xs">
                                <Check className="w-3 h-3 stroke-[3]" />
                              </div>

                              {/* Overlapping Avatars (3 teratas, bulat utuh dan proporsional) */}
                              {row.checkIn.avatars.length > 0 && (
                                <div className="flex -space-x-1.5 items-center shrink-0">
                                  {row.checkIn.avatars.slice(0, 3).map((av, avIdx) => (
                                    <img
                                      key={avIdx}
                                      src={av}
                                      alt="avatar"
                                      className="w-5 h-5 min-w-[20px] min-h-[20px] aspect-square rounded-full object-cover ring-2 ring-white shrink-0 shadow-2xs"
                                    />
                                  ))}
                                </div>
                              )}

                              {/* Counter Badge (+10, +14, +17) */}
                              {row.checkIn.countBadge && (
                                <span className="text-[11px] font-bold text-slate-600 pl-0.5 whitespace-nowrap">
                                  {row.checkIn.countBadge}
                                </span>
                              )}
                            </div>
                          )}
                        </td>

                        {/* 3b. Keterangan Lokasi Column */}
                        <td className="py-3 px-4 whitespace-nowrap">
                          {isWeekendHoliday ? (
                            <span className="text-slate-400 font-bold text-xs pl-2">-</span>
                          ) : (
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] sm:text-[11px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                                <Building2 className="w-3 h-3 text-emerald-600 shrink-0" />
                                <span>Di Kantor</span>
                              </span>
                              {(row.rawDate === '2026-10-15' || row.rawDate === '2026-10-20') && (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] sm:text-[11px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                                  <MapPin className="w-3 h-3 text-amber-600 shrink-0" />
                                  <span>Di Luar Kantor</span>
                                </span>
                              )}
                            </div>
                          )}
                        </td>

                        {/* 4. Cuti/Izin Column (Avatar Karyawan Cuti) */}
                        <td className="py-3 px-4 whitespace-nowrap">
                          {row.cutiAvatars.length > 0 ? (
                            <div
                              onClick={() => handleOpenCutiMembersModal(row)}
                              className="inline-flex items-center -space-x-1 shrink-0 cursor-pointer p-1 rounded-xl hover:bg-amber-50/70 transition-all hover:scale-105 active:scale-95"
                              title="Klik untuk melihat semua foto & nama karyawan cuti / izin"
                            >
                              {row.cutiAvatars.map((cav, cIdx) => (
                                <img
                                  key={cIdx}
                                  src={cav}
                                  alt="cuti avatar"
                                  className="w-6 h-6 min-w-[24px] min-h-[24px] aspect-square rounded-full object-cover border-1.5 border-white shrink-0 shadow-2xs"
                                />
                              ))}
                            </div>
                          ) : (
                            <span className="text-slate-300 font-bold text-xs">—</span>
                          )}
                        </td>

                        {/* 5. Employee Status Columns (Alis, Awang, Ella, Fanny, Fida, Fikar) */}
                        {employeeColumns.map((colName) => {
                          const status = row.statuses[colName] || 'Hadir';

                          return (
                            <td key={colName} className="py-2.5 px-4 text-center whitespace-nowrap">
                              {isWeekendHoliday ? (
                                // Teks 'Libur' merah tanpa pill di hari libur (persis gambar)
                                <span className="text-xs font-bold text-[#E11D48] tracking-tight">
                                  Libur
                                </span>
                              ) : status === 'Hadir' ? (
                                // Pill Biru Muda untuk 'Hadir'
                                <button
                                  type="button"
                                  onClick={() => {
                                    const fullName = employeeNamesMap[colName] || colName;
                                    const avatar = employeeAvatarMap[colName] || users.find((u) => u.name.toLowerCase().includes(colName.toLowerCase()))?.avatar;
                                    setSimpleProfilePopup({
                                      name: fullName,
                                      avatar: avatar,
                                    });
                                  }}
                                  className="px-3.5 py-1 rounded-full text-xs font-semibold bg-[#E0F2FE] text-[#0369A1] hover:bg-[#BAE6FD] transition-colors cursor-pointer shadow-2xs inline-block active:scale-95"
                                  title={`Klik untuk melihat profil ${colName} (Hadir)`}
                                >
                                  Hadir
                                </button>
                              ) : status === 'Cuti/Izin' ? (
                                // Pill Hijau Muda untuk 'Cuti/Izin'
                                <button
                                  type="button"
                                  onClick={() => {
                                    const fullName = employeeNamesMap[colName] || colName;
                                    const avatar = employeeAvatarMap[colName] || users.find((u) => u.name.toLowerCase().includes(colName.toLowerCase()))?.avatar;
                                    setSimpleProfilePopup({
                                      name: fullName,
                                      avatar: avatar,
                                    });
                                  }}
                                  className="px-3.5 py-1 rounded-full text-xs font-semibold bg-[#DCFCE7] text-[#15803D] hover:bg-[#BBF7D0] transition-colors cursor-pointer shadow-2xs inline-block active:scale-95"
                                  title={`Klik untuk melihat profil ${colName} (Cuti/Izin)`}
                                >
                                  Cuti/Izin
                                </button>
                              ) : (
                                // Pill Merah Muda untuk 'Tidak Hadir'
                                <button
                                  type="button"
                                  onClick={() => {
                                    const fullName = employeeNamesMap[colName] || colName;
                                    const avatar = employeeAvatarMap[colName] || users.find((u) => u.name.toLowerCase().includes(colName.toLowerCase()))?.avatar;
                                    setSimpleProfilePopup({
                                      name: fullName,
                                      avatar: avatar,
                                    });
                                  }}
                                  className="px-3.5 py-1 rounded-full text-xs font-semibold bg-[#FFE4E6] text-[#E11D48] hover:bg-[#FECDD3] transition-colors cursor-pointer shadow-2xs inline-block active:scale-95"
                                  title={`Klik untuk melihat profil ${colName} (Tidak Hadir)`}
                                >
                                  Tidak Hadir
                                </button>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination Footer Kehadiran Tim (Icon Arrow di Pojok Kanan Bawah) */}
          <div className="px-5 py-3 border-t border-slate-100 bg-white flex items-center justify-end gap-2 text-xs">
            <div className="flex items-center gap-1.5">
              <Tooltip content="Halaman Sebelumnya" position="top">
                <button
                  type="button"
                  onClick={() => setMatrixPage((p) => Math.max(p - 1, 1))}
                  disabled={matrixPage <= 1}
                  aria-label="Halaman Sebelumnya"
                  className={`w-8 h-8 rounded-xl border flex items-center justify-center transition-all ${
                    matrixPage <= 1
                      ? 'bg-slate-50 text-slate-300 border-slate-200 cursor-not-allowed'
                      : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-200 shadow-2xs hover:shadow-xs cursor-pointer active:scale-95'
                  }`}
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
              </Tooltip>

              <div className="px-3 py-1 bg-slate-100 rounded-lg font-bold text-slate-700 text-xs">
                {matrixPage} / {totalMatrixPages}
              </div>

              <Tooltip content="Halaman Selanjutnya" position="top">
                <button
                  type="button"
                  onClick={() => setMatrixPage((p) => Math.min(p + 1, totalMatrixPages))}
                  disabled={matrixPage >= totalMatrixPages}
                  aria-label="Halaman Selanjutnya"
                  className={`w-8 h-8 rounded-xl border flex items-center justify-center transition-all ${
                    matrixPage >= totalMatrixPages
                      ? 'bg-slate-50 text-slate-300 border-slate-200 cursor-not-allowed'
                      : 'bg-[#1E3A8A] hover:bg-[#172554] text-white border-[#1E3A8A] shadow-2xs hover:shadow-xs cursor-pointer active:scale-95'
                  }`}
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </Tooltip>
            </div>
          </div>
        </div>
      ) : (
        /* VIEW UTAMA 2: TAMPILAN PRESENSI PRIBADI (Desain Biru Navy & 10 Data Teratas) */
        <div className="space-y-4">
          {/* Header Ringkasan Profil Karyawan & KPI Personal */}
          <div className="bg-white rounded-3xl border border-slate-200/90 shadow-sm p-4 sm:p-5 flex flex-wrap lg:flex-nowrap items-center justify-between gap-4">
            {/* Profil Karyawan (Avatar, Nama + Button Spreadsheet di sebelah Nama, Divisi) */}
            <div className="flex items-center gap-3.5 shrink-0">
              <img
                src={currentUser.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=120&q=80'}
                alt={currentUser.name}
                onClick={() => setSimpleProfilePopup({ name: currentUser.name, avatar: currentUser.avatar })}
                className="w-12 h-12 rounded-2xl object-cover ring-2 ring-slate-100 shadow-2xs shrink-0 cursor-pointer hover:ring-2 hover:ring-blue-300 transition-all"
                title="Lihat Foto Profil"
              />
              <div>
                <div className="flex items-center gap-2.5">
                  <h3
                    onClick={() => setSimpleProfilePopup({ name: currentUser.name, avatar: currentUser.avatar })}
                    className="font-extrabold text-slate-900 hover:text-[#1E3A8A] transition-colors text-sm sm:text-base leading-snug cursor-pointer"
                  >
                    {currentUser.name}
                  </h3>
                  {/* Button ringkas logo spreadsheet di sebelah nama */}
                  <Tooltip content="Unduh riwayat presensi pribadi ke dalam dokumen spreadsheet (.CSV)" position="bottom">
                    <button
                      type="button"
                      onClick={handleExportPersonal}
                      aria-label="Ekspor Spreadsheet"
                      className="h-7.5 w-7.5 bg-[#1E3A8A] hover:bg-[#172554] text-white font-bold rounded-lg transition-all shadow-xs cursor-pointer shrink-0 flex items-center justify-center hover:shadow-md active:scale-95 border border-[#1E3A8A]"
                    >
                      <FileSpreadsheet className="w-3.5 h-3.5" />
                    </button>
                  </Tooltip>
                </div>
                <p className="text-xs text-slate-500 font-medium mt-0.5">
                  {currentUser.department || 'Teknologi Informasi'}
                </p>
              </div>
            </div>

            {/* Category Filter Pills (dengan jumlah total angka riwayat per kategori) */}
            <div className="flex items-center gap-1.5 overflow-x-auto max-w-full pb-1 sm:pb-0 scrollbar-none">
              <Tooltip content="Tampilkan semua riwayat presensi pribadi" position="top">
                <button
                  type="button"
                  onClick={() => setPersonalCategoryFilter('ALL')}
                  className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer shrink-0 ${
                    personalCategoryFilter === 'ALL'
                      ? 'bg-[#1E3A8A] hover:bg-[#172554] text-white shadow-xs font-bold'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200/80'
                  }`}
                >
                  Semua
                </button>
              </Tooltip>

              <Tooltip content="Filter riwayat permohonan izin dan cuti kerja" position="top">
                <button
                  type="button"
                  onClick={() =>
                    setPersonalCategoryFilter(personalCategoryFilter === 'LEAVE' ? 'ALL' : 'LEAVE')
                  }
                  className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer shrink-0 ${
                    personalCategoryFilter === 'LEAVE'
                      ? 'bg-[#1E3A8A] hover:bg-[#172554] text-white shadow-xs font-bold'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200/80'
                  }`}
                >
                  Izin / Cuti ({personalCategoryCounts.leave})
                </button>
              </Tooltip>

              <Tooltip content="Filter riwayat Work From Home (WFH)" position="top">
                <button
                  type="button"
                  onClick={() =>
                    setPersonalCategoryFilter(personalCategoryFilter === 'WFH' ? 'ALL' : 'WFH')
                  }
                  className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer shrink-0 ${
                    personalCategoryFilter === 'WFH'
                      ? 'bg-[#1E3A8A] hover:bg-[#172554] text-white shadow-xs font-bold'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200/80'
                  }`}
                >
                  WFH ({personalCategoryCounts.wfh})
                </button>
              </Tooltip>

              <Tooltip content="Filter riwayat presensi karena sakit" position="top">
                <button
                  type="button"
                  onClick={() =>
                    setPersonalCategoryFilter(personalCategoryFilter === 'SICK' ? 'ALL' : 'SICK')
                  }
                  className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer shrink-0 ${
                    personalCategoryFilter === 'SICK'
                      ? 'bg-[#1E3A8A] hover:bg-[#172554] text-white shadow-xs font-bold'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200/80'
                  }`}
                >
                  Sakit ({personalCategoryCounts.sick})
                </button>
              </Tooltip>

              <Tooltip content="Filter riwayat tugas dinas luar kantor" position="top">
                <button
                  type="button"
                  onClick={() =>
                    setPersonalCategoryFilter(
                      personalCategoryFilter === 'BUSINESS_TRIP' ? 'ALL' : 'BUSINESS_TRIP'
                    )
                  }
                  className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer shrink-0 ${
                    personalCategoryFilter === 'BUSINESS_TRIP'
                      ? 'bg-[#1E3A8A] hover:bg-[#172554] text-white shadow-xs font-bold'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200/80'
                  }`}
                >
                  Dinas Luar ({personalCategoryCounts.businessTrip})
                </button>
              </Tooltip>
            </div>
          </div>

          {/* TABLE ABSENSI PRIBADI (Desain Sesuai Kehadiran Tim, Jam Pulang & Lokasi Dihapus) */}
          <div className="bg-white rounded-3xl border border-slate-200/90 shadow-sm overflow-hidden select-none">
            <div className="overflow-x-auto custom-scrollbar">
              <table className="w-full border-collapse text-left text-xs min-w-[640px]">
                {/* TABLE HEADER */}
                <thead>
                  <tr className="border-b border-slate-200/80 bg-white text-slate-600 font-semibold text-xs">
                    <th className="py-3 px-4 font-semibold text-slate-600 w-28">Tanggal</th>
                    <th className="py-3 px-4 font-semibold text-slate-600 w-36">Presensi Masuk</th>
                    <th className="py-3 px-4 font-semibold text-slate-600 w-36">Keterangan Lokasi</th>
                    <th className="py-3 px-4 font-semibold text-slate-600 text-center w-32">Status Kehadiran</th>
                    <th className="py-3 px-4 font-semibold text-slate-600 min-w-[200px]">Catatan / Tugas</th>
                  </tr>
                </thead>

                {/* TABLE BODY ROWS (10 Teratas per Halaman) */}
                <tbody className="divide-y divide-slate-100">
                  {filteredPersonalRows.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-16 text-center text-slate-400">
                        Tidak ada riwayat presensi yang cocok dengan kategori ini.
                      </td>
                    </tr>
                  ) : (
                    paginatedPersonalRows.map((row) => {
                      const isWeekendHoliday = row.isHoliday;

                      return (
                        <tr
                          key={row.dateStr}
                          className={`transition-colors duration-150 ${
                            isWeekendHoliday
                              ? 'bg-[#FEECEB] hover:bg-[#FEDCDA]'
                              : 'bg-white hover:bg-slate-50/70'
                          }`}
                        >
                          {/* 1. Date Column */}
                          <td
                            className={`py-3 px-4 font-semibold text-xs whitespace-nowrap ${
                              isWeekendHoliday ? 'text-rose-600 font-bold' : 'text-slate-800'
                            }`}
                          >
                            {row.dateStr}
                          </td>

                          {/* 2. Check-in Column (Pill Container Persis Kehadiran Tim - Tanpa Pop Up untuk Presensi Pribadi) */}
                          <td className="py-3 px-4 whitespace-nowrap">
                            {isWeekendHoliday ? (
                              <span className="text-slate-400 font-bold text-xs pl-2">-</span>
                            ) : row.hasCheckmark ? (
                              <div
                                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white border border-slate-200/90 shadow-2xs shrink-0 text-slate-700"
                              >
                                <div className="w-5 h-5 min-w-[20px] min-h-[20px] rounded-full bg-emerald-500 text-white flex items-center justify-center shrink-0 shadow-2xs">
                                  <Check className="w-3 h-3 stroke-[3]" />
                                </div>
                                <img
                                  src={currentUser.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=80&q=80'}
                                  alt="avatar"
                                  className="w-5 h-5 min-w-[20px] min-h-[20px] aspect-square rounded-full object-cover ring-2 ring-white shrink-0 shadow-2xs"
                                />
                                <span className="text-[10px] font-bold text-slate-600">{row.clockIn}</span>
                              </div>
                            ) : (
                              <span className="text-slate-300 font-bold text-xs pl-2">—</span>
                            )}
                          </td>

                          {/* 2b. Keterangan Lokasi Column */}
                          <td className="py-3 px-4 whitespace-nowrap">
                            {isWeekendHoliday ? (
                              <span className="text-slate-400 font-bold text-xs pl-2">-</span>
                            ) : row.locationMode && row.locationMode !== '—' ? (
                              row.locationMode.includes('WFH') || row.locationMode.includes('Luar') || row.locationMode.includes('Dinas') ? (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] sm:text-[11px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                                  <MapPin className="w-3 h-3 text-amber-600 shrink-0" />
                                  <span>Di Luar Kantor</span>
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] sm:text-[11px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                                  <Building2 className="w-3 h-3 text-emerald-600 shrink-0" />
                                  <span>Di Kantor</span>
                                </span>
                              )
                            ) : (
                              <span className="text-slate-300 font-bold text-xs pl-2">—</span>
                            )}
                          </td>

                          {/* 3. Status Kehadiran (Tanpa Pop Up untuk Presensi Pribadi) */}
                          <td className="py-2.5 px-4 text-center whitespace-nowrap">
                            {isWeekendHoliday ? (
                              <span className="text-xs font-bold text-[#E11D48] tracking-tight">
                                Libur
                              </span>
                            ) : (
                              <span
                                className={`px-3.5 py-1 rounded-full text-xs font-semibold shadow-2xs inline-block ${row.statusBadgeClass}`}
                              >
                                {row.statusText}
                              </span>
                            )}
                          </td>

                          {/* 6. Catatan / Tugas */}
                          <td className="py-3 px-4 text-slate-500 truncate max-w-xs" title={row.taskSummary}>
                            {row.taskSummary}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Footer Absensi Pribadi (Icon Arrow di Pojok Kanan Bawah) */}
            <div className="px-5 py-3 border-t border-slate-100 bg-white flex items-center justify-end gap-2 text-xs">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setPersonalPage((p) => Math.max(p - 1, 1))}
                  disabled={personalPage <= 1}
                  aria-label="Halaman Sebelumnya"
                  className={`w-8 h-8 rounded-xl border flex items-center justify-center transition-all ${
                    personalPage <= 1
                      ? 'bg-slate-50 text-slate-300 border-slate-200 cursor-not-allowed'
                      : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-200 shadow-2xs hover:shadow-xs cursor-pointer active:scale-95'
                  }`}
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>

                <div className="px-3 py-1 bg-slate-100 rounded-lg font-bold text-slate-700 text-xs">
                  {personalPage} / {totalPersonalPages}
                </div>

                <button
                  type="button"
                  onClick={() => setPersonalPage((p) => Math.min(p + 1, totalPersonalPages))}
                  disabled={personalPage >= totalPersonalPages}
                  aria-label="Halaman Selanjutnya"
                  className={`w-8 h-8 rounded-xl border flex items-center justify-center transition-all ${
                    personalPage >= totalPersonalPages
                      ? 'bg-slate-50 text-slate-300 border-slate-200 cursor-not-allowed'
                      : 'bg-[#1E3A8A] hover:bg-[#172554] text-white border-[#1E3A8A] shadow-2xs hover:shadow-xs cursor-pointer active:scale-95'
                  }`}
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DETAIL CELL JIKA DIKLIK */}
      {selectedCellInfo && (
        <div
          className={`fixed inset-0 z-50 flex animate-in fade-in duration-200 ${
            isCellInfoModalFullScreen
              ? 'items-center justify-center p-0'
              : 'justify-end items-center p-2.5 sm:p-4 md:p-5'
          }`}
        >
          <div
            className="fixed inset-0 bg-slate-950/40 backdrop-blur-xs transition-opacity cursor-pointer"
            onClick={() => setSelectedCellInfo(null)}
          />
          <div
            className={`relative z-10 bg-white shadow-2xl flex flex-col min-h-0 overflow-hidden transition-all duration-300 font-sans ${
              isCellInfoModalFullScreen
                ? 'w-full h-full max-w-none max-h-none rounded-none border-0'
                : 'w-full max-w-sm sm:max-w-md h-full max-h-[calc(100vh-1.25rem)] sm:max-h-[calc(100vh-2rem)] rounded-3xl border border-slate-200/80 animate-in slide-in-from-right duration-300 ease-out'
            }`}
          >
            <div className="px-6 py-5 border-b border-slate-100 bg-white flex items-center justify-between gap-3 shrink-0">
              <div className="flex items-center gap-3 min-w-0">
                {/* Zoom Button di pojok kiri atas */}
                <button
                  type="button"
                  onClick={() => setIsCellInfoModalFullScreen(!isCellInfoModalFullScreen)}
                  className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl border border-slate-200/80 transition-colors cursor-pointer shrink-0"
                  title={isCellInfoModalFullScreen ? "Perkecil Tampilan" : "Perbesar Layar Penuh"}
                >
                  {isCellInfoModalFullScreen ? (
                    <Minimize2 className="w-4 h-4 text-slate-600" />
                  ) : (
                    <Maximize2 className="w-4 h-4 text-slate-600" />
                  )}
                </button>
                <div>
                  <h3 className="font-bold text-slate-900 text-base">Informasi Kehadiran</h3>
                  <p className="text-xs text-slate-500 mt-0.5">Detail riwayat presensi harian</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedCellInfo(null)}
                className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full border border-slate-200 transition-colors cursor-pointer shrink-0"
                title="Tutup"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-3 text-xs">
              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 flex justify-between items-center">
                <span className="text-slate-500 font-medium">Karyawan</span>
                <span className="font-bold text-slate-800 text-xs sm:text-sm">{selectedCellInfo.name}</span>
              </div>
              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 flex justify-between items-center">
                <span className="text-slate-500 font-medium">Tanggal</span>
                <span className="font-semibold text-slate-800">{selectedCellInfo.date}</span>
              </div>
              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 flex justify-between items-center">
                <span className="text-slate-500 font-medium">Keterangan Status</span>
                <span className="font-bold text-indigo-700">{selectedCellInfo.status}</span>
              </div>

              {isAdmin && (
                <button
                  type="button"
                  onClick={() => {
                    const matchedUser = users.find(
                      (u) =>
                        u.name.toLowerCase().includes(selectedCellInfo.name.toLowerCase()) ||
                        selectedCellInfo.name.toLowerCase().includes(u.name.toLowerCase())
                    );
                    const rawDate =
                      allMatrixRows.find((r) => r.dateStr === selectedCellInfo.date)?.rawDate ||
                      getCurrentDateString();
                    const existingRec = attendanceRecords.find(
                      (r) =>
                        (r.userId === matchedUser?.id || r.userName === selectedCellInfo.name) &&
                        r.date === rawDate
                    );

                    const recordToEdit: AttendanceRecord = existingRec || {
                      id: `att_edit_${Date.now()}`,
                      userId: matchedUser?.id || 'usr_unknown',
                      userName: selectedCellInfo.name,
                      userAvatar:
                        matchedUser?.avatar ||
                        'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=80&q=80',
                      department: matchedUser?.department || 'Divisi Operasional',
                      employmentType: matchedUser?.employmentType || 'CONTRACT',
                      date: rawDate,
                      clockInTime: '08:00',
                      clockInLat: -6.2088,
                      clockInLng: 106.8456,
                      clockInStatus: selectedCellInfo.status === 'Terlambat' ? 'LATE' : 'ON_TIME',
                      clockInLocationStatus: 'IN_OFFICE',
                      clockInLateMinutes: selectedCellInfo.status === 'Terlambat' ? 15 : 0,
                      clockInDistanceMeter: 15,
                      workMode: 'WFO',
                      syncStatus: 'SYNCED',
                    };

                    setEditingRecord(recordToEdit);
                    setSelectedCellInfo(null);
                  }}
                  className="w-full py-2.5 bg-[#1E3A8A] hover:bg-[#172554] text-white font-bold rounded-xl text-xs transition-all shadow-xs flex items-center justify-center gap-1.5 cursor-pointer mt-3"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  <span>Edit Status Presensi (Admin)</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Handler edit presensi dari modal anggota tim */}
      {/* Pop Up Semua Anggota Tim (Presensi Masuk & Cuti/Izin) */}
      <TeamMembersModal
        isOpen={teamMembersModalData.isOpen}
        onClose={() => setTeamMembersModalData((prev) => ({ ...prev, isOpen: false }))}
        title={teamMembersModalData.title}
        subtitle={teamMembersModalData.subtitle}
        members={teamMembersModalData.members}
        isAdmin={isAdmin}
        onEditMember={(member) => {
          const matchedUser = users.find(
            (u) =>
              u.name.toLowerCase().includes(member.name.toLowerCase()) ||
              member.name.toLowerCase().includes(u.name.toLowerCase())
          );

          const rawDate = teamMembersModalData.date || getCurrentDateString();
          const existingRec = attendanceRecords.find(
            (r) => (r.userId === matchedUser?.id || r.userName === member.name) && r.date === rawDate
          );

          const recordToEdit: AttendanceRecord = existingRec || {
            id: `att_edit_${Date.now()}`,
            userId: matchedUser?.id || 'usr_unknown',
            userName: member.name,
            userAvatar:
              member.avatar ||
              matchedUser?.avatar ||
              'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=80&q=80',
            department: member.department || matchedUser?.department || 'Divisi Operasional',
            employmentType: matchedUser?.employmentType || 'CONTRACT',
            date: rawDate,
            clockInTime: '08:00',
            clockInLat: -6.2088,
            clockInLng: 106.8456,
            clockInStatus: 'ON_TIME',
            clockInLocationStatus: 'IN_OFFICE',
            clockInLateMinutes: 0,
            clockInDistanceMeter: 15,
            workMode: 'WFO',
            syncStatus: 'SYNCED',
          };

          setReturnToTeamModalOnClose(true);
          setEditingRecord(recordToEdit);
          setTeamMembersModalData((prev) => ({ ...prev, isOpen: false }));
        }}
      />

      {/* Pop Up Profil Singkat (Nama & Foto Orang) */}
      <SimpleProfileModal
        isOpen={!!simpleProfilePopup}
        onClose={() => setSimpleProfilePopup(null)}
        profile={simpleProfilePopup}
      />

      {/* Modal Edit Status Presensi Karyawan (Admin) */}
      {editingRecord && (
        <EditAttendanceModal
          isOpen={!!editingRecord}
          record={editingRecord}
          onClose={() => {
            setEditingRecord(null);
            if (returnToTeamModalOnClose) {
              setTeamMembersModalData((prev) => ({ ...prev, isOpen: true }));
              setReturnToTeamModalOnClose(false);
            }
          }}
          onSave={(updated) => {
            if (onUpdateRecord) {
              onUpdateRecord(updated);
            } else {
              AppStorage.saveAttendanceRecord(updated);
            }
            setEditingRecord(null);
            if (returnToTeamModalOnClose) {
              setTeamMembersModalData((prev) => ({
                ...prev,
                isOpen: true,
                members: prev.members.map((m) =>
                  m.name === updated.userName
                    ? {
                        ...m,
                        statusBadge:
                          updated.clockInStatus === 'LATE'
                            ? `Terlambat (${updated.clockInTime || ''})`
                            : `Hadir (${updated.clockInTime || ''})`,
                        statusColor: updated.clockInStatus === 'LATE' ? 'amber' : 'emerald',
                        locationBadge:
                          updated.clockInLocationStatus === 'IN_OFFICE'
                            ? 'Sesuai Radius'
                            : updated.clockInLocationStatus === 'WFH_APPROVED'
                            ? 'WFH'
                            : 'Luar Radius',
                      }
                    : m
                ),
              }));
              setReturnToTeamModalOnClose(false);
            }
          }}
        />
      )}

    </div>
  );
}
