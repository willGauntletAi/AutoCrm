-- Create the organization_invitations table
CREATE TABLE IF NOT EXISTS public.organization_invitations (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    organization_id UUID NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    role TEXT NOT NULL, -- e.g. 'admin', 'member'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE,
    UNIQUE (organization_id, email)
);

-- Enable RLS
ALTER TABLE public.organization_invitations ENABLE ROW LEVEL SECURITY;

-- Allow organization admins to view invitations
CREATE POLICY "Organization admins can view invitations"
    ON public.organization_invitations
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.profile_organization_members
            WHERE profile_organization_members.organization_id = organization_invitations.organization_id
            AND profile_organization_members.profile_id = auth.uid()
            AND profile_organization_members.role IN ('admin', 'owner')
            AND profile_organization_members.deleted_at IS NULL
        )
    );

-- Allow users to view their own invitations
CREATE POLICY "Users can view their own invitations"
    ON public.organization_invitations
    FOR SELECT
    TO authenticated
    USING (
        email = (SELECT email FROM auth.users WHERE id = auth.uid())
        AND deleted_at IS NULL
    );

-- Create an index on email for faster lookups
CREATE INDEX organization_invitations_email_idx ON public.organization_invitations (email);

-- Create an index on organization_id for faster joins
CREATE INDEX organization_invitations_organization_id_idx ON public.organization_invitations (organization_id); 