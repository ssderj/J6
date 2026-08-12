import React, { useState, useEffect, useRef } from 'react';
import { fetchPlayerGuildMembers } from '../lib/player-guild.js';
import { GUILD_HALL_STRUCTURES, GUILD_LEVEL_REWARDS, GUILD_XP_SOURCES, computeMembersOnline } from './guild-progression.jsx';
import { GuildLockShatter } from './guild-reputation-panel.jsx';
import { playGuildLevelUpSound, playGuildUnlockSound } from './guild-sound-fx.jsx';
import { ArchiveDivider, ArchiveSectionHeading, ProgressBar } from '../shared-ui/ui-cards.jsx';
import { InkIcon } from '../shell/ink-icon.jsx';
import { RADIUS_SCALE, SPACE_SCALE, TYPE_SCALE } from '../shell/nav-context.jsx';


// The Guild Level counterpart to GuildReputationPanel — same honest live/not-yet-tracked source
// list, but built around a levelling curve and an animated XP bar instead of a flat prestige
// number. The bar reuses ProgressBar, whose own CSS transition is what makes it glide smoothly
// to its new width any time Guild XP changes, rather than snapping.
export function GuildLevelPanel({ progress }) {
    const { level, xpIntoLevel, xpPerLevel, isMaxLevel, totalXP } = progress;
    return React.createElement("div", { style: { marginBottom: 34 } },
        React.createElement(ArchiveSectionHeading, { icon: "\uD83C\uDF96\uFE0F", label: "Guild Level" }),
        React.createElement("div", { style: {
                textAlign: 'center', marginTop: 16, padding: '26px 20px', borderRadius: RADIUS_SCALE[14],
                background: 'radial-gradient(ellipse at 50% 0%, rgba(200,155,60,0.14), transparent 65%), linear-gradient(160deg, #211C13, #17130E)',
                border: '1px solid #4A3D22',
            } },
            React.createElement("div", { style: { fontFamily: "'Fraunces', Georgia, serif", fontSize: TYPE_SCALE[38], fontWeight: 700, color: '#E8C468' } }, level),
            React.createElement("div", { style: { fontSize: TYPE_SCALE[11], color: '#7A7A82', letterSpacing: '0.08em', textTransform: 'uppercase', marginTop: 2 } }, "Guild Level"),
            React.createElement("div", { style: { maxWidth: 280, margin: '18px auto 0' } },
                React.createElement(ProgressBar, { value: xpIntoLevel, max: xpPerLevel, color: '#E8C468' }),
                React.createElement("div", { style: { fontSize: TYPE_SCALE[11], color: '#7A7A82', marginTop: 8 } }, isMaxLevel
                    ? `Maximum Guild Level reached \u2014 ${totalXP.toLocaleString()} Guild XP`
                    : `${xpIntoLevel.toLocaleString()} / ${xpPerLevel.toLocaleString()} Guild XP to Level ${level + 1}`))),
        React.createElement("div", { style: { marginTop: 20 } },
            React.createElement("div", { style: { fontSize: TYPE_SCALE[10.5], color: '#7A7A82', letterSpacing: '0.06em', textTransform: 'uppercase', textAlign: 'center', marginBottom: 10 } }, "Guild XP grows from"),
            React.createElement("div", { style: { display: 'flex', flexDirection: 'column', gap: SPACE_SCALE[8], maxWidth: 340, margin: '0 auto' } },
                GUILD_XP_SOURCES.map((s) => React.createElement("div", { key: s.label, style: {
                        display: 'flex', alignItems: 'center', gap: SPACE_SCALE[10], fontSize: TYPE_SCALE[12.5], color: s.live ? '#D9D2BE' : '#5C5C64',
                    } },
                    React.createElement("span", { style: { fontSize: TYPE_SCALE[12] } }, s.live ? "\u2713" : "\u2022"),
                    React.createElement("span", null, s.label),
                    !s.live && React.createElement("span", { style: { fontSize: TYPE_SCALE[10], fontStyle: 'italic', marginLeft: 'auto' } }, "not yet tracked")))),
        React.createElement("div", { style: { marginTop: 28 } },
            React.createElement("div", { style: { fontSize: TYPE_SCALE[10.5], color: '#7A7A82', letterSpacing: '0.06em', textTransform: 'uppercase', textAlign: 'center', marginBottom: 12 } }, "Cosmetic rewards \u2014 never a gameplay advantage"),
            React.createElement("div", { style: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: SPACE_SCALE[10], maxWidth: 620, margin: '0 auto' } },
                GUILD_LEVEL_REWARDS.map((r) => {
                    const unlocked = level >= r.level;
                    return React.createElement("div", { key: r.level, style: {
                            display: 'flex', flexDirection: 'column', gap: SPACE_SCALE[4], textAlign: 'left', borderRadius: RADIUS_SCALE[10], padding: '12px 14px',
                            background: unlocked ? 'linear-gradient(160deg, #241F14, #17140F)' : 'rgba(255,255,255,0.02)',
                            border: unlocked ? '1px solid #4A3D22' : '1px solid #2A2A30', opacity: unlocked ? 1 : 0.55,
                        } },
                        React.createElement("div", { style: { display: 'flex', alignItems: 'center', gap: SPACE_SCALE[8] } },
                            React.createElement("span", { style: { fontSize: TYPE_SCALE[16] } }, r.icon),
                            React.createElement("span", { style: { fontSize: TYPE_SCALE[12], fontWeight: 600, color: unlocked ? '#E8C468' : '#8A8A92' } }, r.title)),
                        React.createElement("div", { style: { fontSize: TYPE_SCALE[10.5], color: '#7A7A82', lineHeight: 1.4 } }, r.desc),
                        React.createElement("div", { style: { fontSize: TYPE_SCALE[9.5], color: unlocked ? '#5C8A6B' : '#5C5C64', marginTop: 2, display: 'flex', alignItems: 'center', gap: SPACE_SCALE[4] } },
                            unlocked ? "\u2713" : React.createElement(InkIcon, { name: "lock", size: 9 }),
                            unlocked ? `Unlocked at Level ${r.level}` : `Unlocks at Level ${r.level}`));
                })))));
}


// ---------- Guild Level Up ----------
// The ceremony for the moment the whole Guild's collective activity crosses a level threshold —
// the Guild Banner's crest glows, the Guild XP bar fills smoothly to its new position, "Guild
// Level Up!" announces itself, the previous level sits beside the new one, and any Guild Level
// rewards (see GUILD_LEVEL_REWARDS) crossed along the way are listed. Mirrors AuthorLevelUpOverlay
// in shape (fixed overlay, ceremonial fanfare, a Skip control that stays clickable) but themed
// around the Guild crest rather than a Writer Rank crest, since this is a collective, guild-wide
// track rather than a personal one. Skippable at any time — a 3-second ceremony shouldn't be able
// to hold anyone hostage even briefly.
// Its "have we already celebrated this level" bookkeeping has to survive a reload — the Guild Hall
// recomputes Guild XP from scratch on every Home Screen mount rather than tracking a live session
// total — so it's backed by a tiny localStorage record (readSeenGuildLevel/writeSeenGuildLevel)
// instead of an in-memory ref, the same approach as readSeenAuthorLevel/writeSeenAuthorLevel.
export const GUILD_LEVEL_UP_DURATION_MS = 5400;


export const GUILD_LEVEL_UP_SEEN_KEY = 'inkroot:guildLevel:seen';


export function readSeenGuildLevel() {
    try {
        const parsed = JSON.parse(localStorage.getItem(GUILD_LEVEL_UP_SEEN_KEY) || 'null');
        if (parsed && typeof parsed.level === 'number' && typeof parsed.totalXP === 'number')
            return parsed;
    }
    catch (e) { }
    return null;
}


export function writeSeenGuildLevel(level, totalXP) {
    try {
        localStorage.setItem(GUILD_LEVEL_UP_SEEN_KEY, JSON.stringify({ level, totalXP }));
    }
    catch (e) { }
}


// The construction sequence that opens the ceremony: scaffolding rises around the site, a few
// workers hammer away, stone blocks drop into place, dust kicks up, and a ring of golden light
// spreads outward — all on fixed CSS timing (no React state) so it plays once, automatically, in
// the first ~1.6s before the crest reveal below takes over. Purely decorative, same as everything
// else about the Hall's appearance.
export function GuildConstructionSequence() {
    return React.createElement("div", { className: "guildlevelup-construction", style: { position: 'absolute', top: -34, width: 220, height: 170, pointerEvents: 'none' } },
        // scaffolding: a simple crossed timber frame around the build site
        React.createElement("div", { className: "guildlevelup-scaffold", style: { position: 'absolute', inset: 0 } },
            [16, 204].map((x) => React.createElement("div", { key: 'post' + x, style: { position: 'absolute', left: x, top: 10, bottom: 10, width: 4, background: '#8A6B3C' } })),
            [40, 100, 160].map((y) => React.createElement("div", { key: 'beam' + y, style: { position: 'absolute', left: 16, right: 16, top: y, height: 4, background: '#8A6B3C' } })),
            React.createElement("div", { style: { position: 'absolute', left: 16, right: 16, top: 10, height: 60, borderLeft: '3px solid #C89B3C88', borderRight: '3px solid #C89B3C88', transform: 'skewY(-6deg)' } })),
        // workers hammering at the base of the scaffolding
        [30, 108, 186].map((x, i) => React.createElement("div", { key: 'worker' + x, className: "guildlevelup-worker", style: { position: 'absolute', left: x, bottom: 14, width: 10, height: 16, animationDelay: `${i * 0.18}s` } },
            React.createElement("div", { style: { width: 8, height: 10, borderRadius: '4px 4px 0 0', background: '#D9D2BE', margin: '0 auto' } }),
            React.createElement("div", { style: { width: 2, height: 8, background: '#8A6B3C', margin: '0 auto' } }))),
        // stone blocks dropping and sliding into place along the base
        [4, 40, 76, 148, 184].map((x, i) => React.createElement("div", { key: 'block' + x, className: "guildlevelup-block", style: {
                position: 'absolute', left: x, bottom: 6, width: 32, height: 14, borderRadius: RADIUS_SCALE[2],
                background: 'linear-gradient(180deg, #9AA0AA, #5C6068)', border: '1px solid #3E4148', animationDelay: `${i * 0.12}s`,
            } })),
        // dust kicked up by the blocks landing
        React.createElement("div", { className: "gh-dust", style: { position: 'absolute', inset: 0 } },
            Array.from({ length: 8 }).map((_, i) => React.createElement("span", { key: i, style: {
                    position: 'absolute', left: `${8 + i * 12}%`, bottom: 10, width: 3, height: 3, borderRadius: '50%',
                    background: '#C89B3C', animationDelay: `${i * 70}ms`,
                } }))),
        // a ring of golden light spreading outward once the blocks have landed
        React.createElement("div", { className: "guildlevelup-goldspread", style: {
                position: 'absolute', left: '50%', bottom: 20, transform: 'translateX(-50%)', width: 40, height: 40,
                borderRadius: '50%', border: '2px solid #E8C468', boxShadow: '0 0 24px 6px rgba(232,196,104,0.5)',
            } }));
}


