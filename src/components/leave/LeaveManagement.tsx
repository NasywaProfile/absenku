import React, { useState, useMemo } from 'react';
import {
  CalendarDays,
  Plus,
  CheckCircle2,
  Clock,
  XCircle,
  FileText,
  Upload,
  Check,
  X,
  Paperclip,
  ClipboardCopy,
  Mail,
  ChevronDown,
  Calendar,
  FileSpreadsheet,
  Trash2,
  Download,
  AlertCircle,
  User as UserIcon,
  Loader2,
  Cloud,
  Maximize2,
  Minimize2,
} from 'lucide-react';
import { LeaveRequest, LeaveCategory, User, UserRole } from '../../types/index.ts';
import { AppStorage } from '../../lib/storage.ts';
import { formatIndonesianDate } from '../../lib/time-utils.ts';
import { downloadLeaveSpreadsheet } from '../../lib/csv-export.ts';
import {
  generateWhatsAppLeaveRecap,
  copyTextToClipboard,
  EMPLOYMENT_TYPE_LABELS,
} from '../../lib/whatsapp-recap.ts';
import { LeaveRequestIllustration } from '../common/Illustrations.tsx';
import { uploadToCloudinary } from '../../lib/cloudinary.ts';
import { ModernConfirmDialog } from '../common/ModernConfirmDialog.tsx';
import { SimpleProfileModal, SimpleProfileData } from '../common/SimpleProfileModal.tsx';

interface LeaveManagementProps {
  currentUser: User;
  leaves?: LeaveRequest[];
  leaveRequests?: LeaveRequest[];
  userRole?: UserRole;
  onLeaveUpdated?: () => void;
  onRefresh?: () => void;
  onOpenEmailModal?: () => void;
}

