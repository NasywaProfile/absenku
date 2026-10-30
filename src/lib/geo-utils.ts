/**
 * Geo-Utilities for Office Geofencing & Distance Validation
 * Menggunakan Formula Haversine untuk menghitung jarak lingkaran besar (great-circle distance)
 * antara dua titik koordinat pada permukaan bola bumi.
 */

// Konstanta radius bumi rata-rata dalam meter (WGS-84 sphere approximation)
const EARTH_RADIUS_METERS = 6371000;

/**
 * Konversi derajat sudut menjadi radian
 */
function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

export interface Coordinates {
  latitude: number;
  longitude: number;
}

/**
 * Menghitung jarak lurus (orthodromic distance) dalam satuan METER antara dua koordinat GPS
 * menggunakan Haversine Formula:
 * 
 * a = sin²(Δlat/2) + cos(lat1) * cos(lat2) * sin²(Δlon/2)
 * c = 2 * atan2(√a, √(1−a))
 * d = R * c
 * 
 * @param origin Titik koordinat awal (misal: GPS perangkat karyawan)
 * @param destination Titik koordinat tujuan (misal: Titik pusat kantor)
 * @returns Jarak dalam meter (dibulatkan ke bilangan bulat terdekat)
 */
export function calculateHaversineDistance(
  origin: Coordinates,
  destination: Coordinates
): number {
  // 1. Hitung selisih lintang dan bujur dalam bentuk radian
  const deltaLat = toRadians(destination.latitude - origin.latitude);
  const deltaLon = toRadians(destination.longitude - origin.longitude);

  const lat1Rad = toRadians(origin.latitude);
  const lat2Rad = toRadians(destination.latitude);

  // 2. Terapkan rumus kuadrat setengah tali busur (haversine)
  const a =
    Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
    Math.cos(lat1Rad) *
      Math.cos(lat2Rad) *
      Math.sin(deltaLon / 2) *
      Math.sin(deltaLon / 2);

  // 3. Hitung jarak sudut dalam radian
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  // 4. Kalikan dengan radius bumi untuk mendapatkan jarak dalam meter
  const distanceInMeters = EARTH_RADIUS_METERS * c;

  return Math.round(distanceInMeters);
}

/**
 * Validasi apakah posisi pengguna berada di dalam batas radius (Geofence) kantor
 * @param userCoords Koordinat pengguna saat ini
 * @param officeCoords Koordinat pusat kantor
 * @param maxRadiusMeters Batas radius toleransi maksimal (contoh: 100 meter)
 */
export function checkIsWithinOfficeRadius(
  userCoords: Coordinates,
  officeCoords: Coordinates,
  maxRadiusMeters: number,
  isGeofenceActive: boolean = true
): {
  isWithinRadius: boolean;
  distanceMeter: number;
  radiusLimit: number;
  isGeofenceActive: boolean;
} {
  const distanceMeter = calculateHaversineDistance(userCoords, officeCoords);
  return {
    isWithinRadius: isGeofenceActive ? distanceMeter <= maxRadiusMeters : true,
    distanceMeter,
    radiusLimit: maxRadiusMeters,
    isGeofenceActive,
  };
}

/**
 * Format jarak agar ramah pengguna (contoh: '45 m' atau '1.2 km')
 */
export function formatDistanceDisplay(meters: number): string {
  if (meters < 1000) {
    return `${meters} m`;
  }
  return `${(meters / 1000).toFixed(2)} km`;
}
