import { MessageCircle, Plus } from 'lucide-react';

interface EmptyStateProps {
  onNewChat?: () => void;
}

const EmptyState = ({ onNewChat }: EmptyStateProps) => (
  <div className="flex flex-col items-center justify-center h-full px-8 bg-background">
    <div className="text-center max-w-sm">
      <div className="w-24 h-24 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-6">
        <MessageCircle size={48} className="text-primary" />
      </div>

      <h2 className="text-xl font-bold mb-2 text-foreground">HyperChat</h2>
      <p className="text-sm text-muted-foreground mb-8 leading-relaxed">
        Send and receive messages with friends.<br />
        Select a chat or start a new conversation.
      </p>

      <button onClick={onNewChat}
        className="flex items-center gap-2 mx-auto px-6 py-3 rounded-full bg-primary text-primary-foreground text-sm font-medium shadow-md hover:opacity-90 transition-all">
        <Plus size={18} />
        Start New Chat
      </button>
    </div>
  </div>
);

export default EmptyState;
