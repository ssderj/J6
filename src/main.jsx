import React from 'react';
import { createRoot } from 'react-dom/client';
import { SyncProvider, useSync } from './shell/sync-context.jsx';
import InkrootApp from './App.jsx';

// Older browsers and some embedded WebViews don't have structuredClone (it only shipped widely
// in 2022) — carried over from the original single-file app's own polyfill, since the app's
// data is all plain JSON and this fallback is safe.
if (typeof structuredClone !== 'function') {
  window.structuredClone = (obj) => JSON.parse(JSON.stringify(obj));
}

// Session/auth logic itself now lives in SyncProvider (see shell/sync-context.jsx) so any
// screen inside the app can reach it via useSync() — previously this file rendered a fixed,
// always-on-top "Sync" badge that showed on every single screen regardless of relevance. The
// actual account control now lives only on the Home dashboard (see AccountSyncControl in
// shell/account-sync-control.jsx). SyncGate below preserves the original startup behavior
// exactly: the app doesn't render at all until the initial session check resolves.
function SyncGate() {
  const sync = useSync();
  if (!sync.ready) return null;
  return React.createElement(InkrootApp, null);
}

createRoot(document.getElementById('root')).render(
  React.createElement(SyncProvider, null, React.createElement(SyncGate, null))
);

