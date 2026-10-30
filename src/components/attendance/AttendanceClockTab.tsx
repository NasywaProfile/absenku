import React, { useState, useEffect, useMemo } from 'react';
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
  const [isWithinRadius, setIsWithinRadius] = useState<boolean>(true);
  const [workMode, setWorkMode] = useState<WorkMode>('WFO');
  const [clockInNotes, setClockInNotes] = useState('');

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

  // When selectedDate changes, load existing logbook into the single text box
  useEffect(() => {
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
  }, [selectedDate, currentUser.id, allAttendance, dataVersion]);

  const handleLocationUpdate = (coords: Coordinates, dist: number, within: boolean) => {
    setCurrentCoords(coords);
    setDistanceMeters(dist);
    setIsWithinRadius(within);
  };

  const handleClockIn = () => {
    const today = getCurrentDateString();
    const time = getCurrentTimeString();
    const punctuality = calculateClockInPunctuality(
      time,
      officeConfig.workStartHour,
      officeConfig.gracePeriodMinutes
    );
    const isLate = punctuality.status === 'LATE';

    const newRecord: AttendanceRecord = {
      id: `att_${Date.now()}`,
      userId: currentUser.id,
      userName: currentUser.name,
      userAvatar: currentUser.avatar,
      department: currentUser.department,
      employmentType: currentUser.employmentType,
      date: today,
      clockInTime: time,
      clockInLat: currentCoords?.latitude || officeConfig.latitude,
      clockInLng: currentCoords?.longitude || officeConfig.longitude,
      clockInDistanceMeter: distanceMeters !== null ? distanceMeters : 0,
      clockInLocationStatus:
        workMode === 'WFH' ? 'WFH_APPROVED' : isWithinRadius ? 'IN_OFFICE' : 'OUT_OF_RANGE',
      clockInStatus: isLate ? 'LATE' : 'ON_TIME',
      clockInLateMinutes: isLate ? punctuality.lateMinutes : 0,
      workMode,
      notes: clockInNotes.trim() || undefined,
      syncStatus: 'SYNCED',
    };

    AppStorage.recordClockIn(newRecord);
    setDataVersion((v) => v + 1);
    onRefreshData();
  };

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
            <div className="flex items-center justify-between pb-3.5 mb-4 border-b border-slate-100 min-h-[44px]">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-blue-50 border border-blue-100 text-[#1E3A8A] flex items-center justify-center shrink-0">
                  <CalendarIcon className="w-4 h-4" />
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
                  const hasAtt = !!att;
                  const hasLog =
                    (log?.tasks && log.tasks.length > 0) ||
                    (att?.tasksDoneSummary && att.tasksDoneSummary.length > 0);
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
                Libur (Sabtu & Minggu)
              </span>
            </div>

            {/* Button Absen Masuk di Bawah Kalender Presensi (Navy Blue #1E3A8A) */}
            <div className="pt-3">
              {isClockedIn ? (
                <div className="w-full py-2.5 px-4 bg-emerald-50 border border-emerald-200 text-emerald-800 text-center text-xs font-semibold rounded-2xl flex items-center justify-center gap-2 shadow-2xs">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>Presensi Masuk Tercatat Hari Ini ({todayRecord?.clockInTime} WIB)</span>
                </div>
              ) : (
                <Tooltip content="Catat presensi kehadiran masuk kantor hari ini dengan verifikasi GPS" position="top" className="w-full">
                  <button
                    type="button"
                    onClick={handleClockIn}
                    className="w-full py-3 px-4 bg-[#1E3A8A] hover:bg-[#172554] active:scale-[0.98] text-white text-xs font-bold rounded-2xl shadow-sm border border-[#1E3A8A] transition-all flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <Clock className="w-4 h-4 text-white" />
                    <span>Presensi Masuk</span>
                  </button>
                </Tooltip>
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
                    className="w-full py-2.5 px-3 bg-[#1E3A8A] hover:bg-[#172554] active:scale-[0.98] text-white text-xs font-bold rounded-xl shadow-xs border border-[#1E3A8A] transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Check className="w-4 h-4 text-white shrink-0" />
                    <span className="truncate">Simpan Perubahan</span>
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={handleSaveLogbook}
                  className="w-full py-2.5 px-4 bg-[#1E3A8A] hover:bg-[#172554] active:scale-[0.98] text-white text-xs font-bold rounded-xl shadow-xs border border-[#1E3A8A] transition-all flex items-center justify-center gap-1.5 cursor-pointer"
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
        </div>

        {/* CARD KANAN: STATUS GEOFENCE RADAR (Ukuran sama persis dengan Kalender Presensi) */}
        <div className="h-full">
          <GeolocationWidget
            officeConfig={officeConfig}
            onLocationVerified={handleLocationUpdate}
            currentUser={currentUser}
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
