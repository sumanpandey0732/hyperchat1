import { useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import type { Profile } from '@/contexts/AuthContext';

export type MessagePreview = {
  id: string;
  content: string | null;
  type: string;
  sender_id: string;
  created_at: string;
  status: string | null;
};

export type ChatWithMeta = {
  id: string;
  is_group: boolean;
  group_name: string | null;
  group_avatar_url: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  members: Profile[];
  last_message: MessagePreview | null;
  unread_count: number;
};

export const useChats = () => {
  const { user } = useAuth();
  const [chats, setChats] = useState<ChatWithMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const fetchingRef = useRef(false);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  const fetchChats = useCallback(async () => {
    if (!user || fetchingRef.current) return;
    fetchingRef.current = true;

    try {
      const { data: memberRows, error: memberErr } = await supabase
        .from('chat_members').select('chat_id').eq('user_id', user.id);

      if (memberErr) { console.error('Error fetching chat memberships:', memberErr); setLoading(false); return; }
      if (!memberRows || memberRows.length === 0) { setChats([]); setLoading(false); return; }

      const chatIds = memberRows.map(r => r.chat_id);

      const [chatsRes, allMembersRes] = await Promise.all([
        supabase.from('chats').select('*').in('id', chatIds).order('updated_at', { ascending: false }),
        supabase.from('chat_members').select('chat_id, user_id').in('chat_id', chatIds),
      ]);

      const chatData = chatsRes.data;
      const allMembers = allMembersRes.data || [];
      if (!chatData) { setLoading(false); return; }

      const memberUserIds = [...new Set(allMembers.map(m => m.user_id))];
      const { data: profiles } = await supabase.from('profiles').select('*').in('user_id', memberUserIds);

      // Get last messages + unread counts
      const [lastMsgResults, unreadResults] = await Promise.all([
        Promise.all(chatIds.map(chatId =>
          supabase.from('messages').select('id, content, type, sender_id, created_at, status')
            .eq('chat_id', chatId).order('created_at', { ascending: false }).limit(1)
            .then(res => ({ chatId, msg: res.data?.[0] || null }))
        )),
        Promise.all(chatIds.map(chatId =>
          supabase.from('messages').select('id', { count: 'exact', head: true })
            .eq('chat_id', chatId).neq('sender_id', user.id).neq('status', 'read')
            .then(res => ({ chatId, count: res.count || 0 }))
        )),
      ]);

      const lastMessages: Record<string, MessagePreview> = {};
      for (const { chatId, msg } of lastMsgResults) {
        if (msg) lastMessages[chatId] = msg as MessagePreview;
      }

      const unreadMap: Record<string, number> = {};
      for (const { chatId, count } of unreadResults) {
        unreadMap[chatId] = count;
      }

      const profileMap = new Map((profiles || []).map(p => [p.user_id, p as Profile]));
      const memberMap = new Map<string, Profile[]>();
      for (const m of allMembers) {
        if (!memberMap.has(m.chat_id)) memberMap.set(m.chat_id, []);
        const prof = profileMap.get(m.user_id);
        if (prof) memberMap.get(m.chat_id)!.push(prof);
      }

      const result: ChatWithMeta[] = chatData.map(chat => ({
        ...chat, is_group: chat.is_group || false,
        members: (memberMap.get(chat.id) || []).filter(p => p.user_id !== user.id),
        last_message: lastMessages[chat.id] || null,
        unread_count: unreadMap[chat.id] || 0,
      }));

      result.sort((a, b) => {
        const at = a.last_message?.created_at || a.updated_at || a.created_at;
        const bt = b.last_message?.created_at || b.updated_at || b.created_at;
        return new Date(bt).getTime() - new Date(at).getTime();
      });

      setChats(result);
    } catch (err) { console.error('fetchChats error:', err); }
    finally { setLoading(false); fetchingRef.current = false; }
  }, [user]);

  useEffect(() => {
    if (!user) { setLoading(false); return; }
    fetchChats();
  }, [fetchChats, user]);

  useEffect(() => {
    if (!user) return;
    let debounceTimer: NodeJS.Timeout;
    const debouncedFetch = () => { clearTimeout(debounceTimer); debounceTimer = setTimeout(fetchChats, 400); };

    if (channelRef.current) supabase.removeChannel(channelRef.current);

    channelRef.current = supabase
      .channel(`chats-realtime-${user.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, debouncedFetch)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'messages' }, debouncedFetch)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'chats' }, debouncedFetch)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_members' }, debouncedFetch)
      .subscribe();

    return () => {
      clearTimeout(debounceTimer);
      if (channelRef.current) { supabase.removeChannel(channelRef.current); channelRef.current = null; }
    };
  }, [user, fetchChats]);

  const createDirectChat = async (contactUserId: string): Promise<string | null> => {
    if (!user) return null;
    try {
      const { data: myChats } = await supabase.from('chat_members').select('chat_id').eq('user_id', user.id);
      const { data: theirChats } = await supabase.from('chat_members').select('chat_id').eq('user_id', contactUserId);
      const myChatIds = new Set((myChats || []).map(r => r.chat_id));
      const sharedChats = (theirChats || []).filter(r => myChatIds.has(r.chat_id));

      for (const shared of sharedChats) {
        const { data: chat } = await supabase.from('chats').select('*').eq('id', shared.chat_id).single();
        if (chat && !chat.is_group) return shared.chat_id;
      }

      const { data: newChat, error: chatError } = await supabase.from('chats')
        .insert({ is_group: false, created_by: user.id }).select().single();
      if (chatError || !newChat) { console.error('Chat creation failed:', chatError); return null; }

      const { error: creatorErr } = await supabase.from('chat_members').insert({ chat_id: newChat.id, user_id: user.id, role: 'admin' });
      if (creatorErr) { console.error('Creator member insert failed:', creatorErr); await supabase.from('chats').delete().eq('id', newChat.id); return null; }

      await supabase.from('chat_members').insert({ chat_id: newChat.id, user_id: contactUserId, role: 'member' });

      await fetchChats();
      return newChat.id;
    } catch (err) { console.error('createDirectChat exception:', err); return null; }
  };

  const createGroupChat = async (name: string, memberIds: string[]): Promise<string | null> => {
    if (!user) return null;
    try {
      const { data: newChat, error: chatError } = await supabase.from('chats')
        .insert({ is_group: true, group_name: name, created_by: user.id }).select().single();
      if (chatError || !newChat) { console.error('Group creation failed:', chatError); return null; }

      await supabase.from('chat_members').insert({ chat_id: newChat.id, user_id: user.id, role: 'admin' });
      for (const id of memberIds) {
        await supabase.from('chat_members').insert({ chat_id: newChat.id, user_id: id, role: 'member' });
      }
      await fetchChats();
      return newChat.id;
    } catch (err) { console.error('createGroupChat exception:', err); return null; }
  };

  return { chats, loading, fetchChats, createDirectChat, createGroupChat };
};
