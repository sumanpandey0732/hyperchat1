import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Phone, Video, MoreVertical, Send, Paperclip, Smile, Mic, Lock, ArrowLeft } from 'lucide-react';
import AvatarIcon from './AvatarIcon';
import type { Chat, Message } from '@/lib/chat-data';

interface ChatAreaProps {
  chat: Chat;
  currentUserId: string;
  onSendMessage: (chatId: string, content: string) => void;
  onBack?: () => void;
}

const ChatArea = ({ chat, currentUserId, onSendMessage, onBack }: ChatAreaProps) => {
  const [input, setInput] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);
  const [showEmoji, setShowEmoji] = useState(false);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chat.messages.length]);

  const handleSend = () => {
    if (!input.trim()) return;
    onSendMessage(chat.id, input.trim());
    setInput('');
  };

  const chatName = chat.isGroup ? chat.name : chat.participants[0]?.name;
  const chatStatus = chat.isGroup
    ? `${chat.participants.length + 1} members`
    : chat.participants[0]?.status === 'online'
    ? 'Online'
    : chat.participants[0]?.lastSeen || 'Offline';

  const formatMsgTime = (d: Date) => d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  const groupMessages = (msgs: Message[]) => {
    const groups: { senderId: string; messages: Message[] }[] = [];
    msgs.forEach(msg => {
      const last = groups[groups.length - 1];
      if (last && last.senderId === msg.senderId) last.messages.push(msg);
      else groups.push({ senderId: msg.senderId, messages: [msg] });
    });
    return groups;
  };

  const emojis = ['😀', '😂', '❤️', '🔥', '👍', '🎉', '✨', '🚀', '💡', '🎧', '🎮', '💎'];

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="glass-panel-strong px-4 py-3 flex items-center gap-3 border-b border-border/30">
        {onBack && (
          <button onClick={onBack} className="p-1 mr-1 rounded-lg hover:bg-muted/50 text-muted-foreground lg:hidden">
            <ArrowLeft size={20} />
          </button>
        )}
        {chat.isGroup ? (
          <div className="relative w-10 h-10 flex-shrink-0">
            <div className="absolute top-0 left-0"><AvatarIcon user={chat.participants[0]} index={0} size="sm" showStatus={false} /></div>
            <div className="absolute bottom-0 right-0"><AvatarIcon user={chat.participants[1]} index={1} size="sm" showStatus={false} /></div>
          </div>
        ) : (
          <AvatarIcon user={chat.participants[0]} index={0} />
        )}
        <div className="flex-1 min-w-0">
          <h2 className="font-semibold text-sm truncate">{chatName}</h2>
          <p className="text-xs text-muted-foreground flex items-center gap-1">
            {!chat.isGroup && chat.participants[0]?.status === 'online' && (
              <span className="w-1.5 h-1.5 rounded-full status-online inline-block" />
            )}
            {chatStatus}
          </p>
        </div>
        <div className="flex items-center gap-1">
          <button className="p-2 rounded-lg hover:bg-muted/50 text-muted-foreground hover:text-primary transition-colors">
            <Phone size={18} />
          </button>
          <button className="p-2 rounded-lg hover:bg-muted/50 text-muted-foreground hover:text-primary transition-colors">
            <Video size={18} />
          </button>
          <button className="p-2 rounded-lg hover:bg-muted/50 text-muted-foreground hover:text-foreground transition-colors">
            <MoreVertical size={18} />
          </button>
        </div>
      </div>

      {/* E2EE Banner */}
      <div className="flex items-center justify-center gap-1.5 py-2 text-xs text-muted-foreground/60">
        <Lock size={10} />
        <span>End-to-end encrypted</span>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-2">
        <AnimatePresence initial={false}>
          {groupMessages(chat.messages).map((group, gi) => {
            const isSent = group.senderId === currentUserId;
            const sender = chat.participants.find(p => p.id === group.senderId);
            return (
              <div key={gi} className={`flex mb-4 ${isSent ? 'justify-end' : 'justify-start'}`}>
                {!isSent && chat.isGroup && sender && (
                  <div className="mr-2 mt-auto">
                    <AvatarIcon user={sender} index={parseInt(sender.id)} size="sm" showStatus={false} />
                  </div>
                )}
                <div className={`max-w-[75%] ${isSent ? 'items-end' : 'items-start'} flex flex-col gap-0.5`}>
                  {!isSent && chat.isGroup && sender && (
                    <span className="text-[10px] text-neon-purple font-medium px-1 mb-0.5">{sender.name}</span>
                  )}
                  {group.messages.map((msg, mi) => (
                    <motion.div
                      key={msg.id}
                      initial={{ opacity: 0, scale: 0.9, y: 10 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      transition={{ type: 'spring', stiffness: 400, damping: 25, delay: mi * 0.02 }}
                      className={`px-3.5 py-2 rounded-2xl text-sm leading-relaxed ${
                        isSent
                          ? 'message-bubble-sent rounded-br-md'
                          : 'message-bubble-received rounded-bl-md'
                      } ${mi > 0 ? (isSent ? 'rounded-tr-md' : 'rounded-tl-md') : ''}`}
                    >
                      <p className="text-foreground/90">{msg.content}</p>
                      <span className="text-[10px] text-muted-foreground/50 float-right mt-1 ml-3">
                        {formatMsgTime(msg.timestamp)}
                      </span>
                    </motion.div>
                  ))}
                </div>
              </div>
            );
          })}
        </AnimatePresence>
        <div ref={bottomRef} />
      </div>

      {/* Emoji Picker */}
      <AnimatePresence>
        {showEmoji && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="px-4 pb-2"
          >
            <div className="glass-panel rounded-xl p-3 flex flex-wrap gap-2">
              {emojis.map(e => (
                <button
                  key={e}
                  onClick={() => { setInput(prev => prev + e); setShowEmoji(false); }}
                  className="text-xl hover:scale-125 transition-transform p-1"
                >
                  {e}
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Input */}
      <div className="p-3">
        <div className="chat-input-area rounded-2xl flex items-end gap-2 p-2">
          <button className="p-2 rounded-lg hover:bg-muted/50 text-muted-foreground hover:text-foreground transition-colors flex-shrink-0">
            <Paperclip size={18} />
          </button>
          <button
            onClick={() => setShowEmoji(!showEmoji)}
            className="p-2 rounded-lg hover:bg-muted/50 text-muted-foreground hover:text-foreground transition-colors flex-shrink-0"
          >
            <Smile size={18} />
          </button>
          <textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
            placeholder="Type a message..."
            rows={1}
            className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground resize-none focus:outline-none py-2 max-h-32"
            style={{ minHeight: '36px' }}
          />
          {input.trim() ? (
            <motion.button
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              onClick={handleSend}
              className="p-2 rounded-xl bg-primary text-primary-foreground hover:opacity-90 transition-opacity flex-shrink-0"
            >
              <Send size={18} />
            </motion.button>
          ) : (
            <button className="p-2 rounded-lg hover:bg-muted/50 text-muted-foreground hover:text-primary transition-colors flex-shrink-0">
              <Mic size={18} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default ChatArea;
