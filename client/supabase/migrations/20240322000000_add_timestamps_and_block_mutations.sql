-- Add timestamp columns to tables that need them

-- Add to profiles
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE;

-- Add to organizations
ALTER TABLE public.organizations 
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE;

-- Add to profile_organization_members
ALTER TABLE public.profile_organization_members 
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE;

-- Add to tickets (already has updated_at)
ALTER TABLE public.tickets 
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE;

-- Add to ticket_comments
ALTER TABLE public.ticket_comments 
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS set_tickets_updated_at ON public.tickets;
DROP FUNCTION IF EXISTS public.update_ticket_timestamp();

-- Drop mutation policies for profiles
DROP POLICY IF EXISTS "users_can_update_own_profile" ON public.profiles;
DROP POLICY IF EXISTS "users_can_insert_own_profile" ON public.profiles;
DROP POLICY IF EXISTS "users_can_delete_own_profile" ON public.profiles;

-- Drop mutation policies for organizations
DROP POLICY IF EXISTS "Organization members can create organizations" ON public.organizations;
DROP POLICY IF EXISTS "Organization members can update their organizations" ON public.organizations;
DROP POLICY IF EXISTS "Organization members can delete their organizations" ON public.organizations;

-- Drop mutation policies for profile_organization_members
DROP POLICY IF EXISTS "Organization admins can manage members" ON public.profile_organization_members;
DROP POLICY IF EXISTS "Users can join organizations" ON public.profile_organization_members;
DROP POLICY IF EXISTS "Users can leave organizations" ON public.profile_organization_members;

-- Drop mutation policies for tickets
DROP POLICY IF EXISTS "Organization members can create tickets" ON public.tickets;
DROP POLICY IF EXISTS "Organization members can update tickets" ON public.tickets;
DROP POLICY IF EXISTS "Organization members can delete tickets" ON public.tickets;

-- Drop mutation policies for ticket_comments
DROP POLICY IF EXISTS "Organization members can create comments" ON public.ticket_comments;
DROP POLICY IF EXISTS "Organization members can update their comments" ON public.ticket_comments;
DROP POLICY IF EXISTS "Organization members can delete their comments" ON public.ticket_comments; 