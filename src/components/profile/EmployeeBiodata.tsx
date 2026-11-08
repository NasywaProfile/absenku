import React, { useState, useEffect, useRef } from 'react';
import {
  CheckCircle2,
  AlertCircle,
  ChevronDown,
  Check,
  Loader2,
  User as UserIcon,
  Camera,
  Trash2,
  ArrowRight,
  ArrowLeft,
  X,
} from 'lucide-react';
import { User, EmploymentType } from '../../types/index.ts';
import { AppStorage } from '../../lib/storage.ts';
import { uploadToCloudinary } from '../../lib/cloudinary.ts';
import { compressImageFile } from '../../lib/image-compression.ts';
import { sendRealEmail, generateEmailHtmlTemplate } from '../../lib/real-email.ts';

export type BiodataTabKey = 'general' | 'job' | 'contact' | 'payroll';

interface EmployeeBiodataProps {
  currentUser: User | null;
  onUserUpdated: (updatedUser: User) => void;
}

// Komponen Logo Resmi Brand Bank & E-Wallet
export function PaymentMethodLogo({ id, className = "w-6 h-6 shrink-0" }: { id: string; className?: string }) {
  switch (id) {
    case 'BCA':
      return (
        <div className={`${className} rounded-md bg-[#00529C] flex items-center justify-center text-white font-extrabold text-[10px] tracking-tight shadow-xs select-none`}>
          BCA
        </div>
      );
    case 'Bank Mandiri':
      return (
        <div className={`${className} rounded-md bg-[#002D62] flex items-center justify-center relative overflow-hidden shadow-xs select-none`}>
          <span className="text-white font-extrabold text-[8px] tracking-tighter z-10">MANDIRI</span>
          <div className="absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full bg-[#F6A800] opacity-80" />
        </div>
      );
    case 'BNI':
      return (
        <div className={`${className} rounded-md bg-[#006677] flex items-center justify-center relative overflow-hidden shadow-xs select-none`}>
          <span className="text-white font-extrabold text-[9px] tracking-tight z-10">BNI</span>
          <div className="absolute top-0 right-0 w-2 h-2 rounded-full bg-[#F15A24]" />
        </div>
      );
    case 'BRI':
      return (
        <div className={`${className} rounded-md bg-[#00529C] flex items-center justify-center relative overflow-hidden shadow-xs select-none`}>
          <span className="text-white font-black text-[9px] tracking-tight z-10">BRI</span>
          <div className="absolute -bottom-1 left-0 right-0 h-1 bg-[#F37021]" />
        </div>
      );
    case 'Bank Syariah Indonesia (BSI)':
      return (
        <div className={`${className} rounded-md bg-[#00A39D] flex items-center justify-center text-white font-extrabold text-[9px] tracking-tight shadow-xs select-none`}>
          BSI
        </div>
      );
    case 'CIMB Niaga':
      return (
        <div className={`${className} rounded-md bg-[#ED1B24] flex items-center justify-center text-white font-extrabold text-[8px] tracking-tight shadow-xs select-none`}>
          CIMB
        </div>
      );
    case 'Bank Jago':
      return (
        <div className={`${className} rounded-md bg-[#82397F] flex items-center justify-center text-[#FBBA00] font-black text-[9px] tracking-tight shadow-xs select-none`}>
          jago
        </div>
      );
    case 'SeaBank':
      return (
        <div className={`${className} rounded-md bg-[#FA5825] flex items-center justify-center text-white font-extrabold text-[8px] tracking-tight shadow-xs select-none`}>
          Sea
        </div>
      );
    case 'GoPay':
      return (
        <div className={`${className} rounded-md bg-[#00AED6] flex items-center justify-center relative shadow-xs select-none`}>
          <div className="w-3.5 h-3.5 rounded-full border-2 border-white flex items-center justify-center">
            <div className="w-1.5 h-1.5 rounded-full bg-white" />
          </div>
        </div>
      );
    case 'OVO':
      return (
        <div className={`${className} rounded-md bg-[#4C3494] flex items-center justify-center text-white font-black text-[9px] tracking-tight shadow-xs select-none`}>
          OVO
        </div>
      );
    case 'DANA':
      return (
        <div className={`${className} rounded-md bg-[#118EEA] flex items-center justify-center text-white font-extrabold text-[8px] tracking-tight shadow-xs select-none`}>
          DANA
        </div>
      );
    case 'ShopeePay':
      return (
        <div className={`${className} rounded-md bg-[#EE4D2D] flex items-center justify-center relative shadow-xs select-none text-white font-black text-[8px]`}>
          SPay
        </div>
      );
    case 'LinkAja':
      return (
        <div className={`${className} rounded-md bg-[#ED1C24] flex items-center justify-center text-white font-black text-[8px] tracking-tighter shadow-xs select-none`}>
          Link!
        </div>
      );
    default:
      return (
        <div className={`${className} rounded-md bg-slate-800 flex items-center justify-center text-white font-bold text-[9px]`}>
          PAY
        </div>
      );
  }
}

