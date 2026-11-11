import { Page, expect } from '@playwright/test';

export const SUPER = { email: process.env.E2E_SUPER_EMAIL || 'e2e.superadmin@absenku.test', password: process.env.E2E_SUPER_PASSWORD || 'E2eSuperPass#2026!', name: 'Super Admin' };
export const ADMIN = { id: 'usr_e2e_admin', email: process.env.E2E_ADMIN_EMAIL || 'e2e.admin@absenku.test', password: process.env.E2E_ADMIN_PASSWORD || 'E2eAdminPass#2026!', name: 'Budi Admin' };
export const EMP = { id: 'usr_e2e_emp', email: process.env.E2E_EMP_EMAIL || 'e2e.emp@absenku.test', password: process.env.E2E_EMP_PASSWORD || 'E2eEmpPass#2026!', name: 'Alissa Karyawan' };

const baseUser = {
  status: 'ACTIVE',
  employmentType: 'PERMANENT',
  department: 'Teknologi Informasi',
  avatar: '',
  phone: '081200000000',
  joinDate: '2025-01-01',
  leaveBalance: 12,
  bankName: 'BCA',
  bankAccountNumber: '1234567890',
  bankAccountHolder: 'Tester',
  emergencyContactName: 'Kontak',
  emergencyContactPhone: '081211111111',
  address: 'Malang',
  registeredAt: '2025-01-01 08:00',
  isProfileComplete: true,
};

/** Buka aplikasi dengan data bersih, lalu tambahkan akun Admin & Karyawan yang sudah aktif. */
export async function resetAndSeed(page: Page) {
  await page.goto('/');
  await page.evaluate(
    ({ admin, emp, base }) => {
      localStorage.clear();
      // Biarkan aplikasi membuat data awal (Super Admin) lalu tambahkan akun uji
      return { admin, emp, base };
    },
    { admin: ADMIN, emp: EMP, base: baseUser }
  );
  await page.reload();
  await page.evaluate(
    ({ superUser, admin, emp, base }) => {
      const key = 'absenku_users_v10';
      const users = JSON.parse(localStorage.getItem(key) || '[]');
      const saIdx = users.findIndex((u: any) => u.id === 'usr_super_admin' || u.role === 'SUPER_ADMIN');
      if (saIdx >= 0) {
        users[saIdx] = { ...users[saIdx], email: superUser.email, password: superUser.password };
      } else {
        users.unshift({ ...base, id: 'usr_super_admin', name: superUser.name, email: superUser.email, password: superUser.password, role: 'SUPER_ADMIN', position: 'Super Administrator' });
      }
      users.push(
        { ...base, id: admin.id, name: admin.name, email: admin.email, password: admin.password, role: 'ADMIN', position: 'Admin Operasional' },
        { ...base, id: emp.id, name: emp.name, email: emp.email, password: emp.password, role: 'EMPLOYEE', position: 'Frontend Developer' }
      );
      localStorage.setItem(key, JSON.stringify(users));
    },
    { superUser: SUPER, admin: ADMIN, emp: EMP, base: baseUser }
  );
  await page.reload();
}

export async function login(page: Page, email: string, password: string) {
  await page.getByPlaceholder('email@contoh.com').fill(email);
  await page.getByPlaceholder('••••••••••••').fill(password);
  await page.getByRole('button', { name: 'Masuk', exact: true }).click();
}

export async function loginAs(page: Page, who: { email: string; password: string }) {
  await expect(page.getByRole('button', { name: 'Masuk', exact: true })).toBeVisible();
  await login(page, who.email, who.password);
  await expect(page.getByText('Keluar dari Akun').first()).toBeVisible({ timeout: 10_000 });
}

export async function logout(page: Page) {
  await page.getByText('Keluar dari Akun').first().click();
  // Beberapa versi menampilkan dialog konfirmasi
  const confirm = page.getByRole('button', { name: /^(Ya, )?Keluar/ }).last();
  if (await confirm.isVisible().catch(() => false)) {
    await confirm.click().catch(() => {});
  }
  await expect(page.getByRole('button', { name: 'Masuk', exact: true })).toBeVisible({ timeout: 10_000 });
}

export async function goTo(page: Page, label: string | RegExp) {
  await page.getByRole('button', { name: label }).first().click();
}
