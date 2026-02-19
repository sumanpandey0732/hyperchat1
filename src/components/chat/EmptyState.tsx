import { motion } from 'framer-motion';
import { MessageSquare, Shield, Zap, Plus } from 'lucide-react';

interface EmptyStateProps {
  onNewChat?: () => void;
}

const EmptyState = ({ onNewChat }: EmptyStateProps) => (
  <div className="flex flex-col items-center justify-center h-full px-8">
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="text-center max-w-sm"
    >
      <motion.div
        animate={{ y: [0, -8, 0] }}
        transition={{ duration: 3.5, repeat: Infinity, ease: 'easeInOut' }}
        className="w-24 h-24 rounded-3xl bg-primary/10 border border-primary/20 flex items-center justify-center mx-auto mb-6 neon-glow-cyan"
      >
        <MessageSquare size={40} className="text-primary" />
      </motion.div>

      <h2 className="text-2xl font-bold mb-2 font-display neon-text-cyan">HyperChat</h2>
      <p className="text-sm text-muted-foreground mb-8 leading-relaxed">
        Beautiful, secure, real-time messaging.<br />
        Select a chat or start a new conversation.
      </p>

      <motion.button
        whileHover={{ scale: 1.03 }}
        whileTap={{ scale: 0.97 }}
        onClick={onNewChat}
        className="flex items-center gap-2 mx-auto px-5 py-2.5 rounded-xl bg-primary/15 border border-primary/30 text-primary text-sm font-medium hover:bg-primary/25 transition-all neon-glow-cyan mb-8"
      >
        <Plus size={16} />
        Start New Chat
      </motion.button>

      <div className="flex gap-8 justify-center">
        {[
          { icon: Shield, label: 'E2E Encrypted' },
          { icon: Zap, label: 'Real-time' },
        ].map(f => (
          <div key={f.label} className="flex items-center gap-2 text-xs text-muted-foreground/60">
            <f.icon size={13} className="text-primary/70" />
            {f.label}
          </div>
        ))}
      </div>
    </motion.div>
  </div>
);

export default EmptyState;
