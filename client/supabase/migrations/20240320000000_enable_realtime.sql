-- Enable real-time for organizations table
alter publication supabase_realtime add table organizations;

-- If the publication doesn't exist yet, create it
-- create publication if not exists supabase_realtime; 