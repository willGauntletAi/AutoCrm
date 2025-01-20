-- Enable RLS for tickets table
ALTER TABLE public.tickets ENABLE ROW LEVEL SECURITY;

-- Allow users to view tickets they created
CREATE POLICY "select_own_tickets"
ON public.tickets
FOR SELECT
USING (created_by = auth.uid());

-- Allow admins to view all tickets in their organizations
CREATE POLICY "select_org_tickets_if_admin"
ON public.tickets
FOR SELECT
USING (
  EXISTS (
    SELECT 1 
    FROM public.profile_organization_members
    WHERE profile_organization_members.profile_id = auth.uid()
      AND profile_organization_members.organization_id = tickets.organization_id
      AND profile_organization_members.role = 'admin'
  )
);

-- Allow workers to view all tickets in their organizations
CREATE POLICY "select_org_tickets_if_worker"
ON public.tickets
FOR SELECT
USING (
  EXISTS (
    SELECT 1 
    FROM public.profile_organization_members
    WHERE profile_organization_members.profile_id = auth.uid()
      AND profile_organization_members.organization_id = tickets.organization_id
      AND profile_organization_members.role = 'worker'
  )
);

-- Allow members to create tickets in their organizations
CREATE POLICY "insert_tickets_if_org_member"
ON public.tickets
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 
    FROM public.profile_organization_members
    WHERE profile_organization_members.profile_id = auth.uid()
      AND profile_organization_members.organization_id = tickets.organization_id
  )
);

-- Allow users to update their own tickets
CREATE POLICY "update_own_tickets"
ON public.tickets
FOR UPDATE
USING (created_by = auth.uid())
WITH CHECK (created_by = auth.uid());

-- Allow admins to update any ticket in their organizations
CREATE POLICY "update_org_tickets_if_admin"
ON public.tickets
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 
    FROM public.profile_organization_members
    WHERE profile_organization_members.profile_id = auth.uid()
      AND profile_organization_members.organization_id = tickets.organization_id
      AND profile_organization_members.role = 'admin'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 
    FROM public.profile_organization_members
    WHERE profile_organization_members.profile_id = auth.uid()
      AND profile_organization_members.organization_id = tickets.organization_id
      AND profile_organization_members.role = 'admin'
  )
); 