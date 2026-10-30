import {
  LayoutDashboard,
  Clock,
  History,
  CalendarDays,
  Kanban,
  Building2,
  Users,
} from 'lucide-react';
import { UserRole } from '../../types/index.ts';

interface NavigationTabsProps {
  activeTab: string;
  onTabChange: (tabId: string) => void;
  userRole: UserRole;
  pendingLeavesCount: number;
  pendingTasksCount: number;
}

export function NavigationTabs({
  activeTab,
  onTabChange,
  userRole,
  pendingLeavesCount,
  pendingTasksCount,
}: NavigationTabsProps) {
  const tabs = [
    {
      id: 'dashboard',
      label: 'Dashboard',
      icon: LayoutDashboard,
      badge: null,
    },
    {
      id: 'clock',
      label: 'Presensi (Geofence)',
      icon: Clock,
      badge: null,
    },
    {
      id: 'history',
      label: userRole === 'ADMIN' ? 'Rekap Presensi' : 'Riwayat Presensi',
      icon: History,
      badge: null,
    },
    {
      id: 'leaves',
      label: 'Cuti & Izin',
      icon: CalendarDays,
      badge: pendingLeavesCount > 0 ? pendingLeavesCount : null,
      badgeColor: 'bg-amber-500 text-white',
    },
    {
      id: 'tasks',
      label: 'Kanban Tasks',
      icon: Kanban,
      badge: pendingTasksCount > 0 ? pendingTasksCount : null,
      badgeColor: 'bg-indigo-600 text-white',
    },
    ...(userRole === 'ADMIN'
      ? [
          {
            id: 'settings',
            label: 'Pengaturan Kantor',
            icon: Building2,
            badge: null,
          },
        ]
      : []),
  ];

  return (
    <nav className="w-full bg-white border-b border-slate-200/80 px-4 sm:px-6">
      <div className="max-w-7xl mx-auto flex items-center gap-1 sm:gap-2 overflow-x-auto py-2 scrollbar-none">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;

          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onTabChange(tab.id)}
              className={`relative flex items-center gap-2 px-3.5 py-2 rounded-2xl text-xs sm:text-sm font-semibold transition-all whitespace-nowrap shrink-0 ${
                isActive
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <Icon className="w-4 h-4 shrink-0" />
              <span>{tab.label}</span>

              {tab.badge !== null && (
                <span
                  className={`text-[10px] font-bold px-1.5 py-0.2 rounded-full ${
                    isActive ? 'bg-white text-blue-700' : tab.badgeColor || 'bg-slate-200 text-slate-700'
                  }`}
                >
                  {tab.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
