import React, { useEffect } from 'react';
import { X, User as UserIcon } from 'lucide-react';

export interface SimpleProfileData {
  name: string;
  avatar?: string;
}

export interface SimpleProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  profile: SimpleProfileData | null;
}

export const SimpleProfileModal: React.FC<SimpleProfileModalProps> = ({
  isOpen,
  onClose,
  profile,
}) => {
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

  if (!isOpen || !profile) return null;

  const fallbackAvatar = `https://ui-avatars.com/api/?name=${encodeURIComponent(profile.name)}&background=1E3A8A&color=ffffff&size=256&bold=true`;
  const avatarSrc = profile.avatar && profile.avatar.trim() !== '' ? profile.avatar : fallbackAvatar;

  return (
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-slate-950/45 backdrop-blur-xs animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="relative bg-white rounded-[28px] max-w-[280px] w-full p-6 shadow-2xl border border-slate-200/90 text-center flex flex-col items-center animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Tombol Tutup Silang di Kanan Atas */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-3.5 right-3.5 p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors cursor-pointer"
          title="Tutup"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Foto Profil */}
        <div className="relative mt-2">
          <img
            src={avatarSrc}
            alt={profile.name}
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).src = fallbackAvatar;
            }}
            className="w-28 h-28 rounded-2xl object-cover border-2 border-slate-100 shadow-sm"
          />
        </div>

        {/* Nama Orang */}
        <div className="mt-4 w-full px-2">
          <h3 className="font-bold text-base text-slate-900 tracking-tight leading-snug break-words">
            {profile.name}
          </h3>
        </div>
      </div>
    </div>
  );
};
