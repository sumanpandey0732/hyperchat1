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
  created_at: string;
  sender?: Profile;
};

export const useMessages = (chatId: string | null) => {
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [typing, setTyping] = useState<string[]>([]);
  const typingTimerRef = useRef<NodeJS.Timeout>();
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  const fetchMessages = useCallback(async () => {
    if (!chatId) return;
    setLoading(true);
    const { data } = await supabase
      .from('messages')
      .select('*')
      .eq('chat_id', chatId)
      .order('created_at', { ascending: true })
      .limit(100);

    if (data) {
      // Get sender profiles
      const senderIds = [...new Set(data.map(m => m.sender_id))];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('*')
        .in('user_id', senderIds);

      const profileMap = new Map((profiles || []).map(p => [p.user_id, p as Profile]));
      const msgs = data.map(m => ({
        ...m,
        sender: profileMap.get(m.sender_id),
      })) as Message[];
      setMessages(msgs);
    }
    setLoading(false);
  }, [chatId]);

  useEffect(() => {
    setMessages([]);
    if (!chatId) return;
    fetchMessages();

    // Real-time subscription
    channelRef.current = supabase
      .channel(`messages-${chatId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `chat_id=eq.${chatId}`,
      }, async (payload) => {
        const newMsg = payload.new as Message;
        // Get sender profile
        const { data: profile } = await supabase
          .from('profiles')
          .select('*')
          .eq('user_id', newMsg.sender_id)
          .single();

        const msgWithSender = { ...newMsg, sender: profile as Profile };
        setMessages(prev => [...prev, msgWithSender]);

        // Push notification if tab not focused
        if (document.hidden && newMsg.sender_id !== user?.id) {
          const senderName = (profile as Profile)?.display_name || 'Someone';
          showLocalNotification(
            `New message from ${senderName}`,
            newMsg.content || '📎 Attachment',
            chatId || undefined
          );
        }
      })
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'messages',
        filter: `chat_id=eq.${chatId}`,
      }, (payload) => {
        setMessages(prev => prev.map(m =>
          m.id === payload.new.id ? { ...m, ...payload.new } : m
        ));
      })
      .on('postgres_changes', {
        event: 'DELETE',
        schema: 'public',
        table: 'messages',
        filter: `chat_id=eq.${chatId}`,
      }, (payload) => {
        setMessages(prev => prev.filter(m => m.id !== payload.old.id));
      })
      .subscribe();

    return () => {
      if (channelRef.current) supabase.removeChannel(channelRef.current);
    };
  }, [chatId, fetchMessages, user]);

  const sendMessage = async (content: string, type = 'text', fileData?: {
    file_url: string;
    file_name: string;
    file_type: string;
  }) => {
    if (!chatId || !user) return;
    const { error } = await supabase.from('messages').insert({
      chat_id: chatId,
      sender_id: user.id,
      content,
      type,
      ...fileData,
    });
    return !error;
  };

  const deleteMessage = async (messageId: string) => {
    await supabase.from('messages').delete().eq('id', messageId);
  };

  const uploadFile = async (file: File): Promise<{ url: string; name: string; type: string } | null> => {
    if (!user) return null;
    const ext = file.name.split('.').pop();
    const path = `${user.id}/${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from('chat-files').upload(path, file);
    if (error) return null;
    const { data } = supabase.storage.from('chat-files').getPublicUrl(path);
    return { url: data.publicUrl, name: file.name, type: file.type };
  };

  return { messages, loading, typing, sendMessage, deleteMessage, uploadFile };
};
