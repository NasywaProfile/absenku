import React from 'react';
import { KanbanBoard } from './KanbanBoard.tsx';
import { TaskItem, User as UserType, UserRole } from '../../types/index.ts';
import { ShieldCheck } from 'lucide-react';

interface MyTasksProps {
  tasks: TaskItem[];
  users: UserType[];
  currentUser: UserType;
  userRole: UserRole;
  onRefresh: () => void;
}

export function MyTasks({
  tasks,
  users,
  currentUser,
  userRole,
  onRefresh,
}: MyTasksProps) {
  const isSuperAdmin = currentUser.role === 'SUPER_ADMIN';

  // Super Admin tidak menerima tugas pribadi (tidak dapat tugas), melainkan mengawasi seluruh tugas tim
  const taskListToDisplay = isSuperAdmin
    ? tasks
    : tasks.filter(
        (t) =>
          t.assignedTo === currentUser.id ||
          Boolean(t.assignees?.some((a) => a.id === currentUser.id))
      );

  return (
    <div className="space-y-4 font-sans antialiased">
      {isSuperAdmin && (
        <div className="bg-gradient-to-r from-[#1E3A8A] to-indigo-900 rounded-2xl p-4 text-white shadow-2xs flex items-center gap-3">
          <div className="p-2 rounded-xl bg-amber-400/20 text-amber-300 shrink-0 border border-amber-400/30">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <p className="font-extrabold text-xs sm:text-sm text-white">
              Mode Pemantauan Direksi (Super Admin)
            </p>
            <p className="text-[11px] text-slate-200">
              Akun Super Admin bertindak sebagai pemberi tugas &amp; pengawas. Di bawah ini ditampilkan seluruh papan tugas tim secara komprehensif.
            </p>
          </div>
        </div>
      )}

      {/* Render KanbanBoard */}
      <KanbanBoard
        tasks={taskListToDisplay}
        users={users}
        currentUser={currentUser}
        userRole={userRole}
        onRefresh={onRefresh}
      />
    </div>
  );
}
