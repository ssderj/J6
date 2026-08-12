import React from 'react';


// Members Online has no real signal to report yet — Inkroot has no accounts or network layer —
// so it stays null and the banner reads "not yet chronicled" rather than a fabricated number.
export function computeMembersOnline(guild) {
    return null;
}


// Guild Reputation (Section 6) — now wired to a real formula. It accrues from the three sources
// Inkroot can actually track today: published books, completed Guild Quests, and Fireside
// participation. Ratings, guild events, and reviews all appear in GUILD_REPUTATION_SOURCES below
// as things reputation is *meant* to grow from, but none of them contribute yet since none of
// those systems exist — so this stays honest rather than padding the number.
export function computeGuildReputation({ publishedCount, questsCompleted, firesidePostCount }) {
    return publishedCount * 100 + questsCompleted * 250 + firesidePostCount * 5;
}


// ---------- Guild Level ----------
// A separate progression track from Guild Reputation: Reputation is a prestige score, Guild Level
// is earned collectively by everyone in the guild through actual output and activity — the two
// can (and will) diverge. Guild Quests already carried a `guildXP` reward alongside their
// `reputationReward` (see GUILD_QUEST_DEFS) in anticipation of exactly this system.
export const GUILD_LEVEL_MAX = 30;


// Same progressive-cost shape as the Writer Level curve, scaled up: Guild XP is earned by an
// entire guild's collective activity rather than one writer's achievements, so each level costs
// roughly an order of magnitude more.
export const GUILD_LEVEL_THRESHOLDS = (() => {
    const cumulative = [];
    let total = 0;
    for (let level = 1; level < GUILD_LEVEL_MAX; level++) {
        total += 600 + (level - 1) * 220;
        cumulative.push(total);
    }
    return cumulative;
})();


export function guildLevelFloor(level) {
    if (level <= 1)
        return 0;
    return GUILD_LEVEL_THRESHOLDS[Math.min(level, GUILD_LEVEL_MAX) - 2];
}


export function guildLevelSpan(level) {
    if (level >= GUILD_LEVEL_MAX)
        return 0;
    return guildLevelFloor(level + 1) - guildLevelFloor(level);
}


export function guildLevelForXP(xp) {
    let level = 1;
    for (let i = 0; i < GUILD_LEVEL_THRESHOLDS.length; i++) {
        if (xp >= GUILD_LEVEL_THRESHOLDS[i])
            level = i + 2;
        else
            break;
    }
    return Math.min(level, GUILD_LEVEL_MAX);
}


// What actually contributes Guild XP today. "Completing manuscripts" and "Publishing books" share
// one real signal (a project marked complete) since Inkroot doesn't yet distinguish a finished
// manuscript from a published one; "Winning Guild Challenges" pulls each quest's own `guildXP`
// reward straight from GUILD_QUEST_DEFS; "Daily writing activity" counts distinct writing days;
// "Member participation" counts Fireside posts. Completing Guild Achievements and Community
// events have no system behind them yet, so — same honesty policy as Guild Reputation — they're
// listed as things Guild XP is *meant* to grow from without actually contributing.
export const GUILD_XP_SOURCES = [
    { label: 'Completing manuscripts', live: true },
    { label: 'Publishing books', live: true },
    { label: 'Winning Guild Challenges', live: true },
    { label: 'Completing Guild Achievements', live: false },
    { label: 'Daily writing activity', live: true },
    { label: 'Member participation', live: true },
    { label: 'Community events', live: false },
];


export function computeGuildXP({ publishedCount, questDefs, writingDayCount, firesidePostCount }) {
    const manuscriptsXP = (publishedCount || 0) * 400;
    const questsXP = (questDefs || []).reduce((sum, def) => sum + (def.guildXP || 0), 0);
    const dailyXP = (writingDayCount || 0) * 15;
    const participationXP = (firesidePostCount || 0) * 10;
    return manuscriptsXP + questsXP + dailyXP + participationXP;
}


export function computeGuildProgress(inputs) {
    const totalXP = computeGuildXP(inputs);
    const level = guildLevelForXP(totalXP);
    const isMaxLevel = level >= GUILD_LEVEL_MAX;
    const xpIntoLevel = totalXP - guildLevelFloor(level);
    // At max level there's no next threshold to measure toward, so the bar reads as full rather
    // than dividing by a span of 0.
    const xpPerLevel = isMaxLevel ? Math.max(xpIntoLevel, 1) : guildLevelSpan(level);
    return { totalXP, level, xpIntoLevel, xpPerLevel, isMaxLevel, maxLevel: GUILD_LEVEL_MAX };
}


