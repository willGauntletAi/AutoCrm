-- There is no specific function or class here, but this file represents the initial schema migration.

-- 1. Create the 'profiles' table linked to Supabase Auth.
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  full_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  deleted_at TIMESTAMP WITH TIME ZONE
);

-- 2. Create the 'organizations' table.
CREATE TABLE IF NOT EXISTS public.organizations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  deleted_at TIMESTAMP WITH TIME ZONE
);

-- 3. Many-to-many table linking 'profiles' to 'organizations'.
CREATE TABLE IF NOT EXISTS public.profile_organization_members (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  profile_id UUID NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  role TEXT, -- e.g. 'admin', 'member', 'owner', etc.
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  deleted_at TIMESTAMP WITH TIME ZONE,
  UNIQUE (profile_id, organization_id)
);

-- 4. Main 'tickets' table, which references the organization's ID.
CREATE TABLE IF NOT EXISTS public.tickets (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'open',  -- e.g. 'open', 'in_progress', 'closed', etc.
  priority TEXT NOT NULL DEFAULT 'medium',  -- e.g. 'low', 'medium', 'high'
  created_by UUID NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  assigned_to UUID REFERENCES public.profiles (id),
  organization_id UUID NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  deleted_at TIMESTAMP WITH TIME ZONE
);

-- 5. 'ticket_comments' for user discussions on a ticket.
CREATE TABLE IF NOT EXISTS public.ticket_comments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  ticket_id UUID NOT NULL REFERENCES public.tickets (id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  comment TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  deleted_at TIMESTAMP WITH TIME ZONE
);

-- Optional: Create an update trigger for timestamps
CREATE OR REPLACE FUNCTION public.update_timestamps()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add update triggers for all tables
DROP TRIGGER IF EXISTS set_profiles_updated_at ON public.profiles;
CREATE TRIGGER set_profiles_updated_at
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE PROCEDURE public.update_timestamps();

DROP TRIGGER IF EXISTS set_organizations_updated_at ON public.organizations;
CREATE TRIGGER set_organizations_updated_at
BEFORE UPDATE ON public.organizations
FOR EACH ROW
EXECUTE PROCEDURE public.update_timestamps();

DROP TRIGGER IF EXISTS set_profile_organization_members_updated_at ON public.profile_organization_members;
CREATE TRIGGER set_profile_organization_members_updated_at
BEFORE UPDATE ON public.profile_organization_members
FOR EACH ROW
EXECUTE PROCEDURE public.update_timestamps();

DROP TRIGGER IF EXISTS set_tickets_updated_at ON public.tickets;
CREATE TRIGGER set_tickets_updated_at
BEFORE UPDATE ON public.tickets
FOR EACH ROW
EXECUTE PROCEDURE public.update_timestamps();

DROP TRIGGER IF EXISTS set_ticket_comments_updated_at ON public.ticket_comments;
CREATE TRIGGER set_ticket_comments_updated_at
BEFORE UPDATE ON public.ticket_comments
FOR EACH ROW
EXECUTE PROCEDURE public.update_timestamps(); 