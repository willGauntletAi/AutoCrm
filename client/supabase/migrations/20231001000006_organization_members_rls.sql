-- Enable RLS for profile_organization_members table
ALTER TABLE public.profile_organization_members ENABLE ROW LEVEL SECURITY;

-- Create security definer functions for access checks
CREATE OR REPLACE FUNCTION public.check_is_org_member(org_id uuid, user_id uuid)
RETURNS boolean
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM profile_organization_members
    WHERE organization_id = org_id
    AND profile_id = user_id
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.check_is_org_admin(org_id uuid, user_id uuid)
RETURNS boolean
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM profile_organization_members
    WHERE organization_id = org_id
    AND profile_id = user_id
    AND role = 'admin'
  );
END;
$$;

-- Allow users to view members of organizations they belong to
CREATE POLICY "view_org_members_if_member"
ON public.profile_organization_members
FOR SELECT
USING (
  check_is_org_member(organization_id, auth.uid())
);

-- Allow admins to add members to their organizations
CREATE POLICY "insert_members_if_admin"
ON public.profile_organization_members
FOR INSERT
WITH CHECK (
  check_is_org_admin(organization_id, auth.uid())
);

-- Allow admins to update member roles in their organizations
CREATE POLICY "update_members_if_admin"
ON public.profile_organization_members
FOR UPDATE
USING (
  check_is_org_admin(organization_id, auth.uid())
)
WITH CHECK (
  check_is_org_admin(organization_id, auth.uid())
);

-- Allow admins to remove members from their organizations
CREATE POLICY "delete_members_if_admin"
ON public.profile_organization_members
FOR DELETE
USING (
  check_is_org_admin(organization_id, auth.uid())
);

-- Allow users to remove themselves from organizations
CREATE POLICY "delete_self_from_org"
ON public.profile_organization_members
FOR DELETE
USING (profile_id = auth.uid()); 