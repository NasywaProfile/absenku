import React, { useState, useEffect, useMemo } from 'react';
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
  MessageSquare,
  ArrowLeftRight,
} from 'lucide-react';
import { User, OfficeConfig, AttendanceRecord, LeaveRequest, TaskItem, TaskStatus, TaskPriority, getPriorityLabel, ChatTopic } from '../../types/index.ts';
import { AppStorage } from '../../lib/storage.ts';
import { getCurrentDateString, formatIndonesianDate } from '../../lib/time-utils.ts';
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
  onOpenClockModal: (type: 'CLOCK_IN' | 'CLOCK_OUT') => void;
  onNavigateTab: (tabId: string) => void;
  onSwitchUser?: (userId: string) => void;
  onResetTodayAttendance?: () => void;
}

export function NeoBrutalistDashboard({
  currentUser,
  users = [currentUser],
  todayRecord,
  tasks: propTasks,
  onOpenClockModal,
  onNavigateTab,
}: NeoBrutalistDashboardProps) {
  // Mode tampilan Tugas Saya: 'CARDS' | 'TABLE'
  const [taskViewMode, setTaskViewMode] = useState<'CARDS' | 'TABLE'>('CARDS');
  const [selectedTaskForDetail, setSelectedTaskForDetail] = useState<TaskItem | null>(null);
  const [selectedChatTopic, setSelectedChatTopic] = useState<ChatTopic | null>(null);

  // Sekilas Ruang Obrolan (Hanya topik yang relevan untuk pengguna jika bukan Admin)
  const chatTopics = useMemo(() => {
    const allTopics = AppStorage.getChatTopics();
    if (currentUser.role === 'ADMIN' || currentUser.role === 'SUPER_ADMIN') {
      return allTopics;
    }
    const currentNameLower = currentUser.name.toLowerCase();
    const currentFirstName = currentUser.name.split(' ')[0].toLowerCase();
    return allTopics.filter((t) => {
      const isCreator = t.createdBy === currentUser.id;
      const isTagged = Boolean(t.taggedTeammateIds?.includes(currentUser.id));
      const isMentioned = Boolean(
        t.comments?.some((c) => {
          const notesLower = (c.notes || '').toLowerCase();
          const mentionsMatch = c.mentions?.some((m) => {
            const mLower = m.toLowerCase();
            return (
              mLower === currentUser.id.toLowerCase() ||
              mLower === currentNameLower ||
              mLower === currentFirstName ||
              currentNameLower.includes(mLower)
            );
          });
          const textMention =
            notesLower.includes(`@${currentNameLower}`) ||
            notesLower.includes(`@${currentFirstName}`);
          return mentionsMatch || textMention;
        })
      );
      return isCreator || isTagged || isMentioned;
    });
  }, [currentUser]);

  // Calendar & Logbook state
  const todayDateStr = getCurrentDateString();
  const [calendarDate, setCalendarDate] = useState(() => new Date());
  const [selectedDate, setSelectedDate] = useState<string>(todayDateStr);
  const [logbookText, setLogbookText] = useState('');
  const [isExistingLog, setIsExistingLog] = useState(false);
  const [savedSuccessMessage, setSavedSuccessMessage] = useState<string | null>(null);
  const [dataVersion, setDataVersion] = useState(0);



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
    return AppStorage.getAttendanceRecords().filter((r) => r.userId === currentUser.id);
  }, [currentUser.id, dataVersion, todayRecord]);

  const allDailyTasks = useMemo(() => {
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
  }, [selectedDate, currentUser.id, allAttendance, dataVersion]);

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
            <div className="flex items-center justify-between pb-3.5 mb-4 border-b border-slate-100 min-h-[44px]">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-blue-50 border border-blue-100 text-[#1E3A8A] flex items-center justify-center shrink-0">
                  <Calendar className="w-4 h-4" />
                </div>
                <h2 className="text-base font-bold text-slate-900 tracking-tight">
                  Kalender Presensi
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

                  const att = allAttendance.find((a: AttendanceRecord) => a.date === dateStr);
                  const log = allDailyTasks.find((t: any) => t.date === dateStr);
                  const hasAtt = !!att;
                  const hasLog = (log?.tasks && log.tasks.length > 0) || (att?.tasksDoneSummary && att.tasksDoneSummary.length > 0);
                  const isPendingLog = hasAtt && !hasLog;

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

                      {/* Penanda Kehadiran & Logbook */}
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
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Legend / Keterangan Penanda Singkat */}
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

            {/* Indicator / Status Bawah Presensi */}
            <div className="pt-3">
              {todayRecord?.clockInTime ? (
                <div className="w-full py-2.5 px-4 bg-emerald-50 border border-emerald-200 text-emerald-800 text-center text-xs font-semibold rounded-2xl flex items-center justify-center gap-2 shadow-2xs">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>Presensi Masuk Tercatat Hari Ini ({todayRecord.clockInTime} WIB)</span>
                </div>
              ) : (
                <Tooltip content="Buka modal presensi untuk presensi masuk kantor hari ini" position="top" className="w-full">
                  <button
                    type="button"
                    onClick={() => onOpenClockModal('CLOCK_IN')}
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
              {isExistingLog && (
                <span className="text-[10px] font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100">
                  Tersimpan
                </span>
              )}
            </div>

            <textarea
              id="logbook-textarea"
              value={logbookText}
              onChange={(e) => setLogbookText(e.target.value)}
              placeholder="Tulis ringkasan aktivitas / tugas pekerjaan Anda untuk tanggal terpilih..."
              className="w-full h-24 p-3 text-xs bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-[#1E3A8A] focus:border-transparent resize-none transition-all outline-none"
            />

            <div className="space-y-2 mt-3">
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
            <p className="text-xs text-slate-500 mt-0.5">
              Kelola tugas pribadi, pengerjaan harian (Today's), dan tinjau detail aktivitas tim.
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
                              {/* 1. TO-DO: Mulai Kerjakan */}
                              {task.status === 'TODO' && (
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
