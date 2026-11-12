import { TaskItem } from '../types/index.ts';

/**
 * Mengecek apakah tugas dibuat oleh pengguna tertentu, mendukung pencocokan ID permanen
 * maupun fallback nama tampilan (case-insensitive) untuk kompatibilitas baris data lama.
 */
export function isTaskCreatedByUser(
  task: Pick<TaskItem, 'createdBy'>,
  user?: { id?: string; name?: string; role?: string } | null
): boolean {
  if (!user) return false;
  const creator = (task.createdBy || '').trim();
  if (!creator) {
    return user.role === 'SUPER_ADMIN';
  }
  if (user.id && creator === user.id) {
    return true;
  }
  if (user.name && creator.toLowerCase() === user.name.trim().toLowerCase()) {
    return true;
  }
  return false;
}

/**
 * Mengambil timestamp pembuatan (ms) dari ID tugas lokal berformat `task_<ts>_...` maupun `task-<ts>`.
 */
export function parseTaskTimestampMs(taskId: string): number {
  const match = /^task[_-](\d{10,16})(?:$|[_-])/i.exec(String(taskId || '').trim());
  if (!match) return 0;
  const ts = Number.parseInt(match[1], 10);
  return Number.isFinite(ts) ? ts : 0;
}

/**
 * Menentukan apakah tugas lokal yang belum muncul di respons server tetap harus dipertahankan
 * sementara (karena request simpan masih berjalan atau tugas baru saja dibuat di perangkat ini).
 */
export function shouldKeepLocalTaskMissingFromServer(params: {
  taskId: string;
  pendingSyncIds: Set<string>;
  deletedIds: Set<string>;
  nowMs?: number;
  graceWindowMs?: number;
}): boolean {
  const { taskId, pendingSyncIds, deletedIds, nowMs = Date.now(), graceWindowMs = 30000 } = params;
  const normalizedId = String(taskId);

  if (deletedIds.has(normalizedId)) {
    return false;
  }

  if (pendingSyncIds.has(normalizedId)) {
    return true;
  }

  const createdTs = parseTaskTimestampMs(normalizedId);
  return createdTs > 0 && nowMs - createdTs >= 0 && nowMs - createdTs < graceWindowMs;
}
