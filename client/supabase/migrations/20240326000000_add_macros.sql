create table if not exists public.macros (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  macro jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

-- Enable RLS
alter table public.macros enable row level security;

-- Create policies
create policy "Non-customer organization members can view their organization's macros"
  on public.macros
  for select
  using (
    exists (
      select 1 from public.profile_organization_members
      where profile_organization_members.organization_id = macros.organization_id
      and profile_organization_members.profile_id = auth.uid()
      and profile_organization_members.role != 'customer'
      and profile_organization_members.deleted_at is null
    )
    and macros.deleted_at is null
  );

-- Block all mutations
create policy "Block all insertions"
  on public.macros
  for insert
  with check (false);

create policy "Block all updates"
  on public.macros
  for update
  using (false);

create policy "Block all deletions"
  on public.macros
  for delete
  using (false);

-- Add realtime
alter publication supabase_realtime add table macros; 