import React, { useState, useEffect, useMemo, useRef } from 'react';
import { ArchiveDivider, ProgressBar } from '../shared-ui/ui-cards.jsx';
import { stripHtml, wordCount } from '../shared-utils/strip-html.jsx';
import { todayKey } from '../shared-utils/truncate.jsx';
import { InkIcon } from '../shell/ink-icon.jsx';
import { RADIUS_SCALE, SPACE_SCALE, TYPE_SCALE } from '../shell/nav-context.jsx';
import { BookCover, worldCategoryMeta } from '../worldbuilding/book-cover.jsx';
import { ACHIEVEMENT_CATEGORIES, RARITY_META, RankCrest, computeAchievements, computeDailyDeltas, computeLifetimeAchievements, computeLongestStreak, computeStreak, computeWeeklyWritingDayCount, computeWriterProgress, runHealthChecks } from './health-checks.jsx';
import { chapterLabel } from './project-schema-and-backups.jsx';
import { playAchievementSound } from './reading-and-sound-settings.jsx';


// Pools stats and achievements across every saved project into one lifetime picture for the
// Writer Profile. Takes full project objects (not the lightweight index) since it needs each
// project's chapters/characters/world/stats — callers load those from storage first.
export function aggregateWriterStats(fullProjects) {
    let totalWords = 0, chapters = 0, characters = 0, worldEntries = 0, maps = 0, timelineEvents = 0;
    let completedCount = 0, projectsWithTimeline = 0;
    const dayTotals = {};
    const categoriesFullyCompleted = new Set();
    let allAchievements = [];
    fullProjects.forEach((p) => {
        const words = p.chapters.reduce((s, c) => s + wordCount(c.text), 0);
        totalWords += words;
        chapters += p.chapters.length;
        characters += p.characters.length;
        worldEntries += p.world.length;
        maps += p.maps.length;
        timelineEvents += p.timeline.length;
        if (p.completed)
            completedCount++;
        if (p.timeline.length > 0)
            projectsWithTimeline++;
        const log = (p.stats && p.stats.log) || {};
        const deltas = computeDailyDeltas(log);
        Object.entries(deltas).forEach(([day, delta]) => {
            if (delta > 0)
                dayTotals[day] = (dayTotals[day] || 0) + delta;
        });
        const streak = computeStreak(log);
        const health = runHealthChecks(p);
        const projectAchievements = computeAchievements(p, { totalWords: words, streak, healthScore: health.score, totalHealthIssues: health.totalIssues });
        allAchievements = allAchievements.concat(projectAchievements);
        ACHIEVEMENT_CATEGORIES.forEach((cat) => {
            const items = projectAchievements.filter((a) => a.group === cat.key);
            if (items.length && items.every((a) => a.unlocked))
                categoriesFullyCompleted.add(cat.key);
        });
    });
    const writingDays = Object.keys(dayTotals);
    const longestStreak = computeLongestStreak(writingDays);
    const weeklyWritingDayCount = computeWeeklyWritingDayCount(dayTotals);
    const lifetimeAchievements = computeLifetimeAchievements({
        completedCount, totalWords, worldEntries, projectsWithTimeline, maps, characters, longestStreak,
        categoriesCompleted: categoriesFullyCompleted.size,
    });
    const writer = computeWriterProgress([...allAchievements, ...lifetimeAchievements]);
    return {
        totalWords, chapters, characters, worldEntries, maps, timelineEvents, completedCount,
        writingDayCount: writingDays.length, longestStreak, weeklyWritingDayCount,
        totalAchievements: allAchievements.filter((a) => a.unlocked).length + lifetimeAchievements.filter((a) => a.unlocked).length,
        secretAchievementsFound: allAchievements.filter((a) => a.unlocked && a.secret).length,
        lifetimeAchievements,
        ...writer,
    };
}


// A carved, medallion-style frame for one achievement's icon. Unlocked medals take the rarity's
// color and get a soft outer glow (a slow pulse for epic/legendary, so the rarest badges read as
// quietly prestigious rather than static). Locked medals render as a dim, grayscale silhouette —
// present enough to hint at the shape, not enough to give away much before it's earned.
export function AchievementMedal({ icon, rarity, unlocked, size = 56 }) {
    const meta = RARITY_META[rarity] || RARITY_META.common;
    const premium = unlocked && (rarity === 'epic' || rarity === 'legendary');
    return React.createElement("div", { className: premium ? 'medal-glow' : undefined, style: {
            width: size, height: size, borderRadius: '50%', flexShrink: 0, position: 'relative',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: unlocked
                ? `radial-gradient(circle at 34% 28%, ${meta.color}55, #17140F 72%)`
                : 'radial-gradient(circle at 34% 28%, #2A2620, #17140F 72%)',
            border: `2px solid ${unlocked ? meta.color : '#3A362C'}`,
            boxShadow: unlocked
                ? `0 0 0 3px #100E0A, 0 0 0 4px ${meta.glow}, 0 3px 10px rgba(0,0,0,0.5), inset 0 2px 3px rgba(255,255,255,0.25), inset 0 -4px 7px rgba(0,0,0,0.45)`
                : `0 0 0 3px #100E0A, inset 0 2px 3px rgba(255,255,255,0.04), inset 0 -3px 6px rgba(0,0,0,0.5)`,
            filter: unlocked ? 'none' : 'grayscale(1)',
            opacity: unlocked ? 1 : 0.5,
            transition: 'opacity var(--ink-dur) var(--ink-ease), filter var(--ink-dur) var(--ink-ease)',
            '--medal-glow': meta.glow,
        } },
        React.createElement("span", { style: { fontSize: Math.round(size * 0.42) } }, icon),
        !unlocked && React.createElement("span", { style: {
                position: 'absolute', bottom: -2, right: -2, width: 20, height: 20, borderRadius: '50%',
                background: '#100E0A', border: '1px solid #3A362C', display: 'flex', alignItems: 'center', justifyContent: 'center',
            } }, React.createElement(InkIcon, { name: "lock", size: 10, color: "#8A8272" })));
}


export function RarityChip({ rarity }) {
    const meta = RARITY_META[rarity] || RARITY_META.common;
    return React.createElement("span", { style: {
            fontSize: TYPE_SCALE[10], fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase',
            color: meta.color, border: `1px solid ${meta.color}66`, borderRadius: RADIUS_SCALE[20], padding: '2px 8px',
        } }, meta.label);
}


