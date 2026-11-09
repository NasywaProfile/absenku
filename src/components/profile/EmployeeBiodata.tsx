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
  Lock,
  Eye,
  EyeOff,
  KeyRound,
} from 'lucide-react';
import { User, EmploymentType } from '../../types/index.ts';
import { AppStorage } from '../../lib/storage.ts';
import { ApiClient } from '../../lib/api-client.ts';
import { uploadToCloudinary } from '../../lib/cloudinary.ts';
import { compressImageFile } from '../../lib/image-compression.ts';
import { sendRealEmail, generateEmailHtmlTemplate } from '../../lib/real-email.ts';

export type BiodataTabKey = 'general' | 'job' | 'contact' | 'payroll' | 'security';

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

  // Form Fields - Kontak Darurat
  const [emergencyContactName, setEmergencyContactName] = useState('');
  const [emergencyContactPhone, setEmergencyContactPhone] = useState('');

  // Form Fields - Payroll (Bank & E-Wallet)
  const [bankName, setBankName] = useState('BCA');
  const [bankAccountNumber, setBankAccountNumber] = useState('');
  const [bankAccountHolder, setBankAccountHolder] = useState('');
  const [isPaymentDropdownOpen, setIsPaymentDropdownOpen] = useState(false);

  // Form Fields - Keamanan & Ganti Sandi (Opsional)
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const initializedUserIdRef = useRef<string | null>(null);

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
    if (currentUser && currentUser.id !== initializedUserIdRef.current) {
      initializedUserIdRef.current = currentUser.id;
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
      setEmergencyContactName(currentUser.emergencyContactName || '');
      setEmergencyContactPhone(currentUser.emergencyContactPhone || '');
    }
  }, [currentUser?.id]);

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

  const handleSaveAll = async (e?: React.FormEvent) => {
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

    if (newPassword.trim()) {
      if (newPassword.trim().length < 6) {
        setActiveTab('security');
        setErrorMessage('Kata sandi baru minimal 6 karakter.');
        return;
      }
      if (newPassword.trim() !== confirmPassword.trim()) {
        setActiveTab('security');
        setErrorMessage('Konfirmasi kata sandi baru tidak sesuai.');
        return;
      }
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const oldEmail = currentUser.email?.trim().toLowerCase();
      const newEmail = email.trim();
      const isEmailChanged = Boolean(oldEmail && newEmail.toLowerCase() !== oldEmail);
      const isPasswordChanged = Boolean(newPassword.trim());

      // 1. Simpan perubahan ke MySQL server backend (mengirim alias dwibahasa ID & EN)
      const serverPayload: any = {
        id: currentUser.id,
        user_id: currentUser.id,
        current_email: currentUser.email,
        name: name.trim(),
        nama: name.trim(),
        email: newEmail,
        phone: phone.trim(),
        nomor_telepon: phone.trim(),
        gender,
        jenis_kelamin: gender,
        birthDate: birthDate ? birthDate.trim() : (currentUser.birthDate || '2000-01-01'),
        tanggal_lahir: birthDate ? birthDate.trim() : (currentUser.birthDate || '2000-01-01'),
        address: address.trim(),
        alamat: address.trim(),
        avatar: avatar || currentUser.avatar,
        foto_profil: avatar || currentUser.avatar,
        department: department.trim(),
        divisi: department.trim(),
        position: department.trim() || currentUser.position,
        jabatan: department.trim() || currentUser.position,
        employment_type: employmentType,
        tipe_kepegawaian: employmentType,
        bank_name: bankName.trim(),
        nama_bank: bankName.trim(),
        bank_account_number: bankAccountNumber.trim(),
        nomor_rekening: bankAccountNumber.trim(),
        bank_account_holder: bankAccountHolder.trim() || name.trim(),
        nama_pemilik_rekening: bankAccountHolder.trim() || name.trim(),
        emergency_contact_name: emergencyContactName.trim(),
        nama_kontak_darurat: emergencyContactName.trim(),
        emergency_contact_phone: emergencyContactPhone.trim(),
        nomor_kontak_darurat: emergencyContactPhone.trim(),
        is_profile_complete: true,
        profil_lengkap: true,
      };

      if (isPasswordChanged) {
        serverPayload.password = newPassword.trim();
      }

      try {
        const apiRes = await ApiClient.updateProfile(serverPayload);
        if (apiRes && apiRes.token) {
          ApiClient.setToken(apiRes.token);
        }
      } catch (apiErr: any) {
        console.warn('Gagal sinkron profil ke server backend:', apiErr);
        if (apiErr?.status === 422 || apiErr?.status === 400) {
          setErrorMessage(apiErr?.message || 'Data profil tidak valid.');
          setIsSubmitting(false);
          return;
        }
      }

      // 2. Simpan ke local AppStorage
      const updatePayload: Partial<User> = {
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
        emergencyContactName: emergencyContactName.trim(),
        emergencyContactPhone: emergencyContactPhone.trim(),
        isProfileComplete: true,
      };

      if (isPasswordChanged) {
        updatePayload.password = newPassword.trim();
      }

      const updated = AppStorage.updateUserProfile(currentUser.id, updatePayload) || {
        ...currentUser,
        ...updatePayload,
      };

      // 3. Email notifikasi jika email diubah
      if (isEmailChanged) {
        try {
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
        } catch (emailErr) {
          console.warn('Email notification error:', emailErr);
        }
      }

      onUserUpdated(updated);
      setNewPassword('');
      setConfirmPassword('');
      let msg = 'Biodata diri berhasil diperbarui dan disimpan!';
      if (isEmailChanged && isPasswordChanged) {
        msg = `Email dan kata sandi berhasil diperbarui! Notifikasi konfirmasi dikirim ke ${newEmail}.`;
      } else if (isEmailChanged) {
        msg = `Alamat email berhasil diperbarui! Notifikasi konfirmasi dikirim ke ${newEmail}.`;
      } else if (isPasswordChanged) {
        msg = 'Kata sandi berhasil diperbarui! Gunakan kata sandi baru untuk login berikutnya.';
      }
      setSuccessMessage(msg);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 5000);
    } catch (err: any) {
      console.error('Error in handleSaveAll:', err);
      setErrorMessage(err?.message || 'Terjadi kesalahan saat menyimpan perubahan biodata.');
    } finally {
      setIsSubmitting(false);
    }
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
                    ? '25%'
                    : activeTab === 'contact'
                    ? '50%'
                    : activeTab === 'payroll'
                    ? '75%'
                    : 'calc(100% - 48px)'
                }`,
              }}
            />

            {[
              { id: 'general', number: 1, label: 'Umum' },
              { id: 'job', number: 2, label: 'Pekerjaan' },
              { id: 'contact', number: 3, label: 'Kontak' },
              { id: 'payroll', number: 4, label: 'Rekening' },
              { id: 'security', number: 5, label: 'Keamanan' },
            ].map((step) => {
              const currentStepNumber =
                activeTab === 'general'
                  ? 1
                  : activeTab === 'job'
                  ? 2
                  : activeTab === 'contact'
                  ? 3
                  : activeTab === 'payroll'
                  ? 4
                  : 5;
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
        {/* Card Header */}
        <div className="pb-5 mb-5 border-b border-slate-100">
          <h2 className="text-base sm:text-lg font-bold text-slate-900 leading-tight">
            Biodata &amp; Informasi Akun
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Perbarui data profil, kontak, rekening, atau kata sandi Anda di sini.
          </p>
        </div>

        {/* Alert Error */}
        {errorMessage && (
          <div className="mb-5 p-3.5 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs sm:text-sm flex items-center gap-2 animate-in fade-in">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
            <span className="font-semibold">{errorMessage}</span>
          </div>
        )}

        {/* Alert Sukses Inline */}
        {saveSuccess && (
          <div className="mb-5 p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs sm:text-sm flex items-center gap-2 animate-in fade-in">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
            <span className="font-semibold">{successMessage}</span>
          </div>
        )}

        <form
          id="employeeBiodataForm"
          onSubmit={handleSaveAll}
          autoComplete="off"
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.target as HTMLElement).tagName !== 'TEXTAREA') {
              e.preventDefault();
              if (activeTab === 'general') setActiveTab('job');
              else if (activeTab === 'job') setActiveTab('contact');
              else if (activeTab === 'contact') setActiveTab('payroll');
              else if (activeTab === 'payroll') setActiveTab('security');
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
                    autoComplete="off"
                    autoCorrect="off"
                    spellCheck={false}
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

              {/* 3.3 Kontak Darurat (Keluarga / Kerabat) */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6 pt-2 border-t border-slate-100">
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-slate-700">
                    Nama Kontak Darurat
                  </label>
                  <input
                    type="text"
                    value={emergencyContactName}
                    onChange={(e) => setEmergencyContactName(e.target.value)}
                    placeholder="Nama kerabat / keluarga terdekat"
                    className="w-full h-11 px-3.5 bg-white border border-slate-300 focus:border-[#1E3A8A] focus:ring-2 focus:ring-blue-100 rounded-xl text-sm font-medium text-slate-900 transition-all outline-none"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-slate-700">
                    No. HP Kontak Darurat
                  </label>
                  <input
                    type="tel"
                    value={emergencyContactPhone}
                    onChange={(e) => setEmergencyContactPhone(e.target.value)}
                    placeholder="Contoh: 081987654321"
                    className="w-full h-11 px-3.5 bg-white border border-slate-300 focus:border-[#1E3A8A] focus:ring-2 focus:ring-blue-100 rounded-xl text-sm text-slate-900 outline-none transition-all"
                  />
                </div>
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

          {/* TAB 5: KEAMANAN & KATA SANDI (OPSIONAL) */}
          {activeTab === 'security' && (
            <div className="animate-in fade-in duration-150 min-h-[230px] md:min-h-0 md:h-[152px] flex flex-col justify-between space-y-4 md:space-y-0">
              <div className="pb-2 border-b border-slate-100">
                <h3 className="text-sm font-bold text-slate-800">Keamanan & Kata Sandi</h3>
                <p className="text-xs text-slate-500 mt-0.5">Perbarui kata sandi akun Anda untuk mengamankan akses ke portal.</p>
              </div>

              {/* Form Input Password Baru */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-slate-700">
                    Kata Sandi Baru <span className="text-slate-400 font-normal">(Opsional)</span>
                  </label>
                  <div className="relative flex items-center">
                    <KeyRound className="w-4 h-4 text-slate-400 absolute left-3.5 pointer-events-none" />
                    <input
                      type={showNewPassword ? 'text' : 'password'}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Minimal 6 karakter"
                      className="w-full h-11 pl-10 pr-10 bg-white border border-slate-300 focus:border-[#1E3A8A] focus:ring-2 focus:ring-blue-100 rounded-xl text-sm text-slate-900 outline-none transition-all"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                      className="absolute right-3 text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
                      title={showNewPassword ? 'Sembunyikan' : 'Tampilkan'}
                    >
                      {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-slate-700">
                    Konfirmasi Kata Sandi Baru
                  </label>
                  <div className="relative flex items-center">
                    <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 pointer-events-none" />
                    <input
                      type={showConfirmPassword ? 'text' : 'password'}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Ulangi kata sandi baru"
                      className="w-full h-11 pl-10 pr-10 bg-white border border-slate-300 focus:border-[#1E3A8A] focus:ring-2 focus:ring-blue-100 rounded-xl text-sm text-slate-900 outline-none transition-all"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-3 text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
                      title={showConfirmPassword ? 'Sembunyikan' : 'Tampilkan'}
                    >
                      {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </form>

        {/* Navigation Buttons: Prev (Left Arrow) & Next / Save Checkmark (Right Arrow / Check) */}
        <div className="flex items-center justify-between pt-6 mt-6 border-t border-slate-100">
          {activeTab !== 'general' ? (
            <button
              type="button"
              onClick={() => {
                if (activeTab === 'job') setActiveTab('general');
                else if (activeTab === 'contact') setActiveTab('job');
                else if (activeTab === 'payroll') setActiveTab('contact');
                else if (activeTab === 'security') setActiveTab('payroll');
              }}
              className="w-10 h-10 rounded-full border border-slate-200 text-slate-600 hover:text-[#1E3A8A] hover:border-[#1E3A8A] hover:bg-blue-50/50 flex items-center justify-center transition-all cursor-pointer active:scale-95 shadow-2xs"
              title="Kembali ke langkah sebelumnya"
              aria-label="Kembali ke langkah sebelumnya"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
          ) : (
            <div className="w-10 h-10" />
          )}

          <div className="flex items-center gap-2.5 ml-auto">
            {activeTab !== 'security' ? (
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  if (activeTab === 'general') setActiveTab('job');
                  else if (activeTab === 'job') setActiveTab('contact');
                  else if (activeTab === 'contact') setActiveTab('payroll');
                  else if (activeTab === 'payroll') setActiveTab('security');
                }}
                className="w-10 h-10 rounded-full bg-[#1E3A8A] hover:bg-[#172554] text-white flex items-center justify-center shadow-xs transition-all cursor-pointer active:scale-95"
                title="Lanjut ke langkah berikutnya"
                aria-label="Lanjut ke langkah berikutnya"
              >
                <ArrowRight className="w-5 h-5" />
              </button>
            ) : (
              <button
                type="button"
                onClick={handleSaveAll}
                disabled={isSubmitting || isUploading}
                className="w-10 h-10 rounded-full bg-[#1E3A8A] hover:bg-[#172554] disabled:opacity-50 text-white flex items-center justify-center shadow-xs transition-all cursor-pointer disabled:cursor-not-allowed active:scale-95"
                title="Simpan Perubahan Biodata"
                aria-label="Simpan Perubahan Biodata"
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

