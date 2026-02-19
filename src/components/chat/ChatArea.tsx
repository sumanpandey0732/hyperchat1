import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Phone, Video, MoreVertical, Send, Paperclip, Smile,
  Mic, Lock, ArrowLeft, Image as ImageIcon, X, CheckCheck,
  Check, Trash2, Reply, Download
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

const TypingDots = () => (
  <div className="flex items-end gap-1 px-4 py-3 rounded-2xl rounded-bl-md message-bubble-received max-w-fit">
    {[0,1,2].map(i => (
      <span key={i} className="typing-dot w-1.5 h-1.5 rounded-full bg-muted-foreground block" style={{ animationDelay: `${i * 0.2}s` }} />
    ))}
  </div>
);

const ChatArea = ({ chat, currentUser, onBack, onOpenInfo, onStartCall }: ChatAreaProps) => {
  const { messages, loading, sendMessage, deleteMessage, uploadFile } = useMessages(chat.id);
  const [input, setInput] = useState('');
  const [showEmoji, setShowEmoji] = useState(false);
  const [selectedMsg, setSelectedMsg] = useState<Message | null>(null);
  const [replyTo, setReplyTo] = useState<Message | null>(null);
  const [uploading, setUploading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  const handleSend = useCallback(async () => {
    const content = input.trim();
    if (!content) return;
    setInput('');
    setReplyTo(null);
    setShowEmoji(false);
    const ok = await sendMessage(content);
    if (!ok) {
      toast.error('Failed to send message. Check connection.');
      setInput(content); // Restore input if failed
    }
  }, [input, sendMessage]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) { toast.error('File must be under 10MB'); return; }
    setUploading(true);
    const result = await uploadFile(file);
    if (result) {
      const type = file.type.startsWith('image/') ? 'image' : 'file';
      await sendMessage(file.name, type, { file_url: result.url, file_name: result.name, file_type: result.type });
    } else {
      toast.error('Upload failed');
    }
    setUploading(false);
    if (fileRef.current) fileRef.current.value = '';
  };

  const chatName = chat.is_group ? chat.group_name || 'Group' : chat.members[0]?.display_name || 'Unknown';
  const chatMember = chat.is_group ? null : chat.members[0];
  const isOnline = !chat.is_group && chatMember?.is_online;
  const memberCount = chat.members.length + 1;

  const statusText = chat.is_group
    ? `${memberCount} members`
    : isOnline ? 'Online' : chatMember?.last_seen
      ? `Last seen ${new Date(chatMember.last_seen).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
      : 'Offline';

  const formatMsgTime = (d: string) => new Date(d).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  const renderMessage = (msg: Message, isSent: boolean, showAvatar: boolean, isLast: boolean) => {
    const hue = avatarHue(msg.sender?.display_name || '');

    return (
      <motion.div
        key={msg.id}
        initial={{ opacity: 0, scale: 0.92, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 380, damping: 28 }}
        className={`flex mb-0.5 ${isSent ? 'justify-end' : 'justify-start'}`}
        onClick={() => setSelectedMsg(selectedMsg?.id === msg.id ? null : msg)}
      >
        {/* Received avatar */}
        {!isSent && chat.is_group && (
          <div className="w-8 flex-shrink-0 mr-2 mt-auto">
            {showAvatar && (
              <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold overflow-hidden"
                style={{ background: msg.sender?.avatar_url ? undefined : `hsl(${hue}, 70%, 45%)` }}>
                {msg.sender?.avatar_url
                  ? <img src={msg.sender.avatar_url} alt="" className="w-full h-full object-cover" />
                  : msg.sender?.display_name?.[0]?.toUpperCase()}
              </div>
            )}
          </div>
        )}

        <div className={`max-w-[72%] lg:max-w-[60%] flex flex-col ${isSent ? 'items-end' : 'items-start'}`}>
          {!isSent && chat.is_group && showAvatar && (
            <span className="text-[10px] font-semibold px-1 mb-0.5"
              style={{ color: `hsl(${hue}, 70%, 60%)` }}>
              {msg.sender?.display_name}
            </span>
          )}

          <div className={`relative px-3.5 py-2.5 rounded-2xl ${isSent
            ? 'message-bubble-sent rounded-br-sm'
            : 'message-bubble-received rounded-bl-sm'
          }`}>
            {/* Reply preview */}
            {msg.reply_to && (
              <div className="mb-1.5 px-2 py-1 rounded-lg border-l-2 border-primary bg-muted/30 text-xs text-muted-foreground">
                Replied to message
              </div>
            )}

            {/* Image */}
            {msg.type === 'image' && msg.file_url && (
              <div className="mb-1.5 -mx-1">
                <img
                  src={msg.file_url}
                  alt={msg.file_name || 'Image'}
                  className="rounded-xl max-w-full max-h-56 object-cover cursor-pointer"
                  loading="lazy"
                />
              </div>
            )}

            {/* File */}
            {msg.type === 'file' && msg.file_url && (
              <a href={msg.file_url} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-2 mb-1.5 px-2 py-1.5 rounded-lg bg-muted/40 hover:bg-muted/60 transition-colors">
                <Paperclip size={14} className="text-primary flex-shrink-0" />
                <span className="text-xs truncate">{msg.file_name}</span>
                <Download size={12} className="flex-shrink-0 text-muted-foreground" />
              </a>
            )}

            {/* Text */}
            {msg.content && (
              <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">{msg.content}</p>
            )}

            {/* Time + read */}
            <div className={`flex items-center gap-1 mt-0.5 ${isSent ? 'justify-end' : 'justify-start'}`}>
              <span className="text-[10px] text-muted-foreground/60">
                {formatMsgTime(msg.created_at)}
              </span>
              {isSent && (
                <CheckCheck size={12} className="text-primary" />
              )}
            </div>
          </div>

          {/* Actions on tap */}
          <AnimatePresence>
            {selectedMsg?.id === msg.id && (
              <motion.div
                initial={{ opacity: 0, scale: 0.8, y: -5 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.8, y: -5 }}
                className={`flex gap-1 mt-1 ${isSent ? 'flex-row-reverse' : 'flex-row'}`}
              >
                <button onClick={() => { setReplyTo(msg); setSelectedMsg(null); }}
                  className="p-1.5 rounded-lg glass-panel text-muted-foreground hover:text-foreground text-xs flex items-center gap-1">
                  <Reply size={13} /> Reply
                </button>
                {isSent && (
                  <button onClick={() => deleteMessage(msg.id)}
                    className="p-1.5 rounded-lg glass-panel text-destructive hover:text-destructive text-xs flex items-center gap-1">
                    <Trash2 size={13} /> Delete
                  </button>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    );
  };

  // Group messages by sender
  type MsgGroup = { senderId: string; msgs: Message[] };
  const groups: MsgGroup[] = [];
  for (const msg of messages) {
    const last = groups[groups.length - 1];
    if (last && last.senderId === msg.sender_id) last.msgs.push(msg);
    else groups.push({ senderId: msg.sender_id, msgs: [msg] });
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="glass-panel-strong px-3 py-3 flex items-center gap-3 border-b border-border/25 flex-shrink-0">
        {onBack && (
          <button onClick={onBack} className="p-1.5 rounded-xl hover:bg-muted/50 text-muted-foreground lg:hidden">
            <ArrowLeft size={20} />
          </button>
        )}

        <button onClick={onOpenInfo} className="flex items-center gap-3 flex-1 min-w-0 text-left hover:opacity-80 transition-opacity">
          {chat.is_group ? (
            <div className="relative w-10 h-10 flex-shrink-0">
              {chat.members.slice(0, 2).map((m, i) => (
                <div key={m.id}
                  className={`absolute w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold border-2 border-background overflow-hidden ${i === 0 ? 'top-0 left-0 z-10' : 'bottom-0 right-0'}`}
                  style={{ background: m.avatar_url ? undefined : `hsl(${avatarHue(m.display_name)}, 70%, 45%)` }}>
                  {m.avatar_url ? <img src={m.avatar_url} alt="" className="w-full h-full object-cover" /> : m.display_name[0]?.toUpperCase()}
                </div>
              ))}
            </div>
          ) : (
            <div className="relative flex-shrink-0">
              <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold overflow-hidden"
                style={{ background: chatMember?.avatar_url ? undefined : `hsl(${avatarHue(chatMember?.display_name || '')}, 70%, 45%)` }}>
                {chatMember?.avatar_url
                  ? <img src={chatMember.avatar_url} alt="" className="w-full h-full object-cover" />
                  : chatMember?.display_name?.[0]?.toUpperCase()}
              </div>
              {isOnline && (
                <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full status-online border-2 border-background" />
              )}
            </div>
          )}
          <div className="min-w-0">
            <h2 className="font-semibold text-sm truncate">{chatName}</h2>
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              {isOnline && <span className="w-1.5 h-1.5 rounded-full status-online inline-block" />}
              {statusText}
            </p>
          </div>
        </button>

        <div className="flex items-center gap-0.5 flex-shrink-0">
          <button
            onClick={() => onStartCall?.(chat, 'audio')}
            className="p-2 rounded-xl hover:bg-muted/50 text-muted-foreground hover:text-primary transition-colors"
            title="Voice call"
          >
            <Phone size={18} />
          </button>
          <button
            onClick={() => onStartCall?.(chat, 'video')}
            className="p-2 rounded-xl hover:bg-muted/50 text-muted-foreground hover:text-primary transition-colors"
            title="Video call"
          >
            <Video size={18} />
          </button>
          <button className="p-2 rounded-xl hover:bg-muted/50 text-muted-foreground hover:text-foreground transition-colors">
            <MoreVertical size={18} />
          </button>
        </div>
      </div>

      {/* E2EE Banner */}
      <div className="flex items-center justify-center gap-1.5 py-1.5 text-[11px] text-muted-foreground/50 flex-shrink-0">
        <Lock size={10} />
        <span>Messages are end-to-end encrypted</span>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-3 py-2" onClick={() => setSelectedMsg(null)}>
        {loading && (
          <div className="flex items-center justify-center py-8">
            <div className="w-6 h-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
          </div>
        )}

        {groups.map((group, gi) => {
          const isSent = group.senderId === currentUser.user_id;
          return (
            <div key={gi} className="mb-2">
              {group.msgs.map((msg, mi) =>
                renderMessage(msg, isSent, mi === 0, mi === group.msgs.length - 1)
              )}
            </div>
          );
        })}

        <div ref={bottomRef} className="h-2" />
      </div>

      {/* Emoji Picker */}
      <AnimatePresence>
        {showEmoji && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            className="px-3 pb-1 flex-shrink-0"
          >
            <div className="glass-panel rounded-2xl p-3 flex flex-wrap gap-2">
              {emojis.map(e => (
                <button key={e}
                  onClick={() => { setInput(p => p + e); setShowEmoji(false); textareaRef.current?.focus(); }}
                  className="text-xl hover:scale-125 transition-transform p-0.5"
                >{e}</button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Reply preview */}
      <AnimatePresence>
        {replyTo && (
          <motion.div
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 5 }}
            className="mx-3 mb-1 px-3 py-2 rounded-xl glass-panel border-l-2 border-primary flex items-center gap-2 flex-shrink-0"
          >
            <Reply size={14} className="text-primary flex-shrink-0" />
            <p className="text-xs text-muted-foreground truncate flex-1">{replyTo.content}</p>
            <button onClick={() => setReplyTo(null)} className="text-muted-foreground hover:text-foreground">
              <X size={14} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Input Area */}
      <div className="p-3 pt-1 flex-shrink-0">
        <div className="chat-input-area rounded-2xl flex items-end gap-1 px-2 py-2">
          <button
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="p-2 rounded-xl hover:bg-muted/50 text-muted-foreground hover:text-foreground transition-colors flex-shrink-0"
          >
            {uploading
              ? <div className="w-4 h-4 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
              : <Paperclip size={18} />}
          </button>
          <button
            onClick={() => setShowEmoji(!showEmoji)}
            className={`p-2 rounded-xl hover:bg-muted/50 transition-colors flex-shrink-0 ${showEmoji ? 'text-primary' : 'text-muted-foreground hover:text-foreground'}`}
          >
            <Smile size={18} />
          </button>

          <textarea
            ref={textareaRef}
            value={input}
            onChange={e => {
              setInput(e.target.value);
              e.target.style.height = 'auto';
              e.target.style.height = Math.min(e.target.scrollHeight, 128) + 'px';
            }}
            onKeyDown={handleKeyDown}
            placeholder="Type a message..."
            rows={1}
            className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground resize-none focus:outline-none py-2 max-h-32"
            style={{ minHeight: '36px' }}
          />

          <input ref={fileRef} type="file" className="hidden" onChange={handleFileSelect}
            accept="image/*,application/pdf,.doc,.docx,.txt" />

          <AnimatePresence mode="wait">
            {input.trim() ? (
              <motion.button
                key="send"
                initial={{ scale: 0, rotate: -90 }}
                animate={{ scale: 1, rotate: 0 }}
                exit={{ scale: 0, rotate: 90 }}
                transition={{ type: 'spring', stiffness: 400, damping: 20 }}
                onClick={handleSend}
                className="p-2.5 rounded-xl bg-primary text-primary-foreground hover:opacity-90 transition-opacity flex-shrink-0 neon-glow-cyan"
              >
                <Send size={17} />
              </motion.button>
            ) : (
              <motion.button
                key="mic"
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                exit={{ scale: 0 }}
                className="p-2 rounded-xl hover:bg-muted/50 text-muted-foreground hover:text-primary transition-colors flex-shrink-0"
              >
                <Mic size={18} />
              </motion.button>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
};

export default ChatArea;
