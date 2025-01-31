create table if not exists public.macro_chains (
  id uuid primary key default gen_random_uuid(),
  parent_macro_id uuid not null references public.macros(id) on delete cascade,
  child_macro_id uuid not null references public.macros(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique(parent_macro_id, child_macro_id)
);

-- Enable RLS
alter table public.macro_chains enable row level security;

-- Create policies
create policy "Non-customer organization members can view their organization's macro chains"
  on public.macro_chains
  for select
  using (
    exists (
      select 1 from public.macros
      inner join public.profile_organization_members
      on profile_organization_members.organization_id = macros.organization_id
      where macros.id = macro_chains.parent_macro_id
      and profile_organization_members.profile_id = auth.uid()
      and profile_organization_members.role != 'customer'
      and profile_organization_members.deleted_at is null
      and macros.deleted_at is null
    )
    and macro_chains.deleted_at is null
  );

-- Block all mutations
create policy "Block all insertions"
  on public.macro_chains
  for insert
  with check (false);

create policy "Block all updates"
  on public.macro_chains
  for update
  using (false);

create policy "Block all deletions"
  on public.macro_chains
  for delete
  using (false);

-- Add realtime
alter publication supabase_realtime add table macro_chains;

-- Add indexes
create index macro_chains_parent_macro_id_idx on public.macro_chains(parent_macro_id) where deleted_at is null;
create index macro_chains_child_macro_id_idx on public.macro_chains(child_macro_id) where deleted_at is null; 
