import React, { useState, useEffect, useRef, useMemo } from 'react';
import { GUILD_UNLOCK_LEVEL, GuildLockShatter } from '../guild/guild-reputation-panel.jsx';
import { playGuildUnlockSound, readGuildUnlockSeen, writeGuildUnlockSeen } from '../guild/guild-sound-fx.jsx';
import { GrandLibraryAtmosphere } from '../library/grand-library-cards.jsx';
import { ArchiveDivider } from '../shared-ui/ui-cards.jsx';
import { RADIUS_SCALE, SPACE_SCALE, TYPE_SCALE } from './nav-context.jsx';


// ---------- Ink line-icon set ----------
// A small custom SVG icon set standing in for raw emoji glyphs across Home's navigation and
// Quick Access. Emoji render inconsistently across iOS/Android/desktop and read as generic app
// chrome rather than matching the hand-drawn medieval/parchment feel used everywhere else (the
// wooden table, the tree rail, the bookshelf). Every glyph is a plain 24x24 stroke icon that
// uses currentColor for its stroke (and, for the couple of small filled dots, its fill too), so
// it automatically inherits whatever gold/muted tint its parent button already applies for
// active/inactive state — no separate color logic needed at each call site. Add a new key to
// ICON_PATHS to extend the set; InkIcon and its sizing/color props stay the same.
export const ICON_PATHS = {
    home: React.createElement(React.Fragment, null,
        React.createElement("path", { d: "M4,11.5 L12,4.5 L20,11.5" }),
        React.createElement("path", { d: "M6.5,10 V19 A1,1 0 0,0 7.5,20 H16.5 A1,1 0 0,0 17.5,19 V10" }),
        React.createElement("path", { d: "M10,20 V14.5 H14 V20" })),
    guild: React.createElement(React.Fragment, null,
        React.createElement("path", { d: "M12,3.5 L18.5,6 V11.5 C18.5,16 15.5,19 12,20.5 C8.5,19 5.5,16 5.5,11.5 V6 Z" }),
        React.createElement("path", { d: "M9,10.5 L12,12.5 L15,10.5" })),
    library: React.createElement(React.Fragment, null,
        React.createElement("path", { d: "M4,19 V5.6 C4,5.3 4.3,5 4.6,5 H7.4 C7.7,5 8,5.3 8,5.6 V19" }),
        React.createElement("path", { d: "M9.5,19 V4.6 C9.5,4.3 9.8,4 10.1,4 H12.9 C13.2,4 13.5,4.3 13.5,4.6 V19" }),
        React.createElement("path", { d: "M15,19 V6.6 C15,6.3 15.3,6 15.6,6 H18.4 C18.7,6 19,6.3 19,6.6 V19" }),
        React.createElement("path", { d: "M3.5,19 H19.5" })),
    universe: React.createElement(React.Fragment, null,
        React.createElement("ellipse", { cx: 12, cy: 12, rx: 8.5, ry: 3.6, transform: "rotate(-20 12 12)" }),
        React.createElement("circle", { cx: 12, cy: 12, r: 1.7, fill: "currentColor", stroke: "none" }),
        React.createElement("circle", { cx: 18.3, cy: 6.2, r: 0.8, fill: "currentColor", stroke: "none" }),
        React.createElement("circle", { cx: 5.4, cy: 17.6, r: 0.6, fill: "currentColor", stroke: "none" })),
    inbox: React.createElement(React.Fragment, null,
        React.createElement("rect", { x: 3.5, y: 6, width: 17, height: 13, rx: 1.4 }),
        React.createElement("path", { d: "M4,7 L12,13.5 L20,7" })),
    lock: React.createElement(React.Fragment, null,
        React.createElement("rect", { x: 5.5, y: 10.5, width: 13, height: 9, rx: 1.6 }),
        React.createElement("path", { d: "M8,10.5 V7.8 A4,4 0 0,1 16,7.8 V10.5" })),
    unlock: React.createElement(React.Fragment, null,
        React.createElement("rect", { x: 5.5, y: 10.5, width: 13, height: 9, rx: 1.6 }),
        React.createElement("path", { d: "M8,10.5 V7.8 A4,4 0 0,1 15.7,6.3" })),
    plus: React.createElement(React.Fragment, null,
        React.createElement("path", { d: "M12,5 V19" }),
        React.createElement("path", { d: "M5,12 H19" })),
    download: React.createElement(React.Fragment, null,
        React.createElement("path", { d: "M12,4 V15" }),
        React.createElement("path", { d: "M7.5,11.5 L12,16 L16.5,11.5" }),
        React.createElement("path", { d: "M4.5,18.5 H19.5" })),
    upload: React.createElement(React.Fragment, null,
        React.createElement("path", { d: "M12,16 V5" }),
        React.createElement("path", { d: "M7.5,9.5 L12,5 L16.5,9.5" }),
        React.createElement("path", { d: "M4.5,18.5 H19.5" })),
    broom: React.createElement(React.Fragment, null,
        React.createElement("path", { d: "M16,4 L10,10" }),
        React.createElement("path", { d: "M10,10 L5,18 L15,18 Z" }),
        React.createElement("path", { d: "M9,18 L8.3,20.5" }),
        React.createElement("path", { d: "M12,18 L12,20.5" })),
    tree: React.createElement(React.Fragment, null,
        React.createElement("path", { d: "M12,21 V14" }),
        React.createElement("circle", { cx: 12, cy: 9, r: 6 })),
    package: React.createElement(React.Fragment, null,
        React.createElement("path", { d: "M4,8 L12,4 L20,8 L12,12 Z" }),
        React.createElement("path", { d: "M4,8 V16 L12,20 L20,16 V8" }),
        React.createElement("path", { d: "M12,12 V20" })),
    book: React.createElement(React.Fragment, null,
        React.createElement("path", { d: "M12,6.5 C9.7,5 6.3,4.5 3.8,5 V18 C6.3,17.5 9.7,18 12,19.5" }),
        React.createElement("path", { d: "M12,6.5 C14.3,5 17.7,4.5 20.2,5 V18 C17.7,17.5 14.3,18 12,19.5" }),
        React.createElement("path", { d: "M12,6.5 V19.5" })),
    puzzle: React.createElement(React.Fragment, null,
        React.createElement("rect", { x: 5.5, y: 5.5, width: 12, height: 12, rx: 1.6 }),
        React.createElement("circle", { cx: 11.5, cy: 5.5, r: 2 }),
        React.createElement("circle", { cx: 17.5, cy: 12, r: 2 })),
    sparkle: React.createElement("path", {
        d: "M12,2.5 C12.6,7.5 13,9.5 19,10.5 C13,11.5 12.6,13.5 12,18.5 C11.4,13.5 11,11.5 5,10.5 C11,9.5 11.4,7.5 12,2.5 Z",
        fill: "currentColor", stroke: "none",
    }),
    chart: React.createElement(React.Fragment, null,
        React.createElement("path", { d: "M4,17.5 L9.5,11 L13,14 L19.5,6" }),
        React.createElement("path", { d: "M14,6 H19.5 V11.5" })),
    coin: React.createElement(React.Fragment, null,
        React.createElement("circle", { cx: 12, cy: 12, r: 8 }),
        React.createElement("circle", { cx: 12, cy: 12, r: 5 }),
        React.createElement("path", { d: "M12,9.3 V14.7" })),
    cash: React.createElement(React.Fragment, null,
        React.createElement("rect", { x: 3, y: 7, width: 18, height: 10, rx: 1.6 }),
        React.createElement("ellipse", { cx: 12, cy: 12, rx: 3, ry: 2.4 })),
    moneybag: React.createElement(React.Fragment, null,
        React.createElement("path", { d: "M12,4 C10.2,4 9,5.6 9,7.2 C7,7.8 4.8,10.5 4.8,14.3 C4.8,18.4 7.6,21 12,21 C16.4,21 19.2,18.4 19.2,14.3 C19.2,10.5 17,7.8 15,7.2 C15,5.6 13.8,4 12,4 Z" }),
        React.createElement("path", { d: "M9.3,7.4 H14.7" })),
    star: React.createElement("path", {
        d: "M12,3.5 L14.6,9.2 L20.8,9.9 L16.2,14 L17.5,20.2 L12,17 L6.5,20.2 L7.8,14 L3.2,9.9 L9.4,9.2 Z",
    }),
    users: React.createElement(React.Fragment, null,
        React.createElement("circle", { cx: 9, cy: 8.5, r: 3 }),
        React.createElement("path", { d: "M4,20 C4,15.7 6.3,13.5 9,13.5 C11.7,13.5 14,15.7 14,20" }),
        React.createElement("circle", { cx: 17, cy: 9.5, r: 2.4 }),
        React.createElement("path", { d: "M14.3,20 C14.3,16.3 16,14.3 17.3,14.3 C18.9,14.3 20.5,16 20.8,19" })),
};


