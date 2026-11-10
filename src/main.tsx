import React, { Component, ErrorInfo, ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught application error:', error, errorInfo);
  }

  handleReload = () => {
    window.location.reload();
  };

  handleHardReset = () => {
    try {
      localStorage.removeItem('absenku_current_user_id');
      sessionStorage.clear();
    } catch {}
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-900 text-white flex items-center justify-center p-6">
          <div className="max-w-md w-full bg-slate-800 rounded-3xl p-6 border border-slate-700 shadow-2xl text-center space-y-4">
            <div className="w-16 h-16 bg-rose-500/20 text-rose-400 rounded-2xl flex items-center justify-center mx-auto text-2xl font-bold">
              ⚠️
            </div>
            <h1 className="text-xl font-bold text-white">Terjadi Kendala Memuat Aplikasi</h1>
            <p className="text-sm text-slate-300">
              Sistem mendeteksi adanya pembaruan atau cache yang perlu dimuat ulang.
            </p>
            {this.state.error?.message && (
              <div className="p-3 bg-slate-900/80 rounded-xl text-xs text-rose-300 text-left font-mono break-words border border-slate-700">
                {this.state.error.message}
              </div>
            )}
            <div className="flex flex-col sm:flex-row gap-2 pt-2">
              <button
                type="button"
                onClick={this.handleReload}
                className="flex-1 py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold text-sm transition-colors cursor-pointer"
              >
                Muat Ulang Halaman
              </button>
              <button
                type="button"
                onClick={this.handleHardReset}
                className="py-2.5 px-4 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-xl font-medium text-xs transition-colors cursor-pointer"
              >
                Bersihkan Sesi
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

// Pastikan browser memuat versi aplikasi paling mutakhir tanpa cache lawas
const BUILD_VERSION = 'absenku_v20261110_rev1';

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

  // Set versi build
  try {
    sessionStorage.setItem('app_build_version', BUILD_VERSION);
  } catch (e) {
    console.warn('Session storage error:', e);
  }
}

createRoot(document.getElementById('root')!).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>
);
