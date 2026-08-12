import { supabase } from './supabaseClient.js';

export async function signUp(email, password) {
  return supabase.auth.signUp({ email, password });
}

export async function signIn(email, password) {
  return supabase.auth.signInWithPassword({ email, password });
}

export async function signInWithMagicLink(email) {
  return supabase.auth.signInWithOtp({ email });
}

// Redirect-based OAuth: Supabase sends the browser to the provider, then back to redirectTo
// with an auth code in the URL. supabase-js has detectSessionInUrl on by default, so it
// exchanges that code for a session automatically on load — the existing onAuthChange
// listener in main.jsx picks it up the same way it picks up email/password sign-in, no extra
// wiring needed on the receiving end. Requires the provider to be enabled (client ID/secret)
// in the Supabase dashboard under Authentication > Providers — that part can't be done from
// code.
export async function signInWithOAuth(provider) {
  return supabase.auth.signInWithOAuth({
    provider,
    options: { redirectTo: window.location.origin },
  });
}

export async function signOut() {
  return supabase.auth.signOut();
}

export function onAuthChange(callback) {
  const { data } = supabase.auth.onAuthStateChange((_event, session) => {
    callback(session);
  });
  return () => data.subscription.unsubscribe();
}

export async function getSession() {
  const { data } = await supabase.auth.getSession();
  return data.session;
}
