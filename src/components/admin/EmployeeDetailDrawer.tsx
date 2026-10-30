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
  onUpdateRole,
  onUpdateType,
  onToggleStatus,
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
        {/* Header Drawer (Horizontal Compact Header dengan posisi center di antara icon zoom dan icon silang) */}
        <div className="px-5 py-4 bg-white text-slate-900 flex items-center justify-between border-b border-slate-100 shrink-0 font-sans gap-2">
          {/* Sisi Kiri: Zoom / Fullscreen Button */}
          <div className="w-10 shrink-0 flex items-center justify-start">
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
          </div>

          {/* Sisi Tengah (Center di antara icon zoom dan icon silang) */}
          <div className="flex-1 flex items-center justify-center gap-3.5 min-w-0">
            {/* Foto Profil Karyawan */}
            <div className="relative w-12 h-12 rounded-full overflow-hidden bg-slate-100 border border-slate-200 shrink-0 shadow-2xs">
              <img
                src={avatarSrc}
                alt={employee.name}
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).src = fallbackAvatar;
                }}
                className="w-full h-full object-cover"
              />
            </div>

            {/* Nama, Status, & Divisi - Tipe Kepegawaian */}
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-extrabold text-base text-slate-900 truncate leading-snug">
                  {employee.name}
                </h3>

                {/* Status Button (Tanpa teks Ubah, tetap bisa diklik untuk toggle status) */}
                <button
                  type="button"
                  onClick={() => onToggleStatus && onToggleStatus(employee.id)}
                  title="Klik untuk mengubah status aktif karyawan"
                  className={`text-[10px] font-extrabold px-2.5 py-0.5 rounded-full border shrink-0 flex items-center gap-1.5 cursor-pointer transition-all hover:scale-105 active:scale-95 shadow-2xs ${
                    employee.status === 'ACTIVE'
                      ? 'bg-emerald-50 text-emerald-800 border-emerald-300 hover:bg-emerald-100'
                      : 'bg-rose-50 text-rose-800 border-rose-300 hover:bg-rose-100'
                  }`}
                >
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${
                      employee.status === 'ACTIVE' ? 'bg-emerald-500' : 'bg-rose-500'
                    }`}
                  />
                  <span>{employee.status === 'ACTIVE' ? 'Aktif' : 'Tidak Aktif'}</span>
                </button>
              </div>

              {/* Posisi Subtitle: Departemen / Divisi - Tipe Kepegawaian */}
              <p className="text-xs text-slate-500 font-semibold truncate mt-0.5">
                {employee.department || 'Operasional'} - {EMPLOYMENT_TYPE_LABELS[employee.employmentType] || employee.employmentType}
              </p>
            </div>
          </div>

          {/* Sisi Kanan: Close (Silang) Button */}
          <div className="w-10 shrink-0 flex items-center justify-end">
            <button
              type="button"
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-full border border-slate-200 transition-colors cursor-pointer shrink-0"
              title="Tutup"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
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
                    <span className="text-slate-500 font-medium">Departemen / Divisi</span>
                    <span className="font-bold text-slate-900">{employee.department || '-'}</span>
                  </div>
                  <div className="flex items-center justify-between py-1.5 border-b border-slate-200/50 gap-3">
                    <span className="text-slate-500 font-medium shrink-0">Tipe Kepegawaian</span>
                    <select
                      value={employee.employmentType}
                      onChange={(e) => onUpdateType && onUpdateType(employee.id, e.target.value as EmploymentType)}
                      className="text-xs font-bold bg-white border border-slate-200 text-slate-800 rounded-xl px-2.5 py-1.5 focus:outline-hidden focus:ring-2 focus:ring-[#1E3A8A] focus:border-[#1E3A8A] shadow-2xs cursor-pointer transition-colors"
                      title="Ubah tipe kepegawaian staf"
                    >
                      <option value="INTERN">Magang</option>
                      <option value="CONTRACT">Kontrak</option>
                      <option value="PERMANENT">Tetap</option>
                      <option value="FREELANCE">Freelance</option>
                    </select>
                  </div>
                  <div className="flex items-center justify-between py-1.5 border-b border-slate-200/50 gap-3">
                    <span className="text-slate-500 font-medium shrink-0">Peran Akun</span>
                    <select
                      value={employee.role}
                      onChange={(e) => onUpdateRole && onUpdateRole(employee.id, e.target.value as UserRole)}
                      className="text-xs font-bold bg-white border border-slate-200 text-[#1E3A8A] rounded-xl px-2.5 py-1.5 focus:outline-hidden focus:ring-2 focus:ring-[#1E3A8A] focus:border-[#1E3A8A] shadow-2xs cursor-pointer transition-colors"
                      title="Ubah peran akun staf"
                    >
                      <option value="EMPLOYEE">Karyawan</option>
                      <option value="ADMIN">Admin</option>
                      <option value="SUPER_ADMIN">Superadmin</option>
                    </select>
                  </div>
                  <div className="flex items-center justify-between py-1 border-b border-slate-200/50">
                    <span className="text-slate-500 font-medium">Tanggal Bergabung</span>
                    <span className="font-bold text-slate-900 font-mono">{employee.joinDate || '-'}</span>
                  </div>
                  <div className="flex items-center justify-between py-1.5">
                    <span className="text-slate-500 font-medium">Status Akun Karyawan</span>
                    <button
                      type="button"
                      onClick={() => onToggleStatus && onToggleStatus(employee.id)}
                      className={`text-xs font-bold px-3 py-1 rounded-xl border flex items-center gap-1.5 cursor-pointer transition-all hover:scale-105 active:scale-95 shadow-2xs ${
                        employee.status === 'ACTIVE'
                          ? 'bg-emerald-50 text-emerald-800 border-emerald-300 hover:bg-emerald-100'
                          : 'bg-rose-50 text-rose-800 border-rose-300 hover:bg-rose-100'
                      }`}
                      title="Klik untuk mengubah status aktif karyawan"
                    >
                      <span
                        className={`w-1.5 h-1.5 rounded-full ${
                          employee.status === 'ACTIVE' ? 'bg-emerald-500' : 'bg-rose-500'
                        }`}
                      />
                      <span>{employee.status === 'ACTIVE' ? 'Aktif' : 'Tidak Aktif'}</span>
                    </button>
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
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
