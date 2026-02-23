
-- Fix RLS policies, triggers, read_at, indexes (without duplicate realtime)

-- Drop ALL existing policies
DROP POLICY IF EXISTS "chats_select" ON public.chats;
DROP POLICY IF EXISTS "chats_insert" ON public.chats;
DROP POLICY IF EXISTS "chats_update" ON public.chats;
DROP POLICY IF EXISTS "chats_delete" ON public.chats;
DROP POLICY IF EXISTS "chat_members_select" ON public.chat_members;
DROP POLICY IF EXISTS "chat_members_insert" ON public.chat_members;
DROP POLICY IF EXISTS "chat_members_delete" ON public.chat_members;
DROP POLICY IF EXISTS "messages_select" ON public.messages;
DROP POLICY IF EXISTS "messages_insert" ON public.messages;
DROP POLICY IF EXISTS "messages_update" ON public.messages;
DROP POLICY IF EXISTS "messages_delete" ON public.messages;
DROP POLICY IF EXISTS "profiles_select" ON public.profiles;
DROP POLICY IF EXISTS "profiles_insert" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update" ON public.profiles;
DROP POLICY IF EXISTS "contacts_select" ON public.contacts;
DROP POLICY IF EXISTS "contacts_insert" ON public.contacts;
DROP POLICY IF EXISTS "contacts_update" ON public.contacts;
DROP POLICY IF EXISTS "contacts_delete" ON public.contacts;
DROP POLICY IF EXISTS "calls_select" ON public.calls;
DROP POLICY IF EXISTS "calls_insert" ON public.calls;
DROP POLICY IF EXISTS "calls_update" ON public.calls;
DROP POLICY IF EXISTS "calls_delete" ON public.calls;

-- Recreate ALL as PERMISSIVE
CREATE POLICY "chats_select" ON public.chats FOR SELECT USING (is_chat_member(id, auth.uid()) OR created_by = auth.uid());
CREATE POLICY "chats_insert" ON public.chats FOR INSERT WITH CHECK (auth.uid() = created_by);
CREATE POLICY "chats_update" ON public.chats FOR UPDATE USING (is_chat_member(id, auth.uid()));
CREATE POLICY "chats_delete" ON public.chats FOR DELETE USING (created_by = auth.uid());

CREATE POLICY "chat_members_select" ON public.chat_members FOR SELECT USING (is_chat_member(chat_id, auth.uid()) OR user_id = auth.uid());
CREATE POLICY "chat_members_insert" ON public.chat_members FOR INSERT WITH CHECK (user_id = auth.uid() OR can_add_chat_member(chat_id, auth.uid()));
CREATE POLICY "chat_members_delete" ON public.chat_members FOR DELETE USING (user_id = auth.uid() OR can_add_chat_member(chat_id, auth.uid()));

CREATE POLICY "messages_select" ON public.messages FOR SELECT USING (is_chat_member(chat_id, auth.uid()));
CREATE POLICY "messages_insert" ON public.messages FOR INSERT WITH CHECK (is_chat_member(chat_id, auth.uid()) AND sender_id = auth.uid());
CREATE POLICY "messages_update" ON public.messages FOR UPDATE USING (is_chat_member(chat_id, auth.uid()));
CREATE POLICY "messages_delete" ON public.messages FOR DELETE USING (sender_id = auth.uid());

CREATE POLICY "profiles_select" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "profiles_insert" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "profiles_update" ON public.profiles FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "contacts_select" ON public.contacts FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "contacts_insert" ON public.contacts FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "contacts_update" ON public.contacts FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "contacts_delete" ON public.contacts FOR DELETE USING (user_id = auth.uid());

CREATE POLICY "calls_select" ON public.calls FOR SELECT USING (caller_id = auth.uid() OR callee_id = auth.uid() OR is_chat_member(chat_id, auth.uid()));
CREATE POLICY "calls_insert" ON public.calls FOR INSERT WITH CHECK (caller_id = auth.uid());
CREATE POLICY "calls_update" ON public.calls FOR UPDATE USING (caller_id = auth.uid() OR callee_id = auth.uid());
CREATE POLICY "calls_delete" ON public.calls FOR DELETE USING (caller_id = auth.uid());

-- Add read_at column
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS read_at timestamptz DEFAULT NULL;

-- Create triggers
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

DROP TRIGGER IF EXISTS on_message_insert ON public.messages;
CREATE TRIGGER on_message_insert AFTER INSERT ON public.messages FOR EACH ROW EXECUTE FUNCTION public.update_chat_on_message();

DROP TRIGGER IF EXISTS on_profile_update ON public.profiles;
CREATE TRIGGER on_profile_update BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_messages_chat_created ON public.messages(chat_id, created_at);
CREATE INDEX IF NOT EXISTS idx_chat_members_user ON public.chat_members(user_id);
CREATE INDEX IF NOT EXISTS idx_messages_status ON public.messages(chat_id, sender_id, status);
