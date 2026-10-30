import React, { useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Eye,
  EyeOff,
  ArrowLeft,
} from 'lucide-react';
import { AppStorage } from '../../lib/storage.ts';
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

  const handleLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (!loginIdentifier.trim() || !loginPassword) {
      setErrorMsg('Harap masukkan email/username dan password.');
      return;
    }

    setIsLoading(true);

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
    }, 350);
  };

  const handleRegisterSubmit = (e: React.FormEvent) => {
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

      // Setelah daftar: langsung masuk ke halaman webnya
      AppStorage.setSessionUser(res.user.id);
      onLoginSuccess(res.user);
    }, 450);
  };

  const handleResetPasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (!resetEmail.trim() || !resetName.trim() || !newPassword) {
      setErrorMsg('Harap isi email, nama lengkap terdaftar, dan password baru.');
      return;
    }

    if (newPassword.length < 6) {
      setErrorMsg('Password baru minimal terdiri dari 6 karakter.');
      return;
    }

    setIsLoading(true);

    setTimeout(() => {
      const allUsers = AppStorage.getUsers();
      const cleanEmail = resetEmail.trim().toLowerCase();
      const cleanName = resetName.trim().toLowerCase();

      // Cari user berdasarkan nama panjang (nama lengkap terdaftar) ATAU email
      const matched = allUsers.find(
        (u) =>
          (cleanName && u.name.toLowerCase() === cleanName) ||
          (cleanEmail && u.email.toLowerCase() === cleanEmail) ||
          (cleanName.length >= 3 && u.name.toLowerCase().includes(cleanName))
      );

      setIsLoading(false);

      if (!matched) {
        setErrorMsg('Data karyawan tidak ditemukan. Pastikan nama lengkap (nama panjang) atau email sesuai.');
        return;
      }

      matched.password = newPassword.trim();
      AppStorage.updateUser(matched);
      AppStorage.setSessionUser(matched.id);

      setSuccessMsg('Kata sandi berhasil diperbarui! Mengalihkan ke akun Anda...');
      setTimeout(() => {
        onLoginSuccess(matched);
      }, 500);
    }, 400);
  };

  return (
    <div className="min-h-screen lg:h-screen w-full bg-white flex flex-col lg:flex-row font-sans text-slate-900 antialiased selection:bg-[#0D1C42] selection:text-white overflow-x-hidden">
      
      {/* 1. SEBELAH KIRI: DOODLE ILLUSTRATION FLUSH LEFT-BOTTOM (BACKGROUND WHITE) */}
      <div className="hidden lg:flex lg:w-1/2 h-screen sticky top-0 left-0 bg-white items-end justify-start overflow-hidden">
        <InteractiveDoodleScene className="w-full h-full" />
      </div>

      {/* 2. SEBELAH KANAN: FORM MATCHING SCREENSHOT DESIGN (PAS 1 HALAMAN) */}
      <div className="w-full lg:w-1/2 min-h-screen lg:h-screen flex flex-col items-center justify-center p-5 sm:p-8 lg:p-12 bg-white overflow-y-auto">
        
        <div className="w-full max-w-[360px] sm:max-w-[400px] space-y-6 my-auto py-8 lg:py-0">
          
          {/* Header Title Matching Screenshot ("absenku" replace "Welcome back!") */}
          <div className="text-center space-y-1">
            <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-[#1E3A8A] lowercase font-sans">
              absenku
            </h1>
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
            <div className="p-3 bg-rose-50 border-b border-rose-200 text-rose-700 rounded-lg text-xs flex items-center gap-2 animate-in fade-in">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-3 bg-emerald-50 border-b border-emerald-200 text-emerald-800 rounded-lg text-xs flex items-center gap-2 font-medium animate-in fade-in">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* 1. FORM LOGIN (Matching Underline Style from Screenshot) */}
          {authMode === 'LOGIN' && (
            <form onSubmit={handleLoginSubmit} className="space-y-5">
              {/* Email / Username Underline Field */}
              <div className="space-y-1 text-left">
                <label className="block text-xs font-medium text-slate-500">
                  Email
                </label>
                <input
                  type="text"
                  required
                  value={loginIdentifier}
                  onChange={(e) => setLoginIdentifier(e.target.value)}
                  placeholder="email@contoh.com"
                  autoComplete="username"
                  className="w-full bg-transparent border-b border-slate-300 focus:border-[#0D1C42] focus:outline-hidden py-2 text-sm text-slate-900 font-medium placeholder:text-slate-300 transition-colors"
                />
              </div>

              {/* Password Underline Field */}
              <div className="space-y-1 text-left">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-medium text-slate-500">
                    Password
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setAuthMode('FORGOT_PASSWORD');
                      setErrorMsg(null);
                      setSuccessMsg(null);
                    }}
                    className="text-xs text-slate-500 hover:text-[#0D1C42] font-medium transition-colors cursor-pointer"
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
                    className="w-full bg-transparent border-b border-slate-300 focus:border-[#0D1C42] focus:outline-hidden py-2 pr-8 text-sm text-slate-900 font-medium placeholder:text-slate-300 transition-colors"
                  />
                  <button
                    type="button"
                    onClick={() => setShowLoginPassword(!showLoginPassword)}
                    className="absolute right-1 top-2 text-slate-400 hover:text-[#0D1C42] p-0.5 cursor-pointer"
                    title={showLoginPassword ? 'Sembunyikan sandi' : 'Tampilkan sandi'}
                  >
                    {showLoginPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Primary Pill Button (#1E3A8A theme) */}
              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-3.5 px-6 bg-[#1E3A8A] hover:bg-[#172554] disabled:opacity-50 text-white font-semibold rounded-2xl text-sm shadow-xs transition-all duration-200 cursor-pointer mt-2"
              >
                {isLoading ? 'Memverifikasi...' : 'Masuk'}
              </button>

              {/* Small Sign Up Link Below on the Right Side */}
              <div className="flex justify-end pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setAuthMode('REGISTER');
                    setErrorMsg(null);
                    setSuccessMsg(null);
                  }}
                  className="text-xs text-slate-500 hover:text-[#0D1C42] font-normal transition-colors cursor-pointer"
                >
                  Belum punya akun? <span className="font-semibold text-[#0D1C42] underline underline-offset-2">Daftar</span>
                </button>
              </div>
            </form>
          )}

          {/* 2. FORM REGISTER (Sign Up) */}
          {authMode === 'REGISTER' && (
            <form onSubmit={handleRegisterSubmit} className="space-y-4">
              <div className="space-y-1 text-left">
                <label className="block text-xs font-medium text-slate-500">
                  Nama Lengkap
                </label>
                <input
                  type="text"
                  required
                  value={regName}
                  onChange={(e) => setRegName(e.target.value)}
                  placeholder="Contoh: Pratama Arhan"
                  className="w-full bg-transparent border-b border-slate-300 focus:border-[#0D1C42] focus:outline-hidden py-2 text-sm text-slate-900 font-medium placeholder:text-slate-300 transition-colors"
                />
              </div>

              <div className="space-y-1 text-left">
                <label className="block text-xs font-medium text-slate-500">
                  Email
                </label>
                <input
                  type="email"
                  required
                  value={regEmail}
                  onChange={(e) => setRegEmail(e.target.value)}
                  placeholder="email@contoh.com"
                  className="w-full bg-transparent border-b border-slate-300 focus:border-[#0D1C42] focus:outline-hidden py-2 text-sm text-slate-900 font-medium placeholder:text-slate-300 transition-colors"
                />
              </div>

              <div className="space-y-1 text-left">
                <label className="block text-xs font-medium text-slate-500">
                  Divisi
                </label>
                <input
                  type="text"
                  value={regDepartment}
                  onChange={(e) => setRegDepartment(e.target.value)}
                  placeholder="Contoh: Operasional / Marketing / IT"
                  className="w-full bg-transparent border-b border-slate-300 focus:border-[#0D1C42] focus:outline-hidden py-2 text-sm text-slate-900 font-medium placeholder:text-slate-300 transition-colors"
                />
              </div>

              <div className="space-y-1 text-left">
                <label className="block text-xs font-medium text-slate-500">
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
                    className="w-full bg-transparent border-b border-slate-300 focus:border-[#0D1C42] focus:outline-hidden py-2 pr-8 text-sm text-slate-900 font-medium placeholder:text-slate-300 transition-colors"
                  />
                  <button
                    type="button"
                    onClick={() => setShowRegPassword(!showRegPassword)}
                    className="absolute right-1 top-2 text-slate-400 hover:text-[#0D1C42] p-0.5 cursor-pointer"
                  >
                    {showRegPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-3.5 px-6 bg-[#1E3A8A] hover:bg-[#172554] disabled:opacity-50 text-white font-semibold rounded-2xl text-sm shadow-xs transition-all duration-200 cursor-pointer mt-2"
              >
                {isLoading ? 'Mendaftarkan...' : 'Daftar Akun Baru'}
              </button>

              {/* Small Login Link Below on the Right Side */}
              <div className="flex justify-end pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setAuthMode('LOGIN');
                    setErrorMsg(null);
                    setSuccessMsg(null);
                  }}
                  className="text-xs text-slate-500 hover:text-[#0D1C42] font-normal transition-colors cursor-pointer"
                >
                  Sudah punya akun? <span className="font-semibold text-[#0D1C42] underline underline-offset-2">Masuk</span>
                </button>
              </div>
            </form>
          )}

          {/* 3. FORM LUPA PASSWORD */}
          {authMode === 'FORGOT_PASSWORD' && (
            <form onSubmit={handleResetPasswordSubmit} className="space-y-4">
              <div className="space-y-1 text-left">
                <label className="block text-xs font-medium text-slate-500">
                  Email
                </label>
                <input
                  type="email"
                  required
                  value={resetEmail}
                  onChange={(e) => setResetEmail(e.target.value)}
                  placeholder="email@contoh.com"
                  className="w-full bg-transparent border-b border-slate-300 focus:border-[#0D1C42] focus:outline-hidden py-2 text-sm text-slate-900 font-medium placeholder:text-slate-300 transition-colors"
                />
              </div>

              <div className="space-y-1 text-left">
                <label className="block text-xs font-medium text-slate-500">
                  Nama Lengkap Terdaftar
                </label>
                <input
                  type="text"
                  required
                  value={resetName}
                  onChange={(e) => setResetName(e.target.value)}
                  placeholder="Masukkan nama lengkap"
                  className="w-full bg-transparent border-b border-slate-300 focus:border-[#0D1C42] focus:outline-hidden py-2 text-sm text-slate-900 font-medium placeholder:text-slate-300 transition-colors"
                />
              </div>

              <div className="space-y-1 text-left">
                <label className="block text-xs font-medium text-slate-500">
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
                    className="w-full bg-transparent border-b border-slate-300 focus:border-[#0D1C42] focus:outline-hidden py-2 pr-8 text-sm text-slate-900 font-medium placeholder:text-slate-300 transition-colors"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className="absolute right-1 top-2 text-slate-400 hover:text-[#0D1C42] p-0.5 cursor-pointer"
                  >
                    {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-3.5 px-6 bg-[#1E3A8A] hover:bg-[#172554] disabled:opacity-50 text-white font-semibold rounded-2xl text-sm shadow-xs transition-all duration-200 cursor-pointer mt-2"
              >
                {isLoading ? 'Memproses...' : 'Simpan Password Baru'}
              </button>

              <div className="flex justify-between items-center pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setAuthMode('LOGIN');
                    setErrorMsg(null);
                    setSuccessMsg(null);
                  }}
                  className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-[#0D1C42] font-medium transition-colors cursor-pointer"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Kembali ke Halaman Masuk</span>
                </button>
              </div>
            </form>
          )}

        </div>

      </div>

    </div>
  );
}
