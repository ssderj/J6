import React, { createContext, useContext, useState, useEffect } from 'react';
import { onAuthChange, getSession, signIn, signUp, signOut, signInWithOAuth } from '../lib/auth.js';
import { setSyncUser, fullResync } from '../lib/syncEngine.js';

// Account sync used to be a floating "Sync · off" badge rendered by main.jsx on top of the whole
// app, outside its component tree entirely — which meant it showed up fixed in the corner of
// every single screen (Home, the Grand Library, a project workspace, the Guild Hall...) whether
// or not sync had anything to do with what was on screen. Moving the session/auth logic into a
// context here lets exactly one place — the Home dashboard, via AccountSyncControl in
// account-sync-control.jsx — render the actual control, while everything else can ignore it
// entirely. The session logic itself (getSession/onAuthChange wiring, the online-retry effect,
// sign in/up/out, Google OAuth) is unchanged from what main.jsx used to own directly.
export const SyncContext = createContext(null);

export function useSync() {
    return useContext(SyncContext);
}

export function SyncProvider({ children }) {
    const [session, setSession] = useState(null);
    const [ready, setReady] = useState(false);

    useEffect(() => {
        getSession().then((s) => {
            setSession(s);
            setReady(true);
            if (s) {
                setSyncUser(s.user.id);
                fullResync();
            }
        });
        return onAuthChange((s) => {
            setSession(s);
            if (s) {
                setSyncUser(s.user.id);
                fullResync();
            } else {
                setSyncUser(null);
            }
        });
    }, []);

    // Retry sync whenever the device comes back online — the outbox already holds anything
    // written while offline, this just stops it from waiting for the next local edit to flush.
    useEffect(() => {
        const handler = () => { if (session) fullResync(); };
        window.addEventListener('online', handler);
        return () => window.removeEventListener('online', handler);
    }, [session]);

    const value = { session, ready, signIn, signUp, signOut, signInWithOAuth };
    return React.createElement(SyncContext.Provider, { value }, children);
}
