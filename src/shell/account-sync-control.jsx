import React, { useState } from 'react';
import { useSync } from './sync-context.jsx';
import { RADIUS_SCALE, SPACE_SCALE, TYPE_SCALE } from './nav-context.jsx';

// The one place account sync is actually relevant: the Home dashboard, where a returning writer
// would look for it. Sign-in is optional the same way it always was — this only ever offers to
// carry writing to another device, never gates anything.
export function AccountSyncControl() {
    const sync = useSync();
    const [panelOpen, setPanelOpen] = useState(false);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [authError, setAuthError] = useState('');

    if (!sync)
        return null;
    const { session, signIn, signUp, signOut, signInWithOAuth } = sync;

    const handleSignUp = async (e) => {
        e.preventDefault();
        setAuthError('');
        const { error } = await signUp(email, password);
        if (error) setAuthError(error.message);
        else setPanelOpen(false);
    };

    const handleSignIn = async (e) => {
        e.preventDefault();
        setAuthError('');
        const { error } = await signIn(email, password);
        if (error) setAuthError(error.message);
        else setPanelOpen(false);
    };

    // Redirects away immediately on success, so there's nothing to close/reset here — only the
    // pre-redirect failure case (e.g. Google not enabled in the Supabase dashboard yet) surfaces
    // back to this panel.
    const handleGoogleSignIn = async () => {
        setAuthError('');
        const { error } = await signInWithOAuth('google');
        if (error) setAuthError(error.message);
    };

    return React.createElement("div", { style: { position: 'relative' } },
        React.createElement("button", {
            onClick: () => setPanelOpen((v) => !v),
            style: {
                display: 'inline-flex', alignItems: 'center', gap: SPACE_SCALE[6],
                background: 'none', border: '1px solid #2A2A30', color: session ? '#E8C468' : '#8A8272',
                borderRadius: RADIUS_SCALE[999], padding: '6px 12px', fontSize: TYPE_SCALE[11.5],
                cursor: 'pointer', fontFamily: 'inherit',
            },
        }, session ? `\u2601\uFE0F Synced \u00b7 ${session.user.email}` : "\u2601\uFE0F Sync this device"),
        panelOpen && React.createElement("div", {
            style: {
                position: 'absolute', top: 'calc(100% + 8px)', right: 0, zIndex: 30, width: 270,
                padding: 16, borderRadius: RADIUS_SCALE[12], border: '1px solid #3A3020',
                background: 'linear-gradient(160deg, #201A10, #17130E)', color: '#EFE7D2',
                fontSize: TYPE_SCALE[13], boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
            },
        },
            session
                ? React.createElement(React.Fragment, null,
                    React.createElement("p", { style: { marginTop: 0, color: '#B9AE8F' } }, `Signed in as ${session.user.email}`),
                    React.createElement("button", {
                        onClick: signOut, style: {
                            background: 'none', border: '1px solid #3A3020', color: '#EFE7D2',
                            borderRadius: RADIUS_SCALE[8], padding: '6px 12px', fontSize: TYPE_SCALE[12.5], cursor: 'pointer',
                        },
                    }, "Sign out"))
                : React.createElement(React.Fragment, null,
                    React.createElement("p", { style: { color: '#8A8272', marginTop: 0, fontStyle: 'italic' } },
                        "Optional — the app works fully offline without this. Sign in only to carry this device's writing to your other devices."),
                    React.createElement("input", {
                        placeholder: "email", value: email, onChange: (e) => setEmail(e.target.value),
                        style: { display: 'block', width: '100%', marginBottom: 8, boxSizing: 'border-box', background: '#100E0A', border: '1px solid #3A3020', borderRadius: RADIUS_SCALE[6], color: '#EFE7D2', padding: '6px 8px', fontFamily: 'inherit', fontSize: TYPE_SCALE[12.5] },
                    }),
                    React.createElement("input", {
                        placeholder: "password", type: "password", value: password,
                        onChange: (e) => setPassword(e.target.value),
                        style: { display: 'block', width: '100%', marginBottom: 8, boxSizing: 'border-box', background: '#100E0A', border: '1px solid #3A3020', borderRadius: RADIUS_SCALE[6], color: '#EFE7D2', padding: '6px 8px', fontFamily: 'inherit', fontSize: TYPE_SCALE[12.5] },
                    }),
                    React.createElement("div", { style: { display: 'flex', gap: SPACE_SCALE[8] } },
                        React.createElement("button", {
                            onClick: handleSignIn, style: {
                                background: 'none', border: '1px solid #3A3020', color: '#EFE7D2',
                                borderRadius: RADIUS_SCALE[8], padding: '6px 12px', fontSize: TYPE_SCALE[12.5], cursor: 'pointer',
                            },
                        }, "Sign in"),
                        React.createElement("button", {
                            onClick: handleSignUp, style: {
                                background: 'none', border: '1px solid #3A3020', color: '#EFE7D2',
                                borderRadius: RADIUS_SCALE[8], padding: '6px 12px', fontSize: TYPE_SCALE[12.5], cursor: 'pointer',
                            },
                        }, "Create account")),
                    React.createElement("div", {
                        style: { display: 'flex', alignItems: 'center', gap: SPACE_SCALE[8], margin: '10px 0', color: '#5C5C64' },
                    },
                        React.createElement("div", { style: { flex: 1, height: 1, background: '#3A3020' } }),
                        React.createElement("span", { style: { fontSize: TYPE_SCALE[11] } }, "or"),
                        React.createElement("div", { style: { flex: 1, height: 1, background: '#3A3020' } })),
                    React.createElement("button", {
                        onClick: handleGoogleSignIn,
                        style: {
                            width: '100%', boxSizing: 'border-box', display: 'flex', alignItems: 'center',
                            justifyContent: 'center', gap: SPACE_SCALE[8], padding: '6px 10px', borderRadius: RADIUS_SCALE[6],
                            border: '1px solid #3A3020', background: '#fff', color: '#1f1f1f', cursor: 'pointer',
                            fontSize: TYPE_SCALE[12.5], fontFamily: 'inherit',
                        },
                    }, "Continue with Google"),
                    authError && React.createElement("p", { style: { color: '#D98A8A', fontSize: TYPE_SCALE[12] } }, authError))));
}
