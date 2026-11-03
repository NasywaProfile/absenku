import React, { useState, useEffect } from 'react';
import {
  X,
  Search,
  User as UserIcon,
  Edit3,
  Building2,
  MapPin,
  Laptop,
  Paperclip,
  ExternalLink,
  Lock,
  Clock,
  ClipboardList,
  FileText,
  CalendarDays,
  AlertTriangle,
} from 'lucide-react';
import { openAttachmentDirectly } from '../../lib/open-media.ts';

export interface TeamMemberItem {
  id?: string;
  name: string;
  avatar?: string;
  role?: string;
  department?: string;
  clockInTime?: string;
  statusBadge?: string;
  statusColor?: 'emerald' | 'amber' | 'blue' | 'rose' | 'slate' | 'indigo' | 'purple';
  locationBadge?: string;
  locationColor?: 'emerald' | 'amber' | 'indigo' | 'purple' | 'slate';
  attachmentName?: string;
  attachmentData?: string;
  attachmentType?: string;
  logbookTasks?: string[];
  notes?: string;
}

export interface TeamMembersModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  members: TeamMemberItem[];
  isAdmin?: boolean;
  currentUserId?: string;
  currentUserName?: string;
  onEditMember?: (member: TeamMemberItem) => void;
}

export const TeamMembersModal: React.FC<TeamMembersModalProps> = ({
  isOpen,
  onClose,
  title,
  subtitle,
  members,
  isAdmin = false,
  currentUserId,
  currentUserName,
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
        return 'bg-[#DCFCE7] text-[#15803D] border-[#86EFAC]';
      case 'amber':
        return 'bg-[#FEF3C7] text-[#B45309] border-[#FCD34D]';
      case 'blue':
        return 'bg-[#DBEAFE] text-[#1D4ED8] border-[#93C5FD]';
      case 'rose':
        return 'bg-[#FFEDD5] text-[#C2410C] border-[#FDBA74]';
      case 'indigo':
        return 'bg-[#E0E7FF] text-[#4338CA] border-[#A5B4FC]';
      case 'purple':
        return 'bg-[#F3E8FF] text-[#7E22CE] border-[#D8B4FE]';
      default:
        return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  const getLocationBadgeStyle = (badge?: string, color?: string) => {
    const text = (badge || '').toLowerCase();
    if (text.includes('wfh') || text.includes('rumah')) {
      return 'bg-sky-50 text-sky-800 border-sky-200';
    }
    if (text.includes('dinas')) {
      return 'bg-amber-50 text-amber-800 border-amber-200';
    }
    if (text.includes('luar') || text.includes('radius')) {
      return 'bg-rose-50 text-rose-800 border-rose-200';
    }
    if (text.includes('dokter') || text.includes('sakit')) {
      return 'bg-rose-50 text-rose-800 border-rose-200';
    }
    if (text.includes('izin') || text.includes('resmi') || text.includes('cuti')) {
      return 'bg-sky-50 text-sky-800 border-sky-200';
    }
    // Default / Di Kantor
    return 'bg-teal-50 text-teal-800 border-teal-200';
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

                const isSelf = Boolean(
                  (currentUserId && member.id === currentUserId) ||
                  (currentUserName && member.name.toLowerCase() === currentUserName.toLowerCase())
                );

                return (
                  <div
                    key={member.id || `${member.name}-${idx}`}
                    className="relative p-3.5 bg-white hover:bg-blue-50/40 rounded-2xl border border-slate-200/90 shadow-2xs hover:shadow-xs transition-all flex flex-col gap-2.5 group"
                  >
                    {/* Icon edit pen di pojok kanan atas card (Hanya untuk anggota tim lain) */}
                    {isAdmin && onEditMember && !isSelf && (
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

                    {/* Baris Utama: Info Profil & Badges Status */}
                    <div className="flex items-center justify-between gap-2.5 w-full">
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
                          <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
                            {(member.department || member.role) && (
                              <span className="text-[11px] text-slate-500 truncate">
                                {member.department || member.role}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Kanan: Badge Waktu Presensi Masuk (Atas) & Badge Lokasi (Bawah) */}
                      <div className="flex flex-col items-end gap-1 shrink-0 pt-2">
                        {member.clockInTime ? (
                          (() => {
                            const isLate =
                              member.statusColor === 'amber' ||
                              Boolean(member.statusBadge && member.statusBadge.toLowerCase().includes('terlambat'));

                            let lateLabel = 'Terlambat';
                            if (member.statusBadge && member.statusBadge.includes('Terlambat')) {
                              const match = member.statusBadge.match(/Terlambat(\s*\([^)]*\))?/i);
                              if (match && match[0]) {
                                lateLabel = match[0].replace(' mnt', 'm');
                              }
                            }

                            return (
                              <span
                                className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold border shadow-2xs ${
                                  isLate
                                    ? 'bg-[#FEF3C7] text-[#B45309] border-[#FCD34D]'
                                    : 'bg-[#DCFCE7] text-[#15803D] border-[#86EFAC]'
                                }`}
                              >
                                <Clock className="w-3 h-3 shrink-0" />
                                <span>{member.clockInTime}</span>
                                {isLate && (
                                  <>
                                    <span className="text-amber-400 font-normal">&bull;</span>
                                    <span>{lateLabel}</span>
                                  </>
                                )}
                              </span>
                            );
                          })()
                        ) : member.statusBadge ? (
                          <span
                            className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold border shadow-2xs ${getStatusBadgeStyle(
                              member.statusColor
                            )}`}
                          >
                            {member.statusBadge.includes('•') ? (
                              <>
                                <span>{member.statusBadge.split('•')[0].trim()}</span>
                                <span className="text-[10px] font-extrabold text-amber-900 bg-amber-200/90 px-1.5 py-0.5 rounded-md">
                                  • {member.statusBadge.split('•')[1].trim()}
                                </span>
                              </>
                            ) : (
                              <span>{member.statusBadge}</span>
                            )}
                          </span>
                        ) : null}

                        {member.locationBadge && (
                          <span
                            className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${getLocationBadgeStyle(
                              member.locationBadge
                            )}`}
                          >
                            {(() => {
                              const text = (member.locationBadge || '').toLowerCase();
                              if (text.includes('wfh') || text.includes('rumah')) {
                                return <Laptop className="w-2.5 h-2.5 text-sky-600 shrink-0" />;
                              }
                              if (text.includes('dinas')) {
                                return <MapPin className="w-2.5 h-2.5 text-amber-600 shrink-0" />;
                              }
                              if (text.includes('luar') || text.includes('radius')) {
                                return <AlertTriangle className="w-2.5 h-2.5 text-rose-600 shrink-0" />;
                              }
                              if (text.includes('dokter') || text.includes('sakit')) {
                                return <FileText className="w-2.5 h-2.5 text-rose-600 shrink-0" />;
                              }
                              if (text.includes('izin') || text.includes('resmi') || text.includes('cuti')) {
                                return <CalendarDays className="w-2.5 h-2.5 text-sky-600 shrink-0" />;
                              }
                              return <Building2 className="w-2.5 h-2.5 text-teal-600 shrink-0" />;
                            })()}
                            <span>{member.locationBadge}</span>
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Dokumen / Surat Lampiran (Desain Elegan Persis Kontainer Logbook / Tugas Harian) */}
                    {member.attachmentName && (
                      <div className="pt-2 border-t border-slate-100 flex flex-col gap-1.5 w-full bg-slate-50/70 p-2.5 rounded-xl border border-slate-200/60">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-700">
                            <FileText className="w-3.5 h-3.5 text-[#1E3A8A]" />
                            <span>Dokumen / Surat Lampiran:</span>
                          </div>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              openAttachmentDirectly({
                                url: member.attachmentData,
                                name: member.attachmentName,
                                type: member.attachmentType || 'FILE',
                              });
                            }}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-bold bg-[#1E3A8A] hover:bg-blue-900 text-white shadow-2xs transition-all cursor-pointer active:scale-95 shrink-0"
                            title={`Buka surat / dokumen: ${member.attachmentName}`}
                          >
                            <span>Buka Surat</span>
                            <ExternalLink className="w-2.5 h-2.5" />
                          </button>
                        </div>
                        <div className="flex items-center gap-1.5 text-[11px] text-slate-700 font-medium pl-1 truncate">
                          <Paperclip className="w-3 h-3 text-slate-400 shrink-0" />
                          <span className="truncate">{member.attachmentName}</span>
                        </div>
                      </div>
                    )}

                    {/* Logbook / Daftar Tugas Harian (Hanya Muncul Jika Sudah Diisi oleh Staf) */}
                    {member.logbookTasks && member.logbookTasks.length > 0 && (
                      <div className="pt-2 border-t border-slate-100 flex flex-col gap-1.5 w-full bg-slate-50/70 p-2.5 rounded-xl border border-slate-200/60">
                        <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-700">
                          <ClipboardList className="w-3.5 h-3.5 text-[#1E3A8A]" />
                          <span>Logbook / Tugas Harian:</span>
                        </div>
                        <div className="flex flex-col gap-1 pl-1">
                          {member.logbookTasks.map((task, tIdx) => (
                            <div key={tIdx} className="flex items-start gap-1.5 text-[11px] text-slate-600 leading-snug">
                              <span className="text-slate-400 mt-0.5 select-none">•</span>
                              <span>{task}</span>
                            </div>
                          ))}
                        </div>
                        {member.notes && member.notes.trim() && (
                          <div className="text-[10px] text-slate-500 italic mt-0.5 pt-1 border-t border-slate-200/60">
                            Catatan: {member.notes}
                          </div>
                        )}
                      </div>
                    )}
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
