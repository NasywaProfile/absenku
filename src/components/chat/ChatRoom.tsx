import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  MessageSquare,
  Maximize2,
  Minimize2,
  Search,
  Plus,
  Calendar,
  User as UserIcon,
  Paperclip,
  Link2,
  Image as ImageIcon,
  Send,
  X,
  FileText,
  Trash2,
  Download,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  Globe,
  Tag,
  CheckCircle2,
  Check,
  Clock,
  MessageCircle,
  ExternalLink,
  Sparkles,
  ArrowUp,
} from 'lucide-react';
import {
  ChatTopic,
  ChatComment,
  ChatTopicStatus,
  User as UserType,
  UserRole,
  TaskAttachment,
} from '../../types/index.ts';
import { AppStorage } from '../../lib/storage.ts';
import {
  Bubble,
  BubbleContent,
  BubbleGroup,
  BubbleReactions,
  DateDivider,
} from '@/components/ui/bubble';
import { compressImageFile } from '../../lib/image-compression.ts';
import { uploadToCloudinary } from '../../lib/cloudinary.ts';
import { ModernConfirmDialog } from '../common/ModernConfirmDialog.tsx';
import { MediaPreviewModal, MediaPreviewData } from '../common/MediaPreviewModal.tsx';
import { openExternalLink, openAttachmentDirectly, isImageFile } from '../../lib/open-media.ts';
import { TeamMembersModal, TeamMemberItem } from '../common/TeamMembersModal.tsx';



interface ChatRoomProps {
  currentUser: UserType;
  users: UserType[];
  userRole: UserRole;
  onRefresh?: () => void;
}

