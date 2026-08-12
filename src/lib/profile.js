import { supabase } from './supabaseClient.js';

async function currentUser() {
  const { data } = await supabase.auth.getUser();
  return data.user || null;
}

// Push the writer's own pen name / display name / avatar to their public profile row. Called
// fire-and-forget from App.jsx's saveProfile, same non-blocking philosophy as everything else
// signed-in-only in this app — a no-op when signed out, so local-only profile editing behaves
// exactly as it always did.
export async function syncProfile({ name, penName, avatar }) {
  const user = await currentUser();
  if (!user) return null;
  return supabase.from('profiles').update({
    display_name: name || null,
    pen_name: penName || null,
    avatar_url: avatar || null,
    updated_at: new Date().toISOString(),
  }).eq('id', user.id);
}

// Batch name lookup for a list of user ids — e.g. turning a follower list's raw ids into
// something a reader would recognize. Returns a map of id -> the best available display name,
// falling back to a short id fragment for anyone whose profile row hasn't been created yet
// (shouldn't normally happen, since the Phase 4 schema's trigger creates one at signup, but
// accounts created before this migration ran won't have one until they next save their profile).
export async function fetchProfileNames(userIds) {
  const ids = [...new Set(userIds)].filter(Boolean);
  if (ids.length === 0) return {};
  const { data, error } = await supabase
    .from('profiles')
    .select('id, pen_name, display_name')
    .in('id', ids);
  if (error) throw error;
  const byId = {};
  for (const row of data || []) {
    byId[row.id] = row.pen_name || row.display_name || null;
  }
  for (const id of ids) {
    if (!byId[id]) byId[id] = `Reader ${id.slice(0, 8)}`;
  }
  return byId;
}
