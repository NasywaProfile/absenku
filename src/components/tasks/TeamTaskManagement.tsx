import React from 'react';
import { KanbanBoard } from './KanbanBoard.tsx';
import { TaskItem, User as UserType, UserRole } from '../../types/index.ts';
import { Users, Kanban } from 'lucide-react';

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
  return (
    <div className="space-y-4">
      {/* Render KanbanBoard untuk seluruh tim */}
      <KanbanBoard
        tasks={tasks}
        users={users}
        currentUser={currentUser}
        userRole={userRole}
        onRefresh={onRefresh}
      />
    </div>
  );
}
