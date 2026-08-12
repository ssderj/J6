-- Phase 1: a generic key-value sync table mirroring the app's existing local storage keys
-- (e.g. 'inkroot:project:<id>', 'inkroot:writerProfile', 'inkroot:achievements', ...). This
-- lets every existing storage.get/set/delete call in the app sync without redesigning the
-- data model yet. Phase 2/3 introduce proper relational tables (published_books, reviews,
-- guilds, ...) alongside this one, once specific features need real queries across users.

create table if not exists kv_store (
  user_id uuid not null references auth.users(id) on delete cascade,
  key text not null,
  value jsonb,
  updated_at timestamptz not null default now(),
  deleted boolean not null default false,
  primary key (user_id, key)
);

-- Row Level Security: every writer can only ever read/write their own rows. Critical since
-- this table holds everyone's private manuscripts.
alter table kv_store enable row level security;

create policy "select own rows" on kv_store
  for select using (auth.uid() = user_id);

create policy "insert own rows" on kv_store
  for insert with check (auth.uid() = user_id);

create policy "update own rows" on kv_store
  for update using (auth.uid() = user_id);

create policy "delete own rows" on kv_store
  for delete using (auth.uid() = user_id);

-- Supports the sync engine's incremental pull (see src/lib/syncEngine.js: pullRemote()),
-- which only asks for rows changed since the last successful sync rather than the whole table.
create index if not exists kv_store_user_updated_idx on kv_store (user_id, updated_at);
