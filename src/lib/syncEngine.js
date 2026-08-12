import { getDb } from './idb.js';
import { supabase } from './supabaseClient.js';

let userId = null;
let syncing = false;
let pendingRetry = false;

export function setSyncUser(id) {
  userId = id;
}

// Called by storage.js after every local set/delete. Fire-and-forget: if we're offline, signed
// out, or a push is already in flight, the change just sits in the outbox until the next
// successful sync — nothing here blocks the caller or throws, so the app behaves identically
// offline whether or not sync is even configured.
export function scheduleSync() {
  if (!userId) return; // not signed in — sync is opt-in; local-only mode works fully without it
  if (syncing) {
    pendingRetry = true;
    return;
  }
  runSync();
}

async function runSync() {
  syncing = true;
  try {
    await pushOutbox();
    await pullRemote();
  } catch (e) {
    // Network hiccup, Supabase temporarily unreachable, etc. — expected and not fatal. The
    // outbox still holds every unsynced change, so the next scheduleSync() call (the next
    // local edit, a reconnect, or fullResync()) picks up exactly where this left off.
    console.warn('Inkroot sync: attempt failed, will retry on next trigger.', e);
  } finally {
    syncing = false;
    if (pendingRetry) {
      pendingRetry = false;
      runSync();
    }
  }
}

async function pushOutbox() {
  const db = await getDb();
  const keys = await db.getAllKeys('outbox');
  for (const key of keys) {
    const entry = await db.get('outbox', key);
    if (!entry) continue;

    // Last-write-wins, resolved client-side: check what Supabase currently has for this key
    // before overwriting it. If the remote copy is newer than the local edit about to be
    // pushed (another device already synced a later change), the remote value wins — pull it
    // into the local `kv` store instead of clobbering it, and drop the stale outbox entry.
    // Otherwise push local as usual. See the README for the tradeoff this implies.
    const { data: remote } = await supabase
      .from('kv_store')
      .select('value, updated_at, deleted')
      .eq('user_id', userId)
      .eq('key', key)
      .maybeSingle();

    if (remote && new Date(remote.updated_at) > new Date(entry.updatedAt)) {
      if (remote.deleted) {
        await db.delete('kv', key);
      } else {
        await db.put('kv', remote.value, key);
      }
      await db.delete('outbox', key);
      continue;
    }

    await supabase.from('kv_store').upsert({
      user_id: userId,
      key,
      value: entry.deleted ? null : entry.value,
      deleted: !!entry.deleted,
      updated_at: entry.updatedAt,
    });
    await db.delete('outbox', key);
  }
}

async function pullRemote() {
  const db = await getDb();
  const lastSync = (await db.get('meta', 'lastSyncAt')) || '1970-01-01T00:00:00.000Z';

  const { data: rows, error } = await supabase
    .from('kv_store')
    .select('key, value, updated_at, deleted')
    .eq('user_id', userId)
    .gt('updated_at', lastSync);

  if (error) throw error;
  if (!rows) return;

  let maxUpdatedAt = lastSync;
  for (const row of rows) {
    // A key with a pending local edit still sitting in the outbox takes priority over this
    // pull — it gets resolved (one way or the other) on the next pushOutbox() pass instead of
    // being silently overwritten here.
    const pending = await db.get('outbox', row.key);
    if (pending) continue;

    if (row.deleted) {
      await db.delete('kv', row.key);
    } else {
      await db.put('kv', row.value, row.key);
    }
    if (row.updated_at > maxUpdatedAt) maxUpdatedAt = row.updated_at;
  }
  await db.put('meta', maxUpdatedAt, 'lastSyncAt');
}

// Full re-sync — call right after sign-in, when the local device may have none of the
// account's existing data yet: resets the "last synced" bookmark so pullRemote() fetches
// everything instead of only what changed since some earlier point.
export async function fullResync() {
  const db = await getDb();
  await db.delete('meta', 'lastSyncAt');
  await runSync();
}
