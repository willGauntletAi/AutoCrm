-- Drop the existing policy and function
DROP POLICY IF EXISTS "View invitations if admin or invited" ON public.organization_invitations;
DROP FUNCTION IF EXISTS public.check_invitation_access(uuid);

-- Create security definer function for checking invitation access
CREATE OR REPLACE FUNCTION public.check_invitation_access()
RETURNS boolean
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
    user_email text;
BEGIN
    -- Get the current user's email
    SELECT email INTO user_email
    FROM auth.users
    WHERE id = auth.uid();

    RETURN (
        -- Organization admins can view all invitations for their org
        EXISTS (
            SELECT 1 
            FROM public.profile_organization_members
            WHERE profile_organization_members.organization_id = organization_invitations.organization_id
            AND profile_organization_members.profile_id = auth.uid()
            AND profile_organization_members.role IN ('admin', 'owner')
            AND profile_organization_members.deleted_at IS NULL
        )
        OR
        -- Users can view their own invitations
        (organization_invitations.email = user_email AND organization_invitations.deleted_at IS NULL)
    );
END;
$$;

-- Create new policy using the security definer function
CREATE POLICY "View invitations if admin or invited"
    ON public.organization_invitations
    FOR SELECT
    TO authenticated
    USING (
        check_invitation_access()
    ); 