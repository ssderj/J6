-- Phase 5: makes player-created guilds actually joinable by other writers — the largest gap
-- flagged after Phase 4. Founder Guilds (Phase 3) already had a natural shared identifier;
-- player guilds had neither an id nor any join mechanism at all before this.

create table if not exists player_guilds (
  id uuid primary key,
  name text not null,
  motto text,
  crest_url text,
  owner_id uuid not null references auth.users(id) on delete cascade,
  -- Server-generated, not client-generated, so uniqueness doesn't need client-side retry logic.
  -- 8 hex characters is plenty of entropy for an invite code at this app's scale.
  invite_code text unique not null default substr(replace(gen_random_uuid()::text, '-', ''), 1, 8),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table player_guilds enable row level security;

-- Public read (needed for join-by-code to look a guild up at all, and so a joined member's app
-- can display the guild's current name/motto/crest even though someone else owns the row).
-- Only the owner can create/update it.
create policy "anyone can read player guilds" on player_guilds
  for select using (true);
create policy "owner creates their guild" on player_guilds
  for insert with check (auth.uid() = owner_id);
create policy "owner updates their guild" on player_guilds
  for update using (auth.uid() = owner_id);

create table if not exists player_guild_members (
  guild_id uuid not null references player_guilds(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (guild_id, user_id)
);

alter table player_guild_members enable row level security;

create policy "anyone can read player guild members" on player_guild_members
  for select using (true);
create policy "a writer joins on their own behalf" on player_guild_members
  for insert with check (auth.uid() = user_id);
create policy "a writer leaves on their own behalf" on player_guild_members
  for delete using (auth.uid() = user_id);

create index if not exists player_guild_members_guild_idx on player_guild_members (guild_id);
