import React, { useState, useEffect, useRef } from 'react';
import {
  Pencil,
  X,
  CheckCircle2,
  AlertCircle,
  ChevronDown,
  Check,
  Loader2,
  Cloud,
  User as UserIcon,
  Briefcase,
  Phone,
  CreditCard,
} from 'lucide-react';
import { User, EmploymentType } from '../../types/index.ts';
import { AppStorage } from '../../lib/storage.ts';
import { uploadToCloudinary } from '../../lib/cloudinary.ts';

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
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Form Fields - Profil Umum
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [gender, setGender] = useState<'L' | 'P'>('L');
  const [birthDate, setBirthDate] = useState('');
  const [avatar, setAvatar] = useState('');
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  
  // Divisi (Input Text Box) & Role Kerja
  const [department, setDepartment] = useState('');
  const [employmentType, setEmploymentType] = useState<EmploymentType>('PERMANENT');

  // Alamat Tempat Tinggal
  const [city, setCity] = useState('Jakarta Selatan');
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

  // Opsi Tipe Kerja / Role Kerja (Hanya label nama, tanpa teks penjelasan di bawahnya)
  const employmentOptions: { id: EmploymentType; label: string }[] = [
    { id: 'PERMANENT', label: 'Karyawan Tetap' },
    { id: 'CONTRACT', label: 'Karyawan Kontrak' },
    { id: 'FREELANCE', label: 'Freelance' },
    { id: 'INTERN', label: 'Magang (Internship)' },
  ];

  useEffect(() => {
    if (currentUser) {
      setName(currentUser.name || '');
      setEmail(currentUser.email || '');
      setPhone(currentUser.phone || '');
      setGender(currentUser.gender || 'L');
      setBirthDate(currentUser.birthDate || '');
      setAddress(currentUser.address || '');
      setAvatar(currentUser.avatar || '');
      setDepartment(currentUser.department || 'Teknologi & Produk');
      setEmploymentType(currentUser.employmentType || 'PERMANENT');
      setBankName(currentUser.bankName || 'BCA');
      setBankAccountNumber(currentUser.bankAccountNumber || '');
      setBankAccountHolder(currentUser.bankAccountHolder || currentUser.name || '');
    }
  }, [currentUser]);

  if (!currentUser) return null;

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      setErrorMessage('Ukuran file foto maksimal 10MB.');
      return;
    }

    setIsUploadingAvatar(true);
    setErrorMessage(null);

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
      setIsUploadingAvatar(false);
    }
  };

  const handleSaveAll = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!name.trim()) {
      setErrorMessage('Nama lengkap tidak boleh kosong.');
      return;
    }

    if (!email.trim() || !email.includes('@')) {
      setErrorMessage('Format alamat email tidak valid.');
      return;
    }

    const updated = AppStorage.updateUserProfile(currentUser.id, {
      name: name.trim(),
      email: email.trim(),
      phone: phone.trim(),
      gender,
      birthDate: birthDate.trim(),
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

    if (updated) {
      onUserUpdated(updated);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    }
  };

  const initials = (name || currentUser.name || 'KR')
    .split(' ')
    .filter(Boolean)
    .map((n) => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase() || 'KR';

  return (
    <div className="max-w-4xl mx-auto pb-14 font-sans antialiased">
      {/* Alert Notifikasi Sukses */}
      {saveSuccess && (
        <div className="mb-6 flex items-center justify-between rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-3.5 text-sm text-emerald-900 shadow-xs animate-in fade-in">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
            <span className="font-semibold">Biodata karyawan dan data payroll berhasil diperbarui!</span>
          </div>
          <span className="text-xs bg-emerald-100 text-emerald-800 px-3 py-1 rounded-full font-bold">
            Tersimpan
          </span>
        </div>
      )}

      {/* Alert Notifikasi Error */}
      {errorMessage && (
        <div className="mb-6 flex items-center gap-2.5 rounded-2xl border border-rose-200 bg-rose-50 px-5 py-3.5 text-sm text-rose-900 animate-in fade-in">
          <AlertCircle className="h-5 w-5 text-rose-600 shrink-0" />
          <span className="font-medium">{errorMessage}</span>
        </div>
      )}


      <form onSubmit={handleSaveAll} className="space-y-6">
        
        {/* ======================================================== */}
        {/* 1. INFORMASI UMUM                                        */}
        {/* Urutan: Nama, Email, Foto, Jenis Kelamin, Tanggal Lahir */}
        {/* ======================================================== */}
        <div className="bg-white rounded-3xl border border-slate-200 shadow-xs p-5 sm:p-7 space-y-6">
          <div className="flex items-center gap-3 pb-3 border-b border-slate-100">
            <div className="w-8 h-8 rounded-xl bg-blue-50 text-[#1E3A8A] flex items-center justify-center font-bold">
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
            <div className="space-y-2">
              <label className="block text-sm font-semibold text-slate-800">
                Foto Profil
              </label>
              <div className="flex items-center gap-4 p-4 rounded-2xl bg-slate-50/70 border border-slate-150">
                <div className="relative group shrink-0">
                  <div className="w-20 h-20 rounded-full bg-blue-50 border-2 border-white shadow-md flex items-center justify-center overflow-hidden ring-2 ring-slate-200 relative">
                    {isUploadingAvatar ? (
                      <div className="flex flex-col items-center justify-center gap-1">
                        <Loader2 className="w-5 h-5 animate-spin text-[#1E3A8A]" />
                        <span className="text-[9px] font-bold text-[#1E3A8A]">Unggah...</span>
                      </div>
                    ) : avatar ? (
                      <img
                        src={avatar}
                        alt={name || currentUser.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <span className="text-xl font-bold text-[#1E3A8A]">
                        {initials}
                      </span>
                    )}
                  </div>

                  <button
                    type="button"
                    disabled={isUploadingAvatar}
                    onClick={() => fileInputRef.current?.click()}
                    className="absolute bottom-0 right-0 w-7 h-7 rounded-full bg-[#1E3A8A] hover:bg-[#172554] text-white flex items-center justify-center shadow-md transition-all cursor-pointer border-2 border-white group-hover:scale-105 disabled:opacity-60 disabled:cursor-not-allowed"
                    title="Ganti Foto Profil"
                  >
                    {isUploadingAvatar ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <Pencil className="w-3.5 h-3.5" />
                    )}
                  </button>

                  <input
                    type="file"
                    ref={fileInputRef}
                    accept="image/*"
                    disabled={isUploadingAvatar}
                    onChange={handleAvatarChange}
                    className="hidden"
                  />
                </div>

                <div className="space-y-1 text-xs text-slate-500">
                  <p className="font-semibold text-slate-800">Unggah Foto Diri</p>
                  <p className="text-[11px] text-slate-400 leading-tight">
                    {isUploadingAvatar ? (
                      <span className="text-blue-600 font-medium inline-flex items-center gap-1">
                        <Cloud className="w-3 h-3" /> Mengunggah ke Cloudinary...
                      </span>
                    ) : (
                      'Format JPG, PNG atau WebP (Maksimal 10MB).'
                    )}
                  </p>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="text-xs font-semibold text-[#1E3A8A] hover:underline cursor-pointer inline-flex items-center gap-1 mt-0.5"
                  >
                    Pilih Foto Baru
                  </button>
                </div>
              </div>
            </div>

            {/* 1.2 Nama Lengkap */}
            <div className="space-y-1.5">
              <label className="block text-sm font-semibold text-slate-800">
                Nama Lengkap <span className="text-rose-500">*</span>
              </label>
              <div className="relative flex items-center">
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Masukkan nama lengkap"
                  className="w-full h-11 px-4 pr-10 bg-white border border-slate-200 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-50 rounded-xl text-sm font-medium text-slate-900 transition-all outline-none"
                />
                {name && (
                  <button
                    type="button"
                    onClick={() => setName('')}
                    className="absolute right-3 p-1 text-slate-400 hover:text-slate-600 rounded-full cursor-pointer transition-colors"
                    title="Hapus teks"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>

            {/* 1.3 Email */}
            <div className="space-y-1.5">
              <label className="block text-sm font-semibold text-slate-800">
                Alamat Email <span className="text-rose-500">*</span>
              </label>
              <div className="relative flex items-center">
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="nama@perusahaan.id"
                  className="w-full h-11 px-4 pr-11 bg-white border border-slate-200 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-50 rounded-xl text-sm font-medium text-slate-900 transition-all outline-none font-mono"
                />
                <div className="absolute right-3.5 text-slate-400 font-semibold text-base pointer-events-none">
                  @
                </div>
              </div>
            </div>

            {/* 1.4 Jenis Kelamin */}
            <div className="space-y-2">
              <label className="block text-sm font-semibold text-slate-800">
                Jenis Kelamin
              </label>
              <div className="flex items-center gap-6 pt-0.5">
                <label
                  onClick={() => setGender('L')}
                  className="flex items-center gap-2.5 cursor-pointer text-sm font-medium text-slate-800 select-none group"
                >
                  <div
                    className={`w-5 h-5 rounded-full border flex items-center justify-center transition-all ${
                      gender === 'L'
                        ? 'border-[#1E3A8A] bg-white ring-2 ring-blue-100'
                        : 'border-slate-300 bg-white group-hover:border-slate-400'
                    }`}
                  >
                    {gender === 'L' && (
                      <div className="w-2.5 h-2.5 rounded-full bg-[#1E3A8A]" />
                    )}
                  </div>
                  <span>Laki-laki</span>
                </label>

                <label
                  onClick={() => setGender('P')}
                  className="flex items-center gap-2.5 cursor-pointer text-sm font-medium text-slate-800 select-none group"
                >
                  <div
                    className={`w-5 h-5 rounded-full border flex items-center justify-center transition-all ${
                      gender === 'P'
                        ? 'border-[#1E3A8A] bg-white ring-2 ring-blue-100'
                        : 'border-slate-300 bg-white group-hover:border-slate-400'
                    }`}
                  >
                    {gender === 'P' && (
                      <div className="w-2.5 h-2.5 rounded-full bg-[#1E3A8A]" />
                    )}
                  </div>
                  <span>Perempuan</span>
                </label>
              </div>
            </div>

            {/* 1.5 Tanggal Lahir */}
            <div className="space-y-1.5">
              <label className="block text-sm font-semibold text-slate-800">
                Tanggal Lahir
              </label>
              <input
                type="date"
                value={birthDate}
                onChange={(e) => setBirthDate(e.target.value)}
                className="w-full h-11 px-4 bg-white border border-slate-200 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-50 rounded-xl text-sm text-slate-900 outline-none transition-all"
              />
            </div>
          </div>
        </div>

        {/* ======================================================== */}
        {/* 2. INFORMASI PEKERJAAN                                   */}
        {/* Urutan: Divisi, Tipe Kepegawaian                         */}
        {/* ======================================================== */}
        <div className="bg-white rounded-3xl border border-slate-200 shadow-xs p-5 sm:p-7 space-y-6">
          <div className="flex items-center gap-3 pb-3 border-b border-slate-100">
            <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-700 flex items-center justify-center font-bold">
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
                Divisi
              </label>
              <input
                type="text"
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                placeholder="Contoh: Teknologi & Produk"
                className="w-full h-11 px-4 bg-white border border-slate-200 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-50 rounded-xl text-sm text-slate-900 outline-none transition-all"
              />
            </div>

            {/* 2.2 Tipe Kepegawaian */}
            <div className="space-y-2">
              <label className="block text-sm font-semibold text-slate-800">
                Tipe Kepegawaian
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {employmentOptions.map((opt) => {
                  const isSelected = employmentType === opt.id;
                  return (
                    <div
                      key={opt.id}
                      onClick={() => setEmploymentType(opt.id)}
                      className={`flex items-center gap-3 px-3.5 py-3 rounded-xl border transition-all cursor-pointer select-none ${
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
        {/* Urutan: No. WhatsApp, Alamat Tempat Tinggal              */}
        {/* ======================================================== */}
        <div className="bg-white rounded-3xl border border-slate-200 shadow-xs p-5 sm:p-7 space-y-6">
          <div className="flex items-center gap-3 pb-3 border-b border-slate-100">
            <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center font-bold">
              <Phone className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-slate-900">
                Kontak &amp; Alamat
              </h2>
              <p className="text-xs text-slate-500">
                Nomor kontak aktif dan alamat domisili
              </p>
            </div>
          </div>

          <div className="space-y-5">
            {/* 3.1 No. WhatsApp */}
            <div className="space-y-1.5">
              <label className="block text-sm font-semibold text-slate-800">
                No. WhatsApp
              </label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="081234567890"
                className="w-full h-11 px-4 bg-white border border-slate-200 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-50 rounded-xl text-sm font-mono text-slate-900 outline-none transition-all"
              />
            </div>

            {/* 3.2 Alamat Tempat Tinggal */}
            <div className="space-y-2">
              <label className="block text-sm font-semibold text-slate-800">
                Alamat Tempat Tinggal
              </label>
              
              {/* Kota / Kabupaten */}
              <input
                type="text"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="Kota / Kabupaten"
                className="w-full h-11 px-4 bg-white border border-slate-200 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-50 rounded-xl text-sm text-slate-900 transition-all outline-none"
              />

              {/* Nama Jalan & Alamat Lengkap */}
              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Nama jalan, RT/RW, nomor rumah, kelurahan, kecamatan"
                className="w-full h-11 px-4 bg-white border border-slate-200 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-50 rounded-xl text-sm text-slate-900 transition-all outline-none"
              />
            </div>
          </div>
        </div>

        {/* ======================================================== */}
        {/* 4. INFORMASI REKENING                                    */}
        {/* Urutan: Metode Payroll, No. Rekening, Atas Nama          */}
        {/* ======================================================== */}
        <div className="bg-white rounded-3xl border border-slate-200 shadow-xs p-5 sm:p-7 space-y-6">
          <div className="flex items-center gap-3 pb-3 border-b border-slate-100">
            <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center font-bold">
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
                Metode Payroll
              </label>
              
              <button
                type="button"
                onClick={() => setIsPaymentDropdownOpen(!isPaymentDropdownOpen)}
                className={`w-full h-11 px-4 flex items-center justify-between rounded-xl border text-sm font-medium transition-all cursor-pointer bg-white ${
                  isPaymentDropdownOpen
                    ? 'border-indigo-400 ring-2 ring-indigo-50 text-slate-900'
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
                          className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
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
                          className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
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

            {/* 4.2 No. Rekening */}
            <div className="space-y-1.5">
              <label className="block text-sm font-semibold text-slate-800">
                No. Rekening
              </label>
              <input
                type="text"
                value={bankAccountNumber}
                onChange={(e) => setBankAccountNumber(e.target.value)}
                placeholder="Contoh: 5220819234 / 0812xxxx"
                className="w-full h-11 px-4 bg-white border border-slate-200 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-50 rounded-xl text-sm font-mono text-slate-900 outline-none transition-all"
              />
            </div>

            {/* 4.3 Atas Nama */}
            <div className="space-y-1.5">
              <label className="block text-sm font-semibold text-slate-800">
                Atas Nama
              </label>
              <input
                type="text"
                value={bankAccountHolder}
                onChange={(e) => setBankAccountHolder(e.target.value)}
                placeholder="Nama lengkap pemilik rekening"
                className="w-full h-11 px-4 bg-white border border-slate-200 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-50 rounded-xl text-sm text-slate-900 outline-none transition-all"
              />
            </div>
          </div>
        </div>

        {/* ======================================================== */}
        {/* TOMBOL SIMPAN SEMUA PERUBAHAN                            */}
        {/* ======================================================== */}
        <div className="pt-2">
          <button
            type="submit"
            disabled={isUploadingAvatar}
            className="w-full h-12 bg-[#1E3A8A] hover:bg-[#172554] active:scale-[0.99] text-white font-semibold text-sm sm:text-base rounded-2xl shadow-sm shadow-[#1E3A8A]/25 hover:shadow-md transition-all cursor-pointer flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {isUploadingAvatar && <Loader2 className="w-4 h-4 animate-spin" />}
            <span>{isUploadingAvatar ? 'Mengunggah Foto Profil...' : 'Simpan Perubahan'}</span>
          </button>
        </div>

      </form>
    </div>
  );
}

