import React, { useState, useEffect, useRef } from 'react';
import {
  Building2,
  MapPin,
  Clock,
  Save,
  Radio,
  ShieldCheck,
  ShieldAlert,
  Navigation,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import * as maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { OfficeConfig } from '../../types/index.ts';
import { ModernConfirmDialog } from '../common/ModernConfirmDialog.tsx';

// Helper GeoJSON circle
function createGeoJSONCircle(center: [number, number], radiusInMeters: number, points = 64) {
  const [lng, lat] = center;
  const coords: [number, number][] = [];
  const km = radiusInMeters / 1000;
  const distanceX = km / (111.32 * Math.cos((lat * Math.PI) / 180));
  const distanceY = km / 110.574;

  for (let i = 0; i < points; i++) {
    const theta = (i / points) * (2 * Math.PI);
    const x = distanceX * Math.cos(theta);
    const y = distanceY * Math.sin(theta);
    coords.push([lng + x, lat + y]);
  }
  coords.push(coords[0]);

  return {
    type: 'Feature' as const,
    geometry: {
      type: 'Polygon' as const,
      coordinates: [coords],
    },
    properties: {},
  };
}

interface LocationGeofencePageProps {
  officeConfig: OfficeConfig;
  onSaveConfig: (newConfig: OfficeConfig) => void;
}

export function LocationGeofencePage({
  officeConfig,
  onSaveConfig,
}: LocationGeofencePageProps) {
  const [config, setConfig] = useState<OfficeConfig>({
    ...officeConfig,
    isGeofenceActive: officeConfig.isGeofenceActive ?? true,
  });

  const [savedSuccessToast, setSavedSuccessToast] = useState(false);
  const [isLocating, setIsLocating] = useState(false);
  const [geoAlert, setGeoAlert] = useState<string | null>(null);

  const adminMapContainerRef = useRef<HTMLDivElement>(null);
  const adminMapRef = useRef<maplibregl.Map | null>(null);
  const adminMarkerRef = useRef<maplibregl.Marker | null>(null);

  // Inisialisasi MapLibre di halaman Geofence Admin
  useEffect(() => {
    if (!adminMapContainerRef.current || adminMapRef.current) return;

    try {
      const map = new maplibregl.Map({
        container: adminMapContainerRef.current,
        style: {
          version: 8,
          sources: {
            'osm-raster-tiles': {
              type: 'raster',
              tiles: [
                'https://a.tile.openstreetmap.org/{z}/{x}/{y}.png',
                'https://b.tile.openstreetmap.org/{z}/{x}/{y}.png',
                'https://c.tile.openstreetmap.org/{z}/{x}/{y}.png',
              ],
              tileSize: 256,
              attribution:
                '&copy; <a href="https://maplibre.org" target="_blank" rel="noopener noreferrer">MapLibre</a>',
            },
          },
          layers: [
            {
              id: 'osm-raster-layer',
              type: 'raster',
              source: 'osm-raster-tiles',
              minzoom: 0,
              maxzoom: 19,
            },
          ],
        },
        center: [config.longitude || 112.630541, config.latitude || -7.978645],
        zoom: 16.5,
        attributionControl: false,
        scrollZoom: true,
        doubleClickZoom: true,
        touchZoomRotate: true,
        dragPan: true,
      });

      map.on('load', () => {
        // Lingkaran radius
        const circleData = createGeoJSONCircle(
          [config.longitude, config.latitude],
          config.geofenceRadiusMeter
        );

        map.addSource('admin-geofence-circle', {
          type: 'geojson',
          data: circleData,
        });

        map.addLayer({
          id: 'admin-geofence-fill',
          type: 'fill',
          source: 'admin-geofence-circle',
          paint: {
            'fill-color': '#4f46e5',
            'fill-opacity': 0.15,
          },
        });

        map.addLayer({
          id: 'admin-geofence-stroke',
          type: 'line',
          source: 'admin-geofence-circle',
          paint: {
            'line-color': '#4338ca',
            'line-width': 2,
            'line-dasharray': [2, 2],
          },
        });

        // Marker Pin Kantor yang bisa didrag atau diklik
        const el = document.createElement('div');
        el.className = 'w-9 h-9 rounded-full bg-[#1E3A8A] text-white flex items-center justify-center shadow-lg border-2 border-white cursor-pointer';
        el.innerHTML = `
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/>
            <circle cx="12" cy="10" r="3"/>
          </svg>
        `;

        adminMarkerRef.current = new maplibregl.Marker({ element: el, draggable: true })
          .setLngLat([config.longitude, config.latitude])
          .addTo(map);

        adminMarkerRef.current.on('dragend', () => {
          const lngLat = adminMarkerRef.current?.getLngLat();
          if (lngLat) {
            setConfig((prev) => ({
              ...prev,
              latitude: parseFloat(lngLat.lat.toFixed(6)),
              longitude: parseFloat(lngLat.lng.toFixed(6)),
            }));
          }
        });

        // Klik pada peta untuk memindahkan pin lokasi kantor
        map.on('click', (e) => {
          const { lng, lat } = e.lngLat;
          setConfig((prev) => ({
            ...prev,
            latitude: parseFloat(lat.toFixed(6)),
            longitude: parseFloat(lng.toFixed(6)),
          }));
        });
      });

      adminMapRef.current = map;
    } catch (err) {
      console.error('Admin MapLibre init error:', err);
    }

    return () => {
      if (adminMapRef.current) {
        adminMapRef.current.remove();
        adminMapRef.current = null;
      }
    };
  }, []);

  // Update marker & radius circle saat config berubah
  useEffect(() => {
    if (!adminMapRef.current) return;
    const map = adminMapRef.current;

    if (adminMarkerRef.current) {
      adminMarkerRef.current.setLngLat([config.longitude, config.latitude]);
    }

    if (map.isStyleLoaded() && map.getSource('admin-geofence-circle')) {
      const circleData = createGeoJSONCircle(
        [config.longitude, config.latitude],
        config.geofenceRadiusMeter
      );
      (map.getSource('admin-geofence-circle') as maplibregl.GeoJSONSource).setData(circleData);
    }
  }, [config.latitude, config.longitude, config.geofenceRadiusMeter]);

  const handleGetCurrentLocation = () => {
    if (!navigator.geolocation) {
      setGeoAlert('Browser Anda tidak mendukung layanan Geolocation GPS.');
      return;
    }

    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setConfig((prev) => ({
          ...prev,
          latitude: parseFloat(position.coords.latitude.toFixed(6)),
          longitude: parseFloat(position.coords.longitude.toFixed(6)),
        }));
        setIsLocating(false);
      },
      (error) => {
        setIsLocating(false);
        setGeoAlert(`Gagal mengambil titik koordinat GPS: ${error.message}`);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSaveConfig(config);
    setSavedSuccessToast(true);
    setTimeout(() => {
      setSavedSuccessToast(false);
    }, 3500);
  };

  const isGeofenceActive = config.isGeofenceActive ?? true;

  return (
    <div className="space-y-6 font-sans antialiased max-w-5xl mx-auto pb-12">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 rounded-3xl p-6 sm:p-8 text-white shadow-xl relative overflow-hidden">
        <div className="absolute -right-10 -bottom-10 w-60 h-60 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
        
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="px-3 py-1 rounded-full text-[10px] font-extrabold bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 uppercase tracking-wider flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Sistem Geofence
              </span>
            </div>
            
            <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white flex items-center gap-2.5">
              <Building2 className="w-6 h-6 text-indigo-400" />
              <span>Pengaturan Lokasi Kantor &amp; Radar Geofence</span>
            </h1>
            <p className="text-slate-300 text-xs sm:text-sm max-w-2xl leading-relaxed">
              Konfigurasi titik pusat koordinat GPS lokasi kantor, batas radius aman geofence, serta aktivasi Status Geofence Radar untuk pembatasan presensi staf.
            </p>
          </div>

          {/* Radar Live Indicator Badge */}
          <div className={`p-4 rounded-2xl border backdrop-blur-md shrink-0 flex items-center gap-3.5 transition-all ${
            isGeofenceActive
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-200'
              : 'bg-amber-500/10 border-amber-500/30 text-amber-200'
          }`}>
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 relative ${
              isGeofenceActive ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'
            }`}>
              <Radio className={`w-6 h-6 ${isGeofenceActive ? 'animate-pulse' : ''}`} />
              {isGeofenceActive && (
                <span className="absolute inset-0 rounded-2xl border border-emerald-400/60 animate-ping opacity-75" />
              )}
            </div>
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider block opacity-80">
                Status Radar Geofence
              </span>
              <span className="text-sm font-black tracking-tight">
                {isGeofenceActive ? 'AKTIF (Radius Terkunci)' : 'NONAKTIF (Presensi Bebas)'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Alert Success Notification Toast */}
      {savedSuccessToast && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl text-emerald-900 flex items-center justify-between gap-3 animate-in fade-in slide-in-from-top-2 duration-300 shadow-sm">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            <div>
              <p className="font-bold text-xs">Perubahan Lokasi &amp; Status Geofence Berhasil Disimpan!</p>
              <p className="text-[11px] text-emerald-700">Aturan geofence terbaru telah aktif dan berlaku untuk seluruh karyawan.</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setSavedSuccessToast(false)}
            className="text-emerald-500 hover:text-emerald-700 text-xs font-bold"
          >
            Tutup
          </button>
        </div>
      )}

      {/* Main Form Container */}
      <form onSubmit={handleSubmit} className="space-y-6">
        
        {/* CARD 1: TOGGLE STATUS GEOFENCE RADAR */}
        <div className="bg-white rounded-3xl border border-slate-200 shadow-xs p-6 sm:p-7 space-y-4">
          <div className="flex items-start justify-between gap-4 pb-4 border-b border-slate-100">
            <div>
              <div className="flex items-center gap-2">
                <Radio className="w-5 h-5 text-[#1E3A8A]" />
                <h2 className="text-base font-bold text-slate-900">
                  Status Geofence Radar
                </h2>
              </div>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                Tentukan apakah karyawan wajib berada di radius lokasi kantor untuk melakukan presensi, atau dapat presensi secara bebas/fleksibel dari mana saja.
              </p>
            </div>

            {/* Toggle Switch */}
            <button
              type="button"
              onClick={() =>
                setConfig((prev) => ({
                  ...prev,
                  isGeofenceActive: !isGeofenceActive,
                }))
              }
              className={`relative inline-flex h-8 w-14 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden ${
                isGeofenceActive ? 'bg-[#1E3A8A]' : 'bg-slate-300'
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-7 w-7 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                  isGeofenceActive ? 'translate-x-6' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
            <div
              onClick={() => setConfig((prev) => ({ ...prev, isGeofenceActive: true }))}
              className={`p-4 rounded-2xl border-2 cursor-pointer transition-all ${
                isGeofenceActive
                  ? 'border-[#1E3A8A] bg-blue-50/50 shadow-xs'
                  : 'border-slate-200 hover:border-slate-300 bg-slate-50/50'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 font-bold text-xs text-slate-900">
                  <ShieldCheck className="w-4 h-4 text-emerald-600" />
                  <span>Geofence Radar AKTIF</span>
                </div>
                <input
                  type="radio"
                  checked={isGeofenceActive}
                  onChange={() => setConfig((prev) => ({ ...prev, isGeofenceActive: true }))}
                  className="accent-[#1E3A8A] cursor-pointer"
                />
              </div>
              <p className="text-[11px] text-slate-500 mt-2 leading-relaxed">
                Presensi karyawan ditolak otomatis jika posisi GPS karyawan berada di luar batas radius meter kantor.
              </p>
            </div>

            <div
              onClick={() => setConfig((prev) => ({ ...prev, isGeofenceActive: false }))}
              className={`p-4 rounded-2xl border-2 cursor-pointer transition-all ${
                !isGeofenceActive
                  ? 'border-amber-600 bg-amber-50/50 shadow-xs'
                  : 'border-slate-200 hover:border-slate-300 bg-slate-50/50'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 font-bold text-xs text-slate-900">
                  <ShieldAlert className="w-4 h-4 text-amber-600" />
                  <span>Geofence Radar NONAKTIF</span>
                </div>
                <input
                  type="radio"
                  checked={!isGeofenceActive}
                  onChange={() => setConfig((prev) => ({ ...prev, isGeofenceActive: false }))}
                  className="accent-amber-600 cursor-pointer"
                />
              </div>
              <p className="text-[11px] text-slate-500 mt-2 leading-relaxed">
                Presensi bersifat Bebas / Remote. Karyawan dapat clock in dari mana saja tanpa validasi jarak radius GPS.
              </p>
            </div>
          </div>
        </div>

        {/* CARD 2: KOORDINAT GPS & NAMA LOKASI KANTOR */}
        <div className="bg-white rounded-3xl border border-slate-200 shadow-xs p-6 sm:p-7 space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
            <div>
              <div className="flex items-center gap-2">
                <MapPin className="w-5 h-5 text-[#1E3A8A]" />
                <h2 className="text-base font-bold text-slate-900">
                  Titik Koordinat Pusat Kantor
                </h2>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Pusat acuan pengukuran jarak Haversine GPS presensi
              </p>
            </div>

            {/* Quick GPS Auto-detect Button */}
            <button
              type="button"
              onClick={handleGetCurrentLocation}
              disabled={isLocating}
              className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 active:scale-95 text-slate-800 rounded-xl text-xs font-bold border border-slate-200 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              <Navigation className={`w-3.5 h-3.5 text-[#1E3A8A] ${isLocating ? 'animate-spin' : ''}`} />
              <span>{isLocating ? 'Mengambil GPS...' : '📍 Gunakan Lokasi GPS Saya Saat Ini'}</span>
            </button>
          </div>

          <div className="space-y-4 text-xs">
            <div>
              <label className="block font-semibold text-slate-700 mb-1.5">
                Nama Gedung / Cabang Kantor
              </label>
              <input
                type="text"
                required
                value={config.name}
                onChange={(e) => setConfig({ ...config, name: e.target.value })}
                placeholder="Contoh: IndigoSpace Malang Pusat"
                className="w-full px-4 py-2.5 bg-slate-50 hover:bg-white focus:bg-white border border-slate-200 rounded-xl text-xs text-slate-900 font-medium focus:outline-hidden focus:ring-2 focus:ring-indigo-500 transition-colors"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1.5">
                Alamat Lengkap Kantor
              </label>
              <input
                type="text"
                value={config.address || ''}
                onChange={(e) => setConfig({ ...config, address: e.target.value })}
                placeholder="Contoh: Jl. Simpang Semanggi Barat No. 2, Lowokwaru, Malang"
                className="w-full px-4 py-2.5 bg-slate-50 hover:bg-white focus:bg-white border border-slate-200 rounded-xl text-xs text-slate-900 font-medium focus:outline-hidden focus:ring-2 focus:ring-indigo-500 transition-colors"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block font-semibold text-slate-700 mb-1.5">
                  Latitude (Garis Lintang)
                </label>
                <input
                  type="number"
                  step="0.000001"
                  required
                  value={config.latitude}
                  onChange={(e) =>
                    setConfig({ ...config, latitude: parseFloat(e.target.value) || 0 })
                  }
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-mono text-slate-900 font-bold focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1.5">
                  Longitude (Garis Bujur)
                </label>
                <input
                  type="number"
                  step="0.000001"
                  required
                  value={config.longitude}
                  onChange={(e) =>
                    setConfig({ ...config, longitude: parseFloat(e.target.value) || 0 })
                  }
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-mono text-slate-900 font-bold focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>

            {/* Interactive Map Preview & Pin Picker */}
            <div className="pt-2">
              <div className="flex items-center justify-between mb-2">
                <span className="font-semibold text-slate-700 text-xs flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
                  <span>Pratinjau Peta &amp; Radius Geofence</span>
                </span>
                <span className="text-[11px] text-slate-400">
                  Klik di peta untuk menentukan koordinat kantor
                </span>
              </div>

              <div className="relative w-full h-64 sm:h-72 rounded-2xl overflow-hidden border border-slate-200/90 shadow-2xs bg-slate-100">
                <div ref={adminMapContainerRef} className="absolute inset-0 w-full h-full" />
              </div>
            </div>
          </div>
        </div>

        {/* CARD 3: BATAS RADIUS GEOFENCE & WAKTU KERJA */}
        <div className="bg-white rounded-3xl border border-slate-200 shadow-xs p-6 sm:p-7 space-y-5">
          <div className="pb-4 border-b border-slate-100">
            <h2 className="text-base font-bold text-slate-900">
              Batas Radius &amp; Jam Wajib Kantor
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Pengaturan jarak cakupan radar dan toleransi batas keterlambatan
            </p>
          </div>

          <div className="space-y-5 text-xs">
            {/* Radius Slider */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="font-semibold text-slate-700">
                  Batas Radius Geofence (Meter)
                </label>
                <span className="font-mono font-bold text-xs bg-blue-50 text-[#1E3A8A] px-3 py-1 rounded-lg border border-blue-200">
                  {config.geofenceRadiusMeter} Meter
                </span>
              </div>
              <div className="flex items-center gap-4">
                <span className="text-slate-400 font-bold text-[11px]">30m</span>
                <input
                  type="range"
                  min="30"
                  max="1000"
                  step="10"
                  value={config.geofenceRadiusMeter}
                  onChange={(e) =>
                    setConfig({
                      ...config,
                      geofenceRadiusMeter: parseInt(e.target.value, 10) || 50,
                    })
                  }
                  className="flex-1 h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-[#1E3A8A]"
                />
                <span className="text-slate-400 font-bold text-[11px]">1000m</span>
              </div>
              <p className="text-[11px] text-slate-400 mt-1.5 italic">
                Rekomendasi radius presensi kantor standar: 50 - 150 meter.
              </p>
            </div>

            {/* Jam Kerja */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              <div>
                <label className="block font-semibold text-slate-700 mb-1.5 flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-slate-500" />
                  <span>Jam Masuk Wajib</span>
                </label>
                <input
                  type="time"
                  required
                  value={config.workStartHour}
                  onChange={(e) => setConfig({ ...config, workStartHour: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-bold"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1.5 flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-slate-500" />
                  <span>Jam Pulang Standar</span>
                </label>
                <input
                  type="time"
                  required
                  value={config.workEndHour}
                  onChange={(e) => setConfig({ ...config, workEndHour: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-bold"
                />
              </div>
            </div>
          </div>
        </div>

        {/* BOTTOM SAVE BUTTON */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            type="submit"
            className="px-8 py-3.5 bg-[#1E3A8A] hover:bg-[#172554] active:scale-[0.98] text-white font-bold rounded-2xl text-xs shadow-md shadow-indigo-900/20 transition-all flex items-center gap-2 cursor-pointer"
          >
            <Save className="w-4 h-4" />
            <span>Simpan Perubahan Lokasi &amp; Geofence Radar</span>
          </button>
        </div>
      </form>

      {/* Pop Up Dialog Notifikasi GPS Simpel */}
      <ModernConfirmDialog
        isOpen={!!geoAlert}
        variant="warning"
        title="Layanan Lokasi GPS"
        message={geoAlert || ''}
        confirmText="Mengerti"
        hideCancel={true}
        onConfirm={() => setGeoAlert(null)}
        onCancel={() => setGeoAlert(null)}
      />
    </div>
  );
}
