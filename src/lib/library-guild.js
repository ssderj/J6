import { supabase } from './supabaseClient.js';

// Same self-checking-auth philosophy as library.js (Phase 2): every function here is safe to
// call regardless of sign-in state. The difference from Phase 2 is that these functions also
// need a guildId (the writer's founderGuildId) — there's no meaningful "post to the Fireside"
// without knowing which Founder Guild's Fireside. Callers (FiresideBoard, GuildBookshelf) fall
// back to the original local-only storage when either signed out or not in a Founder Guild —
// see the fallback logic where each is used in App.jsx.

async function currentUser() {
  const { data } = await supabase.auth.getUser();
  return data.user || null;
}

// Returns { posts, reactionsByPost } — posts is the flat list (top-level + replies, same shape
// FiresideBoard already expects to filter/sort locally), reactionsByPost maps postId -> array of
// { reaction, user_id } so the caller can compute both counts and "did I react with this" per
// post without a second round trip per post.
export async function fetchFiresidePosts(guildId) {
  const { data: posts, error: postsErr } = await supabase
    .from('fireside_posts')
    .select('id, parent_id, author_id, author_name, category, body, pinned, created_at')
    .eq('guild_id', guildId)
    .order('created_at', { ascending: true });
  if (postsErr) throw postsErr;

  const postIds = (posts || []).map((p) => p.id);
  const reactionsByPost = {};
  if (postIds.length > 0) {
    const { data: reactions, error: reactErr } = await supabase
      .from('fireside_reactions')
      .select('post_id, user_id, reaction')
      .in('post_id', postIds);
    if (reactErr) throw reactErr;
    for (const r of reactions || []) {
      if (!reactionsByPost[r.post_id]) reactionsByPost[r.post_id] = [];
      reactionsByPost[r.post_id].push(r);
    }
  }
  return { posts: posts || [], reactionsByPost };
}

export async function postFiresideMessage(guildId, category, body, parentId) {
  const user = await currentUser();
  if (!user) throw new Error('Sign in to post to the Fireside.');
  const { data, error } = await supabase.from('fireside_posts').insert({
    guild_id: guildId,
    parent_id: parentId || null,
    author_id: user.id,
    author_name: user.user_metadata?.penName || user.email,
    category: category || 'discussion',
    body,
  }).select().single();
  if (error) throw error;
  return data;
}

// Author-only, per the schema's RLS — see the comment in schema_phase3.sql for why this can't
// be opened up to any guild member in this phase.
export async function toggleFiresidePin(postId, pinned) {
  const { error } = await supabase.from('fireside_posts').update({ pinned }).eq('id', postId);
  if (error) throw error;
}

export async function toggleFiresideReaction(postId, reaction, currentlyActive) {
  const user = await currentUser();
  if (!user) throw new Error('Sign in to react.');
  if (currentlyActive) {
    const { error } = await supabase.from('fireside_reactions').delete().eq('post_id', postId).eq('user_id', user.id).eq('reaction', reaction);
    if (error) throw error;
  } else {
    const { error } = await supabase.from('fireside_reactions').insert({ post_id: postId, user_id: user.id, reaction });
    if (error) throw error;
  }
}

// Subscribes to live inserts on both tables for one guild's Fireside. Returns an unsubscribe
// function. onChange is called with no arguments — callers just re-fetch via
// fetchFiresidePosts() on any change rather than trying to patch individual rows in, since the
// Fireside's own view (pinned-first, threaded replies) is cheap to recompute and much simpler
// than merging partial realtime payloads into that structure correctly.
export function subscribeFiresideRealtime(guildId, onChange) {
  const channel = supabase
    .channel(`fireside:${guildId}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'fireside_posts', filter: `guild_id=eq.${guildId}` }, onChange)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'fireside_reactions' }, onChange)
    .subscribe();
  return () => supabase.removeChannel(channel);
}

export async function fetchGuildBookFeedback(guildId, bookId) {
  const { data, error } = await supabase
    .from('guild_book_feedback')
    .select('id, author_name, stars, note, created_at')
    .eq('guild_id', guildId)
    .eq('book_id', bookId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function addGuildBookFeedback(guildId, bookId, stars, note) {
  const user = await currentUser();
  if (!user) throw new Error('Sign in to leave guild feedback.');
  const { error } = await supabase.from('guild_book_feedback').insert({
    guild_id: guildId, book_id: bookId, author_id: user.id,
    author_name: user.user_metadata?.penName || user.email, stars, note: note || '',
  });
  if (error) throw error;
}
