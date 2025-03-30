-- Drop existing schema
drop schema if exists public cascade;
create schema public;

-- Drop team-related tables if they exist
drop table if exists public.team_members;
drop table if exists public.teams;

-- Grant necessary permissions to anon role
grant usage on schema public to anon;
grant all on all tables in public to anon;
grant all on all sequences in public to anon;

-- Set up extensions
create extension if not exists "uuid-ossp";

-- Create waitlist table
create table if not exists public.waitlist (
    id uuid default gen_random_uuid() primary key,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    email text not null,
    country text not null,
    constraint waitlist_email_key unique (email)
);

-- Enable Row Level Security (RLS)
alter table public.waitlist enable row level security;

-- Create policy to allow inserts from anon role
create policy "Enable insert for anon" on public.waitlist
    for insert
    to anon
    with check (true);

-- Create policy to allow reads from anon role
create policy "Enable read for anon" on public.waitlist
    for select
    to anon
    using (true); 