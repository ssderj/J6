# Inkroot — Phase 1 backend scaffold

> **Merge note:** this build combines two branches of the project — the file structure comes
> from a later pass that split the original single-file `src/App.jsx` into the modular
> `src/{shell,guild,library,writing,worldbuilding,shared-ui,shared-utils}/` layout you see here;
> the feature content (Phases 3–5 below, plus the accompanying schema files and `src/lib/`
> modules) comes from a parallel branch that kept building on the single-file version. Both
> started from the same Phase 1/2 base, so merging just meant carrying the newer guild-social,
> profiles, and player-guild logic into the already-split files rather than re-splitting
> anything. Every touched file was syntax-checked and cross-checked for import/export
> consistency after the merge.

This is a new project, separate from the single `Inkroot-consolidated.html` file — Phase 1 of
adding accounts + cross-device sync, offline-first. I couldn't run or test this scaffold myself
(no network access in the sandbox that built it, so no `npm install`, no real Supabase project to
connect to) — treat it as a solid starting point to run and verify yourself, not verified code.

## What this does

- Keeps everything working **fully offline with no account**, exactly like the original app —
  sync is opt-in, only active once signed in.
- Adds Supabase Auth (email/password to start; magic link is wired in `src/lib/auth.js` too).
- Syncs through a generic key-value table (`kv_store`) that mirrors the app's existing local
  storage keys (`inkroot:project:<id>`, `inkroot:writerProfile`, etc.) — no data model redesign
  needed for this phase.
- Local-first: every read/write hits IndexedDB immediately (via `src/lib/storage.js`, same
  `get/set/delete/list` shape the original app already used). A background sync engine
  (`src/lib/syncEngine.js`) pushes changes to Supabase when online and pulls remote changes
  down, using last-write-wins by timestamp.

## Setup

1. Create a free project at supabase.com.
2. In the SQL editor, run `supabase/schema.sql`.
3. In Project Settings → API, copy the Project URL and anon public key.
4. `cp .env.example .env.local` and fill in those two values.
5. `npm install`
6. `npm run dev`

## Conflict resolution — read this before relying on it

Last-write-wins by timestamp is simple and matches the `updatedAt` convention the original app
already used on projects, but it means: if the same key is edited offline on two devices before
either syncs, whichever change has the later timestamp wins outright — the other is discarded,
not merged. Fine for a solo writer moving between their own devices sequentially; would need a
real merge strategy (e.g. per-chapter granularity, or CRDTs) if you ever add simultaneous
multi-device or multi-person editing.

## Migrating the actual app in — done

The ~16,000-line component tree from `Inkroot-consolidated.html` is now in `src/App.jsx`.
What changed in the move:

1. The original inline `<script>` contents are in `src/App.jsx`, exporting a default
   `InkrootApp` component (`NavigationProvider` wrapping `InkRoot`, matching the original
   file's own mount call).
2. The original file's own inline IndexedDB-backed `storage` object — `IDB_DB_NAME`,
   `openInkrootDB`, `idbGet`/`idbSet`/`idbDelete`, the `localStorage` fallback, and the
   one-time migration logic — was **removed entirely**. Every call site (`storage.get(...)`,
   `storage.set(...)`, etc.) is untouched and now resolves to the import from
   `src/lib/storage.js` instead — same shape, now sync-aware.
3. The `<style>` block moved to `src/app.css`, imported directly in `App.jsx`.
4. The CDN `<script src="...react...">` tags are gone — `index.html` no longer loads
   React/ReactDOM from CDN; Vite bundles them from `node_modules` instead. `App.jsx` imports
   `React` as a normal module; every component itself is unchanged, since the app only ever
   called `React.createElement` directly and never used JSX.
5. `main.jsx` mounts `InkrootApp` unconditionally — signed in or not. Sync is opt-in via a
   small floating "Sync" button, not a login gate, so the app behaves exactly like the
   original offline-only version until you choose to sign in.

One thing intentionally left alone: `App.jsx` still has one dynamic `cdnjs.cloudflare.com`
script load (for d3.js, used by a chart). That's a separate, pre-existing lazy-load pattern
unrelated to this migration — fine to leave as-is, or swap for a real `d3` npm dependency later.

I could not run this myself — no network access in the sandbox that built it, so no
`npm install`, no real Supabase project, no actual browser render. Syntax-checked every file
with `node --check` (as a temporary `.mjs` copy for the two JSX-named-but-JSX-free files), but
that only proves the files parse — running `npm install && npm run dev` yourself is the real
test.

## Phase 2 — publishing/reviews — done

Real backend for the parts of the Grand Library that were "Coming Soon" placeholders:

- **`supabase/schema_phase2.sql`** — three new tables layered on top of Phase 1's `kv_store`:
  `published_books` (the public listing — title/blurb/genre/tags/price, publicly readable, only
  the author can write their own), `reviews` (one review per reader per book, publicly
  readable, only the reviewer can write their own), and `follows` (who follows whom). Run this
  in the Supabase SQL editor the same way you ran `schema.sql`.
- **`src/lib/library.js`** — the API: `publishBookRemote`/`unpublishBookRemote`,
  `fetchBookStats`/`fetchAuthorRatingsSummary`, `submitReview`, `follow`/`unfollowAuthor`,
  `fetchFollowers`. Every function checks for a session itself and no-ops gracefully when
  signed out, so nothing here needs the caller to track auth state.
- **Publishing is wired end to end**: `publishBookWithDetails` and `setPublishStatus` in
  `App.jsx` now push (or remove) the public listing after every local publish/unpublish/
  re-publish, fire-and-forget, same non-blocking philosophy as Phase 1's sync engine — a failed
  remote push never blocks or fails the local action.
- **Creator Dashboard's Ratings and Readers tabs are real now**, not Coming Soon panels:
  Ratings shows actual aggregate star ratings and reviews per published book; Readers shows
  actual followers. Each book card's Rating metric also now shows a real number once it has
  reviews.

What's still legitimately out of scope, and why:
- **Readers tab doesn't have traffic sources or page views** — that needs a separate
  events-tracking table, not part of this phase. Said honestly in the tab's own copy rather
  than implied.
- **Follower list shows ids, not names** — Supabase doesn't expose other users' profile data
  through a plain query (`auth.users` isn't publicly readable). Fixing this means mirroring a
  display name onto a small public `profiles` table the next time you touch auth — noted in
  `library.js` where it matters, not silently worked around.
- **Templates, Add-ons, Analytics, Earnings, Withdrawals** are still Coming Soon panels,
  unchanged — Earnings/Withdrawals genuinely need a real payment processor (a much bigger,
  separate decision), and Templates/Add-ons/Analytics are separate features this phase's plan
  never covered.

As with Phase 1, I could not run any of this myself — no Supabase project, no `npm install`, no
real browser. Syntax-checked with `node --check` only.

## Phase 3 (not built yet)

- **Phase 3** — guild social: `guilds`, `guild_members`, `fireside_posts`, plus Supabase
  Realtime subscriptions for live activity feeds.
