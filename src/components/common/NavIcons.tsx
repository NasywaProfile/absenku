import React from 'react';
import {
  LayoutDashboard,
  UserCheck,
  CalendarCheck,
  Clock,
  History,
  ClipboardList,
  CheckSquare,
  Kanban,
  MessageSquare,
  FileText,
  CalendarDays,
  FileCheck2,
  Building2,
  Users,
  UserPlus,
  MapPin,
} from 'lucide-react';

/**
 * Modern Clean Lucide Icons for Navbar & Sidebar
 * Sleek SaaS icon badges with soft background tints and Lucide React icons.
 * Each navigation item has a distinct contextual icon while maintaining
 * the exact consistent Navy Blue theme and styling.
 */

interface NavIconProps {
  tabId: string;
  isActive?: boolean;
  className?: string;
  iconClassName?: string;
}

export function NavIcon({
  tabId,
  isActive = false,
  className = "w-7 h-7",
  iconClassName,
}: NavIconProps) {
  const activeClass = isActive ? "scale-105 shadow-xs" : "opacity-90 hover:opacity-100";
  const iconBaseClass = `flex items-center justify-center rounded-xl transition-all duration-200 ${
    isActive 
      ? 'bg-[#1E3A8A] text-white shadow-[#1E3A8A]/20 shadow-sm' 
      : 'bg-indigo-50/80 text-[#1E3A8A] group-hover:bg-indigo-100/80 border border-indigo-200/80'
  } ${className} ${activeClass}`;

  const defaultIconClass = className.includes('w-5')
    ? 'w-3 h-3 stroke-[2]'
    : className.includes('w-6')
    ? 'w-3.5 h-3.5 stroke-[2]'
    : className.includes('w-8')
    ? 'w-4.5 h-4.5 stroke-[2]'
    : 'w-4 h-4 stroke-[2]';

  const icClass = iconClassName || defaultIconClass;

  switch (tabId) {
    case 'dashboard':
      return (
        <div className={iconBaseClass}>
          <LayoutDashboard className={icClass} />
        </div>
      );

    case 'profile':
      return (
        <div className={iconBaseClass}>
          <UserCheck className={icClass} />
        </div>
      );

    case 'absensi_folder':
      return (
        <div className={iconBaseClass}>
          <CalendarCheck className={icClass} />
        </div>
      );

    case 'clock':
      return (
        <div className={iconBaseClass}>
          <Clock className={icClass} />
        </div>
      );

    case 'history':
      return (
        <div className={iconBaseClass}>
          <History className={icClass} />
        </div>
      );

    case 'tugas_folder':
      return (
        <div className={iconBaseClass}>
          <ClipboardList className={icClass} />
        </div>
      );

    case 'tasks_my':
      return (
        <div className={iconBaseClass}>
          <CheckSquare className={icClass} />
        </div>
      );

    case 'tasks_team':
      return (
        <div className={iconBaseClass}>
          <Kanban className={icClass} />
        </div>
      );

    case 'tasks':
      return (
        <div className={iconBaseClass}>
          <ClipboardList className={icClass} />
        </div>
      );

    case 'chat':
    case 'chat_room':
      return (
        <div className={iconBaseClass}>
          <MessageSquare className={icClass} />
        </div>
      );

    case 'pengajuan_folder':
      return (
        <div className={iconBaseClass}>
          <FileText className={icClass} />
        </div>
      );

    case 'leaves_my':
      return (
        <div className={iconBaseClass}>
          <CalendarDays className={icClass} />
        </div>
      );

    case 'leaves_approval':
      return (
        <div className={iconBaseClass}>
          <FileCheck2 className={icClass} />
        </div>
      );

    case 'leaves':
      return (
        <div className={iconBaseClass}>
          <FileText className={icClass} />
        </div>
      );

    case 'karyawan_folder':
      return (
        <div className={iconBaseClass}>
          <Building2 className={icClass} />
        </div>
      );

    case 'employees':
      return (
        <div className={iconBaseClass}>
          <Users className={icClass} />
        </div>
      );

    case 'employee_approvals':
      return (
        <div className={iconBaseClass}>
          <UserPlus className={icClass} />
        </div>
      );

    case 'settings':
      return (
        <div className={iconBaseClass}>
          <MapPin className={icClass} />
        </div>
      );

    default:
      return (
        <div className={iconBaseClass}>
          <LayoutDashboard className={icClass} />
        </div>
      );
  }
}
