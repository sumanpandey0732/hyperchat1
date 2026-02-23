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
      <div className="bg-card border-t border-border px-2 pb-safe">
        <div className="flex items-center justify-around py-1">
          {tabs.map(tab => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => onTabChange(tab.id)}
                className="relative flex flex-col items-center gap-0.5 px-4 py-2 min-w-[64px]"
              >
                <div className={`p-1.5 rounded-full transition-colors ${
                  isActive ? 'text-primary' : 'text-muted-foreground'
                }`}>
                  <tab.icon size={22} />
                </div>
                <span className={`text-[10px] font-medium ${
                  isActive ? 'text-primary' : 'text-muted-foreground'
                }`}>
                  {tab.label}
                </span>
                {tab.id === 'chats' && unreadCount > 0 && (
                  <span className="absolute top-1 right-2 w-4 h-4 rounded-full bg-primary text-primary-foreground text-[9px] font-bold flex items-center justify-center">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default BottomNav;
