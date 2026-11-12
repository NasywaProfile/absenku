import React, { useMemo } from 'react';
import { KanbanBoard } from './KanbanBoard.tsx';
import { TaskItem, User as UserType, UserRole } from '../../types/index.ts';
import { isTaskCreatedByUser } from '../../lib/task-sync.ts';

interface TeamTaskManagementProps {
  tasks: TaskItem[];
  users: UserType[];
  currentUser: UserType;
  userRole: UserRole;
  onRefresh: () => void;
}

export function TeamTaskManagement({
  tasks,
  users,
  currentUser,
  userRole,
  onRefresh,
}: TeamTaskManagementProps) {
  // Hanya menampilkan tugas yang dibuat/diberikan oleh akun admin/super admin yang sedang login sebagai PIC
  const myAssignedTasks = useMemo(() => {
    const list = Array.isArray(tasks) ? tasks : [];
    return list.filter((t) => isTaskCreatedByUser(t, currentUser));
  }, [tasks, currentUser]);

  return (
    <div className="space-y-4">
      {/* Render KanbanBoard untuk tugas yang diberikan oleh PIC akun ini */}
      <KanbanBoard
        tasks={myAssignedTasks}
        users={users}
        currentUser={currentUser}
        userRole={userRole}
        onRefresh={onRefresh}
      />
    </div>
  );
}
