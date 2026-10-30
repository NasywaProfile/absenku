import React, { useState, useEffect } from 'react';
import { X, Search, User as UserIcon, Edit3, Building2, MapPin, Laptop } from 'lucide-react';

export interface TeamMemberItem {
  id?: string;
  name: string;
  avatar?: string;
  role?: string;
  department?: string;
  statusBadge?: string;
  statusColor?: 'emerald' | 'amber' | 'blue' | 'rose' | 'slate';
  locationBadge?: string;
  locationColor?: 'emerald' | 'amber' | 'indigo' | 'slate';
}

export interface TeamMembersModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  members: TeamMemberItem[];
  isAdmin?: boolean;
  onEditMember?: (member: TeamMemberItem) => void;
}

export const TeamMembersModal: React.FC<TeamMembersModalProps> = ({
  isOpen,
  onClose,
  title,
  subtitle,
  members,
  isAdmin = false,
  onEditMember,
}) => {
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (!isOpen) {
      setSearchQuery('');
    }
  }, [isOpen]);

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

  if (!isOpen) return null;

  const filteredMembers = members.filter((m) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      m.name.toLowerCase().includes(q) ||
      (m.department && m.department.toLowerCase().includes(q)) ||
      (m.role && m.role.toLowerCase().includes(q)) ||
      (m.statusBadge && m.statusBadge.toLowerCase().includes(q)) ||
      (m.locationBadge && m.locationBadge.toLowerCase().includes(q))
    );
  });

  const getStatusBadgeStyle = (color?: string) => {
    switch (color) {
      case 'emerald':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'amber':
        return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'blue':
        return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'rose':
        return 'bg-rose-50 text-rose-700 border-rose-200';
      default:
        return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  const getLocationBadgeStyle = (color?: string) => {
    switch (color) {
      case 'amber':
        return 'bg-amber-50 text-amber-800 border-amber-200';
      case 'indigo':
        return 'bg-indigo-50 text-indigo-800 border-indigo-200';
      case 'emerald':
      default:
        return 'bg-emerald-50 text-emerald-800 border-emerald-200';
    }
  };

  return (
    <div
      className="fixed inset-0 z-[130] flex justify-end items-center p-2.5 sm:p-4 md:p-5 bg-slate-950/50 backdrop-blur-xs animate-in fade-in duration-200 font-sans"
      onClick={onClose}
    >
      <div
        className="relative z-10 bg-white shadow-2xl flex flex-col min-h-0 overflow-hidden w-full max-w-md sm:max-w-lg md:max-w-xl h-full max-h-[calc(100vh-1.25rem)] sm:max-h-[calc(100vh-2rem)] rounded-3xl border border-slate-200/80 animate-in slide-in-from-right duration-300 ease-out"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header / Top Bar dengan Input Pencarian & Tombol Silang */}
        <div className="px-5 sm:px-6 py-4 border-b border-slate-100 bg-white flex items-center justify-between gap-3 shrink-0">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari nama atau departemen..."
              className="w-full pl-9 pr-3.5 py-2.5 bg-slate-50 hover:bg-slate-100/70 focus:bg-white border border-slate-200 rounded-2xl text-xs sm:text-sm text-slate-800 placeholder-slate-400 outline-none focus:border-[#1E3A8A] transition-colors shadow-2xs"
            />
          </div>

          {/* Tombol Tutup Silang */}
          <button
            type="button"
            onClick={onClose}
            className="p-2.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full border border-slate-200 transition-colors cursor-pointer shrink-0"
            title="Tutup"
          >
            <X className="w-4 h-4" />
          </button>
        </div>



        {/* Member Grid / List */}
        <div className="p-5 sm:p-6 overflow-y-auto flex-1 custom-scrollbar">
          {filteredMembers.length === 0 ? (
            <div className="py-12 text-center text-slate-400 flex flex-col items-center justify-center space-y-2">
              <UserIcon className="w-8 h-8 text-slate-300" />
              <p className="text-sm font-semibold text-slate-600">Tidak ada anggota yang cocok</p>
              <p className="text-xs text-slate-400">Coba ubah kata kunci pencarian Anda.</p>
            </div>
          ) : (
            <div className="flex flex-col space-y-2.5">
              {filteredMembers.map((member, idx) => {
                const fallbackAvatar = `https://ui-avatars.com/api/?name=${encodeURIComponent(
                  member.name
                )}&background=1E3A8A&color=ffffff&size=128&bold=true`;
                const avatarSrc =
                  member.avatar && member.avatar.trim() !== '' ? member.avatar : fallbackAvatar;

                return (
                  <div
                    key={member.id || `${member.name}-${idx}`}
                    className="relative p-3.5 bg-white hover:bg-blue-50/40 rounded-2xl border border-slate-200/90 shadow-2xs hover:shadow-xs transition-all flex items-center justify-between gap-2.5 group"
                  >
                    {/* Icon edit pen di pojok kanan atas card (Hanya untuk Role Admin & Super Admin) */}
                    {isAdmin && onEditMember && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onEditMember(member);
                        }}
                        className="absolute top-2.5 right-3 p-1 text-slate-400 hover:text-[#1E3A8A] hover:bg-blue-50 rounded-lg transition-colors cursor-pointer z-10"
                        title={`Edit status kehadiran & lokasi ${member.name}`}
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                    )}

                    {/* Kiri: Foto Profil & Informasi Karyawan */}
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div className="relative w-11 h-11 rounded-2xl overflow-hidden bg-slate-100 border border-slate-200 shrink-0 shadow-2xs group-hover:scale-105 transition-transform duration-200">
                        <img
                          src={avatarSrc}
                          alt={member.name}
                          onError={(e) => {
                            (e.currentTarget as HTMLImageElement).src = fallbackAvatar;
                          }}
                          className="w-full h-full object-cover"
                        />
                      </div>

                      <div className="min-w-0 flex-1">
                        <h4 className="font-bold text-xs sm:text-sm text-slate-900 group-hover:text-[#1E3A8A] transition-colors truncate pr-7">
                          {member.name}
                        </h4>
                        {(member.department || member.role) && (
                          <p className="text-[11px] text-slate-500 truncate mt-0.5">
                            {member.department || member.role}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Kanan: Badge Status Hadir & Di Kantor / Di Luar Kantor / WFH */}
                    <div className="flex flex-col items-end gap-1 shrink-0 pt-3">
                      {member.statusBadge && (
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${getStatusBadgeStyle(
                            member.statusColor
                          )}`}
                        >
                          {member.statusBadge}
                        </span>
                      )}
                      {member.locationBadge && (
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${getLocationBadgeStyle(
                            member.locationColor
                          )}`}
                        >
                          {member.locationColor === 'amber' ? (
                            <MapPin className="w-2.5 h-2.5 text-amber-600" />
                          ) : member.locationColor === 'indigo' ? (
                            <Laptop className="w-2.5 h-2.5 text-indigo-600" />
                          ) : (
                            <Building2 className="w-2.5 h-2.5 text-emerald-600" />
                          )}
                          <span>{member.locationBadge}</span>
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
