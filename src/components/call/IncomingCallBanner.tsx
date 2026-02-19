import { motion } from 'framer-motion';
import { Phone, PhoneOff, Video } from 'lucide-react';
import type { Profile } from '@/contexts/AuthContext';

interface IncomingCallBannerProps {
  callerName: string;
  callerAvatar?: string | null;
  callType: 'audio' | 'video';
  onAccept: () => void;
  onDecline: () => void;
}

const avatarHue = (name: string) => (name.charCodeAt(0) * 13) % 360;

const IncomingCallBanner = ({ callerName, callerAvatar, callType, onAccept, onDecline }: IncomingCallBannerProps) => {
  const hue = avatarHue(callerName);

  return (
    <motion.div
      initial={{ opacity: 0, y: -80 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -80 }}
      transition={{ type: 'spring', stiffness: 350, damping: 28 }}
      className="fixed top-4 left-4 right-4 z-[90] mx-auto max-w-sm"
    >
      <div className="glass-panel-strong rounded-2xl p-4 flex items-center gap-3 border border-primary/20 neon-glow-cyan">
        {/* Avatar */}
        <div
          className="w-12 h-12 rounded-full flex items-center justify-center text-lg font-bold flex-shrink-0 overflow-hidden"
          style={{ background: callerAvatar ? undefined : `hsl(${hue}, 55%, 38%)` }}
        >
          {callerAvatar
            ? <img src={callerAvatar} alt="" className="w-full h-full object-cover" />
            : callerName[0]?.toUpperCase()}
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-xs text-muted-foreground">
            {callType === 'video' ? '🎥 Incoming video call' : '🎙️ Incoming voice call'}
          </p>
          <p className="font-semibold text-sm truncate">{callerName}</p>
        </div>

        {/* Decline */}
        <motion.button
          whileTap={{ scale: 0.9 }}
          onClick={onDecline}
          className="w-10 h-10 rounded-full bg-destructive flex items-center justify-center flex-shrink-0"
        >
          <PhoneOff size={18} className="text-white" />
        </motion.button>

        {/* Accept */}
        <motion.button
          whileTap={{ scale: 0.9 }}
          onClick={onAccept}
          className="w-10 h-10 rounded-full bg-primary flex items-center justify-center flex-shrink-0"
        >
          {callType === 'video' ? <Video size={18} className="text-primary-foreground" /> : <Phone size={18} className="text-primary-foreground" />}
        </motion.button>
      </div>
    </motion.div>
  );
};

export default IncomingCallBanner;
