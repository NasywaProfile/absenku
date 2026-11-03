import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  timeout: 60_000,
  workers: 1,
  reporter: [['list']],
  outputDir: './results',
  use: {
    baseURL: 'http://localhost:3000',
    headless: true,
    viewport: { width: 1440, height: 900 },
    permissions: ['geolocation'],
    // Koordinat default = kantor (IndigoSpace Malang); tes bisa menimpa sendiri
    geolocation: { latitude: -7.9439, longitude: 112.6322 },
    locale: 'id-ID',
    timezoneId: 'Asia/Jakarta',
    screenshot: 'off',
  },
});
