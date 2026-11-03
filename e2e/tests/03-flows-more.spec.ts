import { test, expect } from '@playwright/test';
import { resetAndSeed, loginAs, logout, goTo, login, SUPER, ADMIN, EMP } from './helpers';

test.describe.configure({ mode: 'serial' });

function isoDate(offsetDays: number) {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

test('B3. admin MENOLAK cuti dengan alasan -> karyawan melihat status Ditolak', async ({ page }) => {
  await resetAndSeed(page);
  const tgl = isoDate(2);

  await loginAs(page, EMP);
  await goTo(page, 'Pengajuan Izin Saya');
  await page.getByRole('button', { name: /Buat Pengajuan Baru/ }).first().click();
  const dates = page.locator('input[type="date"]');
  await dates.nth((await dates.count()) - 2).fill(tgl);
  await dates.nth((await dates.count()) - 1).fill(tgl);
  await page.getByPlaceholder(/Tuliskan alasan permohonan/).fill('Liburan (uji tolak)');
  await page.getByRole('button', { name: /Kirim Pengajuan/ }).click();
  await expect(page.getByText('Liburan (uji tolak)').first()).toBeVisible({ timeout: 10_000 });
  await logout(page);

  await loginAs(page, ADMIN);
  await goTo(page, 'Persetujuan Izin Tim');
  await page.getByTitle(/Tolak Permohonan/).first().click();
  await page.getByPlaceholder(/Contoh: Jadwal bertabrakan/).fill('Bentrok dengan agenda proyek');
  await page.getByRole('button', { name: 'Konfirmasi Penolakan' }).click();
  await page.waitForTimeout(600);
  await logout(page);

  await loginAs(page, EMP);
  await goTo(page, 'Pengajuan Izin Saya');
  await expect(page.getByRole('cell', { name: 'Ditolak', exact: true })).toBeVisible({ timeout: 10_000 });
  await page.screenshot({ path: 'results/B3-karyawan-ditolak.png' });
});

test('B4. pendaftaran akun baru -> menunggu persetujuan -> Super Admin setujui -> bisa masuk', async ({ page }) => {
  await resetAndSeed(page);

  await page.getByRole('button', { name: /Belum punya akun/ }).click();
  await page.getByPlaceholder('Contoh: Pratama Arhan').fill('Citra Pendaftar');
  await page.getByPlaceholder('email@contoh.com').fill('citra.baru@gmail.com');
  await page.getByPlaceholder('Minimal 6 karakter').fill('Citra12345');
  await page.getByRole('button', { name: 'Daftar Akun Baru' }).click();
  await page.waitForTimeout(1500);
  await page.screenshot({ path: 'results/B4-setelah-daftar.png' });

  // Onboarding biodata panjang tidak diisi lewat UI; tandai selesai agar masuk antrean persetujuan
  await page.evaluate(() => {
    const k = 'absenku_users_v9';
    const us = JSON.parse(localStorage.getItem(k) || '[]');
    const u = us.find((x: any) => x.email === 'citra.baru@gmail.com');
    Object.assign(u, { isProfileComplete: true, phone: '081200001111', address: 'Malang', bankName: 'BCA', bankAccountNumber: '111', bankAccountHolder: 'Citra', emergencyContactName: 'Ibu', emergencyContactPhone: '081200002222' });
    localStorage.setItem(k, JSON.stringify(us));
  });
  await page.reload();
  await page.waitForTimeout(800);
  await page.screenshot({ path: 'results/B4-pending.png' });
  // Karyawan pending tidak boleh melihat menu aplikasi
  await expect(page.getByText('Pengajuan Izin Saya')).toHaveCount(0);

  // logout dari layar pending
  await page.getByRole('button', { name: /Keluar ke Halaman Masuk/ }).click();
  await expect(page.getByRole('button', { name: 'Masuk', exact: true })).toBeVisible();

  // Pending tidak boleh langsung masuk dashboard saat login
  await login(page, 'citra.baru@gmail.com', 'Citra12345');
  await page.waitForTimeout(800);
  await expect(page.getByText('Pengajuan Izin Saya')).toHaveCount(0);
  await page.getByRole('button', { name: /Keluar ke Halaman Masuk/ }).click();

  await loginAs(page, SUPER);
  await goTo(page, 'Persetujuan Akun Baru');
  await expect(page.getByText('Citra Pendaftar').first()).toBeVisible({ timeout: 10_000 });
  await page.screenshot({ path: 'results/B4-antrean-superadmin.png' });
  await page.getByTitle('Setujui (ACC)').first().click();
  await page.waitForTimeout(800);
  await logout(page);

  await loginAs(page, { email: 'citra.baru@gmail.com', password: 'Citra12345' });
  await expect(page.getByText('Pengajuan Izin Saya').first()).toBeVisible();
  await page.screenshot({ path: 'results/B4-citra-masuk.png' });
});

test('B5. pengajuan sakit dengan lampiran PDF besar tidak memicu error kuota', async ({ page }) => {
  await resetAndSeed(page);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });

  await loginAs(page, EMP);
  await goTo(page, 'Pengajuan Izin Saya');
  await page.getByRole('button', { name: /Buat Pengajuan Baru/ }).first().click();
  await page.locator('select').last().selectOption('SICK');
  const tgl = isoDate(3);
  const dates = page.locator('input[type="date"]');
  await dates.nth((await dates.count()) - 2).fill(tgl);
  await dates.nth((await dates.count()) - 1).fill(tgl);
  await page.getByPlaceholder(/Tuliskan alasan permohonan/).fill('Demam (uji lampiran besar)');
  // PDF sintetis ~6 MB (melebihi kuota localStorage 5 MB)
  const big = Buffer.concat([Buffer.from('%PDF-1.4\n'), Buffer.alloc(6 * 1024 * 1024, 65), Buffer.from('\n%%EOF')]);
  await page.locator('input[type="file"]').last().setInputFiles({ name: 'surat-dokter.pdf', mimeType: 'application/pdf', buffer: big });
  await page.waitForTimeout(2500);
  await page.getByRole('button', { name: /Kirim Pengajuan/ }).click();
  await expect(page.getByText('Demam (uji lampiran besar)').first()).toBeVisible({ timeout: 15_000 });
  await page.screenshot({ path: 'results/B5-sakit-lampiran.png' });
  expect(errors.filter((e) => /quota|QuotaExceeded/i.test(e))).toEqual([]);
});
