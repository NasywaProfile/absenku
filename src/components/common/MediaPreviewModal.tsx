import React from 'react';
import {
  X,
  Download,
  ExternalLink,
  FileText,
  Maximize2,
  Minimize2,
  ZoomIn,
  ZoomOut,
  FileSpreadsheet,
  FileCode,
  Archive,
  Loader2,
} from 'lucide-react';
import {
  isImageFile,
  isPdfFile,
  openExternalLink,
  downloadMediaFile,
  openDataUrlInNewTab,
  resolveMediaUrl,
  dataUrlToBlob,
  isSafeMediaUrl,
  isSafeDataUrl,
} from '../../lib/open-media.ts';

export interface MediaPreviewData {
  url: string;
  name?: string;
  type?: 'FILE' | 'LINK' | string;
  fileType?: string;
  fileSize?: string;
}

interface MediaPreviewModalProps {
  media: MediaPreviewData | null;
  onClose: () => void;
}

export function MediaPreviewModal({ media, onClose }: MediaPreviewModalProps) {
  const [resolvedUrl, setResolvedUrl] = React.useState<string>('');
  const [blobUrl, setBlobUrl] = React.useState<string>('');
  const [isLoading, setIsLoading] = React.useState<boolean>(true);
  const [zoomLevel, setZoomLevel] = React.useState(1);
  const [isFullscreen, setIsFullscreen] = React.useState(false);

  // Deteksi jenis file berdasarkan nama, tipe, dan konten
  const fileName = media?.name || '';
  const isImg = isImageFile(media?.url, media?.fileType) || isImageFile(fileName, media?.fileType);
  const isPdf = isPdfFile(media?.url, media?.fileType) || isPdfFile(fileName, media?.fileType);
  const isLink =
    media?.type === 'LINK' ||
    ((media?.url?.startsWith('http://') || media?.url?.startsWith('https://')) && !isImg && !isPdf);

  // Deteksi dokumen kantor khusus (Word, Excel, Zip)
  const isWordDoc = /\.(docx?|odt|rtf)$/i.test(fileName);
  const isSpreadsheetDoc = /\.(xlsx?|csv|ods)$/i.test(fileName);
  const isArchiveDoc = /\.(zip|rar|7z|tar|gz)$/i.test(fileName);

  // Ambil dan konversi URL ke Blob URL yang didukung penuh oleh browser Chrome/Edge tanpa blank
  React.useEffect(() => {
    let currentBlob = '';
    let isMounted = true;

    async function loadData() {
      if (!media?.url) {
        setResolvedUrl('');
        setBlobUrl('');
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setZoomLevel(1);

      try {
        let finalUrl = media.url;
        // 1. Jika URL berupa ID IndexedDB (idb:doc_...)
        if (finalUrl.startsWith('idb:')) {
          const resolved = await resolveMediaUrl(finalUrl, '');
          finalUrl = resolved;
        }

        if (!isMounted) return;
        if (!isSafeMediaUrl(finalUrl)) {
          setResolvedUrl('');
          setBlobUrl('');
          return;
        }
        setResolvedUrl(finalUrl);

        // 2. Jika berupa Base64 Data URL, konversi menjadi Blob URL asli
        // Browser seperti Chrome memblokir iframe dengan data:application/pdf sehingga tampak blank putih.
        // Blob URL (blob:http://...) didukung 100% dan membuka viewer PDF bawaan browser secara sempurna.
        if (finalUrl.startsWith('data:')) {
          if (!isSafeDataUrl(finalUrl)) {
            setBlobUrl('');
            return;
          }
          const mime = isPdf ? 'application/pdf' : isImg ? 'image/jpeg' : 'application/octet-stream';
          const blob = dataUrlToBlob(finalUrl, mime);
          currentBlob = URL.createObjectURL(blob);
          if (isMounted) {
            setBlobUrl(currentBlob);
          }
        } else {
          setBlobUrl(finalUrl);
        }
      } catch (err) {
        console.warn('Gagal memuat pratinjau media:', err);
        if (isMounted) {
          setBlobUrl(isSafeMediaUrl(media.url) ? media.url : '');
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    loadData();

    return () => {
      isMounted = false;
      if (currentBlob && currentBlob.startsWith('blob:')) {
        URL.revokeObjectURL(currentBlob);
      }
    };
  }, [media?.url, isPdf, isImg]);

  if (!media) return null;

  const handleDownload = () => {
    downloadMediaFile(blobUrl || resolvedUrl || media.url, media.name || 'berkas_lampiran');
  };

  const handleOpenNewTab = () => {
    if (isLink) {
      openExternalLink(resolvedUrl || media.url);
    } else if (blobUrl) {
      openDataUrlInNewTab(blobUrl, media.name || 'lampiran_berkas');
    } else {
      openDataUrlInNewTab(resolvedUrl || media.url, media.name || 'lampiran_berkas');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 md:p-6 font-sans animate-in fade-in duration-200">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-950/80 backdrop-blur-md transition-opacity cursor-pointer"
        onClick={onClose}
      />

      {/* Modal Card */}
      <div
        className={`relative z-10 bg-white rounded-3xl shadow-2xl border border-slate-200/80 flex flex-col overflow-hidden animate-in zoom-in-95 duration-200 transition-all ${
          isFullscreen
            ? 'fixed inset-2 sm:inset-4 w-auto h-auto max-w-none max-h-none'
            : 'w-full max-w-5xl max-h-[92vh] h-[85vh]'
        }`}
      >
        {/* Header Bar */}
        <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between gap-3 bg-white shrink-0">
          <div className="min-w-0 flex-1">
            <h3 className="font-bold text-slate-900 text-sm truncate leading-snug">
              {media.name || 'Pratinjau Berkas'}
            </h3>
            <p className="text-[11px] text-slate-400 truncate leading-snug">
              {media.fileSize ? `${media.fileSize} • ` : ''}
              {isImg
                ? 'Format Gambar'
                : isPdf
                ? 'Dokumen PDF'
                : isWordDoc
                ? 'Dokumen Microsoft Word'
                : isSpreadsheetDoc
                ? 'Dokumen Spreadsheet'
                : isArchiveDoc
                ? 'Arsip Berkas (ZIP/RAR)'
                : isLink
                ? 'Tautan Eksternal'
                : 'Berkas Lampiran'}
            </p>
          </div>

          {/* Action Toolbar */}
          <div className="flex items-center gap-1.5 shrink-0">
            {isImg && (
              <>
                <button
                  type="button"
                  onClick={() => setZoomLevel((z) => Math.max(0.5, z - 0.25))}
                  className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
                  title="Perkecil Gambar"
                >
                  <ZoomOut className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setZoomLevel((z) => Math.min(3, z + 0.25))}
                  className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
                  title="Perbesar Gambar"
                >
                  <ZoomIn className="w-4 h-4" />
                </button>
              </>
            )}

            {/* Toggle Layar Penuh Modal */}
            <button
              type="button"
              onClick={() => setIsFullscreen(!isFullscreen)}
              className="p-2 text-slate-500 hover:text-[#1E3A8A] hover:bg-blue-50 rounded-xl transition-colors cursor-pointer"
              title={isFullscreen ? 'Kecilkan Tampilan' : 'Perbesar Layar Penuh'}
            >
              {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>

            {/* Buka di Tab Baru Browser */}
            <button
              type="button"
              onClick={handleOpenNewTab}
              className="p-2 text-slate-500 hover:text-[#1E3A8A] hover:bg-blue-50 rounded-xl transition-colors cursor-pointer"
              title="Buka Dokumen di Tab Baru"
            >
              <ExternalLink className="w-4 h-4" />
            </button>

            {!isLink && (
              <button
                type="button"
                onClick={handleDownload}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-[#1E3A8A] hover:bg-[#172554] text-white rounded-xl text-xs font-bold transition-all shadow-2xs cursor-pointer ml-1 active:scale-95"
                title="Unduh Berkas"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Unduh</span>
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-full transition-colors cursor-pointer ml-1"
              title="Tutup Pratinjau"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-hidden p-3 sm:p-5 bg-slate-100/70 flex flex-col items-center justify-center min-h-[350px]">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center p-12 space-y-3">
              <Loader2 className="w-8 h-8 text-[#1E3A8A] animate-spin" />
              <p className="text-xs font-semibold text-slate-600">Memuat berkas dokumen...</p>
            </div>
          ) : isImg ? (
            <div className="w-full h-full overflow-auto flex items-center justify-center p-2 custom-scrollbar">
              <img
                src={blobUrl || resolvedUrl || media.url}
                alt={media.name || 'Pratinjau'}
                style={{ transform: `scale(${zoomLevel})` }}
                className="max-w-full max-h-full object-contain rounded-2xl shadow-lg transition-transform duration-150"
              />
            </div>
          ) : isPdf ? (
            <div className="w-full h-full flex flex-col rounded-2xl overflow-hidden border border-slate-200/90 bg-white shadow-sm">
              <iframe
                src={`${blobUrl || resolvedUrl}#toolbar=1&navpanes=0`}
                title={media.name || 'Dokumen PDF'}
                className="w-full flex-1 border-none"
              />
              <div className="px-4 py-2 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500 shrink-0">
                <span className="truncate pr-2 font-medium">
                  {media.name || 'Dokumen PDF'} • {media.fileSize || 'Dokumen'}
                </span>
                <div className="flex items-center gap-2 shrink-0 font-semibold">
                  <button
                    type="button"
                    onClick={handleOpenNewTab}
                    className="text-[#1E3A8A] hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <span>Buka Tab Penuh</span>
                    <ExternalLink className="w-3 h-3" />
                  </button>
                  <span className="text-slate-300">|</span>
                  <button
                    type="button"
                    onClick={handleDownload}
                    className="text-[#1E3A8A] hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <span>Unduh</span>
                    <Download className="w-3 h-3" />
                  </button>
                </div>
              </div>
            </div>
          ) : isLink ? (
            <div className="text-center p-8 max-w-md bg-white rounded-2xl border border-slate-200 shadow-sm space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-blue-50 text-[#1E3A8A] flex items-center justify-center mx-auto">
                <ExternalLink className="w-6 h-6" />
              </div>
              <div>
                <h4 className="font-bold text-slate-900 text-sm mb-1">{media.name || 'Tautan Eksternal'}</h4>
                <p className="text-xs text-slate-500 break-all">{resolvedUrl || media.url}</p>
              </div>
              <button
                type="button"
                onClick={handleOpenNewTab}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#1E3A8A] hover:bg-[#172554] text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer active:scale-95"
              >
                <span>Buka Tautan di Tab Baru</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <div className="text-center p-8 max-w-md bg-white rounded-3xl border border-slate-200/90 shadow-md space-y-4">
              <div className="w-16 h-16 rounded-3xl bg-blue-50 text-[#1E3A8A] flex items-center justify-center mx-auto shadow-2xs border border-blue-100">
                {isWordDoc ? (
                  <FileText className="w-8 h-8 text-blue-700" />
                ) : isSpreadsheetDoc ? (
                  <FileSpreadsheet className="w-8 h-8 text-emerald-600" />
                ) : isArchiveDoc ? (
                  <Archive className="w-8 h-8 text-amber-600" />
                ) : (
                  <FileCode className="w-8 h-8 text-[#1E3A8A]" />
                )}
              </div>
              <div>
                <h4 className="font-bold text-slate-900 text-sm mb-1">{media.name || 'Berkas Lampiran'}</h4>
                <p className="text-xs text-slate-500">
                  {media.fileSize ? `${media.fileSize} • ` : ''}
                  {isWordDoc
                    ? 'Format Microsoft Word siap dibuka atau diunduh'
                    : isSpreadsheetDoc
                    ? 'Format Spreadsheet siap dibuka atau diunduh'
                    : 'Berkas siap diunduh ke komputer Anda'}
                </p>
              </div>
              <div className="flex items-center justify-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={handleDownload}
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#1E3A8A] hover:bg-[#172554] text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer active:scale-95"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Unduh Dokumen Sekarang</span>
                </button>
                <button
                  type="button"
                  onClick={handleOpenNewTab}
                  className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all cursor-pointer"
                  title="Buka di Tab Baru"
                >
                  <span>Buka</span>
                  <ExternalLink className="w-3 h-3" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
