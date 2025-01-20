-- Enable RLS for organizations table
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;

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