export function InkIcon({ name, size = 18, color = 'currentColor', strokeWidth = 1.6, style }) {
    const glyph = ICON_PATHS[name];
    if (!glyph)
        return null;
    return React.createElement("svg", {
        width: size, height: size, viewBox: "0 0 24 24", fill: "none",
        stroke: color, strokeWidth, strokeLinecap: "round", strokeLinejoin: "round",
        style: Object.assign({ display: 'block', flexShrink: 0 }, style),
        "aria-hidden": "true",
    }, glyph);
}


export function HomeNav({ activeTab, onSelect, writerLevel, inboxUnreadCount, hasProjects }) {
    const [showTooltip, setShowTooltip] = useState(false);
    const [celebrate, setCelebrate] = useState(false);
    // Collapsed by default: a single neat row of icon-only buttons (see .home-nav-icon-btn) so five
    // tabs never fight for space the way the old all-in-one-row text pills did on narrow phones.
    // The toggle reveals this same row again underneath with full labels, for anyone who wants the
    // names spelled out — same tabs, same onSelect calls, just not crammed together by default.
    const [expanded, setExpanded] = useState(false);
    const tooltipTimer = useRef(null);
    const celebrateTimer = useRef(null);
    const hasCelebratedRef = useRef(readGuildUnlockSeen());
    const unlocked = writerLevel >= GUILD_UNLOCK_LEVEL;
    // Library and Universe are gated too, but neither has earned its own unlock ceremony the way
    // Guild has (see `celebrate` below), so they get a plain lock + tooltip rather than the glow/
    // burst treatment. Library unlocks on readiness (you've actually started something), not
    // tenure; Universe rides the same level threshold as Guild since it's a guild-adjacent feature.
    const libraryLocked = !hasProjects;
    const universeLocked = !unlocked;
    const [lockedTooltipKey, setLockedTooltipKey] = useState(null);
    const lockedTooltipTimer = useRef(null);
    const LOCK_MESSAGES = {
        library: "Start your first project to unlock the Grand Library.",
        universe: `Reach Writer Level ${GUILD_UNLOCK_LEVEL} to unlock the Living Universe.`,
    };
    const handleLockedTap = (key) => {
        setLockedTooltipKey(key);
        if (lockedTooltipTimer.current)
            clearTimeout(lockedTooltipTimer.current);
        lockedTooltipTimer.current = setTimeout(() => setLockedTooltipKey(null), 3200);
    };
    useEffect(() => {
        if (unlocked && !hasCelebratedRef.current) {
            hasCelebratedRef.current = true;
            writeGuildUnlockSeen();
            setCelebrate(true);
            playGuildUnlockSound();
            celebrateTimer.current = setTimeout(() => setCelebrate(false), 2600);
        }
    }, [unlocked]);
    useEffect(() => () => {
        if (tooltipTimer.current)
            clearTimeout(tooltipTimer.current);
        if (celebrateTimer.current)
            clearTimeout(celebrateTimer.current);
        if (lockedTooltipTimer.current)
            clearTimeout(lockedTooltipTimer.current);
    }, []);
    const handleGuildTap = () => {
        if (unlocked) {
            onSelect('guild');
            setExpanded(false);
            return;
        }
        setShowTooltip(true);
        if (tooltipTimer.current)
            clearTimeout(tooltipTimer.current);
        tooltipTimer.current = setTimeout(() => setShowTooltip(false), 3200);
    };
    const selectTab = (key, locked) => {
        if (locked) {
            handleLockedTap(key);
            return;
        }
        onSelect(key);
        setExpanded(false);
    };
    // 0 while there's no urgency yet, climbing to 1 right at level 9 (still locked) — used to
    // gently scale up the glow's blur/spread/opacity/speed the closer the writer gets to 10.
    const proximity = unlocked ? 0 : Math.max(0, Math.min(1, (writerLevel - 6) / 3));
    const nearMax = !unlocked && writerLevel >= 9;
    const showLock = !unlocked || celebrate;
    const glowVars = {
        '--guild-glow-blur': `${14 + proximity * 14}px`,
        '--guild-glow-spread': `${1 + proximity * 3}px`,
        '--guild-glow-opacity': (0.26 + proximity * 0.3).toFixed(2),
        '--guild-glow-duration': `${(3.4 - proximity * 0.8).toFixed(2)}s`,
    };
    // Each key doubles as its InkIcon name (see ICON_PATHS above) — home/guild/library/universe/
    // inbox all have a matching glyph, so there's no separate icon field to keep in sync.
    const TABS = [
        { key: 'home', label: 'Home' },
        { key: 'guild', label: 'Guild' },
        { key: 'library', label: 'Grand Library' },
        { key: 'universe', label: 'Universe' },
        { key: 'inbox', label: 'Inbox' },
    ];
    return React.createElement("div", { style: {
            position: 'sticky', top: 0, zIndex: 30, width: '100%',
            background: 'rgba(23,23,27,0.92)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)',
            borderBottom: '1px solid #2A2A30',
        } },
        React.createElement("style", null, `
        .home-nav-icon-row { display: flex; align-items: center; gap: 8px; }
        .home-nav-icon-btn {
          width: 42px; height: 42px; border-radius: 50%; border: 1px solid #2A2A30; cursor: pointer;
          background: #1D1D22; display: flex; align-items: center; justify-content: center; font-size: 17px;
          color: #7A7A82; position: relative; flex-shrink: 0; padding: 0;
          transition: background var(--ink-dur) var(--ink-ease), color var(--ink-dur) var(--ink-ease),
            border-color var(--ink-dur) var(--ink-ease), box-shadow var(--ink-dur) var(--ink-ease);
        }
        .home-nav-icon-btn.active {
          background: linear-gradient(160deg, #241F14, #1A160D); border-color: #4A3D22; color: #E8C468;
          box-shadow: 0 0 14px rgba(232,196,104,0.32), inset 0 1px 0 rgba(255,255,255,0.06);
        }
        .home-nav-icon-btn:hover { border-color: #4A3D22; }
        .home-nav-toggle {
          width: 42px; height: 42px; border-radius: 50%; border: 1px solid #2A2A30; cursor: pointer;
          background: #1D1D22; display: flex; align-items: center; justify-content: center; color: #C89B3C;
          margin-left: auto; flex-shrink: 0; padding: 0; font-size: 13px;
          transition: transform var(--ink-dur) var(--ink-ease), background var(--ink-dur) var(--ink-ease), border-color var(--ink-dur) var(--ink-ease);
        }
        .home-nav-toggle:hover { border-color: #4A3D22; }
        .home-nav-toggle.open { transform: rotate(180deg); }
        .home-nav-badge {
          position: absolute; top: -3px; right: -3px; font-size: 9.5px; font-weight: 700; color: #1A1610;
          background: #E8C468; border-radius: 999px; min-width: 15px; text-align: center; padding: 1px 4px;
          line-height: 13px; box-shadow: 0 0 6px rgba(232,196,104,0.5); pointer-events: none;
        }
        .home-nav-lock { font-size: 9px; position: absolute; bottom: -2px; right: -3px; }
        .home-nav-panel {
          overflow: hidden; max-height: 0; opacity: 0;
          transition: max-height var(--ink-dur) var(--ink-ease), opacity var(--ink-dur) var(--ink-ease);
        }
        .home-nav-panel.open { max-height: 320px; opacity: 1; margin-top: 6px; }
        .home-nav-row {
          width: 100%; display: flex; align-items: center; gap: 12px; border: none; cursor: pointer;
          background: transparent; text-align: left; padding: 11px 4px; color: #A6A6AD;
          border-top: 1px solid #24242A;
          transition: background var(--ink-dur) var(--ink-ease), color var(--ink-dur) var(--ink-ease);
        }
        .home-nav-row:hover { background: #1D1D22; }
        .home-nav-row.active { color: #E8C468; }
        .home-nav-row-icon { width: 26px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
        .home-nav-row-label { flex: 1; font-size: 13.5px; font-weight: 600; line-height: 1.3; }
        .home-nav-row-sub { display: block; font-size: 10.5px; color: #7A7A82; font-weight: 500; margin-top: 2px; }
      `),
        React.createElement("div", { className: "ink-page-container", style: { padding: '12px 24px', position: 'relative' } },
            React.createElement("div", { className: "home-nav-icon-row" },
                TABS.map((t) => {
                    if (t.key === 'guild') {
                        return React.createElement("div", { key: t.key, style: { position: 'relative' } },
                            React.createElement("button", {
                                onClick: handleGuildTap,
                                title: unlocked ? "Guild" : `Guild — reach level ${GUILD_UNLOCK_LEVEL} to unlock`,
                                "aria-label": "Guild",
                                className: ["home-nav-icon-btn", activeTab === 'guild' && 'active', !unlocked && 'ink-guild-lock-pulse', celebrate && 'ink-guild-unlock-burst'].filter(Boolean).join(' '),
                                style: glowVars,
                            },
                                nearMax && React.createElement("span", { className: "ink-guild-shimmer-sweep" }),
                                React.createElement(InkIcon, { name: "guild", size: 19 }),
                                showLock && React.createElement("span", { className: "home-nav-lock" + (celebrate ? ' ink-guild-lock-crack' : '') },
                                    React.createElement(InkIcon, { name: "lock", size: 10 }),
                                    celebrate && React.createElement(GuildLockShatter, null))),
                            showTooltip && !unlocked && React.createElement("div", { style: {
                                    position: 'absolute', top: '100%', left: '50%', transform: 'translateX(-50%)', marginTop: 8, width: 200, zIndex: 40,
                                    background: 'linear-gradient(160deg, #201C13, #17140F)', border: '1px solid #4A3D22',
                                    borderRadius: RADIUS_SCALE[10], padding: '11px 13px', fontSize: TYPE_SCALE[12], color: '#D9D2BE', lineHeight: 1.45,
                                    boxShadow: '0 8px 20px rgba(0,0,0,0.4)', textAlign: 'left',
                                } }, "Reach Writer Level 10 to unlock the Guild Hall."));
                    }
                    if (t.key === 'library' || t.key === 'universe') {
                        const locked = t.key === 'library' ? libraryLocked : universeLocked;
                        return React.createElement("div", { key: t.key, style: { position: 'relative' } },
                            React.createElement("button", {
                                onClick: () => selectTab(t.key, locked),
                                title: locked ? LOCK_MESSAGES[t.key] : t.label, "aria-label": t.label,
                                className: "home-nav-icon-btn" + (activeTab === t.key ? ' active' : ''),
                            },
                                React.createElement(InkIcon, { name: t.key, size: 19 }),
                                locked && React.createElement("span", { className: "home-nav-lock" },
                                    React.createElement(InkIcon, { name: "lock", size: 10 }))),
                            lockedTooltipKey === t.key && React.createElement("div", { style: {
                                    position: 'absolute', top: '100%', left: '50%', transform: 'translateX(-50%)', marginTop: 8, width: 200, zIndex: 40,
                                    background: 'linear-gradient(160deg, #201C13, #17140F)', border: '1px solid #4A3D22',
                                    borderRadius: RADIUS_SCALE[10], padding: '11px 13px', fontSize: TYPE_SCALE[12], color: '#D9D2BE', lineHeight: 1.45,
                                    boxShadow: '0 8px 20px rgba(0,0,0,0.4)', textAlign: 'left',
                                } }, LOCK_MESSAGES[t.key]));
                    }
                    return React.createElement("button", {
                        key: t.key, onClick: () => selectTab(t.key), title: t.label, "aria-label": t.label,
                        className: "home-nav-icon-btn" + (activeTab === t.key ? ' active' : ''),
                    },
                        React.createElement(InkIcon, { name: t.key, size: 19 }),
                        t.key === 'inbox' && inboxUnreadCount > 0 && React.createElement("span", { className: "home-nav-badge" }, inboxUnreadCount > 99 ? '99+' : inboxUnreadCount));
                }),
                React.createElement("button", {
                    onClick: () => setExpanded((v) => !v), title: expanded ? "Collapse navigation" : "Expand navigation",
                    "aria-label": expanded ? "Collapse navigation" : "Expand navigation", "aria-expanded": expanded,
                    className: "home-nav-toggle" + (expanded ? ' open' : ''),
                }, "\u25BE")),
            React.createElement("div", { className: "home-nav-panel" + (expanded ? ' open' : '') },
                TABS.map((t) => {
                    if (t.key === 'guild') {
                        return React.createElement("button", {
                            key: t.key, onClick: handleGuildTap,
                            className: "home-nav-row" + (activeTab === 'guild' ? ' active' : ''),
                        },
                            React.createElement("span", { className: "home-nav-row-icon" }, React.createElement(InkIcon, { name: "guild", size: 16 })),
                            React.createElement("span", { className: "home-nav-row-label" }, t.label,
                                !unlocked && React.createElement("span", { className: "home-nav-row-sub" }, `Locked · Lvl ${Math.min(Math.max(writerLevel, 1), GUILD_UNLOCK_LEVEL)} / ${GUILD_UNLOCK_LEVEL}`)),
                            showLock && React.createElement("span", { style: { opacity: 0.8, display: 'flex' } }, React.createElement(InkIcon, { name: "lock", size: 12 })));
                    }
                    if (t.key === 'library' || t.key === 'universe') {
                        const locked = t.key === 'library' ? libraryLocked : universeLocked;
                        return React.createElement("button", {
                            key: t.key, onClick: () => selectTab(t.key, locked),
                            className: "home-nav-row" + (activeTab === t.key ? ' active' : ''),
                        },
                            React.createElement("span", { className: "home-nav-row-icon" }, React.createElement(InkIcon, { name: t.key, size: 16 })),
                            React.createElement("span", { className: "home-nav-row-label" }, t.label,
                                locked && React.createElement("span", { className: "home-nav-row-sub" },
                                    t.key === 'library' ? "Locked · start a project" : `Locked · Lvl ${Math.min(Math.max(writerLevel, 1), GUILD_UNLOCK_LEVEL)} / ${GUILD_UNLOCK_LEVEL}`)),
                            locked && React.createElement("span", { style: { opacity: 0.8, display: 'flex' } }, React.createElement(InkIcon, { name: "lock", size: 12 })));
                    }
                    return React.createElement("button", {
                        key: t.key, onClick: () => selectTab(t.key),
                        className: "home-nav-row" + (activeTab === t.key ? ' active' : ''),
                    },
                        React.createElement("span", { className: "home-nav-row-icon" }, React.createElement(InkIcon, { name: t.key, size: 16 })),
                        React.createElement("span", { className: "home-nav-row-label" }, t.label),
                        t.key === 'inbox' && inboxUnreadCount > 0 && React.createElement("span", { style: {
                                fontSize: TYPE_SCALE[9.5], fontWeight: 700, color: '#1A1610', background: '#E8C468', borderRadius: RADIUS_SCALE[999],
                                minWidth: 18, textAlign: 'center', padding: '2px 6px', lineHeight: '14px',
                            } }, inboxUnreadCount > 99 ? '99+' : inboxUnreadCount));
                })),
            celebrate && React.createElement("div", { className: "ink-guild-unlock-banner", style: {
                    position: 'absolute', top: '100%', left: 24, right: 24, marginTop: 10, textAlign: 'center', zIndex: 40,
                    fontFamily: "'Fraunces', Georgia, serif", fontStyle: 'italic', fontSize: TYPE_SCALE[14], color: '#E8C468',
                    textShadow: '0 0 12px rgba(232,196,104,0.5)', pointerEvents: 'none',
                } }, "The Guild Hall has been unlocked.")));
}


