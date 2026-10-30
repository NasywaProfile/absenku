import { useState } from 'react';
import {
  X,
  Maximize2,
  Minimize2,
  AlertTriangle,
  Clock,
  ShieldCheck,
  CheckCircle,
  MapPin,
  Building2,
  Lock,
} from 'lucide-react';
import { GeolocationWidget } from './GeolocationWidget.tsx';
import { User, OfficeConfig, AttendanceType, AttendanceRecord } from '../../types/index.ts';
import { Coordinates, formatDistanceDisplay } from '../../lib/geo-utils.ts';
import { ModernConfirmDialog } from '../common/ModernConfirmDialog.tsx';
import {
  calculateClockInPunctuality,
  calculateWorkDurationMinutes,
  getCurrentTimeString,
  getCurrentDateString,
  formatDurationHuman,
} from '../../lib/time-utils.ts';
import { AppStorage } from '../../lib/storage.ts';
import { saveAttendanceWithOfflineSupport } from '../../lib/offline-sync.ts';
import { GeofenceIllustration } from '../common/Illustrations.tsx';

interface ClockInOutModalProps {
  type: AttendanceType;
  currentUser: User;
  officeConfig: OfficeConfig;
  existingTodayRecord?: AttendanceRecord;
  onClose: () => void;
  onSuccess: (record: AttendanceRecord) => void;
}

