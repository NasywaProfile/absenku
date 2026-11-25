import React, { useState, useEffect, useMemo } from 'react';
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
  AlertTriangle,
  Lock,
  Globe,
  ClipboardList,
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
import { ModernConfirmDialog } from '../common/ModernConfirmDialog.tsx';
import {
  getDailyStatus,
  getStatusStyle,
  getApprovedLeaveForDate,
  isOffCategory,
} from '../../lib/attendance-status.ts';

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
  onClearAllAttendance?: () => void;
}

export type LocationBadgeType = 'OFFICE' | 'WFH' | 'BUSINESS_TRIP' | 'OUT_OF_RANGE' | 'LEAVE' | 'SICK';

const LOCATION_TAG_CONFIG: Record<
  LocationBadgeType,
  { label: string; icon: React.ComponentType<{ className?: string }>; bg: string; text: string; border: string; iconColor: string }
> = {
  OFFICE: {
    label: 'Area Kantor',
    icon: Building2,
    bg: 'bg-emerald-50',
    text: 'text-emerald-800',
    border: 'border-emerald-200',
    iconColor: 'text-emerald-600',
  },
  WFH: {
    label: 'Dari Rumah',
    icon: Laptop,
    bg: 'bg-indigo-50',
    text: 'text-indigo-800',
    border: 'border-indigo-200',
    iconColor: 'text-indigo-600',
  },
  BUSINESS_TRIP: {
    label: 'Dinas Luar',
    icon: MapPin,
    bg: 'bg-purple-50',
    text: 'text-purple-800',
    border: 'border-purple-200',
    iconColor: 'text-purple-600',
  },
  OUT_OF_RANGE: {
    label: 'Di Luar Kantor',
    icon: AlertTriangle,
    bg: 'bg-rose-50',
    text: 'text-rose-800',
    border: 'border-rose-200',
    iconColor: 'text-rose-600',
  },
  LEAVE: {
    label: 'Bebas Absen',
    icon: CalendarDays,
    bg: 'bg-sky-50',
    text: 'text-sky-800',
    border: 'border-sky-200',
    iconColor: 'text-sky-600',
  },
  SICK: {
    label: 'Bebas Absen',
    icon: AlertCircle,
    bg: 'bg-rose-50',
    text: 'text-rose-800',
    border: 'border-rose-200',
    iconColor: 'text-rose-600',
  },
};

