import React, { useState } from 'react';
import { Mail, X, Maximize2, Minimize2, ExternalLink, Calendar, CheckCircle2, FileText, User, Paperclip } from 'lucide-react';
import { EmailNotification } from '../../types/index.ts';
import { EMPLOYMENT_TYPE_LABELS } from '../../lib/whatsapp-recap.ts';

interface EmailNotificationModalProps {
  isOpen: boolean;
  onClose: () => void;
  emails: EmailNotification[];
  onNavigateToApproval: () => void;
}

export function EmailNotificationModal({
  isOpen,
  onClose,
  emails,
  onNavigateToApproval,
}: EmailNotificationModalProps) {
  const [isFullScreen, setIsFullScreen] = useState(false);
  if (!isOpen) return null;

  const categoryBadgeColors = {
    LEAVE: 'bg-indigo-50 text-indigo-700 border-indigo-200',
    WFH: 'bg-amber-50 text-amber-900 border-amber-200',
    SICK: 'bg-orange-50 text-orange-900 border-orange-200',
    BUSINESS_TRIP: 'bg-purple-50 text-purple-900 border-purple-200',
  };

  const categoryTitles = {
    LEAVE: 'Izin / Cuti',
    WFH: 'Work From Home (WFH)',
    SICK: 'Sakit',
    BUSINESS_TRIP: 'Dinas Luar',
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
            : 'w-full max-w-md sm:max-w-lg md:max-w-xl h-full max-h-[calc(100vh-1.25rem)] sm:max-h-[calc(100vh-2rem)] rounded-3xl border border-slate-200/80 animate-in slide-in-from-right duration-300 ease-out'
        }`}
      >
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-100 bg-white flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            {/* Zoom Button di pojok kiri atas */}
            <button
              type="button"
              onClick={() => setIsFullScreen(!isFullScreen)}
              className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl border border-slate-200/80 transition-colors cursor-pointer shrink-0"
              title={isFullScreen ? "Perkecil Tampilan" : "Perbesar Layar Penuh"}
            >
              {isFullScreen ? (
                <Minimize2 className="w-4 h-4 text-slate-600" />
              ) : (
                <Maximize2 className="w-4 h-4 text-slate-600" />
              )}
            </button>
            <div>
              <h3 className="font-bold text-base text-slate-900">
                Log Notifikasi Email Masuk (Admin)
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Simulasi trigger pengiriman email otomatis saat user submit pengajuan izin
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full border border-slate-200 transition-colors cursor-pointer shrink-0"
            title="Tutup"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* List of Simulated Emails */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {emails.length === 0 ? (
            <div className="py-12 text-center text-slate-500">
              <Mail className="w-10 h-10 mx-auto text-slate-300 mb-2" />
              <p className="font-semibold text-sm">Belum ada email notifikasi perizinan terkirim</p>
              <p className="text-xs text-slate-400">
                Ajukan perizinan baru untuk melihat trigger notifikasi email otomatis.
              </p>
            </div>
          ) : (
            emails.map((mail) => (
              <div
                key={mail.id}
                className="bg-slate-50 rounded-xl border border-slate-200/90 p-5 space-y-3.5 hover:border-slate-300 transition-colors"
              >
                {/* Meta Bar */}
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div>
                    <span className="text-xs text-slate-400 font-mono block">
                      Waktu Terkirim: {mail.sentAt}
                    </span>
                    <h4 className="font-bold text-slate-900 text-base mt-0.5">
                      {mail.subject}
                    </h4>
                  </div>
                  <span
                    className={`text-xs font-bold px-2.5 py-1 rounded-full border ${
                      categoryBadgeColors[mail.category] || 'bg-slate-100 text-slate-700'
                    }`}
                  >
                    {categoryTitles[mail.category] || mail.category}
                  </span>
                </div>

                {/* Email Content Box */}
                <div className="bg-white rounded-lg p-4 border border-slate-200/70 text-xs sm:text-sm text-slate-700 space-y-2 font-sans">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs pb-2 border-b border-slate-100">
                    <p>
                      <strong className="text-slate-900">Kepada:</strong> {mail.toName} ({mail.toEmail})
                    </p>
                    <p>
                      <strong className="text-slate-900">Pengirim:</strong> {mail.fromName}
                    </p>
                  </div>

                  <p className="leading-relaxed pt-1">
                    Halo Administrator, karyawan{' '}
                    <strong className="text-slate-900">
                      {mail.employeeName} ({EMPLOYMENT_TYPE_LABELS[mail.employmentType] || 'Karyawan'})
                    </strong>{' '}
                    telah mengajukan permohonan <strong>{categoryTitles[mail.category]}</strong> dengan rincian:
                  </p>

                  <div className="bg-slate-50 p-3 rounded-lg border border-slate-100 space-y-1.5 text-xs">
                    <p className="flex items-center gap-2">
                      <Calendar className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                      <span>Rentang Waktu: <strong>{mail.dateRange}</strong></span>
                    </p>
                    <p className="flex items-start gap-2">
                      <FileText className="w-3.5 h-3.5 text-indigo-600 shrink-0 mt-0.5" />
                      <span>Alasan: <em>"{mail.reason}"</em></span>
                    </p>
                    {mail.attachmentName && (
                      <p className="text-slate-600 pt-1 flex items-center gap-1.5">
                        <Paperclip className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                        <span>Lampiran Dokumen: <strong>{mail.attachmentName}</strong></span>
                      </p>
                    )}
                  </div>
                </div>

                {/* Direct Action Link */}
                <div className="flex items-center justify-between pt-1">
                  <span className="text-xs text-slate-500 font-medium flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    Simulasi SMTP Dispatch Sukses
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onNavigateToApproval();
                    }}
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-[#1E3A8A] hover:bg-[#172554] text-white rounded-lg text-xs font-bold transition-all shadow-xs cursor-pointer"
                  >
                    <span>Tautan Persetujuan</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
