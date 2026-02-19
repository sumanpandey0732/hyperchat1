
-- ================================================================
-- FIX 1: Create missing triggers (handle_new_user + updated_at)
-- ================================================================

-- Trigger: auto-create profile when new user signs up
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Trigger: auto-update updated_at on chats
DROP TRIGGER IF EXISTS update_chats_updated_at ON public.chats;
CREATE TRIGGER update_chats_updated_at
  BEFORE UPDATE ON public.chats
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Trigger: auto-update updated_at on profiles
DROP TRIGGER IF EXISTS update_profiles_updated_at ON public.profiles;
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ================================================================
-- FIX 2: Drop RESTRICTIVE policies and replace with PERMISSIVE ones
-- (RESTRICTIVE policies block even when other policies allow)
-- ================================================================

-- Drop ALL old policies on chat_members
DROP POLICY IF EXISTS "Chat creator can add members" ON public.chat_members;
DROP POLICY IF EXISTS "Members can leave chats" ON public.chat_members;
DROP POLICY IF EXISTS "Members can view chat members" ON public.chat_members;

-- Drop ALL old policies on chats
DROP POLICY IF EXISTS "Authenticated users can create chats" ON public.chats;
DROP POLICY IF EXISTS "Group admins can update chats" ON public.chats;
DROP POLICY IF EXISTS "Members can view their chats" ON public.chats;

-- Drop ALL old policies on messages
DROP POLICY IF EXISTS "Members can send messages" ON public.messages;
DROP POLICY IF EXISTS "Members can view messages" ON public.messages;
DROP POLICY IF EXISTS "Senders can delete own messages" ON public.messages;
DROP POLICY IF EXISTS "Senders can update own messages" ON public.messages;

-- Drop ALL old policies on profiles
DROP POLICY IF EXISTS "Anyone authenticated can view profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;

-- Drop old contact policies
DROP POLICY IF EXISTS "Users can add contacts" ON public.contacts;
DROP POLICY IF EXISTS "Users can delete own contacts" ON public.contacts;
DROP POLICY IF EXISTS "Users can view own contacts" ON public.contacts;

-- ================================================================
-- FIX 3: Re-create all policies as PERMISSIVE (default)
-- ================================================================

-- PROFILES policies
CREATE POLICY "profiles_select_authenticated"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "profiles_insert_own"
  ON public.profiles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "profiles_update_own"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

-- CHATS policies
CREATE POLICY "chats_insert_authenticated"
  ON public.chats FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "chats_select_members"
  ON public.chats FOR SELECT
  TO authenticated
  USING (is_chat_member(id, auth.uid()));

CREATE POLICY "chats_update_members"
  ON public.chats FOR UPDATE
  TO authenticated
  USING (is_chat_member(id, auth.uid()));

CREATE POLICY "chats_delete_creator"
  ON public.chats FOR DELETE
  TO authenticated
  USING (created_by = auth.uid());

-- CHAT_MEMBERS policies
CREATE POLICY "chat_members_select"
  ON public.chat_members FOR SELECT
  TO authenticated
  USING (is_chat_member(chat_id, auth.uid()) OR user_id = auth.uid());

CREATE POLICY "chat_members_insert"
  ON public.chat_members FOR INSERT
  TO authenticated
  WITH CHECK (
    -- The inserting user is the chat creator OR they are adding themselves
    (EXISTS (
      SELECT 1 FROM public.chats
      WHERE chats.id = chat_members.chat_id
        AND chats.created_by = auth.uid()
    ))
    OR (user_id = auth.uid())
  );

CREATE POLICY "chat_members_delete"
  ON public.chat_members FOR DELETE
  TO authenticated
  USING (user_id = auth.uid() OR is_chat_member(chat_id, auth.uid()));

-- MESSAGES policies
CREATE POLICY "messages_select_members"
  ON public.messages FOR SELECT
  TO authenticated
  USING (is_chat_member(chat_id, auth.uid()));

CREATE POLICY "messages_insert_members"
  ON public.messages FOR INSERT
  TO authenticated
  WITH CHECK (
    is_chat_member(chat_id, auth.uid())
    AND sender_id = auth.uid()
  );

CREATE POLICY "messages_update_own"
  ON public.messages FOR UPDATE
  TO authenticated
  USING (sender_id = auth.uid());

CREATE POLICY "messages_delete_own"
  ON public.messages FOR DELETE
  TO authenticated
  USING (sender_id = auth.uid());

-- CONTACTS policies
CREATE POLICY "contacts_select_own"
  ON public.contacts FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "contacts_insert_own"
  ON public.contacts FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "contacts_delete_own"
  ON public.contacts FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- ================================================================
-- FIX 4: Add calls table for WebRTC signaling
-- ================================================================
CREATE TABLE IF NOT EXISTS public.calls (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  chat_id uuid NOT NULL REFERENCES public.chats(id) ON DELETE CASCADE,
  caller_id uuid NOT NULL,
  callee_id uuid,
  call_type text NOT NULL DEFAULT 'audio', -- 'audio' | 'video'
  status text NOT NULL DEFAULT 'ringing',  -- 'ringing' | 'active' | 'ended' | 'declined' | 'missed'
  started_at timestamp with time zone NOT NULL DEFAULT now(),
  ended_at timestamp with time zone,
  sdp_offer text,
  sdp_answer text,
  ice_candidates jsonb DEFAULT '[]'::jsonb
);

ALTER TABLE public.calls ENABLE ROW LEVEL SECURITY;

CREATE POLICY "calls_select_participants"
  ON public.calls FOR SELECT
  TO authenticated
  USING (caller_id = auth.uid() OR callee_id = auth.uid() OR is_chat_member(chat_id, auth.uid()));

CREATE POLICY "calls_insert_authenticated"
  ON public.calls FOR INSERT
  TO authenticated
  WITH CHECK (caller_id = auth.uid());

CREATE POLICY "calls_update_participants"
  ON public.calls FOR UPDATE
  TO authenticated
  USING (caller_id = auth.uid() OR callee_id = auth.uid());

-- Enable realtime for calls
ALTER PUBLICATION supabase_realtime ADD TABLE public.calls;

-- ================================================================
-- FIX 5: Add realtime to messages and chat_members if not already
-- ================================================================
DO $$
BEGIN
  -- messages
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
  END IF;

  -- chat_members
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'chat_members'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_members;
  END IF;

  -- chats
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'chats'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.chats;
  END IF;

  -- profiles
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'profiles'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles;
  END IF;
END $$;
