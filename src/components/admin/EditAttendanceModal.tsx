import { useState, useMemo } from 'react';
import {
  MapPin,
  Clock,
  Save,
  X,
  Maximize2,
  Minimize2,
  Building2,
  Laptop,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  CalendarDays,
  UserCheck,
  Lock,
} from 'lucide-react';
import {
  AttendanceRecord,
  LocationStatus,
  AttendanceStatus,
  LeaveCategory,
  LeaveRequest,
} from '../../types/index.ts';
import { AppStorage } from '../../lib/storage.ts';
import { getApprovedLeaveForDate } from '../../lib/attendance-status.ts';

interface EditAttendanceModalProps {
  record: AttendanceRecord;
  isOpen: boolean;
  onClose: () => void;
  currentUserId?: string;
  currentUserName?: string;
  onSave: (updatedRecord: AttendanceRecord, leaveCategory?: LeaveCategory | 'NONE') => void;
}

export function EditAttendanceModal({
  record,
  isOpen,
  onClose,
  currentUserId,
  currentUserName,
  onSave,
}: EditAttendanceModalProps) {
  if (!isOpen || !record) return null;

  const isSelf = Boolean(
    (currentUserId && record.userId === currentUserId) ||
    (currentUserName && record.userName.toLowerCase() === currentUserName.toLowerCase())
  );

  // Cek perizinan aktif yang disetujui pada tanggal ini (prioritas: Sakit > Cuti/Izin > Dinas Luar > WFH)
  const existingLeave = useMemo(() => {
    const leaves = AppStorage.getLeaveRequests();
    return getApprovedLeaveForDate(leaves, { id: record.userId, name: record.userName }, record.date);
  }, [record.userId, record.userName, record.date]);

  // State Kategori Perizinan: 'NONE' | 'LEAVE' | 'WFH' | 'SICK' | 'BUSINESS_TRIP'
  const [leaveCategory, setLeaveCategory] = useState<LeaveCategory | 'NONE'>(() => {
    if (existingLeave) return existingLeave.category;
    if (record.clockInLocationStatus === 'WFH_APPROVED' || record.workMode === 'WFH') return 'WFH';
    if (record.clockInLocationStatus === 'DINAS_APPROVED' || record.workMode === 'DINAS') return 'BUSINESS_TRIP';
    return 'NONE';
  });

  // Lokasi fisik presensi (hanya relevan untuk status Hadir biasa). WFH & Dinas Luar ditentukan oleh kategori.
  const [locationStatus, setLocationStatus] = useState<LocationStatus>(() =>
    record.clockInLocationStatus === 'OUT_OF_RANGE' ? 'OUT_OF_RANGE' : 'IN_OFFICE'
  );

  const [attendanceStatus, setAttendanceStatus] = useState<AttendanceStatus>(
    record.clockInStatus || 'ON_TIME'
  );

  const [lateMinutes, setLateMinutes] = useState<number>(
    record.clockInLateMinutes || 0
  );

  const [notes, setNotes] = useState<string>(record.notes || existingLeave?.reason || '');
  const [isFullScreen, setIsFullScreen] = useState(false);

  // Cuti/Izin & Sakit = OFF (bebas presensi). WFH & Dinas Luar tetap bekerja.
  const isOffSelected = leaveCategory === 'LEAVE' || leaveCategory === 'SICK';
  const isRemoteSelected = leaveCategory === 'WFH' || leaveCategory === 'BUSINESS_TRIP';

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (isSelf) {
      alert('Admin tidak diizinkan mengubah catatan presensi miliknya sendiri.');
      return;
    }

    // 1. Sinkronisasi perizinan HANYA untuk tanggal ini (pengajuan multi-hari dipecah, hari lain tidak ikut berubah)
    AppStorage.setLeaveCategoryForDate(
      {
        id: record.userId,
        name: record.userName,
        avatar: record.userAvatar,
        department: record.department,
        employmentType: record.employmentType,
      },
      record.date,
      leaveCategory,
      { reason: notes, reviewerName: 'Administrator' }
    );

    // 2. Sinkronisasi data record presensi
    const effectiveLocationStatus: LocationStatus =
      leaveCategory === 'WFH'
        ? 'WFH_APPROVED'
        : leaveCategory === 'BUSINESS_TRIP'
        ? 'DINAS_APPROVED'
        : locationStatus;

    const updated: AttendanceRecord = {
      ...record,
      clockInLocationStatus: effectiveLocationStatus,
      clockInStatus: attendanceStatus,
      clockInLateMinutes: attendanceStatus === 'LATE' ? Math.max(1, lateMinutes) : 0,
      clockInDistanceMeter:
        effectiveLocationStatus === 'IN_OFFICE'
          ? 15
          : effectiveLocationStatus === 'WFH_APPROVED' || effectiveLocationStatus === 'DINAS_APPROVED'
          ? record.clockInDistanceMeter ?? 0
          : Math.max(101, record.clockInDistanceMeter || 500),
      workMode:
        leaveCategory === 'WFH' ? 'WFH' : leaveCategory === 'BUSINESS_TRIP' ? 'DINAS' : 'WFO',
      notes:
        notes.trim() ||
        (isOffSelected
          ? `OFF (${leaveCategory === 'SICK' ? 'Sakit' : 'Cuti / Izin'})`
          : undefined),
      syncStatus: 'SYNCED',
    };

    onSave(updated, leaveCategory);
    onClose();
  };

  return (
    <div
      className={`fixed inset-0 z-50 flex animate-in fade-in duration-200 font-sans ${
        isFullScreen
          ? 'items-center justify-center p-0'
          : 'justify-end items-center p-2.5 sm:p-4 md:p-5'
      }`}
    >
      <div
        className="fixed inset-0 bg-slate-950/40 backdrop-blur-xs transition-opacity cursor-pointer"
        onClick={onClose}
      />
      <div
        className={`relative z-10 bg-white shadow-2xl flex flex-col min-h-0 overflow-hidden transition-all duration-300 font-sans ${
          isFullScreen
            ? 'w-full h-full max-w-none max-h-none rounded-none border-0'
            : 'w-full max-w-sm sm:max-w-md md:max-w-lg h-full max-h-[calc(100vh-1.25rem)] sm:max-h-[calc(100vh-2rem)] rounded-3xl border border-slate-200/80 animate-in slide-in-from-right duration-300 ease-out'
        }`}
      >
        {/* Header Modal */}
        <div className="px-5 sm:px-6 py-4.5 border-b border-slate-100 flex items-center justify-between shrink-0 bg-white relative">
          <button
            type="button"
            onClick={() => setIsFullScreen(!isFullScreen)}
            className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl border border-slate-200/80 transition-colors cursor-pointer shrink-0"
            title={isFullScreen ? 'Perkecil Tampilan' : 'Perbesar Layar Penuh'}
          >
            {isFullScreen ? (
              <Minimize2 className="w-4 h-4 text-slate-600" />
            ) : (
              <Maximize2 className="w-4 h-4 text-slate-600" />
            )}
          </button>

          <div className="flex-1 text-center px-2 min-w-0">
            <h3 className="font-bold text-slate-900 text-base sm:text-lg tracking-tight text-center truncate">
              Edit Status Presensi & Perizinan
            </h3>
            <p className="text-slate-500 text-xs sm:text-sm mt-0.5 text-center font-medium whitespace-normal break-words leading-tight">
              {record.userName} ({record.date})
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full border border-slate-200 transition-colors cursor-pointer shrink-0"
            title="Tutup"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleFormSubmit} className="flex-1 flex flex-col min-h-0">
          <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-5 text-xs">
            {/* 1. Pengaturan Kategori Perizinan Karyawan */}
            <div className="space-y-2.5 bg-slate-50/70 p-4 rounded-2xl border border-slate-200/80">
              <div className="flex items-center justify-between">
                <label className="block font-bold text-slate-800 text-xs">
                  Kategori Perizinan Karyawan
                </label>
                {leaveCategory !== 'NONE' && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-[#1E3A8A]">
                    Perizinan Aktif
                  </span>
                )}
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {/* Hadir Biasa (Tanpa Perizinan) */}
                <button
                  type="button"
                  onClick={() => setLeaveCategory('NONE')}
                  className={`p-2.5 rounded-xl border font-semibold flex items-center gap-2 transition-all text-left cursor-pointer ${
                    leaveCategory === 'NONE'
                      ? 'bg-emerald-50 border-emerald-500 text-emerald-800 ring-2 ring-emerald-500/20 shadow-xs'
                      : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <UserCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span className="truncate">Hadir</span>
                </button>

                {/* Izin / Cuti */}
                <button
                  type="button"
                  onClick={() => setLeaveCategory('LEAVE')}
                  className={`p-2.5 rounded-xl border font-semibold flex items-center gap-2 transition-all text-left cursor-pointer ${
                    leaveCategory === 'LEAVE'
                      ? 'bg-sky-50 border-sky-500 text-sky-800 ring-2 ring-sky-500/20 shadow-xs'
                      : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <CalendarDays className="w-4 h-4 text-sky-600 shrink-0" />
                  <span className="truncate">Cuti / Izin</span>
                </button>

                {/* WFH */}
                <button
                  type="button"
                  onClick={() => setLeaveCategory('WFH')}
                  className={`p-2.5 rounded-xl border font-semibold flex items-center gap-2 transition-all text-left cursor-pointer ${
                    leaveCategory === 'WFH'
                      ? 'bg-indigo-50 border-indigo-500 text-indigo-800 ring-2 ring-indigo-500/20 shadow-xs'
                      : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <Laptop className="w-4 h-4 text-indigo-600 shrink-0" />
                  <span className="truncate">WFH</span>
                </button>

                {/* Sakit */}
                <button
                  type="button"
                  onClick={() => setLeaveCategory('SICK')}
                  className={`p-2.5 rounded-xl border font-semibold flex items-center gap-2 transition-all text-left cursor-pointer ${
                    leaveCategory === 'SICK'
                      ? 'bg-rose-50 border-rose-500 text-rose-800 ring-2 ring-rose-500/20 shadow-xs'
                      : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span className="truncate">Sakit</span>
                </button>

                {/* Dinas Luar */}
                <button
                  type="button"
                  onClick={() => setLeaveCategory('BUSINESS_TRIP')}
                  className={`p-2.5 rounded-xl border font-semibold flex items-center gap-2 transition-all text-left cursor-pointer col-span-2 sm:col-span-1 ${
                    leaveCategory === 'BUSINESS_TRIP'
                      ? 'bg-purple-50 border-purple-500 text-purple-800 ring-2 ring-purple-500/20 shadow-xs'
                      : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <MapPin className="w-4 h-4 text-purple-600 shrink-0" />
                  <span className="truncate">Dinas Luar</span>
                </button>
              </div>

              {/* Penjelasan sesuai kategori yang dipilih */}
              {isOffSelected && (
                <div className="p-2.5 rounded-xl bg-amber-50/80 border border-amber-200 text-amber-900 text-[11px] flex items-center gap-2 animate-fadeIn">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                  <span>
                    Hari ini akan tercatat <b>OFF ({leaveCategory === 'SICK' ? 'Sakit' : 'Cuti / Izin'})</b>, karyawan bebas presensi dan tidak dihitung hadir.
                  </span>
                </div>
              )}
              {isRemoteSelected && (
                <div className="p-2.5 rounded-xl bg-indigo-50/80 border border-indigo-200 text-indigo-900 text-[11px] flex items-center gap-2 animate-fadeIn">
                  <AlertTriangle className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                  <span>
                    Karyawan <b>tetap wajib presensi</b>; lokasi dicatat sebagai <b>{leaveCategory === 'WFH' ? 'WFH' : 'Dinas Luar'}</b>.
                  </span>
                </div>
              )}
              <p className="text-[10px] text-slate-400 leading-snug">
                Perubahan hanya berlaku untuk tanggal {record.date}. Pengajuan multi-hari akan dipecah, hari lain tidak ikut berubah.
              </p>
            </div>

            {/* 2. Lokasi Presensi (hanya untuk status Hadir biasa) */}
            {leaveCategory === 'NONE' && (
            <div className="space-y-2">
              <label className="block font-bold text-slate-800 text-xs">
                Status Radius / Lokasi Presensi
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setLocationStatus('IN_OFFICE')}
                  className={`p-3 rounded-xl border font-semibold flex flex-col items-center justify-center gap-1.5 transition-all text-center cursor-pointer ${
                    locationStatus === 'IN_OFFICE'
                      ? 'bg-emerald-50 border-emerald-500 text-emerald-800 ring-2 ring-emerald-500/20 shadow-xs'
                      : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  <Building2 className="w-4 h-4 text-emerald-600" />
                  <span>Sesuai Radius</span>
                </button>

                <button
                  type="button"
                  onClick={() => setLocationStatus('OUT_OF_RANGE')}
                  className={`p-3 rounded-xl border font-semibold flex flex-col items-center justify-center gap-1.5 transition-all text-center cursor-pointer ${
                    locationStatus === 'OUT_OF_RANGE'
                      ? 'bg-rose-50 border-rose-500 text-rose-800 ring-2 ring-rose-500/20 shadow-xs'
                      : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  <MapPin className="w-4 h-4 text-rose-600" />
                  <span>Luar Radius</span>
                </button>
              </div>
            </div>
            )}

            {/* 3. Pengaturan Status Kehadiran (Tepat Waktu vs Terlambat) - tidak relevan untuk OFF */}
            {!isOffSelected && (
            <div className="space-y-2">
              <label className="block font-bold text-slate-800 text-xs">
                Status Waktu Masuk (Clock In)
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setAttendanceStatus('ON_TIME');
                    setLateMinutes(0);
                  }}
                  className={`p-3 rounded-xl border font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                    attendanceStatus === 'ON_TIME'
                      ? 'bg-emerald-50 border-emerald-500 text-emerald-800 ring-2 ring-emerald-500/20 shadow-xs'
                      : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>Tepat Waktu</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setAttendanceStatus('LATE');
                    if (lateMinutes === 0) setLateMinutes(15);
                  }}
                  className={`p-3 rounded-xl border font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                    attendanceStatus === 'LATE'
                      ? 'bg-amber-50 border-amber-500 text-amber-900 ring-2 ring-amber-500/20 shadow-xs'
                      : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  <AlertTriangle className="w-4 h-4 text-amber-600" />
                  <span>Terlambat</span>
                </button>
              </div>
            </div>
            )}

            {/* Keterlambatan Menit Input */}
            {!isOffSelected && attendanceStatus === 'LATE' && (
              <div className="space-y-1 bg-amber-50/60 p-3.5 rounded-xl border border-amber-200/80 animate-fadeIn">
                <label className="block font-bold text-amber-900 text-xs">
                  Durasi Keterlambatan (Menit)
                </label>
                <input
                  type="number"
                  min={1}
                  value={lateMinutes}
                  onChange={(e) => setLateMinutes(parseInt(e.target.value) || 0)}
                  className="w-full px-3 py-2 bg-white border border-amber-300 rounded-lg text-slate-900 font-mono font-bold focus:outline-hidden focus:ring-2 focus:ring-amber-500"
                />
              </div>
            )}

            {/* 4. Catatan / Alasan Perubahan */}
            <div className="space-y-1.5">
              <label className="block font-bold text-slate-800 text-xs">
                Catatan / Alasan Perizinan (Opsional)
              </label>
              <textarea
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Tuliskan catatan perizinan atau alasan perubahan status..."
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-[#1E3A8A] focus:bg-white transition-all resize-none placeholder:text-slate-400"
              />
            </div>
          </div>

          {/* Footer Actions */}
          {!isSelf && (
            <div className="px-6 py-4.5 border-t border-slate-100 flex items-center shrink-0 bg-white">
              <button
                type="submit"
                className="w-full py-3 px-6 bg-[#1E3A8A] hover:bg-[#172554] text-white font-bold rounded-2xl text-sm transition-all duration-200 shadow-xs hover:scale-[1.01] active:scale-[0.99] cursor-pointer flex items-center justify-center gap-2"
              >
                <Save className="w-4 h-4 text-white" />
                <span>Simpan Perubahan</span>
              </button>
            </div>
          )}
        </form>
      </div>
    </div>
  );
}
