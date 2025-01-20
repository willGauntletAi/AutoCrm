-- Enable RLS for ticket comments table
ALTER TABLE public.ticket_comments ENABLE ROW LEVEL SECURITY;

-- Allow users to view comments on their own tickets
CREATE POLICY "select_comments_on_own_tickets"
ON public.ticket_comments
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.tickets
    WHERE tickets.id = ticket_comments.ticket_id
      AND tickets.created_by = auth.uid()
  )
);

-- Allow admins to view comments on all tickets in their organizations
CREATE POLICY "select_comments_if_admin"
ON public.ticket_comments
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.tickets
    JOIN public.profile_organization_members
      ON tickets.organization_id = profile_organization_members.organization_id
    WHERE tickets.id = ticket_comments.ticket_id
      AND profile_organization_members.profile_id = auth.uid()
      AND profile_organization_members.role = 'admin'
  )
);

-- Allow workers to view comments on all tickets in their organizations
CREATE POLICY "select_comments_if_worker"
ON public.ticket_comments
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.tickets
    JOIN public.profile_organization_members
      ON tickets.organization_id = profile_organization_members.organization_id
    WHERE tickets.id = ticket_comments.ticket_id
      AND profile_organization_members.profile_id = auth.uid()
      AND profile_organization_members.role = 'worker'
  )
);

-- Allow users to comment on their own tickets
CREATE POLICY "insert_comments_on_own_tickets"
ON public.ticket_comments
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.tickets
    WHERE tickets.id = ticket_comments.ticket_id
      AND tickets.created_by = auth.uid()
  )
);

-- Allow admins to comment on any ticket in their organizations
CREATE POLICY "insert_comments_if_admin"
ON public.ticket_comments
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.tickets
    JOIN public.profile_organization_members
      ON tickets.organization_id = profile_organization_members.organization_id
    WHERE tickets.id = ticket_comments.ticket_id
      AND profile_organization_members.profile_id = auth.uid()
      AND profile_organization_members.role = 'admin'
  )
);

-- Allow workers to comment on any ticket in their organizations
CREATE POLICY "insert_comments_if_worker"
ON public.ticket_comments
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.tickets
    JOIN public.profile_organization_members
      ON tickets.organization_id = profile_organization_members.organization_id
    WHERE tickets.id = ticket_comments.ticket_id
      AND profile_organization_members.profile_id = auth.uid()
      AND profile_organization_members.role = 'worker'
  )
);

-- Allow users to update their own comments
CREATE POLICY "update_own_comments"
ON public.ticket_comments
FOR UPDATE
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- Allow users to delete their own comments
CREATE POLICY "delete_own_comments"
ON public.ticket_comments
FOR DELETE
USING (user_id = auth.uid()); 