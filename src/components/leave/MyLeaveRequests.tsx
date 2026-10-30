import React, { useState, useMemo } from 'react';
import {
  CalendarDays,
  Plus,
  Maximize2,
  Minimize2,
  CheckCircle2,
  Clock,
  XCircle,
  FileText,
  Upload,
  Check,
  X,
  Paperclip,
  ExternalLink,
  Mail,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Calendar,
  FileSpreadsheet,
  Trash2,
  Loader2,
  Cloud,
  ShieldCheck,
} from 'lucide-react';
import { LeaveRequest, LeaveCategory, User } from '../../types/index.ts';
import { AppStorage } from '../../lib/storage.ts';
import { downloadLeaveSpreadsheet } from '../../lib/csv-export.ts';
import { LeaveRequestIllustration } from '../common/Illustrations.tsx';
import { uploadToCloudinary } from '../../lib/cloudinary.ts';
import { uploadHybridFile } from '../../lib/file-uploader.ts';
import { ModernConfirmDialog } from '../common/ModernConfirmDialog.tsx';
import { SimpleProfileModal, SimpleProfileData } from '../common/SimpleProfileModal.tsx';
import { openAttachmentDirectly } from '../../lib/open-media.ts';

interface MyLeaveRequestsProps {
  currentUser: User;
  leaves?: LeaveRequest[];
  leaveRequests?: LeaveRequest[];
  onRefresh?: () => void;
  onOpenEmailModal?: () => void;
}

