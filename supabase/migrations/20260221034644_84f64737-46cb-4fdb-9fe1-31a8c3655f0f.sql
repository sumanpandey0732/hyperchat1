
-- ============================================================
-- DEFINITIVE FIX: Drop ALL existing policies and recreate AS PERMISSIVE
-- Also recreate all triggers
-- ============================================================

-- ==================== CHATS ====================
DROP POLICY IF EXISTS "chats_select" ON public.chats;
DROP POLICY IF EXISTS "chats_insert" ON public.chats;
DROP POLICY IF EXISTS "chats_update" ON public.chats;
DROP POLICY IF EXISTS "chats_delete" ON public.chats;
DROP POLICY IF EXISTS "chats_delete_creator" ON public.chats;
DROP POLICY IF EXISTS "chats_insert_authenticated" ON public.chats;
DROP POLICY IF EXISTS "chats_select_members" ON public.chats;
DROP POLICY IF EXISTS "chats_update_members" ON public.chats;

CREATE POLICY "chats_select" ON public.chats AS PERMISSIVE FOR SELECT TO authenticated
  USING (is_chat_member(id, auth.uid()) OR created_by = auth.uid());

CREATE POLICY "chats_insert" ON public.chats AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "chats_update" ON public.chats AS PERMISSIVE FOR UPDATE TO authenticated
  USING (is_chat_member(id, auth.uid()));

CREATE POLICY "chats_delete" ON public.chats AS PERMISSIVE FOR DELETE TO authenticated
  USING (created_by = auth.uid());

-- ==================== CHAT_MEMBERS ====================
DROP POLICY IF EXISTS "chat_members_select" ON public.chat_members;
DROP POLICY IF EXISTS "chat_members_insert" ON public.chat_members;
DROP POLICY IF EXISTS "chat_members_delete" ON public.chat_members;

CREATE POLICY "chat_members_select" ON public.chat_members AS PERMISSIVE FOR SELECT TO authenticated
  USING (is_chat_member(chat_id, auth.uid()) OR user_id = auth.uid());

CREATE POLICY "chat_members_insert" ON public.chat_members AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() OR can_add_chat_member(chat_id, auth.uid()));

CREATE POLICY "chat_members_delete" ON public.chat_members AS PERMISSIVE FOR DELETE TO authenticated
  USING (user_id = auth.uid() OR can_add_chat_member(chat_id, auth.uid()));

-- ==================== MESSAGES ====================
DROP POLICY IF EXISTS "messages_select" ON public.messages;
DROP POLICY IF EXISTS "messages_insert" ON public.messages;
DROP POLICY IF EXISTS "messages_update" ON public.messages;
DROP POLICY IF EXISTS "messages_delete" ON public.messages;
DROP POLICY IF EXISTS "messages_delete_own" ON public.messages;
DROP POLICY IF EXISTS "messages_insert_members" ON public.messages;
DROP POLICY IF EXISTS "messages_select_members" ON public.messages;
DROP POLICY IF EXISTS "messages_update_own" ON public.messages;

CREATE POLICY "messages_select" ON public.messages AS PERMISSIVE FOR SELECT TO authenticated
  USING (is_chat_member(chat_id, auth.uid()));

CREATE POLICY "messages_insert" ON public.messages AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (is_chat_member(chat_id, auth.uid()) AND sender_id = auth.uid());

CREATE POLICY "messages_update" ON public.messages AS PERMISSIVE FOR UPDATE TO authenticated
  USING (sender_id = auth.uid());

CREATE POLICY "messages_delete" ON public.messages AS PERMISSIVE FOR DELETE TO authenticated
  USING (sender_id = auth.uid());

-- ==================== PROFILES ====================
DROP POLICY IF EXISTS "profiles_select" ON public.profiles;
DROP POLICY IF EXISTS "profiles_insert" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update" ON public.profiles;
DROP POLICY IF EXISTS "profiles_insert_own" ON public.profiles;
DROP POLICY IF EXISTS "profiles_select_all_authenticated" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;

CREATE POLICY "profiles_select" ON public.profiles AS PERMISSIVE FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "profiles_insert" ON public.profiles AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "profiles_update" ON public.profiles AS PERMISSIVE FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);

-- ==================== CONTACTS ====================
DROP POLICY IF EXISTS "contacts_select" ON public.contacts;
DROP POLICY IF EXISTS "contacts_insert" ON public.contacts;
DROP POLICY IF EXISTS "contacts_update" ON public.contacts;
DROP POLICY IF EXISTS "contacts_delete" ON public.contacts;
DROP POLICY IF EXISTS "contacts_delete_own" ON public.contacts;
DROP POLICY IF EXISTS "contacts_insert_own" ON public.contacts;
DROP POLICY IF EXISTS "contacts_select_own" ON public.contacts;
DROP POLICY IF EXISTS "contacts_update_own" ON public.contacts;

CREATE POLICY "contacts_select" ON public.contacts AS PERMISSIVE FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "contacts_insert" ON public.contacts AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "contacts_update" ON public.contacts AS PERMISSIVE FOR UPDATE TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "contacts_delete" ON public.contacts AS PERMISSIVE FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- ==================== CALLS ====================
DROP POLICY IF EXISTS "calls_select" ON public.calls;
DROP POLICY IF EXISTS "calls_insert" ON public.calls;
DROP POLICY IF EXISTS "calls_update" ON public.calls;
DROP POLICY IF EXISTS "calls_delete" ON public.calls;
DROP POLICY IF EXISTS "calls_delete_own" ON public.calls;
DROP POLICY IF EXISTS "calls_insert_authenticated" ON public.calls;
DROP POLICY IF EXISTS "calls_select_participants" ON public.calls;
DROP POLICY IF EXISTS "calls_update_participants" ON public.calls;

CREATE POLICY "calls_select" ON public.calls AS PERMISSIVE FOR SELECT TO authenticated
  USING (caller_id = auth.uid() OR callee_id = auth.uid() OR is_chat_member(chat_id, auth.uid()));

CREATE POLICY "calls_insert" ON public.calls AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (caller_id = auth.uid());

CREATE POLICY "calls_update" ON public.calls AS PERMISSIVE FOR UPDATE TO authenticated
  USING (caller_id = auth.uid() OR callee_id = auth.uid());

CREATE POLICY "calls_delete" ON public.calls AS PERMISSIVE FOR DELETE TO authenticated
  USING (caller_id = auth.uid());

-- ==================== TRIGGERS ====================
-- Drop and recreate triggers to ensure they exist

-- Auto-create profile on user signup
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Auto-update chats.updated_at on new message
DROP TRIGGER IF EXISTS on_message_insert_update_chat ON public.messages;
CREATE TRIGGER on_message_insert_update_chat
  AFTER INSERT ON public.messages
  FOR EACH ROW EXECUTE FUNCTION public.update_chat_on_message();

-- Auto-update profiles.updated_at
DROP TRIGGER IF EXISTS on_profile_update ON public.profiles;
CREATE TRIGGER on_profile_update
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ==================== REALTIME ====================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'chats'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.chats;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'calls'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.calls;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'chat_members'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_members;
  END IF;
END $$;
