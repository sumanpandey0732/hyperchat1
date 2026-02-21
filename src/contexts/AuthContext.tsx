import { createContext, useContext, useEffect, useState, useRef, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { registerServiceWorker, requestNotificationPermission } from '@/lib/notifications';

export type Profile = {
  id: string;
  user_id: string;
  display_name: string;
  avatar_url: string | null;
  about: string | null;
  is_online: boolean;
  last_seen: string;
  phone: string | null;
};

type AuthContextType = {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  signOut: () => Promise<void>;
  updateProfile: (data: Partial<Omit<Profile, 'id' | 'user_id'>>) => Promise<void>;
  refreshProfile: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType>({} as AuthContextType);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const loadingTimeoutRef = useRef<NodeJS.Timeout>();

  const loadProfile = async (userId: string, retries = 3): Promise<void> => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', userId)
        .single();
      if (data) {
        setProfile(data as Profile);
        return;
      }
      // Profile not found — trigger may not have fired yet; retry or create manually
      if (error && retries > 0) {
        await new Promise(r => setTimeout(r, 800));
        return loadProfile(userId, retries - 1);
      }
      // After retries, create profile manually as fallback
      if (!data) {
        const { data: userData } = await supabase.auth.getUser();
        const meta = userData?.user?.user_metadata || {};
        const displayName = meta.full_name || meta.name || meta.display_name || userData?.user?.email?.split('@')[0] || 'User';
        const { data: created } = await supabase
          .from('profiles')
          .insert({ user_id: userId, display_name: displayName, avatar_url: meta.avatar_url || meta.picture || null })
          .select()
          .single();
        if (created) setProfile(created as Profile);
      }
    } catch (err) {
      console.warn('Profile load error:', err);
    }
  };

  const refreshProfile = async () => {
    if (user) await loadProfile(user.id);
  };

  useEffect(() => {
    registerServiceWorker();

    // Safety timeout: never stuck loading > 8s
    loadingTimeoutRef.current = setTimeout(() => {
      setLoading(false);
    }, 8000);

    // Set up listener BEFORE getSession
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      setSession(session);
      setUser(session?.user ?? null);

      if (session?.user) {
        // Load profile non-blocking
        loadProfile(session.user.id).then(() => {
          setLoading(false);
          clearTimeout(loadingTimeoutRef.current);
        });

        // Mark online (deferred)
        setTimeout(async () => {
          try {
            await supabase
              .from('profiles')
              .update({ is_online: true })
              .eq('user_id', session.user.id);
          } catch {}
        }, 500);

        // Request notification permission
        requestNotificationPermission().catch(() => {});
      } else {
        setProfile(null);
        setLoading(false);
        clearTimeout(loadingTimeoutRef.current);
      }
    });

    // Check existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        setLoading(false);
        clearTimeout(loadingTimeoutRef.current);
      }
    });

    return () => {
      subscription.unsubscribe();
      clearTimeout(loadingTimeoutRef.current);
    };
  }, []);

  useEffect(() => {
    const markOffline = async () => {
      if (user) {
        try {
          await supabase
            .from('profiles')
            .update({ is_online: false, last_seen: new Date().toISOString() })
            .eq('user_id', user.id);
        } catch {}
      }
    };
    window.addEventListener('beforeunload', markOffline);
    return () => window.removeEventListener('beforeunload', markOffline);
  }, [user]);

  const signOut = async () => {
    if (user) {
      try {
        await supabase
          .from('profiles')
          .update({ is_online: false, last_seen: new Date().toISOString() })
          .eq('user_id', user.id);
      } catch {}
    }
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setProfile(null);
  };

  const updateProfile = async (data: Partial<Omit<Profile, 'id' | 'user_id'>>) => {
    if (!user) return;
    const { data: updated } = await supabase
      .from('profiles')
      .update(data)
      .eq('user_id', user.id)
      .select()
      .single();
    if (updated) setProfile(updated as Profile);
  };

  return (
    <AuthContext.Provider value={{ user, session, profile, loading, signOut, updateProfile, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
