import React, { useState, useMemo } from 'react';
import {
  Mail,
  X,
  Maximize2,
  Minimize2,
  ExternalLink,
  Calendar,
  CheckCircle2,
  FileText,
  User,
  Paperclip,
  CheckCheck,
  Search,
  Filter,
  Kanban,
  FileCheck,
  Clock,
  AlertCircle,
  ShieldCheck,
  Layers,
  Inbox,
  Send,
} from 'lucide-react';
import { EmailNotification, User as UserType } from '../../types/index.ts';
import { EMPLOYMENT_TYPE_LABELS } from '../../lib/whatsapp-recap.ts';

interface EmailNotificationModalProps {
  isOpen: boolean;
  onClose: () => void;
  emails: EmailNotification[];
  currentUser?: UserType | null;
  onNavigateTab: (tabId: string) => void;
  onMarkAsRead?: (id: string) => void;
  onMarkAllAsRead?: () => void;
}

export function EmailNotificationModal({
  isOpen,
  onClose,
  emails,
  currentUser,
  onNavigateTab,
  onMarkAsRead,
  onMarkAllAsRead,
}: EmailNotificationModalProps) {
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [selectedFilter, setSelectedFilter] = useState<'ALL' | 'TASK' | 'LEAVE' | 'ACCOUNT'>('ALL');
  const [scopeFilter, setScopeFilter] = useState<'FOR_ME' | 'ALL'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  if (!isOpen) return null;

  const isAdminOrSuperAdmin =
    currentUser?.role === 'ADMIN' || currentUser?.role === 'SUPER_ADMIN';

  const categoryBadgeStyles: Record<string, string> = {
    ACCOUNT_VERIFIED: 'bg-emerald-50 text-emerald-800 border-emerald-200',
    TASK_ASSIGNED: 'bg-blue-50 text-blue-700 border-blue-200',
    TASK_IN_PROGRESS: 'bg-cyan-50 text-cyan-700 border-cyan-200',
    TASK_SUBMITTED: 'bg-amber-50 text-amber-700 border-amber-200',
    TASK_REVISION: 'bg-rose-50 text-rose-700 border-rose-200',
    TASK_APPROVED: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    LEAVE: 'bg-indigo-50 text-indigo-700 border-indigo-200',
    WFH: 'bg-amber-50 text-amber-900 border-amber-200',
    SICK: 'bg-orange-50 text-orange-900 border-orange-200',
    BUSINESS_TRIP: 'bg-purple-50 text-purple-900 border-purple-200',
  };

  const categoryTitles: Record<string, string> = {
    ACCOUNT_VERIFIED: 'Verifikasi Akun (ACC)',
    TASK_ASSIGNED: 'Penugasan Baru',
    TASK_IN_PROGRESS: 'Pengerjaan Dimulai',
    TASK_SUBMITTED: 'Tugas Dikirim (Review)',
    TASK_REVISION: 'Permintaan Revisi',
    TASK_APPROVED: 'Tugas Selesai (ACC)',
    LEAVE: 'Izin / Cuti',
    WFH: 'Work From Home (WFH)',
    SICK: 'Sakit',
    BUSINESS_TRIP: 'Dinas Luar',
  };

  // Filter list data
  const filteredEmails = emails.filter((mail) => {
    // 1. Filter Scope (Untuk Saya vs Semua)
    if (scopeFilter === 'FOR_ME' && currentUser) {
      const isDirect =
        mail.toEmail.toLowerCase() === currentUser.email.toLowerCase() ||
        mail.toName.toLowerCase() === currentUser.name.toLowerCase();
      const isAdminOrSuperAdmin = currentUser.role === 'ADMIN' || currentUser.role === 'SUPER_ADMIN';
      const isLeaveForAdmin =
        isAdminOrSuperAdmin &&
        (mail.recipientRole === 'ADMIN' ||
          mail.recipientRole === 'SUPER_ADMIN' ||
          (!mail.recipientRole && (mail.notificationType === 'LEAVE' || mail.subject.toLowerCase().includes('pengajuan izin'))));
      if (!isDirect && !isLeaveForAdmin) return false;
    }

    // 2. Filter Tipe Notifikasi
    const isTaskNotification =
      mail.notificationType === 'TASK' ||
      mail.category.startsWith('TASK_') ||
      Boolean(mail.taskTitle) ||
      Boolean(mail.taskId);

    const isAccountNotification =
      mail.notificationType === 'ACCOUNT' ||
      mail.category === 'ACCOUNT_VERIFIED';

    if (selectedFilter === 'TASK' && !isTaskNotification) return false;
    if (selectedFilter === 'LEAVE' && (isTaskNotification || isAccountNotification)) return false;
    if (selectedFilter === 'ACCOUNT' && !isAccountNotification) return false;

    // 3. Search Query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      const match =
        mail.subject.toLowerCase().includes(q) ||
        mail.toName.toLowerCase().includes(q) ||
        mail.toEmail.toLowerCase().includes(q) ||
        mail.fromName.toLowerCase().includes(q) ||
        mail.employeeName.toLowerCase().includes(q) ||
        (mail.taskTitle && mail.taskTitle.toLowerCase().includes(q)) ||
        (mail.reason && mail.reason.toLowerCase().includes(q)) ||
        (mail.notes && mail.notes.toLowerCase().includes(q));
      if (!match) return false;
    }

    return true;
  });

  const unreadCount = filteredEmails.filter((m) => !m.read).length;
  const taskCount = emails.filter(
    (m) =>
      m.notificationType === 'TASK' ||
      m.category.startsWith('TASK_') ||
      Boolean(m.taskTitle)
  ).length;
  const leaveCount = emails.filter(
    (m) =>
      m.notificationType === 'LEAVE' ||
      (!m.category.startsWith('TASK_') &&
        !m.taskTitle &&
        m.notificationType !== 'ACCOUNT' &&
        m.category !== 'ACCOUNT_VERIFIED')
  ).length;
  const accountCount = emails.filter(
    (m) =>
      m.notificationType === 'ACCOUNT' ||
      m.category === 'ACCOUNT_VERIFIED'
  ).length;

  const handleActionNavigate = (mail: EmailNotification) => {
    if (onMarkAsRead && !mail.read) {
      onMarkAsRead(mail.id);
    }
    onClose();

    // Tentukan tab tujuan
    let targetTab = 'dashboard';
    const link = mail.directApprovalLink || '';
    if (link.includes('tasks_team')) {
      targetTab = 'tasks_team';
    } else if (link.includes('tasks_my')) {
      targetTab = 'tasks_my';
    } else if (link.includes('tasks')) {
      targetTab = isAdminOrSuperAdmin ? 'tasks_team' : 'tasks_my';
    } else if (link.includes('leaves_approval')) {
      targetTab = 'leaves_approval';
    } else if (link.includes('leaves_my')) {
      targetTab = 'leaves_my';
    } else if (link.includes('leaves')) {
      targetTab = isAdminOrSuperAdmin ? 'leaves_approval' : 'leaves_my';
    } else if (link.includes('login') || link.includes('account')) {
      targetTab = isAdminOrSuperAdmin ? 'employees' : 'dashboard';
    }

    onNavigateTab(targetTab);
  };

  return (
    <div
      className={`fixed inset-0 z-50 flex animate-in fade-in duration-200 ${
        isFullScreen
          ? 'items-center justify-center p-0'
          : 'justify-end items-center p-2.5 sm:p-4 md:p-5'
      }`}
    >
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-950/40 backdrop-blur-xs transition-opacity cursor-pointer"
        onClick={onClose}
      />

      {/* Modal Dialog Card */}
      <div
        className={`relative z-10 bg-white shadow-2xl flex flex-col min-h-0 overflow-hidden transition-all duration-300 font-sans ${
          isFullScreen
            ? 'w-full h-full max-w-none max-h-none rounded-none border-0'
            : 'w-full max-w-lg sm:max-w-xl md:max-w-2xl h-full max-h-[calc(100vh-1.25rem)] sm:max-h-[calc(100vh-2rem)] rounded-3xl border border-slate-200/80 animate-in slide-in-from-right duration-300 ease-out'
        }`}
      >
        {/* Header */}
        <div className="px-5 sm:px-6 py-4 border-b border-slate-100 bg-white flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            {/* Zoom Button */}
            <button
              type="button"
              onClick={() => setIsFullScreen(!isFullScreen)}
              className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl border border-slate-200/80 transition-colors cursor-pointer shrink-0"
              title={isFullScreen ? 'Perkecil Tampilan' : 'Perbesar Layar Penuh'}
            >
              {isFullScreen ? (
                <Minimize2 className="w-4 h-4 text-slate-600" />
              ) : (
                <Maximize2 className="w-4 h-4 text-slate-600" />
              )}
            </button>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-base text-slate-900 truncate">
                  Log Notifikasi Email Masuk
                </h3>
                {unreadCount > 0 && (
                  <span className="px-2 py-0.5 rounded-full bg-rose-100 text-rose-700 font-bold text-[11px] shrink-0 border border-rose-200">
                    {unreadCount} Baru
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 mt-0.5 truncate">
                Simulasi otomatis pengiriman email untuk proses penugasan &amp; perizinan
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {onMarkAllAsRead && unreadCount > 0 && (
              <button
                type="button"
                onClick={onMarkAllAsRead}
                className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-600 hover:text-[#1E3A8A] hover:bg-blue-50 border border-slate-200/80 transition-all cursor-pointer"
                title="Tandai semua sudah dibaca"
              >
                <CheckCheck className="w-3.5 h-3.5 text-blue-600" />
                <span>Tandai Dibaca</span>
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full border border-slate-200 transition-colors cursor-pointer shrink-0"
              title="Tutup"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Filter Bar & Search */}
        <div className="px-5 sm:px-6 py-3 border-b border-slate-100 bg-slate-50/70 space-y-2.5 shrink-0">
          <div className="flex flex-wrap items-center justify-between gap-2">
            {/* Category Filter Tabs */}
            <div className="flex items-center gap-1.5 p-1 bg-white border border-slate-200/80 rounded-2xl shadow-2xs">
              <button
                type="button"
                onClick={() => setSelectedFilter('ALL')}
                className={`px-3 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  selectedFilter === 'ALL'
                    ? 'bg-[#1E3A8A] text-white shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                Semua ({emails.length})
              </button>
              <button
                type="button"
                onClick={() => setSelectedFilter('TASK')}
                className={`px-3 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                  selectedFilter === 'TASK'
                    ? 'bg-[#1E3A8A] text-white shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                <Kanban className="w-3.5 h-3.5" />
                <span>Penugasan ({taskCount})</span>
              </button>
              <button
                type="button"
                onClick={() => setSelectedFilter('LEAVE')}
                className={`px-3 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                  selectedFilter === 'LEAVE'
                    ? 'bg-[#1E3A8A] text-white shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                <Calendar className="w-3.5 h-3.5" />
                <span>Izin ({leaveCount})</span>
              </button>
              <button
                type="button"
                onClick={() => setSelectedFilter('ACCOUNT')}
                className={`px-3 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                  selectedFilter === 'ACCOUNT'
                    ? 'bg-[#1E3A8A] text-white shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>Akun ({accountCount})</span>
              </button>
            </div>

            {/* Scope Filter: Untuk Saya vs Semua Log */}
            {currentUser && (
              <div className="flex items-center gap-1 bg-white border border-slate-200/80 rounded-2xl p-1 text-xs shadow-2xs">
                <button
                  type="button"
                  onClick={() => setScopeFilter('FOR_ME')}
                  className={`px-2.5 py-1 rounded-xl font-medium transition-all cursor-pointer ${
                    scopeFilter === 'FOR_ME'
                      ? 'bg-blue-100 text-[#1E3A8A] font-bold'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                  title={`Tampilkan email untuk ${currentUser.name}`}
                >
                  Untuk Saya
                </button>
                <button
                  type="button"
                  onClick={() => setScopeFilter('ALL')}
                  className={`px-2.5 py-1 rounded-xl font-medium transition-all cursor-pointer ${
                    scopeFilter === 'ALL'
                      ? 'bg-blue-100 text-[#1E3A8A] font-bold'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                  title="Tampilkan seluruh log simulasi sistem"
                >
                  Semua Log
                </button>
              </div>
            )}
          </div>

          {/* Search Input Bar */}
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari subjek email, nama karyawan, judul tugas, atau keterangan..."
              className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 shadow-2xs transition-all"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* List of Simulated Emails */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
          {filteredEmails.length === 0 ? (
            <div className="py-16 text-center text-slate-500 space-y-3">
              <div className="w-16 h-16 rounded-3xl bg-slate-100 border border-slate-200 flex items-center justify-center mx-auto text-slate-400 shadow-inner">
                <Inbox className="w-8 h-8" />
              </div>
              <div>
                <p className="font-bold text-sm text-slate-800">
                  Belum ada notifikasi email yang cocok
                </p>
                <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                  {selectedFilter === 'TASK'
                    ? 'Buat penugasan baru di papan tugas atau ubah status tugas untuk melihat pengiriman email otomatis.'
                    : 'Ajukan perizinan baru atau buat tugas untuk memicu notifikasi email simulasi.'}
                </p>
              </div>
            </div>
          ) : (
            filteredEmails.map((mail) => {
              const isTask =
                mail.notificationType === 'TASK' ||
                mail.category.startsWith('TASK_') ||
                Boolean(mail.taskTitle);

              const isAccount =
                mail.notificationType === 'ACCOUNT' ||
                mail.category === 'ACCOUNT_VERIFIED';

              return (
                <div
                  key={mail.id}
                  onClick={() => {
                    if (onMarkAsRead && !mail.read) {
                      onMarkAsRead(mail.id);
                    }
                  }}
                  className={`bg-slate-50/90 rounded-2xl border p-4 sm:p-5 space-y-3.5 transition-all relative ${
                    mail.read
                      ? 'border-slate-200/90 hover:border-slate-300 opacity-95'
                      : 'border-blue-300/80 bg-blue-50/30 shadow-xs hover:border-blue-400'
                  }`}
                >
                  {/* Unread indicator dot */}
                  {!mail.read && (
                    <span
                      className="absolute top-4 right-4 w-2.5 h-2.5 rounded-full bg-blue-600 ring-4 ring-blue-100"
                      title="Belum dibaca"
                    />
                  )}

                  {/* Meta Bar */}
                  <div className="flex items-start justify-between gap-3 pr-4 flex-wrap">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] text-slate-400 block">
                          Terkirim: {mail.sentAt}
                        </span>
                        {!mail.read && (
                          <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-md bg-rose-100 text-rose-700">
                            Baru
                          </span>
                        )}
                      </div>
                      <h4 className="font-bold text-slate-900 text-sm sm:text-base mt-0.5 leading-snug">
                        {mail.subject}
                      </h4>
                    </div>
                    <span
                      className={`text-xs font-bold px-2.5 py-1 rounded-full border shrink-0 ${
                        categoryBadgeStyles[mail.category] || 'bg-slate-100 text-slate-700 border-slate-200'
                      }`}
                    >
                      {categoryTitles[mail.category] || mail.category}
                    </span>
                  </div>

                  {/* Email Content Box */}
                  <div className="bg-white rounded-xl p-4 border border-slate-200/80 text-xs sm:text-sm text-slate-700 space-y-2.5 font-sans shadow-2xs">
                    {/* Header: Kepada & Pengirim */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs pb-2.5 border-b border-slate-100">
                      <div>
                        <span className="text-slate-400 font-medium">Kepada:</span>{' '}
                        <strong className="text-slate-900">{mail.toName}</strong>{' '}
                        <span className="text-slate-500">({mail.toEmail})</span>
                      </div>
                      <div>
                        <span className="text-slate-400 font-medium">Pengirim:</span>{' '}
                        <strong className="text-slate-900">{mail.fromName}</strong>{' '}
                        {mail.fromEmail && (
                          <span className="text-slate-500">({mail.fromEmail})</span>
                        )}
                      </div>
                    </div>

                    {/* Body Description & Highlights */}
                    {isAccount ? (
                      /* KONTEN EMAIL KHUSUS VERIFIKASI AKUN */
                      <div className="space-y-2.5 pt-1">
                        <p className="text-xs sm:text-sm text-slate-700 leading-relaxed">
                          Selamat <strong className="text-slate-900">{mail.employeeName || mail.toName}</strong>! Pendaftaran akun Anda telah diverifikasi dan disetujui. Akun Anda telah aktif dan siap digunakan.
                        </p>

                        <div className="bg-emerald-50/70 p-3.5 rounded-xl border border-emerald-100/90 space-y-2 text-xs">
                          <p className="flex items-center gap-2">
                            <User className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                            <span>
                              Nama Pengguna:{' '}
                              <strong className="text-slate-900">{mail.employeeName || mail.toName}</strong>
                            </span>
                          </p>
                          <p className="flex items-center gap-2">
                            <Mail className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                            <span>
                              Email Terdaftar:{' '}
                              <strong className="text-slate-900">{mail.toEmail}</strong>
                            </span>
                          </p>
                          <p className="flex items-center gap-2">
                            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                            <span>
                              Hak Akses / Peran:{' '}
                              <strong className="text-slate-900">
                                {mail.recipientRole === 'SUPER_ADMIN'
                                  ? 'Superadmin'
                                  : mail.recipientRole === 'ADMIN'
                                  ? 'Admin'
                                  : 'Karyawan'}
                              </strong>
                            </span>
                          </p>
                          <p className="flex items-center gap-2">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                            <span>
                              Status Akun:{' '}
                              <span className="font-bold text-emerald-800 bg-emerald-100/80 px-2 py-0.5 rounded-md text-[11px] border border-emerald-200">
                                Aktif (Terverifikasi)
                              </span>
                            </span>
                          </p>
                        </div>
                      </div>
                    ) : isTask ? (
                      /* KONTEN EMAIL KHUSUS PENUGASAN TUGAS */
                      <div className="space-y-2.5 pt-1">
                        <p className="text-xs sm:text-sm text-slate-700 leading-relaxed">
                          {mail.category === 'TASK_ASSIGNED' && (
                            <>
                              Pemberitahuan penugasan resmi untuk tugas:{' '}
                              <strong className="text-slate-900">
                                {mail.taskTitle || mail.subject}
                              </strong>
                              .
                            </>
                          )}
                          {mail.category === 'TASK_IN_PROGRESS' && (
                            <>
                              Proses pengerjaan aktif telah dimulai oleh{' '}
                              <strong className="text-slate-900">{mail.employeeName}</strong>.
                            </>
                          )}
                          {mail.category === 'TASK_SUBMITTED' && (
                            <>
                              Hasil pengerjaan tugas telah dikirimkan oleh{' '}
                              <strong className="text-slate-900">{mail.employeeName}</strong>{' '}
                              dan siap ditinjau/ACC oleh PIC penugasan.
                            </>
                          )}
                          {mail.category === 'TASK_REVISION' && (
                            <>
                              Terdapat instruksi revisi perbaikan untuk tugas{' '}
                              <strong className="text-slate-900">
                                {mail.taskTitle || mail.subject}
                              </strong>
                              .
                            </>
                          )}
                          {mail.category === 'TASK_APPROVED' && (
                            <>
                              Tugas{' '}
                              <strong className="text-slate-900">
                                {mail.taskTitle || mail.subject}
                              </strong>{' '}
                              telah resmi disetujui (ACC) dan ditandai selesai.
                            </>
                          )}
                        </p>

                        <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-100 space-y-2 text-xs">
                          {mail.taskTitle && (
                            <p className="flex items-center gap-2">
                              <Kanban className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                              <span>
                                Judul Tugas: <strong className="text-slate-900">{mail.taskTitle}</strong>
                              </span>
                            </p>
                          )}
                          {mail.taskPriority && (
                            <p className="flex items-center gap-2">
                              <ShieldCheck className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                              <span>
                                Prioritas:{' '}
                                <span className="font-bold text-slate-800">
                                  {mail.taskPriority}
                                </span>
                              </span>
                            </p>
                          )}
                          {mail.dueDate && (
                            <p className="flex items-center gap-2">
                              <Calendar className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                              <span>
                                Batas Waktu (Due Date):{' '}
                                <strong className="text-slate-900">{mail.dueDate}</strong>
                              </span>
                            </p>
                          )}
                          {mail.picName && (
                            <p className="flex items-center gap-2">
                              <User className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                              <span>
                                PIC Penugasan: <strong className="text-slate-900">{mail.picName}</strong>
                              </span>
                            </p>
                          )}
                          {(mail.notes || mail.reason) && (
                            <p className="flex items-start gap-2 pt-1 border-t border-slate-200/60">
                              <FileText className="w-3.5 h-3.5 text-blue-600 shrink-0 mt-0.5" />
                              <span>
                                Catatan / Deskripsi:{' '}
                                <em className="text-slate-700">"{mail.notes || mail.reason}"</em>
                              </span>
                            </p>
                          )}
                          {mail.attachmentName && (
                            <p className="text-slate-600 pt-1 flex items-center gap-2 border-t border-slate-200/60">
                              <Paperclip className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                              <span>
                                Lampiran Deliverable:{' '}
                                <strong className="text-slate-900">{mail.attachmentName}</strong>
                              </span>
                            </p>
                          )}
                        </div>
                      </div>
                    ) : (
                      /* KONTEN EMAIL KHUSUS PERIZINAN & CUTI */
                      <div className="space-y-2 pt-1">
                        <p className="leading-relaxed">
                          Halo Administrator, karyawan{' '}
                          <strong className="text-slate-900">
                            {mail.employeeName} (
                            {(mail.employmentType && EMPLOYMENT_TYPE_LABELS[mail.employmentType]) ||
                              'Karyawan'}
                            )
                          </strong>{' '}
                          telah mengajukan permohonan{' '}
                          <strong>{categoryTitles[mail.category] || mail.category}</strong>:
                        </p>

                        <div className="bg-slate-50 p-3 rounded-lg border border-slate-100 space-y-1.5 text-xs">
                          {mail.dateRange && (
                            <p className="flex items-center gap-2">
                              <Calendar className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                              <span>
                                Rentang Waktu: <strong>{mail.dateRange}</strong>
                              </span>
                            </p>
                          )}
                          {mail.reason && (
                            <p className="flex items-start gap-2">
                              <FileText className="w-3.5 h-3.5 text-indigo-600 shrink-0 mt-0.5" />
                              <span>
                                Alasan: <em>"{mail.reason}"</em>
                              </span>
                            </p>
                          )}
                          {mail.attachmentName && (
                            <p className="text-slate-600 pt-1 flex items-center gap-1.5">
                              <Paperclip className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                              <span>
                                Lampiran Dokumen: <strong>{mail.attachmentName}</strong>
                              </span>
                            </p>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Direct Action Link */}
                  <div className="flex items-center justify-between pt-1">
                    <span className="text-xs text-slate-500 font-medium flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      Simulasi SMTP Dispatch Sukses
                    </span>
                    <button
                      type="button"
                      onClick={() => handleActionNavigate(mail)}
                      className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-[#1E3A8A] hover:bg-[#172554] text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer active:scale-95"
                    >
                      <span>
                        {isAccount
                          ? 'Buka Beranda Akun'
                          : isTask
                          ? mail.directApprovalLink?.includes('tasks_team')
                            ? 'Buka Tugas Tim'
                            : 'Buka Tugas Saya'
                          : 'Tautan Persetujuan'}
                      </span>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
