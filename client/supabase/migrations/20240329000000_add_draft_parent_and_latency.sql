-- Add parent_draft_id column to ticket_drafts table
ALTER TABLE public.ticket_drafts
ADD COLUMN parent_draft_id UUID REFERENCES public.ticket_drafts (id) ON DELETE SET NULL;

-- Add latency column to ticket_drafts table
ALTER TABLE public.ticket_drafts
ADD COLUMN latency NUMERIC NOT NULL DEFAULT 0;

-- Create an index for parent_draft_id to improve query performance
CREATE INDEX ticket_drafts_parent_draft_id_idx ON public.ticket_drafts (parent_draft_id);

-- Drop existing policies to rewrite them
DROP POLICY IF EXISTS "Users can view their own drafts" ON public.ticket_drafts;
DROP POLICY IF EXISTS "Users can view parent drafts of their drafts" ON public.ticket_drafts;
DROP POLICY IF EXISTS "Admins can view all drafts in their organizations" ON public.ticket_drafts;
DROP POLICY IF EXISTS "Workers can view all drafts in their organizations" ON public.ticket_drafts;

-- Create a single policy for non-customer users to view drafts in their organization
CREATE POLICY "Non-customer users can view all drafts in their organizations"
    ON public.ticket_drafts
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1
            FROM profile_organization_members
            WHERE profile_organization_members.organization_id = ticket_drafts.organization_id
            AND profile_organization_members.profile_id = auth.uid()
            AND profile_organization_members.role != 'customer'
        )
    ); 