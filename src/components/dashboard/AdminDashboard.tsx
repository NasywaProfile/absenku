import { useState } from 'react';
import {
  Users,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Calendar,
  CheckSquare,
  Building2,
  FileCheck,
  ChevronRight,
  TrendingUp,
  MessageSquare,
  ShieldCheck,
  Check,
  ArrowLeftRight,
} from 'lucide-react';
import { AttendanceRecord, LeaveRequest, OfficeConfig, TaskItem, User } from '../../types/index.ts';
import { getCurrentDateString, formatDurationHuman } from '../../lib/time-utils.ts';
import { OfficeSettingsModal } from '../admin/OfficeSettingsModal.tsx';
import { AppStorage } from '../../lib/storage.ts';


interface AdminDashboardProps {
  currentUser?: User;
  users: User[];
  records: AttendanceRecord[];
  leaves: LeaveRequest[];
  tasks: TaskItem[];
  officeConfig: OfficeConfig;
  onNavigateTab: (tabId: string) => void;
  onRefreshData: () => void;
}

export function AdminDashboard({
  currentUser: propCurrentUser,
  users,
  records,
  leaves,
  tasks,
  officeConfig,
  onNavigateTab,
  onRefreshData,
}: AdminDashboardProps) {
  const currentUser = propCurrentUser || AppStorage.getCurrentUser() || ({} as User);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const today = getCurrentDateString();

  const [adminLogbookText, setAdminLogbookText] = useState(() => {
    const tasksList = AppStorage.getDailyTasks();
    const myLog = tasksList.find((t) => t.date === today);
    return myLog?.tasks?.join('\n') || '';
  });
  const [adminLogSavedMsg, setAdminLogSavedMsg] = useState('');
  const [isCardsSwapped, setIsCardsSwapped] = useState(() => {
    return localStorage.getItem('absenku_cards_swapped') === 'true';
  });

  const toggleCards = () => {
    setIsCardsSwapped((prev) => {
      const next = !prev;
      localStorage.setItem('absenku_cards_swapped', String(next));
      return next;
    });
  };

  const handleSaveAdminLogbook = () => {
    if (!adminLogbookText.trim()) return;
    AppStorage.upsertDailyTaskForDate(currentUser, today, [adminLogbookText.trim()], '');
    setAdminLogSavedMsg('Logbook berhasil disimpan!');
    setTimeout(() => setAdminLogSavedMsg(''), 3000);
  };

  const isSuperAdmin = currentUser.role === 'SUPER_ADMIN';

  // Karyawan (non-admin)
  const employees = users.filter((u) => u.role === 'EMPLOYEE');
  const totalEmployees = employees.length;

  // Absensi hari ini
  const todayRecords = records.filter((r) => r.date === today);
  const presentCount = todayRecords.length;
  const attendanceRate = totalEmployees > 0 ? Math.round((presentCount / totalEmployees) * 100) : 0;

  const onTimeCount = todayRecords.filter((r) => r.clockInStatus === 'ON_TIME').length;
  const lateCount = todayRecords.filter((r) => r.clockInStatus === 'LATE').length;
  const inOfficeCount = todayRecords.filter((r) => r.clockInLocationStatus === 'IN_OFFICE').length;
  const outOfRangeCount = todayRecords.filter((r) => r.clockInLocationStatus === 'OUT_OF_RANGE').length;

  // Cuti pending
  const pendingLeaves = leaves.filter((l) => l.status === 'PENDING');

  // Task metrics
  const totalTasks = tasks.length;
  const reviewedTasks = tasks.filter((t) => t.status === 'REVIEWED').length;
  const inProgressTasks = tasks.filter((t) => t.status === 'IN_PROGRESS').length;
  const doneTasks = tasks.filter((t) => t.status === 'DONE').length;
  const taskCompletionRate = totalTasks > 0 ? Math.round((reviewedTasks / totalTasks) * 100) : 0;

  const handleSaveOfficeConfig = (newCfg: OfficeConfig) => {
    AppStorage.updateOfficeConfig(newCfg);
    setShowSettingsModal(false);
    onRefreshData();
  };

  if (isSuperAdmin) {
    const chatTopics = AppStorage.getChatTopics().slice(0, 3);

    return (
      <div className="space-y-6 font-sans antialiased">
        {/* Top Banner */}
        <div className="bg-gradient-to-r from-slate-900 via-blue-950 to-indigo-950 rounded-3xl p-6 text-white shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <span className="text-xs font-semibold tracking-wider text-cyan-400 uppercase flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5" />
              Panel Direksi
            </span>
            <h2 className="text-2xl font-bold mt-1">Dashboard Pemantauan &amp; Operasional</h2>
            <p className="text-xs text-slate-300 mt-1 max-w-xl">
              Bebas presensi dan logbook. Akses penuh untuk memantau kinerja tim, memberikan tugas, dan konfigurasi sistem.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setShowSettingsModal(true)}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-white/10 hover:bg-white/20 text-white rounded-2xl text-xs font-semibold backdrop-blur-xs border border-white/10 transition-colors cursor-pointer"
            >
              <Building2 className="w-4 h-4 text-cyan-400" />
              Konfigurasi Kantor &amp; Geofence
            </button>
          </div>
        </div>

        {/* 2-Column Grid Header with Tukar Posisi button */}
        <div className="flex items-center justify-between pb-1">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
            Aktivitas Utama &amp; Komunikasi
          </span>
          <button
            type="button"
            onClick={toggleCards}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white hover:bg-blue-50 text-slate-700 hover:text-[#1E3A8A] border border-slate-200 shadow-2xs text-xs font-semibold transition-all cursor-pointer"
            title="Tukar posisi kartu Kalender dan Ruang Obrolan"
          >
            <ArrowLeftRight className="w-3.5 h-3.5 text-[#1E3A8A]" />
            <span>Tukar Posisi ({isCardsSwapped ? 'Kalender di Kiri' : 'Ruang Obrolan di Kiri'})</span>
          </button>
        </div>

        {/* 2-Column Grid: Ruang Obrolan & Kalender Kerja */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-stretch">
          
          {/* Card Ruang Obrolan */}
          <div className={`bg-white rounded-[28px] border border-slate-200/90 p-6 shadow-xs flex flex-col justify-between h-full min-h-[420px] ${isCardsSwapped ? 'md:order-2' : 'md:order-1'}`}>
            <div>
              <div className="flex items-center justify-between pb-3.5 mb-4 border-b border-slate-100">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-blue-50 border border-blue-100 text-[#1E3A8A] flex items-center justify-center shrink-0">
                    <MessageSquare className="w-4 h-4" />
                  </div>
                  <h3 className="text-base font-bold text-slate-900 tracking-tight">
                    Ruang Obrolan
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => onNavigateTab('chat')}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#1E3A8A] hover:text-[#172554] bg-blue-50/80 hover:bg-blue-100/80 px-2.5 py-1 rounded-lg transition-colors cursor-pointer"
                >
                  <span>Lihat Semua</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="space-y-3">
                {chatTopics.length === 0 ? (
                  <div className="text-center py-12 px-4 text-xs text-slate-400">
                    Belum ada obrolan tim.
                  </div>
                ) : (
                  chatTopics.map((topic) => (
                    <div
                      key={topic.id}
                      onClick={() => onNavigateTab('chat')}
                      className="group p-3.5 rounded-2xl bg-slate-50/80 hover:bg-white border border-slate-200/70 hover:border-blue-200 hover:shadow-xs transition-all cursor-pointer space-y-1.5"
                    >
                      <h4 className="text-xs font-bold text-slate-900 group-hover:text-[#1E3A8A] transition-colors line-clamp-1">
                        {topic.title}
                      </h4>
                      <p className="text-[11px] text-slate-500 line-clamp-1">
                        {topic.shortNotes || 'Klik untuk membuka diskusi...'}
                      </p>
                      <div className="flex items-center justify-between text-[10px] text-slate-400 pt-1 border-t border-slate-100">
                        <span>Oleh {topic.createdByName}</span>
                        <span>{topic.comments?.length || 0} Balasan</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="pt-4 mt-4 border-t border-slate-100">
              <button
                type="button"
                onClick={() => onNavigateTab('chat')}
                className="w-full py-3 px-4 bg-[#1E3A8A] hover:bg-[#172554] text-white text-xs font-bold rounded-2xl shadow-xs transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <MessageSquare className="w-4 h-4 text-white" />
                <span>Buka Ruang Obrolan Tim</span>
              </button>
            </div>
          </div>

          {/* Card Kalender Kerja & Logbook */}
          <div className={`bg-white rounded-[28px] border border-slate-200/90 p-6 shadow-xs flex flex-col justify-between h-full ${isCardsSwapped ? 'md:order-1' : 'md:order-2'}`}>
            <div className="space-y-4">
              <div className="flex items-center justify-between pb-3.5 border-b border-slate-100">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-blue-50 border border-blue-100 text-[#1E3A8A] flex items-center justify-center shrink-0">
                    <Calendar className="w-4 h-4" />
                  </div>
                  <h3 className="text-base font-bold text-slate-900 tracking-tight">
                    Kalender Kerja
                  </h3>
                </div>
                <span className="px-3 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-bold rounded-full">
                  Hari Kerja Aktif
                </span>
              </div>

              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/80 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-600">Tanggal:</span>
                  <span className="text-xs font-extrabold text-slate-900">Kamis, 29 Okt 2026</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-600">Jam Kerja Kantor:</span>
                  <span className="text-xs font-mono font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-200">
                    {officeConfig?.workStartHour || '08:00'} - {officeConfig?.workEndHour || '17:00'} WIB
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-600">Status Akun:</span>
                  <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200">
                    Super Admin / Direksi
                  </span>
                </div>
              </div>

              {/* Form Catatan Logbook dengan Tombol Panjang */}
              <div className="pt-3 border-t border-slate-100 space-y-2.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-slate-800">Logbook Catatan Kerja Hari Ini</span>
                </div>
                <textarea
                  rows={3}
                  value={adminLogbookText}
                  onChange={(e) => setAdminLogbookText(e.target.value)}
                  placeholder="Tulis apa yang dikerjakan hari ini..."
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-indigo-400 focus:bg-white transition-all resize-none shadow-2xs placeholder:text-slate-400"
                />
                <div className="pt-0.5 w-full">
                  <button
                    type="button"
                    onClick={handleSaveAdminLogbook}
                    className="w-full py-3 px-6 bg-[#1E3A8A] hover:bg-[#172554] active:scale-[0.98] text-white text-xs sm:text-sm font-bold rounded-xl shadow-md border border-[#1E3A8A] transition-all flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <Check className="w-4 h-4 text-white" />
                    <span>Simpan Logbook</span>
                  </button>
                </div>
                {adminLogSavedMsg && (
                  <div className="p-2 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-[11px] font-semibold flex items-center gap-1.5 animate-fadeIn">
                    <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                    <span>{adminLogSavedMsg}</span>
                  </div>
                )}
              </div>
            </div>
          </div>

        </div>

        {/* Office Settings Modal */}
        {showSettingsModal && (
          <OfficeSettingsModal
            currentConfig={officeConfig}
            onSave={handleSaveOfficeConfig}
            onClose={() => setShowSettingsModal(false)}
          />
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-blue-950 to-indigo-950 rounded-3xl p-6 text-white shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <span className="text-xs font-semibold tracking-wider text-cyan-400 uppercase flex items-center gap-1.5">
            <TrendingUp className="w-3.5 h-3.5" />
            Panel Analitik HR &amp; Operasional Kantor
          </span>
          <h2 className="text-2xl font-bold mt-1">Dashboard Pemantauan Presensi &amp; Kinerja</h2>
          <p className="text-xs text-slate-300 mt-1 max-w-xl">
            Real-time monitoring geofencing lokasi kantor ({officeConfig.geofenceRadiusMeter}m), verifikasi selfie, dan approval izin cuti.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setShowSettingsModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-white/10 hover:bg-white/20 text-white rounded-2xl text-xs font-semibold backdrop-blur-xs border border-white/10 transition-colors"
          >
            <Building2 className="w-4 h-4 text-cyan-400" />
            Konfigurasi Kantor &amp; Geofence
          </button>
        </div>
      </div>

      {/* KPI Cards Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* 1. Kehadiran Hari Ini */}
        <div className="bg-white rounded-3xl p-5 border border-slate-100 shadow-xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Tingkat Kehadiran</span>
            <div className="p-2 bg-blue-50 text-blue-600 rounded-xl">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-slate-900">{attendanceRate}%</span>
            <span className="text-xs text-slate-400 font-medium">
              ({presentCount}/{totalEmployees} Karyawan)
            </span>
          </div>
          <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
            <div
              className="bg-blue-600 h-full rounded-full transition-all duration-500"
              style={{ width: `${attendanceRate}%` }}
            />
          </div>
        </div>

        {/* 2. Ketepatan Waktu */}
        <div className="bg-white rounded-3xl p-5 border border-slate-100 shadow-xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Ketepatan Waktu</span>
            <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-emerald-600">{onTimeCount}</span>
            <span className="text-xs text-slate-400 font-medium">Tepat Waktu</span>
          </div>
          <p className="text-[11px] text-amber-600 font-medium flex items-center gap-1">
            <AlertTriangle className="w-3 h-3" />
            {lateCount} Karyawan Terlambat
          </p>
        </div>

        {/* 3. Pengajuan Izin Menunggu */}
        <div
          onClick={() => onNavigateTab('leaves')}
          className="bg-white rounded-3xl p-5 border border-slate-100 shadow-xs space-y-2 hover:border-indigo-300 transition-colors cursor-pointer group"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Izin Butuh Persetujuan</span>
            <div className="p-2 bg-amber-50 text-amber-600 rounded-xl group-hover:scale-110 transition-transform">
              <FileCheck className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-amber-600">{pendingLeaves.length}</span>
            <span className="text-xs text-slate-400 font-medium">Pengajuan</span>
          </div>
          <span className="text-[11px] text-indigo-600 font-semibold flex items-center gap-0.5">
            Tinjau Sekarang <ChevronRight className="w-3 h-3" />
          </span>
        </div>

        {/* 4. Penyelesaian Tugas Tim */}
        <div
          onClick={() => onNavigateTab('tasks')}
          className="bg-white rounded-3xl p-5 border border-slate-100 shadow-xs space-y-2 hover:border-emerald-300 transition-colors cursor-pointer group"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Progress Tugas Tim</span>
            <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl group-hover:scale-110 transition-transform">
              <CheckSquare className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-slate-900">{taskCompletionRate}%</span>
            <span className="text-xs text-slate-400 font-medium">
              ({reviewedTasks}/{totalTasks} Selesai)
            </span>
          </div>
          <p className="text-[11px] text-indigo-700 font-medium">
            {doneTasks} tugas menunggu review HR
          </p>
        </div>
      </div>

      {/* Grid: Live Check-ins + Geofence & Task Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Kolom 1 & 2: Presensi Terkini Hari Ini */}
        <div className="lg:col-span-2 bg-white rounded-3xl p-6 border border-slate-100 shadow-sm space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div>
              <h3 className="font-bold text-base text-slate-900">
                Aktivitas Presensi Terkini Hari Ini
              </h3>
              <p className="text-xs text-slate-500">
                Log presensi masuk dengan rekaman koordinat dan tangkapan webcam
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigateTab('history')}
              className="text-xs text-blue-600 hover:text-blue-700 font-semibold flex items-center gap-1"
            >
              Lihat Semua Log <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {todayRecords.length === 0 ? (
            <div className="py-12 text-center text-slate-400 text-xs">
              Belum ada presensi yang tercatat untuk hari ini.
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {todayRecords.slice(0, 5).map((rec) => (
                <div key={rec.id} className="py-3 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="relative">
                      <img
                        src={rec.userAvatar}
                        alt={rec.userName}
                        className="w-10 h-10 rounded-full object-cover border border-slate-200"
                      />
                      {rec.clockInPhoto && (
                        <div
                          className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full overflow-hidden border-2 border-white shadow-xs"
                          title="Selfie Preview"
                        >
                          <img
                            src={rec.clockInPhoto}
                            alt="Selfie"
                            className="w-full h-full object-cover"
                          />
                        </div>
                      )}
                    </div>
                    <div>
                      <p className="font-bold text-xs text-slate-900">{rec.userName}</p>
                      <p className="text-[10px] text-slate-400">{rec.department}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 text-right">
                    <div>
                      <p className="text-xs font-mono font-bold text-slate-800">
                        {rec.clockInTime} WIB
                      </p>
                      <span
                        className={`text-[10px] font-semibold ${
                          rec.clockInStatus === 'ON_TIME' ? 'text-emerald-600' : 'text-amber-600'
                        }`}
                      >
                        {rec.clockInStatus === 'ON_TIME'
                          ? 'Tepat Waktu'
                          : `Terlambat ${formatDurationHuman(rec.clockInLateMinutes)}`}
                      </span>
                    </div>

                    <span
                      className={`px-2.5 py-1 rounded-full text-[10px] font-semibold ${
                        rec.clockInLocationStatus === 'IN_OFFICE'
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : 'bg-amber-50 text-amber-700 border border-amber-200'
                      }`}
                    >
                      {rec.clockInLocationStatus === 'IN_OFFICE' ? 'Di Kantor' : 'Luar Radius'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Kolom 3: Status Radius & Cuti Pending Widget */}
        <div className="space-y-6">
          {/* Geofence Compliance Summary */}
          <div className="bg-white rounded-3xl p-5 border border-slate-100 shadow-sm space-y-3">
            <h4 className="font-bold text-xs text-slate-900 uppercase tracking-wide">
              Kepatuhan Radius Kantor ({officeConfig.geofenceRadiusMeter}m)
            </h4>
            <div className="space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-slate-600 flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                  Presensi Di Dalam Kantor
                </span>
                <span className="font-bold text-slate-900">{inOfficeCount}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-600 flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                  Presensi Di Luar Radius / WFA
                </span>
                <span className="font-bold text-slate-900">{outOfRangeCount}</span>
              </div>
            </div>

            <div className="pt-2 border-t border-slate-100 text-[11px] text-slate-400">
              Pusat Kantor: <span className="font-mono text-slate-600">{officeConfig.latitude}, {officeConfig.longitude}</span>
            </div>
          </div>

          {/* Pending Leaves Box */}
          <div className="bg-white rounded-3xl p-5 border border-slate-100 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="font-bold text-xs text-slate-900 uppercase tracking-wide">
                Permohonan Cuti Masuk
              </h4>
              <span className="text-xs bg-amber-100 text-amber-800 font-bold px-2 py-0.5 rounded-full">
                {pendingLeaves.length}
              </span>
            </div>

            {pendingLeaves.length === 0 ? (
              <p className="text-xs text-slate-400 italic py-2">
                Tidak ada permohonan cuti baru.
              </p>
            ) : (
              <div className="space-y-2.5">
                {pendingLeaves.slice(0, 2).map((item) => (
                  <div
                    key={item.id}
                    className="p-3 bg-slate-50 rounded-2xl border border-slate-200/70 text-xs space-y-1"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-800">{item.userName}</span>
                      <span className="text-[10px] text-slate-400">{item.totalDays} Hari</span>
                    </div>
                    <p className="text-slate-500 text-[11px] line-clamp-1">"{item.reason}"</p>
                  </div>
                ))}

                <button
                  type="button"
                  onClick={() => onNavigateTab('leaves')}
                  className="w-full text-center text-xs font-semibold text-blue-600 hover:text-blue-700 pt-1"
                >
                  Proses Pengajuan &rarr;
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Office Settings Modal */}
      {showSettingsModal && (
        <OfficeSettingsModal
          currentConfig={officeConfig}
          onSave={handleSaveOfficeConfig}
          onClose={() => setShowSettingsModal(false)}
        />
      )}
    </div>
  );
}
