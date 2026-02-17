import { motion } from 'framer-motion';
import { X, Phone, Video, Bell, Lock, Image, FileText, Link2, ChevronRight } from 'lucide-react';
import AvatarIcon from './AvatarIcon';
import { getAvatarGradient, type Chat } from '@/lib/chat-data';

interface InfoPanelProps {
  chat: Chat;
  onClose: () => void;
}

const InfoPanel = ({ chat, onClose }: InfoPanelProps) => {
  const isGroup = chat.isGroup;
  const name = isGroup ? chat.name : chat.participants[0]?.name;
  const status = isGroup
    ? `${chat.participants.length + 1} participants`
    : chat.participants[0]?.status === 'online' ? 'Online' : chat.participants[0]?.lastSeen || 'Offline';

  const sections = [
    { icon: Image, label: 'Shared Media', count: 24 },
    { icon: FileText, label: 'Shared Files', count: 8 },
    { icon: Link2, label: 'Shared Links', count: 15 },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, x: 30 }}
      animate={{ opacity: 1, x: 0 }}
      className="flex flex-col h-full"
    >
      {/* Header */}
      <div className="p-4 flex items-center justify-between border-b border-border/30">
        <h3 className="font-semibold text-sm">Contact Info</h3>
        <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted/50 text-muted-foreground">
          <X size={16} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* Profile */}
        <div className="flex flex-col items-center py-6 px-4">
          {isGroup ? (
            <div className="w-20 h-20 rounded-full flex items-center justify-center text-2xl font-bold"
              style={{ background: getAvatarGradient(0) }}>
              {name?.[0]}
            </div>
          ) : (
            <AvatarIcon user={chat.participants[0]} index={0} size="lg" />
          )}
          <h2 className="font-bold text-base mt-3">{name}</h2>
          <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
            {!isGroup && chat.participants[0]?.status === 'online' && (
              <span className="w-1.5 h-1.5 rounded-full status-online inline-block" />
            )}
            {status}
          </p>

          {/* Actions */}
          <div className="flex gap-4 mt-4">
            {[
              { icon: Phone, label: 'Audio' },
              { icon: Video, label: 'Video' },
              { icon: Bell, label: 'Mute' },
            ].map(action => (
              <button key={action.label} className="flex flex-col items-center gap-1 group">
                <div className="p-2.5 rounded-xl bg-muted/40 group-hover:bg-primary/15 group-hover:text-primary transition-all">
                  <action.icon size={18} />
                </div>
                <span className="text-[10px] text-muted-foreground">{action.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Encryption */}
        <div className="px-4 pb-4">
          <div className="glass-panel rounded-xl p-3 flex items-center gap-3">
            <Lock size={16} className="text-primary flex-shrink-0" />
            <div>
              <p className="text-xs font-medium">Encryption</p>
              <p className="text-[10px] text-muted-foreground">Messages are end-to-end encrypted</p>
            </div>
          </div>
        </div>

        {/* Shared */}
        <div className="px-4 space-y-1">
          {sections.map(s => (
            <button key={s.label} className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-muted/30 transition-colors">
              <s.icon size={16} className="text-muted-foreground" />
              <span className="text-sm flex-1 text-left">{s.label}</span>
              <span className="text-xs text-muted-foreground mr-1">{s.count}</span>
              <ChevronRight size={14} className="text-muted-foreground" />
            </button>
          ))}
        </div>

        {/* Participants */}
        {isGroup && (
          <div className="px-4 mt-4">
            <h4 className="text-xs font-semibold text-muted-foreground px-3 mb-2 uppercase tracking-wider">
              Participants
            </h4>
            {chat.participants.map((p, i) => (
              <div key={p.id} className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-muted/30 transition-colors">
                <AvatarIcon user={p} index={i} size="sm" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{p.name}</p>
                  <p className="text-[10px] text-muted-foreground capitalize">{p.status}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </motion.div>
  );
};

export default InfoPanel;
