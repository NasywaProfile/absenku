import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Clock,
  Check,
  Smile,
  Bold,
  Italic,
  Underline as UnderlineIcon,
  Strikethrough,
  Trash2,
  CalendarCheck,
  Calendar,
  CalendarDays,
  ListTodo,
  ClipboardList,
  CheckCircle2,
  X,
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  ArrowUpRight,
  Send,
  RotateCcw,
  AlertCircle,
  AlertTriangle,
  MessageSquare,
  ArrowLeftRight,
  MapPin,
  PenLine,
} from 'lucide-react';
import { User, OfficeConfig, AttendanceRecord, LeaveRequest, TaskItem, TaskStatus, TaskPriority, getPriorityLabel, ChatTopic } from '../../types/index.ts';
import { AppStorage } from '../../lib/storage.ts';
import { ApiClient } from '../../lib/api-client.ts';
import { isChatTopicVisibleToUser } from '../../lib/chat-visibility.ts';
import { getDailyStatus, getCalendarCell, isOffCategory } from '../../lib/attendance-status.ts';
import { getCurrentDateString, formatIndonesianDate, calculateClockInPunctuality } from '../../lib/time-utils.ts';
import { TaskDetailModal } from '../tasks/TaskDetailModal.tsx';
import { EmptyStateTaskIllustration } from '../common/Illustrations.tsx';
import { Tooltip } from '../ui/tooltip.tsx';
import { ModernConfirmDialog } from '../common/ModernConfirmDialog.tsx';
import { ChatTopicModal } from '../chat/ChatTopicModal.tsx';
import { DropdownMenu } from '../ui/dropdown-menu.tsx';

interface NeoBrutalistDashboardProps {
  currentUser: User;
  users: User[];
  officeConfig: OfficeConfig;
  todayRecord?: AttendanceRecord | null;
  records: AttendanceRecord[];
  leaves: LeaveRequest[];
  tasks?: any;
  onOpenClockModal: () => void;
  onNavigateTab: (tabId: string) => void;
  onSwitchUser?: (userId: string) => void;
  onResetTodayAttendance?: () => void;
  onRefreshData?: () => void;
}

