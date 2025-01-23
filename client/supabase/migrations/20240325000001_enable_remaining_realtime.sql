-- Enable real-time for remaining tables
alter publication supabase_realtime add table profiles;
alter publication supabase_realtime add table profile_organization_members;
alter publication supabase_realtime add table organization_invitations; 