// Guild Level rewards — every single one purely cosmetic (a backdrop, a shimmer, a color theme,
// a display shelf, some trim, a shimmering name). None of them touch Guild XP, Reputation, quest
// progress, or anything else that could be called an advantage — leveling up only ever changes
// how the Hall looks, never what it does.
export const GUILD_LEVEL_REWARDS = [
    { level: 5, icon: "\uD83D\uDDBC\uFE0F", title: 'New Guild Banner', desc: 'A richer, more ornate backdrop behind the Guild Banner.' },
    { level: 10, icon: "\u2728", title: 'Animated Guild Crest', desc: "The guild's crest gleams with a slow, living glow." },
    { level: 15, icon: "\uD83C\uDFA8", title: 'Exclusive Guild Theme', desc: 'A distinct color theme for the whole Guild Hall.' },
    { level: 20, icon: "\uD83C\uDFC6", title: 'Guild Trophy Display', desc: "A trophy shelf celebrating the guild's milestones." },
    { level: 25, icon: "\uD83D\uDD6F\uFE0F", title: 'Decorative Guild Hall Upgrades', desc: 'Extra ornamental flourishes throughout the Hall.' },
    { level: 30, icon: "\uD83D\uDC51", title: 'Golden Guild Name', desc: "The guild's name shimmers in gold." },
];


export function guildRewardsUnlocked(level) {
    return GUILD_LEVEL_REWARDS.filter((r) => level >= r.level);
}


// Names the actual pieces GuildHallEnvironment builds at each threshold, so the Level Up ceremony
// can literally list "every newly unlocked building" rather than only the cosmetic-reward summary
// GUILD_LEVEL_REWARDS already gives. Kept in the same order the Hall raises them.
export const GUILD_HALL_STRUCTURES = {
    1: ['The Campfire', 'Notice Board', 'Supply Crates'],
    5: ['The Outpost Archway', 'Guild Banner', 'Training Yard', 'Wooden Cabins'],
    10: ['The Lodge', 'Stone Fireplace', 'Guild Library Entrance', 'Reading Tables'],
    15: ['The Fortress Wall', 'Watchtowers', 'Fountain Courtyard', 'Guild Statues'],
    20: ['The Grand Keep', 'Grand Staircase', 'Knight Guards', 'Beautiful Gardens', 'Guild Museum'],
    25: ['Citadel Walls', 'Corner Towers', 'The Observatory', 'Archives & Guild Academy', 'Marketplace Courtyard'],
    30: ['The Cathedral Spire', "Founders' Plaza Monument", 'The Living City Skyline', 'Flying Banners'],
};


// ---------- Living Guild Hall ----------
// The Hall rendered as an actual small environment — a building — rather than just a list of
// unlocked badges. It shares its thresholds with GUILD_LEVEL_REWARDS above (5/10/15/20/25/30) so
// the same milestone that unlocks a reward panel elsewhere also visibly raises part of the Hall:
// a banner, a crest, a pair of towers, spires, a golden flag. Level is a single shared number every
// member's screen computes from the same Guild XP, so what's standing here is identical and
// permanent for anyone who opens this Hall — never a personal or per-visit view. Pieces are only
// ever added, never removed, and each one only plays its "construction" rise-in animation the
// first time a browser notices the level has newly reached that threshold (readSeenGuildHallStage/
// writeSeenGuildHallStage below) — after that it simply stands there already-built, the same way
// GuildLevelUpOverlay's readSeenGuildLevel/writeSeenGuildLevel keeps that separate ceremony from
// replaying on every reload. Small idle motion (window glow, a stirring flag, the crest's own pulse)
// runs regardless of level so the Hall reads as alive between milestones too, not just at them.
export const GUILD_HALL_SEEN_KEY = 'inkroot:guildHall:seenStage';


export function readSeenGuildHallStage() {
    try {
        const n = parseInt(localStorage.getItem(GUILD_HALL_SEEN_KEY) || '', 10);
        return Number.isFinite(n) ? n : 0;
    }
    catch (e) {
        return 0;
    }
}


export function writeSeenGuildHallStage(level) {
    try {
        localStorage.setItem(GUILD_HALL_SEEN_KEY, String(level));
    }
    catch (e) { }
}
