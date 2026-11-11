import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Maximize2,
  Minimize2,
  Clock,
  ChevronDown,
  ChevronUp,
  Paperclip,
  Globe,
  ExternalLink,
  Download,
  Send,
  ArrowUp,
  MessageSquare,
  Calendar,
  Trash2,
  AlertCircle,
  Sparkles,
  Tag,
  Users,
  CheckCircle2,
  FolderArchive,
  FileText,
  Upload,
  CheckSquare,
  Link2,
  UserPlus,
  Search,
} from 'lucide-react';
import {
  ChatTopic,
  ChatComment,
  ChatTopicStatus,
  User as UserType,
  UserRole,
  TaskAttachment,
  safeParseJsonArray,
} from '../../types/index.ts';
import { AppStorage } from '../../lib/storage.ts';
import { ApiClient } from '../../lib/api-client.ts';
import {
  Bubble,
  BubbleContent,
  BubbleGroup,
  BubbleReactions,
  DateDivider,
} from '@/components/ui/bubble';
import { uploadHybridFile } from '../../lib/file-uploader.ts';
import { openExternalLink, openAttachmentDirectly, isImageFile } from '../../lib/open-media.ts';
import { MediaPreviewModal, MediaPreviewData } from '../common/MediaPreviewModal.tsx';
import { TeamMembersModal, TeamMemberItem } from '../common/TeamMembersModal.tsx';

interface ChatTopicModalProps {
  topic: ChatTopic | null;
  isOpen: boolean;
  onClose: () => void;
  currentUser: UserType;
  users: UserType[];
  onNavigateToFullChat?: () => void;
  onTopicUpdated?: (topic: ChatTopic) => void;
}

function formatChipName(fullName?: string): string {
  if (!fullName) return 'User';
  const parts = fullName.trim().split(/\s+/);
  if (parts.length <= 1) return parts[0];
  return `${parts[0]} ${parts[1][0]}.`;
}

