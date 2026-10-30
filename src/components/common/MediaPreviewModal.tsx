import React from 'react';
import {
  X,
  Download,
  ExternalLink,
  FileText,
  Maximize2,
  ZoomIn,
  ZoomOut,
  Image as ImageIcon,
} from 'lucide-react';
import { isImageFile, isPdfFile, openExternalLink, downloadMediaFile } from '../../lib/open-media.ts';

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
  const [zoomLevel, setZoomLevel] = React.useState(1);

  React.useEffect(() => {
    setZoomLevel(1);
  }, [media]);

  if (!media) return null;

  const isImg = isImageFile(media.url, media.fileType) || isImageFile(media.name, media.fileType);
  const isPdf = isPdfFile(media.url, media.fileType) || isPdfFile(media.name, media.fileType);
  const isLink = media.type === 'LINK' || (!media.url.startsWith('data:') && !isImg && !isPdf);

  const handleDownload = () => {
    downloadMediaFile(media.url, media.name || 'lampiran_berkas');
  };

  const handleOpenNewTab = () => {
    if (isLink) {
      openExternalLink(media.url);
    } else {
      const win = window.open();
      if (win) {
        if (isPdf) {
          win.document.title = media.name || 'Dokumen PDF';
          win.document.write(
            `<body style="margin:0; background:#1e293b; display:flex; justify-content:center; align-items:center; height:100vh; overflow:hidden;">
              <iframe src="${media.url}" frameborder="0" style="width:100%; height:100%; border:none;"></iframe>
            </body>`
          );
          win.document.close();
        } else if (isImg) {
          win.document.title = media.name || 'Pratinjau Gambar';
          win.document.write(
            `<body style="margin:0; background:#0f172a; display:flex; justify-content:center; align-items:center; min-height:100vh;">
              <img src="${media.url}" style="max-width:95vw; max-height:95vh; object-fit:contain; border-radius:12px; box-shadow:0 10px 30px rgba(0,0,0,0.5);" />
            </body>`
          );
          win.document.close();
        } else {
          window.open(media.url, '_blank');
        }
      } else {
        window.open(media.url, '_blank');
      }
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 font-sans animate-in fade-in duration-200">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-950/80 backdrop-blur-md transition-opacity cursor-pointer"
        onClick={onClose}
      />

      {/* Modal Card */}
      <div className="relative z-10 bg-white rounded-3xl shadow-2xl border border-slate-200/80 w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
        {/* Header Bar */}
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between gap-3 bg-white shrink-0">
          <div className="min-w-0 flex-1">
            <h3 className="font-bold text-slate-900 text-sm truncate leading-snug">
              {media.name || 'Pratinjau Berkas'}
            </h3>
            <p className="text-[11px] text-slate-400 truncate leading-snug">
              {media.fileSize ? `${media.fileSize} • ` : ''}
              {isImg ? 'Format Gambar' : isPdf ? 'Dokumen PDF' : isLink ? 'Tautan Eksternal' : 'Berkas Lampiran'}
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

            <button
              type="button"
              onClick={handleOpenNewTab}
              className="p-2 text-slate-500 hover:text-[#1E3A8A] hover:bg-blue-50 rounded-xl transition-colors cursor-pointer"
              title="Buka di Tab Baru"
            >
              <Maximize2 className="w-4 h-4" />
            </button>

            {!isLink && (
              <button
                type="button"
                onClick={handleDownload}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#1E3A8A] hover:bg-[#172554] text-white rounded-xl text-xs font-bold transition-all shadow-2xs cursor-pointer ml-1"
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
        <div className="flex-1 overflow-auto p-4 sm:p-6 bg-slate-900/5 flex items-center justify-center min-h-[320px]">
          {isImg ? (
            <div className="overflow-auto max-h-[70vh] flex items-center justify-center">
              <img
                src={media.url}
                alt={media.name || 'Pratinjau'}
                style={{ transform: `scale(${zoomLevel})` }}
                className="max-w-full max-h-[68vh] object-contain rounded-2xl shadow-lg transition-transform duration-150"
              />
            </div>
          ) : isPdf ? (
            <div className="w-full h-[68vh] rounded-2xl overflow-hidden border border-slate-200 bg-white shadow-inner">
              <iframe
                src={media.url}
                title={media.name || 'Dokumen PDF'}
                className="w-full h-full border-none"
              />
            </div>
          ) : isLink ? (
            <div className="text-center p-8 max-w-md bg-white rounded-2xl border border-slate-200 shadow-sm space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-blue-50 text-[#1E3A8A] flex items-center justify-center mx-auto">
                <ExternalLink className="w-6 h-6" />
              </div>
              <div>
                <h4 className="font-bold text-slate-900 text-sm mb-1">{media.name || 'Tautan Eksternal'}</h4>
                <p className="text-xs text-slate-500 font-mono break-all">{media.url}</p>
              </div>
              <button
                type="button"
                onClick={handleOpenNewTab}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#1E3A8A] hover:bg-[#172554] text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer"
              >
                <span>Buka Tautan di Tab Baru</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <div className="text-center p-8 max-w-md bg-white rounded-2xl border border-slate-200 shadow-sm space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto">
                <FileText className="w-6 h-6" />
              </div>
              <div>
                <h4 className="font-bold text-slate-900 text-sm mb-1">{media.name || 'Berkas Lampiran'}</h4>
                <p className="text-xs text-slate-500">Berkas siap diunduh ke komputer Anda</p>
              </div>
              <button
                type="button"
                onClick={handleDownload}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#1E3A8A] hover:bg-[#172554] text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Unduh Berkas Sekarang</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
