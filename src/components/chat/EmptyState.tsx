import { motion } from 'framer-motion';
import { MessageSquare, Shield, Zap } from 'lucide-react';

const EmptyState = () => (
  <div className="flex flex-col items-center justify-center h-full px-8">
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="text-center max-w-sm"
    >
      <motion.div
        animate={{ y: [0, -6, 0] }}
        transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
        className="w-20 h-20 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-6 neon-glow-cyan"
      >
        <MessageSquare size={36} className="text-primary" />
      </motion.div>
      <h2 className="text-xl font-bold mb-2 font-display">Welcome to Nexus</h2>
      <p className="text-sm text-muted-foreground mb-8">
        Select a conversation to start messaging
      </p>
      <div className="flex gap-6 justify-center">
        {[
          { icon: Shield, label: 'E2E Encrypted' },
          { icon: Zap, label: 'Real-time' },
        ].map(f => (
          <div key={f.label} className="flex items-center gap-2 text-xs text-muted-foreground">
            <f.icon size={14} className="text-primary" />
            {f.label}
          </div>
        ))}
      </div>
    </motion.div>
  </div>
);

export default EmptyState;
