import { useState, useEffect, useCallback } from 'react';
import { AttendanceRecord, OfflineSyncItem } from '../types/index.ts';
import { AppStorage } from './storage.ts';

const SYNC_EVENT_NAME = 'absenku_sync_updated';

// Helper to broadcast sync updates across tabs and components
export function notifySyncUpdated(): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(SYNC_EVENT_NAME));
  }
}

// 1. Service Worker Registration
export function registerServiceWorker(): void {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;

  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js')
      .then((reg) => {
        // Force update to latest service worker immediately
        reg.update();
        if ('sync' in reg) {
          // Background sync supported
        }
      })
      .catch((err) => {
        console.warn('[SW Registration Notice]', err);
      });

    // Listen for messages from Service Worker
    navigator.serviceWorker.addEventListener('message', (event) => {
      if (event.data?.type === 'OFFLINE_SYNC_TRIGGERED') {
        syncPendingAttendanceRecords();
      }
    });
  });
}

// 2. Sync Pending Offline Attendance Records
export function syncPendingAttendanceRecords(): { syncedCount: number } {
  const syncedCount = AppStorage.syncAllPendingAttendance();
  if (syncedCount > 0) {
    notifySyncUpdated();
  }
  return { syncedCount };
}

// 3. Save Attendance with Offline Resilience
export function saveAttendanceWithOfflineSupport(
  record: AttendanceRecord,
  actionType: 'CLOCK_IN' | 'CLOCK_OUT'
): { isOffline: boolean; record: AttendanceRecord } {
  const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;

  const finalRecord: AttendanceRecord = {
    ...record,
    syncStatus: isOnline ? 'SYNCED' : 'PENDING_SYNC',
    offlineLoggedAt: !isOnline ? new Date().toISOString() : undefined,
  };

  // Always persist immediately into localStorage
  AppStorage.saveAttendanceRecord(finalRecord);

  if (!isOnline) {
    const queueItem: OfflineSyncItem = {
      id: `queue-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      recordId: finalRecord.id,
      userId: finalRecord.userId,
      type: actionType,
      timestamp: new Date().toISOString(),
      date: finalRecord.date,
    };
    AppStorage.addToOfflineQueue(queueItem);

    // Request Background Sync from Service Worker if supported
    if (
      typeof window !== 'undefined' &&
      'serviceWorker' in navigator &&
      'SyncManager' in window
    ) {
      navigator.serviceWorker.ready.then((reg: any) => {
        if (reg.sync) {
          reg.sync.register('sync-attendance').catch(() => {});
        }
      });
    }
  }

  notifySyncUpdated();

  return {
    isOffline: !isOnline,
    record: finalRecord,
  };
}

// 4. Custom React Hook to track online status & pending syncs
export function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState<boolean>(() => {
    return typeof navigator !== 'undefined' ? navigator.onLine : true;
  });
  const [pendingCount, setPendingCount] = useState<number>(() => {
    return AppStorage.getPendingSyncCount();
  });
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [lastSyncResult, setLastSyncResult] = useState<string | null>(null);

  const refreshCount = useCallback(() => {
    setPendingCount(AppStorage.getPendingSyncCount());
  }, []);

  const triggerSync = useCallback(() => {
    if (!navigator.onLine) {
      return { success: false, syncedCount: 0, message: 'Tidak dapat sinkronisasi dalam mode offline.' };
    }
    setIsSyncing(true);
    try {
      const { syncedCount } = syncPendingAttendanceRecords();
      refreshCount();
      setIsSyncing(false);
      const msg =
        syncedCount > 0
          ? `${syncedCount} presensi offline berhasil disinkronkan ke server!`
          : 'Semua data presensi sudah tersinkronisasi.';
      setLastSyncResult(msg);
      return { success: true, syncedCount, message: msg };
    } catch {
      setIsSyncing(false);
      return { success: false, syncedCount: 0, message: 'Gagal melakukan sinkronisasi data.' };
    }
  }, [refreshCount]);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      // Auto-sync immediately when connection is restored
      triggerSync();
    };

    const handleOffline = () => {
      setIsOnline(false);
    };

    const handleSyncEvent = () => {
      refreshCount();
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    window.addEventListener(SYNC_EVENT_NAME, handleSyncEvent);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener(SYNC_EVENT_NAME, handleSyncEvent);
    };
  }, [triggerSync, refreshCount]);

  return {
    isOnline,
    pendingCount,
    isSyncing,
    lastSyncResult,
    triggerSync,
    refreshCount,
  };
}
