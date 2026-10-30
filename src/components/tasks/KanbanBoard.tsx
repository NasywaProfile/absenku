import React, { useState, useRef, useEffect } from 'react';
import {
  Plus,
  Maximize2,
  Minimize2,
  Clock,
  CheckCircle2,
  Calendar,
  AlertCircle,
  Tag,
  Search,
  Filter,
  ArrowRight,
  ShieldCheck,
  X,
  Trash2,
  User,
  Sparkles,
  ArrowUpRight,
  RotateCcw,
  Paperclip,
  Link2,
  FileText,
  ExternalLink,
  Download,
  Upload,
  FileUp,
  Image as ImageIcon,
  MessageSquare,
  Send,
  CornerDownRight,
  Check,
  FileCheck,
  HelpCircle,
  CheckSquare,
  Globe,
  ChevronDown,
  ArrowUp,
} from 'lucide-react';
import { TaskItem, TaskPriority, TaskStatus, TaskAttachment, TaskActivity, TaskAssignee, User as UserType, UserRole } from '../../types/index.ts';
import { AppStorage } from '../../lib/storage.ts';
import { Tooltip } from '../ui/tooltip.tsx';
import { formatIndonesianDate, formatIndonesianDateShort } from '../../lib/time-utils.ts';
import { ModernConfirmDialog } from '../common/ModernConfirmDialog.tsx';
import { EmptyStateTaskIllustration, SuccessCheckIllustration } from '../common/Illustrations.tsx';
import { compressImageFile } from '../../lib/image-compression.ts';
import { uploadToCloudinary } from '../../lib/cloudinary.ts';
import { uploadHybridFile } from '../../lib/file-uploader.ts';
import { Bubble, BubbleContent, BubbleGroup, BubbleReactions } from '../ui/bubble.tsx';
import { MediaPreviewModal, MediaPreviewData } from '../common/MediaPreviewModal.tsx';
import { openExternalLink, openAttachmentDirectly, isImageFile } from '../../lib/open-media.ts';

interface KanbanBoardProps {
  tasks: TaskItem[];
  users: UserType[];
  currentUser: UserType;
  userRole: UserRole;
  onRefresh: () => void;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

function sanitizeNoteText(note?: string): string {
  if (!note) return '';
  if (note.trim() === 'Disahkan oleh Admin.' || note.trim() === 'Disahkan oleh Admin') {
    return 'Penugasan Selesai';
  }
  return note;
}

// Helper untuk format nama ringkas pada user chip (misal: "Hendra Pratama" -> "Hendra P.")
function formatChipName(fullName?: string): string {
  if (!fullName) return 'User';
  const parts = fullName.trim().split(/\s+/);
  if (parts.length <= 1) return parts[0];
  return `${parts[0]} ${parts[1][0]}.`;
}

// Helper untuk format pemisah tanggal chat (Date Divider)
function formatActivityDateDivider(ts?: string): string {
  if (!ts) return 'Hari ini';
  try {
    const rawDate = ts.includes(' ') ? ts.split(' ')[0] : ts.includes('T') ? ts.split('T')[0] : ts;
    const today = new Date().toISOString().split('T')[0];
    if (rawDate === today) return 'Hari ini';

    const yesterdayObj = new Date();
    yesterdayObj.setDate(yesterdayObj.getDate() - 1);
    const yesterday = yesterdayObj.toISOString().split('T')[0];
    if (rawDate === yesterday) return 'Kemarin';

    const d = new Date(rawDate);
    if (!isNaN(d.getTime())) {
      return d.toLocaleDateString('id-ID', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      });
    }
    return rawDate;
  } catch {
    return 'Hari ini';
  }
}

// Helper untuk mengambil jam kecil (HH:MM)
function extractActivityTime(ts?: string): string {
  if (!ts) return '';
  if (ts.includes(' ')) {
    const parts = ts.split(' ');
    const last = parts[parts.length - 1];
    if (/^\d{1,2}:\d{2}/.test(last)) {
      return last.substring(0, 5);
    }
  }
  if (ts.includes('T')) {
    const timePart = ts.split('T')[1];
    if (timePart) return timePart.substring(0, 5);
  }
  const match = ts.match(/(\d{1,2}:\d{2})/);
  if (match) return match[1];
  return ts;
}

// Helper untuk menyusun riwayat percakapan/aktivitas pengerjaan
function getTaskActivities(task: TaskItem, users: UserType[]): TaskActivity[] {
  let rawList: TaskActivity[] = [];
  if (Array.isArray(task.activities)) {
    rawList = task.activities;
  } else {
    const adminUser = users.find((u) => u.id === task.createdBy || u.role === 'ADMIN') || {
      id: task.createdBy,
      name: 'Administrator (PIC)',
      role: 'ADMIN' as const,
      avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&w=256&q=80',
    };
    const empUser = users.find((u) => u.id === task.assignedTo) || {
      id: task.assignedTo,
      name: task.assignedName,
      role: 'EMPLOYEE' as const,
      avatar: task.assignedAvatar,
    };

    const synthesized: TaskActivity[] = [];

    // 1. Submission notes jika ada
    if (task.submissionNotes || task.status === 'DONE' || task.status === 'REVIEWED') {
      const empAtts = (task.attachments || []).filter((a) => a.uploadedBy !== task.createdBy && a.stage !== 'TODO');
      synthesized.push({
        id: `act-sub-${task.id}`,
        type: 'SUBMITTED',
        userId: empUser.id,
        userName: empUser.name,
        userAvatar: empUser.avatar,
        userRole: 'EMPLOYEE',
        timestamp: task.updatedAt + ' 16:30',
        notes: task.submissionNotes || 'Bukti & hasil kerja diserahkan untuk ditinjau oleh PIC.',
        attachments: empAtts,
      });
    }

    // 2. Approval or revision
    if (task.status === 'REVIEWED') {
      synthesized.push({
        id: `act-app-${task.id}`,
        type: 'APPROVED',
        userId: adminUser.id,
        userName: adminUser.name,
        userAvatar: adminUser.avatar,
        userRole: 'ADMIN',
        timestamp: task.updatedAt + ' 17:00',
        notes: task.reviewNotes || 'Penugasan Selesai (ACC oleh PIC)',
        attachments: [],
      });
    } else if (task.reviewNotes) {
      synthesized.push({
        id: `act-rev-${task.id}`,
        type: 'REVISION_REQUESTED',
        userId: adminUser.id,
        userName: adminUser.name,
        userAvatar: adminUser.avatar,
        userRole: 'ADMIN',
        timestamp: task.updatedAt + ' 17:15',
        notes: task.reviewNotes,
        attachments: [],
      });
    }
    rawList = synthesized;
  }

  // Filter out any activity that purely duplicates task description or is an initial creation log
  const cleaned = rawList.filter((act) => {
    if (act.type === 'CREATED') return false;
    if (act.id?.startsWith('act-init-')) return false;
    if (act.id?.startsWith('act-ack-')) return false;
    if (act.notes && task.description && act.notes.trim() === task.description.trim()) return false;
    return true;
  });

  return cleaned.map((act) => ({
    ...act,
    notes: sanitizeNoteText(act.notes),
  }));
}

