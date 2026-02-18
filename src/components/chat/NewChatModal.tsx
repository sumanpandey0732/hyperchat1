import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Search, UserPlus, Users, Check } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import type { Profile } from '@/contexts/AuthContext';
import { toast } from 'sonner';

interface NewChatModalProps {
  onClose: () => void;
  onChatCreated: (chatId: string) => void;
  createDirectChat: (userId: string) => Promise<string | null>;
  createGroupChat: (name: string, memberIds: string[]) => Promise<string | null>;
}

const NewChatModal = ({ onClose, onChatCreated, createDirectChat, createGroupChat }: NewChatModalProps) => {
  const { user } = useAuth();
  const [mode, setMode] = useState<'dm' | 'group'>('dm');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Profile[]>([]);
  const [selected, setSelected] = useState<Profile[]>([]);
  const [groupName, setGroupName] = useState('');
  const [loading, setLoading] = useState(false);
  const [searching, setSearching] = useState(false);

  const search = async (q: string) => {
    setQuery(q);
    if (!q.trim() || q.length < 2) { setResults([]); return; }
    setSearching(true);
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .neq('user_id', user?.id || '')
      .or(`display_name.ilike.%${q}%`)
      .limit(10);
    setResults((data || []) as Profile[]);
    setSearching(false);
  };

  const toggleSelect = (profile: Profile) => {
    setSelected(prev =>
      prev.find(p => p.id === profile.id)
        ? prev.filter(p => p.id !== profile.id)
        : [...prev, profile]
    );
  };

  const handleCreate = async () => {
    setLoading(true);
    try {
      if (mode === 'dm') {
        if (selected.length !== 1) { toast.error('Select one contact'); return; }
        const chatId = await createDirectChat(selected[0].user_id);
        if (chatId) { onChatCreated(chatId); onClose(); }
        else toast.error('Failed to create chat');
      } else {
        if (!groupName.trim()) { toast.error('Enter group name'); return; }
        if (selected.length < 1) { toast.error('Add at least one member'); return; }
        const chatId = await createGroupChat(groupName, selected.map(p => p.user_id));
        if (chatId) { onChatCreated(chatId); onClose(); }
        else toast.error('Failed to create group');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-background/60 backdrop-blur-sm"
        onClick={onClose}
      >
        <motion.div
          initial={{ y: 60, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 60, opacity: 0 }}
          transition={{ type: 'spring', damping: 25 }}
          onClick={e => e.stopPropagation()}
          className="glass-panel-strong rounded-2xl w-full max-w-md overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-border/30">
            <h2 className="font-bold text-base">
              {mode === 'dm' ? 'New Message' : 'New Group'}
            </h2>
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted/50 text-muted-foreground">
              <X size={18} />
            </button>
          </div>

          {/* Mode toggle */}
          <div className="flex gap-2 p-4 pb-0">
            <button
              onClick={() => { setMode('dm'); setSelected([]); }}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                mode === 'dm' ? 'bg-primary/20 text-primary' : 'bg-muted/30 text-muted-foreground hover:text-foreground'
              }`}
            >
              <UserPlus size={14} /> Direct Message
            </button>
            <button
              onClick={() => setMode('group')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                mode === 'group' ? 'bg-primary/20 text-primary' : 'bg-muted/30 text-muted-foreground hover:text-foreground'
              }`}
            >
              <Users size={14} /> Group Chat
            </button>
          </div>

          <div className="p-4 space-y-3">
            {mode === 'group' && (
              <input
                type="text"
                placeholder="Group name"
                value={groupName}
                onChange={e => setGroupName(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl bg-muted/40 border border-border/50 text-sm focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20"
              />
            )}

            {/* Selected */}
            {selected.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {selected.map(p => (
                  <div key={p.id} className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-primary/20 text-primary text-xs">
                    <span>{p.display_name}</span>
                    <button onClick={() => toggleSelect(p)}>
                      <X size={12} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Search */}
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search by name..."
                value={query}
                onChange={e => search(e.target.value)}
                className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-muted/40 border border-border/50 text-sm focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20"
              />
            </div>

            {/* Results */}
            <div className="max-h-52 overflow-y-auto space-y-1">
              {searching && (
                <div className="text-center py-4 text-muted-foreground text-sm">Searching...</div>
              )}
              {!searching && results.length === 0 && query.length >= 2 && (
                <div className="text-center py-4 text-muted-foreground text-sm">No users found</div>
              )}
              {results.map(p => {
                const isSelected = !!selected.find(s => s.id === p.id);
                return (
                  <button
                    key={p.id}
                    onClick={() => mode === 'dm' ? setSelected([p]) : toggleSelect(p)}
                    className={`w-full flex items-center gap-3 p-2.5 rounded-xl text-left transition-all ${
                      isSelected ? 'bg-primary/15' : 'hover:bg-muted/40'
                    }`}
                  >
                    <div className="w-9 h-9 rounded-full flex items-center justify-center font-semibold text-sm flex-shrink-0"
                      style={{ background: `hsl(${(p.display_name.charCodeAt(0) * 13) % 360}, 70%, 45%)` }}>
                      {p.display_name[0]?.toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{p.display_name}</p>
                      <p className="text-xs text-muted-foreground">{p.about}</p>
                    </div>
                    {isSelected && <Check size={16} className="text-primary flex-shrink-0" />}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="p-4 pt-0">
            <button
              onClick={handleCreate}
              disabled={loading || (mode === 'dm' ? selected.length !== 1 : selected.length < 1 || !groupName.trim())}
              className="w-full py-3 rounded-xl bg-primary text-primary-foreground font-semibold text-sm hover:opacity-90 transition-all disabled:opacity-40"
            >
              {loading ? 'Creating...' : mode === 'dm' ? 'Start Chat' : 'Create Group'}
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default NewChatModal;
