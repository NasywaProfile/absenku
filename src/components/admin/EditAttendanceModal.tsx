import { useState } from 'react';
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
} from 'lucide-react';
import { AttendanceRecord, LocationStatus, AttendanceStatus } from '../../types/index.ts';

interface EditAttendanceModalProps {
  record: AttendanceRecord;
  isOpen: boolean;
  onClose: () => void;
  onSave: (updatedRecord: AttendanceRecord) => void;
}

export function EditAttendanceModal({
  record,
  isOpen,
  onClose,
  onSave,
}: EditAttendanceModalProps) {
  if (!isOpen || !record) return null;

  const [locationStatus, setLocationStatus] = useState<LocationStatus>(
    record.clockInLocationStatus || 'IN_OFFICE'
  );

  const [attendanceStatus, setAttendanceStatus] = useState<AttendanceStatus>(
    record.clockInStatus || 'ON_TIME'
  );

  const [lateMinutes, setLateMinutes] = useState<number>(
    record.clockInLateMinutes || 0
  );

  const [notes, setNotes] = useState<string>(record.notes || '');
  const [isFullScreen, setIsFullScreen] = useState(false);

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const updated: AttendanceRecord = {
      ...record,
      clockInLocationStatus: locationStatus,
      clockInStatus: attendanceStatus,
      clockInLateMinutes: attendanceStatus === 'LATE' ? Math.max(1, lateMinutes) : 0,
      clockInDistanceMeter:
        locationStatus === 'IN_OFFICE'
          ? 15
          : locationStatus === 'WFH_APPROVED'
          ? 0
          : Math.max(100, record.clockInDistanceMeter || 500),
      notes: notes.trim(),
      syncStatus: 'SYNCED',
    };

    onSave(updated);
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
        
        {/* Header Modal - Judul & Subjudul Ditengah */}
        <div className="px-5 sm:px-6 py-4.5 border-b border-slate-100 flex items-center justify-between shrink-0 bg-white relative">
          {/* Zoom Button di pojok kiri atas */}
          <button
            type="button"
            onClick={() => setIsFullScreen(!isFullScreen)}
            className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl border border-slate-200/80 transition-colors cursor-pointer shrink-0"
            title={isFullScreen ? "Perkecil Tampilan" : "Perbesar Layar Penuh"}
          >
            {isFullScreen ? (
              <Minimize2 className="w-4 h-4 text-slate-600" />
            ) : (
              <Maximize2 className="w-4 h-4 text-slate-600" />
            )}
          </button>

          {/* Judul & Subjudul Ditengah */}
          <div className="flex-1 text-center px-2 min-w-0">
            <h3 className="font-bold text-slate-900 text-base sm:text-lg tracking-tight text-center truncate">
              Edit Status Presensi Karyawan
            </h3>
            <p className="text-slate-500 text-xs sm:text-sm mt-0.5 text-center font-medium whitespace-normal break-words leading-tight">
              {record.userName} ({record.date})
            </p>
          </div>

          {/* Tombol Tutup Silang di kanan */}
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
          <div className="flex-1 overflow-y-auto p-6 space-y-5 text-xs">
          
          {/* 1. Pengaturan Status Radius / Lokasi Presensi */}
          <div className="space-y-2">
            <label className="block font-bold text-slate-800 text-xs">
              Status Radius / Lokasi Presensi
            </label>
            <div className="grid grid-cols-3 gap-2">
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

              <button
                type="button"
                onClick={() => setLocationStatus('WFH_APPROVED')}
                className={`p-3 rounded-xl border font-semibold flex flex-col items-center justify-center gap-1.5 transition-all text-center cursor-pointer ${
                  locationStatus === 'WFH_APPROVED'
                    ? 'bg-indigo-50 border-indigo-500 text-indigo-800 ring-2 ring-indigo-500/20 shadow-xs'
                    : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                }`}
              >
                <Laptop className="w-4 h-4 text-indigo-600" />
                <span>WFH</span>
              </button>
            </div>
          </div>

          {/* 2. Pengaturan Status Kehadiran (Tepat Waktu vs Terlambat) */}
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

          {/* Keterlambatan Menit Input */}
          {attendanceStatus === 'LATE' && (
            <div className="space-y-1 bg-amber-50/60 p-3.5 rounded-xl border border-amber-200/80">
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

          </div>

          {/* Footer Actions */}
          <div className="px-6 py-4.5 border-t border-slate-100 flex items-center shrink-0 bg-white">
            <button
              type="submit"
              className="w-full py-3 px-6 bg-[#1E3A8A] hover:bg-[#172554] text-white font-bold rounded-2xl text-sm transition-all duration-200 shadow-xs hover:scale-[1.01] active:scale-[0.99] cursor-pointer flex items-center justify-center gap-2"
            >
              <Save className="w-4 h-4 text-white" />
              <span>Simpan Perubahan</span>
            </button>
          </div>

        </form>
      </div>
    </div>
  );
}
