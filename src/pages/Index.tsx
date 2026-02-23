import { useState, useCallback, useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { MessageSquarePlus } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useChats } from '@/hooks/useChats';
import { supabase } from '@/integrations/supabase/client';
import { showLocalNotification } from '@/lib/notifications';
import ChatSidebar from '@/components/chat/ChatSidebar';
import ChatArea from '@/components/chat/ChatArea';
import EmptyState from '@/components/chat/EmptyState';
import BottomNav from '@/components/chat/BottomNav';
import NewChatModal from '@/components/chat/NewChatModal';
import ProfileSheet from '@/components/chat/ProfileSheet';
import InfoPanel from '@/components/chat/InfoPanel';
import CallScreen from '@/components/call/CallScreen';
import IncomingCallBanner from '@/components/call/IncomingCallBanner';
import type { ChatWithMeta } from '@/hooks/useChats';

type Tab = 'chats' | 'groups' | 'calls' | 'profile';

type IncomingCall = {
  callId: string;
  callType: 'audio' | 'video';
  callerId: string;
  callerName: string;
  callerAvatar: string | null;
  chat: ChatWithMeta;
};

type ActiveCall = {
  chat: ChatWithMeta;
  callType: 'audio' | 'video';
  callId?: string;
  isIncoming: boolean;
};

const Index = () => {
  const { user, profile, loading } = useAuth();
  const { chats, createDirectChat, createGroupChat } = useChats();
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [showInfo, setShowInfo] = useState(false);
  const [showNewChat, setShowNewChat] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>('chats');
  const [activeCall, setActiveCall] = useState<ActiveCall | null>(null);
  const [incomingCall, setIncomingCall] = useState<IncomingCall | null>(null);

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

  const startCall = (chat: ChatWithMeta, callType: 'audio' | 'video') => {
    setActiveCall({ chat, callType, isIncoming: false });
  };

  // Listen for incoming calls
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel(`incoming-calls-${user.id}`)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'calls',
        filter: `callee_id=eq.${user.id}`,
      }, async (payload) => {
        const callRow = payload.new as any;
        if (callRow.status !== 'ringing') return;
        const { data: callerProfile } = await supabase.from('profiles').select('*').eq('user_id', callRow.caller_id).single();
        const chat = chats.find(c => c.id === callRow.chat_id);
        if (!chat) return;
        const incoming: IncomingCall = {
          callId: callRow.id, callType: callRow.call_type,
          callerId: callRow.caller_id,
          callerName: callerProfile?.display_name || 'Unknown',
          callerAvatar: callerProfile?.avatar_url || null, chat,
        };
        setIncomingCall(incoming);
        if (document.hidden) {
          showLocalNotification(`Incoming ${callRow.call_type} call`, `${incoming.callerName} is calling you`, callRow.id);
        }
        setTimeout(() => { setIncomingCall(prev => prev?.callId === callRow.id ? null : prev); }, 30000);
      }).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user, chats]);

  if (loading) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-3 border-primary/30 border-t-primary rounded-full animate-spin" />
          <p className="text-sm text-muted-foreground">Loading HyperChat...</p>
        </div>
      </div>
    );
  }

  if (!user || !profile) {
    return <Navigate to="/auth" replace />;
  }

  const totalUnread = chats.filter(c => c.unread_count > 0).length;

  return (
    <div className="h-screen w-screen overflow-hidden bg-background relative">
      <div className="h-full flex">
        {/* Sidebar */}
        <div className={`bg-card border-r border-border w-full lg:w-80 xl:w-96 flex-shrink-0 ${
          activeChatId ? 'hidden lg:flex' : 'flex'
        } flex-col pb-16 lg:pb-0`}>
          <ChatSidebar
            chats={chats} activeChatId={activeChatId}
            onSelectChat={handleSelectChat} currentUserId={user.id}
            onNewChat={() => setShowNewChat(true)}
            onOpenProfile={() => setShowProfile(true)}
            profile={profile} activeTab={activeTab}
          />
        </div>

        {/* Chat Area */}
        <div className={`flex-1 min-w-0 ${!activeChatId ? 'hidden lg:flex' : 'flex'} flex-col pb-16 lg:pb-0`}>
          {activeChat ? (
            <ChatArea chat={activeChat} currentUser={profile}
              onBack={() => { setActiveChatId(null); setShowInfo(false); }}
              onOpenInfo={() => setShowInfo(true)} onStartCall={startCall}
            />
          ) : (
            <EmptyState onNewChat={() => setShowNewChat(true)} />
          )}
        </div>

        {/* Info Panel */}
        <AnimatePresence>
          {activeChat && showInfo && (
            <motion.div
              initial={{ width: 0, opacity: 0 }} animate={{ width: 300, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }} transition={{ type: 'spring', damping: 25 }}
              className="bg-card border-l border-border overflow-hidden hidden xl:block flex-shrink-0"
            >
              <InfoPanel chat={activeChat} onClose={() => setShowInfo(false)} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Mobile Bottom Nav */}
      <BottomNav activeTab={activeTab} onTabChange={handleTabChange} unreadCount={totalUnread} />

      {/* FAB */}
      <AnimatePresence>
        {!activeChatId && (
          <motion.button
            initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}
            whileTap={{ scale: 0.9 }}
            onClick={() => setShowNewChat(true)}
            className="fixed bottom-20 right-4 z-40 lg:hidden w-14 h-14 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-lg"
          >
            <MessageSquarePlus size={24} />
          </motion.button>
        )}
      </AnimatePresence>

      {/* Modals */}
      {showNewChat && (
        <NewChatModal onClose={() => setShowNewChat(false)} onChatCreated={handleChatCreated}
          createDirectChat={createDirectChat} createGroupChat={createGroupChat} />
      )}
      {showProfile && <ProfileSheet onClose={() => setShowProfile(false)} />}

      {/* Incoming call */}
      <AnimatePresence>
        {incomingCall && !activeCall && (
          <IncomingCallBanner
            callerName={incomingCall.callerName} callerAvatar={incomingCall.callerAvatar}
            callType={incomingCall.callType}
            onAccept={() => {
              setActiveCall({ chat: incomingCall.chat, callType: incomingCall.callType, callId: incomingCall.callId, isIncoming: true });
              setIncomingCall(null);
            }}
            onDecline={() => setIncomingCall(null)}
          />
        )}
      </AnimatePresence>

      {/* Active call */}
      <AnimatePresence>
        {activeCall && (
          <CallScreen chat={activeCall.chat} callType={activeCall.callType}
            callId={activeCall.callId} isIncoming={activeCall.isIncoming}
            currentUser={profile} onEnd={() => setActiveCall(null)} />
        )}
      </AnimatePresence>
    </div>
  );
};

export default Index;
