import React, { useState, useEffect, useRef } from 'react';
import {
  MessageSquare,
  Send,
  Hash,
  Paperclip,
  Smile,
  Shield,
  User as UserIcon,
  Search,
  CheckCircle2,
  Clock,
} from 'lucide-react';
import { User, DiscussionMessage, UserRole, EmploymentType } from '../../types/index.ts';
import { AppStorage } from '../../lib/storage.ts';
import { EMPLOYMENT_TYPE_LABELS } from '../../lib/whatsapp-recap.ts';

interface RoomDiscussionProps {
  currentUser: User;
}

const CHANNELS = [
  { id: 'general', name: 'umum-diskusi', description: 'Ruang koordinasi harian dan update santai internal tim' },
  { id: 'project', name: 'proyek-sprint', description: 'Diskusi teknis sprint release, arsitektur, dan blocker tugas' },
  { id: 'announcement', name: 'pengumuman-resmi', description: 'Pengumuman resmi dari Direksi dan Manajemen HR' },
];

export function RoomDiscussion({ currentUser }: RoomDiscussionProps) {
  const [activeChannel, setActiveChannel] = useState('general');
  const [messages, setMessages] = useState<DiscussionMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const loadMessages = () => {
    const all = AppStorage.getDiscussionMessages();
    setMessages(all);
  };

  useEffect(() => {
    loadMessages();
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, activeChannel]);

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim()) return;

    AppStorage.sendDiscussionMessage(currentUser, inputValue, activeChannel);
    setInputValue('');
    loadMessages();
  };

  const currentChannelObj = CHANNELS.find((c) => c.id === activeChannel) || CHANNELS[0];

  const filteredMessages = messages.filter((m) => {
    const channelMatch = (m.channelId || 'general') === activeChannel;
    if (!channelMatch) return false;
    if (!searchQuery) return true;
    return (
      m.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.userName.toLowerCase().includes(searchQuery.toLowerCase())
    );
  });

  const getRoleBadge = (role: UserRole, type: EmploymentType) => {
    if (role === 'SUPER_ADMIN') {
      return (
        <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-purple-50 text-purple-800 border border-purple-200">
          Super Admin
        </span>
      );
    }
    if (role === 'ADMIN') {
      return (
        <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-blue-50 text-[#1E3A8A] border border-blue-200">
          HR Admin
        </span>
      );
    }
    return (
      <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 border border-slate-200">
        {EMPLOYMENT_TYPE_LABELS[type] || 'Karyawan'}
      </span>
    );
  };

  return (
    <div className="space-y-4">
      {/* Header Panel */}
      <div className="w-full bg-white rounded-2xl border border-slate-200/90 shadow-xs p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-md bg-blue-50 text-[#1E3A8A] text-xs font-bold uppercase tracking-wider border border-blue-200/60">
              Kolaborasi Tim
            </span>
            <span className="text-xs text-slate-400 font-mono">Realtime Hub</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            Room Discussion Internal
          </h1>
          <p className="text-xs sm:text-sm text-slate-500">
            Ruang diskusi interaktif internal tim untuk koordinasi harian, pengumuman, dan sharing link/dokumen.
          </p>
        </div>

        {/* Quick Search in chat */}
        <div className="w-full sm:w-72">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari percakapan..."
              className="w-full pl-9 pr-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-[#1E3A8A] focus:bg-white transition-all"
            />
          </div>
        </div>
      </div>

      {/* Main Discussion Container: Channels Sidebar + Chat Feed */}
      <div className="grid grid-cols-1 md:grid-cols-4 bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden h-[620px]">
        {/* Channel Navigation Sidebar */}
        <div className="md:col-span-1 border-b md:border-b-0 md:border-r border-slate-200 bg-slate-50/60 p-4 flex flex-col">
          <div className="text-xs font-bold text-slate-400 uppercase tracking-wider px-2 mb-3">
            Channels Diskusi
          </div>

          <div className="space-y-1 flex-1">
            {CHANNELS.map((ch) => {
              const isActive = activeChannel === ch.id;
              return (
                <button
                  key={ch.id}
                  type="button"
                  onClick={() => setActiveChannel(ch.id)}
                  className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-bold transition-colors cursor-pointer text-left ${
                    isActive
                      ? 'bg-white text-[#1E3A8A] shadow-xs border border-blue-200 font-bold'
                      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                  }`}
                >
                  <Hash className={`w-4 h-4 shrink-0 ${isActive ? 'text-[#1E3A8A]' : 'text-slate-400'}`} />
                  <span className="truncate">{ch.name}</span>
                </button>
              );
            })}
          </div>

          {/* User Status Card */}
          <div className="pt-3 border-t border-slate-200/80 flex items-center gap-2.5">
            <img
              src={currentUser.avatar}
              alt={currentUser.name}
              className="w-8 h-8 rounded-full object-cover border border-slate-200"
            />
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold text-slate-900 truncate">{currentUser.name}</p>
              <p className="text-[10px] text-slate-500 truncate">
                {EMPLOYMENT_TYPE_LABELS[currentUser.employmentType]} &bull; Aktif
              </p>
            </div>
          </div>
        </div>

        {/* Chat Feed & Input Area */}
        <div className="md:col-span-3 flex flex-col h-full bg-white">
          {/* Active Channel Header */}
          <div className="px-5 py-3.5 border-b border-slate-200/80 bg-slate-50/30 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Hash className="w-4 h-4 text-slate-500" />
              <span className="font-bold text-sm text-slate-900">{currentChannelObj.name}</span>
              <span className="text-slate-300">|</span>
              <span className="text-xs text-slate-500 hidden sm:inline truncate max-w-md">
                {currentChannelObj.description}
              </span>
            </div>
            <span className="text-xs font-mono text-slate-400 font-medium">
              {filteredMessages.length} Pesan
            </span>
          </div>

          {/* Messages Scroll Area */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
            {filteredMessages.length === 0 ? (
              <div className="py-16 text-center text-slate-400 space-y-2">
                <MessageSquare className="w-8 h-8 mx-auto text-slate-300" />
                <p className="text-xs font-semibold text-slate-600">
                  Belum ada pesan di channel ini. Mulai percakapan pertama Anda!
                </p>
              </div>
            ) : (
              filteredMessages.map((msg) => {
                const isMe = msg.userId === currentUser.id;
                return (
                  <div key={msg.id} className="flex items-start gap-3 group">
                    <img
                      src={msg.userAvatar}
                      alt={msg.userName}
                      className="w-9 h-9 rounded-xl object-cover border border-slate-200 shrink-0 mt-0.5"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-xs text-slate-900">{msg.userName}</span>
                        {getRoleBadge(msg.userRole, msg.employmentType)}
                        <span className="text-[11px] text-slate-400 font-mono">
                          {msg.timestamp.substring(11, 16)} WIB
                        </span>
                      </div>

                      <div className="mt-1 text-xs sm:text-sm text-slate-800 leading-relaxed bg-slate-50/80 border border-slate-200/60 p-3 rounded-2xl rounded-tl-none inline-block max-w-2xl break-words">
                        {msg.content}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Message Input Box */}
          <div className="p-3.5 border-t border-slate-200 bg-slate-50/50">
            <form onSubmit={handleSendMessage} className="flex items-center gap-2">
              <input
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder={`Kirim pesan ke #${currentChannelObj.name}...`}
                className="flex-1 px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-[#1E3A8A] transition-all"
              />
              <button
                type="submit"
                disabled={!inputValue.trim()}
                className="px-4 py-2.5 bg-[#1E3A8A] hover:bg-[#172554] disabled:opacity-50 text-white font-bold rounded-xl text-xs shadow-xs transition-all flex items-center gap-1.5 cursor-pointer disabled:cursor-not-allowed shrink-0"
              >
                <span>Kirim</span>
                <Send className="w-3.5 h-3.5" />
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