export function ClockInOutModal({
  type,
  currentUser,
  officeConfig,
  existingTodayRecord,
  onClose,
  onSuccess,
}: ClockInOutModalProps) {
  const [coords, setCoords] = useState<Coordinates | null>(null);
  const [distanceMeter, setDistanceMeter] = useState<number>(0);
  const [isWithinRadius, setIsWithinRadius] = useState<boolean>(true);
  const [notes, setNotes] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [showLocationDialog, setShowLocationDialog] = useState<boolean>(false);
  const [isFullScreen, setIsFullScreen] = useState<boolean>(false);

  const currentTime = getCurrentTimeString();
  const currentDate = getCurrentDateString();

  // Cek apakah ada izin WFH yang aktif hari ini
  const userLeaves = AppStorage.getLeaveRequests();
  const todayWfhRequest = userLeaves.find(
    (l: any) => l.userId === currentUser.id && (l.category === 'WFH' || l.type === 'WFH') && currentDate >= l.startDate && currentDate <= l.endDate
  );
  const isWfhApproved = todayWfhRequest?.status === 'APPROVED';

  // Hitung ketepatan waktu untuk Clock In
  const punctuality = calculateClockInPunctuality(
    currentTime,
    officeConfig.workStartHour,
    officeConfig.gracePeriodMinutes
  );

  const handleLocationVerified = (
    c: Coordinates,
    distance: number,
    withinRadius: boolean
  ) => {
    const isGeofenceActive = officeConfig.isGeofenceActive ?? true;
    setCoords(c);
    setDistanceMeter(distance);
    setIsWithinRadius(isGeofenceActive ? withinRadius : true);
  };

  const handleActionSubmit = () => {
    setSubmitError(null);

    if (!coords) {
      setSubmitError('Sinyal GPS lokasi belum terdeteksi. Pastikan izin lokasi browser aktif atau klik tombol Segarkan GPS.');
      return;
    }

    // Jika di luar radius dan tidak ada izin WFH yang disetujui, beri peringatan
    if (!isWithinRadius && !isWfhApproved) {
      setShowLocationDialog(true);
      return;
    }

    executeModalSubmit();
  };

  const executeModalSubmit = () => {
    if (!coords) return;
    setIsSubmitting(true);

    try {
      if (type === 'CLOCK_IN') {
        const locationStatus = isWfhApproved
          ? 'WFH_APPROVED'
          : isWithinRadius
          ? 'IN_OFFICE'
          : 'OUT_OF_RANGE';

        const newRecord: AttendanceRecord = {
          id: `att-${Date.now()}`,
          userId: currentUser.id,
          userName: currentUser.name,
          userAvatar: currentUser.avatar,
          department: currentUser.department,
          employmentType: currentUser.employmentType || 'CONTRACT',
          workMode: locationStatus === 'WFH_APPROVED' ? 'WFH' : 'WFO',
          date: currentDate,
          clockInTime: currentTime,
          clockInLat: coords.latitude,
          clockInLng: coords.longitude,
          clockInDistanceMeter: distanceMeter,
          clockInLocationStatus: locationStatus,
          clockInStatus: punctuality.status,
          clockInLateMinutes: punctuality.lateMinutes,
          notes: notes.trim() || undefined,
        };

        const { record } = saveAttendanceWithOfflineSupport(newRecord, 'CLOCK_IN');
        onSuccess(record);
      } else {
        if (!existingTodayRecord) {
          throw new Error('Data Clock In hari ini tidak ditemukan.');
        }

        const duration = calculateWorkDurationMinutes(
          existingTodayRecord.clockInTime,
          currentTime
        );

        const locationStatus = isWfhApproved
          ? 'WFH_APPROVED'
          : isWithinRadius
          ? 'IN_OFFICE'
          : 'OUT_OF_RANGE';

        const updatedRecord: AttendanceRecord = {
          ...existingTodayRecord,
          clockOutTime: currentTime,
          clockOutLat: coords.latitude,
          clockOutLng: coords.longitude,
          clockOutDistanceMeter: distanceMeter,
          clockOutLocationStatus: locationStatus,
          workDurationMinutes: duration,
          notes: notes.trim()
            ? (existingTodayRecord.notes && existingTodayRecord.notes.trim() ? `${existingTodayRecord.notes} | ${notes.trim()}` : notes.trim())
            : (existingTodayRecord.notes || undefined),
        };

        const { record } = saveAttendanceWithOfflineSupport(updatedRecord, 'CLOCK_OUT');
        onSuccess(record);
      }
    } catch (err: unknown) {
      setSubmitError((err as Error).message || 'Gagal menyimpan presensi.');
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className={`fixed inset-0 z-50 flex animate-in fade-in duration-200 font-sans overflow-hidden ${
        isFullScreen
          ? 'items-center justify-center p-0'
          : 'items-center justify-center p-3 sm:p-5 md:p-6'
      }`}
    >
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-950/40 backdrop-blur-xs transition-opacity cursor-pointer"
        onClick={onClose}
      />

      {/* Modal Dialog Card */}
      <div
        className={`relative z-10 bg-white shadow-2xl flex flex-col min-h-0 overflow-hidden transition-all duration-300 font-sans ${
          isFullScreen
            ? 'w-full h-full max-w-none max-h-none rounded-none border-0'
            : 'w-full max-w-xl max-h-[92vh] rounded-[28px] border border-slate-200/90 animate-in zoom-in-95 duration-200'
        }`}
      >
        
        {/* Header Modal */}
        <div className="px-5 sm:px-6 py-4.5 border-b border-slate-100 flex items-center justify-between shrink-0 bg-white">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-2xl bg-blue-50 text-[#1E3A8A] border border-blue-100 flex items-center justify-center shrink-0">
              <Clock className="w-5 h-5 text-[#1E3A8A]" />
            </div>
            <div className="min-w-0">
              <h3 className="font-bold text-base sm:text-lg text-slate-900 tracking-tight truncate">
                {type === 'CLOCK_IN' ? 'Presensi Masuk Kerja' : 'Presensi Pulang Kerja'}
              </h3>
              <p className="text-xs text-slate-500 mt-0.5 truncate">
                {currentUser.name} &bull; {currentUser.department || 'Divisi'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => setIsFullScreen(!isFullScreen)}
              className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl border border-slate-200/80 transition-colors cursor-pointer"
              title={isFullScreen ? "Perkecil Tampilan" : "Perbesar Layar Penuh"}
            >
              {isFullScreen ? (
                <Minimize2 className="w-4 h-4 text-slate-600" />
              ) : (
                <Maximize2 className="w-4 h-4 text-slate-600" />
              )}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full border border-slate-200 transition-colors cursor-pointer"
              title="Tutup"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Scrollable Modal Body */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-4 text-xs">
          {/* Feedback Error */}
          {submitError && (
            <div className="p-3.5 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl flex items-center gap-2.5">
              <AlertTriangle className="w-4 h-4 shrink-0 text-rose-500" />
              <span>{submitError}</span>
            </div>
          )}

          {/* Status Waktu & Ketepatan */}
          <div className="p-4 bg-slate-50 border border-slate-200/80 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-indigo-600" />
              <span className="text-slate-500">Waktu Presensi:</span>
              <span className="font-mono font-bold text-slate-900 text-sm">{currentTime} WIB</span>
            </div>

            {type === 'CLOCK_IN' ? (
              <div>
                <span
                  className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold ${
                    punctuality.status === 'ON_TIME'
                      ? 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                      : 'bg-orange-100 text-orange-900 border border-orange-300'
                  }`}
                >
                  {punctuality.status === 'ON_TIME' ? (
                    <CheckCircle className="w-3.5 h-3.5 text-emerald-700" />
                  ) : (
                    <AlertTriangle className="w-3.5 h-3.5 text-orange-700" />
                  )}
                  {punctuality.status === 'ON_TIME' ? (isWfhApproved ? 'Hadir (WFH)' : 'Hadir (Masuk)') : punctuality.remarks}
                </span>
              </div>
            ) : (
              existingTodayRecord && (
                <div className="text-slate-600">
                  Masuk pukul: <strong className="font-mono text-slate-900">{existingTodayRecord.clockInTime} WIB</strong>
                </div>
              )
            )}
          </div>

          {/* Snapshot Geofence Radar Widget */}
          <div className="border border-slate-200 rounded-xl overflow-hidden">
            <GeolocationWidget
              officeConfig={officeConfig}
              onLocationVerified={handleLocationVerified}
            />
          </div>

          {/* Lokasi Kantor Tujuan */}
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 text-slate-600 min-w-0">
              <Building2 className="w-4 h-4 text-indigo-600 shrink-0" />
              <span className="truncate font-semibold text-slate-800">{officeConfig.name}</span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span className="text-xs font-semibold text-slate-500">
                Radius: <strong className="text-slate-900">{officeConfig.geofenceRadiusMeter}m</strong>
              </span>
              <GeofenceIllustration className="w-8 h-8 opacity-90" />
            </div>
          </div>

          {/* Catatan / Keterangan Opsional */}
          <div>
            <label className="block font-semibold text-slate-700 mb-1.5">
              Catatan / Keterangan (Opsional)
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={isWfhApproved ? 'Sedang WFH - tugas hari ini...' : 'Contoh: Hadir di kantor / meeting klien...'}
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        </div>

        {/* Modal Footer (Action Buttons) */}
        <div className="px-5 sm:px-6 py-4 border-t border-slate-100 flex items-center justify-between gap-3 shrink-0 bg-white">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs sm:text-sm cursor-pointer transition-colors active:scale-95"
          >
            Batal
          </button>

          <button
            type="button"
            onClick={handleActionSubmit}
            disabled={isSubmitting || !coords}
            className={`inline-flex items-center justify-center gap-2 px-6 py-2.5 text-white font-bold rounded-xl shadow-xs transition-all duration-200 active:scale-95 cursor-pointer disabled:opacity-50 text-xs sm:text-sm ${
              type === 'CLOCK_IN'
                ? 'bg-[#1E3A8A] hover:bg-[#172554]'
                : 'bg-rose-600 hover:bg-rose-700'
            }`}
          >
            <ShieldCheck className="w-4 h-4 text-white" />
            <span>
              {isSubmitting
                ? 'Memproses Presensi...'
                : type === 'CLOCK_IN'
                ? 'Konfirmasi Presensi Masuk'
                : 'Konfirmasi Presensi Pulang'}
            </span>
          </button>
        </div>

      </div>

      {/* Modern Dialog Konfirmasi Luar Radius */}
      <ModernConfirmDialog
        isOpen={showLocationDialog}
        variant="location"
        title="Konfirmasi Presensi Luar Radius"
        message={`Posisi GPS Anda saat ini berjarak ${formatDistanceDisplay(distanceMeter)} dari kantor (di luar batas radius kantor ${officeConfig.geofenceRadiusMeter}m).\n\nTetap lanjutkan presensi? Catatan presensi akan ditandai dengan status "Luar Radius".`}
        confirmText="Lanjutkan Presensi"
        cancelText="Batal"
        onConfirm={() => {
          setShowLocationDialog(false);
          executeModalSubmit();
        }}
        onCancel={() => setShowLocationDialog(false)}
      />
    </div>
  );
}
