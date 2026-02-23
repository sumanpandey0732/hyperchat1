import { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Camera, LogOut, Edit2, Check, Bell, Lock, Moon, ChevronRight } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface ProfileSheetProps {
  onClose: () => void;
}

const ProfileSheet = ({ onClose }: ProfileSheetProps) => {
  const { profile, updateProfile, signOut } = useAuth();
  const [editingName, setEditingName] = useState(false);
  const [editingAbout, setEditingAbout] = useState(false);
  const [name, setName] = useState(profile?.display_name || '');
  const [about, setAbout] = useState(profile?.about || '');
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const saveField = async (field: 'display_name' | 'about', value: string) => {
    await updateProfile({ [field]: value });
    toast.success('Updated!');
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const ext = file.name.split('.').pop();
      const path = `avatars/${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from('chat-files').upload(path, file, { upsert: true });
      if (error) { toast.error('Upload failed'); return; }
      const { data } = supabase.storage.from('chat-files').getPublicUrl(path);
      await updateProfile({ avatar_url: data.publicUrl });
      toast.success('Avatar updated!');
    } finally { setUploading(false); }
  };

  const handleSignOut = async () => { await signOut(); onClose(); };

  const initials = profile?.display_name?.[0]?.toUpperCase() || '?';
  const hue = (profile?.display_name?.charCodeAt(0) || 0) * 13 % 360;

  return (
    <AnimatePresence>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-foreground/40"
        onClick={onClose}>
        <motion.div initial={{ y: 60, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 60, opacity: 0 }}
          transition={{ type: 'spring', damping: 25 }}
          onClick={e => e.stopPropagation()}
          className="bg-card rounded-2xl w-full max-w-sm overflow-hidden shadow-xl border border-border">
          
          {/* Header */}
          <div className="bg-primary px-4 py-3 flex items-center justify-between">
            <h2 className="font-bold text-base text-primary-foreground">Profile</h2>
            <button onClick={onClose} className="p-1.5 rounded-full hover:bg-primary-foreground/10 text-primary-foreground">
              <X size={18} />
            </button>
          </div>

          <div className="p-6 space-y-5">
            {/* Avatar */}
            <div className="flex flex-col items-center">
              <div className="relative">
                <div className="w-20 h-20 rounded-full flex items-center justify-center text-2xl font-bold text-primary-foreground overflow-hidden"
                  style={{ background: profile?.avatar_url ? undefined : `hsl(${hue}, 60%, 55%)` }}>
                  {profile?.avatar_url ? <img src={profile.avatar_url} alt="" className="w-full h-full object-cover" /> : initials}
                </div>
                <button onClick={() => fileRef.current?.click()}
                  className="absolute -bottom-1 -right-1 p-1.5 rounded-full bg-primary text-primary-foreground shadow-md"
                  disabled={uploading}>
                  <Camera size={14} />
                </button>
                <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} />
              </div>
              <div className="flex items-center gap-1.5 mt-2">
                <div className="w-2 h-2 rounded-full status-online" />
                <p className="text-xs text-muted-foreground">Online</p>
              </div>
            </div>

            {/* Name */}
            <div>
              <label className="text-xs text-muted-foreground mb-1.5 block">Display Name</label>
              <div className="flex items-center gap-2">
                {editingName ? (
                  <>
                    <input value={name} onChange={e => setName(e.target.value)}
                      className="flex-1 px-3 py-2.5 rounded-xl bg-background border border-primary text-sm focus:outline-none" autoFocus />
                    <button onClick={() => { saveField('display_name', name); setEditingName(false); }}
                      className="p-2 rounded-lg bg-primary text-primary-foreground"><Check size={15} /></button>
                  </>
                ) : (
                  <div className="flex items-center gap-2 flex-1 px-3 py-2.5 rounded-xl bg-muted/50">
                    <span className="flex-1 text-sm">{profile?.display_name}</span>
                    <button onClick={() => setEditingName(true)} className="text-muted-foreground hover:text-foreground"><Edit2 size={14} /></button>
                  </div>
                )}
              </div>
            </div>

            {/* About */}
            <div>
              <label className="text-xs text-muted-foreground mb-1.5 block">About</label>
              <div className="flex items-center gap-2">
                {editingAbout ? (
                  <>
                    <input value={about} onChange={e => setAbout(e.target.value)}
                      className="flex-1 px-3 py-2.5 rounded-xl bg-background border border-primary text-sm focus:outline-none" autoFocus />
                    <button onClick={() => { saveField('about', about); setEditingAbout(false); }}
                      className="p-2 rounded-lg bg-primary text-primary-foreground"><Check size={15} /></button>
                  </>
                ) : (
                  <div className="flex items-center gap-2 flex-1 px-3 py-2.5 rounded-xl bg-muted/50">
                    <span className="flex-1 text-sm text-muted-foreground">{profile?.about}</span>
                    <button onClick={() => setEditingAbout(true)} className="text-muted-foreground hover:text-foreground"><Edit2 size={14} /></button>
                  </div>
                )}
              </div>
            </div>

            {/* Settings */}
            <div className="space-y-1">
              {[
                { icon: Bell, label: 'Notifications' },
                { icon: Lock, label: 'Privacy' },
                { icon: Moon, label: 'Appearance' },
              ].map(item => (
                <button key={item.label} className="w-full flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-muted/50 text-sm text-muted-foreground hover:text-foreground transition-all">
                  <item.icon size={18} />
                  <span className="flex-1 text-left">{item.label}</span>
                  <ChevronRight size={16} />
                </button>
              ))}
            </div>

            {/* Sign Out */}
            <button onClick={handleSignOut}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-destructive/10 text-destructive text-sm font-medium hover:bg-destructive/20 transition-all">
              <LogOut size={16} /> Sign Out
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default ProfileSheet;
