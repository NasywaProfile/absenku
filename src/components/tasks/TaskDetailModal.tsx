import React, { useState, useRef, useEffect } from 'react';
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
} from 'lucide-react';
import { TaskItem, TaskStatus, TaskAttachment, TaskActivity, User as UserType } from '../../types/index.ts';
import { AppStorage } from '../../lib/storage.ts';
import { formatIndonesianDateShort } from '../../lib/time-utils.ts';
import { ModernConfirmDialog } from '../common/ModernConfirmDialog.tsx';
import { compressImageFile } from '../../lib/image-compression.ts';
import { uploadToCloudinary } from '../../lib/cloudinary.ts';
import { uploadHybridFile } from '../../lib/file-uploader.ts';
import { MediaPreviewModal, MediaPreviewData } from '../common/MediaPreviewModal.tsx';
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

  const [previewNote, setPreviewNote] = useState('');
  const [previewAttachments, setPreviewAttachments] = useState<TaskAttachment[]>([]);
  const [taskUploadError, setTaskUploadError] = useState<string | null>(null);
  const [showPreviewAddLink, setShowPreviewAddLink] = useState(false);
  const [previewLinkTitle, setPreviewLinkTitle] = useState('');
  const [previewLinkUrl, setPreviewLinkUrl] = useState('');
  const [picDecision, setPicDecision] = useState<'APPROVE' | 'REVISION' | 'NOTE'>('APPROVE');
  const [taskToDelete, setTaskToDelete] = useState<string | null>(null);
  const [mediaPreview, setMediaPreview] = useState<MediaPreviewData | null>(null);

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

  const handleUpdateStatus = (
    targetStatus: TaskStatus,
    notes?: { submissionNotes?: string; reviewNotes?: string; newAttachments?: TaskAttachment[] }
  ) => {
    AppStorage.updateTaskStatus(activeTask.id, targetStatus, {
      ...notes,
      activityUser: {
        id: currentUser.id,
        name: currentUser.name,
        role: userRole,
        avatar: currentUser.avatar,
      },
    });
    refreshCurrentTask(activeTask.id);
  };

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
    const note = previewNote.trim() || 'Hasil preview tugas dilampirkan untuk ditinjau oleh PIC.';

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
        reviewNotes: note || 'Penugasan Selesai (ACC oleh PIC)',
        newAttachments: previewAttachments,
      });
    } else if (picDecision === 'REVISION') {
      handleUpdateStatus('IN_PROGRESS', {
        reviewNotes: note || 'Mohon disempurnakan kembali sesuai catatan arahan dari PIC.',
        newAttachments: previewAttachments,
      });
    } else {
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
    AppStorage.deleteTaskActivity(activeTask.id, actId);
    refreshCurrentTask(activeTask.id);
  };

  const activeTaskPicUser = users.find(
    (u) => u.id === activeTask.createdBy || u.role === 'ADMIN'
  );
  const activeTaskPicName = activeTaskPicUser?.name || 'Administrator (PIC)';
  const shortDueDate = formatIndonesianDateShort(activeTask.dueDate) || activeTask.dueDate;
  const isPICActive = isAdmin || activeTask.createdBy === currentUser.id;
  const isMyTaskActive =
    activeTask.assignedTo === currentUser.id ||
    Boolean(activeTask.assignees?.some((a) => a.id === currentUser.id));

  return (
    <div
      className={`fixed inset-0 z-[100] flex animate-in fade-in duration-200 ${
        isFullScreen
          ? 'items-center justify-center p-0'
          : 'justify-end items-center p-2.5 sm:p-4 md:p-5'
      }`}
    >
      {/* Backdrop Blur */}
      <div
        className="fixed inset-0 bg-slate-950/40 backdrop-blur-xs transition-opacity cursor-pointer z-[100]"
        onClick={handleModalClose}
      />

      {/* Modal Dialog Card */}
      <div
        className={`relative z-[101] bg-white shadow-2xl flex flex-col min-h-0 overflow-hidden transition-all duration-300 font-sans ${
          isFullScreen
            ? 'w-full h-full max-w-none max-h-none rounded-none border-0'
            : 'w-full max-w-md sm:max-w-lg md:max-w-xl h-full max-h-[calc(100vh-1.25rem)] sm:max-h-[calc(100vh-2rem)] rounded-3xl border border-slate-200/80 animate-in slide-in-from-right duration-300 ease-out'
        }`}
      >
        
        {/* Header Drawer */}
        <div className="px-5 py-4 border-b border-slate-100 bg-white space-y-3 shrink-0">
          {/* Baris Atas: Zoom (kiri), Judul & Deskripsi Tugas (tengah), Tutup Panel (kanan) */}
          <div className="flex items-start justify-between gap-3">
            {/* Zoom / Fullscreen Button di pojok kiri atas */}
            <div className="w-9 shrink-0 flex items-start">
              <button
                type="button"
                onClick={() => setIsFullScreen(!isFullScreen)}
                className="p-1.5 sm:p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl border border-slate-200/80 transition-colors cursor-pointer shrink-0 mt-0.5"
                title={isFullScreen ? "Perkecil Tampilan" : "Perbesar Layar Penuh"}
              >
                {isFullScreen ? (
                  <Minimize2 className="w-4 h-4 text-slate-600" />
                ) : (
                  <Maximize2 className="w-4 h-4 text-slate-600" />
                )}
              </button>
            </div>

            {/* Judul & Subjudul diposisikan di tengah persis seperti di Ruang Obrolan */}
            <div className="flex-1 min-w-0 text-center px-1 sm:px-3 space-y-1.5 flex flex-col items-center justify-center pt-2.5 sm:pt-3">
              <h2 className="text-sm sm:text-[15px] font-bold text-slate-900 tracking-tight leading-snug max-w-2xl">
                {activeTask.title}
              </h2>
              {activeTask.description && (
                <p className="text-slate-500 text-[11px] sm:text-xs leading-relaxed font-normal whitespace-pre-wrap max-w-2xl">
                  {activeTask.description}
                </p>
              )}
            </div>

            {/* Container Tombol Tutup Panel di pojok kanan atas */}
            <div className="w-9 shrink-0 flex items-start justify-end">
              <button
                type="button"
                onClick={handleModalClose}
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
          <div className="flex items-start justify-between gap-4 pt-0.5 text-xs text-slate-500">
            {/* Kolom Kiri: Status & Pelaksana */}
            <div className="flex flex-col items-start gap-2 min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span
                  className={`inline-flex items-center gap-1.5 font-semibold px-2.5 py-0.5 rounded-full text-[11px] border ${
                    activeTask.status === 'REVIEWED'
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      : activeTask.status === 'DONE'
                      ? 'bg-amber-50 text-amber-700 border-amber-200'
                      : activeTask.status === 'IN_PROGRESS'
                      ? 'bg-blue-50 text-blue-600 border-blue-200'
                      : 'bg-slate-100 text-slate-700 border-slate-200'
                  }`}
                >
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${
                      activeTask.status === 'REVIEWED'
                        ? 'bg-emerald-600'
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
                    className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded text-[11px] transition-colors cursor-pointer"
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
                        reviewNotes: 'Tugas dibuka kembali oleh PIC untuk penyesuaian lanjutan.',
                      });
                    }}
                    className="text-[11px] text-slate-500 hover:text-slate-800 font-medium underline underline-offset-2 cursor-pointer"
                  >
                    Buka Kembali
                  </button>
                )}
              </div>

              {activeTask.assignees && activeTask.assignees.length > 1 ? (
                <div className="flex items-center gap-1.5 text-xs flex-wrap" title={`Pelaksana: ${activeTask.assignees.map((a) => a.name).join(', ')}`}>
                  <div className="flex items-center -space-x-1.5 shrink-0">
                    {activeTask.assignees.slice(0, 4).map((a, i) => (
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
                    {activeTask.assignees.map((a) => a.name.split(' ')[0]).join(', ')}
                  </span>
                </div>
              ) : (
                <div className="flex items-center gap-1.5 text-xs" title={`Pelaksana: ${activeTask.assignedName}`}>
                  {activeTask.assignedAvatar ? (
                    <img
                      src={activeTask.assignedAvatar}
                      alt={activeTask.assignedName}
                      className="w-5 h-5 rounded-full object-cover shrink-0 border border-slate-200"
                    />
                  ) : (
                    <div className="w-5 h-5 rounded-full bg-slate-200 text-slate-700 font-bold text-[9px] flex items-center justify-center shrink-0">
                      {activeTask.assignedName
                        ? activeTask.assignedName.substring(0, 2).toUpperCase()
                        : 'ST'}
                    </div>
                  )}
                  <span className="font-medium text-slate-700">{formatChipName(activeTask.assignedName)}</span>
                </div>
              )}
            </div>

            {/* Kolom Kanan: Tanggal & PIC */}
            <div className="flex flex-col items-end gap-2 shrink-0">
              <div className="flex items-center gap-1.5 text-xs text-slate-500">
                <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <span className="text-slate-700 font-medium">{shortDueDate}</span>
              </div>

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
        </div>

        {/* Middle Content Area */}
        <div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-5 space-y-3.5 bg-slate-50/40">

          {(() => {
            const activities = getTaskActivities(activeTask, users);

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

                  const dateKey = formatActivityDateDivider(act.timestamp);
                  const showDateDivider = dateKey !== lastDateKey;
                  if (showDateDivider) {
                    lastDateKey = dateKey;
                  }

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
                              {act.userRole === 'ADMIN' || act.userRole === 'SUPER_ADMIN' ? (
                                <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                                  PIC
                                </span>
                              ) : null}
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

        {/* Bottom Input Action Section */}
        <div className="p-4 border-t border-slate-200/80 bg-white shrink-0 space-y-3 shadow-lg">
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
            <div className="flex items-center justify-between gap-1.5 px-3 py-1.5 text-xs text-rose-600 bg-rose-50 border border-rose-200/90 rounded-xl animate-in fade-in duration-200">
              <div className="flex items-center gap-1.5 min-w-0">
                <AlertCircle className="w-3.5 h-3.5 shrink-0 text-rose-500" />
                <span className="font-medium">{taskUploadError}</span>
              </div>
              <button
                type="button"
                onClick={() => setTaskUploadError(null)}
                className="text-rose-400 hover:text-rose-700 ml-1 shrink-0 cursor-pointer p-0.5"
                title="Tutup pesan"
              >
                <X className="w-3.5 h-3.5" />
              </button>
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
                  isPICActive && activeTask.status === 'DONE'
                    ? picDecision === 'APPROVE'
                      ? 'Tulis konfirmasi penugasan selesai...'
                      : 'Tulis arahan revisi...'
                    : isPICActive
                    ? `Tulis pesan untuk ${activeTask.assignedName}...`
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
              title={
                isPICActive && activeTask.status === 'DONE'
                  ? 'Kirim Evaluasi PIC'
                  : activeTask.status === 'REVIEWED'
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
                onClick={() => setTaskToDelete(activeTask.id)}
                className="px-2 py-0.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg font-semibold transition-colors flex items-center gap-1 cursor-pointer ml-auto"
              >
                <Trash2 className="w-3 h-3" />
                Hapus Tugas
              </button>
            </div>
          )}
        </div>
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

      {/* Modal Pratinjau Berkas, Gambar, dan Tautan Interaktif */}
      <MediaPreviewModal
        media={mediaPreview}
        onClose={() => setMediaPreview(null)}
      />
    </div>
  );
}