export function AchievementCard({ achievement }) {
    const { icon, title, desc, current, target, unlocked, rarity, xp, secret } = achievement;
    const meta = RARITY_META[rarity] || RARITY_META.common;
    const isMystery = secret && !unlocked;
    return React.createElement("div", { className: "achievement-card" + (unlocked ? ' unlocked' : ''), style: {
            background: unlocked ? 'linear-gradient(160deg, #221D14, #17140F)' : 'linear-gradient(160deg, #1B1B1F, #17171B)',
            border: `1px solid ${unlocked ? meta.color + '55' : '#2A2A30'}`,
            borderRadius: RADIUS_SCALE[12], padding: '16px 16px', display: 'flex', gap: SPACE_SCALE[14], alignItems: 'flex-start',
        } },
        React.createElement(AchievementMedal, { icon: isMystery ? '\u2753' : icon, rarity: rarity, unlocked: unlocked }),
        React.createElement("div", { style: { flex: 1, minWidth: 0 } },
            React.createElement("div", { style: { display: 'flex', alignItems: 'center', gap: SPACE_SCALE[8], flexWrap: 'wrap', marginBottom: 3 } },
                React.createElement("div", { style: { fontFamily: "'Fraunces', Georgia, serif", fontSize: TYPE_SCALE[15], fontWeight: 600, color: unlocked ? '#EFE7D2' : '#8A8A90' } }, isMystery ? 'Secret Achievement' : title),
                React.createElement(RarityChip, { rarity: rarity })),
            React.createElement("div", { style: { fontSize: TYPE_SCALE[12], color: '#7A7A82', lineHeight: 1.5, fontStyle: isMystery ? 'italic' : 'normal' } }, isMystery ? 'Its nature is unknown until earned.' : desc),
            !unlocked && !secret && target > 1 && React.createElement("div", { style: { display: 'flex', flexDirection: 'column', gap: SPACE_SCALE[4], marginTop: 10 } },
                React.createElement(ProgressBar, { value: current, max: target, color: meta.color }),
                React.createElement("div", { style: { fontSize: TYPE_SCALE[11], color: '#5C5C64' } }, `${current.toLocaleString()} / ${target.toLocaleString()}`)),
            React.createElement("div", { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 10 } },
                React.createElement("span", { style: { fontSize: TYPE_SCALE[11.5], fontWeight: 600, color: unlocked ? meta.color : '#5C5C64' } }, isMystery ? '??? XP' : `+${xp} XP`),
                unlocked && React.createElement("span", { style: { fontSize: TYPE_SCALE[11.5], color: meta.color, fontWeight: 600 } }, "Unlocked \u2713"))));
}


// One category's heading in the Achievements page: emblem + tracked title + a slim gold rule
// whose fill reflects how much of that category is unlocked, closed off by the usual fleuron.
export function AchievementCategoryHeading({ icon, label, unlocked, total }) {
    const pct = total > 0 ? Math.round((unlocked / total) * 100) : 0;
    return React.createElement("div", { style: { textAlign: 'center', marginBottom: 4 } },
        React.createElement("div", { style: { fontSize: TYPE_SCALE[19], marginBottom: 6, opacity: 0.9 } }, icon),
        React.createElement("div", { style: { fontFamily: "'Fraunces', Georgia, serif", fontSize: TYPE_SCALE[15], letterSpacing: '0.22em', textTransform: 'uppercase', color: '#EFE7D2', fontWeight: 600 } }, label),
        React.createElement("div", { style: { fontSize: TYPE_SCALE[11.5], color: '#C89B3C', marginTop: 4, letterSpacing: '0.04em' } }, `${unlocked} / ${total} \u00B7 ${pct}%`),
        React.createElement("div", { style: { maxWidth: 160, margin: '8px auto 0' } }, React.createElement(ProgressBar, { value: unlocked, max: total, color: '#C89B3C' })),
        React.createElement(ArchiveDivider, null));
}


