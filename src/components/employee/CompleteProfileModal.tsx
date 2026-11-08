import React, { useState, useRef } from 'react';
import {
  Phone,
  MapPin,
  Calendar,
  AlertCircle,
  ArrowRight,
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
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
import { compressImageFile } from '../../lib/image-compression.ts';

interface CompleteProfileModalProps {
  currentUser: UserType;
  onComplete: (updatedUser: UserType) => void;
  onLogout?: () => void;
}

export type ProfileTabKey = 'general' | 'job' | 'contact' | 'payroll';

export function CompleteProfileModal({ currentUser, onComplete, onLogout }: CompleteProfileModalProps) {
  const [activeTab, setActiveTab] = useState<ProfileTabKey>('general');
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
      console.warn('Cloudinary upload fallback to compressed base64:', err);
      try {
        const compressedBase64 = await compressImageFile(file, 300, 300, 0.75);
        setAvatar(compressedBase64);
      } catch (compressErr) {
        console.error('Failed to compress avatar fallback:', compressErr);
        const reader = new FileReader();
        reader.onload = () => {
          if (typeof reader.result === 'string') {
            setAvatar(reader.result);
          }
        };
        reader.readAsDataURL(file);
      }
    } finally {
      setIsUploading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    // Proteksi: Form HANYA boleh disimpan saat berada di langkah 4 (Informasi Rekening)
    if (activeTab !== 'payroll') {
      if (activeTab === 'general') setActiveTab('job');
      else if (activeTab === 'job') setActiveTab('contact');
      else if (activeTab === 'contact') setActiveTab('payroll');
      return;
    }

    if (!name.trim()) {
      setActiveTab('general');
      setErrorMsg('Harap isi nama lengkap Anda.');
      return;
    }

    if (!avatar) {
      setActiveTab('general');
      setErrorMsg('Harap unggah foto profil Anda terlebih dahulu.');
      return;
    }

    if (!birthDate) {
      setActiveTab('general');
      setErrorMsg('Harap pilih tanggal lahir Anda.');
      return;
    }

    if (!email.trim() || !email.includes('@')) {
      setActiveTab('contact');
      setErrorMsg('Harap isi alamat email yang valid.');
      return;
    }

    if (!department.trim()) {
      setActiveTab('job');
      setErrorMsg('Harap isi divisi / departemen Anda.');
      return;
    }

    if (!phone.trim() || phone.trim().length < 9) {
      setActiveTab('contact');
      setErrorMsg('Harap masukkan nomor WhatsApp / HP aktif yang valid.');
      return;
    }

    if (!address.trim()) {
      setActiveTab('contact');
      setErrorMsg('Harap isi alamat domisili tempat tinggal Anda.');
      return;
    }

    if (!bankAccountNumber.trim()) {
      setActiveTab('payroll');
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
    <div className="min-h-screen overflow-y-auto bg-slate-50/70 flex flex-col font-sans antialiased text-slate-900">
      
      {/* Top Navbar Header */}
      <header className="shrink-0 w-full bg-white border-b border-slate-200/80 sticky top-0 z-20">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between">
          {/* Logo & Brand */}
          <div className="flex items-center gap-3">
            <img
              src="/assets/in-time-logo.png"
              alt="in-Time indekraf presence system"
              className="h-8 w-auto object-contain select-none"
            />
          </div>

          {/* Right Action: User Info & Logout Button */}
          <div className="flex items-center gap-2.5">
            {(name || currentUser?.name || currentUser?.email) && (
              <div className="hidden sm:flex items-center gap-1.5 px-3 py-1 rounded-xl bg-slate-50 border border-slate-200/80 text-xs text-slate-600">
                <span className="text-slate-400 font-medium">Akun:</span>
                <span className="font-bold text-slate-800">{name.trim() || currentUser?.name || currentUser?.email}</span>
              </div>
            )}
            {onLogout && (
              <button
                type="button"
                onClick={onLogout}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl border border-slate-200/80 bg-white hover:bg-rose-50 hover:border-rose-200 hover:text-rose-600 text-xs font-bold text-slate-600 transition-all cursor-pointer shadow-2xs active:scale-95"
                title="Keluar dari akun"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Keluar</span>
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Main Content - Stepper Diturunkan & Kolom Form Dibungkus Card */}
      <main className="flex-1 w-full max-w-2xl mx-auto px-4 sm:px-6 pt-10 sm:pt-14 pb-12 flex flex-col justify-center">
        {/* TOP SECTION: Stepper Navigation (Posisi diturunkan lebih proporsional) */}
        <div className="shrink-0 mb-6 sm:mb-8">
          <div className="w-full max-w-xl mx-auto px-2">
            <div className="relative flex items-center justify-between">
              {/* Background connecting line */}
              <div className="absolute left-6 right-6 top-4 sm:top-4.5 h-0.5 bg-slate-200 -z-0" />

              {/* Filled progress line */}
              <div
                className="absolute left-6 top-4 sm:top-4.5 h-0.5 bg-[#1E3A8A] transition-all duration-300 -z-0"
                style={{
                  width: `${
                    activeTab === 'general'
                      ? '0%'
                      : activeTab === 'job'
                      ? '33.33%'
                      : activeTab === 'contact'
                      ? '66.66%'
                      : 'calc(100% - 48px)'
                  }`,
                }}
              />

              {[
                { id: 'general', number: 1, label: 'Informasi Umum' },
                { id: 'job', number: 2, label: 'Informasi Pekerjaan' },
                { id: 'contact', number: 3, label: 'Kontak & Alamat' },
                { id: 'payroll', number: 4, label: 'Informasi Rekening' },
              ].map((step) => {
                const currentStepNumber =
                  activeTab === 'general' ? 1 : activeTab === 'job' ? 2 : activeTab === 'contact' ? 3 : 4;
                const isCompleted = step.number < currentStepNumber;
                const isActive = step.id === activeTab;

                return (
                  <div key={step.id} className="relative z-10 flex flex-col items-center">
                    <button
                      type="button"
                      onClick={() => setActiveTab(step.id as ProfileTabKey)}
                      className={`w-8 h-8 sm:w-9 sm:h-9 rounded-full flex items-center justify-center font-bold text-xs sm:text-sm transition-all cursor-pointer ${
                        isActive
                          ? 'bg-[#1E3A8A] text-white shadow-xs ring-4 ring-blue-100'
                          : isCompleted
                          ? 'bg-[#1E3A8A] text-white shadow-xs'
                          : 'bg-white border-2 border-slate-200 text-slate-400 hover:border-slate-300'
                      }`}
                    >
                      {isCompleted ? <Check className="w-4 h-4 stroke-[2.5]" /> : step.number}
                    </button>
                    <span
                      onClick={() => setActiveTab(step.id as ProfileTabKey)}
                      className={`mt-2 text-xs font-semibold text-center cursor-pointer transition-colors max-w-[80px] sm:max-w-none leading-tight ${
                        isActive
                          ? 'text-[#1E3A8A] font-bold'
                          : isCompleted
                          ? 'text-slate-700'
                          : 'text-slate-400'
                      }`}
                    >
                      {step.label}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* MIDDLE & BOTTOM SECTION: Kolom Form dengan Card */}
        <div className="w-full bg-white border border-slate-200/90 rounded-2xl sm:rounded-3xl shadow-sm sm:shadow-md p-5 sm:p-7 md:p-8">
          {/* Error Alert di dalam Card */}
          {errorMsg && (
            <div className="mb-5 p-3.5 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs sm:text-sm flex items-center gap-2 animate-in fade-in">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
              <span className="font-semibold">{errorMsg}</span>
            </div>
          )}

          <form
            id="completeProfileForm"
            onSubmit={handleSubmit}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.target as HTMLElement).tagName !== 'TEXTAREA') {
                e.preventDefault();
                if (activeTab === 'general') setActiveTab('job');
                else if (activeTab === 'job') setActiveTab('contact');
                else if (activeTab === 'contact') setActiveTab('payroll');
              }
            }}
            className="w-full"
          >
            {/* ======================================================== */}
            {/* STEP 1: INFORMASI UMUM                                   */}
            {/* Row 1: Foto Profil sejajar Nama Lengkap                  */}
            {/* Row 2: Jenis Kelamin sejajar Tanggal Lahir               */}
            {/* ======================================================== */}
            {activeTab === 'general' && (
              <div className="space-y-4 sm:space-y-5 animate-in fade-in duration-150">
                {/* Row 1: Foto Profil & Nama Lengkap */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6 items-center">
                  {/* Foto Profil */}
                  <div className="space-y-1.5">
                    <label className="block text-xs font-semibold text-slate-700">
                      Foto Profil <span className="text-rose-500">*</span>
                    </label>
                    <div className="flex items-center gap-3">
                      <div className="relative group shrink-0">
                        {isUploading ? (
                          <div className="w-11 h-11 rounded-full bg-blue-50 border-2 border-[#1E3A8A] flex items-center justify-center text-[#1E3A8A]">
                            <Loader2 className="w-4 h-4 animate-spin" />
                          </div>
                        ) : avatar ? (
                          <img
                            src={avatar}
                            alt={currentUser.name}
                            onError={() => setAvatar('')}
                            className="w-11 h-11 rounded-full object-cover border-2 border-[#1E3A8A] bg-white shadow-xs"
                          />
                        ) : (
                          <div
                            onClick={() => !isUploading && fileInputRef.current?.click()}
                            className="w-11 h-11 rounded-full bg-slate-50 border-2 border-dashed border-slate-300 flex items-center justify-center text-slate-400 group-hover:text-[#1E3A8A] group-hover:border-[#1E3A8A] cursor-pointer transition-all"
                          >
                            <UserIcon className="w-5 h-5" />
                          </div>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
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
                          className="inline-flex items-center gap-1.5 px-3 py-2 bg-[#1E3A8A] hover:bg-[#172554] disabled:opacity-60 text-white font-bold rounded-xl text-xs shadow-2xs transition-all cursor-pointer active:scale-95"
                        >
                          <Camera className="w-3.5 h-3.5" />
                          <span>{avatar ? 'Ganti Foto' : 'Pilih Foto'}</span>
                        </button>
                        {avatar && (
                          <button
                            type="button"
                            onClick={() => {
                              setAvatar('');
                              if (fileInputRef.current) fileInputRef.current.value = '';
                            }}
                            className="p-2 border border-slate-200 hover:border-rose-200 hover:bg-rose-50 text-rose-600 rounded-xl transition-all cursor-pointer"
                            title="Hapus foto"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Nama Lengkap */}
                  <div className="space-y-1.5">
                    <label className="block text-xs font-semibold text-slate-700">
                      Nama Lengkap <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Nama lengkap sesuai KTP"
                      className="w-full h-11 px-3.5 bg-white border border-slate-300 focus:border-[#1E3A8A] focus:ring-2 focus:ring-blue-100 rounded-xl text-sm font-medium text-slate-900 transition-all outline-none"
                    />
                  </div>
                </div>

                {/* Row 2: Jenis Kelamin & Tanggal Lahir */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6 items-center">
                  {/* Jenis Kelamin */}
                  <div className="space-y-1.5">
                    <label className="block text-xs font-semibold text-slate-700">
                      Jenis Kelamin <span className="text-rose-500">*</span>
                    </label>
                    <div className="w-full h-11 bg-slate-100 p-1 rounded-xl grid grid-cols-2 gap-1 border border-slate-200/60">
                      <button
                        type="button"
                        onClick={() => setGender('L')}
                        className={`h-full rounded-lg text-xs font-bold transition-all cursor-pointer ${
                          gender === 'L'
                            ? 'bg-[#1E3A8A] text-white shadow-xs'
                            : 'text-slate-600 hover:text-slate-900 font-medium'
                        }`}
                      >
                        Laki-laki
                      </button>
                      <button
                        type="button"
                        onClick={() => setGender('P')}
                        className={`h-full rounded-lg text-xs font-bold transition-all cursor-pointer ${
                          gender === 'P'
                            ? 'bg-[#1E3A8A] text-white shadow-xs'
                            : 'text-slate-600 hover:text-slate-900 font-medium'
                        }`}
                      >
                        Perempuan
                      </button>
                    </div>
                  </div>

                  {/* Tanggal Lahir */}
                  <div className="space-y-1.5">
                    <label className="block text-xs font-semibold text-slate-700">
                      Tanggal Lahir <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="date"
                      required
                      value={birthDate}
                      onChange={(e) => setBirthDate(e.target.value)}
                      className="w-full h-11 px-3.5 bg-white border border-slate-300 focus:border-[#1E3A8A] focus:ring-2 focus:ring-blue-100 rounded-xl text-sm text-slate-900 outline-none transition-all cursor-pointer"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* ======================================================== */}
            {/* STEP 2: INFORMASI PEKERJAAN                              */}
            {/* ======================================================== */}
            {activeTab === 'job' && (
              <div className="space-y-4 sm:space-y-5 animate-in fade-in duration-150">
                {/* 2.1 Divisi / Departemen */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-slate-700">
                    Divisi / Departemen <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={department}
                    onChange={(e) => setDepartment(e.target.value)}
                    placeholder="Contoh: Operasional / Teknologi & Engineering / Marketing"
                    className="w-full h-11 px-3.5 bg-white border border-slate-300 focus:border-[#1E3A8A] focus:ring-2 focus:ring-blue-100 rounded-xl text-sm font-medium text-slate-900 outline-none transition-all"
                  />
                </div>

                {/* 2.2 Tipe Kepegawaian */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-slate-700">
                    Tipe Kepegawaian <span className="text-rose-500">*</span>
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                    {employmentOptions.map((opt) => {
                      const isSelected = employmentType === opt.id;
                      return (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => setEmploymentType(opt.id)}
                          className={`h-11 flex items-center justify-center px-2 sm:px-3 rounded-xl border text-xs transition-all cursor-pointer select-none text-center ${
                            isSelected
                              ? 'border-[#1E3A8A] bg-blue-50/70 text-[#1E3A8A] ring-1 ring-[#1E3A8A] font-bold shadow-2xs'
                              : 'border-slate-300 bg-white text-slate-700 hover:border-slate-400 font-medium'
                          }`}
                        >
                          {opt.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* ======================================================== */}
            {/* STEP 3: KONTAK & ALAMAT                                  */}
            {/* ======================================================== */}
            {activeTab === 'contact' && (
              <div className="space-y-4 sm:space-y-5 animate-in fade-in duration-150">
                {/* 3.1 Email & WhatsApp Side by Side */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
                  <div className="space-y-1.5">
                    <label className="block text-xs font-semibold text-slate-700">
                      Alamat Email <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="email@contoh.com"
                      className="w-full h-11 px-3.5 bg-white border border-slate-300 focus:border-[#1E3A8A] focus:ring-2 focus:ring-blue-100 rounded-xl text-sm font-medium text-slate-900 transition-all outline-none"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="block text-xs font-semibold text-slate-700">
                      No. WhatsApp / HP <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="tel"
                      required
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="Contoh: 081234567890"
                      className="w-full h-11 px-3.5 bg-white border border-slate-300 focus:border-[#1E3A8A] focus:ring-2 focus:ring-blue-100 rounded-xl text-sm text-slate-900 outline-none transition-all"
                    />
                  </div>
                </div>

                {/* 3.2 Alamat Domisili */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-slate-700">
                    Alamat Domisili <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="Contoh: Jl. Ijen No. 12, Klojen, Kota Malang, Jawa Timur"
                    className="w-full h-11 px-3.5 bg-white border border-slate-300 focus:border-[#1E3A8A] focus:ring-2 focus:ring-blue-100 rounded-xl text-sm font-medium text-slate-900 outline-none transition-all"
                  />
                </div>
              </div>
            )}

            {/* ======================================================== */}
            {/* STEP 4: INFORMASI REKENING                               */}
            {/* ======================================================== */}
            {activeTab === 'payroll' && (
              <div className="space-y-4 sm:space-y-5 animate-in fade-in duration-150">
                {/* 4.1 Metode Payroll & No. Rekening Side by Side */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
                  {/* Metode Payroll */}
                  <div className="space-y-1.5">
                    <label className="block text-xs font-semibold text-slate-700">
                      Metode Payroll <span className="text-rose-500">*</span>
                    </label>
                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => setIsPaymentDropdownOpen(!isPaymentDropdownOpen)}
                        className={`w-full h-11 px-3.5 flex items-center justify-between rounded-xl border text-sm font-medium transition-all cursor-pointer bg-white ${
                          isPaymentDropdownOpen
                            ? 'border-[#1E3A8A] ring-2 ring-blue-100 text-slate-900'
                            : 'border-slate-300 text-slate-800 hover:border-slate-400'
                        }`}
                      >
                        <span className="font-semibold text-slate-900 truncate">
                          {paymentMethods.find((p) => p.id === bankName)?.label || bankName}
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
                          <div className="absolute left-0 right-0 mt-1.5 bg-white border border-slate-200 rounded-2xl shadow-xl p-2 z-40 max-h-60 overflow-y-auto animate-in fade-in zoom-in-95 duration-150">
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
                                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                                    isSelected
                                      ? 'bg-blue-50 text-[#1E3A8A] font-bold'
                                      : 'text-slate-700 hover:bg-slate-50 hover:text-slate-900'
                                  }`}
                                >
                                  <span className="truncate">{method.label}</span>
                                  {isSelected && (
                                    <Check className="w-4 h-4 text-[#1E3A8A] shrink-0" />
                                  )}
                                </button>
                              );
                            })}

                            {/* Bagian: Rekening Bank */}
                            <div className="px-2.5 pt-2.5 pb-1 text-[10px] font-bold tracking-wider text-slate-400 uppercase border-t border-slate-100 mt-1">
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
                                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                                    isSelected
                                      ? 'bg-blue-50 text-[#1E3A8A] font-bold'
                                      : 'text-slate-700 hover:bg-slate-50 hover:text-slate-900'
                                  }`}
                                >
                                  <span className="truncate">{method.label}</span>
                                  {isSelected && (
                                    <Check className="w-4 h-4 text-[#1E3A8A] shrink-0" />
                                  )}
                                </button>
                              );
                            })}
                          </div>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Nomor Rekening */}
                  <div className="space-y-1.5">
                    <label className="block text-xs font-semibold text-slate-700">
                      Nomor Rekening / HP <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={bankAccountNumber}
                      onChange={(e) => setBankAccountNumber(e.target.value)}
                      placeholder="Contoh: 1234567890"
                      className="w-full h-11 px-3.5 bg-white border border-slate-300 focus:border-[#1E3A8A] focus:ring-2 focus:ring-blue-100 rounded-xl text-sm text-slate-900 outline-none transition-all"
                    />
                  </div>
                </div>

                {/* 4.2 Atas Nama */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-slate-700">
                    Atas Nama Rekening <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={bankAccountHolder}
                    onChange={(e) => setBankAccountHolder(e.target.value)}
                    placeholder="Nama sesuai di rekening / e-wallet"
                    className="w-full h-11 px-3.5 bg-white border border-slate-300 focus:border-[#1E3A8A] focus:ring-2 focus:ring-blue-100 rounded-xl text-sm font-medium text-slate-900 outline-none transition-all"
                  />
                </div>
              </div>
            )}
          </form>

          {/* Card Footer: Navigation Buttons */}
          <div className="mt-6 sm:mt-7 pt-5 border-t border-slate-100 flex items-center justify-between">
            {activeTab !== 'general' ? (
              <button
                type="button"
                onClick={() => {
                  if (activeTab === 'job') setActiveTab('general');
                  else if (activeTab === 'contact') setActiveTab('job');
                  else if (activeTab === 'payroll') setActiveTab('contact');
                }}
                className="w-10 h-10 rounded-full border border-slate-200 text-slate-600 hover:text-[#1E3A8A] hover:border-[#1E3A8A] hover:bg-blue-50/50 flex items-center justify-center transition-all cursor-pointer active:scale-95 shadow-2xs"
                title="Sebelumnya"
                aria-label="Sebelumnya"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
            ) : (
              <div className="w-10 h-10" />
            )}

            {activeTab !== 'payroll' ? (
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  if (activeTab === 'general') setActiveTab('job');
                  else if (activeTab === 'job') setActiveTab('contact');
                  else if (activeTab === 'contact') setActiveTab('payroll');
                }}
                className="w-10 h-10 rounded-full bg-[#1E3A8A] hover:bg-[#172554] text-white flex items-center justify-center shadow-xs transition-all cursor-pointer active:scale-95"
                title="Selanjutnya"
                aria-label="Selanjutnya"
              >
                <ArrowRight className="w-5 h-5" />
              </button>
            ) : (
              <button
                type="submit"
                form="completeProfileForm"
                disabled={isSubmitting || isUploading}
                className="w-10 h-10 rounded-full bg-[#1E3A8A] hover:bg-[#172554] disabled:opacity-50 text-white flex items-center justify-center shadow-xs transition-all cursor-pointer disabled:cursor-not-allowed active:scale-95"
                title="Simpan & Selesaikan"
                aria-label="Simpan & Selesaikan"
              >
                {isSubmitting ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <Check className="w-5 h-5 stroke-[2.5]" />
                )}
              </button>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
