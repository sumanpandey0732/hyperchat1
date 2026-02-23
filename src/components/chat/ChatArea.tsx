import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Phone, Video, MoreVertical, Send, Paperclip, Smile,
  Mic, ArrowLeft, X, CheckCheck, Check,
  Trash2, Reply, Download
} from 'lucide-react';
import { useMessages, type Message } from '@/hooks/useMessages';
import type { ChatWithMeta } from '@/hooks/useChats';
import type { Profile } from '@/contexts/AuthContext';
import { toast } from 'sonner';

interface ChatAreaProps {
  chat: ChatWithMeta;
  currentUser: Profile;
  onBack?: () => void;
  onOpenInfo?: () => void;
  onStartCall?: (chat: ChatWithMeta, callType: 'audio' | 'video') => void;
}

const avatarHue = (name: string) => (name.charCodeAt(0) * 13) % 360;
const emojis = ['😀','😂','❤️','🔥','👍','🎉','✨','🚀','💡','🎧','🎮','💎','🌙','⚡','🎵','🙏'];

const TypingDots = ({ names }: { names: string[] }) => (
  <div className="flex items-end gap-1 px-4 py-2.5 rounded-2xl rounded-bl-md message-bubble-received max-w-fit shadow-sm">
    <span className="text-xs text-muted-foreground mr-1">
      {names.length === 1 ? names[0] : `${names.length} people`} typing
    </span>
    {[0,1,2].map(i => (
      <span key={i} className="typing-dot w-1.5 h-1.5 rounded-full bg-muted-foreground block" style={{ animationDelay: `${i * 0.2}s` }} />
    ))}
  </div>
);

