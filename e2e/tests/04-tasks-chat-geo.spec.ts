import { test, expect } from '@playwright/test';
import { resetAndSeed, loginAs, logout, goTo, SUPER, ADMIN, EMP } from './helpers';

test.describe.configure({ mode: 'serial' });

test('C1. Admin menerbitkan tugas baru untuk karyawan -> Karyawan melihat di Tugas Saya', async ({ page }) => {
  await resetAndSeed(page);

  // --- 1. Admin membuat tugas untuk Alissa ---
  await loginAs(page, ADMIN);
  await goTo(page, /Tugas Tim|Memberikan Tugas Tim/);
  await page.getByRole('button', { name: /Tambah Tugas Baru/ }).first().click();

  await page.getByPlaceholder(/Evaluasi Keamanan Webhook/).fill('Integrasi Schema API Backend');
  await page.getByPlaceholder(/Kriteria, spesifikasi teknis/).fill('Rancang DTO dan relasi database PostgreSQL');
  
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 3);
  const p = (n: number) => String(n).padStart(2, '0');
  const dueStr = `${tomorrow.getFullYear()}-${p(tomorrow.getMonth() + 1)}-${p(tomorrow.getDate())}`;
  await page.locator('input[type="date"]').last().fill(dueStr);

  // Pilih Alissa sebagai assignee
  await page.getByText(EMP.name).last().click();
  await page.getByRole('button', { name: 'Terbitkan Tugas' }).click();

  await expect(page.getByText('Integrasi Schema API Backend').first()).toBeVisible({ timeout: 10_000 });
  await page.screenshot({ path: 'results/C1-admin-task-created.png' });
  await logout(page);

  // --- 2. Karyawan memeriksa Tugas Saya ---
  await loginAs(page, EMP);
  await goTo(page, 'Tugas Saya');
  await expect(page.getByText('Integrasi Schema API Backend').first()).toBeVisible({ timeout: 10_000 });
  await page.screenshot({ path: 'results/C1-karyawan-my-task.png' });
});

test('C2. Karyawan membuat topik diskusi -> Admin membalas pesan di topik', async ({ page }) => {
  await resetAndSeed(page);

  // --- 1. Karyawan membuat topik diskusi ---
  await loginAs(page, EMP);
  await goTo(page, 'Ruang Obrolan');
  await page.getByRole('button', { name: /Buat Topik Baru/ }).first().click();

  await page.getByPlaceholder(/Permintaan kunjungan Radar Malang/).fill('Rapat Koordinasi Migrasi Database');
  // Tag semua anggota
  await page.getByRole('button', { name: 'Pilih Semua' }).click();
  await page.getByPlaceholder(/Ringkasan konteks diskusi/).fill('Mohon masukan terkait skema user dan auth token');
  await page.getByRole('button', { name: 'Buat Topik Obrolan' }).click();

  await expect(page.getByText('Rapat Koordinasi Migrasi Database').first()).toBeVisible({ timeout: 10_000 });
  await page.screenshot({ path: 'results/C2-karyawan-topic-created.png' });
  await logout(page);

  // --- 2. Admin membuka topik dan mengirim balasan ---
  await loginAs(page, ADMIN);
  await goTo(page, 'Ruang Obrolan');
  await page.getByText('Rapat Koordinasi Migrasi Database').first().click();
  await page.waitForTimeout(600);

  const commentInput = page.getByPlaceholder(/Ketik pesan atau mention/);
  await commentInput.fill('Siap, saya setuju pakai PostgreSQL + Prisma/Drizzle.');
  // Klik tombol kirim komentar (ArrowUp bulat)
  await page.getByTitle('Kirim pesan').click();

  await expect(page.getByText('Siap, saya setuju pakai PostgreSQL + Prisma/Drizzle.').first()).toBeVisible({ timeout: 10_000 });
  await page.screenshot({ path: 'results/C2-admin-reply-sent.png' });
});

test('C3. Super Admin mengatur konfigurasi Geofence & Jam Kantor', async ({ page }) => {
  await resetAndSeed(page);

  await loginAs(page, SUPER);
  await goTo(page, 'Lokasi & Geofence');
  await expect(page.getByText('Pengaturan Kantor & Geofence').first()).toBeVisible({ timeout: 10_000 });

  // Ubah radius atau nama kantor lalu simpan
  await page.screenshot({ path: 'results/C3-superadmin-geofence-modal.png' });
  await page.getByRole('button', { name: 'Simpan Perubahan' }).click();
  await page.waitForTimeout(600);
});
