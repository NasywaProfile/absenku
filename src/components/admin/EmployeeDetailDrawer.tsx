import React, { useState, useEffect } from 'react';
import {
  X,
  Maximize2,
  Minimize2,
  User as UserIcon,
  Mail,
  Phone,
  Building2,
  Calendar,
  CreditCard,
  MapPin,
  ShieldCheck,
  Check,
  Copy,
  Briefcase,
  HeartHandshake,
} from 'lucide-react';
import { User, EmploymentType, UserRole, AttendanceRecord, DailyTaskLog } from '../../types/index.ts';
import { EMPLOYMENT_TYPE_LABELS, copyTextToClipboard } from '../../lib/whatsapp-recap.ts';

interface EmployeeDetailDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  employee: User | null;
  currentUser?: User;
  attendanceHistory?: AttendanceRecord[];
  dailyTasks?: DailyTaskLog[];
  onUpdateRole?: (userId: string, newRole: UserRole) => void;
  onUpdateType?: (userId: string, newType: EmploymentType) => void;
  onToggleStatus?: (userId: string) => void;
}

export function EmployeeDetailDrawer({
  isOpen,
  onClose,
  employee,
}: EmployeeDetailDrawerProps) {
  // Hanya menampilkan tab Data Diri dan Finansial sesuai permintaan
  const [activeTab, setActiveTab] = useState<'DATA_DIRI' | 'FINANSIAL'>('DATA_DIRI');
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [copiedBank, setCopiedBank] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      setActiveTab('DATA_DIRI');
      setCopiedBank(false);
    }
  }, [isOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !employee) return null;

  const handleCopyAccount = async (text?: string) => {
    if (!text) return;
    const ok = await copyTextToClipboard(text);
    if (ok) {
      setCopiedBank(true);
      setTimeout(() => setCopiedBank(false), 2000);
    }
  };

  const fallbackAvatar = `https://ui-avatars.com/api/?name=${encodeURIComponent(
    employee.name
  )}&background=1E3A8A&color=ffffff&size=256&bold=true`;
  const avatarSrc = employee.avatar && employee.avatar.trim() !== '' ? employee.avatar : fallbackAvatar;

  return (
    <div
      className={`fixed inset-0 z-50 flex animate-in fade-in duration-200 ${
        isFullScreen
          ? 'items-center justify-center p-0'
          : 'justify-end items-center p-2.5 sm:p-4 md:p-5'
      }`}
    >
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-950/50 backdrop-blur-xs transition-opacity duration-300 cursor-pointer"
        onClick={onClose}
      />

      <div
        className={`relative z-10 bg-white shadow-2xl flex flex-col min-h-0 overflow-hidden transition-all duration-300 font-sans ${
          isFullScreen
            ? 'w-full h-full max-w-none max-h-none rounded-none border-0'
            : 'w-full max-w-md sm:max-w-lg md:max-w-xl h-full max-h-[calc(100vh-1.25rem)] sm:max-h-[calc(100vh-2rem)] rounded-3xl border border-slate-200/80 animate-in slide-in-from-right duration-300 ease-out'
        }`}
      >
        {/* Header Drawer */}
        <div className="px-6 py-5 bg-white text-slate-900 flex items-center justify-between border-b border-slate-100 shrink-0 font-sans">
          <div className="flex items-center gap-3.5 min-w-0">
            {/* Zoom / Fullscreen Button */}
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

            {/* Foto Profil Karyawan */}
            <div className="relative w-12 h-12 rounded-2xl overflow-hidden bg-slate-100 border border-slate-200 shrink-0 shadow-2xs">
              <img
                src={avatarSrc}
                alt={employee.name}
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).src = fallbackAvatar;
                }}
                className="w-full h-full object-cover"
              />
            </div>

            {/* Nama & Posisi */}
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-extrabold text-base text-slate-900 truncate leading-snug">
                  {employee.name}
                </h3>
                <span
                  className={`text-[10px] font-extrabold px-2.5 py-0.5 rounded-full border shrink-0 ${
                    employee.status === 'ACTIVE'
                      ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                      : employee.status === 'PENDING_APPROVAL'
                      ? 'bg-amber-50 text-amber-900 border-amber-200'
                      : 'bg-rose-50 text-rose-800 border-rose-200'
                  }`}
                >
                  {employee.status === 'ACTIVE'
                    ? 'Aktif'
                    : employee.status === 'PENDING_APPROVAL'
                    ? 'Menunggu Persetujuan'
                    : 'Non-Aktif'}
                </span>
              </div>
              <p className="text-xs text-slate-500 font-medium truncate mt-0.5">
                {employee.position} &bull; {employee.department}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-full border border-slate-200 transition-colors cursor-pointer shrink-0"
            title="Tutup"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Navigation: Khusus Data Diri & Finansial */}
        <div className="flex items-center border-b border-slate-200 px-6 bg-slate-50/70 shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab('DATA_DIRI')}
            className={`py-3 px-4 text-xs font-bold border-b-2 transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === 'DATA_DIRI'
                ? 'border-[#1E3A8A] text-[#1E3A8A]'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <UserIcon className="w-3.5 h-3.5" />
            <span>Data Diri</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('FINANSIAL')}
            className={`py-3 px-4 text-xs font-bold border-b-2 transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === 'FINANSIAL'
                ? 'border-[#1E3A8A] text-[#1E3A8A]'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <CreditCard className="w-3.5 h-3.5" />
            <span>Finansial</span>
          </button>
        </div>

        {/* Drawer Body */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-5">
          {/* TAB 1: DATA DIRI */}
          {activeTab === 'DATA_DIRI' && (
            <div className="space-y-4 animate-in fade-in duration-200 text-xs sm:text-sm">
              {/* 1. Informasi Pekerjaan & Kepegawaian */}
              <div className="space-y-2.5">
                <h4 className="font-bold text-[11px] text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Briefcase className="w-3.5 h-3.5 text-slate-400" />
                  <span>Informasi Pekerjaan</span>
                </h4>
                <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200/80 space-y-2.5">
                  <div className="flex items-center justify-between py-1 border-b border-slate-200/50">
                    <span className="text-slate-500 font-medium">Jabatan / Posisi</span>
                    <span className="font-bold text-slate-900">{employee.position || '-'}</span>
                  </div>
                  <div className="flex items-center justify-between py-1 border-b border-slate-200/50">
                    <span className="text-slate-500 font-medium">Departemen / Divisi</span>
                    <span className="font-bold text-slate-900">{employee.department || '-'}</span>
                  </div>
                  <div className="flex items-center justify-between py-1 border-b border-slate-200/50">
                    <span className="text-slate-500 font-medium">Tipe Kepegawaian</span>
                    <span className="font-bold text-slate-900">
                      {EMPLOYMENT_TYPE_LABELS[employee.employmentType] || employee.employmentType}
                    </span>
                  </div>
                  <div className="flex items-center justify-between py-1 border-b border-slate-200/50">
                    <span className="text-slate-500 font-medium">Peran Akun</span>
                    <span className="font-bold text-[#1E3A8A]">
                      {employee.role === 'SUPER_ADMIN'
                        ? 'Super Admin (Direksi)'
                        : employee.role === 'ADMIN'
                        ? 'Admin Operasional'
                        : 'Karyawan'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between py-1 border-b border-slate-200/50">
                    <span className="text-slate-500 font-medium">Tanggal Bergabung</span>
                    <span className="font-bold text-slate-900 font-mono">{employee.joinDate || '-'}</span>
                  </div>
                  <div className="flex items-center justify-between py-1">
                    <span className="text-slate-500 font-medium">Sisa Cuti Tahunan</span>
                    <span className="font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200 text-xs">
                      {employee.leaveBalance || 12} Hari
                    </span>
                  </div>
                </div>
              </div>

              {/* 2. Kontak & Alamat Domisili */}
              <div className="space-y-2.5">
                <h4 className="font-bold text-[11px] text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Mail className="w-3.5 h-3.5 text-slate-400" />
                  <span>Kontak &amp; Alamat</span>
                </h4>
                <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200/80 space-y-2.5">
                  <div className="flex items-center justify-between py-1 border-b border-slate-200/50">
                    <span className="text-slate-500 font-medium">Email Kantor</span>
                    <span className="font-bold text-slate-900 font-mono">{employee.email}</span>
                  </div>
                  <div className="flex items-center justify-between py-1 border-b border-slate-200/50">
                    <span className="text-slate-500 font-medium">Nomor WhatsApp / Telepon</span>
                    <span className="font-bold text-slate-900 font-mono">{employee.phone || '-'}</span>
                  </div>
                  <div className="flex items-start justify-between py-1">
                    <span className="text-slate-500 font-medium shrink-0 mr-4">Alamat Domisili</span>
                    <span className="font-bold text-slate-900 text-right leading-snug">
                      {employee.address || '-'}
                    </span>
                  </div>
                </div>
              </div>

              {/* 3. Kontak Darurat (Emergency Contact) */}
              <div className="space-y-2.5">
                <h4 className="font-bold text-[11px] text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                  <HeartHandshake className="w-3.5 h-3.5 text-slate-400" />
                  <span>Kontak Darurat</span>
                </h4>
                <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200/80 space-y-2.5">
                  <div className="flex items-center justify-between py-1 border-b border-slate-200/50">
                    <span className="text-slate-500 font-medium">Nama Kerabat / Hubungan</span>
                    <span className="font-bold text-slate-900">{employee.emergencyContactName || '-'}</span>
                  </div>
                  <div className="flex items-center justify-between py-1">
                    <span className="text-slate-500 font-medium">Nomor Telepon Darurat</span>
                    <span className="font-bold text-slate-900 font-mono">{employee.emergencyContactPhone || '-'}</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: FINANSIAL */}
          {activeTab === 'FINANSIAL' && (
            <div className="space-y-5 animate-in fade-in duration-200 text-xs sm:text-sm">
              {/* Kartu Bank / Rekening Digital */}
              <div className="relative overflow-hidden rounded-2xl p-5 bg-gradient-to-br from-[#1E3A8A] via-[#1e40af] to-[#172554] text-white shadow-lg space-y-5">
                {/* Background Decorator */}
                <div className="absolute -right-8 -top-8 w-36 h-36 rounded-full bg-white/10 blur-xl pointer-events-none" />
                <div className="absolute -left-8 -bottom-8 w-36 h-36 rounded-full bg-blue-400/10 blur-xl pointer-events-none" />

                {/* Top Card Row */}
                <div className="flex items-center justify-between relative z-10">
                  <div className="flex items-center gap-2">
                    <CreditCard className="w-5 h-5 text-blue-200" />
                    <span className="font-bold text-xs uppercase tracking-wider text-blue-100">
                      Rekening Payroll
                    </span>
                  </div>
                  <span className="font-extrabold text-sm tracking-wide text-white">
                    {employee.bankName || 'BCA (Bank Central Asia)'}
                  </span>
                </div>

                {/* Account Number Display */}
                <div className="space-y-1 relative z-10 pt-1">
                  <span className="text-[10px] text-blue-200 uppercase tracking-wider block font-semibold">
                    Nomor Rekening
                  </span>
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-mono text-xl sm:text-2xl font-extrabold tracking-wider text-white">
                      {employee.bankAccountNumber || 'Belum diisi'}
                    </p>
                    {employee.bankAccountNumber && (
                      <button
                        type="button"
                        onClick={() => handleCopyAccount(employee.bankAccountNumber)}
                        className="px-2.5 py-1 bg-white/20 hover:bg-white/30 text-white rounded-lg text-xs font-semibold flex items-center gap-1 cursor-pointer transition shadow-2xs active:scale-95 shrink-0"
                        title="Salin Nomor Rekening"
                      >
                        {copiedBank ? (
                          <>
                            <Check className="w-3.5 h-3.5 text-emerald-300" />
                            <span className="text-[11px] text-emerald-300">Tersalin!</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5" />
                            <span className="text-[11px]">Salin</span>
                          </>
                        )}
                      </button>
                    )}
                  </div>
                </div>

                {/* Cardholder Name */}
                <div className="flex items-end justify-between relative z-10 pt-2 border-t border-white/15">
                  <div>
                    <span className="text-[10px] text-blue-200 uppercase tracking-wider block font-semibold">
                      Atas Nama (Pemilik Rekening)
                    </span>
                    <p className="font-bold text-sm text-white truncate max-w-[280px]">
                      {employee.bankAccountHolder || employee.name}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 text-[11px] font-semibold text-emerald-300 bg-emerald-950/40 px-2.5 py-0.5 rounded-full border border-emerald-400/30">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    <span>Terverifikasi</span>
                  </div>
                </div>
              </div>

              {/* Rincian Finansial Tabel */}
              <div className="space-y-2.5">
                <h4 className="font-bold text-[11px] text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Building2 className="w-3.5 h-3.5 text-slate-400" />
                  <span>Detail Data Finansial &amp; Bank</span>
                </h4>
                <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200/80 space-y-2.5">
                  <div className="flex items-center justify-between py-1 border-b border-slate-200/50">
                    <span className="text-slate-500 font-medium">Bank Penyalur</span>
                    <span className="font-bold text-slate-900">{employee.bankName || 'BCA (Bank Central Asia)'}</span>
                  </div>
                  <div className="flex items-center justify-between py-1 border-b border-slate-200/50">
                    <span className="text-slate-500 font-medium">Nomor Rekening</span>
                    <span className="font-bold text-slate-900 font-mono">{employee.bankAccountNumber || '-'}</span>
                  </div>
                  <div className="flex items-center justify-between py-1 border-b border-slate-200/50">
                    <span className="text-slate-500 font-medium">Nama Pemilik Rekening</span>
                    <span className="font-bold text-slate-900">{employee.bankAccountHolder || employee.name}</span>
                  </div>
                  <div className="flex items-center justify-between py-1">
                    <span className="text-slate-500 font-medium">Status Rekening Payroll</span>
                    <span className="font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200 text-xs">
                      Aktif &amp; Terverifikasi
                    </span>
                  </div>
                </div>
                <p className="text-[11px] text-slate-400 italic px-1">
                  * Rekening ini digunakan untuk pencairan gaji bulanan, pembayaran tunjangan, serta proses reimbursement resmi kantor.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Drawer Footer */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between shrink-0">
          <span className="text-xs text-slate-400">
            ID: <strong className="font-mono text-slate-600">{employee.id}</strong>
          </span>
        </div>
      </div>
    </div>
  );
}
