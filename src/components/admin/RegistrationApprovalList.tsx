import React, { useState } from 'react';
import { UserCheck, Check, X } from 'lucide-react';
import { User, UserRole } from '../../types/index.ts';
import { EMPLOYMENT_TYPE_LABELS } from '../../lib/whatsapp-recap.ts';

interface RegistrationApprovalListProps {
  pendingUsers: User[];
  onApprove: (userId: string, role?: UserRole) => void;
  onReject: (userId: string) => void;
  onNavigateToAll?: () => void;
}

export function RegistrationApprovalList({
  pendingUsers,
  onApprove,
  onReject,
  onNavigateToAll,
}: RegistrationApprovalListProps) {
  // State per-user role selection (default ke user.role atau 'EMPLOYEE')
  const [selectedRoles, setSelectedRoles] = useState<Record<string, UserRole>>({});

  if (pendingUsers.length === 0) return null;

  const handleRoleChange = (userId: string, role: UserRole) => {
    setSelectedRoles((prev) => ({ ...prev, [userId]: role }));
  };

  return (
    <div className="bg-amber-50/80 border border-amber-300/80 rounded-2xl p-3.5 sm:p-4 space-y-3 font-sans w-full overflow-hidden shadow-2xs">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-xl bg-amber-500 text-white flex items-center justify-center shrink-0 shadow-xs">
            <UserCheck className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-bold text-xs sm:text-sm text-amber-950 truncate">
                Persetujuan Registrasi Akun Baru (Pending Approval)
              </h3>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-200 text-amber-950 border border-amber-300 shrink-0">
                {pendingUsers.length} Permohonan
              </span>
            </div>
            <p className="text-[11px] text-amber-800/90 truncate">
              Aktivasi akses sistem staf baru sesuai role dari Admin / Super Admin.
            </p>
          </div>
        </div>

        {onNavigateToAll && (
          <button
            type="button"
            onClick={onNavigateToAll}
            className="text-xs font-bold text-amber-900 hover:text-amber-950 underline underline-offset-2 cursor-pointer shrink-0 ml-auto"
          >
            Buka Tabel Persetujuan &rarr;
          </button>
        )}
      </div>

      {/* Grid persetujuan karyawan baru yang muat fit dalam 1 halaman */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-2.5 max-h-[calc(100vh-14rem)] overflow-y-auto custom-scrollbar pr-0.5">
        {pendingUsers.map((user) => {
          const currentChosenRole = selectedRoles[user.id] || user.role || 'EMPLOYEE';

          return (
            <div
              key={user.id}
              className="bg-white rounded-xl border border-amber-200/90 p-3 flex flex-col justify-between gap-2.5 shadow-2xs hover:shadow-xs transition-all w-full min-w-0"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <img
                  src={user.avatar}
                  alt={user.name}
                  className="w-10 h-10 rounded-xl object-cover border border-slate-200 shrink-0"
                />
                <div className="min-w-0 space-y-0.5 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <h4 className="font-bold text-xs sm:text-sm text-slate-900 truncate">{user.name}</h4>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-200 shrink-0">
                      {EMPLOYMENT_TYPE_LABELS[user.employmentType]}
                    </span>
                  </div>
                  <p className="text-[11px] font-bold text-slate-700 truncate">
                    {user.department || 'Operasional'}
                  </p>
                  <p className="text-[11px] text-slate-400 font-mono truncate max-w-full">
                    {user.email} {user.phone ? `• ${user.phone}` : ''}
                  </p>
                </div>
              </div>

              {/* Pemilihan Role & Tombol Aksi Icon Only Pastel */}
              <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100 text-xs">
                <div className="flex items-center gap-1.5 shrink-0">
                  <span className="text-[11px] font-semibold text-slate-500">Halaman / Role:</span>
                  <select
                    value={currentChosenRole}
                    onChange={(e) => handleRoleChange(user.id, e.target.value as UserRole)}
                    className="text-xs font-semibold bg-slate-50 border border-slate-200 text-slate-800 rounded-lg px-2 py-1 focus:outline-hidden focus:ring-1 focus:ring-indigo-600 cursor-pointer h-8"
                  >
                    <option value="EMPLOYEE">Karyawan</option>
                    <option value="ADMIN">Admin</option>
                    <option value="SUPER_ADMIN">Superadmin</option>
                  </select>
                </div>

                <div className="flex items-center gap-1.5 shrink-0 ml-auto">
                  <button
                    type="button"
                    onClick={() => onApprove(user.id, currentChosenRole)}
                    className="w-8 h-8 inline-flex items-center justify-center bg-emerald-100/90 hover:bg-emerald-200 text-emerald-800 border border-emerald-200/90 rounded-xl transition-all cursor-pointer active:scale-95 shadow-2xs"
                    title={`Setujui Akun sebagai ${currentChosenRole === 'SUPER_ADMIN' ? 'Superadmin' : currentChosenRole === 'ADMIN' ? 'Admin' : 'Karyawan'}`}
                  >
                    <Check className="w-4 h-4 text-emerald-700 stroke-[2.5]" />
                  </button>
                  <button
                    type="button"
                    onClick={() => onReject(user.id)}
                    className="w-8 h-8 inline-flex items-center justify-center bg-rose-100/90 hover:bg-rose-200 text-rose-800 border border-rose-200/90 rounded-xl transition-all cursor-pointer active:scale-95 shadow-2xs"
                    title="Tolak Pendaftaran"
                  >
                    <X className="w-4 h-4 text-rose-700 stroke-[2.5]" />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