export function KanbanBoard({
  tasks,
  users,
  currentUser,
  userRole,
  onRefresh,
}: KanbanBoardProps) {
  const isAdmin = userRole === 'ADMIN' || userRole === 'SUPER_ADMIN';
  const [taskViewMode, setTaskViewMode] = useState<'BOARD' | 'TABLE'>('BOARD');
  const [searchTerm, setSearchTerm] = useState('');
  const [assigneeFilter, setAssigneeFilter] = useState<string>('ALL');
  const [createdDateCustom, setCreatedDateCustom] = useState<string>('');
  const [deadlineCustom, setDeadlineCustom] = useState<string>('');
  const [mobileColumnFilter, setMobileColumnFilter] = useState<string>('ALL');
  const [isMobileFilterOpen, setIsMobileFilterOpen] = useState(false);

  const handleResetFilters = () => {
    setSearchTerm('');
    setAssigneeFilter('ALL');
    setCreatedDateCustom('');
    setDeadlineCustom('');
    setMobileColumnFilter('ALL');
  };

  const hasActiveFilters =
    Boolean(searchTerm) ||
    assigneeFilter !== 'ALL' ||
    Boolean(createdDateCustom) ||
    Boolean(deadlineCustom) ||
    mobileColumnFilter !== 'ALL';

  const handleToggleTodays = (taskId: string) => {
    AppStorage.toggleTaskTodays(taskId);
    onRefresh();
  };

  // Modal states
  const [showCreateModal, setShowCreateModal] = useState<boolean>(false);
  const [activeTaskDetail, setActiveTaskDetail] = useState<TaskItem | null>(null);
  const [isTaskDetailFullScreen, setIsTaskDetailFullScreen] = useState(false);
  const [isCreateModalFullScreen, setIsCreateModalFullScreen] = useState(false);

  const [taskToDelete, setTaskToDelete] = useState<string | null>(null);

  // Form states for new task (Admin)
  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newPriority, setNewPriority] = useState<TaskPriority>('MEDIUM');
  const assignableUsers = users.filter((u) => u.role !== 'SUPER_ADMIN');
  const [newAssigneeIds, setNewAssigneeIds] = useState<string[]>(() => {
    const defaultUser = assignableUsers[0]?.id || users[0]?.id;
    return defaultUser ? [defaultUser] : [];
  });
  const [assigneeSearchQuery, setAssigneeSearchQuery] = useState('');
  const [newDueDate, setNewDueDate] = useState<string>('');
  const [createAttachments, setCreateAttachments] = useState<TaskAttachment[]>([]);
  const [createTaskUploadError, setCreateTaskUploadError] = useState<string | null>(null);
  const [createLinkTitle, setCreateLinkTitle] = useState('');
  const [createLinkUrl, setCreateLinkUrl] = useState('');
  const [showCreateAddLink, setShowCreateAddLink] = useState(false);

  // State Tunggal Pengiriman Preview Tugas & Catatan Review
  const [previewNote, setPreviewNote] = useState('');
  const [previewAttachments, setPreviewAttachments] = useState<TaskAttachment[]>([]);
  const [showPreviewAddLink, setShowPreviewAddLink] = useState(false);
  const [previewLinkTitle, setPreviewLinkTitle] = useState('');
  const [previewLinkUrl, setPreviewLinkUrl] = useState('');
  const [picDecision, setPicDecision] = useState<'APPROVE' | 'REVISION' | 'NOTE'>('APPROVE');
  const [mediaPreview, setMediaPreview] = useState<MediaPreviewData | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (activeTaskDetail) {
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    }
  }, [activeTaskDetail?.id, activeTaskDetail?.activities?.length, activeTaskDetail?.status]);

  const openTaskDetail = (task: TaskItem) => {
    setIsTaskDetailFullScreen(false);
    setActiveTaskDetail(task);
    setPreviewNote('');
    setPreviewAttachments([]);
    setShowPreviewAddLink(false);
    setPreviewLinkTitle('');
    setPreviewLinkUrl('');
    setPicDecision('APPROVE');
  };

  // 4 Kolom Kanban Bersih Ala Vercel/Linear
  const COLUMNS: { id: TaskStatus; label: string; shortLabel: string; headerStyle: string }[] = [
    {
      id: 'TODO',
      label: 'Penugasan',
      shortLabel: 'Penugasan',
      headerStyle: 'bg-slate-100 text-slate-700 border-slate-200 font-bold',
    },
    {
      id: 'IN_PROGRESS',
      label: 'Dalam Proses',
      shortLabel: 'Dalam',
      headerStyle: 'bg-sky-100 text-sky-800 border-sky-200 font-bold shadow-2xs',
    },
    {
      id: 'DONE',
      label: 'Tinjauan Tugas',
      shortLabel: 'Tinjauan',
      headerStyle: 'bg-amber-100 text-amber-800 border-amber-200 font-bold shadow-2xs',
    },
    {
      id: 'REVIEWED',
      label: 'Selesai',
      shortLabel: 'Selesai',
      headerStyle: 'bg-emerald-100 text-emerald-800 border-emerald-200 font-bold shadow-2xs',
    },
  ];

  const handleUpdateStatus = (
    taskId: string,
    targetStatus: TaskStatus,
    notes?: { submissionNotes?: string; reviewNotes?: string; newAttachments?: TaskAttachment[] }
  ) => {
    AppStorage.updateTaskStatus(taskId, targetStatus, {
      ...notes,
      activityUser: {
        id: currentUser.id,
        name: currentUser.name,
        role: userRole,
        avatar: currentUser.avatar,
      },
    });
    onRefresh();
    if (activeTaskDetail && activeTaskDetail.id === taskId) {
      const updated = AppStorage.getTasks().find((t) => t.id === taskId);
      setActiveTaskDetail(updated || null);
    }
  };

  // Upload Handler untuk Form Buat Tugas Baru (Hybrid Cloudinary & VPS dengan validasi ukuran & jenis)
  const handleCreateFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setCreateTaskUploadError(null);

    for (const file of Array.from(files)) {
      try {
        const uploadRes = await uploadHybridFile(file, { folder: 'absenku/tasks' });
        const newAtt: TaskAttachment = {
          id: `att-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          name: uploadRes.name,
          type: 'FILE',
          url: uploadRes.url,
          fileType: uploadRes.type,
          fileSize: formatBytes(uploadRes.size),
          uploadedBy: currentUser.id,
          uploadedByName: currentUser.name,
          uploadedAt: new Date().toISOString().replace('T', ' ').substring(0, 16),
          stage: 'TODO',
        };
        setCreateAttachments((prev) => [...prev, newAtt]);
      } catch (err: any) {
        setCreateTaskUploadError(err.message || 'Gagal mengunggah berkas.');
      }
    }
    e.target.value = '';
  };

  const handleCreateAddLink = () => {
    if (!createLinkUrl.trim()) return;
    let url = createLinkUrl.trim();
    if (!/^https?:\/\//i.test(url)) {
      url = 'https://' + url;
    }
    const newAtt: TaskAttachment = {
      id: `att-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      name: createLinkTitle.trim() || url,
      type: 'LINK',
      url,
      uploadedBy: currentUser.id,
      uploadedByName: currentUser.name,
      uploadedAt: new Date().toISOString().replace('T', ' ').substring(0, 16),
      stage: 'TODO',
    };
    setCreateAttachments((prev) => [...prev, newAtt]);
    setCreateLinkTitle('');
    setCreateLinkUrl('');
    setShowCreateAddLink(false);
  };

  const handleCreateTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !newDueDate) return;
    if (newAssigneeIds.length === 0) {
      alert('Pilih setidaknya satu anggota tim yang ditugaskan.');
      return;
    }

    const selectedUsers = users.filter((u) => newAssigneeIds.includes(u.id));
    const primaryUser = selectedUsers[0] || assignableUsers[0] || users[0];

    const assigneesList: TaskAssignee[] = selectedUsers.map((u) => ({
      id: u.id,
      name: u.name,
      avatar: u.avatar,
      department: u.department,
    }));

    const formattedAssignedName = selectedUsers.length === 1
      ? primaryUser.name
      : `${primaryUser.name} (+${selectedUsers.length - 1} lainnya)`;

    AppStorage.addTask({
      id: `task-${Date.now()}`,
      status: 'TODO',
      createdAt: new Date().toISOString().substring(0, 10),
      updatedAt: new Date().toISOString().substring(0, 10),
      title: newTitle.trim(),
      description: newDesc.trim(),
      priority: newPriority,
      assignedTo: primaryUser.id,
      assignedName: formattedAssignedName,
      assignedAvatar: primaryUser.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80',
      assignees: assigneesList,
      createdBy: currentUser.id,
      dueDate: newDueDate,
      tags: ['Tugas Tim'],
      attachments: createAttachments,
    });

    onRefresh();
    setShowCreateModal(false);
    setNewTitle('');
    setNewDesc('');
    setNewPriority('MEDIUM');
    setNewDueDate('');
    const defaultUser = assignableUsers[0]?.id || users[0]?.id;
    setNewAssigneeIds(defaultUser ? [defaultUser] : []);
    setAssigneeSearchQuery('');
    setCreateAttachments([]);
  };

  // ========================================================
  // HANDLERS UNTUK PENGIRIMAN PREVIEW DELIVERABLE & CATATAN
  // ========================================================
  const handlePreviewFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    for (const file of Array.from(files)) {
      let fileUrl = '';
      try {
        const cloudRes = await uploadToCloudinary(file, { folder: 'absenku/tasks' });
        fileUrl = cloudRes.url;
      } catch (err) {
        console.warn('Cloudinary upload fallback to base64:', err);
        fileUrl = await compressImageFile(file);
      }
      const newAtt: TaskAttachment = {
        id: `att-prev-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        name: file.name,
        type: 'FILE',
        url: fileUrl,
        fileType: file.type || 'application/octet-stream',
        fileSize: formatBytes(file.size),
        uploadedBy: currentUser.id,
        uploadedByName: currentUser.name,
        uploadedAt: new Date().toISOString().replace('T', ' ').substring(0, 16),
        stage: 'DONE',
      };
      setPreviewAttachments((prev) => [...prev, newAtt]);
    }
    e.target.value = '';
  };

  const handlePreviewAddLink = () => {
    if (!previewLinkUrl.trim()) return;
    let url = previewLinkUrl.trim();
    if (!/^https?:\/\//i.test(url)) url = 'https://' + url;
    const newAtt: TaskAttachment = {
      id: `att-prev-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      name: previewLinkTitle.trim() || url,
      type: 'LINK',
      url,
      uploadedBy: currentUser.id,
      uploadedByName: currentUser.name,
      uploadedAt: new Date().toISOString().replace('T', ' ').substring(0, 16),
      stage: 'DONE',
    };
    setPreviewAttachments((prev) => [...prev, newAtt]);
    setPreviewLinkTitle('');
    setPreviewLinkUrl('');
    setShowPreviewAddLink(false);
  };

  // 1. Eksekusi "Kirim Preview" (Pelaksana / Assignee)
  // Otomatis ubah status ke 'DONE' (Preview Tugas / Perlu Review) dan simpan berkas deliverable
  const handleSendPreview = () => {
    if (!activeTaskDetail) return;
    if (!previewNote.trim() && previewAttachments.length === 0) return;

    const note = previewNote.trim() || 'Hasil preview tugas dilampirkan untuk ditinjau oleh PIC.';

    handleUpdateStatus(activeTaskDetail.id, 'DONE', {
      submissionNotes: note,
      newAttachments: previewAttachments,
    });

    setPreviewNote('');
    setPreviewAttachments([]);
    setShowPreviewAddLink(false);
  };

  // 2. Eksekusi "Kirim Catatan Review" (PIC / Evaluator)
  const handlePicSubmitReview = () => {
    if (!activeTaskDetail) return;
    const note = previewNote.trim();

    if (picDecision === 'APPROVE') {
      handleUpdateStatus(activeTaskDetail.id, 'REVIEWED', {
        reviewNotes: note || 'Penugasan Selesai (ACC oleh PIC)',
        newAttachments: previewAttachments,
      });
    } else if (picDecision === 'REVISION') {
      handleUpdateStatus(activeTaskDetail.id, 'IN_PROGRESS', {
        reviewNotes: note || 'Mohon disempurnakan kembali sesuai catatan arahan dari PIC.',
        newAttachments: previewAttachments,
      });
    } else {
      // NOTE (Catatan Saja)
      const activity: TaskActivity = {
        id: `act-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        type: 'COMMENT_ADDED',
        userId: currentUser.id,
        userName: currentUser.name,
        userAvatar: currentUser.avatar,
        userRole: userRole,
        timestamp: new Date().toISOString().replace('T', ' ').substring(0, 16),
        notes: note || 'Catatan arahan dari PIC.',
        attachments: previewAttachments,
      };
      AppStorage.addTaskActivity(activeTaskDetail.id, activity);
      onRefresh();
      const updated = AppStorage.getTasks().find((t) => t.id === activeTaskDetail.id);
      if (updated) setActiveTaskDetail(updated);
    }

    setPreviewNote('');
    setPreviewAttachments([]);
    setShowPreviewAddLink(false);
  };

  // 3. Tambah Catatan Tambahan (saat tugas sudah selesai atau catatan umum)
  const handleAddGeneralNote = () => {
    if (!activeTaskDetail) return;
    if (!previewNote.trim() && previewAttachments.length === 0) return;

    const activity: TaskActivity = {
      id: `act-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      type: 'COMMENT_ADDED',
      userId: currentUser.id,
      userName: currentUser.name,
      userAvatar: currentUser.avatar,
      userRole: userRole,
      timestamp: new Date().toISOString().replace('T', ' ').substring(0, 16),
      notes: previewNote.trim(),
      attachments: previewAttachments,
    };
    AppStorage.addTaskActivity(activeTaskDetail.id, activity);
    onRefresh();
    const updated = AppStorage.getTasks().find((t) => t.id === activeTaskDetail.id);
    if (updated) setActiveTaskDetail(updated);

    setPreviewNote('');
    setPreviewAttachments([]);
    setShowPreviewAddLink(false);
  };

  // 4. Mulai Kerjakan Tugas (Status IN_PROGRESS)
  const handleStartTask = () => {
    if (!activeTaskDetail) return;
    handleUpdateStatus(activeTaskDetail.id, 'IN_PROGRESS');
  };

  const handleDeleteTask = (taskId: string) => {
    setTaskToDelete(taskId);
  };

  const executeDeleteTask = (taskId: string) => {
    AppStorage.deleteTask(taskId);
    onRefresh();
    if (activeTaskDetail && activeTaskDetail.id === taskId) {
      setActiveTaskDetail(null);
    }
  };

  const handleDeleteActivity = (actId: string) => {
    if (!activeTaskDetail) return;
    AppStorage.deleteTaskActivity(activeTaskDetail.id, actId);
    onRefresh();
    const updated = AppStorage.getTasks().find((t) => t.id === activeTaskDetail.id);
    if (updated) setActiveTaskDetail(updated);
  };

  // Filter Tasks
  const filteredTasks = tasks.filter((t) => {
    const matchesSearch =
      !searchTerm ||
      t.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (t.assignedName && t.assignedName.toLowerCase().includes(searchTerm.toLowerCase())) ||
      Boolean(t.assignees?.some((a) => a.name.toLowerCase().includes(searchTerm.toLowerCase())));

    const matchesAssignee =
      assigneeFilter === 'ALL' ||
      t.assignedTo === assigneeFilter ||
      Boolean(t.assignees?.some((a) => a.id === assigneeFilter));

    const matchesCreatedDate = (() => {
      if (!createdDateCustom) return true;
      return Boolean(t.createdAt && t.createdAt.includes(createdDateCustom));
    })();

    const matchesDeadlineDate = (() => {
      if (!deadlineCustom) return true;
      return Boolean(t.dueDate && t.dueDate.includes(deadlineCustom));
    })();

    return (
      matchesSearch &&
      matchesAssignee &&
      matchesCreatedDate &&
      matchesDeadlineDate
    );
  });

  const getPriorityBadge = (priority: TaskPriority) => {
    switch (priority) {
      case 'URGENT':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-50 text-rose-800 border border-rose-200">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-600 animate-pulse" />
            Mendesak
          </span>
        );
      case 'HIGH':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-orange-50 text-orange-800 border border-orange-200">
            <span className="w-1.5 h-1.5 rounded-full bg-orange-500" />
            Tinggi
          </span>
        );
      case 'MEDIUM':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-50 text-blue-800 border border-blue-200">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
            Sedang
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-100 text-slate-700 border border-slate-200">
            <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
            Rendah
          </span>
        );
    }
  };

  return (
    <div className="space-y-6 font-sans">
      
      {/* 1. FILTER & SEARCH TOOLBAR (Baris 1: View Toggle, Search & Primary Action; Baris 2: Dedicated Filter Strip) */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs p-3 sm:p-3.5 space-y-2.5 sm:space-y-3">
        {/* BARIS 1A: TAMPILAN KHUSUS MOBILE (< sm) */}
        <div className="flex sm:hidden flex-col gap-2.5 pb-2.5 border-b border-slate-100">
          {/* 1. View Toggle: Papan Tugas | Detail Tugas */}
          <div className="grid grid-cols-2 p-1 bg-slate-100/90 rounded-2xl border border-slate-200/80 h-11 text-xs font-semibold w-full">
            <button
              type="button"
              onClick={() => setTaskViewMode('BOARD')}
              className={`w-full h-9 rounded-xl transition-all cursor-pointer flex items-center justify-center text-center ${
                taskViewMode === 'BOARD'
                  ? 'bg-white text-slate-900 shadow-xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Papan Tugas
            </button>
            <button
              type="button"
              onClick={() => setTaskViewMode('TABLE')}
              className={`w-full h-9 rounded-xl transition-all cursor-pointer flex items-center justify-center text-center ${
                taskViewMode === 'TABLE'
                  ? 'bg-white text-slate-900 shadow-xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Detail Tugas
            </button>
          </div>

          {/* 2. Button Tambah Tugas Baru Dulu (Full Width) */}
          {isAdmin && (
            <button
              type="button"
              onClick={() => {
                setCreateAttachments([]);
                setShowCreateModal(true);
              }}
              className="w-full h-11 inline-flex items-center justify-center gap-2 px-4 bg-[#1E3A8A] hover:bg-[#172554] active:scale-[0.98] text-white rounded-2xl text-xs font-bold shadow-xs transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4 text-white stroke-[2.5]" />
              <span>Tambah Tugas Baru</span>
            </button>
          )}

          {/* 3. Kolom Search dengan Panah ke Bawah untuk Buka/Tutup Filter */}
          <div className="relative w-full flex items-center">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 pointer-events-none" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Cari tugas, deskripsi..."
              className="h-11 w-full pl-10 pr-12 bg-slate-50 hover:bg-white focus:bg-white border border-slate-200 rounded-2xl focus:outline-hidden focus:ring-2 focus:ring-[#1E3A8A] text-slate-900 text-xs transition-colors font-medium shadow-2xs"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className="absolute right-10 text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
                title="Hapus pencarian"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
            <button
              type="button"
              onClick={() => setIsMobileFilterOpen(!isMobileFilterOpen)}
              className={`absolute right-1.5 top-1/2 -translate-y-1/2 h-8 px-2 rounded-xl flex items-center justify-center transition-all cursor-pointer ${
                isMobileFilterOpen
                  ? 'bg-[#1E3A8A] text-white shadow-2xs'
                  : hasActiveFilters
                  ? 'bg-blue-100 text-[#1E3A8A] font-bold'
                  : 'text-slate-500 hover:text-slate-800 hover:bg-slate-200/60'
              }`}
              title={isMobileFilterOpen ? "Sembunyikan filter" : "Tampilkan filter"}
              aria-label="Toggle Filter"
            >
              <ChevronDown
                className={`w-4 h-4 transition-transform duration-200 ${
                  isMobileFilterOpen ? 'rotate-180' : ''
                }`}
              />
            </button>
          </div>
        </div>

        {/* BARIS 1B: TAMPILAN DESKTOP & TABLET (>= sm) - Tetap Normal */}
        <div className="hidden sm:flex sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
          {/* Sisi Kiri: Tab toggle view (Papan Tugas | Detail Tugas) */}
          <div className="p-1 bg-slate-100/90 rounded-2xl border border-slate-200/80 h-10 text-xs font-semibold inline-flex">
            <Tooltip content="Tampilkan tata letak kartu visual kanban alur pengerjaan" position="bottom">
              <button
                type="button"
                onClick={() => setTaskViewMode('BOARD')}
                className={`h-8 px-5 min-w-[120px] rounded-xl transition-all cursor-pointer flex items-center justify-center text-center ${
                  taskViewMode === 'BOARD'
                    ? 'bg-white text-slate-900 shadow-xs font-bold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Papan Tugas
              </button>
            </Tooltip>
            <Tooltip content="Tampilkan daftar seluruh tugas dalam tabel detail terstruktur" position="bottom">
              <button
                type="button"
                onClick={() => setTaskViewMode('TABLE')}
                className={`h-8 px-5 min-w-[120px] rounded-xl transition-all cursor-pointer flex items-center justify-center text-center ${
                  taskViewMode === 'TABLE'
                    ? 'bg-white text-slate-900 shadow-xs font-bold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Detail Tugas
              </button>
            </Tooltip>
          </div>

          {/* Sisi Tengah & Kanan: Search Bar + Tombol Utama */}
          <div className="flex items-center gap-3 flex-1 justify-end min-w-0">
            <div className="relative w-full max-w-md min-w-0">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Cari tugas, deskripsi..."
                className="h-10 w-full pl-9 pr-3.5 bg-slate-50 hover:bg-white focus:bg-white border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-[#1E3A8A] text-slate-900 text-xs transition-colors font-medium"
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 cursor-pointer"
                  title="Hapus pencarian"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {isAdmin && (
              <Tooltip content="Buat dan delegasikan tugas baru untuk anggota tim atau diri sendiri" position="bottom">
                <button
                  type="button"
                  onClick={() => {
                    setCreateAttachments([]);
                    setShowCreateModal(true);
                  }}
                  className="h-10 inline-flex items-center justify-center gap-2 px-5 bg-[#1E3A8A] hover:bg-[#172554] active:scale-[0.98] text-white rounded-xl text-xs font-semibold shadow-xs transition-all cursor-pointer shrink-0"
                >
                  <Plus className="w-4 h-4 text-white" />
                  <span>Tambah Tugas Baru</span>
                </button>
              </Tooltip>
            )}
          </div>
        </div>

        {/* BARIS 2: Dedicated Filter Strip (Desktop: selalu tampil | Mobile: hanya tampil jika panah filter diklik) */}
        <div className={`${isMobileFilterOpen ? 'flex' : 'hidden'} sm:flex flex-col lg:flex-row items-stretch lg:items-center gap-2.5 sm:gap-3 bg-slate-50/90 p-3 sm:p-2.5 md:p-3 rounded-2xl border border-slate-200/80 text-xs w-full animate-in fade-in slide-in-from-top-1 duration-150`}>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 sm:gap-3 flex-1 min-w-0">
            {/* Filter 1: Pelaksana Tugas (Assignee) */}
            <div
              className={`flex items-center gap-2.5 h-12 sm:h-10 px-4 sm:px-3 rounded-xl border transition-all shadow-2xs min-w-0 ${
                assigneeFilter !== 'ALL'
                  ? 'bg-blue-50 border-blue-300 text-[#1E3A8A] font-bold ring-1 ring-blue-300/40'
                  : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-700'
              }`}
            >
              <span className="text-xs font-semibold text-slate-500 whitespace-nowrap shrink-0">Pelaksana:</span>
              <div className="relative flex items-center flex-1 min-w-0">
                <select
                  value={assigneeFilter}
                  onChange={(e) => setAssigneeFilter(e.target.value)}
                  className="w-full appearance-none pr-6 bg-transparent font-semibold text-slate-900 text-xs focus:outline-hidden cursor-pointer truncate py-1.5"
                >
                  <option value="ALL">Semua Rekan</option>
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name}
                    </option>
                  ))}
                </select>
                <ChevronDown className="w-4 h-4 text-slate-400 absolute right-0 pointer-events-none shrink-0" />
              </div>
            </div>

            {/* Filter Khusus Mobile: Proses Tugas (Diletakkan persis di bawah Pelaksana pada tampilan Mobile) */}
            <div
              className={`sm:hidden flex items-center gap-2.5 h-12 px-4 rounded-xl border transition-all shadow-2xs min-w-0 ${
                mobileColumnFilter !== 'ALL'
                  ? 'bg-blue-50 border-blue-300 text-[#1E3A8A] font-bold ring-1 ring-blue-300/40'
                  : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-700'
              }`}
            >
              <span className="text-xs font-semibold text-slate-500 whitespace-nowrap shrink-0">Proses Tugas:</span>
              <div className="relative flex items-center flex-1 min-w-0">
                <select
                  value={mobileColumnFilter}
                  onChange={(e) => setMobileColumnFilter(e.target.value)}
                  className="w-full appearance-none pr-6 bg-transparent font-semibold text-slate-900 text-xs focus:outline-hidden cursor-pointer truncate py-1.5"
                >
                  <option value="ALL">Semua ({filteredTasks.length})</option>
                  {COLUMNS.map((col) => {
                    const count = filteredTasks.filter((t) => t.status === col.id).length;
                    return (
                      <option key={col.id} value={col.id}>
                        {col.label} ({count})
                      </option>
                    );
                  })}
                </select>
                <ChevronDown className="w-4 h-4 text-slate-400 absolute right-0 pointer-events-none shrink-0" />
              </div>
            </div>

            {/* Filter 2: Tanggal Dibuat */}
            <div
              className={`flex items-center gap-2.5 h-12 sm:h-10 px-4 sm:px-3 rounded-xl border transition-all shadow-2xs min-w-0 ${
                createdDateCustom
                  ? 'bg-blue-50 border-blue-300 text-[#1E3A8A] font-bold ring-1 ring-blue-300/40'
                  : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-700'
              }`}
            >
              <span className="text-xs font-semibold text-slate-500 whitespace-nowrap shrink-0">Tanggal Dibuat:</span>
              <input
                type="date"
                value={createdDateCustom}
                onChange={(e) => setCreatedDateCustom(e.target.value)}
                className="w-full bg-transparent text-xs text-slate-900 font-semibold focus:outline-hidden cursor-pointer min-w-0 py-1.5"
              />
              {createdDateCustom && (
                <button
                  type="button"
                  onClick={() => setCreatedDateCustom('')}
                  className="text-[#1E3A8A] hover:text-[#172554] cursor-pointer p-0.5 ml-0.5 shrink-0"
                  title="Hapus filter Tanggal Dibuat"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Filter 3: Tanggal Tenggat */}
            <div
              className={`flex items-center gap-2.5 h-12 sm:h-10 px-4 sm:px-3 rounded-xl border transition-all shadow-2xs min-w-0 ${
                deadlineCustom
                  ? 'bg-blue-50 border-blue-300 text-[#1E3A8A] font-bold ring-1 ring-blue-300/40'
                  : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-700'
              }`}
            >
              <span className="text-xs font-semibold text-slate-500 whitespace-nowrap shrink-0">Tanggal Tenggat:</span>
              <input
                type="date"
                value={deadlineCustom}
                onChange={(e) => setDeadlineCustom(e.target.value)}
                className="w-full bg-transparent text-xs text-slate-900 font-semibold focus:outline-hidden cursor-pointer min-w-0 py-1.5"
              />
              {deadlineCustom && (
                <button
                  type="button"
                  onClick={() => setDeadlineCustom('')}
                  className="text-[#1E3A8A] hover:text-[#172554] cursor-pointer p-0.5 ml-0.5 shrink-0"
                  title="Hapus filter Tanggal Tenggat"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Tombol Reset Filter */}
          {hasActiveFilters && (
            <button
              type="button"
              onClick={handleResetFilters}
              className="h-11 sm:h-9.5 md:h-10 px-4 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold border border-rose-200 text-xs flex items-center justify-center gap-1.5 cursor-pointer transition-all active:scale-95 shadow-2xs shrink-0 whitespace-nowrap"
              title="Hapus Semua Filter"
            >
              <X className="w-3.5 h-3.5" />
              <span>Reset Filter</span>
            </button>
          )}
        </div>
      </div>

      {/* 3. MODE TAMPILAN: PAPAN KANBAN / TABEL DETAIL */}
      {taskViewMode === 'BOARD' ? (
        <>
          {/* FOUR KANBAN COLUMNS */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5 items-start">
            {COLUMNS.map((column) => {
              const columnTasks = filteredTasks.filter((t) => t.status === column.id);
              const isVisibleOnMobile = mobileColumnFilter === 'ALL' || column.id === mobileColumnFilter;

              return (
                <div
                  key={column.id}
                  className={`${
                    isVisibleOnMobile ? 'flex' : 'hidden sm:flex'
                  } flex-col space-y-3 h-[500px] sm:h-[600px] md:h-[680px]`}
                >
                  {/* Column Header: Judul Proses & Angka Bersatu dalam 1 Container Ber-BG & Beradius */}
                  <div className={`flex items-center justify-between px-3.5 py-2.5 rounded-xl border shadow-2xs shrink-0 font-bold text-xs tracking-tight ${column.headerStyle}`}>
                    <span>{column.label}</span>
                    <span className="w-5 h-5 rounded-full bg-white text-slate-800 font-extrabold text-[11px] flex items-center justify-center shadow-2xs border border-white/80 shrink-0">
                      {columnTasks.length}
                    </span>
                  </div>

                  {/* Tasks List */}
                  <div className="space-y-4 flex-1 overflow-y-auto px-1.5 py-2.5 custom-scrollbar">
                    {columnTasks.length === 0 ? (
                      <div className="py-10 px-4 text-center text-slate-400 text-xs border border-dashed border-slate-200/90 rounded-2xl bg-slate-50/50 flex flex-col items-center justify-center gap-2">
                        <EmptyStateTaskIllustration className="w-16 h-16 opacity-75" />
                        <span className="font-semibold text-slate-500">Belum ada tugas di kolom ini</span>
                      </div>
                    ) : (
                      columnTasks.map((task) => {
                        const isMyTask = task.assignedTo === currentUser.id || Boolean(task.assignees?.some((a) => a.id === currentUser.id));
                        const isPIC = isAdmin || task.createdBy === currentUser.id;
                        const picUser = users.find((u) => u.id === task.createdBy || u.role === 'ADMIN');
                        const isTodays = task.isTodays ?? true;
                        const stageLabel =
                          task.status === 'TODO'
                            ? 'Penugasan'
                            : task.status === 'IN_PROGRESS'
                            ? 'Dalam Proses'
                            : task.status === 'DONE'
                            ? 'Preview Tugas'
                            : 'Selesai';

                        const stageBadgeColor =
                          task.status === 'REVIEWED'
                            ? 'bg-emerald-600 text-white shadow-xs'
                            : task.status === 'DONE'
                            ? 'bg-amber-500 text-white shadow-xs'
                            : task.status === 'IN_PROGRESS'
                            ? 'bg-sky-500 text-white shadow-xs'
                            : 'bg-slate-100 text-slate-800 border border-slate-200';

                        // Warna border kartu sesuai dengan warna border proses pengerjaan
                        const cardProcessBorder =
                          task.status === 'REVIEWED'
                            ? 'border-emerald-300 hover:border-emerald-500 hover:shadow-emerald-500/10'
                            : task.status === 'DONE'
                            ? 'border-amber-400 hover:border-amber-500 hover:shadow-amber-500/15'
                            : task.status === 'IN_PROGRESS'
                            ? 'border-sky-300 hover:border-sky-500 hover:shadow-sky-500/10'
                            : 'border-slate-300 hover:border-slate-400 hover:shadow-slate-500/5';

                        return (
                          <div
                            key={task.id}
                            onClick={() => openTaskDetail(task)}
                            className={`bg-white rounded-2xl p-5 border ${cardProcessBorder} shadow-2xs hover:shadow-md transition-all duration-200 cursor-pointer space-y-3.5 group`}
                          >
                            {/* Baris Atas: Priority Badge & 3 Dots Menu / Button Hapus jika Selesai */}
                            <div className="flex items-center justify-between gap-2">
                              <div>
                                {getPriorityBadge(task.priority)}
                              </div>

                              {task.status === 'REVIEWED' ? (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleDeleteTask(task.id);
                                  }}
                                  className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg cursor-pointer transition-colors"
                                  title="Hapus Tugas Selesai"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    openTaskDetail(task);
                                  }}
                                  className="p-1 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
                                  title="Opsi"
                                >
                                  <span className="text-base font-bold leading-none tracking-widest">&#8942;</span>
                                </button>
                              )}
                            </div>

                            {/* Judul Tugas */}
                            <h3 className="font-bold text-sm text-slate-900 leading-snug">
                              {task.title}
                            </h3>

                            {/* Deskripsi Singkat */}
                            {task.description && (
                              <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed">
                                {task.description}
                              </p>
                            )}

                            {/* Banner Peringatan Revisi jika sedang IN_PROGRESS dan ada catatan perbaikan */}
                            {task.status === 'IN_PROGRESS' && task.reviewNotes && (
                              <div className="p-2.5 bg-rose-50 border border-rose-200/80 rounded-xl text-[11px] text-rose-800 space-y-1">
                                <div className="flex items-center gap-1.5 font-bold text-rose-900">
                                  <RotateCcw className="w-3 h-3 text-rose-600 shrink-0" />
                                  <span>Perlu Revisi dari PIC:</span>
                                </div>
                                <p className="line-clamp-2 text-rose-700 italic font-medium leading-relaxed">
                                  "{task.reviewNotes}"
                                </p>
                              </div>
                            )}

                            {/* Hairline Divider */}
                            <div className="border-t border-slate-100 pt-2" />

                            {/* Footer: Overlapping Assignee Avatars (Kiri) & Deadline Date (Kanan) */}
                            <div className="flex items-center justify-between gap-2 text-xs">
                              {task.assignees && task.assignees.length > 0 ? (
                                <div className="flex items-center -space-x-2">
                                  {task.assignees.slice(0, 3).map((a, idx) => (
                                    a.avatar ? (
                                      <img
                                        key={idx}
                                        src={a.avatar}
                                        alt={a.name}
                                        className="w-7 h-7 rounded-full object-cover border-2 border-white shadow-2xs"
                                        title={`Pelaksana: ${a.name}`}
                                      />
                                    ) : (
                                      <div
                                        key={idx}
                                        className="w-7 h-7 rounded-full bg-amber-400 text-slate-900 border-2 border-white font-extrabold text-[10px] flex items-center justify-center shadow-2xs"
                                        title={`Pelaksana: ${a.name}`}
                                      >
                                        {a.name.substring(0, 2).toUpperCase()}
                                      </div>
                                    )
                                  ))}
                                  {task.assignees.length > 3 && (
                                    <div
                                      className="w-7 h-7 rounded-full bg-slate-200 text-slate-700 border-2 border-white font-bold text-[10px] flex items-center justify-center shadow-2xs"
                                      title={`${task.assignees.length - 3} pelaksana lainnya`}
                                    >
                                      +{task.assignees.length - 3}
                                    </div>
                                  )}
                                </div>
                              ) : (
                                <div className="flex items-center -space-x-2">
                                  <div className="w-7 h-7 rounded-full bg-amber-400 text-slate-900 border-2 border-white font-extrabold text-[10px] flex items-center justify-center shadow-2xs" title={`Pelaksana: ${task.assignedName}`}>
                                    {task.assignedName ? task.assignedName.substring(0, 2).toUpperCase() : 'AU'}
                                  </div>
                                  {task.assignedAvatar && (
                                    <img
                                      src={task.assignedAvatar}
                                      alt={task.assignedName}
                                      className="w-7 h-7 rounded-full object-cover border-2 border-white shadow-2xs"
                                      title={`Pelaksana: ${task.assignedName}`}
                                    />
                                  )}
                                </div>
                              )}

                              <span className="text-xs text-slate-400 font-normal">
                                {task.dueDate}
                              </span>
                            </div>

                            {/* Tombol Aksi Sesuai Flow Penugasan ke PIC */}
                            <div className="pt-1 flex flex-wrap items-center gap-1.5 text-xs">
                              {/* 1. TO-DO: Mulai Kerjakan (Jika tugas ini ditugaskan ke saya, baik Admin maupun Karyawan bisa Mulai Kerjakan!) */}
                              {task.status === 'TODO' && isMyTask && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleUpdateStatus(task.id, 'IN_PROGRESS');
                                  }}
                                  className="w-full py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-200 font-bold rounded-xl text-center transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-2xs"
                                >
                                  <span>Mulai Kerjakan</span>
                                  <ArrowRight className="w-3.5 h-3.5" />
                                </button>
                              )}

                              {/* 2. IN_PROGRESS: Kirim Hasil Tugas (Jika tugas ini ditugaskan ke saya, bisa kirim hasil tugas!) */}
                              {task.status === 'IN_PROGRESS' && isMyTask && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    openTaskDetail(task);
                                  }}
                                  className="w-full py-2 bg-[#1E3A8A] hover:bg-[#172554] text-white font-bold rounded-xl text-center transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-2xs"
                                  title="Buka Chat untuk Upload Bukti & Kirim Preview"
                                >
                                  <Send className="w-3.5 h-3.5 text-white" />
                                  <span>Kirim Hasil Tugas</span>
                                </button>
                              )}

                              {/* 3. PREVIEW (DONE): Otoritas PIC / Admin (ACC vs Revisi) */}
                              {task.status === 'DONE' && (
                                isPIC ? (
                                  <div className="grid grid-cols-2 gap-1.5 w-full">
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleUpdateStatus(task.id, 'REVIEWED', {
                                          reviewNotes: 'Penugasan Selesai (ACC oleh PIC)',
                                        });
                                      }}
                                      className="py-1.5 bg-emerald-100 hover:bg-emerald-200 text-emerald-800 border border-emerald-300 font-bold rounded-xl text-center transition-all shadow-2xs cursor-pointer flex items-center justify-center gap-1"
                                      title="Setujui Hasil Kerja (ACC)"
                                    >
                                      <Check className="w-3.5 h-3.5 text-emerald-700" />
                                      <span>ACC</span>
                                    </button>

                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        openTaskDetail(task);
                                      }}
                                      className="py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 font-bold rounded-xl text-center transition-all cursor-pointer flex items-center justify-center gap-1"
                                      title="Revisi"
                                    >
                                      <MessageSquare className="w-3.5 h-3.5 text-amber-700" />
                                      <span>Revisi</span>
                                    </button>
                                  </div>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      openTaskDetail(task);
                                    }}
                                    className="w-full py-2 bg-amber-50 hover:bg-amber-100 text-amber-800 font-bold rounded-xl text-center text-xs flex items-center justify-center gap-1.5 border border-amber-200/90 cursor-pointer shadow-2xs"
                                    title="Menunggu Review PIC"
                                  >
                                    <Clock className="w-3.5 h-3.5 text-amber-600 animate-pulse" />
                                    <span>Menunggu Review</span>
                                  </button>
                                )
                              )}

                              {/* 4. APPROVED (REVIEWED): Tugas Selesai */}
                              {task.status === 'REVIEWED' && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    openTaskDetail(task);
                                  }}
                                  className="w-full py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-bold rounded-xl text-center text-xs flex items-center justify-center gap-1.5 border border-emerald-200/90 cursor-pointer shadow-2xs"
                                  title="Buka Riwayat Diskusi & Hasil Kerja"
                                >
                                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                                  <span>Tugas Selesai</span>
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      ) : (
        /* TAMPILAN 2: TABEL DETAIL (Bahasa Indonesia, Tanpa OKR & Tanpa Aksi) */
        <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse min-w-[650px]">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/80 text-slate-700 font-bold text-xs">
                  <th className="py-3 px-4 font-bold whitespace-nowrap">Tugas</th>
                  <th className="py-3 px-3.5 font-bold whitespace-nowrap min-w-[160px]">Penanggung Jawab</th>
                  <th className="py-3 px-3.5 font-bold whitespace-nowrap min-w-[140px]">Tahapan Tugas</th>
                  <th className="py-3 px-3.5 font-bold whitespace-nowrap">Tenggat Waktu</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {filteredTasks.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-10 text-center text-slate-400 font-medium">
                      Tidak ada data tugas yang sesuai dengan filter.
                    </td>
                  </tr>
                ) : (
                  filteredTasks.map((task) => {
                    const stageLabel =
                      task.status === 'TODO'
                        ? 'Penugasan'
                        : task.status === 'IN_PROGRESS'
                        ? 'Dalam Proses'
                        : task.status === 'DONE'
                        ? 'Preview Tugas'
                        : 'Selesai';

                    const stageBadgeColor =
                      task.status === 'REVIEWED'
                        ? 'bg-emerald-600 text-white'
                        : task.status === 'DONE'
                        ? 'bg-amber-500 text-white'
                        : task.status === 'IN_PROGRESS'
                        ? 'bg-[#1E3A8A] text-white'
                        : 'bg-slate-600 text-white';

                    return (
                      <tr
                        key={task.id}
                        onClick={() => openTaskDetail(task)}
                        className="hover:bg-slate-50/80 transition-colors cursor-pointer group"
                      >
                        <td className="py-3.5 px-4 max-w-[280px]">
                          <div className="font-bold text-slate-900 leading-snug group-hover:text-indigo-600 transition-colors">
                            {task.title}
                          </div>
                          {task.description && (
                            <div className="text-[11px] text-slate-500 line-clamp-1 mt-0.5">
                              {task.description}
                            </div>
                          )}
                        </td>
                        <td className="py-3 px-3.5 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            {task.assignees && task.assignees.length > 0 ? (
                              <div className="flex items-center -space-x-1.5 shrink-0">
                                {task.assignees.slice(0, 3).map((a, idx) => (
                                  a.avatar ? (
                                    <img
                                      key={idx}
                                      src={a.avatar}
                                      alt={a.name}
                                      className="w-6 h-6 rounded-full object-cover border-2 border-white shadow-2xs"
                                      title={`Pelaksana: ${a.name}`}
                                    />
                                  ) : (
                                    <div
                                      key={idx}
                                      className="w-6 h-6 rounded-full bg-amber-400 text-slate-900 border-2 border-white font-extrabold text-[10px] flex items-center justify-center shadow-2xs"
                                      title={`Pelaksana: ${a.name}`}
                                    >
                                      {a.name.substring(0, 2).toUpperCase()}
                                    </div>
                                  )
                                ))}
                                {task.assignees.length > 3 && (
                                  <div
                                    className="w-6 h-6 rounded-full bg-slate-200 text-slate-700 border-2 border-white font-bold text-[9px] flex items-center justify-center shadow-2xs"
                                    title={`${task.assignees.length - 3} lainnya`}
                                  >
                                    +{task.assignees.length - 3}
                                  </div>
                                )}
                              </div>
                            ) : (
                              <div className="flex items-center -space-x-1.5 shrink-0">
                                <div className="w-6 h-6 rounded-full bg-amber-400 text-slate-900 border-2 border-white font-extrabold text-[10px] flex items-center justify-center shadow-2xs">
                                  {task.assignedName ? task.assignedName.substring(0, 2).toUpperCase() : 'AU'}
                                </div>
                                {task.assignedAvatar && (
                                  <img
                                    src={task.assignedAvatar}
                                    alt={task.assignedName}
                                    className="w-6 h-6 rounded-full object-cover border-2 border-white shadow-2xs"
                                  />
                                )}
                              </div>
                            )}
                            <span className="font-semibold text-slate-800 text-xs truncate max-w-[140px]">
                              {task.assignedName}
                            </span>
                          </div>
                        </td>
                        <td className="py-3 px-3.5 whitespace-nowrap">
                          <span className={`inline-flex items-center justify-center text-[11px] font-bold px-3 py-1 rounded-full whitespace-nowrap shadow-2xs ${stageBadgeColor}`}>
                            {stageLabel}
                          </span>
                        </td>
                        <td className="py-3 px-3.5 font-mono text-slate-700 text-xs whitespace-nowrap">
                          {task.dueDate || '-'}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 4. PANEL SLIDE-OVER SEBELAH KANAN: DETAIL TUGAS & DISKUSI */}
      {activeTaskDetail && (
        <div
          className={`fixed inset-0 z-50 flex animate-in fade-in duration-200 ${
            isTaskDetailFullScreen
              ? 'items-center justify-center p-0'
              : 'justify-end items-center p-2.5 sm:p-4 md:p-5'
          }`}
        >
          {/* Backdrop Blur */}
          <div
            className="fixed inset-0 bg-slate-950/40 backdrop-blur-xs transition-opacity cursor-pointer"
            onClick={() => setActiveTaskDetail(null)}
          />

          {/* Dialog Card */}
          <div
            className={`relative z-10 bg-white shadow-2xl flex flex-col min-h-0 overflow-hidden transition-all duration-300 font-sans ${
              isTaskDetailFullScreen
                ? 'w-full h-full max-w-none max-h-none rounded-none border-0'
                : 'w-full max-w-md sm:max-w-lg md:max-w-xl h-full max-h-[calc(100vh-1.25rem)] sm:max-h-[calc(100vh-2rem)] rounded-3xl border border-slate-200/80 animate-in slide-in-from-right duration-300 ease-out'
            }`}
          >
            
            {/* Header Drawer Ringkas, Lega & Terstruktur: Judul -> Deskripsi -> Inline Metadata */}
            <div className="px-5 py-4 border-b border-slate-100 bg-white space-y-3 shrink-0">
              {/* Baris Atas: Zoom (kiri), Judul & Deskripsi Tugas (tengah), Tutup Panel (kanan) */}
              <div className="flex items-start justify-between gap-3">
                {/* Zoom / Fullscreen Button di pojok kiri atas */}
                <div className="w-9 shrink-0 flex items-start">
                  <button
                    type="button"
                    onClick={() => setIsTaskDetailFullScreen(!isTaskDetailFullScreen)}
                    className="p-1.5 sm:p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl border border-slate-200/80 transition-colors cursor-pointer shrink-0 mt-0.5"
                    title={isTaskDetailFullScreen ? "Perkecil Tampilan" : "Perbesar Layar Penuh"}
                  >
                    {isTaskDetailFullScreen ? (
                      <Minimize2 className="w-4 h-4 text-slate-600" />
                    ) : (
                      <Maximize2 className="w-4 h-4 text-slate-600" />
                    )}
                  </button>
                </div>

                {/* Judul & Subjudul diposisikan di tengah persis seperti di Ruang Obrolan */}
                <div className="flex-1 min-w-0 text-center px-1 sm:px-3 space-y-1.5 flex flex-col items-center justify-center pt-2.5 sm:pt-3">
                  <h2 className="text-sm sm:text-[15px] font-bold text-slate-900 tracking-tight leading-snug max-w-2xl">
                    {activeTaskDetail.title}
                  </h2>
                  {activeTaskDetail.description && (
                    <p className="text-slate-500 text-[11px] sm:text-xs leading-relaxed font-normal whitespace-pre-wrap max-w-2xl">
                      {activeTaskDetail.description}
                    </p>
                  )}
                </div>

                {/* Container Tombol Tutup Panel di pojok kanan atas */}
                <div className="w-9 shrink-0 flex items-start justify-end">
                  <button
                    type="button"
                    onClick={() => setActiveTaskDetail(null)}
                    className="p-1.5 sm:p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer shrink-0 mt-0.5"
                    title="Tutup Panel"
                  >
                    <X className="w-4 h-4 sm:w-5 sm:h-5 text-slate-600" />
                  </button>
                </div>
              </div>

              {/* Garis Pemisah Tipis */}
              <div className="border-t border-slate-100 pt-0.5" />

              {/* Baris Metadata: Kiri (Status & Pelaksana), Kanan (Tanggal & PIC) - Tetap utuh */}
              {(() => {
                const activeTaskPicUser = users.find(
                  (u) => u.id === activeTaskDetail.createdBy || u.role === 'ADMIN'
                );
                const activeTaskPicName = activeTaskPicUser?.name || 'Administrator';
                const shortDueDate = formatIndonesianDateShort(activeTaskDetail.dueDate) || activeTaskDetail.dueDate;
                const isPICActive = isAdmin || activeTaskDetail.createdBy === currentUser.id;
                const isMyTaskActive = activeTaskDetail.assignedTo === currentUser.id || Boolean(activeTaskDetail.assignees?.some((a) => a.id === currentUser.id));

                return (
                  <div className="flex items-start justify-between gap-4 pt-0.5 text-xs text-slate-500">
                    {/* Kolom Kiri: Status di atas, Pelaksana di bawah */}
                    <div className="flex flex-col items-start gap-2 min-w-0">
                      {/* Baris 1: Status Badge */}
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span
                          className={`inline-flex items-center gap-1.5 font-semibold px-2.5 py-0.5 rounded-full text-[11px] border ${
                            activeTaskDetail.status === 'REVIEWED'
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : activeTaskDetail.status === 'DONE'
                              ? 'bg-amber-50 text-amber-700 border-amber-200'
                              : activeTaskDetail.status === 'IN_PROGRESS'
                              ? 'bg-blue-50 text-blue-600 border-blue-200'
                              : 'bg-slate-100 text-slate-700 border-slate-200'
                          }`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              activeTaskDetail.status === 'REVIEWED'
                                ? 'bg-emerald-600'
                                : activeTaskDetail.status === 'DONE'
                                ? 'bg-amber-500 animate-pulse'
                                : activeTaskDetail.status === 'IN_PROGRESS'
                                ? 'bg-blue-500 animate-pulse'
                                : 'bg-slate-400'
                            }`}
                          />
                          {activeTaskDetail.status === 'TODO' && 'Penugasan'}
                          {activeTaskDetail.status === 'IN_PROGRESS' && 'Dalam Proses'}
                          {activeTaskDetail.status === 'DONE' && 'Tinjauan Tugas'}
                          {activeTaskDetail.status === 'REVIEWED' && 'Selesai'}
                        </span>

                        {activeTaskDetail.status === 'TODO' && isMyTaskActive && (
                          <button
                            type="button"
                            onClick={handleStartTask}
                            className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded text-[11px] transition-colors cursor-pointer"
                          >
                            <ArrowRight className="w-3 h-3" />
                            <span>Mulai</span>
                          </button>
                        )}

                        {activeTaskDetail.status === 'REVIEWED' && isPICActive && (
                          <button
                            type="button"
                            onClick={() => {
                              handleUpdateStatus(activeTaskDetail.id, 'IN_PROGRESS', {
                                reviewNotes: 'Tugas dibuka kembali oleh PIC untuk penyesuaian lanjutan.',
                              });
                            }}
                            className="text-[11px] text-slate-500 hover:text-slate-800 font-medium underline underline-offset-2 cursor-pointer"
                          >
                            Buka Kembali
                          </button>
                        )}
                      </div>

                      {/* Baris 2: Pelaksana di bawah Dalam Proses */}
                      {activeTaskDetail.assignees && activeTaskDetail.assignees.length > 1 ? (
                        <div className="flex items-center gap-1.5 text-xs flex-wrap" title={`Pelaksana: ${activeTaskDetail.assignees.map((a) => a.name).join(', ')}`}>
                          <div className="flex items-center -space-x-1.5 shrink-0">
                            {activeTaskDetail.assignees.slice(0, 4).map((a, i) => (
                              a.avatar ? (
                                <img
                                  key={i}
                                  src={a.avatar}
                                  alt={a.name}
                                  title={a.name}
                                  className="w-5 h-5 rounded-full object-cover shrink-0 border border-white"
                                />
                              ) : (
                                <div
                                  key={i}
                                  className="w-5 h-5 rounded-full bg-slate-200 text-slate-700 font-bold text-[9px] flex items-center justify-center shrink-0 border border-white"
                                  title={a.name}
                                >
                                  {a.name.substring(0, 2).toUpperCase()}
                                </div>
                              )
                            ))}
                          </div>
                          <span className="font-medium text-slate-700 truncate max-w-[150px]">
                            {activeTaskDetail.assignees.map((a) => a.name.split(' ')[0]).join(', ')}
                          </span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5 text-xs" title={`Pelaksana: ${activeTaskDetail.assignedName}`}>
                          {activeTaskDetail.assignedAvatar ? (
                            <img
                              src={activeTaskDetail.assignedAvatar}
                              alt={activeTaskDetail.assignedName}
                              className="w-5 h-5 rounded-full object-cover shrink-0 border border-slate-200"
                            />
                          ) : (
                            <div className="w-5 h-5 rounded-full bg-slate-200 text-slate-700 font-bold text-[9px] flex items-center justify-center shrink-0">
                              {activeTaskDetail.assignedName
                                ? activeTaskDetail.assignedName.substring(0, 2).toUpperCase()
                                : 'ST'}
                            </div>
                          )}
                          <span className="font-medium text-slate-700">{formatChipName(activeTaskDetail.assignedName)}</span>
                        </div>
                      )}
                    </div>

                    {/* Kolom Kanan: Tanggal di atas, PIC di bawahnya (berjarak di sisi kanan) */}
                    <div className="flex flex-col items-end gap-2 shrink-0">
                      {/* Baris 1: Tanggal Tenggat */}
                      <div className="flex items-center gap-1.5 text-xs text-slate-500">
                        <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span className="text-slate-700 font-medium">{shortDueDate}</span>
                      </div>

                      {/* Baris 2: PIC di bawah Tanggal */}
                      <div className="flex items-center gap-1.5 text-xs" title={`PIC: ${activeTaskPicName}`}>
                        {activeTaskPicUser?.avatar ? (
                          <img
                            src={activeTaskPicUser.avatar}
                            alt={activeTaskPicName}
                            className="w-5 h-5 rounded-full object-cover shrink-0 border border-slate-200"
                          />
                        ) : (
                          <ShieldCheck className="w-4 h-4 text-indigo-600 shrink-0" />
                        )}
                        <span className="font-medium text-slate-700">{formatChipName(activeTaskPicName)}</span>
                        <span className="text-[10px] text-slate-400 font-normal">• PIC</span>
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>

            {(() => {
              const activeTaskPicUser = users.find(
                (u) => u.id === activeTaskDetail.createdBy || u.role === 'ADMIN'
              );
              const activeTaskPicName = activeTaskPicUser?.name || 'Administrator (PIC)';
              const isPICActive = isAdmin || activeTaskDetail.createdBy === currentUser.id;

              return (
                <>
                  {/* 2. MIDDLE CONTENT: AREA CHAT & RIWAYAT PREVIEW (Scrollable Independen) */}
                  <div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-5 space-y-3.5 bg-slate-50/40">

                    {(() => {
                      const activities = getTaskActivities(activeTaskDetail, users);

                      {/* Sederhanakan tampilan Empty State: kasual, ringkas & minimalis */}
                      if (activities.length === 0) {
                        return (
                          <div className="h-full flex-1 flex flex-col items-center justify-center py-10 px-6 text-center select-none">
                            <div className="w-8 h-8 rounded-full bg-slate-100/90 flex items-center justify-center mb-1.5 text-slate-300">
                              <MessageSquare className="w-3.5 h-3.5" />
                            </div>
                            <p className="text-xs text-slate-400 font-medium select-none">
                              Belum Ada Pesan
                            </p>
                          </div>
                        );
                      }

                      let lastDateKey = '';

                      return (
                        <div className="space-y-3 pb-2">
                          {activities.map((act, index) => {
                            const isMe = act.userId === currentUser.id;
                            const isImageAtt = (att: TaskAttachment) =>
                              att.url.startsWith('data:image/') ||
                              att.fileType?.startsWith('image/') ||
                              /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(att.name);

                            const isSenderPIC =
                              act.userRole === 'ADMIN' ||
                              act.userRole === 'SUPER_ADMIN' ||
                              act.userId === activeTaskDetail.createdBy;

                            const dateKey = formatActivityDateDivider(act.timestamp);
                            const showDateDivider = dateKey !== lastDateKey;
                            if (showDateDivider) {
                              lastDateKey = dateKey;
                            }

                            const timeOnly = extractActivityTime(act.timestamp) || act.timestamp;

                            return (
                              <React.Fragment key={act.id || index}>
                                {/* Pemisah Tanggal (Date Divider) */}
                                {showDateDivider && (
                                  <div className="flex items-center justify-center my-3 select-none">
                                    <div className="h-px bg-slate-200/90 flex-1" />
                                    <span className="mx-3 px-2.5 py-0.5 rounded-full bg-white border border-slate-200/80 text-[10px] font-semibold text-slate-500 tracking-wide shadow-2xs">
                                      {dateKey}
                                    </span>
                                    <div className="h-px bg-slate-200/90 flex-1" />
                                  </div>
                                )}

                                 {/* Bubble Chat Dua Sisi - Gaya Ruang Obrolan */}
                                {isMe ? (
                                  /* 2. Pesan dari Diri Sendiri (Kanan) */
                                  <div className="flex flex-col items-end self-end max-w-[80%] sm:max-w-[75%] ml-auto animate-in fade-in duration-150">
                                    {/* Bubble Chat Biru Khas iOS / Ruang Obrolan */}
                                    <div className="bg-[#007AFF] text-white px-4 py-2.5 rounded-2xl rounded-br-xs text-xs sm:text-sm leading-relaxed shadow-2xs">
                                      {act.type === 'SUBMITTED' && (
                                        <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-white/20 text-white text-[10px] font-bold mb-1">
                                          <FileCheck className="w-3 h-3" />
                                          <span>Preview Deliverable Diajukan</span>
                                        </div>
                                      )}

                                      {act.notes && (
                                        <div className="whitespace-pre-wrap">
                                          {act.notes.split(' ').map((word, idx) => {
                                            if (word.startsWith('@')) {
                                              return (
                                                <span
                                                  key={idx}
                                                  className="text-yellow-200 font-semibold bg-white/20 px-1 py-0.5 rounded-md mr-0.5"
                                                >
                                                  {word}{' '}
                                                </span>
                                              );
                                            }
                                            return word + ' ';
                                          })}
                                        </div>
                                      )}

                                      {/* Lampiran berkas / link */}
                                      {act.attachments && act.attachments.length > 0 && (
                                        <div className="pt-2 flex flex-wrap gap-2">
                                          {act.attachments.map((att) => {
                                            const isImg = isImageAtt(att) || isImageFile(att.url, att.fileType) || isImageFile(att.name, att.fileType);
                                            if (isImg && att.url && att.url !== '#') {
                                              return (
                                                <div
                                                  key={att.id}
                                                  onClick={() => setMediaPreview({
                                                    url: att.url,
                                                    name: att.name,
                                                    type: 'FILE',
                                                    fileType: att.fileType,
                                                    fileSize: att.fileSize,
                                                  })}
                                                  className="relative group overflow-hidden rounded-xl border border-white/40 max-w-[180px] cursor-pointer shadow-2xs hover:shadow-md transition-all"
                                                  title={`Buka gambar ${att.name}`}
                                                >
                                                  <img
                                                    src={att.url}
                                                    alt={att.name}
                                                    className="w-full h-24 object-cover rounded-xl transition-transform duration-200 group-hover:scale-105"
                                                  />
                                                  <div className="absolute inset-0 bg-slate-950/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white font-bold text-[10px] gap-1">
                                                    <Maximize2 className="w-3.5 h-3.5 text-white" />
                                                    <span>Buka</span>
                                                  </div>
                                                </div>
                                              );
                                            }
                                            return (
                                              <button
                                                key={att.id}
                                                type="button"
                                                onClick={() => {
                                                  if (att.type === 'LINK') {
                                                    openExternalLink(att.url);
                                                  } else {
                                                    setMediaPreview({
                                                      url: att.url,
                                                      name: att.name,
                                                      type: att.type,
                                                      fileType: att.fileType,
                                                      fileSize: att.fileSize,
                                                    });
                                                  }
                                                }}
                                                className="flex items-center gap-1.5 px-2.5 py-1.5 bg-white/25 hover:bg-white/35 active:scale-95 border border-white/30 rounded-xl text-[11px] font-semibold text-white transition-all cursor-pointer shadow-2xs"
                                                title={`Buka ${att.name}`}
                                              >
                                                {att.type === 'LINK' ? <Globe className="w-3.5 h-3.5" /> : <Paperclip className="w-3.5 h-3.5" />}
                                                <span className="truncate max-w-[130px]">{att.name}</span>
                                                <ExternalLink className="w-3 h-3 opacity-70 ml-0.5" />
                                              </button>
                                            );
                                          })}
                                        </div>
                                      )}
                                    </div>

                                    {/* Status / Timestamp */}
                                    <div className="flex items-center gap-1.5 mr-2 mt-1">
                                      <span className="text-[10px] text-gray-400">
                                        {timeOnly} · Terkirim
                                      </span>
                                      {(act.userId === currentUser.id || isAdmin) && (
                                        <button
                                          type="button"
                                          onClick={() => handleDeleteActivity(act.id)}
                                          className="text-rose-600 hover:text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200/80 p-0.5 rounded transition-all cursor-pointer"
                                          title="Hapus pesan"
                                        >
                                          <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                                        </button>
                                      )}
                                    </div>
                                  </div>
                                ) : (
                                  /* 1. Pesan dari Rekan / PIC (Kiri) */
                                  <div className="flex items-end gap-2 max-w-[80%] sm:max-w-[75%] animate-in fade-in duration-150">
                                    {/* Avatar di pojok kiri bawah */}
                                    <div className="w-7 h-7 rounded-full overflow-hidden bg-slate-200 border border-slate-300 shrink-0 mb-1">
                                      {act.userAvatar ? (
                                        <img
                                          src={act.userAvatar}
                                          alt={act.userName}
                                          className="w-full h-full object-cover"
                                        />
                                      ) : (
                                        <div className="w-full h-full flex items-center justify-center font-bold text-xs text-slate-700 bg-purple-100">
                                          {act.userName ? act.userName.charAt(0).toUpperCase() : 'U'}
                                        </div>
                                      )}
                                    </div>

                                    <div className="flex flex-col items-start min-w-0">
                                      {/* Nama Pengirim & Badge Role */}
                                      <div className="flex items-center gap-1.5 ml-3 mb-1">
                                        <span className="text-[11px] font-semibold text-gray-500">
                                          {act.userName}
                                        </span>
                                        {isSenderPIC ? (
                                          <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                                            PIC
                                          </span>
                                        ) : (
                                          <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-sky-50 text-sky-700 border border-sky-200">
                                            Pelaksana
                                          </span>
                                        )}
                                      </div>

                                      {/* Bubble Chat Abu-abu Khas iOS / Ruang Obrolan */}
                                      <div className="bg-[#E9E9EB] text-gray-900 px-4 py-2.5 rounded-2xl rounded-bl-xs text-xs sm:text-sm leading-relaxed shadow-2xs">
                                        {act.type === 'APPROVED' && (
                                          <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-600 text-white text-[10px] font-bold mb-1">
                                            <CheckCircle2 className="w-3 h-3" />
                                            <span>Penugasan Disetujui (ACC) - Selesai</span>
                                          </div>
                                        )}
                                        {act.type === 'REVISION_REQUESTED' && (
                                          <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-rose-600 text-white text-[10px] font-bold mb-1">
                                            <RotateCcw className="w-3 h-3" />
                                            <span>Arahan Revisi dari PIC</span>
                                          </div>
                                        )}
                                        {act.type === 'SUBMITTED' && (
                                          <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-sky-600 text-white text-[10px] font-bold mb-1">
                                            <FileCheck className="w-3 h-3" />
                                            <span>Preview Deliverable Diajukan</span>
                                          </div>
                                        )}

                                        {act.notes && (
                                          <div className="whitespace-pre-wrap">
                                            {act.notes.split(' ').map((word, idx) => {
                                              if (word.startsWith('@')) {
                                                return (
                                                  <span
                                                    key={idx}
                                                    className="text-[#007AFF] font-bold bg-blue-50/80 px-1 py-0.5 rounded-md border border-blue-200/60 mr-0.5"
                                                  >
                                                    {word}{' '}
                                                  </span>
                                                );
                                              }
                                              return word + ' ';
                                            })}
                                          </div>
                                        )}

                                        {/* Lampiran berkas / link */}
                                        {act.attachments && act.attachments.length > 0 && (
                                          <div className="pt-2 flex flex-wrap gap-2">
                                            {act.attachments.map((att) => {
                                              const isImg = isImageAtt(att) || isImageFile(att.url, att.fileType) || isImageFile(att.name, att.fileType);
                                              if (isImg && att.url && att.url !== '#') {
                                                return (
                                                  <div
                                                    key={att.id}
                                                    onClick={() => setMediaPreview({
                                                      url: att.url,
                                                      name: att.name,
                                                      type: 'FILE',
                                                      fileType: att.fileType,
                                                      fileSize: att.fileSize,
                                                    })}
                                                    className="relative group overflow-hidden rounded-xl border border-slate-300 max-w-[180px] cursor-pointer shadow-2xs hover:shadow-md transition-all"
                                                    title={`Buka gambar ${att.name}`}
                                                  >
                                                    <img
                                                      src={att.url}
                                                      alt={att.name}
                                                      className="w-full h-24 object-cover rounded-xl transition-transform duration-200 group-hover:scale-105"
                                                    />
                                                    <div className="absolute inset-0 bg-slate-950/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white font-bold text-[10px] gap-1">
                                                      <Maximize2 className="w-3.5 h-3.5 text-white" />
                                                      <span>Buka</span>
                                                    </div>
                                                  </div>
                                                );
                                              }
                                              return (
                                                <button
                                                  key={att.id}
                                                  type="button"
                                                  onClick={() => {
                                                    if (att.type === 'LINK') {
                                                      openExternalLink(att.url);
                                                    } else {
                                                      setMediaPreview({
                                                        url: att.url,
                                                        name: att.name,
                                                        type: att.type,
                                                        fileType: att.fileType,
                                                        fileSize: att.fileSize,
                                                      });
                                                    }
                                                  }}
                                                  className="flex items-center gap-1.5 px-2.5 py-1.5 bg-white hover:bg-slate-50 active:scale-95 border border-slate-200 rounded-xl text-[11px] font-semibold text-[#1E3A8A] transition-all cursor-pointer shadow-2xs"
                                                  title={`Buka ${att.name}`}
                                                >
                                                  {att.type === 'LINK' ? <Globe className="w-3.5 h-3.5" /> : <Paperclip className="w-3.5 h-3.5" />}
                                                  <span className="truncate max-w-[130px]">{att.name}</span>
                                                  <ExternalLink className="w-3 h-3 opacity-70 ml-0.5" />
                                                </button>
                                              );
                                            })}
                                          </div>
                                        )}
                                      </div>

                                      {/* Status / Timestamp */}
                                      <div className="flex items-center gap-1.5 ml-3 mt-1">
                                        <span className="text-[10px] text-gray-400">
                                          {timeOnly}
                                        </span>
                                        {(act.userId === currentUser.id || isAdmin) && (
                                          <button
                                            type="button"
                                            onClick={() => handleDeleteActivity(act.id)}
                                            className="text-rose-600 hover:text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200/80 p-0.5 rounded transition-all cursor-pointer"
                                            title="Hapus pesan"
                                          >
                                            <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                                          </button>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                )}
                              </React.Fragment>
                            );
                          })}
                          <div ref={messagesEndRef} />
                        </div>
                      );
                    })()}
                  </div>

                  {/* 3. BOTTOM CHAT INPUT BAR: Ramping, Melekat di Bawah */}
                  <div className="p-3 sm:p-4 border-t border-slate-100 bg-white shrink-0 space-y-2">
                    {/* Mode Khusus PIC Reviewing in DONE status */}
                    {isPICActive && activeTaskDetail.status === 'DONE' && (
                      <div className="flex items-center gap-1.5 p-1 bg-slate-100/70 rounded-xl border border-slate-200/80 text-xs">
                        <button
                          type="button"
                          onClick={() => setPicDecision('APPROVE')}
                          className={`flex-1 py-1.5 px-3 rounded-xl border text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                            picDecision === 'APPROVE'
                              ? 'bg-emerald-100 border-emerald-400 text-emerald-800 shadow-2xs ring-2 ring-emerald-400/30'
                              : 'bg-emerald-50/60 border-emerald-200/60 text-emerald-700 hover:bg-emerald-100/70 font-semibold'
                          }`}
                        >
                          <Check className="w-3.5 h-3.5 text-emerald-600" />
                          <span>Setujui (ACC)</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setPicDecision('REVISION')}
                          className={`flex-1 py-1.5 px-3 rounded-xl border text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                            picDecision === 'REVISION'
                              ? 'bg-rose-100 border-rose-400 text-rose-800 shadow-2xs ring-2 ring-rose-400/30'
                              : 'bg-rose-50/60 border-rose-200/60 text-rose-700 hover:bg-rose-100/70 font-semibold'
                          }`}
                        >
                          <RotateCcw className="w-3.5 h-3.5 text-rose-600" />
                          <span>Minta Revisi</span>
                        </button>
                      </div>
                    )}

                    {/* Popover Sematkan Tautan */}
                    {showPreviewAddLink && (
                      <div className="p-3 bg-white rounded-2xl border border-sky-200 shadow-md space-y-2 animate-in fade-in duration-150">
                        <div className="flex items-center justify-between pb-1 border-b border-slate-100">
                          <span className="font-bold text-xs text-slate-800 flex items-center gap-1.5">
                            <Link2 className="w-3.5 h-3.5 text-sky-600" />
                            <span>Sematkan Tautan Deliverable / Preview</span>
                          </span>
                          <button
                            type="button"
                            onClick={() => setShowPreviewAddLink(false)}
                            className="text-slate-400 hover:text-slate-600 p-0.5 cursor-pointer"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        <input
                          type="text"
                          value={previewLinkTitle}
                          onChange={(e) => setPreviewLinkTitle(e.target.value)}
                          placeholder="Nama Tautan (misal: Prototipe Figma / Google Docs / PR GitHub)"
                          className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-sky-500 outline-none"
                        />
                        <input
                          type="text"
                          value={previewLinkUrl}
                          onChange={(e) => setPreviewLinkUrl(e.target.value)}
                          placeholder="URL (misal: https://...)"
                          className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-sky-500 outline-none"
                        />
                        <div className="flex justify-end gap-1.5 pt-0.5">
                          <button
                            type="button"
                            onClick={handlePreviewAddLink}
                            className="px-3.5 py-1 bg-sky-500 hover:bg-sky-600 text-white font-bold rounded-lg text-xs cursor-pointer shadow-2xs"
                          >
                            Sematkan Link
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Preview Chips Lampiran Deliverables */}
                    {previewAttachments.length > 0 && (
                      <div className="flex flex-wrap items-center gap-1.5 px-0.5">
                        {previewAttachments.map((att, idx) => (
                          <div
                            key={idx}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-sky-50 border border-sky-200 rounded-full text-[11px] font-semibold text-sky-800 shadow-2xs"
                          >
                            {att.type === 'FILE' ? (
                              <Paperclip className="w-3 h-3 text-sky-600 shrink-0" />
                            ) : (
                              <Link2 className="w-3 h-3 text-sky-600 shrink-0" />
                            )}
                            <span className="max-w-[140px] truncate">{att.name}</span>
                            <button
                              type="button"
                              onClick={() => setPreviewAttachments((prev) => prev.filter((_, i) => i !== idx))}
                              className="text-slate-400 hover:text-rose-600 p-0.5 rounded-full cursor-pointer"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Baris Input Chat Utama - Persis Dengan Ruang Obrolan (image_50a19f56.png) */}
                    <div className="flex items-end gap-1.5 sm:gap-2">
                      {/* Tombol Lampiran Berkas di Sisi Kiri Luar Textarea */}
                      <label
                        className="p-2 text-gray-500 hover:text-[#1E3A8A] rounded-full hover:bg-slate-100 transition cursor-pointer shrink-0 mb-0.5"
                        title="Unggah Foto atau Berkas"
                      >
                        <Paperclip className="w-4 h-4" />
                        <input
                          type="file"
                          multiple
                          className="hidden"
                          onChange={handlePreviewFileUpload}
                        />
                      </label>

                      {/* Tombol Tautan Link */}
                      <button
                        type="button"
                        onClick={() => setShowPreviewAddLink(!showPreviewAddLink)}
                        title="Sematkan Tautan Link"
                        className={`p-2 rounded-full transition cursor-pointer shrink-0 mb-0.5 ${
                          showPreviewAddLink ? 'text-[#1E3A8A] bg-blue-100' : 'text-gray-500 hover:text-[#1E3A8A] hover:bg-slate-100'
                        }`}
                      >
                        <Globe className="w-4 h-4" />
                      </button>

                      {/* Tombol Mention Rekan (@) */}
                      <button
                        type="button"
                        onClick={() => {
                          setPreviewNote((prev) => (prev ? `${prev} @` : '@'));
                        }}
                        title="Mention Rekan Tim (@)"
                        className="w-8 h-8 rounded-full text-gray-500 hover:text-[#1E3A8A] hover:bg-slate-100 transition cursor-pointer shrink-0 flex items-center justify-center text-xs font-bold mb-0.5"
                      >
                        <span className="text-sm font-bold">@</span>
                      </button>

                      {/* Textarea Input Box Khas Ruang Obrolan */}
                      <div className="relative flex-1">
                        <textarea
                          rows={1}
                          value={previewNote}
                          onChange={(e) => {
                            setPreviewNote(e.target.value);
                            e.target.style.height = 'auto';
                            e.target.style.height = `${Math.min(e.target.scrollHeight, 120)}px`;
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.stopPropagation();
                            }
                          }}
                          placeholder={
                            isPICActive && activeTaskDetail.status === 'DONE'
                              ? picDecision === 'APPROVE'
                                ? 'Tulis konfirmasi penugasan selesai...'
                                : 'Tulis arahan revisi...'
                              : isPICActive
                              ? `Tulis pesan untuk ${activeTaskDetail.assignedName}...`
                              : 'Tulis pesan atau mention @teman...'
                          }
                          className="w-full bg-[#F2F2F7] border border-gray-200/80 rounded-2xl px-4 py-2 text-xs sm:text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#1E3A8A]/30 focus:bg-white transition resize-none max-h-28 overflow-y-auto leading-relaxed"
                        />
                      </div>

                      {/* Tombol Send Lingkaran di Sisi Kanan (Persis Ruang Obrolan) */}
                      <button
                        type="button"
                        disabled={!previewNote.trim() && previewAttachments.length === 0}
                        onClick={() => {
                          if (isPICActive && activeTaskDetail.status === 'DONE') {
                            handlePicSubmitReview();
                          } else if (activeTaskDetail.status === 'REVIEWED') {
                            handleAddGeneralNote();
                          } else {
                            handleSendPreview();
                          }
                        }}
                        className={`w-8 h-8 rounded-full text-white flex items-center justify-center hover:opacity-90 active:scale-95 transition shrink-0 shadow-2xs disabled:opacity-40 cursor-pointer mb-1 ${
                          isPICActive && activeTaskDetail.status === 'DONE'
                            ? picDecision === 'APPROVE'
                              ? 'bg-emerald-600'
                              : 'bg-rose-600'
                            : 'bg-[#1E3A8A]'
                        }`}
                        title={
                          isPICActive && activeTaskDetail.status === 'DONE'
                            ? 'Kirim Evaluasi PIC'
                            : activeTaskDetail.status === 'REVIEWED'
                            ? 'Kirim Pesan'
                            : 'Kirim Pesan'
                        }
                      >
                        <ArrowUp className="w-4 h-4 stroke-[2.5]" />
                      </button>
                    </div>

                    {/* Admin Hapus Tugas Button */}
                    {isAdmin && (
                      <div className="pt-1 flex items-center justify-end text-[11px] text-slate-400">
                        <button
                          type="button"
                          onClick={() => handleDeleteTask(activeTaskDetail.id)}
                          className="px-2 py-0.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg font-semibold transition-colors flex items-center gap-1 cursor-pointer ml-auto"
                        >
                          <Trash2 className="w-3 h-3" />
                          Hapus Tugas
                        </button>
                      </div>
                    )}
                  </div>
                </>
              );
            })()}
          </div>
        </div>
      )}

      {/* 5. MODAL BUAT TUGAS BARU OLEH ADMIN */}
      {showCreateModal && isAdmin && (
        <div
          className={`fixed inset-0 z-50 flex animate-in fade-in duration-200 ${
            isCreateModalFullScreen
              ? 'items-center justify-center p-0'
              : 'justify-end items-center p-2.5 sm:p-4 md:p-5'
          }`}
        >
          {/* Backdrop Blur */}
          <div
            className="fixed inset-0 bg-slate-950/40 backdrop-blur-xs transition-opacity cursor-pointer"
            onClick={() => setShowCreateModal(false)}
          />

          {/* Dialog Card */}
          <div
            className={`relative z-10 bg-white shadow-2xl flex flex-col min-h-0 overflow-hidden transition-all duration-300 font-sans ${
              isCreateModalFullScreen
                ? 'w-full h-full max-w-none max-h-none rounded-none border-0'
                : 'w-full max-w-md sm:max-w-lg h-full max-h-[calc(100vh-1.25rem)] sm:max-h-[calc(100vh-2rem)] rounded-3xl border border-slate-200/80 animate-in slide-in-from-right duration-300 ease-out'
            }`}
          >
            {/* Header Drawer */}
            <div className="px-5 py-4 border-b border-slate-100 bg-white shrink-0">
              <div className="flex items-start justify-between gap-3">
                {/* Zoom Button di pojok kiri atas */}
                <div className="w-9 shrink-0 flex items-start">
                  <button
                    type="button"
                    onClick={() => setIsCreateModalFullScreen(!isCreateModalFullScreen)}
                    className="p-1.5 sm:p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl border border-slate-200/80 transition-colors cursor-pointer shrink-0 mt-0.5"
                    title={isCreateModalFullScreen ? "Perkecil Tampilan" : "Perbesar Layar Penuh"}
                  >
                    {isCreateModalFullScreen ? (
                      <Minimize2 className="w-4 h-4 text-slate-600" />
                    ) : (
                      <Maximize2 className="w-4 h-4 text-slate-600" />
                    )}
                  </button>
                </div>

                {/* Judul & Subjudul diposisikan di tengah persis seperti di pop up card tugas */}
                <div className="flex-1 min-w-0 text-center px-1 sm:px-3 space-y-1 flex flex-col items-center justify-center pt-1.5 sm:pt-2">
                  <h2 className="text-sm sm:text-[15px] font-bold text-slate-900 tracking-tight leading-snug max-w-2xl">
                    Buat Tugas Baru
                  </h2>
                  <p className="text-slate-500 text-[11px] sm:text-xs leading-relaxed font-normal whitespace-pre-wrap max-w-2xl">
                    Lengkapi formulir di bawah ini untuk menerbitkan tugas baru bagi anggota tim.
                  </p>
                </div>

                {/* Container Tombol Tutup Panel di pojok kanan atas */}
                <div className="w-9 shrink-0 flex items-start justify-end">
                  <button
                    type="button"
                    onClick={() => setShowCreateModal(false)}
                    className="p-1.5 sm:p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer shrink-0 mt-0.5"
                    title="Tutup Panel"
                  >
                    <X className="w-4 h-4 sm:w-5 sm:h-5 text-slate-600" />
                  </button>
                </div>
              </div>
            </div>

            {/* Form Body Scrollable */}
            <form onSubmit={handleCreateTask} className="flex-1 flex flex-col min-h-0">
              <div className="flex-1 overflow-y-auto p-6 space-y-4 text-xs">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Judul Tugas *
                  </label>
                  <input
                    type="text"
                    required
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    placeholder="Contoh: Evaluasi Keamanan Webhook Payment"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-indigo-500 focus:bg-white text-slate-900 text-xs font-medium transition-all"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Deskripsi Pengerjaan *
                  </label>
                  <textarea
                    rows={3}
                    required
                    value={newDesc}
                    onChange={(e) => setNewDesc(e.target.value)}
                    placeholder="Kriteria, spesifikasi teknis, atau instruksi pengerjaan tugas..."
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-indigo-500 focus:bg-white text-slate-900 text-xs font-medium resize-none transition-all"
                  />
                </div>

                {/* Prioritas Tugas & Tenggat Waktu (Side-by-side) */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                      Prioritas Tugas
                    </label>
                    <select
                      value={newPriority}
                      onChange={(e) => setNewPriority(e.target.value as TaskPriority)}
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-800 text-xs focus:ring-2 focus:ring-indigo-500 outline-none cursor-pointer"
                    >
                      <option value="LOW">Rendah (Low)</option>
                      <option value="MEDIUM">Sedang (Medium)</option>
                      <option value="HIGH">Tinggi (High)</option>
                      <option value="URGENT">Mendesak (Urgent)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                      Tenggat Waktu *
                    </label>
                    <input
                      type="date"
                      required
                      value={newDueDate}
                      onChange={(e) => setNewDueDate(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-xs focus:ring-2 focus:ring-indigo-500 outline-none cursor-pointer"
                    />
                  </div>
                </div>

                {/* Tugaskan Kepada (Ditempatkan di Bawah & Dapat Memilih Lebih Dari Satu Orang) */}
                <div className="space-y-2 pt-1">
                  <div className="flex items-center justify-between">
                    <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                      Tugaskan Kepada *
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        if (newAssigneeIds.length === assignableUsers.length) {
                          setNewAssigneeIds([]);
                        } else {
                          setNewAssigneeIds(assignableUsers.map((u) => u.id));
                        }
                      }}
                      className="text-[11px] font-bold text-[#1E3A8A] hover:underline cursor-pointer"
                    >
                      {newAssigneeIds.length === assignableUsers.length ? 'Batal Semua' : 'Pilih Semua'}
                    </button>
                  </div>

                  {/* Chips Anggota Tim Terpilih */}
                  {newAssigneeIds.length > 0 && (
                    <div className="flex flex-wrap items-center gap-1.5 p-2 bg-slate-50/80 rounded-xl border border-slate-200/80">
                      {newAssigneeIds.map((uid) => {
                        const u = users.find((usr) => usr.id === uid);
                        if (!u) return null;
                        return (
                          <span
                            key={uid}
                            className="inline-flex items-center gap-1.5 pl-1.5 pr-2 py-1 bg-white border border-blue-200 text-[#1E3A8A] rounded-lg text-xs font-semibold shadow-2xs animate-fadeIn"
                          >
                            {u.avatar ? (
                              <img src={u.avatar} alt={u.name} className="w-4 h-4 rounded-full object-cover" />
                            ) : (
                              <span className="w-4 h-4 rounded-full bg-blue-100 text-[#1E3A8A] font-extrabold text-[9px] flex items-center justify-center">
                                {u.name.charAt(0)}
                              </span>
                            )}
                            <span className="truncate max-w-[120px]">{u.name}</span>
                            <button
                              type="button"
                              onClick={() => setNewAssigneeIds((prev) => prev.filter((id) => id !== uid))}
                              className="text-slate-400 hover:text-rose-600 rounded-sm p-0.5 cursor-pointer transition-colors"
                              title={`Hapus ${u.name}`}
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </span>
                        );
                      })}
                    </div>
                  )}

                  {/* Search Input Anggota Tim */}
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      value={assigneeSearchQuery}
                      onChange={(e) => setAssigneeSearchQuery(e.target.value)}
                      placeholder="Cari anggota tim atau divisi..."
                      className="w-full pl-8 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all"
                    />
                  </div>

                  {/* Daftar Anggota Tim (Checklist Multi-Select) */}
                  <div className="max-h-48 overflow-y-auto space-y-1.5 p-1.5 bg-slate-50/50 rounded-2xl border border-slate-200 custom-scrollbar">
                    {assignableUsers
                      .filter((u) =>
                        !assigneeSearchQuery ||
                        u.name.toLowerCase().includes(assigneeSearchQuery.toLowerCase()) ||
                        (u.department && u.department.toLowerCase().includes(assigneeSearchQuery.toLowerCase()))
                      )
                      .map((u) => {
                        const isSelected = newAssigneeIds.includes(u.id);
                        return (
                          <div
                            key={u.id}
                            onClick={() => {
                              setNewAssigneeIds((prev) =>
                                isSelected ? prev.filter((id) => id !== u.id) : [...prev, u.id]
                              );
                            }}
                            className={`flex items-center justify-between p-2 rounded-xl cursor-pointer transition-all border ${
                              isSelected
                                ? 'bg-blue-50/90 border-[#1E3A8A] text-[#1E3A8A] shadow-2xs'
                                : 'bg-white hover:bg-slate-100/70 border-slate-200/80 text-slate-700'
                            }`}
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              {u.avatar ? (
                                <img
                                  src={u.avatar}
                                  alt={u.name}
                                  className="w-7 h-7 rounded-full object-cover border border-slate-200 shrink-0"
                                />
                              ) : (
                                <div className="w-7 h-7 rounded-full bg-blue-100 text-[#1E3A8A] font-bold text-xs flex items-center justify-center shrink-0">
                                  {u.name.charAt(0)}
                                </div>
                              )}
                              <div className="truncate">
                                <p className="font-bold text-xs truncate leading-snug">{u.name}</p>
                                <p className="text-[10px] text-slate-400 truncate leading-snug">
                                  {u.department || 'Staf Operasional'}
                                </p>
                              </div>
                            </div>

                            <div
                              className={`w-5 h-5 rounded-lg flex items-center justify-center border transition-all shrink-0 ml-2 ${
                                isSelected
                                  ? 'bg-[#1E3A8A] border-[#1E3A8A] text-white'
                                  : 'border-slate-300 bg-white text-transparent'
                              }`}
                            >
                              <Check className="w-3.5 h-3.5 stroke-[3]" />
                            </div>
                          </div>
                        );
                      })}
                  </div>
                </div>

                {/* Lampiran File & Link Saat Admin Membuat Tugas */}
                <div className="space-y-2 pt-1">
                  <div className="flex items-center justify-between">
                    <span className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                      Lampiran Berkas &amp; Tautan Referensi (Opsional)
                    </span>
                    <div className="flex items-center gap-1.5">
                      <label className="inline-flex items-center gap-1 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-xl font-bold text-[11px] cursor-pointer shadow-2xs transition-colors">
                        <Paperclip className="w-3 h-3 text-indigo-600" />
                        <span>+ File</span>
                        <input
                          type="file"
                          multiple
                          onChange={handleCreateFileUpload}
                          className="hidden"
                        />
                      </label>
                      <button
                        type="button"
                        onClick={() => setShowCreateAddLink(!showCreateAddLink)}
                        className="inline-flex items-center gap-1 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-xl font-bold text-[11px] cursor-pointer shadow-2xs transition-colors"
                      >
                        <Globe className="w-3 h-3 text-indigo-600" />
                        <span>+ Link</span>
                      </button>
                    </div>
                  </div>

                  {/* Inline Peringatan Validasi Upload Berkas */}
                  {createTaskUploadError && (
                    <div className="flex items-center justify-between gap-1.5 px-3 py-1.5 text-xs text-rose-600 bg-rose-50 border border-rose-200/90 rounded-xl animate-in fade-in duration-200">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <AlertCircle className="w-3.5 h-3.5 shrink-0 text-rose-500" />
                        <span className="font-medium">{createTaskUploadError}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setCreateTaskUploadError(null)}
                        className="text-rose-400 hover:text-rose-700 ml-1 shrink-0 cursor-pointer p-0.5"
                        title="Tutup pesan"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}

                  {showCreateAddLink && (
                    <div className="p-3 bg-indigo-50/70 rounded-xl border border-indigo-200 space-y-2 animate-in fade-in duration-150">
                      <input
                        type="text"
                        value={createLinkTitle}
                        onChange={(e) => setCreateLinkTitle(e.target.value)}
                        placeholder="Nama Tautan (misal: Dokumen Spesifikasi / Figma)"
                        className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs"
                      />
                      <input
                        type="text"
                        value={createLinkUrl}
                        onChange={(e) => setCreateLinkUrl(e.target.value)}
                        placeholder="URL (misal: https://...)"
                        className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs"
                      />
                      <div className="flex justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => setShowCreateAddLink(false)}
                          className="px-3 py-1 text-slate-500 hover:bg-slate-100 rounded-md text-xs"
                        >
                          Batal
                        </button>
                        <button
                          type="button"
                          onClick={handleCreateAddLink}
                          className="px-3.5 py-1 bg-indigo-600 text-white font-bold rounded-md text-xs hover:bg-indigo-700 cursor-pointer"
                        >
                          Tambah Link
                        </button>
                      </div>
                    </div>
                  )}

                  {createAttachments.length > 0 && (
                    <div className="space-y-2 pt-1">
                      {createAttachments.map((att) => (
                        <div
                          key={att.id}
                          className="p-2.5 bg-slate-50 hover:bg-slate-100/70 rounded-xl border border-slate-200 flex items-center justify-between text-xs transition-colors"
                        >
                          <div
                            onClick={() => {
                              if (att.type === 'LINK') {
                                openExternalLink(att.url);
                              } else {
                                setMediaPreview({
                                  url: att.url,
                                  name: att.name,
                                  type: att.type,
                                  fileType: att.fileType,
                                  fileSize: att.fileSize,
                                });
                              }
                            }}
                            className="flex items-center gap-2.5 truncate cursor-pointer flex-1 min-w-0"
                            title={`Buka ${att.name}`}
                          >
                            <div className="w-7 h-7 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center shrink-0">
                              {att.type === 'FILE' ? <FileText className="w-3.5 h-3.5" /> : <Link2 className="w-3.5 h-3.5" />}
                            </div>
                            <div className="truncate">
                              <span className="truncate font-semibold text-slate-800 block hover:text-[#1E3A8A] transition-colors">{att.name}</span>
                              <span className="text-[10px] text-slate-400 font-mono">
                                {att.type === 'FILE' ? 'Berkas Unggahan (Klik untuk pratinjau)' : 'Tautan Eksternal (Klik untuk buka)'}
                              </span>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => setCreateAttachments((prev) => prev.filter((a) => a.id !== att.id))}
                            className="p-1 text-slate-400 hover:text-rose-600 rounded-lg cursor-pointer ml-2 shrink-0"
                            title="Hapus"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Sticky Footer */}
              <div className="px-6 py-4.5 border-t border-slate-100 bg-white flex items-center justify-between gap-3 shrink-0">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-xl transition-colors cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={newAssigneeIds.length === 0}
                  className="px-6 py-2.5 bg-[#1E3A8A] hover:bg-[#172554] disabled:opacity-50 disabled:pointer-events-none text-white font-bold text-xs rounded-xl shadow-xs transition-all duration-300 hover:-translate-y-0.5 cursor-pointer"
                >
                  Terbitkan Tugas {newAssigneeIds.length > 1 ? `(${newAssigneeIds.length} Anggota)` : ''}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}



      {/* Modern Confirm Dialog Hapus Tugas */}
      <ModernConfirmDialog
        isOpen={Boolean(taskToDelete)}
        variant="danger"
        title="Hapus Tugas Dari Kanban"
        message="Apakah Anda yakin ingin menghapus tugas ini secara permanen dari papan kerja tim?"
        confirmText="Ya, Hapus Tugas"
        cancelText="Batal"
        onConfirm={() => {
          if (taskToDelete) {
            executeDeleteTask(taskToDelete);
            setTaskToDelete(null);
          }
        }}
        onCancel={() => setTaskToDelete(null)}
      />

      {/* Modal Pratinjau Berkas, Gambar, dan Tautan Interaktif */}
      <MediaPreviewModal
        media={mediaPreview}
        onClose={() => setMediaPreview(null)}
      />
    </div>
  );
}
