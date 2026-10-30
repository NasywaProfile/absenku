import React, { useState, useMemo } from 'react';
import {
  CheckCircle2,
  Clock,
  Maximize2,
  Minimize2,
  XCircle,
  Search,
  Check,
  X,
  Paperclip,
  ExternalLink,
  ClipboardCopy,
  Mail,
  Calendar,
  FileSpreadsheet,
  Users,
  ShieldCheck,
  User as UserIcon,
  ChevronDown,
} from 'lucide-react';
import { LeaveRequest, LeaveCategory, User } from '../../types/index.ts';
import { AppStorage } from '../../lib/storage.ts';
import { downloadLeaveSpreadsheet } from '../../lib/csv-export.ts';
import {
  generateWhatsAppLeaveRecap,
  copyTextToClipboard,
} from '../../lib/whatsapp-recap.ts';
import { LeaveRequestIllustration } from '../common/Illustrations.tsx';
import { Tooltip } from '../ui/tooltip.tsx';
import { SimpleProfileModal, SimpleProfileData } from '../common/SimpleProfileModal.tsx';
import { openAttachmentDirectly } from '../../lib/open-media.ts';

interface TeamLeaveApprovalsProps {
  currentUser: User;
  leaves?: LeaveRequest[];
  leaveRequests?: LeaveRequest[];
  onRefresh?: () => void;
  onOpenEmailModal?: () => void;
}

