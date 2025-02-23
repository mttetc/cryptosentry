create table if not exists public.waitlist (
  id uuid default gen_random_uuid() primary key,
  email text not null unique,
  country text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS
alter table public.waitlist enable row level security;

-- Create policies
create policy "Enable insert for all users" on public.waitlist
  for insert with check (true);

create policy "Enable read access for all users" on public.waitlist
  for select using (true); 