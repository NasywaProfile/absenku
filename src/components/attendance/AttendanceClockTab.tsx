import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  Trash2,
  Check,
  Clock,
  ShieldCheck,
  Eye,
  Users,
  AlertCircle,
  AlertTriangle,
  MapPin,
  CalendarDays,
  PenLine,
} from 'lucide-react';
import { AttendanceRecord, OfficeConfig, User, WorkMode } from '../../types/index.ts';
import { GeolocationWidget } from './GeolocationWidget.tsx';
import { Coordinates } from '../../lib/geo-utils.ts';
import {
  calculateClockInPunctuality,
  getCurrentDateString,
  getCurrentTimeString,
  formatIndonesianDate,
} from '../../lib/time-utils.ts';
import { AppStorage } from '../../lib/storage.ts';
import {
  getApprovedLeaveForDate,
  isOffCategory,
  getDailyStatus,
  getCalendarCell,
} from '../../lib/attendance-status.ts';
import { Tooltip } from '../ui/tooltip.tsx';
import { ModernConfirmDialog } from '../common/ModernConfirmDialog.tsx';

interface AttendanceClockTabProps {
  currentUser: User;
  officeConfig: OfficeConfig;
  todayRecord?: AttendanceRecord | null;
  onRefreshData: () => void;
}

