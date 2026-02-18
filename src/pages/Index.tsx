import { useState, useCallback } from 'react';
import { Navigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { useAuth } from '@/contexts/AuthContext';
import { useChats } from '@/hooks/useChats';
import AnimatedBackground from '@/components/chat/AnimatedBackground';
import ChatSidebar from '@/components/chat/ChatSidebar';
import ChatArea from '@/components/chat/ChatArea';
import EmptyState from '@/components/chat/EmptyState';
import BottomNav from '@/components/chat/BottomNav';
import NewChatModal from '@/components/chat/NewChatModal';
import ProfileSheet from '@/components/chat/ProfileSheet';
import InfoPanel from '@/components/chat/InfoPanel';
import type { ChatWithMeta } from '@/hooks/useChats';

type Tab = 'chats' | 'groups' | 'calls' | 'profile';

const Index = () => {
  const { user, profile, loading } = useAuth();
  const { chats, createDirectChat, createGroupChat } = useChats();
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [showInfo, setShowInfo] = useState(false);
  const [showNewChat, setShowNewChat] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>('chats');

  const activeChat = chats.find(c => c.id === activeChatId) || null;

  const handleSelectChat = useCallback((id: string) => {
    setActiveChatId(id);
    setShowInfo(false);
  }, []);

  const handleTabChange = (tab: Tab) => {
    setActiveTab(tab);
    if (tab === 'profile') {
      setShowProfile(true);
      setActiveTab('chats');
    }
  };

  const handleChatCreated = (chatId: string) => {
    setActiveChatId(chatId);
    setShowNewChat(false);
  };

  if (loading) {
    return (
      <div className="h-screen w-screen flex items-center justify-center gradient-mesh">
        <AnimatedBackground />
        <div className="relative z-10 flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
          <p className="text-sm text-muted-foreground">Loading Nexus...</p>
        </div>
      </div>
    );
  }

  if (!user || !profile) {
    return <Navigate to="/auth" replace />;
  }

  const totalUnread = chats.length;

  return (
    <div className="h-screen w-screen overflow-hidden gradient-mesh relative">
      <AnimatedBackground />

      <div className="relative z-10 h-full flex">
        {/* Sidebar */}
        <div
          className={`glass-panel-strong border-r border-border/25 w-full lg:w-80 xl:w-96 flex-shrink-0 ${
            activeChatId ? 'hidden lg:flex' : 'flex'
          } flex-col pb-16 lg:pb-0`}
        >
          <ChatSidebar
            chats={chats}
            activeChatId={activeChatId}
            onSelectChat={handleSelectChat}
            currentUserId={user.id}
            onNewChat={() => setShowNewChat(true)}
            onOpenProfile={() => setShowProfile(true)}
            profile={profile}
            activeTab={activeTab}
          />
        </div>

        {/* Chat Area */}
        <div className={`flex-1 min-w-0 ${!activeChatId ? 'hidden lg:flex' : 'flex'} flex-col pb-16 lg:pb-0`}>
          {activeChat ? (
            <ChatArea
              chat={activeChat}
              currentUser={profile}
              onBack={() => setActiveChatId(null)}
              onOpenInfo={() => setShowInfo(true)}
            />
          ) : (
            <EmptyState onNewChat={() => setShowNewChat(true)} />
          )}
        </div>

        {/* Info Panel */}
        <AnimatePresence>
          {activeChat && showInfo && (
            <motion.div
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 300, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              transition={{ type: 'spring', damping: 25 }}
              className="glass-panel-strong border-l border-border/25 overflow-hidden hidden xl:block flex-shrink-0"
            >
              <InfoPanel chat={activeChat} onClose={() => setShowInfo(false)} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Mobile Bottom Nav */}
      <BottomNav
        activeTab={activeTab}
        onTabChange={handleTabChange}
        unreadCount={totalUnread}
      />

      {/* Modals */}
      {showNewChat && (
        <NewChatModal
          onClose={() => setShowNewChat(false)}
          onChatCreated={handleChatCreated}
          createDirectChat={createDirectChat}
          createGroupChat={createGroupChat}
        />
      )}

      {showProfile && (
        <ProfileSheet onClose={() => setShowProfile(false)} />
      )}
    </div>
  );
};

export default Index;
