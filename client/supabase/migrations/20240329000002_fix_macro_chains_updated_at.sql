-- Drop the default value for updated_at to allow manual updates
alter table public.macro_chains 
    alter column updated_at drop default,
    alter column updated_at drop not null;

-- Add back not null constraint but without default
alter table public.macro_chains 
    alter column updated_at set not null; 