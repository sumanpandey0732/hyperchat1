import { motion } from 'framer-motion';
import { MessageSquare, Users, Phone, User } from 'lucide-react';

type Tab = 'chats' | 'groups' | 'calls' | 'profile';

interface BottomNavProps {
  activeTab: Tab;
  onTabChange: (tab: Tab) => void;
  unreadCount?: number;
}

const tabs = [
  { id: 'chats' as Tab, icon: MessageSquare, label: 'Chats' },
  { id: 'groups' as Tab, icon: Users, label: 'Groups' },
  { id: 'calls' as Tab, icon: Phone, label: 'Calls' },
  { id: 'profile' as Tab, icon: User, label: 'Profile' },
];

const BottomNav = ({ activeTab, onTabChange, unreadCount = 0 }: BottomNavProps) => {
  return (
    <div className="lg:hidden fixed bottom-0 left-0 right-0 z-50 safe-area-bottom">
      <div className="glass-panel-strong border-t border-border/30 px-2 pb-safe">
        <div className="flex items-center justify-around py-2">
          {tabs.map(tab => {
            const isActive = activeTab === tab.id;
            return (
              <motion.button
                key={tab.id}
                onClick={() => onTabChange(tab.id)}
                whileTap={{ scale: 0.9 }}
                className="relative flex flex-col items-center gap-0.5 px-4 py-2 rounded-xl"
              >
                <motion.div
                  animate={{
                    scale: isActive ? 1.1 : 1,
                  }}
                  transition={{ type: 'spring', stiffness: 400, damping: 20 }}
                  className={`p-1.5 rounded-xl transition-all ${
                    isActive
                      ? 'bg-primary/20 text-primary neon-glow-cyan'
                      : 'text-muted-foreground'
                  }`}
                >
                  <tab.icon size={20} />
                </motion.div>
                <span className={`text-[10px] font-medium transition-colors ${
                  isActive ? 'text-primary' : 'text-muted-foreground'
                }`}>
                  {tab.label}
                </span>
                {tab.id === 'chats' && unreadCount > 0 && (
                  <span className="absolute top-1.5 right-3 w-4 h-4 rounded-full bg-primary text-primary-foreground text-[9px] font-bold flex items-center justify-center">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
                {isActive && (
                  <motion.div
                    layoutId="bottomNavIndicator"
                    className="absolute -top-0.5 left-1/2 -translate-x-1/2 w-6 h-0.5 rounded-full bg-primary"
                  />
                )}
              </motion.button>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default BottomNav;
