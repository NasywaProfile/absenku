import { useState } from 'react';
import {
  LogIn,
  ArrowRight,
  Send,
  Clock,
  CheckCircle2,
} from 'lucide-react';
import { AttendanceRecord, OfficeConfig, TaskItem, User, getPriorityLabel } from '../../types/index.ts';
import { getCurrentDateString, formatIndonesianDate } from '../../lib/time-utils.ts';
import { ClockInOutModal } from '../attendance/ClockInOutModal.tsx';
import { TaskDetailModal } from '../tasks/TaskDetailModal.tsx';

interface EmployeeDashboardProps {
  currentUser: User;
  officeConfig: OfficeConfig;
  todayRecord?: AttendanceRecord;
  myTasks: TaskItem[];
  onNavigateTab: (tabId: string) => void;
  onRefreshData: () => void;
}

export function EmployeeDashboard({
  currentUser,
  officeConfig,
  todayRecord,
  myTasks,
  onNavigateTab,
  onRefreshData,
}: EmployeeDashboardProps) {
  const [activeModalType, setActiveModalType] = useState<'CLOCK_IN' | null>(null);
  const [selectedTaskForDetail, setSelectedTaskForDetail] = useState<TaskItem | null>(null);
  const today = new Date();

  // Simple Grid Calendar (for demonstration)
  const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  return (
    <div className="p-6 space-y-6 bg-[#F8FAFC] min-h-screen">
      {/* Header with Date and Attendance Button */}
      <div className="flex justify-between items-center bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Halo, {currentUser.name}</h1>
          <p className="text-slate-500">{formatIndonesianDate(getCurrentDateString())}</p>
        </div>
        <button
          type="button"
          onClick={() => setActiveModalType('CLOCK_IN')}
          className="flex items-center gap-2 px-6 py-3 bg-[#1E3A8A] hover:bg-[#172554] text-white rounded-2xl font-bold shadow-md shadow-[#1E3A8A]/20 active:scale-[0.98] transition-all border border-[#1E3A8A]"
        >
          <LogIn className="w-5 h-5 text-white" />
          Presensi Masuk
        </button>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Calendar Card */}
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
          <h2 className="text-lg font-bold text-slate-900 mb-4">Kalender Presensi</h2>
          <div className="grid grid-cols-7 gap-2 text-center text-xs font-bold uppercase tracking-wider mb-2">
            {['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'].map((d, i) => (
              <div key={i} className={i === 0 || i === 6 ? 'text-red-500 font-extrabold' : 'text-slate-400'}>
                {d}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-2">
            {days.map((day) => {
              const dateObj = new Date(today.getFullYear(), today.getMonth(), day);
              const dayOfWeek = dateObj.getDay();
              const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
              const isToday = day === today.getDate();

              return (
                <div
                  key={day}
                  title={isWeekend ? 'Hari Libur (Sabtu / Minggu)' : undefined}
                  className={`p-3 text-center rounded-xl font-bold text-lg ${
                    isToday
                      ? isWeekend
                        ? 'bg-indigo-900 text-white border-2 border-red-500'
                        : 'bg-indigo-900 text-white'
                      : isWeekend
                      ? 'border border-red-500 text-red-600 bg-red-50/30'
                      : 'bg-slate-50 text-slate-700'
                  }`}
                >
                  {day}
                </div>
              );
            })}
          </div>
        </div>

        {/* Tugas Saya Berdasarkan Masing-masing Proses (1 Teratas dari Tiap Proses) */}
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 space-y-5">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-slate-900">Tugas Saya Berdasarkan Proses</h2>
            <button
              type="button"
              onClick={() => onNavigateTab('tasks')}
              className="text-xs text-sky-600 hover:text-sky-700 font-semibold"
            >
              Buka Papan Tugas &rarr;
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { id: 'TODO', label: 'Penugasan', headerStyle: 'bg-slate-100/90 text-slate-800 border-slate-200/90' },
              { id: 'IN_PROGRESS', label: 'Dalam Proses', headerStyle: 'bg-sky-50 text-sky-800 border-sky-200/80' },
              { id: 'DONE', label: 'Preview Tugas', headerStyle: 'bg-amber-50 text-amber-900 border-amber-200/80' },
              { id: 'REVIEWED', label: 'Selesai', headerStyle: 'bg-emerald-50 text-emerald-900 border-emerald-200/80' },
            ].map((col) => {
              const topTask = myTasks.find((t) => t.status === col.id);

              return (
                <div key={col.id} className="bg-slate-50/70 rounded-2xl p-4 border border-slate-200/80 flex flex-col justify-between space-y-3">
                  {/* Judul Proses & Angka Bersatu dalam 1 Container Ber-BG & Beradius */}
                  <div className={`flex items-center justify-between px-3.5 py-2.5 rounded-xl border shadow-2xs font-bold text-xs tracking-tight ${col.headerStyle}`}>
                    <span>{col.label}</span>
                    <span className="w-5 h-5 rounded-full bg-white text-slate-800 font-extrabold text-[11px] flex items-center justify-center shadow-2xs border border-white/80 shrink-0">
                      {topTask ? '1' : '0'}
                    </span>
                  </div>

                  {/* Task Card atau Empty State */}
                  {!topTask ? (
                    <div className="py-8 text-center text-slate-400 text-xs border border-dashed border-slate-200 rounded-xl bg-white">
                      Tidak ada tugas
                    </div>
                  ) : (
                    <div
                      onClick={() => setSelectedTaskForDetail(topTask)}
                      className="bg-white rounded-2xl p-4 border border-slate-200/90 shadow-2xs hover:shadow-md hover:border-sky-300 transition-all duration-200 cursor-pointer space-y-3"
                    >
                      <div className="flex items-center justify-between">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                          topTask.priority === 'URGENT' ? 'bg-rose-50 text-rose-700 border-rose-200' :
                          topTask.priority === 'HIGH' ? 'bg-orange-50 text-orange-700 border-orange-200' :
                          topTask.priority === 'MEDIUM' ? 'bg-sky-50 text-sky-700 border-sky-200' : 'bg-slate-100 text-slate-700 border-slate-200'
                        }`}>
                          {getPriorityLabel(topTask.priority)}
                        </span>
                        <span className="text-[11px] text-slate-400 font-mono">{topTask.dueDate}</span>
                      </div>

                      <h3 className="font-bold text-sm text-slate-900 leading-snug truncate">
                        {topTask.title}
                      </h3>

                      {topTask.description && (
                        <p className="text-xs text-slate-500 line-clamp-2">
                          {topTask.description}
                        </p>
                      )}

                      <div className="border-t border-slate-100 pt-2 flex items-center justify-between text-xs">
                        <div className="flex items-center -space-x-2">
                          <div className="w-6 h-6 rounded-full bg-amber-400 text-slate-900 border-2 border-white font-extrabold text-[9px] flex items-center justify-center shadow-2xs">
                            {topTask.assignedName ? topTask.assignedName.substring(0, 2).toUpperCase() : 'AU'}
                          </div>
                        </div>
                        <span className="text-xs text-slate-400">{topTask.dueDate}</span>
                      </div>

                      {/* Tombol Aksi Bawah */}
                      <div className="pt-1 flex flex-wrap items-center gap-1 text-xs">
                        {topTask.status === 'TODO' && (
                          <div className="w-full py-2 bg-sky-50 hover:bg-sky-100 text-sky-700 font-bold rounded-xl text-center text-xs transition-all flex items-center justify-center gap-1">
                            <span>Mulai Kerjakan</span>
                            <ArrowRight className="w-3.5 h-3.5" />
                          </div>
                        )}
                        {topTask.status === 'IN_PROGRESS' && (
                          <div className="w-full py-2 bg-[#0EA5E9] hover:bg-[#0284C7] text-white font-bold rounded-xl text-center text-xs transition-all flex items-center justify-center gap-1 shadow-2xs">
                            <Send className="w-3.5 h-3.5 text-white" />
                            <span>Kirim ke Preview Tugas</span>
                          </div>
                        )}
                        {topTask.status === 'DONE' && (
                          <div className="w-full py-1.5 bg-amber-50 text-amber-800 font-semibold rounded-xl text-center text-xs flex items-center justify-center gap-1 border border-amber-200/80">
                            <Clock className="w-3.5 h-3.5 text-amber-600 animate-pulse" />
                            <span>Menunggu Review PIC</span>
                          </div>
                        )}
                        {topTask.status === 'REVIEWED' && (
                          <div className="w-full py-1.5 bg-emerald-50 text-emerald-800 font-semibold rounded-xl text-center text-xs flex items-center justify-center gap-1 border border-emerald-200/80">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                            <span>Disetujui PIC (Selesai)</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Tasks Assigned Card */}
      <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
        <h2 className="text-lg font-bold text-slate-900 mb-4">Tugas yang Saya Berikan</h2>
        <p className="text-slate-500">Belum ada tugas yang diberikan.</p>
      </div>

      {activeModalType && (
        <ClockInOutModal
          type={activeModalType}
          currentUser={currentUser}
          officeConfig={officeConfig}
          existingTodayRecord={todayRecord}
          onClose={() => setActiveModalType(null)}
          onSuccess={() => {
            setActiveModalType(null);
            onRefreshData();
          }}
        />
      )}

      {selectedTaskForDetail && (
        <TaskDetailModal
          task={selectedTaskForDetail}
          onClose={() => setSelectedTaskForDetail(null)}
          currentUser={currentUser}
          users={[currentUser]}
          onRefresh={onRefreshData}
        />
      )}
    </div>
  );
}
