-- There is no specific function or class here, but this file sets up RLS for our tables.

-- Enable Row-Level Security for each table that should be restricted.
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profile_organization_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ticket_comments ENABLE ROW LEVEL SECURITY;

------------------------------------------------------------------------------
-- Example Policy: Only allow SELECT on tickets if user is a member 
-- of the organization for that ticket.
------------------------------------------------------------------------------

-- 1. Policy for 'tickets' SELECT. 
--    Checks if the user is a member of the org referenced by the ticket.
CREATE POLICY "select_tickets_if_org_member"
ON public.tickets
FOR SELECT
USING (
  EXISTS (
    SELECT 1 
    FROM public.profile_organization_members
    WHERE profile_organization_members.profile_id = auth.uid()
      AND profile_organization_members.organization_id = tickets.organization_id
  )
);

-- 2. Similarly, you can create policies for INSERT, UPDATE, DELETE 
--    to ensure the user can only write data for organizations they belong to.
-- Example for INSERT:
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

-- 3. Optionally add separate RLS policies for 'ticket_comments', 'organizations',
--    or 'profile_organization_members' to match your requirements.

-- Example policy for 'ticket_comments' SELECT:
CREATE POLICY "select_comments_if_org_member"
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
  )
);

-- Enable RLS for profiles table
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Allow users to view their own profile
CREATE POLICY "users_can_view_own_profile"
ON public.profiles
FOR SELECT
USING (auth.uid() = id);

-- Allow users to update their own profile
CREATE POLICY "users_can_update_own_profile"
ON public.profiles
FOR UPDATE
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- Allow users to insert their own profile
CREATE POLICY "users_can_insert_own_profile"
ON public.profiles
FOR INSERT
WITH CHECK (auth.uid() = id);

-- Allow users to delete their own profile
CREATE POLICY "users_can_delete_own_profile"
ON public.profiles
FOR DELETE
USING (auth.uid() = id);

-- Organizations policies
-- Allow members to view organizations they belong to
CREATE POLICY "view_organizations_if_member"
ON public.organizations
FOR SELECT
USING (
  EXISTS (
    SELECT 1 
    FROM public.profile_organization_members
    WHERE profile_organization_members.organization_id = organizations.id
    AND profile_organization_members.profile_id = auth.uid()
  )
);

-- Allow anyone to create organizations
CREATE POLICY "anyone_can_create_organizations"
ON public.organizations
FOR INSERT
WITH CHECK (true);

-- Allow only admins to update organizations
CREATE POLICY "admins_can_update_organizations"
ON public.organizations
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 
    FROM public.profile_organization_members
    WHERE profile_organization_members.organization_id = organizations.id
    AND profile_organization_members.profile_id = auth.uid()
    AND profile_organization_members.role = 'admin'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 
    FROM public.profile_organization_members
    WHERE profile_organization_members.organization_id = organizations.id
    AND profile_organization_members.profile_id = auth.uid()
    AND profile_organization_members.role = 'admin'
  )
);

-- Allow only admins to delete organizations
CREATE POLICY "admins_can_delete_organizations"
ON public.organizations
FOR DELETE
USING (
  EXISTS (
    SELECT 1 
    FROM public.profile_organization_members
    WHERE profile_organization_members.organization_id = organizations.id
    AND profile_organization_members.profile_id = auth.uid()
    AND profile_organization_members.role = 'admin'
  )
); 