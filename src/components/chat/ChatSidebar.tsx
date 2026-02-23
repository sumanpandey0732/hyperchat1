import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Search, Plus, MessageSquare, Users, Phone, Check, CheckCheck } from 'lucide-react';
import type { ChatWithMeta } from '@/hooks/useChats';
import type { Profile } from '@/contexts/AuthContext';

interface ChatSidebarProps {
  chats: ChatWithMeta[];
  activeChatId: string | null;
  onSelectChat: (id: string) => void;
  currentUserId: string;
  onNewChat: () => void;
  onOpenProfile: () => void;
  profile: Profile | null;
  activeTab: 'chats' | 'groups' | 'calls' | 'profile';
}

const avatarHue = (name: string) => (name.charCodeAt(0) * 13) % 360;

const ChatSidebar = ({
  chats, activeChatId, onSelectChat, currentUserId,
  onNewChat, onOpenProfile, profile, activeTab
}: ChatSidebarProps) => {
  const [searchOpen, setSearchOpen] = useState(false);
  const [search, setSearch] = useState('');

  const filteredChats = chats.filter(chat => {
    const isGroup = chat.is_group;
    if (activeTab === 'calls') return false;
    if (activeTab === 'groups' && !isGroup) return false;
    if (activeTab === 'chats' && isGroup) return false;
    if (!search) return true;
    const name = isGroup ? chat.group_name : chat.members[0]?.display_name;
    return name?.toLowerCase().includes(search.toLowerCase());
  });

  const getChatName = (chat: ChatWithMeta) => {
    if (chat.is_group) return chat.group_name || 'Group';
    const otherMember = chat.members.find(m => m.user_id !== currentUserId);
    return otherMember?.display_name || 'Unknown';
  };

  const formatTime = (dateStr: string) => {
    const d = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    if (diff < 60000) return 'now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m`;
    if (diff < 86400000) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  const isOnline = (chat: ChatWithMeta) => !chat.is_group && chat.members[0]?.is_online;

  return (
    <div className="flex flex-col h-full">
      {/* Header - Pink bar like WhatsApp */}
      <div className="bg-primary px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={onOpenProfile} className="relative flex-shrink-0">
              <div className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold overflow-hidden bg-primary-foreground/20 text-primary-foreground">
                {profile?.avatar_url
                  ? <img src={profile.avatar_url} alt="" className="w-full h-full object-cover" />
                  : profile?.display_name?.[0]?.toUpperCase() || '?'}
              </div>
            </button>
            <h1 className="text-lg font-bold text-primary-foreground">HyperChat</h1>
          </div>
          <div className="flex gap-1">
            <button onClick={() => { setSearchOpen(!searchOpen); if (searchOpen) setSearch(''); }}
              className="p-2 rounded-full hover:bg-primary-foreground/10 text-primary-foreground transition-colors">
              <Search size={20} />
            </button>
            <button onClick={onNewChat}
              className="p-2 rounded-full hover:bg-primary-foreground/10 text-primary-foreground transition-colors">
              <Plus size={20} />
            </button>
          </div>
        </div>

        {/* Search bar */}
        <AnimatePresence>
          {searchOpen && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }} className="overflow-hidden mt-2">
              <input type="text" autoFocus placeholder="Search..."
                value={search} onChange={e => setSearch(e.target.value)}
                className="w-full px-4 py-2.5 rounded-full bg-primary-foreground text-foreground text-sm placeholder:text-muted-foreground focus:outline-none"
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Tab bar */}
      <div className="flex border-b border-border bg-card">
        {(['chats', 'groups', 'calls'] as const).map(tab => (
          <button key={tab}
            className={`flex-1 flex items-center justify-center gap-1.5 py-3 text-sm font-medium transition-all border-b-2 ${
              activeTab === tab
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground'
            }`}
          >
            {tab === 'chats' && <MessageSquare size={16} />}
            {tab === 'groups' && <Users size={16} />}
            {tab === 'calls' && <Phone size={16} />}
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      {/* Chat List */}
      <div className="flex-1 overflow-y-auto">
        {filteredChats.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
            <MessageSquare size={40} className="text-muted-foreground/30 mb-3" />
            <p className="text-sm text-muted-foreground">
              {search ? 'No results found' : activeTab === 'calls' ? 'No recent calls' : 'No conversations yet'}
            </p>
            {!search && activeTab === 'chats' && (
              <button onClick={onNewChat} className="mt-3 text-sm text-primary font-medium">
                Start your first chat →
              </button>
            )}
          </div>
        )}

        {filteredChats.map((chat) => {
          const isActive = chat.id === activeChatId;
          const online = isOnline(chat);
          const lastMsg = chat.last_message;
          const isMyMsg = lastMsg?.sender_id === currentUserId;
          const otherMember = chat.members[0];
          const chatName = getChatName(chat);
          const avatarUrl = chat.is_group ? chat.group_avatar_url : otherMember?.avatar_url;
          const hue = avatarHue(chatName);

          return (
            <button key={chat.id} onClick={() => onSelectChat(chat.id)}
              className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors border-b border-border/50 ${
                isActive ? 'bg-accent' : 'hover:bg-muted/50 active:bg-muted'
              }`}
            >
              {/* Avatar */}
              <div className="relative flex-shrink-0">
                <div className="w-12 h-12 rounded-full flex items-center justify-center text-sm font-bold overflow-hidden text-primary-foreground"
                  style={{ background: avatarUrl ? undefined : `hsl(${hue}, 60%, 55%)` }}>
                  {avatarUrl ? <img src={avatarUrl} alt="" className="w-full h-full object-cover" /> : chatName[0]?.toUpperCase()}
                </div>
                {online && <div className="absolute bottom-0 right-0 w-3 h-3 rounded-full status-online border-2 border-card" />}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold text-sm truncate text-foreground">{chatName}</span>
                  {lastMsg && (
                    <span className={`text-xs flex-shrink-0 ${chat.unread_count > 0 ? 'text-primary font-semibold' : 'text-muted-foreground'}`}>
                      {formatTime(lastMsg.created_at)}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1 mt-0.5">
                  {isMyMsg && lastMsg && (
                    lastMsg.type === 'text' && (lastMsg as any).status === 'read'
                      ? <CheckCheck size={14} className="text-primary flex-shrink-0" />
                      : <Check size={14} className="text-muted-foreground flex-shrink-0" />
                  )}
                  <p className="text-xs text-muted-foreground truncate flex-1">
                    {lastMsg
                      ? lastMsg.type === 'text' ? lastMsg.content || '' : lastMsg.type === 'image' ? '📷 Photo' : '📎 File'
                      : 'No messages yet'}
                  </p>
                  {chat.unread_count > 0 && (
                    <span className="w-5 h-5 rounded-full bg-primary text-primary-foreground text-[10px] font-bold flex items-center justify-center flex-shrink-0">
                      {chat.unread_count > 9 ? '9+' : chat.unread_count}
                    </span>
                  )}
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default ChatSidebar;
