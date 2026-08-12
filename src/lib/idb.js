import { openDB } from 'idb';

const DB_NAME = 'inkroot';
const DB_VERSION = 1;

let dbPromise = null;

export function getDb() {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        // Current value for every key — same role as the original single-file app's IndexedDB
        // store. Keyed directly by the storage key string (e.g. 'inkroot:project:<id>').
        if (!db.objectStoreNames.contains('kv')) {
          db.createObjectStore('kv');
        }
        // Pending local changes not yet confirmed pushed to Supabase. Keyed by the same
        // storage key, so a second local edit to the same key before the first sync completes
        // just overwrites the pending entry rather than queuing duplicate pushes.
        if (!db.objectStoreNames.contains('outbox')) {
          db.createObjectStore('outbox');
        }
        // Bookkeeping — e.g. the timestamp of the last successful pull, so incremental syncs
        // only ask Supabase for rows changed since then instead of the whole table every time.
        if (!db.objectStoreNames.contains('meta')) {
          db.createObjectStore('meta');
        }
      },
    });
  }
  return dbPromise;
}