export function AttendanceClockTab({
  currentUser,
  officeConfig,
  todayRecord,
  onRefreshData,
}: AttendanceClockTabProps) {
  if (currentUser.role === 'SUPER_ADMIN') {
    return (
      <div className="max-w-4xl mx-auto space-y-6 py-4 sm:py-6 font-sans antialiased">
        <div className="bg-gradient-to-br from-[#1E3A8A] via-indigo-950 to-slate-900 rounded-3xl p-6 sm:p-8 text-white shadow-xl border border-indigo-500/20">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
            <div className="flex items-start gap-4">
              <div className="w-14 h-14 rounded-2xl bg-amber-400/20 border border-amber-400/30 flex items-center justify-center shrink-0 text-amber-300 shadow-md">
                <ShieldCheck className="w-7 h-7" />
              </div>
              <div className="space-y-1.5">
                <span className="px-3 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-amber-400/20 text-amber-300 border border-amber-400/30 inline-block">
                  Akses Direksi / Super Admin
                </span>
                <h2 className="text-lg sm:text-2xl font-extrabold text-white tracking-tight">
                  Mode Pengawasan Direksi (Bebas Absen)
                </h2>
                <p className="text-xs sm:text-sm text-slate-300 leading-relaxed max-w-xl">
                  Sebagai Super Admin, akun Anda memiliki wewenang tertinggi untuk memantau kehadiran dan kinerja seluruh tim tanpa diwajibkan melakukan presensi harian.
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-3xl border border-slate-200/90 shadow-sm p-6 space-y-4">
          <div className="flex items-center gap-3 pb-3 border-b border-slate-100">
            <div className="p-2.5 rounded-xl bg-blue-50 text-[#1E3A8A]">
              <Eye className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-sm">Fungsi Pemantauan Super Admin</h3>
              <p className="text-xs text-slate-500">Gunakan menu navigasi untuk memantau data operasional kantor</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs pt-1">
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-2">
              <div className="font-bold text-slate-800 flex items-center gap-2">
                <Clock className="w-4 h-4 text-indigo-600" />
                <span>Rekap Presensi Seluruh Staf</span>
              </div>
              <p className="text-slate-500 text-[11px] leading-relaxed">
                Pantau log kedatangan, lokasi GPS, selfie presensi, dan keterlambatan staf di menu <strong>Rekap Presensi</strong>.
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-2">
              <div className="font-bold text-slate-800 flex items-center gap-2">
                <Users className="w-4 h-4 text-[#1E3A8A]" />
                <span>Kelola &amp; Terbitkan Tugas Tim</span>
              </div>
              <p className="text-slate-500 text-[11px] leading-relaxed">
                Super Admin dapat menerbitkan tugas ke anggota tim dan menyetujui hasil kerja di menu <strong>Memberikan Tugas</strong>.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const [currentCoords, setCurrentCoords] = useState<Coordinates | null>(null);
  const [distanceMeters, setDistanceMeters] = useState<number | null>(null);
  const [isWithinRadius, setIsWithinRadius] = useState<boolean>(false);
  const [workMode, setWorkMode] = useState<WorkMode>('WFO');
  const [clockInNotes, setClockInNotes] = useState('');
  const [isEditingLateReason, setIsEditingLateReason] = useState(false);
  const [editReasonText, setEditReasonText] = useState('');

  // Calendar State (Exact same as Beranda Kalender Presensi)
  const todayDateStr = getCurrentDateString();
  const [calendarDate, setCalendarDate] = useState(() => new Date());
  const [selectedDate, setSelectedDate] = useState<string>(todayDateStr);

  // Single Simple Text Box for Logbook
  const [logbookText, setLogbookText] = useState('');
  const [isExistingLog, setIsExistingLog] = useState(false);
  const [savedSuccessMessage, setSavedSuccessMessage] = useState<string | null>(null);

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

  // Sync / refresh triggers
  const [dataVersion, setDataVersion] = useState(0);

  const calYear = calendarDate.getFullYear();
  const calMonth = calendarDate.getMonth();
  const currentMonthName = new Intl.DateTimeFormat('id-ID', {
    month: 'long',
    year: 'numeric',
  }).format(calendarDate);

  const firstDayOfWeek = new Date(calYear, calMonth, 1).getDay(); // 0 = Minggu (Min)
  const totalDaysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
  const todayDateNum = new Date().getDate();
  const isCurrentMonthAndYear =
    new Date().getMonth() === calMonth && new Date().getFullYear() === calYear;

  const isClockedIn = !!todayRecord;

  // Load all attendance and daily tasks for calendar markers
  const allAttendance = useMemo(() => {
    return AppStorage.getAttendanceRecords().filter((r) => r.userId === currentUser.id);
  }, [currentUser.id, dataVersion, todayRecord]);

  const allDailyTasks = useMemo(() => {
    return AppStorage.getDailyTasks().filter((t) => t.userId === currentUser.id);
  }, [currentUser.id, dataVersion]);

  const loadedDateRef = useRef<string | null>(null);

  // When selectedDate changes, load existing logbook into the single text box
  useEffect(() => {
    if (loadedDateRef.current === selectedDate) {
      return;
    }
    loadedDateRef.current = selectedDate;

    const existingLog = AppStorage.getDailyTaskForDate(currentUser.id, selectedDate);
    if (existingLog && ((existingLog.tasks && existingLog.tasks.length > 0) || existingLog.notes)) {
      const text = existingLog.tasks && existingLog.tasks.length > 0
        ? existingLog.tasks.join('\n')
        : existingLog.notes || '';
      setLogbookText(text);
      setIsExistingLog(true);
    } else {
      // Check if attendance record on that date had tasks summary
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

  const handleLocationUpdate = (coords: Coordinates, dist: number, within: boolean) => {
    setCurrentCoords(coords);
    setDistanceMeters(dist);
    setIsWithinRadius(within);
  };

  // Perizinan disetujui hari ini (prioritas: Sakit > Cuti/Izin > Dinas Luar > WFH)
  const userLeaves = useMemo(() => AppStorage.getLeaveRequests(), [dataVersion]);
  const todayApprovedLeave = useMemo(
    () =>
      getApprovedLeaveForDate(
        userLeaves,
        { id: currentUser.id, name: currentUser.name },
        todayDateStr
      ),
    [userLeaves, currentUser, todayDateStr]
  );
  const isWfhApproved = todayApprovedLeave?.category === 'WFH';
  const isBusinessTripApproved = todayApprovedLeave?.category === 'BUSINESS_TRIP';
  // Cuti/Izin & Sakit = OFF & bebas presensi. WFH & Dinas Luar tetap wajib presensi.
  const isOffToday = Boolean(todayApprovedLeave && isOffCategory(todayApprovedLeave.category));
  const hasRemoteApproval = isWfhApproved || isBusinessTripApproved;
  const isFreelance = currentUser.employmentType === 'FREELANCE';
  const effectiveWorkMode = isBusinessTripApproved
    ? 'DINAS'
    : isWfhApproved
    ? 'WFH'
    : isFreelance
    ? (isWithinRadius ? 'WFO' : 'WFH')
    : workMode;

  const currentPunctuality = calculateClockInPunctuality(
    getCurrentTimeString(),
    officeConfig.workStartHour || '08:00',
    officeConfig.gracePeriodMinutes || 0
  );
  const isCurrentlyLate = currentPunctuality.status === 'LATE';

  const handleClockIn = () => {
    if (isOffToday) {
      return;
    }
    if (!currentCoords) {
      setConfirmModal({
        isOpen: true,
        title: 'Sinyal GPS Belum Terdeteksi',
        message: 'Presensi wajib menggunakan koordinat GPS nyata dari perangkat Anda. Aktifkan izin lokasi browser lalu klik Segarkan GPS.',
        variant: 'warning',
        confirmText: 'Mengerti',
        hideCancel: true,
        onConfirm: () => setConfirmModal((prev) => ({ ...prev, isOpen: false })),
      });
      return;
    }
    const today = getCurrentDateString();
    const time = getCurrentTimeString();
    const punctuality = calculateClockInPunctuality(
      time,
      officeConfig.workStartHour || '08:00',
      officeConfig.gracePeriodMinutes || 0
    );
    const isLate = punctuality.status === 'LATE';
    const isFreelance = currentUser.employmentType === 'FREELANCE';
    const effectiveWorkMode = isBusinessTripApproved
      ? 'DINAS'
      : isWfhApproved
      ? 'WFH'
      : isFreelance
      ? (isWithinRadius ? 'WFO' : 'WFH')
      : workMode;
    const locationStatus = isBusinessTripApproved
      ? 'DINAS_APPROVED'
      : isWfhApproved
      ? 'WFH_APPROVED'
      : isWithinRadius
      ? 'IN_OFFICE'
      : isFreelance
      ? 'WFH_APPROVED'
      : 'OUT_OF_RANGE';

    const newRecord: AttendanceRecord = {
      id: `att_${Date.now()}`,
      userId: currentUser.id,
      userName: currentUser.name,
      userAvatar: currentUser.avatar,
      department: currentUser.department,
      employmentType: currentUser.employmentType,
      date: today,
      clockInTime: time,
      clockInLat: currentCoords.latitude,
      clockInLng: currentCoords.longitude,
      clockInDistanceMeter: distanceMeters !== null ? distanceMeters : 0,
      clockInLocationStatus: locationStatus,
      clockInStatus: isLate ? 'LATE' : 'ON_TIME',
      clockInLateMinutes: isLate ? punctuality.lateMinutes : 0,
      workMode: effectiveWorkMode,
      notes: clockInNotes.trim() || undefined,
      syncStatus: 'SYNCED',
    };

    AppStorage.recordClockIn(newRecord);
    setDataVersion((v) => v + 1);
    onRefreshData();
  };

  // Tampilkan feedback apabila server menolak catatan presensi (mis. duplikat 409 / GPS tidak valid 422)
  useEffect(() => {
    const onAttendanceErr = (e: Event) => {
      const msg = (e as CustomEvent<{ message?: string }>)?.detail?.message;
      if (msg) {
        setConfirmModal({
          isOpen: true,
          title: 'Validasi Presensi Server',
          message: msg,
          variant: 'warning',
          confirmText: 'Mengerti',
          hideCancel: true,
          onConfirm: () => setConfirmModal((prev) => ({ ...prev, isOpen: false })),
        });
        setDataVersion((v) => v + 1);
        onRefreshData();
      }
    };
    window.addEventListener('absenku:attendance_error', onAttendanceErr);
    return () => window.removeEventListener('absenku:attendance_error', onAttendanceErr);
  }, [onRefreshData]);

  // Auto-detect pergantian hari (setelah lewat 23:59:59) agar absensi otomatis ter-reset untuk hari baru
  useEffect(() => {
    let lastKnownDate = getCurrentDateString();
    const interval = setInterval(() => {
      const nowFormatted = getCurrentDateString();
      if (nowFormatted !== lastKnownDate) {
        lastKnownDate = nowFormatted;
        setSelectedDate(nowFormatted);
        onRefreshData(); // Hari baru dimulai, absensi otomatis ter-reset setelah 23.59
      }
    }, 5000);
    return () => clearInterval(interval);
  }, [onRefreshData]);

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
    onRefreshData();

    setSavedSuccessMessage(`Logbook tersimpan di tanggal ini!`);
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
        onRefreshData();
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

  // Selected date info
  const selectedAttRecord = allAttendance.find((a) => a.date === selectedDate);
  const isSelectedDateToday = selectedDate === todayDateStr;

  return (
    <div className="w-full space-y-6 font-sans pb-8">
      {/* 2-Column Grid: Kalender Presensi di sebelah KIRI, Status Geofence Radar di sebelah KANAN */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">
        
        {/* CARD KIRI: KALENDER PRESENSI (Desain Sama Persis seperti di Beranda) */}
        <div className="bg-white rounded-[28px] border border-slate-200/90 p-6 shadow-xs flex flex-col justify-between h-full">
          <div>
            {/* Header Kalender */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 sm:gap-2 pb-3.5 mb-4 border-b border-slate-100 min-h-[44px]">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-8 h-8 rounded-xl bg-blue-50 border border-blue-100 text-[#1E3A8A] flex items-center justify-center shrink-0">
                  <CalendarIcon className="w-4 h-4" />
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

            {/* Minimalist Grid Calendar (Sama persis dengan Beranda) */}
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

                  const att = allAttendance.find((a) => a.date === dateStr);
                  const log = allDailyTasks.find((t) => t.date === dateStr);
                  const dayStatus = getDailyStatus({
                    user: { id: currentUser.id, name: currentUser.name },
                    date: dateStr,
                    records: allAttendance,
                    leaves: userLeaves,
                    today: todayDateStr,
                  });
                  const dayCell = getCalendarCell(dayStatus);
                  const hasAtt = !!att;
                  const hasLog =
                    (log?.tasks && log.tasks.length > 0) ||
                    (att?.tasksDoneSummary && att.tasksDoneSummary.length > 0);
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
                      title={`${formatIndonesianDate(dateStr)} • ${statusLabel}`}
                      className={`py-1.5 rounded-xl font-bold transition-all relative flex flex-col items-center justify-center cursor-pointer border ${bgClass} ${borderClass} ${textClass} ${
                        isSelected
                          ? isWeekend
                            ? 'ring-2 ring-red-500 ring-offset-2 shadow-sm scale-105 z-10'
                            : 'ring-2 ring-[#1E3A8A] ring-offset-2 shadow-sm scale-105 z-10'
                          : 'hover:brightness-95 hover:scale-[1.02]'
                      }`}
                    >
                      <span>{day}</span>

                      {/* Penanda Logbook */}
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

            {/* Button Absen Masuk di Bawah Kalender Presensi (Navy Blue #1E3A8A) */}
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
                    <span>
                      {todayApprovedLeave?.category === 'SICK'
                        ? 'Izin Sakit Disetujui • Bebas Absen'
                        : 'Izin / Cuti Disetujui • Bebas Absen'}
                    </span>
                  </button>
                </Tooltip>
              ) : isClockedIn && todayRecord ? (
                (() => {
                  const isWfh = isWfhApproved || todayRecord.workMode === 'WFH' || todayRecord.clockInLocationStatus === 'WFH_APPROVED';
                  const isDinas = isBusinessTripApproved || todayRecord.workMode === 'DINAS' || todayRecord.clockInLocationStatus === 'DINAS_APPROVED';

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
                    ? 'Dari Rumah'
                    : isDinas
                    ? 'Dinas Luar'
                    : todayRecord.clockInLocationStatus === 'OUT_OF_RANGE'
                    ? 'Di Luar Kantor'
                    : 'Area Kantor';

                  let badgeIcon = <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />;
                  let badgeBg = 'bg-emerald-100/90 text-emerald-800 border-emerald-300';
                  let badgeText = 'Hadir WFO';

                  if (isLate) {
                    badgeIcon = <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />;
                    badgeBg = 'bg-amber-100/90 text-amber-800 border-amber-300';
                    if (isWfh) {
                      badgeText = lateMin > 0 ? `WFH • Terlambat (${lateMin}m)` : 'WFH • Terlambat';
                    } else if (isDinas) {
                      badgeText = lateMin > 0 ? `Dinas Luar • Terlambat (${lateMin}m)` : 'Dinas Luar • Terlambat';
                    } else {
                      badgeText = lateMin > 0 ? `Terlambat (${lateMin}m)` : 'Terlambat';
                    }
                  } else if (isWfh) {
                    badgeIcon = <CheckCircle2 className="w-3.5 h-3.5 text-indigo-600 shrink-0" />;
                    badgeBg = 'bg-indigo-100/90 text-indigo-800 border-indigo-300';
                    badgeText = 'WFH';
                  } else if (isDinas) {
                    badgeIcon = <CheckCircle2 className="w-3.5 h-3.5 text-purple-600 shrink-0" />;
                    badgeBg = 'bg-purple-100/90 text-purple-800 border-purple-300';
                    badgeText = 'Dinas Luar';
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
                              onClick={() => {
                                const trimmed = editReasonText.trim();
                                const updated: AttendanceRecord = {
                                  ...todayRecord,
                                  notes: trimmed || undefined,
                                };
                                AppStorage.saveAttendanceRecord(updated);
                                setDataVersion((v) => v + 1);
                                onRefreshData();
                                setIsEditingLateReason(false);
                              }}
                              className="px-3 py-1 bg-[#1E3A8A] hover:bg-[#172554] text-white text-[11px] font-bold rounded-lg shadow-2xs transition-colors cursor-pointer"
                            >
                              Simpan Alasan
                            </button>
                          </div>
                        </div>
                      ) : todayRecord.notes ? (
                        <div className="mt-2.5 pt-2 border-t border-slate-200/60 text-[11px] text-slate-600 flex items-start justify-between gap-2 text-left">
                          <div className="flex items-start gap-1.5 flex-1 min-w-0">
                            <span className="font-semibold text-slate-700 shrink-0">
                              {todayRecord.clockInStatus === 'LATE' ? 'Alasan Terlambat:' : 'Catatan Presensi:'}
                            </span>
                            <span className="italic text-slate-800 break-words">"{todayRecord.notes}"</span>
                          </div>
                          {todayRecord.clockInStatus === 'LATE' && (
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
                      ) : todayRecord.clockInStatus === 'LATE' ? (
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
                <div className="w-full space-y-2.5">
                  {/* Input Alasan Keterlambatan (Opsional saat terdeteksi terlambat) */}
                  {isCurrentlyLate && (
                    <div className="w-full p-3 bg-amber-50/80 border border-amber-200/90 rounded-2xl space-y-1.5 text-left animate-in fade-in duration-200 shadow-2xs">
                      <div className="flex items-center justify-between">
                        <label className="text-[11px] font-semibold text-amber-950 flex items-center gap-1.5">
                          <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                          <span>Alasan Keterlambatan ({currentPunctuality.remarks})</span>
                        </label>
                        <span className="text-[10px] text-amber-700 font-medium bg-amber-100 px-2 py-0.5 rounded-full border border-amber-200/80">
                          Opsional
                        </span>
                      </div>
                      <textarea
                        value={clockInNotes}
                        onChange={(e) => setClockInNotes(e.target.value)}
                        placeholder="Tulis alasan terlambat jika ada (misal: terjebak macet, kendala kendaraan, dll)..."
                        rows={2}
                        maxLength={300}
                        className="w-full text-xs p-2.5 bg-white border border-amber-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-400 placeholder:text-slate-400 text-slate-800 transition-all resize-none leading-relaxed"
                      />
                    </div>
                  )}

                  <Tooltip content="Catat presensi kehadiran masuk kerja hari ini dengan verifikasi GPS" position="top" className="w-full">
                    <button
                      type="button"
                      onClick={handleClockIn}
                      className="w-full py-3 px-4 bg-[#1E3A8A] hover:bg-[#172554] active:scale-[0.98] text-white text-xs font-bold rounded-2xl shadow-sm border border-[#1E3A8A] transition-all flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <Clock className="w-4 h-4 text-white" />
                      <span>Presensi Masuk Sekarang</span>
                    </button>
                  </Tooltip>
                </div>
              )}
            </div>
          </div>

          {/* BAGIAN LOGBOOK SIMPEL: 1 Text Box Saja dengan Tombol Simpan Perubahan (Indigo) & Hapus di Kanan */}
          <div className="pt-4 mt-4 border-t border-slate-100 space-y-2.5">
            {/* Header Tanggal Terpilih (Tanpa badge Hari Ini dan tanpa badge Hadir) */}
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-slate-800">
                Logbook {formatIndonesianDate(selectedDate)}
              </span>
            </div>

            {/* Satu Text Box Simpel Saja (Tersimpan Langsung di Sini Tanpa Makan Tempat) */}
            <textarea
              rows={3}
              value={logbookText}
              onChange={(e) => setLogbookText(e.target.value)}
              placeholder="Tulis apa yang dikerjakan pada tanggal ini..."
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-indigo-400 focus:bg-white transition-all resize-none shadow-2xs placeholder:text-slate-400"
            />

            {/* Tombol Aksi Logbook: Sama Ukuran & Tanpa Space Kosong */}
            <div className="pt-1 w-full">
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

            {/* Pesan Sukses Ringkas */}
            {savedSuccessMessage && (
              <div className="p-2 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-[11px] font-semibold flex items-center gap-1.5 animate-fadeIn">
                <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                <span>{savedSuccessMessage}</span>
              </div>
            )}
          </div>
        </div>

        {/* CARD KANAN: STATUS GEOFENCE RADAR (Mengisi 100% tinggi penuh sama dengan Kalender) */}
        <div className="h-full flex flex-col min-h-[460px] sm:min-h-[500px] lg:min-h-0">
          <GeolocationWidget
            officeConfig={officeConfig}
            onLocationVerified={handleLocationUpdate}
            currentUser={currentUser}
            workMode={effectiveWorkMode}
            isWfhApproved={isWfhApproved}
            isBusinessTripApproved={isBusinessTripApproved}
          />
        </div>

      </div>

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
    </div>
  );
}
