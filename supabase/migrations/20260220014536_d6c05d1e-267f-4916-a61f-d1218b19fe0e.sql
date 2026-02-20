
-- ============================================================
-- HYPERCHAT: FULL FIX MIGRATION (without realtime duplicates)
-- ============================================================

-- 1. DROP ALL EXISTING RLS POLICIES
DROP POLICY IF EXISTS calls_select_participants ON public.calls;
DROP POLICY IF EXISTS calls_insert_authenticated ON public.calls;
DROP POLICY IF EXISTS calls_update_participants ON public.calls;

DROP POLICY IF EXISTS chat_members_select ON public.chat_members;
DROP POLICY IF EXISTS chat_members_insert ON public.chat_members;
DROP POLICY IF EXISTS chat_members_delete ON public.chat_members;

DROP POLICY IF EXISTS chats_insert_authenticated ON public.chats;
DROP POLICY IF EXISTS chats_select_members ON public.chats;
DROP POLICY IF EXISTS chats_update_members ON public.chats;
DROP POLICY IF EXISTS chats_delete_creator ON public.chats;

DROP POLICY IF EXISTS contacts_select_own ON public.contacts;
DROP POLICY IF EXISTS contacts_insert_own ON public.contacts;
DROP POLICY IF EXISTS contacts_delete_own ON public.contacts;

DROP POLICY IF EXISTS messages_select_members ON public.messages;
DROP POLICY IF EXISTS messages_insert_members ON public.messages;
DROP POLICY IF EXISTS messages_update_own ON public.messages;
DROP POLICY IF EXISTS messages_delete_own ON public.messages;

DROP POLICY IF EXISTS profiles_select_authenticated ON public.profiles;
DROP POLICY IF EXISTS profiles_insert_own ON public.profiles;
DROP POLICY IF EXISTS profiles_update_own ON public.profiles;

-- 2. RECREATE ALL RLS POLICIES AS PERMISSIVE

-- PROFILES
CREATE POLICY "profiles_select_all_authenticated" ON public.profiles
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "profiles_insert_own" ON public.profiles
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "profiles_update_own" ON public.profiles
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);

-- CHATS
CREATE POLICY "chats_insert_authenticated" ON public.chats
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by);

CREATE POLICY "chats_select_members" ON public.chats
  FOR SELECT TO authenticated USING (is_chat_member(id, auth.uid()));

CREATE POLICY "chats_update_members" ON public.chats
  FOR UPDATE TO authenticated USING (is_chat_member(id, auth.uid()));

CREATE POLICY "chats_delete_creator" ON public.chats
  FOR DELETE TO authenticated USING (created_by = auth.uid());

-- CHAT_MEMBERS security definer function
CREATE OR REPLACE FUNCTION public.can_add_chat_member(_chat_id uuid, _inserter_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.chats
    WHERE id = _chat_id AND created_by = _inserter_id
  ) OR EXISTS (
    SELECT 1 FROM public.chat_members
    WHERE chat_id = _chat_id AND user_id = _inserter_id AND role = 'admin'
  );
$$;

CREATE POLICY "chat_members_select" ON public.chat_members
  FOR SELECT TO authenticated USING (
    is_chat_member(chat_id, auth.uid()) OR user_id = auth.uid()
  );

CREATE POLICY "chat_members_insert" ON public.chat_members
  FOR INSERT TO authenticated WITH CHECK (
    user_id = auth.uid() OR can_add_chat_member(chat_id, auth.uid())
  );

CREATE POLICY "chat_members_delete" ON public.chat_members
  FOR DELETE TO authenticated USING (
    user_id = auth.uid() OR can_add_chat_member(chat_id, auth.uid())
  );

-- MESSAGES
CREATE POLICY "messages_select_members" ON public.messages
  FOR SELECT TO authenticated USING (is_chat_member(chat_id, auth.uid()));

CREATE POLICY "messages_insert_members" ON public.messages
  FOR INSERT TO authenticated WITH CHECK (
    is_chat_member(chat_id, auth.uid()) AND sender_id = auth.uid()
  );

CREATE POLICY "messages_update_own" ON public.messages
  FOR UPDATE TO authenticated USING (sender_id = auth.uid());

CREATE POLICY "messages_delete_own" ON public.messages
  FOR DELETE TO authenticated USING (sender_id = auth.uid());

-- CALLS
CREATE POLICY "calls_select_participants" ON public.calls
  FOR SELECT TO authenticated USING (
    caller_id = auth.uid() OR callee_id = auth.uid() OR is_chat_member(chat_id, auth.uid())
  );

CREATE POLICY "calls_insert_authenticated" ON public.calls
  FOR INSERT TO authenticated WITH CHECK (caller_id = auth.uid());

CREATE POLICY "calls_update_participants" ON public.calls
  FOR UPDATE TO authenticated USING (
    caller_id = auth.uid() OR callee_id = auth.uid()
  );

CREATE POLICY "calls_delete_own" ON public.calls
  FOR DELETE TO authenticated USING (caller_id = auth.uid());

-- CONTACTS
CREATE POLICY "contacts_select_own" ON public.contacts
  FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE POLICY "contacts_insert_own" ON public.contacts
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

CREATE POLICY "contacts_update_own" ON public.contacts
  FOR UPDATE TO authenticated USING (user_id = auth.uid());

CREATE POLICY "contacts_delete_own" ON public.contacts
  FOR DELETE TO authenticated USING (user_id = auth.uid());

-- 3. DATABASE TRIGGERS

-- Auto-create profile on user signup
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Auto-update updated_at on chats
DROP TRIGGER IF EXISTS update_chats_updated_at ON public.chats;
CREATE TRIGGER update_chats_updated_at
  BEFORE UPDATE ON public.chats
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Auto-update updated_at on profiles
DROP TRIGGER IF EXISTS update_profiles_updated_at ON public.profiles;
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Auto-update chat updated_at when new message inserted
CREATE OR REPLACE FUNCTION public.update_chat_on_message()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.chats SET updated_at = now() WHERE id = NEW.chat_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_new_message_update_chat ON public.messages;
CREATE TRIGGER on_new_message_update_chat
  AFTER INSERT ON public.messages
  FOR EACH ROW EXECUTE FUNCTION public.update_chat_on_message();

-- 4. INDEXES FOR PERFORMANCE
CREATE INDEX IF NOT EXISTS idx_messages_chat_id_created ON public.messages (chat_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_sender_id ON public.messages (sender_id);
CREATE INDEX IF NOT EXISTS idx_chat_members_user_id ON public.chat_members (user_id);
CREATE INDEX IF NOT EXISTS idx_chat_members_chat_id ON public.chat_members (chat_id);
CREATE INDEX IF NOT EXISTS idx_profiles_user_id ON public.profiles (user_id);
CREATE INDEX IF NOT EXISTS idx_chats_updated_at ON public.chats (updated_at DESC);