export function TeamLeaveApprovals({
  currentUser,
  leaves: propLeaves,
  leaveRequests: propLeaveRequests,
  onRefresh,
  onOpenEmailModal,
}: TeamLeaveApprovalsProps) {
  const leaves = propLeaves || propLeaveRequests || AppStorage.getLeaveRequests();

  const notifyUpdated = () => {
    if (onRefresh) onRefresh();
  };

  // Filter & Search states
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState<string>('ALL');
  const [filterStatus, setFilterStatus] = useState<string>('PENDING'); // Default to PENDING for quick review
  const [specificDateFilter, setSpecificDateFilter] = useState('');
  const [isMobileFilterOpen, setIsMobileFilterOpen] = useState(false);

  const hasActiveFilters = filterCategory !== 'ALL' || filterStatus !== 'PENDING' || specificDateFilter !== '';

  // Detail Modal & Reject Dialog
  const [selectedLeaveDetail, setSelectedLeaveDetail] = useState<LeaveRequest | null>(null);
  const [isDetailModalFullScreen, setIsDetailModalFullScreen] = useState(false);
  const [isRejectModalFullScreen, setIsRejectModalFullScreen] = useState(false);
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
  const [simpleProfilePopup, setSimpleProfilePopup] = useState<SimpleProfileData | null>(null);
  const allUsers = useMemo(() => AppStorage.getUsers(), []);

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
        return 'bg-[#DCFCE7] text-[#15803D]';
      case 'WFH':
        return 'bg-[#FEF3C7] text-[#B45309]';
      case 'SICK':
        return 'bg-[#FFEDD5] text-[#C2410C]';
      case 'BUSINESS_TRIP':
        return 'bg-[#E0E7FF] text-[#4338CA]';
      default:
        return 'bg-slate-100 text-slate-700';
    }
  };

  const pendingCount = useMemo(() => leaves.filter((l) => l.status === 'PENDING').length, [leaves]);
  const approvedCount = useMemo(() => leaves.filter((l) => l.status === 'APPROVED').length, [leaves]);
  const rejectedCount = useMemo(() => leaves.filter((l) => l.status === 'REJECTED').length, [leaves]);

  const filteredLeaves = useMemo(() => {
    return leaves.filter((l) => {
      // Filter search
      const matchesSearch =
        l.userName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (l.department && l.department.toLowerCase().includes(searchTerm.toLowerCase())) ||
        l.reason.toLowerCase().includes(searchTerm.toLowerCase());
      if (!matchesSearch) return false;

      // Filter Kategori
      if (filterCategory !== 'ALL' && l.category !== filterCategory) return false;

      // Filter Status
      if (filterStatus !== 'ALL' && l.status !== filterStatus) return false;

      // Filter Tanggal
      if (specificDateFilter) {
        const inRange =
          (l.startDate <= specificDateFilter && specificDateFilter <= l.endDate) ||
          (l.appliedAt && l.appliedAt.includes(specificDateFilter));
        if (!inRange) return false;
      }

      return true;
    }).sort((a, b) => (b.appliedAt || b.startDate).localeCompare(a.appliedAt || a.startDate));
  }, [leaves, searchTerm, filterCategory, filterStatus, specificDateFilter]);

  const handleExportSpreadsheet = () => {
    downloadLeaveSpreadsheet(filteredLeaves, 'Persetujuan Izin Tim');
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

  return (
    <div className="space-y-4 font-sans antialiased">
      {/* FILTER & TABEL PENGAJUAN TIM */}
      <div className="bg-white rounded-3xl border border-slate-200/90 shadow-sm overflow-hidden">
        <div className="p-3 sm:p-4 border-b border-slate-100 bg-white space-y-3">
          {/* Row 1: Search Bar & Icon Spreadsheet */}
          <div className="flex flex-row items-center gap-2.5 w-full">
            {/* Search Input Bar (Memanjang mengisi seluruh space di Desktop, dengan panah toggle filter di Mobile) */}
            <div className="relative flex-1 min-w-0">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Cari nama karyawan, divisi, alasan..."
                className="w-full pl-10 pr-12 sm:pr-8 h-12 sm:h-10 md:h-10 bg-slate-50 hover:bg-white focus:bg-white border border-slate-200 rounded-xl text-xs sm:text-xs text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-blue-200 focus:border-[#1E3A8A] font-medium transition-colors shadow-2xs"
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm('')}
                  className="absolute right-10 sm:right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer p-0.5"
                  title="Hapus pencarian"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
              {/* Tombol Panah Buka/Tutup Filter Khusus Mobile */}
              <button
                type="button"
                onClick={() => setIsMobileFilterOpen(!isMobileFilterOpen)}
                className={`sm:hidden absolute right-1.5 top-1/2 -translate-y-1/2 h-9 px-2.5 rounded-xl flex items-center justify-center transition-all cursor-pointer ${
                  isMobileFilterOpen
                    ? 'bg-[#1E3A8A] text-white shadow-2xs'
                    : hasActiveFilters
                    ? 'bg-blue-100 text-[#1E3A8A] font-bold'
                    : 'text-slate-500 hover:text-slate-800 hover:bg-slate-200/60'
                }`}
                title={isMobileFilterOpen ? "Sembunyikan filter" : "Tampilkan filter"}
                aria-label="Toggle Filter"
              >
                <ChevronDown
                  className={`w-4 h-4 transition-transform duration-200 ${
                    isMobileFilterOpen ? 'rotate-180' : ''
                  }`}
                />
              </button>
            </div>

            {/* Tombol Ekspor Rekap Spreadsheet */}
            <Tooltip content="Ekspor rekapitulasi daftar izin karyawan ke file spreadsheet (.XLS)" position="bottom">
              <button
                type="button"
                onClick={handleExportSpreadsheet}
                aria-label="Ekspor Rekap Spreadsheet"
                className="w-12 h-12 sm:w-10 sm:h-10 md:w-10 md:h-10 bg-[#1E3A8A] hover:bg-[#172554] text-white rounded-xl transition-all shadow-xs cursor-pointer shrink-0 flex items-center justify-center active:scale-95"
              >
                <FileSpreadsheet className="w-4 h-4" />
              </button>
            </Tooltip>
          </div>

          {/* Row 2: Dedicated Filter Strip (Desktop: selalu tampil | Mobile: hanya tampil jika panah filter diklik) */}
          <div className={`${isMobileFilterOpen ? 'flex' : 'hidden'} sm:flex flex-col sm:flex-row items-stretch sm:items-center gap-3 bg-slate-50/90 p-3.5 sm:p-3 rounded-2xl border border-slate-200/80 text-xs w-full animate-in fade-in slide-in-from-top-1 duration-150`}>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 sm:gap-3 flex-1 min-w-0">
              {/* Filter 1: Kategori */}
              <div className="flex items-center gap-2.5 h-12 sm:h-10 md:h-10 px-4 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-xs shadow-2xs font-semibold text-slate-700 flex-1 min-w-0">
                <span className="text-xs font-semibold text-slate-500 whitespace-nowrap shrink-0">Kategori:</span>
                <div className="relative flex items-center flex-1 min-w-0">
                  <select
                    value={filterCategory}
                    onChange={(e) => setFilterCategory(e.target.value)}
                    className="w-full appearance-none pr-6 bg-transparent font-semibold text-slate-900 text-xs focus:outline-hidden cursor-pointer truncate py-1.5"
                  >
                    <option value="ALL">Semua Kategori</option>
                    <option value="LEAVE">Izin / Cuti</option>
                    <option value="WFH">WFH</option>
                    <option value="SICK">Sakit</option>
                    <option value="BUSINESS_TRIP">Dinas Luar</option>
                  </select>
                  <ChevronDown className="w-4 h-4 text-slate-400 absolute right-0 pointer-events-none shrink-0" />
                </div>
              </div>

              {/* Filter 2: Status */}
              <div className="flex items-center gap-2.5 h-12 sm:h-10 md:h-10 px-4 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-xs shadow-2xs font-semibold text-slate-700 flex-1 min-w-0">
                <span className="text-xs font-semibold text-slate-500 whitespace-nowrap shrink-0">Status:</span>
                <div className="relative flex items-center flex-1 min-w-0">
                  <select
                    value={filterStatus}
                    onChange={(e) => setFilterStatus(e.target.value)}
                    className="w-full appearance-none pr-6 bg-transparent font-semibold text-slate-900 text-xs focus:outline-hidden cursor-pointer truncate py-1.5"
                  >
                    <option value="ALL">Semua Status</option>
                    <option value="PENDING">Menunggu Persetujuan</option>
                    <option value="APPROVED">Disetujui</option>
                    <option value="REJECTED">Ditolak</option>
                  </select>
                  <ChevronDown className="w-4 h-4 text-slate-400 absolute right-0 pointer-events-none shrink-0" />
                </div>
              </div>

              {/* Filter 3: Tanggal */}
              <div className="flex items-center gap-2.5 h-12 sm:h-10 md:h-10 px-4 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-xs shadow-2xs font-semibold text-slate-700 flex-1 min-w-0">
                <span className="text-xs font-semibold text-slate-500 whitespace-nowrap shrink-0">Tanggal:</span>
                <input
                  type="date"
                  value={specificDateFilter}
                  onChange={(e) => setSpecificDateFilter(e.target.value)}
                  className="w-full bg-transparent text-xs text-slate-900 font-semibold outline-hidden cursor-pointer py-1.5"
                />
                {specificDateFilter && (
                  <button
                    type="button"
                    onClick={() => setSpecificDateFilter('')}
                    className="text-[#1E3A8A] hover:text-[#172554] cursor-pointer p-0.5 ml-0.5 shrink-0"
                    title="Hapus filter Tanggal"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* TABEL PERSETUJUAN */}
        <div className="w-full overflow-x-auto custom-scrollbar">
          <table className="w-full text-left text-xs border-collapse min-w-[640px]">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/80 text-slate-700 font-bold">
                <th className="py-3 px-3.5 font-bold">Karyawan</th>
                <th className="py-3 px-3.5 font-bold">Kategori</th>
                <th className="py-3 px-3.5 font-bold">Periode &amp; Durasi</th>
                <th className="py-3 px-3.5 font-bold">Alasan &amp; Bukti</th>
                <th className="py-3 px-3.5 font-bold text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredLeaves.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-slate-400">
                    <LeaveRequestIllustration className="w-14 h-14 mx-auto opacity-75 mb-2" />
                    <p className="font-bold text-slate-600">Tidak ada pengajuan izin yang perlu ditinjau saat ini.</p>
                  </td>
                </tr>
              ) : (
                filteredLeaves.map((req) => {
                  const isApproved = req.status === 'APPROVED';
                  const isRejected = req.status === 'REJECTED';

                  return (
                    <tr
                      key={req.id}
                      onClick={() => setSelectedLeaveDetail(req)}
                      className="hover:bg-slate-50/80 transition-colors cursor-pointer"
                    >
                      <td className="py-3.5 px-3.5 whitespace-nowrap">
                        <div
                          className="flex items-center gap-2.5 cursor-pointer group/prof"
                          onClick={(e) => {
                            e.stopPropagation();
                            const matched = allUsers.find((u) => u.id === req.userId || u.name === req.userName);
                            setSimpleProfilePopup({
                              name: req.userName,
                              avatar: matched?.avatar || req.userAvatar,
                            });
                          }}
                          title="Lihat Profil"
                        >
                          {(() => {
                            const matched = allUsers.find((u) => u.id === req.userId || u.name === req.userName);
                            const av = matched?.avatar || req.userAvatar;
                            if (av) {
                              return (
                                <img
                                  src={av}
                                  alt={req.userName}
                                  className="w-8 h-8 rounded-full object-cover border border-slate-200 shrink-0 group-hover/prof:ring-2 group-hover/prof:ring-blue-300 transition-all"
                                />
                              );
                            }
                            return (
                              <div className="w-8 h-8 rounded-full bg-blue-100 text-[#1E3A8A] font-bold flex items-center justify-center shrink-0 group-hover/prof:ring-2 group-hover/prof:ring-blue-300 transition-all">
                                {req.userName.charAt(0)}
                              </div>
                            );
                          })()}
                          <div>
                            <p className="font-bold text-slate-900 group-hover/prof:text-[#1E3A8A] transition-colors text-xs">{req.userName}</p>
                            <p className="text-[10px] text-slate-500">{req.department || 'Staf Operasional'}</p>
                          </div>
                        </div>
                      </td>
                      <td className="py-3.5 px-3.5 whitespace-nowrap">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-bold inline-block ${getCategoryBadgeClass(req.category)}`}>
                          {categoryLabels[req.category]}
                        </span>
                      </td>
                      <td className="py-3.5 px-3.5 whitespace-nowrap font-bold text-slate-800">
                        {formatPeriodAndDuration(req.startDate, req.endDate, req.totalDays)}
                      </td>
                      <td className="py-3.5 px-3.5 max-w-xs">
                        <p className="text-slate-800 font-medium line-clamp-1" title={req.reason}>
                          "{req.reason}"
                        </p>
                        {req.attachmentName && (
                          <button
                            type="button"
                            onClick={(e) => handleOpenAttachment(e, req)}
                            className="inline-flex items-center gap-1.5 text-[11px] font-bold text-[#1E3A8A] hover:text-[#172554] hover:underline pt-1 cursor-pointer group"
                            title={`Buka ${req.attachmentName}`}
                          >
                            <Paperclip className="w-3 h-3 text-[#1E3A8A] group-hover:scale-110 transition-transform" />
                            <span className="truncate max-w-[160px]">{req.attachmentName}</span>
                            <ExternalLink className="w-3 h-3 text-[#1E3A8A]/70 group-hover:text-[#1E3A8A]" />
                          </button>
                        )}
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
                          <div className="inline-flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                            <button
                              type="button"
                              onClick={() => handleApprove(req.id)}
                              className="w-8 h-8 rounded-xl bg-[#DCFCE7] hover:bg-[#BBF7D0] text-[#15803D] border border-[#86EFAC] font-bold transition-all cursor-pointer flex items-center justify-center shadow-2xs active:scale-95"
                              title="Setujui Permohonan (Centang Pastel)"
                            >
                              <Check className="w-4 h-4 stroke-[2.5]" />
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setRejectDialog({
                                  isOpen: true,
                                  leaveId: req.id,
                                  userName: req.userName,
                                  reason: '',
                                });
                              }}
                              className="w-8 h-8 rounded-xl bg-[#FFE4E6] hover:bg-[#FECDD3] text-[#E11D48] border border-[#FDA4AF] font-bold transition-all cursor-pointer flex items-center justify-center shadow-2xs active:scale-95"
                              title="Tolak Permohonan (Silang Pastel)"
                            >
                              <X className="w-4 h-4 stroke-[2.5]" />
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL TOLAK PENGAJUAN */}
      {rejectDialog.isOpen && (
        <div
          className={`fixed inset-0 z-50 flex animate-in fade-in duration-200 ${
            isRejectModalFullScreen
              ? 'items-center justify-center p-0'
              : 'justify-end items-center p-2.5 sm:p-4 md:p-5'
          }`}
        >
          <div
            className="fixed inset-0 bg-slate-950/40 backdrop-blur-xs transition-opacity cursor-pointer"
            onClick={() => setRejectDialog({ isOpen: false, leaveId: '', userName: '', reason: '' })}
          />
          <div
            className={`relative z-10 bg-white shadow-2xl flex flex-col min-h-0 overflow-hidden transition-all duration-300 font-sans ${
              isRejectModalFullScreen
                ? 'w-full h-full max-w-none max-h-none rounded-none border-0'
                : 'w-full max-w-sm sm:max-w-md h-full max-h-[calc(100vh-1.25rem)] sm:max-h-[calc(100vh-2rem)] rounded-3xl border border-slate-200/80 animate-in slide-in-from-right duration-300 ease-out'
            }`}
          >
            <div className="px-6 py-5 border-b border-slate-100 bg-white flex items-center justify-between gap-3 shrink-0">
              <div className="flex items-center gap-3 min-w-0">
                {/* Zoom Button di pojok kiri atas */}
                <button
                  type="button"
                  onClick={() => setIsRejectModalFullScreen(!isRejectModalFullScreen)}
                  className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl border border-slate-200/80 transition-colors cursor-pointer shrink-0"
                  title={isRejectModalFullScreen ? "Perkecil Tampilan" : "Perbesar Layar Penuh"}
                >
                  {isRejectModalFullScreen ? (
                    <Minimize2 className="w-4 h-4 text-slate-600" />
                  ) : (
                    <Maximize2 className="w-4 h-4 text-slate-600" />
                  )}
                </button>
                <div>
                  <h3 className="font-bold text-base text-slate-900">
                    Tolak Pengajuan Izin
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Berikan alasan penolakan perizinan bagi karyawan terkait.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setRejectDialog({ isOpen: false, leaveId: '', userName: '', reason: '' })}
                className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full border border-slate-200 transition-colors cursor-pointer shrink-0"
                title="Tutup"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-4 text-xs sm:text-sm">
              <div className="p-3.5 bg-blue-50/70 border border-blue-200 text-[#1E3A8A] rounded-xl text-xs">
                Penolakan untuk: <strong className="font-bold text-slate-900">{rejectDialog.userName}</strong>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Alasan Penolakan *
                </label>
                <textarea
                  rows={4}
                  value={rejectDialog.reason}
                  onChange={(e) => setRejectDialog({ ...rejectDialog, reason: e.target.value })}
                  placeholder="Contoh: Jadwal bertabrakan dengan agenda proyek vital atau kuota perizinan divisi telah penuh..."
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-900 outline-none focus:border-[#1E3A8A] focus:bg-white resize-none"
                />
              </div>
            </div>

            <div className="px-6 py-4.5 border-t border-slate-100 bg-white flex items-center justify-between gap-3 shrink-0">
              <button
                type="button"
                onClick={() => setRejectDialog({ isOpen: false, leaveId: '', userName: '', reason: '' })}
                className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl text-xs cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleReject}
                className="px-6 py-2.5 bg-[#1E3A8A] hover:bg-[#172554] text-white font-bold rounded-xl text-xs shadow-xs cursor-pointer active:scale-95 transition-all"
              >
                Konfirmasi Penolakan
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DETAIL MODAL */}
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
                  <h3 className="font-bold text-base text-slate-900">Rincian Pengajuan Izin Tim</h3>
                  <p className="text-xs text-slate-500 mt-0.5">Evaluasi dan berikan persetujuan perizinan</p>
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
              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between">
                <div
                  className="cursor-pointer group/prof"
                  onClick={() => {
                    const matched = allUsers.find((u) => u.id === selectedLeaveDetail.userId || u.name === selectedLeaveDetail.userName);
                    setSimpleProfilePopup({
                      name: selectedLeaveDetail.userName,
                      avatar: matched?.avatar || selectedLeaveDetail.userAvatar,
                    });
                  }}
                  title="Lihat Profil"
                >
                  <p className="font-bold text-slate-900 group-hover/prof:text-[#1E3A8A] transition-colors text-sm">{selectedLeaveDetail.userName}</p>
                  <p className="text-xs text-slate-500">{selectedLeaveDetail.department || 'Staf Tim'}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`px-3 py-1 rounded-full text-xs font-bold ${getCategoryBadgeClass(selectedLeaveDetail.category)}`}>
                    {categoryLabels[selectedLeaveDetail.category]}
                  </span>
                  {selectedLeaveDetail.status === 'APPROVED' && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-[#DCFCE7] text-[#15803D] border border-[#86EFAC]/70">
                      <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                      <span>Disetujui</span>
                    </span>
                  )}
                  {selectedLeaveDetail.status === 'REJECTED' && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-[#FFE4E6] text-[#E11D48] border border-[#FDA4AF]/70">
                      <X className="w-3.5 h-3.5 stroke-[2.5]" />
                      <span>Ditolak</span>
                    </span>
                  )}
                </div>
              </div>

              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Periode &amp; Durasi</span>
                <p className="font-bold text-slate-900">{formatPeriodAndDuration(selectedLeaveDetail.startDate, selectedLeaveDetail.endDate, selectedLeaveDetail.totalDays)}</p>
              </div>

              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Alasan Lengkap</span>
                <p className="text-slate-800 font-medium">"{selectedLeaveDetail.reason}"</p>
              </div>

              {selectedLeaveDetail.attachmentName && (
                <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Lampiran Dokumen</span>
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
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setRejectDialog({
                        isOpen: true,
                        leaveId: selectedLeaveDetail.id,
                        userName: selectedLeaveDetail.userName,
                        reason: '',
                      });
                    }}
                    className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-[#FFE4E6] hover:bg-[#FECDD3] text-[#E11D48] border border-[#FDA4AF] font-bold rounded-xl text-xs cursor-pointer shadow-2xs active:scale-95 transition-all"
                    title="Tolak Permohonan"
                  >
                    <X className="w-4 h-4 stroke-[2.5]" />
                    <span>Tolak</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleApprove(selectedLeaveDetail.id)}
                    className="inline-flex items-center gap-1.5 px-5 py-2.5 bg-[#DCFCE7] hover:bg-[#BBF7D0] text-[#15803D] border border-[#86EFAC] font-bold rounded-xl text-xs cursor-pointer shadow-2xs active:scale-95 transition-all"
                    title="Setujui Pengajuan"
                  >
                    <Check className="w-4 h-4 stroke-[2.5]" />
                    <span>Setujui</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
      {/* Pop Up Profil Singkat (Nama & Foto Orang) */}
      <SimpleProfileModal
        isOpen={!!simpleProfilePopup}
        onClose={() => setSimpleProfilePopup(null)}
        profile={simpleProfilePopup}
      />
    </div>
  );
}
