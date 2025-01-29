-- Add parent_draft_id column to ticket_drafts table
ALTER TABLE public.ticket_drafts
ADD COLUMN parent_draft_id UUID REFERENCES public.ticket_drafts (id) ON DELETE SET NULL;

-- Add latency column to ticket_drafts table
ALTER TABLE public.ticket_drafts
ADD COLUMN latency NUMERIC;

-- Create an index for parent_draft_id to improve query performance
CREATE INDEX ticket_drafts_parent_draft_id_idx ON public.ticket_drafts (parent_draft_id);

-- Update RLS policies to include parent_draft_id in the conditions
CREATE POLICY "Users can view parent drafts of their drafts"
    ON public.ticket_drafts
    FOR SELECT
    USING (
        id IN (
            SELECT parent_draft_id 
            FROM public.ticket_drafts 
            WHERE created_by = auth.uid()
        )
    ); 