export function EmployeeBiodata({ currentUser, onUserUpdated }: EmployeeBiodataProps) {
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [successMessage, setSuccessMessage] = useState('Biodata diri berhasil diperbarui dan disimpan!');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState<BiodataTabKey>('general');

  // Form Fields - Profil Umum
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [gender, setGender] = useState<'L' | 'P'>('L');
  const [birthDate, setBirthDate] = useState('2000-01-01');
  const [avatar, setAvatar] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  
  // Divisi (Input Text Box) & Role Kerja
  const [department, setDepartment] = useState('Operasional');
  const [employmentType, setEmploymentType] = useState<EmploymentType>('CONTRACT');

  // Alamat Tempat Tinggal
  const [address, setAddress] = useState('');

  // Form Fields - Payroll (Bank & E-Wallet)
  const [bankName, setBankName] = useState('BCA');
  const [bankAccountNumber, setBankAccountNumber] = useState('');
  const [bankAccountHolder, setBankAccountHolder] = useState('');
  const [isPaymentDropdownOpen, setIsPaymentDropdownOpen] = useState(false);

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

  useEffect(() => {
    if (currentUser) {
      setName(currentUser.name || '');
      setEmail(currentUser.email || '');
      setPhone(currentUser.phone || '');
      setGender(currentUser.gender || 'L');
      setBirthDate(currentUser.birthDate || '2000-01-01');
      setAddress(currentUser.address || '');
      setAvatar(currentUser.avatar || '');
      setDepartment(currentUser.department || 'Operasional');
      setEmploymentType(currentUser.employmentType || 'CONTRACT');
      setBankName(currentUser.bankName || 'BCA');
      setBankAccountNumber(currentUser.bankAccountNumber || '');
      setBankAccountHolder(currentUser.bankAccountHolder || currentUser.name || '');
    }
  }, [currentUser]);

  if (!currentUser) return null;

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      setErrorMessage('Ukuran file foto maksimal 10MB.');
      return;
    }

    setIsUploading(true);
    setErrorMessage(null);

    try {
      const result = await uploadToCloudinary(file, {
        folder: 'absenku/avatars',
        resourceType: 'image',
      });
      setAvatar(result.url);
    } catch (err) {
      console.warn('Cloudinary upload fallback to compressed base64:', err);
      try {
        const compressed = await compressImageFile(file, 300, 300, 0.75);
        setAvatar(compressed);
      } catch (compErr) {
        console.error('Gagal kompresi foto profil:', compErr);
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

  const handleSaveAll = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setErrorMessage(null);

    if (!name.trim()) {
      setActiveTab('general');
      setErrorMessage('Harap isi nama lengkap Anda.');
      return;
    }

    if (!email.trim() || !email.includes('@')) {
      setActiveTab('contact');
      setErrorMessage('Format alamat email tidak valid.');
      return;
    }

    setIsSubmitting(true);

    const oldEmail = currentUser.email?.trim().toLowerCase();
    const newEmail = email.trim();
    const isEmailChanged = Boolean(oldEmail && newEmail.toLowerCase() !== oldEmail);

    const updated = AppStorage.updateUserProfile(currentUser.id, {
      name: name.trim(),
      email: newEmail,
      phone: phone.trim(),
      gender,
      birthDate: birthDate ? birthDate.trim() : (currentUser.birthDate || '2000-01-01'),
      address: address.trim(),
      avatar: avatar || currentUser.avatar,
      department: department.trim(),
      position: department.trim() || currentUser.position,
      employmentType,
      bankName: bankName.trim(),
      bankAccountNumber: bankAccountNumber.trim(),
      bankAccountHolder: bankAccountHolder.trim() || name.trim(),
      isProfileComplete: true,
    });

    if (isEmailChanged) {
      const emailSubject = `[in-Time] Konfirmasi Pembaruan Email Akun ${currentUser.role === 'SUPER_ADMIN' ? 'Super Admin' : 'Pengguna'}`;
      const now = new Date();
      const dateFormatted = new Intl.DateTimeFormat('id-ID', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      }).format(now);
      const timeFormatted = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')} WIB`;

      const emailHtml = generateEmailHtmlTemplate({
        title: 'Konfirmasi Pembaruan Email Akun',
        recipientName: name.trim() || currentUser.name,
        intro: `Halo <strong>${name.trim() || currentUser.name}</strong>, pemberitahuan ini mengonfirmasi bahwa alamat email untuk akun ${currentUser.role === 'SUPER_ADMIN' ? 'Super Administrator' : 'pengguna'} Anda pada platform operasional in-Time telah berhasil diperbarui dan diverifikasi.`,
        fields: [
          { label: 'Nama Pengguna', value: name.trim() || currentUser.name },
          { label: 'Peran Akun', value: currentUser.role === 'SUPER_ADMIN' ? 'Super Administrator' : currentUser.role === 'ADMIN' ? 'Administrator' : 'Karyawan' },
          { label: 'Email Baru', value: `<strong>${newEmail}</strong>` },
          { label: 'Email Sebelumnya', value: currentUser.email || '-' },
          { label: 'Waktu Pembaruan', value: `${dateFormatted}, ${timeFormatted}` },
          { label: 'Status Akun', value: '<span style="color: #16a34a; font-weight: bold;">Aktif & Terverifikasi</span>' },
        ],
        actionText: 'Buka Portal in-Time',
        footerNote: 'Pemberitahuan resmi: Seluruh korespondensi dan notifikasi penugasan selanjutnya akan dikirimkan ke alamat email ini.',
      });

      sendRealEmail({
        to: newEmail,
        subject: emailSubject,
        html: emailHtml,
        text: `Konfirmasi Pembaruan Email Akun in-Time: Alamat email untuk akun ${name.trim()} berhasil diubah ke ${newEmail} pada ${dateFormatted}, ${timeFormatted}.`,
      });

      AppStorage.addEmailNotification({
        id: `email_change_${Date.now()}`,
        toEmail: newEmail,
        toName: name.trim() || currentUser.name,
        fromName: 'Sistem in-Time Notifier',
        fromEmail: 'system@in-time.id',
        subject: emailSubject,
        employeeName: name.trim() || currentUser.name,
        category: 'Pembaruan Akun',
        reason: `Alamat email akun telah berhasil diperbarui menjadi ${newEmail}.`,
        directApprovalLink: '#profile',
        sentAt: `${now.toISOString().split('T')[0]} ${timeFormatted.replace(' WIB', '')}`,
        read: false,
        recipientRole: currentUser.role,
      });
    }

    setTimeout(() => {
      setIsSubmitting(false);
      if (updated) {
        onUserUpdated(updated);
        setSuccessMessage(
          isEmailChanged
            ? `Biodata diri berhasil diperbarui! Notifikasi konfirmasi resmi telah dikirimkan ke inbox email baru: ${newEmail}.`
            : 'Biodata diri berhasil diperbarui dan disimpan!'
        );
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 5000);
      }
    }, 300);
  };

  return (
    <div className="w-full max-w-2xl mx-auto px-4 sm:px-6 pt-4 sm:pt-6 pb-14 font-sans antialiased">
      {/* TOP SECTION: Stepper Navigation (Sama persis seperti halaman lengkapi profil di awal) */}
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
                    onClick={() => setActiveTab(step.id as BiodataTabKey)}
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
                    onClick={() => setActiveTab(step.id as BiodataTabKey)}
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
        {/* Alert Error */}
        {errorMessage && (
          <div className="mb-5 p-3.5 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs sm:text-sm flex items-center gap-2 animate-in fade-in">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
            <span className="font-semibold">{errorMessage}</span>
          </div>
        )}

        <form
          id="employeeBiodataForm"
          onSubmit={handleSaveAll}
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

        {/* Card Footer: Navigation & Save Buttons */}
        <div className="mt-6 sm:mt-7 pt-5 border-t border-slate-100 flex items-center justify-between flex-wrap gap-3">
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

          <div className="flex items-center gap-2.5 ml-auto">
            {activeTab !== 'payroll' ? (
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
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
                type="button"
                onClick={handleSaveAll}
                disabled={isSubmitting || isUploading}
                className="w-10 h-10 rounded-full bg-[#1E3A8A] hover:bg-[#172554] disabled:opacity-50 text-white flex items-center justify-center shadow-xs transition-all cursor-pointer disabled:cursor-not-allowed active:scale-95"
                title="Simpan Perubahan"
                aria-label="Simpan Perubahan"
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
      </div>

      {/* Pop-up Kecil Sukses di Kanan Bawah (Floating Toast di Luar Card) */}
      {saveSuccess && (
        <div className="fixed bottom-6 right-6 z-50 max-w-sm sm:max-w-md bg-white border border-emerald-200 text-slate-800 p-4 rounded-2xl shadow-xl flex items-start gap-3 animate-in fade-in slide-in-from-bottom-5 duration-300">
          <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0 mt-0.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="flex-1 min-w-0 pr-1">
            <p className="text-xs font-bold text-slate-900 leading-snug">Berhasil Disimpan!</p>
            <p className="text-[11px] text-slate-600 leading-snug mt-0.5">{successMessage}</p>
          </div>
          <button
            type="button"
            onClick={() => setSaveSuccess(false)}
            className="p-1 text-slate-400 hover:text-slate-700 rounded-lg transition-colors cursor-pointer shrink-0 -mr-1 -mt-1"
            title="Tutup notifikasi"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
}