export function GuildLevelUpOverlay({ previousLevel, level, xpIntoLevel, xpPerLevel, isMaxLevel, newRewards, onDone }) {
    useEffect(() => {
        playGuildLevelUpSound();
        const t = setTimeout(onDone, GUILD_LEVEL_UP_DURATION_MS);
        return () => clearTimeout(t);
    }, [onDone]);
    // The bar mounts at 0 and is nudged to its real value a beat later, so ProgressBar's own CSS
    // width transition is what makes it "fill smoothly" to the new position, rather than a
    // keyframe faking the motion — same trick GuildLevelPanel's comment describes for the normal
    // (non-celebratory) bar.
    const [barValue, setBarValue] = useState(0);
    useEffect(() => {
        const t = setTimeout(() => setBarValue(xpIntoLevel), 2950);
        return () => clearTimeout(t);
    }, [xpIntoLevel]);
    // Every actual piece the Hall raised at each threshold crossed this level-up, in build order —
    // "show every newly unlocked building", not just the cosmetic-reward summary.
    const newStructures = newRewards.flatMap((r) => GUILD_HALL_STRUCTURES[r.level] || []);
    return React.createElement("div", { className: "guildlevelup-overlay", style: {
            position: 'fixed', inset: 0, zIndex: 4900, display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'radial-gradient(circle at 50% 40%, rgba(40,32,16,0.65), rgba(8,7,6,0.92) 74%)',
            pointerEvents: 'none', overflowY: 'auto', padding: '24px 0',
        } },
        React.createElement("button", {
            onClick: onDone, style: {
                position: 'absolute', top: 22, right: 22, pointerEvents: 'auto', cursor: 'pointer',
                background: 'none', border: '1px solid #3A3A42', color: '#A6A6AD', borderRadius: RADIUS_SCALE[6],
                padding: '5px 12px', fontSize: TYPE_SCALE[12], fontWeight: 600, letterSpacing: '0.03em',
            },
        }, "Enter the Guild Hall \u203A"),
        React.createElement("div", { style: { position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', width: 'min(90vw, 420px)', textAlign: 'center', margin: 'auto' } },
            React.createElement(GuildConstructionSequence, null),
            React.createElement("div", { className: "guildlevelup-burst", style: {
                    position: 'absolute', top: -10, width: 240, height: 240, borderRadius: '50%',
                    background: 'radial-gradient(circle, #E8C46855, transparent 70%)',
                } }),
            React.createElement("div", { className: "guildlevelup-crest", style: {
                    marginTop: 10, width: 108, height: 108, position: 'relative',
                    clipPath: 'polygon(50% 0%, 95% 24%, 95% 74%, 50% 100%, 5% 74%, 5% 24%)',
                    background: 'radial-gradient(circle at 34% 24%, #2A2620, #17140F 72%)',
                    border: '3px solid #C89B3C', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: TYPE_SCALE[46],
                } }, "\uD83C\uDFF0"),
            React.createElement("div", { className: "guildlevelup-title", style: {
                    marginTop: 22, fontFamily: "'Fraunces', Georgia, serif", fontSize: TYPE_SCALE[30], fontWeight: 600, letterSpacing: '0.08em',
                    color: '#E8C468', textShadow: '0 0 22px #C89B3C99', textTransform: 'uppercase',
                } }, "Guild Level Up!"),
            React.createElement("div", { className: "guildlevelup-grown", style: {
                    marginTop: 6, fontFamily: "'Fraunces', Georgia, serif", fontSize: TYPE_SCALE[15], fontStyle: 'italic', color: '#D9D2BE',
                } }, "The Guild has grown."),
            React.createElement("div", { className: "guildlevelup-levelline", style: {
                    marginTop: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: SPACE_SCALE[10],
                    fontFamily: "'Fraunces', Georgia, serif", fontSize: TYPE_SCALE[17], fontWeight: 600, color: '#EFE7D2',
                } },
                React.createElement("span", { style: { color: '#8A8A92' } }, `Level ${previousLevel}`),
                React.createElement("span", { style: { color: '#C89B3C' } }, "\u2192"),
                React.createElement("span", { style: { color: '#E8C468', fontSize: TYPE_SCALE[20] } }, `Level ${level}`)),
            React.createElement("div", { className: "guildlevelup-bar-wrap", style: { width: '100%', maxWidth: 280, margin: '18px auto 0' } },
                React.createElement(ProgressBar, { value: barValue, max: xpPerLevel, color: '#E8C468' }),
                React.createElement("div", { style: { fontSize: TYPE_SCALE[11], color: '#7A7A82', marginTop: 8 } }, isMaxLevel
                    ? "Maximum Guild Level reached"
                    : `${xpIntoLevel.toLocaleString()} / ${xpPerLevel.toLocaleString()} Guild XP`)),
            newStructures.length > 0 && React.createElement("div", { className: "guildlevelup-structures", style: { marginTop: 20, width: '100%' } },
                React.createElement("div", { style: { fontSize: TYPE_SCALE[10.5], color: '#7A7A82', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 10 } }, "Newly Built in the Guild Hall"),
                React.createElement("div", { style: { display: 'flex', flexWrap: 'wrap', gap: SPACE_SCALE[6], justifyContent: 'center' } },
                    newStructures.map((name) => React.createElement("span", { key: name, style: {
                            fontSize: TYPE_SCALE[11.5], color: '#E8C468', background: 'rgba(200,155,60,0.1)', border: '1px solid #4A3D22',
                            borderRadius: RADIUS_SCALE[20], padding: '5px 12px',
                        } }, `\uD83E\uDDF1 ${name}`)))),
            newRewards.length > 0 && React.createElement("div", { className: "guildlevelup-rewards", style: { marginTop: 20, width: '100%' } },
                React.createElement("div", { style: { fontSize: TYPE_SCALE[10.5], color: '#7A7A82', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 10 } }, "Guild Rewards Unlocked"),
                React.createElement("div", { style: { display: 'flex', flexDirection: 'column', gap: SPACE_SCALE[8] } },
                    newRewards.map((r) => React.createElement("div", { key: r.level, style: {
                            display: 'flex', alignItems: 'center', gap: SPACE_SCALE[10], background: 'linear-gradient(160deg, #241F14, #17140F)',
                            border: '1px solid #4A3D22', borderRadius: RADIUS_SCALE[10], padding: '10px 14px', textAlign: 'left',
                        } },
                        React.createElement("span", { style: { fontSize: TYPE_SCALE[18] } }, r.icon),
                        React.createElement("div", null,
                            React.createElement("div", { style: { fontSize: TYPE_SCALE[12.5], fontWeight: 600, color: '#E8C468' } }, r.title),
                            React.createElement("div", { style: { fontSize: TYPE_SCALE[10.5], color: '#7A7A82', marginTop: 1 } }, r.desc))))))));
}


// A single engraved plaque used by both the Writer Identity Card and the Guild Banner — one stat,
// given the same quiet carved-medallion treatment as everything else in the writer's chamber
// (RankCrest, AchievementMedal).
export function IdentityPlaque({ icon, label, value, valueColor, caption }) {
    return React.createElement("div", { style: { flex: '1 1 0', minWidth: 0, textAlign: 'center', padding: '0 6px' } },
        React.createElement("div", { style: { fontSize: TYPE_SCALE[17], marginBottom: 5, opacity: 0.92 } }, icon),
        React.createElement("div", {
            style: {
                fontFamily: "'Fraunces', Georgia, serif", fontSize: TYPE_SCALE[15], fontWeight: 600,
                color: valueColor || '#E8C468', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
            },
        }, value),
        React.createElement("div", { style: { fontSize: TYPE_SCALE[9.5], color: '#7A7A82', letterSpacing: '0.06em', textTransform: 'uppercase', marginTop: 3 } }, label),
        caption && React.createElement("div", { style: { fontSize: TYPE_SCALE[9], color: '#5C5C64', fontStyle: 'italic', marginTop: 2 } }, caption));
}


// ---------- Founder Guilds ----------
// The ten permanent, official guilds Inkroot itself stands up so no writer ever faces an empty
// Guild Hall. They can never be deleted and always exist — every new writer must take a seat in
// one before they're able to found a Guild of their own. Each is led by the Founder of Inkroot;
// there is no per-guild leader roster yet since Inkroot has no accounts or networking layer.
export const FOUNDER_GUILDS = [
    { id: 'fantasy', icon: "\uD83C\uDFF0", name: 'The Fantasy Guild', motto: 'Where dragons rise and kingdoms are born.' },
    { id: 'romance', icon: "\u2764\uFE0F", name: 'The Romance Guild', motto: 'Every heart has a story worth telling.' },
    { id: 'scifi', icon: "\uD83D\uDE80", name: 'The Science Fiction Guild', motto: 'Chart the unknown, one page at a time.' },
    { id: 'historical', icon: "\uD83D\uDDE1\uFE0F", name: 'The Historical Guild', motto: 'The past deserves an eloquent witness.' },
    { id: 'horror', icon: "\uD83D\uDC7B", name: 'The Horror Guild', motto: 'Fear is just another kind of honesty.' },
    { id: 'mystery', icon: "\uD83D\uDD75\uFE0F", name: 'The Mystery Guild', motto: 'Every clue leads somewhere.' },
    { id: 'comedy', icon: "\uD83D\uDE02", name: 'The Comedy Guild', motto: 'Laughter is the plot twist we all need.' },
    { id: 'worldbuilders', icon: "\uD83C\uDF0D", name: 'The Worldbuilders Guild', motto: 'Maps, myths, and the bones of new worlds.' },
    { id: 'poetry', icon: "\uD83D\uDCDC", name: 'The Poetry Guild', motto: 'Say more with less.' },
    { id: 'general', icon: "\uD83D\uDD8B\uFE0F", name: 'The General Writers Guild', motto: 'For stories that defy a single shelf.' },
];


export const FOUNDER_GUILD_LEADER = 'Founder of Inkroot';


export function founderGuildById(id) {
    return FOUNDER_GUILDS.find((g) => g.id === id) || null;
}


// A writer belongs to only one Guild at a time. Leaving one — Founder or Player — starts this
// cooldown before another can be joined (including re-entering a Player Guild they'd already
// founded). Joining a Founder Guild itself is always free.
export const GUILD_LEAVE_COOLDOWN_HOURS = 24;


export const GUILD_LEAVE_COOLDOWN_MS = GUILD_LEAVE_COOLDOWN_HOURS * 60 * 60 * 1000;


export function freshGuildMembership() {
    return { guildType: null, founderGuildId: null, founderJoinedDate: null, playerGuild: null, joinedGuild: null, leftAt: null };
}


export function guildCooldownRemainingMs(membership) {
    if (!membership || !membership.leftAt)
        return 0;
    const elapsed = Date.now() - new Date(membership.leftAt).getTime();
    return Math.max(0, GUILD_LEAVE_COOLDOWN_MS - elapsed);
}


export function formatCooldownRemaining(ms) {
    const totalMinutes = Math.ceil(ms / 60000);
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    if (hours > 0)
        return `About ${hours}h ${minutes}m remain.`;
    return `About ${minutes}m remain.`;
}


// Migrates whatever's stored under GUILD_KEY into the current { guildType, founderGuildId,
// founderJoinedDate, playerGuild, leftAt } shape. Two older shapes are handled: the very first
// Founder-Guild save (which let a writer sit in a Founder Guild and a Player Guild at once, with
// no leftAt/cooldown), and the original pre-Founder-Guild save (a single self-founded guild profile
// directly at the top level). Either way, migration never assumes a writer is currently "in" a
// guild — guildType only ever comes from an explicit, current-shape membership.
export function normalizeGuildMembership(parsed) {
    if (parsed && typeof parsed === 'object' && 'guildType' in parsed) {
        return {
            guildType: parsed.guildType || null,
            founderGuildId: parsed.founderGuildId || null,
            founderJoinedDate: parsed.founderJoinedDate || null,
            playerGuild: parsed.playerGuild || null,
            joinedGuild: parsed.joinedGuild || null,
            leftAt: parsed.leftAt || null,
        };
    }
    if (parsed && typeof parsed === 'object' && ('founderGuildId' in parsed || 'playerGuild' in parsed)) {
        return {
            guildType: parsed.founderGuildId ? 'founder' : null,
            founderGuildId: parsed.founderGuildId || null,
            founderJoinedDate: parsed.founderJoinedDate || null,
            playerGuild: parsed.playerGuild || null,
            joinedGuild: null,
            leftAt: null,
        };
    }
    const wasCustomized = !!(parsed && (parsed.name || parsed.crest || parsed.motto));
    return {
        guildType: null,
        founderGuildId: null,
        founderJoinedDate: null,
        playerGuild: wasCustomized ? {
            name: parsed.name || '', crest: parsed.crest || null, motto: parsed.motto || '',
            createdDate: parsed.createdDate || new Date().toISOString(),
        } : null,
        joinedGuild: null,
        leftAt: null,
    };
}


// The very first thing a writer sees on opening the Guild Hall, before they've taken a seat
// anywhere — a welcome, and a choice of the ten permanent Founder Guilds. There is no "skip":
// every writer settles into an established Guild before they're able to found one of their own.
export function JoinGuildByCode({ onJoinByCode, joinCodeError }) {
    const [code, setCode] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const handleSubmit = async () => {
        if (!code.trim() || submitting)
            return;
        setSubmitting(true);
        await onJoinByCode(code.trim());
        setSubmitting(false);
    };
    return React.createElement("div", { style: { margin: '18px auto 0', maxWidth: 320 } },
        React.createElement("div", { style: { fontSize: TYPE_SCALE[10.5], color: '#5C5C64', marginBottom: 8, fontStyle: 'italic' } }, "Have an invite code for a friend's guild?"),
        React.createElement("div", { style: { display: 'flex', gap: SPACE_SCALE[8] } },
            React.createElement("input", {
                value: code, onChange: (e) => setCode(e.target.value), placeholder: "Invite code",
                onKeyDown: (e) => { if (e.key === 'Enter')
                    handleSubmit(); },
                style: {
                    flex: 1, borderRadius: RADIUS_SCALE[9], border: '1px solid #3A3020', background: '#1D1A14', color: '#EFE7D2',
                    padding: '9px 12px', fontSize: TYPE_SCALE[12.5], textAlign: 'center', letterSpacing: '0.04em', fontFamily: 'inherit',
                },
            }),
            React.createElement("button", {
                onClick: handleSubmit, disabled: submitting || !code.trim(), style: {
                    background: 'none', border: '1px solid #4A3D22', color: '#C89B3C', borderRadius: RADIUS_SCALE[9],
                    padding: '0 16px', fontSize: TYPE_SCALE[12.5], fontWeight: 600, cursor: submitting ? 'default' : 'pointer',
                    opacity: submitting || !code.trim() ? 0.6 : 1,
                },
            }, submitting ? "Joining\u2026" : "Join")),
        joinCodeError && React.createElement("div", { style: { fontSize: TYPE_SCALE[11], color: '#D98A8A', marginTop: 6 } }, joinCodeError),
        React.createElement("div", { style: { fontSize: TYPE_SCALE[10], color: '#5C5C64', marginTop: 6, fontStyle: 'italic' } }, "Sign in first \u2014 joining a guild is an account feature."));
}
export function GuildWelcomeScreen({ mode, cooldownLabel, hasPlayerGuild, playerGuildName, onJoin, onEnterOwnGuild, onJoinByCode, joinCodeError }) {
    const headline = mode === 'cooldown'
        ? "Between Guilds"
        : "The Guild Hall";
    const body = mode === 'cooldown'
        ? `You've stepped back from a guild \u2014 a cooldown stands before you can settle into another. ${cooldownLabel || ''}`.trim()
        : mode === 'return'
            ? "You're between guilds. Take a seat in a Founder Guild again, or return to the guild you founded yourself."
            : "Every great storyteller begins their journey within an established Guild. Learn, write, build your reputation, and one day establish a Guild worthy of your own legend.";
    return React.createElement("div", { style: { textAlign: 'center' } },
        React.createElement("div", { style: { textAlign: 'center', marginBottom: 8 } },
            React.createElement("div", { style: { fontSize: TYPE_SCALE[22], color: '#C89B3C', opacity: 0.85, marginBottom: 6 } }, "\u2766"),
            React.createElement("div", { style: { fontFamily: "'Fraunces', Georgia, serif", fontSize: TYPE_SCALE[28], fontStyle: 'italic', fontWeight: 600, color: '#EFE7D2' } }, headline),
            React.createElement("div", {
                style: {
                    fontSize: TYPE_SCALE[13.5], color: '#B8AF95', marginTop: 18, marginBottom: 8, lineHeight: 1.6,
                    maxWidth: 460, marginLeft: 'auto', marginRight: 'auto', fontStyle: 'italic',
                    fontFamily: "'Fraunces', Georgia, serif",
                },
            }, body)),
        (mode === 'return' || mode === 'cooldown') && React.createElement("button", {
            onClick: mode === 'cooldown' ? undefined : onEnterOwnGuild,
            disabled: mode === 'cooldown',
            style: {
                margin: '10px auto 0', display: 'block', background: 'linear-gradient(160deg, #241F14, #17140F)', border: '1px solid #4A3D22',
                color: mode === 'cooldown' ? '#5C5C64' : '#E8C468', borderRadius: RADIUS_SCALE[9], padding: '10px 20px', fontSize: TYPE_SCALE[12.5], fontWeight: 600,
                cursor: mode === 'cooldown' ? 'default' : 'pointer', opacity: mode === 'cooldown' ? 0.55 : 1,
            },
        }, "\u2694\uFE0F ", hasPlayerGuild ? `Return to ${playerGuildName || 'My Guild'}` : "Establish Your Own Guild"),
        mode === 'cooldown' && React.createElement("div", { style: { fontSize: TYPE_SCALE[10.5], color: '#5C5C64', marginTop: 8, fontStyle: 'italic' } },
            hasPlayerGuild ? "Unlocks once the cooldown above ends." : "Unlocks once the cooldown above ends \u2014 that includes founding a Guild of your own for the first time, not just rejoining a Founder Guild."),
        mode !== 'cooldown' && React.createElement(JoinGuildByCode, { onJoinByCode, joinCodeError }),
        mode !== 'cooldown' && React.createElement(React.Fragment, null,
            React.createElement(ArchiveDivider, { maxWidth: 320, margin: '26px auto 22px', fontSize: TYPE_SCALE[11], color: '#4A3D22', opacity: 1 }),
            React.createElement(ArchiveSectionHeading, { icon: "\uD83C\uDFF0", label: "Founder Guilds" }),
            React.createElement("div", { style: { fontSize: TYPE_SCALE[11.5], color: '#7A7A82', marginTop: 8, marginBottom: 22 } }, "Permanent guilds raised by Inkroot itself \u2014 every one led by the ", FOUNDER_GUILD_LEADER, "."),
            React.createElement("div", { style: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: SPACE_SCALE[16], textAlign: 'left' } },
                FOUNDER_GUILDS.map((fg) => React.createElement("div", {
                    key: fg.id, style: {
                        background: 'linear-gradient(160deg, #211C13, #17130E)', border: '1px solid #3A3020',
                        borderRadius: RADIUS_SCALE[14], padding: '20px 18px', display: 'flex', flexDirection: 'column', gap: SPACE_SCALE[10],
                    },
                },
                    React.createElement("div", { style: { fontSize: TYPE_SCALE[30] } }, fg.icon),
                    React.createElement("div", { style: { fontFamily: "'Fraunces', Georgia, serif", fontSize: TYPE_SCALE[16], fontWeight: 600, color: '#EFE7D2' } }, fg.name),
                    React.createElement("div", { style: { fontSize: TYPE_SCALE[11.5], color: '#8A8390', fontStyle: 'italic', lineHeight: 1.4, minHeight: 30 } }, "\u201C", fg.motto, "\u201D"),
                    React.createElement("div", { style: { fontSize: TYPE_SCALE[10], color: '#6C6C74', letterSpacing: '0.03em' } }, "\uD83D\uDC51 Led by ", FOUNDER_GUILD_LEADER),
                    React.createElement("button", {
                        onClick: () => onJoin(fg.id), style: {
                            marginTop: 4, background: 'linear-gradient(160deg, #241F14, #17140F)', border: '1px solid #4A3D22',
                            color: '#E8C468', borderRadius: RADIUS_SCALE[9], padding: '10px 16px', fontSize: TYPE_SCALE[12.5], fontWeight: 600, cursor: 'pointer',
                        },
                    }, "Join this Guild")))),
            React.createElement(GuildBenefitsPanel, null)));
}


// A static, non-clickable roster entry representing the Founder of Inkroot — every Founder Guild's
// permanent leader. Deliberately plainer than MemberCard (no avatar upload, no click-through)
// since it isn't a real writer account, just Inkroot's own standing presence in the Hall.
export function FounderLeaderCard({ guildName }) {
    return React.createElement("div", {
        className: "member-card", style: {
            display: 'flex', gap: SPACE_SCALE[14], alignItems: 'flex-start',
            background: 'linear-gradient(160deg, #241F14, #17130E)', border: '1px solid #4A3D22',
            borderRadius: RADIUS_SCALE[14], padding: 18, marginBottom: 12,
        },
    },
        React.createElement("div", { style: {
                width: 52, height: 52, borderRadius: '50%', flexShrink: 0,
                background: 'radial-gradient(circle at 34% 28%, #3A2F18, #17140F 72%)',
                border: '2px solid #C89B3C', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: TYPE_SCALE[22],
            } }, "\uD83D\uDC51"),
        React.createElement("div", { style: { flex: 1, minWidth: 0 } },
            React.createElement("div", { style: { display: 'flex', alignItems: 'center', gap: SPACE_SCALE[8], flexWrap: 'wrap' } },
                React.createElement("div", { style: { fontFamily: "'Fraunces', Georgia, serif", fontSize: TYPE_SCALE[16], fontWeight: 600, color: '#EFE7D2' } }, FOUNDER_GUILD_LEADER),
                React.createElement("span", { style: { fontSize: TYPE_SCALE[9.5], fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', color: GUILD_ROLES[0].color, border: `1px solid ${GUILD_ROLES[0].color}55`, borderRadius: RADIUS_SCALE[5], padding: '2px 6px' } }, GUILD_ROLES[0].icon + ' ' + GUILD_ROLES[0].name)),
            React.createElement("div", { style: { fontSize: TYPE_SCALE[12], color: '#8A8390', marginTop: 5, lineHeight: 1.4 } }, "Presiding permanently over ", guildName || 'this guild', " on behalf of Inkroot.")));
}


// What a writer earns simply by holding a seat in a Founder Guild. None of these are guild-specific
// mechanics yet (they're the same lifetime systems Inkroot already tracks — XP, reputation,
// achievements, streaks), but while inside a Founder Guild they all count toward that guild.
export const FOUNDER_GUILD_BENEFITS = [
    { icon: "\uD83C\uDF96\uFE0F", label: 'Guild XP' },
    { icon: "\u2726", label: 'Writer XP' },
    { icon: "\u231B", label: 'Reputation' },
    { icon: "\uD83C\uDFF7\uFE0F", label: 'Guild Titles' },
    { icon: "\uD83C\uDFC5", label: 'Guild Achievements' },
    { icon: "\uD83D\uDCDA", label: 'Publishing achievements' },
    { icon: "\uD83D\uDD25", label: 'Writing streaks' },
    { icon: "\uD83D\uDC41\uFE0F", label: "Readers' recognition" },
];


export function GuildBenefitsPanel() {
    return React.createElement("div", { style: { marginBottom: 34 } },
        React.createElement(ArchiveSectionHeading, { icon: "\u2728", label: "While Inside This Founder Guild, Writers Earn" }),
        React.createElement("div", { style: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: SPACE_SCALE[12], marginTop: 16 } },
            FOUNDER_GUILD_BENEFITS.map((b) => React.createElement("div", {
                key: b.label, style: {
                    display: 'flex', alignItems: 'center', gap: SPACE_SCALE[10], background: 'linear-gradient(160deg, #211C13, #17130E)',
                    border: '1px solid #3A3020', borderRadius: RADIUS_SCALE[11], padding: '12px 14px',
                },
            },
                React.createElement("span", { style: { fontSize: TYPE_SCALE[17] } }, b.icon),
                React.createElement("span", { style: { fontSize: TYPE_SCALE[12.5], color: '#D9D2BE', fontWeight: 500 } }, b.label)))));
}


// Level 20 reward: a trophy shelf celebrating the guild's own standing (Guild Rank, Guild Level,
// Guild Quests won) — a display case, not a new stat. Nothing shown here is computed differently
// than it already is elsewhere in the Hall.
export function GuildTrophyDisplay({ guildRank, guildLevel, questsCompleted, totalQuests }) {
    const trophies = [
        { icon: guildRank.icon, label: guildRank.name, caption: 'Guild Rank', color: guildRank.color },
        { icon: "\uD83C\uDF96\uFE0F", label: `Level ${guildLevel}`, caption: 'Guild Level', color: '#E8C468' },
        { icon: "\u2694\uFE0F", label: `${questsCompleted} / ${totalQuests}`, caption: 'Guild Quests Won', color: '#C89B3C' },
    ];
    return React.createElement("div", { style: { marginBottom: 34 } },
        React.createElement(ArchiveSectionHeading, { icon: "\uD83C\uDFC6", label: "Guild Trophy Display" }),
        React.createElement("div", { style: { display: 'flex', justifyContent: 'center', gap: SPACE_SCALE[16], flexWrap: 'wrap', marginTop: 16 } },
            trophies.map((t) => React.createElement("div", { key: t.caption, style: {
                    textAlign: 'center', minWidth: 130, padding: '18px 16px', borderRadius: RADIUS_SCALE[12],
                    background: 'linear-gradient(160deg, #211C13, #17130E)', border: `1px solid ${t.color}44`,
                } },
                React.createElement("div", { style: { fontSize: TYPE_SCALE[26] } }, t.icon),
                React.createElement("div", { style: { fontFamily: "'Fraunces', Georgia, serif", fontSize: TYPE_SCALE[15], fontWeight: 600, color: t.color, marginTop: 6 } }, t.label),
                React.createElement("div", { style: { fontSize: TYPE_SCALE[10], color: '#7A7A82', letterSpacing: '0.05em', textTransform: 'uppercase', marginTop: 3 } }, t.caption)))));
}


// Level 25 reward: purely decorative trim — an ornamental flourish and gilded rule that appear
// around the Hall once a guild has reached that level. No content, no function, just adornment.
export function GuildHallDecorFlourish() {
    return React.createElement("div", { style: { display: 'flex', alignItems: 'center', gap: SPACE_SCALE[12], margin: '8px auto 30px', maxWidth: 360 } },
        React.createElement("div", { style: { flex: 1, height: 1, background: 'linear-gradient(90deg, transparent, #8B5CCE88, transparent)' } }),
        React.createElement("span", { style: { fontSize: TYPE_SCALE[14], color: '#8B5CCE' } }, "\u2766 \u2765 \u2766"),
        React.createElement("div", { style: { flex: 1, height: 1, background: 'linear-gradient(90deg, transparent, #8B5CCE88, transparent)' } }));
}


// The large Guild Banner at the top of the Guild Hall — the writers'-fortress counterpart to the
// Writer Identity Card. A Founder Guild's banner (isFounder: true) is read-only — its name, motto,
// and crest are fixed, since it's a permanent Inkroot institution — but a writer can still leave
// their seat in it (leaving always starts the cooldown before joining anywhere else). A writer's
// own Player Guild keeps the original editable banner: they're its sole real member and its only
// possible officer, which is why the Invite button always shows. Guild Level rewards (new banner
// backdrop, animated crest, exclusive theme, golden name) layer on here purely cosmetically once
// earned; Members Online stays wired to the placeholder function above until a real multi-writer
// system exists to back it.
// Real members of a Player Guild — owned or joined — fetched once per guild id. Kept separate
// from GuildBanner's own "Total Members" plaque (which still just defaults to 1) rather than
// threading a loading member count back up into a preceding sibling component; this renders its
// own compact list right below the banner instead.
export function PlayerGuildRoster({ guildId }) {
    const [state, setState] = useState({ loading: true, error: null, members: [] });
    useEffect(() => {
        let cancelled = false;
        setState({ loading: true, error: null, members: [] });
        fetchPlayerGuildMembers(guildId)
            .then((members) => { if (!cancelled) setState({ loading: false, error: null, members }); })
            .catch((e) => { if (!cancelled) setState({ loading: false, error: e, members: [] }); });
        return () => { cancelled = true; };
    }, [guildId]);
    if (state.loading || state.error || state.members.length === 0)
        return null; // quiet by default — MembersHall below already shows the current writer regardless
    return React.createElement("div", { style: { marginTop: -14, marginBottom: 26, textAlign: 'center' } },
        React.createElement("div", { style: { fontSize: TYPE_SCALE[10.5], color: '#7A7A82', letterSpacing: '0.04em', textTransform: 'uppercase', marginBottom: 8 } },
            `${state.members.length} Member${state.members.length === 1 ? '' : 's'}`),
        React.createElement("div", { style: { display: 'flex', gap: SPACE_SCALE[6], flexWrap: 'wrap', justifyContent: 'center' } },
            state.members.map((m) => React.createElement("span", {
                key: m.user_id, style: {
                    fontSize: TYPE_SCALE[11], color: '#D9D2BE', background: '#1D1D22', border: '1px solid #2A2417',
                    borderRadius: RADIUS_SCALE[999], padding: '4px 10px',
                },
            }, m.name))));
}
export function GuildBanner({ guild, fileInputRef, handleCrestFile, crestError, onSaveGuild, onLeave, onInvite, inviteStatus, reputation, isFounder, isJoinedMember, founderIcon, guildLevel, memberCount }) {
    const online = computeMembersOnline(guild);
    const notYet = (v) => v === null || v === undefined;
    // A guild is read-only to the person viewing it whenever they don't own it — that's true for
    // every Founder Guild (nobody "owns" those) and now also true for a Player Guild joined via
    // invite code rather than founded. Kept as its own derived flag rather than overloading
    // isFounder everywhere, since a couple of spots (the crest icon, the footer disclaimer) still
    // need to tell the two read-only cases apart.
    const readOnly = isFounder || isJoinedMember;
    // Guild Level rewards, applied purely as visual flourish — none of these change what the
    // banner does, only how it looks once the guild's collective activity has earned them.
    const hasNewBanner = guildLevel >= 5;
    const hasAnimatedCrest = guildLevel >= 10;
    const hasExclusiveTheme = guildLevel >= 15;
    const hasGoldenName = guildLevel >= 30;
    const accentBorder = hasExclusiveTheme ? '#5B3F86' : '#4A3D22';
    const accentGlow = hasExclusiveTheme ? 'rgba(139,92,206,0.20)' : 'rgba(200,155,60,0.16)';
    const bannerBackground = hasNewBanner
        ? `radial-gradient(ellipse at 50% 0%, ${accentGlow}, transparent 68%), radial-gradient(ellipse at 12% 105%, rgba(232,196,104,0.10), transparent 60%), linear-gradient(160deg, #241F17, #17130E)`
        : `radial-gradient(ellipse at 50% 0%, ${accentGlow}, transparent 68%), linear-gradient(160deg, #211C13, #17130E)`;
    return React.createElement("div", {
        style: {
            textAlign: 'center', padding: '38px 26px 28px', borderRadius: RADIUS_SCALE[16], marginBottom: 30, position: 'relative',
            background: bannerBackground,
            border: `1px solid ${accentBorder}`, boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.05), 0 12px 34px rgba(0,0,0,0.4)',
        },
    },
        // The current Guild Level, planted beside the banner rather than inside its plaque row —
        // the one stat about this guild meant to catch the eye first.
        React.createElement("div", { style: {
                position: 'absolute', top: 16, right: 16, display: 'flex', flexDirection: 'column', alignItems: 'center',
                background: 'linear-gradient(160deg, #2A2416, #1B160E)', border: `1px solid ${accentBorder}`, borderRadius: RADIUS_SCALE[10],
                padding: '6px 12px', boxShadow: '0 4px 12px rgba(0,0,0,0.35)',
            } },
            React.createElement("div", { style: { fontSize: TYPE_SCALE[9], color: '#8A7355', letterSpacing: '0.08em', textTransform: 'uppercase' } }, "Level"),
            React.createElement("div", { style: { fontFamily: "'Fraunces', Georgia, serif", fontSize: TYPE_SCALE[20], fontWeight: 700, color: '#E8C468', lineHeight: 1.1 } }, guildLevel)),
        React.createElement("div", { className: hasAnimatedCrest ? 'guild-crest-animated' : undefined, onClick: readOnly ? undefined : (() => fileInputRef.current && fileInputRef.current.click()), style: {
                width: 128, height: 128, margin: '0 auto 18px', cursor: readOnly ? 'default' : 'pointer', position: 'relative',
                clipPath: 'polygon(50% 0%, 95% 24%, 95% 74%, 50% 100%, 5% 74%, 5% 24%)',
                background: guild.crest ? `center/cover url(${guild.crest})` : 'radial-gradient(circle at 34% 24%, #2A2620, #17140F 72%)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                filter: hasAnimatedCrest ? undefined : 'drop-shadow(0 0 0 #C89B3C) drop-shadow(0 4px 16px rgba(0,0,0,0.5))',
            } },
            React.createElement("div", { style: {
                    position: 'absolute', inset: 0,
                    clipPath: 'polygon(50% 0%, 95% 24%, 95% 74%, 50% 100%, 5% 74%, 5% 24%)',
                    border: `3px solid ${hasExclusiveTheme ? '#8B5CCE' : '#C89B3C'}`, boxShadow: `inset 0 0 22px ${accentGlow}, 0 0 26px ${accentGlow}`,
                    pointerEvents: 'none',
                } }),
            !guild.crest && React.createElement("span", { style: { fontSize: readOnly ? 50 : 46, opacity: readOnly ? 0.9 : 0.5 } }, isFounder ? (founderIcon || "\uD83C\uDFF0") : "\uD83D\uDEE1\uFE0F"),
            !readOnly && React.createElement("span", { style: {
                    position: 'absolute', bottom: 2, right: 2, width: 30, height: 30, borderRadius: '50%',
                    background: '#C89B3C', border: '2px solid #17140F', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: TYPE_SCALE[13],
                } }, "\u270E")),
        !readOnly && React.createElement("input", { ref: fileInputRef, type: "file", accept: "image/*", onChange: handleCrestFile, style: { display: 'none' } }),
        crestError && React.createElement("div", { style: { fontSize: TYPE_SCALE[11.5], color: '#D97757', marginBottom: 10 } }, crestError),
        readOnly
            ? React.createElement("div", { className: hasGoldenName ? 'guild-name-golden' : undefined, style: {
                    textAlign: 'center', fontFamily: "'Fraunces', Georgia, serif", fontSize: TYPE_SCALE[25], fontWeight: 600, color: hasGoldenName ? undefined : '#EFE7D2',
                } }, guild.name)
            : React.createElement("input", { className: hasGoldenName ? 'guild-name-golden' : undefined, value: guild.name, onChange: (e) => onSaveGuild({ name: e.target.value }), placeholder: "Name your guild\u2026", style: {
                    display: 'block', margin: '0 auto', textAlign: 'center', background: 'none', border: 'none', outline: 'none',
                    fontFamily: "'Fraunces', Georgia, serif", fontSize: TYPE_SCALE[25], fontWeight: 600, color: hasGoldenName ? undefined : '#EFE7D2', width: '100%', maxWidth: 340,
                } }),
        readOnly
            ? (guild.motto && React.createElement("div", { style: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: SPACE_SCALE[6], marginTop: 10, maxWidth: 360, marginLeft: 'auto', marginRight: 'auto' } },
                React.createElement("span", { style: { fontSize: TYPE_SCALE[12], color: '#4A4A52' } }, "\u201C"),
                React.createElement("span", { style: { fontFamily: "'Fraunces', Georgia, serif", fontStyle: 'italic', fontSize: TYPE_SCALE[12.5], color: '#C9BE8D' } }, guild.motto),
                React.createElement("span", { style: { fontSize: TYPE_SCALE[12], color: '#4A4A52' } }, "\u201D")))
            : React.createElement("div", { style: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: SPACE_SCALE[6], marginTop: 10, maxWidth: 360, marginLeft: 'auto', marginRight: 'auto' } },
                React.createElement("span", { style: { fontSize: TYPE_SCALE[12], color: '#4A4A52' } }, "\u201C"),
                React.createElement("input", { value: guild.motto || '', onChange: (e) => onSaveGuild({ motto: e.target.value }), placeholder: "A motto worth rallying behind\u2026", style: {
                        flex: 1, minWidth: 0, background: 'none', border: 'none', outline: 'none', textAlign: 'center',
                        fontFamily: "'Fraunces', Georgia, serif", fontStyle: 'italic', fontSize: TYPE_SCALE[12.5], color: '#C9BE8D',
                    } }),
                React.createElement("span", { style: { fontSize: TYPE_SCALE[12], color: '#4A4A52' } }, "\u201D")),
        isFounder && React.createElement("div", { style: { fontSize: TYPE_SCALE[11], color: '#8A7355', marginTop: 10, letterSpacing: '0.02em' } }, "\uD83D\uDC51 Led by ", FOUNDER_GUILD_LEADER),
        React.createElement(ArchiveDivider, { maxWidth: 320, margin: '22px auto 18px', fontSize: TYPE_SCALE[11], color: '#4A3D22', opacity: 1 }),
        React.createElement("div", { style: { display: 'flex', alignItems: 'stretch', flexWrap: 'wrap', rowGap: 16 } },
            React.createElement(IdentityPlaque, { icon: "\uD83C\uDF9A", label: "Guild Level", value: guildLevel }),
            React.createElement("div", { style: { width: 1, background: '#2E2818', margin: '2px 0' } }),
            React.createElement(IdentityPlaque, { icon: "\u231B", label: "Reputation", value: notYet(reputation) ? "\u2014" : reputation, valueColor: notYet(reputation) ? '#7A7A82' : undefined, caption: notYet(reputation) ? 'not yet chronicled' : null }),
            React.createElement("div", { style: { width: 1, background: '#2E2818', margin: '2px 0' } }),
            React.createElement(IdentityPlaque, { icon: React.createElement(InkIcon, { name: "users", size: 15, style: { display: "inline-block" } }), label: "Total Members", value: memberCount == null ? 1 : memberCount }),
            React.createElement("div", { style: { width: 1, background: '#2E2818', margin: '2px 0' } }),
            React.createElement(IdentityPlaque, { icon: "\uD83D\uDFE2", label: "Members Online", value: notYet(online) ? "\u2014" : online, valueColor: notYet(online) ? '#7A7A82' : undefined, caption: notYet(online) ? 'not yet chronicled' : null })),
        React.createElement("div", { style: { display: 'flex', gap: SPACE_SCALE[10], justifyContent: 'center', marginTop: 26, flexWrap: 'wrap' } },
            React.createElement("button", { onClick: onLeave, style: {
                    background: 'none', border: '1px solid #3A3A42', color: '#A6A6AD', borderRadius: RADIUS_SCALE[9],
                    padding: '11px 22px', fontSize: TYPE_SCALE[13], fontWeight: 600, cursor: 'pointer',
                } }, "Leave Guild"),
            !isJoinedMember && React.createElement("button", { onClick: onInvite, style: {
                    background: 'none', border: '1px solid #4A3D22', color: '#C89B3C', borderRadius: RADIUS_SCALE[9],
                    padding: '11px 22px', fontSize: TYPE_SCALE[13], fontWeight: 600, cursor: 'pointer',
                } }, "\u2709 Invite")),
        isFounder
            ? React.createElement("div", { style: { fontSize: TYPE_SCALE[10.5], color: '#5C5C64', marginTop: 10, fontStyle: 'italic' } }, "A permanent Founder Guild \u2014 official, always open, and never deleted. Leaving starts a cooldown before you can join another \u2014 or found (or return to) a Guild of your own from there.")
            : isJoinedMember
                ? React.createElement("div", { style: { fontSize: TYPE_SCALE[10.5], color: '#5C5C64', marginTop: 10, fontStyle: 'italic' } }, "You joined this guild \u2014 its founder can edit its name, motto, and crest, and holds the Invite. Leaving starts a cooldown before you can join another.")
                : React.createElement("div", { style: { fontSize: TYPE_SCALE[10.5], color: '#5C5C64', marginTop: 10, fontStyle: 'italic' } }, "You founded this guild \u2014 as its only officer, you hold the Invite. Leaving starts a cooldown before you can join another."),
        inviteStatus && React.createElement("div", { style: { fontSize: TYPE_SCALE[12], color: '#C89B3C', marginTop: 8 } }, inviteStatus));
}


// The wooden board above the Members' Hall — a handful of parchment notices "pinned" at gentle,
// alternating angles. Two of the six draw on real guild data (the welcome and the founding
// milestone); the rest are evergreen starter content for a guild of one, standing in for a real
// posting system that doesn't exist yet.
export function NoticeBoard({ guild }) {
    const foundedLabel = (() => {
        try {
            return new Date(guild.createdDate).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
        }
        catch (e) {
            return '';
        }
    })();
    const guildName = guild.name || 'this guild';
    const notices = [
        { icon: "\uD83D\uDC51", title: "Guild Leader Announcement", body: `Welcome to ${guildName} \u2014 the Hall stands open. May your quills never run dry.` },
        { icon: "\u2696\uFE0F", title: "Guild Milestone Reached", body: foundedLabel ? `${guildName} was founded on ${foundedLabel}.` : `${guildName} was founded.` },
        { icon: "\uD83D\uDDC2", title: "Weekly Writing Challenge", body: "This week\u2019s prompt: write a scene told entirely in flashback." },
        { icon: "\uD83D\uDCD6", title: "Anthology Submissions Open", body: "Submit a short story to the Founders\u2019 Anthology before the season ends." },
        { icon: "\uD83C\uDFC6", title: "Writing Competition", body: "The Autumn Duel begins soon \u2014 sharpen your prose and claim the laurel." },
        { icon: "\uD83D\uDDD3\uFE0F", title: "Upcoming Events", body: "No events scheduled yet \u2014 check back soon." },
    ];
    const rotations = [-2.5, 1.5, -1, 2, -2, 1];
    return React.createElement("div", { style: { marginBottom: 34 } },
        React.createElement(ArchiveSectionHeading, { icon: "\uD83D\uDCDC", label: "Guild Notice Board" }),
        React.createElement("div", { className: "notice-board", style: { marginTop: 16 } },
            React.createElement("div", { style: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(148px, 1fr))', gap: SPACE_SCALE[22] } },
                notices.map((n, i) => React.createElement("div", { key: n.title, className: "notice-card", style: { transform: `rotate(${rotations[i % rotations.length]}deg)` } },
                    React.createElement("div", { className: "notice-pin" }),
                    React.createElement("div", { style: { fontSize: TYPE_SCALE[18], marginBottom: 6 } }, n.icon),
                    React.createElement("div", { style: { fontFamily: "'Fraunces', Georgia, serif", fontSize: TYPE_SCALE[13], fontWeight: 700, color: '#2A1D10', marginBottom: 5, lineHeight: 1.25 } }, n.title),
                    React.createElement("div", { style: { fontSize: TYPE_SCALE[11.5], color: '#4A3826', lineHeight: 1.4 } }, n.body))))));
}


// The five Guild Role tiers, for the legend beneath the roster — only Guild Master is ever
// actually held right now (by the founder), but the ladder is shown in full since it's part of
// what the Guild Hall is building toward.
export const GUILD_ROLES = [
    { name: 'Guild Master', icon: "\uD83D\uDC51", color: '#E8C468' },
    { name: 'Officer', icon: "\u2694\uFE0F", color: '#C89B3C' },
    { name: 'Veteran', icon: "\uD83C\uDF96\uFE0F", color: '#A8916A' },
    { name: 'Member', icon: "\uD83D\uDCD6", color: '#8A8A92' },
    { name: 'Apprentice', icon: "\uD83E\uDEB6", color: '#6C6C74' },
];


// One labeled value inside a Member Card — plainer than IdentityPlaque (no icon, left-aligned,
// built for a 2-column grid rather than a row) since a member card holds more fields in less width.
export function MemberStat({ label, value }) {
    return React.createElement("div", { style: { minWidth: 0 } },
        React.createElement("div", { style: { fontSize: TYPE_SCALE[9], color: '#7A7A82', letterSpacing: '0.05em', textTransform: 'uppercase' } }, label),
        React.createElement("div", { style: { fontSize: TYPE_SCALE[12], color: '#D9D2BE', marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' } }, value));
}


// A single member's card in the Members' Hall — real data throughout, since Inkroot's only
// possible member (for now) is the writer themself, founder and Guild Master of their own guild.
// Clicking it opens their Author Hall, the same destination as the profile-avatar shortcut
// elsewhere in the app.
export function MemberCard({ profile, rank, role, reputation, currentProject, online, publishedCount, memberSinceLabel, onOpen }) {
    const notYet = (v) => v === null || v === undefined;
    return React.createElement("div", {
        onClick: onOpen, className: "member-card", style: {
            display: 'flex', gap: SPACE_SCALE[14], alignItems: 'flex-start', cursor: 'pointer',
            background: 'linear-gradient(160deg, #211C13, #17130E)', border: '1px solid #3A3020',
            borderRadius: RADIUS_SCALE[14], padding: 18,
        },
    },
        React.createElement("div", { style: { position: 'relative', flexShrink: 0 } },
            React.createElement("div", { style: {
                    width: 52, height: 52, borderRadius: '50%',
                    background: profile.avatar ? `center/cover url(${profile.avatar})` : 'radial-gradient(circle at 34% 28%, #2A2620, #17140F 72%)',
                    border: '2px solid #C89B3C', display: 'flex', alignItems: 'center', justifyContent: 'center',
                } }, !profile.avatar && React.createElement("span", { style: { fontSize: TYPE_SCALE[20], opacity: 0.5 } }, "\uD83E\uDDD1\u200D\uD83C\uDF93")),
            React.createElement("span", { style: {
                    position: 'absolute', bottom: -1, right: -1, width: 13, height: 13, borderRadius: '50%',
                    background: online ? '#5FBF6E' : '#5C5C64', border: '2px solid #17140F',
                } })),
        React.createElement("div", { style: { flex: 1, minWidth: 0 } },
            React.createElement("div", { style: { display: 'flex', alignItems: 'center', gap: SPACE_SCALE[8], flexWrap: 'wrap' } },
                React.createElement("div", { style: { fontFamily: "'Fraunces', Georgia, serif", fontSize: TYPE_SCALE[16], fontWeight: 600, color: '#EFE7D2' } }, profile.name || 'Unnamed Writer'),
                React.createElement("span", { style: { fontSize: TYPE_SCALE[9.5], fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', color: role.color, border: `1px solid ${role.color}55`, borderRadius: RADIUS_SCALE[5], padding: '2px 6px' } }, role.icon + ' ' + role.name)),
            React.createElement("div", { style: { fontSize: TYPE_SCALE[12], color: rank.color, marginTop: 3 } }, rank.icon + ' ' + rank.name),
            React.createElement("div", { style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px 14px', marginTop: 14 } },
                React.createElement(MemberStat, { label: "Reputation", value: notYet(reputation) ? "\u2014" : reputation }),
                React.createElement(MemberStat, { label: "Current Project", value: currentProject || 'Not currently writing' }),
                React.createElement(MemberStat, { label: "Published Books", value: publishedCount }),
                React.createElement(MemberStat, { label: "Member Since", value: memberSinceLabel || "\u2014" }))));
}


// The Members' Hall: the roster of everyone in the guild. Inkroot has no accounts or networking
// yet, so the writer is necessarily the only real entry — shown as its founder and Guild Master,
// with the full five-tier role ladder displayed below as a legend even though only the top rung is
// occupied so far.
export function MembersHall({ profile, rank, guild, reputation, currentProject, publishedCount, memberSinceLabel, onOpen, isFounder }) {
    return React.createElement("div", null,
        React.createElement(ArchiveSectionHeading, { icon: "\uD83C\uDFDB\uFE0F", label: "The Members' Hall" }),
        React.createElement("div", { style: { marginTop: 16 } },
            isFounder && React.createElement(FounderLeaderCard, { guildName: guild.name }),
            React.createElement(MemberCard, {
                profile, rank, role: isFounder ? GUILD_ROLES[3] : GUILD_ROLES[0], reputation, currentProject, online: true,
                publishedCount, memberSinceLabel, onOpen,
            })),
        React.createElement(GuildRoleLegend, null));
}


export function GuildRoleLegend() {
    return React.createElement("div", { style: { display: 'flex', flexWrap: 'wrap', gap: SPACE_SCALE[8], marginTop: 20, justifyContent: 'center' } },
        GUILD_ROLES.map((r) => React.createElement("span", {
            key: r.name, style: {
                fontSize: TYPE_SCALE[10.5], color: r.color, border: `1px solid ${r.color}40`, borderRadius: RADIUS_SCALE[6], padding: '4px 9px',
                display: 'inline-flex', alignItems: 'center', gap: SPACE_SCALE[5],
            },
        }, r.icon, ' ', r.name)));
}


// ---------- Guild Contribution ----------
// Every member's activity is what actually drives the guild's collective Guild XP (see
// computeGuildXP above) — this panel breaks that shared total back down by member so a writer can
// see what they personally put in. Guild Reputation (computeGuildReputation) is a wholly separate,
// personal prestige score built from different inputs; this panel only ever reads Guild XP figures
// that are already computed elsewhere and never touches Reputation, so a member's contribution
// share can't nudge their own Reputation up or down.
// Inkroot has no accounts or networking yet, so — same honesty as MembersHall's roster and
// GuildBanner's Members Online — the writer is necessarily the only member this device can
// actually measure. Top Contributors and Weekly Contributors are therefore real, single-entry
// leaderboards rather than an invented roster, built to grow the moment real multi-writer guilds
// exist. "Weekly" is scoped to daily writing activity specifically, since it's the one Guild XP
// source (see GUILD_XP_SOURCES) with per-day granularity — manuscripts and quests aren't stamped
// with a completion date to window by week, so the panel says so plainly rather than guessing.
export function ContributorRow({ profile, rank, xp, pct, isYou }) {
    return React.createElement("div", { style: {
            display: 'flex', alignItems: 'center', gap: SPACE_SCALE[12], padding: '10px 2px',
        } },
        React.createElement("div", { style: {
                width: 34, height: 34, borderRadius: '50%', flexShrink: 0,
                background: profile.avatar ? `center/cover url(${profile.avatar})` : 'radial-gradient(circle at 34% 28%, #2A2620, #17140F 72%)',
                border: '2px solid #C89B3C', display: 'flex', alignItems: 'center', justifyContent: 'center',
            } }, !profile.avatar && React.createElement("span", { style: { fontSize: TYPE_SCALE[13], opacity: 0.5 } }, "\uD83E\uDDD1\u200D\uD83C\uDF93")),
        React.createElement("div", { style: { flex: 1, minWidth: 0 } },
            React.createElement("div", { style: { display: 'flex', alignItems: 'center', gap: SPACE_SCALE[6] } },
                React.createElement("span", { style: { fontSize: TYPE_SCALE[13], fontWeight: 600, color: '#EFE7D2', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' } }, profile.name || 'Unnamed Writer'),
                isYou && React.createElement("span", { style: { fontSize: TYPE_SCALE[9], color: '#7A7A82', border: '1px solid #3A3A42', borderRadius: RADIUS_SCALE[5], padding: '1px 5px' } }, "YOU"),
                rank && React.createElement("span", { title: rank.name, style: { fontSize: TYPE_SCALE[11] } }, rank.icon)),
            React.createElement("div", { style: { marginTop: 6, maxWidth: 220 } }, React.createElement(ProgressBar, { value: pct, max: 100, color: '#E8C468' }))),
        React.createElement("div", { style: { textAlign: 'right', flexShrink: 0, minWidth: 58 } },
            React.createElement("div", { style: { fontSize: TYPE_SCALE[12.5], fontWeight: 700, color: '#E8C468' } }, xp.toLocaleString()),
            React.createElement("div", { style: { fontSize: TYPE_SCALE[9.5], color: '#7A7A82' } }, `${pct}%`)));
}


export function GuildContributionPanel({ profile, rank, totalXP, yourXP, weeklyXP }) {
    const pct = totalXP > 0 ? Math.round((yourXP / totalXP) * 100) : 0;
    // Solo guild: whatever you earned this week already IS the whole tracked weekly total, so
    // your share reads 100% the moment you've earned anything, 0% otherwise — rather than a
    // divide-by-zero producing something nonsensical.
    const weeklyPct = weeklyXP > 0 ? 100 : 0;
    return React.createElement("div", { style: { marginBottom: 34 } },
        React.createElement(ArchiveSectionHeading, { icon: "\uD83E\uDD1D", label: "Guild Contribution" }),
        React.createElement("div", { style: { display: 'flex', flexWrap: 'wrap', gap: SPACE_SCALE[14], marginTop: 16, marginBottom: 24 } },
            React.createElement("div", { style: { flex: '1 1 170px', textAlign: 'center', padding: '18px 14px', borderRadius: RADIUS_SCALE[12], background: 'linear-gradient(160deg, #211C13, #17130E)', border: '1px solid #3A3020' } },
                React.createElement("div", { style: { fontFamily: "'Fraunces', Georgia, serif", fontSize: TYPE_SCALE[22], fontWeight: 700, color: '#E8C468' } }, totalXP.toLocaleString()),
                React.createElement("div", { style: { fontSize: TYPE_SCALE[10], color: '#7A7A82', letterSpacing: '0.06em', textTransform: 'uppercase', marginTop: 4 } }, "Total Guild XP Earned")),
            React.createElement("div", { style: { flex: '1 1 170px', textAlign: 'center', padding: '18px 14px', borderRadius: RADIUS_SCALE[12], background: 'linear-gradient(160deg, #211C13, #17130E)', border: '1px solid #3A3020' } },
                React.createElement("div", { style: { fontFamily: "'Fraunces', Georgia, serif", fontSize: TYPE_SCALE[22], fontWeight: 700, color: '#E8C468' } }, yourXP.toLocaleString()),
                React.createElement("div", { style: { fontSize: TYPE_SCALE[10], color: '#7A7A82', letterSpacing: '0.06em', textTransform: 'uppercase', marginTop: 4 } }, "Your Contribution"),
                React.createElement("div", { style: { fontSize: TYPE_SCALE[10.5], color: '#5C8A6B', marginTop: 3 } }, `${pct}% of the guild's total`))),
        React.createElement("div", { style: { marginBottom: 22 } },
            React.createElement("div", { style: { fontSize: TYPE_SCALE[10.5], color: '#7A7A82', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 6 } }, "Top Contributors"),
            React.createElement("div", { style: { background: 'linear-gradient(160deg, #1D1810, #17130E)', border: '1px solid #3A3020', borderRadius: RADIUS_SCALE[12], padding: '2px 16px' } },
                React.createElement(ContributorRow, { profile, rank, xp: yourXP, pct, isYou: true }))),
        React.createElement("div", null,
            React.createElement("div", { style: { fontSize: TYPE_SCALE[10.5], color: '#7A7A82', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 6 } }, "Weekly Contributors"),
            React.createElement("div", { style: { background: 'linear-gradient(160deg, #1D1810, #17130E)', border: '1px solid #3A3020', borderRadius: RADIUS_SCALE[12], padding: '2px 16px' } },
                React.createElement(ContributorRow, { profile, rank, xp: weeklyXP, pct: weeklyPct, isYou: true }))),
        React.createElement("div", { style: { fontSize: TYPE_SCALE[10.5], color: '#5C5C64', marginTop: 14, fontStyle: 'italic', textAlign: 'center', lineHeight: 1.5 } }, "You're the only member Inkroot can track on this device \u2014 this leaderboard is ready to grow the day other writers can join. Weekly reflects daily writing activity only, the one Guild XP source Inkroot can currently window by week."),
        React.createElement("div", { style: { fontSize: TYPE_SCALE[10], color: '#5C5C64', marginTop: 8, textAlign: 'center' } }, "A share of Guild XP only \u2014 contributing here never changes your personal Reputation."));
}


// ---------- Guild Quests ----------
// Five cooperative objectives. Three are wired to real lifetime totals (words, chapters,
// completed/published projects) that Inkroot already tracks — for a guild of one, everything the
// writer writes counts toward them alone until other writers can join. The other two (Recruit,
// Review) have no backing system yet, so their progress is honestly zero rather than invented;
// statKey is null for those, which QuestCard reads as "no system for this yet."
export const GUILD_QUEST_DEFS = [
    { id: 'words2m', icon: "\u270D\uFE0F", title: 'Write 2,000,000 Words Together', target: 2000000, unit: 'words', guildXP: 5000, reputationReward: 250, statKey: 'totalWords' },
    { id: 'chapters300', icon: "\uD83D\uDDC2\uFE0F", title: 'Complete 300 Chapters', target: 300, unit: 'chapters', guildXP: 3000, reputationReward: 150, statKey: 'chapters' },
    { id: 'publish25', icon: "\uD83D\uDCDA", title: 'Publish 25 Books', target: 25, unit: 'books', guildXP: 8000, reputationReward: 400, statKey: 'completedCount' },
    { id: 'recruit15', icon: "\uD83E\uDD1D", title: 'Recruit 15 New Writers', target: 15, unit: 'writers', guildXP: 4000, reputationReward: 200, statKey: null },
    { id: 'review100', icon: "\uD83D\uDD0D", title: 'Review 100 Published Stories', target: 100, unit: 'reviews', guildXP: 2500, reputationReward: 120, statKey: null },
];


// Each completed quest celebrates exactly once — a per-quest localStorage flag, same pattern as
// GUILD_UNLOCK_SEEN_KEY, so reopening the app after a quest is already done doesn't replay it.
export const GUILD_QUESTS_SEEN_KEY = 'inkroot:guildQuestsSeen:v1';


export function readQuestsSeenMap() {
    try {
        return JSON.parse(localStorage.getItem(GUILD_QUESTS_SEEN_KEY) || '{}');
    }
    catch (e) {
        return {};
    }
}


export function writeQuestSeen(id) {
    try {
        const map = readQuestsSeenMap();
        map[id] = true;
        localStorage.setItem(GUILD_QUESTS_SEEN_KEY, JSON.stringify(map));
    }
    catch (e) { }
}


// One quest's card: a progress bar, its Guild XP / Reputation / (ongoing) completion-time rewards,
// and a status pill. The moment its progress first reaches target, it plays the same crack-and-
// shatter ceremony as the Guild Hall unlock (reusing GuildLockShatter and the ink-guild-unlock-burst
// glow) plus the ceremonial chime — a completed quest deserves the same fanfare as the Hall itself.
export function QuestCard({ def, progress }) {
    const target = def.target;
    const pct = Math.max(0, Math.min(100, Math.round((progress / target) * 100)));
    const complete = progress >= target;
    const [celebrate, setCelebrate] = useState(false);
    const hasCelebratedRef = useRef(readQuestsSeenMap()[def.id] === true);
    const celebrateTimer = useRef(null);
    useEffect(() => {
        if (complete && !hasCelebratedRef.current) {
            hasCelebratedRef.current = true;
            writeQuestSeen(def.id);
            setCelebrate(true);
            playGuildUnlockSound();
            celebrateTimer.current = setTimeout(() => setCelebrate(false), 2200);
        }
    }, [complete]);
    useEffect(() => () => { if (celebrateTimer.current)
        clearTimeout(celebrateTimer.current); }, []);
    const noSystemYet = def.statKey === null;
    return React.createElement("div", {
        className: celebrate ? 'ink-guild-unlock-burst' : undefined, style: {
            background: 'linear-gradient(160deg, #211C13, #17130E)', border: '1px solid #3A3020', borderRadius: RADIUS_SCALE[12],
            padding: 16, position: 'relative', textAlign: 'left',
        },
    },
        React.createElement("div", { style: { display: 'flex', alignItems: 'center', gap: SPACE_SCALE[8], marginBottom: 10 } },
            React.createElement("span", { style: { fontSize: TYPE_SCALE[18] } }, def.icon),
            React.createElement("span", { style: { fontFamily: "'Fraunces', Georgia, serif", fontSize: TYPE_SCALE[14.5], fontWeight: 600, color: '#EFE7D2', flex: 1 } }, def.title),
            React.createElement("span", { style: {
                    fontSize: TYPE_SCALE[9.5], fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', borderRadius: RADIUS_SCALE[5], padding: '3px 7px',
                    color: complete ? '#8FCB8F' : '#C89B3C', border: `1px solid ${complete ? '#8FCB8F55' : '#C89B3C55'}`,
                } }, complete ? "\u2713 Completed" : "In Progress")),
        React.createElement("div", { style: { height: 8, borderRadius: RADIUS_SCALE[5], background: '#100E0A', overflow: 'hidden', border: '1px solid #2A2416' } },
            React.createElement("div", { style: { height: '100%', width: `${pct}%`, background: 'linear-gradient(90deg, #8A6B25, #E8C468)', transition: 'width 600ms ease' } })),
        React.createElement("div", { style: { fontSize: TYPE_SCALE[11], color: '#7A7A82', marginTop: 6 } }, `${progress.toLocaleString()} / ${target.toLocaleString()} ${def.unit}`),
        noSystemYet && React.createElement("div", { style: { fontSize: TYPE_SCALE[10], color: '#5C5C64', fontStyle: 'italic', marginTop: 3 } }, "no system for this yet \u2014 progress starts at zero"),
        React.createElement("div", { style: { display: 'flex', gap: SPACE_SCALE[10], flexWrap: 'wrap', marginTop: 12, fontSize: TYPE_SCALE[11] } },
            React.createElement("span", { style: { color: '#C89B3C' } }, `\uD83C\uDF96\uFE0F +${def.guildXP.toLocaleString()} Guild XP`),
            React.createElement("span", { style: { color: '#A8916A' } }, `\u231B +${def.reputationReward} Reputation`),
            React.createElement("span", { style: { color: '#7A7A82' } }, "\u23F3 Ongoing")),
        celebrate && React.createElement(GuildLockShatter, null),
        celebrate && React.createElement("div", { className: "ink-guild-unlock-banner", style: { textAlign: 'center', marginTop: 10, fontFamily: "'Fraunces', Georgia, serif", fontStyle: 'italic', fontSize: TYPE_SCALE[12.5], color: '#E8C468' } }, "Quest complete!"));
}


// The Guild Quests board — cooperative objectives, framed honestly for a guild of one until real
// multi-writer participation exists.
export function GuildQuestBoard({ lifetimeStats }) {
    return React.createElement("div", { style: { marginBottom: 34 } },
        React.createElement(ArchiveSectionHeading, { icon: "\u2694\uFE0F", label: "Guild Quests" }),
        React.createElement("div", { style: { fontSize: TYPE_SCALE[11.5], color: '#5C5C64', textAlign: 'center', marginTop: 6, marginBottom: 18, fontStyle: 'italic' } }, "Cooperative objectives for the whole guild \u2014 for now, everything you write counts toward them alone"),
        React.createElement("div", { style: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: SPACE_SCALE[14] } },
            GUILD_QUEST_DEFS.map((def) => React.createElement(QuestCard, { key: def.id, def, progress: def.statKey ? (lifetimeStats[def.statKey] || 0) : 0 }))));
}


// ---------- The Fireside ----------
// Inkroot's guild-discussion space — a real, functioning local message board (not a placeholder),
// since posting to it, replying, pinning, and reacting are all things a single writer can
// meaningfully do on their own device without any accounts or networking. Persisted under its own
// key rather than inside guildProfile, since it grows unboundedly while the guild record itself
// stays small.
export const FIRESIDE_KEY = 'inkroot:guild:fireside';


export const FIRESIDE_CATEGORIES = [
    { key: 'discussion', icon: "\uD83D\uDCAC", label: 'Guild Discussion' },
    { key: 'advice', icon: "\uD83E\uDEB6", label: 'Writing Advice' },
    { key: 'worldbuilding', icon: "\uD83D\uDDFA\uFE0F", label: 'Worldbuilding Ideas' },
    { key: 'feedback', icon: "\uD83D\uDCD6", label: 'Chapter Feedback' },
    { key: 'announcement', icon: "\uD83D\uDCE2", label: 'Announcement' },
];


// Reaction emblems, deliberately not a single "like" — each names a specific kind of appreciation,
// so reacting reads as a considered response rather than a tally.
export const FIRESIDE_REACTIONS = [
    { key: 'fire', icon: "\uD83D\uDD25", label: 'Inspired' },
    { key: 'sword', icon: "\u2694\uFE0F", label: 'Well Argued' },
    { key: 'scroll', icon: "\uD83D\uDCDC", label: 'Noted' },
    { key: 'spark', icon: "\u2728", label: 'Brilliant' },
];
