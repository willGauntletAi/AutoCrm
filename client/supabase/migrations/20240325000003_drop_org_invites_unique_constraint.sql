-- Drop the unique constraint on organization_invitations
ALTER TABLE public.organization_invitations
DROP CONSTRAINT IF EXISTS organization_invitations_organization_id_email_key; 