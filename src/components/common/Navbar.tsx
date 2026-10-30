import { useState, useEffect } from 'react';
import {
  Clock,
  Shield,
  UserCheck,
  ChevronDown,
  RotateCcw,
  Sparkles,
} from 'lucide-react';
import { User } from '../../types/index.ts';
import { getCurrentTimeString } from '../../lib/time-utils.ts';

interface NavbarProps {
  currentUser: User;
  users: User[];
  onSwitchUser: (userId: string) => void;
  onResetData: () => void;
}

export function Navbar({ currentUser, users, onSwitchUser, onResetData }: NavbarProps) {
  const [currentTime, setCurrentTime] = useState(getCurrentTimeString());
  const [showUserDropdown, setShowUserDropdown] = useState(false);

  // Update clock every second
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(getCurrentTimeString());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <header className="sticky top-0 z-40 bg-white/90 backdrop-blur-md border-b border-slate-200/80 px-4 sm:px-6 py-3">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
        {/* Brand / Logo */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-[#1E3A8A] flex items-center justify-center text-white shadow-xs">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-extrabold text-slate-900 text-sm sm:text-base tracking-tight">
                PresensiPro &amp; Tasks
              </h1>
              <span className="text-[10px] bg-blue-100 text-blue-800 font-bold px-1.5 py-0.2 rounded-md uppercase tracking-wider">
                Enterprise
              </span>
            </div>
            <p className="text-[11px] text-slate-500 hidden sm:block">
              PT Solusi Digital Nusantara • Sudirman CBD
            </p>
          </div>
        </div>

        {/* Center: Live Real-Time Clock WIB */}
        <div className="hidden md:flex items-center gap-2 px-3.5 py-1.5 bg-slate-100 border border-slate-200 rounded-full text-slate-700 shadow-inner">
          <Clock className="w-3.5 h-3.5 text-blue-600 animate-pulse" />
          <span className="text-xs font-mono font-bold tracking-wider">{currentTime}</span>
          <span className="text-[10px] font-semibold text-slate-400">WIB</span>
        </div>

        {/* Right: Quick Role & User Switcher + Reset */}
        <div className="flex items-center gap-2.5">
          {/* Reset Demo Button */}
          <button
            type="button"
            onClick={onResetData}
            title="Reset data demo ke pengaturan awal"
            className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors border border-transparent hover:border-slate-200"
          >
            <RotateCcw className="w-4 h-4" />
          </button>

          {/* User Account Dropdown Selector */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowUserDropdown(!showUserDropdown)}
              className="flex items-center gap-2.5 p-1.5 pr-3 rounded-2xl hover:bg-slate-100 transition-colors border border-slate-200 bg-white shadow-2xs"
            >
              <img
                src={currentUser.avatar}
                alt={currentUser.name}
                className="w-8 h-8 rounded-xl object-cover border border-slate-200"
              />
              <div className="text-left hidden sm:block">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-bold text-slate-900">{currentUser.name}</span>
                </div>
                <p className="text-[10px] text-slate-400 truncate max-w-[120px]">
                  {currentUser.position}
                </p>
              </div>
              <ChevronDown className="w-4 h-4 text-slate-400" />
            </button>

            {/* Dropdown Menu */}
            {showUserDropdown && (
              <div className="absolute right-0 mt-2 w-72 bg-white rounded-3xl shadow-2xl border border-slate-200/80 p-2 z-50 animate-in fade-in zoom-in-95">
                <div className="px-3 py-2 border-b border-slate-100">
                  <p className="text-xs font-bold text-slate-900">Ganti Akun Pengguna</p>
                  <p className="text-[11px] text-slate-400">
                    Pilih akun untuk menguji fitur sebagai Admin atau Karyawan
                  </p>
                </div>

                <div className="py-1 space-y-1">
                  {users.map((u) => {
                    const isSelected = u.id === currentUser.id;
                    return (
                      <button
                        key={u.id}
                        type="button"
                        onClick={() => {
                          onSwitchUser(u.id);
                          setShowUserDropdown(false);
                        }}
                        className={`w-full flex items-center gap-3 p-2 rounded-2xl text-left transition-all ${
                          isSelected
                            ? 'bg-blue-50 text-blue-900 border border-blue-200 font-semibold'
                            : 'hover:bg-slate-50 text-slate-700'
                        }`}
                      >
                        <img
                          src={u.avatar}
                          alt={u.name}
                          className="w-9 h-9 rounded-xl object-cover border border-slate-200"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <p className="text-xs font-bold truncate">{u.name}</p>
                            <span
                              className={`text-[9px] font-bold px-1.5 py-0.2 rounded ${
                                u.role === 'ADMIN'
                                  ? 'bg-indigo-100 text-indigo-800'
                                  : 'bg-slate-100 text-slate-600'
                              }`}
                            >
                              {u.role === 'ADMIN' ? 'ADMIN' : 'KARYAWAN'}
                            </span>
                          </div>
                          <p className="text-[10px] text-slate-400 truncate">{u.position}</p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
