-- Drop and recreate the check constraint on ticket_tag_keys to include enum type
alter table ticket_tag_keys drop constraint ticket_tag_keys_tag_type_check;
alter table ticket_tag_keys add constraint ticket_tag_keys_tag_type_check 
    check (tag_type in ('date', 'number', 'text', 'enum'));

-- Create enum options table
create table ticket_tag_enum_options (
    id uuid primary key default uuid_generate_v4(),
    tag_key_id uuid not null references ticket_tag_keys(id) on delete cascade,
    value text not null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    deleted_at timestamptz,
    unique (tag_key_id, value, deleted_at)
);

-- Create enum values table
create table ticket_tag_enum_values (
    id uuid primary key default uuid_generate_v4(),
    ticket_id uuid not null references tickets(id) on delete cascade,
    tag_key_id uuid not null references ticket_tag_keys(id) on delete cascade,
    enum_option_id uuid not null references ticket_tag_enum_options(id) on delete cascade,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    deleted_at timestamptz,
    unique (ticket_id, tag_key_id, deleted_at)
);

-- Enable row level security
alter table ticket_tag_enum_options enable row level security;
alter table ticket_tag_enum_values enable row level security;

-- Enable realtime
alter publication supabase_realtime add table ticket_tag_enum_options;
alter publication supabase_realtime add table ticket_tag_enum_values;

-- RLS Policies for enum options
create policy "Non-customer users can view enum options in their organizations"
    on ticket_tag_enum_options for select
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

-- RLS Policies for enum values
create policy "Non-customer users can view enum values in their organizations"
    on ticket_tag_enum_values for select
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