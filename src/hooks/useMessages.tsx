import { useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { showLocalNotification } from '@/lib/notifications';
import type { Profile } from '@/contexts/AuthContext';

export type Message = {
  id: string;
  chat_id: string;
  sender_id: string;
  content: string | null;
  type: string;
  file_url: string | null;
  file_name: string | null;
  file_type: string | null;
  reply_to: string | null;
  status: string;
  read_at: string | null;
  created_at: string;
  sender?: Profile;
};

export const useMessages = (chatId: string | null) => {
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const typingTimers = useRef<Map<string, NodeJS.Timeout>>(new Map());
  const profileCacheRef = useRef<Map<string, Profile>>(new Map());

  const getProfile = useCallback(async (userId: string): Promise<Profile | undefined> => {
    if (profileCacheRef.current.has(userId)) return profileCacheRef.current.get(userId);
    const { data } = await supabase.from('profiles').select('*').eq('user_id', userId).single();
    if (data) { profileCacheRef.current.set(userId, data as Profile); return data as Profile; }
  }, []);

  const fetchMessages = useCallback(async () => {
    if (!chatId) return;
    setLoading(true);
    try {
      const { data } = await supabase.from('messages').select('*')
        .eq('chat_id', chatId).order('created_at', { ascending: true }).limit(100);
      if (data) {
        const senderIds = [...new Set(data.map(m => m.sender_id))];
        const { data: profiles } = await supabase.from('profiles').select('*').in('user_id', senderIds);
        const profileMap = new Map((profiles || []).map(p => [p.user_id, p as Profile]));
        profiles?.forEach(p => profileCacheRef.current.set(p.user_id, p as Profile));
        const msgs = data.map(m => ({ ...m, sender: profileMap.get(m.sender_id) })) as Message[];
        setMessages(msgs);
      }
    } catch (err) { console.error('fetchMessages error:', err); }
    finally { setLoading(false); }
  }, [chatId]);

  // Mark unread messages as read
  const markAsRead = useCallback(async () => {
    if (!chatId || !user) return;
    try {
      await supabase.from('messages')
        .update({ status: 'read', read_at: new Date().toISOString() })
        .eq('chat_id', chatId)
        .neq('sender_id', user.id)
        .neq('status', 'read');
    } catch (err) { console.warn('markAsRead error:', err); }
  }, [chatId, user]);

  useEffect(() => {
    setMessages([]);
    setTypingUsers([]);
    if (!chatId || !user) return;

    fetchMessages();

    if (channelRef.current) supabase.removeChannel(channelRef.current);

    channelRef.current = supabase
      .channel(`messages-${chatId}-${user.id}`)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'messages',
        filter: `chat_id=eq.${chatId}`,
      }, async (payload) => {
        const newMsg = payload.new as Message;
        const senderProfile = await getProfile(newMsg.sender_id);
        const msgWithSender = { ...newMsg, sender: senderProfile };
        setMessages(prev => {
          if (prev.some(m => m.id === newMsg.id)) return prev;
          return [...prev, msgWithSender];
        });

        // Auto-mark as read if from other user and tab is focused
        if (newMsg.sender_id !== user.id && !document.hidden) {
          supabase.from('messages')
            .update({ status: 'read', read_at: new Date().toISOString() })
            .eq('id', newMsg.id).then(() => {});
        }

        if (document.hidden && newMsg.sender_id !== user.id) {
          const senderName = senderProfile?.display_name || 'Someone';
          showLocalNotification(`New message from ${senderName}`, newMsg.content || '📎 Attachment', chatId);
        }
      })
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public', table: 'messages',
        filter: `chat_id=eq.${chatId}`,
      }, (payload) => {
        setMessages(prev => prev.map(m => m.id === payload.new.id ? { ...m, ...payload.new } : m));
      })
      .on('postgres_changes', {
        event: 'DELETE', schema: 'public', table: 'messages',
        filter: `chat_id=eq.${chatId}`,
      }, (payload) => {
        setMessages(prev => prev.filter(m => m.id !== payload.old.id));
      })
      .on('broadcast', { event: 'typing' }, (payload) => {
        const { userId, displayName } = payload.payload as { userId: string; displayName: string };
        if (userId === user.id) return;
        setTypingUsers(prev => prev.includes(displayName) ? prev : [...prev, displayName]);
        const existing = typingTimers.current.get(userId);
        if (existing) clearTimeout(existing);
        const timer = setTimeout(() => {
          setTypingUsers(prev => prev.filter(n => n !== displayName));
          typingTimers.current.delete(userId);
        }, 3000);
        typingTimers.current.set(userId, timer);
      })
      .subscribe();

    return () => {
      if (channelRef.current) { supabase.removeChannel(channelRef.current); channelRef.current = null; }
      typingTimers.current.forEach(t => clearTimeout(t));
      typingTimers.current.clear();
    };
  }, [chatId, user, fetchMessages, getProfile]);

  const sendTypingIndicator = useCallback(async (displayName: string) => {
    if (!channelRef.current || !user) return;
    channelRef.current.send({ type: 'broadcast', event: 'typing', payload: { userId: user.id, displayName } });
  }, [user]);

  const sendMessage = async (content: string, type = 'text', fileData?: { file_url: string; file_name: string; file_type: string }) => {
    if (!chatId || !user) return false;
    const { error } = await supabase.from('messages').insert({
      chat_id: chatId, sender_id: user.id, content, type, status: 'sent', ...fileData,
    });
    if (error) { console.error('Error sending message:', error); return false; }
    return true;
  };

  const deleteMessage = async (messageId: string) => {
    await supabase.from('messages').delete().eq('id', messageId).eq('sender_id', user?.id || '');
  };

  const uploadFile = async (file: File): Promise<{ url: string; name: string; type: string } | null> => {
    if (!user) return null;
    const ext = file.name.split('.').pop();
    const path = `${user.id}/${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from('chat-files').upload(path, file);
    if (error) { console.error('Upload error:', error); return null; }
    const { data } = supabase.storage.from('chat-files').getPublicUrl(path);
    return { url: data.publicUrl, name: file.name, type: file.type };
  };

  return { messages, loading, typingUsers, sendMessage, sendTypingIndicator, deleteMessage, uploadFile, markAsRead };
};