export function LeaveManagement({
  currentUser,
  leaves: propLeaves,
  leaveRequests: propLeaveRequests,
  userRole,
  onLeaveUpdated,
  onRefresh,
  onOpenEmailModal,
}: LeaveManagementProps) {
  const leaves = propLeaves || propLeaveRequests || AppStorage.getLeaveRequests();

  const notifyUpdated = () => {
    if (onLeaveUpdated) onLeaveUpdated();
    if (onRefresh) onRefresh();
  };

  const isAdmin =
    currentUser.role === 'ADMIN' ||
    currentUser.role === 'SUPER_ADMIN' ||
    userRole === 'ADMIN' ||
    userRole === 'SUPER_ADMIN';

  // Filter states
  const [dateFilterOpen, setDateFilterOpen] = useState(false);
  const [specificDateFilter, setSpecificDateFilter] = useState('');
  const [sortOrder, setSortOrder] = useState<'DESC' | 'ASC'>('DESC');
  const [filterCategory, setFilterCategory] = useState<string>('ALL');
  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  // Untuk Admin: opsi melihat milik pribadi (default) atau seluruh tim
  const [adminScope, setAdminScope] = useState<'MY' | 'ALL'>('MY');

  // Detail Modal & Cancel Modal
  const [selectedLeaveDetail, setSelectedLeaveDetail] = useState<LeaveRequest | null>(null);
  const [cancelTargetId, setCancelTargetId] = useState<string | null>(null);

  // Form Modal Ajukan Izin Baru
  const [showModal, setShowModal] = useState(false);
  const [isFormModalFullScreen, setIsFormModalFullScreen] = useState(false);
  const [category, setCategory] = useState<LeaveCategory>('LEAVE');
  const [startDate, setStartDate] = useState(new Date().toISOString().substring(0, 10));
  const [endDate, setEndDate] = useState(new Date().toISOString().substring(0, 10));
  const [reason, setReason] = useState('');
  const [attachmentName, setAttachmentName] = useState<string | undefined>();
  const [attachmentData, setAttachmentData] = useState<string | undefined>();
  const [attachmentType, setAttachmentType] = useState<string | undefined>();
  const [isUploadingAttachment, setIsUploadingAttachment] = useState(false);
  const [fileAlert, setFileAlert] = useState<string | null>(null);
  const [simpleProfilePopup, setSimpleProfilePopup] = useState<SimpleProfileData | null>(null);
  const allUsers = useMemo(() => AppStorage.getUsers(), []);

  // Dialog Tolak (Khusus Admin saat otorisasi)
  const [rejectDialog, setRejectDialog] = useState<{
    isOpen: boolean;
    leaveId: string;
    userName: string;
    reason: string;
  }>({
    isOpen: false,
    leaveId: '',
    userName: '',
    reason: '',
  });

  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [emailDispatchedToast, setEmailDispatchedToast] = useState(false);

  // Format Tanggal Ringkas Bahasa Indonesia (contoh: 24 Okt 2026)
  const formatShortDate = (dateStr: string) => {
    if (!dateStr) return '';
    try {
      const parts = dateStr.split('-');
      if (parts.length === 3) {
        const d = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
        return new Intl.DateTimeFormat('id-ID', {
          day: 'numeric',
          month: 'short',
          year: 'numeric',
        }).format(d).replace(/[\u202f\u00a0\s]+/g, ' ').trim();
      }
      return dateStr;
    } catch {
      return dateStr;
    }
  };

  // Format Gabungan Periode & Durasi (contoh: 25 Okt 2026 • 1 Hari)
  const formatPeriodAndDuration = (start: string, end: string, days: number) => {
    const s = formatShortDate(start);
    if (!end || start === end) {
      return `${s} • ${days} Hari`;
    }
    const e = formatShortDate(end);
    return `${s} – ${e} • ${days} Hari`;
  };

  // Upload file attachment
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 10 * 1024 * 1024) {
        setFileAlert('Ukuran berkas melebihi batas maksimal 10MB. Silakan pilih berkas yang lebih kecil.');
        return;
      }
      setAttachmentName(file.name);
      setAttachmentType(file.type);
      setIsUploadingAttachment(true);
      try {
        const result = await uploadToCloudinary(file, { folder: 'absenku/perizinan' });
        setAttachmentData(result.url);
      } catch (err) {
        console.warn('Cloudinary upload fallback to base64:', err);
        const reader = new FileReader();
        reader.onloadend = () => {
          setAttachmentData(reader.result as string);
        };
        reader.readAsDataURL(file);
      } finally {
        setIsUploadingAttachment(false);
      }
    }
  };

  const calculateDays = (start: string, end: string) => {
    const s = new Date(start);
    const e = new Date(end);
    const diffTime = e.getTime() - s.getTime();
    if (diffTime < 0) return 1;
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
  };

  const totalDays = calculateDays(startDate, endDate);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason.trim()) return;

    AppStorage.submitLeaveRequest(currentUser, {
      category,
      startDate,
      endDate,
      totalDays,
      reason,
      attachmentName,
      attachmentData,
      attachmentType,
    });

    setShowModal(false);
    setReason('');
    setAttachmentName(undefined);
    setAttachmentData(undefined);
    notifyUpdated();

    setEmailDispatchedToast(true);
    setTimeout(() => setEmailDispatchedToast(false), 4000);
  };

  // Batalkan Pengajuan yang Masih Pending
  const executeCancelLeave = (id: string) => {
    AppStorage.deleteLeaveRequest(id);
    setCancelTargetId(null);
    if (selectedLeaveDetail?.id === id) {
      setSelectedLeaveDetail(null);
    }
    notifyUpdated();
  };

  const handleApprove = (id: string) => {
    AppStorage.approveLeave(id, currentUser.name);
    notifyUpdated();
    if (selectedLeaveDetail && selectedLeaveDetail.id === id) {
      setSelectedLeaveDetail({ ...selectedLeaveDetail, status: 'APPROVED', reviewedBy: currentUser.name });
    }
  };

  const handleReject = () => {
    if (rejectDialog.leaveId) {
      AppStorage.rejectLeave(
        rejectDialog.leaveId,
        rejectDialog.reason || 'Ditolak oleh Administrator',
        currentUser.name
      );
      if (selectedLeaveDetail && selectedLeaveDetail.id === rejectDialog.leaveId) {
        setSelectedLeaveDetail({
          ...selectedLeaveDetail,
          status: 'REJECTED',
          rejectionReason: rejectDialog.reason || 'Ditolak oleh Administrator',
        });
      }
      setRejectDialog({ isOpen: false, leaveId: '', userName: '', reason: '' });
      notifyUpdated();
    }
  };

  const handleCopyWA = async (leave: LeaveRequest) => {
    const text = generateWhatsAppLeaveRecap(leave);
    const success = await copyTextToClipboard(text);
    if (success) {
      setCopiedId(leave.id);
      setTimeout(() => setCopiedId(null), 2500);
    }
  };

  // Label Kategori (Tanpa angka awalan 1., 2., 3., 4.)
  const categoryLabels: Record<string, string> = {
    LEAVE: 'Izin / Cuti',
    WFH: 'WFH',
    SICK: 'Sakit',
    BUSINESS_TRIP: 'Dinas Luar',
    ANNUAL: 'Izin / Cuti',
  };

  const getCategoryBadgeClass = (cat: string) => {
    switch (cat) {
      case 'LEAVE':
      case 'ANNUAL':
        return 'bg-[#DCFCE7] text-[#15803D] hover:bg-[#BBF7D0]';
      case 'WFH':
        return 'bg-[#FEF3C7] text-[#B45309] hover:bg-[#FDE68A]';
      case 'SICK':
        return 'bg-[#FFEDD5] text-[#C2410C] hover:bg-[#FED7AA]';
      case 'BUSINESS_TRIP':
        return 'bg-[#E0E7FF] text-[#4338CA] hover:bg-[#C7D2FE]';
      default:
        return 'bg-slate-100 text-slate-700';
    }
  };

  // Hitung jumlah data per kategori untuk riwayat yang relevan
  const categoryCounts = useMemo(() => {
    let all = 0;
    let leave = 0;
    let wfh = 0;
    let sick = 0;
    let businessTrip = 0;

    leaves.forEach((l) => {
      // Default: riwayat pribadi
      if (!isAdmin || adminScope === 'MY') {
        if (l.userId !== currentUser.id) return;
      }
      all++;
      if (l.category === 'LEAVE') leave++;
      else if (l.category === 'WFH') wfh++;
      else if (l.category === 'SICK') sick++;
      else if (l.category === 'BUSINESS_TRIP') businessTrip++;
    });

    return { all, leave, wfh, sick, businessTrip };
  }, [leaves, isAdmin, adminScope, currentUser.id]);

  // Filter Data Pengajuan
  const filteredLeaves = useMemo(() => {
    let list = leaves.filter((l: LeaveRequest) => {
      // Default: riwayat pribadi
      if (!isAdmin || adminScope === 'MY') {
        if (l.userId !== currentUser.id) return false;
      }

      // Filter Kategori
      if (filterCategory !== 'ALL' && l.category !== filterCategory) return false;

      // Filter Status
      if (filterStatus !== 'ALL' && l.status !== filterStatus) return false;

      // Filter Tanggal Spesifik
      if (specificDateFilter) {
        const inRange =
          (l.startDate <= specificDateFilter && specificDateFilter <= l.endDate) ||
          (l.appliedAt && l.appliedAt.includes(specificDateFilter));
        if (!inRange) return false;
      }

      return true;
    });

    // Urutkan Tanggal
    list.sort((a, b) => {
      const dateA = a.startDate || a.appliedAt || '';
      const dateB = b.startDate || b.appliedAt || '';
      return sortOrder === 'DESC' ? dateB.localeCompare(dateA) : dateA.localeCompare(dateB);
    });

    return list;
  }, [
    leaves,
    isAdmin,
    adminScope,
    currentUser.id,
    filterCategory,
    filterStatus,
    specificDateFilter,
    sortOrder,
  ]);

  // Export Data Spreadsheet
  const handleExportSpreadsheet = () => {
    const categoryName =
      filterCategory === 'LEAVE'
        ? 'Izin / Cuti'
        : filterCategory === 'WFH'
        ? 'WFH'
        : filterCategory === 'SICK'
        ? 'Sakit'
        : filterCategory === 'BUSINESS_TRIP'
        ? 'Dinas Luar'
        : 'Semua Kategori';

    downloadLeaveSpreadsheet(filteredLeaves, categoryName);
  };

  return (
    <div className="space-y-4 font-sans antialiased">
      {/* Toast Notifikasi Email Otomatis */}
      {emailDispatchedToast && (
        <div className="p-4 bg-slate-900 text-white rounded-2xl shadow-xl flex items-center justify-between gap-3 animate-in fade-in slide-in-from-top-4 duration-300">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
              <Mail className="w-4 h-4" />
            </div>
            <div>
              <p className="font-bold text-xs sm:text-sm text-white">
                Notifikasi Email Otomatis Terkirim ke Admin
              </p>
              <p className="text-[11px] text-slate-300">
                Email berisi rincian izin dan tautan persetujuan telah diteruskan ke administrator.
              </p>
            </div>
          </div>
          {onOpenEmailModal && (
            <button
              type="button"
              onClick={onOpenEmailModal}
              className="px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white text-xs font-bold rounded-lg border border-white/20 cursor-pointer"
            >
              Lihat Log Email
            </button>
          )}
        </div>
      )}

      {/* 1. HEADER ATAS (1 BARIS RATA KANAN-KIRI) */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs p-3 sm:px-4 sm:py-3.5 flex flex-wrap items-center justify-between gap-3">
        {/* Sisi Kiri: Judul Halaman & Subteks */}
        <div>
          <h2 className="text-sm sm:text-base font-extrabold text-slate-900 tracking-tight leading-none">
            Riwayat Perizinan Saya
          </h2>
          <p className="text-[11px] text-slate-400 font-medium hidden sm:block pt-1">
            Kelola dan pantau status permohonan izin, cuti, WFH, dan dinas Anda
          </p>
        </div>

        {/* Sisi Kanan: Tombol Utama Ajukan Izin Baru & Ekspor Spreadsheet, lalu Tombol Pilih Tanggal & Filter Status di Bawah */}
        <div className="flex flex-col gap-2.5 w-full sm:w-auto">
          {/* Row 1: Tombol Ajukan (Lebar) & Spreadsheet */}
          <div className="flex items-center gap-2 sm:gap-2.5 w-full">
            <button
              type="button"
              onClick={() => setShowModal(true)}
              className="flex-1 sm:flex-initial h-11 sm:h-12 inline-flex items-center justify-center gap-2 bg-[#1E3A8A] hover:bg-[#172554] text-white font-bold text-xs sm:text-sm px-4 rounded-xl transition-all cursor-pointer shadow-xs active:scale-95"
            >
              <Plus className="w-4 h-4 stroke-[2.5]" />
              <span>Ajukan Perizinan Baru</span>
            </button>

            <button
              type="button"
              onClick={handleExportSpreadsheet}
              title="Ekspor Laporan Spreadsheet (.XLS)"
              aria-label="Ekspor Laporan Spreadsheet"
              className="w-11 h-11 sm:w-12 sm:h-12 bg-[#1E3A8A] hover:bg-[#172554] text-white rounded-xl transition-all shadow-xs cursor-pointer shrink-0 flex items-center justify-center active:scale-95"
            >
              <FileSpreadsheet className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>
          </div>

          {/* Row 2: Filter Pilih Tanggal dan Semua Status di Bawah */}
          <div className="grid grid-cols-2 gap-2 sm:gap-2.5 w-full">
            {/* Tombol Kalender: Pilih Tanggal */}
            <div className="relative w-full">
              <button
                type="button"
                onClick={() => setDateFilterOpen(!dateFilterOpen)}
                className="w-full flex items-center justify-between gap-1.5 bg-white hover:bg-slate-50 text-slate-700 hover:text-slate-900 font-semibold text-xs sm:text-sm px-3 sm:px-3.5 h-11 sm:h-12 rounded-xl transition-all cursor-pointer border border-slate-200 shadow-2xs"
                title="Pilih tanggal perizinan"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <Calendar className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-slate-500 shrink-0" />
                  <span className="truncate">
                    {specificDateFilter
                      ? `${specificDateFilter.split('-').reverse().join('/')}`
                      : 'Pilih Tanggal'}
                  </span>
                </div>
                <ChevronDown
                  className={`w-3.5 h-3.5 sm:w-4 sm:h-4 text-slate-500 transition-transform duration-200 shrink-0 ${
                    dateFilterOpen ? 'rotate-180' : ''
                  }`}
                />
              </button>

              {/* Dropdown Filter Tanggal */}
              {dateFilterOpen && (
                <>
                  <div
                    className="fixed inset-0 z-30"
                    onClick={() => setDateFilterOpen(false)}
                  />
                  <div className="absolute right-0 mt-2 w-72 max-w-[calc(100vw-2rem)] bg-white rounded-2xl border border-slate-200 shadow-xl p-3.5 z-40 text-xs animate-in fade-in zoom-in-95 duration-150 space-y-2.5">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                        Cari Berdasarkan Tanggal
                      </label>
                      <div className="flex items-center gap-1.5">
                        <input
                          type="date"
                          value={specificDateFilter}
                          onChange={(e) => {
                            setSpecificDateFilter(e.target.value);
                          }}
                          className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 outline-none focus:border-[#1E3A8A] focus:ring-2 focus:ring-blue-100 focus:bg-white font-medium cursor-pointer"
                        />
                        {specificDateFilter && (
                          <button
                            type="button"
                            onClick={() => setSpecificDateFilter('')}
                            className="px-2 py-1 text-[11px] font-bold text-[#1E3A8A] hover:bg-blue-50 rounded-lg cursor-pointer whitespace-nowrap"
                            title="Hapus Filter Tanggal"
                          >
                            Reset
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="border-t border-slate-100 pt-1" />
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                      Urutan Tanggal
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        setSortOrder('DESC');
                        setDateFilterOpen(false);
                      }}
                      className={`w-full text-left px-2.5 py-1.5 rounded-lg font-semibold transition-colors cursor-pointer ${
                        sortOrder === 'DESC'
                          ? 'bg-blue-50 text-[#1E3A8A] font-bold'
                          : 'text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      Terbaru ke Terlama
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setSortOrder('ASC');
                        setDateFilterOpen(false);
                      }}
                      className={`w-full text-left px-2.5 py-1.5 rounded-lg font-semibold transition-colors cursor-pointer ${
                        sortOrder === 'ASC'
                          ? 'bg-blue-50 text-[#1E3A8A] font-bold'
                          : 'text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      Terlama ke Terbaru
                    </button>
                  </div>
                </>
              )}
            </div>

            {/* Filter Status dengan Background Putih di Sebelah Tanggal */}
            <div className="relative w-full flex items-center">
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="w-full h-11 sm:h-12 pl-3 sm:pl-3.5 pr-8 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-semibold text-[#1E3A8A] outline-none cursor-pointer transition-all shadow-2xs appearance-none truncate"
                title="Filter berdasarkan status"
              >
                <option value="ALL">Semua Status</option>
                <option value="APPROVED">Disetujui</option>
                <option value="PENDING">Menunggu Persetujuan</option>
                <option value="REJECTED">Ditolak</option>
              </select>
              <ChevronDown className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-slate-500 absolute right-3 pointer-events-none shrink-0" />
            </div>
          </div>
        </div>
      </div>

      {/* 2. SATUKAN BARIS FILTER KATEGORI & TABEL KE DALAM SATU CARD SOLID */}
      <div className="bg-white rounded-3xl border border-slate-200/90 shadow-sm overflow-hidden select-none">
        {/* BARIS FILTER: KATEGORI PILL DI KIRI, SEARCH & STATUS DI KANAN */}
        <div className="p-3 sm:px-4 sm:py-3 flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 bg-white">
          {/* Category Filter Pills (Tanpa nomor) */}
          <div className="flex items-center gap-1.5 overflow-x-auto custom-scrollbar py-0.5 max-w-full">
            <button
              type="button"
              onClick={() => setFilterCategory('ALL')}
              className={`px-3 py-1.5 rounded-full text-xs transition-all cursor-pointer shrink-0 ${
                filterCategory === 'ALL'
                  ? 'bg-[#1E3A8A] text-white font-bold shadow-2xs'
                  : 'bg-blue-50 text-[#1E3A8A] hover:bg-blue-100 border border-blue-200/60 font-semibold'
              }`}
            >
              Semua ({categoryCounts.all})
            </button>
            <button
              type="button"
              onClick={() =>
                setFilterCategory(filterCategory === 'LEAVE' ? 'ALL' : 'LEAVE')
              }
              className={`px-3 py-1.5 rounded-full text-xs transition-all cursor-pointer shrink-0 ${
                filterCategory === 'LEAVE'
                  ? 'bg-[#1E3A8A] text-white font-bold shadow-2xs'
                  : 'bg-blue-50 text-[#1E3A8A] hover:bg-blue-100 border border-blue-200/60 font-semibold'
              }`}
            >
              Izin / Cuti ({categoryCounts.leave})
            </button>
            <button
              type="button"
              onClick={() =>
                setFilterCategory(filterCategory === 'WFH' ? 'ALL' : 'WFH')
              }
              className={`px-3 py-1.5 rounded-full text-xs transition-all cursor-pointer shrink-0 ${
                filterCategory === 'WFH'
                  ? 'bg-[#1E3A8A] text-white font-bold shadow-2xs'
                  : 'bg-blue-50 text-[#1E3A8A] hover:bg-blue-100 border border-blue-200/60 font-semibold'
              }`}
            >
              WFH ({categoryCounts.wfh})
            </button>
            <button
              type="button"
              onClick={() =>
                setFilterCategory(filterCategory === 'SICK' ? 'ALL' : 'SICK')
              }
              className={`px-3 py-1.5 rounded-full text-xs transition-all cursor-pointer shrink-0 ${
                filterCategory === 'SICK'
                  ? 'bg-[#1E3A8A] text-white font-bold shadow-2xs'
                  : 'bg-blue-50 text-[#1E3A8A] hover:bg-blue-100 border border-blue-200/60 font-semibold'
              }`}
            >
              Sakit ({categoryCounts.sick})
            </button>
            <button
              type="button"
              onClick={() =>
                setFilterCategory(filterCategory === 'BUSINESS_TRIP' ? 'ALL' : 'BUSINESS_TRIP')
              }
              className={`px-3 py-1.5 rounded-full text-xs transition-all cursor-pointer shrink-0 ${
                filterCategory === 'BUSINESS_TRIP'
                  ? 'bg-[#1E3A8A] text-white font-bold shadow-2xs'
                  : 'bg-blue-50 text-[#1E3A8A] hover:bg-blue-100 border border-blue-200/60 font-semibold'
              }`}
            >
              Dinas Luar ({categoryCounts.businessTrip})
            </button>
          </div>

          {/* Sisi Kanan: Scope Admin */}
          {isAdmin && (
            <div className="flex items-center gap-2 shrink-0 ml-auto">
              <select
                value={adminScope}
                onChange={(e) => setAdminScope(e.target.value as 'MY' | 'ALL')}
                className="px-2.5 py-1 bg-blue-50 border border-blue-200 rounded-xl text-xs font-semibold text-[#1E3A8A] outline-none cursor-pointer h-8"
                title="Pilih cakupan riwayat"
              >
                <option value="MY">Pengajuan Saya</option>
                <option value="ALL">Semua Staf (Mode Admin)</option>
              </select>
            </div>
          )}
        </div>

        {/* TABEL RIWAYAT PERIZINAN PRIBADI (Clickable row, single Detail button) */}
        <div className="w-full">
          <table className="w-full border-collapse text-left text-xs">
            {/* TABLE HEADER BERSIH & LEGA */}
            <thead>
              <tr className="border-b border-slate-200/80 bg-white text-slate-600 font-semibold text-xs">
                <th className="py-3 px-3.5 font-semibold text-slate-600 w-28">Kategori</th>
                <th className="py-3 px-3.5 font-semibold text-slate-600 w-44">Tanggal / Periode</th>
                <th className="py-3 px-3.5 font-semibold text-slate-600 w-28">Tgl Diajukan</th>
                <th className="py-3 px-3.5 font-semibold text-slate-600">Alasan &amp; Bukti</th>
                <th className="py-3 px-3.5 font-semibold text-slate-600 text-center w-32">Status Persetujuan</th>
                <th className="py-3 px-3.5 font-semibold text-slate-600 text-center w-24">Aksi</th>
              </tr>
            </thead>

            {/* TABLE BODY ROWS */}
            <tbody className="divide-y divide-slate-100">
              {filteredLeaves.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-16 text-center text-slate-400">
                    <div className="flex flex-col items-center justify-center space-y-2">
                      <LeaveRequestIllustration className="w-16 h-16 opacity-75" />
                      <p className="font-semibold text-slate-600">
                        Tidak ada riwayat perizinan yang sesuai filter atau pencarian.
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredLeaves.map((req) => {
                  const isApproved = req.status === 'APPROVED';
                  const isRejected = req.status === 'REJECTED';
                  const isPending = req.status === 'PENDING';
                  const isMyOwn = req.userId === currentUser.id;

                  return (
                    <tr
                      key={req.id}
                      onClick={() => setSelectedLeaveDetail(req)}
                      className="bg-white hover:bg-blue-50/40 transition-colors duration-150 cursor-pointer group"
                    >
                      {/* 1. Kategori: Badge Ringkas */}
                      <td className="py-3.5 px-3.5 whitespace-nowrap">
                        <span
                          className={`px-3 py-1 rounded-full text-xs font-semibold shadow-2xs inline-block ${getCategoryBadgeClass(
                            req.category
                          )}`}
                        >
                          {categoryLabels[req.category] || req.category}
                        </span>
                      </td>

                      {/* 3. Tanggal / Periode: Satukan Rentang Waktu & Durasi */}
                      <td className="py-3.5 px-3.5 whitespace-nowrap">
                        <span className="font-bold text-slate-800 text-xs">
                          {formatPeriodAndDuration(req.startDate, req.endDate, req.totalDays)}
                        </span>
                      </td>

                      {/* 4. Tgl Diajukan: Format Ringkas */}
                      <td className="py-3.5 px-3.5 whitespace-nowrap text-slate-600 text-xs font-medium">
                        {formatShortDate(req.appliedAt ? req.appliedAt.substring(0, 10) : req.startDate)}
                      </td>

                      {/* 5. Alasan & Bukti: Teks alasan singkat + ikon/link lampiran file di bawahnya */}
                      <td className="py-3.5 px-3.5">
                        <div className="space-y-1">
                          {/* Jika Admin melihat pengajuan staf lain dalam mode ALL, berikan tag kecil */}
                          {isAdmin && !isMyOwn && (
                            <span
                              onClick={(e) => {
                                e.stopPropagation();
                                const matched = allUsers.find((u) => u.id === req.userId || u.name === req.userName);
                                setSimpleProfilePopup({
                                  name: req.userName,
                                  avatar: matched?.avatar,
                                });
                              }}
                              className="inline-block text-[10px] font-bold bg-slate-100 hover:bg-blue-100 text-slate-600 hover:text-[#1E3A8A] px-1.5 py-0.5 rounded-md mr-1.5 cursor-pointer transition-colors"
                              title="Lihat Profil"
                            >
                              {req.userName}
                            </span>
                          )}
                          <p className="text-slate-800 font-medium line-clamp-1" title={req.reason}>
                            "{req.reason}"
                          </p>

                          {/* Lampiran Bukti File di Bawah Alasan */}
                          {req.attachmentName && (
                            <div className="flex items-center gap-1.5 text-[11px] text-blue-600 font-semibold pt-0.5">
                              <Paperclip className="w-3 h-3 shrink-0 text-blue-600" />
                              {req.attachmentData ? (
                                <a
                                  href={req.attachmentData}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  download={req.attachmentData.startsWith('http') ? undefined : req.attachmentName}
                                  onClick={(e) => e.stopPropagation()}
                                  className="truncate hover:underline"
                                  title={`Buka ${req.attachmentName}`}
                                >
                                  {req.attachmentName}
                                </a>
                              ) : (
                                <span className="truncate">{req.attachmentName}</span>
                              )}
                            </div>
                          )}

                          {/* Catatan Penolakan jika Ditolak */}
                          {req.rejectionReason && (
                            <p className="text-[11px] text-rose-600 italic line-clamp-1 pt-0.5">
                              Catatan Penolakan: "{req.rejectionReason}"
                            </p>
                          )}
                        </div>
                      </td>

                      {/* 6. Status Approval: Badge Ringkas */}
                      <td className="py-3.5 px-3.5 text-center whitespace-nowrap">
                        {isApproved ? (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-[#DCFCE7] text-[#15803D] border border-[#86EFAC]/70 shadow-2xs">
                            <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                            <span>Disetujui</span>
                          </span>
                        ) : isRejected ? (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-[#FFE4E6] text-[#E11D48] border border-[#FDA4AF]/70 shadow-2xs">
                            <X className="w-3.5 h-3.5 stroke-[2.5]" />
                            <span>Ditolak</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-[#FEF3C7] text-[#B45309] border border-[#FDE68A]/70 shadow-2xs">
                            <Clock className="w-3.5 h-3.5" />
                            <span>Menunggu</span>
                          </span>
                        )}
                      </td>

                      {/* 7. Aksi: Satu Tombol Detail Utama */}
                      <td className="py-3.5 px-3.5 text-center whitespace-nowrap">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedLeaveDetail(req);
                          }}
                          className="px-3.5 py-1.5 bg-[#F0F5FA] group-hover:bg-[#1E3A8A] text-[#1E3A8A] group-hover:text-white font-bold rounded-xl text-xs transition-all duration-150 shadow-2xs cursor-pointer border border-blue-200/50"
                          title="Lihat Rincian Pengajuan"
                        >
                          Detail
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 4. MODAL KONFIRMASI BATALKAN PENGAJUAN */}
      {cancelTargetId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs transition-opacity cursor-pointer"
            onClick={() => setCancelTargetId(null)}
          />
          <div className="relative w-full max-w-sm bg-white rounded-3xl border border-slate-200 shadow-2xl p-6 space-y-4 animate-in fade-in zoom-in-95 duration-200">
            <div>
              <h3 className="font-bold text-base text-slate-900">
                Batalkan Pengajuan?
              </h3>
              <p className="text-xs text-slate-500 pt-1 leading-relaxed">
                Pengajuan yang masih berstatus menunggu dapat dibatalkan dan akan dihapus dari sistem.
              </p>
            </div>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setCancelTargetId(null)}
                className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl text-xs cursor-pointer"
              >
                Kembali
              </button>
              <button
                type="button"
                onClick={() => executeCancelLeave(cancelTargetId)}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl text-xs cursor-pointer shadow-xs active:scale-95"
              >
                Ya, Batalkan
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 5. MODAL FORM PENGAJUAN PERIZINAN BARU */}
      {showModal && (
        <div
          className={`fixed inset-0 z-50 flex animate-in fade-in duration-200 ${
            isFormModalFullScreen
              ? 'items-center justify-center p-0'
              : 'justify-end items-center p-2.5 sm:p-4 md:p-5'
          }`}
        >
          <div
            className="fixed inset-0 bg-slate-950/40 backdrop-blur-xs transition-opacity cursor-pointer"
            onClick={() => setShowModal(false)}
          />
          <div
            className={`relative z-10 bg-white shadow-2xl flex flex-col min-h-0 overflow-hidden transition-all duration-300 font-sans ${
              isFormModalFullScreen
                ? 'w-full h-full max-w-none max-h-none rounded-none border-0'
                : 'w-full max-w-md sm:max-w-lg h-full max-h-[calc(100vh-1.25rem)] sm:max-h-[calc(100vh-2rem)] rounded-3xl border border-slate-200/80 animate-in slide-in-from-right duration-300 ease-out'
            }`}
          >
            {/* Header Drawer */}
            <div className="px-5 py-4 border-b border-slate-100 bg-white shrink-0">
              <div className="flex items-start justify-between gap-3">
                {/* Zoom Button di pojok kiri atas */}
                <div className="w-9 shrink-0 flex items-start">
                  <button
                    type="button"
                    onClick={() => setIsFormModalFullScreen(!isFormModalFullScreen)}
                    className="p-1.5 sm:p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl border border-slate-200/80 transition-colors cursor-pointer shrink-0 mt-0.5"
                    title={isFormModalFullScreen ? "Perkecil Tampilan" : "Perbesar Layar Penuh"}
                  >
                    {isFormModalFullScreen ? (
                      <Minimize2 className="w-4 h-4 text-slate-600" />
                    ) : (
                      <Maximize2 className="w-4 h-4 text-slate-600" />
                    )}
                  </button>
                </div>

                {/* Judul & Subjudul diposisikan di tengah persis seperti di pop up card tugas */}
                <div className="flex-1 min-w-0 text-center px-1 sm:px-3 space-y-1 flex flex-col items-center justify-center pt-1.5 sm:pt-2">
                  <h2 className="text-sm sm:text-[15px] font-bold text-slate-900 tracking-tight leading-snug max-w-2xl">
                    Formulir Pengajuan Perizinan Baru
                  </h2>
                  <p className="text-slate-500 text-[11px] sm:text-xs leading-relaxed font-normal whitespace-pre-wrap max-w-2xl">
                    Isi formulir berikut untuk mengajukan cuti, perizinan, sakit, atau dinas luar.
                  </p>
                </div>

                {/* Container Tombol Tutup Panel di pojok kanan atas */}
                <div className="w-9 shrink-0 flex items-start justify-end">
                  <button
                    type="button"
                    onClick={() => setShowModal(false)}
                    className="p-1.5 sm:p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer shrink-0 mt-0.5"
                    title="Tutup Panel"
                  >
                    <X className="w-4 h-4 sm:w-5 sm:h-5 text-slate-600" />
                  </button>
                </div>
              </div>
            </div>

            {/* Form Body Scrollable */}
            <form onSubmit={handleSubmit} className="flex-1 flex flex-col min-h-0">
              <div className="flex-1 overflow-y-auto p-6 space-y-4 text-xs sm:text-sm">
                {/* Kategori Pilihan */}
                <div>
                  <label className="block font-bold text-slate-800 mb-1">
                    Kategori Perizinan
                  </label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value as LeaveCategory)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-800 text-xs sm:text-sm cursor-pointer outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-50"
                  >
                    <option value="LEAVE">Izin / Cuti</option>
                    <option value="WFH">Work From Home (WFH)</option>
                    <option value="SICK">Sakit (Surat Dokter Opsional)</option>
                    <option value="BUSINESS_TRIP">Dinas Luar (Kunjungan Proyek/Klien)</option>
                  </select>
                </div>

                {/* Date Pickers */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold text-slate-800 mb-1">
                      Tanggal Mulai
                    </label>
                    <input
                      type="date"
                      required
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-900 font-medium cursor-pointer outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-50"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-slate-800 mb-1">
                      Tanggal Selesai
                    </label>
                    <input
                      type="date"
                      required
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-900 font-medium cursor-pointer outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-50"
                    />
                  </div>
                </div>

                <div className="text-xs text-slate-500 font-medium">
                  Total durasi pengajuan:{' '}
                  <strong className="text-slate-900 font-bold">{totalDays} Hari Kerja</strong>
                </div>

                {/* Alasan */}
                <div>
                  <label className="block font-bold text-slate-800 mb-1">
                    Alasan &amp; Keterangan Lengkap
                  </label>
                  <textarea
                    rows={3}
                    required
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="Tuliskan alasan permohonan atau agenda dinas luar Anda..."
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-900 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-50 focus:bg-white resize-none"
                  />
                </div>

                {/* Upload Dokumen Lampiran (PDF / JPG / PNG) */}
                <div>
                  <label className="block font-bold text-slate-800 mb-1">
                    Lampiran Dokumen Surat (Opsional: PDF/JPG/PNG)
                  </label>
                  <div className="flex flex-wrap items-center gap-2.5">
                    <label className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold border transition-all ${
                      isUploadingAttachment
                        ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed'
                        : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200 cursor-pointer'
                    }`}>
                      {isUploadingAttachment ? (
                        <Loader2 className="w-4 h-4 animate-spin text-[#1E3A8A]" />
                      ) : (
                        <Upload className="w-4 h-4 text-slate-600" />
                      )}
                      <span>{isUploadingAttachment ? 'Mengunggah...' : 'Pilih Berkas'}</span>
                      <input
                        type="file"
                        accept=".pdf,.png,.jpg,.jpeg"
                        disabled={isUploadingAttachment}
                        onChange={handleFileChange}
                        className="hidden"
                      />
                    </label>

                    {isUploadingAttachment && (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-blue-50 text-[#1E3A8A] text-[11px] font-medium border border-blue-200 animate-pulse">
                        <Cloud className="w-3.5 h-3.5" />
                        Mengunggah ke Cloudinary...
                      </span>
                    )}

                    {!isUploadingAttachment && attachmentName && (
                      <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-800 text-[11px] font-medium border border-emerald-200 max-w-full">
                        <Paperclip className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                        <span className="truncate max-w-[200px]">{attachmentName}</span>
                        <button
                          type="button"
                          onClick={() => {
                            setAttachmentName(undefined);
                            setAttachmentData(undefined);
                            setAttachmentType(undefined);
                          }}
                          className="text-emerald-700 hover:text-emerald-950 p-0.5 rounded hover:bg-emerald-100"
                          title="Hapus berkas"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    )}

                    {!isUploadingAttachment && !attachmentName && (
                      <span className="text-xs text-slate-400">
                        Belum ada berkas dipilih (Maks 10MB)
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1">
                    Bisa berupa surat keterangan sakit dokter, surat tugas dinas luar, atau surat izin resmi.
                  </p>
                </div>

                {/* Info Notifikasi Otomatis */}
                <div className="p-3 bg-blue-50/70 border border-blue-200/70 rounded-xl text-xs text-blue-900 space-y-0.5">
                  <p className="font-bold flex items-center gap-1.5">
                    <Mail className="w-3.5 h-3.5 text-blue-600" />
                    <span>Notifikasi Email Otomatis</span>
                  </p>
                  <p className="text-slate-600 text-[11px]">
                    Email notifikasi otomatis akan langsung dikirimkan ke HR Admin beserta perincian izin.
                  </p>
                </div>
              </div>

              {/* Sticky Footer Buttons */}
              <div className="px-6 py-4 border-t border-slate-100 bg-white flex items-center justify-between gap-3 shrink-0">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  disabled={isUploadingAttachment}
                  className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl text-xs cursor-pointer disabled:opacity-50"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isUploadingAttachment}
                  className="px-5 py-2.5 bg-[#1E3A8A] hover:bg-[#172554] text-white font-bold rounded-xl text-xs shadow-xs cursor-pointer active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {isUploadingAttachment && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>{isUploadingAttachment ? 'Mengunggah Lampiran...' : 'Kirim Pengajuan'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 6. MODAL DETAIL PENGAJUAN */}
      {selectedLeaveDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs transition-opacity cursor-pointer"
            onClick={() => setSelectedLeaveDetail(null)}
          />
          <div className="relative w-full max-w-md bg-white rounded-3xl border border-slate-200 shadow-2xl overflow-hidden p-6 space-y-4 animate-in fade-in zoom-in-95 duration-200 font-sans">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-bold text-base text-slate-900">
                Rincian Pengajuan Perizinan
              </h3>
              <button
                type="button"
                onClick={() => setSelectedLeaveDetail(null)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-xl cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3.5 text-xs sm:text-sm">
              {/* Info Pengaju */}
              <div
                className="p-3 bg-blue-50/60 hover:bg-blue-50 rounded-xl border border-blue-100 flex items-center justify-between cursor-pointer group/prof transition-colors"
                onClick={() => {
                  const matched = allUsers.find((u) => u.id === selectedLeaveDetail.userId || u.name === selectedLeaveDetail.userName);
                  setSimpleProfilePopup({
                    name: selectedLeaveDetail.userName,
                    avatar: matched?.avatar,
                  });
                }}
                title="Lihat Profil"
              >
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Pemohon</span>
                  <p className="font-bold text-slate-900 group-hover/prof:text-[#1E3A8A] transition-colors">{selectedLeaveDetail.userName}</p>
                </div>
                <span className="text-[11px] text-[#1E3A8A] font-bold group-hover/prof:underline">Lihat Profil &rarr;</span>
              </div>

              {/* Status & Kategori */}
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                    Kategori
                  </span>
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-xs font-bold inline-block ${getCategoryBadgeClass(
                      selectedLeaveDetail.category
                    )}`}
                  >
                    {categoryLabels[selectedLeaveDetail.category]}
                  </span>
                </div>
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                    Status Persetujuan
                  </span>
                  {selectedLeaveDetail.status === 'APPROVED' ? (
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-[#DCFCE7] text-[#15803D] border border-[#86EFAC]/70 inline-flex items-center gap-1.5 shadow-2xs">
                      <Check className="w-3.5 h-3.5 stroke-[2.5]" /> Disetujui
                    </span>
                  ) : selectedLeaveDetail.status === 'REJECTED' ? (
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-[#FFE4E6] text-[#E11D48] border border-[#FDA4AF]/70 inline-flex items-center gap-1.5 shadow-2xs">
                      <X className="w-3.5 h-3.5 stroke-[2.5]" /> Ditolak
                    </span>
                  ) : (
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-[#FEF3C7] text-[#B45309] border border-[#FDE68A]/70 inline-flex items-center gap-1.5 shadow-2xs">
                      <Clock className="w-3.5 h-3.5" /> Menunggu
                    </span>
                  )}
                </div>
              </div>

              {/* Tanggal & Durasi */}
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 space-y-1">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                  Periode &amp; Durasi
                </span>
                <p className="font-mono font-bold text-slate-900">
                  {formatPeriodAndDuration(
                    selectedLeaveDetail.startDate,
                    selectedLeaveDetail.endDate,
                    selectedLeaveDetail.totalDays
                  )}
                </p>
                <p className="text-[11px] text-slate-400">
                  Diajukan pada:{' '}
                  {formatShortDate(
                    selectedLeaveDetail.appliedAt
                      ? selectedLeaveDetail.appliedAt.substring(0, 10)
                      : selectedLeaveDetail.startDate
                  )}
                </p>
              </div>

              {/* Alasan */}
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 space-y-1">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                  Alasan Lengkap
                </span>
                <p className="text-slate-800 italic leading-relaxed">
                  "{selectedLeaveDetail.reason}"
                </p>
              </div>

              {/* Lampiran */}
              {selectedLeaveDetail.attachmentName && (
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 space-y-1">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                    Lampiran Berkas Dokumen
                  </span>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-slate-700 truncate max-w-[260px]">
                      {selectedLeaveDetail.attachmentName}
                    </span>
                    {selectedLeaveDetail.attachmentData && (
                      <a
                        href={selectedLeaveDetail.attachmentData}
                        download={selectedLeaveDetail.attachmentName}
                        className="inline-flex items-center gap-1 px-3 py-1 bg-blue-50 text-blue-700 hover:bg-blue-100 font-bold rounded-lg text-xs"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>Unduh</span>
                      </a>
                    )}
                  </div>
                </div>
              )}

              {/* Catatan Penolakan */}
              {selectedLeaveDetail.rejectionReason && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl space-y-1">
                  <span className="text-[10px] font-bold text-rose-700 uppercase tracking-wider block">
                    Catatan Penolakan dari Admin
                  </span>
                  <p className="text-xs text-rose-800 italic">
                    "{selectedLeaveDetail.rejectionReason}"
                  </p>
                </div>
              )}
            </div>

            {/* Tombol Aksi di Modal */}
            <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => handleCopyWA(selectedLeaveDetail)}
                className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all border cursor-pointer ${
                  copiedId === selectedLeaveDetail.id
                    ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                    : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border-emerald-200'
                }`}
              >
                <ClipboardCopy className="w-3.5 h-3.5" />
                <span>{copiedId === selectedLeaveDetail.id ? 'Tersalin!' : 'Salin Rekap WA'}</span>
              </button>

              <div className="flex items-center gap-2">
                {/* Otorisasi Admin jika sedang memeriksa permohonan staf lain */}
                {isAdmin &&
                  selectedLeaveDetail.userId !== currentUser.id &&
                  selectedLeaveDetail.status === 'PENDING' && (
                    <div className="flex items-center gap-1.5 mr-1">
                      <button
                        type="button"
                        onClick={() => {
                          handleApprove(selectedLeaveDetail.id);
                        }}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-[#DCFCE7] hover:bg-[#BBF7D0] text-[#15803D] border border-[#86EFAC] font-bold rounded-xl text-xs cursor-pointer shadow-2xs active:scale-95 transition-all"
                        title="Setujui Permohonan (ACC)"
                      >
                        <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                        <span>Setujui</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const target = selectedLeaveDetail;
                          setRejectDialog({
                            isOpen: true,
                            leaveId: target.id,
                            userName: target.userName,
                            reason: '',
                          });
                        }}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-[#FFE4E6] hover:bg-[#FECDD3] text-[#E11D48] border border-[#FDA4AF] font-bold rounded-xl text-xs cursor-pointer shadow-2xs active:scale-95 transition-all"
                        title="Tolak Permohonan"
                      >
                        <X className="w-3.5 h-3.5 stroke-[2.5]" />
                        <span>Tolak</span>
                      </button>
                    </div>
                  )}

                {/* Batalkan jika pending dan milik sendiri */}
                {selectedLeaveDetail.status === 'PENDING' &&
                  selectedLeaveDetail.userId === currentUser.id && (
                    <button
                      type="button"
                      onClick={() => setCancelTargetId(selectedLeaveDetail.id)}
                      className="px-3.5 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-bold rounded-xl text-xs cursor-pointer inline-flex items-center gap-1.5"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Batalkan Pengajuan</span>
                    </button>
                  )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 7. MODAL TOLAK PERMOHONAN (KHUSUS ADMIN) */}
      {rejectDialog.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs transition-opacity cursor-pointer"
            onClick={() => setRejectDialog({ isOpen: false, leaveId: '', userName: '', reason: '' })}
          />
          <div className="relative w-full max-w-sm bg-white rounded-3xl border border-slate-200 shadow-2xl overflow-hidden p-6 space-y-4 animate-in fade-in zoom-in-95 duration-200">
            <h3 className="font-bold text-base text-slate-900">
              Tolak Permohonan {rejectDialog.userName}
            </h3>
            <p className="text-xs text-slate-500">
              Berikan alasan penolakan yang jelas agar staf mengetahuinya:
            </p>

            <textarea
              rows={3}
              value={rejectDialog.reason}
              onChange={(e) => setRejectDialog({ ...rejectDialog, reason: e.target.value })}
              placeholder="Contoh: Kuota izin tim di tanggal tersebut sudah memenuhi batas..."
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-rose-500 focus:bg-white resize-none"
            />

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setRejectDialog({ isOpen: false, leaveId: '', userName: '', reason: '' })}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl text-xs cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleReject}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl text-xs cursor-pointer"
              >
                Tolak Permohonan
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Pop Up Dialog Notifikasi Berkas Simpel */}
      <ModernConfirmDialog
        isOpen={!!fileAlert}
        variant="warning"
        title="Berkas Terlalu Besar"
        message={fileAlert || ''}
        confirmText="Mengerti"
        hideCancel={true}
        onConfirm={() => setFileAlert(null)}
        onCancel={() => setFileAlert(null)}
      />
      {/* Pop Up Profil Singkat (Nama & Foto Orang) */}
      <SimpleProfileModal
        isOpen={!!simpleProfilePopup}
        onClose={() => setSimpleProfilePopup(null)}
        profile={simpleProfilePopup}
      />
    </div>
  );
}
