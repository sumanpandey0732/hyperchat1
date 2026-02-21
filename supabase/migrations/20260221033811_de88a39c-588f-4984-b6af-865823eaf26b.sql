
-- ============================================================
-- FIX: Drop ALL restrictive policies and recreate as PERMISSIVE
-- Also create missing triggers
-- ============================================================

-- ==================== CHATS ====================
DROP POLICY IF EXISTS "chats_delete_creator" ON public.chats;
DROP POLICY IF EXISTS "chats_insert_authenticated" ON public.chats;
DROP POLICY IF EXISTS "chats_select_members" ON public.chats;
DROP POLICY IF EXISTS "chats_update_members" ON public.chats;

CREATE POLICY "chats_select" ON public.chats FOR SELECT TO authenticated
  USING (is_chat_member(id, auth.uid()) OR created_by = auth.uid());

CREATE POLICY "chats_insert" ON public.chats FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "chats_update" ON public.chats FOR UPDATE TO authenticated
  USING (is_chat_member(id, auth.uid()));

CREATE POLICY "chats_delete" ON public.chats FOR DELETE TO authenticated
  USING (created_by = auth.uid());

-- ==================== CHAT_MEMBERS ====================
DROP POLICY IF EXISTS "chat_members_delete" ON public.chat_members;
DROP POLICY IF EXISTS "chat_members_insert" ON public.chat_members;
DROP POLICY IF EXISTS "chat_members_select" ON public.chat_members;

CREATE POLICY "chat_members_select" ON public.chat_members FOR SELECT TO authenticated
  USING (is_chat_member(chat_id, auth.uid()) OR user_id = auth.uid());

CREATE POLICY "chat_members_insert" ON public.chat_members FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() OR can_add_chat_member(chat_id, auth.uid()));

CREATE POLICY "chat_members_delete" ON public.chat_members FOR DELETE TO authenticated
  USING (user_id = auth.uid() OR can_add_chat_member(chat_id, auth.uid()));

-- ==================== MESSAGES ====================
DROP POLICY IF EXISTS "messages_delete_own" ON public.messages;
DROP POLICY IF EXISTS "messages_insert_members" ON public.messages;
DROP POLICY IF EXISTS "messages_select_members" ON public.messages;
DROP POLICY IF EXISTS "messages_update_own" ON public.messages;

CREATE POLICY "messages_select" ON public.messages FOR SELECT TO authenticated
  USING (is_chat_member(chat_id, auth.uid()));

CREATE POLICY "messages_insert" ON public.messages FOR INSERT TO authenticated
  WITH CHECK (is_chat_member(chat_id, auth.uid()) AND sender_id = auth.uid());

CREATE POLICY "messages_update" ON public.messages FOR UPDATE TO authenticated
  USING (sender_id = auth.uid());

CREATE POLICY "messages_delete" ON public.messages FOR DELETE TO authenticated
  USING (sender_id = auth.uid());

-- ==================== PROFILES ====================
DROP POLICY IF EXISTS "profiles_insert_own" ON public.profiles;
DROP POLICY IF EXISTS "profiles_select_all_authenticated" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;

CREATE POLICY "profiles_select" ON public.profiles FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "profiles_insert" ON public.profiles FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "profiles_update" ON public.profiles FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);

-- ==================== CONTACTS ====================
DROP POLICY IF EXISTS "contacts_delete_own" ON public.contacts;
DROP POLICY IF EXISTS "contacts_insert_own" ON public.contacts;
DROP POLICY IF EXISTS "contacts_select_own" ON public.contacts;
DROP POLICY IF EXISTS "contacts_update_own" ON public.contacts;

CREATE POLICY "contacts_select" ON public.contacts FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "contacts_insert" ON public.contacts FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "contacts_update" ON public.contacts FOR UPDATE TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "contacts_delete" ON public.contacts FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- ==================== CALLS ====================
DROP POLICY IF EXISTS "calls_delete_own" ON public.calls;
DROP POLICY IF EXISTS "calls_insert_authenticated" ON public.calls;
DROP POLICY IF EXISTS "calls_select_participants" ON public.calls;
DROP POLICY IF EXISTS "calls_update_participants" ON public.calls;

CREATE POLICY "calls_select" ON public.calls FOR SELECT TO authenticated
  USING (caller_id = auth.uid() OR callee_id = auth.uid() OR is_chat_member(chat_id, auth.uid()));

CREATE POLICY "calls_insert" ON public.calls FOR INSERT TO authenticated
  WITH CHECK (caller_id = auth.uid());

CREATE POLICY "calls_update" ON public.calls FOR UPDATE TO authenticated
  USING (caller_id = auth.uid() OR callee_id = auth.uid());

CREATE POLICY "calls_delete" ON public.calls FOR DELETE TO authenticated
  USING (caller_id = auth.uid());

-- ==================== MISSING TRIGGERS ====================

-- Auto-create profile on signup
CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Auto-update chats.updated_at when a message is sent
CREATE OR REPLACE TRIGGER on_message_insert_update_chat
  AFTER INSERT ON public.messages
  FOR EACH ROW EXECUTE FUNCTION public.update_chat_on_message();

-- Auto-update updated_at on profiles
CREATE OR REPLACE TRIGGER on_profile_update
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Enable realtime for key tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.chats;
ALTER PUBLICATION supabase_realtime ADD TABLE public.calls;
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_members;
