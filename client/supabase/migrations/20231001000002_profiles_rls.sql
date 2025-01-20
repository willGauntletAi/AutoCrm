-- Enable RLS for profiles table
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Allow users to view their own profile
CREATE POLICY "users_can_view_own_profile"
ON public.profiles
FOR SELECT
USING (auth.uid() = id);

-- Allow admins and workers to view all profiles in their organizations
CREATE POLICY "admin_worker_can_view_org_profiles"
ON public.profiles
FOR SELECT
USING (
  EXISTS (
    SELECT 1 
    FROM public.profile_organization_members viewer
    WHERE viewer.profile_id = auth.uid()
    AND viewer.role IN ('admin', 'worker')
    AND EXISTS (
      SELECT 1
      FROM public.profile_organization_members target
      WHERE target.profile_id = profiles.id
      AND target.organization_id = viewer.organization_id
    )
  )
);

-- Allow customers to view admin and worker profiles in their organizations
CREATE POLICY "customers_can_view_staff_profiles"
ON public.profiles
FOR SELECT
USING (
  EXISTS (
    SELECT 1 
    FROM public.profile_organization_members viewer
    WHERE viewer.profile_id = auth.uid()
    AND viewer.role = 'customer'
    AND EXISTS (
      SELECT 1
      FROM public.profile_organization_members target
      WHERE target.profile_id = profiles.id
      AND target.organization_id = viewer.organization_id
      AND target.role IN ('admin', 'worker')
    )
  )
);

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