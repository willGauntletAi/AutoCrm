-- Drop the existing policy
DROP POLICY IF EXISTS "View invitations if admin or invited" ON public.organization_invitations;

-- Create security definer function for checking invitation access
CREATE OR REPLACE FUNCTION public.check_invitation_access(invitation_id uuid, user_id uuid)
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
    WHERE id = user_id;

    RETURN EXISTS (
        SELECT 1
        FROM public.organization_invitations i
        WHERE i.id = invitation_id
        AND (
            -- Organization admins can view all invitations for their org
            EXISTS (
                SELECT 1 
                FROM public.profile_organization_members
                WHERE profile_organization_members.organization_id = i.organization_id
                AND profile_organization_members.profile_id = auth.uid()
                AND profile_organization_members.role IN ('admin', 'owner')
                AND profile_organization_members.deleted_at IS NULL
            )
            OR
            -- Users can view their own invitations
            (i.email = user_email AND i.deleted_at IS NULL)
        )
    );
END;
$$;

-- Create new policy using the security definer function
CREATE POLICY "View invitations if admin or invited"
    ON public.organization_invitations
    FOR SELECT
    TO authenticated
    USING (
        check_invitation_access(id, auth.uid())
    ); 