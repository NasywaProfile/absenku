import React, { useState, useEffect, useMemo } from 'react';
import {
  Users,
  CheckCircle2,
  Clock,
  Maximize2,
  Minimize2,
  Building2,
  FileCheck,
  Check,
  X,
  ChevronRight,
  ChevronLeft,
  Search,
  Mail,
  ClipboardCopy,
  CalendarDays,
  UserCheck,
  Plus,
  Smile,
  ListTodo,
  ClipboardList,
  Paperclip,
  Bold,
  Italic,
  Underline as UnderlineIcon,
  Strikethrough,
  Trash2,
  MoreVertical,
  RotateCcw,
  Send,
  AlertTriangle,
  Calendar,
  ArrowRight,
  MessageSquare,
  MapPin,
  ExternalLink,
  Edit3,
} from 'lucide-react';
import { AttendanceRecord, LeaveRequest, OfficeConfig, User, UserRole, EmploymentType, TaskItem, TaskStatus, TaskPriority, getPriorityLabel, ChatTopic } from '../../types/index.ts';
import { formatIndonesianDate, formatIndonesianDateShort, getCurrentDateString } from '../../lib/time-utils.ts';
import { TaskDetailModal } from '../tasks/TaskDetailModal.tsx';
import {
  generateWhatsAppAttendanceRecap,
  copyTextToClipboard,
  EMPLOYMENT_TYPE_LABELS,
} from '../../lib/whatsapp-recap.ts';
import { RegistrationApprovalList } from './RegistrationApprovalList.tsx';
import { EmployeeDetailDrawer } from './EmployeeDetailDrawer.tsx';
import { EditAttendanceModal } from './EditAttendanceModal.tsx';
import { AppStorage } from '../../lib/storage.ts';
import { EmptyStateTaskIllustration } from '../common/Illustrations.tsx';
import { Tooltip } from '../ui/tooltip.tsx';
import { ModernConfirmDialog } from '../common/ModernConfirmDialog.tsx';
import { SimpleProfileModal, SimpleProfileData } from '../common/SimpleProfileModal.tsx';
import { MediaPreviewModal, MediaPreviewData } from '../common/MediaPreviewModal.tsx';
import { openAttachmentDirectly, openExternalLink, isImageFile } from '../../lib/open-media.ts';
import { ChatTopicModal } from '../chat/ChatTopicModal.tsx';
import { DropdownMenu } from '../ui/dropdown-menu.tsx';

interface AdminDashboardProps {
  currentUser: User;
  users: User[];
  attendanceRecords?: AttendanceRecord[];
  records?: AttendanceRecord[];
  leaves: LeaveRequest[];
  tasks?: any;
  officeConfig: OfficeConfig;
  onApproveLeave: (leaveId: string) => void;
  onRejectLeave: (leaveId: string, reason: string) => void;
  onApproveRegistration?: (userId: string, role?: UserRole) => void;
  onRejectRegistration?: (userId: string) => void;
  onUpdateRole?: (userId: string, newRole: UserRole) => void;
  onUpdateType?: (userId: string, newType: EmploymentType) => void;
  onToggleStatus?: (userId: string) => void;
  onNavigateTab: (tabId: string) => void;
  onOpenEmailModal?: () => void;
  onOpenSettingsModal: () => void;
  onApproveTask?: any;
  onRequestTaskRevision?: any;
  onDeleteTask?: any;
  onUpdateUser?: any;
  onUpdateAttendanceRecord?: any;
}

