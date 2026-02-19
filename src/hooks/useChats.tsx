import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import type { Profile } from '@/contexts/AuthContext';

export type MessagePreview = {
  id: string;
  content: string | null;
  type: string;
  sender_id: string;
  created_at: string;
};

export type ChatWithMeta = {
  id: string;
  is_group: boolean;
  group_name: string | null;
  group_avatar_url: string | null;
  created_by: string | null;
  created_at: string;
  members: Profile[];
  last_message: MessagePreview | null;
  unread_count: number;
};

export const useChats = () => {
  const { user } = useAuth();
  const [chats, setChats] = useState<ChatWithMeta[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchChats = useCallback(async () => {
    if (!user) return;
    setLoading(true);

    // Get all chat IDs where user is member
    const { data: memberRows } = await supabase
      .from('chat_members')
      .select('chat_id')
      .eq('user_id', user.id);

    if (!memberRows || memberRows.length === 0) {
      setChats([]);
      setLoading(false);
      return;
    }

    const chatIds = memberRows.map(r => r.chat_id);

    // Get chats
    const { data: chatData } = await supabase
      .from('chats')
      .select('*')
      .in('id', chatIds)
      .order('updated_at', { ascending: false });

    if (!chatData) { setLoading(false); return; }

    // Get all members for these chats
    const { data: allMembers } = await supabase
      .from('chat_members')
      .select('chat_id, user_id')
      .in('chat_id', chatIds);

    // Get profiles for all member user_ids
    const memberUserIds = [...new Set((allMembers || []).map(m => m.user_id))];
    const { data: profiles } = await supabase
      .from('profiles')
      .select('*')
      .in('user_id', memberUserIds);

    // Get last message for each chat
    const lastMessages: Record<string, MessagePreview> = {};
    for (const chatId of chatIds) {
      const { data: msgs } = await supabase
        .from('messages')
        .select('id, content, type, sender_id, created_at')
        .eq('chat_id', chatId)
        .order('created_at', { ascending: false })
        .limit(1);
      if (msgs && msgs.length > 0) {
        lastMessages[chatId] = msgs[0] as MessagePreview;
      }
    }

    const profileMap = new Map((profiles || []).map(p => [p.user_id, p as Profile]));
    const memberMap = new Map<string, Profile[]>();
    for (const m of allMembers || []) {
      if (!memberMap.has(m.chat_id)) memberMap.set(m.chat_id, []);
      const prof = profileMap.get(m.user_id);
      if (prof && m.user_id !== user.id) memberMap.get(m.chat_id)!.push(prof);
    }

    const result: ChatWithMeta[] = chatData.map(chat => ({
      ...chat,
      members: memberMap.get(chat.id) || [],
      last_message: lastMessages[chat.id] || null,
      unread_count: 0,
    }));

    // Sort by last message time
    result.sort((a, b) => {
      const at = a.last_message?.created_at || a.created_at;
      const bt = b.last_message?.created_at || b.created_at;
      return new Date(bt).getTime() - new Date(at).getTime();
    });

    setChats(result);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    fetchChats();
  }, [fetchChats]);

  // Real-time subscription for new messages
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel('chats-realtime')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, () => {
        fetchChats();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'chats' }, () => {
        fetchChats();
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_members' }, () => {
        fetchChats();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user, fetchChats]);

  const createDirectChat = async (contactUserId: string): Promise<string | null> => {
    if (!user) return null;

    // Check if DM already exists
    const { data: myChats } = await supabase
      .from('chat_members').select('chat_id').eq('user_id', user.id);
    const { data: theirChats } = await supabase
      .from('chat_members').select('chat_id').eq('user_id', contactUserId);

    const myChatIds = new Set((myChats || []).map(r => r.chat_id));
    const sharedChat = (theirChats || []).find(r => myChatIds.has(r.chat_id));

    if (sharedChat) {
      // Verify it's a DM
      const { data: chat } = await supabase
        .from('chats').select('*').eq('id', sharedChat.chat_id).single();
      if (chat && !chat.is_group) return sharedChat.chat_id;
    }

    // Create new DM chat
    const { data: newChat, error: chatError } = await supabase
      .from('chats')
      .insert({ 
        is_group: false, 
        created_by: user.id,
        updated_at: new Date().toISOString()
      })
      .select()
      .single();

    if (chatError || !newChat) {
      console.error('Detailed Chat Creation Error:', chatError);
      return null;
    }

    // Add both members
    const { error: membersError } = await supabase.from('chat_members').insert([
      { chat_id: newChat.id, user_id: user.id, role: 'admin' },
      { chat_id: newChat.id, user_id: contactUserId, role: 'member' },
    ]);

    if (membersError) {
      console.error('Detailed Member Addition Error:', membersError);
      // Cleanup
      await supabase.from('chats').delete().eq('id', newChat.id);
      return null;
    }

    await fetchChats();
    return newChat.id;
  };

  const createGroupChat = async (name: string, memberIds: string[]): Promise<string | null> => {
    if (!user) return null;

    const { data: newChat, error: chatError } = await supabase
      .from('chats')
      .insert({ is_group: true, group_name: name, created_by: user.id })
      .select()
      .single();

    if (chatError || !newChat) {
      console.error('Error creating group chat:', chatError);
      return null;
    }

    const members = [
      { chat_id: newChat.id, user_id: user.id, role: 'admin' },
      ...memberIds.map(id => ({ chat_id: newChat.id, user_id: id, role: 'member' })),
    ];
    
    const { error: membersError } = await supabase.from('chat_members').insert(members);
    
    if (membersError) {
      console.error('Error adding group members:', membersError);
      await supabase.from('chats').delete().eq('id', newChat.id);
      return null;
    }

    await fetchChats();
    return newChat.id;
  };

  return { chats, loading, fetchChats, createDirectChat, createGroupChat };
};