export function NeoBrutalistDashboard({
  currentUser,
  users = [currentUser],
  officeConfig,
  todayRecord,
  records: propRecords,
  leaves: propLeaves,
  tasks: propTasks,
  onOpenClockModal,
  onNavigateTab,
  onSwitchUser,
  onResetTodayAttendance,
  onRefreshData,
}: NeoBrutalistDashboardProps) {
  // Mode tampilan Tugas Saya: 'CARDS' | 'TABLE'
  const [taskViewMode, setTaskViewMode] = useState<'CARDS' | 'TABLE'>('CARDS');
  const [selectedTaskForDetail, setSelectedTaskForDetail] = useState<TaskItem | null>(null);
  const [selectedChatTopic, setSelectedChatTopic] = useState<ChatTopic | null>(null);

  const [chatTopicsList, setChatTopicsList] = useState<ChatTopic[]>(() => AppStorage.getChatTopics());
  const [isEditingLateReason, setIsEditingLateReason] = useState(false);
  const [isSavingLateReason, setIsSavingLateReason] = useState(false);
  const [editReasonText, setEditReasonText] = useState('');

  useEffect(() => {
    const syncChat = () => {
      setChatTopicsList(AppStorage.getChatTopics());
    };
    window.addEventListener('absenku:chat_updated', syncChat);
    window.addEventListener('storage', syncChat);
    const interval = setInterval(syncChat, 2000);
    return () => {
      window.removeEventListener('absenku:chat_updated', syncChat);
      window.removeEventListener('storage', syncChat);
      clearInterval(interval);
    };
  }, []);

  // Sekilas Ruang Obrolan (Hanya topik di mana akun terdaftar di Assignees / pembuat)
  const chatTopics = useMemo(() => {
    if (!Array.isArray(chatTopicsList)) return [];
    const localHiddenIds = AppStorage.getHiddenChatTopicIds(currentUser?.id);
    return chatTopicsList.filter((t) =>
      isChatTopicVisibleToUser(t, currentUser, users, localHiddenIds)
    );
  }, [chatTopicsList, currentUser, users]);

  // Calendar & Logbook state
  const todayDateStr = getCurrentDateString();
  const [calendarDate, setCalendarDate] = useState(() => new Date());
  const [selectedDate, setSelectedDate] = useState<string>(todayDateStr);
  const [logbookText, setLogbookText] = useState('');
  const [isExistingLog, setIsExistingLog] = useState(false);
  const [savedSuccessMessage, setSavedSuccessMessage] = useState<string | null>(null);
  const [dataVersion, setDataVersion] = useState(0);

  const todayApprovedLeave = useMemo(() => {
    const leavesList = propLeaves || AppStorage.getLeaves();
    return leavesList.find(
      (l) =>
        (l.userId === currentUser.id || l.userName?.toLowerCase() === currentUser.name.toLowerCase()) &&
        l.status === 'APPROVED' &&
        todayDateStr >= l.startDate &&
        todayDateStr <= l.endDate
    );
  }, [currentUser, todayDateStr, dataVersion, propLeaves]);

  const isOffToday = Boolean(
    todayApprovedLeave && isOffCategory(todayApprovedLeave.category)
  );

  const isApprovedWfhToday = todayApprovedLeave?.category === 'WFH' || (todayApprovedLeave as any)?.type === 'WFH';

  const selectedDateApprovedLeave = useMemo(() => {
    const leavesList = propLeaves || AppStorage.getLeaves();
    return leavesList.find(
      (l) =>
        (l.userId === currentUser.id || l.userName?.toLowerCase() === currentUser.name.toLowerCase()) &&
        l.status === 'APPROVED' &&
        selectedDate >= l.startDate &&
        selectedDate <= l.endDate
    );
  }, [currentUser, selectedDate, dataVersion, propLeaves]);

  const isOffSelectedDate = Boolean(
    selectedDateApprovedLeave && isOffCategory(selectedDateApprovedLeave.category)
  );

  const isApprovedBusinessTripToday = useMemo(() => {
    const leavesList = propLeaves || AppStorage.getLeaves();
    return leavesList.some(
      (l) =>
        (l.userId === currentUser.id || l.userName?.toLowerCase() === currentUser.name.toLowerCase()) &&
        l.status === 'APPROVED' &&
        (l.category === 'BUSINESS_TRIP' || (l as any).type === 'BUSINESS_TRIP' || (l as any).category === 'DINAS' || (l as any).type === 'DINAS') &&
        todayDateStr >= l.startDate &&
        todayDateStr <= l.endDate
    );
  }, [currentUser, todayDateStr, dataVersion, propLeaves]);

  const allLeaves = useMemo(() => propLeaves || AppStorage.getLeaves(), [dataVersion, propLeaves]);

  // Modern dialog confirmation state (no browser alert/confirm popup)
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    variant?: 'warning' | 'danger' | 'info' | 'success';
    confirmText?: string;
    cancelText?: string;
    hideCancel?: boolean;
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {},
  });

  const calYear = calendarDate.getFullYear();
  const calMonth = calendarDate.getMonth();
  const isCurrentMonthAndYear =
    new Date().getMonth() === calMonth && new Date().getFullYear() === calYear;
  const todayDateNum = new Date().getDate();

  const currentMonthName = new Intl.DateTimeFormat('id-ID', {
    month: 'long',
    year: 'numeric',
  }).format(calendarDate);

  const totalDaysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
  const firstDayOfWeek = new Date(calYear, calMonth, 1).getDay();

  // Load all attendance and daily tasks for calendar markers
  const allAttendance = useMemo(() => {
    const list = propRecords || AppStorage.getAttendanceRecords();
    return list.filter((r) => r.userId === currentUser.id);
  }, [currentUser.id, dataVersion, todayRecord, propRecords]);

  const allDailyTasks = useMemo(() => {
    return AppStorage.getDailyTasks().filter((t) => t.userId === currentUser.id);
  }, [currentUser.id, dataVersion]);

  const loadedDateRef = useRef<string | null>(null);

  // Load existing logbook on selectedDate change
  useEffect(() => {
    if (loadedDateRef.current === selectedDate) {
      return;
    }
    loadedDateRef.current = selectedDate;

    const existingLog = AppStorage.getDailyTaskForDate(currentUser.id, selectedDate);
    if (existingLog && ((existingLog.tasks && existingLog.tasks.length > 0) || existingLog.notes)) {
      const text =
        existingLog.tasks && existingLog.tasks.length > 0
          ? existingLog.tasks.join('\n')
          : existingLog.notes || '';
      setLogbookText(text);
      setIsExistingLog(true);
    } else {
      const attRecord = allAttendance.find((a) => a.date === selectedDate);
      if (attRecord && attRecord.tasksDoneSummary && attRecord.tasksDoneSummary.length > 0) {
        setLogbookText(attRecord.tasksDoneSummary.join('\n'));
        setIsExistingLog(true);
      } else {
        setLogbookText('');
        setIsExistingLog(false);
      }
    }
    setSavedSuccessMessage(null);
  }, [selectedDate, currentUser.id]);

  const handleSaveLogbook = () => {
    if (isOffSelectedDate) {
      setConfirmModal({
        isOpen: true,
        title: 'Status OFF (Bebas Presensi)',
        message: `Status tanggal ini adalah OFF (${selectedDateApprovedLeave?.category === 'SICK' ? 'Sakit' : 'Cuti / Izin'}) yang telah disetujui. Pengisian logbook tidak aktif.`,
        variant: 'info',
        confirmText: 'Mengerti',
        hideCancel: true,
        onConfirm: () => setConfirmModal((prev) => ({ ...prev, isOpen: false })),
      });
      return;
    }

    if (!logbookText.trim()) {
      setConfirmModal({
        isOpen: true,
        title: 'Catatan Masih Kosong',
        message: 'Silakan ketik pekerjaan atau catatan logbook terlebih dahulu sebelum menyimpan.',
        variant: 'warning',
        confirmText: 'Mengerti',
        hideCancel: true,
        onConfirm: () => setConfirmModal((prev) => ({ ...prev, isOpen: false })),
      });
      return;
    }

    const tasks = logbookText
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean);

    AppStorage.upsertDailyTaskForDate(
      currentUser,
      selectedDate,
      tasks.length > 0 ? tasks : [logbookText.trim()],
      ''
    );

    setIsExistingLog(true);
    setDataVersion((v) => v + 1);
    setSavedSuccessMessage('Logbook tersimpan di tanggal ini!');
    setTimeout(() => {
      setSavedSuccessMessage(null);
    }, 3000);
  };

  const handleDeleteLogbook = () => {
    setConfirmModal({
      isOpen: true,
      title: 'Hapus Catatan Logbook',
      message: 'Apakah Anda yakin ingin menghapus catatan logbook untuk tanggal ini?',
      variant: 'danger',
      confirmText: 'Ya, Hapus',
      cancelText: 'Batal',
      hideCancel: false,
      onConfirm: () => {
        AppStorage.deleteDailyTaskForDate(currentUser.id, selectedDate);
        setLogbookText('');
        setIsExistingLog(false);
        setDataVersion((v) => v + 1);
        setSavedSuccessMessage('Catatan logbook berhasil dihapus.');
        setTimeout(() => {
          setSavedSuccessMessage(null);
        }, 3000);
        setConfirmModal((prev) => ({ ...prev, isOpen: false }));
      },
    });
  };

  const handlePrevMonth = () => {
    setCalendarDate(new Date(calYear, calMonth - 1, 1));
  };

  const handleNextMonth = () => {
    setCalendarDate(new Date(calYear, calMonth + 1, 1));
  };

  // Task Items State untuk update toggle Today's
  const [tasksState, setTasksState] = useState<TaskItem[]>(() =>
    Array.isArray(propTasks) && propTasks.length > 0 ? propTasks : AppStorage.getTasks()
  );

  const handleToggleTodays = (taskId: string) => {
    AppStorage.toggleTaskTodays(taskId);
    setTasksState((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, isTodays: !t.isTodays } : t))
    );
  };

  const handleUpdateTaskStatus = (
    taskId: string,
    targetStatus: TaskStatus,
    notes?: { submissionNotes?: string; reviewNotes?: string; newAttachments?: any[] }
  ) => {
    AppStorage.updateTaskStatus(taskId, targetStatus, {
      ...notes,
      activityUser: {
        id: currentUser.id,
        name: currentUser.name,
        role: currentUser.role,
        avatar: currentUser.avatar,
      },
    });
    setTasksState(AppStorage.getTasks());
  };

  const firstName = currentUser.name.split(' ')[0];

  const getPriorityBadge = (priority: TaskPriority) => {
    switch (priority) {
      case 'URGENT':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-50 text-rose-800 border border-rose-200">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-600 animate-pulse" />
            Mendesak
          </span>
        );
      case 'HIGH':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-orange-50 text-orange-800 border border-orange-200">
            <span className="w-1.5 h-1.5 rounded-full bg-orange-500" />
            Tinggi
          </span>
        );
      case 'MEDIUM':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-50 text-blue-800 border border-blue-200">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
            Sedang
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-100 text-slate-700 border border-slate-200">
            <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
            Rendah
          </span>
        );
    }
  };

  // Helper: periksa apakah tugas benar-benar ditugaskan ke pengguna yang sedang login
  const isTaskAssignedToMe = (t: TaskItem): boolean => {
    if (t.assignedTo === currentUser.id) return true;
    if (t.assignees && t.assignees.some((a) => a.id === currentUser.id)) return true;
    return false;
  };

  // Tasks Data Filtering (Hanya tugas yang ditugaskan ke pengguna ini):
  const myActiveTasksList = tasksState.filter(
    (t) => isTaskAssignedToMe(t) && t.status !== 'REVIEWED'
  );

  return (
    <div className="w-full space-y-6 pb-8">
      {/* 1. TOP HEADER BAR */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-light text-slate-400 tracking-tight">
            {(() => {
              const hour = new Date().getHours();
              let greeting = 'Selamat pagi';
              if (hour >= 11 && hour < 15) greeting = 'Selamat siang';
              else if (hour >= 15 && hour < 19) greeting = 'Selamat sore';
              else if (hour >= 19 || hour < 5) greeting = 'Selamat malam';
              return greeting;
            })()}, <span className="font-bold text-slate-900">{firstName}</span>
          </h1>
        </div>

      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-stretch">
        
        {/* CARD KALENDER PRESENSI DENGAN LOGBOOK INTEGRASI */}
        <div className="bg-white rounded-[28px] border border-slate-200/90 p-6 shadow-xs flex flex-col justify-between h-full">
          <div>
            {/* Header Kalender */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 sm:gap-2 pb-3.5 mb-4 border-b border-slate-100 min-h-[44px]">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-8 h-8 rounded-xl bg-blue-50 border border-blue-100 text-[#1E3A8A] flex items-center justify-center shrink-0">
                  <Calendar className="w-4 h-4" />
                </div>
                <h2 className="text-base font-bold text-slate-900 tracking-tight whitespace-nowrap">
                  Kalender Presensi
                </h2>
              </div>
              <div className="flex items-center justify-between sm:justify-end gap-1 w-full sm:w-auto bg-slate-50/90 sm:bg-transparent border border-slate-200/70 sm:border-0 rounded-xl sm:rounded-none px-2 py-1 sm:p-0 shrink-0">
                <button
                  type="button"
                  onClick={handlePrevMonth}
                  className="p-1.5 sm:p-1 hover:bg-white sm:hover:bg-slate-100 text-slate-500 sm:text-slate-400 hover:text-slate-700 rounded-lg transition-colors cursor-pointer"
                  title="Bulan Sebelumnya"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="text-xs font-bold text-slate-700 px-2 sm:px-1 capitalize whitespace-nowrap">
                  {currentMonthName}
                </span>
                <button
                  type="button"
                  onClick={handleNextMonth}
                  className="p-1.5 sm:p-1 hover:bg-white sm:hover:bg-slate-100 text-slate-500 sm:text-slate-400 hover:text-slate-700 rounded-lg transition-colors cursor-pointer"
                  title="Bulan Berikutnya"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Minimalist Grid Calendar */}
            <div className="p-3 bg-slate-50/80 rounded-2xl border border-slate-100">
              <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-bold uppercase tracking-wider mb-2">
                {['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'].map((d, i) => (
                  <div key={i} className={i === 0 || i === 6 ? 'text-red-500 font-extrabold' : 'text-slate-400'}>
                    {d}
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-1 text-center text-xs">
                {[
                  ...Array(firstDayOfWeek).fill(null),
                  ...Array.from({ length: totalDaysInMonth }, (_, i) => i + 1),
                ].map((day, i) => {
                  if (!day) {
                    return (
                      <div key={i} className="py-1.5 text-transparent pointer-events-none" />
                    );
                  }

                  const dateStr = `${calYear}-${String(calMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                  const isSelected = selectedDate === dateStr;
                  const isToday = day === todayDateNum && isCurrentMonthAndYear;
                  const dayOfWeek = i % 7; // 0 = Min (Minggu), 6 = Sab (Sabtu)
                  const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

                  const att = allAttendance.find((a: AttendanceRecord) => a.date === dateStr);
                  const log = allDailyTasks.find((t: any) => t.date === dateStr);
                  const dayStatus = getDailyStatus({
                    user: { id: currentUser.id, name: currentUser.name },
                    date: dateStr,
                    records: allAttendance,
                    leaves: allLeaves,
                    today: todayDateStr,
                  });
                  const dayCell = getCalendarCell(dayStatus);
                  const hasAtt = !!att;
                  const hasLog = (log?.tasks && log.tasks.length > 0) || (att?.tasksDoneSummary && att.tasksDoneSummary.length > 0);
                  const isPendingLog = hasAtt && !hasLog;

                  // Tentukan warna background dan status tanggal secara dinamis sesuai kehadiran & perizinan
                  const statusLabel = dayCell.label;
                  const bgClass = dayCell.bg;
                  const borderClass = dayCell.isPlanned ? ` border-dashed` : dayCell.border;
                  const textClass = dayCell.text;

                  return (
                    <button
                      key={i}
                      type="button"
                      onClick={() => setSelectedDate(dateStr)}
                      title={`${dateStr} • ${statusLabel}`}
                      className={`py-1.5 rounded-xl font-bold transition-all relative flex flex-col items-center justify-center cursor-pointer border ${bgClass} ${borderClass} ${textClass} ${
                        isSelected
                          ? isWeekend
                            ? 'ring-2 ring-red-500 ring-offset-2 shadow-sm scale-105 z-10'
                            : 'ring-2 ring-[#1E3A8A] ring-offset-2 shadow-sm scale-105 z-10'
                          : 'hover:brightness-95 hover:scale-[1.02]'
                      }`}
                    >
                      <span>{day}</span>

                      {/* Penanda Kehadiran & Logbook */}
                      <div className="flex items-center gap-0.5 justify-center mt-0.5 min-h-[4px]">
                        {hasLog ? (
                          <span
                            title="Logbook Terisi"
                            className="w-1.5 h-1.5 rounded-full bg-[#1E3A8A]"
                          />
                        ) : isPendingLog ? (
                          <span
                            title="Belum Isi Logbook"
                            className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"
                          />
                        ) : null}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Status Penanda Logbook */}
            <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-[10px] text-slate-500 pt-2.5">
              <span className="flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-[#1E3A8A]" />
                <span>Titik Biru: Logbook Terisi</span>
              </span>
              <span className="flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                <span>Titik Kuning: Belum Isi Logbook</span>
              </span>
            </div>

            {/* Indicator / Status Bawah Presensi */}
            <div className="pt-3">
              {isOffToday ? (
                <Tooltip
                  content={`Anda berstatus OFF (${todayApprovedLeave?.category === 'SICK' ? 'Sakit' : 'Cuti / Izin'}) hari ini — Bebas Presensi`}
                  position="top"
                  className="w-full"
                >
                  <button
                    type="button"
                    disabled
                    className="w-full py-3 px-4 bg-slate-100 border border-slate-200 text-slate-400 text-xs font-bold rounded-2xl shadow-2xs flex items-center justify-center gap-2 cursor-not-allowed select-none opacity-80"
                  >
                    {todayApprovedLeave?.category === 'SICK' ? (
                      <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
                    ) : (
                      <CalendarDays className="w-4 h-4 text-sky-500 shrink-0" />
                    )}
                    <span>Presensi Masuk Tidak Aktif (OFF: {todayApprovedLeave?.category === 'SICK' ? 'Sakit' : 'Cuti / Izin'})</span>
                  </button>
                </Tooltip>
              ) : todayRecord?.clockInTime ? (
                (() => {
                  const isWfh = isApprovedWfhToday || todayRecord.workMode === 'WFH' || todayRecord.clockInLocationStatus === 'WFH_APPROVED';
                  const isDinas = isApprovedBusinessTripToday || todayRecord.workMode === 'DINAS' || todayRecord.clockInLocationStatus === 'DINAS_APPROVED';

                  const punctuality = calculateClockInPunctuality(
                    todayRecord.clockInTime,
                    officeConfig?.workStartHour || '08:00',
                    officeConfig?.gracePeriodMinutes || 0
                  );
                  const isLate = todayRecord.clockInStatus === 'LATE' || punctuality.status === 'LATE' || (todayRecord.clockInLateMinutes !== undefined && todayRecord.clockInLateMinutes > 0);
                  const lateMin = (todayRecord.clockInLateMinutes !== undefined && todayRecord.clockInLateMinutes > 0)
                    ? todayRecord.clockInLateMinutes
                    : punctuality.lateMinutes;

                  let formattedLate = `${lateMin}m`;
                  if (lateMin >= 60) {
                    const hours = Math.floor(lateMin / 60);
                    const mins = lateMin % 60;
                    formattedLate = mins > 0 ? `${hours}j ${mins}m` : `${hours}j`;
                  }

                  const rawTime = (todayRecord.clockInTime || '').replace(/\s*WIB/i, '').trim();
                  const timeParts = rawTime.split(':');
                  const timeShort = timeParts.length >= 2 ? `${timeParts[0]}:${timeParts[1]}` : rawTime;

                  const locationText = isWfh
                    ? 'Rumah / WFH'
                    : isDinas
                    ? 'Dinas Luar'
                    : todayRecord.clockInLocationStatus === 'OUT_OF_RANGE'
                    ? `Di Luar Kantor (${todayRecord.clockInDistanceMeter ? `${Math.round(todayRecord.clockInDistanceMeter)}m` : 'Luar Radius'})`
                    : 'Di Kantor';

                  let badgeIcon = <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />;
                  let badgeBg = 'bg-emerald-100/90 text-emerald-800 border-emerald-300';
                  let badgeText = 'Tepat Waktu';

                  if (isLate) {
                    badgeIcon = <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />;
                    badgeBg = 'bg-amber-100/90 text-amber-800 border-amber-300';
                    if (isWfh) {
                      badgeText = lateMin > 0 ? `WFH • Terlambat ${formattedLate}` : 'WFH • Terlambat';
                    } else if (isDinas) {
                      badgeText = lateMin > 0 ? `Dinas • Terlambat ${formattedLate}` : 'Dinas • Terlambat';
                    } else {
                      badgeText = lateMin > 0 ? `Terlambat ${formattedLate}` : 'Terlambat';
                    }
                  } else if (isWfh) {
                    badgeIcon = <CheckCircle2 className="w-3.5 h-3.5 text-indigo-600 shrink-0" />;
                    badgeBg = 'bg-indigo-100/90 text-indigo-800 border-indigo-300';
                    badgeText = 'WFH Tepat Waktu';
                  } else if (isDinas) {
                    badgeIcon = <CheckCircle2 className="w-3.5 h-3.5 text-purple-600 shrink-0" />;
                    badgeBg = 'bg-purple-100/90 text-purple-800 border-purple-300';
                    badgeText = 'Dinas Tepat Waktu';
                  }

                  const cardBgClass = isLate
                    ? 'bg-amber-50/70 border-amber-200'
                    : isWfh
                    ? 'bg-indigo-50/70 border-indigo-200'
                    : isDinas
                    ? 'bg-purple-50/70 border-purple-200'
                    : 'bg-emerald-50/70 border-emerald-200';

                  return (
                    <div className={`w-full py-2.5 px-3.5 sm:px-4 border rounded-2xl shadow-2xs transition-all ${cardBgClass}`}>
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-3">
                        {/* Sebelahan: Presensi Masuk & Lokasi */}
                        <div className="min-w-0 text-left">
                          <div className="flex items-center flex-wrap gap-1.5 sm:gap-2">
                            <h4 className="font-bold text-xs sm:text-sm text-slate-900 tracking-tight">
                              Presensi Masuk ({timeShort} WIB)
                            </h4>
                            <span className="text-slate-300 text-xs">•</span>
                            <div className="flex items-center gap-1 text-[11px] sm:text-xs text-slate-600 font-medium">
                              <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                              <span className="truncate">{locationText}</span>
                            </div>
                          </div>
                        </div>

                        {/* Kolom Kanan / Bawah pada mobile: Badge Status Keterlambatan / Tepat Waktu (Lebar penuh di mobile tanpa space kosong) */}
                        <div className="w-full sm:w-auto self-stretch sm:self-center shrink-0">
                          <div className={`flex sm:inline-flex items-center justify-center gap-1.5 px-3 py-1.5 sm:py-1 rounded-full text-[11px] sm:text-xs font-bold border shadow-2xs w-full sm:w-auto text-center ${badgeBg}`}>
                            {badgeIcon}
                            <span>{badgeText}</span>
                          </div>
                        </div>
                      </div>

                      {/* Tampilkan Alasan / Catatan Presensi jika ada, atau tombol tulis alasan jika terlambat */}
                      {isEditingLateReason ? (
                        <div className="mt-2.5 pt-2 border-t border-amber-200/60 space-y-2 text-left animate-in fade-in duration-200">
                          <div className="flex items-center justify-between">
                            <span className="text-[11px] font-semibold text-amber-950 flex items-center gap-1">
                              <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                              <span>Tulis Alasan Keterlambatan</span>
                            </span>
                            <span className="text-[10px] text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded font-medium border border-amber-200/80">
                              Opsional
                            </span>
                          </div>
                          <textarea
                            value={editReasonText}
                            onChange={(e) => setEditReasonText(e.target.value)}
                            placeholder="Contoh: Terjebak macet di jalan, ban bocor, kendala teknis, dll..."
                            rows={2}
                            maxLength={300}
                            className="w-full text-xs p-2.5 bg-white border border-amber-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-400 text-slate-800 resize-none leading-relaxed"
                          />
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => setIsEditingLateReason(false)}
                              className="px-2.5 py-1 text-[11px] font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                            >
                              Batal
                            </button>
                            <button
                              type="button"
                              disabled={isSavingLateReason}
                              onClick={async () => {
                                setIsSavingLateReason(true);
                                const trimmed = editReasonText.trim();
                                const updated: AttendanceRecord = {
                                  ...todayRecord,
                                  notes: trimmed || undefined,
                                };
                                AppStorage.saveAttendanceRecord(updated);
                                try {
                                  await ApiClient.clockIn({
                                    id: updated.id,
                                    user_id: updated.userId,
                                    pengguna_id: updated.userId,
                                    date: updated.date,
                                    clock_in_time: updated.clockInTime,
                                    clock_in_lat: updated.clockInLat,
                                    clock_in_lng: updated.clockInLng,
                                    clock_in_distance_meter: updated.clockInDistanceMeter,
                                    clock_in_location_status: updated.clockInLocationStatus,
                                    clock_in_status: updated.clockInStatus,
                                    clock_in_late_minutes: updated.clockInLateMinutes,
                                    work_mode: updated.workMode,
                                    notes: trimmed,
                                  });
                                } catch (e) {
                                  // Fallback offline
                                } finally {
                                  setIsSavingLateReason(false);
                                  setIsEditingLateReason(false);
                                  if (onRefreshData) onRefreshData();
                                }
                              }}
                              className="px-3 py-1 bg-[#1E3A8A] hover:bg-[#172554] text-white text-[11px] font-bold rounded-lg shadow-2xs transition-colors cursor-pointer disabled:opacity-60"
                            >
                              {isSavingLateReason ? 'Menyimpan...' : 'Simpan Alasan'}
                            </button>
                          </div>
                        </div>
                      ) : todayRecord.notes ? (
                        <div className="mt-2.5 pt-2 border-t border-slate-200/60 text-[11px] text-slate-600 flex items-start justify-between gap-2 text-left">
                          <div className="flex items-start gap-1.5 flex-1 min-w-0">
                            <span className="font-semibold text-slate-700 shrink-0">
                              {isLate ? 'Alasan Terlambat:' : 'Catatan Presensi:'}
                            </span>
                            <span className="text-slate-800 break-words font-medium">{todayRecord.notes}</span>
                          </div>
                          {isLate && (
                            <button
                              type="button"
                              onClick={() => {
                                setEditReasonText(todayRecord.notes || '');
                                setIsEditingLateReason(true);
                              }}
                              className="text-[#1E3A8A] hover:text-[#172554] shrink-0 text-[10px] font-bold hover:underline inline-flex items-center gap-0.5 cursor-pointer ml-1"
                              title="Ubah alasan keterlambatan"
                            >
                              <PenLine className="w-3 h-3" />
                              <span>Ubah</span>
                            </button>
                          )}
                        </div>
                      ) : isLate ? (
                        <div className="mt-2.5 pt-2 border-t border-amber-200/60 flex items-center justify-between text-[11px] text-left">
                          <span className="text-amber-800/90 italic text-[11px]">Belum ada alasan keterlambatan</span>
                          <button
                            type="button"
                            onClick={() => {
                              setEditReasonText('');
                              setIsEditingLateReason(true);
                            }}
                            className="text-[#1E3A8A] hover:text-[#172554] font-bold inline-flex items-center gap-1 hover:underline cursor-pointer"
                          >
                            <PenLine className="w-3 h-3" />
                            <span>+ Tulis Alasan</span>
                          </button>
                        </div>
                      ) : null}

                    </div>
                  );
                })()
              ) : (
                <Tooltip content="Buka modal presensi untuk presensi masuk kantor hari ini" position="top" className="w-full">
                  <button
                    type="button"
                    onClick={() => onOpenClockModal()}
                    className="w-full py-3 px-4 bg-[#1E3A8A] hover:bg-[#172554] active:scale-[0.98] text-white text-xs font-bold rounded-2xl shadow-sm border border-[#1E3A8A] transition-all flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <Clock className="w-4 h-4 text-white" />
                    <span>Presensi Masuk Sekarang</span>
                  </button>
                </Tooltip>
              )}
            </div>
          </div>

          {/* Form Quick Logbook per Tanggal Terpilih */}
          <div className="pt-4 mt-4 border-t border-slate-100">
            <div className="flex items-center justify-between mb-2">
              <label htmlFor="logbook-textarea" className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <ClipboardList className="w-3.5 h-3.5 text-[#1E3A8A]" />
                <span>Input Logbook ({formatIndonesianDate(selectedDate)})</span>
              </label>
            </div>

            <textarea
              id="logbook-textarea"
              value={logbookText}
              onChange={(e) => setLogbookText(e.target.value)}
              disabled={isOffSelectedDate}
              placeholder={
                isOffSelectedDate
                  ? `Status tanggal ini OFF (${selectedDateApprovedLeave?.category === 'SICK' ? 'Sakit' : 'Cuti / Izin'}) — Tidak perlu mengisi logbook.`
                  : "Tulis ringkasan aktivitas / tugas pekerjaan Anda untuk tanggal terpilih..."
              }
              className={`w-full h-24 p-3 text-xs bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-[#1E3A8A] focus:border-transparent resize-none transition-all outline-none ${
                isOffSelectedDate ? 'opacity-60 cursor-not-allowed bg-slate-100 text-slate-500' : ''
              }`}
            />

            <div className="space-y-2 mt-3">
              {savedSuccessMessage && (
                <div className="text-xs font-bold text-emerald-600 animate-fadeIn">
                  {savedSuccessMessage}
                </div>
              )}

              {isOffSelectedDate ? (
                <Tooltip
                  content={`Status tanggal ini OFF (${selectedDateApprovedLeave?.category === 'SICK' ? 'Sakit' : 'Cuti / Izin'}). Pengisian logbook dinonaktifkan.`}
                  position="top"
                  className="w-full"
                >
                  <button
                    type="button"
                    disabled
                    className="w-full py-2.5 px-4 bg-slate-100 text-slate-400 text-xs font-bold rounded-xl border border-slate-200 cursor-not-allowed select-none flex items-center justify-center gap-1.5 opacity-70"
                  >
                    <Check className="w-4 h-4 text-slate-400 shrink-0" />
                    <span>Simpan Logbook Tidak Aktif (OFF)</span>
                  </button>
                </Tooltip>
              ) : isExistingLog ? (
                <div className="grid grid-cols-2 gap-2.5 w-full">
                  <button
                    type="button"
                    onClick={handleDeleteLogbook}
                    className="w-full py-2.5 px-3 bg-rose-50 hover:bg-rose-100 active:scale-[0.98] text-rose-700 text-xs font-bold rounded-xl border border-rose-200 transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs"
                  >
                    <Trash2 className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                    <span className="truncate">Hapus Logbook</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveLogbook}
                    className="w-full py-2.5 px-3 bg-blue-50 hover:bg-blue-100 active:scale-[0.98] text-[#1E3A8A] text-xs font-bold rounded-xl border border-blue-200 shadow-2xs transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Check className="w-4 h-4 text-[#1E3A8A] shrink-0" />
                    <span className="truncate">Simpan Perubahan</span>
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={handleSaveLogbook}
                  className="w-full py-2.5 px-4 bg-blue-50 hover:bg-blue-100 active:scale-[0.98] text-[#1E3A8A] text-xs font-bold rounded-xl border border-blue-200 shadow-2xs transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Check className="w-4 h-4 text-[#1E3A8A] shrink-0" />
                  <span>Simpan Logbook</span>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* CARD RUANG OBROLAN */}
        <div className="bg-white rounded-[28px] border border-slate-200/90 p-6 shadow-xs flex flex-col justify-between h-full min-h-[480px]">
          <div>
            {/* Header Ruang Obrolan */}
            <div className="flex items-center justify-between pb-3.5 mb-4 border-b border-slate-100 min-h-[44px]">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-blue-50 border border-blue-100 text-[#1E3A8A] flex items-center justify-center shrink-0">
                  <MessageSquare className="w-4 h-4" />
                </div>
                <h2 className="text-base font-bold text-slate-900 tracking-tight">
                  Ruang Obrolan
                </h2>
              </div>
              <button
                type="button"
                onClick={() => onNavigateTab('chat')}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#1E3A8A] hover:text-[#172554] bg-blue-50/80 hover:bg-blue-100/80 px-2.5 py-1 rounded-lg transition-colors cursor-pointer"
                title="Buka Ruang Obrolan Lengkap"
              >
                <span>Lihat Semua</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* List Topik Diskusi Terkini */}
            <div className="space-y-3">
              {chatTopics.length === 0 ? (
                <div className="text-center py-12 px-4">
                  <div className="w-12 h-12 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-center mx-auto mb-2.5 text-slate-400">
                    <MessageSquare className="w-6 h-6" />
                  </div>
                  <p className="text-xs font-bold text-slate-700">Belum ada obrolan tim</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">Mulai topik diskusi pertama bersama rekan kerja Anda.</p>
                </div>
              ) : (
                chatTopics.slice(0, 4).map((topic) => {
                  const commentsCount = topic.comments?.length || 0;
                  const latestComment = commentsCount > 0 ? topic.comments[commentsCount - 1] : null;

                  const statusBadge = (() => {
                    switch (topic.status) {
                      case 'NEED_COMMENTS':
                        return {
                          label: 'Perlu Tanggapan',
                          classes: 'bg-amber-50 text-amber-700 border-amber-200',
                          dot: 'bg-amber-500',
                        };
                      case 'IN_PROGRESS':
                        return {
                          label: 'Sedang Berjalan',
                          classes: 'bg-sky-50 text-sky-700 border-sky-200',
                          dot: 'bg-sky-500',
                        };
                      case 'CLOSED':
                        return {
                          label: 'Selesai',
                          classes: 'bg-emerald-50 text-emerald-700 border-emerald-200',
                          dot: 'bg-emerald-500',
                        };
                      case 'OPEN':
                      default:
                        return {
                          label: 'Terbuka',
                          classes: 'bg-blue-50 text-[#1E3A8A] border-blue-200',
                          dot: 'bg-[#1E3A8A]',
                        };
                    }
                  })();

                  return (
                    <div
                      key={topic.id}
                      onClick={() => setSelectedChatTopic(topic)}
                      className="group p-3.5 rounded-2xl bg-slate-50/80 hover:bg-white border border-slate-200/70 hover:border-blue-200 hover:shadow-xs transition-all duration-200 cursor-pointer space-y-2"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="text-xs font-bold text-slate-900 group-hover:text-[#1E3A8A] transition-colors line-clamp-1 flex-1">
                          {topic.title}
                        </h3>
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border shrink-0 ${statusBadge.classes}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${statusBadge.dot}`} />
                          {statusBadge.label}
                        </span>
                      </div>

                      {/* Cuplikan Pesan Terakhir atau Catatan */}
                      <p className="text-[11px] text-slate-500 line-clamp-1 leading-relaxed">
                        {latestComment ? (
                          <>
                            <span className="font-semibold text-slate-700">{latestComment.userName}: </span>
                            {latestComment.notes}
                          </>
                        ) : (
                          topic.shortNotes || 'Klik untuk membuka diskusi dan membalas...'
                        )}
                      </p>

                      {/* Info Pembuat & Jumlah Komentar */}
                      <div className="flex items-center justify-between text-[10px] text-slate-400 pt-1 border-t border-slate-100/90">
                        <span className="truncate">
                          Oleh <span className="font-medium text-slate-600">{topic.createdByName}</span> • {topic.createdAt?.split(' ')[1] || topic.createdAt || 'Hari Ini'}
                        </span>
                        <span className="inline-flex items-center gap-1 font-semibold text-slate-500 shrink-0">
                          <MessageSquare className="w-3 h-3 text-slate-400" />
                          <span>{commentsCount} Balasan</span>
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Tombol Aksi Bawah: Buka Ruang Obrolan */}
          <div className="pt-4 mt-4 border-t border-slate-100">
            <Tooltip content="Buka ruang diskusi lengkap untuk bertukar pesan dan kolaborasi tim" position="top" className="w-full">
              <button
                type="button"
                onClick={() => onNavigateTab('chat')}
                className="w-full py-3 px-4 bg-[#1E3A8A] hover:bg-[#172554] active:scale-[0.98] text-white text-xs font-bold rounded-2xl shadow-xs border border-[#1E3A8A] transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <MessageSquare className="w-4 h-4 text-white" />
                <span>Buka Ruang Obrolan Tim</span>
                <ArrowRight className="w-3.5 h-3.5 text-white/80 group-hover:translate-x-0.5 transition-transform" />
              </button>
            </Tooltip>
          </div>
        </div>

      </div>

      {/* 3. ROW 2: CARD TUGAS SAYA (Desain Kartu & Tabel Detail Sesuai Gambar Referensi) */}
      <div className="bg-white rounded-[28px] border border-slate-200/90 p-6 shadow-xs space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
          <div>
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-xl bg-blue-50 border border-blue-100 text-[#1E3A8A]">
                <ClipboardList className="w-4 h-4" />
              </div>
              <h2 className="text-base font-bold text-slate-900 tracking-tight">
                Tugas Saya
              </h2>
            </div>
          </div>

          <div className="flex items-center justify-between sm:justify-end gap-1.5 sm:gap-2 w-full sm:w-auto shrink-0">
            {/* View Switcher: Kartu Grid vs Tabel Detail */}
            <div className="flex items-center p-1 bg-slate-100/80 rounded-xl border border-slate-200/80 text-xs font-semibold shrink-0">
              <button
                type="button"
                onClick={() => setTaskViewMode('CARDS')}
                className={`px-2.5 sm:px-3 py-1.5 rounded-lg whitespace-nowrap transition-all cursor-pointer ${
                  taskViewMode === 'CARDS'
                    ? 'bg-white text-slate-900 shadow-2xs font-bold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Kartu Grid
              </button>
              <button
                type="button"
                onClick={() => setTaskViewMode('TABLE')}
                className={`px-2.5 sm:px-3 py-1.5 rounded-lg whitespace-nowrap transition-all cursor-pointer ${
                  taskViewMode === 'TABLE'
                    ? 'bg-white text-slate-900 shadow-2xs font-bold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Tabel Detail
              </button>
            </div>

            <button
              type="button"
              onClick={() => onNavigateTab('tasks_my')}
              title="Buka Tugas Saya"
              className="inline-flex items-center justify-center gap-1.5 p-2 sm:px-3 sm:py-1.5 text-xs font-bold text-slate-700 hover:text-[#1E3A8A] bg-slate-50 border border-slate-200 rounded-xl transition-colors cursor-pointer shrink-0 ml-auto sm:ml-0"
            >
              <span className="hidden sm:inline">Buka Tugas Saya</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* TAMPILAN 1: 4 KOLOM PROSES (Desain Kartu & Papan Sesuai Halaman Tugas Saya) */}
        {taskViewMode === 'CARDS' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5 items-start">
            {[
              {
                id: 'TODO' as TaskStatus,
                label: 'Penugasan',
                headerStyle: 'bg-slate-100 text-slate-700 border-slate-200 font-bold',
              },
              {
                id: 'IN_PROGRESS' as TaskStatus,
                label: 'Dalam Proses',
                headerStyle: 'bg-sky-100 text-sky-800 border-sky-200 font-bold shadow-2xs',
              },
              {
                id: 'DONE' as TaskStatus,
                label: 'Preview Tugas',
                headerStyle: 'bg-amber-100 text-amber-800 border-amber-200 font-bold shadow-2xs',
              },
              {
                id: 'REVIEWED' as TaskStatus,
                label: 'Selesai',
                headerStyle: 'bg-emerald-100 text-emerald-800 border-emerald-200 font-bold shadow-2xs',
              },
            ].map((col) => {
              const allColumnTasks = tasksState.filter(
                (t) => isTaskAssignedToMe(t) && t.status === col.id
              );
              const sortedTasks = [...allColumnTasks].sort((a, b) => {
                const dateA = a.updatedAt || a.createdAt || '';
                const dateB = b.updatedAt || b.createdAt || '';
                return dateB.localeCompare(dateA);
              });
              const displayedTasks = sortedTasks.slice(0, 1);

              return (
                <div key={col.id} className="flex flex-col space-y-3">
                  {/* Judul Proses & Angka Bersatu dalam 1 Container Ber-BG & Beradius (100% Mirip Halaman Tugas Saya) */}
                  <div className={`flex items-center justify-between px-3.5 py-2.5 rounded-xl border shadow-2xs shrink-0 font-bold text-xs tracking-tight ${col.headerStyle}`}>
                    <span>{col.label}</span>
                    <span className="w-5 h-5 rounded-full bg-white text-slate-800 font-extrabold text-[11px] flex items-center justify-center shadow-2xs border border-white/80 shrink-0">
                      {allColumnTasks.length}
                    </span>
                  </div>

                  {/* Tasks List */}
                  <div className="space-y-3">
                    {displayedTasks.length === 0 ? (
                      <div className="py-8 px-4 text-center text-slate-400 text-xs border border-dashed border-slate-200/90 rounded-2xl bg-slate-50/50 flex flex-col items-center justify-center gap-2">
                        <EmptyStateTaskIllustration className="w-12 h-12 opacity-75" />
                        <span className="font-semibold text-slate-500">Belum ada tugas di kolom ini</span>
                      </div>
                    ) : (
                      displayedTasks.map((task) => {
                        const isMyTask = task.assignedTo === currentUser.id || Boolean(task.assignees?.some((a) => a.id === currentUser.id));
                        const isPIC = currentUser.role === 'ADMIN' || currentUser.role === 'SUPER_ADMIN' || task.createdBy === currentUser.id;

                        // Warna border kartu sesuai dengan warna border proses pengerjaan
                        const cardProcessBorder =
                          task.status === 'REVIEWED'
                            ? 'border-emerald-300 hover:border-emerald-500 hover:shadow-emerald-500/10'
                            : task.status === 'DONE'
                            ? 'border-amber-400 hover:border-amber-500 hover:shadow-amber-500/15'
                            : task.status === 'IN_PROGRESS'
                            ? 'border-sky-300 hover:border-sky-500 hover:shadow-sky-500/10'
                            : 'border-slate-300 hover:border-slate-400 hover:shadow-slate-500/5';

                        return (
                          <div
                            key={task.id}
                            onClick={() => {
                              if (task.status === 'TODO') return;
                              setSelectedTaskForDetail(task);
                            }}
                            className={`bg-white rounded-2xl p-5 border ${cardProcessBorder} shadow-2xs hover:shadow-md transition-all duration-200 ${
                              task.status === 'TODO' ? 'cursor-default' : 'cursor-pointer'
                            } space-y-3.5 group`}
                          >
                            {/* Baris Atas: Priority Badge & Button Hapus PIC / 3 Dots */}
                            <div className="flex items-center justify-between gap-2">
                              <div>
                                {getPriorityBadge(task.priority)}
                              </div>

                              {isPIC ? (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    AppStorage.deleteTask(task.id);
                                    setTasksState(AppStorage.getTasks());
                                  }}
                                  className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg cursor-pointer transition-colors"
                                  title="Hapus Tugas"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              ) : task.status !== 'TODO' ? (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedTaskForDetail(task);
                                  }}
                                  className="p-1 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
                                  title="Opsi"
                                >
                                  <span className="text-base font-bold leading-none tracking-widest">&#8942;</span>
                                </button>
                              ) : null}
                            </div>

                            {/* Judul Tugas */}
                            <h3 className="font-bold text-sm text-slate-900 leading-snug">
                              {task.title}
                            </h3>

                            {/* Deskripsi Singkat */}
                            {task.description && (
                              <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed">
                                {task.description}
                              </p>
                            )}

                            {/* Banner Peringatan Revisi jika sedang IN_PROGRESS dan ada catatan perbaikan */}
                            {task.status === 'IN_PROGRESS' && (() => {
                              const revNote = task.reviewNotes || task.activities?.slice().reverse().find((a) => a.type === 'REVISION_REQUESTED')?.notes;
                              if (!revNote) return null;
                              return (
                                <div className="p-2.5 bg-rose-50 border border-rose-200/90 rounded-xl text-[11px] text-rose-800 space-y-1 my-1">
                                  <div className="flex items-center gap-1.5 font-bold text-rose-900">
                                    <RotateCcw className="w-3 h-3 text-rose-600 shrink-0" />
                                    <span>Perlu Revisi dari PIC:</span>
                                  </div>
                                  <p className="line-clamp-2 text-rose-700 italic font-medium leading-relaxed">
                                    "{revNote}"
                                  </p>
                                </div>
                              );
                            })()}

                            {/* Hairline Divider */}
                            <div className="border-t border-slate-100 pt-2" />

                            {/* Footer: Overlapping Assignee Avatars (Kiri) & Deadline Date (Kanan) */}
                            <div className="flex items-center justify-between gap-2 text-xs">
                              {task.assignees && task.assignees.length > 0 ? (
                                <div className="flex items-center -space-x-2">
                                  {task.assignees.slice(0, 3).map((a, idx) => (
                                    a.avatar ? (
                                      <img
                                        key={idx}
                                        src={a.avatar}
                                        alt={a.name}
                                        className="w-7 h-7 rounded-full object-cover border-2 border-white shadow-2xs"
                                        title={`Pelaksana: ${a.name}`}
                                      />
                                    ) : (
                                      <div
                                        key={idx}
                                        className="w-7 h-7 rounded-full bg-amber-400 text-slate-900 border-2 border-white font-extrabold text-[10px] flex items-center justify-center shadow-2xs"
                                        title={`Pelaksana: ${a.name}`}
                                      >
                                        {a.name.substring(0, 2).toUpperCase()}
                                      </div>
                                    )
                                  ))}
                                  {task.assignees.length > 3 && (
                                    <div
                                      className="w-7 h-7 rounded-full bg-slate-200 text-slate-700 border-2 border-white font-bold text-[10px] flex items-center justify-center shadow-2xs"
                                      title={`${task.assignees.length - 3} pelaksana lainnya`}
                                    >
                                      +{task.assignees.length - 3}
                                    </div>
                                  )}
                                </div>
                              ) : (
                                <div className="flex items-center -space-x-2">
                                  <div className="w-7 h-7 rounded-full bg-amber-400 text-slate-900 border-2 border-white font-extrabold text-[10px] flex items-center justify-center shadow-2xs" title={`Pelaksana: ${task.assignedName}`}>
                                    {task.assignedName ? task.assignedName.substring(0, 2).toUpperCase() : 'AU'}
                                  </div>
                                  {task.assignedAvatar && (
                                    <img
                                      src={task.assignedAvatar}
                                      alt={task.assignedName}
                                      className="w-7 h-7 rounded-full object-cover border-2 border-white shadow-2xs"
                                      title={`Pelaksana: ${task.assignedName}`}
                                    />
                                  )}
                                </div>
                              )}

                              <span className="text-xs text-slate-400 font-normal">
                                {task.dueDate}
                              </span>
                            </div>

                            {/* Tombol Aksi Sesuai Flow Penugasan */}
                            <div className="pt-1 flex flex-wrap items-center gap-1.5 text-xs">
                              {/* 1. TO-DO: Mulai Mengerjakan */}
                              {task.status === 'TODO' && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleUpdateTaskStatus(task.id, 'IN_PROGRESS');
                                  }}
                                  className="w-full py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-200 font-bold rounded-xl text-center transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-2xs"
                                >
                                  <span>Mulai Mengerjakan</span>
                                  <ArrowRight className="w-3.5 h-3.5" />
                                </button>
                              )}

                              {/* 2. IN_PROGRESS: Kirim Preview */}
                              {task.status === 'IN_PROGRESS' && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedTaskForDetail(task);
                                  }}
                                  className="w-full py-2 bg-[#1E3A8A] hover:bg-[#172554] text-white font-bold rounded-xl text-center transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-2xs"
                                  title="Buka Chat untuk Upload Bukti & Kirim Preview"
                                >
                                  <Send className="w-3.5 h-3.5 text-white" />
                                  <span>Kirim Preview</span>
                                </button>
                              )}

                              {/* 3. PREVIEW (DONE): Otoritas PIC vs Karyawan */}
                              {task.status === 'DONE' && (
                                isPIC ? (
                                  <div className="grid grid-cols-2 gap-1.5 w-full">
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleUpdateTaskStatus(task.id, 'REVIEWED');
                                      }}
                                      className="py-1.5 bg-emerald-100 hover:bg-emerald-200 text-emerald-800 border border-emerald-300 font-bold rounded-xl text-center transition-all shadow-2xs cursor-pointer flex items-center justify-center gap-1"
                                      title="Setujui Hasil Kerja (ACC)"
                                    >
                                      <Check className="w-3.5 h-3.5 text-emerald-700" />
                                      <span>ACC</span>
                                    </button>

                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setSelectedTaskForDetail(task);
                                      }}
                                      className="py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 font-bold rounded-xl text-center transition-all cursor-pointer flex items-center justify-center gap-1"
                                      title="Revisi"
                                    >
                                      <MessageSquare className="w-3.5 h-3.5 text-amber-700" />
                                      <span>Revisi</span>
                                    </button>
                                  </div>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setSelectedTaskForDetail(task);
                                    }}
                                    className="w-full py-2 bg-amber-50 hover:bg-amber-100 text-amber-800 font-bold rounded-xl text-center text-xs flex items-center justify-center gap-1.5 border border-amber-200/90 cursor-pointer shadow-2xs"
                                    title="Menunggu Review PIC"
                                  >
                                    <Clock className="w-3.5 h-3.5 text-amber-600 animate-pulse" />
                                    <span>Menunggu Review</span>
                                  </button>
                                )
                              )}

                              {/* 4. APPROVED (REVIEWED): Tugas Selesai */}
                              {task.status === 'REVIEWED' && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedTaskForDetail(task);
                                  }}
                                  className="w-full py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-bold rounded-xl text-center text-xs flex items-center justify-center gap-1.5 border border-emerald-200/90 cursor-pointer shadow-2xs"
                                  title="Tugas Selesai"
                                >
                                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                                  <span>Tugas Selesai</span>
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })
                    )}

                    {/* Indikator Jika Ada Tugas Lain di Proses Ini */}
                    {allColumnTasks.length > 1 && (
                      <button
                        type="button"
                        onClick={() => onNavigateTab('tasks_my')}
                        className="w-full py-2 px-3 bg-slate-50 hover:bg-slate-100 border border-slate-200/80 rounded-xl text-[11px] font-bold text-slate-700 hover:text-[#1E3A8A] flex items-center justify-center transition-colors cursor-pointer text-center"
                      >
                        +{allColumnTasks.length - 1} tugas lainnya
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          /* TAMPILAN 2: TABEL DETAIL (Sesuai Halaman Tugas Saya) */
          <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse min-w-[650px]">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/80 text-slate-700 font-bold">
                    <th className="py-3 px-4 font-bold">Tugas</th>
                    <th className="py-3 px-3.5 font-bold">Penanggung Jawab</th>
                    <th className="py-3 px-3.5 font-bold">Tahapan Tugas</th>
                    <th className="py-3 px-3.5 font-bold">Tenggat Waktu</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {myActiveTasksList.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="py-10 text-center text-slate-400 font-medium">
                        Tidak ada data tugas yang tersedia.
                      </td>
                    </tr>
                  ) : (
                    myActiveTasksList.map((task) => {
                      const stageLabel =
                        task.status === 'TODO'
                          ? 'Penugasan'
                          : task.status === 'IN_PROGRESS'
                          ? 'Dalam Proses'
                          : task.status === 'DONE'
                          ? 'Preview Tugas'
                          : 'Selesai';

                      const stageBadgeColor =
                        task.status === 'REVIEWED'
                          ? 'bg-emerald-600 text-white'
                          : task.status === 'DONE'
                          ? 'bg-amber-500 text-white'
                          : task.status === 'IN_PROGRESS'
                          ? 'bg-blue-600 text-white'
                          : 'bg-slate-600 text-white';

                      return (
                        <tr
                          key={task.id}
                          onClick={() => {
                            if (task.status === 'TODO') return;
                            setSelectedTaskForDetail(task);
                          }}
                          className={`hover:bg-slate-50/80 transition-colors ${
                            task.status === 'TODO' ? 'cursor-default' : 'cursor-pointer'
                          } group`}
                        >
                          <td className="py-3.5 px-4 max-w-[280px]">
                            <div className="font-bold text-slate-900 leading-snug group-hover:text-indigo-600 transition-colors">
                              {task.title}
                            </div>
                            {task.description && (
                              <div className="text-[11px] text-slate-500 line-clamp-1 mt-0.5">
                                {task.description}
                              </div>
                            )}
                          </td>
                          <td className="py-3 px-3.5">
                            <div className="flex items-center gap-2">
                              <div className="flex items-center -space-x-1.5 shrink-0">
                                <div className="w-6 h-6 rounded-full bg-amber-400 text-slate-900 border-2 border-white font-extrabold text-[10px] flex items-center justify-center shadow-2xs">
                                  {task.assignedName ? task.assignedName.substring(0, 2).toUpperCase() : 'AU'}
                                </div>
                                {task.assignedAvatar && (
                                  <img
                                    src={task.assignedAvatar}
                                    alt={task.assignedName}
                                    className="w-6 h-6 rounded-full object-cover border-2 border-white shadow-2xs"
                                  />
                                )}
                              </div>
                              <span className="font-semibold text-slate-800 text-xs truncate max-w-[120px]">
                                {task.assignedName}
                              </span>
                            </div>
                          </td>
                          <td className="py-3 px-3.5">
                            <span className={`inline-block text-[10px] font-bold px-2.5 py-1 rounded-full ${stageBadgeColor}`}>
                              {stageLabel}
                            </span>
                          </td>
                          <td className="py-3 px-3.5 text-slate-700 text-xs whitespace-nowrap">
                            {task.dueDate || '-'}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {selectedTaskForDetail && (
        <TaskDetailModal
          task={selectedTaskForDetail}
          onClose={() => setSelectedTaskForDetail(null)}
          currentUser={currentUser}
          users={users}
          onRefresh={() => setTasksState(AppStorage.getTasks())}
        />
      )}

      {/* Pop Up Dialog Konfirmasi Simpel (Tanpa default browser alert/confirm localhost) */}
      <ModernConfirmDialog
        isOpen={confirmModal.isOpen}
        title={confirmModal.title}
        message={confirmModal.message}
        variant={confirmModal.variant}
        confirmText={confirmModal.confirmText}
        cancelText={confirmModal.cancelText}
        hideCancel={confirmModal.hideCancel}
        onConfirm={confirmModal.onConfirm}
        onCancel={() => setConfirmModal((prev) => ({ ...prev, isOpen: false }))}
      />

      {/* Pop Up Detail & Diskusi Topik Ruang Obrolan */}
      <ChatTopicModal
        isOpen={!!selectedChatTopic}
        topic={selectedChatTopic}
        onClose={() => setSelectedChatTopic(null)}
        currentUser={currentUser}
        users={users}
        onNavigateToFullChat={() => onNavigateTab('chat')}
        onTopicUpdated={(updatedTopic) => {
          setSelectedChatTopic(updatedTopic);
        }}
      />
    </div>
  );
}