// A small, fixed set of original entrance lines for the Home hero's welcome message — deterministic
// per calendar day (not random per render, so it doesn't flicker between two lines if the writer
// re-renders the page) via day-of-year, and separate from the time-of-day greeting so the two
// combine into something that doesn't repeat the same way every single day.
export const LIBRARY_ENTRANCE_LINES = [
    "The candles are lit, and the shelves are waiting.",
    "Somewhere on these shelves, your next chapter is already taking shape.",
    "The Hall is quiet tonight \u2014 a good night for writing.",
    "Dust drifts in the lamplight. The desk is exactly as you left it.",
    "Every tale in this Hall started the same way yours did: one page at a time.",
    "The ink is fresh and the parchment is patient.",
    "Somewhere above, a chandelier still burns for the writers who never stopped.",
];


export function timeOfDayGreeting() {
    const h = new Date().getHours();
    if (h < 5)
        return 'Burning the midnight oil';
    if (h < 12)
        return 'Good morning';
    if (h < 17)
        return 'Good afternoon';
    if (h < 21)
        return 'Good evening';
    return 'Good evening';
}


export function dayOfYear(d) {
    const start = new Date(d.getFullYear(), 0, 0);
    return Math.floor((d - start) / 86400000);
}


// A small carved brass corner guard, the kind found on an old ledger or a travelling writing
// desk — two straight fillets meeting at a corner plus a single rivet, rendered in line rather
// than as a filled shape so it reads as hardware inlaid into the wood, not a sticker on top of
// it. One shared component, rotated per corner, so all four stay pixel-identical. `id` is
// per-instance because SVG gradient ids are global to the document and LibraryHero mounts four
// of these at once.
function HeroCornerGuard({ corner, id }) {
    const rotation = { tl: 0, tr: 90, br: 180, bl: 270 }[corner];
    const pos = {
        tl: { top: 7, left: 7 }, tr: { top: 7, right: 7 },
        br: { bottom: 7, right: 7 }, bl: { bottom: 7, left: 7 },
    }[corner];
    return React.createElement("div", { style: { position: 'absolute', width: 24, height: 24, zIndex: 2, pointerEvents: 'none', ...pos, transform: `rotate(${rotation}deg)` } },
        React.createElement("svg", { width: 24, height: 24, viewBox: "0 0 24 24", fill: "none" },
            React.createElement("defs", null,
                React.createElement("linearGradient", { id, x1: "0", y1: "0", x2: "24", y2: "24" },
                    React.createElement("stop", { offset: "0%", stopColor: "#F0D48A" }),
                    React.createElement("stop", { offset: "55%", stopColor: "#C89B3C" }),
                    React.createElement("stop", { offset: "100%", stopColor: "#7A5E24" }))),
            React.createElement("path", { d: "M1.5,9 V2.5 A1,1 0 0,1 2.5,1.5 H9", stroke: `url(#${id})`, strokeWidth: 1.6, strokeLinecap: "round" }),
            React.createElement("path", { d: "M1.5,13.5 V2.5 A1,1 0 0,1 2.5,1.5 H13.5", stroke: `url(#${id})`, strokeWidth: 1, strokeLinecap: "round", opacity: 0.45 }),
            React.createElement("circle", { cx: 6.2, cy: 6.2, r: 1.5, fill: `url(#${id})` }),
            React.createElement("circle", { cx: 6.2, cy: 6.2, r: 1.5, fill: "none", stroke: "#3A2A10", strokeWidth: 0.5, opacity: 0.5 })));
}


