import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Pastikan browser memuat versi aplikasi paling mutakhir tanpa cache lawas
const BUILD_VERSION = 'absenku_v20261029_rev3';

if (typeof window !== 'undefined') {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.getRegistrations().then((registrations) => {
      for (const reg of registrations) {
        reg.unregister();
      }
    });
  }
  if ('caches' in window) {
    caches.keys().then((keys) => {
      keys.forEach((k) => caches.delete(k));
    });
  }

  // Otomatis refresh browser 1 kali jika versi aplikasi diperbarui untuk membersihkan cache RAM
  try {
    const currentVer = sessionStorage.getItem('app_build_version');
    if (currentVer !== BUILD_VERSION) {
      sessionStorage.setItem('app_build_version', BUILD_VERSION);
      // Hard reload
      window.location.reload();
    }
  } catch (e) {
    console.warn('Session storage error:', e);
  }
}

createRoot(document.getElementById('root')!).render(<App />);