// The ornate banner atop the Achievements page: writer level, its title, total XP, and progress
// toward the next level — the "coat of arms" for the whole page.
// xpGain, when passed, describes a one-shot XP-gain animation to play over the banner's normal
// (already-current) numbers: { id, amount, previousLevel, previousXpIntoLevel, leveledUp }. While
// it plays, the level number and progress bar/counter show the *previous* state and tween forward
// to the new one — all the way to a full bar if `leveledUp`, rather than the new, wrapped-around
// low value — then onXpGainEnd(leveledUp) fires so the caller can clear the event and, if it
// leveled up, bring in the Level Up animation right as this one finishes (see ProjectWorkspace's
// and AuthorsHallScreen's detection effects). Without xpGain, this renders exactly as it always
// has: a static snapshot of the current level/rank/XP.
export function WriterLevelBanner({ level, rank, subtitle, totalXP, xpIntoLevel, xpPerLevel, isMaxLevel, unlockedCount, totalCount, xpGain, onXpGainEnd }) {
    const [displayXp, setDisplayXp] = useState(xpGain ? xpGain.previousXpIntoLevel : xpIntoLevel);
    const [showFloat, setShowFloat] = useState(false);
    useEffect(() => {
        if (!xpGain)
            return;
        setDisplayXp(xpGain.previousXpIntoLevel);
        setShowFloat(true);
        const target = xpGain.leveledUp ? xpPerLevel : xpIntoLevel;
        const start = xpGain.previousXpIntoLevel;
        const duration = 900;
        const startTime = performance.now();
        let raf = null;
        const tick = (now) => {
            const t = Math.min(1, (now - startTime) / duration);
            const eased = 1 - Math.pow(1 - t, 3); // ease-out cubic — quick at first, settles gently
            setDisplayXp(Math.round(start + (target - start) * eased));
            if (t < 1) {
                raf = requestAnimationFrame(tick);
            }
            else {
                // A brief pause at a full bar before handing off makes the level-up feel like an
                // arrival rather than an abrupt cut; an ordinary gain settles a little faster.
                setTimeout(() => onXpGainEnd(xpGain.leveledUp), xpGain.leveledUp ? 260 : 450);
            }
        };
        raf = requestAnimationFrame(tick);
        const floatTimer = setTimeout(() => setShowFloat(false), 1100);
        return () => { if (raf)
            cancelAnimationFrame(raf); clearTimeout(floatTimer); };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [xpGain && xpGain.id]);
    const shownLevel = xpGain && xpGain.leveledUp ? xpGain.previousLevel : level;
    const shownXp = xpGain ? displayXp : xpIntoLevel;
    // Once Level 50 is reached there's no next level to show progress toward — the bar reads as
    // full and the caption celebrates the cap instead of dividing toward a threshold that no
    // longer exists. A level-up animation that lands exactly on Level 50 still gets to play out
    // (shownLevel briefly holds the previous level while the bar fills), so this only takes over
    // once that settles.
    const atCap = isMaxLevel && !(xpGain && xpGain.leveledUp && shownLevel < level);
    return React.createElement("div", { style: {
            position: 'relative', textAlign: 'center', padding: '26px 24px 22px', borderRadius: RADIUS_SCALE[14], marginBottom: 12,
            background: 'radial-gradient(ellipse at 50% 0%, rgba(200,155,60,0.10), transparent 70%), linear-gradient(160deg, #201C13, #17140F)',
            border: '1px solid #3A3020',
        } },
        xpGain && showFloat && React.createElement("div", { key: xpGain.id, className: "xpgain-float" }, `+${xpGain.amount} XP`),
        React.createElement("div", { style: { fontSize: TYPE_SCALE[11], letterSpacing: '0.2em', textTransform: 'uppercase', color: '#8A7C55', marginBottom: 6 } }, "Writer Level"),
        React.createElement("div", { style: { fontFamily: "'Fraunces', Georgia, serif", fontSize: TYPE_SCALE[34], fontWeight: 600, color: '#E8C468' } }, shownLevel),
        rank
            ? React.createElement("div", { style: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: SPACE_SCALE[10], marginTop: 6 } },
                React.createElement(RankCrest, { rank: rank, size: 34 }),
                React.createElement("div", { style: { fontFamily: "'Fraunces', Georgia, serif", fontStyle: 'italic', fontSize: TYPE_SCALE[16], color: '#EFE7D2' } }, rank.name))
            : React.createElement("div", { style: { fontFamily: "'Fraunces', Georgia, serif", fontStyle: 'italic', fontSize: TYPE_SCALE[15], color: '#EFE7D2', marginTop: 2 } }, subtitle),
        React.createElement("div", { style: { maxWidth: 280, margin: '16px auto 0' } },
            React.createElement(ProgressBar, { value: atCap ? 1 : shownXp, max: atCap ? 1 : xpPerLevel, color: '#E8C468' }),
            React.createElement("div", { style: { fontSize: TYPE_SCALE[11], color: '#7A7A82', marginTop: 6 } }, atCap
                ? `Maximum level reached \u2014 ${totalXP.toLocaleString()} XP`
                : `${shownXp} / ${xpPerLevel} XP to Level ${shownLevel + 1}`)),
        React.createElement("div", { style: { fontSize: TYPE_SCALE[12], color: '#A6A6AD', marginTop: 16, display: 'flex', justifyContent: 'center', gap: SPACE_SCALE[18], flexWrap: 'wrap' } },
            React.createElement("span", null, React.createElement("strong", { style: { color: '#EFE7D2' } }, totalXP.toLocaleString()), " total XP"),
            React.createElement("span", null, React.createElement("strong", { style: { color: '#EFE7D2' } }, unlockedCount), ` / ${totalCount} unlocked`)));
}


