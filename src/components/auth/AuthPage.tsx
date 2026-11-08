import React, { useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Eye,
  EyeOff,
  ArrowLeft,
} from 'lucide-react';
import { AppStorage } from '../../lib/storage.ts';
import { ApiClient } from '../../lib/api-client.ts';
import { User as UserType } from '../../types/index.ts';
import { InteractiveDoodleScene } from '../common/InteractiveDoodleScene.tsx';

interface AuthPageProps {
  onLoginSuccess: (user: UserType) => void;
}

export function AuthPage({ onLoginSuccess }: AuthPageProps) {
  const [authMode, setAuthMode] = useState<'LOGIN' | 'REGISTER' | 'FORGOT_PASSWORD'>('LOGIN');

  // Login form state
  const [loginIdentifier, setLoginIdentifier] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showLoginPassword, setShowLoginPassword] = useState(false);

  // Register form state
  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [showRegPassword, setShowRegPassword] = useState(false);
  const [regDepartment, setRegDepartment] = useState('');

  // Lupa Password state
  const [resetEmail, setResetEmail] = useState('');
  const [resetName, setResetName] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);

  // Feedback states
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (!loginIdentifier.trim() || !loginPassword) {
      setErrorMsg('Harap masukkan email/username dan password.');
      return;
    }

    setIsLoading(true);

    try {
      // 1. Coba login melalui API Laravel Backend & MySQL
      const res = await ApiClient.login(loginIdentifier.trim(), loginPassword);
      if (res && res.user) {
        const localMatched = AppStorage.getUsers().find(
          (u) => u.id === res.user.id || u.email.toLowerCase() === res.user.email.toLowerCase()
        );
        const apiUser: UserType = {
          id: res.user.id,
          name: res.user.name,
          email: res.user.email,
          role: res.user.role,
          status: localMatched?.status || res.user.status,
          employmentType: localMatched?.employmentType || res.user.employment_type || res.user.employmentType || 'CONTRACT',
          department: localMatched?.department || res.user.department || 'Operasional',
          position: localMatched?.position || res.user.position || 'Staf',
          avatar: localMatched?.avatar || res.user.avatar || '',
          phone: localMatched?.phone || res.user.phone || '',
          joinDate: localMatched?.joinDate || res.user.join_date || res.user.joinDate || '',
          leaveBalance: localMatched?.leaveBalance ?? res.user.leave_balance ?? res.user.leaveBalance ?? 12,
          bankName: localMatched?.bankName || res.user.bank_name || res.user.bankName || '',
          bankAccountNumber: localMatched?.bankAccountNumber || res.user.bank_account_number || res.user.bankAccountNumber || '',
          bankAccountHolder: localMatched?.bankAccountHolder || res.user.bank_account_holder || res.user.bankAccountHolder || '',
          emergencyContactName: localMatched?.emergencyContactName || res.user.emergency_contact_name || res.user.emergencyContactName || '',
          emergencyContactPhone: localMatched?.emergencyContactPhone || res.user.emergency_contact_phone || res.user.emergencyContactPhone || '',
          address: localMatched?.address || res.user.address || '',
          registeredAt: localMatched?.registeredAt || res.user.registered_at || res.user.registeredAt || '',
          isProfileComplete: localMatched?.isProfileComplete ?? Boolean(res.user.is_profile_complete ?? res.user.isProfileComplete),
        };

        AppStorage.updateUser(apiUser);
        AppStorage.setSessionUser(apiUser.id);
        setIsLoading(false);
        onLoginSuccess(apiUser);
        return;
      }
    } catch (apiErr: any) {
      if (apiErr.status === 403) {
        setIsLoading(false);
        const msg =
          apiErr.message && !apiErr.message.toLowerCase().includes('fetch')
            ? apiErr.message
            : 'Akun tidak diizinkan masuk atau belum disetujui.';
        setErrorMsg(msg);
        return;
      }
      // Jika akun dibuat via mock/test harness lokal di browser
      const localUser = AppStorage.authenticate(loginIdentifier, loginPassword);
      if (localUser) {
        AppStorage.setSessionUser(localUser.id);
        setIsLoading(false);
        onLoginSuccess(localUser);
        return;
      }

      setIsLoading(false);
      setErrorMsg('Email/username atau password tidak sesuai.');
      return;
    }

    // Fallback autentikasi lokal
    setTimeout(() => {
      const user = AppStorage.authenticate(loginIdentifier, loginPassword);

      if (!user) {
        setIsLoading(false);
        setErrorMsg('Email/username atau password tidak sesuai.');
        return;
      }

      AppStorage.setSessionUser(user.id);
      setIsLoading(false);
      onLoginSuccess(user);
    }, 250);
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (!regName.trim() || !regEmail.trim() || !regPassword) {
      setErrorMsg('Harap lengkapi semua bidang yang wajib diisi.');
      return;
    }

    if (regPassword.length < 6) {
      setErrorMsg('Password minimal terdiri dari 6 karakter.');
      return;
    }

    setIsLoading(true);

    try {
      const regRes = await ApiClient.register({
        name: regName.trim(),
        email: regEmail.trim(),
        password: regPassword,
        department: regDepartment.trim() || 'Operasional',
        position: 'Staf',
      });

      if (regRes && regRes.user) {
        const now = new Date();
        const localYear = now.getFullYear();
        const localMonth = String(now.getMonth() + 1).padStart(2, '0');
        const localDay = String(now.getDate()).padStart(2, '0');
        const localDateStr = `${localYear}-${localMonth}-${localDay}`;
        const localTimeStr = `${localDateStr} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

        const newUser: UserType = {
          id: regRes.user.id,
          name: regRes.user.name,
          email: regRes.user.email,
          role: regRes.user.role || 'EMPLOYEE',
          status: regRes.user.status || 'PENDING_APPROVAL',
          employmentType: regRes.user.employment_type || 'CONTRACT',
          department: regRes.user.department || 'Operasional',
          position: regRes.user.position || 'Staf',
          avatar: regRes.user.avatar || '',
          phone: regRes.user.phone || '',
          joinDate: regRes.user.join_date || regRes.user.registered_at?.substring(0, 10) || localDateStr,
          leaveBalance: regRes.user.leave_balance ?? 12,
          registeredAt: regRes.user.registered_at || localTimeStr,
          isProfileComplete: false,
        };

        AppStorage.updateUser(newUser);
        AppStorage.setSessionUser(newUser.id);
        setIsLoading(false);
        onLoginSuccess(newUser);
        return;
      }
    } catch (apiErr: any) {
      if (apiErr.status === 422 || apiErr.status === 400) {
        setIsLoading(false);
        setErrorMsg(apiErr.message || 'Gagal mendaftarkan akun. Email mungkin sudah terdaftar.');
        return;
      }
    }

    // Fallback pendaftaran lokal
    setTimeout(() => {
      const res = AppStorage.registerEmployee({
        name: regName.trim(),
        email: regEmail.trim(),
        password: regPassword,
        department: regDepartment.trim() || 'Operasional',
        position: 'Staf',
      });

      setIsLoading(false);

      if (!res.success || !res.user) {
        setErrorMsg(res.error || 'Gagal mendaftarkan akun.');
        return;
      }

      AppStorage.setSessionUser(res.user.id);
      onLoginSuccess(res.user);
    }, 250);
  };

  const handleResetPasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (!resetEmail.trim() || !newPassword) {
      setErrorMsg('Harap isi email terdaftar dan password baru.');
      return;
    }

    if (newPassword.length < 6) {
      setErrorMsg('Password baru minimal terdiri dari 6 karakter.');
      return;
    }

    setIsLoading(true);

    setTimeout(() => {
      const res = AppStorage.resetPasswordSelfService(resetEmail.trim(), resetName.trim(), newPassword);
      setIsLoading(false);

      if (!res.success) {
        setErrorMsg(res.message || 'Gagal mengatur ulang password.');
        return;
      }

      setSuccessMsg('Kata sandi berhasil diperbarui! Silakan masuk dengan password baru Anda.');
      setNewPassword('');
      setTimeout(() => {
        setSuccessMsg(null);
        setAuthMode('LOGIN');
      }, 1500);
    }, 400);
  };

  return (
    <div className="min-h-screen lg:h-screen w-full bg-[#F3F6FA] lg:bg-white flex flex-col lg:flex-row font-sans text-slate-900 antialiased selection:bg-[#0D1C42] selection:text-white overflow-x-hidden">
      
      {/* 1. KHUSUS DESKTOP (lg:flex): DOODLE ILLUSTRATION FLUSH LEFT-BOTTOM */}
      <div className="hidden lg:flex lg:w-1/2 h-screen sticky top-0 left-0 bg-white items-end justify-start overflow-hidden">
        <InteractiveDoodleScene className="w-full h-full" />
      </div>

      {/* 2. AREA FORM (DESKTOP KANAN / MOBILE & IPAD/TABLET KARTU UTUH TERPADU PROPORSIONAL) */}
      <div className="w-full lg:w-1/2 min-h-screen lg:h-screen flex flex-col items-center justify-center p-4 sm:p-6 md:p-8 lg:px-10 lg:py-6 overflow-y-auto">
        
        {/* KARTU TERPADU: UKURAN PROPORSIONAL & LEGA UNTUK MOBILE MAUPUN IPAD/TABLET */}
        <div className="w-full max-w-[370px] xs:max-w-[380px] sm:max-w-[400px] lg:max-w-[380px] my-auto bg-white rounded-[26px] sm:rounded-[32px] lg:rounded-none shadow-xl shadow-slate-300/40 lg:shadow-none border border-slate-200/90 lg:border-0 overflow-hidden lg:overflow-visible flex flex-col transition-all">
          
          {/* BAGIAN 1 (ATAS KARTU): DOODLE KARAKTER LEGA DI MOBILE & TABLET/IPAD */}
          <div className="lg:hidden w-full h-52 xs:h-60 sm:h-68 bg-white relative overflow-hidden flex items-end justify-center select-none shrink-0 pt-2">
            <InteractiveDoodleScene
              className="w-full h-full"
              viewBox="0 80 800 520"
              preserveAspectRatio="xMidYMin slice"
            />
          </div>

          {/* GARIS PEMISAH ELEGAN ANTARA DOODLE DAN FORM */}
          <div className="lg:hidden w-full border-b border-slate-200/80" />

          {/* BAGIAN 2 (BAWAH KARTU): FORM MASUK / DAFTAR / LUPA PASSWORD DENGAN UKURAN LEBIH BESAR SEDIKIT */}
          <div className="px-6 pt-6 pb-7 xs:px-7 xs:pt-7 xs:pb-8 sm:px-9 sm:pt-8 sm:pb-9 lg:p-0 space-y-4">
            
            {/* Header Brand Logo (in-Time indekraf presence system) */}
            <div className="text-center space-y-2 pb-1 flex flex-col items-center">
              <img
                src="/assets/in-time-logo.png"
                alt="in-Time indekraf presence system"
                className="h-12 sm:h-14 w-auto object-contain select-none"
              />
              <p className="text-xs sm:text-sm text-slate-500 font-normal">
                {authMode === 'LOGIN'
                  ? 'Silakan masukkan detail akun Anda'
                  : authMode === 'REGISTER'
                  ? 'Silakan isi data diri untuk membuat akun baru'
                  : 'Atur ulang kata sandi akun Anda'}
              </p>
            </div>

            {/* Feedback Banners */}
            {errorMsg && (
              <div className="p-3 bg-rose-50 border border-rose-200/80 text-rose-700 rounded-xl text-xs sm:text-sm flex items-center gap-2 animate-in fade-in shadow-2xs">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
                <span>
                  {errorMsg.toLowerCase().includes('failed to fetch') || errorMsg.toLowerCase().includes('network')
                    ? 'Email/username atau password tidak sesuai.'
                    : errorMsg}
                </span>
              </div>
            )}

            {successMsg && (
              <div className="p-3 bg-emerald-50 border border-emerald-200/80 text-emerald-800 rounded-xl text-xs sm:text-sm flex items-center gap-2 font-medium animate-in fade-in shadow-2xs">
                <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
                <span>{successMsg}</span>
              </div>
            )}

            {/* 1. FORM LOGIN */}
            {authMode === 'LOGIN' && (
              <form onSubmit={handleLoginSubmit} className="space-y-3.5 sm:space-y-4">
                {/* Email / Username Field */}
                <div className="space-y-1 text-left">
                  <label className="block text-xs sm:text-sm font-semibold text-slate-700">
                    Email
                  </label>
                  <input
                    type="text"
                    required
                    value={loginIdentifier}
                    onChange={(e) => setLoginIdentifier(e.target.value)}
                    placeholder="email@contoh.com"
                    autoComplete="username"
                    className="w-full bg-transparent border-0 border-b-2 border-slate-300 focus:border-[#1E3A8A] focus:outline-hidden rounded-none px-0.5 py-2 text-sm text-slate-900 font-medium placeholder:text-slate-400 transition-colors"
                  />
                </div>

                {/* Password Field */}
                <div className="space-y-1 text-left">
                  <div className="flex items-center justify-between">
                    <label className="block text-xs sm:text-sm font-semibold text-slate-700">
                      Password
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        setAuthMode('FORGOT_PASSWORD');
                        setErrorMsg(null);
                        setSuccessMsg(null);
                      }}
                      className="text-xs sm:text-sm text-[#1E3A8A] hover:underline font-semibold transition-colors cursor-pointer"
                    >
                      Lupa password?
                    </button>
                  </div>
                  <div className="relative">
                    <input
                      type={showLoginPassword ? 'text' : 'password'}
                      required
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                      placeholder="••••••••••••"
                      autoComplete="current-password"
                      className="w-full bg-transparent border-0 border-b-2 border-slate-300 focus:border-[#1E3A8A] focus:outline-hidden rounded-none px-0.5 py-2 pr-8 text-sm text-slate-900 font-medium placeholder:text-slate-400 transition-colors"
                    />
                    <button
                      type="button"
                      onClick={() => setShowLoginPassword(!showLoginPassword)}
                      className="absolute right-0 top-1/2 -translate-y-1/2 text-slate-400 hover:text-[#1E3A8A] p-1 cursor-pointer transition-colors"
                      title={showLoginPassword ? 'Sembunyikan sandi' : 'Tampilkan sandi'}
                    >
                      {showLoginPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Primary Pill Button (#1E3A8A Navy Blue) */}
                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full py-3 sm:py-3.5 px-6 bg-[#1E3A8A] hover:bg-[#152a65] active:scale-[0.99] disabled:opacity-50 text-white font-bold rounded-full text-sm shadow-md shadow-blue-950/15 transition-all duration-200 cursor-pointer mt-3.5 sm:mt-4"
                >
                  {isLoading ? 'Memverifikasi...' : 'Masuk'}
                </button>

                {/* Centered Sign Up Link */}
                <div className="flex justify-center pt-2 pb-2">
                  <button
                    type="button"
                    onClick={() => {
                      setAuthMode('REGISTER');
                      setErrorMsg(null);
                      setSuccessMsg(null);
                    }}
                    className="text-xs sm:text-[13px] text-slate-500 font-normal hover:text-[#1E3A8A] transition-colors cursor-pointer"
                  >
                    Belum punya akun?{' '}
                    <span className="font-semibold text-slate-800 underline underline-offset-2 hover:text-[#1E3A8A]">
                      Daftar
                    </span>
                  </button>
                </div>
              </form>
            )}

            {/* 2. FORM REGISTER (Sign Up) */}
            {authMode === 'REGISTER' && (
              <form onSubmit={handleRegisterSubmit} className="space-y-3.5 sm:space-y-4">
                <div className="space-y-1 text-left">
                  <label className="block text-xs sm:text-sm font-semibold text-slate-700">
                    Nama Lengkap
                  </label>
                  <input
                    type="text"
                    required
                    value={regName}
                    onChange={(e) => setRegName(e.target.value)}
                    placeholder="Contoh: Pratama Arhan"
                    className="w-full bg-transparent border-0 border-b-2 border-slate-300 focus:border-[#1E3A8A] focus:outline-hidden rounded-none px-0.5 py-2 text-sm text-slate-900 font-medium placeholder:text-slate-400 transition-colors"
                  />
                </div>

                <div className="space-y-1 text-left">
                  <label className="block text-xs sm:text-sm font-semibold text-slate-700">
                    Email
                  </label>
                  <input
                    type="email"
                    required
                    value={regEmail}
                    onChange={(e) => setRegEmail(e.target.value)}
                    placeholder="email@contoh.com"
                    className="w-full bg-transparent border-0 border-b-2 border-slate-300 focus:border-[#1E3A8A] focus:outline-hidden rounded-none px-0.5 py-2 text-sm text-slate-900 font-medium placeholder:text-slate-400 transition-colors"
                  />
                </div>

                <div className="space-y-1 text-left">
                  <label className="block text-xs sm:text-sm font-semibold text-slate-700">
                    Password
                  </label>
                  <div className="relative">
                    <input
                      type={showRegPassword ? 'text' : 'password'}
                      required
                      minLength={6}
                      value={regPassword}
                      onChange={(e) => setRegPassword(e.target.value)}
                      placeholder="Minimal 6 karakter"
                      className="w-full bg-transparent border-0 border-b-2 border-slate-300 focus:border-[#1E3A8A] focus:outline-hidden rounded-none px-0.5 py-2 pr-8 text-sm text-slate-900 font-medium placeholder:text-slate-400 transition-colors"
                    />
                    <button
                      type="button"
                      onClick={() => setShowRegPassword(!showRegPassword)}
                      className="absolute right-0 top-1/2 -translate-y-1/2 text-slate-400 hover:text-[#1E3A8A] p-1 cursor-pointer transition-colors"
                    >
                      {showRegPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full py-3 sm:py-3.5 px-6 bg-[#1E3A8A] hover:bg-[#152a65] active:scale-[0.99] disabled:opacity-50 text-white font-bold rounded-full text-sm shadow-md shadow-blue-950/15 transition-all duration-200 cursor-pointer mt-3.5 sm:mt-4"
                >
                  {isLoading ? 'Mendaftarkan...' : 'Daftar Akun Baru'}
                </button>

                {/* Centered Login Link Below with Safe Bottom Spacing */}
                <div className="flex justify-center pt-2 pb-2">
                  <button
                    type="button"
                    onClick={() => {
                      setAuthMode('LOGIN');
                      setErrorMsg(null);
                      setSuccessMsg(null);
                    }}
                    className="text-xs sm:text-[13px] text-slate-500 font-normal hover:text-[#1E3A8A] transition-colors cursor-pointer"
                  >
                    Sudah punya akun?{' '}
                    <span className="font-semibold text-slate-800 underline underline-offset-2 hover:text-[#1E3A8A]">
                      Masuk
                    </span>
                  </button>
                </div>
              </form>
            )}

            {/* 3. FORM LUPA PASSWORD */}
            {authMode === 'FORGOT_PASSWORD' && (
              <form onSubmit={handleResetPasswordSubmit} className="space-y-3.5 sm:space-y-4">
                <div className="space-y-1 text-left">
                  <label className="block text-xs sm:text-sm font-semibold text-slate-700">
                    Email Terdaftar <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="email"
                    required
                    value={resetEmail}
                    onChange={(e) => setResetEmail(e.target.value)}
                    placeholder="contoh: superadmin@gmail.com"
                    className="w-full bg-transparent border-0 border-b-2 border-slate-300 focus:border-[#1E3A8A] focus:outline-hidden rounded-none px-0.5 py-2 text-sm text-slate-900 font-medium placeholder:text-slate-400 transition-colors"
                  />
                </div>

                <div className="space-y-1 text-left">
                  <label className="block text-xs sm:text-sm font-semibold text-slate-700">
                    Nama Lengkap Terdaftar <span className="text-slate-400 text-[10px] sm:text-xs font-normal">(Opsional)</span>
                  </label>
                  <input
                    type="text"
                    value={resetName}
                    onChange={(e) => setResetName(e.target.value)}
                    placeholder="Contoh: Super Admin"
                    className="w-full bg-transparent border-0 border-b-2 border-slate-300 focus:border-[#1E3A8A] focus:outline-hidden rounded-none px-0.5 py-2 text-sm text-slate-900 font-medium placeholder:text-slate-400 transition-colors"
                  />
                </div>

                <div className="space-y-1 text-left">
                  <label className="block text-xs sm:text-sm font-semibold text-slate-700">
                    Password Baru
                  </label>
                  <div className="relative">
                    <input
                      type={showNewPassword ? 'text' : 'password'}
                      required
                      minLength={6}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Minimal 6 karakter"
                      className="w-full bg-transparent border-0 border-b-2 border-slate-300 focus:border-[#1E3A8A] focus:outline-hidden rounded-none px-0.5 py-2 pr-8 text-sm text-slate-900 font-medium placeholder:text-slate-400 transition-colors"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                      className="absolute right-0 top-1/2 -translate-y-1/2 text-slate-400 hover:text-[#1E3A8A] p-1 cursor-pointer transition-colors"
                    >
                      {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full py-3 sm:py-3.5 px-6 bg-[#1E3A8A] hover:bg-[#152a65] active:scale-[0.99] disabled:opacity-50 text-white font-bold rounded-full text-sm shadow-md shadow-blue-950/15 transition-all duration-200 cursor-pointer mt-3.5 sm:mt-4"
                >
                  {isLoading ? 'Memproses...' : 'Simpan Password Baru'}
                </button>

                <div className="flex justify-center items-center pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setAuthMode('LOGIN');
                      setErrorMsg(null);
                      setSuccessMsg(null);
                    }}
                    className="inline-flex items-center gap-1.5 text-xs sm:text-sm text-slate-500 hover:text-[#1E3A8A] font-semibold transition-colors cursor-pointer"
                  >
                    <ArrowLeft className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                    <span>Kembali ke Halaman Masuk</span>
                  </button>
                </div>
              </form>
            )}

          </div>

        </div>

      </div>

    </div>
  );
}
