-- First, we need to drop existing foreign key constraints
ALTER TABLE public.ticket_comments DROP CONSTRAINT ticket_comments_ticket_id_fkey;

-- Update profile_organization_members table
ALTER TABLE public.profile_organization_members 
  ALTER COLUMN id DROP DEFAULT,  -- Remove BIGSERIAL
  ALTER COLUMN id SET DATA TYPE UUID USING gen_random_uuid(),  -- Convert to UUID
  ALTER COLUMN id SET DEFAULT gen_random_uuid();  -- Set default for new records

-- Update tickets table
ALTER TABLE public.tickets 
  ALTER COLUMN id DROP DEFAULT,  -- Remove BIGSERIAL
  ALTER COLUMN id SET DATA TYPE UUID USING gen_random_uuid(),  -- Convert to UUID
  ALTER COLUMN id SET DEFAULT gen_random_uuid();  -- Set default for new records

-- Update ticket_comments table
ALTER TABLE public.ticket_comments 
  ALTER COLUMN id DROP DEFAULT,  -- Remove BIGSERIAL
  ALTER COLUMN id SET DATA TYPE UUID USING gen_random_uuid(),  -- Convert to UUID
  ALTER COLUMN id SET DEFAULT gen_random_uuid(),  -- Set default for new records
  ALTER COLUMN ticket_id SET DATA TYPE UUID USING gen_random_uuid();  -- Convert foreign key to UUID

-- Re-add foreign key constraint with new type
ALTER TABLE public.ticket_comments 
  ADD CONSTRAINT ticket_comments_ticket_id_fkey 
  FOREIGN KEY (ticket_id) 
  REFERENCES public.tickets(id) 
  ON DELETE CASCADE;

-- Drop the sequence that was used for BIGSERIAL
DROP SEQUENCE IF EXISTS public.profile_organization_members_id_seq;
DROP SEQUENCE IF EXISTS public.tickets_id_seq;
DROP SEQUENCE IF EXISTS public.ticket_comments_id_seq; 