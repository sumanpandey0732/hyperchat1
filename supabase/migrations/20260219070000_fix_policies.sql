-- Allow authenticated users to insert into chat_members for chats they just created
-- The existing policy had a potential race condition or visibility issue with subqueries
DROP POLICY IF EXISTS "Chat creator can add members" ON public.chat_members;
CREATE POLICY "Chat creator can add members" ON public.chat_members FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.chats 
    WHERE id = chat_members.chat_id 
    AND created_by = auth.uid()
  )
  OR user_id = auth.uid()
);

-- Ensure authenticated users can always create chats
DROP POLICY IF EXISTS "Authenticated users can create chats" ON public.chats;
CREATE POLICY "Authenticated users can create chats" ON public.chats FOR INSERT TO authenticated
WITH CHECK (true);

-- Ensure updated_at is handled if not by trigger
-- (Optional but good practice if you see nulls)
