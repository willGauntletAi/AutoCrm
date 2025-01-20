-- Enable RLS for profile_organization_members table
ALTER TABLE public.profile_organization_members ENABLE ROW LEVEL SECURITY;

-- Allow users to view members of organizations they belong to
CREATE POLICY "view_org_members_if_member"
ON public.profile_organization_members
FOR SELECT
USING (
  EXISTS (
    SELECT 1 
    FROM public.profile_organization_members members
    WHERE members.organization_id = profile_organization_members.organization_id
    AND members.profile_id = auth.uid()
  )
);

-- Allow admins to add members to their organizations
CREATE POLICY "insert_members_if_admin"
ON public.profile_organization_members
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 
    FROM public.profile_organization_members
    WHERE profile_organization_members.organization_id = organization_id
    AND profile_id = auth.uid()
    AND role = 'admin'
  )
);

-- Allow admins to update member roles in their organizations
CREATE POLICY "update_members_if_admin"
ON public.profile_organization_members
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 
    FROM public.profile_organization_members
    WHERE profile_organization_members.organization_id = organization_id
    AND profile_id = auth.uid()
    AND role = 'admin'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 
    FROM public.profile_organization_members
    WHERE profile_organization_members.organization_id = organization_id
    AND profile_id = auth.uid()
    AND role = 'admin'
  )
);

-- Allow admins to remove members from their organizations
CREATE POLICY "delete_members_if_admin"
ON public.profile_organization_members
FOR DELETE
USING (
  EXISTS (
    SELECT 1 
    FROM public.profile_organization_members
    WHERE profile_organization_members.organization_id = profile_organization_members.organization_id
    AND profile_id = auth.uid()
    AND role = 'admin'
  )
);

-- Allow users to remove themselves from organizations
CREATE POLICY "delete_self_from_org"
ON public.profile_organization_members
FOR DELETE
USING (profile_id = auth.uid()); 