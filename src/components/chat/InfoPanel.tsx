import { motion } from 'framer-motion';
import { X, Phone, Video, Bell, Lock, Image, FileText, Link2, ChevronRight, UserCheck } from 'lucide-react';
import type { ChatWithMeta } from '@/hooks/useChats';

interface InfoPanelProps {
  chat: ChatWithMeta;
  onClose: () => void;
}

const avatarHue = (name: string) => (name.charCodeAt(0) * 13) % 360;

const InfoPanel = ({ chat, onClose }: InfoPanelProps) => {
  const isGroup = chat.is_group;
  const name = isGroup ? chat.group_name || 'Group' : chat.members.find(m => m.user_id !== chat.created_by)?.display_name || 'Unknown';
  const member = !isGroup ? chat.members.find(m => m.user_id !== chat.created_by) : null;
  const status = isGroup
    ? `${chat.members.length + 1} participants`
    : member?.is_online ? 'Online now' : 'Offline';

  const hue = avatarHue(name);

  const sections = [
    { icon: Image, label: 'Shared Media', count: '–' },
    { icon: FileText, label: 'Shared Files', count: '–' },
    { icon: Link2, label: 'Shared Links', count: '–' },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, x: 30 }}
      animate={{ opacity: 1, x: 0 }}
      className="flex flex-col h-full"
    >
      {/* Header */}
      <div className="p-4 flex items-center justify-between border-b border-border/25">
        <h3 className="font-semibold text-sm">{isGroup ? 'Group Info' : 'Contact Info'}</h3>
        <button onClick={onClose} className="p-1.5 rounded-xl hover:bg-muted/50 text-muted-foreground">
          <X size={16} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* Profile */}
        <div className="flex flex-col items-center py-6 px-4">
          <div
            className="w-20 h-20 rounded-full flex items-center justify-center text-2xl font-bold overflow-hidden"
            style={{ background: (isGroup ? chat.group_avatar_url : member?.avatar_url) ? undefined : `hsl(${hue}, 70%, 45%)` }}
          >
            {(isGroup ? chat.group_avatar_url : member?.avatar_url)
              ? <img src={(isGroup ? chat.group_avatar_url : member?.avatar_url) || ''} alt="" className="w-full h-full object-cover" />
              : name[0]?.toUpperCase()}
          </div>

          <h2 className="font-bold text-base mt-3">{name}</h2>
          <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1.5">
            {!isGroup && member?.is_online && (
              <span className="w-1.5 h-1.5 rounded-full status-online inline-block" />
            )}
            {status}
          </p>

          {/* Actions */}
          <div className="flex gap-6 mt-5">
            {[
              { icon: Phone, label: 'Audio' },
              { icon: Video, label: 'Video' },
              { icon: Bell, label: 'Mute' },
            ].map(action => (
              <button key={action.label} className="flex flex-col items-center gap-1.5 group">
                <div className="p-2.5 rounded-xl bg-muted/40 group-hover:bg-primary/15 group-hover:text-primary transition-all text-muted-foreground">
                  <action.icon size={17} />
                </div>
                <span className="text-[10px] text-muted-foreground">{action.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* About / Status */}
        {!isGroup && member && (
          <div className="px-4 pb-4">
            <div className="glass-panel rounded-xl p-3">
              <p className="text-xs text-muted-foreground mb-0.5">About</p>
              <p className="text-sm">{"Hey there! I am using Nexus"}</p>
            </div>
          </div>
        )}

        {/* Encryption */}
        <div className="px-4 pb-4">
          <div className="glass-panel rounded-xl p-3 flex items-center gap-3">
            <Lock size={15} className="text-primary flex-shrink-0" />
            <div>
              <p className="text-xs font-medium">Encrypted</p>
              <p className="text-[10px] text-muted-foreground">End-to-end encrypted</p>
            </div>
          </div>
        </div>

        {/* Shared content */}
        <div className="px-4 space-y-0.5">
          {sections.map(s => (
            <button key={s.label} className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-muted/30 transition-colors">
              <s.icon size={15} className="text-muted-foreground" />
              <span className="text-sm flex-1 text-left">{s.label}</span>
              <span className="text-xs text-muted-foreground mr-1">{s.count}</span>
              <ChevronRight size={13} className="text-muted-foreground" />
            </button>
          ))}
        </div>

        {/* Group members */}
        {isGroup && (
          <div className="px-4 mt-4">
            <h4 className="text-xs font-semibold text-muted-foreground px-2 mb-2 uppercase tracking-wider">
              Members · {chat.members.length + 1}
            </h4>
            {chat.members.map(m => (
              <div key={m.id} className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-muted/30 transition-colors">
                <div className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold overflow-hidden flex-shrink-0"
                  style={{ background: m.avatar_url ? undefined : `hsl(${avatarHue(m.display_name)}, 70%, 45%)` }}>
                  {m.avatar_url ? <img src={m.avatar_url} alt="" className="w-full h-full object-cover" /> : m.display_name[0]?.toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{m.display_name}</p>
                  <p className="text-[10px] text-muted-foreground">{m.is_online ? '🟢 Online' : 'Offline'}</p>
                </div>
                <UserCheck size={14} className="text-muted-foreground" />
              </div>
            ))}
          </div>
        )}
      </div>
    </motion.div>
  );
};

export default InfoPanel;
