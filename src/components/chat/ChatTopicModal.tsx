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
import { uploadHybridFile } from '../../lib/file-uploader.ts';
import { openExternalLink, isImageFile } from '../../lib/open-media.ts';
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

  const commentsEndRef = useRef<HTMLDivElement>(null);
  const commentInputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setActiveTopic(topic);
    setIsAttachmentsExpanded(false);
    setShowCommentAddLink(false);
    setCommentAttachments([]);
    setCommentText('');
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
      }
    }

    const updatedTopic: ChatTopic = {
      ...activeTopic,
      files: [...(activeTopic.files || []), ...uploadedFiles],
    };
    AppStorage.updateChatTopic(updatedTopic);
    setActiveTopic(updatedTopic);
    if (onTopicUpdated) onTopicUpdated(updatedTopic);
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
  const handleSendComment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentText.trim() && commentAttachments.length === 0) return;

    // Detect @mentions
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

    const newlyTaggedIds = mentionedUsers
      .map((u) => u.id)
      .filter((id) => !activeTopic.taggedTeammateIds.includes(id));

    let updatedTopic: ChatTopic = activeTopic;
    if (newlyTaggedIds.length > 0) {
      updatedTopic = {
        ...activeTopic,
        taggedTeammateIds: [...activeTopic.taggedTeammateIds, ...newlyTaggedIds],
      };
      AppStorage.updateChatTopic(updatedTopic);
    }

    const newComment = AppStorage.addTopicComment(activeTopic.id, {
      userId: currentUser.id,
      userName: currentUser.name,
      userAvatar: currentUser.avatar,
      userRole: currentUser.role,
      notes: commentText.trim(),
      attachments: commentAttachments,
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

    setTimeout(() => {
      commentsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  };

  const handleDeleteComment = (commentId: string) => {
    if (!activeTopic) return;
    AppStorage.deleteTopicComment(activeTopic.id, commentId);
    const updated = AppStorage.getChatTopics().find((t) => t.id === activeTopic.id);
    if (updated) {
      setActiveTopic(updated);
      if (onTopicUpdated) onTopicUpdated(updated);
    }
  };

  // Open Tagged Members Modal
  const handleOpenTaggedMembersModal = (topicItem: ChatTopic, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const taggedIds = topicItem.taggedTeammateIds || [];
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
      subtitle: `Topik: "${topicItem.title}" • ${members.length} Rekan Ditag`,
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

        {/* Dialog Card (Identik dengan ChatRoom) */}
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
                      onClose();
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

                  {/* Status Dropdown Ditaruh Tepat di Bawah Profil Tim */}
                  <div className="space-y-1.5 pt-1">
                    <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider block">
                      STATUS
                    </span>
                    <div className="relative inline-flex items-center">
                      <select
                        value={activeTopic.status}
                        onChange={(e) =>
                          handleUpdateTopicStatus(e.target.value as ChatTopicStatus)
                        }
                        className={`appearance-none pl-6 pr-7 py-1.5 rounded-full text-xs font-semibold outline-none cursor-pointer transition-all shadow-2xs ${
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
                </div>

                {/* Kolom Kanan (md:col-span-7): Khusus Menampung Daftar File Lampiran & Tautan Eksternal */}
                <div className="md:col-span-7 md:border-l md:border-gray-100 md:pl-5 space-y-2.5">
                  {/* Header Lampiran dengan Tombol "+ Up File" berdampingan di atas daftar */}
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">
                      LAMPIRAN ({((activeTopic.files?.length || 0) + (activeTopic.links?.length || 0))})
                    </span>
                    {/* Tombol Upload File Tambahan */}
                    <label className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold text-[#1E3A8A] bg-blue-50 hover:bg-blue-100 border border-blue-200 transition cursor-pointer shrink-0">
                      <Paperclip className="w-3.5 h-3.5 text-[#1E3A8A]" />
                      <span>+ Up File</span>
                      <input
                        type="file"
                        multiple
                        className="hidden"
                        onChange={handleUploadToActiveTopic}
                      />
                    </label>
                  </div>

                  {/* Daftar File Lampiran */}
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

                        {allAttachments.length > 2 && (
                          <div className="pt-0.5">
                            <button
                              type="button"
                              onClick={() => setIsAttachmentsExpanded(!isAttachmentsExpanded)}
                              className="inline-flex items-center gap-1 text-xs font-semibold text-[#1E3A8A] hover:text-[#172554] hover:underline transition-colors cursor-pointer"
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
                        /* 2. Pesan dari Diri Sendiri (Kanan) */
                        <div
                          key={comm.id}
                          className="flex items-end justify-end gap-2 max-w-[75%] ml-auto animate-in fade-in duration-150"
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

                          {/* Avatar Sendiri */}
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
                              <div className="w-full h-full flex items-center justify-center font-bold text-xs text-slate-700 bg-blue-100">
                                {comm.userName.charAt(0)}
                              </div>
                            )}
                          </div>

                          <div className="flex flex-col items-start">
                            {/* Nama Pengirim */}
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

                            {/* Timestamp */}
                            <div className="flex items-center gap-1.5 ml-3 mt-1">
                              <span className="text-[10px] text-gray-400">
                                {comm.timestamp}
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
                        </div>
                      );
                    })}
                  </BubbleGroup>
                )}
                <div ref={commentsEndRef} />
              </div>

              {/* Input Bar di Bagian Bawah */}
              <div className="p-3 border-t border-gray-100 bg-white/80 backdrop-blur-md shrink-0">
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
                      @
                    </button>

                    {/* Input Field Teks Pesan (Textarea agar Enter turun kebawah) */}
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
                          if (e.key === 'Enter') {
                            // Biarkan Enter pindah baris ke bawah (kebawa), jangan kirim!
                            e.stopPropagation();
                          }
                        }}
                        placeholder="Tulis pesan..."
                        className="w-full bg-[#F2F2F7] focus:bg-white text-gray-900 border border-transparent focus:border-slate-300 rounded-2xl px-4 py-2 text-xs sm:text-sm outline-none transition-all resize-none max-h-28 overflow-y-auto leading-relaxed"
                      />

                      {/* Dropdown Mention Rekan Tim */}
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

                    {/* Tombol Kirim Bundar iOS: Klik untuk kirim */}
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

                  {/* Inline Peringatan Validasi Upload Berkas */}
                  {commentUploadError && (
                    <div className="flex items-center justify-between gap-1.5 mt-2 px-3 py-1.5 text-xs text-rose-600 bg-rose-50 border border-rose-200/90 rounded-xl animate-in fade-in duration-200">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <AlertCircle className="w-3.5 h-3.5 shrink-0 text-rose-500" />
                        <span className="font-medium">{commentUploadError}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setCommentUploadError(null)}
                        className="text-rose-400 hover:text-rose-700 ml-1 shrink-0 cursor-pointer p-0.5"
                        title="Tutup pesan"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}

                  {/* List Attachment Preview sebelum dikirim */}
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
    </>
  );
}
