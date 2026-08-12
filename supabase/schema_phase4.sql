-- Phase 4: a small public profiles table. Fixes the one real gap flagged in Phase 3's README —
-- fetchFollowers() could only ever return follower ids, since Supabase doesn't expose other
-- users' auth.users data (email, metadata) through a plain query, and the `follows` table itself
-- never had anywhere to put a display name. This is that place.

create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  pen_name text,
  display_name text,
  avatar_url text,
  updated_at timestamptz not null default now()
);

alter table profiles enable row level security;

-- Public read, same as published_books/reviews/follows — a profile is meant to be visible to
-- anyone (it's what lets a follower list show names at all). Only the profile's own owner can
-- write to it.
create policy "anyone can read profiles" on profiles
  for select using (true);
create policy "a user updates their own profile" on profiles
  for update using (auth.uid() = id);
create policy "a user inserts their own profile" on profiles
  for insert with check (auth.uid() = id);

-- Auto-creates a minimal profile row the moment someone signs up, so the client only ever needs
-- to UPDATE (via src/lib/profile.js's syncProfile) rather than juggling an insert-or-update
-- dance for a row that might not exist yet.
create or replace function handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, split_part(new.email, '@', 1));
  return new;
end;
$$ language plpgsql security definer set search_path = public;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();
