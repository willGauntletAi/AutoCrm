-- Create ticket tag keys table
create table ticket_tag_keys (
    id uuid primary key default uuid_generate_v4(),
    organization_id uuid not null references organizations(id) on delete cascade,
    name text not null,
    description text,
    tag_type text not null check (tag_type in ('date', 'number', 'text')),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    deleted_at timestamptz,
    unique (organization_id, name, deleted_at)
);

-- Create date tag values table
create table ticket_tag_date_values (
    id uuid primary key default uuid_generate_v4(),
    ticket_id uuid not null references tickets(id) on delete cascade,
    tag_key_id uuid not null references ticket_tag_keys(id) on delete cascade,
    value date not null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    deleted_at timestamptz,
    unique (ticket_id, tag_key_id, deleted_at)
);

-- Create number tag values table
create table ticket_tag_number_values (
    id uuid primary key default uuid_generate_v4(),
    ticket_id uuid not null references tickets(id) on delete cascade,
    tag_key_id uuid not null references ticket_tag_keys(id) on delete cascade,
    value numeric not null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    deleted_at timestamptz,
    unique (ticket_id, tag_key_id, deleted_at)
);

-- Create text tag values table
create table ticket_tag_text_values (
    id uuid primary key default uuid_generate_v4(),
    ticket_id uuid not null references tickets(id) on delete cascade,
    tag_key_id uuid not null references ticket_tag_keys(id) on delete cascade,
    value text not null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    deleted_at timestamptz,
    unique (ticket_id, tag_key_id, deleted_at)
);

-- Enable row level security
alter table ticket_tag_keys enable row level security;
alter table ticket_tag_date_values enable row level security;
alter table ticket_tag_number_values enable row level security;
alter table ticket_tag_text_values enable row level security;

-- Enable realtime
alter publication supabase_realtime add table ticket_tag_keys;
alter publication supabase_realtime add table ticket_tag_date_values;
alter publication supabase_realtime add table ticket_tag_number_values;
alter publication supabase_realtime add table ticket_tag_text_values;

-- RLS Policies

-- ticket_tag_keys policies
create policy "Non-customer users can view ticket tag keys in their organizations"
    on ticket_tag_keys for select
    using (
        organization_id in (
            select organization_id
            from profile_organization_members
            where profile_id = auth.uid()
            and role != 'customer'
        )
    );

-- ticket_tag_date_values policies
create policy "Non-customer users can view date tag values in their organizations"
    on ticket_tag_date_values for select
    using (
        tag_key_id in (
            select id from ticket_tag_keys
            where organization_id in (
                select organization_id
                from profile_organization_members
                where profile_id = auth.uid()
                and role != 'customer'
            )
        )
    );

-- ticket_tag_number_values policies
create policy "Non-customer users can view number tag values in their organizations"
    on ticket_tag_number_values for select
    using (
        tag_key_id in (
            select id from ticket_tag_keys
            where organization_id in (
                select organization_id
                from profile_organization_members
                where profile_id = auth.uid()
                and role != 'customer'
            )
        )
    );

-- ticket_tag_text_values policies
create policy "Non-customer users can view text tag values in their organizations"
    on ticket_tag_text_values for select
    using (
        tag_key_id in (
            select id from ticket_tag_keys
            where organization_id in (
                select organization_id
                from profile_organization_members
                where profile_id = auth.uid()
                and role != 'customer'
            )
        )
    ); 