import React, { useEffect, useMemo } from 'react';
import { RADIUS_SCALE, TYPE_SCALE } from '../shell/nav-context.jsx';
import { AUTHOR_LEVEL_SEEN_KEY, AUTHOR_LEVEL_UP_DURATION_MS } from '../writing/achievements.jsx';
import { RankCrest } from '../writing/health-checks.jsx';


export function readSeenAuthorLevel() {
    try {
        const parsed = JSON.parse(localStorage.getItem(AUTHOR_LEVEL_SEEN_KEY) || 'null');
        if (parsed && typeof parsed.level === 'number' && typeof parsed.totalXP === 'number')
            return parsed;
    }
    catch (e) { }
    return null;
}


export function writeSeenAuthorLevel(level, totalXP) {
    try {
        localStorage.setItem(AUTHOR_LEVEL_SEEN_KEY, JSON.stringify({ level, totalXP }));
    }
    catch (e) { }
}


export function AuthorLevelUpOverlay({ level, rank, xpEarned, onDone }) {
    useEffect(() => {
        const t = setTimeout(onDone, AUTHOR_LEVEL_UP_DURATION_MS);
        return () => clearTimeout(t);
    }, [onDone]);
    // A handful of embers with slightly randomized position/drift/timing so they read as organic
    // rather than a mechanically identical set — memoized so they don't reshuffle on re-render
    // during the overlay's brief lifetime.
    const embers = useMemo(() => Array.from({ length: 11 }, (_, i) => ({
        id: i,
        leftPct: Math.round(40 + Math.random() * 20),
        dx: Math.round((Math.random() * 2 - 1) * 26),
        duration: 1900 + Math.round(Math.random() * 900),
        delay: 500 + i * 240 + Math.round(Math.random() * 220),
    })), []);
    return React.createElement("div", { className: "authorlevelup-overlay", style: {
            position: 'fixed', inset: 0, zIndex: 4900, display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'radial-gradient(circle at 50% 40%, rgba(40,32,16,0.65), rgba(8,7,6,0.92) 74%)',
            pointerEvents: 'none',
        } },
        React.createElement("button", {
            onClick: onDone, style: {
                position: 'absolute', top: 22, right: 22, pointerEvents: 'auto', cursor: 'pointer',
                background: 'none', border: '1px solid #3A3A42', color: '#A6A6AD', borderRadius: RADIUS_SCALE[6],
                padding: '5px 12px', fontSize: TYPE_SCALE[12], fontWeight: 600, letterSpacing: '0.03em',
            },
        }, "Skip \u203A"),
        React.createElement("div", { style: { position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', width: 'min(90vw, 420px)', textAlign: 'center' } },
            React.createElement("div", { className: "authorlevelup-burst", style: {
                    position: 'absolute', top: -20, width: 260, height: 260, borderRadius: '50%',
                    background: 'radial-gradient(circle, #E8C46855, transparent 70%)',
                } }),
            React.createElement("div", { className: "authorlevelup-burst", style: {
                    position: 'absolute', top: 30, width: 190, height: 190, borderRadius: '50%',
                    border: '1.5px solid #E8C46899', boxShadow: '0 0 0 10px #C89B3C22, 0 0 50px 10px #C89B3C40',
                } }),
            embers.map((e) => React.createElement("span", { key: e.id, className: "authorlevelup-ember", style: {
                    top: 170, left: `${e.leftPct}%`, '--dx': `${e.dx}px`, animationDuration: `${e.duration}ms`, animationDelay: `${e.delay}ms`,
                } })),
            React.createElement("div", { className: "authorlevelup-crest", style: { marginTop: 26 } },
                React.createElement(RankCrest, { rank: rank, size: 96, forceGlow: true })),
            React.createElement("div", { className: "authorlevelup-title", style: {
                    marginTop: 20, fontFamily: "'Fraunces', Georgia, serif", fontSize: TYPE_SCALE[32], fontWeight: 600, letterSpacing: '0.08em',
                    color: '#E8C468', textShadow: '0 0 22px #C89B3C99', textTransform: 'uppercase',
                } }, "Author Level Up"),
            React.createElement("div", { className: "authorlevelup-levelline", style: {
                    marginTop: 10, fontFamily: "'Fraunces', Georgia, serif", fontSize: TYPE_SCALE[18], fontWeight: 600, color: '#EFE7D2',
                } }, `Level ${level}`),
            React.createElement("div", { className: "authorlevelup-rankline", style: {
                    marginTop: 6, fontFamily: "'Fraunces', Georgia, serif", fontStyle: 'italic', fontSize: TYPE_SCALE[14.5], letterSpacing: '0.04em', color: rank.color,
                } }, rank.name),
            React.createElement("div", { className: "authorlevelup-xp", style: { marginTop: 14, fontSize: TYPE_SCALE[15], fontWeight: 700, color: '#E8C468' } }, `+${xpEarned.toLocaleString()} Lifetime XP`),
            React.createElement("div", { className: "authorlevelup-finalglow", style: { top: 30, width: 190, height: 190 } })));
}
