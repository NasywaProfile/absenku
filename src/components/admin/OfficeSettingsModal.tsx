import React, { useState } from 'react';
import { X, Maximize2, Minimize2, MapPin, Clock, Save, Image as ImageIcon, Upload, Trash2 } from 'lucide-react';
import { OfficeConfig } from '../../types/index.ts';
import { compressImageFile } from '../../lib/image-compression.ts';
import { uploadToCloudinary } from '../../lib/cloudinary.ts';

interface OfficeSettingsModalProps {
  currentConfig: OfficeConfig;
  onSave: (newConfig: OfficeConfig) => void;
  onClose: () => void;
}

export function OfficeSettingsModal({ currentConfig, onSave, onClose }: OfficeSettingsModalProps) {
  const [config, setConfig] = useState<OfficeConfig>({ ...currentConfig });
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(config);
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const file = files[0];
    setIsUploadingPhoto(true);
    try {
      const compressed = await compressImageFile(file);
      const res = await uploadToCloudinary(compressed, { folder: 'absenku/office' });
      setConfig((prev) => ({ ...prev, photo: res.url }));
    } catch (err) {
      console.warn('Cloudinary upload fallback to compressed base64:', err);
      const compressed = await compressImageFile(file);
      setConfig((prev) => ({ ...prev, photo: compressed }));
    } finally {
      setIsUploadingPhoto(false);
      e.target.value = '';
    }
  };

  return (
    <div
      className={`fixed inset-0 z-50 flex animate-in fade-in duration-200 font-sans ${
        isFullScreen
          ? 'items-center justify-center p-0'
          : 'justify-end items-center p-2.5 sm:p-4 md:p-5'
      }`}
    >
      <div
        className="fixed inset-0 bg-slate-950/40 backdrop-blur-xs transition-opacity cursor-pointer"
        onClick={onClose}
      />
      <div
        className={`relative z-10 bg-white shadow-2xl flex flex-col min-h-0 overflow-hidden transition-all duration-300 font-sans ${
          isFullScreen
            ? 'w-full h-full max-w-none max-h-none rounded-none border-0'
            : 'w-full max-w-md sm:max-w-lg h-full max-h-[calc(100vh-1.25rem)] sm:max-h-[calc(100vh-2rem)] rounded-3xl border border-slate-200/80 animate-in slide-in-from-right duration-300 ease-out'
        }`}
      >
        
        {/* Header - Styled identical to ChatTopicModal */}
        <div className="px-5 py-4 border-b border-slate-100 flex items-start justify-between shrink-0 bg-white gap-3">
          {/* Zoom Button di pojok kiri atas */}
          <div className="w-9 shrink-0 flex items-start">
            <button
              type="button"
              onClick={() => setIsFullScreen(!isFullScreen)}
              className="p-1.5 sm:p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl border border-slate-200/80 transition-colors cursor-pointer shrink-0 mt-0.5"
              title={isFullScreen ? "Perkecil Tampilan" : "Perbesar Layar Penuh"}
            >
              {isFullScreen ? (
                <Minimize2 className="w-4 h-4 text-slate-600" />
              ) : (
                <Maximize2 className="w-4 h-4 text-slate-600" />
              )}
            </button>
          </div>

          {/* Judul & Subjudul diposisikan di tengah persis seperti di Ruang Obrolan */}
          <div className="flex-1 min-w-0 text-center px-1 sm:px-3 space-y-1.5 flex flex-col items-center justify-center pt-1">
            <h2 className="text-sm sm:text-[15px] font-bold text-slate-900 tracking-tight leading-snug max-w-2xl">
              Pengaturan Kantor &amp; Geofence
            </h2>
            <p className="text-slate-500 text-[11px] sm:text-xs leading-relaxed font-normal max-w-2xl">
              Konfigurasi radius GPS dan jam wajib masuk seluruh kantor
            </p>
          </div>

          {/* Container Tombol Tutup Panel di pojok kanan atas */}
          <div className="w-9 shrink-0 flex items-start justify-end">
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 sm:p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer shrink-0 mt-0.5"
              title="Tutup Panel"
            >
              <X className="w-4 h-4 sm:w-5 sm:h-5 text-slate-600" />
            </button>
          </div>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 flex flex-col min-h-0">
          <div className="flex-1 overflow-y-auto p-6 space-y-4 text-xs">
            {/* Nama Kantor / Lokasi */}
            <div>
              <label className="block font-semibold text-slate-700 mb-1.5">
                Nama Kantor / Lokasi
              </label>
              <input
                type="text"
                required
                value={config.name}
                onChange={(e) => setConfig({ ...config, name: e.target.value })}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 transition-all"
              />
            </div>

            {/* Di bawah kantor adalah alamat untuk di card maps */}
            <div>
              <label className="block font-semibold text-slate-700 mb-1.5">
                Alamat Kantor (Card Maps)
              </label>
              <textarea
                rows={2}
                value={config.address || ''}
                onChange={(e) => setConfig({ ...config, address: e.target.value })}
                placeholder="Contoh: Jl. Soekarno Hatta No. 9, Malang, Jawa Timur"
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 transition-all resize-none"
              />
            </div>

            {/* Unggah Foto Kantor (Card Maps) */}
            <div className="pt-2 border-t border-slate-100 space-y-2">
              <label className="block font-semibold text-slate-700">
                Unggah Foto Kantor (Card Maps)
              </label>
              <div className="bg-slate-50/80 border border-slate-200/90 rounded-2xl p-3 flex items-center gap-3.5">
                {/* Round Avatar Preview */}
                <div className="relative w-12 h-12 sm:w-14 sm:h-14 rounded-full overflow-hidden border border-slate-200 shadow-xs shrink-0 bg-white flex items-center justify-center">
                  {config.photo ? (
                    <img src={config.photo} alt="Foto Kantor" className="w-full h-full object-cover" />
                  ) : (
                    <ImageIcon className="w-5 h-5 text-slate-400" />
                  )}
                </div>

                {/* Upload Action */}
                <div className="flex-1 min-w-0 flex items-center gap-2">
                  <label className="flex-1 py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-xs flex items-center justify-center gap-2 cursor-pointer transition-colors shadow-xs">
                    <Upload className="w-4 h-4 text-white" />
                    <span>{isUploadingPhoto ? 'Mengunggah...' : 'Unggah Foto'}</span>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handlePhotoUpload}
                      disabled={isUploadingPhoto}
                    />
                  </label>
                  {config.photo && (
                    <button
                      type="button"
                      onClick={() => setConfig((prev) => ({ ...prev, photo: '' }))}
                      className="px-3 py-2.5 text-rose-600 hover:bg-rose-50 rounded-xl font-semibold text-xs border border-rose-200/70 transition-colors cursor-pointer shrink-0 flex items-center gap-1"
                      title="Hapus Foto"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Hapus</span>
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Lokasi (Latitude, Longitude, Geofence) */}
            <div className="pt-2 border-t border-slate-100 space-y-3">
              <p className="font-bold text-xs text-slate-800 uppercase tracking-wider">
                Titik Koordinat &amp; Geofence
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1.5 flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5 text-indigo-600" />
                    Latitude
                  </label>
                  <input
                    type="number"
                    step="0.000001"
                    required
                    value={config.latitude}
                    onChange={(e) => setConfig({ ...config, latitude: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono text-slate-900"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1.5 flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5 text-indigo-600" />
                    Longitude
                  </label>
                  <input
                    type="number"
                    step="0.000001"
                    required
                    value={config.longitude}
                    onChange={(e) => setConfig({ ...config, longitude: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono text-slate-900"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1.5">
                  Batas Radius Geofence (Meter)
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="range"
                    min="30"
                    max="500"
                    step="10"
                    value={config.geofenceRadiusMeter}
                    onChange={(e) => setConfig({ ...config, geofenceRadiusMeter: parseInt(e.target.value, 10) || 50 })}
                    className="flex-1 accent-indigo-600"
                  />
                  <span className="font-mono font-bold text-xs bg-indigo-50 text-indigo-700 px-3 py-1.5 rounded-lg border border-indigo-200/60 min-w-[70px] text-center">
                    {config.geofenceRadiusMeter} m
                  </span>
                </div>
              </div>
            </div>

            {/* Jam Wajib Masuk */}
            <div className="pt-2 border-t border-slate-100 space-y-3">
              <p className="font-bold text-xs text-slate-800 uppercase tracking-wider">
                Jam Masuk Kantor
              </p>
              <div>
                <label className="block font-semibold text-slate-700 mb-1.5 flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-slate-500" />
                  Jam Masuk Wajib
                </label>
                <input
                  type="time"
                  required
                  value={config.workStartHour}
                  onChange={(e) => setConfig({ ...config, workStartHour: e.target.value })}
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900"
                />
              </div>
            </div>
          </div>

          <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-end shrink-0 bg-white">
            <button
              type="submit"
              className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs shadow-xs transition-all duration-300 hover:-translate-y-0.5 flex items-center gap-1.5 cursor-pointer"
            >
              <Save className="w-3.5 h-3.5" />
              <span>Simpan Perubahan</span>
            </button>
          </div>
        </form>

      </div>
    </div>
  );
}
