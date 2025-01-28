-- Create the main ticket_drafts table
CREATE TABLE IF NOT EXISTS public.ticket_drafts (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT,
    status TEXT NOT NULL DEFAULT 'draft',
    priority TEXT NOT NULL DEFAULT 'medium',
    draft_status TEXT NOT NULL DEFAULT 'unreviewed' CHECK (draft_status IN ('unreviewed', 'partially_accepted', 'accepted', 'rejected')),
    created_by UUID NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
    created_by_macro UUID NOT NULL REFERENCES public.macros (id) ON DELETE CASCADE,
    assigned_to UUID REFERENCES public.profiles (id),
    organization_id UUID NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
    original_ticket_id UUID REFERENCES public.tickets (id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE
);

-- Create the ticket_draft_comments table
CREATE TABLE IF NOT EXISTS public.ticket_draft_comments (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    ticket_draft_id UUID NOT NULL REFERENCES public.ticket_drafts (id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
    comment TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE
);

-- Create draft tag values tables
CREATE TABLE IF NOT EXISTS public.ticket_draft_tag_date_values (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    ticket_draft_id UUID NOT NULL REFERENCES public.ticket_drafts (id) ON DELETE CASCADE,
    tag_key_id UUID NOT NULL REFERENCES public.ticket_tag_keys (id) ON DELETE CASCADE,
    value DATE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE,
    UNIQUE (ticket_draft_id, tag_key_id, deleted_at)
);

CREATE TABLE IF NOT EXISTS public.ticket_draft_tag_number_values (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    ticket_draft_id UUID NOT NULL REFERENCES public.ticket_drafts (id) ON DELETE CASCADE,
    tag_key_id UUID NOT NULL REFERENCES public.ticket_tag_keys (id) ON DELETE CASCADE,
    value NUMERIC NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE,
    UNIQUE (ticket_draft_id, tag_key_id, deleted_at)
);

CREATE TABLE IF NOT EXISTS public.ticket_draft_tag_text_values (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    ticket_draft_id UUID NOT NULL REFERENCES public.ticket_drafts (id) ON DELETE CASCADE,
    tag_key_id UUID NOT NULL REFERENCES public.ticket_tag_keys (id) ON DELETE CASCADE,
    value TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE,
    UNIQUE (ticket_draft_id, tag_key_id, deleted_at)
);

CREATE TABLE IF NOT EXISTS public.ticket_draft_tag_enum_values (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    ticket_draft_id UUID NOT NULL REFERENCES public.ticket_drafts (id) ON DELETE CASCADE,
    tag_key_id UUID NOT NULL REFERENCES public.ticket_tag_keys (id) ON DELETE CASCADE,
    enum_option_id UUID NOT NULL REFERENCES public.ticket_tag_enum_options (id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE,
    UNIQUE (ticket_draft_id, tag_key_id, deleted_at)
);

-- Enable RLS for all new tables
ALTER TABLE public.ticket_drafts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ticket_draft_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ticket_draft_tag_date_values ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ticket_draft_tag_number_values ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ticket_draft_tag_text_values ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ticket_draft_tag_enum_values ENABLE ROW LEVEL SECURITY;

-- Enable realtime for all new tables
ALTER PUBLICATION supabase_realtime ADD TABLE ticket_drafts;
ALTER PUBLICATION supabase_realtime ADD TABLE ticket_draft_comments;
ALTER PUBLICATION supabase_realtime ADD TABLE ticket_draft_tag_date_values;
ALTER PUBLICATION supabase_realtime ADD TABLE ticket_draft_tag_number_values;
ALTER PUBLICATION supabase_realtime ADD TABLE ticket_draft_tag_text_values;
ALTER PUBLICATION supabase_realtime ADD TABLE ticket_draft_tag_enum_values;

-- RLS Policies for ticket_drafts

-- View policies only - all modifications blocked by default
CREATE POLICY "Users can view their own drafts"
    ON public.ticket_drafts
    FOR SELECT
    USING (created_by = auth.uid());

CREATE POLICY "Admins can view all drafts in their organizations"
    ON public.ticket_drafts
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 
            FROM public.profile_organization_members
            WHERE profile_organization_members.profile_id = auth.uid()
                AND profile_organization_members.organization_id = ticket_drafts.organization_id
                AND profile_organization_members.role = 'admin'
        )
    );

CREATE POLICY "Workers can view all drafts in their organizations"
    ON public.ticket_drafts
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 
            FROM public.profile_organization_members
            WHERE profile_organization_members.profile_id = auth.uid()
                AND profile_organization_members.organization_id = ticket_drafts.organization_id
                AND profile_organization_members.role = 'worker'
        )
    );

