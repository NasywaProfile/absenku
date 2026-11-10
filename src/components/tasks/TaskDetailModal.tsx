import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  X,
  Maximize2,
  Minimize2,
  FileCheck,
  MessageSquare,
  Download,
  Link2,
  Send,
  Trash2,
  Paperclip,
  ArrowRight,
  ShieldCheck,
  Calendar,
  Plus,
  ExternalLink,
  FileUp,
  Image as ImageIcon,
  Check,
  RotateCcw,
  Globe,
  CheckCircle2,
  ArrowUp,
  AlertCircle,
  Clock,
  Sparkles,
  Tag,
  Users,
  CheckSquare,
  Upload,
  FileText,
  FolderArchive,
  Eye,
} from 'lucide-react';
import { TaskItem, TaskStatus, TaskAttachment, TaskActivity, User as UserType } from '../../types/index.ts';
import { AppStorage } from '../../lib/storage.ts';
import { formatIndonesianDateShort } from '../../lib/time-utils.ts';
import { ModernConfirmDialog } from '../common/ModernConfirmDialog.tsx';
import { uploadHybridFile } from '../../lib/file-uploader.ts';
import { openExternalLink, openAttachmentDirectly, isImageFile } from '../../lib/open-media.ts';

interface TaskDetailModalProps {
  task: TaskItem | null;
  onClose: () => void;
  currentUser: UserType;
  users: UserType[];
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

function formatChipName(fullName?: string): string {
  if (!fullName) return 'User';
  const parts = fullName.trim().split(/\s+/);
  if (parts.length <= 1) return parts[0];
  return `${parts[0]} ${parts[1][0]}.`;
}

function formatIndonesianDateFull(dateStr?: string): string {
  if (!dateStr) return '-';
  try {
    const raw = dateStr.includes('T') ? dateStr.split('T')[0] : dateStr.includes(' ') ? dateStr.split(' ')[0] : dateStr;
    const parts = raw.split('-');
    let d: Date;
    if (parts.length === 3) {
      d = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
    } else {
      d = new Date(dateStr);
    }
    if (isNaN(d.getTime())) return dateStr;
    const formatted = new Intl.DateTimeFormat('id-ID', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }).format(d);
    return formatted.replace(/[\u202f\u00a0\s]+/g, ' ').trim();
  } catch {
    return dateStr;
  }
}

function formatDateTimeFull(dateStr?: string): string {
  return formatIndonesianDateFull(dateStr);
}

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

