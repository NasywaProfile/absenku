import React, { useState, useEffect } from 'react';
import {
  X,
  Maximize2,
  Minimize2,
  Plus,
  Trash2,
  CheckCircle2,
  ClipboardCopy,
  Clock,
  MessageSquare,
  Sparkles,
} from 'lucide-react';
import { User, DailyTaskLog, AttendanceRecord } from '../../types/index.ts';
import { AppStorage } from '../../lib/storage.ts';
import {
  generateWhatsAppAttendanceRecap,
  copyTextToClipboard,
  EMPLOYMENT_TYPE_LABELS,
} from '../../lib/whatsapp-recap.ts';
import { formatIndonesianDate } from '../../lib/time-utils.ts';

interface DailyTaskLogModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: User;
  todayAttendance: AttendanceRecord | null;
  onTaskUpdated?: () => void;
}

export function DailyTaskLogModal({
  isOpen,
  onClose,
  currentUser,
  todayAttendance,
  onTaskUpdated,
}: DailyTaskLogModalProps) {
  const [tasks, setTasks] = useState<string[]>(['']);
  const [notes, setNotes] = useState('');
  const [lastSaved, setLastSaved] = useState<DailyTaskLog | null>(null);
  const [copiedWA, setCopiedWA] = useState(false);
  const [isSavedToast, setIsSavedToast] = useState(false);
  const [isFullScreen, setIsFullScreen] = useState(false);

  useEffect(() => {
    if (isOpen && currentUser) {
      const existing = AppStorage.getTodayDailyTask(currentUser.id);
      if (existing) {
        setLastSaved(existing);
        setTasks(existing.tasks.length > 0 ? existing.tasks : ['']);
        setNotes(existing.notes || '');
      } else if (todayAttendance?.tasksDoneSummary && todayAttendance.tasksDoneSummary.length > 0) {
        setTasks(todayAttendance.tasksDoneSummary);
        setNotes(todayAttendance.notes || '');
      } else {
        setTasks(['']);
        setNotes('');
      }
      setCopiedWA(false);
      setIsSavedToast(false);
    }
  }, [isOpen, currentUser, todayAttendance]);

  if (!isOpen) return null;

  const handleAddTaskInput = () => {
    setTasks([...tasks, '']);
  };

  const handleRemoveTaskInput = (index: number) => {
    if (tasks.length === 1) {
      setTasks(['']);
      return;
    }
    const next = tasks.filter((_, idx) => idx !== index);
    setTasks(next);
  };

  const handleTaskChange = (index: number, val: string) => {
    const next = [...tasks];
    next[index] = val;
    setTasks(next);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanTasks = tasks.map((t) => t.trim()).filter(Boolean);
    if (cleanTasks.length === 0) {
      cleanTasks.push('Menyelesaikan aktivitas kerja harian & koordinasi tim');
    }

    const saved = AppStorage.upsertDailyTask(currentUser, cleanTasks, notes);
    setLastSaved(saved);
    setIsSavedToast(true);
    if (onTaskUpdated) onTaskUpdated();

    setTimeout(() => {
      setIsSavedToast(false);
    }, 2500);
  };

  const handleCopyWhatsApp = async () => {
    const cleanTasks = tasks.map((t) => t.trim()).filter(Boolean);
    const mockDailyTask: DailyTaskLog = {
      id: lastSaved?.id || 'dt_preview',
      userId: currentUser.id,
      userName: currentUser.name,
      userAvatar: currentUser.avatar,
      employmentType: currentUser.employmentType,
      date: new Date().toISOString().substring(0, 10),
      tasks: cleanTasks.length > 0 ? cleanTasks : ['Menyelesaikan aktivitas kerja harian & koordinasi tim'],
      submittedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      notes,
    };

    const waText = generateWhatsAppAttendanceRecap({
      attendance: todayAttendance,
      dailyTask: mockDailyTask,
      user: currentUser,
    });

    const success = await copyTextToClipboard(waText);
    if (success) {
      setCopiedWA(true);
      setTimeout(() => setCopiedWA(false), 3000);
    }
  };

  return (
    <div
      className={`fixed inset-0 z-50 flex animate-in fade-in duration-200 ${
        isFullScreen
          ? 'items-center justify-center p-0'
          : 'justify-end items-center p-2.5 sm:p-4 md:p-5'
      }`}
    >
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-950/40 backdrop-blur-xs transition-opacity cursor-pointer"
        onClick={onClose}
      />

      {/* Modal Dialog Card */}
      <div
        className={`relative z-10 bg-white shadow-2xl flex flex-col min-h-0 overflow-hidden transition-all duration-300 font-sans ${
          isFullScreen
            ? 'w-full h-full max-w-none max-h-none rounded-none border-0'
            : 'w-full max-w-md sm:max-w-lg h-full max-h-[calc(100vh-1.25rem)] sm:max-h-[calc(100vh-2rem)] rounded-3xl border border-slate-200/80 animate-in slide-in-from-right duration-300 ease-out'
        }`}
      >
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-100 bg-white flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            {/* Zoom Button di pojok kiri atas */}
            <button
              type="button"
              onClick={() => setIsFullScreen(!isFullScreen)}
              className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl border border-slate-200/80 transition-colors cursor-pointer shrink-0"
              title={isFullScreen ? "Perkecil Tampilan" : "Perbesar Layar Penuh"}
            >
              {isFullScreen ? (
                <Minimize2 className="w-4 h-4 text-slate-600" />
              ) : (
                <Maximize2 className="w-4 h-4 text-slate-600" />
              )}
            </button>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-base text-slate-900">
                  Log Aktivitas &amp; Task Harian
                </h3>
                <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-blue-50 text-[#1E3A8A] border border-blue-200">
                  Fleksibel
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                {formatIndonesianDate(new Date().toISOString().substring(0, 10))} &bull;{' '}
                {currentUser.name} ({EMPLOYMENT_TYPE_LABELS[currentUser.employmentType]})
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full border border-slate-200 transition-colors cursor-pointer shrink-0"
            title="Tutup"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Form */}
        <form onSubmit={handleSave} className="flex-1 flex flex-col min-h-0">
          <div className="flex-1 overflow-y-auto p-6 space-y-4 text-xs">
          <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200/80 text-xs text-slate-600 space-y-1">
            <p className="font-semibold text-slate-900 flex items-center gap-1.5">
              <Clock className="w-4 h-4 text-[#1E3A8A]" />
              <span>Pengisian Tugas Fleksibel Kapan Saja</span>
            </p>
            <p className="leading-relaxed">
              Anda tidak perlu mengisi tugas bersamaan dengan presensi masuk. Anda dapat mengisi atau memperbarui daftar tugas yang dikerjakan kapan saja hari ini (pagi, siang, atau sore hari).
            </p>
          </div>

          {/* List of Tasks */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                Daftar Tugas / Pekerjaan Hari Ini
              </label>
              <button
                type="button"
                onClick={handleAddTaskInput}
                className="inline-flex items-center gap-1 text-xs font-bold text-[#1E3A8A] hover:text-[#172554] cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Tambah Baris Tugas</span>
              </button>
            </div>

            <div className="space-y-2">
              {tasks.map((task, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <span className="w-6 text-center font-mono font-bold text-xs text-slate-400 shrink-0">
                    {idx + 1}.
                  </span>
                  <input
                    type="text"
                    value={task}
                    onChange={(e) => handleTaskChange(idx, e.target.value)}
                    placeholder={`Contoh: Selesaikan fitur ${idx === 0 ? 'review code sprint 4' : idx === 1 ? 'testing API backend' : 'dokumentasi arsitektur'}`}
                    className="flex-1 px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-medium text-slate-900 placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-[#1E3A8A] focus:bg-white transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => handleRemoveTaskInput(idx)}
                    title="Hapus baris ini"
                    className="p-2 text-slate-400 hover:text-rose-600 rounded-lg transition-colors cursor-pointer shrink-0"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Catatan Tambahan (Opsional) */}
          <div className="space-y-1.5 pt-1">
            <label className="text-xs font-bold text-slate-800 uppercase tracking-wider">
              Catatan Progres / Keterangan (Opsional)
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Contoh: Sudah dideploy ke server staging, menunggu review dari lead..."
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-medium text-slate-900 placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-[#1E3A8A] focus:bg-white transition-all"
            />
          </div>

          {/* Feedback Toast */}
          {isSavedToast && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold rounded-xl flex items-center gap-2 animate-in fade-in">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>Log aktivitas berhasil disimpan ke sistem!</span>
            </div>
          )}

          {lastSaved && (
            <p className="text-[11px] text-slate-400 font-mono">
              Terakhir diperbarui: {lastSaved.updatedAt} WIB
            </p>
          )}

          </div>

          {/* Sticky Action Footer */}
          <div className="px-6 py-4.5 border-t border-slate-100 bg-white flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
            {/* Tombol Salin Format WhatsApp */}
            <button
              type="button"
              onClick={handleCopyWhatsApp}
              className={`w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all border cursor-pointer ${
                copiedWA
                  ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                  : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border-emerald-300'
              }`}
            >
              {copiedWA ? (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Tersalin ke WhatsApp!</span>
                </>
              ) : (
                <>
                  <ClipboardCopy className="w-4 h-4 text-emerald-700" />
                  <span>Salin Format WhatsApp</span>
                </>
              )}
            </button>

            {/* Simpan Log Task */}
            <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl text-xs transition-colors cursor-pointer"
              >
                Batal
              </button>
              <button
                type="submit"
                className="flex-1 sm:flex-none px-5 py-2.5 bg-[#1E3A8A] hover:bg-[#172554] text-white font-bold rounded-xl text-xs shadow-xs transition-all cursor-pointer"
              >
                Simpan Log Tugas
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
