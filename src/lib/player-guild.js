import { supabase } from './supabaseClient.js';
import { fetchProfileNames } from './profile.js';

async function currentUser() {
  const { data } = await supabase.auth.getUser();
  return data.user || null;
}

// Creates the row on first sync (id is generated once by the caller — see App.jsx's
// enterOwnGuild — and kept in local guildProfile.playerGuild.id from then on, the same
// reuse-the-app's-own-id pattern as Phase 2's published_books) or updates it on every later
// save. Returns the row, including invite_code, so the caller can persist the code into local
// state the first time the guild is created.
export async function syncPlayerGuild(id, { name, motto, crestUrl }) {
  const user = await currentUser();
  if (!user) return null;
  const { data, error } = await supabase.from('player_guilds').upsert({
    id, name, motto: motto || null, crest_url: crestUrl || null, owner_id: user.id, updated_at: new Date().toISOString(),
  }).select().single();
  if (error) throw error;
  // The owner is also a member — recorded explicitly rather than special-cased, so roster
  // counts and fetchPlayerGuildMembers() include them without extra logic anywhere else.
  await supabase.from('player_guild_members').upsert({ guild_id: id, user_id: user.id });
  return data;
}

export async function joinPlayerGuildByCode(code) {
  const user = await currentUser();
  if (!user) throw new Error('Sign in to join a guild.');
  const cleanCode = code.trim().toLowerCase();
  const { data: guild, error } = await supabase.from('player_guilds').select('*').eq('invite_code', cleanCode).maybeSingle();
  if (error) throw error;
  if (!guild) throw new Error('No guild found with that invite code.');
  const { error: joinErr } = await supabase.from('player_guild_members').upsert({ guild_id: guild.id, user_id: user.id });
  if (joinErr) throw joinErr;
  return guild;
}

export async function leavePlayerGuildRemote(guildId) {
  const user = await currentUser();
  if (!user) return null;
  return supabase.from('player_guild_members').delete().eq('guild_id', guildId).eq('user_id', user.id);
}

// Real roster with real names, same profiles-backed pattern as Phase 4's fetchFollowers().
export async function fetchPlayerGuildMembers(guildId) {
  const { data, error } = await supabase.from('player_guild_members').select('user_id, joined_at').eq('guild_id', guildId).order('joined_at', { ascending: true });
  if (error) throw error;
  const rows = data || [];
  const names = await fetchProfileNames(rows.map((r) => r.user_id));
  return rows.map((r) => ({ ...r, name: names[r.user_id] }));
}

// Fetches a guild's current public data by id — used to refresh a joined (non-owner) member's
// local copy of the guild's name/motto/crest, since only the owner's device otherwise has it.
export async function fetchPlayerGuild(guildId) {
  const { data, error } = await supabase.from('player_guilds').select('*').eq('id', guildId).maybeSingle();
  if (error) throw error;
  return data;
}