-- RLS Policies for ticket_draft_comments

-- View policies only - all modifications blocked by default
CREATE POLICY "Users can view comments on their own drafts"
    ON public.ticket_draft_comments
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1
            FROM public.ticket_drafts
            WHERE ticket_drafts.id = ticket_draft_comments.ticket_draft_id
                AND ticket_drafts.created_by = auth.uid()
        )
    );

CREATE POLICY "Admins can view comments on all drafts in their organizations"
    ON public.ticket_draft_comments
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1
            FROM public.ticket_drafts
            JOIN public.profile_organization_members
                ON ticket_drafts.organization_id = profile_organization_members.organization_id
            WHERE ticket_drafts.id = ticket_draft_comments.ticket_draft_id
                AND profile_organization_members.profile_id = auth.uid()
                AND profile_organization_members.role = 'admin'
        )
    );

CREATE POLICY "Workers can view comments on all drafts in their organizations"
    ON public.ticket_draft_comments
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1
            FROM public.ticket_drafts
            JOIN public.profile_organization_members
                ON ticket_drafts.organization_id = profile_organization_members.organization_id
            WHERE ticket_drafts.id = ticket_draft_comments.ticket_draft_id
                AND profile_organization_members.profile_id = auth.uid()
                AND profile_organization_members.role = 'worker'
        )
    );

-- RLS Policies for draft tag values

-- Date tag values - view only
CREATE POLICY "Non-customer users can view date tag values for drafts in their organizations"
    ON public.ticket_draft_tag_date_values
    FOR SELECT
    USING (
        tag_key_id IN (
            SELECT id FROM ticket_tag_keys
            WHERE organization_id IN (
                SELECT organization_id
                FROM profile_organization_members
                WHERE profile_id = auth.uid()
                AND role != 'customer'
            )
        )
    );

-- Number tag values - view only
CREATE POLICY "Non-customer users can view number tag values for drafts in their organizations"
    ON public.ticket_draft_tag_number_values
    FOR SELECT
    USING (
        tag_key_id IN (
            SELECT id FROM ticket_tag_keys
            WHERE organization_id IN (
                SELECT organization_id
                FROM profile_organization_members
                WHERE profile_id = auth.uid()
                AND role != 'customer'
            )
        )
    );

-- Text tag values - view only
CREATE POLICY "Non-customer users can view text tag values for drafts in their organizations"
    ON public.ticket_draft_tag_text_values
    FOR SELECT
    USING (
        tag_key_id IN (
            SELECT id FROM ticket_tag_keys
            WHERE organization_id IN (
                SELECT organization_id
                FROM profile_organization_members
                WHERE profile_id = auth.uid()
                AND role != 'customer'
            )
        )
    );

-- Enum tag values - view only
CREATE POLICY "Non-customer users can view enum tag values for drafts in their organizations"
    ON public.ticket_draft_tag_enum_values
    FOR SELECT
    USING (
        tag_key_id IN (
            SELECT id FROM ticket_tag_keys
            WHERE organization_id IN (
                SELECT organization_id
                FROM profile_organization_members
                WHERE profile_id = auth.uid()
                AND role != 'customer'
            )
        )
    );

-- Create indexes for better performance
CREATE INDEX ticket_drafts_organization_id_idx ON public.ticket_drafts (organization_id);
CREATE INDEX ticket_drafts_created_by_idx ON public.ticket_drafts (created_by);
CREATE INDEX ticket_drafts_original_ticket_id_idx ON public.ticket_drafts (original_ticket_id);
CREATE INDEX ticket_draft_comments_ticket_draft_id_idx ON public.ticket_draft_comments (ticket_draft_id);
CREATE INDEX ticket_draft_tag_date_values_ticket_draft_id_idx ON public.ticket_draft_tag_date_values (ticket_draft_id);
CREATE INDEX ticket_draft_tag_number_values_ticket_draft_id_idx ON public.ticket_draft_tag_number_values (ticket_draft_id);
CREATE INDEX ticket_draft_tag_text_values_ticket_draft_id_idx ON public.ticket_draft_tag_text_values (ticket_draft_id);
CREATE INDEX ticket_draft_tag_enum_values_ticket_draft_id_idx ON public.ticket_draft_tag_enum_values (ticket_draft_id); 
