import React, { useState, useEffect } from 'react';
import { X, Check } from 'lucide-react';
import { User } from '../../types/index.ts';
import { AppStorage } from '../../lib/storage.ts';

interface PendingApprovalScreenProps {
  currentUser: User;
  onApproved: (user: User) => void;
  onLogout?: () => void;
  onSwitchToAdmin?: () => void;
}

export function PendingApprovalScreen({
  currentUser,
  onApproved,
  onLogout,
}: PendingApprovalScreenProps) {
  const [isVerifiedSuccess, setIsVerifiedSuccess] = useState(false);

  // Polling status akun setiap 1.5 detik
  useEffect(() => {
    if (isVerifiedSuccess) return;

    const checkStatus = () => {
      const allUsers = AppStorage.getUsers();
      const freshUser = allUsers.find((u) => u.id === currentUser.id);

      if (freshUser && freshUser.status === 'ACTIVE') {
        setIsVerifiedSuccess(true);
        AppStorage.setSessionUser(freshUser.id);
        setTimeout(() => {
          onApproved(freshUser);
        }, 800);
      } else if (!freshUser && onLogout) {
        onLogout();
      }
    };

    const intervalId = setInterval(checkStatus, 1500);
    return () => clearInterval(intervalId);
  }, [currentUser.id, onApproved, onLogout, isVerifiedSuccess]);

  return (
    <div className="fixed inset-0 w-screen h-screen overflow-hidden bg-white flex flex-col justify-between p-6 sm:p-10 select-none z-50">
      {/* Top Header: Brand in-Time di kiri, tombol Logout di kanan */}
      <header className="flex items-center justify-between w-full shrink-0">
        <div className="flex items-center gap-2">
          <img
            src="/assets/in-time-logo.png"
            alt="in-Time"
            className="h-7 sm:h-8 w-auto object-contain select-none"
          />
        </div>

        {onLogout && (
          <button
            type="button"
            onClick={onLogout}
            className="w-8 h-8 rounded-full bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-500 hover:text-slate-800 transition-all cursor-pointer flex items-center justify-center active:scale-95 shadow-2xs"
            title="Keluar ke Halaman Masuk"
            aria-label="Keluar ke Halaman Masuk"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </header>

      {/* Center: Animasi Loading Minimalis & Bersih */}
      <main className="flex-1 flex items-center justify-center">
        <div className="flex flex-col items-center text-center px-4">
          {!isVerifiedSuccess ? (
            <div className="flex flex-col items-center gap-3 animate-in fade-in duration-300">
              <div className="inline-flex items-center gap-3 px-5 py-2.5 rounded-full bg-slate-50/90 border border-slate-200/80 shadow-2xs">
                {/* Single hairline minimal spinner */}
                <span className="w-4 h-4 border-[1.5px] border-slate-200 border-t-[#1E3A8A] rounded-full animate-spin shrink-0" />
                
                {/* Teks: Menunggu Verifikasi Akun Anda */}
                <span className="text-xs sm:text-sm font-semibold text-slate-800 tracking-tight">
                  Menunggu Verifikasi Akun Anda
                </span>
              </div>
            </div>
          ) : (
            <div className="inline-flex items-center gap-2.5 px-5 py-2.5 rounded-full bg-emerald-50 border border-emerald-200 shadow-2xs animate-in zoom-in-95 duration-200">
              <Check className="w-4 h-4 text-emerald-600 stroke-[2.5]" />
              <span className="text-xs sm:text-sm font-semibold text-emerald-800">
                Akun Terverifikasi
              </span>
            </div>
          )}
        </div>
      </main>

      {/* Bottom Spacer */}
      <div className="w-full shrink-0 h-8" aria-hidden="true" />
    </div>
  );
}
