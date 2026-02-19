import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Plus, Settings, MessageSquare, Users, Phone, Check, CheckCheck } from 'lucide-react';
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

  const getChatAvatar = (chat: ChatWithMeta, index: number) => {
    if (chat.is_group) {
      const name = chat.group_name || 'G';
      return { initials: name[0].toUpperCase(), hue: avatarHue(name), avatarUrl: chat.group_avatar_url };
    }
    const otherMember = chat.members.find(m => m.user_id !== currentUserId);
    return {
      initials: otherMember?.display_name?.[0]?.toUpperCase() || '?',
      hue: avatarHue(otherMember?.display_name || ''),
      avatarUrl: otherMember?.avatar_url,
    };
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

  const isOnline = (chat: ChatWithMeta) =>
    !chat.is_group && chat.members[0]?.is_online;

  const myInitials = profile?.display_name?.[0]?.toUpperCase() || '?';
  const myHue = avatarHue(profile?.display_name || '');

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-4 pb-3 border-b border-border/20">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2.5">
            {/* My avatar */}
            <button onClick={onOpenProfile} className="relative flex-shrink-0">
              <div
                className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold overflow-hidden"
                style={{ background: profile?.avatar_url ? undefined : `hsl(${myHue}, 70%, 45%)` }}
              >
                {profile?.avatar_url
                  ? <img src={profile.avatar_url} alt="" className="w-full h-full object-cover" />
                  : myInitials}
              </div>
              <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full status-online border border-background" />
            </button>
            <h1 className="text-lg font-bold neon-text-cyan font-display">Nexus</h1>
          </div>
          <div className="flex gap-1">
            <motion.button
              onClick={() => { setSearchOpen(!searchOpen); if (searchOpen) setSearch(''); }}
              whileTap={{ scale: 0.9 }}
              className="p-2 rounded-xl hover:bg-muted/50 transition-colors text-muted-foreground hover:text-foreground"
            >
              <Search size={18} />
            </motion.button>
            <motion.button
              onClick={onNewChat}
              whileTap={{ scale: 0.9 }}
              className="p-2 rounded-xl hover:bg-muted/50 transition-colors text-muted-foreground hover:text-primary"
            >
              <Plus size={18} />
            </motion.button>
          </div>
        </div>

        {/* Collapsible Search */}
        <AnimatePresence>
          {searchOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <input
                type="text"
                autoFocus
                placeholder="Search conversations..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl bg-muted/40 border border-border/50 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20 transition-all"
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Desktop tab bar */}
      <div className="hidden lg:flex gap-1 mx-3 my-2 p-1 rounded-xl bg-muted/20">
        {(['chats', 'groups', 'calls'] as const).map(tab => (
          <button
            key={tab}
            className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-medium transition-all capitalize ${
              activeTab === tab
                ? 'bg-primary/20 text-primary'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {tab === 'chats' && <MessageSquare size={13} />}
            {tab === 'groups' && <Users size={13} />}
            {tab === 'calls' && <Phone size={13} />}
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      {/* Chat List */}
      <div className="flex-1 overflow-y-auto px-2 py-1">
        {filteredChats.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
            <div className="w-14 h-14 rounded-2xl bg-muted/30 flex items-center justify-center mb-3">
              <MessageSquare size={24} className="text-muted-foreground/50" />
            </div>
            <p className="text-sm text-muted-foreground">
              {search ? 'No results found' : activeTab === 'calls' ? 'No recent calls' : 'No conversations yet'}
            </p>
            {!search && activeTab === 'chats' && (
              <button onClick={onNewChat} className="mt-3 text-xs text-primary hover:underline">
                Start your first chat →
              </button>
            )}
          </div>
        )}

        <AnimatePresence initial={false}>
          {filteredChats.map((chat, i) => {
            const isActive = chat.id === activeChatId;
            const { initials, hue, avatarUrl } = getChatAvatar(chat, i);
            const online = isOnline(chat);
            const lastMsg = chat.last_message;
            const isMyMsg = lastMsg?.sender_id === currentUserId;

            return (
              <motion.button
                key={chat.id}
                initial={{ opacity: 0, x: -15 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.025, duration: 0.2 }}
                onClick={() => onSelectChat(chat.id)}
                className={`w-full flex items-center gap-3 p-3 rounded-2xl mb-0.5 text-left transition-all ${
                  isActive
                    ? 'glass-panel neon-glow-cyan'
                    : 'hover:bg-muted/25 active:bg-muted/40'
                }`}
              >
                {/* Avatar */}
                <div className="relative flex-shrink-0">
                  {chat.is_group ? (
                    <div className="relative w-11 h-11">
                      {chat.members.slice(0, 2).map((m, mi) => (
                        <div key={m.id} className={`absolute w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold border-2 border-background overflow-hidden ${mi === 0 ? 'top-0 left-0' : 'bottom-0 right-0'}`}
                          style={{ background: m.avatar_url ? undefined : `hsl(${avatarHue(m.display_name)}, 70%, 45%)` }}>
                          {m.avatar_url ? <img src={m.avatar_url} alt="" className="w-full h-full object-cover" /> : m.display_name[0]?.toUpperCase()}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="w-11 h-11 rounded-full flex items-center justify-center text-sm font-bold overflow-hidden"
                      style={{ background: avatarUrl ? undefined : `hsl(${hue}, 70%, 45%)` }}>
                      {avatarUrl ? <img src={avatarUrl} alt="" className="w-full h-full object-cover" /> : initials}
                    </div>
                  )}
                  {online && (
                    <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full status-online border-2 border-background" />
                  )}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-1">
                    <span className="font-semibold text-sm truncate">{getChatName(chat)}</span>
                    {lastMsg && (
                      <span className="text-[11px] text-muted-foreground flex-shrink-0">
                        {formatTime(lastMsg.created_at)}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1 mt-0.5">
                    {isMyMsg && lastMsg && (
                      <CheckCheck size={13} className="text-primary flex-shrink-0" />
                    )}
                    <p className="text-xs text-muted-foreground truncate">
                      {lastMsg
                        ? lastMsg.type === 'text'
                          ? lastMsg.content || ''
                          : lastMsg.type === 'image' ? '📷 Photo'
                          : '📎 File'
                        : 'No messages yet'}
                    </p>
                  </div>
                </div>
              </motion.button>
            );
          })}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default ChatSidebar;
