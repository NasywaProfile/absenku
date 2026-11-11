# Absenku — Sistem Presensi & Manajemen Kerja Modern

Aplikasi web presensi modern, manajemen izin/cuti, pemantauan logbook tugas harian, papan Kanban kolaboratif, dan ruang diskusi tim untuk **Indiekraf**.

---

## 🚀 Fitur Utama

- **Presensi Akurat & Geofence GPS:**
  - Presensi masuk dengan deteksi radius kantor (IndigoSpace Malang & multi-kantor) menggunakan rumus Haversine.
  - Perhitungan otomatis tepat waktu vs keterlambatan (menit late) dengan jam masuk fleksibel & grace period.
  - Dukungan mode kerja WFO, WFH (dengan izin tervalidasi), dan Dinas Luar.
  - Format rekap otomatis siap kirim ke grup WhatsApp tim.
- **Hierarki Peran Terintegrasi (RBAC):**
  - **Super Admin:** Konfigurasi geofence kantor, persetujuan pendaftaran akun baru, kelola divisi, dan promosi admin.
  - **Admin:** Verifikasi izin & cuti tim, kelola presensi karyawan, delegasi tugas Kanban.
  - **Karyawan:** Presensi harian, pengisian logbook tugas, pengajuan cuti/izin berlampiran, dan ruang diskusi.
- **Manajemen Cuti & Izin Terpadu:**
  - Kategori Izin/Cuti, Sakit, WFH, dan Dinas Luar.
  - Dukungan lampiran dokumen & surat dokter (optimasi penyimpanan otomatis via IndexedDB / Storage).
  - Alur persetujuan & penolakan dengan catatan alasan dari Admin.
- **Papan Kanban & Logbook Harian:**
  - Pelacakan progres tugas tim secara real-time.
- **Ruang Diskusi Tim (Chat Room):**
  - Topik diskusi terstruktur dengan tagging rekan tim, lampiran berkas, tautan, dan balasan pesan.
- **Backend Ready:**
  - REST API terhubung dengan Laravel 11 & MySQL (phpMyAdmin via XAMPP) serta fallback offline-first.

---

## 🗄️ Struktur Database MySQL (`absenku_db` via phpMyAdmin)

Tabel pada database dirancang dengan istilah baku Bahasa Indonesia untuk keperluan dokumentasi akademik dan Tugas Akhir (TA):

| No | Nama Tabel | Deskripsi Fungsi |
| :---: | :--- | :--- |
| 1 | `pengguna` | Menyimpan data akun, otentikasi, profil diri, peran, dan payroll karyawan |
| 2 | `konfigurasi_kantor` | Pengaturan titik koordinat GPS kantor, radius geofence, dan jam kerja |
| 3 | `presensi` | Log presensi masuk harian karyawan, deteksi GPS, dan status keterlambatan |
| 4 | `pengajuan_izin` | Permohonan izin, cuti tahunan, sakit, dinas, dan status persetujuan |
| 5 | `logbook_harian` | Laporan rekapan tugas harian dan akuntabilitas kerja karyawan |
| 6 | `tugas_proyek` | Manajemen kartu tugas tim pada papan Kanban kolaboratif |
| 7 | `topik_diskusi` | Ruang diskusi topik kerja tim, berkas materi, dan catatan proyek |
| 8 | `pesan_diskusi` | Percakapan dan balasan interaktif di dalam topik atau kanal umum |
| 9 | `personal_access_tokens` | Manajemen token keamanan REST API resmi via Laravel Sanctum |

---

## 🛠️ Teknologi yang Digunakan

- **Frontend:** React 19, TypeScript, Vite, Tailwind CSS v4, Lucide React, Radix UI.
- **Backend API:** Laravel 11, Laravel Sanctum, PHP 8.4, MySQL / phpMyAdmin.
- **Pengujian & Verifikasi:** Playwright E2E Browser Testing & TSX System Verification.

---

## 💻 Menjalankan Proyek Secara Lokal

### 1. Frontend (React + Vite)
```bash
# Instal dependensi
npm install

# Jalankan server pengembangan (port 3000)
npm run dev

# Jalankan pengujian unit (78 skenario)
npm test

# Jalankan pengujian E2E browser Playwright (13 skenario)
cd e2e
npx playwright test
```

### 2. Backend (Laravel 11 + MySQL)
Pastikan Apache & MySQL aktif di **XAMPP Control Panel** (atau layanan MySQL di server).
```bash
cd ../absenku-backend

# Jalankan migrasi tabel (TANPA migrate:fresh di produksi!)
php artisan migrate

# Atur akun Super Admin awal melalui .env (SEED_SUPER_ADMIN_EMAIL & SEED_SUPER_ADMIN_PASSWORD) atau command berikut:
php artisan absenku:set-superadmin

# Jalankan server API backend (port 8000)
php artisan serve --port=8000
```

---

## 🔒 Keamanan & Deployment Produksi

- **Jangan gunakan akun/password default** di repositori publik. Gunakan `php artisan absenku:set-superadmin` di server untuk menetapkan email & kata sandi kuat khusus pemilik sistem.
- **Jangan pernah menjalankan `php artisan migrate:fresh`** di server produksi (otomatis diblokir saat `APP_ENV=production`).
- **Aktifkan HTTPS** serta setel `APP_ENV=production`, `APP_DEBUG=false`, `APP_FORCE_HTTPS=true`, `SESSION_SECURE_COOKIE=true`, dan `CORS_ALLOWED_ORIGINS=https://domain-anda` pada `.env` backend.
- **Aktifkan backup database otomatis** dengan `php artisan db:backup` dan Laravel scheduler cron (`* * * * * php artisan schedule:run`).
