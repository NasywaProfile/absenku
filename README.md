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
Pastikan Apache & MySQL aktif di **XAMPP Control Panel**.
```bash
cd ../absenku-backend

# Jalankan migrasi dan seeder database
php artisan migrate:fresh --seed

# Jalankan server API backend (port 8000)
php artisan serve --port=8000
```

---

## 🔐 Akun Pengujian Default

| Peran | Email | Kata Sandi |
| :--- | :--- | :--- |
| **Super Admin** | `superadmin@gmail.com` | `SuperAdminabsenkuMantap` |
| **Admin** | `budi.admin@gmail.com` | `AdminBudi123` |
| **Karyawan** | `alissa.karyawan@gmail.com` | `Karyawan123` |