// Helper konversi string ke lowercase yang aman dari null / undefined
const safeLower = (str?: string | null): string => (str ? String(str).toLowerCase().trim() : '');

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
  statuses: Record<string, 'Hadir' | 'Terlambat' | 'WFH' | 'Sakit' | 'Dinas Luar' | 'Tidak Hadir' | 'Cuti/Izin' | 'Libur'>;
  lateWfhMap?: Record<string, number>;
  locations: {
    hasOffice: boolean;
    hasOutOfOffice: boolean;
  };
  locationTags: LocationBadgeType[];
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
  onClearAllAttendance,
}: AttendanceHistoryProps) {
  const [dataVersion, setDataVersion] = useState(0);

  useEffect(() => {
    const handleUpdate = () => setDataVersion((v) => v + 1);
    window.addEventListener('absenku:attendance_updated', handleUpdate);
    window.addEventListener('absenku:leaves_updated', handleUpdate);
    window.addEventListener('absenku:users_updated', handleUpdate);
    return () => {
      window.removeEventListener('absenku:attendance_updated', handleUpdate);
      window.removeEventListener('absenku:leaves_updated', handleUpdate);
      window.removeEventListener('absenku:users_updated', handleUpdate);
    };
  }, []);

  const currentUser = propCurrentUser || AppStorage.getCurrentUser() || ({} as User);
  const users = propUsers || AppStorage.getUsers() || [];

  const attendanceRecords = useMemo(() => {
    const storageRecs = AppStorage.getAttendanceRecords();
    const propRecs = propAttendanceRecords || propRecords || [];

    // Gabungkan rekaman dari server (props) dan localStorage secara pintar
    const map = new Map<string, AttendanceRecord>();
    for (const r of storageRecs) {
      if (r && (r.userId || r.userName) && r.date) {
        const key = `${r.userId || safeLower(r.userName).trim()}_${r.date}`;
        map.set(key, r);
      }
    }
    for (const r of propRecs) {
      if (r && (r.userId || r.userName) && r.date) {
        const key = `${r.userId || safeLower(r.userName).trim()}_${r.date}`;
        const existing = map.get(key);
        map.set(key, { ...(existing || {}), ...r });
      }
    }
    const combined = Array.from(map.values());
    const source = combined.length > 0 ? combined : storageRecs.length > 0 ? storageRecs : propRecs;
    return source.filter(
      (r) => r.userId !== 'usr_super_admin' && safeLower(r.userName) !== 'super admin'
    );
  }, [propAttendanceRecords, propRecords, dataVersion]);

  const leaves = useMemo(() => {
    const storageLeaves = AppStorage.getLeaveRequests();
    const propLeavesList = propLeaves || [];
    const map = new Map<string, LeaveRequest>();
    for (const l of storageLeaves) {
      if (l && l.id) {
        map.set(String(l.id), l);
      }
    }
    for (const l of propLeavesList) {
      if (l && l.id) {
        const existing = map.get(String(l.id));
        map.set(String(l.id), { ...(existing || {}), ...l });
      }
    }
    const combined = Array.from(map.values());
    const source = combined.length > 0 ? combined : storageLeaves.length > 0 ? storageLeaves : propLeavesList;
    return source.filter(
      (l) => l.userId !== 'usr_super_admin' && safeLower(l.userName) !== 'super admin'
    );
  }, [propLeaves, dataVersion]);

  const dailyTasks = useMemo(() => {
    const storageTasks = AppStorage.getDailyTasks();
    return storageTasks.length > 0 ? storageTasks : (propDailyTasks || []);
  }, [propDailyTasks, dataVersion]);

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

  // Roster tim dari pengguna yang terdaftar di sistem
  const fullTeamRoster: TeamMemberItem[] = useMemo(() => {
    return users
      .filter((u) => u.role === "EMPLOYEE")
      .map((u) => ({
        name: u.name,
        avatar: u.avatar || "",
        department: u.department,
        role: u.position,
        statusBadge: "Terdaftar",
        statusColor: "emerald",
      }));
  }, [users]);

  // Helper untuk membuka pop-up semua orang yang presensi masuk pada tanggal tersebut
  const handleOpenCheckInMembersModal = (row: MatrixRow) => {
    const todayDateStr = getCurrentDateString();
    const list: TeamMemberItem[] = [];
    const addedNames = new Set<string>();

    // 1. Ambil dari attendance records riil terlebih dahulu (Prioritas Utama)
    const allRecords = attendanceRecords || [];
    allRecords
      .filter((rec) => {
        const u = users.find((usr) => usr.id === rec.userId || safeLower(usr.name) === safeLower(rec.userName));
        return rec.date === row.rawDate && rec.clockInTime && u?.role !== 'SUPER_ADMIN';
      })
      .forEach((rec) => {
        if (!addedNames.has(rec.userName)) {
          const matchedUser = users.find(
            (usr) => usr.id === rec.userId || safeLower(usr.name) === safeLower(rec.userName)
          );

          const ds = getDailyStatus({
            user: { id: matchedUser?.id || rec.userId, name: matchedUser?.name || rec.userName },
            date: row.rawDate,
            records: attendanceRecords || [],
            leaves: leaves || [],
            today: todayDateStr,
          });

          // Cocokkan status persis sama dengan tabel matriks
          const empCol = employeeColumns.find(
            (col) =>
              safeLower(col) === safeLower(rec.userName) ||
              (matchedUser && safeLower(col) === safeLower(matchedUser.name))
          );
          const tableStatus = empCol ? row.statuses[empCol] : null;
          const lateMin =
            (empCol && row.lateWfhMap?.[empCol]) ||
            (ds.isLate ? ds.lateMinutes : (rec.clockInLateMinutes || 0));

          const isFreelance = rec.employmentType === 'FREELANCE';
          const isWfh = ds.location === 'WFH' || tableStatus === 'WFH' || rec.clockInLocationStatus === 'WFH_APPROVED' || (isFreelance && rec.clockInLocationStatus !== 'IN_OFFICE');
          const isBusinessTrip = ds.location === 'BUSINESS_TRIP' || tableStatus === 'Dinas Luar' || rec.clockInLocationStatus === 'DINAS_APPROVED';
          const isOutOfRange =
            !isWfh &&
            !isBusinessTrip &&
            !isFreelance &&
            (rec.clockInLocationStatus === 'OUT_OF_RANGE' ||
              (rec.clockInDistanceMeter !== undefined && rec.clockInDistanceMeter > 100));

          let statusText = 'Hadir WFO';
          let statusColor: 'emerald' | 'amber' | 'indigo' | 'purple' | 'rose' | 'slate' = 'emerald';

          if (isFreelance) {
            statusText = 'Hadir Freelance';
            statusColor = 'indigo';
          } else if (ds.key === 'WFH' || tableStatus === 'WFH') {
            if (lateMin > 0 || ds.isLate) {
              statusText = `WFH • Terlambat (${lateMin}m)`;
              statusColor = 'amber';
            } else {
              statusText = 'WFH';
              statusColor = 'indigo';
            }
          } else if (ds.key === 'BUSINESS_TRIP' || tableStatus === 'Dinas Luar') {
            if (lateMin > 0 || ds.isLate) {
              statusText = `Dinas Luar • Terlambat (${lateMin}m)`;
              statusColor = 'amber';
            } else {
              statusText = 'Dinas Luar';
              statusColor = 'purple';
            }
          } else if (ds.key === 'LATE' || tableStatus === 'Terlambat' || ds.isLate || rec.clockInStatus === 'LATE') {
            statusText = lateMin > 0 ? `Terlambat (${lateMin}m)` : 'Terlambat';
            statusColor = 'amber';
          } else if (ds.key === 'SICK' || tableStatus === 'Sakit') {
            statusText = 'Sakit';
            statusColor = 'rose';
          } else if (ds.key === 'LEAVE' || tableStatus === 'Cuti/Izin' || (tableStatus as any) === 'Izin / Cuti') {
            statusText = 'Izin / Cuti';
            statusColor = 'emerald';
          } else if (ds.location === 'OUT_OF_RANGE' || rec.clockInLocationStatus === 'OUT_OF_RANGE' || isOutOfRange) {
            statusText = 'Luar Radius';
            statusColor = 'rose';
          } else {
            statusText = 'Hadir WFO';
            statusColor = 'emerald';
          }

          const isOffDay = ds.key === 'LEAVE' || ds.key === 'SICK';
          const locationText = isOffDay
            ? undefined
            : isWfh
            ? 'Dari Rumah'
            : isBusinessTrip
            ? 'Dinas Luar'
            : isOutOfRange
            ? 'Di Luar Kantor'
            : 'Area Kantor';

          const userDailyTask = dailyTasks?.find(
            (t) =>
              (t.userId === (rec.userId || matchedUser?.id) ||
                safeLower(t.userName) === safeLower(rec.userName)) &&
              t.date === row.rawDate
          );
          const tasks =
            userDailyTask?.tasks && userDailyTask.tasks.length > 0
              ? userDailyTask.tasks
              : rec.tasksDoneSummary && rec.tasksDoneSummary.length > 0
              ? rec.tasksDoneSummary
              : undefined;
          const notes = rec.notes?.trim() || userDailyTask?.notes?.trim() || undefined;
          const clockTime = rec.clockInTime
            ? rec.clockInTime.includes('WIB')
              ? rec.clockInTime
              : `${rec.clockInTime} WIB`
            : undefined;

          list.push({
            id: rec.userId || matchedUser?.id,
            name: rec.userName,
            avatar: rec.userAvatar || matchedUser?.avatar || '',
            department: rec.department || matchedUser?.department || 'Divisi Operasional',
            role: matchedUser?.position || matchedUser?.role || 'Karyawan',
            clockInTime: clockTime,
            statusBadge: statusText,
            statusColor: statusColor as any,
            locationBadge: locationText,
            locationColor: (isWfh || isBusinessTrip) ? 'indigo' : isOutOfRange ? 'amber' : 'emerald',
            logbookTasks: tasks,
            notes: notes,
          });
          addedNames.add(rec.userName);
        }
      });

    // 2. Kolom matriks lainnya yang berstatus Hadir, Terlambat, WFH, atau Dinas Luar jika belum masuk
    employeeColumns.forEach((colName) => {
      const st = row.statuses[colName];
      const fullName = employeeNamesMap[colName] || colName;
      if ((st === 'Hadir' || st === 'Terlambat' || st === 'WFH' || st === 'Dinas Luar') && !addedNames.has(fullName) && !addedNames.has(colName)) {
        const avatar = employeeAvatarMap[colName] || sampleAvatars[0];
        const isLate = st === 'Terlambat';
        const isWfh = st === 'WFH';
        const isBusinessTrip = st === 'Dinas Luar';
        const lateMin = row.lateWfhMap?.[colName];

        const userRec = (attendanceRecords || []).find(
          (r) =>
            r.date === row.rawDate &&
            (safeLower(r.userName) === safeLower(fullName) ||
              safeLower(r.userName) === safeLower(colName))
        );
        const userObj = users.find(
          (u) =>
            safeLower(u.name) === safeLower(fullName) ||
            safeLower(u.name) === safeLower(colName)
        );
        const userDailyTask = dailyTasks?.find(
          (t) =>
            (t.userId === (userRec?.userId || userObj?.id) ||
              safeLower(t.userName) === safeLower(fullName) ||
              safeLower(t.userName) === safeLower(colName)) &&
            t.date === row.rawDate
        );

        const tasks =
          userDailyTask?.tasks && userDailyTask.tasks.length > 0
            ? userDailyTask.tasks
            : userRec?.tasksDoneSummary && userRec.tasksDoneSummary.length > 0
            ? userRec.tasksDoneSummary
            : undefined;
        const notes = userRec?.notes?.trim() || userDailyTask?.notes?.trim() || undefined;
        const clockTime = userRec?.clockInTime
          ? userRec.clockInTime.includes('WIB')
            ? userRec.clockInTime
            : `${userRec.clockInTime} WIB`
          : undefined;

        let statusText: string = st;
        let statusColor: 'emerald' | 'amber' | 'indigo' | 'purple' | 'rose' = 'emerald';
        if (isWfh) {
          if (lateMin) {
            statusText = `WFH • Terlambat (${lateMin}m)`;
            statusColor = 'amber';
          } else {
            statusText = 'WFH';
            statusColor = 'indigo';
          }
        } else if (isBusinessTrip) {
          if (lateMin) {
            statusText = `Dinas Luar • Terlambat (${lateMin}m)`;
            statusColor = 'amber';
          } else {
            statusText = 'Dinas Luar';
            statusColor = 'purple';
          }
        } else if (isLate) {
          statusText = lateMin ? `Terlambat (${lateMin}m)` : 'Terlambat';
          statusColor = 'amber';
        }

        const isOutOfRangeCol = !isWfh && !isBusinessTrip && (userRec?.clockInLocationStatus === 'OUT_OF_RANGE' || (userRec?.clockInDistanceMeter !== undefined && userRec.clockInDistanceMeter > 100));
        const locBadgeText = isWfh ? 'Dari Rumah' : isBusinessTrip ? 'Dinas Luar' : isOutOfRangeCol ? 'Di Luar Kantor' : 'Area Kantor';

        list.push({
          id: userObj?.id || userRec?.userId,
          name: fullName,
          avatar,
          department: userObj?.department || 'Divisi Operasional',
          role: userObj?.position || userObj?.role || 'Karyawan',
          clockInTime: clockTime,
          statusBadge: statusText,
          statusColor: statusColor as any,
          locationBadge: locBadgeText,
          locationColor: isWfh ? 'indigo' : isBusinessTrip ? 'purple' : isOutOfRangeCol ? 'rose' : 'emerald',
          logbookTasks: tasks,
          notes: notes,
        });
        addedNames.add(fullName);
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

  // Helper untuk membuka pop-up semua orang yang cuti / sakit / izin pada tanggal tersebut
  const handleOpenCutiMembersModal = (row: MatrixRow) => {
    const list: TeamMemberItem[] = [];
    const addedNames = new Set<string>();

    // 1. Kolom matriks yang statusnya 'Cuti/Izin' atau 'Sakit'
    employeeColumns.forEach((colName) => {
      const st = row.statuses[colName];
      if (st === 'Cuti/Izin' || st === 'Sakit') {
        const fullName = employeeNamesMap[colName] || colName;
        const avatar = employeeAvatarMap[colName] || sampleAvatars[0] || '';

        // Cari pengajuan cuti/sakit yang cocok
        const matchedLeave = (leaves || []).find((l) => {
          const u = users.find((usr) => usr.id === l.userId || safeLower(usr.name) === safeLower(l.userName));
          const isNameMatch =
            (u && (safeLower(u.name) === safeLower(fullName) || safeLower(u.name).includes(safeLower(colName)))) ||
            safeLower(l.userName) === safeLower(fullName) ||
            safeLower(l.userName).includes(safeLower(colName));
          return (
            l.status === 'APPROVED' &&
            row.rawDate >= l.startDate &&
            row.rawDate <= l.endDate &&
            isNameMatch
          );
        });

        const userObj = users.find(
          (u) =>
            safeLower(u.name) === safeLower(fullName) ||
            safeLower(u.name).includes(safeLower(colName))
        );

        const isSick = st === 'Sakit';
        const attachmentName = matchedLeave?.attachmentName;
        const attachmentData = matchedLeave?.attachmentData;
        const attachmentType = matchedLeave?.attachmentType;

        list.push({
          id: userObj?.id || matchedLeave?.userId,
          name: fullName,
          avatar,
          department: userObj?.department || matchedLeave?.department || 'Divisi Operasional',
          role: userObj?.role || 'Karyawan',
          statusBadge: isSick ? 'Sakit' : 'Cuti / Izin',
          statusColor: isSick ? 'rose' : 'amber',
          attachmentName,
          attachmentData,
          attachmentType,
        });
        addedNames.add(fullName);
      }
    });

    // 2. Ambil dari leaves yang disetujui untuk tanggal ini (khusus Cuti / Sakit / Izin)
    (leaves || [])
      .filter((l) => {
        const u = users.find((usr) => usr.id === l.userId || safeLower(usr.name) === safeLower(l.userName));
        return (
          l.status === 'APPROVED' &&
          l.category !== 'WFH' &&
          l.category !== 'BUSINESS_TRIP' &&
          row.rawDate >= l.startDate &&
          row.rawDate <= l.endDate &&
          u?.role !== 'SUPER_ADMIN'
        );
      })
      .forEach((l) => {
        if (!addedNames.has(l.userName)) {
          const userObj = users.find((u) => u.id === l.userId || safeLower(u.name) === safeLower(l.userName));
          const isSick = l.category === 'SICK';
          const attachmentName = l.attachmentName;
          const attachmentData = l.attachmentData;
          const attachmentType = l.attachmentType;

          list.push({
            id: l.userId || userObj?.id,
            name: l.userName,
            avatar: l.userAvatar || userObj?.avatar,
            department: l.department || userObj?.department || 'Divisi Operasional',
            role: userObj?.role || 'Karyawan',
            statusBadge: isSick ? 'Sakit' : 'Cuti / Izin',
            statusColor: isSick ? 'rose' : 'amber',
            attachmentName,
            attachmentData,
            attachmentType,
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
      title: 'Daftar Karyawan Cuti / Sakit / Izin',
      subtitle: `Tanggal ${row.dateStr} • ${list.length} Karyawan (Cuti / Sakit / Izin)`,
      members: list,
    });
  };

  // Kolom nama karyawan di tabel presensi: Menampilkan seluruh karyawan aktif atau yang memiliki rekaman presensi / izin
  const employeeColumns = useMemo(() => {
    const list: string[] = [];
    const seen = new Set<string>();

    // 1. Karyawan aktif dari daftar pengguna (Super Admin dikecualikan dari presensi)
    users
      .filter((u) => {
        if (u.role === 'SUPER_ADMIN' || u.id === 'usr_super_admin') return false;
        const s = (u.status || '').toUpperCase();
        return s === 'ACTIVE' || s === 'APPROVED' || !s;
      })
      .forEach((u) => {
        const name = (u.name || '').trim();
        if (name && !seen.has(safeLower(name))) {
          seen.add(safeLower(name));
          list.push(name);
        }
      });

    // 2. Karyawan yang tercatat dalam riwayat presensi (agar tidak pernah hilang dari matriks)
    (attendanceRecords || []).forEach((r) => {
      const name = (r.userName || '').trim();
      if (name && safeLower(name) !== 'super admin' && !seen.has(safeLower(name))) {
        seen.add(safeLower(name));
        list.push(name);
      }
    });

    // 3. Karyawan yang memiliki pengajuan cuti/izin
    (leaves || []).forEach((l) => {
      const name = (l.userName || '').trim();
      if (name && safeLower(name) !== 'super admin' && !seen.has(safeLower(name))) {
        seen.add(safeLower(name));
        list.push(name);
      }
    });

    return list;
  }, [users, attendanceRecords, leaves]);

  // Mapping nama & foto profil karyawan untuk kolom matriks
  const employeeNamesMap = useMemo(() => {
    const map: Record<string, string> = {};
    users
      .filter((u) => u.role !== 'SUPER_ADMIN')
      .forEach((u) => {
        if (u.name) map[u.name] = u.name;
      });
    (attendanceRecords || []).forEach((r) => {
      if (r.userName) map[r.userName] = r.userName;
    });
    return map;
  }, [users, attendanceRecords]);

  const employeeAvatarMap = useMemo(() => {
    const map: Record<string, string> = {};
    users
      .filter((u) => u.role !== 'SUPER_ADMIN')
      .forEach((u) => {
        if (u.name && u.avatar) {
          map[u.name] = u.avatar;
        }
      });
    (attendanceRecords || []).forEach((r) => {
      if (r.userName && r.userAvatar && !map[r.userName]) {
        map[r.userName] = r.userAvatar;
      }
    });
    return map;
  }, [users, attendanceRecords]);

  // Avatar foto profil untuk check-in avatar stack
  const sampleAvatars = useMemo(() => {
    const list = users.map((u) => u.avatar).filter(Boolean);
    if (list.length > 0) return list;
    return [
      'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=80&q=80',
    ];
  }, [users]);

  const findUserByAvatar = (avatarUrl: string): SimpleProfileData => {
    const matched = users.find((u) => u.avatar === avatarUrl);
    if (matched) return { name: matched.name, avatar: matched.avatar };
    return { name: 'Karyawan Presensi', avatar: avatarUrl };
  };

  // Pagination State: 10 teratas per halaman
  const [matrixPage, setMatrixPage] = useState(1);
  const [personalPage, setPersonalPage] = useState(1);
  const ITEMS_PER_PAGE = 10;

  // Dataset Baris Matriks Dinamis: Dibangun sepenuhnya dari riwayat presensi yang tersimpan & pengajuan izin yang disetujui (Kecuali Super Admin)
  const allMatrixRows = useMemo(() => {
    const todayDateStr = getCurrentDateString();
    const dateSet = new Set<string>();

    // Riwayat presensi hanya mencakup tanggal hari ini ke belakang (<= todayDateStr)
    (attendanceRecords || []).forEach((r) => {
      const u = users.find((usr) => usr.id === r.userId || safeLower(usr.name) === safeLower(r.userName));
      if (r.date && r.date <= todayDateStr && u?.role !== 'SUPER_ADMIN') {
        dateSet.add(r.date);
      }
    });

    (leaves || []).forEach((l) => {
      const u = users.find((usr) => usr.id === l.userId || safeLower(usr.name) === safeLower(l.userName));
      if (l.status === 'APPROVED' && l.startDate && l.endDate && u?.role !== 'SUPER_ADMIN') {
        const [sy, sm, sd] = l.startDate.split('-').map(Number);
        const [ey, em, ed] = l.endDate.split('-').map(Number);
        const curr = new Date(sy, sm - 1, sd);
        const end = new Date(ey, em - 1, ed);
        while (curr <= end) {
          const y = curr.getFullYear();
          const m = String(curr.getMonth() + 1).padStart(2, '0');
          const d = String(curr.getDate()).padStart(2, '0');
          const dateStr = `${y}-${m}-${d}`;
          if (dateStr <= todayDateStr) {
            dateSet.add(dateStr);
          }
          curr.setDate(curr.getDate() + 1);
        }
      }
    });

    if (dateSet.size === 0) {
      return [];
    }

    // Ambil tanggal unik dan urutkan menurun secara pasti (terbaru paling atas)
    const uniqueDates = Array.from(dateSet).sort((a, b) => b.localeCompare(a));

    return uniqueDates.map((rawDate, idx) => {
      const dParts = rawDate.split('-');
      const dateFormatted = `${dParts[2]}/${dParts[1]}/${dParts[0]}`;
      const dObj = new Date(rawDate);
      const dayOfWeek = dObj.getDay();
      const isWeekend = (dayOfWeek === 0 || dayOfWeek === 6) && rawDate !== todayDateStr;

      const dayRecords = (attendanceRecords || []).filter((r) => {
        const u = users.find((usr) => usr.id === r.userId || safeLower(usr.name).trim() === safeLower(r.userName).trim());
        return r.date === rawDate && u?.role !== 'SUPER_ADMIN';
      });

      const statuses: Record<string, 'Hadir' | 'Terlambat' | 'WFH' | 'Sakit' | 'Dinas Luar' | 'Tidak Hadir' | 'Cuti/Izin' | 'Libur'> = {};
      const lateWfhMap: Record<string, number> = {};
      const lateNotesMap: Record<string, string> = {};
      const cutiAvatars: string[] = [];

      employeeColumns.forEach((emp) => {
        const matchedUser = users.find(
          (u) =>
            safeLower(u.name).trim() === safeLower(emp).trim() ||
            safeLower(u.name).trim().includes(safeLower(emp).trim())
        );

        const empRec = dayRecords.find(
          (r) =>
            (matchedUser?.id && r.userId === matchedUser.id) ||
            safeLower(r.userName).trim() === safeLower(emp).trim()
        );
        if (empRec?.notes && empRec.notes.trim()) {
          lateNotesMap[emp] = empRec.notes.trim();
        }

        const ds = getDailyStatus({
          user: { id: matchedUser?.id || emp, name: matchedUser?.name || emp },
          date: rawDate,
          records: dayRecords,
          leaves: leaves || [],
          today: todayDateStr,
        });

        let mappedStatus: 'Hadir' | 'Terlambat' | 'WFH' | 'Sakit' | 'Dinas Luar' | 'Tidak Hadir' | 'Cuti/Izin' | 'Libur' = 'Tidak Hadir';
        if (ds.key === 'PRESENT') mappedStatus = 'Hadir';
        else if (ds.key === 'LATE') mappedStatus = 'Terlambat';
        else if (ds.key === 'WFH') mappedStatus = 'WFH';
        else if (ds.key === 'BUSINESS_TRIP') mappedStatus = 'Dinas Luar';
        else if (ds.key === 'SICK') mappedStatus = 'Sakit';
        else if (ds.key === 'LEAVE') mappedStatus = 'Cuti/Izin';
        else if (ds.key === 'HOLIDAY') mappedStatus = 'Libur';
        else if (ds.key === 'TODAY_PENDING') mappedStatus = 'Tidak Hadir';
        else mappedStatus = 'Tidak Hadir';

        statuses[emp] = mappedStatus;

        if (ds.isLate && ds.lateMinutes) {
          lateWfhMap[emp] = ds.lateMinutes;
        }

        // Kumpulkan avatar hanya jika karyawan berstatus OFF (Sakit / Cuti / Izin)
        if (ds.isOff) {
          const cav = employeeAvatarMap[emp] || matchedUser?.avatar;
          if (cav && !cutiAvatars.includes(cav)) {
            cutiAvatars.push(cav);
          }
        }
      });

      // Karyawan yang benar-benar tercatat hadir (tidak berstatus OFF)
      const clockedInRecords = dayRecords.filter((r) => {
        if (!r.clockInTime) return false;
        const u = users.find((usr) => usr.id === r.userId || safeLower(usr.name) === safeLower(r.userName));
        const ds = getDailyStatus({
          user: { id: u?.id || r.userId, name: u?.name || r.userName },
          date: rawDate,
          records: dayRecords,
          leaves: leaves || [],
          today: todayDateStr,
        });
        return ds.isPresent;
      });

      const avatars = clockedInRecords.map((r) => r.userAvatar).filter(Boolean) as string[];

      // Kumpulkan status lokasi unik (Sinkron 100% dengan detail presensi)
      const locationTagSet = new Set<LocationBadgeType>();

      clockedInRecords.forEach((rec) => {
        const u = users.find((usr) => usr.id === rec.userId || safeLower(usr.name) === safeLower(rec.userName));
        const ds = getDailyStatus({
          user: { id: u?.id || rec.userId, name: u?.name || rec.userName },
          date: rawDate,
          records: dayRecords,
          leaves: leaves || [],
          today: todayDateStr,
        });

        const empCol = employeeColumns.find(
          (col) =>
            safeLower(col) === safeLower(rec.userName) ||
            (u && safeLower(col) === safeLower(u.name))
        );
        const tableStatus = empCol ? statuses[empCol] : null;

        const isFreelance = rec.employmentType === 'FREELANCE';
        const isWfh = ds.location === 'WFH' || tableStatus === 'WFH' || rec.clockInLocationStatus === 'WFH_APPROVED' || (isFreelance && rec.clockInLocationStatus !== 'IN_OFFICE');
        const isBusinessTrip = ds.location === 'BUSINESS_TRIP' || tableStatus === 'Dinas Luar' || rec.clockInLocationStatus === 'DINAS_APPROVED';
        const isOutOfRange =
          !isWfh &&
          !isBusinessTrip &&
          !isFreelance &&
          (rec.clockInLocationStatus === 'OUT_OF_RANGE' ||
            (rec.clockInDistanceMeter !== undefined && rec.clockInDistanceMeter > 100));

        if (isBusinessTrip) {
          locationTagSet.add('BUSINESS_TRIP');
        } else if (isWfh) {
          locationTagSet.add('WFH');
        } else if (isOutOfRange) {
          locationTagSet.add('OUT_OF_RANGE');
        } else {
          locationTagSet.add('OFFICE');
        }
      });

      // Ditambah dari status karyawan (WFH atau Dinas Luar)
      employeeColumns.forEach((emp) => {
        const st = statuses[emp];
        if (st === 'WFH') locationTagSet.add('WFH');
        else if (st === 'Dinas Luar') locationTagSet.add('BUSINESS_TRIP');
      });

      const hasOffice = locationTagSet.has('OFFICE');
      const hasOutOfOffice = locationTagSet.has('OUT_OF_RANGE');

      const tagOrder: LocationBadgeType[] = ['OFFICE', 'WFH', 'BUSINESS_TRIP', 'OUT_OF_RANGE'];
      const locationTags = tagOrder.filter((tag) => locationTagSet.has(tag));

      return {
        index: idx + 1,
        dateStr: dateFormatted,
        rawDate,
        isHoliday: isWeekend,
        checkIn: {
          hasCheckmark: clockedInRecords.length > 0,
          avatars: avatars.slice(0, 3),
          countBadge: clockedInRecords.length > 3 ? `+${clockedInRecords.length - 3}` : undefined,
          isPurple: isWeekend,
        },
        cutiAvatars,
        statuses,
        lateWfhMap,
        lateNotesMap,
        locations: {
          hasOffice,
          hasOutOfOffice,
        },
        locationTags,
      };
    });
  }, [attendanceRecords, leaves, employeeColumns, users]);

  // Filter Hari & Tanggal Spesifik (Basis data sebelum pencarian teks)
  const baseMatrixRows = useMemo(() => {
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

    return result;
  }, [allMatrixRows, filterType, specificDateFilter]);

  // Filter & Urutan Data Kehadiran Tim (Mendukung pencarian nama, status, lokasi, dan tanggal)
  const displayedRows = useMemo(() => {
    let result = [...baseMatrixRows];

    // Filter Pencarian Teks (Cari riwayat presensi: nama, status, lokasi, tanggal)
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter((r) => {
        // 1. Pencarian Tanggal (format DD/MM/YYYY, YYYY-MM-DD, atau nama hari/bulan bahasa Indonesia)
        if (r.dateStr.toLowerCase().includes(q) || r.rawDate.toLowerCase().includes(q)) return true;
        try {
          const dParts = r.rawDate.split('-');
          if (dParts.length === 3) {
            const dObj = new Date(parseInt(dParts[0]), parseInt(dParts[1]) - 1, parseInt(dParts[2]));
            const indoDate = dObj.toLocaleDateString('id-ID', {
              weekday: 'long',
              day: 'numeric',
              month: 'long',
              year: 'numeric',
            }).toLowerCase();
            if (indoDate.includes(q)) return true;
          }
        } catch {
          // Abaikan kesalahan parsing tanggal
        }

        // 2. Pencarian Keterangan Lokasi
        const locationLabels: string[] = [];
        (r.locationTags || []).forEach((tag) => {
          const cfg = LOCATION_TAG_CONFIG[tag];
          if (cfg) locationLabels.push(cfg.label.toLowerCase());
        });
        if (r.locations?.hasOffice) {
          locationLabels.push('kantor', 'di kantor', 'office', 'wfo');
        }
        if (r.locations?.hasOutOfOffice) {
          locationLabels.push('di luar kantor', 'luar kantor', 'out of range');
        }
        if (locationLabels.some((lbl) => lbl.includes(q))) return true;

        // Cek langsung kecocokan istilah lokasi umum
        if (
          (q === 'kantor' || q === 'office' || q === 'wfo') &&
          (r.locations?.hasOffice || r.locationTags?.includes('OFFICE'))
        ) return true;
        if (
          (q === 'wfh' || q === 'rumah' || q === 'work from home') &&
          r.locationTags?.includes('WFH')
        ) return true;
        if (
          (q === 'dinas' || q === 'dinas luar' || q === 'business trip') &&
          r.locationTags?.includes('BUSINESS_TRIP')
        ) return true;
        if (
          (q === 'luar' || q === 'luar kantor' || q === 'di luar kantor' || q === 'radius') &&
          (r.locations?.hasOutOfOffice || r.locationTags?.includes('OUT_OF_RANGE'))
        ) return true;

        // 3. Pencarian Status Kehadiran
        const statusSynonyms: Record<string, string[]> = {
          hadir: ['hadir', 'masuk', 'present', 'tepat waktu', 'on time'],
          terlambat: ['terlambat', 'telat', 'late'],
          wfh: ['wfh', 'rumah', 'work from home'],
          'dinas luar': ['dinas', 'dinas luar', 'business trip'],
          sakit: ['sakit', 'sick'],
          'cuti/izin': ['cuti', 'izin', 'cuti/izin', 'leave', 'permit'],
          'tidak hadir': ['tidak hadir', 'alpa', 'absen', 'absent'],
          libur: ['libur', 'holiday', 'weekend', 'akhir pekan'],
        };

        const matchesStatus = Object.values(r.statuses).some((st) => {
          const sLower = st.toLowerCase();
          if (sLower.includes(q)) return true;
          const syns = statusSynonyms[sLower];
          return syns && syns.some((syn) => syn.includes(q) || q.includes(syn));
        });
        if (matchesStatus) return true;

        // 4. Pencarian Nama Karyawan (Cari baris di mana nama karyawan ada & memiliki status aktif/presensi)
        for (const [employee, status] of Object.entries(r.statuses)) {
          const empLower = employee.toLowerCase();
          if (empLower.includes(q)) {
            // Jika user mencari nama tertentu, cocokkan baris di mana karyawan hadir/berkegiatan (bukan default tidak hadir/libur)
            if (status !== 'Tidak Hadir' && status !== 'Libur') return true;
            // Atau ada catatan absensi/cuti pada tanggal tersebut
            const hasRec = (attendanceRecords || []).some(
              (rec) => rec.date === r.rawDate && (safeLower(rec.userName).includes(empLower) || empLower.includes(safeLower(rec.userName)))
            );
            if (hasRec) return true;
            const hasLeave = (leaves || []).some(
              (l) => r.rawDate >= l.startDate && r.rawDate <= l.endDate && (safeLower(l.userName).includes(empLower) || empLower.includes(safeLower(l.userName)))
            );
            if (hasLeave) return true;
          }
        }

        // 5. Pencarian multi-kata (misal: "Rina Hadir", "Devi WFH", "Kantor Budi")
        const tokens = q.split(/\s+/).filter(Boolean);
        if (tokens.length > 1) {
          const allTokensMatch = tokens.every((token) => {
            if (r.dateStr.toLowerCase().includes(token) || r.rawDate.toLowerCase().includes(token)) return true;
            if (locationLabels.some((lbl) => lbl.includes(token))) return true;
            for (const [employee, status] of Object.entries(r.statuses)) {
              if (employee.toLowerCase().includes(token)) return true;
              if (status.toLowerCase().includes(token)) return true;
            }
            return false;
          });
          if (allTokensMatch) return true;
        }

        return false;
      });
    }

    // Pastikan histori terbaru selalu muncul di baris paling atas secara default (DESC)
    result.sort((a, b) => {
      const cmp = b.rawDate.localeCompare(a.rawDate);
      return sortOrder === 'DESC' ? cmp : -cmp;
    });

    return result;
  }, [baseMatrixRows, searchQuery, sortOrder, attendanceRecords, leaves]);

  // Data Baris untuk Tampilan Absensi Pribadi (Desain persis Kehadiran Tim cuman khusus perorangan)
  const personalRows = useMemo(() => {
    const todayDateStr = getCurrentDateString();
    return baseMatrixRows.map((row) => {
      const myRecord = attendanceRecords.find(
        (r) => (r.userId === currentUser.id || safeLower(r.userName) === safeLower(currentUser.name)) && r.date === row.rawDate
      );
      const myTaskLog = dailyTasks?.find(
        (t) => (t.userId === currentUser.id || safeLower(t.userName) === safeLower(currentUser.name)) && t.date === row.rawDate
      );

      const ds = getDailyStatus({
        user: { id: currentUser.id, name: currentUser.name },
        date: row.rawDate,
        records: attendanceRecords,
        leaves: leaves || [],
        today: todayDateStr,
      });

      const statusText = ds.fullLabel;
      const statusBadgeClass = getStatusStyle(ds).pill;
      const hasCheckmark = ds.isPresent || ds.isOff;
      const clockIn = ds.isOff
        ? 'OFF'
        : myRecord?.clockInTime
        ? `${myRecord.clockInTime} WIB`
        : row.isHoliday
        ? '-'
        : '—';

      const isFreelance = currentUser.employmentType === 'FREELANCE';
      const isWfh = ds.location === 'WFH' || myRecord?.clockInLocationStatus === 'WFH_APPROVED' || myRecord?.workMode === 'WFH' || (isFreelance && myRecord?.clockInLocationStatus !== 'IN_OFFICE');
      const isBusinessTrip = ds.location === 'BUSINESS_TRIP' || myRecord?.clockInLocationStatus === 'DINAS_APPROVED' || myRecord?.workMode === 'DINAS';
      const isOutOfRange =
        !isWfh &&
        !isBusinessTrip &&
        !isFreelance &&
        (myRecord?.clockInLocationStatus === 'OUT_OF_RANGE' ||
          (myRecord?.clockInDistanceMeter !== undefined && myRecord.clockInDistanceMeter > 100));

      let locationMode = '—';
      if (ds.isOff) {
        locationMode = 'Bebas Absen';
      } else if (isWfh) {
        locationMode = 'Dari Rumah';
      } else if (isBusinessTrip) {
        locationMode = 'Dinas Luar';
      } else if (isOutOfRange) {
        locationMode = 'Di Luar Kantor';
      } else if (ds.isPresent || myRecord?.clockInTime) {
        locationMode = 'Area Kantor';
      } else if (row.isHoliday) {
        locationMode = 'Libur Akhir Pekan';
      }

      let taskSummary = '-';
      if (ds.isOff) {
        taskSummary = ds.leave?.reason || 'Pengajuan Perizinan Disetujui';
      } else if (myTaskLog?.tasks && myTaskLog.tasks.length > 0) {
        taskSummary = myTaskLog.tasks.join(', ');
        if (myRecord?.notes && myRecord.notes.trim()) {
          taskSummary += ` (Alasan: ${myRecord.notes.trim()})`;
        }
      } else if (myRecord?.tasksDoneSummary && myRecord.tasksDoneSummary.length > 0) {
        taskSummary = myRecord.tasksDoneSummary.join(', ');
        if (myRecord?.notes && myRecord.notes.trim()) {
          taskSummary += ` (Alasan: ${myRecord.notes.trim()})`;
        }
      } else if (myRecord?.notes && myRecord.notes.trim()) {
        taskSummary = myRecord.clockInStatus === 'LATE'
          ? `Alasan: "${myRecord.notes.trim()}"`
          : myRecord.notes.trim();
      } else {
        taskSummary = '-';
      }

      let category: 'LEAVE' | 'WFH' | 'SICK' | 'BUSINESS_TRIP' | undefined = undefined;
      if (ds.key === 'LEAVE') category = 'LEAVE';
      else if (ds.key === 'SICK') category = 'SICK';
      else if (ds.key === 'WFH') category = 'WFH';
      else if (ds.key === 'BUSINESS_TRIP') category = 'BUSINESS_TRIP';

      return {
        ...row,
        statusText,
        statusBadgeClass,
        clockIn,
        locationMode,
        taskSummary,
        hasCheckmark,
        category,
        isOff: ds.isOff,
      };
    });
  }, [displayedRows, attendanceRecords, leaves, dailyTasks, currentUser.id, currentUser.name]);

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

    return { all: personalRows.length, leave, wfh, sick, businessTrip };
  }, [personalRows]);

  // Filter Absensi Pribadi berdasarkan Kategori (1. Izin / Cuti s/d 4. Dinas Luar) & Pencarian
  const filteredPersonalRows = useMemo(() => {
    let result = personalRows;
    if (personalCategoryFilter !== 'ALL') {
      result = result.filter((r) => r.category === personalCategoryFilter);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter((r) => {
        // 1. Tanggal (DD/MM/YYYY, YYYY-MM-DD, nama hari/bulan)
        if (r.dateStr.toLowerCase().includes(q) || r.rawDate.toLowerCase().includes(q)) return true;
        try {
          const dParts = r.rawDate.split('-');
          if (dParts.length === 3) {
            const dObj = new Date(parseInt(dParts[0]), parseInt(dParts[1]) - 1, parseInt(dParts[2]));
            const indoDate = dObj.toLocaleDateString('id-ID', {
              weekday: 'long',
              day: 'numeric',
              month: 'long',
              year: 'numeric',
            }).toLowerCase();
            if (indoDate.includes(q)) return true;
          }
        } catch {}

        // 2. Status & Nama
        if (safeLower(r.statusText).includes(q)) return true;
        if (safeLower(currentUser.name).includes(q)) return true;

        // 3. Lokasi
        if (safeLower(r.locationMode).includes(q)) return true;

        // 4. Catatan / Rangkuman tugas
        if (safeLower(r.taskSummary).includes(q)) return true;

        // 5. Sinonim Status & Lokasi
        if ((q === 'hadir' || q === 'masuk' || q === 'tepat waktu') && r.hasCheckmark) return true;
        if ((q === 'telat' || q === 'terlambat') && safeLower(r.statusText).includes('terlambat')) return true;
        if ((q === 'kantor' || q === 'office' || q === 'wfo') && safeLower(r.locationMode).includes('kantor')) return true;
        if ((q === 'wfh' || q === 'rumah') && (safeLower(r.locationMode).includes('wfh') || safeLower(r.locationMode).includes('rumah'))) return true;
        if ((q === 'dinas' || q === 'dinas luar') && safeLower(r.locationMode).includes('dinas')) return true;
        if ((q === 'luar' || q === 'luar kantor' || q === 'di luar kantor' || q === 'radius') && safeLower(r.locationMode).includes('luar')) return true;
        if ((q === 'cuti' || q === 'izin') && (safeLower(r.statusText).includes('izin') || safeLower(r.statusText).includes('cuti'))) return true;
        if (q === 'sakit' && safeLower(r.statusText).includes('sakit')) return true;

        return false;
      });
    }
    // Pastikan histori terbaru selalu muncul di baris paling atas
    result.sort((a, b) => {
      const cmp = b.rawDate.localeCompare(a.rawDate);
      return sortOrder === 'DESC' ? cmp : -cmp;
    });
    return result;
  }, [personalRows, personalCategoryFilter, searchQuery, sortOrder, currentUser.name]);

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
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs relative z-10 p-2.5 sm:p-3.5">
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
                className={`h-9 px-3 flex items-center justify-center gap-1.5 font-bold text-xs rounded-xl transition-all cursor-pointer shadow-2xs whitespace-nowrap shrink-0 border ${
                  specificDateFilter || filterType !== 'ALL'
                    ? 'bg-blue-50 border-blue-300 text-[#1E3A8A] ring-1 ring-blue-300/40'
                    : 'bg-white hover:bg-slate-50 text-slate-800 border-slate-200'
                }`}
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
          <Tooltip content="Cari riwayat presensi berdasarkan nama, status, lokasi, atau tanggal" position="bottom" className="flex-1">
            <div className="relative flex items-center w-full">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cari riwayat presensi..."
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

            <Tooltip content="Cari riwayat presensi berdasarkan nama, status, lokasi, atau tanggal" position="bottom" className="flex-1 mx-2 max-w-2xl">
              <div className="relative flex items-center w-full">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 pointer-events-none" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Cari riwayat presensi..."
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
                  className={`flex items-center gap-2 font-bold rounded-xl transition-all cursor-pointer shadow-2xs whitespace-nowrap border ${
                    specificDateFilter || filterType !== 'ALL'
                      ? 'bg-blue-50 border-blue-300 text-[#1E3A8A] ring-1 ring-blue-300/40'
                      : 'bg-white hover:bg-slate-50 text-slate-800 border-slate-200/90'
                  } ${
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
            <table className="w-full border-collapse text-left text-xs min-w-max">
              {/* TABLE HEADER */}
              <thead>
                <tr className="border-b border-slate-200/80 bg-white text-slate-600 font-semibold text-xs">
                  {/* Kolom Tanggal (Bahasa Indonesia) */}
                  <th className="py-3.5 px-4 font-semibold text-slate-600 whitespace-nowrap min-w-[130px]">Tanggal</th>

                  {/* Kolom Presensi Masuk (Summary pill) */}
                  <th className="py-3.5 px-4 font-semibold text-slate-600 whitespace-nowrap min-w-[160px]">Presensi Masuk</th>

                  {/* Kolom Keterangan Lokasi */}
                  <th className="py-3.5 px-4 font-semibold text-slate-600 whitespace-nowrap min-w-[170px]">Keterangan Lokasi</th>

                  {/* Kolom Cuti / Sakit / Izin */}
                  <th className="py-3.5 px-4 font-semibold text-slate-600 whitespace-nowrap min-w-[180px]">Cuti / Sakit / Izin</th>

                  {/* Kolom Tiap Karyawan (Dinamis dari Karyawan Terdaftar) */}
                  {employeeColumns.length === 0 ? (
                    <th className="py-3.5 px-4 font-medium text-slate-400 italic text-center min-w-[200px] whitespace-nowrap">
                      Belum Ada Karyawan Terdaftar
                    </th>
                  ) : (
                    employeeColumns.map((colName) => (
                      <th
                        key={colName}
                        onClick={() => {
                          const matchedUser = users.find((u) =>
                            safeLower(u.name).includes(safeLower(colName))
                          );
                          const fullName = matchedUser?.name || employeeNamesMap[colName] || colName;
                          const avatar = matchedUser?.avatar || employeeAvatarMap[colName] || sampleAvatars[0];
                          setSimpleProfilePopup({
                            name: fullName,
                            avatar: avatar,
                          });
                        }}
                        className="py-3.5 px-4 font-semibold text-slate-700 hover:text-[#1E3A8A] hover:bg-blue-50/60 min-w-[130px] text-center cursor-pointer transition-colors whitespace-nowrap"
                        title="Klik untuk melihat profil"
                      >
                        {colName}
                      </th>
                    ))
                  )}
                </tr>
              </thead>

              {/* TABLE BODY ROWS */}
              <tbody className="divide-y divide-slate-100">
                {displayedRows.length === 0 ? (
                  <tr>
                    <td colSpan={employeeColumns.length === 0 ? 5 : 4 + employeeColumns.length} className="py-16 text-center text-slate-400 font-medium">
                      {allMatrixRows.length === 0
                        ? 'Belum ada catatan riwayat presensi karyawan.'
                        : 'Tidak ada data riwayat presensi yang cocok dengan filter pencarian.'}
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

                        {/* 3b. Keterangan Lokasi Column (Muncul semua status unik pada hari tersebut, masing-masing maksimal 1) */}
                        <td className="py-3 px-4 whitespace-nowrap">
                          {row.locationTags && row.locationTags.length > 0 ? (
                            <div className="flex items-center gap-1.5 flex-wrap">
                              {row.locationTags.map((tag) => {
                                const cfg = LOCATION_TAG_CONFIG[tag];
                                if (!cfg) return null;
                                const TagIcon = cfg.icon;
                                return (
                                  <span
                                    key={tag}
                                    className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] sm:text-[11px] font-bold ${cfg.bg} ${cfg.text} border ${cfg.border} shadow-2xs`}
                                  >
                                    <TagIcon className={`w-3 h-3 ${cfg.iconColor} shrink-0`} />
                                    <span>{cfg.label}</span>
                                  </span>
                                );
                              })}
                            </div>
                          ) : isWeekendHoliday ? (
                            <span className="text-slate-400 font-bold text-xs pl-2">-</span>
                          ) : (
                            <span className="text-slate-300 font-bold text-xs pl-2">—</span>
                          )}
                        </td>

                        {/* 4. Cuti / Sakit / Izin Column (Avatar Karyawan Cuti / Sakit / Izin) */}
                        <td className="py-3 px-4 whitespace-nowrap">
                          {row.cutiAvatars.length > 0 ? (
                            <div
                              onClick={() => handleOpenCutiMembersModal(row)}
                              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-50/80 border border-amber-200/80 text-amber-800 shadow-2xs transition-all shrink-0 cursor-pointer hover:bg-amber-100/80 hover:scale-105 active:scale-95"
                              title="Klik untuk melihat semua foto & nama karyawan (Cuti / Sakit / Izin)"
                            >
                              <div className="flex -space-x-1.5 items-center shrink-0">
                                {row.cutiAvatars.slice(0, 3).map((cav, cIdx) => (
                                  <img
                                    key={cIdx}
                                    src={cav}
                                    alt="cuti avatar"
                                    className="w-5 h-5 min-w-[20px] min-h-[20px] aspect-square rounded-full object-cover ring-2 ring-white shrink-0 shadow-2xs"
                                  />
                                ))}
                              </div>
                              {row.cutiAvatars.length > 3 && (
                                <span className="text-[11px] font-bold text-amber-900 pl-0.5 whitespace-nowrap">
                                  +{row.cutiAvatars.length - 3}
                                </span>
                              )}
                            </div>
                          ) : isWeekendHoliday ? (
                            <span className="text-slate-400 font-bold text-xs pl-2">-</span>
                          ) : (
                            <span className="text-slate-300 font-bold text-xs pl-2">—</span>
                          )}
                        </td>

                        {/* 5. Employee Status Columns (Dinamis dari Akun Karyawan Terdaftar) */}
                        {employeeColumns.length === 0 ? (
                          <td className="py-2.5 px-4 text-center text-slate-300 italic text-xs">
                            —
                          </td>
                        ) : (
                          employeeColumns.map((colName) => {
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
                                      setSelectedCellInfo({
                                        name: fullName,
                                        date: row.dateStr,
                                        status: 'Hadir',
                                      });
                                    }}
                                    className="px-3.5 py-1 rounded-full text-xs font-semibold bg-[#DCFCE7] text-[#15803D] hover:bg-[#BBF7D0] transition-colors cursor-pointer shadow-2xs inline-block active:scale-95"
                                    title={`Klik untuk melihat detail & logbook presensi ${colName} (Hadir)`}
                                  >
                                    Hadir
                                  </button>
                                ) : status === 'Terlambat' ? (
                                  (() => {
                                    const lateNote = (row as any).lateNotesMap?.[colName];
                                    return (
                                      <button
                                        type="button"
                                        onClick={() => {
                                          const fullName = employeeNamesMap[colName] || colName;
                                          setSelectedCellInfo({
                                            name: fullName,
                                            date: row.dateStr,
                                            status: 'Terlambat',
                                          });
                                        }}
                                        className="px-3.5 py-1 rounded-full text-xs font-semibold bg-[#FEF3C7] text-[#B45309] hover:bg-[#FDE68A] transition-all cursor-pointer shadow-2xs inline-flex items-center gap-1 active:scale-95 border border-amber-300/80"
                                        title={
                                          lateNote
                                            ? `Terlambat • Alasan: "${lateNote}" (Klik untuk detail)`
                                            : `Klik untuk melihat detail & logbook presensi ${colName} (Terlambat)`
                                        }
                                      >
                                        <span>Terlambat</span>
                                        {lateNote && (
                                          <span
                                            className="w-1.5 h-1.5 rounded-full bg-amber-600 animate-pulse shrink-0"
                                            title={`Alasan: ${lateNote}`}
                                          />
                                        )}
                                      </button>
                                    );
                                  })()
                                ) : status === 'Cuti/Izin' ? (
                                  // Pill Hijau Muda untuk 'Cuti/Izin'
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const fullName = employeeNamesMap[colName] || colName;
                                      setSelectedCellInfo({
                                        name: fullName,
                                        date: row.dateStr,
                                        status: 'Cuti/Izin',
                                      });
                                    }}
                                    className="px-3.5 py-1 rounded-full text-xs font-semibold bg-[#DCFCE7] text-[#15803D] hover:bg-[#BBF7D0] transition-colors cursor-pointer shadow-2xs inline-block active:scale-95"
                                    title={`Klik untuk melihat detail perizinan ${colName} (Cuti/Izin)`}
                                  >
                                    Cuti/Izin
                                  </button>
                                ) : status === 'WFH' ? (
                                  // Pill Indigo / Split Badge untuk 'WFH'
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const fullName = employeeNamesMap[colName] || colName;
                                      setSelectedCellInfo({
                                        name: fullName,
                                        date: row.dateStr,
                                        status: 'WFH',
                                      });
                                    }}
                                    className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors cursor-pointer shadow-2xs inline-flex items-center gap-1 active:scale-95 ${
                                      row.lateWfhMap?.[colName]
                                        ? 'bg-[#FEF3C7] text-[#B45309] border border-amber-300 hover:bg-[#FDE68A]'
                                        : 'bg-[#E0E7FF] text-[#4338CA] hover:bg-[#C7D2FE]'
                                    }`}
                                    title={row.lateWfhMap?.[colName] ? `Klik untuk melihat detail & logbook ${colName} (WFH Terlambat ${row.lateWfhMap[colName]} mnt)` : `Klik untuk melihat detail & logbook ${colName} (WFH)`}
                                  >
                                    <span>WFH</span>
                                    {row.lateWfhMap?.[colName] ? (
                                      <span className="text-[10px] font-extrabold text-amber-900 bg-amber-200/90 px-1.5 py-0.5 rounded-md">
                                        • Terlambat ({row.lateWfhMap[colName]}m)
                                      </span>
                                    ) : null}
                                  </button>
                                ) : status === 'Sakit' ? (
                                  // Pill Oranye untuk 'Sakit'
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const fullName = employeeNamesMap[colName] || colName;
                                      setSelectedCellInfo({
                                        name: fullName,
                                        date: row.dateStr,
                                        status: 'Sakit',
                                      });
                                    }}
                                    className="px-3.5 py-1 rounded-full text-xs font-semibold bg-[#FFEDD5] text-[#C2410C] hover:bg-[#FED7AA] transition-colors cursor-pointer shadow-2xs inline-block active:scale-95"
                                    title={`Klik untuk melihat detail perizinan ${colName} (Sakit)`}
                                  >
                                    Sakit
                                  </button>
                                ) : status === 'Dinas Luar' ? (
                                  // Pill Ungu untuk 'Dinas Luar'
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const fullName = employeeNamesMap[colName] || colName;
                                      setSelectedCellInfo({
                                        name: fullName,
                                        date: row.dateStr,
                                        status: 'Dinas Luar',
                                      });
                                    }}
                                    className="px-3.5 py-1 rounded-full text-xs font-semibold bg-[#F3E8FF] text-[#7E22CE] hover:bg-[#E9D5FF] transition-colors cursor-pointer shadow-2xs inline-block active:scale-95"
                                    title={`Klik untuk melihat detail & logbook dinas luar ${colName}`}
                                  >
                                    Dinas Luar
                                  </button>
                                ) : (
                                  // Pill Merah Muda untuk 'Tidak Hadir'
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const fullName = employeeNamesMap[colName] || colName;
                                      setSelectedCellInfo({
                                        name: fullName,
                                        date: row.dateStr,
                                        status: 'Tidak Hadir',
                                      });
                                    }}
                                    className="px-3.5 py-1 rounded-full text-xs font-semibold bg-[#FFE4E6] text-[#E11D48] hover:bg-[#FECDD3] transition-colors cursor-pointer shadow-2xs inline-block active:scale-95"
                                    title={`Klik untuk melihat detail presensi ${colName} (Tidak Hadir)`}
                                  >
                                    Tidak Hadir
                                  </button>
                                )}
                              </td>
                            );
                          })
                        )}
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
                <h3
                  onClick={() => setSimpleProfilePopup({ name: currentUser.name, avatar: currentUser.avatar })}
                  className="font-extrabold text-slate-900 hover:text-[#1E3A8A] transition-colors text-sm sm:text-base leading-snug cursor-pointer"
                >
                  {currentUser.name}
                </h3>
                <p className="text-xs text-slate-500 font-medium mt-0.5">
                  {currentUser.department || 'Teknologi Informasi'}
                </p>
              </div>
            </div>

            {/* Category Filter Pills (dengan jumlah total angka riwayat per kategori) */}
            <div className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto max-w-full pb-1 sm:pb-0 scrollbar-none">
              <Tooltip content="Tampilkan semua riwayat presensi pribadi" position="top">
                <button
                  type="button"
                  onClick={() => setPersonalCategoryFilter('ALL')}
                  className={`px-3 py-1.5 rounded-full text-xs whitespace-nowrap transition-all cursor-pointer shrink-0 ${
                    personalCategoryFilter === 'ALL'
                      ? 'bg-[#1E3A8A] text-white font-bold shadow-2xs'
                      : 'bg-blue-50/80 text-[#1E3A8A] hover:bg-blue-100 border border-blue-200/60 font-semibold'
                  }`}
                >
                  Semua ({personalCategoryCounts.all})
                </button>
              </Tooltip>

              <Tooltip content="Filter riwayat permohonan izin dan cuti kerja" position="top">
                <button
                  type="button"
                  onClick={() =>
                    setPersonalCategoryFilter(personalCategoryFilter === 'LEAVE' ? 'ALL' : 'LEAVE')
                  }
                  className={`px-3 py-1.5 rounded-full text-xs whitespace-nowrap transition-all cursor-pointer shrink-0 ${
                    personalCategoryFilter === 'LEAVE'
                      ? 'bg-[#1E3A8A] text-white font-bold shadow-2xs'
                      : 'bg-blue-50/80 text-[#1E3A8A] hover:bg-blue-100 border border-blue-200/60 font-semibold'
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
                  className={`px-3 py-1.5 rounded-full text-xs whitespace-nowrap transition-all cursor-pointer shrink-0 ${
                    personalCategoryFilter === 'WFH'
                      ? 'bg-[#1E3A8A] text-white font-bold shadow-2xs'
                      : 'bg-blue-50/80 text-[#1E3A8A] hover:bg-blue-100 border border-blue-200/60 font-semibold'
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
                  className={`px-3 py-1.5 rounded-full text-xs whitespace-nowrap transition-all cursor-pointer shrink-0 ${
                    personalCategoryFilter === 'SICK'
                      ? 'bg-[#1E3A8A] text-white font-bold shadow-2xs'
                      : 'bg-blue-50/80 text-[#1E3A8A] hover:bg-blue-100 border border-blue-200/60 font-semibold'
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
                  className={`px-3 py-1.5 rounded-full text-xs whitespace-nowrap transition-all cursor-pointer shrink-0 ${
                    personalCategoryFilter === 'BUSINESS_TRIP'
                      ? 'bg-[#1E3A8A] text-white font-bold shadow-2xs'
                      : 'bg-blue-50/80 text-[#1E3A8A] hover:bg-blue-100 border border-blue-200/60 font-semibold'
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
                              isWeekendHoliday && !row.hasCheckmark ? 'text-rose-600 font-bold' : 'text-slate-800'
                            }`}
                          >
                            {row.dateStr}
                          </td>

                          {/* 2. Check-in Column (Pill Container Persis Kehadiran Tim - Tanpa Pop Up untuk Presensi Pribadi) */}
                          <td className="py-3 px-4 whitespace-nowrap">
                            {row.hasCheckmark ? (
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
                            ) : isWeekendHoliday ? (
                              <span className="text-slate-400 font-bold text-xs pl-2">-</span>
                            ) : (
                              <span className="text-slate-300 font-bold text-xs pl-2">—</span>
                            )}
                          </td>

                          {/* 2b. Keterangan Lokasi Column (Sesuai Spesifikasi PDF) */}
                          <td className="py-3 px-4 whitespace-nowrap">
                            {row.hasCheckmark || (row.locationMode && row.locationMode !== '—' && !isWeekendHoliday) ? (
                              (() => {
                                const mode = row.locationMode;
                                const isWfh = mode === 'Dari Rumah' || mode.includes('WFH') || mode.includes('Rumah');
                                const isDinas = mode === 'Dinas Luar' || mode.includes('Dinas');
                                const isLuar = mode === 'Di Luar Kantor' || mode.includes('Luar') || mode.includes('Radius');
                                const isOff = Boolean(row.isOff) || mode === 'Bebas Absen' || mode.includes('Bebas Absen') || mode.includes('OFF') || row.clockIn === 'OFF';
                                const isSick = row.statusText.includes('Sakit') || row.category === 'SICK';

                                if (isOff) {
                                  return (
                                    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] sm:text-[11px] font-bold ${
                                      isSick
                                        ? 'bg-rose-50 text-rose-800 border border-rose-200'
                                        : 'bg-sky-50 text-sky-800 border border-sky-200'
                                    }`}>
                                      <CalendarDays className="w-3 h-3 shrink-0" />
                                      <span>Bebas Absen</span>
                                    </span>
                                  );
                                }

                                if (isWfh) {
                                  return (
                                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] sm:text-[11px] font-bold bg-indigo-50 text-indigo-800 border border-indigo-200 shadow-2xs">
                                      <Laptop className="w-3 h-3 text-indigo-600 shrink-0" />
                                      <span>Dari Rumah</span>
                                    </span>
                                  );
                                }

                                if (isDinas) {
                                  return (
                                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] sm:text-[11px] font-bold bg-purple-50 text-purple-800 border border-purple-200 shadow-2xs">
                                      <MapPin className="w-3 h-3 text-purple-600 shrink-0" />
                                      <span>Dinas Luar</span>
                                    </span>
                                  );
                                }

                                if (isLuar) {
                                  return (
                                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] sm:text-[11px] font-bold bg-rose-50 text-rose-800 border border-rose-200 shadow-2xs">
                                      <AlertTriangle className="w-3 h-3 text-rose-600 shrink-0" />
                                      <span>Di Luar Kantor</span>
                                    </span>
                                  );
                                }

                                return (
                                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] sm:text-[11px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200 shadow-2xs">
                                    <Building2 className="w-3 h-3 text-emerald-600 shrink-0" />
                                    <span>Area Kantor</span>
                                  </span>
                                );
                              })()
                            ) : isWeekendHoliday ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] sm:text-[11px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                                —
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] sm:text-[11px] font-bold bg-slate-100 text-slate-600 border border-slate-200">
                                —
                              </span>
                            )}
                          </td>

                          {/* 3. Status Kehadiran (Pill Status Terpadu, Menit Menyatu dengan Terlambat) */}
                          <td className="py-2.5 px-4 text-center whitespace-nowrap">
                            {isWeekendHoliday && !row.hasCheckmark && !row.category ? (
                              <span className="text-xs font-bold text-[#E11D48] tracking-tight">
                                Libur
                              </span>
                            ) : row.category === 'WFH' || row.statusText.includes('WFH') ? (
                              <span
                                className={`px-3 py-1 rounded-full text-xs font-semibold shadow-2xs inline-flex items-center gap-1 ${
                                  row.statusText.includes('Terlambat')
                                    ? 'bg-[#FEF3C7] text-[#B45309] border border-amber-300'
                                    : 'bg-[#E0E7FF] text-[#4338CA]'
                                }`}
                              >
                                <span>WFH</span>
                                {row.statusText.includes('Terlambat') && (
                                  <span className="text-[10px] font-extrabold text-amber-900 bg-amber-200/90 px-1.5 py-0.5 rounded-md">
                                    • Terlambat {row.statusText.match(/\(.*\)/)?.[0]?.replace(' mnt', 'm') || ''}
                                  </span>
                                )}
                              </span>
                            ) : (
                              <span className={`px-3.5 py-1 rounded-full text-xs font-semibold shadow-2xs inline-flex items-center justify-center ${row.statusBadgeClass}`}>
                                {row.statusText.includes('Terlambat')
                                  ? row.statusText.replace(' mnt', 'm')
                                  : row.statusText}
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

              {/* Logbook / Tugas Harian Karyawan (Dapat dilihat oleh semua akun) */}
              {(() => {
                const matchedUser = users.find(
                  (u) =>
                    safeLower(u.name).includes(safeLower(selectedCellInfo.name)) ||
                    safeLower(selectedCellInfo.name).includes(safeLower(u.name))
                );
                const rawDate =
                  allMatrixRows.find((r) => r.dateStr === selectedCellInfo.date)?.rawDate ||
                  selectedCellInfo.date;

                const userDailyTask = (dailyTasks || []).find(
                  (t) =>
                    (t.userId === matchedUser?.id ||
                      safeLower(t.userName) === safeLower(selectedCellInfo.name)) &&
                    t.date === rawDate
                );

                const existingRec = (attendanceRecords || []).find(
                  (r) =>
                    ((matchedUser?.id && r.userId === matchedUser.id) ||
                      (r.userName && selectedCellInfo.name && safeLower(r.userName).trim() === safeLower(selectedCellInfo.name).trim())) &&
                    (r.date === rawDate || r.date === selectedCellInfo.date)
                );

                const tasks =
                  userDailyTask?.tasks && userDailyTask.tasks.length > 0
                    ? userDailyTask.tasks
                    : existingRec?.tasksDoneSummary && existingRec.tasksDoneSummary.length > 0
                    ? existingRec.tasksDoneSummary
                    : [];

                return (
                  <div className="space-y-2.5 pt-1">
                    {/* Alasan Keterlambatan / Catatan Presensi Masuk (Jika Ada) */}
                    {existingRec?.notes ? (
                      <div className={`p-3.5 rounded-xl border flex flex-col gap-1 text-left ${
                        existingRec.clockInStatus === 'LATE' || selectedCellInfo.status.includes('Terlambat')
                          ? 'bg-amber-50/80 border-amber-200/90 text-amber-950'
                          : 'bg-slate-50 border-slate-200'
                      }`}>
                        <div className="flex items-center justify-between">
                          <span className={`text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5 ${
                            existingRec.clockInStatus === 'LATE' || selectedCellInfo.status.includes('Terlambat')
                              ? 'text-amber-800'
                              : 'text-slate-500'
                          }`}>
                            <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                            <span>
                              {existingRec.clockInStatus === 'LATE' || selectedCellInfo.status.includes('Terlambat')
                                ? 'Alasan Keterlambatan'
                                : 'Catatan Presensi'}
                            </span>
                          </span>
                          {(existingRec.clockInStatus === 'LATE' || selectedCellInfo.status.includes('Terlambat')) && (
                            <span className="text-[10px] bg-amber-100 text-amber-800 font-semibold px-2 py-0.5 rounded-full border border-amber-200/80">
                              Terlambat {existingRec.clockInLateMinutes ? `(${existingRec.clockInLateMinutes}m)` : ''}
                            </span>
                          )}
                        </div>
                        <p className="text-slate-800 italic text-xs mt-0.5 font-medium leading-relaxed">
                          "{existingRec.notes}"
                        </p>
                      </div>
                    ) : (existingRec?.clockInStatus === 'LATE' || selectedCellInfo.status.includes('Terlambat')) ? (
                      <div className="p-3 rounded-xl border border-amber-200/60 bg-amber-50/50 text-left flex items-center justify-between gap-2">
                        <span className="text-xs text-amber-800 italic flex items-center gap-1.5">
                          <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                          <span>Belum ada alasan keterlambatan</span>
                        </span>
                        {isAdmin && (
                          <button
                            type="button"
                            onClick={() => {
                              const cleanName = safeLower(selectedCellInfo.name).trim();
                              const matchedUser = users.find(
                                (u) =>
                                  safeLower(u.name).trim() === cleanName ||
                                  safeLower(u.name).includes(cleanName) ||
                                  cleanName.includes(safeLower(u.name))
                              );
                              const targetId = existingRec?.userId || matchedUser?.id || '';
                              const targetRec = existingRec || ({
                                id: `att_${Date.now()}`,
                                userId: targetId,
                                userName: matchedUser?.name || selectedCellInfo.name,
                                userAvatar: matchedUser?.avatar || '',
                                department: matchedUser?.department || 'Divisi Operasional',
                                employmentType: matchedUser?.employmentType || 'CONTRACT',
                                date: rawDate,
                                clockInTime: '08:00',
                                clockInStatus: 'LATE',
                                clockInLocationStatus: 'IN_OFFICE',
                                clockInLateMinutes: 15,
                                clockInDistanceMeter: 15,
                                workMode: 'WFO',
                                syncStatus: 'SYNCED',
                              } as AttendanceRecord);
                              setEditingRecord(targetRec);
                            }}
                            className="text-[11px] font-bold text-[#1E3A8A] hover:underline cursor-pointer"
                          >
                            + Tambah Alasan
                          </button>
                        )}
                      </div>
                    ) : null}

                    <div className="p-3.5 bg-slate-50/80 rounded-xl border border-slate-200 space-y-2">
                      <div className="flex items-center gap-1.5 font-bold text-slate-800 text-xs">
                        <ClipboardList className="w-4 h-4 text-[#1E3A8A]" />
                        <span>Logbook / Tugas Harian</span>
                      </div>
                      {tasks && tasks.length > 0 ? (
                        <div className="space-y-1.5 pl-1">
                          {tasks.map((task, tIdx) => (
                            <div key={tIdx} className="flex items-start gap-2 text-slate-700 leading-snug">
                              <span className="text-[#1E3A8A] font-bold mt-0.5">•</span>
                              <span className="font-medium">{task}</span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-slate-400 italic text-[11px]">
                          Karyawan belum mengisi logbook tugas untuk tanggal ini.
                        </p>
                      )}

                      {userDailyTask?.notes && userDailyTask.notes.trim() && userDailyTask.notes !== existingRec?.notes && (
                        <div className="pt-2 border-t border-slate-200/60 text-[11px] text-slate-600">
                          <span className="font-semibold text-slate-700">Catatan Logbook: </span>
                          <span>{userDailyTask.notes}</span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })()}

              {(() => {
                if (!isAdmin) return null;

                const isSelf =
                  safeLower(selectedCellInfo.name) === safeLower(currentUser.name) ||
                  Boolean(
                    users.find(
                      (u) =>
                        u.id === currentUser.id &&
                        (safeLower(u.name).includes(safeLower(selectedCellInfo.name)) ||
                          safeLower(selectedCellInfo.name).includes(safeLower(u.name)))
                    )
                  );

                if (isSelf) {
                  return null;
                }

                return (
                  <button
                    type="button"
                    onClick={() => {
                      const cleanName = safeLower(selectedCellInfo.name).trim();
                      const matchedUser = users.find(
                        (u) =>
                          safeLower(u.name).trim() === cleanName ||
                          safeLower(u.name).includes(cleanName) ||
                          cleanName.includes(safeLower(u.name))
                      );
                      const rawDate =
                        allMatrixRows.find((r) => r.dateStr === selectedCellInfo.date)?.rawDate ||
                        getCurrentDateString();
                      const existingRec = attendanceRecords.find(
                        (r) =>
                          (r.userId === matchedUser?.id || safeLower(r.userName).trim() === cleanName) &&
                          r.date === rawDate
                      );

                      const targetUserId = existingRec?.userId || matchedUser?.id || 'usr_unknown';
                      const recordToEdit: AttendanceRecord = existingRec || {
                        id: `att_edit_${Date.now()}`,
                        userId: targetUserId,
                        userName: matchedUser?.name || selectedCellInfo.name,
                        userAvatar:
                          matchedUser?.avatar ||
                          'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=80&q=80',
                        department: matchedUser?.department || 'Divisi Operasional',
                        employmentType: matchedUser?.employmentType || 'CONTRACT',
                        date: rawDate,
                        clockInTime: '08:00',
                        clockInLat: -6.2088,
                        clockInLng: 106.8456,
                        clockInStatus: selectedCellInfo.status.includes('Terlambat') ? 'LATE' : 'ON_TIME',
                        clockInLocationStatus: 'IN_OFFICE',
                        clockInLateMinutes: selectedCellInfo.status.includes('Terlambat') ? 15 : 0,
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
                );
              })()}
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
        currentUserId={currentUser.id}
        currentUserName={currentUser.name}
        onEditMember={(member) => {
          const isSelf =
            member.id === currentUser.id ||
            safeLower(member.name) === safeLower(currentUser.name);
          if (isSelf) return;

          const cleanName = safeLower(member.name).trim();
          const matchedUser = users.find(
            (u) =>
              (member.id && u.id === member.id) ||
              safeLower(u.name).trim() === cleanName ||
              safeLower(u.name).includes(cleanName) ||
              cleanName.includes(safeLower(u.name))
          );

          const rawDate = teamMembersModalData.date || getCurrentDateString();
          const existingRec = attendanceRecords.find(
            (r) =>
              (r.userId === member.id || r.userId === matchedUser?.id || safeLower(r.userName).trim() === cleanName) &&
              r.date === rawDate
          );

          const targetUserId = existingRec?.userId || member.id || matchedUser?.id || 'usr_unknown';
          const recordToEdit: AttendanceRecord = existingRec || {
            id: `att_edit_${Date.now()}`,
            userId: targetUserId,
            userName: matchedUser?.name || member.name,
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
          currentUserId={currentUser.id}
          currentUserName={currentUser.name}
          onClose={() => {
            setEditingRecord(null);
            if (returnToTeamModalOnClose) {
              setTeamMembersModalData((prev) => ({ ...prev, isOpen: true }));
              setReturnToTeamModalOnClose(false);
            }
          }}
          onSave={(updated, leaveCategory) => {
            AppStorage.saveAttendanceRecord(updated);
            if (onUpdateRecord) {
              onUpdateRecord(updated);
            }
            setDataVersion((v) => v + 1);
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
                          leaveCategory === 'SICK'
                            ? 'Sakit'
                            : leaveCategory === 'BUSINESS_TRIP'
                            ? updated.clockInStatus === 'LATE'
                              ? `Dinas Luar • Terlambat (${updated.clockInLateMinutes || 0}m)`
                              : 'Dinas Luar'
                            : leaveCategory === 'LEAVE'
                            ? 'Cuti / Izin'
                            : leaveCategory === 'WFH'
                            ? updated.clockInStatus === 'LATE'
                              ? `WFH • Terlambat (${updated.clockInLateMinutes || 0}m)`
                              : 'WFH'
                            : updated.clockInStatus === 'LATE'
                            ? `Terlambat (${updated.clockInLateMinutes || 0}m)`
                            : 'Hadir',
                        statusColor:
                          leaveCategory === 'SICK'
                            ? 'rose'
                            : leaveCategory === 'BUSINESS_TRIP'
                            ? updated.clockInStatus === 'LATE'
                              ? 'amber'
                              : 'purple'
                            : leaveCategory === 'LEAVE'
                            ? 'emerald'
                            : (leaveCategory === 'WFH' && updated.clockInStatus === 'LATE')
                            ? 'amber'
                            : leaveCategory === 'WFH'
                            ? 'indigo'
                            : updated.clockInStatus === 'LATE'
                            ? 'amber'
                            : 'emerald',
                        locationBadge:
                          leaveCategory === 'SICK' || leaveCategory === 'LEAVE'
                            ? undefined
                            : leaveCategory === 'WFH' || updated.clockInLocationStatus === 'WFH_APPROVED'
                            ? 'Dari Rumah'
                            : leaveCategory === 'BUSINESS_TRIP' || updated.clockInLocationStatus === 'DINAS_APPROVED'
                            ? 'Dinas Luar'
                            : updated.clockInLocationStatus === 'IN_OFFICE'
                            ? 'Area Kantor'
                            : 'Di Luar Kantor',
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
