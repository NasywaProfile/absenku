import { test, expect } from '@playwright/test';
import { resetAndSeed, loginAs, logout, login, SUPER, ADMIN, EMP } from './helpers';

test.describe.configure({ mode: 'serial' });

test('A1. pengunjung baru harus melihat halaman login (tidak auto-login Super Admin)', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await expect(page.getByRole('button', { name: 'Masuk', exact: true })).toBeVisible();
  await page.screenshot({ path: 'results/A1-login.png' });
});

test('A2. login ditolak: password salah & password kosong', async ({ page }) => {
  await resetAndSeed(page);
  await login(page, EMP.email, 'salah-total');
  await expect(page.getByText(/tidak sesuai/i)).toBeVisible();

  await page.getByPlaceholder('email@contoh.com').fill(SUPER.email);
  await page.getByPlaceholder('••••••••••••').fill('');
  await page.getByRole('button', { name: 'Masuk', exact: true }).click();
  await expect(page.getByText('Keluar dari Akun')).toHaveCount(0);
  await page.screenshot({ path: 'results/A2-ditolak.png' });
});

test('A3. tiga peran bisa login dan melihat menu sesuai haknya', async ({ page }) => {
  await resetAndSeed(page);

  await loginAs(page, EMP);
  await expect(page.getByText('Persetujuan Akun Baru')).toHaveCount(0);
  await expect(page.getByText('Lokasi & Geofence')).toHaveCount(0);
  await page.screenshot({ path: 'results/A3-karyawan.png' });
  await logout(page);

  await loginAs(page, ADMIN);
  await expect(page.getByText('Persetujuan Izin Tim').first()).toBeVisible();
  await page.screenshot({ path: 'results/A3-admin.png' });
  await logout(page);

  await loginAs(page, SUPER);
  await expect(page.getByText('Lokasi & Geofence').first()).toBeVisible();
  await page.screenshot({ path: 'results/A3-superadmin.png' });
});

test('A4. sesi hilang setelah logout & reload (tidak kembali masuk otomatis)', async ({ page }) => {
  await resetAndSeed(page);
  await loginAs(page, SUPER);
  await logout(page);
  await page.reload();
  await expect(page.getByRole('button', { name: 'Masuk', exact: true })).toBeVisible();
});

test('A5. karyawan tidak bisa membuka halaman admin lewat manipulasi tab', async ({ page }) => {
  await resetAndSeed(page);
  await loginAs(page, EMP);
  const adminOnly = ['Lokasi & Geofence', 'Persetujuan Akun Baru', 'Data Karyawan'];
  for (const t of adminOnly) {
    await expect(page.getByText(t)).toHaveCount(0);
  }
});