export function ChatRoom({ currentUser, users, userRole, onRefresh }: ChatRoomProps) {
  const isAdminOrSuperAdmin =
    userRole === 'ADMIN' ||
    userRole === 'SUPER_ADMIN' ||
    currentUser.role === 'ADMIN' ||
    currentUser.role === 'SUPER_ADMIN';
  const [topics, setTopics] = useState<ChatTopic[]>(() => AppStorage.getChatTopics());
  const [activeTopic, setActiveTopic] = useState<ChatTopic | null>(null);
  const [isTopicFullScreen, setIsTopicFullScreen] = useState(false);
  const [isCreateTopicFullScreen, setIsCreateTopicFullScreen] = useState(false);
  const [isAttachmentsExpanded, setIsAttachmentsExpanded] = useState(false);
  
  // Filters State (Matching Tugas Saya / Kanban Board style)
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [teammateFilter, setTeammateFilter] = useState<string>('ALL');
  const [createdByFilter, setCreatedByFilter] = useState<string>('ALL');
  const [createdDateCustom, setCreatedDateCustom] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [isMobileFilterOpen, setIsMobileFilterOpen] = useState<boolean>(false);

  const handleResetFilters = () => {
    setStatusFilter('ALL');
    setTeammateFilter('ALL');
    setCreatedByFilter('ALL');
    setCreatedDateCustom('');
    setSearchTerm('');
  };

  const hasActiveFilters =
    statusFilter !== 'ALL' ||
    teammateFilter !== 'ALL' ||
    createdByFilter !== 'ALL' ||
    createdDateCustom !== '' ||
    searchTerm !== '';

  // New Topic Modal State
  const [showCreateModal, setShowCreateModal] = useState<boolean>(false);
  const [newTitle, setNewTitle] = useState<string>('');
  const [newStatus, setNewStatus] = useState<ChatTopicStatus>('NEED_COMMENTS');
  const [newTaggedIds, setNewTaggedIds] = useState<string[]>([]);
  const [newShortNotes, setNewShortNotes] = useState<string>('');
  const [newFiles, setNewFiles] = useState<TaskAttachment[]>([]);
  const [newLinks, setNewLinks] = useState<{ title: string; url: string }[]>([]);
  const [newLinkTitle, setNewLinkTitle] = useState<string>('');
  const [newLinkUrl, setNewLinkUrl] = useState<string>('');
  const [showAddLinkInput, setShowAddLinkInput] = useState<boolean>(false);

  // Modern dialog confirmation state (no browser alert/confirm popup)
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    variant?: 'warning' | 'danger' | 'info' | 'success';
    confirmText?: string;
    cancelText?: string;
    hideCancel?: boolean;
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {},
  });

  // File upload handler for creating new topic
  const handleTopicFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    for (const file of Array.from(files)) {
      let fileUrl = '';
      try {
        const cloudRes = await uploadToCloudinary(file, { folder: 'absenku/chat' });
        fileUrl = cloudRes.url;
      } catch (err) {
        console.warn('Cloudinary upload fallback to base64:', err);
        fileUrl = await compressImageFile(file);
      }
      const newAtt: TaskAttachment = {
        id: `att-topic-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        name: file.name,
        type: 'FILE',
        url: fileUrl,
        fileType: file.type || 'application/octet-stream',
        uploadedBy: currentUser.id,
        uploadedByName: currentUser.name,
        uploadedAt: new Date().toISOString().replace('T', ' ').substring(0, 16),
      };
      setNewFiles((prev) => [...prev, newAtt]);
    }
    e.target.value = '';
  };

  const handleAddTopicLink = () => {
    if (!newLinkUrl.trim()) return;
    let url = newLinkUrl.trim();
    if (!/^https?:\/\//i.test(url)) url = 'https://' + url;
    setNewLinks((prev) => [
      ...prev,
      { title: newLinkTitle.trim() || url, url },
    ]);
    setNewLinkTitle('');
    setNewLinkUrl('');
    setShowAddLinkInput(false);
  };

  // Direct File Upload to Active Topic
  const handleUploadToActiveTopic = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!activeTopic) return;
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const uploadedFiles: TaskAttachment[] = [];
    for (const file of Array.from(files)) {
      let fileUrl = '';
      try {
        const cloudRes = await uploadToCloudinary(file, { folder: 'absenku/chat' });
        fileUrl = cloudRes.url;
      } catch (err) {
        console.warn('Cloudinary upload fallback to base64:', err);
        fileUrl = await compressImageFile(file);
      }
      uploadedFiles.push({
        id: `att-topic-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        name: file.name,
        type: 'FILE',
        url: fileUrl,
        fileType: file.type || 'application/octet-stream',
        uploadedBy: currentUser.id,
        uploadedByName: currentUser.name,
        uploadedAt: new Date().toISOString().replace('T', ' ').substring(0, 16),
      });
    }

    const updatedTopic: ChatTopic = {
      ...activeTopic,
      files: [...(activeTopic.files || []), ...uploadedFiles],
      updatedAt: new Date().toISOString().substring(0, 10),
    };

    AppStorage.updateChatTopic(updatedTopic);
    reloadTopics();
    setActiveTopic(updatedTopic);
    e.target.value = '';
  };

  // Comment Input State inside Active Topic Modal
  const [commentText, setCommentText] = useState<string>('');
  const [commentAttachments, setCommentAttachments] = useState<TaskAttachment[]>([]);
  const [activeTab, setActiveTab] = useState<'COMMENTS' | 'ACTIVITY'>('COMMENTS');
  const [previewModalData, setPreviewModalData] = useState<MediaPreviewData | null>(null);
  const [showCommentAddLink, setShowCommentAddLink] = useState(false);
  const [commentLinkTitle, setCommentLinkTitle] = useState('');
  const [commentLinkUrl, setCommentLinkUrl] = useState('');

  // Mention Autocomplete & Suggestion State
  const [showMentionDropdown, setShowMentionDropdown] = useState<boolean>(false);
  const [mentionQuery, setMentionQuery] = useState<string>('');
  const [mentionCursorIndex, setMentionCursorIndex] = useState<number>(-1);
  const commentInputRef = useRef<HTMLTextAreaElement>(null);

  // Search filter for Tag Teammates in Create Topic modal
  const [createTopicMemberSearch, setCreateTopicMemberSearch] = useState<string>('');

  // Teammates suggestion list for mentions
  const mentionSuggestions = useMemo(() => {
    const q = mentionQuery.toLowerCase().trim();
    if (!q) return users;
    return users.filter(
      (u) =>
        u.name.toLowerCase().includes(q) ||
        (u.email && u.email.toLowerCase().includes(q)) ||
        (u.department && u.department.toLowerCase().includes(q))
    );
  }, [users, mentionQuery]);

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return '1.2 MB';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const handleCommentFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    for (const file of Array.from(files)) {
      let fileUrl = '';
      try {
        const cloudRes = await uploadToCloudinary(file, { folder: 'absenku/chat' });
        fileUrl = cloudRes.url;
      } catch (err) {
        console.warn('Cloudinary upload fallback to base64:', err);
        fileUrl = await compressImageFile(file);
      }
      const newAtt: TaskAttachment = {
        id: `att-comment-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        name: file.name,
        type: 'FILE',
        url: fileUrl,
        fileType: file.type || 'application/octet-stream',
        fileSize: formatFileSize(file.size),
        uploadedBy: currentUser.id,
        uploadedByName: currentUser.name,
        uploadedAt: new Date().toISOString().replace('T', ' ').substring(0, 16),
      };
      setCommentAttachments((prev) => [...prev, newAtt]);
    }
    e.target.value = '';
  };

  const handleAddCommentLink = () => {
    if (!commentLinkUrl.trim()) return;
    let url = commentLinkUrl.trim();
    if (!/^https?:\/\//i.test(url)) url = 'https://' + url;
    const newAtt: TaskAttachment = {
      id: `att-comment-link-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      name: commentLinkTitle.trim() || url,
      type: 'LINK',
      url,
      uploadedBy: currentUser.id,
      uploadedByName: currentUser.name,
      uploadedAt: new Date().toISOString().replace('T', ' ').substring(0, 16),
    };
    setCommentAttachments((prev) => [...prev, newAtt]);
    setCommentLinkTitle('');
    setCommentLinkUrl('');
    setShowCommentAddLink(false);
  };

  const commentsEndRef = useRef<HTMLDivElement>(null);

  // Reload topics from AppStorage
  const reloadTopics = () => {
    const updated = AppStorage.getChatTopics();
    setTopics(updated);
    if (activeTopic) {
      const refreshedTopic = updated.find((t) => t.id === activeTopic.id);
      if (refreshedTopic) setActiveTopic(refreshedTopic);
    }
  };

  useEffect(() => {
    commentsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activeTopic?.comments]);

  // Filtered Topics list (Strict privacy: if not Admin, only shows if created by user, tagged, or mentioned)
  const filteredTopics = useMemo(() => {
    const currentNameLower = currentUser.name.toLowerCase();
    const currentFirstName = currentUser.name.split(' ')[0].toLowerCase();

    return topics.filter((t) => {
      // Access Control: Non-admin only sees topics where they are creator, tagged, or mentioned
      if (!isAdminOrSuperAdmin) {
        const isCreator = t.createdBy === currentUser.id;
        const isTagged = Boolean(t.taggedTeammateIds?.includes(currentUser.id));
        const isMentioned = Boolean(
          t.comments?.some((c) => {
            const notesLower = (c.notes || '').toLowerCase();
            const mentionsMatch = c.mentions?.some((m) => {
              const mLower = m.toLowerCase();
              return (
                mLower === currentUser.id.toLowerCase() ||
                mLower === currentNameLower ||
                mLower === currentFirstName ||
                currentNameLower.includes(mLower)
              );
            });
            const textMention =
              notesLower.includes(`@${currentNameLower}`) ||
              notesLower.includes(`@${currentFirstName}`);
            return mentionsMatch || textMention;
          })
        );
        if (!isCreator && !isTagged && !isMentioned) {
          return false;
        }
      }

      const matchesStatus = statusFilter === 'ALL' || t.status === statusFilter;
      const matchesTeammate =
        teammateFilter === 'ALL' || t.taggedTeammateIds.includes(teammateFilter);
      const matchesCreatedBy =
        createdByFilter === 'ALL' || t.createdBy === createdByFilter;
      const matchesCreatedDate =
        !createdDateCustom || (t.createdAt && t.createdAt.startsWith(createdDateCustom));
      const matchesSearch =
        !searchTerm.trim() ||
        t.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (t.shortNotes && t.shortNotes.toLowerCase().includes(searchTerm.toLowerCase()));
      return matchesStatus && matchesTeammate && matchesCreatedBy && matchesCreatedDate && matchesSearch;
    });
  }, [topics, statusFilter, teammateFilter, createdByFilter, createdDateCustom, searchTerm, isAdminOrSuperAdmin, currentUser]);

  // Ensure active topic is closed if user has no access to it
  useEffect(() => {
    if (activeTopic && !isAdminOrSuperAdmin) {
      const hasAccess = filteredTopics.some((t) => t.id === activeTopic.id);
      if (!hasAccess) {
        setActiveTopic(null);
      }
    }
  }, [filteredTopics, activeTopic, isAdminOrSuperAdmin]);

  // Pagination Ruang Obrolan (10 item teratas)
  const [currentPage, setCurrentPage] = useState<number>(1);
  const ITEMS_PER_PAGE = 10;

  useEffect(() => {
    setCurrentPage(1);
  }, [statusFilter, teammateFilter, createdByFilter, createdDateCustom, searchTerm]);

  const totalPages = Math.ceil(filteredTopics.length / ITEMS_PER_PAGE) || 1;
  const paginatedTopics = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredTopics.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredTopics, currentPage]);

  // Handle Create Topic
  const handleCreateTopic = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    if (newTaggedIds.length === 0) {
      alert('Pilih setidaknya satu anggota tim yang ditag agar obrolan dapat masuk ke rekan yang dituju.');
      return;
    }

    AppStorage.addChatTopic({
      title: newTitle.trim(),
      status: newStatus,
      taggedTeammateIds: Array.from(new Set([...newTaggedIds, currentUser.id])),
      shortNotes: newShortNotes.trim(),
      files: newFiles,
      links: newLinks,
      createdBy: currentUser.id,
      createdByName: currentUser.name,
      createdByAvatar: currentUser.avatar,
    });

    setNewTitle('');
    setNewStatus('NEED_COMMENTS');
    setNewTaggedIds([]);
    setNewShortNotes('');
    setNewFiles([]);
    setNewLinks([]);
    setCreateTopicMemberSearch('');
    setShowCreateModal(false);
    reloadTopics();
  };

  const handleCommentChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const val = e.target.value;
    setCommentText(val);

    const cursorPos = e.target.selectionStart ?? val.length;
    const textBefore = val.slice(0, cursorPos);
    const lastAtIndex = textBefore.lastIndexOf('@');

    if (lastAtIndex !== -1) {
      const textAfterAt = textBefore.slice(lastAtIndex + 1);
      if (!textAfterAt.includes('\n') && textAfterAt.length <= 25) {
        setMentionQuery(textAfterAt);
        setMentionCursorIndex(lastAtIndex);
        setShowMentionDropdown(true);
        return;
      }
    }
    setShowMentionDropdown(false);
  };

  const handleSelectMentionUser = (user: UserType) => {
    if (mentionCursorIndex === -1) {
      setCommentText((prev) => `${prev}@${user.name} `);
    } else {
      const before = commentText.slice(0, mentionCursorIndex);
      const after = commentText.slice(mentionCursorIndex + 1 + mentionQuery.length);
      setCommentText(`${before}@${user.name} ${after}`);
    }
    setShowMentionDropdown(false);
    setMentionQuery('');
    setMentionCursorIndex(-1);
    commentInputRef.current?.focus();
  };

  // Handle Add Comment
  const handleSendComment = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!activeTopic) return;
    if (!commentText.trim() && commentAttachments.length === 0) return;

    // Detect @mentions from text against available users
    const textLower = commentText.toLowerCase();
    const mentionedUsers = users.filter((u) => {
      const fullNameLower = u.name.toLowerCase();
      const firstNameLower = u.name.split(' ')[0].toLowerCase();
      return (
        textLower.includes(`@${fullNameLower}`) ||
        textLower.includes(`@${firstNameLower}`) ||
        textLower.includes(`@${u.id.toLowerCase()}`)
      );
    });

    const genericMatches = commentText.match(/@([a-zA-Z0-9_\u00C0-\u017F]+)/g) || [];
    const genericMentions = genericMatches.map((m) => m.substring(1));
    const allMentionLabels = Array.from(
      new Set([...mentionedUsers.map((u) => u.name), ...genericMentions])
    );

    // CRITICAL REQUIREMENT:
    // If a teammate is mentioned in comments, dynamically tag them in taggedTeammateIds!
    // This allows the discussion to enter/appear in their chat view immediately.
    const newlyTaggedIds = mentionedUsers
      .map((u) => u.id)
      .filter((id) => !activeTopic.taggedTeammateIds.includes(id));

    if (newlyTaggedIds.length > 0) {
      const updatedTopic: ChatTopic = {
        ...activeTopic,
        taggedTeammateIds: [...activeTopic.taggedTeammateIds, ...newlyTaggedIds],
      };
      AppStorage.updateChatTopic(updatedTopic);
      setActiveTopic(updatedTopic);
    }

    AppStorage.addTopicComment(activeTopic.id, {
      userId: currentUser.id,
      userName: currentUser.name,
      userAvatar: currentUser.avatar,
      userRole,
      notes: commentText.trim(),
      attachments: commentAttachments,
      mentions: allMentionLabels,
      type: 'COMMENT',
    });

    setCommentText('');
    setCommentAttachments([]);
    setShowMentionDropdown(false);
    reloadTopics();
  };

  // Handle Delete Comment
  const handleDeleteComment = (commentId: string) => {
    if (!activeTopic) return;
    AppStorage.deleteTopicComment(activeTopic.id, commentId);
    reloadTopics();
    const updated = AppStorage.getChatTopics().find((t) => t.id === activeTopic.id);
    if (updated) setActiveTopic(updated);
  };

  // Handle Update Topic Status from Detail Drawer
  const handleUpdateTopicStatus = (topicId: string, status: ChatTopicStatus) => {
    const topic = topics.find((t) => t.id === topicId);
    if (!topic) return;
    const updated = { ...topic, status };
    AppStorage.updateChatTopic(updated);
    reloadTopics();
  };

  // Handle Delete Topic
  const handleDeleteTopic = (topicId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setConfirmModal({
      isOpen: true,
      title: 'Hapus Topik Obrolan',
      message: 'Apakah Anda yakin ingin menghapus topik obrolan ini beserta seluruh riwayat pesannya?',
      variant: 'danger',
      confirmText: 'Ya, Hapus',
      cancelText: 'Batal',
      hideCancel: false,
      onConfirm: () => {
        AppStorage.deleteChatTopic(topicId);
        if (activeTopic?.id === topicId) {
          setActiveTopic(null);
        }
        reloadTopics();
        if (onRefresh) onRefresh();
        setConfirmModal((prev) => ({ ...prev, isOpen: false }));
      },
    });
  };

  // Status Badge Component
  const renderStatusBadge = (status: ChatTopicStatus) => {
    switch (status) {
      case 'NEED_COMMENTS':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-200/80 shadow-2xs">
            <span>Need comments</span>
          </span>
        );
      case 'CLOSED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200/80 shadow-2xs">
            <span>Closed</span>
          </span>
        );
      case 'IN_PROGRESS':
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-sky-100 text-sky-800 border border-sky-200/80 shadow-2xs">
            <span>In Progress</span>
          </span>
        );
    }
  };

  // Modal Pop Up untuk melihat semua rekan tim yang ditag dalam sebuah topik
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

  const handleOpenTaggedMembersModal = (topic: ChatTopic, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const taggedIds = topic.taggedTeammateIds || [];
    const members: TeamMemberItem[] = taggedIds.map((uid) => {
      const u = users.find((user) => user.id === uid);
      return {
        id: uid,
        name: u?.name || 'Rekan Tim',
        avatar: u?.avatar,
        role: u?.role === 'ADMIN' ? 'Administrator' : u?.role === 'SUPER_ADMIN' ? 'Super Admin' : 'Karyawan',
        department: u?.department || (u?.role === 'ADMIN' ? 'Administrator' : 'Karyawan'),
        statusBadge: 'Ditag',
        statusColor: 'blue',
      };
    });

    setTaggedMembersModalData({
      isOpen: true,
      title: 'Rekan Tim yang Ditag',
      subtitle: `Topik: "${topic.title}" • ${members.length} Rekan Ditag`,
      members,
    });
  };

  // Render User Avatars Stack
  const renderTeammateAvatars = (taggedIds: string[]) => {
    const taggedUsers = users.filter((u) => taggedIds.includes(u.id));
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
          <div className="w-6 h-6 rounded-full border-2 border-white bg-purple-600 text-white flex items-center justify-center text-[9px] font-bold shrink-0">
            +{taggedUsers.length - 4}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-4 font-sans antialiased">
      {/* 1. TOP BAR NAV, SEARCH & FILTERS */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs p-3 sm:p-3.5 space-y-2.5 sm:space-y-3">
        {/* ROW 1A: TAMPILAN KHUSUS MOBILE (< sm) */}
        <div className="flex sm:hidden flex-col gap-2.5 pb-2.5 border-b border-slate-100">
          {/* 1. Tombol Buat Topik Baru (Switch Posisi ke Atas / Dulu) */}
          <button
            type="button"
            onClick={() => setShowCreateModal(true)}
            className="w-full h-11 inline-flex items-center justify-center gap-2 px-4 bg-[#1E3A8A] hover:bg-[#172554] active:scale-[0.98] text-white rounded-2xl text-xs font-bold shadow-xs transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4 text-white stroke-[2.5]" />
            <span>Buat Topik Baru</span>
          </button>

          {/* 2. Kolom Search dengan Panah ke Bawah untuk Buka/Tutup Filter */}
          <div className="relative w-full flex items-center">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 pointer-events-none" />
            <input
              type="text"
              placeholder="Cari topik, pesan..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
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

        {/* ROW 1B: TAMPILAN DESKTOP & TABLET (>= sm) - Tetap Normal */}
        <div className="hidden sm:flex sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
          {/* Search Bar Input (Kiri) */}
          <div className="relative w-full flex-1 min-w-0">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              placeholder="Cari topik, pesan..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="h-10 w-full pl-9 pr-8 bg-white hover:bg-slate-50 focus:bg-white border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-[#1E3A8A] text-slate-900 text-xs transition-colors shadow-2xs font-medium"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer p-0.5"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Tombol Buat Topik Baru (Kanan) */}
          <button
            type="button"
            onClick={() => setShowCreateModal(true)}
            className="h-10 inline-flex items-center justify-center gap-2 px-5 bg-[#1E3A8A] hover:bg-[#172554] active:scale-[0.98] text-white rounded-xl text-xs font-semibold shadow-xs transition-all cursor-pointer shrink-0 whitespace-nowrap"
          >
            <Plus className="w-4 h-4 text-white stroke-[2.5]" />
            <span>Buat Topik Baru</span>
          </button>
        </div>

        {/* Row 2: Dedicated Filter Strip (Desktop selalu tampil, Mobile hanya tampil jika panah filter diklik) */}
        <div className={`${isMobileFilterOpen ? 'flex' : 'hidden'} sm:flex flex-col lg:flex-row items-stretch lg:items-center gap-2.5 sm:gap-3 bg-slate-50/90 p-3 sm:p-2.5 md:p-3 rounded-2xl border border-slate-200/80 text-xs w-full animate-in fade-in slide-in-from-top-1 duration-150`}>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3 flex-1 min-w-0">
            {/* Filter 1: Tahapan Topik */}
            <div
              className={`flex items-center gap-2.5 h-11 sm:h-9.5 md:h-10 px-3.5 sm:px-3 rounded-xl border transition-all shadow-2xs min-w-0 ${
                statusFilter !== 'ALL'
                  ? 'bg-blue-50 border-blue-300 text-[#1E3A8A] font-bold ring-1 ring-blue-300/40'
                  : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-700'
              }`}
            >
              <span className="text-xs font-semibold text-slate-500 whitespace-nowrap shrink-0">Tahapan:</span>
              <div className="relative flex items-center flex-1 min-w-0">
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="w-full appearance-none pr-6 bg-transparent font-semibold text-slate-900 text-xs focus:outline-hidden cursor-pointer truncate py-1"
                >
                  <option value="ALL">Semua Tahapan</option>
                  <option value="NEED_COMMENTS">Perlu Tanggapan</option>
                  <option value="IN_PROGRESS">Sedang Berjalan</option>
                  <option value="CLOSED">Selesai / Ditutup</option>
                </select>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-0 pointer-events-none shrink-0" />
              </div>
            </div>

            {/* Filter 2: Pelaksana / Penanggung Jawab */}
            <div
              className={`flex items-center gap-2.5 h-11 sm:h-9.5 md:h-10 px-3.5 sm:px-3 rounded-xl border transition-all shadow-2xs min-w-0 ${
                teammateFilter !== 'ALL'
                  ? 'bg-blue-50 border-blue-300 text-[#1E3A8A] font-bold ring-1 ring-blue-300/40'
                  : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-700'
              }`}
            >
              <span className="text-xs font-semibold text-slate-500 whitespace-nowrap shrink-0">Pelaksana:</span>
              <div className="relative flex items-center flex-1 min-w-0">
                <select
                  value={teammateFilter}
                  onChange={(e) => setTeammateFilter(e.target.value)}
                  className="w-full appearance-none pr-6 bg-transparent font-semibold text-slate-900 text-xs focus:outline-hidden cursor-pointer truncate py-1"
                >
                  <option value="ALL">Semua Rekan</option>
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name}
                    </option>
                  ))}
                </select>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-0 pointer-events-none shrink-0" />
              </div>
            </div>

            {/* Filter 3: Dibuat Oleh */}
            <div
              className={`flex items-center gap-2.5 h-11 sm:h-9.5 md:h-10 px-3.5 sm:px-3 rounded-xl border transition-all shadow-2xs min-w-0 ${
                createdByFilter !== 'ALL'
                  ? 'bg-blue-50 border-blue-300 text-[#1E3A8A] font-bold ring-1 ring-blue-300/40'
                  : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-700'
              }`}
            >
              <span className="text-xs font-semibold text-slate-500 whitespace-nowrap shrink-0">Dibuat Oleh:</span>
              <div className="relative flex items-center flex-1 min-w-0">
                <select
                  value={createdByFilter}
                  onChange={(e) => setCreatedByFilter(e.target.value)}
                  className="w-full appearance-none pr-6 bg-transparent font-semibold text-slate-900 text-xs focus:outline-hidden cursor-pointer truncate py-1"
                >
                  <option value="ALL">Semua Pembuat</option>
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name}
                    </option>
                  ))}
                </select>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-0 pointer-events-none shrink-0" />
              </div>
            </div>

            {/* Filter 4: Tanggal Dibuat */}
            <div
              className={`flex items-center gap-2.5 h-11 sm:h-9.5 md:h-10 px-3.5 sm:px-3 rounded-xl border transition-all shadow-2xs min-w-0 ${
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
                className="w-full bg-transparent text-xs text-slate-900 font-semibold focus:outline-hidden cursor-pointer min-w-0 py-1"
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

          {/* Reset Filter Banner (Jika Ada Filter Aktif) */}
          {hasActiveFilters && (
            <div className="flex items-center justify-between pt-1 border-t border-slate-200/60">
              <span className="text-[11px] font-semibold text-[#1E3A8A]">
                Filter sedang aktif &bull; Menampilkan {filteredTopics.length} dari {topics.length} topik
              </span>
              <button
                type="button"
                onClick={handleResetFilters}
                className="h-7 px-2.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold border border-rose-200 text-[11px] flex items-center gap-1 cursor-pointer transition-all active:scale-95"
                title="Hapus Semua Filter"
              >
                <X className="w-3 h-3" />
                <span>Reset Filter</span>
              </button>
            </div>
          )}
        </div>

      {/* 2. TOPICS TABLE LIST VIEW (Matching image_ec656e6c.png) */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs overflow-hidden">
        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-left text-xs min-w-[580px]">
            <thead className="bg-slate-50/80 border-b border-slate-200 text-slate-400 font-bold uppercase tracking-wider text-[10px]">
              <tr>
                <th className="py-3 px-4 w-1/2">Topik</th>
                <th className="py-3 px-3">Status</th>
                <th className="py-3 px-3">Tag teammates</th>
                <th className="py-3 px-3 text-center">Comments</th>
                <th className="py-3 px-3 text-center w-16">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700 font-medium">
              {filteredTopics.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-slate-400">
                    <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-40 text-slate-400" />
                    <p className="font-semibold text-xs">Belum ada topik obrolan</p>
                    <p className="text-[11px] text-slate-400 pt-0.5">
                      Klik "+ New topic" untuk memulai diskusi ruang obrolan baru.
                    </p>
                  </td>
                </tr>
              ) : (
                paginatedTopics.map((topic) => {
                  const commentCount = topic.comments.length;

                  return (
                    <tr
                      key={topic.id}
                      onClick={() => {
                        setActiveTopic(topic);
                        setIsAttachmentsExpanded(false);
                      }}
                      className="hover:bg-purple-50/40 transition-colors cursor-pointer group"
                    >
                      {/* Topik Title */}
                      <td className="py-3.5 px-4">
                        <div>
                          <p className="font-bold text-slate-900 group-hover:text-purple-700 leading-snug line-clamp-2">
                            {topic.title}
                          </p>
                          {topic.shortNotes && (
                            <p className="text-[11px] text-slate-400 font-normal pt-0.5 line-clamp-1">
                              {topic.shortNotes}
                            </p>
                          )}
                        </div>
                      </td>

                      {/* Status Pill */}
                      <td className="py-3.5 px-3 whitespace-nowrap">
                        {renderStatusBadge(topic.status)}
                      </td>

                      {/* Tag Teammates */}
                      <td
                        className="py-3.5 px-3 whitespace-nowrap cursor-pointer hover:bg-blue-50/60 transition-colors group/teammates"
                        onClick={(e) => handleOpenTaggedMembersModal(topic, e)}
                        title="Klik untuk melihat semua foto & nama rekan tim yang ditag"
                      >
                        <div className="inline-flex items-center gap-1.5 p-1 rounded-xl group-hover/teammates:ring-1 group-hover/teammates:ring-blue-300 transition-all">
                          {renderTeammateAvatars(topic.taggedTeammateIds)}
                        </div>
                      </td>

                      {/* Comments Count Badge */}
                      <td className="py-3.5 px-3 text-center whitespace-nowrap">
                        <div className="inline-flex items-center gap-1.5 px-2 py-1 bg-slate-100 text-slate-700 font-bold rounded-xl text-[11px] shadow-2xs group-hover:bg-purple-100 group-hover:text-purple-800">
                          <MessageCircle className="w-3.5 h-3.5 text-purple-600 fill-purple-100" />
                          <span>{commentCount}</span>
                        </div>
                      </td>

                      {/* Tombol Hapus Aksi */}
                      <td className="py-3.5 px-3 text-center whitespace-nowrap">
                        <button
                          type="button"
                          onClick={(e) => handleDeleteTopic(topic.id, e)}
                          title="Hapus Topik Obrolan"
                          className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-xl transition-colors cursor-pointer border border-transparent hover:border-rose-200 shadow-2xs"
                        >
                          <Trash2 className="w-4 h-4 mx-auto" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Navigasi Riwayat Jika > 10 Topik */}
        {filteredTopics.length > ITEMS_PER_PAGE && (
          <div className="px-4 py-3 border-t border-slate-100 flex items-center justify-between bg-slate-50/60 text-xs">
            <span className="text-slate-500 font-medium">
              Menampilkan {Math.min((currentPage - 1) * ITEMS_PER_PAGE + 1, filteredTopics.length)}-
              {Math.min(currentPage * ITEMS_PER_PAGE, filteredTopics.length)} dari {filteredTopics.length} topik
            </span>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
                disabled={currentPage === 1}
                className="p-1.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-white hover:text-slate-900 disabled:opacity-40 disabled:cursor-not-allowed transition cursor-pointer shadow-2xs"
                title="Halaman Sebelumnya"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="px-2 font-bold text-slate-700">
                {currentPage} / {totalPages}
              </span>
              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
                disabled={currentPage === totalPages}
                className="p-1.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-white hover:text-slate-900 disabled:opacity-40 disabled:cursor-not-allowed transition cursor-pointer shadow-2xs"
                title="Halaman Berikutnya"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 3. DETAIL TOPIK & CHAT DRAWER / MODAL */}
      {activeTopic && (
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
            onClick={() => setActiveTopic(null)}
          />
          {/* Dialog Card */}
          <div
            className={`relative z-10 bg-white shadow-2xl flex flex-col min-h-0 overflow-hidden transition-all duration-300 font-sans ${
              isTopicFullScreen
                ? 'w-full h-full max-w-none max-h-none rounded-none border-0'
                : 'w-full max-w-md sm:max-w-lg md:max-w-xl h-full max-h-[calc(100vh-1.25rem)] sm:max-h-[calc(100vh-2rem)] rounded-3xl border border-slate-200/80 animate-in slide-in-from-right duration-300 ease-out'
            }`}
          >
            {/* Modal Body Container */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6 custom-scrollbar bg-slate-50/30">
              {/* TOP METADATA CARD (Clean, Minimalis & Elegan) */}
              <div className="bg-white border border-gray-100 rounded-2xl p-5 sm:p-6 shadow-2xs space-y-4">
                {/* 1. Bagian Judul, Subjudul, Tanggal (Center di antara Zoom & Close) */}
                <div className="flex items-start justify-between gap-3 pb-1">
                  {/* Container Tombol Zoom di pojok kiri atas */}
                  <div className="w-9 shrink-0 flex items-start">
                    <button
                      type="button"
                      onClick={() => setIsTopicFullScreen(!isTopicFullScreen)}
                      className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl border border-slate-200/80 transition-colors cursor-pointer"
                      title={isTopicFullScreen ? "Perkecil Tampilan" : "Perbesar Layar Penuh"}
                    >
                      {isTopicFullScreen ? (
                        <Minimize2 className="w-4 h-4 text-slate-600" />
                      ) : (
                        <Maximize2 className="w-4 h-4 text-slate-600" />
                      )}
                    </button>
                  </div>

                  {/* Judul, Subjudul & Tanggal dibuat CENTER di antara button zoom dan exit */}
                  <div className="flex-1 min-w-0 text-center px-1 sm:px-3 space-y-1.5 flex flex-col items-center justify-center">
                    <h2 className="text-sm sm:text-[15px] font-bold text-gray-900 tracking-tight leading-snug max-w-2xl">
                      {activeTopic.title}
                    </h2>
                    <div className="flex flex-wrap items-center justify-center gap-x-2.5 gap-y-1 text-[11px] sm:text-xs text-gray-500 pt-0.5">
                      <p className="flex items-center gap-1.5">
                        <span>Dibuat oleh</span>
                        <span className="font-semibold text-gray-800">{activeTopic.createdByName}</span>
                      </p>
                      <span className="text-gray-300">•</span>
                      <p className="flex items-center gap-1 text-gray-500">
                        <Clock className="w-3.5 h-3.5 text-gray-400" />
                        <span>{activeTopic.createdAt}</span>
                      </p>
                    </div>
                  </div>

                  {/* Container Tombol Close (✕) di Sudut Kanan Atas */}
                  <div className="w-9 shrink-0 flex items-start justify-end">
                    <button
                      type="button"
                      onClick={() => {
                        setActiveTopic(null);
                        setIsAttachmentsExpanded(false);
                      }}
                      title="Tutup Obrolan"
                      className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-full transition-colors cursor-pointer -mr-1"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                </div>

                {/* Garis Pemisah Tipis (Divider Line) */}
                <div className="border-t border-gray-100 pt-3" />

                {/* 2. Tata Letak Dua Kolom (Split Grid) untuk Bagian Bawah: Tim & Lampiran */}
                <div className="grid grid-cols-1 md:grid-cols-12 gap-5 items-start">
                  {/* Kolom Kiri (md:col-span-5): Informasi Tim/Anggota + Status Dropdown di bawahnya */}
                  <div className="md:col-span-5 space-y-3.5">
                    {/* Profil Tim */}
                    <div className="space-y-1.5">
                      <span className="text-xs font-bold text-gray-400 uppercase tracking-wider block">
                        TIM
                      </span>
                      <div
                        onClick={(e) => handleOpenTaggedMembersModal(activeTopic, e)}
                        className="inline-flex items-center gap-2.5 px-3 py-1.5 rounded-2xl bg-slate-50 hover:bg-blue-50 border border-slate-200 hover:border-blue-200 transition-all cursor-pointer shadow-2xs group"
                        title="Klik untuk melihat semua foto & nama rekan tim yang ditag"
                      >
                        <div className="flex -space-x-1.5 overflow-hidden items-center py-0.5">
                          {renderTeammateAvatars(activeTopic.taggedTeammateIds)}
                        </div>
                        <span className="text-xs font-bold text-slate-700 group-hover:text-[#1E3A8A] transition-colors">
                          {activeTopic.taggedTeammateIds?.length || 0} Rekan Ditag
                        </span>
                      </div>
                    </div>

                    {/* Status atau Need Comments Ditaruh Tepat di Bawah Profil Tim */}
                    <div className="space-y-1.5 pt-1">
                      <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider block">
                        STATUS
                      </span>
                      <div className="relative inline-flex items-center">
                        <select
                          value={activeTopic.status}
                          onChange={(e) =>
                            handleUpdateTopicStatus(activeTopic.id, e.target.value as ChatTopicStatus)
                          }
                          className={`appearance-none pl-6 pr-7 py-1.5 rounded-full text-xs font-semibold outline-none cursor-pointer transition-all shadow-2xs ${
                            activeTopic.status === 'CLOSED'
                              ? 'bg-amber-50 text-amber-800 border border-amber-200/80 hover:bg-amber-100/80'
                              : activeTopic.status === 'NEED_COMMENTS'
                              ? 'bg-purple-50 text-purple-800 border border-purple-200/80 hover:bg-purple-100/80'
                              : 'bg-sky-50 text-sky-800 border border-sky-200/80 hover:bg-sky-100/80'
                          }`}
                        >
                          <option value="NEED_COMMENTS">Need comments</option>
                          <option value="IN_PROGRESS">In Progress</option>
                          <option value="CLOSED">Closed</option>
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
                  </div>

                  {/* Kolom Kanan (md:col-span-7): Khusus Menampung Daftar File Lampiran & Tautan Eksternal */}
                  <div className="md:col-span-7 md:border-l md:border-gray-100 md:pl-5 space-y-2.5">
                    {/* Header Lampiran dengan Tombol "+ Up File" berdampingan di atas daftar */}
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">
                        LAMPIRAN ({((activeTopic.files?.length || 0) + (activeTopic.links?.length || 0))})
                      </span>
                      {/* Tombol Upload File Tambahan */}
                      <label className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold text-purple-700 bg-purple-50 hover:bg-purple-100 border border-purple-200 transition cursor-pointer shrink-0">
                        <Paperclip className="w-3.5 h-3.5 text-purple-600" />
                        <span>+ Up File</span>
                        <input
                          type="file"
                          multiple
                          className="hidden"
                          onChange={handleUploadToActiveTopic}
                        />
                      </label>
                    </div>

                    {/* Daftar File Lampiran: Tampilkan 2 file teratas saja, jika ada lebih bisa di-expand dengan scroll halus */}
                    {(() => {
                      const allAttachments = [
                        ...(activeTopic.files || []).map((f) => ({ kind: 'file' as const, file: f })),
                        ...(activeTopic.links || []).map((l, idx) => ({ kind: 'link' as const, link: l, id: `link-${idx}` })),
                      ];

                      if (allAttachments.length === 0) {
                        return (
                          <p className="text-xs text-gray-400 italic py-1">Belum ada file lampiran</p>
                        );
                      }

                      const displayedItems = isAttachmentsExpanded
                        ? allAttachments
                        : allAttachments.slice(0, 2);

                      return (
                        <div className="space-y-2">
                          <div className={`flex flex-col space-y-2 ${isAttachmentsExpanded && allAttachments.length > 2 ? 'max-h-48 overflow-y-auto custom-scrollbar pr-1' : ''}`}>
                            {displayedItems.map((item) =>
                              item.kind === 'file' ? (
                                <div
                                  key={item.file.id}
                                  onClick={() => setPreviewModalData({
                                    url: item.file.url,
                                    name: item.file.name,
                                    type: 'FILE',
                                    fileType: item.file.fileType,
                                  })}
                                  className="flex items-center justify-between gap-2 px-3 py-2 rounded-xl text-xs font-medium text-gray-700 bg-gray-50 hover:bg-blue-50 hover:text-[#1E3A8A] border border-gray-200 hover:border-blue-200 transition group cursor-pointer"
                                  title={`Buka ${item.file.name}`}
                                >
                                  <div className="flex items-center gap-2 min-w-0">
                                    <Paperclip className="w-3.5 h-3.5 text-gray-400 group-hover:text-[#1E3A8A] shrink-0" />
                                    <span className="truncate">{item.file.name}</span>
                                  </div>
                                  <Download className="w-3.5 h-3.5 text-gray-400 group-hover:text-[#1E3A8A] shrink-0 opacity-70 group-hover:opacity-100" />
                                </div>
                              ) : (
                                <div
                                  key={item.id}
                                  onClick={() => openExternalLink(item.link.url)}
                                  className="flex items-center justify-between gap-2 px-3 py-2 rounded-xl text-xs font-medium text-blue-700 bg-blue-50/70 hover:bg-blue-100/70 border border-blue-200/80 hover:border-blue-300 transition group cursor-pointer"
                                  title={`Buka tautan: ${item.link.url}`}
                                >
                                  <div className="flex items-center gap-2 min-w-0">
                                    <Globe className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                                    <span className="truncate">{item.link.title}</span>
                                  </div>
                                  <ExternalLink className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                                </div>
                              )
                            )}
                          </div>

                          {/* Tautan Teks Lihat Lampiran Lainnya jika > 2 file (Plain Text Link tanpa Button Box) */}
                          {allAttachments.length > 2 && (
                            <div className="pt-0.5">
                              <button
                                type="button"
                                onClick={() => setIsAttachmentsExpanded(!isAttachmentsExpanded)}
                                className="inline-flex items-center gap-1 text-xs font-semibold text-purple-600 hover:text-purple-800 hover:underline transition-colors cursor-pointer"
                              >
                                {isAttachmentsExpanded ? (
                                  <>
                                    <span>Tampilkan 2 file saja</span>
                                    <ChevronUp className="w-3.5 h-3.5" />
                                  </>
                                ) : (
                                  <>
                                    <span>+ Lihat {allAttachments.length - 2} lampiran lainnya</span>
                                    <ChevronDown className="w-3.5 h-3.5" />
                                  </>
                                )}
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })()}
                  </div>
                </div>
              </div>

              {/* COMMENTS & ACTIVITY SECTION (Chat Messages & Input) */}
              <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs overflow-hidden flex flex-col">
                {/* Chat Messages List (iOS iMessage Style) */}
                <div className="p-4 space-y-4 max-h-[420px] overflow-y-auto custom-scrollbar bg-white/60 font-sans">
                  {/* iOS Date Divider */}
                  <DateDivider>Kemarin 14:12</DateDivider>

                  {activeTopic.comments.length === 0 ? (
                    <div className="py-8 text-center text-slate-400 text-xs font-medium">
                      Belum ada obrolan. Tulis pesan di bawah untuk memulai tanggapan.
                    </div>
                  ) : (
                    <BubbleGroup>
                      {activeTopic.comments.map((comm) => {
                        const isMe = comm.userId === currentUser.id;
                        return isMe ? (
                          /* 2. Pesan dari Diri Sendiri (Kanan) */
                          <div
                            key={comm.id}
                            className="flex flex-col items-end self-end max-w-[75%] ml-auto animate-in fade-in duration-150"
                          >
                            {/* Bubble Chat Biru Khas iOS */}
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
                                  {comm.attachments.map((att) => {
                                    const isImg = isImageFile(att.url, att.fileType) || isImageFile(att.name, att.fileType);
                                    if (isImg && att.url && att.url !== '#') {
                                      return (
                                        <div
                                          key={att.id}
                                          onClick={() => setPreviewModalData({
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
                                            setPreviewModalData({
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
                                {comm.timestamp} · Terkirim
                              </span>
                              {(comm.userId === currentUser.id || isAdminOrSuperAdmin) && (
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
                        ) : (
                          /* 1. Pesan dari Rekan / Orang Lain (Kiri) */
                          <div
                            key={comm.id}
                            className="flex items-end gap-2 max-w-[75%] animate-in fade-in duration-150"
                          >
                            {/* Avatar */}
                            <div className="w-7 h-7 rounded-full overflow-hidden bg-slate-200 border border-slate-300 shrink-0 mb-1">
                              {comm.userAvatar ? (
                                <img
                                  src={comm.userAvatar}
                                  alt={comm.userName}
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center font-bold text-xs text-slate-700 bg-purple-100">
                                  {comm.userName.charAt(0)}
                                </div>
                              )}
                            </div>

                            <div className="flex flex-col items-start">
                              {/* Nama Pengirim (Kecil di atas bubble) */}
                              <span className="text-[11px] font-semibold text-gray-500 ml-3 mb-1">
                                {comm.userName}
                              </span>

                              {/* Bubble Chat Abu-abu Khas iOS */}
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
                                    {comm.attachments.map((att) => {
                                      const isImg = isImageFile(att.url, att.fileType) || isImageFile(att.name, att.fileType);
                                      if (isImg && att.url && att.url !== '#') {
                                        return (
                                          <div
                                            key={att.id}
                                            onClick={() => setPreviewModalData({
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
                                              setPreviewModalData({
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
                                          {att.type === 'LINK' ? <Globe className="w-3.5 h-3.5 text-[#1E3A8A]" /> : <Paperclip className="w-3.5 h-3.5 text-[#1E3A8A]" />}
                                          <span className="truncate max-w-[130px]">{att.name}</span>
                                          <ExternalLink className="w-3 h-3 text-slate-400 ml-0.5" />
                                        </button>
                                      );
                                    })}
                                  </div>
                                )}
                              </div>

                              {/* Timestamp halus di bawah */}
                              <div className="flex items-center gap-1.5 ml-3 mt-1">
                                <span className="text-[10px] text-gray-400">
                                  {comm.timestamp}
                                </span>
                                {(comm.userId === currentUser.id || isAdminOrSuperAdmin) && (
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
                          </div>
                        );
                      })}
                    </BubbleGroup>
                  )}
                  <div ref={commentsEndRef} />
                </div>

                {/* Input Bar ala iPhone di Bagian Bawah */}
                <div className="p-3 border-t border-gray-100 bg-white/80 backdrop-blur-md shrink-0">
                  {/* Form Input Pesan & Lampiran */}
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
                      }}
                      className="flex items-end gap-1.5 sm:gap-2"
                    >
                      {/* Tombol Unggah File / Gambar */}
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

                      {/* Tombol Tambah Link */}
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

                      {/* Tombol Mention Rekan (@) */}
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
                        <span className="text-sm font-bold">@</span>
                      </button>

                      {/* Input Field Pill with Mention Autocomplete Menu (Textarea) */}
                      <div className="relative flex-1">
                        {showMentionDropdown && (
                          <div className="absolute bottom-full left-0 mb-2 w-72 sm:w-80 bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden z-50 animate-in fade-in slide-in-from-bottom-2 duration-150 font-sans">
                            <div className="px-3.5 py-2.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                              <span className="text-[11px] font-bold text-slate-700 flex items-center gap-1.5">
                                <span className="w-4 h-4 rounded-full bg-blue-100 text-[#1E3A8A] flex items-center justify-center text-[10px] font-bold">@</span>
                                Mention Rekan Tim
                              </span>
                              <button
                                type="button"
                                onClick={() => setShowMentionDropdown(false)}
                                className="text-slate-400 hover:text-slate-600 p-0.5 rounded cursor-pointer"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>
                            <div className="max-h-52 overflow-y-auto p-1 divide-y divide-slate-100">
                              {mentionSuggestions.length === 0 ? (
                                <div className="p-3 text-center text-xs text-slate-400">
                                  Tidak ada rekan tim yang cocok
                                </div>
                              ) : (
                                mentionSuggestions.map((u) => {
                                  const isAlreadyTagged = activeTopic?.taggedTeammateIds?.includes(u.id);
                                  return (
                                    <button
                                      key={u.id}
                                      type="button"
                                      onClick={() => handleSelectMentionUser(u)}
                                      className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-blue-50 text-left transition rounded-xl group cursor-pointer"
                                    >
                                      <div className="w-7 h-7 rounded-full overflow-hidden bg-slate-200 shrink-0 border border-slate-300">
                                        {u.avatar ? (
                                          <img src={u.avatar} alt={u.name} className="w-full h-full object-cover" />
                                        ) : (
                                          <div className="w-full h-full flex items-center justify-center font-bold text-xs text-slate-700 bg-blue-100">
                                            {u.name.charAt(0)}
                                          </div>
                                        )}
                                      </div>
                                      <div className="flex-1 min-w-0">
                                        <div className="text-xs font-bold text-slate-800 group-hover:text-[#1E3A8A] truncate">
                                          {u.name}
                                        </div>
                                        <div className="text-[10px] text-slate-400 truncate">
                                          {u.department || (u.role === 'ADMIN' ? 'Administrator' : 'Karyawan')}
                                        </div>
                                      </div>
                                      {isAlreadyTagged ? (
                                        <span className="text-[9px] font-semibold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded-md shrink-0 border border-emerald-200">
                                          Ditag
                                        </span>
                                      ) : (
                                        <span className="text-[9px] font-semibold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded-md shrink-0 border border-amber-200">
                                          + Auto-tag
                                        </span>
                                      )}
                                    </button>
                                  );
                                })
                              )}
                            </div>
                            <div className="px-3 py-1.5 bg-slate-50 border-t border-slate-100 text-[10px] text-slate-500 italic">
                              Rekan yang di-mention otomatis ditag & menerima obrolan ini.
                            </div>
                          </div>
                        )}

                        <textarea
                          ref={commentInputRef}
                          rows={1}
                          placeholder="Ketik pesan atau mention @teman..."
                          value={commentText}
                          onChange={(e) => {
                            handleCommentChange(e);
                            e.target.style.height = 'auto';
                            e.target.style.height = `${Math.min(e.target.scrollHeight, 120)}px`;
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              // Enter = new line (kebawah), jangan kirim!
                              e.stopPropagation();
                            }
                          }}
                          className="w-full bg-[#F2F2F7] border border-gray-200/80 rounded-2xl px-4 py-2 text-xs sm:text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#1E3A8A]/30 focus:bg-white transition resize-none max-h-28 overflow-y-auto leading-relaxed"
                        />
                      </div>

                      {/* Tombol Send */}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          handleSendComment(e);
                        }}
                        disabled={!commentText.trim() && commentAttachments.length === 0}
                        className="w-8 h-8 rounded-full bg-[#1E3A8A] text-white flex items-center justify-center hover:bg-[#172554] active:scale-95 transition shrink-0 shadow-2xs disabled:opacity-40 cursor-pointer mb-1"
                      >
                        <ArrowUp className="w-4 h-4 stroke-[2.5]" />
                      </button>
                    </form>

                    {/* Comment Attachments Preview Badges */}
                    {commentAttachments.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-2 px-1">
                        {commentAttachments.map((att) => (
                          <div
                            key={att.id}
                            className="flex items-center gap-1.5 px-2.5 py-1 bg-blue-50/80 border border-blue-200 text-[#1E3A8A] text-[11px] rounded-full font-medium"
                          >
                            <button
                              type="button"
                              onClick={() => setPreviewModalData({
                                url: att.url,
                                name: att.name,
                                type: att.type,
                                fileType: att.fileType,
                                fileSize: att.fileSize,
                              })}
                              className="flex items-center gap-1 hover:underline cursor-pointer"
                              title="Buka pratinjau"
                            >
                              {att.type === 'LINK' ? <Globe className="w-3 h-3" /> : <Paperclip className="w-3 h-3 text-[#1E3A8A]" />}
                              <span className="truncate max-w-[120px] font-semibold">{att.name}</span>
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                setCommentAttachments(
                                  commentAttachments.filter((a) => a.id !== att.id)
                                )
                              }
                              className="text-slate-400 hover:text-rose-600 ml-0.5 cursor-pointer"
                              title="Hapus"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 4. MODAL BUAT TOPIK OBROLAN BARU */}
      {showCreateModal && (
        <div
          className={`fixed inset-0 z-50 flex animate-in fade-in duration-200 ${
            isCreateTopicFullScreen
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
              isCreateTopicFullScreen
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
                    onClick={() => setIsCreateTopicFullScreen(!isCreateTopicFullScreen)}
                    className="p-1.5 sm:p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl border border-slate-200/80 transition-colors cursor-pointer shrink-0 mt-0.5"
                    title={isCreateTopicFullScreen ? "Perkecil Tampilan" : "Perbesar Layar Penuh"}
                  >
                    {isCreateTopicFullScreen ? (
                      <Minimize2 className="w-4 h-4 text-slate-600" />
                    ) : (
                      <Maximize2 className="w-4 h-4 text-slate-600" />
                    )}
                  </button>
                </div>

                {/* Judul & Subjudul diposisikan di tengah persis seperti di pop up card tugas */}
                <div className="flex-1 min-w-0 text-center px-1 sm:px-3 space-y-1 flex flex-col items-center justify-center pt-1.5 sm:pt-2">
                  <h2 className="text-sm sm:text-[15px] font-bold text-slate-900 tracking-tight leading-snug max-w-2xl">
                    Buat Topik Obrolan Baru
                  </h2>
                  <p className="text-slate-500 text-[11px] sm:text-xs leading-relaxed font-normal whitespace-pre-wrap max-w-2xl">
                    Lengkapi formulir di bawah ini untuk memulai ruang diskusi bersama tim.
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
            <form onSubmit={handleCreateTopic} className="flex-1 flex flex-col min-h-0">
              <div className="flex-1 overflow-y-auto p-6 space-y-4 text-xs">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Judul Topik Diskusi *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Contoh: Permintaan kunjungan Radar Malang ke AIC Malang..."
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 outline-none focus:border-purple-500 focus:bg-white font-medium transition-all"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Status Topik
                  </label>
                  <select
                    value={newStatus}
                    onChange={(e) => setNewStatus(e.target.value as ChatTopicStatus)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 outline-none focus:border-purple-500 focus:bg-white cursor-pointer"
                  >
                    <option value="NEED_COMMENTS">Need comments</option>
                    <option value="IN_PROGRESS">In Progress</option>
                    <option value="CLOSED">Closed</option>
                  </select>
                </div>

                {/* Tag Anggota Tim */}
                <div className="space-y-2 pt-1">
                  <div className="flex items-center justify-between">
                    <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                      Tag Anggota Tim *
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        if (newTaggedIds.length === users.length) {
                          setNewTaggedIds([]);
                        } else {
                          setNewTaggedIds(users.map((u) => u.id));
                        }
                      }}
                      className="text-[11px] font-bold text-[#1E3A8A] hover:underline cursor-pointer"
                    >
                      {newTaggedIds.length === users.length ? 'Batal Semua' : 'Pilih Semua'}
                    </button>
                  </div>

                  {/* Chips Anggota Tim Terpilih */}
                  {newTaggedIds.length > 0 && (
                    <div className="flex flex-wrap items-center gap-1.5 p-2 bg-slate-50/80 rounded-xl border border-slate-200/80">
                      {newTaggedIds.map((uid) => {
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
                              onClick={() => setNewTaggedIds((prev) => prev.filter((id) => id !== uid))}
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
                      value={createTopicMemberSearch}
                      onChange={(e) => setCreateTopicMemberSearch(e.target.value)}
                      placeholder="Cari anggota tim atau divisi..."
                      className="w-full pl-8 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-[#1E3A8A] focus:bg-white transition-all"
                    />
                  </div>

                  {/* Daftar Anggota Tim (Checklist Multi-Select Cards) */}
                  <div className="max-h-48 overflow-y-auto space-y-1.5 p-1.5 bg-slate-50/50 rounded-2xl border border-slate-200 custom-scrollbar">
                    {users
                      .filter((u) =>
                        !createTopicMemberSearch ||
                        u.name.toLowerCase().includes(createTopicMemberSearch.toLowerCase()) ||
                        (u.email && u.email.toLowerCase().includes(createTopicMemberSearch.toLowerCase())) ||
                        (u.department && u.department.toLowerCase().includes(createTopicMemberSearch.toLowerCase()))
                      )
                      .map((u) => {
                        const isSelected = newTaggedIds.includes(u.id);
                        return (
                          <div
                            key={u.id}
                            onClick={() => {
                              setNewTaggedIds((prev) =>
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
                                  {u.department || (u.role === 'ADMIN' ? 'Administrator' : 'Karyawan')}
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

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Catatan Ringkas / Deskripsi Topik
                  </label>
                  <textarea
                    rows={3}
                    placeholder="Ringkasan konteks diskusi atau instruksi untuk rekan tim..."
                    value={newShortNotes}
                    onChange={(e) => setNewShortNotes(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 outline-none focus:border-purple-500 focus:bg-white font-medium resize-none transition-all"
                  />
                </div>

                {/* Upload File & Link Section */}
                <div className="space-y-2 pt-1">
                  <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                    Upload Berkas &amp; Tautan Dokumen (Lampiran)
                  </label>
                  
                  <div className="flex flex-wrap items-center gap-2">
                    <label className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-purple-50 hover:bg-purple-100 text-purple-700 font-bold rounded-xl text-xs cursor-pointer transition-colors border border-purple-200">
                      <Paperclip className="w-3.5 h-3.5 text-purple-600" />
                      <span>+ Upload File</span>
                      <input
                        type="file"
                        multiple
                        className="hidden"
                        onChange={handleTopicFileUpload}
                      />
                    </label>

                    <button
                      type="button"
                      onClick={() => setShowAddLinkInput(!showAddLinkInput)}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold rounded-xl text-xs transition-colors border border-blue-200 cursor-pointer"
                    >
                      <Globe className="w-3.5 h-3.5 text-blue-600" />
                      <span>+ Tambah Link</span>
                    </button>
                  </div>

                  {/* Input Tautan Link */}
                  {showAddLinkInput && (
                    <div className="p-3 bg-blue-50/70 border border-blue-200 rounded-xl space-y-2.5 mt-2 animate-in fade-in duration-150">
                      <input
                        type="text"
                        placeholder="Judul Tautan (mis: Proposal Journalist Camp)"
                        value={newLinkTitle}
                        onChange={(e) => setNewLinkTitle(e.target.value)}
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-medium"
                      />
                      <div className="flex gap-2">
                        <input
                          type="url"
                          placeholder="https://example.com"
                          value={newLinkUrl}
                          onChange={(e) => setNewLinkUrl(e.target.value)}
                          className="flex-1 px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-medium"
                        />
                        <button
                          type="button"
                          onClick={handleAddTopicLink}
                          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-lg cursor-pointer"
                        >
                          Simpan Link
                        </button>
                      </div>
                    </div>
                  )}

                  {/* File & Link Preview Card Badges */}
                  {(newFiles.length > 0 || newLinks.length > 0) && (
                    <div className="space-y-2 pt-1">
                      {newFiles.map((f) => (
                        <div
                          key={f.id}
                          className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between text-xs"
                        >
                          <div className="flex items-center gap-2.5 truncate">
                            <div className="w-7 h-7 rounded-lg bg-purple-100 text-purple-700 flex items-center justify-center shrink-0">
                              <Paperclip className="w-3.5 h-3.5" />
                            </div>
                            <div className="truncate">
                              <span className="font-semibold text-slate-800 block truncate">{f.name}</span>
                              <span className="text-[10px] text-slate-400 font-mono">Berkas Lampiran</span>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => setNewFiles(newFiles.filter((item) => item.id !== f.id))}
                            className="p-1 text-slate-400 hover:text-rose-600 rounded-lg cursor-pointer ml-2"
                            title="Hapus"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}

                      {newLinks.map((l, idx) => (
                        <div
                          key={idx}
                          className="p-2.5 bg-blue-50/60 border border-blue-200 rounded-xl flex items-center justify-between text-xs"
                        >
                          <div className="flex items-center gap-2.5 truncate">
                            <div className="w-7 h-7 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center shrink-0">
                              <Globe className="w-3.5 h-3.5" />
                            </div>
                            <div className="truncate">
                              <span className="font-semibold text-blue-900 block truncate">{l.title}</span>
                              <span className="text-[10px] text-blue-500 font-mono block truncate">{l.url}</span>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => setNewLinks(newLinks.filter((_, i) => i !== idx))}
                            className="p-1 text-blue-400 hover:text-rose-600 rounded-lg cursor-pointer ml-2"
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
                  className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-xl cursor-pointer transition-colors"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 bg-[#1E3A8A] hover:bg-[#172554] text-white font-bold text-xs rounded-xl cursor-pointer shadow-xs transition-all hover:-translate-y-0.5"
                >
                  Buat Topik Obrolan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Pop Up Dialog Konfirmasi Simpel (Tanpa default browser alert/confirm localhost) */}
      <ModernConfirmDialog
        isOpen={confirmModal.isOpen}
        title={confirmModal.title}
        message={confirmModal.message}
        variant={confirmModal.variant}
        confirmText={confirmModal.confirmText}
        cancelText={confirmModal.cancelText}
        hideCancel={confirmModal.hideCancel}
        onConfirm={confirmModal.onConfirm}
        onCancel={() => setConfirmModal((prev) => ({ ...prev, isOpen: false }))}
      />

      {/* Pop Up Semua Foto & Nama Rekan Tim yang Ditag */}
      <TeamMembersModal
        isOpen={taggedMembersModalData.isOpen}
        onClose={() => setTaggedMembersModalData((prev) => ({ ...prev, isOpen: false }))}
        title={taggedMembersModalData.title}
        subtitle={taggedMembersModalData.subtitle}
        members={taggedMembersModalData.members}
      />

      {/* Modal Pratinjau Berkas, Gambar, dan Tautan Interaktif */}
      <MediaPreviewModal
        media={previewModalData}
        onClose={() => setPreviewModalData(null)}
      />
    </div>
  );
}