function formatIndonesianDateFull(dateStr?: string): string {
  if (!dateStr) return '';
  try {
    let d: Date;
    const parts = dateStr.includes(' ') ? dateStr.split(' ')[0].split('-') : dateStr.split('-');
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

export function ChatTopicModal({
  topic,
  isOpen,
  onClose,
  currentUser,
  users,
  onNavigateToFullChat,
  onTopicUpdated,
}: ChatTopicModalProps) {
  const [activeTopic, setActiveTopic] = useState<ChatTopic | null>(topic);
  const [isTopicFullScreen, setIsTopicFullScreen] = useState(false);
  const [isAttachmentsExpanded, setIsAttachmentsExpanded] = useState(false);

  // Comments & input state
  const [commentText, setCommentText] = useState('');
  const [commentAttachments, setCommentAttachments] = useState<TaskAttachment[]>([]);
  const [commentUploadError, setCommentUploadError] = useState<string | null>(null);
  const [showMentionDropdown, setShowMentionDropdown] = useState(false);
  const [mentionQuery, setMentionQuery] = useState('');
  const [mentionCursorIndex, setMentionCursorIndex] = useState<number | null>(null);
  const [showCommentAddLink, setShowCommentAddLink] = useState(false);
  const [commentLinkTitle, setCommentLinkTitle] = useState('');
  const [commentLinkUrl, setCommentLinkUrl] = useState('');
  const [isUploadingCommentFile, setIsUploadingCommentFile] = useState(false);

  // Direct Attachment Links state for topic header
  const [showDirectTopicLink, setShowDirectTopicLink] = useState(false);
  const [directTopicLinkTitle, setDirectTopicLinkTitle] = useState('');
  const [directTopicLinkUrl, setDirectTopicLinkUrl] = useState('');

  // Sub-modals state
  const [previewModalData, setPreviewModalData] = useState<MediaPreviewData | null>(null);
  const [taggedMembersModalData, setTaggedMembersModalData] = useState<{
    isOpen: boolean;
    title: string;
    subtitle?: string;
    members: TeamMemberItem[];
  }>({
    isOpen: false,
    title: '',
    members: [],
  });
  const [showTagTeammatesModal, setShowTagTeammatesModal] = useState(false);
  const [tagSearchQuery, setTagSearchQuery] = useState('');

  const commentsEndRef = useRef<HTMLDivElement>(null);
  const commentInputRef = useRef<HTMLTextAreaElement>(null);
  const currentTopicIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!topic) {
      currentTopicIdRef.current = null;
      return;
    }

    // Hanya reset teks ketikan jika BERGANTI TOPIK (id berbeda)
    // Jangan hapus commentText saat background sync 2 detik berjalan!
    if (currentTopicIdRef.current !== topic.id) {
      currentTopicIdRef.current = topic.id;
      setActiveTopic(topic);
      setIsAttachmentsExpanded(false);
      setShowCommentAddLink(false);
      setShowDirectTopicLink(false);
      setCommentAttachments([]);
      setCommentText('');
    } else {
      // Pertahankan apa yang sedang diketik user, hanya perbarui metadata/komentar baru
      setActiveTopic((prev) => {
        if (!prev) return topic;
        return {
          ...prev,
          ...topic,
          comments: topic.comments || prev.comments,
        };
      });
    }
  }, [topic]);

  useEffect(() => {
    if (isOpen && activeTopic) {
      setTimeout(() => {
        commentsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    }
  }, [isOpen, activeTopic?.comments?.length]);

  if (!isOpen || !activeTopic) return null;

  // Handle status update
  const handleUpdateTopicStatus = (status: ChatTopicStatus) => {
    const updated: ChatTopic = { ...activeTopic, status };
    AppStorage.updateChatTopic(updated);
    setActiveTopic(updated);
    if (onTopicUpdated) onTopicUpdated(updated);
  };

  // Upload file additional to topic
  const handleUploadToActiveTopic = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const uploadedFiles: TaskAttachment[] = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      try {
        const uploadRes = await uploadHybridFile(file, { folder: 'absenku/chat' });
        uploadedFiles.push({
          id: `att-${Date.now()}-${i}`,
          name: uploadRes.name,
          url: uploadRes.url,
          type: 'FILE',
          fileType: uploadRes.type,
          fileSize: `${Math.round(uploadRes.size / 1024)} KB`,
          uploadedBy: currentUser.id,
          uploadedByName: currentUser.name,
          uploadedAt: new Date().toISOString(),
        });
      } catch (uploadErr: any) {
        setCommentUploadError(uploadErr.message || 'Gagal mengunggah berkas.');
        setTimeout(() => setCommentUploadError(null), 4000);
      }
    }

    const updatedTopic: ChatTopic = {
      ...activeTopic,
      files: [...(activeTopic.files || []), ...uploadedFiles],
    };
    AppStorage.updateChatTopic(updatedTopic);
    setActiveTopic(updatedTopic);
    if (onTopicUpdated) onTopicUpdated(updatedTopic);
    e.target.value = '';
  };

  const handleAddDirectTopicLink = () => {
    if (!directTopicLinkUrl.trim()) return;
    let url = directTopicLinkUrl.trim();
    if (!/^https?:\/\//i.test(url)) {
      url = `https://${url}`;
    }
    const newLink = {
      title: directTopicLinkTitle.trim() || url,
      url,
    };
    const updatedTopic: ChatTopic = {
      ...activeTopic,
      links: [...(activeTopic.links || []), newLink],
    };
    AppStorage.updateChatTopic(updatedTopic);
    setActiveTopic(updatedTopic);
    if (onTopicUpdated) onTopicUpdated(updatedTopic);
    setDirectTopicLinkTitle('');
    setDirectTopicLinkUrl('');
    setShowDirectTopicLink(false);
  };

  // Upload file to comment
  const handleCommentFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsUploadingCommentFile(true);
    try {
      const uploaded: TaskAttachment[] = [];
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        try {
          const uploadRes = await uploadHybridFile(file, { folder: 'absenku/chat' });
          uploaded.push({
            id: `att-comm-${Date.now()}-${i}`,
            name: uploadRes.name,
            url: uploadRes.url,
            type: 'FILE',
            fileType: uploadRes.type,
            fileSize: `${Math.round(uploadRes.size / 1024)} KB`,
            uploadedBy: currentUser.id,
            uploadedByName: currentUser.name,
          });
        } catch (uploadErr: any) {
          setCommentUploadError(uploadErr.message || 'Gagal mengunggah berkas.');
          setTimeout(() => setCommentUploadError(null), 4000);
        }
      }
      setCommentAttachments((prev) => [...prev, ...uploaded]);
    } finally {
      setIsUploadingCommentFile(false);
      e.target.value = '';
    }
  };

  const handleAddCommentLink = () => {
    if (!commentLinkUrl.trim()) return;
    const newAtt: TaskAttachment = {
      id: `att-link-${Date.now()}`,
      name: commentLinkTitle.trim() || commentLinkUrl.trim(),
      url: commentLinkUrl.trim().startsWith('http') ? commentLinkUrl.trim() : `https://${commentLinkUrl.trim()}`,
      type: 'LINK',
      uploadedBy: currentUser.id,
      uploadedByName: currentUser.name,
    };
    setCommentAttachments((prev) => [...prev, newAtt]);
    setCommentLinkTitle('');
    setCommentLinkUrl('');
    setShowCommentAddLink(false);
  };

  // Send comment
  const handleSendComment = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!activeTopic) return;
    if (!commentText.trim() && commentAttachments.length === 0) return;

    const textToSend = commentText.trim();
    const attachmentsToSend = [...commentAttachments];

    // Detect @mentions
    const textLower = textToSend.toLowerCase();
    const mentionedUsers = (users || []).filter((u) => {
      const fullNameLower = (u.name || '').toLowerCase();
      const firstNameLower = (u.name || '').split(' ')[0].toLowerCase();
      return (
        Boolean(fullNameLower && textLower.includes(`@${fullNameLower}`)) ||
        Boolean(firstNameLower && textLower.includes(`@${firstNameLower}`)) ||
        Boolean(u.id && textLower.includes(`@${u.id.toLowerCase()}`))
      );
    });

    const genericMatches = textToSend.match(/@([a-zA-Z0-9_\u00C0-\u017F]+)/g) || [];
    const genericMentions = genericMatches.map((m) => m.substring(1));
    const allMentionLabels = Array.from(
      new Set([...mentionedUsers.map((u) => u.name), ...genericMentions])
    );

    const existingTagged = safeParseJsonArray(
      activeTopic.taggedTeammateIds ?? (activeTopic as any).id_anggota_ditandai ?? (activeTopic as any).tagged_teammate_ids
    );

    const newlyTaggedIds = mentionedUsers
      .map((u) => u.id)
      .filter((id) => id && !existingTagged.includes(id));

    let updatedTopic: ChatTopic = activeTopic;
    if (newlyTaggedIds.length > 0) {
      updatedTopic = {
        ...activeTopic,
        taggedTeammateIds: [...existingTagged, ...newlyTaggedIds],
      };
      AppStorage.updateChatTopic(updatedTopic);
    }

    try {
      const newComment = AppStorage.addTopicComment(activeTopic.id, {
        userId: currentUser?.id || 'usr_super_admin',
        userName: currentUser?.name || 'Pengguna',
        userAvatar: currentUser?.avatar || '',
        userRole: currentUser?.role || 'EMPLOYEE',
        notes: textToSend,
        attachments: attachmentsToSend,
        mentions: allMentionLabels,
        type: 'COMMENT',
      });

      const refreshedTopic: ChatTopic = {
        ...updatedTopic,
        comments: [...(updatedTopic.comments || []), newComment],
      };

      setActiveTopic(refreshedTopic);
      setCommentText('');
      setCommentAttachments([]);
      setShowMentionDropdown(false);
      if (onTopicUpdated) onTopicUpdated(refreshedTopic);

      window.dispatchEvent(new CustomEvent('absenku:chat_updated'));

      setTimeout(() => {
        commentsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    } catch (err) {
      console.error('Gagal mengirim komentar:', err);
    }
  };

  const handleDeleteComment = (commentId: string) => {
    if (!activeTopic) return;
    const targetComm = activeTopic.comments?.find((c) => c.id === commentId);
    if (targetComm && targetComm.userId !== currentUser.id) return;
    AppStorage.deleteTopicComment(activeTopic.id, commentId);
    const updated = AppStorage.getChatTopics().find((t) => t.id === activeTopic.id);
    if (updated) {
      setActiveTopic(updated);
      if (onTopicUpdated) onTopicUpdated(updated);
    }
  };

  // Open Tagged Members Modal (Hapus dummy "Rekan Tim" agar hanya user asli yang ditampilkan)
  const handleOpenTaggedMembersModal = (topicItem: ChatTopic, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const rawTagged = safeParseJsonArray(
      topicItem.taggedTeammateIds ?? (topicItem as any).id_anggota_ditandai ?? (topicItem as any).tagged_teammate_ids
    );
    const members: TeamMemberItem[] = [];
    const seen = new Set<string>();

    rawTagged.forEach((uid) => {
      if (!uid) return;
      const cleanUid = String(uid).trim().toLowerCase();
      const u = (users || []).find((user) => 
        (user.id && user.id.toLowerCase() === cleanUid) ||
        (user.name && user.name.toLowerCase().trim() === cleanUid) ||
        (user.email && user.email.toLowerCase().trim() === cleanUid)
      );
      // Hapus data dummy: Jangan tampilkan jika user tidak ada di sistem atau bernama "Rekan Tim"
      if (!u || !u.name || u.name.toLowerCase().includes('rekan tim')) return;

      const dedupeKey = u.email ? u.email.toLowerCase().trim() : u.id;
      if (seen.has(dedupeKey)) return;
      seen.add(dedupeKey);

      members.push({
        id: u.id,
        name: u.name,
        avatar: u.avatar,
        role: u.role === 'ADMIN' ? 'Administrator' : u.role === 'SUPER_ADMIN' ? 'Super Admin' : 'Karyawan',
        department: u.department || (u.role === 'ADMIN' ? 'Administrator' : 'Karyawan'),
        statusBadge: 'Ditag',
        statusColor: 'blue',
      });
    });

    setTaggedMembersModalData({
      isOpen: true,
      title: 'Rekan Tim yang Ditag',
      subtitle: `Topik: "${topicItem.title}"`,
      members,
    });
  };

  // Filter rekan tim untuk penambahan tag ke topik obrolan
  const tagFilteredUsers = (users || []).filter((u) => {
    if (!u || !u.name || u.name.toLowerCase().includes('rekan tim') || u.name === 'User') return false;
    if (!tagSearchQuery.trim()) return true;
    const q = tagSearchQuery.toLowerCase().trim();
    return (
      u.name.toLowerCase().includes(q) ||
      (u.department && u.department.toLowerCase().includes(q)) ||
      (u.email && u.email.toLowerCase().includes(q))
    );
  });

  // Tambah / Cabut tag rekan tim pada topik yang sudah dibuat
  const handleToggleTagUser = (userId: string) => {
    if (!activeTopic) return;
    const rawTagged = safeParseJsonArray(
      activeTopic.taggedTeammateIds ?? (activeTopic as any).id_anggota_ditandai ?? (activeTopic as any).tagged_teammate_ids
    );
    const targetUser = (users || []).find((u) => u.id === userId);
    const isCurrentlyTagged = rawTagged.some(
      (id) =>
        String(id).toLowerCase() === userId.toLowerCase() ||
        (targetUser?.email && String(id).toLowerCase() === targetUser.email.toLowerCase()) ||
        (targetUser?.name && String(id).toLowerCase() === targetUser.name.toLowerCase().trim())
    );

    let nextTagged: string[];
    if (isCurrentlyTagged) {
      nextTagged = rawTagged.filter(
        (id) =>
          String(id).toLowerCase() !== userId.toLowerCase() &&
          (!targetUser?.email || String(id).toLowerCase() !== targetUser.email.toLowerCase()) &&
          (!targetUser?.name || String(id).toLowerCase() !== targetUser.name.toLowerCase().trim())
      );
    } else {
      nextTagged = [...rawTagged, userId];
    }

    const updatedTopic: ChatTopic = {
      ...activeTopic,
      taggedTeammateIds: nextTagged,
      updatedAt: new Date().toISOString(),
    };

    setActiveTopic(updatedTopic);
    AppStorage.updateChatTopic(updatedTopic);
    ApiClient.updateChatTopic(updatedTopic.id, {
      taggedTeammateIds: nextTagged,
      id_anggota_ditandai: nextTagged,
    }).catch(console.error);
    window.dispatchEvent(new CustomEvent('absenku:chat_updated'));
    if (onTopicUpdated) onTopicUpdated(updatedTopic);
  };

  // Render User Avatars Stack (Hapus dummy agar tidak render avatar kosong)
  const renderTeammateAvatars = (taggedIds: string[]) => {
    const rawTagged = safeParseJsonArray(taggedIds);
    const cleanLower = rawTagged.map((id) => String(id).toLowerCase().trim());
    const taggedUsers = (users || []).filter((u) => 
      u.name && !u.name.toLowerCase().includes('rekan tim') && (
        (u.id && cleanLower.includes(u.id.toLowerCase())) ||
        (u.name && cleanLower.includes(u.name.toLowerCase().trim())) ||
        (u.email && cleanLower.includes(u.email.toLowerCase().trim()))
      )
    );
    if (taggedUsers.length === 0) {
      return <span className="text-xs text-slate-400 font-medium">-</span>;
    }

    return (
      <div className="flex items-center -space-x-1.5 overflow-hidden">
        {taggedUsers.slice(0, 4).map((u) => (
          <div
            key={u.id}
            className="relative w-6 h-6 rounded-full border-2 border-white bg-slate-200 overflow-hidden shrink-0"
            title={u.name}
          >
            {u.avatar ? (
              <img src={u.avatar} alt={u.name} className="w-full h-full object-cover" />
            ) : (
              <span className="w-full h-full flex items-center justify-center font-bold text-[10px] text-slate-700 bg-purple-100">
                {u.name.charAt(0)}
              </span>
            )}
          </div>
        ))}
        {taggedUsers.length > 4 && (
          <div className="w-6 h-6 rounded-full border-2 border-white bg-[#1E3A8A] text-white flex items-center justify-center text-[9px] font-bold shrink-0">
            +{taggedUsers.length - 4}
          </div>
        )}
      </div>
    );
  };

  // Mention filtered users
  const mentionFilteredUsers = users.filter((u) => {
    if (u.id === currentUser.id) return false;
    if (!mentionQuery) return true;
    return (
      u.name.toLowerCase().includes(mentionQuery.toLowerCase()) ||
      u.department?.toLowerCase().includes(mentionQuery.toLowerCase())
    );
  });

  const handleSelectMention = (user: UserType) => {
    const firstName = user.name.split(' ')[0];
    const mentionTag = `@${firstName} `;
    if (mentionCursorIndex !== null) {
      const before = commentText.slice(0, mentionCursorIndex);
      const after = commentText.slice(mentionCursorIndex);
      setCommentText(before + mentionTag + after);
    } else {
      setCommentText((prev) => (prev ? `${prev} ${mentionTag}` : mentionTag));
    }
    setShowMentionDropdown(false);
    commentInputRef.current?.focus();
  };

  const allTopicAttachments = [
    ...(activeTopic.files || []).map((f) => ({ kind: 'file' as const, file: f })),
    ...(activeTopic.links || []).map((l, idx) => ({ kind: 'link' as const, link: l, id: `link-${idx}` })),
  ];

  // Render Image 1 Style Properties Table for Topic
  const renderTopicPropertiesTable = () => (
    <div className="space-y-3 py-1 text-xs sm:text-sm">
      {/* 1. Created time */}
      <div className="flex items-center gap-4">
        <div className="w-32 sm:w-36 flex items-center gap-2 text-slate-400 shrink-0 font-medium">
          <Clock className="w-4 h-4 text-slate-400" />
          <span>Created time</span>
        </div>
        <div className="text-slate-800 font-medium">
          {formatDateTimeFull(activeTopic.createdAt)}
        </div>
      </div>

      {/* 2. Status */}
      <div className="flex items-center gap-4">
        <div className="w-32 sm:w-36 flex items-center gap-2 text-slate-400 shrink-0 font-medium">
          <Sparkles className="w-4 h-4 text-slate-400" />
          <span>Status</span>
        </div>
        <div className="relative inline-flex items-center">
          <select
            value={activeTopic.status}
            onChange={(e) =>
              handleUpdateTopicStatus(e.target.value as ChatTopicStatus)
            }
            className={`appearance-none pl-6 pr-7 py-1 rounded-full text-xs font-semibold outline-none cursor-pointer transition-all shadow-2xs ${
              activeTopic.status === 'CLOSED'
                ? 'bg-amber-50 text-amber-800 border border-amber-200/80 hover:bg-amber-100/80'
                : activeTopic.status === 'NEED_COMMENTS'
                ? 'bg-purple-50 text-purple-800 border border-purple-200/80 hover:bg-purple-100/80'
                : 'bg-sky-50 text-sky-800 border border-sky-200/80 hover:bg-sky-100/80'
            }`}
          >
            <option value="NEED_COMMENTS">Perlu Tanggapan</option>
            <option value="IN_PROGRESS">Sedang Berjalan</option>
            <option value="CLOSED">Selesai</option>
          </select>
          <span
            className={`w-2 h-2 rounded-full absolute left-2.5 pointer-events-none ${
              activeTopic.status === 'CLOSED'
                ? 'bg-amber-500'
                : activeTopic.status === 'NEED_COMMENTS'
                ? 'bg-purple-500'
                : 'bg-sky-500'
            }`}
          />
          <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2 pointer-events-none" />
        </div>
      </div>

      {/* 3. Members / Tim (Assignees) */}
      <div className="flex items-center gap-4">
        <div className="w-32 sm:w-36 flex items-center gap-2 text-slate-400 shrink-0 font-medium">
          <Users className="w-4 h-4 text-slate-400" />
          <span>Assignees</span>
        </div>
        <div className="flex items-center gap-2.5 flex-wrap">
          <div
            onClick={() => setShowTagTeammatesModal(true)}
            className="flex items-center gap-2 cursor-pointer hover:opacity-80 transition-opacity"
            title="Klik untuk kelola anggota tim yang ditag"
          >
            <div className="flex -space-x-1.5 overflow-hidden items-center py-0.5">
              {renderTeammateAvatars(activeTopic.taggedTeammateIds)}
            </div>
          </div>
          <button
            type="button"
            onClick={() => setShowTagTeammatesModal(true)}
            className="inline-flex items-center justify-center w-7 h-7 rounded-full text-xs font-semibold bg-blue-50 text-[#1E3A8A] hover:bg-blue-100 border border-blue-200 transition-all cursor-pointer shadow-2xs active:scale-95 shrink-0"
            title="Tambah atau kelola rekan yang ditag ke ruang obrolan ini"
            aria-label="Tag Rekan"
          >
            <UserPlus className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );

  // Render Topic Attachments Section
  const renderTopicAttachmentsSection = () => (
    <div className="space-y-3 pt-1">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h3 className="text-xs sm:text-sm font-bold text-slate-900 flex items-center gap-2">
          <Paperclip className="w-4 h-4 text-slate-500" />
          <span>Attachments ({allTopicAttachments.length})</span>
        </h3>
      </div>

      {/* List of attachments */}
      {allTopicAttachments.length === 0 ? (
        <div className="p-4 rounded-xl border-2 border-dashed border-slate-200 text-center text-xs text-slate-400">
          Belum ada berkas atau tautan yang dilampirkan pada topik ini.
        </div>
      ) : (
        <div className="space-y-2">
          {allTopicAttachments.map((item) =>
            item.kind === 'file' ? (
              <div
                key={item.file.id}
                className="flex items-center justify-between p-3 bg-white hover:bg-slate-50 border border-slate-200/90 rounded-2xl transition-all shadow-2xs group"
              >
                <div
                  className="flex items-center gap-3 min-w-0 flex-1 cursor-pointer"
                  onClick={() => openAttachmentDirectly({
                    url: item.file.url,
                    name: item.file.name,
                    type: 'FILE',
                    fileType: item.file.fileType,
                  })}
                >
                  <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center shrink-0 text-blue-600">
                    {item.file.name.endsWith('.pdf') ? (
                      <FileText className="w-5 h-5 text-rose-600" />
                    ) : item.file.name.endsWith('.zip') || item.file.name.endsWith('.rar') ? (
                      <FolderArchive className="w-5 h-5 text-amber-600" />
                    ) : (
                      <FileText className="w-5 h-5 text-blue-600" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs sm:text-sm font-semibold text-slate-900 truncate group-hover:text-blue-600 transition-colors">
                      {item.file.name}
                    </p>
                    <p className="text-[11px] text-slate-400 truncate">
                      {item.file.fileSize ? `Ukuran: ${item.file.fileSize}` : 'Berkas Lampiran'} • Oleh {formatChipName(item.file.uploadedByName || activeTopic.createdByName)}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => openAttachmentDirectly({
                    url: item.file.url,
                    name: item.file.name,
                    type: 'FILE',
                    fileType: item.file.fileType,
                  })}
                  className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-blue-600 hover:text-white text-slate-700 text-xs font-semibold transition-all flex items-center gap-1 cursor-pointer shrink-0 ml-2"
                  title={`Buka ${item.file.name} di tab baru`}
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Buka</span>
                </button>
              </div>
            ) : (
              <div
                key={item.id}
                className="flex items-center justify-between p-3 bg-white hover:bg-slate-50 border border-slate-200/90 rounded-2xl transition-all shadow-2xs group"
              >
                <div
                  className="flex items-center gap-3 min-w-0 flex-1 cursor-pointer"
                  onClick={() => openExternalLink(item.link.url)}
                >
                  <div className="w-10 h-10 rounded-xl bg-sky-50 border border-sky-100 flex items-center justify-center shrink-0 text-sky-600">
                    <Globe className="w-5 h-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs sm:text-sm font-semibold text-slate-900 truncate group-hover:text-sky-600 transition-colors">
                      {item.link.title}
                    </p>
                    <p className="text-[11px] text-slate-400 truncate">
                      Tautan Eksternal • {item.link.url}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => openExternalLink(item.link.url)}
                  className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-sky-600 hover:text-white text-slate-700 text-xs font-semibold transition-all flex items-center gap-1 cursor-pointer shrink-0 ml-2"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Buka</span>
                </button>
              </div>
            )
          )}
        </div>
      )}
    </div>
  );

  // Render Comments Stream
  const renderTopicCommentsStream = () => (
    <div className="space-y-4">
      <DateDivider>Hari Ini</DateDivider>

      {(!activeTopic.comments || activeTopic.comments.length === 0) ? (
        <div className="py-8 text-center text-slate-400 text-xs font-medium">
          Belum ada obrolan. Tulis pesan di bawah untuk memulai tanggapan.
        </div>
      ) : (
        <BubbleGroup>
          {activeTopic.comments.map((comm) => {
            const isMe = comm.userId === currentUser.id;
            return isMe ? (
              /* Pesan dari Diri Sendiri (Kanan) */
              <div
                key={comm.id}
                className="flex items-end justify-end gap-2 max-w-[85%] sm:max-w-[78%] ml-auto animate-in fade-in duration-150"
              >
                <div className="flex flex-col items-end">
                  <div className="bg-[#007AFF] text-white px-4 py-2.5 rounded-2xl rounded-br-xs text-xs sm:text-sm leading-relaxed shadow-2xs">
                    <div className="whitespace-pre-wrap">
                      {comm.notes.split(' ').map((word, idx) => {
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

                    {comm.attachments && comm.attachments.length > 0 && (
                      <div className="pt-2 flex flex-wrap gap-2">
                        {comm.attachments.map((att) => (
                          <button
                            key={att.id}
                            type="button"
                            onClick={() => openAttachmentDirectly(att)}
                            className="flex items-center gap-1.5 px-2.5 py-1.5 bg-white/25 hover:bg-white/35 active:scale-95 border border-white/30 rounded-xl text-[11px] font-semibold text-white transition-all cursor-pointer shadow-2xs"
                            title={`Buka ${att.name} di tab baru`}
                          >
                            {att.type === 'LINK' ? <Globe className="w-3.5 h-3.5" /> : <Paperclip className="w-3.5 h-3.5" />}
                            <span className="truncate max-w-[130px]">{att.name}</span>
                            <ExternalLink className="w-3 h-3 opacity-70 ml-0.5" />
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5 mr-2 mt-1">
                    <span className="text-[10px] text-gray-400">
                      {comm.timestamp} · Terkirim
                    </span>
                    {(comm.userId === currentUser.id || currentUser.role === 'ADMIN' || currentUser.role === 'SUPER_ADMIN') && (
                      <button
                        type="button"
                        onClick={() => handleDeleteComment(comm.id)}
                        className="text-rose-600 hover:text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200/80 p-0.5 rounded transition-all cursor-pointer"
                        title="Hapus pesan"
                      >
                        <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                      </button>
                    )}
                  </div>
                </div>

                <div className="w-7 h-7 rounded-full overflow-hidden bg-blue-100 border border-blue-200 shrink-0 mb-1">
                  {currentUser.avatar ? (
                    <img
                      src={currentUser.avatar}
                      alt={currentUser.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center font-bold text-xs text-white bg-[#007AFF]">
                      {currentUser.name.charAt(0)}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              /* Pesan dari Rekan / Orang Lain (Kiri) */
              <div
                key={comm.id}
                className="flex items-end gap-2 max-w-[85%] sm:max-w-[78%] animate-in fade-in duration-150"
              >
                <div className="w-7 h-7 rounded-full overflow-hidden bg-slate-200 border border-slate-300 shrink-0 mb-1">
                  {comm.userAvatar ? (
                    <img
                      src={comm.userAvatar}
                      alt={comm.userName}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center font-bold text-xs text-slate-700 bg-blue-100">
                      {comm.userName.charAt(0)}
                    </div>
                  )}
                </div>

                <div className="flex flex-col items-start min-w-0">
                  <span className="text-[11px] font-semibold text-gray-500 ml-3 mb-1">
                    {comm.userName}
                  </span>

                  <div className="bg-[#E9E9EB] text-gray-900 px-4 py-2.5 rounded-2xl rounded-bl-xs text-xs sm:text-sm leading-relaxed shadow-2xs">
                    <div className="whitespace-pre-wrap">
                      {comm.notes.split(' ').map((word, idx) => {
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

                    {comm.attachments && comm.attachments.length > 0 && (
                      <div className="pt-2 flex flex-wrap gap-2">
                        {comm.attachments.map((att) => (
                          <button
                            key={att.id}
                            type="button"
                            onClick={() => openAttachmentDirectly(att)}
                            className="flex items-center gap-1.5 px-2.5 py-1.5 bg-white hover:bg-slate-50 active:scale-95 border border-slate-200 rounded-xl text-[11px] font-semibold text-[#1E3A8A] transition-all cursor-pointer shadow-2xs"
                            title={`Buka ${att.name} di tab baru`}
                          >
                            {att.type === 'LINK' ? <Globe className="w-3.5 h-3.5 text-[#1E3A8A]" /> : <Paperclip className="w-3.5 h-3.5 text-[#1E3A8A]" />}
                            <span className="truncate max-w-[130px]">{att.name}</span>
                            <ExternalLink className="w-3 h-3 text-slate-400 ml-0.5" />
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5 ml-3 mt-1">
                    <span className="text-[10px] text-gray-400">
                      {comm.timestamp}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </BubbleGroup>
      )}
      <div ref={commentsEndRef} />
    </div>
  );

  // Render Comment Input Box
  const renderTopicCommentInput = () => (
    <div className="p-3 border-t border-slate-200/80 bg-white shrink-0">
      <div className="space-y-2">
        {showCommentAddLink && (
          <div className="p-2.5 bg-blue-50/80 rounded-2xl border border-blue-200 space-y-2 animate-in fade-in duration-150 text-xs">
            <div className="flex items-center justify-between">
              <span className="font-bold text-[#1E3A8A] text-[11px]">Sematkan Tautan Link</span>
              <button
                type="button"
                onClick={() => setShowCommentAddLink(false)}
                className="text-slate-400 hover:text-slate-600 p-0.5 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
            <input
              type="text"
              value={commentLinkTitle}
              onChange={(e) => setCommentLinkTitle(e.target.value)}
              placeholder="Judul Tautan (misal: Dokumen Google Drive / Figma)..."
              className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-hidden focus:ring-1 focus:ring-[#1E3A8A]"
            />
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={commentLinkUrl}
                onChange={(e) => setCommentLinkUrl(e.target.value)}
                placeholder="URL (misal: https://...)"
                className="flex-1 px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-hidden focus:ring-1 focus:ring-[#1E3A8A]"
              />
              <button
                type="button"
                onClick={handleAddCommentLink}
                disabled={!commentLinkUrl.trim()}
                className="px-3.5 py-1.5 bg-[#1E3A8A] hover:bg-[#172554] disabled:opacity-40 text-white font-bold rounded-xl text-xs cursor-pointer"
              >
                Tambah
              </button>
            </div>
          </div>
        )}

        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSendComment(e);
          }}
          className="flex items-end gap-1.5 sm:gap-2"
        >
          <label
            className="p-2 text-gray-500 hover:text-[#1E3A8A] rounded-full hover:bg-slate-100 transition cursor-pointer shrink-0 mb-0.5"
            title="Unggah Foto atau Berkas"
          >
            <Paperclip className="w-4 h-4" />
            <input
              type="file"
              multiple
              onChange={handleCommentFileUpload}
              className="hidden"
            />
          </label>

          <button
            type="button"
            onClick={() => setShowCommentAddLink(!showCommentAddLink)}
            title="Sematkan Tautan Link"
            className={`p-2 rounded-full transition cursor-pointer shrink-0 mb-0.5 ${
              showCommentAddLink ? 'text-[#1E3A8A] bg-blue-100' : 'text-gray-500 hover:text-[#1E3A8A] hover:bg-slate-100'
            }`}
          >
            <Globe className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={() => {
              setShowMentionDropdown((prev) => !prev);
              setMentionQuery('');
              setMentionCursorIndex(commentText.length);
              setTimeout(() => commentInputRef.current?.focus(), 50);
            }}
            title="Mention Rekan Tim (@)"
            className={`w-8 h-8 rounded-full transition cursor-pointer shrink-0 flex items-center justify-center text-xs font-bold mb-0.5 ${
              showMentionDropdown
                ? 'text-white bg-[#1E3A8A] shadow-xs'
                : 'text-gray-500 hover:text-[#1E3A8A] hover:bg-slate-100'
            }`}
          >
            @
          </button>

          <div className="relative flex-1 min-w-0">
            <textarea
              ref={commentInputRef}
              rows={1}
              value={commentText}
              onChange={(e) => {
                const val = e.target.value;
                setCommentText(val);
                e.target.style.height = 'auto';
                e.target.style.height = `${Math.min(e.target.scrollHeight, 120)}px`;

                const cursor = e.target.selectionStart || val.length;
                const textBeforeCursor = val.slice(0, cursor);
                const lastAt = textBeforeCursor.lastIndexOf('@');

                if (lastAt !== -1 && !textBeforeCursor.slice(lastAt).includes(' ')) {
                  setShowMentionDropdown(true);
                  setMentionQuery(textBeforeCursor.slice(lastAt + 1));
                  setMentionCursorIndex(lastAt);
                } else if (!val.includes('@')) {
                  setShowMentionDropdown(false);
                }
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSendComment();
                }
              }}
              placeholder="Tulis pesan..."
              className="w-full bg-[#F2F2F7] focus:bg-white text-gray-900 border border-transparent focus:border-slate-300 rounded-2xl px-4 py-2 text-xs sm:text-sm outline-none transition-all resize-none max-h-28 overflow-y-auto leading-relaxed"
            />

            {showMentionDropdown && (
              <div className="absolute bottom-full left-0 mb-2 w-64 bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden z-30 animate-in fade-in zoom-in-95 duration-150">
                <div className="p-2 border-b border-slate-100 text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center justify-between">
                  <span>Pilih Rekan Tim</span>
                  <button
                    type="button"
                    onClick={() => setShowMentionDropdown(false)}
                    className="text-slate-400 hover:text-slate-600"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
                <div className="max-h-48 overflow-y-auto custom-scrollbar p-1">
                  {mentionFilteredUsers.length === 0 ? (
                    <div className="p-2 text-xs text-slate-400 text-center">
                      Rekan tidak ditemukan
                    </div>
                  ) : (
                    mentionFilteredUsers.map((u) => (
                      <button
                        key={u.id}
                        type="button"
                        onClick={() => handleSelectMention(u)}
                        className="w-full text-left p-2 hover:bg-blue-50 rounded-xl flex items-center gap-2.5 transition-colors cursor-pointer"
                      >
                        <img
                          src={u.avatar}
                          alt={u.name}
                          className="w-6 h-6 rounded-full object-cover border border-slate-200 shrink-0"
                        />
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-bold text-slate-800 truncate">{u.name}</p>
                          <p className="text-[10px] text-slate-400 truncate">{u.department || 'Staf'}</p>
                        </div>
                      </button>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              handleSendComment(e);
            }}
            disabled={!commentText.trim() && commentAttachments.length === 0}
            className="w-8 h-8 rounded-full bg-[#007AFF] hover:bg-blue-600 active:scale-95 disabled:opacity-40 text-white flex items-center justify-center transition-all cursor-pointer shadow-xs shrink-0 mb-1"
            title="Kirim Pesan"
          >
            <ArrowUp className="w-4 h-4 stroke-[2.5]" />
          </button>
        </form>

        {commentUploadError && (
          <div className="flex items-center gap-2 mt-2 px-3 py-2 text-xs text-rose-700 bg-rose-50 border border-rose-200/90 rounded-xl animate-in fade-in duration-200 shadow-2xs">
            <AlertCircle className="w-3.5 h-3.5 shrink-0 text-rose-500" />
            <span className="font-medium">{commentUploadError}</span>
          </div>
        )}

        {commentAttachments.length > 0 && (
          <div className="flex flex-wrap gap-2 pt-1">
            {commentAttachments.map((att, idx) => (
              <div
                key={idx}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-slate-100 border border-slate-200 rounded-xl text-xs text-slate-700"
              >
                <Paperclip className="w-3.5 h-3.5 text-slate-500" />
                <span className="truncate max-w-[140px]">{att.name}</span>
                <button
                  type="button"
                  onClick={() =>
                    setCommentAttachments((prev) => prev.filter((_, i) => i !== idx))
                  }
                  className="text-slate-400 hover:text-rose-600 cursor-pointer ml-1"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );

  return (
    <>
      <div
        className={`fixed inset-0 z-50 flex animate-in fade-in duration-200 ${
          isTopicFullScreen
            ? 'items-center justify-center p-0'
            : 'justify-end items-center p-2.5 sm:p-4 md:p-5'
        }`}
      >
        {/* Backdrop Blur */}
        <div
          className="fixed inset-0 bg-slate-950/40 backdrop-blur-xs transition-opacity cursor-pointer"
          onClick={onClose}
        />

        {/* Dialog Card */}
        <div
          className={`relative z-10 bg-white shadow-2xl flex flex-col min-h-0 overflow-hidden transition-all duration-300 font-sans ${
            isTopicFullScreen
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
                onClick={() => setIsTopicFullScreen(!isTopicFullScreen)}
                className="p-1.5 sm:p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl border border-slate-200/80 transition-colors cursor-pointer"
                title={isTopicFullScreen ? 'Perkecil Tampilan' : 'Perbesar Layar Penuh'}
              >
                {isTopicFullScreen ? (
                  <Minimize2 className="w-4 h-4 text-slate-600" />
                ) : (
                  <Maximize2 className="w-4 h-4 text-slate-600" />
                )}
              </button>
              {isTopicFullScreen && (
                <span className="text-xs font-semibold text-slate-500 truncate max-w-md hidden sm:inline">
                  {activeTopic.title}
                </span>
              )}
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={() => {
                  onClose();
                  setIsAttachmentsExpanded(false);
                }}
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
          {isTopicFullScreen ? (
            /* =================== FULLSCREEN SPLIT VIEW =================== */
            <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 min-h-0 overflow-hidden">
              {/* SEBELAH KIRI (lg:col-span-7): RINCIAN TOPIK & LAMPIRAN */}
              <div className="lg:col-span-7 xl:col-span-7 h-full overflow-y-auto p-6 sm:p-8 space-y-6 border-r border-slate-200/80 bg-white">
                <div className="space-y-2">
                  <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight leading-snug">
                    {activeTopic.title}
                  </h1>
                  <p className="text-xs text-slate-400">
                    Dibuat oleh <strong className="text-slate-700">{activeTopic.createdByName}</strong> • {formatDateTimeFull(activeTopic.createdAt)}
                  </p>
                </div>

                {/* Project Description (Kotak Rounded Soft - Gaya Gambar 1) */}
                <div className="bg-slate-50/80 rounded-2xl p-5 border border-slate-100 space-y-2">
                  <h3 className="text-xs sm:text-sm font-bold text-slate-900 uppercase tracking-wider">
                    Project Description
                  </h3>
                  <p className="text-xs sm:text-sm text-slate-600 leading-relaxed whitespace-pre-wrap">
                    {activeTopic.longNotes || activeTopic.shortNotes || 'Tidak ada deskripsi rinci untuk topik diskusi ini.'}
                  </p>
                </div>

                {/* Berkas & Tautan Lampiran (Attachments - Gaya Gambar 2) */}
                {renderTopicAttachmentsSection()}

                {/* Attributes Section (Gaya Gambar 2) */}
                <div className="space-y-4 pt-4 border-t border-slate-100">
                  <h3 className="text-sm font-bold text-slate-900">Attributes</h3>
                  <div className="bg-slate-50/70 rounded-2xl p-4 sm:p-5 border border-slate-100">
                    {renderTopicPropertiesTable()}
                  </div>
                </div>
              </div>

              {/* SEBELAH KANAN (lg:col-span-5): ROOM CHATING */}
              <div className="lg:col-span-5 xl:col-span-5 h-full flex flex-col bg-slate-50/40">
                <div className="px-5 py-3.5 border-b border-slate-200/80 bg-white flex items-center justify-between shrink-0">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                      <MessageSquare className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="text-xs sm:text-sm font-bold text-slate-900 leading-tight">
                        Ruang Obrolan & Riwayat Pesan
                      </h3>
                      <p className="text-[11px] text-slate-400">Diskusikan topik ini bersama tim secara langsung</p>
                    </div>
                  </div>
                  <span className="text-[11px] font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
                    {activeTopic.comments?.length || 0} Pesan
                  </span>
                </div>

                <div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-5 space-y-3.5">
                  {renderTopicCommentsStream()}
                </div>

                {renderTopicCommentInput()}
              </div>
            </div>
          ) : (
            /* =================== UNZOOMED NORMAL DRAWER VIEW =================== */
            <div className="flex-1 flex flex-col min-h-0">
              <div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-5 space-y-4 bg-slate-50/40">
                {/* 1. Header Card (Gaya Gambar 1: Judul Besar + Metadata Tabel + Deskripsi) */}
                <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-100 shadow-2xs space-y-4">
                  <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight leading-snug">
                    {activeTopic.title}
                  </h1>

                  {/* Metadata Tabel Vertikal (Persis Gambar 1) */}
                  {renderTopicPropertiesTable()}

                  {/* Kotak Deskripsi (Persis Gambar 1) */}
                  <div className="bg-slate-50/90 rounded-2xl p-4 border border-slate-100 space-y-1.5">
                    <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                      Project Description
                    </h3>
                    <p className="text-xs sm:text-sm text-slate-600 leading-relaxed whitespace-pre-wrap font-normal">
                      {activeTopic.longNotes || activeTopic.shortNotes || 'Tidak ada deskripsi rinci untuk topik diskusi ini.'}
                    </p>
                  </div>
                </div>

                {/* 2. Berkas & Tautan Lampiran (Attachments - Gaya Gambar 2) */}
                <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-100 shadow-2xs space-y-3">
                  {renderTopicAttachmentsSection()}
                </div>

                {/* 3. Ruang Obrolan & Komentar Tanggapan */}
                <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-100 shadow-2xs space-y-3">
                  <div className="flex items-center justify-between pb-1 border-b border-slate-100">
                    <h3 className="text-xs sm:text-sm font-bold text-slate-900 flex items-center gap-1.5">
                      <MessageSquare className="w-4 h-4 text-blue-600" />
                      <span>Ruang Obrolan & Riwayat Pesan</span>
                    </h3>
                    <span className="text-[11px] text-slate-400">{activeTopic.comments?.length || 0} Pesan</span>
                  </div>
                  {renderTopicCommentsStream()}
                </div>
              </div>

              {renderTopicCommentInput()}
            </div>
          )}
        </div>
      </div>

      {/* Modal Preview Media / Gambar / Dokumen */}
      <MediaPreviewModal
        media={previewModalData}
        onClose={() => setPreviewModalData(null)}
      />

      {/* Modal Daftar Rekan Tim yang Ditag */}
      <TeamMembersModal
        isOpen={taggedMembersModalData.isOpen}
        onClose={() => setTaggedMembersModalData((prev) => ({ ...prev, isOpen: false }))}
        title={taggedMembersModalData.title}
        subtitle={taggedMembersModalData.subtitle}
        members={taggedMembersModalData.members}
      />

      {/* Modal Kelola / Tambah Tag Rekan Tim (Req 1) */}
      {showTagTeammatesModal && activeTopic && (
        <div
          className="fixed inset-0 z-[140] flex items-center justify-center p-4 bg-slate-950/50 backdrop-blur-xs animate-in fade-in duration-200 font-sans"
          onClick={() => setShowTagTeammatesModal(false)}
        >
          <div
            className="relative bg-white rounded-3xl max-w-md w-full shadow-2xl border border-slate-200/90 overflow-hidden flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="px-6 py-4.5 border-b border-slate-100 flex items-center justify-between gap-3 bg-white">
              <div>
                <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
                  <Users className="w-4 h-4 text-[#1E3A8A]" />
                  <span>Kelola Rekan yang Ditag</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5 truncate max-w-[280px]">
                  Topik: &quot;{activeTopic.title}&quot;
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowTagTeammatesModal(false)}
                className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full border border-slate-200 transition-colors cursor-pointer"
                title="Tutup"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Search Input */}
            <div className="px-6 pt-3 pb-2 border-b border-slate-100 bg-slate-50/50">
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={tagSearchQuery}
                  onChange={(e) => setTagSearchQuery(e.target.value)}
                  placeholder="Cari nama atau departemen..."
                  className="w-full pl-9 pr-3.5 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 outline-none focus:border-[#1E3A8A] transition-colors shadow-2xs"
                />
              </div>
            </div>

            {/* User List */}
            <div className="p-4 sm:p-5 overflow-y-auto flex-1 space-y-2 custom-scrollbar">
              {tagFilteredUsers.length === 0 ? (
                <div className="py-8 text-center text-slate-400 text-xs">
                  Tidak ada rekan tim yang cocok.
                </div>
              ) : (
                tagFilteredUsers.map((u) => {
                  const rawTagged = safeParseJsonArray(
                    activeTopic.taggedTeammateIds ?? (activeTopic as any).id_anggota_ditandai ?? (activeTopic as any).tagged_teammate_ids
                  );
                  const isTagged = rawTagged.some(
                    (id) =>
                      String(id).toLowerCase() === u.id.toLowerCase() ||
                      (u.email && String(id).toLowerCase() === u.email.toLowerCase()) ||
                      (u.name && String(id).toLowerCase() === u.name.toLowerCase().trim())
                  );

                  return (
                    <div
                      key={u.id}
                      className="p-3 bg-white hover:bg-slate-50 rounded-2xl border border-slate-200/90 shadow-2xs flex items-center justify-between gap-3 transition-colors"
                    >
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <img
                          src={
                            u.avatar ||
                            `https://ui-avatars.com/api/?name=${encodeURIComponent(
                              u.name
                            )}&background=1E3A8A&color=ffffff&size=128&bold=true`
                          }
                          alt={u.name}
                          className="w-9 h-9 rounded-xl object-cover border border-slate-200 shrink-0"
                        />
                        <div className="min-w-0 flex-1">
                          <p className="font-bold text-xs text-slate-900 truncate">{u.name}</p>
                          <p className="text-[11px] text-slate-400 truncate">
                            {u.department || (u.role === 'ADMIN' ? 'Administrator' : 'Karyawan')}
                          </p>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleToggleTagUser(u.id)}
                        className={`px-3 py-1 rounded-full text-xs font-semibold transition-all cursor-pointer shrink-0 border ${
                          isTagged
                            ? 'bg-blue-600 hover:bg-rose-600 text-white border-blue-600 hover:border-rose-600 shadow-2xs'
                            : 'bg-slate-50 hover:bg-blue-50 text-slate-700 hover:text-blue-700 border-slate-200 hover:border-blue-300'
                        }`}
                        title={isTagged ? 'Klik untuk membatalkan tag' : 'Klik untuk tag rekan ini'}
                      >
                        {isTagged ? 'Ditag' : '+ Tag'}
                      </button>
                    </div>
                  );
                })
              )}
            </div>

            {/* Footer */}
            <div className="px-6 py-3 border-t border-slate-100 bg-slate-50 flex items-center justify-end">
              <button
                type="button"
                onClick={() => setShowTagTeammatesModal(false)}
                className="px-4 py-2 bg-[#1E3A8A] hover:bg-[#172554] text-white font-bold rounded-xl text-xs transition-colors cursor-pointer"
              >
                Selesai
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
