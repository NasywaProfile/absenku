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
  AlertCircle,
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
import { compressImageFile } from '../../lib/image-compression.ts';
import { uploadToCloudinary } from '../../lib/cloudinary.ts';
import { uploadHybridFile } from '../../lib/file-uploader.ts';
import { ModernConfirmDialog } from '../common/ModernConfirmDialog.tsx';
import { MediaPreviewModal, MediaPreviewData } from '../common/MediaPreviewModal.tsx';
import { openExternalLink, openAttachmentDirectly, isImageFile } from '../../lib/open-media.ts';
import { TeamMembersModal, TeamMemberItem } from '../common/TeamMembersModal.tsx';
import { ChatTopicModal } from './ChatTopicModal.tsx';



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

  useEffect(() => {
    const handleChatSync = async () => {
      try {
        const serverTopics = await ApiClient.getChatTopics().catch(() => null);
        if (Array.isArray(serverTopics) && serverTopics.length > 0) {
          const localTopics = AppStorage.getChatTopics();
          const merged = [...localTopics];
          for (const st of serverTopics) {
            const idx = merged.findIndex((t) => t.id === st.id);
            const rawComments = Array.isArray(st.comments) && st.comments.length > 0
              ? st.comments
              : (Array.isArray(st.messages) ? st.messages : (st.comments || []));

            const mappedComments: ChatComment[] = Array.isArray(rawComments) && rawComments.length > 0
              ? rawComments.map((c: any) => ({
                  id: c.id,
                  topicId: c.topicId || c.topik_id || st.id,
                  userId: c.userId || c.pengguna_id || '',
                  userName: c.userName || c.nama_pengirim || '',
                  userAvatar: c.userAvatar || c.foto_pengirim || '',
                  userRole: c.userRole || c.peran_pengirim || 'EMPLOYEE',
                  timestamp: c.timestamp || c.waktu_kirim || '',
                  notes: c.notes || c.isi_pesan || c.content || '',
                  attachments: Array.isArray(c.attachments) ? c.attachments : (Array.isArray(c.lampiran) ? c.lampiran : []),
                  type: 'COMMENT' as const,
                }))
              : (idx >= 0 ? merged[idx].comments : []);

            const mappedTopic: ChatTopic = {
              id: st.id,
              title: st.title || st.judul_topik || '',
              status: (st.status || st.status_topik || 'NEED_COMMENTS') as any,
              taggedTeammateIds: safeParseJsonArray(st.taggedTeammateIds ?? st.id_anggota_ditandai ?? st.tagged_teammate_ids),
              files: Array.isArray(st.files) ? st.files : (Array.isArray(st.berkas) ? st.berkas : []),
              links: Array.isArray(st.links) ? st.links : (Array.isArray(st.tautan) ? st.tautan : []),
              images: Array.isArray(st.images) ? st.images : (Array.isArray(st.gambar) ? st.gambar : []),
              shortNotes: st.shortNotes || st.short_notes || st.catatan_singkat || '',
              longNotes: st.longNotes || st.long_notes || st.catatan_lengkap || '',
              createdBy: st.createdBy || st.created_by || st.dibuat_oleh_id || '',
              createdByName: st.createdByName || st.created_by_name || st.dibuat_oleh_nama || '',
              createdByAvatar: st.createdByAvatar || st.created_by_avatar || st.dibuat_oleh_foto || '',
              comments: mappedComments,
              createdAt: st.createdAt || st.created_at || '',
              updatedAt: st.updatedAt || st.updated_at || '',
            };
            if (idx >= 0) {
              merged[idx] = { ...merged[idx], ...mappedTopic };
            } else {
              merged.push(mappedTopic);
            }
          }
          AppStorage.saveChatTopics(merged);
          setTopics(merged);
          setActiveTopic((prev) => {
            if (!prev) return null;
            return merged.find((t) => t.id === prev.id) || prev;
          });
          return;
        }
      } catch {
        // Fallback to local
      }

      const updated = AppStorage.getChatTopics();
      setTopics(updated);
      setActiveTopic((prev) => {
        if (!prev) return null;
        return updated.find((t) => t.id === prev.id) || prev;
      });
    };

    // Sinkronkan data topik dari server seketika saat halaman dibuka
    handleChatSync();

    window.addEventListener('absenku:chat_updated', handleChatSync);
    window.addEventListener('storage', handleChatSync);

    const interval = setInterval(handleChatSync, 2000);

    return () => {
      window.removeEventListener('absenku:chat_updated', handleChatSync);
      window.removeEventListener('storage', handleChatSync);
      clearInterval(interval);
    };
  }, []);

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

  // Anggota tim yang dapat ditag:
  // 1. Tidak dobel (deduplikasi ketat berdasarkan ID, Email, dan Nama)
  // 2. Akun pembuat (currentUser / Akun A) TIDAK USAH masuk ke daftar tag anggota tim
  //    karena Akun A otomatis diikutsertakan sebagai pembuat tugas/topik
  const uniqueTeammates = useMemo(() => {
    const list: UserType[] = [];
    const seenNames = new Set<string>();
    const seenEmails = new Set<string>();
    const seenIds = new Set<string>();

    const creatorId = currentUser?.id;
    const creatorEmail = currentUser?.email?.toLowerCase().trim();
    const creatorName = currentUser?.name?.toLowerCase().trim();

    (users || []).forEach((u) => {
      if (!u || u.status !== 'ACTIVE') return;

      const uId = u.id;
      const uEmail = u.email?.toLowerCase().trim();
      const uName = u.name?.toLowerCase().trim();

      // Akun pembuat (currentUser / Akun A) TIDAK dimasukkan ke pilihan checklist
      const isCreator =
        (creatorId && uId === creatorId) ||
        (creatorEmail && uEmail && uEmail === creatorEmail) ||
        (creatorName && uName && uName === creatorName);

      if (isCreator) return;

      // Cek apakah sudah pernah masuk berdasarkan ID, Email, atau Nama yang sama
      if (uId && seenIds.has(uId)) return;
      if (uEmail && seenEmails.has(uEmail)) return;
      if (uName && seenNames.has(uName)) return;

      if (uId) seenIds.add(uId);
      if (uEmail) seenEmails.add(uEmail);
      if (uName) seenNames.add(uName);

      list.push(u);
    });

    return list;
  }, [users, currentUser]);

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
      try {
        const uploadRes = await uploadHybridFile(file, { folder: 'absenku/chat' });
        const newAtt: TaskAttachment = {
          id: `att-topic-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          name: uploadRes.name,
          type: 'FILE',
          url: uploadRes.url,
          fileType: uploadRes.type,
          fileSize: formatFileSize(uploadRes.size),
          uploadedBy: currentUser.id,
          uploadedByName: currentUser.name,
          uploadedAt: new Date().toISOString().replace('T', ' ').substring(0, 16),
        };
        setNewFiles((prev) => [...prev, newAtt]);
      } catch (err: any) {
        alert(err.message || 'Gagal mengunggah berkas.');
      }
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
    setChatUploadError(null);
    for (const file of Array.from(files)) {
      try {
        const uploadRes = await uploadHybridFile(file, { folder: 'absenku/chat' });
        uploadedFiles.push({
          id: `att-topic-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          name: uploadRes.name,
          type: 'FILE',
          url: uploadRes.url,
          fileType: uploadRes.type,
          fileSize: formatFileSize(uploadRes.size),
          uploadedBy: currentUser.id,
          uploadedByName: currentUser.name,
          uploadedAt: new Date().toISOString().replace('T', ' ').substring(0, 16),
        });
      } catch (err: any) {
        setChatUploadError(err.message || 'Gagal mengunggah berkas.');
        setTimeout(() => setChatUploadError(null), 4000);
      }
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
  const [chatUploadError, setChatUploadError] = useState<string | null>(null);
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
    setChatUploadError(null);
    for (const file of Array.from(files)) {
      try {
        const uploadRes = await uploadHybridFile(file, { folder: 'absenku/chat' });
        const newAtt: TaskAttachment = {
          id: `att-comment-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          name: uploadRes.name,
          type: 'FILE',
          url: uploadRes.url,
          fileType: uploadRes.type,
          fileSize: formatFileSize(uploadRes.size),
          uploadedBy: currentUser.id,
          uploadedByName: currentUser.name,
          uploadedAt: new Date().toISOString().replace('T', ' ').substring(0, 16),
        };
        setCommentAttachments((prev) => [...prev, newAtt]);
      } catch (err: any) {
        setChatUploadError(err.message || 'Gagal mengunggah berkas.');
        setTimeout(() => setChatUploadError(null), 4000);
      }
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

  // Filtered Topics list: topik hanya tampil jika akun terdaftar di Assignees (taggedTeammateIds) atau pembuat
  const filteredTopics = useMemo(() => {
    const currentNameLower = currentUser?.name ? currentUser.name.toLowerCase().trim() : '';
    const currentEmailLower = currentUser?.email ? currentUser.email.toLowerCase().trim() : '';
    const currentId = currentUser?.id;

    if (!Array.isArray(topics)) return [];

    // Kumpulkan seluruh identitas milik currentUser (ID, Email, Nama) dari session & list users
    const myIdentifiers = new Set<string>();
    if (currentId) myIdentifiers.add(currentId.toLowerCase());
    if (currentEmailLower) myIdentifiers.add(currentEmailLower);
    if (currentNameLower) myIdentifiers.add(currentNameLower);

    (users || []).forEach((u) => {
      const match =
        (currentId && u.id === currentId) ||
        (currentEmailLower && u.email && u.email.toLowerCase().trim() === currentEmailLower) ||
        (currentNameLower && u.name && u.name.toLowerCase().trim() === currentNameLower);
      if (match) {
        if (u.id) myIdentifiers.add(u.id.toLowerCase());
        if (u.email) myIdentifiers.add(u.email.toLowerCase().trim());
        if (u.name) myIdentifiers.add(u.name.toLowerCase().trim());
      }
    });

    return topics.filter((t) => {
      const tagged = safeParseJsonArray(
        t.taggedTeammateIds ?? (t as any).id_anggota_ditandai ?? (t as any).tagged_teammate_ids
      );

      // Cek apakah akun ini pembuat topik
      const isCreator =
        (t.createdBy && myIdentifiers.has(t.createdBy.toLowerCase().trim())) ||
        (t.createdByName && myIdentifiers.has(t.createdByName.toLowerCase().trim()));

      // Cek apakah akun ini termasuk yang ditag
      const isTagged = tagged.some((tagItem) => {
        if (!tagItem) return false;
        const cleanTag = tagItem.toLowerCase().trim();
        if (myIdentifiers.has(cleanTag)) return true;
        // Cek juga jika tagItem merujuk pada user yang memiliki email/nama/ID sama dengan currentUser
        const matchedUser = (users || []).find((u) => 
          (u.id && u.id.toLowerCase().trim() === cleanTag) ||
          (u.email && u.email.toLowerCase().trim() === cleanTag) ||
          (u.name && u.name.toLowerCase().trim() === cleanTag)
        );
        if (matchedUser) {
          if (matchedUser.id && myIdentifiers.has(matchedUser.id.toLowerCase().trim())) return true;
          if (matchedUser.email && myIdentifiers.has(matchedUser.email.toLowerCase().trim())) return true;
          if (matchedUser.name && myIdentifiers.has(matchedUser.name.toLowerCase().trim())) return true;
        }
        return false;
      });

      // Access Control: Admin/Superadmin memiliki akses pemantauan penuh,
      // topik umum tanpa tag terbuka untuk semua, atau khusus akun yang ditandai / pembuat
      const isAssignee = Boolean(
        isAdminOrSuperAdmin ||
        tagged.length === 0 ||
        isTagged ||
        isCreator
      );

      if (!isAssignee) {
        return false;
      }

      const matchesStatus = statusFilter === 'ALL' || t.status === statusFilter;
      const matchesTeammate =
        teammateFilter === 'ALL' ||
        tagged.some((tagItem) => typeof tagItem === 'string' && tagItem.toLowerCase() === teammateFilter.toLowerCase());
      const matchesCreatedBy =
        createdByFilter === 'ALL' || t.createdBy === createdByFilter;
      const matchesCreatedDate =
        !createdDateCustom || (t.createdAt && t.createdAt.startsWith(createdDateCustom));
      const matchesSearch =
        !searchTerm.trim() ||
        t.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (t.shortNotes && t.shortNotes.toLowerCase().includes(searchTerm.toLowerCase()));
      return matchesStatus && matchesTeammate && matchesCreatedBy && matchesCreatedDate && matchesSearch;
    }).sort((a, b) => {
      // Topik terbaru otomatis berada di urutan paling atas
      const timeA = a.updatedAt || a.createdAt || '';
      const timeB = b.updatedAt || b.createdAt || '';
      if (timeA !== timeB) return timeB.localeCompare(timeA);
      return (b.id || '').localeCompare(a.id || '');
    });
  }, [topics, statusFilter, teammateFilter, createdByFilter, createdDateCustom, searchTerm, currentUser, users, isAdminOrSuperAdmin]);

  // Pastikan topik aktif ditutup jika pengguna tidak memiliki akses ke topik tersebut
  useEffect(() => {
    if (activeTopic) {
      const hasAccess = filteredTopics.some((t) => t.id === activeTopic.id);
      if (!hasAccess) {
        setActiveTopic(null);
      }
    }
  }, [filteredTopics, activeTopic]);

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
  const handleCreateTopic = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    // Simpan semua representasi identitas akun yang ditandai (ID, Email, Nama)
    // serta identitas pembuat (Akun A) agar sinkronisasi antar perangkat & halaman 100% akurat
    const taggedIdentifiers: string[] = [currentUser.id];
    if (currentUser.email) taggedIdentifiers.push(currentUser.email);
    if (currentUser.name) taggedIdentifiers.push(currentUser.name);

    newTaggedIds.forEach((uid) => {
      taggedIdentifiers.push(uid);
      const matched = (users || []).find((u) => u.id === uid);
      if (matched) {
        if (matched.email) taggedIdentifiers.push(matched.email);
        if (matched.name) taggedIdentifiers.push(matched.name);
      }
    });

    const finalTaggedIds = Array.from(new Set(taggedIdentifiers));

    const newTopic = AppStorage.addChatTopic({
      title: newTitle.trim(),
      status: newStatus,
      taggedTeammateIds: finalTaggedIds,
      shortNotes: newShortNotes.trim(),
      files: newFiles,
      links: newLinks,
      createdBy: currentUser.id,
      createdByName: currentUser.name,
      createdByAvatar: currentUser.avatar,
    });

    // Kirim sinkronisasi langsung ke MySQL backend
    try {
      await ApiClient.createChatTopic({
        id: newTopic.id,
        title: newTopic.title,
        status: newTopic.status,
        shortNotes: newTopic.shortNotes,
        longNotes: newTopic.longNotes,
        taggedTeammateIds: newTopic.taggedTeammateIds,
        files: newTopic.files,
        links: newTopic.links,
        images: newTopic.images,
        createdBy: newTopic.createdBy,
        createdByName: newTopic.createdByName,
        createdByAvatar: newTopic.createdByAvatar,
      });
    } catch (err) {
      console.warn('Sinkronisasi topik chat ke server gagal, tersimpan lokal:', err);
    }

    setNewTitle('');
    setNewStatus('NEED_COMMENTS');
    setNewTaggedIds([]);
    setNewShortNotes('');
    setNewFiles([]);
    setNewLinks([]);
    setCreateTopicMemberSearch('');
    setShowCreateModal(false);
    reloadTopics();
    window.dispatchEvent(new CustomEvent('absenku:chat_updated'));
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
            <span>Perlu Tanggapan</span>
          </span>
        );
      case 'CLOSED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200/80 shadow-2xs">
            <span>Selesai</span>
          </span>
        );
      case 'IN_PROGRESS':
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-sky-100 text-sky-800 border border-sky-200/80 shadow-2xs">
            <span>Sedang Berjalan</span>
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
    const rawTagged = safeParseJsonArray(
      topic.taggedTeammateIds ?? (topic as any).id_anggota_ditandai ?? (topic as any).tagged_teammate_ids
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
      if (!u || u.name === 'Rekan Tim') return;

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
      subtitle: `Topik: "${topic.title}" • ${members.length} Rekan Ditag`,
      members,
    });
  };

  // Render User Avatars Stack (Hapus dummy agar tidak render avatar kosong)
  const renderTeammateAvatars = (taggedIds: string[]) => {
    const rawTagged = safeParseJsonArray(taggedIds);
    const cleanLower = rawTagged.map((id) => String(id).toLowerCase().trim());
    const taggedUsers = (users || []).filter((u) => 
      u.name !== 'Rekan Tim' && (
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
      <ChatTopicModal
        topic={activeTopic}
        isOpen={Boolean(activeTopic)}
        onClose={() => setActiveTopic(null)}
        currentUser={currentUser}
        users={users}
        onTopicUpdated={(updated) => {
          setActiveTopic(updated);
          setTopics((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
        }}
      />

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
                    <option value="NEED_COMMENTS">Perlu Tanggapan</option>
                    <option value="IN_PROGRESS">Sedang Berjalan</option>
                    <option value="CLOSED">Selesai</option>
                  </select>
                </div>

                {/* Tag Anggota Tim */}
                <div className="space-y-2 pt-1">
                  <div className="flex items-center justify-between">
                    <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                      Tag Anggota Tim *
                    </label>
                    {uniqueTeammates.length > 0 && (
                      <button
                        type="button"
                        onClick={() => {
                          if (newTaggedIds.length === uniqueTeammates.length) {
                            setNewTaggedIds([]);
                          } else {
                            setNewTaggedIds(uniqueTeammates.map((u) => u.id));
                          }
                        }}
                        className="text-[11px] font-bold text-[#1E3A8A] hover:underline cursor-pointer"
                      >
                        {newTaggedIds.length === uniqueTeammates.length && uniqueTeammates.length > 0 ? 'Batal Semua' : 'Pilih Semua'}
                      </button>
                    )}
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

                  {/* Daftar Anggota Tim (Checklist Multi-Select Cards - Tanpa Dobel & Tanpa Akun Pembuat) */}
                  <div className="max-h-48 overflow-y-auto space-y-1.5 p-1.5 bg-slate-50/50 rounded-2xl border border-slate-200 custom-scrollbar">
                    {uniqueTeammates
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
                    {uniqueTeammates.length === 0 && (
                      <div className="p-4 text-center text-slate-400 text-xs">
                        Tidak ada anggota tim lain yang dapat ditag.
                      </div>
                    )}
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
                          <div
                            onClick={() => openAttachmentDirectly(f)}
                            className="flex items-center gap-2.5 truncate cursor-pointer flex-1"
                            title={`Buka ${f.name} di tab baru`}
                          >
                            <div className="w-7 h-7 rounded-lg bg-purple-100 text-purple-700 flex items-center justify-center shrink-0">
                              <Paperclip className="w-3.5 h-3.5" />
                            </div>
                            <div className="truncate">
                              <span className="font-semibold text-slate-800 block truncate hover:text-[#1E3A8A] transition-colors">{f.name}</span>
                              <span className="text-[11px] text-slate-500 font-normal block leading-tight">Berkas Lampiran (Klik untuk buka di tab baru)</span>
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
                              <span className="text-[11px] text-blue-600 font-normal block truncate leading-tight">{l.url}</span>
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
              <div className="px-6 py-4.5 border-t border-slate-100 bg-white flex items-center justify-end gap-3 shrink-0">
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
