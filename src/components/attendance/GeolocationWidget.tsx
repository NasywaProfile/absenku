import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  Compass,
  Navigation,
  Building2,
  Maximize2,
  LocateFixed,
  Home,
  Briefcase,
} from 'lucide-react';
import * as maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { Coordinates, calculateHaversineDistance, formatDistanceDisplay } from '../../lib/geo-utils.ts';
import { OfficeConfig, User } from '../../types/index.ts';

interface GeolocationWidgetProps {
  officeConfig: OfficeConfig;
  onLocationVerified: (coords: Coordinates, distanceMeter: number, isWithinRadius: boolean) => void;
  currentUser?: User;
  workMode?: 'WFO' | 'WFH' | 'DINAS';
  isWfhApproved?: boolean;
  isBusinessTripApproved?: boolean;
}

// Helper untuk membuat Polygon GeoJSON lingkaran radius di atas peta
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

export function GeolocationWidget({
  officeConfig,
  onLocationVerified,
  currentUser,
  workMode,
  isWfhApproved,
  isBusinessTripApproved,
}: GeolocationWidgetProps) {
  const [currentCoords, setCurrentCoords] = useState<Coordinates | null>(null);
  const [gpsAccuracy, setGpsAccuracy] = useState<number | null>(null);
  const [gpsError, setGpsError] = useState<string | null>(null);
  const [isDetecting, setIsDetecting] = useState<boolean>(false);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<maplibregl.Map | null>(null);
  const userMarkerRef = useRef<maplibregl.Marker | null>(null);
  const officeMarkerRef = useRef<maplibregl.Marker | null>(null);

  // Status fleksibilitas kerja remote (WFH / Dinas Luar)
  const isWfh = Boolean(isWfhApproved || workMode === 'WFH');
  const isDinas = Boolean(isBusinessTripApproved || workMode === 'DINAS');
  const isRemote = isWfh || isDinas;

  // Koordinat Kantor Asli (IndigoSpace Malang: Simpang Borobudur)
  const officeCoords: Coordinates = {
    latitude: officeConfig.latitude || -7.9439,
    longitude: officeConfig.longitude || 112.6322,
  };

  const isGeofenceActive = officeConfig.isGeofenceActive ?? true;
  const radiusMeters = officeConfig.geofenceRadiusMeter || 100;
  const distance = currentCoords ? calculateHaversineDistance(currentCoords, officeCoords) : null;
  const isWithinRadius = distance !== null ? (isGeofenceActive ? (isRemote || distance <= radiusMeters) : true) : false;

  // Evaluasi jarak dan kirim ke parent
  const evaluateLocation = useCallback(
    (coords: Coordinates) => {
      setCurrentCoords(coords);
      const dist = calculateHaversineDistance(coords, officeCoords);
      const withinRadius = isRemote || dist <= radiusMeters;
      onLocationVerified(coords, dist, withinRadius);
    },
    [officeCoords.latitude, officeCoords.longitude, radiusMeters, onLocationVerified, isRemote]
  );

  // Fit bounds agar kedua titik (Kantor & Posisi User) tampak jelas di layar
  const fitBothPoints = useCallback(
    (userCoords: Coordinates) => {
      if (!mapInstanceRef.current) return;
      const bounds = new maplibregl.LngLatBounds();
      bounds.extend([officeCoords.longitude, officeCoords.latitude]);
      bounds.extend([userCoords.longitude, userCoords.latitude]);

      mapInstanceRef.current.fitBounds(bounds, {
        padding: { top: 85, bottom: 120, left: 60, right: 60 },
        maxZoom: 16.8,
        duration: 900,
      });
    },
    [officeCoords.latitude, officeCoords.longitude]
  );

  // Pusatkan ke posisi user
  const centerToUser = useCallback(() => {
    if (!mapInstanceRef.current || !currentCoords) return;
    mapInstanceRef.current.flyTo({
      center: [currentCoords.longitude, currentCoords.latitude],
      zoom: 17,
      pitch: 20,
      duration: 800,
    });
  }, [currentCoords]);

  // Pusatkan ke kantor
  const centerToOffice = useCallback(() => {
    if (!mapInstanceRef.current) return;
    mapInstanceRef.current.flyTo({
      center: [officeCoords.longitude, officeCoords.latitude],
      zoom: 17,
      pitch: 20,
      duration: 800,
    });
  }, [officeCoords.latitude, officeCoords.longitude]);

  // Request GPS Asli Real-time dari Geolocation API perangkat
  const detectLiveGPS = useCallback(() => {
    setIsDetecting(true);
    setGpsError(null);

    if (!navigator.geolocation) {
      setGpsError('Browser Anda tidak mendukung layanan Geolocation.');
      setIsDetecting(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const coords: Coordinates = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        };
        setGpsAccuracy(position.coords.accuracy || null);
        evaluateLocation(coords);
        setIsDetecting(false);

        // Langsung tampilkan kedua titik jika map sudah siap
        setTimeout(() => {
          fitBothPoints(coords);
        }, 300);
      },
      (err) => {
        console.warn('GPS Error / Denied:', err.message);
        setIsDetecting(false);

        if (err.code === 1) {
          setGpsError('Izin akses lokasi ditolak oleh browser. Mohon klik ikon gembok/izin di address bar browser untuk mengizinkan akses lokasi.');
        } else if (err.code === 2) {
          setGpsError('Sinyal GPS perangkat tidak dapat diperoleh. Pastikan layanan lokasi pada perangkat Anda telah aktif.');
        } else if (err.code === 3) {
          setGpsError('Pencarian GPS timeout. Coba klik tombol "Kalibrasi GPS" kembali.');
        } else {
          setGpsError('Gagal mendeteksi lokasi GPS Anda.');
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      }
    );
  }, [evaluateLocation, fitBothPoints]);

  // Pantau lokasi secara berkala (watchPosition) jika diizinkan
  useEffect(() => {
    if (!navigator.geolocation) return;

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const coords: Coordinates = {
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
        };
        setGpsAccuracy(pos.coords.accuracy || null);
        setCurrentCoords(coords);
        const dist = calculateHaversineDistance(coords, officeCoords);
        const withinRadius = dist <= radiusMeters;
        onLocationVerified(coords, dist, withinRadius);
      },
      () => {},
      {
        enableHighAccuracy: true,
        maximumAge: 5000,
      }
    );

    return () => {
      navigator.geolocation.clearWatch(watchId);
    };
  }, [officeCoords.latitude, officeCoords.longitude, radiusMeters, onLocationVerified]);

  // Inisialisasi MapLibre GL
  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    try {
      const map = new maplibregl.Map({
        container: mapContainerRef.current,
        style: {
          version: 8,
          sources: {
            'esri-tiles': {
              type: 'raster',
              tiles: [
                'https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}',
              ],
              tileSize: 256,
              attribution:
                '&copy; <a href="https://www.esri.com" target="_blank" rel="noopener noreferrer">Esri</a>',
            },
          },
          layers: [
            {
              id: 'esri-layer',
              type: 'raster',
              source: 'esri-tiles',
              minzoom: 0,
              maxzoom: 19,
              paint: {
                // Shader styling minimalis modern: Mengubah warna kuning/oranye menjadi abu-abu pastel elegan
                'raster-saturation': -0.72,
                'raster-contrast': 0.08,
                'raster-brightness-min': 0.04,
              },
            },
          ],
        },
        center: [officeCoords.longitude, officeCoords.latitude],
        zoom: 16.5,
        pitch: 0,
        attributionControl: false,
        scrollZoom: true,
        doubleClickZoom: true,
        touchZoomRotate: true,
        dragPan: true,
      });

      map.on('load', () => {
        map.resize();

        // 1. Tambahkan GeoJSON polygon untuk batas radius geofence kantor (100m)
        const circleData = createGeoJSONCircle(
          [officeCoords.longitude, officeCoords.latitude],
          radiusMeters
        );

        map.addSource('geofence-circle', {
          type: 'geojson',
          data: circleData,
        });

        // Layer fill radius kantor
        map.addLayer({
          id: 'geofence-fill',
          type: 'fill',
          source: 'geofence-circle',
          paint: {
            'fill-color': '#10b981',
            'fill-opacity': 0.16,
          },
        });

        // Layer stroke border radius kantor
        map.addLayer({
          id: 'geofence-stroke',
          type: 'line',
          source: 'geofence-circle',
          paint: {
            'line-color': '#059669',
            'line-width': 2,
            'line-dasharray': [2, 2],
          },
        });

        // 2. Marker Kantor (Pin Biru Indigo Resmi)
        const officeEl = document.createElement('div');
        officeEl.className = 'flex flex-col items-center cursor-pointer group select-none';
        officeEl.innerHTML = `
          <div class="relative flex items-center justify-center">
            <div class="w-10 h-10 rounded-2xl bg-[#1E3A8A] text-white flex items-center justify-center shadow-xl border-2 border-white transform transition-transform group-hover:scale-110">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <path d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z"/>
                <path d="M6 12H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2"/>
                <path d="M18 9h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2"/>
                <path d="M10 6h4"/>
                <path d="M10 10h4"/>
                <path d="M10 14h4"/>
                <path d="M10 18h4"/>
              </svg>
            </div>
            <div class="absolute -bottom-1 w-3 h-1 bg-black/30 rounded-full blur-[1px]"></div>
          </div>
          <div class="mt-1 px-2.5 py-0.5 bg-[#1E3A8A] text-white text-[10px] font-extrabold rounded-md shadow-md whitespace-nowrap border border-white/20">
            ${officeConfig.name || 'IndigoSpace Malang (Kantor Pusat)'}
          </div>
        `;

        officeMarkerRef.current = new maplibregl.Marker({ element: officeEl })
          .setLngLat([officeCoords.longitude, officeCoords.latitude])
          .addTo(map);
      });

      mapInstanceRef.current = map;

      // Handle ResizeObserver so the map is never blank in modals/drawers
      const resizeObserver = new ResizeObserver(() => {
        map.resize();
      });
      if (mapContainerRef.current) {
        resizeObserver.observe(mapContainerRef.current);
      }

      return () => {
        resizeObserver.disconnect();
        map.remove();
        mapInstanceRef.current = null;
      };
    } catch (err) {
      console.error('MapLibre init error:', err);
    }
  }, [officeCoords.latitude, officeCoords.longitude, radiusMeters, officeConfig.name]);

  // Update Lingkaran Geofence & Marker saat isWithinRadius / radius berubah
  useEffect(() => {
    if (!mapInstanceRef.current) return;
    const map = mapInstanceRef.current;

    if (map.isStyleLoaded() && map.getSource('geofence-circle')) {
      const circleData = createGeoJSONCircle(
        [officeCoords.longitude, officeCoords.latitude],
        radiusMeters
      );
      (map.getSource('geofence-circle') as maplibregl.GeoJSONSource).setData(circleData);

      // Ubah warna fill & stroke sesuai status radius & mode kerja remote
      const fillColor = isRemote
        ? '#e0e7ff'
        : isWithinRadius
        ? '#10b981'
        : '#ef4444';
      const strokeColor = isRemote
        ? '#6366f1'
        : isWithinRadius
        ? '#059669'
        : '#dc2626';

      map.setPaintProperty('geofence-fill', 'fill-color', fillColor);
      map.setPaintProperty('geofence-stroke', 'line-color', strokeColor);
    }
  }, [isWithinRadius, radiusMeters, officeCoords.latitude, officeCoords.longitude, isRemote]);

  // Update Live User Marker saat koordinat GPS berubah
  useEffect(() => {
    if (!mapInstanceRef.current || !currentCoords) return;
    const map = mapInstanceRef.current;

    let userBadgeText = 'Posisi Anda (Saya)';
    let userColorClass = 'bg-emerald-600';
    let userPulseClass = 'bg-emerald-500/30';
    let userBorderClass = 'border-emerald-400';

    if (isWfh) {
      userBadgeText = 'Posisi Anda (Lokasi Rumah / WFH)';
      userColorClass = 'bg-indigo-600';
      userPulseClass = 'bg-indigo-500/30';
      userBorderClass = 'border-indigo-400';
    } else if (isDinas) {
      userBadgeText = 'Posisi Anda (Tugas Dinas Luar)';
      userColorClass = 'bg-purple-600';
      userPulseClass = 'bg-purple-500/30';
      userBorderClass = 'border-purple-400';
    } else if (isWithinRadius) {
      userBadgeText = 'Posisi Anda (Dalam Radius)';
      userColorClass = 'bg-emerald-600';
      userPulseClass = 'bg-emerald-500/30';
      userBorderClass = 'border-emerald-400';
    } else {
      userBadgeText = distance
        ? `Posisi Anda (${formatDistanceDisplay(distance)})`
        : 'Posisi Anda (Luar Radius)';
      userColorClass = 'bg-rose-600';
      userPulseClass = 'bg-rose-500/30';
      userBorderClass = 'border-rose-400';
    }

    if (!userMarkerRef.current) {
      const userEl = document.createElement('div');
      userEl.className = 'flex flex-col items-center cursor-pointer select-none group';
      userEl.innerHTML = `
        <div class="relative flex items-center justify-center">
          <div class="w-10 h-10 rounded-full ${userPulseClass} animate-ping absolute"></div>
          <div class="w-9 h-9 rounded-2xl ${userColorClass} text-white flex items-center justify-center shadow-xl border-2 border-white relative z-10 transform transition-transform group-hover:scale-110">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <polygon points="3 11 22 2 13 21 11 13 3 11"/>
            </svg>
          </div>
          <div class="absolute -bottom-1 w-3 h-1 bg-black/30 rounded-full blur-[1px]"></div>
        </div>
        <div class="mt-1 px-2.5 py-0.5 ${userColorClass} text-white text-[10px] font-extrabold rounded-md shadow-lg whitespace-nowrap border border-white/30">
          ${userBadgeText}
        </div>
      `;

      userMarkerRef.current = new maplibregl.Marker({ element: userEl })
        .setLngLat([currentCoords.longitude, currentCoords.latitude])
        .addTo(map);
    } else {
      userMarkerRef.current.setLngLat([currentCoords.longitude, currentCoords.latitude]);
      const el = userMarkerRef.current.getElement();
      if (el) {
        el.innerHTML = `
          <div class="relative flex items-center justify-center">
            <div class="w-10 h-10 rounded-full ${userPulseClass} animate-ping absolute"></div>
            <div class="w-9 h-9 rounded-2xl ${userColorClass} text-white flex items-center justify-center shadow-xl border-2 border-white relative z-10 transform transition-transform group-hover:scale-110">
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <polygon points="3 11 22 2 13 21 11 13 3 11"/>
              </svg>
            </div>
            <div class="absolute -bottom-1 w-3 h-1 bg-black/30 rounded-full blur-[1px]"></div>
          </div>
          <div class="mt-1 px-2.5 py-0.5 ${userColorClass} text-white text-[10px] font-extrabold rounded-md shadow-lg whitespace-nowrap border border-white/30">
            ${userBadgeText}
          </div>
        `;
      }
    }
  }, [currentCoords, isWithinRadius, distance, isWfh, isDinas]);

  // Deteksi GPS pertama kali saat komponen dimuat
  useEffect(() => {
    detectLiveGPS();
    const timeouts = [
      setTimeout(() => mapInstanceRef.current?.resize(), 50),
      setTimeout(() => mapInstanceRef.current?.resize(), 200),
      setTimeout(() => mapInstanceRef.current?.resize(), 450),
      setTimeout(() => mapInstanceRef.current?.resize(), 800),
    ];
    return () => {
      timeouts.forEach((t) => clearTimeout(t));
    };
  }, [detectLiveGPS]);

  return (
    <div className="bg-white rounded-[28px] border border-slate-200/90 shadow-xs overflow-hidden flex flex-col h-full flex-1 relative font-sans">
      
      {/* Top Header Bar over the Map */}
      <div className="px-6 py-4 bg-white border-b border-slate-100 flex items-center justify-between z-20 shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-blue-50 border border-blue-100 text-[#1E3A8A] flex items-center justify-center shrink-0">
            <Compass className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900 tracking-tight leading-tight">
              Status Geofence Radar
            </h2>
            <p className="text-[11px] text-slate-500 font-medium">
              Pendeteksian posisi GPS real-time
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={detectLiveGPS}
            disabled={isDetecting}
            className={`p-2 rounded-xl border transition-all cursor-pointer flex items-center justify-center ${
              isDetecting
                ? 'bg-blue-50 text-[#1E3A8A] border-blue-200 shadow-2xs'
                : 'text-slate-600 hover:text-[#1E3A8A] hover:bg-slate-100 border-slate-200'
            }`}
            title={isDetecting ? 'Sedang Mengalibrasi GPS...' : 'Kalibrasi / Segarkan Posisi GPS'}
          >
            <RefreshCw className={`w-4 h-4 transition-transform ${isDetecting ? 'animate-spin text-[#1E3A8A]' : ''}`} />
          </button>
        </div>
      </div>

      {/* GPS Error Notification jika izin lokasi diblokir browser */}
      {gpsError && (
        <div className="px-4 py-2.5 bg-amber-50 border-b border-amber-200 text-amber-900 text-xs flex items-center justify-between gap-2 z-20 shrink-0 animate-fadeIn">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
            <span className="leading-snug">{gpsError}</span>
          </div>
          <button
            type="button"
            onClick={detectLiveGPS}
            className="px-2.5 py-1 bg-amber-600 text-white rounded-lg font-bold text-[11px] shrink-0 hover:bg-amber-700 transition-colors"
          >
            Coba Lagi
          </button>
        </div>
      )}

      {/* MAP CONTAINER (Mengisi 100% sisa tinggi Card Tanpa Space Kosong) */}
      <div className="relative w-full flex-1 min-h-[360px] bg-[#eef2f6] overflow-hidden select-none">
        
        {/* PROMINENT BADGE DI ATAS PETA */}
        <div className="absolute top-3.5 left-1/2 -translate-x-1/2 z-20 pointer-events-none max-w-[calc(100%-2rem)] px-1">
          {currentCoords ? (
            isWfh ? (
              <div className="px-4 py-2 rounded-full bg-indigo-600/95 text-white text-xs font-bold flex items-center justify-center gap-2 shadow-lg backdrop-blur-xs border border-indigo-400/50 truncate">
                <Home className="w-4 h-4 text-indigo-200 shrink-0" />
                <span className="truncate">Mode WFH Aktif • Presensi Fleksibel dari Rumah Diizinkan</span>
              </div>
            ) : isDinas ? (
              <div className="px-4 py-2 rounded-full bg-purple-600/95 text-white text-xs font-bold flex items-center justify-center gap-2 shadow-lg backdrop-blur-xs border border-purple-400/50 truncate">
                <Briefcase className="w-4 h-4 text-purple-200 shrink-0" />
                <span className="truncate">Mode Dinas Luar Aktif • Presensi Fleksibel Diizinkan</span>
              </div>
            ) : isWithinRadius ? (
              <div className="px-4 py-2 rounded-full bg-emerald-600/95 text-white text-xs font-bold flex items-center justify-center gap-2 shadow-lg backdrop-blur-xs border border-emerald-400/50 truncate">
                <CheckCircle2 className="w-4 h-4 text-emerald-200 shrink-0" />
                <span className="truncate">Di Dalam Radius Kantor ({radiusMeters}m)</span>
              </div>
            ) : (
              <div className="px-4 py-2 rounded-full bg-rose-600/95 text-white text-xs font-bold flex items-center justify-center gap-2 shadow-lg backdrop-blur-xs border border-rose-400/50 truncate">
                <AlertTriangle className="w-4 h-4 text-rose-200 shrink-0" />
                <span className="truncate">Di Luar Radius Kantor ({distance ? formatDistanceDisplay(distance) : '>100m'})</span>
              </div>
            )
          ) : (
            <div className="px-4 py-2 rounded-full bg-slate-800/90 text-white text-xs font-semibold flex items-center justify-center gap-2 shadow-lg backdrop-blur-xs border border-slate-700/50">
              <RefreshCw className="w-3.5 h-3.5 text-blue-400 animate-spin shrink-0" />
              <span>Mencari koordinat GPS Anda...</span>
            </div>
          )}
        </div>

        {/* Quick Nav Controls (Floating Buttons di Kanan Atas Peta) */}
        <div className="absolute top-3.5 right-3.5 z-20 flex flex-col gap-1.5">
          <button
            type="button"
            onClick={centerToUser}
            disabled={!currentCoords}
            className="w-9 h-9 rounded-xl bg-white/95 backdrop-blur-sm border border-slate-200 shadow-md text-slate-700 hover:text-[#1E3A8A] hover:bg-white flex items-center justify-center transition-all cursor-pointer disabled:opacity-40 disabled:pointer-events-none"
            title="Pusatkan ke Posisi Saya"
          >
            <Navigation className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={centerToOffice}
            className="w-9 h-9 rounded-xl bg-white/95 backdrop-blur-sm border border-slate-200 shadow-md text-slate-700 hover:text-[#1E3A8A] hover:bg-white flex items-center justify-center transition-all cursor-pointer"
            title="Pusatkan ke Titik Kantor"
          >
            <Building2 className="w-4 h-4" />
          </button>
          {currentCoords && (
            <button
              type="button"
              onClick={() => fitBothPoints(currentCoords)}
              className="w-9 h-9 rounded-xl bg-white/95 backdrop-blur-sm border border-slate-200 shadow-md text-slate-700 hover:text-[#1E3A8A] hover:bg-white flex items-center justify-center transition-all cursor-pointer"
              title="Tampilkan Kantor & Posisi Saya Sekaligus"
            >
              <Maximize2 className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* MapLibre DOM Node */}
        <div
          ref={mapContainerRef}
          className="absolute inset-0 w-full h-full"
          style={{ width: '100%', height: '100%' }}
        />

        {/* FLOATING CARD AT BOTTOM (Informasi Kantor & Jarak Akurat) */}
        <div
          role="button"
          tabIndex={0}
          onClick={centerToOffice}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              centerToOffice();
            }
          }}
          className="absolute left-3 right-3 bottom-3 z-20 bg-white/95 backdrop-blur-md rounded-2xl border border-slate-200/90 shadow-xl p-3.5 sm:p-4 cursor-pointer hover:bg-white hover:border-[#1E3A8A]/50 hover:shadow-2xl transition-all group select-none"
          title="Klik untuk memusatkan kembali peta ke titik kantor"
        >
          <div className="flex items-center gap-3">
            {/* Logo / Ikon Kantor */}
            <div className="relative shrink-0">
              <div className="w-12 h-12 rounded-xl bg-blue-50 border border-blue-200 text-[#1E3A8A] shadow-2xs flex items-center justify-center group-hover:scale-105 transition-transform overflow-hidden">
                <Building2 className="w-6 h-6" />
              </div>
            </div>

            {/* Nama & Alamat Lengkap */}
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2">
                <h4 className="font-extrabold text-xs sm:text-sm text-slate-900 truncate group-hover:text-[#1E3A8A] transition-colors">
                  {officeConfig.name || 'IndigoSpace Malang (Kantor Pusat)'}
                </h4>
                {distance !== null && (
                  <span className={`text-[11px] font-extrabold px-2.5 py-0.5 rounded-md shrink-0 ${
                    isWfh
                      ? 'bg-indigo-100 text-indigo-800 border border-indigo-200'
                      : isDinas
                      ? 'bg-purple-100 text-purple-800 border border-purple-200'
                      : isWithinRadius
                      ? 'bg-emerald-100 text-emerald-800'
                      : 'bg-rose-100 text-rose-800'
                  }`}>
                    {isWfh
                      ? `WFH Bebas Radius (${formatDistanceDisplay(distance)})`
                      : isDinas
                      ? `Dinas Bebas Radius (${formatDistanceDisplay(distance)})`
                      : formatDistanceDisplay(distance)}
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-500 line-clamp-1 mt-0.5 leading-snug">
                {officeConfig.address || 'Jl. Simpang Borobudur No. 1, Mojolangu, Kec. Lowokwaru, Kota Malang, Jawa Timur 65142'}
              </p>
            </div>
          </div>
        </div>

      </div>

    </div>
  );
}
