import { useState, useCallback } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import AnimatedBackground from '@/components/chat/AnimatedBackground';
import ChatSidebar from '@/components/chat/ChatSidebar';
import ChatArea from '@/components/chat/ChatArea';
import InfoPanel from '@/components/chat/InfoPanel';
import EmptyState from '@/components/chat/EmptyState';
import { mockChats, currentUser, type Chat, type Message } from '@/lib/chat-data';

const Index = () => {
  const [chats, setChats] = useState<Chat[]>(mockChats);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [showInfo, setShowInfo] = useState(false);

  const activeChat = chats.find(c => c.id === activeChatId) || null;

  const handleSendMessage = useCallback((chatId: string, content: string) => {
    const newMsg: Message = {
      id: `msg-${Date.now()}`,
      senderId: currentUser.id,
      content,
      timestamp: new Date(),
      type: 'text',
      read: false,
    };
    setChats(prev =>
      prev.map(chat =>
        chat.id === chatId
          ? { ...chat, messages: [...chat.messages, newMsg], lastMessage: newMsg }
          : chat
      )
    );
  }, []);

  const handleSelectChat = (id: string) => {
    setActiveChatId(id);
    setChats(prev =>
      prev.map(c => (c.id === id ? { ...c, unreadCount: 0 } : c))
    );
  };

  return (
    <div className="h-screen w-screen overflow-hidden gradient-mesh relative">
      <AnimatedBackground />

      <div className="relative z-10 h-full flex">
        {/* Sidebar */}
        <div
          className={`glass-panel-strong border-r border-border/30 w-full lg:w-80 xl:w-96 flex-shrink-0 ${
            activeChatId ? 'hidden lg:flex' : 'flex'
          } flex-col`}
        >
          <ChatSidebar
            chats={chats}
            activeChatId={activeChatId}
            onSelectChat={handleSelectChat}
            currentUserId={currentUser.id}
          />
        </div>

        {/* Chat Area */}
        <div className={`flex-1 min-w-0 ${!activeChatId ? 'hidden lg:flex' : 'flex'} flex-col`}>
          {activeChat ? (
            <ChatArea
              chat={activeChat}
              currentUserId={currentUser.id}
              onSendMessage={handleSendMessage}
              onBack={() => setActiveChatId(null)}
            />
          ) : (
            <EmptyState />
          )}
        </div>

        {/* Info Panel */}
        <AnimatePresence>
          {activeChat && showInfo && (
            <motion.div
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 320, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              className="glass-panel-strong border-l border-border/30 overflow-hidden hidden xl:block flex-shrink-0"
            >
              <InfoPanel chat={activeChat} onClose={() => setShowInfo(false)} />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Toggle info panel on chat header click */}
        {activeChat && !showInfo && (
          <button
            onClick={() => setShowInfo(true)}
            className="hidden xl:block absolute right-4 top-4 text-xs text-muted-foreground hover:text-foreground glass-panel rounded-lg px-3 py-1.5 transition-colors"
          >
            Info
          </button>
        )}
      </div>
    </div>
  );
};

export default Index;
