import { supabase } from './supabaseClient.js';
import { fetchProfileNames } from './profile.js';

// Every function here is safe to call whether or not the reader is signed in — publishing,
// reviewing, and following are all opt-in account features layered on top of an app that fully
// works without one (same philosophy as syncEngine.js in Phase 1). Each function checks for a
// session itself rather than expecting the caller to track auth state, so App.jsx's publish/
// unpublish handlers don't need to know anything about sign-in status to call these safely.

async function currentUser() {
  const { data } = await supabase.auth.getUser();
  return data.user || null;
}

// Pushes (or updates) a book's public listing. Called after a local publish/re-publish — the
// project's full content never leaves kv_store; this only sends the subset that's meant to be
// public (title, blurb, genre, tags, price, destination).
export async function publishBookRemote({ id, title, blurb, genre, tags, price, destination, publishedAt }) {
  const user = await currentUser();
  if (!user) return null; // not signed in — stays a local-only publish, same as before Phase 2
  return supabase.from('published_books').upsert({
    id,
    author_id: user.id,
    author_name: user.user_metadata?.penName || user.email,
    title,
    blurb: blurb || '',
    genre: genre || '',
    tags: tags || [],
    price: price || 0,
    destination,
    published_at: new Date(publishedAt || Date.now()).toISOString(),
    updated_at: new Date().toISOString(),
  });
}

export async function unpublishBookRemote(id) {
  const user = await currentUser();
  if (!user) return null;
  return supabase.from('published_books').delete().eq('id', id).eq('author_id', user.id);
}

// Aggregate rating + full review list for one book — used by both the individual book card
// (average only) and a book's own reviews view (the full list).
export async function fetchBookStats(bookId) {
  const { data: reviewRows, error } = await supabase
    .from('reviews')
    .select('rating, body, reviewer_name, created_at')
    .eq('book_id', bookId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  const reviews = reviewRows || [];
  const avgRating = reviews.length ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length : null;
  return { reviews, avgRating, reviewCount: reviews.length };
}

// One call per author, covering every book they've published — this is what backs the Creator
// Dashboard's Ratings tab, so it doesn't need one request per book.
export async function fetchAuthorRatingsSummary(bookIds) {
  if (!bookIds || bookIds.length === 0) return [];
  const { data, error } = await supabase
    .from('reviews')
    .select('book_id, rating, body, reviewer_name, created_at')
    .in('book_id', bookIds)
    .order('created_at', { ascending: false });
  if (error) throw error;
  const byBook = {};
  for (const row of data || []) {
    if (!byBook[row.book_id]) byBook[row.book_id] = [];
    byBook[row.book_id].push(row);
  }
  return Object.entries(byBook).map(([bookId, reviews]) => ({
    bookId,
    reviews,
    avgRating: reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length,
  }));
}

export async function submitReview(bookId, rating, body) {
  const user = await currentUser();
  if (!user) throw new Error('Sign in to leave a review.');
  return supabase.from('reviews').upsert({
    book_id: bookId,
    reviewer_id: user.id,
    reviewer_name: user.user_metadata?.penName || user.email,
    rating,
    body: body || '',
  }, { onConflict: 'book_id,reviewer_id' });
}

export async function followAuthor(authorId) {
  const user = await currentUser();
  if (!user) throw new Error('Sign in to follow an author.');
  return supabase.from('follows').upsert({ follower_id: user.id, followee_id: authorId });
}

export async function unfollowAuthor(authorId) {
  const user = await currentUser();
  if (!user) return null;
  return supabase.from('follows').delete().eq('follower_id', user.id).eq('followee_id', authorId);
}

export async function isFollowing(authorId) {
  const user = await currentUser();
  if (!user) return false;
  const { data } = await supabase
    .from('follows')
    .select('follower_id')
    .eq('follower_id', user.id)
    .eq('followee_id', authorId)
    .maybeSingle();
  return !!data;
}

// Backs the Creator Dashboard's Readers tab — the honest version of "who's reading your work"
// this phase can actually deliver: real followers, not page-view/traffic-source analytics
// (that would need a separate events-tracking table, which isn't part of this phase).
export async function fetchFollowers() {
  const user = await currentUser();
  if (!user) return [];
  const { data, error } = await supabase
    .from('follows')
    .select('follower_id, created_at')
    .eq('followee_id', user.id)
    .order('created_at', { ascending: false });
  if (error) throw error;
  const rows = data || [];
  // Phase 4's profiles table is what makes real names possible here — before it existed, this
  // could only return raw ids (see the Phase 3 README note this replaces).
  const names = await fetchProfileNames(rows.map((r) => r.follower_id));
  return rows.map((r) => ({ ...r, name: names[r.follower_id] }));
}