function getTaskActivities(task: TaskItem, users: UserType[]): TaskActivity[] {
  let rawList: TaskActivity[] = [];
  if (Array.isArray(task.activities)) {
    rawList = task.activities;
  } else {
    const adminUser = users.find((u) => u.id === task.createdBy || u.role === 'ADMIN') || {
      id: task.createdBy,
      name: 'Administrator',
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

export function TaskDetailModal({
  task,
  onClose,
  currentUser,
  users,
  onRefresh,
}: TaskDetailModalProps) {
  if (!task) return null;

  const [activeTask, setActiveTask] = useState<TaskItem>(task);
  const [isFullScreen, setIsFullScreen] = useState(false);

  useEffect(() => {
    setActiveTask(task);
    setIsFullScreen(false);
  }, [task]);

  const handleModalClose = () => {
    setIsFullScreen(false);
    onClose();
  };

  const isAdmin = currentUser.role === 'ADMIN' || currentUser.role === 'SUPER_ADMIN';
  const userRole = currentUser.role;

  // Discussion & attachment input state
  const [previewNote, setPreviewNote] = useState('');
  const [previewAttachments, setPreviewAttachments] = useState<TaskAttachment[]>([]);
  const [taskUploadError, setTaskUploadError] = useState<string | null>(null);
  const [showPreviewAddLink, setShowPreviewAddLink] = useState(false);
  const [previewLinkTitle, setPreviewLinkTitle] = useState('');
  const [previewLinkUrl, setPreviewLinkUrl] = useState('');
  const [picDecision, setPicDecision] = useState<'APPROVE' | 'REVISION' | 'NOTE'>('APPROVE');
  const [taskToDelete, setTaskToDelete] = useState<string | null>(null);

  // Direct Attachment Upload state
  const [showDirectAddLink, setShowDirectAddLink] = useState(false);
  const [directLinkTitle, setDirectLinkTitle] = useState('');
  const [directLinkUrl, setDirectLinkUrl] = useState('');

  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  }, [activeTask.id, activeTask.activities?.length, activeTask.status]);

  const refreshCurrentTask = (taskId: string) => {
    onRefresh();
    const updated = AppStorage.getTasks().find((t) => t.id === taskId);
    if (updated) {
      setActiveTask(updated);
    }
  };

  // Hanya menampilkan lampiran awal penugasan dari PIC saat task dibuat (berkas chat stay di room chat)
  const allAttachments: TaskAttachment[] = useMemo(() => {
    if (Array.isArray(activeTask.attachments)) {
      return activeTask.attachments.filter(
        (att) => att.stage === 'TODO' || !att.stage || att.uploadedBy === activeTask.createdBy
      );
    }
    return [];
  }, [activeTask.attachments, activeTask.createdBy]);

  const handleUpdateStatus = (
    targetStatus: TaskStatus,
    notes?: { submissionNotes?: string; reviewNotes?: string; newAttachments?: TaskAttachment[] }
  ) => {
    AppStorage.updateTaskStatus(activeTask.id, targetStatus, {
      ...notes,
      activityUser: {
        id: currentUser.id,
        name: currentUser.name,
        email: currentUser.email,
        role: userRole,
        avatar: currentUser.avatar,
      },
    });
    refreshCurrentTask(activeTask.id);
  };

  // Direct attachment upload to the task
  const handleDirectFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setTaskUploadError(null);

    const newItems: TaskAttachment[] = [];
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
          stage: 'DONE',
        };
        newItems.push(newAtt);
      } catch (err: any) {
        setTaskUploadError(err.message || 'Gagal mengunggah berkas.');
        setTimeout(() => setTaskUploadError(null), 4000);
      }
    }

    if (newItems.length > 0) {
      const updatedAttachments = [...(activeTask.attachments || []), ...newItems];
      AppStorage.updateTask(activeTask.id, { attachments: updatedAttachments });
      refreshCurrentTask(activeTask.id);
    }
    e.target.value = '';
  };

  const handleDirectAddLink = () => {
    if (!directLinkUrl.trim()) return;
    let formattedUrl = directLinkUrl.trim();
    if (!/^https?:\/\//i.test(formattedUrl)) {
      formattedUrl = `https://${formattedUrl}`;
    }

    const newAtt: TaskAttachment = {
      id: `att-link-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      name: directLinkTitle.trim() || directLinkUrl.trim(),
      type: 'LINK',
      url: formattedUrl,
      uploadedBy: currentUser.id,
      uploadedByName: currentUser.name,
      uploadedAt: new Date().toISOString().replace('T', ' ').substring(0, 16),
      stage: 'DONE',
    };

    const updatedAttachments = [...(activeTask.attachments || []), newAtt];
    AppStorage.updateTask(activeTask.id, { attachments: updatedAttachments });
    refreshCurrentTask(activeTask.id);

    setDirectLinkTitle('');
    setDirectLinkUrl('');
    setShowDirectAddLink(false);
  };

  // Preview file upload inside chat bar
  const handlePreviewFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setTaskUploadError(null);

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
          stage: 'DONE',
        };
        setPreviewAttachments((prev) => [...prev, newAtt]);
      } catch (err: any) {
        setTaskUploadError(err.message || 'Gagal mengunggah berkas.');
        setTimeout(() => setTaskUploadError(null), 4000);
      }
    }
    e.target.value = '';
  };

  const handleAddPreviewLink = () => {
    if (!previewLinkUrl.trim()) return;
    let formattedUrl = previewLinkUrl.trim();
    if (!/^https?:\/\//i.test(formattedUrl)) {
      formattedUrl = `https://${formattedUrl}`;
    }

    const newAtt: TaskAttachment = {
      id: `att-link-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      name: previewLinkTitle.trim() || previewLinkUrl.trim(),
      type: 'LINK',
      url: formattedUrl,
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

  const handleRemovePreviewAttachment = (id?: string) => {
    if (!id) return;
    setPreviewAttachments((prev) => prev.filter((a) => a.id !== id));
  };

  const handleSendPreview = () => {
    if (!previewNote.trim() && previewAttachments.length === 0) return;
    const note = previewNote.trim();

    handleUpdateStatus('DONE', {
      submissionNotes: note,
      newAttachments: previewAttachments,
    });

    setPreviewNote('');
    setPreviewAttachments([]);
    setShowPreviewAddLink(false);
  };

  const handlePicSubmitReview = () => {
    const note = previewNote.trim();

    if (picDecision === 'APPROVE') {
      handleUpdateStatus('REVIEWED', {
        reviewNotes: note,
        newAttachments: previewAttachments,
      });
    } else if (picDecision === 'REVISION') {
      handleUpdateStatus('IN_PROGRESS', {
        reviewNotes: note,
        newAttachments: previewAttachments,
      });
    } else {
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
      AppStorage.addTaskActivity(activeTask.id, activity);
      refreshCurrentTask(activeTask.id);
    }

    setPreviewNote('');
    setPreviewAttachments([]);
    setShowPreviewAddLink(false);
  };

  const handleAddGeneralNote = () => {
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
    AppStorage.addTaskActivity(activeTask.id, activity);
    refreshCurrentTask(activeTask.id);

    setPreviewNote('');
    setPreviewAttachments([]);
    setShowPreviewAddLink(false);
  };

  const handleStartTask = () => {
    handleUpdateStatus('IN_PROGRESS');
  };

  const executeDeleteTask = (taskId: string) => {
    AppStorage.deleteTask(taskId);
    onRefresh();
    onClose();
  };

  const handleDeleteActivity = (actId: string) => {
    const targetAct = activities.find((a) => a.id === actId);
    if (targetAct && targetAct.userId !== currentUser.id) return;
    AppStorage.deleteTaskActivity(activeTask.id, actId);
    refreshCurrentTask(activeTask.id);
  };

  const activeTaskPicUser = users.find(
    (u) => u.id === activeTask.createdBy || u.role === 'ADMIN'
  );
  const activeTaskPicName = activeTaskPicUser?.name || 'Administrator';
  const shortDueDate = formatIndonesianDateFull(activeTask.dueDate) || activeTask.dueDate;
  const isPICActive = isAdmin || activeTask.createdBy === currentUser.id;
  const isMyTaskActive =
    activeTask.assignedTo === currentUser.id ||
    (Boolean(currentUser.email) && activeTask.assignedTo === currentUser.email) ||
    Boolean(
      activeTask.assignees?.some(
        (a) =>
          a.id === currentUser.id ||
          (currentUser.email && a.id === currentUser.email) ||
          (currentUser.name &&
            a.name?.toLowerCase().trim() === currentUser.name.toLowerCase().trim())
      )
    ) ||
    (Boolean(currentUser.name) &&
      activeTask.assignedName?.toLowerCase().trim() ===
        currentUser.name.toLowerCase().trim());
  const isDoneActive = activeTask.status === 'DONE' || activeTask.status === 'REVIEWED';
  const canDeleteActive = isPICActive || (isMyTaskActive && isDoneActive);

  // Activities list
  const activities = getTaskActivities(activeTask, users);

  // Render attachment helper item
  const renderAttachmentItem = (att: TaskAttachment) => {
    const isLink = att.type === 'LINK';
    const isImg = !isLink && (isImageFile(att.url, att.fileType) || isImageFile(att.name, att.fileType));

    return (
      <div
        key={att.id}
        className="flex items-center justify-between p-3 bg-white hover:bg-slate-50 border border-slate-200/90 rounded-2xl transition-all shadow-2xs group"
      >
        <div
          className="flex items-center gap-3 min-w-0 flex-1 cursor-pointer"
          onClick={() => {
            if (isLink) {
              openExternalLink(att.url);
            } else {
              openAttachmentDirectly(att);
            }
          }}
        >
          {/* File Thumbnail or Icon */}
          <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center shrink-0 text-blue-600">
            {isLink ? (
              <Globe className="w-5 h-5 text-sky-600" />
            ) : isImg && att.url ? (
              <img src={att.url} alt={att.name} className="w-full h-full object-cover rounded-xl" />
            ) : att.name.endsWith('.pdf') ? (
              <FileText className="w-5 h-5 text-rose-600" />
            ) : att.name.endsWith('.zip') || att.name.endsWith('.rar') ? (
              <FolderArchive className="w-5 h-5 text-amber-600" />
            ) : (
              <FileText className="w-5 h-5 text-blue-600" />
            )}
          </div>

          <div className="min-w-0 flex-1">
            <p className="text-xs sm:text-sm font-semibold text-slate-900 truncate group-hover:text-blue-600 transition-colors">
              {att.name}
            </p>
            <p className="text-[11px] text-slate-400 truncate">
              {att.fileSize ? `Ukuran: ${att.fileSize}` : isLink ? 'Tautan Web' : 'Berkas'}
              {att.uploadedAt ? ` • ${extractActivityTime(att.uploadedAt)}` : ''}
            </p>
          </div>
        </div>

        {/* Action Button */}
        <div className="flex items-center gap-1.5 shrink-0 ml-2">
          <button
            type="button"
            onClick={() => {
              if (isLink) {
                openExternalLink(att.url);
              } else {
                openAttachmentDirectly(att);
              }
            }}
            className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-blue-600 hover:text-white text-slate-700 text-xs font-semibold transition-all flex items-center gap-1 cursor-pointer"
            title="Buka / Unduh di tab baru"
          >
            {isLink ? <ExternalLink className="w-3.5 h-3.5" /> : <Download className="w-3.5 h-3.5" />}
            <span>{isLink ? 'Buka' : 'Unduh'}</span>
          </button>
        </div>
      </div>
    );
  };

  // Render Image 1 Style Properties Table
  const renderPropertiesTable = () => (
    <div className="space-y-3 py-1 text-xs sm:text-sm">
      {/* 1. Created time */}
      <div className="flex items-center gap-4">
        <div className="w-32 sm:w-36 flex items-center gap-2 text-slate-400 shrink-0 font-medium">
          <Clock className="w-4 h-4 text-slate-400" />
          <span>Created time</span>
        </div>
        <div className="text-slate-800 font-medium">
          {formatDateTimeFull(activeTask.createdAt)}
        </div>
      </div>

      {/* 2. Status */}
      <div className="flex items-center gap-4">
        <div className="w-32 sm:w-36 flex items-center gap-2 text-slate-400 shrink-0 font-medium">
          <Sparkles className="w-4 h-4 text-slate-400" />
          <span>Status</span>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <span
            className={`inline-flex items-center gap-1.5 font-semibold px-3 py-0.5 rounded-full text-xs border ${
              activeTask.status === 'REVIEWED'
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                : activeTask.status === 'DONE'
                ? 'bg-amber-50 text-amber-700 border-amber-200'
                : activeTask.status === 'IN_PROGRESS'
                ? 'bg-blue-50 text-blue-700 border-blue-200'
                : 'bg-slate-100 text-slate-700 border-slate-200'
            }`}
          >
            <span
              className={`w-2 h-2 rounded-full ${
                activeTask.status === 'REVIEWED'
                  ? 'bg-emerald-500'
                  : activeTask.status === 'DONE'
                  ? 'bg-amber-500 animate-pulse'
                  : activeTask.status === 'IN_PROGRESS'
                  ? 'bg-blue-500 animate-pulse'
                  : 'bg-slate-400'
              }`}
            />
            {activeTask.status === 'TODO' && 'Penugasan'}
            {activeTask.status === 'IN_PROGRESS' && 'Dalam Proses'}
            {activeTask.status === 'DONE' && 'Tinjauan Tugas'}
            {activeTask.status === 'REVIEWED' && 'Selesai'}
          </span>

          {activeTask.status === 'TODO' && isMyTaskActive && (
            <button
              type="button"
              onClick={handleStartTask}
              className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-full text-xs transition-colors cursor-pointer"
            >
              <ArrowRight className="w-3 h-3" />
              <span>Mulai</span>
            </button>
          )}

          {activeTask.status === 'REVIEWED' && isPICActive && (
            <button
              type="button"
              onClick={() => {
                handleUpdateStatus('IN_PROGRESS', {
                  reviewNotes: '',
                });
              }}
              className="text-xs text-slate-500 hover:text-slate-800 font-medium underline underline-offset-2 cursor-pointer ml-1"
            >
              Buka Kembali
            </button>
          )}
        </div>
      </div>

      {/* 3. Priority */}
      <div className="flex items-center gap-4">
        <div className="w-32 sm:w-36 flex items-center gap-2 text-slate-400 shrink-0 font-medium">
          <CheckCircle2 className="w-4 h-4 text-slate-400" />
          <span>Priority</span>
        </div>
        <div>
          <span
            className={`inline-flex items-center px-3 py-0.5 rounded-full text-xs font-semibold ${
              activeTask.priority === 'URGENT'
                ? 'bg-rose-100 text-rose-700'
                : activeTask.priority === 'HIGH'
                ? 'bg-amber-100 text-amber-700'
                : activeTask.priority === 'MEDIUM'
                ? 'bg-sky-100 text-sky-700'
                : 'bg-purple-100 text-purple-700'
            }`}
          >
            {activeTask.priority === 'URGENT'
              ? 'Urgent'
              : activeTask.priority === 'HIGH'
              ? 'High'
              : activeTask.priority === 'MEDIUM'
              ? 'Medium'
              : 'Low'}
          </span>
        </div>
      </div>

      {/* 4. Due Date */}
      <div className="flex items-center gap-4">
        <div className="w-32 sm:w-36 flex items-center gap-2 text-slate-400 shrink-0 font-medium">
          <Calendar className="w-4 h-4 text-slate-400" />
          <span>Due Date</span>
        </div>
        <div className="text-slate-800 font-medium">
          {shortDueDate}
        </div>
      </div>

      {/* 5. Assignees */}
      <div className="flex items-center gap-4">
        <div className="w-32 sm:w-36 flex items-center gap-2 text-slate-400 shrink-0 font-medium">
          <Users className="w-4 h-4 text-slate-400" />
          <span>Assignees</span>
        </div>
        <div className="flex items-center gap-2">
          {activeTask.assignees && activeTask.assignees.length > 0 ? (
            <div className="flex items-center -space-x-2">
              {activeTask.assignees.map((a, i) => (
                <div
                  key={i}
                  className="w-7 h-7 rounded-full border-2 border-white overflow-hidden bg-slate-200 shrink-0 shadow-2xs"
                  title={a.name}
                >
                  {a.avatar ? (
                    <img src={a.avatar} alt={a.name} className="w-full h-full object-cover" />
                  ) : (
                    <span className="w-full h-full flex items-center justify-center font-bold text-[10px] text-slate-700 bg-purple-100">
                      {a.name.substring(0, 2).toUpperCase()}
                    </span>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="flex items-center gap-1.5">
              <div className="w-7 h-7 rounded-full border-2 border-white overflow-hidden bg-slate-200 shrink-0 shadow-2xs">
                {activeTask.assignedAvatar ? (
                  <img
                    src={activeTask.assignedAvatar}
                    alt={activeTask.assignedName}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span className="w-full h-full flex items-center justify-center font-bold text-[10px] text-slate-700 bg-purple-100">
                    {activeTask.assignedName?.substring(0, 2).toUpperCase() || 'US'}
                  </span>
                )}
              </div>
              <span className="text-slate-800 font-medium">{activeTask.assignedName}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  // Chat activities stream component
  const renderChatStream = () => (
    <div className="space-y-3.5 pb-2">
      {activities.length === 0 ? (
        <div className="h-full flex-1 flex flex-col items-center justify-center py-10 px-6 text-center select-none">
          <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center mb-2 text-slate-400">
            <MessageSquare className="w-4 h-4" />
          </div>
          <p className="text-xs text-slate-400 font-medium">
            Belum ada pesan atau catatan progres dalam ruang obrolan ini.
          </p>
        </div>
      ) : (
        (() => {
          let lastDateKey = '';
          return activities.map((act, index) => {
            const isMe = act.userId === currentUser.id;
            const dateKey = formatActivityDateDivider(act.timestamp);
            const showDateDivider = dateKey !== lastDateKey;
            if (showDateDivider) lastDateKey = dateKey;
            const timeOnly = extractActivityTime(act.timestamp) || act.timestamp;

            return (
              <React.Fragment key={act.id || index}>
                {showDateDivider && (
                  <div className="flex items-center justify-center my-3 select-none">
                    <div className="h-px bg-slate-200/90 flex-1" />
                    <span className="mx-3 px-2.5 py-0.5 rounded-full bg-white border border-slate-200/80 text-[10px] font-semibold text-slate-500 tracking-wide shadow-2xs">
                      {dateKey}
                    </span>
                    <div className="h-px bg-slate-200/90 flex-1" />
                  </div>
                )}

                {isMe ? (
                  /* Pesan Diri Sendiri (Kanan) */
                  <div className="flex flex-col items-end self-end max-w-[85%] sm:max-w-[78%] ml-auto animate-in fade-in duration-150">
                    <div className="bg-[#007AFF] text-white px-4 py-2.5 rounded-2xl rounded-br-xs text-xs sm:text-sm leading-relaxed shadow-2xs">
                      {act.notes && (
                        <div className="whitespace-pre-wrap">{act.notes}</div>
                      )}

                      {act.attachments && act.attachments.length > 0 && (
                        <div className="pt-2 flex flex-wrap gap-2">
                          {act.attachments.map((att) => (
                            <button
                              key={att.id}
                              type="button"
                              onClick={() => openAttachmentDirectly(att)}
                              className="flex items-center gap-1.5 px-2.5 py-1.5 bg-white/25 hover:bg-white/35 active:scale-95 border border-white/30 rounded-xl text-[11px] font-semibold text-white transition-all cursor-pointer shadow-2xs"
                              title={`Buka ${att.name} di tab baru`}
                            >
                              {att.type === 'LINK' ? <Globe className="w-3.5 h-3.5" /> : <Paperclip className="w-3.5 h-3.5" />}
                              <span className="truncate max-w-[140px]">{att.name}</span>
                              <ExternalLink className="w-3 h-3 opacity-70 ml-0.5" />
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5 mr-2 mt-1">
                      <span className="text-[10px] text-gray-400">{timeOnly} · Terkirim</span>
                      {act.userId === currentUser.id && (
                        <button
                          type="button"
                          onClick={() => handleDeleteActivity(act.id)}
                          className="text-rose-600 hover:text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200/80 p-0.5 rounded transition-all cursor-pointer"
                          title="Hapus pesan saya"
                        >
                          <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                        </button>
                      )}
                    </div>
                  </div>
                ) : (
                  /* Pesan Rekan / PIC (Kiri) */
                  <div className="flex items-end gap-2 max-w-[85%] sm:max-w-[78%] animate-in fade-in duration-150">
                    <div className="w-7 h-7 rounded-full overflow-hidden bg-slate-200 border border-slate-300 shrink-0 mb-1">
                      {act.userAvatar ? (
                        <img src={act.userAvatar} alt={act.userName} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center font-bold text-xs text-slate-700 bg-purple-100">
                          {act.userName ? act.userName.charAt(0).toUpperCase() : 'U'}
                        </div>
                      )}
                    </div>

                    <div className="flex flex-col items-start min-w-0">
                      <div className="flex items-center gap-1.5 ml-3 mb-1">
                        <span className="text-[11px] font-semibold text-gray-500">{act.userName}</span>
                      </div>

                      <div className="bg-[#E9E9EB] text-gray-900 px-4 py-2.5 rounded-2xl rounded-bl-xs text-xs sm:text-sm leading-relaxed shadow-2xs">
                        {act.notes && (
                          <div className="whitespace-pre-wrap">{act.notes}</div>
                        )}

                        {act.attachments && act.attachments.length > 0 && (
                          <div className="pt-2 flex flex-wrap gap-2">
                            {act.attachments.map((att) => (
                              <button
                                key={att.id}
                                type="button"
                                onClick={() => openAttachmentDirectly(att)}
                                className="flex items-center gap-1.5 px-2.5 py-1.5 bg-white hover:bg-slate-50 active:scale-95 border border-slate-200 rounded-xl text-[11px] font-semibold text-[#1E3A8A] transition-all cursor-pointer shadow-2xs"
                                title={`Buka ${att.name} di tab baru`}
                              >
                                {att.type === 'LINK' ? <Globe className="w-3.5 h-3.5" /> : <Paperclip className="w-3.5 h-3.5" />}
                                <span className="truncate max-w-[140px]">{att.name}</span>
                                <ExternalLink className="w-3 h-3 opacity-70 ml-0.5" />
                              </button>
                            ))}
                          </div>
                        )}
                      </div>

                      <div className="flex items-center gap-1.5 ml-3 mt-1">
                        <span className="text-[10px] text-gray-400">{timeOnly}</span>
                      </div>
                    </div>
                  </div>
                )}
              </React.Fragment>
            );
          });
        })()
      )}
      <div ref={messagesEndRef} />
    </div>
  );

  // Bottom Input Action Section
  const renderChatInput = () => (
    <div className="p-4 border-t border-slate-200/80 bg-white shrink-0 space-y-3">
      {/* Opsi Keputusan PIC untuk Tugas Menunggu Review */}
      {isPICActive && activeTask.status === 'DONE' && (
        <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
          <div className="flex items-center gap-2 flex-1">
            <button
              type="button"
              onClick={() => setPicDecision('APPROVE')}
              className={`flex-1 py-1.5 px-3 rounded-xl border text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                picDecision === 'APPROVE'
                  ? 'bg-emerald-100 border-emerald-400 text-emerald-800 ring-2 ring-emerald-400/30 shadow-2xs'
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
                  ? 'bg-rose-100 border-rose-400 text-rose-800 ring-2 ring-rose-400/30 shadow-2xs'
                  : 'bg-rose-50/60 border-rose-200/60 text-rose-700 hover:bg-rose-100/70 font-semibold'
              }`}
            >
              <RotateCcw className="w-3.5 h-3.5 text-rose-600" />
              <span>Minta Revisi</span>
            </button>
          </div>
        </div>
      )}

      {/* Render Lampiran Berkas Sementara sebelum dikirim */}
      {previewAttachments.length > 0 && (
        <div className="flex flex-wrap gap-2 pt-1 max-h-24 overflow-y-auto">
          {previewAttachments.map((att) => (
            <div
              key={att.id}
              className="px-2.5 py-1 bg-slate-100 border border-slate-200 rounded-lg flex items-center gap-2 text-xs text-slate-700"
            >
              {att.type === 'LINK' ? (
                <Link2 className="w-3 h-3 text-sky-600" />
              ) : (
                <Paperclip className="w-3 h-3 text-slate-500" />
              )}
              <span className="truncate max-w-[120px] font-medium">{att.name}</span>
              <button
                type="button"
                onClick={() => handleRemovePreviewAttachment(att.id)}
                className="p-0.5 text-slate-400 hover:text-rose-600 rounded cursor-pointer"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Form Input Tambah Tautan Link */}
      {showPreviewAddLink && (
        <div className="p-3 bg-sky-50/70 border border-sky-200 rounded-xl space-y-2 animate-in fade-in">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-sky-900 flex items-center gap-1.5">
              <Link2 className="w-3.5 h-3.5 text-sky-600" />
              Sematkan Tautan
            </span>
            <button
              type="button"
              onClick={() => setShowPreviewAddLink(false)}
              className="text-slate-400 hover:text-slate-600 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="space-y-1.5">
            <input
              type="text"
              placeholder="Judul Tautan (Opsional)"
              value={previewLinkTitle}
              onChange={(e) => setPreviewLinkTitle(e.target.value)}
              className="w-full px-2.5 py-1.5 bg-white border border-sky-200 rounded-lg text-xs outline-none text-slate-800"
            />
            <input
              type="url"
              placeholder="https://drive.google.com/..."
              value={previewLinkUrl}
              onChange={(e) => setPreviewLinkUrl(e.target.value)}
              className="w-full px-2.5 py-1.5 bg-white border border-sky-200 rounded-lg text-xs outline-none text-slate-800"
            />
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={handleAddPreviewLink}
              disabled={!previewLinkUrl.trim()}
              className="px-3 py-1 bg-sky-600 hover:bg-sky-700 disabled:opacity-50 text-white font-bold rounded-lg text-xs transition-colors cursor-pointer"
            >
              Tambah Tautan
            </button>
          </div>
        </div>
      )}

      {/* Inline Peringatan Validasi Upload Berkas */}
      {taskUploadError && (
        <div className="flex items-center gap-2 px-3 py-2 text-xs text-rose-700 bg-rose-50 border border-rose-200/90 rounded-xl animate-in fade-in duration-200 shadow-2xs">
          <AlertCircle className="w-3.5 h-3.5 shrink-0 text-rose-500" />
          <span className="font-medium">{taskUploadError}</span>
        </div>
      )}

      {/* Baris Input Chat Utama */}
      <div className="flex items-end gap-1.5 sm:gap-2">
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
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                if (isPICActive && activeTask.status === 'DONE') {
                  handlePicSubmitReview();
                } else if (activeTask.status === 'REVIEWED') {
                  handleAddGeneralNote();
                } else {
                  handleSendPreview();
                }
              }
            }}
            placeholder={
              isPICActive && activeTask.status === 'DONE'
                ? picDecision === 'APPROVE'
                  ? 'Tulis konfirmasi penugasan selesai...'
                  : 'Tulis arahan revisi...'
                : isPICActive
                ? `Tulis pesan untuk ${activeTask.assignedName}...`
                : 'Tulis pesan di sini...'
            }
            className="w-full bg-[#F2F2F7] border border-gray-200/80 rounded-2xl px-4 py-2 text-xs sm:text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#1E3A8A]/30 focus:bg-white transition resize-none max-h-28 overflow-y-auto leading-relaxed"
          />
        </div>

        <button
          type="button"
          disabled={!previewNote.trim() && previewAttachments.length === 0}
          onClick={() => {
            if (isPICActive && activeTask.status === 'DONE') {
              handlePicSubmitReview();
            } else if (activeTask.status === 'REVIEWED') {
              handleAddGeneralNote();
            } else {
              handleSendPreview();
            }
          }}
          className={`w-8 h-8 rounded-full text-white flex items-center justify-center hover:opacity-90 active:scale-95 transition shrink-0 shadow-2xs disabled:opacity-40 cursor-pointer mb-1 ${
            isPICActive && activeTask.status === 'DONE'
              ? picDecision === 'APPROVE'
                ? 'bg-emerald-600'
                : 'bg-rose-600'
              : 'bg-[#1E3A8A]'
          }`}
          title="Kirim Pesan"
        >
          <ArrowUp className="w-4 h-4 stroke-[2.5]" />
        </button>
      </div>

      {/* Tombol Hapus Tugas: PIC selalu bisa, Pelaksana bisa jika tugas sudah SELESAI */}
      {canDeleteActive && (
        <div className="pt-1 flex items-center justify-end text-[11px] text-slate-400">
          <button
            type="button"
            onClick={() => {
              executeDeleteTask(activeTask.id);
              handleModalClose();
            }}
            className="px-2 py-0.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg font-semibold transition-colors flex items-center gap-1 cursor-pointer ml-auto"
            title={isPICActive ? "Hapus Tugas Langsung" : "Hapus Tugas Selesai"}
          >
            <Trash2 className="w-3 h-3" />
            {isPICActive ? "Hapus Tugas" : "Hapus Tugas Selesai"}
          </button>
        </div>
      )}
    </div>
  );

  return (
    <div
      className={`fixed inset-0 z-[100] flex animate-in fade-in duration-200 ${
        isFullScreen
          ? 'items-center justify-center p-0'
          : 'justify-end items-center p-2.5 sm:p-4 md:p-5'
      }`}
    >
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-950/40 backdrop-blur-xs transition-opacity cursor-pointer z-[100]"
        onClick={handleModalClose}
      />

      {/* Dialog Card Container */}
      <div
        className={`relative z-[101] bg-white shadow-2xl flex flex-col min-h-0 overflow-hidden transition-all duration-300 font-sans ${
          isFullScreen
            ? 'w-full h-full max-w-none max-h-none rounded-none border-0'
            : 'w-full max-w-md sm:max-w-lg md:max-w-xl h-full max-h-[calc(100vh-1.25rem)] sm:max-h-[calc(100vh-2rem)] rounded-3xl border border-slate-200/80 animate-in slide-in-from-right duration-300 ease-out'
        }`}
      >
        {/* ========================================================= */}
        {/* TOP NAVBAR (Sleek window navbar with Zoom & Close icons) */}
        {/* ========================================================= */}
        <div className="px-5 py-3 border-b border-slate-100 bg-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <button
              type="button"
              onClick={() => setIsFullScreen(!isFullScreen)}
              className="p-1.5 sm:p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl border border-slate-200/80 transition-colors cursor-pointer"
              title={isFullScreen ? 'Perkecil Tampilan' : 'Perbesar Layar Penuh'}
            >
              {isFullScreen ? (
                <Minimize2 className="w-4 h-4 text-slate-600" />
              ) : (
                <Maximize2 className="w-4 h-4 text-slate-600" />
              )}
            </button>
            {isFullScreen && (
              <span className="text-xs font-semibold text-slate-500 truncate max-w-md hidden sm:inline">
                {activeTask.title}
              </span>
            )}
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={handleModalClose}
              className="p-1.5 sm:p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl border border-slate-200/80 transition-colors cursor-pointer"
              title="Tutup Panel"
            >
              <X className="w-4 h-4 sm:w-5 sm:h-5 text-slate-600" />
            </button>
          </div>
        </div>

        {/* ========================================================= */}
        {/* MODAL BODY (Zoomed = Split 2 Columns; Unzoomed = Vertical) */}
        {/* ========================================================= */}
        {isFullScreen ? (
          /* =================== FULLSCREEN SPLIT VIEW =================== */
          <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 lg:grid-rows-1 min-h-0 h-full overflow-hidden">
            {/* SEBELAH KIRI (lg:col-span-7): RINCIAN TUGAS & LAMPIRAN */}
            <div className="lg:col-span-7 xl:col-span-7 h-full min-h-0 overflow-y-auto custom-scrollbar p-6 sm:p-8 space-y-6 border-r border-slate-200/80 bg-white">
              {/* Judul Besar (Gaya Gambar 1 & Gambar 2) */}
              <div className="space-y-2">
                <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight leading-snug">
                  {activeTask.title}
                </h1>
                <p className="text-xs text-slate-400">
                  Dibuat oleh <strong className="text-slate-700">{activeTaskPicName}</strong> • {formatDateTimeFull(activeTask.createdAt)}
                </p>
              </div>

              {/* Project Description (Kotak Rounded Soft - Gaya Gambar 1) */}
              <div className="bg-slate-50/80 rounded-2xl p-5 border border-slate-100 space-y-2">
                <h3 className="text-xs sm:text-sm font-bold text-slate-900 uppercase tracking-wider">
                  Project Description
                </h3>
                <p className="text-xs sm:text-sm text-slate-600 leading-relaxed whitespace-pre-wrap">
                  {activeTask.description || 'Tidak ada deskripsi rinci untuk tugas ini.'}
                </p>
              </div>

              {/* Berkas & Tautan Lampiran (Attachments - Gaya Gambar 2) */}
              <div className="space-y-3 pt-1">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    <Paperclip className="w-4 h-4 text-slate-500" />
                    <span>Attachments ({allAttachments.length})</span>
                  </h3>
                </div>

                {/* List Berkas Lampiran */}
                {allAttachments.length === 0 ? (
                  <div className="p-5 rounded-2xl border-2 border-dashed border-slate-200 text-center text-xs text-slate-400 space-y-1">
                    <p className="font-semibold text-slate-500">Belum ada berkas atau tautan yang dilampirkan</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {allAttachments.map((att) => renderAttachmentItem(att))}
                  </div>
                )}
              </div>

              {/* Attributes / Metadata Section (Gaya Gambar 2 Sisi Kanan) */}
              <div className="space-y-4 pt-4 border-t border-slate-100">
                <h3 className="text-sm font-bold text-slate-900">Attributes</h3>
                <div className="bg-slate-50/70 rounded-2xl p-4 sm:p-5 border border-slate-100 space-y-3.5">
                  {/* Due date */}
                  <div className="flex items-center justify-between text-xs sm:text-sm">
                    <div className="flex items-center gap-2 text-slate-500 font-medium">
                      <Calendar className="w-4 h-4 text-slate-400" />
                      <span>Due date</span>
                    </div>
                    <span className="font-semibold text-slate-800">{shortDueDate}</span>
                  </div>

                  {/* Assigned to */}
                  <div className="flex items-center justify-between text-xs sm:text-sm">
                    <div className="flex items-center gap-2 text-slate-500 font-medium">
                      <Users className="w-4 h-4 text-slate-400" />
                      <span>Assigned to</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {activeTask.assignedAvatar ? (
                        <img
                          src={activeTask.assignedAvatar}
                          alt={activeTask.assignedName}
                          className="w-5 h-5 rounded-full object-cover border border-slate-200"
                        />
                      ) : (
                        <div className="w-5 h-5 rounded-full bg-slate-200 text-slate-700 font-bold text-[9px] flex items-center justify-center">
                          {activeTask.assignedName?.substring(0, 2).toUpperCase() || 'ST'}
                        </div>
                      )}
                      <span className="font-semibold text-slate-800">{activeTask.assignedName}</span>
                    </div>
                  </div>

                  {/* Priority */}
                  <div className="flex items-center justify-between text-xs sm:text-sm">
                    <div className="flex items-center gap-2 text-slate-500 font-medium">
                      <CheckCircle2 className="w-4 h-4 text-slate-400" />
                      <span>Priority</span>
                    </div>
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold ${
                        activeTask.priority === 'URGENT'
                          ? 'bg-rose-100 text-rose-700'
                          : activeTask.priority === 'HIGH'
                          ? 'bg-amber-100 text-amber-700'
                          : activeTask.priority === 'MEDIUM'
                          ? 'bg-sky-100 text-sky-700'
                          : 'bg-purple-100 text-purple-700'
                      }`}
                    >
                      {activeTask.priority === 'URGENT' ? 'Urgent' : activeTask.priority}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* SEBELAH KANAN (lg:col-span-5): ROOM CHATING */}
            <div className="lg:col-span-5 xl:col-span-5 h-full min-h-0 flex flex-col overflow-hidden bg-slate-50/40">
              {/* Header Ruang Obrolan */}
              <div className="px-5 py-3.5 border-b border-slate-200/80 bg-white flex items-center justify-between shrink-0">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                    <MessageSquare className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-xs sm:text-sm font-bold text-slate-900 leading-tight">
                      Ruang Obrolan & Diskusi Tugas
                    </h3>
                    <p className="text-[11px] text-slate-400">Diskusikan progres & arahan tugas secara langsung</p>
                  </div>
                </div>
                <span className="text-[11px] font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
                  {activities.length} Pesan
                </span>
              </div>

              {/* Chat messages stream */}
              <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar p-4 sm:p-5 space-y-3.5">
                {renderChatStream()}
              </div>

              {/* Bottom input bar */}
              {renderChatInput()}
            </div>
          </div>
        ) : (
          /* =================== UNZOOMED NORMAL DRAWER VIEW =================== */
          <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
            {/* Scrollable middle area */}
            <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar p-4 sm:p-5 space-y-4 bg-slate-50/40">
              {/* 1. Header Card (Gaya Gambar 1: Judul Besar + Metadata Tabel + Deskripsi Proyek) */}
              <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-100 shadow-2xs space-y-4">
                {/* Judul Besar */}
                <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight leading-snug">
                  {activeTask.title}
                </h1>

                {/* Metadata Tabel Vertikal (Persis Gambar 1) */}
                {renderPropertiesTable()}

                {/* Kotak Deskripsi Proyek (Project Description - Persis Gambar 1) */}
                <div className="bg-slate-50/90 rounded-2xl p-4 border border-slate-100 space-y-1.5">
                  <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                    Project Description
                  </h3>
                  <p className="text-xs sm:text-sm text-slate-600 leading-relaxed whitespace-pre-wrap font-normal">
                    {activeTask.description || 'Tidak ada deskripsi rinci untuk tugas ini.'}
                  </p>
                </div>
              </div>

              {/* 2. Berkas & Tautan Lampiran (Attachments - Gaya Gambar 2) */}
              <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-100 shadow-2xs space-y-3">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <h3 className="text-xs sm:text-sm font-bold text-slate-900 flex items-center gap-2">
                    <Paperclip className="w-4 h-4 text-slate-500" />
                    <span>Attachments ({allAttachments.length})</span>
                  </h3>
                </div>

                {/* List Berkas Lampiran */}
                {allAttachments.length === 0 ? (
                  <div className="p-4 rounded-xl border-2 border-dashed border-slate-200 text-center text-xs text-slate-400">
                    Belum ada berkas atau tautan yang dilampirkan pada tugas ini.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {allAttachments.map((att) => renderAttachmentItem(att))}
                  </div>
                )}
              </div>

              {/* 3. Ruang Obrolan & Riwayat Diskusi */}
              <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-100 shadow-2xs space-y-3">
                <div className="flex items-center justify-between pb-1 border-b border-slate-100">
                  <h3 className="text-xs sm:text-sm font-bold text-slate-900 flex items-center gap-1.5">
                    <MessageSquare className="w-4 h-4 text-blue-600" />
                    <span>Ruang Obrolan & Riwayat Pesan</span>
                  </h3>
                  <span className="text-[11px] text-slate-400">{activities.length} Pesan</span>
                </div>
                {renderChatStream()}
              </div>
            </div>

            {/* Bottom Input Action Section */}
            {renderChatInput()}
          </div>
        )}
      </div>

      {/* Modern Confirm Dialog for Deleting Task */}
      <ModernConfirmDialog
        isOpen={Boolean(taskToDelete)}
        title="Hapus Tugas Permanen?"
        message="Tugas ini beserta seluruh riwayat percakapan dan lampiran akan dihapus secara permanen dari sistem."
        confirmText="Hapus Permanen"
        cancelText="Batal"
        type="danger"
        onConfirm={() => {
          if (taskToDelete) executeDeleteTask(taskToDelete);
          setTaskToDelete(null);
        }}
        onCancel={() => setTaskToDelete(null)}
      />
    </div>
  );
}