// A brief celebratory toast for the moment an achievement unlocks while the writer is anywhere
// other than the Achievement Hall (most importantly while actually writing) — the medal appears
// inside a burst of gold particles flying outward, then the whole toast fades away after ~2
// seconds, on its own timeline via .aunlock-toast-in. Deliberately small and non-blocking so it
// never interrupts typing; the full cinematic AchievementUnlockOverlay below is reserved for the
// Achievement Hall, where the writer has already stopped to look. See handleUnlockContinue and its
// neighboring effect in ProjectWorkspace for how the two share the same unlockQueue.
export function AchievementUnlockToast({ achievement, onView }) {
    const meta = RARITY_META[achievement.rarity] || RARITY_META.common;
    const particles = Array.from({ length: 12 }, (_, i) => i);
    // The toast fades into view at 15% of its 2000ms entrance (see .aunlock-toast-in), so the
    // sound is timed to land right as the medal actually becomes visible rather than on mount.
    useEffect(() => {
        const timer = setTimeout(() => playAchievementSound(achievement.rarity), 300);
        return () => clearTimeout(timer);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [achievement.id]);
    return React.createElement("div", { className: "aunlock-toast-in", onClick: onView, style: {
            position: 'fixed', top: 22, left: '50%', transform: 'translateX(-50%)', zIndex: 3000,
            display: 'flex', alignItems: 'center', gap: SPACE_SCALE[14], padding: '14px 22px 14px 14px', borderRadius: RADIUS_SCALE[14],
            background: 'linear-gradient(160deg, #241F14, #17140F)', border: `1px solid ${meta.color}77`,
            boxShadow: `0 10px 30px rgba(0,0,0,0.55), 0 0 24px ${meta.glow}`,
            cursor: onView ? 'pointer' : 'default',
        } },
        React.createElement("div", { style: { position: 'relative', width: 56, height: 56, flexShrink: 0 } },
            particles.map((i) => React.createElement("span", { key: i, className: "gold-particle", style: { '--a': `${Math.round((360 / particles.length) * i)}deg`, animationDelay: `${i * 14}ms` } })),
            React.createElement(AchievementMedal, { icon: achievement.icon, rarity: achievement.rarity, unlocked: true, size: 56 })),
        React.createElement("div", null,
            React.createElement("div", { style: { fontSize: TYPE_SCALE[10.5], letterSpacing: '0.14em', textTransform: 'uppercase', color: meta.color, fontWeight: 700 } }, "Achievement Unlocked"),
            React.createElement("div", { style: { fontFamily: "'Fraunces', Georgia, serif", fontSize: TYPE_SCALE[16], fontWeight: 600, color: '#EFE7D2', marginTop: 2 } }, achievement.title),
            React.createElement("div", { style: { fontSize: TYPE_SCALE[11.5], color: meta.color, marginTop: 2, fontWeight: 600 } }, `+${achievement.xp} XP`)));
}


// Per-rarity intensity/timing profile for AchievementUnlockOverlay below — the layout (badge, then
// title, rarity chip, XP, checkmark, Continue) is identical at every rarity; only how much visual
// spectacle rides along with it, and how long the whole sequence takes to land, changes:
//   Common     — a small warm glow and a gentle pop, nothing more.
//   Uncommon   — a stronger glow plus a fuller ring of orbiting sparkles.
//   Rare       — adds an expanding gold ring and a brighter outward particle burst.
//   Epic       — the glow shifts to a purple-and-gold aura, with rotating light rays behind the medal.
//   Legendary  — the biggest glow, three staggered expanding rings, drifting embers, a subtle
//                camera shake right as the medal lands, and the longest hold before Continue appears.
// Every delay field below is a millisecond offset from mount, reused directly as that element's
// animationDelay — so the same CSS animations run for every rarity, just spaced further apart as
// the celebration gets grander, rather than needing a separate keyframe set per tier.
export const RARITY_UNLOCK_FX = {
    common: {
        glowSize: 150, glowBg: 'radial-gradient(circle, #FFEFC088, #E8C46844 55%, transparent 78%)', glowPeak: 0.55, glowEnd: 0.4, glowDur: 500,
        overshoot: 1.08, badgeDur: 480,
        sparkleCount: 4, sparkleRadius: 28, sparkleSize: 4, sparkleDur: 700, sparkleBg: 'radial-gradient(circle, #FFEFC0, #E8C468 60%, transparent 100%)',
        burstCount: 0, ringCount: 0, rays: false, driftCount: 0, shake: false,
        titleDelay: 480, rarityDelay: 620, xpDelay: 700, xpDur: 400, checkDelay: 880, continueDelay: 1250,
    },
    uncommon: {
        glowSize: 190, glowBg: 'radial-gradient(circle, #FFF6E0aa, #C7CCD655 50%, #E8C46833 70%, transparent 80%)', glowPeak: 0.75, glowEnd: 0.55, glowDur: 620,
        overshoot: 1.12, badgeDur: 540,
        sparkleCount: 14, sparkleRadius: 32, sparkleSize: 5, sparkleDur: 950, sparkleBg: 'radial-gradient(circle, #FFF6E0, #E8C468 55%, transparent 100%)',
        burstCount: 0, ringCount: 0, rays: false, driftCount: 0, shake: false,
        titleDelay: 560, rarityDelay: 700, xpDelay: 780, xpDur: 450, checkDelay: 980, continueDelay: 1450,
    },
    rare: {
        glowSize: 220, glowBg: 'radial-gradient(circle, #FFF6D9bb, #E8C46866 50%, transparent 78%)', glowPeak: 0.9, glowEnd: 0.7, glowDur: 700,
        overshoot: 1.15, badgeDur: 600,
        sparkleCount: 10, sparkleRadius: 32, sparkleSize: 5, sparkleDur: 1000, sparkleBg: 'radial-gradient(circle, #FFEFC0, #E8C468 60%, transparent 100%)',
        burstCount: 12, burstSize: 6, burstDur: 750, burstBg: 'radial-gradient(circle, #FFFBEA, #FFD84f 55%, transparent 100%)',
        ringCount: 1, ringSize: 112, rays: false, driftCount: 0, shake: false,
        titleDelay: 650, rarityDelay: 800, xpDelay: 900, xpDur: 500, checkDelay: 1150, continueDelay: 1650,
    },
    epic: {
        glowSize: 240, glowBg: 'radial-gradient(circle, #E8C468aa, #A184D688 45%, #6B4FA855 70%, transparent 82%)', glowPeak: 0.95, glowEnd: 0.75, glowDur: 800,
        overshoot: 1.16, badgeDur: 620,
        sparkleCount: 14, sparkleRadius: 34, sparkleSize: 5.5, sparkleDur: 1050, sparkleBg: 'radial-gradient(circle, #F1E4FF, #A184D6 55%, transparent 100%)',
        burstCount: 0, ringCount: 0, rays: true, raysSize: 190, raysDur: 1500, driftCount: 0, shake: false,
        titleDelay: 750, rarityDelay: 900, xpDelay: 1000, xpDur: 550, checkDelay: 1300, continueDelay: 1850,
    },
    legendary: {
        glowSize: 300, glowBg: 'radial-gradient(circle, #FFF8E4dd, #E8C468bb 40%, #A184D666 62%, transparent 82%)', glowPeak: 1, glowEnd: 0.85, glowDur: 950,
        overshoot: 1.2, badgeDur: 680,
        sparkleCount: 20, sparkleRadius: 40, sparkleSize: 6, sparkleDur: 1250, sparkleBg: 'radial-gradient(circle, #FFFBEA, #E8C468 55%, transparent 100%)',
        burstCount: 0, ringCount: 3, ringSize: 120, rays: false,
        driftCount: 8, shake: true,
        titleDelay: 950, rarityDelay: 1120, xpDelay: 1250, xpDur: 650, checkDelay: 1600, continueDelay: 2550,
    },
};


// A cinematic, full-screen moment for the instant an achievement unlocks: the backdrop dims and
// blurs, a glow blooms from the center, the medal springs in and settles while sparkles orbit it,
// then title/rarity/XP/checkmark reveal in a staggered sequence, and finally a Continue button
// fades in once everything else has landed. Every bit of that — glow size/color, sparkle count,
// how much overshoot the medal's spring has, which extra elements (rings, rays, burst, drift,
// shake) show up, and how long each stage is delayed — comes from RARITY_UNLOCK_FX above, so the
// same component reads as a quiet pop for a Common medal and a genuine event for a Legendary one
// without any of the underlying layout changing. This is a deliberate, blocking beat (background
// dimmed, pointer events captured) rather than a passive notification, so it holds until the writer
// taps Continue — see the "aunlock-*" keyframes below for the shape of each stage's animation, and
// AchievementUnlockToast above for the non-blocking version shown outside the Achievement Hall.
// Purely a session-side effect (see the unlock-detection effect in ProjectWorkspace) — nothing
// about "which achievements have already been celebrated" is persisted.
export function AchievementUnlockOverlay({ achievement, onContinue }) {
    const meta = RARITY_META[achievement.rarity] || RARITY_META.common;
    const fx = RARITY_UNLOCK_FX[achievement.rarity] || RARITY_UNLOCK_FX.common;
    const [displayXp, setDisplayXp] = useState(0);
    // The medal's spring-in (.aunlock-badge-spring) starts 150ms after mount regardless of
    // rarity, so the stinger is timed to land there too — right as the badge actually appears —
    // rather than at t=0 while the backdrop is still fading in.
    useEffect(() => {
        const timer = setTimeout(() => playAchievementSound(achievement.rarity), 150);
        return () => clearTimeout(timer);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [achievement.id]);
    // The XP figure counts up from zero rather than appearing instantly, timed (per rarity, via
    // fx.xpDelay/fx.xpDur) to land after the badge/title/rarity beats above it but before the
    // checkmark and Continue button below it.
    useEffect(() => {
        setDisplayXp(0);
        let raf = null;
        const startTimer = setTimeout(() => {
            const startTime = performance.now();
            const tick = (now) => {
                const t = Math.min(1, (now - startTime) / fx.xpDur);
                const eased = 1 - Math.pow(1 - t, 3); // ease-out cubic, matching the XP bar elsewhere
                setDisplayXp(Math.round(achievement.xp * eased));
                if (t < 1)
                    raf = requestAnimationFrame(tick);
            };
            raf = requestAnimationFrame(tick);
        }, fx.xpDelay);
        return () => { clearTimeout(startTimer); if (raf)
            cancelAnimationFrame(raf); };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [achievement.id]);
    const sparkles = Array.from({ length: fx.sparkleCount }, (_, i) => i);
    const bursts = Array.from({ length: fx.burstCount }, (_, i) => i);
    const rings = Array.from({ length: fx.ringCount }, (_, i) => i);
    const drifts = Array.from({ length: fx.driftCount }, (_, i) => i);
    return React.createElement("div", { className: "aunlock-overlay", style: {
            position: 'fixed', inset: 0, zIndex: 4700, display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'rgba(10,9,7,0.72)', padding: 24,
        } },
        React.createElement("div", { className: fx.shake ? 'aunlock-shake' : undefined, style: { position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', width: 'min(88vw, 360px)', textAlign: 'center' } },
            React.createElement("div", { className: "aunlock-badge-wrap" },
                React.createElement("div", { className: "aunlock-glow", style: { width: fx.glowSize, height: fx.glowSize, background: fx.glowBg, '--glow-peak': fx.glowPeak, '--glow-end': fx.glowEnd, animationDuration: `${fx.glowDur}ms` } }),
                fx.rays && React.createElement("div", { className: "aunlock-rays", style: { width: fx.raysSize, height: fx.raysSize, animationDuration: `${fx.raysDur}ms, ${fx.raysDur}ms` } }),
                rings.map((i) => React.createElement("div", { key: 'ring' + i, className: "aunlock-ring", style: { width: fx.ringSize + i * 22, height: fx.ringSize + i * 22, animationDelay: `${i * 160}ms` } })),
                bursts.map((i) => React.createElement("span", { key: 'burst' + i, className: "aunlock-burst", style: { '--a': `${Math.round((360 / bursts.length) * i)}deg`, width: fx.burstSize, height: fx.burstSize, background: fx.burstBg, animationDuration: `${fx.burstDur}ms`, animationDelay: `${180 + i * 10}ms` } })),
                sparkles.map((i) => React.createElement("span", { key: 'sparkle' + i, className: "aunlock-sparkle", style: { '--a': `${Math.round((360 / sparkles.length) * i)}deg`, '--radius': `${fx.sparkleRadius}px`, width: fx.sparkleSize, height: fx.sparkleSize, background: fx.sparkleBg, animationDuration: `${fx.sparkleDur}ms`, animationDelay: `${250 + i * 12}ms` } })),
                drifts.map((i) => React.createElement("span", { key: 'drift' + i, className: "aunlock-drift", style: { '--dx': `${(i % 2 === 0 ? 1 : -1) * (10 + i * 5)}px`, animationDelay: `${400 + i * 90}ms` } })),
                React.createElement("div", { className: "aunlock-badge-spring", style: { '--overshoot': fx.overshoot, animationDuration: `${fx.badgeDur}ms` } },
                    React.createElement(AchievementMedal, { icon: achievement.icon, rarity: achievement.rarity, unlocked: true, size: 78 }))),
            React.createElement("div", { className: "aunlock-title", style: { animationDelay: `${fx.titleDelay}ms` } },
                React.createElement("div", { style: { fontSize: TYPE_SCALE[11], letterSpacing: '0.16em', textTransform: 'uppercase', color: meta.color, fontWeight: 700, marginBottom: 5 } }, "Achievement Unlocked"),
                React.createElement("div", { style: { fontFamily: "'Fraunces', Georgia, serif", fontSize: TYPE_SCALE[21], fontWeight: 600, color: '#EFE7D2' } }, achievement.title)),
            React.createElement("div", { className: "aunlock-rarity", style: { marginTop: 12, animationDelay: `${fx.rarityDelay}ms` } }, React.createElement(RarityChip, { rarity: achievement.rarity })),
            React.createElement("div", { className: "aunlock-xp", style: { fontSize: TYPE_SCALE[15.5], fontWeight: 700, color: meta.color, marginTop: 16, animationDelay: `${fx.xpDelay}ms` } }, `+${displayXp.toLocaleString()} XP`),
            React.createElement("div", { className: "aunlock-check", style: { display: 'flex', alignItems: 'center', gap: SPACE_SCALE[6], marginTop: 10, fontSize: TYPE_SCALE[11.5], fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: meta.color, animationDelay: `${fx.checkDelay}ms` } },
                React.createElement("span", { style: { fontSize: TYPE_SCALE[13] } }, "\u2713"), "Unlocked"),
            React.createElement("button", { className: "aunlock-continue", onClick: onContinue, style: {
                    marginTop: 26, background: 'none', border: `1px solid ${meta.color}88`, color: '#EFE7D2', borderRadius: RADIUS_SCALE[8],
                    padding: '9px 28px', fontSize: TYPE_SCALE[13], fontWeight: 600, cursor: 'pointer', fontFamily: "'Inter', sans-serif",
                    animationDelay: `${fx.continueDelay}ms`,
                } }, "Continue")));
}


// A cinematic, ceremonial moment for the rarer event of the writer's level (not just a single
// achievement) advancing — deliberately slower and grander than AchievementUnlockOverlay above, like a noble
// title being conferred rather than a quick notification. Purely a session-side effect (see the
// level-detection effect in ProjectWorkspace) — nothing about "which level-ups have already been
// celebrated" is persisted, so it simply won't replay after a reload. Dismisses itself via onDone
// once its animation finishes; see LEVEL_UP_DURATION_MS.
export const LEVEL_UP_DURATION_MS = 2800;


export function LevelUpOverlay({ project, level, xpEarned, newAchievements, onDone }) {
    useEffect(() => {
        const t = setTimeout(onDone, LEVEL_UP_DURATION_MS);
        return () => clearTimeout(t);
    }, [onDone]);
    const shimmerParticles = Array.from({ length: 14 }, (_, i) => i);
    return React.createElement("div", { className: "levelup-overlay", style: {
            position: 'fixed', inset: 0, zIndex: 4600, display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'radial-gradient(circle at 50% 42%, rgba(36,29,15,0.6), rgba(10,9,7,0.88) 70%)',
            pointerEvents: 'none',
        } },
        React.createElement("div", { style: { position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', width: 'min(88vw, 380px)', textAlign: 'center' } },
            React.createElement("div", { className: "levelup-ring", style: {
                    position: 'absolute', top: 2, width: 152, height: 152, borderRadius: '50%',
                    border: '1.5px solid #E8C46899', boxShadow: '0 0 0 8px #C89B3C22, 0 0 44px 8px #C89B3C3d',
                } }),
            shimmerParticles.map((i) => React.createElement("span", { key: 'shimmer' + i, className: "gold-particle levelup-shimmer", style: {
                    top: 78, left: '50%', '--a': `${Math.round((360 / shimmerParticles.length) * i)}deg`, animationDelay: `${200 + i * 22}ms`,
                } })),
            React.createElement("div", { className: "levelup-crest" },
                React.createElement(BookCover, { title: project.title, subtitle: project.subtitle, seriesName: project.seriesName, author: project.author, cover: project.cover, size: "sm" })),
            React.createElement("div", { className: "levelup-title", style: {
                    marginTop: 24, fontFamily: "'Fraunces', Georgia, serif", fontSize: TYPE_SCALE[30], fontWeight: 600, letterSpacing: '0.08em',
                    color: '#E8C468', textShadow: '0 0 20px #C89B3C88', textTransform: 'uppercase',
                } }, "Level Up"),
            React.createElement("div", { className: "levelup-title", style: { fontFamily: "'Fraunces', Georgia, serif", fontStyle: 'italic', fontSize: TYPE_SCALE[14.5], color: '#D9C99A', marginTop: 4 } }, `${(project.title && project.title.trim()) ? project.title.trim() : 'Your novel'} has reached Level ${level}`),
            React.createElement("div", { className: "levelup-bar-wrap", style: { width: '76%', marginTop: 22 } },
                React.createElement("div", { style: { background: '#232328', borderRadius: RADIUS_SCALE[6], height: 8, overflow: 'hidden', width: '100%', boxShadow: 'inset 0 0 0 1px #3A3A42' } },
                    React.createElement("div", { className: "levelup-bar-fill" }))),
            React.createElement("div", { className: "levelup-xp", style: { marginTop: 18 } },
                React.createElement("div", { style: { fontSize: TYPE_SCALE[14.5], fontWeight: 700, color: '#E8C468' } }, `+${xpEarned.toLocaleString()} XP Earned`),
                newAchievements.length > 0 && React.createElement("div", { style: { fontSize: TYPE_SCALE[12], color: '#A6A6AD', marginTop: 8, lineHeight: 1.7, maxWidth: 320 } },
                    "New achievements unlocked:",
                    React.createElement("br", null),
                    newAchievements.map((a) => a.title).join(' \u00B7 '))),
            React.createElement("div", { className: "levelup-final-sparkle" })));
}


// A quiet counterpart to LevelUpOverlay above, for the moment a level-up happens while the writer
// is actually writing: the full ceremonial overlay would interrupt typing, so this is just a small
// corner toast — sized and positioned like the app's other transient panels (below the toolbar, top
// right), fades in/out on its own, and never covers or blocks the editor. Tapping it (or its "View
// Rewards" button) opens the Achievement Hall to see the full moment there instead.
// Deliberately does NOT clear the shared level-up event when it times out or is tapped away — this
// toast is just a heads-up, not the reward moment itself, so the full LevelUpOverlay still gets to
// play the first time the writer actually opens the Achievement Hall. It only hides *itself* (via
// local state) once its own time is up, so it won't linger or replay on every visit back to the
// manuscript tab.
export const LEVEL_UP_TOAST_DURATION_MS = 4600;


export function LevelUpMiniToast({ level, xpEarned, onView, stacked }) {
    const [dismissed, setDismissed] = useState(false);
    useEffect(() => {
        const t = setTimeout(() => setDismissed(true), LEVEL_UP_TOAST_DURATION_MS);
        return () => clearTimeout(t);
    }, []);
    if (dismissed)
        return null;
    const particles = Array.from({ length: 6 }, (_, i) => i);
    return React.createElement("div", {
        className: "levelup-mini-toast", onClick: onView,
        style: {
            // AchievementUnlockToast (centered, ~top 22-106px) can be showing at the same time as
            // this one — an achievement and the level-up it caused land in the very same render —
            // so when that's the case this drops below it instead of overlapping.
            position: 'fixed', top: stacked ? 118 : 66, right: 18, zIndex: 3200, display: 'flex', alignItems: 'center', gap: SPACE_SCALE[12],
            padding: '11px 14px', borderRadius: RADIUS_SCALE[12], cursor: 'pointer', maxWidth: 260,
            background: 'linear-gradient(160deg, #241F14, #17140F)', border: '1px solid #C89B3C66',
            boxShadow: '0 8px 22px rgba(0,0,0,0.5), 0 0 18px #C89B3C33',
            transition: 'top var(--ink-dur) var(--ink-ease)',
        },
    },
        React.createElement("div", { style: { position: 'relative', width: 34, height: 34, flexShrink: 0, borderRadius: '50%', background: 'radial-gradient(circle at 34% 28%, #C89B3C55, #17140F 72%)', border: '1.5px solid #C89B3C', display: 'flex', alignItems: 'center', justifyContent: 'center' } },
            particles.map((i) => React.createElement("span", { key: i, className: "gold-particle levelup-mini-particle", style: { '--a': `${Math.round((360 / particles.length) * i)}deg`, animationDelay: `${i * 20}ms` } })),
            React.createElement("span", { style: { fontSize: TYPE_SCALE[15] } }, "\u2728")),
        React.createElement("div", { style: { minWidth: 0 } },
            React.createElement("div", { style: { fontSize: TYPE_SCALE[10], letterSpacing: '0.12em', textTransform: 'uppercase', color: '#C89B3C', fontWeight: 700 } }, "Project Level Up"),
            React.createElement("div", { style: { fontFamily: "'Fraunces', Georgia, serif", fontSize: TYPE_SCALE[15], fontWeight: 600, color: '#EFE7D2', marginTop: 2 } }, `Level ${level}`, React.createElement("span", { style: { fontFamily: "'Inter', sans-serif", fontSize: TYPE_SCALE[11.5], fontWeight: 600, color: '#A6A6AD', marginLeft: 8 } }, `+${xpEarned.toLocaleString()} XP`)),
            React.createElement("button", { onClick: (e) => { e.stopPropagation(); onView(); }, style: {
                    marginTop: 6, background: 'none', border: '1px solid #3A3A42', color: '#E8C468', borderRadius: RADIUS_SCALE[6],
                    padding: '3px 9px', fontSize: TYPE_SCALE[11], fontWeight: 600, cursor: 'pointer',
                } }, "View Rewards")));
}


// ---------- Author Level Up (Writer Profile) ----------
// A rarer, more ceremonial moment than either project-scoped animation above: the writer's
// permanent lifetime level has advanced. Deliberately slower, larger, and more layered than
// LevelUpOverlay — the crest is the writer's own Rank crest rather than a single project's cover,
// and there's an extra "Writer Rank" beat before the headline.
// This is always the FIRST of at most two animations in the author-progression queue: if the same
// level-up also unlocks a new Rank, AuthorsHallScreen only brings in RankPromotionOverlay from
// this component's onDone — never before it, and never at the same time — so the two never overlap
// (see the queuing comment on AuthorsHallScreen's detection effect). Skippable via the Skip
// button below; skipping calls the same onDone used for a natural finish, so the queue still
// advances to the rank promotion (if any) exactly as it would have.
// Its "have we already celebrated this level" bookkeeping has to survive a reload — the Profile
// screen recomputes lifetime stats from scratch every time it's opened, unlike a project's live
// editing session — so it's backed by a tiny localStorage record (see readSeenAuthorLevel /
// writeSeenAuthorLevel below) instead of an in-memory ref.
export const AUTHOR_LEVEL_UP_DURATION_MS = 4000;


export const AUTHOR_LEVEL_SEEN_KEY = 'inkroot:writerLevel:seen';


// ---------- Writer Rank Promotion (Writer Profile) ----------
// The rarest, most ceremonial of the three level-related overlays: a Writer Rank (a whole tier,
// spanning several levels each) only advances a handful of times across a writer's whole lifetime.
// This is always the SECOND stage of the author-progression queue — AuthorsHallScreen only ever
// sets the state that renders this from AuthorLevelUpOverlay's onDone, once that animation has
// fully finished (whether by timing out or being skipped), so it can never start early or appear
// alongside it (see the queuing comment on AuthorsHallScreen's detection effect). The old rank's
// crest fades and shrinks away while the new rank's crest grows in to take its place, which is the
// "Previous Rank \u2192 New Rank" transition — reinforced in words just below it for clarity.
// Skippable at any time (a title-conferring ceremony this size shouldn't feel like it's holding the
// writer hostage), via a small Skip control that stays clickable despite the rest of the overlay
// being pointer-events: none.
export const RANK_PROMOTION_DURATION_MS = 4500;


export function RankPromotionOverlay({ previousRank, newRank, onDone }) {
    useEffect(() => {
        const t = setTimeout(onDone, RANK_PROMOTION_DURATION_MS);
        return () => clearTimeout(t);
    }, [onDone]);
    const embers = useMemo(() => Array.from({ length: 13 }, (_, i) => ({
        id: i,
        leftPct: Math.round(38 + Math.random() * 24),
        dx: Math.round((Math.random() * 2 - 1) * 30),
        duration: 2000 + Math.round(Math.random() * 1000),
        delay: 500 + i * 240 + Math.round(Math.random() * 240),
    })), []);
    return React.createElement("div", { className: "rankpromo-overlay", style: {
            position: 'fixed', inset: 0, zIndex: 4950, display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'radial-gradient(circle at 50% 40%, rgba(40,32,16,0.68), rgba(8,7,6,0.93) 74%)',
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
            React.createElement("div", { className: "rankpromo-burst", style: {
                    position: 'absolute', top: -24, width: 280, height: 280, borderRadius: '50%',
                    background: 'radial-gradient(circle, #E8C46855, transparent 70%)',
                } }),
            React.createElement("div", { className: "rankpromo-burst", style: {
                    position: 'absolute', top: 28, width: 200, height: 200, borderRadius: '50%',
                    border: '1.5px solid #E8C46899', boxShadow: '0 0 0 10px #C89B3C22, 0 0 54px 10px #C89B3C40',
                } }),
            embers.map((e) => React.createElement("span", { key: e.id, className: "rankpromo-ember", style: {
                    top: 180, left: `${e.leftPct}%`, '--dx': `${e.dx}px`, animationDuration: `${e.duration}ms`, animationDelay: `${e.delay}ms`,
                } })),
            React.createElement("div", { style: { position: 'relative', width: 110, height: 110, marginTop: 24, display: 'flex', alignItems: 'center', justifyContent: 'center' } },
                React.createElement("div", { className: "rankpromo-prevcrest", style: { position: 'absolute' } },
                    React.createElement(RankCrest, { rank: previousRank, size: 60 })),
                React.createElement("div", { className: "rankpromo-newcrest", style: { position: 'absolute' } },
                    React.createElement(RankCrest, { rank: newRank, size: 100, forceGlow: true }))),
            React.createElement("div", { className: "rankpromo-title", style: {
                    marginTop: 22, fontFamily: "'Fraunces', Georgia, serif", fontSize: TYPE_SCALE[26], fontWeight: 600, letterSpacing: '0.05em',
                    color: '#E8C468', textShadow: '0 0 22px #C89B3C99',
                } }, "A New Title Has Been Earned"),
            React.createElement("div", { className: "rankpromo-transition", style: {
                    marginTop: 12, fontFamily: "'Fraunces', Georgia, serif", fontSize: TYPE_SCALE[16], display: 'flex', alignItems: 'center', gap: SPACE_SCALE[8],
                } },
                React.createElement("span", { style: { fontStyle: 'italic', color: '#7A7A82' } }, previousRank.name),
                React.createElement("span", { style: { color: '#5C5C64' } }, "\u2192"),
                React.createElement("span", { style: { fontWeight: 600, color: newRank.color } }, newRank.name)),
            React.createElement("div", { className: "rankpromo-finalglow", style: { top: 26, width: 210, height: 210 } })));
}


// Keeps a per-day snapshot of total word count, debounced, so streaks and
// "words today" stay accurate without writing to storage on every keystroke.
export function useDailyLog(project, ready, setProject) {
    const timer = useRef(null);
    useEffect(() => {
        if (!ready || !project)
            return;
        if (timer.current)
            clearTimeout(timer.current);
        timer.current = setTimeout(() => {
            const key = todayKey();
            const total = project.chapters.reduce((s, c) => s + wordCount(c.text), 0);
            setProject((p) => {
                if (!p)
                    return p;
                const log = (p.stats && p.stats.log) || {};
                if (log[key] === total)
                    return p;
                const next = structuredClone(p);
                if (!next.stats)
                    next.stats = { log: {} };
                next.stats.log[key] = total;
                return next;
            });
        }, 800);
        return () => clearTimeout(timer.current);
    }, [project, ready]);
}


export function searchAllEntities(query, characters, locations, world, glossary, timeline) {
    const q = (query || '').toLowerCase();
    const matches = (x, field) => (x[field] || '').toLowerCase().includes(q) || (x.tags || []).some((t) => t.toLowerCase().includes(q));
    const byField = (list, field, type) => list
        .filter((x) => matches(x, field))
        .map((x) => ({ id: x.id, name: x[field], type }));
    return [
        ...byField(characters, 'name', 'character'),
        ...byField(locations, 'name', 'location'),
        ...byField(world, 'topic', 'world'),
        ...byField(glossary, 'term', 'glossary'),
        ...byField(timeline || [], 'what', 'timeline'),
    ];
}


// Builds a short excerpt centered on the first match of `q` inside `text`, so a search result can
// show *why* it matched rather than just its title. Falls back to the start of the text if the
// match isn't found in this particular field (title already matched instead).
export function makeSnippet(text, q, radius) {
    if (!text)
        return '';
    const plain = text.replace(/\s+/g, ' ').trim();
    const idx = plain.toLowerCase().indexOf(q.toLowerCase());
    if (idx === -1)
        return plain.slice(0, radius * 2);
    const start = Math.max(0, idx - radius);
    const end = Math.min(plain.length, idx + q.length + radius);
    return (start > 0 ? '…' : '') + plain.slice(start, end) + (end < plain.length ? '…' : '');
}


// Searches the whole project — manuscript, characters, locations, world-bible entries (split into
// Organizations / Items / everything-else), notes, timeline, and glossary — and groups matches by
// category. Each group is an array of { id, title, snippet } ready to render and jump to.
export function globalSearch(project, query) {
    const q = (query || '').trim().toLowerCase();
    const empty = { manuscript: [], characters: [], locations: [], organizations: [], items: [], world: [], notes: [], timeline: [], glossary: [] };
    if (!q || !project)
        return empty;
    const hit = (...fields) => fields.filter(Boolean).join(' \u2014 ').toLowerCase().includes(q);
    const results = { ...empty };
    (project.chapters || []).forEach((c, idx) => {
        const plain = stripHtml(c.text);
        if (plain.toLowerCase().includes(q) || (c.title || '').toLowerCase().includes(q)) {
            results.manuscript.push({ id: c.id, title: chapterLabel(project.chapters, c.id), snippet: makeSnippet(plain, q, 40) });
        }
    });
    (project.characters || []).forEach((c) => {
        if (hit(c.name, c.alias, c.occupation, c.status, c.goals, c.personality, c.biography, c.notes, ...(c.tags || []))) {
            results.characters.push({ id: c.id, title: c.name || 'Unnamed', snippet: makeSnippet([c.biography, c.notes, c.goals, c.personality].filter(Boolean).join(' \u2014 '), q, 50) });
        }
    });
    (project.locations || []).forEach((l) => {
        if (hit(l.name, l.description)) {
            results.locations.push({ id: l.id, title: l.name || 'Unnamed', snippet: makeSnippet(l.description, q, 50) });
        }
    });
    (project.world || []).forEach((w) => {
        if (hit(w.topic, w.detail)) {
            const entry = { id: w.id, title: w.topic || 'Unnamed', snippet: makeSnippet(w.detail, q, 50) };
            if (w.category === 'organizations')
                results.organizations.push(entry);
            else if (w.category === 'artifacts')
                results.items.push(entry);
            else
                results.world.push({ ...entry, meta: worldCategoryMeta(w.category).label });
        }
    });
    (project.notes || []).forEach((n) => {
        if (hit(n.title, n.body)) {
            results.notes.push({ id: n.id, title: n.title || 'Untitled note', snippet: makeSnippet(n.body, q, 50) });
        }
    });
    (project.timeline || []).forEach((ev) => {
        if (hit(ev.when, ev.what)) {
            results.timeline.push({ id: ev.id, title: ev.what || 'Untitled event', snippet: ev.when || '' });
        }
    });
    (project.glossary || []).forEach((g) => {
        if (hit(g.term, g.definition)) {
            results.glossary.push({ id: g.id, title: g.term || 'Untitled term', snippet: makeSnippet(g.definition, q, 50) });
        }
    });
    return results;
}


export const SEARCH_GROUPS = [
    { key: 'manuscript', icon: '📖', label: 'Manuscript' },
    { key: 'characters', icon: '👥', label: 'Characters' },
    { key: 'locations', icon: '🏰', label: 'Locations' },
    { key: 'organizations', icon: '🏛', label: 'Organizations' },
    { key: 'items', icon: '🗝', label: 'Items' },
    { key: 'world', icon: '🌍', label: 'World Bible' },
    { key: 'notes', icon: '📝', label: 'Notes' },
    { key: 'timeline', icon: '📅', label: 'Timeline' },
    { key: 'glossary', icon: '📚', label: 'Glossary' },
];