// Layered gradients standing in for a dark, hand-rubbed walnut frame: a base wood tone, two
// offset repeating-linear-gradients at a slight angle for grain (one dark for the grain lines
// themselves, one warm and near-invisible for the occasional lighter streak real wood has), and
// a soft sheen top-left as if the same window light from GrandLibraryAtmosphere is glancing off
// its varnish. Kept to gradients rather than an image so the frame stays crisp at any size and
// never needs a network asset.
const WOOD_FRAME_BACKGROUND = 'radial-gradient(ellipse at 18% -15%, rgba(255,205,145,0.14), transparent 55%),' +
    'repeating-linear-gradient(91deg, rgba(0,0,0,0.22) 0px, rgba(0,0,0,0.22) 1px, transparent 1px, transparent 5px),' +
    'repeating-linear-gradient(91deg, rgba(255,190,120,0.05) 0px, rgba(255,190,120,0.05) 1px, transparent 1px, transparent 13px),' +
    'linear-gradient(158deg, #4A3016 0%, #33210F 45%, #1E140A 100%)';


// The Grand Library entrance: the writer's actual welcome to the app, before anything else on
// the page. Reuses GrandLibraryAtmosphere (stone wall, arched window light, hanging candle
// chandelier, drifting dust) as its backdrop rather than a separate reimplementation, so the very
// first thing a writer sees already looks like the same Hall the rest of the app lives in — now
// set inside a dark wood frame with a thin brass fillet and carved corner guards, the way that
// Hall's own entrance would be dressed, rather than floating edgeless against the page.
export function LibraryHero({ writerName, writerProfile, onOpenProfile, hasProjects }) {
    const now = useMemo(() => new Date(), []);
    const line = LIBRARY_ENTRANCE_LINES[dayOfYear(now) % LIBRARY_ENTRANCE_LINES.length];
    const greeting = timeOfDayGreeting();
    return React.createElement("div", { style: {
            position: 'relative', borderRadius: RADIUS_SCALE[20], padding: '18px 14px',
            background: WOOD_FRAME_BACKGROUND,
            boxShadow: 'inset 0 1px 0 rgba(255,210,150,0.14), inset 0 -3px 8px rgba(0,0,0,0.6), ' +
                'inset 0 0 0 1px rgba(0,0,0,0.45), 0 22px 44px rgba(0,0,0,0.5), 0 6px 14px rgba(0,0,0,0.35)',
        } },
        ['tl', 'tr', 'br', 'bl'].map((corner) => React.createElement(HeroCornerGuard, { key: corner, corner, id: `heroCornerGuard-${corner}` })),
        React.createElement("div", { style: {
                borderRadius: RADIUS_SCALE[16], padding: 2,
                border: '1px solid rgba(232,196,104,0.28)',
                boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.5)',
            } },
            React.createElement(GrandLibraryAtmosphere, null,
        React.createElement("div", { style: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 26 } },
            React.createElement("div", { className: "ink-hero-wordmark", style: { display: 'flex', alignItems: 'center', gap: SPACE_SCALE[8] } },
                React.createElement("span", { style: { fontSize: TYPE_SCALE[20], color: '#C89B3C', opacity: 0.9 } }, "\u2766"),
                React.createElement("div", { style: { fontFamily: "'Fraunces', Georgia, serif", fontSize: TYPE_SCALE[26], fontStyle: 'italic', fontWeight: 600, color: '#EFE7D2' } }, "Inkroot")),
            React.createElement("button", { onClick: onOpenProfile, title: "Author's Hall", style: {
                    width: 44, height: 44, borderRadius: '50%', flexShrink: 0, cursor: 'pointer', padding: 0,
                    background: writerProfile && writerProfile.avatar ? `center/cover url(${writerProfile.avatar})` : 'radial-gradient(circle at 34% 28%, #2A2620, #17140F 72%)',
                    border: '2px solid #C89B3C', boxShadow: '0 0 0 2px #100E0A, 0 0 14px rgba(200,155,60,0.25)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: TYPE_SCALE[17],
                } }, !(writerProfile && writerProfile.avatar) && "\uD83E\uDDD1\u200D\uD83C\uDF93")),
        React.createElement("div", { style: { textAlign: 'center', padding: '10px 6px 4px' } },
            React.createElement("div", { style: { fontFamily: "'Fraunces', Georgia, serif", fontSize: TYPE_SCALE[22], fontStyle: 'italic', color: '#EFE7D2' } },
                greeting, writerName ? `, ${writerName}.` : '.'),
            React.createElement("div", { style: { fontSize: TYPE_SCALE[13], color: '#A6A6AD', marginTop: 10, maxWidth: 380, marginLeft: 'auto', marginRight: 'auto', lineHeight: 1.6 } },
                hasProjects ? line : "The Hall stands ready for your first tale."),
            React.createElement(ArchiveDivider, { maxWidth: 200, margin: '20px auto 4px', fontSize: TYPE_SCALE[10], color: '#4A3D22', opacity: 1 })))));
}


