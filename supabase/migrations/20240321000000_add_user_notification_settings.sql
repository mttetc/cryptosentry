-- Create user_notification_settings table
create table if not exists public.user_notification_settings (
    id uuid default gen_random_uuid() primary key,
    user_id uuid references auth.users(id) on delete cascade not null,
    phone text,
    prefer_sms boolean default false,
    active_24h boolean default true,
    quiet_hours_start text,
    quiet_hours_end text,
    weekends_enabled boolean default true,
    telegram_enabled boolean default false,
    telegram_chat_id text,
    telegram_setup_in_progress boolean default false,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
    constraint user_notification_settings_user_id_key unique (user_id)
);

-- Enable Row Level Security (RLS)
alter table public.user_notification_settings enable row level security;

-- Create policy to allow users to read their own settings
create policy "Users can read their own notification settings"
    on public.user_notification_settings
    for select
    to authenticated
    using (auth.uid() = user_id);

-- Create policy to allow users to insert their own settings
create policy "Users can insert their own notification settings"
    on public.user_notification_settings
    for insert
    to authenticated
    with check (auth.uid() = user_id);

-- Create policy to allow users to update their own settings
create policy "Users can update their own notification settings"
    on public.user_notification_settings
    for update
    to authenticated
    using (auth.uid() = user_id)
    with check (auth.uid() = user_id);

-- Create policy to allow users to delete their own settings
create policy "Users can delete their own notification settings"
    on public.user_notification_settings
    for delete
    to authenticated
    using (auth.uid() = user_id);

-- Create function to automatically update updated_at timestamp
create or replace function public.handle_updated_at()
returns trigger as $$
begin
    new.updated_at = timezone('utc'::text, now());
    return new;
end;
$$ language plpgsql;

-- Create trigger to automatically update updated_at timestamp
create trigger handle_updated_at
    before update on public.user_notification_settings
    for each row
    execute function public.handle_updated_at(); 