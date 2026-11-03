import { test, expect, Page } from '@playwright/test';
import { resetAndSeed, loginAs, logout, goTo, SUPER, ADMIN, EMP } from './helpers';

test.describe.configure({ mode: 'serial' });

function isoDate(offsetDays: number) {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

async function openPresensiTim(page: Page) {
  await goTo(page, /^Presensi Karyawan$|^Presensi$/);
}

test('B1. karyawan presensi masuk + logbook -> tampil di Admin & Super Admin', async ({ page }) => {
  await resetAndSeed(page);

  // --- Karyawan ---
  await loginAs(page, EMP);
  await page.getByRole('button', { name: /Presensi Masuk Sekarang/ }).first().click();
  // Beberapa alur menampilkan modal konfirmasi / pilihan mode kerja
  const confirmClock = page.getByRole('button', { name: /Presensi Masuk Sekarang|Konfirmasi|Ya, Presensi/ });
  if ((await confirmClock.count()) > 1) await confirmClock.last().click().catch(() => {});
  await expect(page.getByText(/Presensi Masuk \(\d{2}:\d{2}:\d{2} WIB\)/).first()).toBeVisible({ timeout: 10_000 });
  await page.screenshot({ path: 'results/B1-karyawan-clockin.png' });

  await page.getByPlaceholder(/Tulis ringkasan aktivitas/).fill('Membuat halaman login e2e');
  await page.getByRole('button', { name: /Simpan Logbook/ }).click();
  await page.waitForTimeout(500);
  await page.screenshot({ path: 'results/B1-karyawan-logbook.png' });
  await logout(page);

  // --- Admin ---
  await loginAs(page, ADMIN);
  await expect(page.getByText(EMP.name).first()).toBeVisible({ timeout: 10_000 });
  await page.screenshot({ path: 'results/B1-admin-dashboard.png' });
  await logout(page);

  // --- Super Admin ---
  await loginAs(page, SUPER);
  await expect(page.getByText(EMP.name).first()).toBeVisible({ timeout: 10_000 });
  await page.screenshot({ path: 'results/B1-superadmin-dashboard.png' });
});

test('B2. karyawan ajukan cuti -> admin setujui -> karyawan melihat status Disetujui', async ({ page }) => {
  await resetAndSeed(page);
  const tgl = isoDate(1);

  // --- Karyawan mengajukan ---
  await loginAs(page, EMP);
  await goTo(page, 'Pengajuan Izin Saya');
  await page.getByRole('button', { name: /Buat Pengajuan Baru/ }).first().click();
  await page.locator('select').last().selectOption('LEAVE');
  const dates = page.locator('input[type="date"]');
  await dates.nth(await dates.count() - 2).fill(tgl);
  await dates.nth(await dates.count() - 1).fill(tgl);
  await page.getByPlaceholder(/Tuliskan alasan permohonan/).fill('Keperluan keluarga (uji e2e)');
  await page.screenshot({ path: 'results/B2-form.png' });
  await page.getByRole('button', { name: /Kirim Pengajuan/ }).click();
  await expect(page.getByText('Keperluan keluarga (uji e2e)').first()).toBeVisible({ timeout: 10_000 });
  await page.screenshot({ path: 'results/B2-karyawan-menunggu.png' });
  await logout(page);

  // --- Admin menyetujui ---
  await loginAs(page, ADMIN);
  await goTo(page, 'Persetujuan Izin Tim');
  await expect(page.getByText(EMP.name).first()).toBeVisible({ timeout: 10_000 });
  await page.screenshot({ path: 'results/B2-admin-antrian.png' });
  await page.getByTitle(/Setujui Permohonan/).first().click();
  const yes = page.getByRole('button', { name: /^(Ya, )?Setujui/ });
  if ((await yes.count()) > 0 && (await yes.last().isVisible().catch(() => false))) await yes.last().click().catch(() => {});
  await page.waitForTimeout(600);
  await page.screenshot({ path: 'results/B2-admin-setelah-setuju.png' });
  await logout(page);

  // --- Karyawan melihat hasil ---
  await loginAs(page, EMP);
  await goTo(page, 'Pengajuan Izin Saya');
  await expect(page.getByRole('cell', { name: 'Disetujui', exact: true })).toBeVisible({ timeout: 10_000 });
  await page.screenshot({ path: 'results/B2-karyawan-disetujui.png' });
});
