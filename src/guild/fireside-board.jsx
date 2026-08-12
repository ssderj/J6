import React, { useState, useEffect } from 'react';
import { storage } from '../lib/storage.js';
import { supabase } from '../lib/supabaseClient.js';
import { fetchFiresidePosts, postFiresideMessage, subscribeFiresideRealtime, toggleFiresidePin, toggleFiresideReaction } from '../lib/library-guild.js';
import { FIRESIDE_CATEGORIES, FIRESIDE_KEY, FIRESIDE_REACTIONS } from './guild-hall.jsx';
import { EmptyState } from '../shared-ui/ui-cards.jsx';
import { uuid } from '../shared-utils/storage-keys.jsx';
import { RADIUS_SCALE, SPACE_SCALE, TYPE_SCALE } from '../shell/nav-context.jsx';


// One message bubble — styled like a scrap of parchment rather than a chat bubble. Handles both
// top-level posts (which can be pinned and replied to) and replies (a single level deep, no
// further nesting) via the isReply flag.
export function FiresideMessage({ msg, profile, isReply, onReply, onTogglePin, onToggleReaction, showReplyComposer, replyDraft, onReplyDraftChange, onSubmitReply, onCancelReply }) {
    const cat = FIRESIDE_CATEGORIES.find((c) => c.key === msg.category) || FIRESIDE_CATEGORIES[0];
    const dateLabel = new Date(msg.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    return React.createElement("div", { style: {
            background: 'linear-gradient(160deg, #EFE3C4 0%, #E1CE9F 55%, #CBB07E 100%)', color: '#2A1D10',
            borderRadius: RADIUS_SCALE[10], padding: '14px 16px', marginLeft: isReply ? 30 : 0, position: 'relative',
            boxShadow: '0 6px 14px rgba(0,0,0,0.3)', marginBottom: 12, textAlign: 'left',
        } },
        msg.pinned && React.createElement("div", { style: { position: 'absolute', top: -8, right: 12, fontSize: TYPE_SCALE[14] } }, "\uD83D\uDCCC"),
        React.createElement("div", { style: { display: 'flex', alignItems: 'center', gap: SPACE_SCALE[8], marginBottom: 6, flexWrap: 'wrap' } },
            React.createElement("div", { style: {
                    width: 26, height: 26, borderRadius: '50%', flexShrink: 0,
                    background: profile.avatar ? `center/cover url(${profile.avatar})` : 'radial-gradient(circle at 34% 28%, #cbb07e, #8a6b25 72%)',
                    border: '1px solid #8A6B25',
                } }),
            React.createElement("span", { style: { fontWeight: 700, fontSize: TYPE_SCALE[12.5] } }, msg.authorName || profile.name || 'Unnamed Writer'),
            React.createElement("span", { style: { fontSize: TYPE_SCALE[10], color: '#6B5A3E' } }, cat.icon + ' ' + cat.label),
            React.createElement("span", { style: { fontSize: TYPE_SCALE[10], color: '#8A7355', marginLeft: 'auto' } }, dateLabel)),
        React.createElement("div", { style: { fontSize: TYPE_SCALE[13], lineHeight: 1.5, whiteSpace: 'pre-wrap' } }, msg.text),
        React.createElement("div", { style: { display: 'flex', gap: SPACE_SCALE[6], marginTop: 10, flexWrap: 'wrap' } },
            FIRESIDE_REACTIONS.map((r) => React.createElement("button", { key: r.key, onClick: () => onToggleReaction(msg.id, r.key), title: r.label, style: {
                    background: msg.reactions && msg.reactions[r.key] ? 'rgba(59,42,24,0.18)' : 'none',
                    border: '1px solid rgba(59,42,24,0.3)', borderRadius: RADIUS_SCALE[999], padding: '3px 8px', fontSize: TYPE_SCALE[11], cursor: 'pointer', color: '#3B2A18',
                } }, r.icon)),
            !isReply && React.createElement("button", { onClick: () => onReply(msg.id), style: {
                    background: 'none', border: '1px solid rgba(59,42,24,0.3)', borderRadius: RADIUS_SCALE[999], padding: '3px 10px', fontSize: TYPE_SCALE[11], cursor: 'pointer', color: '#3B2A18',
                } }, "\u21A9 Reply"),
            !isReply && React.createElement("button", { onClick: () => onTogglePin(msg.id), style: {
                    background: 'none', border: '1px solid rgba(59,42,24,0.3)', borderRadius: RADIUS_SCALE[999], padding: '3px 10px', fontSize: TYPE_SCALE[11], cursor: 'pointer', color: '#3B2A18',
                } }, msg.pinned ? "Unpin" : "\uD83D\uDCCC Pin")),
        showReplyComposer && React.createElement("div", { style: { marginTop: 10, display: 'flex', gap: SPACE_SCALE[8] } },
            React.createElement("input", { value: replyDraft, onChange: (e) => onReplyDraftChange(e.target.value), placeholder: "Write a reply\u2026", style: {
                    flex: 1, borderRadius: RADIUS_SCALE[8], border: '1px solid rgba(59,42,24,0.3)', padding: '7px 10px', fontSize: TYPE_SCALE[12.5], background: 'rgba(255,255,255,0.35)', color: '#2A1D10',
                } }),
            React.createElement("button", { onClick: () => onSubmitReply(msg.id), style: {
                    background: '#3B2A18', color: '#EFE3C4', border: 'none', borderRadius: RADIUS_SCALE[8], padding: '7px 12px', fontSize: TYPE_SCALE[12], cursor: 'pointer',
                } }, "Post"),
            React.createElement("button", { onClick: onCancelReply, style: {
                    background: 'none', color: '#3B2A18', border: 'none', fontSize: TYPE_SCALE[12], cursor: 'pointer',
                } }, "Cancel")));
}


// The Fireside itself: a fireplace visual, a category-tagged composer, pinned messages surfaced
// above the rest, and single-level reply threads. Two persistence modes behind one identical
// render path: local-only via FIRESIDE_KEY (unsigned-in, or no active Founder Guild — the
// original behavior, unchanged), or shared via Supabase + Realtime once signed in to a Founder
// Guild (see library-guild.js). Both modes produce the exact same `messages` shape, so
// everything below this point (topLevel/pinned/rest/repliesFor/renderThread) doesn't need to
// know or care which mode it's in.
export function FiresideBoard({ profile, guildId }) {
    const [mode, setMode] = useState('checking'); // 'checking' | 'remote' | 'local'
    const [userId, setUserId] = useState(null);
    const [messages, setMessages] = useState(null); // null while loading
    const [draft, setDraft] = useState('');
    const [draftCategory, setDraftCategory] = useState('discussion');
    const [replyingTo, setReplyingTo] = useState(null);
    const [replyDraft, setReplyDraft] = useState('');

    const toLocalShape = (posts, reactionsByPost, myId) => posts.map((p) => ({
        id: p.id, parentId: p.parent_id, category: p.category, text: p.body,
        createdAt: new Date(p.created_at).getTime(), pinned: p.pinned, authorName: p.author_name,
        reactions: FIRESIDE_REACTIONS.reduce((acc, r) => {
            acc[r.key] = (reactionsByPost[p.id] || []).some((x) => x.reaction === r.key && x.user_id === myId);
            return acc;
        }, {}),
    }));

    const refetchRemote = React.useCallback(() => {
        fetchFiresidePosts(guildId)
            .then(({ posts, reactionsByPost }) => setMessages(toLocalShape(posts, reactionsByPost, userId)))
            .catch((e) => console.warn('Inkroot: fireside fetch failed', e));
    }, [guildId, userId]);

    // Decide mode once: local-only unless there's both a Founder Guild to post into and a
    // signed-in reader to post as. Falling back to local rather than blocking is deliberate —
    // the Fireside should never be unusable just because sync isn't configured.
    useEffect(() => {
        let cancelled = false;
        if (!guildId) {
            setMode('local');
            return;
        }
        supabase.auth.getUser().then(({ data }) => {
            if (cancelled) return;
            if (data.user) {
                setUserId(data.user.id);
                setMode('remote');
            } else {
                setMode('local');
            }
        });
        return () => { cancelled = true; };
    }, [guildId]);

    useEffect(() => {
        if (mode === 'local') {
            (async () => {
                const res = await storage.get(FIRESIDE_KEY);
                if (res) {
                    setMessages(JSON.parse(res.value));
                    return;
                }
                await storage.set(FIRESIDE_KEY, JSON.stringify([]));
                setMessages([]);
            })();
        } else if (mode === 'remote') {
            refetchRemote();
            const unsubscribe = subscribeFiresideRealtime(guildId, refetchRemote);
            return unsubscribe;
        }
    }, [mode, refetchRemote]);

    const persistLocal = (next) => {
        setMessages(next);
        storage.set(FIRESIDE_KEY, JSON.stringify(next));
    };

    const handlePost = () => {
        const text = draft.trim();
        if (!text)
            return;
        if (mode === 'remote') {
            postFiresideMessage(guildId, draftCategory, text, null).then(refetchRemote).catch((e) => console.warn('Inkroot: fireside post failed', e));
        } else {
            const msg = { id: uuid(), parentId: null, category: draftCategory, text, createdAt: Date.now(), pinned: false, reactions: {} };
            persistLocal([msg, ...(messages || [])]);
        }
        setDraft('');
    };
    const handleReply = (parentId) => {
        setReplyingTo(parentId);
        setReplyDraft('');
    };
    const handleSubmitReply = (parentId) => {
        const text = replyDraft.trim();
        if (!text)
            return;
        if (mode === 'remote') {
            postFiresideMessage(guildId, 'discussion', text, parentId).then(refetchRemote).catch((e) => console.warn('Inkroot: fireside reply failed', e));
        } else {
            const msg = { id: uuid(), parentId, category: 'discussion', text, createdAt: Date.now(), pinned: false, reactions: {} };
            persistLocal([...(messages || []), msg]);
        }
        setReplyingTo(null);
        setReplyDraft('');
    };
    const handleTogglePin = (id) => {
        if (mode === 'remote') {
            const current = (messages || []).find((m) => m.id === id);
            toggleFiresidePin(id, !(current && current.pinned)).then(refetchRemote).catch((e) => console.warn('Inkroot: fireside pin failed \u2014 you can only pin your own posts', e));
        } else {
            persistLocal((messages || []).map((m) => m.id === id ? { ...m, pinned: !m.pinned } : m));
        }
    };
    const handleToggleReaction = (id, key) => {
        if (mode === 'remote') {
            const current = (messages || []).find((m) => m.id === id);
            const active = !!(current && current.reactions && current.reactions[key]);
            toggleFiresideReaction(id, key, active).then(refetchRemote).catch((e) => console.warn('Inkroot: fireside reaction failed', e));
        } else {
            persistLocal((messages || []).map((m) => m.id === id ? { ...m, reactions: { ...m.reactions, [key]: !(m.reactions && m.reactions[key]) } } : m));
        }
    };
    if (messages === null) {
        return React.createElement("div", { style: { textAlign: 'center', padding: '40px 12px', fontSize: TYPE_SCALE[12.5], color: '#5C5C64' } }, "The fire is catching\u2026");
    }
    const topLevel = messages.filter((m) => !m.parentId).sort((a, b) => b.createdAt - a.createdAt);
    const pinned = topLevel.filter((m) => m.pinned);
    const rest = topLevel.filter((m) => !m.pinned);
    const repliesFor = (id) => messages.filter((m) => m.parentId === id).sort((a, b) => a.createdAt - b.createdAt);
    const renderThread = (m) => React.createElement(React.Fragment, { key: m.id },
        React.createElement(FiresideMessage, {
            msg: m, profile, isReply: false, onReply: handleReply, onTogglePin: handleTogglePin, onToggleReaction: handleToggleReaction,
            showReplyComposer: replyingTo === m.id, replyDraft, onReplyDraftChange: setReplyDraft, onSubmitReply: handleSubmitReply, onCancelReply: () => setReplyingTo(null),
        }),
        repliesFor(m.id).map((r) => React.createElement(FiresideMessage, { key: r.id, msg: r, profile, isReply: true, onReply: () => { }, onTogglePin: () => { }, onToggleReaction: handleToggleReaction, showReplyComposer: false, replyDraft: '', onReplyDraftChange: () => { }, onSubmitReply: () => { }, onCancelReply: () => { } })));
    return React.createElement("div", { className: "fireside-hall" },
        React.createElement("div", { className: "fireside-fire" },
            React.createElement("div", { className: "fireside-flame f1" }),
            React.createElement("div", { className: "fireside-flame f2" }),
            React.createElement("div", { className: "fireside-flame f3" })),
        mode === 'local' && guildId && React.createElement("div", { style: { textAlign: 'center', fontSize: TYPE_SCALE[10.5], color: '#5C5C64', fontStyle: 'italic', padding: '10px 18px 0' } },
            "Local only right now \u2014 sign in to share this Fireside with the rest of the guild."),
        React.createElement("div", { style: { padding: '22px 18px 0' } },
            React.createElement("div", { style: { display: 'flex', gap: SPACE_SCALE[6], flexWrap: 'wrap', marginBottom: 12, justifyContent: 'center' } },
                FIRESIDE_CATEGORIES.map((c) => React.createElement("button", { key: c.key, onClick: () => setDraftCategory(c.key), style: {
                        background: draftCategory === c.key ? 'linear-gradient(160deg, #241F14, #1A160D)' : 'none',
                        border: '1px solid #3A3020', color: draftCategory === c.key ? '#E8C468' : '#A6A6AD',
                        borderRadius: RADIUS_SCALE[999], padding: '6px 12px', fontSize: TYPE_SCALE[11.5], cursor: 'pointer',
                    } }, c.icon + ' ' + c.label))),
            React.createElement("div", { style: { display: 'flex', gap: SPACE_SCALE[8], marginBottom: 22 } },
                React.createElement("textarea", { value: draft, onChange: (e) => setDraft(e.target.value), placeholder: "Share something by the fire\u2026", rows: 2, style: {
                        flex: 1, borderRadius: RADIUS_SCALE[10], border: '1px solid #3A3020', background: '#1D1A14', color: '#EFE7D2', padding: '10px 12px', fontSize: TYPE_SCALE[13], resize: 'vertical', fontFamily: 'inherit',
                    } }),
                React.createElement("button", { onClick: handlePost, style: {
                        background: 'linear-gradient(160deg, #241F14, #17140F)', border: '1px solid #4A3D22', color: '#E8C468',
                        borderRadius: RADIUS_SCALE[10], padding: '0 18px', fontSize: TYPE_SCALE[13], fontWeight: 600, cursor: 'pointer',
                    } }, "Post")),
            pinned.length > 0 && React.createElement("div", { style: { marginBottom: 20 } },
                React.createElement("div", { style: { fontSize: TYPE_SCALE[10.5], color: '#C89B3C', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 10 } }, "\uD83D\uDCCC Pinned"),
                pinned.map(renderThread)),
            (rest.length === 0 && pinned.length === 0)
                ? React.createElement(EmptyState, { text: "The fire is quiet \u2014 be the first to share something." })
                : rest.map(renderThread)),
        React.createElement("div", { className: "fireside-bench" }));
}