export function AdminDashboard({
  currentUser,
  users,
  attendanceRecords: propAttendanceRecords,
  records: propRecords,
  leaves,
  tasks: propTasks,
  officeConfig,
  onApproveLeave,
  onRejectLeave,
  onApproveRegistration = (userId, role) => {
    AppStorage.approveRegistration(userId, currentUser.name);
    if (role) AppStorage.updateUserRole(userId, role);
  },
  onRejectRegistration = (userId) => AppStorage.rejectRegistration(userId),
  onUpdateRole = (userId, newRole) => AppStorage.updateUserRole(userId, newRole),
  onUpdateType = (userId, newType) => AppStorage.updateEmploymentType(userId, newType),
  onToggleStatus = (userId) => AppStorage.toggleUserActiveStatus(userId),
  onNavigateTab,
  onOpenEmailModal,
  onOpenSettingsModal,
  onUpdateAttendanceRecord,
}: AdminDashboardProps) {
  const attendanceRecords = propAttendanceRecords || propRecords || [];
  const isSuperAdmin = currentUser?.role === 'SUPER_ADMIN';
  const [selectedEmployee, setSelectedEmployee] = useState<User | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [selectedTaskForDetail, setSelectedTaskForDetail] = useState<TaskItem | null>(null);

  // View Mode untuk Kartu Grid vs Tabel Detail pada Tugas
  const [taskViewMode, setTaskViewMode] = useState<'CARDS' | 'TABLE'>('CARDS');
  const [simpleProfilePopup, setSimpleProfilePopup] = useState<SimpleProfileData | null>(null);

  // Detail Modal untuk Presensi Masuk & Persetujuan Perizinan
  const [selectedAttendanceDetail, setSelectedAttendanceDetail] = useState<AttendanceRecord | null>(null);
  const [editingAttendanceRecord, setEditingAttendanceRecord] = useState<AttendanceRecord | null>(null);
  const [returnToAttendanceDetailOnClose, setReturnToAttendanceDetailOnClose] = useState<AttendanceRecord | null>(null);
  const [isAttendanceModalFullScreen, setIsAttendanceModalFullScreen] = useState(false);
  const [selectedLeaveDetail, setSelectedLeaveDetail] = useState<LeaveRequest | null>(null);
  const [isLeaveModalFullScreen, setIsLeaveModalFullScreen] = useState(false);

  // Sekilas Ruang Obrolan
  const [chatTopics, setChatTopics] = useState<ChatTopic[]>(() => AppStorage.getChatTopics());
  const [selectedChatTopic, setSelectedChatTopic] = useState<ChatTopic | null>(null);

  // Calendar & Logbook state
  const todayDateStr = getCurrentDateString();
  const [calendarDate, setCalendarDate] = useState(() => isSuperAdmin ? new Date(2026, 9, 29) : new Date());
  const [selectedDate, setSelectedDate] = useState<string>(() => isSuperAdmin ? '2026-10-29' : todayDateStr);
  const [logbookText, setLogbookText] = useState('');
  const [isExistingLog, setIsExistingLog] = useState(false);
  const [savedSuccessMessage, setSavedSuccessMessage] = useState<string | null>(null);
  const [dataVersion, setDataVersion] = useState(0);
  const [mediaPreview, setMediaPreview] = useState<MediaPreviewData | null>(null);

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

  // Load all attendance and daily tasks for calendar markers for admin user
  const adminAttendance = useMemo(() => {
    return AppStorage.getAttendanceRecords().filter((r) => r.userId === currentUser.id);
  }, [currentUser.id, dataVersion, attendanceRecords]);

  const adminDailyTasks = useMemo(() => {
    return AppStorage.getDailyTasks().filter((t) => t.userId === currentUser.id);
  }, [currentUser.id, dataVersion]);

  // Load existing logbook on selectedDate change
  useEffect(() => {
    const existingLog = AppStorage.getDailyTaskForDate(currentUser.id, selectedDate);
    if (existingLog && ((existingLog.tasks && existingLog.tasks.length > 0) || existingLog.notes)) {
      const text =
        existingLog.tasks && existingLog.tasks.length > 0
          ? existingLog.tasks.join('\n')
          : existingLog.notes || '';
      setLogbookText(text);
      setIsExistingLog(true);
    } else {
      const attRecord = adminAttendance.find((a) => a.date === selectedDate);
      if (attRecord && attRecord.tasksDoneSummary && attRecord.tasksDoneSummary.length > 0) {
        setLogbookText(attRecord.tasksDoneSummary.join('\n'));
        setIsExistingLog(true);
      } else {
        setLogbookText('');
        setIsExistingLog(false);
      }
    }
    setSavedSuccessMessage(null);
  }, [selectedDate, currentUser.id, adminAttendance, dataVersion]);

  const handleSaveLogbook = () => {
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

  // Tasks state
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
    notes?: { submissionNotes?: string; reviewNotes?: string }
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

  // Reject Prompt State
  const [rejectDialog, setRejectDialog] = useState<{
    isOpen: boolean;
    leaveId: string;
    userName: string;
    reason: string;
  }>({
    isOpen: false,
    leaveId: '',
    userName: '',
    reason: '',
  });
  const [isRejectModalFullScreen, setIsRejectModalFullScreen] = useState(false);

  const todayStr = getCurrentDateString();
  const todayAttendance = attendanceRecords.filter((r) => r.date === todayStr);
  const pendingLeaves = leaves.filter((l) => l.status === 'PENDING');
  const pendingRegistrations = users.filter((u) => u.status === 'PENDING_APPROVAL');

  const todayRecord = attendanceRecords.find(
    (r) => r.userId === currentUser.id && r.date === todayStr
  );

  const handleCopyWA = async (record: AttendanceRecord) => {
    const userObj = users.find((u) => u.id === record.userId) || currentUser;
    const taskLog = AppStorage.getTodayDailyTask(record.userId);

    const waText = generateWhatsAppAttendanceRecap({
      attendance: record,
      dailyTask: taskLog,
      user: userObj,
      dateStr: record.date,
    });

    const success = await copyTextToClipboard(waText);
    if (success) {
      setCopiedId(record.id);
      setTimeout(() => setCopiedId(null), 2500);
    }
  };

  const handleOpenDrawer = (userId: string) => {
    const targetUser = users.find((u) => u.id === userId) || null;
    if (targetUser) {
      setSelectedEmployee(targetUser);
    }
  };

  const categoryLabels = {
    LEAVE: 'Izin / Cuti',
    WFH: 'WFH',
    SICK: 'Sakit',
    BUSINESS_TRIP: 'Dinas Luar',
  };

  const categoryBadgeColors = {
    LEAVE: 'bg-[#DCFCE7] text-[#15803D] border-emerald-200',
    WFH: 'bg-[#FEF3C7] text-[#B45309] border-amber-200',
    SICK: 'bg-[#FFEDD5] text-[#C2410C] border-orange-200',
    BUSINESS_TRIP: 'bg-[#E0E7FF] text-[#4338CA] border-purple-200',
  };

  const firstName = currentUser.name.split(' ')[0];

  const getTimeGreeting = () => {
    const hour = new Date().getHours();
    if (hour >= 11 && hour < 15) return 'Selamat siang';
    if (hour >= 15 && hour < 19) return 'Selamat sore';
    if (hour >= 19 || hour < 5) return 'Selamat malam';
    return 'Selamat pagi';
  };

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

  return (
    <div className="w-full space-y-6 pb-8">
      {/* 1. TOP HEADER HERO (SESUAI FORMAT SAMBUTAN & TOOLBAR HARI INI) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-light text-slate-400 tracking-tight">
            {getTimeGreeting()}, <span className="font-bold text-slate-900">{firstName}</span>
          </h1>
        </div>

        {/* Quick Action Toolbar */}
        <div className="flex items-center gap-2.5 flex-wrap">

          {onOpenEmailModal && (
            <Tooltip content="Kirim atau pantau rekap log email harian tim" position="bottom">
              <button
                type="button"
                onClick={onOpenEmailModal}
                className="inline-flex items-center gap-1.5 px-3.5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-2xl text-xs font-bold transition-all border border-slate-200 cursor-pointer"
              >
                <Mail className="w-4 h-4 text-slate-600" />
                <span>Log Email</span>
              </button>
            </Tooltip>
          )}
        </div>
      </div>

      {/* 2. BARIS 1: 2-COLUMN EQUAL GRID (Sekilas Ruang Obrolan & Kalender Presensi) - 100% SAMA DENGAN BERANDA KARYAWAN */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-stretch">
        
        {/* CARD 1: SEKILAS RUANG OBROLAN (Menggantikan To Do List) */}
        <div className="bg-white rounded-[28px] border border-slate-200/90 p-6 shadow-xs flex flex-col justify-between h-full min-h-[480px] md:order-2">
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
                chatTopics.slice(0, 3).map((topic) => {
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

        {/* CARD 2: KALENDER PRESENSI DENGAN LOGBOOK INTEGRASI (Sama Persis dengan Presensi Sekarang) / KALENDER KERJA (SUPER ADMIN) */}
        <div className="bg-white rounded-[28px] border border-slate-200/90 p-6 shadow-xs flex flex-col justify-between h-full md:order-1">
          <div>
            {/* Header Kalender */}
            <div className="flex items-center justify-between pb-3.5 mb-4 border-b border-slate-100 min-h-[44px]">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-blue-50 border border-blue-100 text-[#1E3A8A] flex items-center justify-center shrink-0">
                  <Calendar className="w-4 h-4" />
                </div>
                <h2 className="text-base font-bold text-slate-900 tracking-tight">
                  {isSuperAdmin ? 'Kalender Kerja' : 'Kalender Presensi'}
                </h2>
              </div>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={handlePrevMonth}
                  className="p-1 hover:bg-slate-100 text-slate-400 hover:text-slate-700 rounded-lg transition-colors cursor-pointer"
                  title="Bulan Sebelumnya"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="text-xs font-bold text-slate-700 px-1 capitalize">
                  {currentMonthName}
                </span>
                <button
                  type="button"
                  onClick={handleNextMonth}
                  className="p-1 hover:bg-slate-100 text-slate-400 hover:text-slate-700 rounded-lg transition-colors cursor-pointer"
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

                  const att = adminAttendance.find((a) => a.date === dateStr);
                  const log = adminDailyTasks.find((t) => t.date === dateStr);
                  const hasAtt = !isSuperAdmin && !!att;
                  const hasLog =
                    !isSuperAdmin &&
                    ((log?.tasks && log.tasks.length > 0) ||
                    (att?.tasksDoneSummary && att.tasksDoneSummary.length > 0));
                  const isPendingLog = !isSuperAdmin && hasAtt && !hasLog;

                  return (
                    <button
                      key={i}
                      type="button"
                      onClick={() => setSelectedDate(dateStr)}
                      title={isWeekend ? 'Hari Libur (Sabtu / Minggu)' : undefined}
                      className={`py-1.5 rounded-xl font-medium transition-all relative flex flex-col items-center justify-center cursor-pointer ${
                        isSelected
                          ? isWeekend
                            ? 'bg-[#1E3A8A] text-white font-extrabold shadow-sm ring-2 ring-[#1E3A8A] ring-offset-1 border border-red-500'
                            : 'bg-[#1E3A8A] text-white font-extrabold shadow-sm ring-2 ring-[#1E3A8A] ring-offset-1'
                          : hasAtt
                          ? isWeekend
                            ? 'bg-blue-100/90 text-[#1E3A8A] font-bold border border-red-500'
                            : 'bg-blue-100/90 text-[#1E3A8A] font-bold border border-blue-200'
                          : isToday
                          ? isWeekend
                            ? 'bg-blue-50 text-[#1E3A8A] font-semibold border border-red-500'
                            : 'bg-blue-50 text-[#1E3A8A] font-semibold border border-blue-200/60'
                          : isWeekend
                          ? 'border border-red-500 text-red-600 bg-red-50/30 font-semibold hover:bg-red-50/60'
                          : 'text-slate-700 hover:bg-slate-200/60 border border-transparent'
                      }`}
                    >
                      <span>{day}</span>

                      {/* Penanda Kehadiran & Logbook (Hanya untuk Admin Operasional) */}
                      {!isSuperAdmin && (
                        <div className="flex items-center gap-0.5 justify-center mt-0.5 min-h-[4px]">
                          {hasAtt && (
                            <span
                              title="Presensi Hadir"
                              className={`w-1 h-1 rounded-full ${
                                isSelected ? 'bg-white' : 'bg-emerald-500'
                              }`}
                            />
                          )}
                          {hasLog ? (
                            <span
                              title="Logbook Terisi"
                              className={`w-1 h-1 rounded-full ${
                                isSelected ? 'bg-white' : 'bg-[#1E3A8A]'
                              }`}
                            />
                          ) : isPendingLog ? (
                            <span
                              title="Belum Isi Logbook"
                              className={`w-1 h-1 rounded-full animate-pulse ${
                                isSelected ? 'bg-white' : 'bg-amber-500'
                              }`}
                            />
                          ) : null}
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Legend / Keterangan Penanda Singkat */}
            {isSuperAdmin ? (
              <div className="flex flex-wrap items-center justify-center gap-3 text-[10px] text-slate-500 pt-2.5">
                <span className="flex items-center gap-1">
                  <span className="w-2.5 h-2.5 rounded-sm bg-[#1E3A8A]" />
                  Hari Terpilih
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2.5 h-2.5 rounded-sm border border-rose-300 bg-rose-50/60" />
                  Libur Akhir Pekan (Sabtu &amp; Minggu)
                </span>
              </div>
            ) : (
              <div className="flex flex-wrap items-center justify-center gap-3 text-[10px] text-slate-500 pt-2.5">
                <span className="flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  Hadir
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#1E3A8A]" />
                  Logbook Terisi
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                  Belum Isi Logbook
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2.5 h-2.5 rounded-sm border border-rose-300 bg-rose-50/60" />
                  Libur (Sabtu &amp; Minggu)
                </span>
              </div>
            )}

            {/* Button Absen Masuk (Hanya untuk Admin Operasional) */}
            {!isSuperAdmin && (
              <div className="pt-3">
                {todayRecord?.clockInTime ? (
                  <div className="w-full py-2.5 px-4 bg-emerald-50 border border-emerald-200 text-emerald-800 text-center text-xs font-semibold rounded-2xl flex items-center justify-center gap-2 shadow-2xs">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>Presensi Masuk Tercatat ({todayRecord.clockInTime} WIB)</span>
                  </div>
                ) : (
                  <Tooltip content="Buka menu presensi untuk presensi masuk kantor hari ini dengan verifikasi" position="top" className="w-full">
                    <button
                      type="button"
                      onClick={() => onNavigateTab('clock')}
                      className="w-full py-3 px-4 bg-[#1E3A8A] hover:bg-[#172554] active:scale-[0.98] text-white text-xs font-bold rounded-2xl shadow-sm border border-[#1E3A8A] transition-all flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <Clock className="w-4 h-4 text-white" />
                      <span>Presensi Masuk (Presensi Sekarang)</span>
                    </button>
                  </Tooltip>
                )}
              </div>
            )}
          </div>

          {/* BAGIAN BAWAH: AGENDA & PENGAWASAN (SUPER ADMIN) vs LOGBOOK (ADMIN) */}
          {isSuperAdmin ? (
            <div className="pt-4 mt-4 border-t border-slate-100 space-y-3">
              {(() => {
                const selDateObj = new Date(selectedDate);
                const dayNum = selDateObj.getDay();
                const isSelWeekend = dayNum === 0 || dayNum === 6;
                return (
                  <>
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-slate-800">
                        {formatIndonesianDate(selectedDate)}
                      </span>
                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                        isSelWeekend ? 'bg-rose-50 text-rose-600 border border-rose-200' : 'bg-blue-50 text-[#1E3A8A] border border-blue-200'
                      }`}>
                        {isSelWeekend ? 'Libur Akhir Pekan' : 'Hari Kerja Aktif'}
                      </span>
                    </div>

                    <div className="p-3.5 bg-slate-50/90 rounded-2xl border border-slate-100 text-xs space-y-2">
                      <div className="flex items-center justify-between text-slate-600">
                        <span className="text-[11px]">Jam Kerja Kantor:</span>
                        <span className="font-semibold text-slate-800 text-[11px]">
                          {isSelWeekend ? 'Libur Operasional' : `${officeConfig?.workStartHour || '08:00'} - ${officeConfig?.workEndHour || '17:00'} WIB`}
                        </span>
                      </div>
                    </div>
                  </>
                );
              })()}
            </div>
          ) : (
            <div className="pt-4 mt-4 border-t border-slate-100 space-y-2.5">
              {/* Header Tanggal Terpilih */}
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-slate-800">
                  Logbook {formatIndonesianDate(selectedDate)}
                </span>
              </div>

              {/* Satu Text Box Simpel Saja */}
              <textarea
                rows={3}
                value={logbookText}
                onChange={(e) => setLogbookText(e.target.value)}
                placeholder="Tulis apa yang dikerjakan pada tanggal ini..."
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-indigo-400 focus:bg-white transition-all resize-none shadow-2xs placeholder:text-slate-400"
              />

              {/* Tombol Aksi Logbook: Sama Ukuran & Tanpa Space Kosong */}
              <div className="space-y-2 pt-1 w-full">
                {savedSuccessMessage && (
                  <div className="text-xs font-bold text-emerald-600 animate-fadeIn">
                    {savedSuccessMessage}
                  </div>
                )}

                {isExistingLog ? (
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
                      className="w-full py-2.5 px-3 bg-[#1E3A8A] hover:bg-[#172554] active:scale-[0.98] text-white text-xs font-bold rounded-xl shadow-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <Check className="w-4 h-4 text-white shrink-0" />
                      <span className="truncate">Simpan Perubahan</span>
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={handleSaveLogbook}
                    className="w-full py-2.5 px-4 bg-[#1E3A8A] hover:bg-[#172554] active:scale-[0.98] text-white text-xs font-bold rounded-xl shadow-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Check className="w-4 h-4 text-white shrink-0" />
                    <span>Simpan Logbook</span>
                  </button>
                )}
              </div>

              {/* Pesan Sukses Ringkas */}
              {savedSuccessMessage && (
                <div className="p-2 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-[11px] font-semibold flex items-center gap-1.5 animate-fadeIn">
                  <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                  <span>{savedSuccessMessage}</span>
                </div>
              )}
            </div>
          )}
        </div>

      </div>

      {/* 2. TABEL OPERASIONAL: REKAP PRESENSI HARI INI & PERSETUJUAN PERIZINAN (Ukuran Tetap & Sempurna Simetris h-[450px]) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pt-1 items-stretch">
        
        {/* Kolom Kiri: Presensi Masuk Hari Ini */}
        <div className="bg-white rounded-[28px] border border-slate-200/90 p-6 shadow-xs flex flex-col h-[450px]">
          <div className="flex items-center justify-between pb-3.5 border-b border-slate-100 shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-blue-50 text-[#1E3A8A] flex items-center justify-center shrink-0 border border-blue-100/80">
                <UserCheck className="w-4 h-4" />
              </div>
              <h3 className="font-bold text-base text-slate-900">
                Presensi Masuk Hari Ini ({todayAttendance.length})
              </h3>
            </div>
            <button
              type="button"
              onClick={() => onNavigateTab('history')}
              className="text-xs font-bold text-[#1E3A8A] hover:text-[#172554] cursor-pointer"
            >
              Lihat Rekap &rarr;
            </button>
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto pr-1 space-y-2.5 custom-scrollbar pt-3">
            {todayAttendance.length === 0 ? (
              <div className="h-full min-h-[220px] flex flex-col items-center justify-center py-10 px-4 text-center text-slate-400 border border-dashed border-slate-200 rounded-2xl bg-slate-50/50 space-y-2">
                <Clock className="w-8 h-8 mx-auto text-slate-300" />
                <p className="text-xs font-semibold text-slate-600">Belum ada karyawan yang presensi masuk hari ini</p>
                <p className="text-[11px] text-slate-400">Data presensi akan otomatis masuk secara realtime saat staf melakukan presensi.</p>
              </div>
            ) : (
              todayAttendance.map((rec) => {
                return (
                  <div
                    key={rec.id}
                    onClick={() => setSelectedAttendanceDetail(rec)}
                    className="p-3.5 rounded-2xl border border-slate-200/80 bg-white shadow-2xs hover:border-slate-300 hover:shadow-xs transition-all text-xs flex items-center justify-between gap-3 min-h-[72px] cursor-pointer group/card"
                    title="Klik untuk melihat detail presensi masuk"
                  >
                    {/* Kiri: Avatar + Info Karyawan */}
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div
                        className="shrink-0 cursor-pointer group/prof"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSimpleProfilePopup({ name: rec.userName, avatar: rec.userAvatar });
                        }}
                        title="Lihat Foto Profil"
                      >
                        <img
                          src={rec.userAvatar}
                          alt={rec.userName}
                          className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl object-cover border border-slate-200 shrink-0 group-hover/prof:ring-2 group-hover/prof:ring-blue-300 transition-all"
                        />
                      </div>
                      <div className="min-w-0 flex-1">
                        {/* Baris 1: Nama Lengkap & Status Lokasi */}
                        <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
                          <p className="font-bold text-slate-900 text-xs sm:text-sm truncate group-hover/card:text-[#1E3A8A] transition-colors leading-snug">
                            {rec.userName}
                          </p>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border shrink-0 inline-flex items-center gap-1 ${
                            rec.clockInLocationStatus === 'OUT_OF_RANGE' || rec.workMode === 'WFH'
                              ? 'bg-amber-50 text-amber-800 border-amber-200'
                              : 'bg-emerald-50 text-emerald-800 border-emerald-200'
                          }`}>
                            {rec.clockInLocationStatus === 'OUT_OF_RANGE' || rec.workMode === 'WFH' ? (
                              <>
                                <MapPin className="w-3 h-3 text-amber-600" />
                                <span>Di Luar Kantor</span>
                              </>
                            ) : (
                              <>
                                <Building2 className="w-3 h-3 text-emerald-600" />
                                <span>Di Kantor</span>
                              </>
                            )}
                          </span>
                        </div>
                        {/* Baris 2: Jam Presensi Masuk */}
                        <div className="flex items-center gap-2 text-xs text-slate-500 font-normal mt-1 flex-wrap">
                          <span className="truncate">
                            Presensi Masuk: <span className="font-semibold text-slate-800">{rec.clockInTime} WIB</span>
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Kanan: Badge Status Kehadiran Presisi Pas di Tengah Kartu */}
                    <div className="shrink-0 my-auto self-center">
                      <span
                        className={`px-2.5 py-1 rounded-full text-[10px] sm:text-[11px] font-bold border inline-flex items-center gap-1.5 ${
                          rec.clockInStatus === 'LATE'
                            ? 'bg-[#FEF3C7] text-[#B45309] border-[#FDE68A]'
                            : 'bg-[#DCFCE7] text-[#15803D] border-[#86EFAC]'
                        }`}
                      >
                        {rec.clockInStatus === 'LATE' ? (
                          <>
                            <Clock className="w-3.5 h-3.5 text-[#B45309]" />
                            <span>Terlambat</span>
                          </>
                        ) : (
                          <>
                            <CheckCircle2 className="w-3.5 h-3.5 text-[#15803D]" />
                            <span>Tepat Waktu</span>
                          </>
                        )}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Kolom Kanan: Permohonan Perizinan Menunggu Approval (Ukuran Tetap h-[450px]) */}
        <div className="bg-white rounded-[28px] border border-slate-200/90 p-6 shadow-xs flex flex-col h-[450px]">
          <div className="flex items-center justify-between pb-3.5 border-b border-slate-100 shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-blue-50 text-[#1E3A8A] flex items-center justify-center shrink-0 border border-blue-100/80">
                <FileCheck className="w-4 h-4 text-[#1E3A8A]" />
              </div>
              <h3 className="font-bold text-base text-slate-900">
                Persetujuan Perizinan ({pendingLeaves.length})
              </h3>
            </div>
            <button
              type="button"
              onClick={() => onNavigateTab('leaves_approval')}
              className="text-xs font-bold text-[#1E3A8A] hover:text-[#172554] cursor-pointer"
            >
              Kelola Izin &rarr;
            </button>
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto pr-1 space-y-2.5 custom-scrollbar pt-3">
            {pendingLeaves.length === 0 ? (
              <div className="h-full min-h-[220px] flex flex-col items-center justify-center py-10 px-4 text-center text-slate-400 border border-dashed border-slate-200 rounded-2xl bg-slate-50/50 space-y-2">
                <FileCheck className="w-8 h-8 mx-auto text-slate-300" />
                <p className="text-xs font-semibold text-slate-600">
                  Tidak ada permohonan perizinan yang menunggu persetujuan
                </p>
                <p className="text-[11px] text-slate-400">Semua pengajuan cuti, sakit, dan WFH staf sudah ditinjau.</p>
              </div>
            ) : (
              pendingLeaves.map((leave) => {
                const formattedDate =
                  leave.startDate === leave.endDate
                    ? `${formatIndonesianDateShort(leave.startDate)} (${leave.totalDays} Hari)`
                    : `${formatIndonesianDateShort(leave.startDate)} - ${formatIndonesianDateShort(leave.endDate)} (${leave.totalDays} Hari)`;

                return (
                  <div
                    key={leave.id}
                    onClick={() => setSelectedLeaveDetail(leave)}
                    className="p-3.5 rounded-2xl border border-slate-200/80 bg-white shadow-2xs hover:border-slate-300 hover:shadow-xs transition-all text-xs flex items-center justify-between gap-3 min-h-[72px] cursor-pointer group/card"
                    title="Klik untuk melihat detail permohonan perizinan"
                  >
                    {/* Kiri: Avatar + Info Pemohon & Izin */}
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div
                        className="shrink-0 cursor-pointer group/prof"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSimpleProfilePopup({ name: leave.userName, avatar: leave.userAvatar });
                        }}
                        title="Lihat Foto Profil"
                      >
                        <img
                          src={leave.userAvatar}
                          alt={leave.userName}
                          className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl object-cover border border-slate-200 shrink-0 group-hover/prof:ring-2 group-hover/prof:ring-blue-300 transition-all"
                        />
                      </div>
                      <div className="min-w-0 flex-1">
                        {/* Baris 1: Nama Lengkap & Badge Kategori (WFH / Cuti / dll) di sebelah nama */}
                        <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
                          <p className="font-bold text-slate-900 text-xs sm:text-sm truncate group-hover/card:text-[#1E3A8A] transition-colors leading-snug">
                            {leave.userName}
                          </p>
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-full border shrink-0 ${
                              categoryBadgeColors[leave.category]
                            }`}
                          >
                            {categoryLabels[leave.category] || leave.category}
                          </span>
                        </div>
                        {/* Baris 2: Tanggal & Lampiran (Sejajar di Bawah) */}
                        <div className="flex items-center gap-2 text-xs text-slate-500 font-normal mt-1">
                          <span className="font-medium text-slate-600 truncate">{formattedDate}</span>
                          {leave.attachmentName && (
                            <span title={`Lampiran: ${leave.attachmentName}`} className="inline-flex items-center">
                              <Paperclip className="w-3.5 h-3.5 text-[#1E3A8A] shrink-0" />
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Kanan: Tombol Setuju & Tolak Icon Pastel Pas di Tengah Kartu */}
                    <div className="flex items-center gap-1.5 shrink-0 my-auto self-center" onClick={(e) => e.stopPropagation()}>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onApproveLeave(leave.id);
                        }}
                        className="w-8 h-8 rounded-xl bg-[#DCFCE7] hover:bg-[#BBF7D0] text-[#15803D] border border-[#86EFAC] font-bold transition-all cursor-pointer flex items-center justify-center shadow-2xs active:scale-95"
                        title="Setujui Permohonan"
                      >
                        <Check className="w-4 h-4 stroke-[2.5]" />
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setRejectDialog({
                            isOpen: true,
                            leaveId: leave.id,
                            userName: leave.userName,
                            reason: '',
                          });
                        }}
                        className="w-8 h-8 rounded-xl bg-[#FFE4E6] hover:bg-[#FECDD3] text-[#E11D48] border border-[#FDA4AF] font-bold transition-all cursor-pointer flex items-center justify-center active:scale-95 shadow-2xs"
                        title="Tolak Permohonan"
                      >
                        <X className="w-4 h-4 stroke-[2.5]" />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

      </div>

      {/* 3. CARD TUGAS SAYA & TIM (Desain Kartu & Tabel Detail) */}
      <div className="bg-white rounded-[28px] border border-slate-200/90 p-6 shadow-xs space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
          <div>
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-xl bg-blue-50 border border-blue-100 text-[#1E3A8A]">
                <ClipboardList className="w-4 h-4" />
              </div>
              <h2 className="text-base font-bold text-slate-900 tracking-tight">
                Tugas Saya &amp; Tim
              </h2>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Menampilkan 1 tugas terbaru dari tiap proses kerja tim &bull; Buka Kanban untuk seluruh tugas.
            </p>
          </div>

          <div className="flex items-center gap-2">
            {/* View Switcher: Kartu Grid vs Tabel Detail */}
            <div className="flex items-center p-1 bg-slate-100/80 rounded-xl border border-slate-200/80 text-xs font-semibold">
              <button
                type="button"
                onClick={() => setTaskViewMode('CARDS')}
                className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
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
                className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
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
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-slate-700 hover:text-[#1E3A8A] bg-slate-50 border border-slate-200 rounded-xl transition-colors cursor-pointer shrink-0"
            >
              <span>Buka Tugas Saya</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* TAMPILAN 1: 4 KOLOM PROSES (Hanya 1 Tugas Terbaru dari Tiap-Tiap Proses) */}
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
              const allColumnTasks = tasksState.filter((t) => t.status === col.id);
              const sortedTasks = [...allColumnTasks].sort((a, b) => {
                const dateA = a.updatedAt || a.createdAt || '';
                const dateB = b.updatedAt || b.createdAt || '';
                return dateB.localeCompare(dateA);
              });
              const displayedTasks = sortedTasks.slice(0, 1);

              return (
                <div key={col.id} className="flex flex-col space-y-3">
                  {/* Judul Proses & Angka Bersatu dalam 1 Container Ber-BG & Beradius */}
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
                        const isPIC = true; // Admin/Super Admin is always PIC

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
                            onClick={() => setSelectedTaskForDetail(task)}
                            className={`bg-white rounded-2xl p-5 border ${cardProcessBorder} shadow-2xs hover:shadow-md transition-all duration-200 cursor-pointer space-y-3.5 group`}
                          >
                            {/* Baris Atas: Priority Badge & 3 Dots Menu / Button Hapus jika Selesai */}
                            <div className="flex items-center justify-between gap-2">
                              <div>
                                {getPriorityBadge(task.priority)}
                              </div>

                              {task.status === 'REVIEWED' ? (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setConfirmModal({
                                      isOpen: true,
                                      title: 'Hapus Tugas',
                                      message: 'Apakah Anda yakin ingin menghapus tugas yang telah selesai ini?',
                                      variant: 'danger',
                                      confirmText: 'Ya, Hapus',
                                      cancelText: 'Batal',
                                      hideCancel: false,
                                      onConfirm: () => {
                                        AppStorage.deleteTask(task.id);
                                        setTasksState(AppStorage.getTasks());
                                        setConfirmModal((prev) => ({ ...prev, isOpen: false }));
                                      },
                                    });
                                  }}
                                  className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg cursor-pointer transition-colors"
                                  title="Hapus Tugas Selesai"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              ) : (
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
                              )}
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
                            {task.status === 'IN_PROGRESS' && task.reviewNotes && (
                              <div className="p-2.5 bg-rose-50 border border-rose-200/80 rounded-xl text-[11px] text-rose-800 space-y-1">
                                <div className="flex items-center gap-1.5 font-bold text-rose-900">
                                  <RotateCcw className="w-3 h-3 text-rose-600 shrink-0" />
                                  <span>Perlu Revisi dari PIC:</span>
                                </div>
                                <p className="line-clamp-2 text-rose-700 italic font-medium leading-relaxed">
                                  "{task.reviewNotes}"
                                </p>
                              </div>
                            )}

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
                              {/* 1. TO-DO: Mulai Kerjakan (Jika tugas ini ditugaskan ke admin/karyawan saat ini) */}
                              {task.status === 'TODO' && isMyTask && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleUpdateTaskStatus(task.id, 'IN_PROGRESS');
                                  }}
                                  className="w-full py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-200 font-bold rounded-xl text-center transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-2xs"
                                >
                                  <span>Mulai Kerjakan</span>
                                  <ArrowRight className="w-3.5 h-3.5" />
                                </button>
                              )}

                              {/* 2. IN_PROGRESS: Kirim Hasil Tugas (Jika tugas ini ditugaskan ke admin/karyawan saat ini) */}
                              {task.status === 'IN_PROGRESS' && isMyTask && (
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
                                  <span>Kirim Hasil Tugas</span>
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
                                        handleUpdateTaskStatus(task.id, 'REVIEWED', {
                                          reviewNotes: 'Penugasan Selesai (ACC oleh PIC)',
                                        });
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
                  {tasksState.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="py-10 text-center text-slate-400 font-medium">
                        Tidak ada data tugas yang tersedia.
                      </td>
                    </tr>
                  ) : (
                    tasksState.map((task) => {
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
                          onClick={() => setSelectedTaskForDetail(task)}
                          className="hover:bg-slate-50/80 transition-colors cursor-pointer group"
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
                          <td className="py-3 px-3.5 font-mono text-slate-700 text-xs whitespace-nowrap">
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

      {/* Detail View Karyawan Drawer */}
      <EmployeeDetailDrawer
        isOpen={!!selectedEmployee}
        onClose={() => setSelectedEmployee(null)}
        employee={selectedEmployee}
        currentUser={currentUser}
        attendanceHistory={attendanceRecords}
        dailyTasks={AppStorage.getDailyTasks()}
        onUpdateRole={onUpdateRole}
        onUpdateType={onUpdateType}
        onToggleStatus={onToggleStatus}
      />

      {/* Modal Tolak Izin */}
      {rejectDialog.isOpen && (
        <div
          className={`fixed inset-0 z-50 flex animate-in fade-in duration-200 ${
            isRejectModalFullScreen
              ? 'items-center justify-center p-0'
              : 'justify-end items-center p-2.5 sm:p-4 md:p-5'
          }`}
        >
          <div
            className="fixed inset-0 bg-slate-950/40 backdrop-blur-xs transition-opacity cursor-pointer"
            onClick={() => setRejectDialog({ isOpen: false, leaveId: '', userName: '', reason: '' })}
          />
          <div
            className={`relative z-10 bg-white shadow-2xl flex flex-col min-h-0 overflow-hidden transition-all duration-300 font-sans ${
              isRejectModalFullScreen
                ? 'w-full h-full max-w-none max-h-none rounded-none border-0'
                : 'w-full max-w-sm sm:max-w-md h-full max-h-[calc(100vh-1.25rem)] sm:max-h-[calc(100vh-2rem)] rounded-3xl border border-slate-200/80 animate-in slide-in-from-right duration-300 ease-out'
            }`}
          >
            <div className="px-6 py-5 border-b border-slate-100 bg-white flex items-center justify-between gap-3 shrink-0">
              <div className="flex items-center gap-3 min-w-0">
                {/* Zoom Button di pojok kiri atas */}
                <button
                  type="button"
                  onClick={() => setIsRejectModalFullScreen(!isRejectModalFullScreen)}
                  className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl border border-slate-200/80 transition-colors cursor-pointer shrink-0"
                  title={isRejectModalFullScreen ? "Perkecil Tampilan" : "Perbesar Layar Penuh"}
                >
                  {isRejectModalFullScreen ? (
                    <Minimize2 className="w-4 h-4 text-slate-600" />
                  ) : (
                    <Maximize2 className="w-4 h-4 text-slate-600" />
                  )}
                </button>
                <div>
                  <h3 className="font-bold text-base text-slate-900">
                    Tolak Permohonan Izin
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Karyawan: <strong className="text-slate-800 font-semibold">{rejectDialog.userName}</strong>
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setRejectDialog({ isOpen: false, leaveId: '', userName: '', reason: '' })}
                className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full border border-slate-200 transition-colors cursor-pointer shrink-0"
                title="Tutup"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-4 text-xs">
              <div>
                <label className="block text-slate-700 font-bold mb-1.5 text-xs">Alasan Penolakan Permohonan *</label>
                <textarea
                  rows={4}
                  value={rejectDialog.reason}
                  onChange={(e) => setRejectDialog({ ...rejectDialog, reason: e.target.value })}
                  placeholder="Berikan alasan penolakan yang jelas bagi karyawan..."
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-rose-500 resize-none"
                />
              </div>
            </div>

            <div className="px-6 py-4.5 border-t border-slate-100 bg-white flex items-center justify-between gap-3 shrink-0">
              <button
                type="button"
                onClick={() => setRejectDialog({ isOpen: false, leaveId: '', userName: '', reason: '' })}
                className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl text-xs cursor-pointer transition-colors"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={() => {
                  onRejectLeave(rejectDialog.leaveId, rejectDialog.reason || 'Ditolak');
                  setRejectDialog({ isOpen: false, leaveId: '', userName: '', reason: '' });
                }}
                className="px-6 py-2.5 bg-[#1E3A8A] hover:bg-[#172554] text-white font-bold rounded-xl text-xs shadow-xs cursor-pointer active:scale-95 transition-all"
              >
                Tolak Izin
              </button>
            </div>
          </div>
        </div>
      )}

      {selectedTaskForDetail && (
        <TaskDetailModal
          task={selectedTaskForDetail}
          onClose={() => setSelectedTaskForDetail(null)}
          currentUser={currentUser}
          users={users}
          onRefresh={() => setTasksState(AppStorage.getTasks())}
        />
      )}

      {/* MODAL RINCIAN PRESENSI MASUK HARI INI */}
      {selectedAttendanceDetail && (
        <div
          className={`fixed inset-0 z-50 flex animate-in fade-in duration-200 ${
            isAttendanceModalFullScreen
              ? 'items-center justify-center p-0'
              : 'items-center justify-center p-3 sm:p-5 md:p-6'
          }`}
        >
          <div
            className="fixed inset-0 bg-slate-950/40 backdrop-blur-xs transition-opacity cursor-pointer"
            onClick={() => setSelectedAttendanceDetail(null)}
          />
          <div
            className={`relative z-10 bg-white shadow-2xl flex flex-col min-h-0 overflow-hidden transition-all duration-300 font-sans ${
              isAttendanceModalFullScreen
                ? 'w-full h-full max-w-none max-h-none rounded-none border-0'
                : 'w-full max-w-xl max-h-[92vh] rounded-[28px] border border-slate-200/90 animate-in zoom-in-95 duration-200'
            }`}
          >
            {/* Modal Header */}
            <div className="px-5 sm:px-6 py-4.5 border-b border-slate-100 bg-white flex items-center justify-between gap-3 shrink-0">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-2xl bg-blue-50 text-[#1E3A8A] border border-blue-100 flex items-center justify-center shrink-0">
                  <UserCheck className="w-5 h-5 text-[#1E3A8A]" />
                </div>
                <div className="min-w-0">
                  <h3 className="font-bold text-slate-900 text-base sm:text-lg tracking-tight truncate">Rincian Presensi Masuk</h3>
                  <p className="text-xs text-slate-500 mt-0.5 truncate">Detail catatan presensi masuk staf hari ini</p>
                </div>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={() => setIsAttendanceModalFullScreen(!isAttendanceModalFullScreen)}
                  className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl border border-slate-200/80 transition-colors cursor-pointer"
                  title={isAttendanceModalFullScreen ? "Perkecil Tampilan" : "Perbesar Layar Penuh"}
                >
                  {isAttendanceModalFullScreen ? (
                    <Minimize2 className="w-4 h-4 text-slate-600" />
                  ) : (
                    <Maximize2 className="w-4 h-4 text-slate-600" />
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedAttendanceDetail(null)}
                  className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full border border-slate-200 transition-colors cursor-pointer"
                  title="Tutup"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Modal Content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4 text-xs sm:text-sm">
              {/* Profil Karyawan Card */}
              <div
                className="p-3.5 bg-slate-50 hover:bg-blue-50/50 rounded-2xl border border-slate-200 flex items-center justify-between gap-3 cursor-pointer group transition-colors"
                onClick={() => setSimpleProfilePopup({ name: selectedAttendanceDetail.userName, avatar: selectedAttendanceDetail.userAvatar })}
                title="Klik untuk melihat foto profil"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <img
                    src={selectedAttendanceDetail.userAvatar}
                    alt={selectedAttendanceDetail.userName}
                    className="w-12 h-12 rounded-xl object-cover border border-slate-200 group-hover:scale-105 transition-transform shrink-0"
                  />
                  <div className="min-w-0">
                    <p className="font-bold text-slate-900 text-sm group-hover:text-[#1E3A8A] transition-colors truncate">
                      {selectedAttendanceDetail.userName}
                    </p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {selectedAttendanceDetail.department || 'Divisi Tim'} &bull; {selectedAttendanceDetail.employmentType || 'Karyawan'}
                    </p>
                  </div>
                </div>
                <span className="text-[11px] font-semibold text-[#1E3A8A] bg-blue-50 px-2.5 py-1 rounded-lg border border-blue-200 shrink-0">
                  Lihat Profil
                </span>
              </div>

              {/* Grid Status & Waktu */}
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Jam Presensi Masuk</span>
                  <p className="font-bold text-slate-900 text-sm">{selectedAttendanceDetail.clockInTime} WIB</p>
                  <p className="text-[11px] text-slate-500">{formatIndonesianDate(selectedAttendanceDetail.date)}</p>
                </div>

                <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Status Ketepatan</span>
                  <div>
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-xs font-bold inline-flex items-center gap-1 border ${
                        selectedAttendanceDetail.clockInStatus === 'LATE'
                          ? 'bg-amber-50 text-amber-800 border-amber-200'
                          : 'bg-emerald-50 text-emerald-800 border-emerald-200'
                      }`}
                    >
                      {selectedAttendanceDetail.clockInStatus === 'LATE' ? (
                        <>
                          <Clock className="w-3 h-3 text-amber-600" />
                          <span>Terlambat {selectedAttendanceDetail.clockInLateMinutes > 0 ? `(${selectedAttendanceDetail.clockInLateMinutes} Menit)` : ''}</span>
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                          <span>Tepat Waktu</span>
                        </>
                      )}
                    </span>
                  </div>
                </div>
              </div>

              {/* Mode Kerja & Lokasi Geofence */}
              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Mode Kerja &amp; Lokasi</span>
                  <span className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-white text-slate-700 border border-slate-200">
                    {selectedAttendanceDetail.workMode === 'WFO' ? 'Bekerja di Kantor' : 'Work From Home (WFH)'}
                  </span>
                </div>
                <div className="text-xs text-slate-600 flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-slate-400 shrink-0" />
                  <span>
                    {selectedAttendanceDetail.clockInLocationStatus === 'IN_OFFICE'
                      ? 'Dalam Radius Geofence Kantor'
                      : selectedAttendanceDetail.workMode === 'WFH'
                      ? 'Lokasi WFH Terdaftar'
                      : 'Di Luar Radius Kantor'}
                    {selectedAttendanceDetail.clockInDistanceMeter > 0 && ` (${Math.round(selectedAttendanceDetail.clockInDistanceMeter)}m)`}
                  </span>
                </div>
              </div>

              {/* Bukti Foto Selfie Presensi Masuk (Jika Ada) */}
              {selectedAttendanceDetail.clockInPhoto && (
                <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Foto Bukti Presensi Masuk</span>
                    <span className="text-[10px] text-blue-600 font-medium">Klik untuk perbesar</span>
                  </div>
                  <div
                    onClick={() => setMediaPreview({
                      url: selectedAttendanceDetail.clockInPhoto!,
                      name: `Foto Bukti Presensi - ${selectedAttendanceDetail.userName}`,
                      type: 'FILE',
                      fileType: 'image/jpeg',
                    })}
                    className="rounded-xl overflow-hidden border border-slate-200 max-h-60 bg-black flex items-center justify-center cursor-pointer group relative"
                    title="Klik untuk melihat foto ukuran penuh"
                  >
                    <img
                      src={selectedAttendanceDetail.clockInPhoto}
                      alt={`Foto Bukti ${selectedAttendanceDetail.userName}`}
                      className="w-full h-full max-h-60 object-contain group-hover:scale-105 transition-transform"
                    />
                    <div className="absolute inset-0 bg-slate-950/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-xs font-bold gap-1">
                      <Maximize2 className="w-4 h-4 text-white" />
                      <span>Buka Foto Penuh</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Catatan Presensi Masuk (Jika Ada) */}
              {selectedAttendanceDetail.notes && (
                <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Catatan Tambahan</span>
                  <p className="text-slate-800 font-medium">"{selectedAttendanceDetail.notes}"</p>
                </div>
              )}
            </div>

            {/* Footer Modal */}
            <div className="px-5 sm:px-6 py-4 border-t border-slate-100 bg-white flex items-center justify-between gap-3 shrink-0 flex-wrap">
              <button
                type="button"
                onClick={() => setSelectedAttendanceDetail(null)}
                className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs sm:text-sm cursor-pointer transition-colors active:scale-95"
              >
                Tutup
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setReturnToAttendanceDetailOnClose(selectedAttendanceDetail);
                    setEditingAttendanceRecord(selectedAttendanceDetail);
                    setSelectedAttendanceDetail(null);
                  }}
                  className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs sm:text-sm cursor-pointer shadow-xs active:scale-95 transition-all inline-flex items-center gap-1.5"
                >
                  <Edit3 className="w-4 h-4" />
                  <span>Edit Status Presensi</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setSelectedAttendanceDetail(null);
                    onNavigateTab('history');
                  }}
                  className="px-4 py-2.5 bg-[#1E3A8A] hover:bg-[#172554] text-white font-bold rounded-xl text-xs sm:text-sm cursor-pointer shadow-xs active:scale-95 transition-all inline-flex items-center gap-1.5"
                >
                  <span>Buka Riwayat</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL RINCIAN PERSETUJUAN PERIZINAN */}
      {selectedLeaveDetail && (
        <div
          className={`fixed inset-0 z-50 flex animate-in fade-in duration-200 ${
            isLeaveModalFullScreen
              ? 'items-center justify-center p-0'
              : 'items-center justify-center p-3 sm:p-5 md:p-6'
          }`}
        >
          <div
            className="fixed inset-0 bg-slate-950/40 backdrop-blur-xs transition-opacity cursor-pointer"
            onClick={() => setSelectedLeaveDetail(null)}
          />
          <div
            className={`relative z-10 bg-white shadow-2xl flex flex-col min-h-0 overflow-hidden transition-all duration-300 font-sans ${
              isLeaveModalFullScreen
                ? 'w-full h-full max-w-none max-h-none rounded-none border-0'
                : 'w-full max-w-xl max-h-[92vh] rounded-[28px] border border-slate-200/90 animate-in zoom-in-95 duration-200'
            }`}
          >
            {/* Header Modal */}
            <div className="px-5 sm:px-6 py-4.5 border-b border-slate-100 bg-white flex items-center justify-between gap-3 shrink-0">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-700 border border-emerald-100 flex items-center justify-center shrink-0">
                  <FileCheck className="w-5 h-5 text-emerald-700" />
                </div>
                <div className="min-w-0">
                  <h3 className="font-bold text-slate-900 text-base sm:text-lg tracking-tight truncate">Rincian Permohonan Izin</h3>
                  <p className="text-xs text-slate-500 mt-0.5 truncate">Tinjau permohonan dan berikan keputusan</p>
                </div>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={() => setIsLeaveModalFullScreen(!isLeaveModalFullScreen)}
                  className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl border border-slate-200/80 transition-colors cursor-pointer"
                  title={isLeaveModalFullScreen ? "Perkecil Tampilan" : "Perbesar Layar Penuh"}
                >
                  {isLeaveModalFullScreen ? (
                    <Minimize2 className="w-4 h-4 text-slate-600" />
                  ) : (
                    <Maximize2 className="w-4 h-4 text-slate-600" />
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedLeaveDetail(null)}
                  className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full border border-slate-200 transition-colors cursor-pointer"
                  title="Tutup"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4 text-xs sm:text-sm">
              {/* Profil Pemohon */}
              <div
                className="p-3.5 bg-slate-50 hover:bg-blue-50/50 rounded-2xl border border-slate-200 flex items-center justify-between gap-3 cursor-pointer group transition-colors"
                onClick={() => setSimpleProfilePopup({ name: selectedLeaveDetail.userName, avatar: selectedLeaveDetail.userAvatar })}
                title="Klik untuk melihat foto profil"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <img
                    src={selectedLeaveDetail.userAvatar}
                    alt={selectedLeaveDetail.userName}
                    className="w-12 h-12 rounded-xl object-cover border border-slate-200 group-hover:scale-105 transition-transform shrink-0"
                  />
                  <div className="min-w-0">
                    <p className="font-bold text-slate-900 text-sm group-hover:text-[#1E3A8A] transition-colors truncate">
                      {selectedLeaveDetail.userName}
                    </p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {selectedLeaveDetail.department || 'Divisi Tim'} &bull; {selectedLeaveDetail.employmentType || 'Karyawan'}
                    </p>
                  </div>
                </div>
                <span className="text-[11px] font-semibold text-[#1E3A8A] bg-blue-50 px-2.5 py-1 rounded-lg border border-blue-200 shrink-0">
                  Lihat Profil
                </span>
              </div>

              {/* Grid Kategori & Status */}
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Kategori Izin</span>
                  <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold inline-block border ${categoryBadgeColors[selectedLeaveDetail.category]}`}>
                    {categoryLabels[selectedLeaveDetail.category] || selectedLeaveDetail.category}
                  </span>
                </div>

                <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Status Permohonan</span>
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-bold inline-flex items-center gap-1 bg-amber-50 text-amber-800 border border-amber-200">
                    <Clock className="w-3.5 h-3.5 text-amber-600" />
                    Menunggu Persetujuan
                  </span>
                </div>
              </div>

              {/* Periode & Durasi */}
              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Periode Tanggal &amp; Durasi</span>
                <p className="font-bold text-slate-900 text-sm">
                  {selectedLeaveDetail.startDate === selectedLeaveDetail.endDate
                    ? `${formatIndonesianDate(selectedLeaveDetail.startDate)} (Durasi ${selectedLeaveDetail.totalDays} Hari)`
                    : `${formatIndonesianDate(selectedLeaveDetail.startDate)} s/d ${formatIndonesianDate(selectedLeaveDetail.endDate)} (Total ${selectedLeaveDetail.totalDays} Hari)`}
                </p>
              </div>

              {/* Alasan Lengkap */}
              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Alasan Pengajuan Lengkap</span>
                <p className="text-slate-800 font-medium leading-relaxed">"{selectedLeaveDetail.reason}"</p>
              </div>

              {/* Lampiran Surat / Bukti */}
              {selectedLeaveDetail.attachmentName && (
                <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Lampiran Dokumen Surat</span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      const pdfSource = selectedLeaveDetail.attachmentData;
                      if (pdfSource) {
                        openAttachmentDirectly({
                          url: pdfSource,
                          name: selectedLeaveDetail.attachmentName,
                          type: 'FILE',
                        });
                      }
                    }}
                    className="inline-flex items-center gap-2 text-xs font-bold text-[#1E3A8A] hover:text-[#172554] hover:underline cursor-pointer group"
                  >
                    <Paperclip className="w-3.5 h-3.5 text-[#1E3A8A] group-hover:scale-110 transition-transform" />
                    <span>{selectedLeaveDetail.attachmentName}</span>
                    <ExternalLink className="w-3.5 h-3.5 text-[#1E3A8A]/70 group-hover:text-[#1E3A8A]" />
                  </button>
                </div>
              )}
            </div>

            {/* Footer Modal: Tombol Aksi */}
            <div className="px-6 py-4.5 border-t border-slate-100 bg-white flex items-center justify-end gap-3 shrink-0">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const lId = selectedLeaveDetail.id;
                    const uName = selectedLeaveDetail.userName;
                    setSelectedLeaveDetail(null);
                    setRejectDialog({
                      isOpen: true,
                      leaveId: lId,
                      userName: uName,
                      reason: '',
                    });
                  }}
                  className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-[#FFE4E6] hover:bg-[#FECDD3] text-[#E11D48] border border-[#FDA4AF] font-bold rounded-xl text-xs transition-colors cursor-pointer active:scale-95 shadow-2xs"
                >
                  <X className="w-4 h-4 stroke-[2.5]" />
                  <span>Tolak Permohonan</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onApproveLeave(selectedLeaveDetail.id);
                    setSelectedLeaveDetail(null);
                  }}
                  className="inline-flex items-center gap-1.5 px-5 py-2.5 bg-[#DCFCE7] hover:bg-[#BBF7D0] text-[#15803D] border border-[#86EFAC] font-bold rounded-xl text-xs transition-colors cursor-pointer shadow-2xs active:scale-95"
                >
                  <Check className="w-4 h-4 stroke-[2.5]" />
                  <span>Setujui Permohonan</span>
                </button>
              </div>
            </div>
          </div>
        </div>
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

      {/* Pop Up Profil Singkat (Nama & Foto Orang) */}
      <SimpleProfileModal
        isOpen={!!simpleProfilePopup}
        onClose={() => setSimpleProfilePopup(null)}
        profile={simpleProfilePopup}
      />

      {/* Modal Pratinjau Berkas, Gambar, dan Foto Presensi */}
      <MediaPreviewModal
        media={mediaPreview}
        onClose={() => setMediaPreview(null)}
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
          setChatTopics((prev) => prev.map((t) => (t.id === updatedTopic.id ? updatedTopic : t)));
        }}
      />

      {/* Modal Edit Status Presensi & Lokasi (Admin) */}
      {editingAttendanceRecord && (
        <EditAttendanceModal
          isOpen={!!editingAttendanceRecord}
          record={editingAttendanceRecord}
          onClose={() => {
            setEditingAttendanceRecord(null);
            if (returnToAttendanceDetailOnClose) {
              setSelectedAttendanceDetail(returnToAttendanceDetailOnClose);
              setReturnToAttendanceDetailOnClose(null);
            }
          }}
          onSave={(updated) => {
            if (onUpdateAttendanceRecord) {
              onUpdateAttendanceRecord(updated);
            } else {
              AppStorage.saveAttendanceRecord(updated);
            }
            setEditingAttendanceRecord(null);
            if (returnToAttendanceDetailOnClose) {
              setSelectedAttendanceDetail(updated);
              setReturnToAttendanceDetailOnClose(null);
            }
          }}
        />
      )}
    </div>
  );
}