const ChatArea = ({ chat, currentUser, onBack, onOpenInfo, onStartCall }: ChatAreaProps) => {
  const { messages, loading, typingUsers, sendMessage, sendTypingIndicator, deleteMessage, uploadFile, markAsRead } = useMessages(chat.id);
  const [input, setInput] = useState('');
  const [showEmoji, setShowEmoji] = useState(false);
  const [selectedMsg, setSelectedMsg] = useState<Message | null>(null);
  const [replyTo, setReplyTo] = useState<Message | null>(null);
  const [uploading, setUploading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout>();

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  // Mark messages as read when chat is opened
  useEffect(() => {
    if (chat.id && markAsRead) {
      markAsRead();
    }
  }, [chat.id, messages.length, markAsRead]);

  const handleSend = useCallback(async () => {
    const content = input.trim();
    if (!content) return;
    setInput('');
    setReplyTo(null);
    setShowEmoji(false);
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
    const ok = await sendMessage(content);
    if (!ok) { toast.error('Failed to send'); setInput(content); }
  }, [input, sendMessage]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    e.target.style.height = 'auto';
    e.target.style.height = Math.min(e.target.scrollHeight, 128) + 'px';
    clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      sendTypingIndicator(currentUser.display_name);
    }, 300);
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 20 * 1024 * 1024) { toast.error('File must be under 20MB'); return; }
    setUploading(true);
    const result = await uploadFile(file);
    if (result) {
      const type = file.type.startsWith('image/') ? 'image' : file.type.startsWith('video/') ? 'video' : file.type.startsWith('audio/') ? 'audio' : 'file';
      await sendMessage(file.name, type, { file_url: result.url, file_name: result.name, file_type: result.type });
    } else { toast.error('Upload failed'); }
    setUploading(false);
    if (fileRef.current) fileRef.current.value = '';
  };

  const chatName = chat.is_group ? chat.group_name || 'Group' : chat.members[0]?.display_name || 'Unknown';
  const chatMember = chat.is_group ? null : chat.members[0] || null;
  const isOnline = !chat.is_group && chatMember?.is_online;
  const memberCount = chat.members.length + 1;

  const statusText = chat.is_group
    ? `${memberCount} members`
    : isOnline ? 'online'
    : chatMember?.last_seen
      ? `last seen ${new Date(chatMember.last_seen).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
      : 'offline';

  const formatMsgTime = (d: string) => new Date(d).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  const getStatusIcon = (msg: Message, isSent: boolean) => {
    if (!isSent) return null;
    if (msg.status === 'read') return <CheckCheck size={14} className="text-primary" />;
    if (msg.status === 'delivered') return <CheckCheck size={14} className="text-muted-foreground" />;
    return <Check size={14} className="text-muted-foreground" />;
  };

  const renderMessage = (msg: Message, isSent: boolean, showAvatar: boolean) => {
    const hue = avatarHue(msg.sender?.display_name || '');

    return (
      <div key={msg.id}
        className={`flex mb-1 ${isSent ? 'justify-end' : 'justify-start'}`}
        onClick={(e) => { e.stopPropagation(); setSelectedMsg(selectedMsg?.id === msg.id ? null : msg); }}
      >
        {!isSent && chat.is_group && (
          <div className="w-8 flex-shrink-0 mr-1.5 mt-auto">
            {showAvatar && (
              <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold overflow-hidden text-primary-foreground"
                style={{ background: msg.sender?.avatar_url ? undefined : `hsl(${hue}, 60%, 55%)` }}>
                {msg.sender?.avatar_url
                  ? <img src={msg.sender.avatar_url} alt="" className="w-full h-full object-cover" />
                  : msg.sender?.display_name?.[0]?.toUpperCase()}
              </div>
            )}
          </div>
        )}

        <div className={`max-w-[75%] lg:max-w-[60%] flex flex-col ${isSent ? 'items-end' : 'items-start'}`}>
          {!isSent && chat.is_group && showAvatar && (
            <span className="text-[11px] font-semibold px-2 mb-0.5 text-primary">
              {msg.sender?.display_name}
            </span>
          )}

          <div className={`relative px-3 py-2 rounded-2xl shadow-sm ${isSent
            ? 'message-bubble-sent rounded-br-md'
            : 'message-bubble-received rounded-bl-md'
          }`}>
            {msg.reply_to && (
              <div className="mb-1.5 px-2 py-1 rounded-lg border-l-2 border-primary bg-primary/10 text-xs text-muted-foreground">
                ↩ Replied to message
              </div>
            )}

            {msg.type === 'image' && msg.file_url && (
              <div className="mb-1.5 -mx-1">
                <img src={msg.file_url} alt={msg.file_name || 'Image'}
                  className="rounded-xl max-w-full max-h-64 object-cover cursor-pointer" loading="lazy"
                  onClick={() => window.open(msg.file_url!, '_blank')} />
              </div>
            )}
            {msg.type === 'video' && msg.file_url && (
              <video src={msg.file_url} controls className="rounded-xl max-w-full max-h-48 mb-1.5" />
            )}
            {msg.type === 'audio' && msg.file_url && (
              <audio src={msg.file_url} controls className="mb-1.5 w-48" />
            )}
            {msg.type === 'file' && msg.file_url && (
              <a href={msg.file_url} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-2 mb-1.5 px-2 py-1.5 rounded-lg bg-muted/50 hover:bg-muted transition-colors">
                <Paperclip size={14} className="text-primary flex-shrink-0" />
                <span className="text-xs truncate max-w-[140px]">{msg.file_name}</span>
                <Download size={12} className="flex-shrink-0 text-muted-foreground" />
              </a>
            )}

            {msg.content && msg.type !== 'image' && msg.type !== 'video' && msg.type !== 'audio' && (
              <p className="text-sm leading-relaxed whitespace-pre-wrap break-words text-foreground">{msg.content}</p>
            )}
            {msg.content && (msg.type === 'image' || msg.type === 'video') && msg.content !== msg.file_name && (
              <p className="text-xs mt-1 leading-relaxed text-foreground">{msg.content}</p>
            )}

            <div className={`flex items-center gap-1 mt-0.5 ${isSent ? 'justify-end' : 'justify-start'}`}>
              <span className="text-[10px] text-muted-foreground">{formatMsgTime(msg.created_at)}</span>
              {getStatusIcon(msg, isSent)}
            </div>
          </div>

          {/* Actions on tap */}
          <AnimatePresence>
            {selectedMsg?.id === msg.id && (
              <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                className={`flex gap-1 mt-1 ${isSent ? 'flex-row-reverse' : 'flex-row'}`}>
                <button onClick={(e) => { e.stopPropagation(); setReplyTo(msg); setSelectedMsg(null); }}
                  className="p-1.5 rounded-lg bg-card border border-border text-muted-foreground hover:text-foreground text-xs flex items-center gap-1 shadow-sm">
                  <Reply size={13} /> Reply
                </button>
                {isSent && (
                  <button onClick={(e) => { e.stopPropagation(); deleteMessage(msg.id); setSelectedMsg(null); }}
                    className="p-1.5 rounded-lg bg-card border border-border text-destructive text-xs flex items-center gap-1 shadow-sm">
                    <Trash2 size={13} /> Delete
                  </button>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    );
  };

  // Group consecutive messages by sender
  type MsgGroup = { senderId: string; msgs: Message[] };
  const groups: MsgGroup[] = [];
  for (const msg of messages) {
    const last = groups[groups.length - 1];
    if (last && last.senderId === msg.sender_id) last.msgs.push(msg);
    else groups.push({ senderId: msg.sender_id, msgs: [msg] });
  }

  return (
    <div className="flex flex-col h-full" onClick={() => setSelectedMsg(null)}>
      {/* Header - Pink bar */}
      <div className="bg-primary px-3 py-2.5 flex items-center gap-3 flex-shrink-0">
        {onBack && (
          <button onClick={onBack} className="p-1.5 rounded-full hover:bg-primary-foreground/10 text-primary-foreground lg:hidden">
            <ArrowLeft size={22} />
          </button>
        )}

        <button onClick={onOpenInfo} className="flex items-center gap-3 flex-1 min-w-0 text-left">
          {/* Avatar */}
          <div className="relative flex-shrink-0">
            <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold overflow-hidden bg-primary-foreground/20 text-primary-foreground"
              style={{ background: (chat.is_group ? chat.group_avatar_url : chatMember?.avatar_url) ? undefined : `hsl(${avatarHue(chatName)}, 60%, 55%)` }}>
              {(chat.is_group ? chat.group_avatar_url : chatMember?.avatar_url)
                ? <img src={(chat.is_group ? chat.group_avatar_url : chatMember?.avatar_url) || ''} alt="" className="w-full h-full object-cover" />
                : chatName[0]?.toUpperCase()}
            </div>
            {isOnline && <div className="absolute bottom-0 right-0 w-3 h-3 rounded-full status-online border-2 border-primary" />}
          </div>
          <div className="min-w-0">
            <h2 className="font-semibold text-sm text-primary-foreground truncate">{chatName}</h2>
            <p className="text-xs text-primary-foreground/70">
              {typingUsers.length > 0 ? 'typing...' : statusText}
            </p>
          </div>
        </button>

        <div className="flex items-center gap-0.5 flex-shrink-0">
          <button onClick={() => onStartCall?.(chat, 'video')}
            className="p-2 rounded-full hover:bg-primary-foreground/10 text-primary-foreground transition-colors">
            <Video size={20} />
          </button>
          <button onClick={() => onStartCall?.(chat, 'audio')}
            className="p-2 rounded-full hover:bg-primary-foreground/10 text-primary-foreground transition-colors">
            <Phone size={20} />
          </button>
          <button className="p-2 rounded-full hover:bg-primary-foreground/10 text-primary-foreground transition-colors">
            <MoreVertical size={20} />
          </button>
        </div>
      </div>

      {/* Messages - Chat wallpaper */}
      <div className="flex-1 overflow-y-auto px-3 py-2 chat-wallpaper">
        {loading && (
          <div className="space-y-3 py-4">
            {[1,2,3,4].map(i => (
              <div key={i} className={`flex ${i % 2 === 0 ? 'justify-end' : 'justify-start'}`}>
                <div className={`h-10 rounded-2xl bg-muted animate-pulse ${i % 2 === 0 ? 'w-40' : 'w-52'}`} />
              </div>
            ))}
          </div>
        )}

        {!loading && messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full py-16 text-center">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-3">
              <span className="text-2xl">👋</span>
            </div>
            <p className="text-sm font-medium text-foreground">Say hello!</p>
            <p className="text-xs text-muted-foreground mt-1">Start your conversation</p>
          </div>
        )}

        {groups.map((group, gi) => {
          const isSent = group.senderId === currentUser.user_id;
          return (
            <div key={gi} className="space-y-0.5">
              {group.msgs.map((msg, mi) => renderMessage(msg, isSent, mi === 0))}
            </div>
          );
        })}

        {typingUsers.length > 0 && (
          <div className="flex justify-start mt-1">
            <TypingDots names={typingUsers} />
          </div>
        )}

        <div ref={bottomRef} className="h-1" />
      </div>

      {/* Emoji Picker */}
      <AnimatePresence>
        {showEmoji && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }} className="px-3 pb-1 flex-shrink-0 bg-background">
            <div className="bg-card rounded-2xl p-3 flex flex-wrap gap-2 border border-border shadow-sm">
              {emojis.map(e => (
                <button key={e} onClick={() => { setInput(p => p + e); setShowEmoji(false); textareaRef.current?.focus(); }}
                  className="text-xl hover:scale-125 transition-transform p-0.5">{e}</button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Reply preview */}
      <AnimatePresence>
        {replyTo && (
          <motion.div initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 5 }}
            className="mx-3 mb-1 px-3 py-2 rounded-xl bg-card border border-border border-l-2 border-l-primary flex items-center gap-2 flex-shrink-0 shadow-sm">
            <Reply size={14} className="text-primary flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-[10px] text-primary font-medium">{replyTo.sender?.display_name || 'Message'}</p>
              <p className="text-xs text-muted-foreground truncate">{replyTo.content || '📎 Attachment'}</p>
            </div>
            <button onClick={() => setReplyTo(null)} className="text-muted-foreground hover:text-foreground flex-shrink-0">
              <X size={14} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Input - WhatsApp style */}
      <div className="px-2 py-2 bg-background flex items-end gap-2 flex-shrink-0">
        <div className="flex-1 flex items-end bg-card rounded-full border border-border px-2 py-1 shadow-sm">
          <button onClick={() => setShowEmoji(!showEmoji)}
            className={`p-2 rounded-full transition-colors flex-shrink-0 ${showEmoji ? 'text-primary' : 'text-muted-foreground'}`}>
            <Smile size={22} />
          </button>

          <textarea ref={textareaRef} value={input} onChange={handleInputChange} onKeyDown={handleKeyDown}
            placeholder="Type a message" rows={1}
            className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground resize-none focus:outline-none py-2 max-h-32"
            style={{ minHeight: '36px' }} />

          <button onClick={() => fileRef.current?.click()} disabled={uploading}
            className="p-2 rounded-full text-muted-foreground hover:text-foreground transition-colors flex-shrink-0">
            {uploading ? <div className="w-5 h-5 border-2 border-primary/30 border-t-primary rounded-full animate-spin" /> : <Paperclip size={22} />}
          </button>
        </div>

        <input ref={fileRef} type="file" className="hidden" onChange={handleFileSelect}
          accept="image/*,video/*,audio/*,application/pdf,.doc,.docx,.txt,.zip" />

        {input.trim() ? (
          <button onClick={handleSend}
            className="w-12 h-12 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-md flex-shrink-0">
            <Send size={20} />
          </button>
        ) : (
          <button className="w-12 h-12 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-md flex-shrink-0">
            <Mic size={20} />
          </button>
        )}
      </div>
    </div>
  );
};

export default ChatArea;
