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
  getCurrentTimeString,
  getCurrentDateString,
} from '../../lib/time-utils.ts';
import { AppStorage } from '../../lib/storage.ts';
import { getApprovedLeaveForDate, isOffCategory } from '../../lib/attendance-status.ts';
import { saveAttendanceWithOfflineSupport } from '../../lib/offline-sync.ts';
import { GeofenceIllustration } from '../common/Illustrations.tsx';

interface ClockInOutModalProps {
  type?: AttendanceType;
  currentUser: User;
  officeConfig: OfficeConfig;
  existingTodayRecord?: AttendanceRecord;
  onClose: () => void;
  onSuccess: (record: AttendanceRecord) => void;
}

export function ClockInOutModal({
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

  // Cek perizinan yang disetujui hari ini (prioritas: Sakit > Cuti/Izin > Dinas Luar > WFH)
  const userLeaves = AppStorage.getLeaveRequests();
  const todayApprovedLeave = getApprovedLeaveForDate(
    userLeaves,
    { id: currentUser.id, name: currentUser.name },
    currentDate
  );
  const isWfhApproved = todayApprovedLeave?.category === 'WFH';
  const isBusinessTripApproved = todayApprovedLeave?.category === 'BUSINESS_TRIP';
  // WFH & Dinas Luar tetap wajib presensi, hanya lokasinya boleh di luar radius kantor
  const hasRemoteApproval = isWfhApproved || isBusinessTripApproved;
  // Cuti/Izin & Sakit = OFF, bebas presensi
  const isOffToday = Boolean(todayApprovedLeave && isOffCategory(todayApprovedLeave.category));

  // Hitung ketepatan waktu untuk Clock In berdasarkan konfigurasi Super Admin
  const punctuality = calculateClockInPunctuality(
    currentTime,
    officeConfig.workStartHour || '08:00',
    officeConfig.gracePeriodMinutes || 0
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

    if (isOffToday) {
      setSubmitError('Hari ini Anda berstatus OFF (' + (todayApprovedLeave?.category === 'SICK' ? 'Sakit' : 'Cuti / Izin') + ') sehingga tidak perlu presensi.');
      return;
    }

    if (!coords) {
      setSubmitError('Sinyal GPS lokasi belum terdeteksi. Pastikan izin lokasi browser aktif atau klik tombol Segarkan GPS.');
      return;
    }

    // Jika di luar radius dan tidak ada izin WFH/Dinas Luar yang disetujui, beri peringatan
    if (!isWithinRadius && !hasRemoteApproval) {
      setShowLocationDialog(true);
      return;
    }

    executeModalSubmit();
  };

  const executeModalSubmit = () => {
    if (!coords) return;
    setIsSubmitting(true);

    try {
      const locationStatus = isBusinessTripApproved
        ? 'DINAS_APPROVED'
        : isWfhApproved
        ? 'WFH_APPROVED'
        : isWithinRadius
        ? 'IN_OFFICE'
        : 'OUT_OF_RANGE';

      // Ketepatan waktu presensi dihitung murni dari jam masuk kerja (bukan dipaksa terlambat karena radius)
      const isLateClockIn = punctuality.status === 'LATE';
      const clockInStatusResult = isLateClockIn ? 'LATE' : 'ON_TIME';
      const lateMinutesResult = isLateClockIn ? punctuality.lateMinutes : 0;

      const newRecord: AttendanceRecord = {
        id: `att-${Date.now()}`,
        userId: currentUser.id,
        userName: currentUser.name,
        userAvatar: currentUser.avatar,
        department: currentUser.department,
        employmentType: currentUser.employmentType || 'CONTRACT',
        workMode: locationStatus === 'DINAS_APPROVED' ? 'DINAS' : locationStatus === 'WFH_APPROVED' ? 'WFH' : 'WFO',
        date: currentDate,
        clockInTime: currentTime,
        clockInLat: coords.latitude,
        clockInLng: coords.longitude,
        clockInDistanceMeter: distanceMeter,
        clockInLocationStatus: locationStatus,
        clockInStatus: clockInStatusResult,
        clockInLateMinutes: lateMinutesResult,
        notes: notes.trim() || undefined,
      };

      const { record } = saveAttendanceWithOfflineSupport(newRecord, 'CLOCK_IN');
      onSuccess(record);
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
          : 'justify-end items-center p-2.5 sm:p-4 md:p-5'
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
            : 'w-full max-w-md sm:max-w-lg h-full max-h-[calc(100vh-1.25rem)] sm:max-h-[calc(100vh-2rem)] rounded-3xl border border-slate-200/80 animate-in slide-in-from-right duration-300 ease-out'
        }`}
      >
        
        {/* Header Modal */}
        <div className="px-5 sm:px-6 py-4 border-b border-slate-100 flex items-start justify-between shrink-0 bg-white gap-3">
          {/* Top-Left Zoom Button */}
          <div className="w-9 shrink-0 flex items-start">
            <button
              type="button"
              onClick={() => setIsFullScreen(!isFullScreen)}
              className="p-1.5 sm:p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl border border-slate-200/80 transition-colors cursor-pointer shrink-0 mt-0.5"
              title={isFullScreen ? "Perkecil Tampilan" : "Perbesar Layar Penuh"}
            >
              {isFullScreen ? (
                <Minimize2 className="w-4 h-4 text-slate-600" />
              ) : (
                <Maximize2 className="w-4 h-4 text-slate-600" />
              )}
            </button>
          </div>

          {/* Judul & Subjudul diposisikan di tengah persis */}
          <div className="flex-1 min-w-0 text-center px-1 sm:px-3 space-y-0.5 flex flex-col items-center justify-center pt-0.5">
            <h3 className="font-bold text-base sm:text-lg text-slate-900 tracking-tight leading-snug">
              Presensi Masuk Kerja
            </h3>
            <p className="text-xs text-slate-500 font-medium leading-normal truncate">
              {currentUser.name} &bull; {currentUser.position || currentUser.department || 'UI UX'}
            </p>
          </div>

          {/* Container Tombol Tutup Panel di pojok kanan atas */}
          <div className="w-9 shrink-0 flex items-start justify-end">
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 sm:p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-full border border-slate-200 transition-colors cursor-pointer shrink-0 mt-0.5"
              title="Tutup"
            >
              <X className="w-4 h-4 sm:w-5 sm:h-5 text-slate-600" />
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

          {/* Status Waktu & Ketepatan (Center di Tampilan Mobile, Flex-Row di Desktop) */}
          <div className="p-4 bg-slate-50 border border-slate-200/80 rounded-xl flex flex-col items-center justify-center text-center sm:flex-row sm:items-center sm:justify-between sm:text-left gap-3">
            <div className="space-y-1 flex flex-col items-center sm:items-start text-center sm:text-left w-full sm:w-auto">
              <div className="flex items-center justify-center sm:justify-start gap-2">
                <Clock className="w-4 h-4 text-indigo-600 shrink-0" />
                <span className="text-slate-500">Waktu Presensi:</span>
                <span className="font-mono font-bold text-slate-900 text-sm">{currentTime} WIB</span>
              </div>
              <p className="text-[11px] text-slate-500 font-medium text-center sm:text-left">
                Jam Masuk Wajib: <strong className="text-slate-800">{officeConfig.workStartHour || '08:00'} WIB</strong>
              </p>
            </div>

            <div className="flex justify-center sm:justify-end w-full sm:w-auto">
              <span
                className={`inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold ${
                  punctuality.status === 'ON_TIME'
                    ? 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                    : 'bg-orange-100 text-orange-900 border border-orange-300'
                }`}
              >
                {punctuality.status === 'ON_TIME' ? (
                  <CheckCircle className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
                ) : (
                  <AlertTriangle className="w-3.5 h-3.5 text-orange-700 shrink-0" />
                )}
                {punctuality.status === 'ON_TIME' ? (isWfhApproved ? 'Hadir (WFH)' : isBusinessTripApproved ? 'Hadir (Dinas Luar)' : 'Hadir (Masuk)') : punctuality.remarks}
              </span>
            </div>
          </div>

          {/* Snapshot Geofence Radar Widget (Mengisi card secara proporsional dan penuh) */}
          <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-2xs h-[380px] flex flex-col">
            <GeolocationWidget
              officeConfig={officeConfig}
              onLocationVerified={handleLocationVerified}
              currentUser={currentUser}
              isWfhApproved={isWfhApproved}
              isBusinessTripApproved={isBusinessTripApproved}
            />
          </div>
        </div>

        {/* Modal Footer (Action Button Full-Width) */}
        <div className="px-5 sm:px-6 py-4 border-t border-slate-100 flex items-center shrink-0 bg-white">
          <button
            type="button"
            onClick={handleActionSubmit}
            disabled={isSubmitting || !coords}
            className="w-full py-3 px-6 text-white font-bold rounded-2xl shadow-xs transition-all duration-200 active:scale-[0.99] cursor-pointer disabled:opacity-50 text-xs sm:text-sm flex items-center justify-center gap-2 bg-[#1E3A8A] hover:bg-[#172554]"
          >
            <ShieldCheck className="w-4.5 h-4.5 text-white shrink-0" />
            <span>
              {isSubmitting
                ? 'Memproses Presensi...'
                : isWfhApproved
                ? 'Presensi Masuk (WFH) Sekarang'
                : isBusinessTripApproved
                ? 'Presensi Masuk (Dinas Luar) Sekarang'
                : 'Presensi Masuk Sekarang'}
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
