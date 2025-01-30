-- Remove the created_by_macro column from ticket_drafts
ALTER TABLE public.ticket_drafts DROP COLUMN created_by_macro;

-- Create the junction table for ticket drafts and macros
CREATE TABLE IF NOT EXISTS public.ticket_draft_macros (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    ticket_draft_id UUID NOT NULL REFERENCES public.ticket_drafts (id) ON DELETE CASCADE,
    macro_id UUID NOT NULL REFERENCES public.macros (id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE,
    UNIQUE (ticket_draft_id, macro_id, deleted_at)
);

-- Enable RLS for the new table
ALTER TABLE public.ticket_draft_macros ENABLE ROW LEVEL SECURITY;

-- Enable realtime for the new table
ALTER PUBLICATION supabase_realtime ADD TABLE ticket_draft_macros;

-- Add RLS policies for ticket_draft_macros
CREATE POLICY "Users can view macro associations for their own drafts"
    ON public.ticket_draft_macros
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1
            FROM public.ticket_drafts
            WHERE ticket_drafts.id = ticket_draft_macros.ticket_draft_id
                AND ticket_drafts.created_by = auth.uid()
        )
    );

CREATE POLICY "Admins can view macro associations for all drafts in their organizations"
    ON public.ticket_draft_macros
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1
            FROM public.ticket_drafts
            JOIN public.profile_organization_members
                ON ticket_drafts.organization_id = profile_organization_members.organization_id
            WHERE ticket_drafts.id = ticket_draft_macros.ticket_draft_id
                AND profile_organization_members.profile_id = auth.uid()
                AND profile_organization_members.role = 'admin'
        )
    );

CREATE POLICY "Workers can view macro associations for all drafts in their organizations"
    ON public.ticket_draft_macros
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1
            FROM public.ticket_drafts
            JOIN public.profile_organization_members
                ON ticket_drafts.organization_id = profile_organization_members.organization_id
            WHERE ticket_drafts.id = ticket_draft_macros.ticket_draft_id
                AND profile_organization_members.profile_id = auth.uid()
                AND profile_organization_members.role = 'worker'
        )
    );

-- Create indexes for better performance
CREATE INDEX ticket_draft_macros_ticket_draft_id_idx ON public.ticket_draft_macros (ticket_draft_id);
CREATE INDEX ticket_draft_macros_macro_id_idx ON public.ticket_draft_macros (macro_id); 