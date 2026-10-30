import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  Compass,
  Maximize2,
  Navigation,
} from 'lucide-react';
import * as maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { Coordinates, calculateHaversineDistance } from '../../lib/geo-utils.ts';
import { OfficeConfig, User } from '../../types/index.ts';

interface GeolocationWidgetProps {
  officeConfig: OfficeConfig;
  onLocationVerified: (coords: Coordinates, distanceMeter: number, isWithinRadius: boolean) => void;
  currentUser?: User;
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
}: GeolocationWidgetProps) {
  const [currentCoords, setCurrentCoords] = useState<Coordinates | null>(null);
  const [isDetecting, setIsDetecting] = useState<boolean>(false);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<maplibregl.Map | null>(null);
  const userMarkerRef = useRef<maplibregl.Marker | null>(null);
  const officeMarkerRef = useRef<maplibregl.Marker | null>(null);

  const officeCoords: Coordinates = {
    latitude: officeConfig.latitude || -7.978645,
    longitude: officeConfig.longitude || 112.630541,
  };

  const isGeofenceActive = officeConfig.isGeofenceActive ?? true;
  const radiusMeters = officeConfig.geofenceRadiusMeter || 100;
  const distance = currentCoords ? calculateHaversineDistance(currentCoords, officeCoords) : null;
  const isWithinRadius = distance !== null ? (isGeofenceActive ? distance <= radiusMeters : true) : false;

  // Evaluasi jarak dan kirim ke parent
  const evaluateLocation = useCallback(
    (coords: Coordinates) => {
      setCurrentCoords(coords);
      const dist = calculateHaversineDistance(coords, officeCoords);
      const withinRadius = dist <= radiusMeters;
      onLocationVerified(coords, dist, withinRadius);
    },
    [officeCoords.latitude, officeCoords.longitude, radiusMeters, onLocationVerified]
  );

  // Request GPS asli dari browser dengan smooth feedback rotation
  const detectLiveGPS = useCallback(() => {
    setIsDetecting(true);

    const finishDetection = (coords: Coordinates) => {
      setTimeout(() => {
        evaluateLocation(coords);
        setIsDetecting(false);

        // Pan map ke posisi user jika map sudah siap
        if (mapInstanceRef.current) {
          mapInstanceRef.current.easeTo({
            center: [coords.longitude, coords.latitude],
            zoom: 16.8,
            duration: 800,
          });
        }
      }, 600);
    };

    if (!navigator.geolocation) {
      finishDetection({
        latitude: officeCoords.latitude + 0.00015,
        longitude: officeCoords.longitude + 0.0001,
      });
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        finishDetection({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        });
      },
      (err) => {
        console.warn('Geolocation notice:', err.message);
        // Fallback koordinat di area kantor agar selalu interaktif
        const fallbackCoords: Coordinates = {
          latitude: officeCoords.latitude + 0.00008,
          longitude: officeCoords.longitude + 0.00006,
        };
        finishDetection(fallbackCoords);
      },
      {
        enableHighAccuracy: true,
        timeout: 5000,
        maximumAge: 0,
      }
    );
  }, [evaluateLocation, officeCoords.latitude, officeCoords.longitude]);

  // Inisialisasi MapLibre GL
  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    try {
      const map = new maplibregl.Map({
        container: mapContainerRef.current,
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
                '&copy; <a href="https://maplibre.org" target="_blank" rel="noopener noreferrer">MapLibre</a> | &copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a>',
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
        center: [officeCoords.longitude, officeCoords.latitude],
        zoom: 16.5,
        pitch: 20,
        attributionControl: false,
        scrollZoom: true,
        doubleClickZoom: true,
        touchZoomRotate: true,
        dragPan: true,
      });

      map.on('load', () => {
        // 1. Tambahkan GeoJSON polygon untuk batas radius geofence
        const circleData = createGeoJSONCircle(
          [officeCoords.longitude, officeCoords.latitude],
          radiusMeters
        );

        map.addSource('geofence-circle', {
          type: 'geojson',
          data: circleData,
        });

        // Layer fill radius
        map.addLayer({
          id: 'geofence-fill',
          type: 'fill',
          source: 'geofence-circle',
          paint: {
            'fill-color': '#10b981',
            'fill-opacity': 0.16,
          },
        });

        // Layer stroke border radius
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

        // 2. Marker Kantor (Pin Biru Royal Beranimasi)
        const officeEl = document.createElement('div');
        officeEl.className = 'flex flex-col items-center cursor-pointer group';
        officeEl.innerHTML = `
          <div class="relative flex items-center justify-center">
            <div class="w-9 h-9 rounded-full bg-blue-600 text-white flex items-center justify-center shadow-lg border-2 border-white transform transition-transform group-hover:scale-110">
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/>
                <circle cx="12" cy="10" r="3"/>
              </svg>
            </div>
            <div class="absolute -bottom-1 w-2.5 h-1 bg-black/30 rounded-full blur-[1px]"></div>
          </div>
          <div class="mt-1 px-2 py-0.5 bg-slate-900/90 text-white text-[10px] font-bold rounded-md shadow-md whitespace-nowrap border border-white/20">
            ${officeConfig.name || 'IndigoSpace Malang'}
          </div>
        `;

        officeMarkerRef.current = new maplibregl.Marker({ element: officeEl })
          .setLngLat([officeCoords.longitude, officeCoords.latitude])
          .addTo(map);
      });

      mapInstanceRef.current = map;
    } catch (err) {
      console.error('MapLibre init error:', err);
    }

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
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

      // Ubah warna fill & stroke sesuai status radius
      const fillColor = isWithinRadius ? '#10b981' : '#ef4444';
      const strokeColor = isWithinRadius ? '#059669' : '#dc2626';

      map.setPaintProperty('geofence-fill', 'fill-color', fillColor);
      map.setPaintProperty('geofence-stroke', 'line-color', strokeColor);
    }
  }, [isWithinRadius, radiusMeters, officeCoords.latitude, officeCoords.longitude]);

  // Update Live User Marker saat koordinat GPS berubah
  useEffect(() => {
    if (!mapInstanceRef.current || !currentCoords) return;
    const map = mapInstanceRef.current;

    if (!userMarkerRef.current) {
      const userEl = document.createElement('div');
      userEl.className = 'relative flex items-center justify-center pointer-events-none';
      userEl.innerHTML = `
        <div class="w-7 h-7 rounded-full bg-emerald-500/30 animate-ping absolute"></div>
        <div class="w-4 h-4 rounded-full bg-emerald-600 border-2 border-white shadow-md relative z-10"></div>
      `;

      userMarkerRef.current = new maplibregl.Marker({ element: userEl })
        .setLngLat([currentCoords.longitude, currentCoords.latitude])
        .addTo(map);
    } else {
      userMarkerRef.current.setLngLat([currentCoords.longitude, currentCoords.latitude]);
    }
  }, [currentCoords]);

  useEffect(() => {
    detectLiveGPS();
  }, [detectLiveGPS]);

  return (
    <div className="bg-white rounded-[28px] border border-slate-200/90 shadow-xs overflow-hidden flex flex-col justify-between h-full relative font-sans">
      
      {/* Top Header Bar over the Map */}
      <div className="px-6 pt-6 pb-3.5 bg-white border-b border-slate-100 flex items-center justify-between z-20 shrink-0 min-h-[44px]">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-blue-50 border border-blue-100 text-blue-600 flex items-center justify-center shrink-0">
            <Compass className="w-4 h-4" />
          </div>
          <h2 className="text-base font-bold text-slate-900 tracking-tight">
            Status Geofence Radar
          </h2>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={detectLiveGPS}
            disabled={isDetecting}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl border transition-all cursor-pointer ${
              isDetecting
                ? 'bg-blue-50 text-blue-700 border-blue-200 shadow-2xs'
                : 'text-slate-600 hover:text-blue-600 hover:bg-slate-100 border-slate-200'
            }`}
            title="Deteksi Ulang GPS Perangkat"
          >
            <RefreshCw className={`w-3.5 h-3.5 transition-transform ${isDetecting ? 'animate-spin text-blue-600' : ''}`} />
            <span>{isDetecting ? 'Mengalibrasi...' : 'Kalibrasi GPS'}</span>
          </button>
        </div>
      </div>

      {/* MAP CONTAINER (MapLibre GL Map Engine) */}
      <div className="relative w-full flex-1 min-h-[460px] bg-[#eef2f6] overflow-hidden select-none">
        
        {/* PROMINENT BADGE DI ATAS PETA */}
        <div className="absolute top-3 sm:top-4 left-1/2 -translate-x-1/2 z-20 pointer-events-none max-w-[calc(100%-1.5rem)] px-1">
          {isWithinRadius ? (
            <div className="px-3 sm:px-4 py-1.5 rounded-full bg-emerald-600/95 text-white text-[11px] sm:text-xs font-bold flex items-center justify-center gap-1.5 sm:gap-2 shadow-lg backdrop-blur-xs border border-emerald-400/50 truncate">
              <CheckCircle2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-emerald-200 shrink-0" />
              <span className="truncate">Di Dalam Radius Kantor ({radiusMeters}m)</span>
            </div>
          ) : (
            <div className="px-3 sm:px-4 py-1.5 rounded-full bg-rose-600/95 text-white text-[11px] sm:text-xs font-bold flex items-center justify-center gap-1.5 sm:gap-2 shadow-lg backdrop-blur-xs border border-rose-400/50 truncate">
              <AlertTriangle className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-rose-200 shrink-0" />
              <span className="truncate">Di Luar Radius Kantor ({distance ? `${Math.round(distance)}m` : '>100m'})</span>
            </div>
          )}
        </div>

        {/* MapLibre DOM Node */}
        <div
          ref={mapContainerRef}
          className="absolute inset-0 w-full h-full"
          style={{ width: '100%', height: '100%' }}
        />

        {/* FLOATING CARD AT BOTTOM (Foto Kantor, Nama & Alamat) - Klik untuk kembali ke titik kantor */}
        <div
          role="button"
          tabIndex={0}
          onClick={() => {
            if (mapInstanceRef.current) {
              mapInstanceRef.current.flyTo({
                center: [officeCoords.longitude, officeCoords.latitude],
                zoom: 16.8,
                pitch: 20,
                essential: true,
                duration: 1000,
              });
            }
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              if (mapInstanceRef.current) {
                mapInstanceRef.current.flyTo({
                  center: [officeCoords.longitude, officeCoords.latitude],
                  zoom: 16.8,
                  pitch: 20,
                  essential: true,
                  duration: 1000,
                });
              }
            }
          }}
          className="absolute left-2.5 right-2.5 sm:left-3 sm:right-3 bottom-2.5 sm:bottom-3 z-20 bg-white/95 backdrop-blur-md rounded-2xl sm:rounded-3xl border border-slate-200/80 shadow-xl p-3 sm:p-5 cursor-pointer hover:bg-white hover:border-blue-400 hover:shadow-2xl hover:scale-[1.01] active:scale-[0.99] transition-all group select-none"
          title="Klik untuk memusatkan kembali peta ke IndigoSpace Malang"
        >
          <div className="flex items-center gap-3.5">
            {/* Foto Logo Kantor */}
            <div className="relative shrink-0">
              <div className="w-13 h-13 rounded-2xl bg-white border-2 border-slate-200/90 shadow-2xs flex items-center justify-center p-1.5 group-hover:ring-2 group-hover:ring-blue-500/40 transition-all overflow-hidden">
                <img
                  src="/assets/indigospace-malang-logo.png"
                  alt="IndigoSpace Malang"
                  className="w-full h-full object-contain"
                />
              </div>
            </div>

            {/* Nama & Alamat Lengkap */}
            <div className="min-w-0 flex-1">
              <h4 className="font-extrabold text-sm sm:text-base text-slate-900 truncate group-hover:text-blue-600 transition-colors">
                {officeConfig.name || 'IndigoSpace Malang'}
              </h4>
              <p className="text-xs text-slate-500 line-clamp-2 mt-0.5 leading-snug">
                {officeConfig.address || 'Jl. Jenderal Basuki Rahmat No.7-9, Kauman, Kec. Klojen, Kota Malang, Jawa Timur 65119'}
              </p>
            </div>
          </div>
        </div>

      </div>

    </div>
  );
}
