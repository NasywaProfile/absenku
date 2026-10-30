import React, { useState, useRef } from 'react';
import {
  Phone,
  MapPin,
  Calendar,
  AlertCircle,
  ArrowRight,
  Camera,
  Upload,
  User as UserIcon,
  Trash2,
  Loader2,
  Cloud,
  Mail,
  Building2,
  Briefcase,
  CreditCard,
  ChevronDown,
  Check,
  LogOut,
  X,
} from 'lucide-react';
import { User as UserType, EmploymentType } from '../../types/index.ts';
import { uploadToCloudinary } from '../../lib/cloudinary.ts';
import { PaymentMethodLogo } from '../profile/EmployeeBiodata.tsx';

interface CompleteProfileModalProps {
  currentUser: UserType;
  onComplete: (updatedUser: UserType) => void;
  onLogout?: () => void;
}

export function CompleteProfileModal({ currentUser, onComplete, onLogout }: CompleteProfileModalProps) {
  // Pre-filled fields dari pendaftaran akun (bisa di-edit oleh karyawan)
  const [name, setName] = useState(currentUser.name || '');
  const [email, setEmail] = useState(currentUser.email || '');
  const [department, setDepartment] = useState(currentUser.department || 'Operasional');
  const [employmentType, setEmploymentType] = useState<EmploymentType>(
    currentUser.employmentType || 'CONTRACT'
  );

  // Jika avatar sudah ada, tampilkan
  const [avatar, setAvatar] = useState(
    currentUser.avatar && (currentUser.avatar.startsWith('data:image/') || currentUser.avatar.startsWith('http'))
      ? currentUser.avatar
      : ''
  );
  const [phone, setPhone] = useState(currentUser.phone || '');
  const [gender, setGender] = useState<'L' | 'P'>(currentUser.gender || 'L');
  const [birthDate, setBirthDate] = useState(currentUser.birthDate || '2000-01-01');
  const [address, setAddress] = useState(currentUser.address || '');

  // Informasi Rekening / Payroll
  const [bankName, setBankName] = useState(currentUser.bankName || 'BCA');
  const [bankAccountNumber, setBankAccountNumber] = useState(currentUser.bankAccountNumber || '');
  const [bankAccountHolder, setBankAccountHolder] = useState(currentUser.bankAccountHolder || currentUser.name || '');
  const [isPaymentDropdownOpen, setIsPaymentDropdownOpen] = useState(false);
  
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Pilihan Bank & E-Wallet
  const paymentMethods = [
    // Dompet Digital (E-Wallet)
    { id: 'GoPay', label: 'GoPay', type: 'ewallet' },
    { id: 'OVO', label: 'OVO', type: 'ewallet' },
    { id: 'DANA', label: 'DANA', type: 'ewallet' },
    { id: 'ShopeePay', label: 'ShopeePay', type: 'ewallet' },
    { id: 'LinkAja', label: 'LinkAja', type: 'ewallet' },
    // Rekening Bank
    { id: 'BCA', label: 'BCA (Bank Central Asia)', type: 'bank' },
    { id: 'Bank Mandiri', label: 'Bank Mandiri', type: 'bank' },
    { id: 'BNI', label: 'Bank BNI', type: 'bank' },
    { id: 'BRI', label: 'Bank BRI', type: 'bank' },
    { id: 'Bank Syariah Indonesia (BSI)', label: 'Bank Syariah Indonesia (BSI)', type: 'bank' },
    { id: 'CIMB Niaga', label: 'CIMB Niaga', type: 'bank' },
    { id: 'Bank Jago', label: 'Bank Jago', type: 'bank' },
    { id: 'SeaBank', label: 'SeaBank', type: 'bank' },
  ];

  const employmentOptions: { id: EmploymentType; label: string }[] = [
    { id: 'CONTRACT', label: 'Karyawan Kontrak' },
    { id: 'PERMANENT', label: 'Karyawan Tetap' },
    { id: 'FREELANCE', label: 'Freelance' },
    { id: 'INTERN', label: 'Magang (Internship)' },
  ];

  // Handler Upload Foto dari Galeri / Kamera
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      setErrorMsg('Ukuran file foto maksimal 10MB.');
      return;
    }

    setIsUploading(true);
    setErrorMsg(null);
    try {
      const result = await uploadToCloudinary(file, {
        folder: 'absenku/avatars',
        resourceType: 'image',
      });
      setAvatar(result.url);
    } catch (err) {
      console.warn('Cloudinary upload fallback to base64:', err);
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          setAvatar(reader.result);
        }
      };
      reader.readAsDataURL(file);
    } finally {
      setIsUploading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!name.trim()) {
      setErrorMsg('Harap isi nama lengkap Anda.');
      return;
    }

    if (!email.trim() || !email.includes('@')) {
      setErrorMsg('Harap isi alamat email yang valid.');
      return;
    }

    if (!department.trim()) {
      setErrorMsg('Harap isi divisi / departemen Anda.');
      return;
    }

    if (!avatar) {
      setErrorMsg('Harap unggah foto profil Anda terlebih dahulu.');
      return;
    }

    if (!phone.trim() || phone.trim().length < 9) {
      setErrorMsg('Harap masukkan nomor WhatsApp / HP aktif yang valid.');
      return;
    }

    if (!birthDate) {
      setErrorMsg('Harap pilih tanggal lahir Anda.');
      return;
    }

    if (!address.trim()) {
      setErrorMsg('Harap isi alamat domisili tempat tinggal Anda.');
      return;
    }

    if (!bankAccountNumber.trim()) {
      setErrorMsg('Harap isi nomor rekening / nomor HP e-wallet Anda.');
      return;
    }

    setIsSubmitting(true);

    const updatedUser: UserType = {
      ...currentUser,
      name: name.trim(),
      email: email.trim().toLowerCase(),
      department: department.trim(),
      position: department.trim() || 'Staf Operasional',
      employmentType,
      avatar,
      phone: phone.trim(),
      gender,
      birthDate,
      address: address.trim(),
      bankName: bankName.trim(),
      bankAccountNumber: bankAccountNumber.trim(),
      bankAccountHolder: bankAccountHolder.trim() || name.trim(),
      isProfileComplete: true, // Data diri telah lengkap
    };

    setTimeout(() => {
      setIsSubmitting(false);
      onComplete(updatedUser);
    }, 350);
  };

  const initials = (name || currentUser.name || 'KR')
    .split(' ')
    .filter(Boolean)
    .map((n) => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase() || 'KR';

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col justify-between items-center py-6 sm:py-10 px-4 sm:px-6 font-sans antialiased text-slate-900">
      
      {/* Top Logout Button */}
      {onLogout && (
        <div className="w-full max-w-3xl flex items-center justify-end pb-4">
          <button
            type="button"
            onClick={onLogout}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-2xl border border-slate-200 bg-white hover:bg-rose-50 hover:border-rose-200 hover:text-rose-600 text-xs font-bold text-slate-600 transition-all cursor-pointer shadow-2xs"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Keluar</span>
          </button>
        </div>
      )}

      {/* Main Full-Page Form Container Card */}
      <div className="w-full max-w-3xl space-y-6 my-auto">

        {/* Error Alert */}
        {errorMsg && (
          <div className="p-4 bg-rose-50 border border-rose-200 text-rose-700 rounded-2xl text-xs flex items-center gap-2.5 animate-in fade-in">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
            <span className="font-semibold text-xs sm:text-sm">{errorMsg}</span>
          </div>
        )}

        <form id="completeProfileForm" onSubmit={handleSubmit} className="space-y-6">
          
          {/* ======================================================== */}
          {/* 1. INFORMASI UMUM                                        */}
          {/* ======================================================== */}
          <div className="bg-white rounded-3xl border border-slate-200 shadow-xs p-5 sm:p-7 space-y-6">
            <div className="flex items-center gap-3 pb-3 border-b border-slate-100">
              <div className="w-8 h-8 rounded-2xl bg-blue-50 text-[#1E3A8A] flex items-center justify-center font-bold">
                <UserIcon className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-base sm:text-lg font-bold text-slate-900">
                  Informasi Umum
                </h2>
                <p className="text-xs text-slate-500">
                  Data identitas dasar diri karyawan
                </p>
              </div>
            </div>

            <div className="space-y-5">
              {/* 1.1 Foto Profil */}
              <div className="p-4 bg-slate-50/70 border border-slate-200/90 rounded-2xl space-y-3">
                <div className="flex items-center justify-between">
                  <label className="block font-bold text-slate-900 text-xs sm:text-sm">
                    Foto Profil <span className="text-rose-500">*</span>
                  </label>
                  {avatar && (
                    <button
                      type="button"
                      onClick={() => {
                        setAvatar('');
                        if (fileInputRef.current) fileInputRef.current.value = '';
                      }}
                      className="inline-flex items-center gap-1 text-[11px] text-rose-600 hover:text-rose-700 font-bold hover:underline cursor-pointer"
                    >
                      <Trash2 className="w-3 h-3" />
                      <span>Hapus Foto</span>
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-3.5 sm:gap-4">
                  {/* Avatar Preview / User Icon */}
                  <div className="relative group shrink-0">
                    {isUploading ? (
                      <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-blue-50 border-2 border-[#1E3A8A] flex flex-col items-center justify-center text-[#1E3A8A]">
                        <Loader2 className="w-6 h-6 animate-spin" />
                        <span className="text-[9px] font-bold mt-1">Unggah...</span>
                      </div>
                    ) : avatar ? (
                      <img
                        src={avatar}
                        alt={currentUser.name}
                        onError={() => setAvatar('')}
                        className="w-16 h-16 sm:w-20 sm:h-20 rounded-full object-cover border-2 border-[#1E3A8A] shadow-xs bg-slate-100"
                      />
                    ) : (
                      /* Default ketika belum ada foto: Clean User Icon */
                      <div
                        onClick={() => !isUploading && fileInputRef.current?.click()}
                        className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-slate-100 border-2 border-dashed border-slate-300 flex items-center justify-center text-slate-400 group-hover:text-[#1E3A8A] group-hover:border-[#1E3A8A] cursor-pointer transition-all shadow-inner shrink-0"
                        title="Klik untuk unggah foto profil"
                      >
                        <UserIcon className="w-8 h-8 sm:w-10 sm:h-10 transition-colors" />
                      </div>
                    )}

                    {!isUploading && (
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        title={avatar ? 'Ganti foto profil' : 'Unggah foto profil'}
                        className="absolute inset-0 bg-black/40 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-white cursor-pointer"
                      >
                        <Camera className="w-5 h-5" />
                      </button>
                    )}
                  </div>

                  {/* Upload Button & Info */}
                  <div className="space-y-1.5 flex-1 min-w-0">
                    <input
                      type="file"
                      ref={fileInputRef}
                      accept="image/*"
                      disabled={isUploading}
                      onChange={handleFileChange}
                      className="hidden"
                    />
                    <button
                      type="button"
                      disabled={isUploading}
                      onClick={() => fileInputRef.current?.click()}
                      className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 bg-[#1E3A8A] hover:bg-[#172554] disabled:opacity-60 disabled:cursor-not-allowed text-white font-bold rounded-2xl text-xs shadow-2xs transition-all duration-200 cursor-pointer whitespace-nowrap active:scale-[0.98]"
                    >
                      {isUploading ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />
                      ) : (
                        <Upload className="w-3.5 h-3.5 shrink-0 stroke-[2.5]" />
                      )}
                      <span>Unggah Foto Anda</span>
                    </button>
                    <p className="text-[11px] text-slate-500 font-medium leading-tight">
                      {isUploading ? (
                        <span className="text-blue-600 font-medium inline-flex items-center gap-1">
                          <Cloud className="w-3 h-3" /> Mengunggah ke Cloudinary...
                        </span>
                      ) : avatar ? (
                        'Foto profil tersimpan. Klik untuk mengganti.'
                      ) : (
                        'Format JPG atau PNG (Ukuran Maksimal 10MB).'
                      )}
                    </p>
                  </div>
                </div>
              </div>

              {/* 1.2 Nama Lengkap & Email */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="block text-sm font-semibold text-slate-800">
                    Nama Lengkap <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Nama lengkap KTP"
                    className="w-full h-11 px-4 bg-white border border-slate-200 focus:border-[#1E3A8A] focus:ring-2 focus:ring-blue-100 rounded-2xl text-sm font-medium text-slate-900 transition-all outline-none"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block text-sm font-semibold text-slate-800">
                    Alamat Email <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="email@contoh.com"
                    className="w-full h-11 px-4 bg-white border border-slate-200 focus:border-[#1E3A8A] focus:ring-2 focus:ring-blue-100 rounded-2xl text-sm font-medium text-slate-900 transition-all outline-none font-mono"
                  />
                </div>
              </div>

              {/* 1.3 Jenis Kelamin & Tanggal Lahir */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="block text-sm font-semibold text-slate-800">
                    Jenis Kelamin <span className="text-rose-500">*</span>
                  </label>
                  <div className="grid grid-cols-2 gap-2 pt-0.5">
                    <button
                      type="button"
                      onClick={() => setGender('L')}
                      className={`h-11 px-3 rounded-2xl border text-sm font-bold transition-all cursor-pointer ${
                        gender === 'L'
                          ? 'bg-[#1E3A8A] text-white border-[#1E3A8A] shadow-2xs'
                          : 'bg-white text-slate-600 border-slate-200 hover:text-[#1E3A8A] hover:bg-slate-50'
                      }`}
                    >
                      Laki-laki
                    </button>
                    <button
                      type="button"
                      onClick={() => setGender('P')}
                      className={`h-11 px-3 rounded-2xl border text-sm font-bold transition-all cursor-pointer ${
                        gender === 'P'
                          ? 'bg-[#1E3A8A] text-white border-[#1E3A8A] shadow-2xs'
                          : 'bg-white text-slate-600 border-slate-200 hover:text-[#1E3A8A] hover:bg-slate-50'
                      }`}
                    >
                      Perempuan
                    </button>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-sm font-semibold text-slate-800">
                    Tanggal Lahir <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={birthDate}
                    onChange={(e) => setBirthDate(e.target.value)}
                    className="w-full h-11 px-4 bg-white border border-slate-200 focus:border-[#1E3A8A] focus:ring-2 focus:ring-blue-100 rounded-2xl text-sm text-slate-900 outline-none transition-all cursor-pointer"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* ======================================================== */}
          {/* 2. INFORMASI PEKERJAAN                                   */}
          {/* ======================================================== */}
          <div className="bg-white rounded-3xl border border-slate-200 shadow-xs p-5 sm:p-7 space-y-6">
            <div className="flex items-center gap-3 pb-3 border-b border-slate-100">
              <div className="w-8 h-8 rounded-2xl bg-indigo-50 text-indigo-700 flex items-center justify-center font-bold">
                <Briefcase className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-base sm:text-lg font-bold text-slate-900">
                  Informasi Pekerjaan
                </h2>
                <p className="text-xs text-slate-500">
                  Posisi divisi dan status kontrak kepegawaian
                </p>
              </div>
            </div>

            <div className="space-y-5">
              {/* 2.1 Divisi */}
              <div className="space-y-1.5">
                <label className="block text-sm font-semibold text-slate-800">
                  Divisi / Departemen <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                  placeholder="Contoh: Operasional / Teknologi & Engineering / Marketing"
                  className="w-full h-11 px-4 bg-white border border-slate-200 focus:border-[#1E3A8A] focus:ring-2 focus:ring-blue-100 rounded-2xl text-sm font-medium text-slate-900 outline-none transition-all"
                />
              </div>

              {/* 2.2 Tipe Kepegawaian */}
              <div className="space-y-2">
                <label className="block text-sm font-semibold text-slate-800">
                  Tipe Kepegawaian <span className="text-rose-500">*</span>
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {employmentOptions.map((opt) => {
                    const isSelected = employmentType === opt.id;
                    return (
                      <div
                        key={opt.id}
                        onClick={() => setEmploymentType(opt.id)}
                        className={`flex items-center gap-3 px-3.5 py-3 rounded-2xl border transition-all cursor-pointer select-none ${
                          isSelected
                            ? 'border-[#1E3A8A] bg-blue-50/60 text-[#1E3A8A] ring-1 ring-[#1E3A8A]/30 shadow-2xs font-bold'
                            : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50/60'
                        }`}
                      >
                        <div
                          className={`w-5 h-5 rounded-full border flex items-center justify-center shrink-0 transition-all ${
                            isSelected
                              ? 'border-[#1E3A8A] bg-white ring-2 ring-blue-100'
                              : 'border-slate-300 bg-white'
                          }`}
                        >
                          {isSelected && (
                            <div className="w-2.5 h-2.5 rounded-full bg-[#1E3A8A]" />
                          )}
                        </div>
                        <span className="text-sm font-semibold truncate">
                          {opt.label}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          {/* ======================================================== */}
          {/* 3. KONTAK & ALAMAT                                       */}
          {/* ======================================================== */}
          <div className="bg-white rounded-3xl border border-slate-200 shadow-xs p-5 sm:p-7 space-y-6">
            <div className="flex items-center gap-3 pb-3 border-b border-slate-100">
              <div className="w-8 h-8 rounded-2xl bg-emerald-50 text-emerald-700 flex items-center justify-center font-bold">
                <Phone className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-base sm:text-lg font-bold text-slate-900">
                  Kontak &amp; Alamat
                </h2>
                <p className="text-xs text-slate-500">
                  Nomor kontak WhatsApp aktif dan alamat domisili tempat tinggal
                </p>
              </div>
            </div>

            <div className="space-y-5">
              {/* 3.1 No. WhatsApp */}
              <div className="space-y-1.5">
                <label className="block text-sm font-semibold text-slate-800">
                  No. WhatsApp / HP Aktif <span className="text-rose-500">*</span>
                </label>
                <input
                  type="tel"
                  required
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="Contoh: 081234567890"
                  className="w-full h-11 px-4 bg-white border border-slate-200 focus:border-[#1E3A8A] focus:ring-2 focus:ring-blue-100 rounded-2xl text-sm font-mono text-slate-900 outline-none transition-all"
                />
              </div>

              {/* 3.2 Alamat Tempat Tinggal */}
              <div className="space-y-1.5">
                <label className="block text-sm font-semibold text-slate-800">
                  Alamat Domisili Tempat Tinggal <span className="text-rose-500">*</span>
                </label>
                <textarea
                  required
                  rows={2}
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Contoh: Jl. Ijen No. 12, Klojen, Kota Malang, Jawa Timur"
                  className="w-full p-3.5 bg-white border border-slate-200 focus:border-[#1E3A8A] focus:ring-2 focus:ring-blue-100 rounded-2xl text-sm text-slate-900 transition-all outline-none resize-none font-medium"
                />
              </div>
            </div>
          </div>

          {/* ======================================================== */}
          {/* 4. INFORMASI REKENING                                    */}
          {/* ======================================================== */}
          <div className="bg-white rounded-3xl border border-slate-200 shadow-xs p-5 sm:p-7 space-y-6">
            <div className="flex items-center gap-3 pb-3 border-b border-slate-100">
              <div className="w-8 h-8 rounded-2xl bg-amber-50 text-amber-700 flex items-center justify-center font-bold">
                <CreditCard className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-base sm:text-lg font-bold text-slate-900">
                  Informasi Rekening
                </h2>
                <p className="text-xs text-slate-500">
                  Pencairan gaji dan tunjangan via Bank / E-Wallet
                </p>
              </div>
            </div>

            <div className="space-y-5">
              {/* 4.1 Metode Payroll */}
              <div className="space-y-1.5 relative">
                <label className="block text-sm font-semibold text-slate-800">
                  Metode Payroll (Bank / E-Wallet) <span className="text-rose-500">*</span>
                </label>
                
                <button
                  type="button"
                  onClick={() => setIsPaymentDropdownOpen(!isPaymentDropdownOpen)}
                  className={`w-full h-11 px-4 flex items-center justify-between rounded-2xl border text-sm font-medium transition-all cursor-pointer bg-white ${
                    isPaymentDropdownOpen
                      ? 'border-[#1E3A8A] ring-2 ring-blue-100 text-slate-900'
                      : 'border-slate-200 text-slate-800 hover:border-slate-300'
                  }`}
                >
                  <span className="flex items-center gap-2.5 truncate">
                    <PaymentMethodLogo id={bankName} className="w-5 h-5 shrink-0" />
                    <span className="font-semibold text-slate-900">{bankName}</span>
                  </span>
                  <ChevronDown
                    className={`w-4 h-4 text-slate-500 transition-transform duration-200 ${
                      isPaymentDropdownOpen ? 'rotate-180' : ''
                    }`}
                  />
                </button>

                {/* Popover Pilihan Brand */}
                {isPaymentDropdownOpen && (
                  <>
                    <div
                      className="fixed inset-0 z-30"
                      onClick={() => setIsPaymentDropdownOpen(false)}
                    />
                    <div className="absolute left-0 right-0 mt-1.5 bg-white border border-slate-200 rounded-2xl shadow-xl p-2 z-40 max-h-68 overflow-y-auto animate-in fade-in zoom-in-95 duration-150">
                      
                      {/* Bagian: Dompet Digital (E-Wallet) */}
                      <div className="px-2.5 py-1 text-[10px] font-bold tracking-wider text-slate-400 uppercase">
                        Dompet Digital (E-Wallet)
                      </div>
                      {paymentMethods.filter(p => p.type === 'ewallet').map((method) => {
                        const isSelected = bankName === method.id;
                        return (
                          <button
                            key={method.id}
                            type="button"
                            onClick={() => {
                              setBankName(method.id);
                              setIsPaymentDropdownOpen(false);
                            }}
                            className={`w-full flex items-center justify-between px-3 py-2 rounded-2xl text-xs font-semibold transition-all cursor-pointer ${
                              isSelected
                                ? 'bg-indigo-50 text-indigo-700 font-bold'
                                : 'text-slate-700 hover:bg-slate-50 hover:text-slate-900'
                            }`}
                          >
                            <span className="flex items-center gap-2.5">
                              <PaymentMethodLogo id={method.id} className="w-5 h-5" />
                              <span>{method.label}</span>
                            </span>
                            {isSelected && (
                              <Check className="w-4 h-4 text-indigo-600" />
                            )}
                          </button>
                        );
                      })}

                      {/* Bagian: Rekening Bank */}
                      <div className="px-2.5 pt-3 pb-1 text-[10px] font-bold tracking-wider text-slate-400 uppercase border-t border-slate-100 mt-1">
                        Rekening Bank
                      </div>
                      {paymentMethods.filter(p => p.type === 'bank').map((method) => {
                        const isSelected = bankName === method.id;
                        return (
                          <button
                            key={method.id}
                            type="button"
                            onClick={() => {
                              setBankName(method.id);
                              setIsPaymentDropdownOpen(false);
                            }}
                            className={`w-full flex items-center justify-between px-3 py-2 rounded-2xl text-xs font-semibold transition-all cursor-pointer ${
                              isSelected
                                ? 'bg-indigo-50 text-indigo-700 font-bold'
                                : 'text-slate-700 hover:bg-slate-50 hover:text-slate-900'
                            }`}
                          >
                            <span className="flex items-center gap-2.5">
                              <PaymentMethodLogo id={method.id} className="w-5 h-5" />
                              <span>{method.label}</span>
                            </span>
                            {isSelected && (
                              <Check className="w-4 h-4 text-indigo-600" />
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </>
                )}
              </div>

              {/* 4.2 Nomor Rekening & Atas Nama */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="block text-sm font-semibold text-slate-800">
                    Nomor Rekening / HP <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={bankAccountNumber}
                    onChange={(e) => setBankAccountNumber(e.target.value)}
                    placeholder="Contoh: 1234567890"
                    className="w-full h-11 px-4 bg-white border border-slate-200 focus:border-[#1E3A8A] focus:ring-2 focus:ring-blue-100 rounded-2xl text-sm font-mono text-slate-900 outline-none transition-all"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block text-sm font-semibold text-slate-800">
                    Nama Pemilik Rekening <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={bankAccountHolder}
                    onChange={(e) => setBankAccountHolder(e.target.value)}
                    placeholder="Nama sesuai di buku tabungan / e-wallet"
                    className="w-full h-11 px-4 bg-white border border-slate-200 focus:border-[#1E3A8A] focus:ring-2 focus:ring-blue-100 rounded-2xl text-sm font-medium text-slate-900 outline-none transition-all"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Submit Button */}
          <div className="pt-2">
            <button
              type="submit"
              disabled={isSubmitting || isUploading}
              className="w-full py-4 px-6 bg-[#1E3A8A] hover:bg-[#172554] disabled:opacity-50 text-white font-bold rounded-2xl text-sm sm:text-base shadow-sm transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer disabled:cursor-not-allowed active:scale-[0.99]"
            >
              <span>
                {isUploading
                  ? 'Sedang Mengunggah Foto...'
                  : isSubmitting
                  ? 'Menyimpan Biodata Diri...'
                  : 'Simpan Data Diri & Lanjutkan'}
              </span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>

        </form>

      </div>

    </div>
  );
}
