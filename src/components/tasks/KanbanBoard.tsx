import React, { useState, useRef, useEffect, useMemo } from 'react';
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
import { TaskDetailModal } from './TaskDetailModal.tsx';
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
import { isTaskCreatedByUser } from '../../lib/task-sync.ts';

interface KanbanBoardProps {
  tasks: TaskItem[];
  users: UserType[];
  currentUser: UserType;
  userRole: UserRole;
  onRefresh: () => void;
  isMyTasks?: boolean;
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
  isMyTasks = false,
}: KanbanBoardProps) {
  const isAdmin = userRole === 'ADMIN' || userRole === 'SUPER_ADMIN';

  // Daftar pembuat tugas (Admin & Super Admin) untuk filter pada "Tugas Saya"
  const creatorUsers = useMemo(() => {
    return users.filter((u) => u.role === 'ADMIN' || u.role === 'SUPER_ADMIN');
  }, [users]);
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
  const assignableUsers = useMemo(() => {
    const list: UserType[] = [];
    const seenNames = new Set<string>();
    const seenEmails = new Set<string>();
    const seenIds = new Set<string>();

    (users || []).forEach((u) => {
      if (u.role === 'SUPER_ADMIN' || u.status !== 'ACTIVE') return;

      const uId = u.id;
      const uEmail = u.email?.toLowerCase().trim();
      const uName = u.name?.toLowerCase().trim();

      if (uId && seenIds.has(uId)) return;
      if (uEmail && seenEmails.has(uEmail)) return;
      if (uName && seenNames.has(uName)) return;

      if (uId) seenIds.add(uId);
      if (uEmail) seenEmails.add(uEmail);
      if (uName) seenNames.add(uName);

      list.push(u);
    });
    return list;
  }, [users]);
  const [newAssigneeId, setNewAssigneeId] = useState<string>(() => {
    return assignableUsers[0]?.id || users[0]?.id || '';
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
        email: currentUser.email,
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
        setTimeout(() => setCreateTaskUploadError(null), 4000);
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

  const openCreateTaskModal = () => {
    setCreateAttachments([]);
    if (!newAssigneeId) {
      const defaultUser = assignableUsers[0]?.id || users[0]?.id || '';
      if (defaultUser) {
        setNewAssigneeId(defaultUser);
      }
    }
    setShowCreateModal(true);
  };

  const handleCreateTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !newDueDate) return;
    if (!newAssigneeId) {
      alert('Pilih anggota tim yang ditugaskan.');
      return;
    }

    const assignedUser = users.find((u) => u.id === newAssigneeId) || assignableUsers[0] || users[0];
    if (!assignedUser) {
      alert('Pilih anggota tim yang ditugaskan.');
      return;
    }

    const assigneesList: TaskAssignee[] = [
      {
        id: assignedUser.id,
        name: assignedUser.name,
        avatar: assignedUser.avatar,
        department: assignedUser.department,
      },
    ];

    AppStorage.addTask({
      id: `task_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      status: 'TODO',
      createdAt: new Date().toISOString().substring(0, 10),
      updatedAt: new Date().toISOString().substring(0, 10),
      title: newTitle.trim(),
      description: newDesc.trim(),
      priority: newPriority,
      assignedTo: assignedUser.id,
      assignedName: assignedUser.name,
      assignedAvatar: assignedUser.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80',
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
    const defaultUser = assignableUsers[0]?.id || users[0]?.id || '';
    setNewAssigneeId(defaultUser);
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
      try {
        const uploadRes = await uploadHybridFile(file, { folder: 'absenku/tasks' });
        const newAtt: TaskAttachment = {
          id: `att-prev-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          name: uploadRes.name,
          type: 'FILE',
          url: uploadRes.url,
          fileType: uploadRes.type,
          fileSize: formatBytes(uploadRes.size),
          uploadedBy: currentUser.id,
          uploadedByName: currentUser.name,
          uploadedAt: new Date().toISOString().replace('T', ' ').substring(0, 16),
          stage: 'DONE',
        };
        setPreviewAttachments((prev) => [...prev, newAtt]);
      } catch (err: any) {
        console.warn('Gagal upload preview file:', err);
      }
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

    const note = previewNote.trim();

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
        reviewNotes: note,
        newAttachments: previewAttachments,
      });
    } else if (picDecision === 'REVISION') {
      handleUpdateStatus(activeTaskDetail.id, 'IN_PROGRESS', {
        reviewNotes: note,
        newAttachments: previewAttachments,
      });
    } else {
      // NOTE (Catatan Saja)
      if (!note && previewAttachments.length === 0) return;
      const activity: TaskActivity = {
        id: `act-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        type: 'COMMENT_ADDED',
        userId: currentUser.id,
        userName: currentUser.name,
        userAvatar: currentUser.avatar,
        userRole: userRole,
        timestamp: new Date().toISOString().replace('T', ' ').substring(0, 16),
        notes: note,
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
    executeDeleteTask(taskId);
  };

  const executeDeleteTask = (taskId: string) => {
    AppStorage.deleteTask(taskId);
    onRefresh();
    if (activeTaskDetail && activeTaskDetail.id === taskId) {
      setActiveTaskDetail(null);
    }
    setTaskToDelete(null);
  };

  // Sinkronisasi realtime saat PIC menghapus tugas di perangkat lain
  useEffect(() => {
    const handleSync = () => {
      onRefresh();
    };
    window.addEventListener('absenku:tasks_updated', handleSync);
    window.addEventListener('storage', handleSync);
    return () => {
      window.removeEventListener('absenku:tasks_updated', handleSync);
      window.removeEventListener('storage', handleSync);
    };
  }, [onRefresh]);

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

    const matchesAssignee = (() => {
      if (assigneeFilter === 'ALL') return true;
      if (isMyTasks) {
        const selectedUser = users.find((u) => u.id === assigneeFilter);
        return (
          t.createdBy === assigneeFilter ||
          (selectedUser && t.createdBy === selectedUser.name) ||
          (!t.createdBy && (selectedUser?.role === 'ADMIN' || selectedUser?.role === 'SUPER_ADMIN'))
        );
      }
      return (
        t.assignedTo === assigneeFilter ||
        Boolean(t.assignees?.some((a) => a.id === assigneeFilter))
      );
    })();

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
  }).sort((a, b) => {
    // Tugas terbaru otomatis urutan paling atas
    const timeA = a.createdAt || '';
    const timeB = b.createdAt || '';
    if (timeA !== timeB) return timeB.localeCompare(timeA);
    return (b.id || '').localeCompare(a.id || '');
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
              onClick={openCreateTaskModal}
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
              placeholder="Cari tugas atau deskripsi..."
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
                placeholder="Cari tugas atau deskripsi..."
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
                  onClick={openCreateTaskModal}
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
            {/* Filter 1: Pelaksana Tugas (Assignee) / Dibuat oleh (Creator pada Tugas Saya) */}
            <div
              className={`flex items-center gap-2.5 h-12 sm:h-10 px-4 sm:px-3 rounded-xl border transition-all shadow-2xs min-w-0 ${
                assigneeFilter !== 'ALL'
                  ? 'bg-blue-50 border-blue-300 text-[#1E3A8A] font-bold ring-1 ring-blue-300/40'
                  : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-700'
              }`}
            >
              <span className="text-xs font-semibold text-slate-500 whitespace-nowrap shrink-0">
                {isMyTasks ? 'Dibuat oleh:' : 'Pelaksana:'}
              </span>
              <div className="relative flex items-center flex-1 min-w-0">
                <select
                  value={assigneeFilter}
                  onChange={(e) => setAssigneeFilter(e.target.value)}
                  className="w-full appearance-none pr-6 bg-transparent font-semibold text-slate-900 text-xs focus:outline-hidden cursor-pointer truncate py-1.5"
                >
                  <option value="ALL">{isMyTasks ? 'Semua Pembuat' : 'Semua Rekan'}</option>
                  {(isMyTasks ? creatorUsers : users).map((u) => (
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
                        const isMyTask =
                          task.assignedTo === currentUser.id ||
                          (Boolean(currentUser.email) && task.assignedTo === currentUser.email) ||
                          Boolean(
                            task.assignees?.some(
                              (a) =>
                                a.id === currentUser.id ||
                                (currentUser.email && a.id === currentUser.email) ||
                                (currentUser.name &&
                                  a.name?.toLowerCase().trim() === currentUser.name.toLowerCase().trim())
                            )
                          ) ||
                          (Boolean(currentUser.name) &&
                            task.assignedName?.toLowerCase().trim() ===
                              currentUser.name.toLowerCase().trim());
                        const isPIC = isAdmin || isTaskCreatedByUser(task, currentUser);
                        const isDone = task.status === 'DONE' || task.status === 'REVIEWED';
                        const canDelete = isPIC || (isMyTask && isDone);
                        const picUser = users.find(
                          (u) =>
                            u.id === task.createdBy ||
                            (u.name && task.createdBy && u.name.trim().toLowerCase() === task.createdBy.trim().toLowerCase()) ||
                            u.role === 'ADMIN'
                        );
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
                            onClick={() => {
                              if (task.status === 'TODO') return;
                              openTaskDetail(task);
                            }}
                            className={`bg-white rounded-2xl p-5 border ${cardProcessBorder} shadow-2xs hover:shadow-md transition-all duration-200 ${
                              task.status === 'TODO' ? 'cursor-default' : 'cursor-pointer'
                            } space-y-3.5 group`}
                          >
                            {/* Baris Atas: Priority Badge & 3 Dots Menu / Button Hapus jika PIC */}
                            {(() => {
                              const latestRevisionNote = (task.reviewNotes || '') ||
                                (task.activities?.slice().reverse().find((a) => a.type === 'REVISION_REQUESTED')?.notes || '');

                              return (
                                <>
                                  <div className="flex items-center justify-between gap-2">
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                      {getPriorityBadge(task.priority)}
                                      {task.status === 'IN_PROGRESS' && latestRevisionNote && (
                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-700 border border-rose-200 shadow-2xs animate-in fade-in">
                                          <RotateCcw className="w-2.5 h-2.5 stroke-[2.5]" />
                                          Perlu Revisi
                                        </span>
                                      )}
                                    </div>

                                    {canDelete ? (
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleDeleteTask(task.id);
                                        }}
                                        className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg cursor-pointer transition-colors"
                                        title={isPIC ? "Hapus Tugas" : "Hapus Tugas Selesai"}
                                      >
                                        <Trash2 className="w-4 h-4" />
                                      </button>
                                    ) : task.status !== 'TODO' ? (
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
                                    ) : null}
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
                                  {task.status === 'IN_PROGRESS' && latestRevisionNote && (
                                    <div className="p-2.5 bg-rose-50 border border-rose-200/90 rounded-xl text-[11px] text-rose-800 space-y-1 shadow-2xs animate-in fade-in">
                                      <div className="flex items-center gap-1.5 font-bold text-rose-900">
                                        <RotateCcw className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                                        <span>Perlu Revisi dari PIC:</span>
                                      </div>
                                      <p className="line-clamp-3 text-rose-700 italic font-medium leading-relaxed">
                                        "{latestRevisionNote}"
                                      </p>
                                    </div>
                                  )}
                                </>
                              );
                            })()}

                            {/* Hairline Divider */}
                            <div className="border-t border-slate-100 pt-2" />

                            {/* Footer: Assignee (Kiri) & Deadline Date (Kanan) */}
                            {(() => {
                              const assignedPerson = users.find((u) => u.id === task.assignedTo);
                              const assignedDisplayName = assignedPerson?.name || task.assignedName || 'Belum ditugaskan';
                              const assignedDisplayAvatar = assignedPerson?.avatar || task.assignedAvatar;

                              return (
                                <div className="flex items-center justify-between gap-2 text-xs">
                                  <div className="flex items-center gap-1.5 min-w-0">
                                    {assignedDisplayAvatar ? (
                                      <img
                                        src={assignedDisplayAvatar}
                                        alt={assignedDisplayName}
                                        className="w-6 h-6 rounded-full object-cover border border-slate-200 shrink-0 shadow-2xs"
                                        title={`Ditugaskan ke: ${assignedDisplayName}`}
                                      />
                                    ) : (
                                      <div
                                        className="w-6 h-6 rounded-full bg-blue-100 text-[#1E3A8A] font-extrabold text-[10px] flex items-center justify-center border border-blue-200 shrink-0 shadow-2xs"
                                        title={`Ditugaskan ke: ${assignedDisplayName}`}
                                      >
                                        {(assignedDisplayName || 'K').substring(0, 2).toUpperCase()}
                                      </div>
                                    )}
                                    <span className="text-[11px] font-semibold text-slate-700 truncate max-w-[120px]" title={assignedDisplayName}>
                                      {assignedDisplayName}
                                    </span>
                                  </div>

                                  <span className="text-xs text-slate-400 font-normal shrink-0">
                                    {task.dueDate}
                                  </span>
                                </div>
                              );
                            })()}

                            {/* Tombol Aksi Sesuai Flow Penugasan ke PIC */}
                            <div className="pt-1 flex flex-wrap items-center gap-1.5 text-xs">
                              {/* 1. TO-DO: Mulai Mengerjakan (Jika tugas ini ditugaskan ke saya, baik Admin maupun Karyawan bisa Mulai Mengerjakan!) */}
                              {task.status === 'TODO' && isMyTask && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleUpdateStatus(task.id, 'IN_PROGRESS');
                                  }}
                                  className="w-full py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-200 font-bold rounded-xl text-center transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-2xs"
                                >
                                  <span>Mulai Mengerjakan</span>
                                  <ArrowRight className="w-3.5 h-3.5" />
                                </button>
                              )}

                              {/* 2. IN_PROGRESS: Kirim Hasil Tugas (Jika tugas ini ditugaskan ke saya, bisa kirim hasil tugas!) */}
                              {task.status === 'IN_PROGRESS' && isMyTask && (() => {
                                const isRevised = Boolean(
                                  task.reviewNotes ||
                                  task.activities?.slice().reverse().find((a) => a.type === 'REVISION_REQUESTED')?.notes
                                );

                                return (
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      openTaskDetail(task);
                                    }}
                                    className={`w-full py-2 font-bold rounded-xl text-center transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-2xs ${
                                      isRevised
                                        ? 'bg-rose-600 hover:bg-rose-700 text-white'
                                        : 'bg-[#1E3A8A] hover:bg-[#172554] text-white'
                                    }`}
                                    title={isRevised ? "Buka Chat untuk Lihat Arahan Revisi & Kirim Perbaikan" : "Buka Chat untuk Upload Bukti & Kirim Preview"}
                                  >
                                    {isRevised ? (
                                      <>
                                        <RotateCcw className="w-3.5 h-3.5 text-white" />
                                        <span>Kirim Perbaikan Revisi</span>
                                      </>
                                    ) : (
                                      <>
                                        <Send className="w-3.5 h-3.5 text-white" />
                                        <span>Kirim Hasil Tugas</span>
                                      </>
                                    )}
                                  </button>
                                );
                              })()}

                              {/* 3. PREVIEW (DONE): Otoritas PIC / Admin (ACC vs Revisi) */}
                              {task.status === 'DONE' && (
                                isPIC ? (
                                  <div className="grid grid-cols-2 gap-1.5 w-full">
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleUpdateStatus(task.id, 'REVIEWED');
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
                        onClick={() => {
                          if (task.status === 'TODO') return;
                          openTaskDetail(task);
                        }}
                        className={`hover:bg-slate-50/80 transition-colors ${
                          task.status === 'TODO' ? 'cursor-default' : 'cursor-pointer'
                        } group`}
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
                            {task.assignedAvatar ? (
                              <img
                                src={task.assignedAvatar}
                                alt={task.assignedName}
                                className="w-6 h-6 rounded-full object-cover border border-slate-200 shrink-0 shadow-2xs"
                                title={task.assignedName}
                              />
                            ) : (
                              <div
                                className="w-6 h-6 rounded-full bg-blue-100 text-[#1E3A8A] font-extrabold text-[10px] flex items-center justify-center border border-blue-200 shrink-0 shadow-2xs"
                                title={task.assignedName}
                              >
                                {(task.assignedName || 'K').substring(0, 2).toUpperCase()}
                              </div>
                            )}
                            <span className="font-semibold text-slate-800 text-xs truncate max-w-[140px]">
                              {task.assignedName || 'Belum ditugaskan'}
                            </span>
                          </div>
                        </td>
                        <td className="py-3 px-3.5 whitespace-nowrap">
                          <span className={`inline-flex items-center justify-center text-[11px] font-bold px-3 py-1 rounded-full whitespace-nowrap shadow-2xs ${stageBadgeColor}`}>
                            {stageLabel}
                          </span>
                        </td>
                        <td className="py-3 px-3.5 text-slate-700 text-xs whitespace-nowrap">
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

      {/* 4. DETAIL TUGAS & DISKUSI MODAL */}
      {activeTaskDetail && (
        <TaskDetailModal
          task={activeTaskDetail}
          onClose={() => setActiveTaskDetail(null)}
          currentUser={currentUser}
          users={users}
          onRefresh={onRefresh}
        />
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
                    Isi formulir untuk membuat tugas baru.
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

                {/* Tugaskan Kepada (Hanya Dapat Memilih Satu Orang) */}
                <div className="space-y-2 pt-1">
                  <div className="flex items-center justify-between">
                    <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                      Tugaskan Kepada *
                    </label>
                    <span className="text-[11px] text-slate-400 font-medium">
                      Pilih 1 orang
                    </span>
                  </div>

                  {/* Anggota Tim Terpilih */}
                  {(() => {
                    const selectedUser = users.find((usr) => usr.id === newAssigneeId);
                    if (!selectedUser) return null;
                    return (
                      <div className="flex items-center justify-between p-2.5 bg-blue-50/80 rounded-xl border border-blue-200 text-[#1E3A8A] animate-fadeIn">
                        <div className="flex items-center gap-2.5 min-w-0">
                          {selectedUser.avatar ? (
                            <img
                              src={selectedUser.avatar}
                              alt={selectedUser.name}
                              className="w-7 h-7 rounded-full object-cover border border-blue-300 shrink-0"
                            />
                          ) : (
                            <div className="w-7 h-7 rounded-full bg-blue-200 text-[#1E3A8A] font-bold text-xs flex items-center justify-center shrink-0">
                              {selectedUser.name.charAt(0)}
                            </div>
                          )}
                          <div className="truncate">
                            <p className="font-bold text-xs truncate leading-snug">{selectedUser.name}</p>
                            <p className="text-[10px] text-blue-600/80 truncate leading-snug">
                              {selectedUser.department || 'Staf Operasional'}
                            </p>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => setNewAssigneeId('')}
                          className="text-slate-400 hover:text-rose-600 p-1 rounded-lg hover:bg-white/60 transition-colors cursor-pointer"
                          title="Batal pilih"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    );
                  })()}

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

                  {/* Daftar Anggota Tim (Single-Select) */}
                  <div className="max-h-48 overflow-y-auto space-y-1.5 p-1.5 bg-slate-50/50 rounded-2xl border border-slate-200 custom-scrollbar">
                    {assignableUsers
                      .filter((u) =>
                        !assigneeSearchQuery ||
                        u.name.toLowerCase().includes(assigneeSearchQuery.toLowerCase()) ||
                        (u.department && u.department.toLowerCase().includes(assigneeSearchQuery.toLowerCase()))
                      )
                      .map((u) => {
                        const isSelected = newAssigneeId === u.id;
                        return (
                          <div
                            key={u.id}
                            onClick={() => {
                              setNewAssigneeId(u.id);
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
                              className={`w-5 h-5 rounded-full flex items-center justify-center border transition-all shrink-0 ml-2 ${
                                isSelected
                                  ? 'border-[#1E3A8A] bg-[#1E3A8A] text-white'
                                  : 'border-slate-300 bg-white text-transparent'
                              }`}
                            >
                              <div
                                className={`w-2 h-2 rounded-full bg-white transition-transform ${
                                  isSelected ? 'scale-100' : 'scale-0'
                                }`}
                              />
                            </div>
                          </div>
                        );
                      })}
                  </div>
                </div>

                {/* Lampiran File & Link Saat Admin Membuat Tugas */}
                <div className="space-y-2 pt-1">
                  <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center sm:justify-between gap-2">
                    <span className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                      Lampiran Berkas &amp; Tautan Referensi (Opsional)
                    </span>
                    <div className="flex items-center gap-2 shrink-0">
                      <label className="inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-xl font-bold text-[11px] cursor-pointer shadow-2xs transition-colors">
                        <Paperclip className="w-3 h-3 text-indigo-600 shrink-0" />
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
                        className="inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-xl font-bold text-[11px] cursor-pointer shadow-2xs transition-colors"
                      >
                        <Globe className="w-3 h-3 text-indigo-600 shrink-0" />
                        <span>+ Link</span>
                      </button>
                    </div>
                  </div>

                  {/* Inline Peringatan Validasi Upload Berkas */}
                  {createTaskUploadError && (
                    <div className="flex items-center gap-2 px-3 py-2 text-xs text-rose-700 bg-rose-50 border border-rose-200/90 rounded-xl animate-in fade-in duration-200 shadow-2xs">
                      <AlertCircle className="w-3.5 h-3.5 shrink-0 text-rose-500" />
                      <span className="font-medium">{createTaskUploadError}</span>
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
                              openAttachmentDirectly(att);
                            }}
                            className="flex items-center gap-2.5 truncate cursor-pointer flex-1 min-w-0"
                            title={`Buka ${att.name} di tab baru`}
                          >
                            <div className="w-7 h-7 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center shrink-0">
                              {att.type === 'FILE' ? <FileText className="w-3.5 h-3.5" /> : <Link2 className="w-3.5 h-3.5" />}
                            </div>
                            <div className="truncate">
                              <span className="truncate font-semibold text-slate-800 block hover:text-[#1E3A8A] transition-colors">{att.name}</span>
                              <span className="text-[11px] text-slate-500 font-normal block leading-tight">
                                {att.type === 'FILE' ? 'Berkas Unggahan (Klik untuk buka di tab baru)' : 'Tautan Eksternal (Klik untuk buka)'}
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
              <div className="px-6 py-4.5 border-t border-slate-100 bg-white flex items-center justify-end gap-3 shrink-0">
                <button
                  type="submit"
                  disabled={!newAssigneeId}
                  className="px-6 py-2.5 bg-[#1E3A8A] hover:bg-[#172554] disabled:opacity-50 disabled:pointer-events-none text-white font-bold text-xs rounded-xl shadow-xs transition-all duration-300 hover:-translate-y-0.5 cursor-pointer"
                >
                  Terbitkan Tugas
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
