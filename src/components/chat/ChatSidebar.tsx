import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Plus, Settings, MessageSquare, Users, Phone } from 'lucide-react';
import AvatarIcon from './AvatarIcon';
import type { Chat, User } from '@/lib/chat-data';

interface ChatSidebarProps {
  chats: Chat[];
  activeChatId: string | null;
  onSelectChat: (id: string) => void;
  currentUserId: string;
}

const tabs = [
  { id: 'chats', icon: MessageSquare, label: 'Chats' },
  { id: 'groups', icon: Users, label: 'Groups' },
  { id: 'calls', icon: Phone, label: 'Calls' },
];

const ChatSidebar = ({ chats, activeChatId, onSelectChat, currentUserId }: ChatSidebarProps) => {
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState('chats');

  const filteredChats = chats.filter(chat => {
    const matchesTab = activeTab === 'chats' ? !chat.isGroup : activeTab === 'groups' ? chat.isGroup : false;
    if (activeTab === 'calls') return false;
    const name = chat.isGroup ? chat.name : chat.participants[0]?.name;
    return matchesTab && (!search || name?.toLowerCase().includes(search.toLowerCase()));
  });

  const getChatName = (chat: Chat) => chat.isGroup ? chat.name : chat.participants[0]?.name;
  const getChatUser = (chat: Chat): User => chat.participants[0];

  const formatTime = (date: Date) => {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    if (diff < 60000) return 'now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m`;
    if (diff < 86400000) return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-4 pb-2">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-xl font-bold neon-text-cyan font-display">Nexus</h1>
          <div className="flex gap-1">
            <button className="p-2 rounded-lg hover:bg-muted/50 transition-colors text-muted-foreground hover:text-foreground">
              <Plus size={18} />
            </button>
            <button className="p-2 rounded-lg hover:bg-muted/50 transition-colors text-muted-foreground hover:text-foreground">
              <Settings size={18} />
            </button>
          </div>
        </div>

        {/* Search */}
        <div className="relative mb-3">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search conversations..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 rounded-lg bg-muted/40 border border-border/50 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20 transition-all"
          />
        </div>

        {/* Tabs */}
        <div className="flex gap-1 p-1 rounded-lg bg-muted/30">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-md text-xs font-medium transition-all ${
                activeTab === tab.id
                  ? 'bg-primary/15 text-primary neon-glow-cyan'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <tab.icon size={14} />
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Chat List */}
      <div className="flex-1 overflow-y-auto px-2 py-1">
        <AnimatePresence>
          {filteredChats.map((chat, i) => {
            const lastMsg = chat.messages[chat.messages.length - 1];
            const isActive = chat.id === activeChatId;
            return (
              <motion.button
                key={chat.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.03 }}
                onClick={() => onSelectChat(chat.id)}
                className={`w-full flex items-center gap-3 p-3 rounded-xl mb-1 text-left transition-all ${
                  isActive
                    ? 'glass-panel neon-glow-cyan'
                    : 'hover:bg-muted/30'
                }`}
              >
                {chat.isGroup ? (
                  <div className="relative w-10 h-10 flex-shrink-0">
                    <div className="absolute top-0 left-0"><AvatarIcon user={chat.participants[0]} index={0} size="sm" showStatus={false} /></div>
                    <div className="absolute bottom-0 right-0"><AvatarIcon user={chat.participants[1]} index={1} size="sm" showStatus={false} /></div>
                  </div>
                ) : (
                  <AvatarIcon user={getChatUser(chat)} index={i} />
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-sm truncate">{getChatName(chat)}</span>
                    {lastMsg && (
                      <span className="text-xs text-muted-foreground flex-shrink-0 ml-2">
                        {formatTime(lastMsg.timestamp)}
                      </span>
                    )}
                  </div>
                  {lastMsg && (
                    <p className="text-xs text-muted-foreground truncate mt-0.5">
                      {lastMsg.senderId === currentUserId ? 'You: ' : ''}
                      {lastMsg.content}
                    </p>
                  )}
                </div>
                {chat.unreadCount > 0 && (
                  <div className="flex-shrink-0 w-5 h-5 rounded-full bg-primary flex items-center justify-center">
                    <span className="text-[10px] font-bold text-primary-foreground">{chat.unreadCount}</span>
                  </div>
                )}
              </motion.button>
            );
          })}
        </AnimatePresence>

        {activeTab === 'calls' && (
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <Phone size={32} className="mb-3 opacity-40" />
            <p className="text-sm">No recent calls</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default ChatSidebar;