export function MyLeaveRequests({
  currentUser,
  leaves: propLeaves,
  leaveRequests: propLeaveRequests,
  onRefresh,
  onOpenEmailModal,
}: MyLeaveRequestsProps) {
  const leaves = propLeaves || propLeaveRequests || AppStorage.getLeaveRequests();

  const notifyUpdated = () => {
    if (onRefresh) onRefresh();
  };

  // Filter states
  const [dateFilterOpen, setDateFilterOpen] = useState(false);
  const [specificDateFilter, setSpecificDateFilter] = useState('');
  const [sortOrder, setSortOrder] = useState<'DESC' | 'ASC'>('DESC');
  const [filterCategory, setFilterCategory] = useState<string>('ALL');
  const [filterStatus, setFilterStatus] = useState<string>('ALL');

  // Detail Modal & Cancel Modal
  const [selectedLeaveDetail, setSelectedLeaveDetail] = useState<LeaveRequest | null>(null);
  const [cancelTargetId, setCancelTargetId] = useState<string | null>(null);
  const [isDetailModalFullScreen, setIsDetailModalFullScreen] = useState(false);
  const [simpleProfilePopup, setSimpleProfilePopup] = useState<SimpleProfileData | null>(null);

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
  const [emailDispatchedToast, setEmailDispatchedToast] = useState(false);

  // Format Tanggal Ringkas
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

  const formatPeriodAndDuration = (start: string, end: string, days: number) => {
    const s = formatShortDate(start);
    if (!end || start === end) {
      return `${s} • ${days} Hari`;
    }
    const e = formatShortDate(end);
    return `${s} – ${e} • ${days} Hari`;
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setFileAlert(null);
      setIsUploadingAttachment(true);
      try {
        const result = await uploadHybridFile(file, { folder: 'absenku/perizinan' });
        setAttachmentName(result.name);
        setAttachmentType(result.type);
        setAttachmentData(result.url);
      } catch (err: any) {
        setFileAlert(err.message || 'Gagal mengunggah berkas lampiran.');
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

  const executeCancelLeave = (id: string) => {
    AppStorage.deleteLeaveRequest(id);
    setCancelTargetId(null);
    if (selectedLeaveDetail?.id === id) {
      setSelectedLeaveDetail(null);
    }
    notifyUpdated();
  };

  const samplePdfData =
    'data:application/pdf;base64,JVBERi0xLjMKMSAwIG9iajw8L1R5cGUvQ2F0YWxvZy9QYWdlcyAyIDAgUj4+ZW5kb2JqCjIgMCBvYmo8PC9UeXBlL1BhZ2VzL0tpZHNbMyAwIFJdL0NvdW50IDE+PmVuZG9iagozIDAgb2JqPDwvVHlwZS9QYWdlL01lZGlhQm94WzAgMCAzMDAgMTQ0XS9QYXJlbnQgMiAwIFIvUmVzb3VyY2VzPDwvRm9udDw8L0YxIDQgMCBSPj4+Pi9Db250ZW50cyA1IDAgUj4+ZW5kb2JqCjQgMCBvYmo8PC9UeXBlL0ZvbnQvU3VidHlwZS9UeXBlMS9CYXNlRm9udC9IZWx2ZXRpY2E+PmVuZG9iago1IDAgb2JqPDwvTGVuZ3RoIDU1Pj5zdHJlYW0KQlQKL0YxIDE4IFRmCjUwIDEwMCBUZAooTG1waXJhbiBQREZJemluIC0gQWJzZW5rdSkgVGoKRVQKZW5kc3RyZWFtCmVuZG9iagp4cmVmCjAgNgowMDAwMDAwMDAwIDY1NTM1IGYgCjAwMDAwMDAwMDkgMDAwMDAgbiAKMDAwMDAwMDA1OCAwMDAwMCBuIAowMDAwMDAwMTE1IDAwMDAwIG4gCjAwMDAwMDAyMjEgMDAwMDAgbiAKMDAwMDAwMDI4NyAwMDAwMCBuIAp0cmFpbGVyPDwvU2l6ZSA2L1Jvb3QgMSAwIFI+PgpzdGFydHhyZWYKNDAyCiUlRU9G';

  const handleOpenAttachment = (e: React.MouseEvent, req: LeaveRequest) => {
    e.stopPropagation();
    const pdfSource = req.attachmentData || samplePdfData;
    openAttachmentDirectly({
      url: pdfSource,
      name: req.attachmentName || 'Dokumen_Lampiran_Perizinan.pdf',
      type: 'FILE',
    });
  };

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

  // Filter perizinan (jika Super Admin, tampilkan seluruh tim untuk pemantauan)
  const myLeaves = useMemo(() => {
    if (currentUser.role === 'SUPER_ADMIN') {
      return leaves;
    }
    return leaves.filter((l) => l.userId === currentUser.id);
  }, [leaves, currentUser.id, currentUser.role]);

  const categoryCounts = useMemo(() => {
    let all = 0;
    let leave = 0;
    let wfh = 0;
    let sick = 0;
    let businessTrip = 0;

    myLeaves.forEach((l) => {
      all++;
      if (l.category === 'LEAVE' || (l.category as string) === 'ANNUAL') leave++;
      else if (l.category === 'WFH') wfh++;
      else if (l.category === 'SICK') sick++;
      else if (l.category === 'BUSINESS_TRIP') businessTrip++;
    });

    return { all, leave, wfh, sick, businessTrip };
  }, [myLeaves]);

  const filteredLeaves = useMemo(() => {
    let list = myLeaves.filter((l) => {
      if (
        filterCategory !== 'ALL' &&
        l.category !== filterCategory &&
        !(filterCategory === 'LEAVE' && (l.category as string) === 'ANNUAL')
      )
        return false;
      if (filterStatus !== 'ALL' && l.status !== filterStatus) return false;
      if (specificDateFilter) {
        const inRange =
          (l.startDate <= specificDateFilter && specificDateFilter <= l.endDate) ||
          (l.appliedAt && l.appliedAt.includes(specificDateFilter));
        if (!inRange) return false;
      }
      return true;
    });

    list.sort((a, b) => {
      const dateA = a.startDate || a.appliedAt || '';
      const dateB = b.startDate || b.appliedAt || '';
      return sortOrder === 'DESC' ? dateB.localeCompare(dateA) : dateA.localeCompare(dateB);
    });

    return list;
  }, [myLeaves, filterCategory, filterStatus, specificDateFilter, sortOrder]);

  // Pagination 10 Teratas
  const [currentPage, setCurrentPage] = useState<number>(1);
  const ITEMS_PER_PAGE = 10;

  React.useEffect(() => {
    setCurrentPage(1);
  }, [filterCategory, filterStatus, specificDateFilter, sortOrder]);

  const totalPages = Math.ceil(filteredLeaves.length / ITEMS_PER_PAGE) || 1;
  const paginatedLeaves = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredLeaves.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredLeaves, currentPage]);

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

      {currentUser.role === 'SUPER_ADMIN' && (
        <div className="bg-gradient-to-r from-[#1E3A8A] to-indigo-900 rounded-2xl p-4 text-white shadow-2xs flex items-center gap-3">
          <div className="p-2 rounded-xl bg-amber-400/20 text-amber-300 shrink-0 border border-amber-400/30">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <p className="font-extrabold text-xs sm:text-sm text-white">
              Mode Pemantauan Direksi (Super Admin)
            </p>
            <p className="text-[11px] text-slate-200">
              Super Admin tidak memerlukan pengajuan izin pribadi dan bertindak sebagai peninjau utama perizinan tim.
            </p>
          </div>
        </div>
      )}

      {/* HEADER ATAS: TOOLBAR PENGAJUAN & FILTER (Desktop 1 baris ramping, Mobile 2 baris proporsional) */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs p-3 sm:p-3.5">
        {/* DESKTOP LAYOUT (md:flex hidden): 1 Baris Rapih & Proporsional Ala Desktop */}
        <div className="hidden md:flex items-center justify-between gap-3">
          {/* Group Filter di Sisi Kiri: Pilih Tanggal + Status + Spreadsheet */}
          <div className="flex items-center gap-2.5">
            {/* Tombol Pilih Tanggal Desktop */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setDateFilterOpen(!dateFilterOpen)}
                className="flex items-center justify-between gap-2 bg-white hover:bg-slate-50 text-slate-700 hover:text-slate-900 font-semibold text-xs px-3.5 h-10 rounded-xl transition-all cursor-pointer border border-slate-200 shadow-2xs min-w-[145px]"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <Calendar className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                  <span className="truncate">
                    {specificDateFilter
                      ? `${specificDateFilter.split('-').reverse().join('/')}`
                      : 'Pilih Tanggal'}
                  </span>
                </div>
                <ChevronDown
                  className={`w-3.5 h-3.5 text-slate-500 transition-transform duration-200 shrink-0 ${
                    dateFilterOpen ? 'rotate-180' : ''
                  }`}
                />
              </button>

              {dateFilterOpen && (
                <>
                  <div
                    className="fixed inset-0 z-30"
                    onClick={() => setDateFilterOpen(false)}
                  />
                  <div className="absolute left-0 mt-2 w-72 max-w-[calc(100vw-2rem)] bg-white rounded-2xl border border-slate-200 shadow-xl p-3.5 z-40 text-xs animate-in fade-in zoom-in-95 duration-150 space-y-2.5">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                        Cari Berdasarkan Tanggal
                      </label>
                      <div className="flex items-center gap-1.5">
                        <input
                          type="date"
                          value={specificDateFilter}
                          onChange={(e) => setSpecificDateFilter(e.target.value)}
                          className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 outline-none focus:border-[#1E3A8A] focus:ring-2 focus:ring-blue-100 font-medium cursor-pointer"
                        />
                        {specificDateFilter && (
                          <button
                            type="button"
                            onClick={() => setSpecificDateFilter('')}
                            className="px-2 py-1 text-[11px] font-bold text-[#1E3A8A] hover:bg-blue-50 rounded-lg cursor-pointer whitespace-nowrap"
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
                      className={`w-full text-left px-2.5 py-1.5 rounded-lg font-semibold cursor-pointer ${
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
                      className={`w-full text-left px-2.5 py-1.5 rounded-lg font-semibold cursor-pointer ${
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

            {/* Filter Status Desktop */}
            <div className="relative flex items-center">
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="h-10 pl-3.5 pr-8 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-[#1E3A8A] outline-none cursor-pointer transition-all shadow-2xs appearance-none min-w-[135px]"
                title="Filter berdasarkan status"
              >
                <option value="ALL">Semua Status</option>
                <option value="APPROVED">Disetujui</option>
                <option value="PENDING">Menunggu Persetujuan</option>
                <option value="REJECTED">Ditolak</option>
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-slate-500 absolute right-3 pointer-events-none shrink-0" />
            </div>

          </div>

          {/* Sisi Kanan: Tombol Buat Pengajuan Baru & Tombol Spreadsheet di Sebelah Kanannya (Desktop & Tablet) */}
          <div className="flex items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={() => setShowModal(true)}
              className="h-10 inline-flex items-center justify-center gap-2 bg-[#1E3A8A] hover:bg-[#172554] active:scale-[0.98] text-white font-bold text-xs sm:text-sm px-4.5 rounded-xl transition-all cursor-pointer shadow-xs shrink-0"
            >
              <Plus className="w-4 h-4 stroke-[2.5]" />
              <span>Buat Pengajuan Baru</span>
            </button>

            {/* Tombol Spreadsheet Desktop di Sebelah Kanan Buat Pengajuan Baru */}
            <button
              type="button"
              onClick={handleExportSpreadsheet}
              title="Ekspor Laporan Spreadsheet (.XLS)"
              aria-label="Ekspor Laporan Spreadsheet"
              className="w-10 h-10 bg-[#1E3A8A] hover:bg-[#172554] text-white rounded-xl transition-all shadow-xs cursor-pointer shrink-0 flex items-center justify-center active:scale-95"
            >
              <FileSpreadsheet className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* MOBILE LAYOUT (md:hidden): 2 Baris Sesuai Tampilan Mobile Saat Ini */}
        <div className="md:hidden space-y-2.5">
          {/* Row 1: Tombol Buat Pengajuan Baru (Lebar) & Tombol Spreadsheet di Sebelah Kanan */}
          <div className="flex items-center gap-2.5 w-full">
            <button
              type="button"
              onClick={() => setShowModal(true)}
              className="flex-1 h-11 inline-flex items-center justify-center gap-2 bg-[#1E3A8A] hover:bg-[#172554] active:scale-[0.98] text-white font-bold text-xs sm:text-sm px-4 rounded-xl transition-all cursor-pointer shadow-xs"
            >
              <Plus className="w-4 h-4 stroke-[2.5]" />
              <span>Buat Pengajuan Baru</span>
            </button>

            <button
              type="button"
              onClick={handleExportSpreadsheet}
              title="Ekspor Laporan Spreadsheet (.XLS)"
              aria-label="Ekspor Laporan Spreadsheet"
              className="w-11 h-11 bg-[#1E3A8A] hover:bg-[#172554] text-white rounded-xl transition-all shadow-xs cursor-pointer shrink-0 flex items-center justify-center active:scale-95"
            >
              <FileSpreadsheet className="w-4 h-4" />
            </button>
          </div>

          {/* Row 2: Filter Pilih Tanggal dan Semua Status di Bawah (Sejajar 2 Kolom) */}
          <div className="grid grid-cols-2 gap-2 w-full">
            {/* Tombol Pilih Tanggal Mobile */}
            <div className="relative w-full">
              <button
                type="button"
                onClick={() => setDateFilterOpen(!dateFilterOpen)}
                className="w-full flex items-center justify-between gap-1.5 bg-white hover:bg-slate-50 text-slate-700 hover:text-slate-900 font-semibold text-xs px-3 h-11 rounded-xl transition-all cursor-pointer border border-slate-200 shadow-2xs"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <Calendar className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                  <span className="truncate">
                    {specificDateFilter
                      ? `${specificDateFilter.split('-').reverse().join('/')}`
                      : 'Pilih Tanggal'}
                  </span>
                </div>
                <ChevronDown
                  className={`w-3.5 h-3.5 text-slate-500 transition-transform duration-200 shrink-0 ${
                    dateFilterOpen ? 'rotate-180' : ''
                  }`}
                />
              </button>

              {dateFilterOpen && (
                <>
                  <div
                    className="fixed inset-0 z-30"
                    onClick={() => setDateFilterOpen(false)}
                  />
                  <div className="absolute left-0 mt-2 w-72 max-w-[calc(100vw-2rem)] bg-white rounded-2xl border border-slate-200 shadow-xl p-3.5 z-40 text-xs animate-in fade-in zoom-in-95 duration-150 space-y-2.5">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                        Cari Berdasarkan Tanggal
                      </label>
                      <div className="flex items-center gap-1.5">
                        <input
                          type="date"
                          value={specificDateFilter}
                          onChange={(e) => setSpecificDateFilter(e.target.value)}
                          className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 outline-none focus:border-[#1E3A8A] focus:ring-2 focus:ring-blue-100 font-medium cursor-pointer"
                        />
                        {specificDateFilter && (
                          <button
                            type="button"
                            onClick={() => setSpecificDateFilter('')}
                            className="px-2 py-1 text-[11px] font-bold text-[#1E3A8A] hover:bg-blue-50 rounded-lg cursor-pointer whitespace-nowrap"
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
                      className={`w-full text-left px-2.5 py-1.5 rounded-lg font-semibold cursor-pointer ${
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
                      className={`w-full text-left px-2.5 py-1.5 rounded-lg font-semibold cursor-pointer ${
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

            {/* Filter Status Mobile */}
            <div className="relative w-full flex items-center">
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="w-full h-11 pl-3 pr-8 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-[#1E3A8A] outline-none cursor-pointer transition-all shadow-2xs appearance-none truncate"
                title="Filter berdasarkan status"
              >
                <option value="ALL">Semua Status</option>
                <option value="APPROVED">Disetujui</option>
                <option value="PENDING">Menunggu Persetujuan</option>
                <option value="REJECTED">Ditolak</option>
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-slate-500 absolute right-3 pointer-events-none shrink-0" />
            </div>
          </div>
        </div>
      </div>

      {/* FILTER CATEGORY & TABLE CONTAINER */}
      <div className="bg-white rounded-3xl border border-slate-200/90 shadow-sm overflow-hidden select-none">
        <div className="p-3 sm:px-4 sm:py-3 flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 bg-white">
          <div className="flex items-center gap-1.5 overflow-x-auto custom-scrollbar py-0.5 max-w-full">
            <button
              type="button"
              onClick={() => setFilterCategory('ALL')}
              className={`px-3 py-1.5 rounded-full text-xs transition-all cursor-pointer shrink-0 ${
                filterCategory === 'ALL'
                  ? 'bg-[#1E3A8A] text-white font-bold shadow-2xs'
                  : 'bg-blue-50/80 text-[#1E3A8A] hover:bg-blue-100 border border-blue-200/60 font-semibold'
              }`}
            >
              Semua ({categoryCounts.all})
            </button>
            <button
              type="button"
              onClick={() => setFilterCategory(filterCategory === 'LEAVE' ? 'ALL' : 'LEAVE')}
              className={`px-3 py-1.5 rounded-full text-xs transition-all cursor-pointer shrink-0 ${
                filterCategory === 'LEAVE'
                  ? 'bg-[#1E3A8A] text-white font-bold shadow-2xs'
                  : 'bg-blue-50/80 text-[#1E3A8A] hover:bg-blue-100 border border-blue-200/60 font-semibold'
              }`}
            >
              Izin / Cuti ({categoryCounts.leave})
            </button>
            <button
              type="button"
              onClick={() => setFilterCategory(filterCategory === 'WFH' ? 'ALL' : 'WFH')}
              className={`px-3 py-1.5 rounded-full text-xs transition-all cursor-pointer shrink-0 ${
                filterCategory === 'WFH'
                  ? 'bg-[#1E3A8A] text-white font-bold shadow-2xs'
                  : 'bg-blue-50/80 text-[#1E3A8A] hover:bg-blue-100 border border-blue-200/60 font-semibold'
              }`}
            >
              WFH ({categoryCounts.wfh})
            </button>
            <button
              type="button"
              onClick={() => setFilterCategory(filterCategory === 'SICK' ? 'ALL' : 'SICK')}
              className={`px-3 py-1.5 rounded-full text-xs transition-all cursor-pointer shrink-0 ${
                filterCategory === 'SICK'
                  ? 'bg-[#1E3A8A] text-white font-bold shadow-2xs'
                  : 'bg-blue-50/80 text-[#1E3A8A] hover:bg-blue-100 border border-blue-200/60 font-semibold'
              }`}
            >
              Sakit ({categoryCounts.sick})
            </button>
            <button
              type="button"
              onClick={() => setFilterCategory(filterCategory === 'BUSINESS_TRIP' ? 'ALL' : 'BUSINESS_TRIP')}
              className={`px-3 py-1.5 rounded-full text-xs transition-all cursor-pointer shrink-0 ${
                filterCategory === 'BUSINESS_TRIP'
                  ? 'bg-[#1E3A8A] text-white font-bold shadow-2xs'
                  : 'bg-blue-50/80 text-[#1E3A8A] hover:bg-blue-100 border border-blue-200/60 font-semibold'
              }`}
            >
              Dinas Luar ({categoryCounts.businessTrip})
            </button>
          </div>
        </div>

        {/* TABEL */}
        <div className="w-full overflow-x-auto custom-scrollbar">
          <table className="w-full border-collapse text-left text-xs min-w-[640px]">
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

            <tbody className="divide-y divide-slate-100">
              {filteredLeaves.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-16 text-center text-slate-400">
                    <div className="flex flex-col items-center justify-center space-y-2">
                      <LeaveRequestIllustration className="w-16 h-16 opacity-75" />
                      <p className="font-semibold text-slate-600">
                        Belum ada riwayat pengajuan izin pribadi.
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                paginatedLeaves.map((req) => {
                  const isApproved = req.status === 'APPROVED';
                  const isRejected = req.status === 'REJECTED';

                  return (
                    <tr
                      key={req.id}
                      onClick={() => setSelectedLeaveDetail(req)}
                      className="bg-white hover:bg-blue-50/40 transition-colors duration-150 cursor-pointer group"
                    >
                      <td className="py-3.5 px-3.5 whitespace-nowrap">
                        <span className={`px-3 py-1 rounded-full text-xs font-semibold shadow-2xs inline-block ${getCategoryBadgeClass(req.category)}`}>
                          {categoryLabels[req.category] || req.category}
                        </span>
                      </td>
                      <td className="py-3.5 px-3.5 whitespace-nowrap font-bold text-slate-800 text-xs">
                        {formatPeriodAndDuration(req.startDate, req.endDate, req.totalDays)}
                      </td>
                      <td className="py-3.5 px-3.5 whitespace-nowrap text-slate-600 text-xs font-medium">
                        {formatShortDate(req.appliedAt ? req.appliedAt.substring(0, 10) : req.startDate)}
                      </td>
                      <td className="py-3.5 px-3.5">
                        <div className="space-y-1">
                          <p className="text-slate-800 font-medium line-clamp-1" title={req.reason}>
                            "{req.reason}"
                          </p>
                          {req.attachmentName && (
                            <button
                              type="button"
                              onClick={(e) => handleOpenAttachment(e, req)}
                              className="inline-flex items-center gap-1.5 text-[11px] font-bold text-[#1E3A8A] hover:text-[#172554] hover:underline pt-0.5 cursor-pointer group"
                              title={`Buka ${req.attachmentName}`}
                            >
                              <Paperclip className="w-3.5 h-3.5 text-[#1E3A8A] group-hover:scale-110 transition-transform" />
                              <span className="truncate max-w-[150px]">{req.attachmentName}</span>
                              <ExternalLink className="w-3 h-3 text-[#1E3A8A]/70 group-hover:text-[#1E3A8A]" />
                            </button>
                          )}
                          {req.rejectionReason && (
                            <p className="text-[11px] text-rose-600 italic line-clamp-1 pt-0.5">
                              Catatan Penolakan: "{req.rejectionReason}"
                            </p>
                          )}
                        </div>
                      </td>
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
                      <td className="py-3.5 px-3.5 text-center whitespace-nowrap">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setCancelTargetId(req.id);
                          }}
                          title="Hapus Pengajuan Izin"
                          className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-xl transition-colors cursor-pointer border border-transparent hover:border-rose-200 shadow-2xs"
                        >
                          <Trash2 className="w-4 h-4 mx-auto" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Navigasi Riwayat Jika > 10 Pengajuan */}
        {filteredLeaves.length > ITEMS_PER_PAGE && (
          <div className="px-4 py-3 border-t border-slate-100 flex items-center justify-between bg-slate-50/60 text-xs">
            <span className="text-slate-500 font-medium">
              Menampilkan {Math.min((currentPage - 1) * ITEMS_PER_PAGE + 1, filteredLeaves.length)}-
              {Math.min(currentPage * ITEMS_PER_PAGE, filteredLeaves.length)} dari {filteredLeaves.length} pengajuan
            </span>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
                disabled={currentPage === 1}
                className="p-1.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-white hover:text-slate-900 disabled:opacity-40 disabled:cursor-not-allowed transition cursor-pointer shadow-2xs"
                title="Halaman Sebelumnya"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="px-2 font-bold text-slate-700">
                {currentPage} / {totalPages}
              </span>
              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
                disabled={currentPage === totalPages}
                className="p-1.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-white hover:text-slate-900 disabled:opacity-40 disabled:cursor-not-allowed transition cursor-pointer shadow-2xs"
                title="Halaman Berikutnya"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* MODAL BATALKAN */}
      {cancelTargetId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs transition-opacity cursor-pointer"
            onClick={() => setCancelTargetId(null)}
          />
          <div className="relative w-full max-w-sm bg-white rounded-3xl border border-slate-200 shadow-2xl p-6 space-y-4 animate-in fade-in zoom-in-95 duration-200">
            <div>
              <h3 className="font-bold text-base text-slate-900">Batalkan Pengajuan?</h3>
              <p className="text-xs text-slate-500 pt-1">
                Pengajuan yang masih berstatus menunggu dapat dibatalkan dan akan dihapus.
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

      {/* MODAL FORM PENGAJUAN BARU */}
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

            <form onSubmit={handleSubmit} className="flex-1 flex flex-col min-h-0">
              <div className="flex-1 overflow-y-auto p-6 space-y-4 text-xs sm:text-sm">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">Kategori Perizinan *</label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value as LeaveCategory)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-800 text-xs sm:text-sm cursor-pointer outline-none focus:border-[#1E3A8A] focus:bg-white"
                  >
                    <option value="LEAVE">Izin / Cuti</option>
                    <option value="WFH">Work From Home (WFH)</option>
                    <option value="SICK">Sakit (Surat Dokter Opsional)</option>
                    <option value="BUSINESS_TRIP">Dinas Luar (Kunjungan Proyek/Klien)</option>
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3.5">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">Tanggal Mulai *</label>
                    <input
                      type="date"
                      required
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-900 font-medium cursor-pointer outline-none focus:border-[#1E3A8A] focus:bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">Tanggal Selesai *</label>
                    <input
                      type="date"
                      required
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-900 font-medium cursor-pointer outline-none focus:border-[#1E3A8A] focus:bg-white"
                    />
                  </div>
                </div>

                <div className="p-3 bg-blue-50/70 rounded-xl border border-blue-200/80 text-xs text-[#1E3A8A] font-medium">
                  Total durasi pengajuan: <strong className="text-[#172554] font-bold">{totalDays} Hari Kerja</strong>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">Alasan &amp; Keterangan Lengkap *</label>
                  <textarea
                    rows={4}
                    required
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="Tuliskan alasan permohonan atau agenda dinas luar Anda..."
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-900 outline-none focus:border-[#1E3A8A] focus:bg-white resize-none"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">Lampiran Dokumen Surat (Opsional)</label>
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
                        Belum ada berkas dipilih (Maks 10MB, PDF/JPG/PNG)
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Sticky Footer */}
              <div className="px-6 py-4.5 border-t border-slate-100 bg-white flex items-center justify-between gap-3 shrink-0">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  disabled={isUploadingAttachment}
                  className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl text-xs cursor-pointer disabled:opacity-50"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isUploadingAttachment}
                  className="px-6 py-2.5 bg-[#1E3A8A] hover:bg-[#172554] text-white font-bold rounded-xl text-xs shadow-xs cursor-pointer active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {isUploadingAttachment && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>{isUploadingAttachment ? 'Mengunggah Lampiran...' : 'Kirim Pengajuan'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL DETAIL */}
      {selectedLeaveDetail && (
        <div
          className={`fixed inset-0 z-50 flex animate-in fade-in duration-200 ${
            isDetailModalFullScreen
              ? 'items-center justify-center p-0'
              : 'justify-end items-center p-2.5 sm:p-4 md:p-5'
          }`}
        >
          <div
            className="fixed inset-0 bg-slate-950/40 backdrop-blur-xs transition-opacity cursor-pointer"
            onClick={() => setSelectedLeaveDetail(null)}
          />
          <div
            className={`relative z-10 bg-white shadow-2xl flex flex-col min-h-0 overflow-hidden transition-all duration-300 font-sans ${
              isDetailModalFullScreen
                ? 'w-full h-full max-w-none max-h-none rounded-none border-0'
                : 'w-full max-w-sm sm:max-w-md h-full max-h-[calc(100vh-1.25rem)] sm:max-h-[calc(100vh-2rem)] rounded-3xl border border-slate-200/80 animate-in slide-in-from-right duration-300 ease-out'
            }`}
          >
            <div className="px-6 py-5 border-b border-slate-100 bg-white flex items-center justify-between gap-3 shrink-0">
              <div className="flex items-center gap-3 min-w-0">
                {/* Zoom Button di pojok kiri atas */}
                <button
                  type="button"
                  onClick={() => setIsDetailModalFullScreen(!isDetailModalFullScreen)}
                  className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl border border-slate-200/80 transition-colors cursor-pointer shrink-0"
                  title={isDetailModalFullScreen ? "Perkecil Tampilan" : "Perbesar Layar Penuh"}
                >
                  {isDetailModalFullScreen ? (
                    <Minimize2 className="w-4 h-4 text-slate-600" />
                  ) : (
                    <Maximize2 className="w-4 h-4 text-slate-600" />
                  )}
                </button>
                <div>
                  <h3 className="font-bold text-base text-slate-900">Rincian Pengajuan Izin</h3>
                  <p className="text-xs text-slate-500 mt-0.5">Detail permohonan dan status persetujuan</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedLeaveDetail(null)}
                className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full border border-slate-200 transition-colors cursor-pointer shrink-0"
                title="Tutup"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-4 text-xs sm:text-sm">
              {/* Profil Pemohon - Klik untuk popup profil simpel */}
              <div
                onClick={() => setSimpleProfilePopup({ name: currentUser.name, avatar: currentUser.avatar })}
                className="flex items-center gap-3 p-3 bg-slate-50 hover:bg-blue-50/60 rounded-xl border border-slate-200/80 cursor-pointer transition-colors group"
                title="Klik untuk melihat profil"
              >
                <img
                  src={currentUser.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(currentUser.name)}&background=1E3A8A&color=fff`}
                  alt={currentUser.name}
                  className="w-10 h-10 rounded-full object-cover border border-slate-200 group-hover:scale-105 transition-transform shrink-0"
                />
                <div className="min-w-0 flex-1">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Pemohon (Profil)</span>
                  <p className="font-bold text-slate-900 truncate group-hover:text-[#1E3A8A] transition-colors">{currentUser.name}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3.5">
                <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200/80">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Kategori</span>
                  <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold inline-block ${getCategoryBadgeClass(selectedLeaveDetail.category)}`}>
                    {categoryLabels[selectedLeaveDetail.category]}
                  </span>
                </div>
                <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200/80">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Status Persetujuan</span>
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

              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200/80 space-y-1">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Periode &amp; Durasi</span>
                <p className="font-bold text-slate-900">
                  {formatPeriodAndDuration(selectedLeaveDetail.startDate, selectedLeaveDetail.endDate, selectedLeaveDetail.totalDays)}
                </p>
              </div>

              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200/80 space-y-1">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Alasan Lengkap</span>
                <p className="text-slate-800 leading-relaxed font-medium">"{selectedLeaveDetail.reason}"</p>
              </div>

              {selectedLeaveDetail.attachmentName && (
                <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200/80 space-y-1">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Lampiran Surat</span>
                  <button
                    type="button"
                    onClick={(e) => handleOpenAttachment(e, selectedLeaveDetail)}
                    className="inline-flex items-center gap-2 text-xs font-bold text-[#1E3A8A] hover:text-[#172554] hover:underline cursor-pointer group"
                    title={`Buka ${selectedLeaveDetail.attachmentName}`}
                  >
                    <Paperclip className="w-3.5 h-3.5 text-[#1E3A8A] group-hover:scale-110 transition-transform" />
                    <span>{selectedLeaveDetail.attachmentName}</span>
                    <ExternalLink className="w-3.5 h-3.5 text-[#1E3A8A]/70 group-hover:text-[#1E3A8A]" />
                  </button>
                </div>
              )}
            </div>

            {selectedLeaveDetail.status === 'PENDING' && (
              <div className="px-6 py-4.5 border-t border-slate-100 bg-white flex items-center justify-end gap-3 shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    setCancelTargetId(selectedLeaveDetail.id);
                  }}
                  className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl text-xs cursor-pointer shadow-xs"
                >
                  Batalkan Pengajuan Ini
                </button>
              </div>
            )}
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

      {/* Pop Up Profil Simpel (Foto dan Nama Saja) */}
      <SimpleProfileModal
        isOpen={!!simpleProfilePopup}
        onClose={() => setSimpleProfilePopup(null)}
        profile={simpleProfilePopup}
      />
    </div>
  );
}