// A short, original writing-craft line for "Today's Inspiration" — separate pool from the hero's
// entrance lines above (those greet the writer; these are meant to nudge the actual writing),
// picked the same deterministic day-of-year way so it holds steady for the whole day.
export const TODAYS_INSPIRATION_LINES = [
    "Write the sentence you're avoiding. It's usually the one the scene needs most.",
    "A character wants something, even if it's only a glass of water. What does yours want right now?",
    "Cut the sentence you're proudest of. See if the paragraph is stronger without it.",
    "Give a minor character one specific, unexplained detail today. Let the reader wonder.",
    "Change one scene from day to night, or night to day. Notice what else has to change with it.",
    "Write the ending first, badly, in three sentences. Now you know what you're walking toward.",
    "Let a character lie to another character today \u2014 and let the reader know before anyone else does.",
    "Describe a room using only what a character would notice while upset. Skip everything else.",
];


export function TodaysInspirationCard() {
    const line = useMemo(() => {
        const now = new Date();
        return TODAYS_INSPIRATION_LINES[dayOfYear(now) % TODAYS_INSPIRATION_LINES.length];
    }, []);
    return React.createElement("div", { style: {
            borderRadius: RADIUS_SCALE[14], padding: '22px 24px', marginBottom: 28,
            background: 'linear-gradient(160deg, #211C13, #17130E)', border: '1px solid #3A3020',
            position: 'relative', overflow: 'hidden',
        } },
        React.createElement("div", { style: {
                position: 'absolute', top: -40, left: -40, width: 140, height: 140, borderRadius: '50%',
                background: 'radial-gradient(circle, rgba(200,155,60,0.09) 0%, rgba(200,155,60,0) 70%)',
            } }),
        React.createElement("div", { style: { display: 'flex', alignItems: 'center', gap: SPACE_SCALE[8], marginBottom: 12, position: 'relative' } },
            React.createElement("span", { style: { fontSize: TYPE_SCALE[15] } }, "\uD83D\uDD6F\uFE0F"),
            React.createElement("div", { style: { fontSize: TYPE_SCALE[11], fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#C89B3C' } }, "Today's Inspiration")),
        React.createElement("div", { style: { fontFamily: "'Fraunces', Georgia, serif", fontSize: TYPE_SCALE[15.5], fontStyle: 'italic', color: '#EFE7D2', lineHeight: 1.55, position: 'relative' } }, line));
}


// One tile in the Quick Actions grid below Recent Activity — icon + label, no description, so a
// row of them reads as a toolbar rather than another wall of text.
export function HomeQuickActionTile({ icon, label, onClick, disabled }) {
    return React.createElement("button", { onClick, disabled, className: "ghost-btn", style: {
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: SPACE_SCALE[8],
            background: '#1D1D22', border: '1px solid #2A2A30', borderRadius: RADIUS_SCALE[12], padding: '18px 10px',
            cursor: disabled ? 'default' : 'pointer', opacity: disabled ? 0.5 : 1, textAlign: 'center',
        } },
        React.createElement("span", { style: { display: 'flex' } }, icon),
        React.createElement("span", { style: { fontSize: TYPE_SCALE[11.5], color: '#C9BE8D', fontWeight: 600 } }, label));
}


// One upcoming feature teaser in the "Inkroot News" section — every item here needs a shared
// backend Inkroot doesn't have yet (see ComingSoonNotice's use elsewhere for the same honesty
// about what is and isn't real today), so all of them carry the same gold "Coming Soon" pill
// rather than pretending any are closer than the others.
export function InkrootNewsCard({ icon, title, description }) {
    return React.createElement("div", { style: {
            display: 'flex', gap: SPACE_SCALE[14], alignItems: 'flex-start', padding: '16px 18px', borderRadius: RADIUS_SCALE[12],
            background: '#1D1D22', border: '1px solid #2A2A30', marginBottom: 10,
        } },
        React.createElement("span", { style: { fontSize: TYPE_SCALE[18], flexShrink: 0, opacity: 0.85, marginTop: 1 } }, icon),
        React.createElement("div", { style: { flex: 1, minWidth: 0 } },
            React.createElement("div", { style: { display: 'flex', alignItems: 'center', gap: SPACE_SCALE[8], flexWrap: 'wrap', marginBottom: 4 } },
                React.createElement("div", { style: { fontFamily: "'Fraunces', Georgia, serif", fontSize: TYPE_SCALE[14.5], fontWeight: 600, color: '#EFE7D2' } }, title),
                React.createElement("span", { style: {
                        fontSize: TYPE_SCALE[9.5], fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#C89B3C',
                        border: '1px dashed #4A3D22', borderRadius: RADIUS_SCALE[20], padding: '2px 8px',
                    } }, "Coming Soon")),
            React.createElement("div", { style: { fontSize: TYPE_SCALE[12], color: '#8A8A92', lineHeight: 1.5 } }, description)));
}
