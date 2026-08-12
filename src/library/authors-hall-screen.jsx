import React, { useState, useEffect, useRef } from 'react';
import { storage } from '../lib/storage.js';
import { PublicIdentityCard, WriterIdentityCard } from './author-identity.jsx';
import { AuthorLevelUpOverlay, readSeenAuthorLevel, writeSeenAuthorLevel } from './author-level-up-overlay.jsx';
import { AUTHOR_EVER_FOLLOWED_KEY, AUTHOR_FOLLOWS_KEY, LegacyShelf, LifetimeStatTile, REPUTATION_QUALITY_MIN_ACHIEVEMENT_PCT, REPUTATION_QUALITY_MIN_WORDS, authorKeyFor, computeAuthorReputation, readAuthorFollowMap, writeAuthorFollowMap } from './author-reputation.jsx';
import { BookDetailModal, LibraryDiscoverCard } from './grand-library-cards.jsx';
import { resolvePublishStatus } from './publishing.jsx';
import { readLocalImageFile } from '../shared-ui/image-utils.jsx';
import { ArchiveSectionHeading } from '../shared-ui/ui-cards.jsx';
import { projectKey, uuid } from '../shared-utils/storage-keys.jsx';
import { wordCount } from '../shared-utils/strip-html.jsx';
import { InkIcon } from '../shell/ink-icon.jsx';
import { Breadcrumbs, RADIUS_SCALE, SPACE_SCALE, TYPE_SCALE, UniversalBackButton, useNav } from '../shell/nav-context.jsx';
import { AchievementCard, RankPromotionOverlay, WriterLevelBanner, aggregateWriterStats } from '../writing/achievements.jsx';
import { RankCrest, computeAchievements, computeStreak, runHealthChecks, writerLevelFloor, writerLevelSpan, writerRankForLevel } from '../writing/health-checks.jsx';
import { patchProjectDefaults } from '../writing/project-schema-and-backups.jsx';


export function AuthorsHallScreen({ isSelf, authorName, profile, projects, onSaveProfile, onBack, onOpenProjectHall, guildReputation, writerGuildName, onOpenCreatorDashboard, onRead }) {
    const fileInputRef = useRef(null);
    const [stats, setStats] = useState(null); // null while the lifetime tally is being gathered
    const [legacyBooks, setLegacyBooks] = useState(null); // completed projects, oldest finished first
    const [avatarError, setAvatarError] = useState('');
    const [showHall, setShowHall] = useState(false); // false = identity/stats view, true = Hall of Legends
    const [authorLevelUpEvent, setAuthorLevelUpEvent] = useState(null);
    const [rankPromotionEvent, setRankPromotionEvent] = useState(null);
    const [authorXpGainEvent, setAuthorXpGainEvent] = useState(null);
    // This device's own follow relationship to whichever author's Hall is open — irrelevant (and
    // never rendered) on your own Hall, since the Follow button only ever appears on someone
    // else's. `everFollowed` is the permanent, one-time ledger the Reputation +1 actually reads
    // from; `following` is just the button's current on/off display state (see
    // AUTHOR_FOLLOWS_KEY / AUTHOR_EVER_FOLLOWED_KEY above).
    const authorFollowKey = authorKeyFor(authorName);
    const [followingMap, setFollowingMap] = useState(() => readAuthorFollowMap(AUTHOR_FOLLOWS_KEY));
    const [everFollowedMap, setEverFollowedMap] = useState(() => readAuthorFollowMap(AUTHOR_EVER_FOLLOWED_KEY));
    const isFollowing = !!followingMap[authorFollowKey];
    const handleToggleFollow = () => {
        setFollowingMap((prev) => {
            const next = { ...prev, [authorFollowKey]: !prev[authorFollowKey] };
            if (!next[authorFollowKey])
                delete next[authorFollowKey];
            writeAuthorFollowMap(AUTHOR_FOLLOWS_KEY, next);
            return next;
        });
        // Award the Reputation point only the very first time this device ever follows this
        // author — every later unfollow/refollow just flips `following` above, which
        // computeAuthorReputation never reads from, so Reputation can't be inflated by repeating
        // the toggle.
        setEverFollowedMap((prev) => {
            if (prev[authorFollowKey])
                return prev;
            const next = { ...prev, [authorFollowKey]: true };
            writeAuthorFollowMap(AUTHOR_EVER_FOLLOWED_KEY, next);
            return next;
        });
    };
    useEffect(() => {
        let cancelled = false;
        setStats(null);
        setLegacyBooks(null);
        (async () => {
            const full = [];
            for (const meta of projects) {
                try {
                    const res = await storage.get(projectKey(meta.id));
                    if (res)
                        full.push(patchProjectDefaults(JSON.parse(res.value)));
                }
                catch (e) { /* skip a project that fails to parse rather than blocking the whole tally */ }
            }
            if (cancelled)
                return;
            const aggregated = aggregateWriterStats(full);
            setStats(aggregated);
            // Lifetime level only ever moves in step with lifetime XP, EXCEPT that deleting a
            // project can pull both back down (its achievements no longer count). So: celebrate
            // only when the level has actually risen past what we last saw here, and otherwise
            // just keep the saved baseline in sync with wherever XP legitimately sits now —
            // that keeps a level lost to deletion from causing a false celebration on recovery.
            // Fires right away regardless of which profile sub-view is open, so the Hall of
            // Legends (which has no XP banner) still gets its celebration promptly — the main
            // identity/stats view instead holds its overlay back until the XP-gain bar-fill
            // animation below finishes, for a smooth "small gain, then big arrival" handoff (see
            // its WriterLevelBanner usage further down).
            //
            // ANIMATION QUEUE: a level-up always plays AuthorLevelUpOverlay first. If it also
            // unlocked a new Writer Rank, that fact travels along as authorLevelUpEvent.
            // pendingPromotion rather than being turned into its own event here — RankPromotionEvent
            // is only ever set from AuthorLevelUpOverlay's onDone (see both render sites below),
            // once that animation has fully finished (by timing out OR being skipped), so the two
            // can never start at the same time or appear in the wrong order.
            const seen = readSeenAuthorLevel();
            if (seen === null) {
                // First time this device has ever tallied lifetime stats — adopt silently.
                writeSeenAuthorLevel(aggregated.level, aggregated.totalXP);
            }
            else {
                const xpGained = aggregated.totalXP - seen.totalXP;
                // Each level now costs a different amount of XP, so where `seen.level` started is a
                // threshold lookup rather than a flat modulo against seen.totalXP.
                const previousXpIntoLevel = seen.totalXP - writerLevelFloor(seen.level);
                if (aggregated.level > seen.level) {
                    const previousRank = writerRankForLevel(seen.level);
                    const pendingPromotion = aggregated.rank.tier > previousRank.tier
                        ? { previousRank, newRank: aggregated.rank }
                        : null;
                    setAuthorLevelUpEvent({ level: aggregated.level, rank: aggregated.rank, xpEarned: xpGained, pendingPromotion });
                    setAuthorXpGainEvent({ id: uuid(), amount: xpGained, previousLevel: seen.level, previousXpIntoLevel, leveledUp: true });
                    writeSeenAuthorLevel(aggregated.level, aggregated.totalXP);
                }
                else if (xpGained > 0) {
                    setAuthorXpGainEvent({ id: uuid(), amount: xpGained, previousLevel: seen.level, previousXpIntoLevel, leveledUp: false });
                    writeSeenAuthorLevel(aggregated.level, aggregated.totalXP);
                }
                else if (xpGained !== 0) {
                    // XP decreased (e.g. a project was deleted) — resync silently, no animation.
                    writeSeenAuthorLevel(aggregated.level, aggregated.totalXP);
                }
            }
            // The Legacy Shelf needs a per-book snapshot (achievement %, final health, completion
            // date) that the pooled lifetime stats above don't keep, so it's built separately here
            // from the same already-loaded project data rather than reloading anything.
            const books = full.filter((p) => p.completed).map((p) => {
                const words = p.chapters.reduce((s, c) => s + wordCount(c.text), 0);
                const streak = computeStreak((p.stats && p.stats.log) || {});
                const health = runHealthChecks(p);
                const ach = computeAchievements(p, { totalWords: words, streak, healthScore: health.score, totalHealthIssues: health.totalIssues });
                const achievementPct = ach.length ? Math.round((ach.filter((a) => a.unlocked).length / ach.length) * 100) : 0;
                return { id: p.id, title: p.title, subtitle: p.subtitle, seriesName: p.seriesName, author: p.author, cover: p.cover,
                    completedAt: p.completedAt || null, wordCount: words, achievementPct, healthScore: health.score };
            }).sort((a, b) => (a.completedAt || 0) - (b.completedAt || 0));
            if (!cancelled)
                setLegacyBooks(books);
        })();
        return () => { cancelled = true; };
    }, [projects]);
    const handleAvatarFile = async (e) => {
        const file = e.target.files && e.target.files[0];
        e.target.value = '';
        if (!file)
            return;
        setAvatarError('');
        try {
            const dataUrl = await readLocalImageFile(file, 480, 0.85);
            onSaveProfile({ avatar: dataUrl });
        }
        catch (err) {
            setAvatarError(err.message || 'Could not use that image.');
        }
    };
    const joinDateLabel = (() => {
        try {
            return new Date(profile.joinDate).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
        }
        catch (e) {
            return '';
        }
    })();
    const writer = stats || { level: 1, rank: writerRankForLevel(1), totalXP: 0, xpIntoLevel: 0, xpPerLevel: writerLevelSpan(1), isMaxLevel: false, totalAchievements: 0, secretAchievementsFound: 0 };
    // For a pen name that isn't this device's own — i.e. someone else's Author's Hall, reached by
    // tapping their name on a book — the only honest "published books" list is what's actually
    // public: publishStatus === 'inkroot' entries from the shared project index, filtered to that
    // exact author credit. (Private drafts, guild-only publications, and this device's other pen
    // names all stay out, same as they would on anyone else's real public page.)
    const publicBooks = isSelf ? [] : projects.filter((p) => resolvePublishStatus(p) === 'inkroot'
        && (p.author || '').trim().toLowerCase() === (authorName || '').trim().toLowerCase())
        .map((p) => ({
            id: p.id, title: p.title, subtitle: p.subtitle, seriesName: p.seriesName, cover: p.cover,
            author: p.author, wordCount: p.wordCount || 0, updatedAt: p.updatedAt || 0,
            genre: p.genre || 'Unspecified', blurb: p.blurb || '', price: typeof p.price === 'number' ? p.price : 0,
        })).sort((a, b) => b.updatedAt - a.updatedAt);
    const [selectedPublicBookId, setSelectedPublicBookId] = useState(null);
    const selectedPublicBook = selectedPublicBookId ? publicBooks.find((b) => b.id === selectedPublicBookId) : null;
    // Same nav.push/pop treatment as GrandLibraryScreen's own book detail — this modal used to be
    // a bare useState toggle that never registered with the Back/breadcrumb stack, so Back could
    // skip past it and the only way out was the Home breadcrumb's full reset.
    const nav = useNav();
    const openPublicBook = (id, title) => { nav.push({ label: title || 'Book', undo: () => setSelectedPublicBookId(null) }); setSelectedPublicBookId(id); };
    const closePublicBook = () => nav.pop();
    // This author's own published-book count, for the Reputation formula — but only the ones that
    // clear REPUTATION_QUALITY_MIN_WORDS. A quick, low-effort "published" stub shouldn't earn
    // Reputation just for existing; on your own Hall that's every sufficiently long project of
    // yours marked Published to Inkroot, on someone else's Hall it's the same publicBooks list
    // (already filtered to their author credit above) held to the same bar.
    const myPublishedCount = projects.filter((p) => resolvePublishStatus(p) === 'inkroot' && (p.wordCount || 0) >= REPUTATION_QUALITY_MIN_WORDS).length;
    const qualityPublicBooksCount = publicBooks.filter((b) => b.wordCount >= REPUTATION_QUALITY_MIN_WORDS).length;
    // "Completed projects" for the Reputation formula, self only (see below) — held to a real
    // quality bar rather than just the "marked complete" checkbox: long enough to be a genuine
    // book AND at least REPUTATION_QUALITY_MIN_ACHIEVEMENT_PCT of its own achievements actually
    // unlocked. legacyBooks already carries both wordCount and achievementPct per finished
    // project, so this reuses that same real data rather than the raw, ungated stats.completedCount.
    const meaningfulCompletedCount = (legacyBooks || []).filter((b) => b.wordCount >= REPUTATION_QUALITY_MIN_WORDS && b.achievementPct >= REPUTATION_QUALITY_MIN_ACHIEVEMENT_PCT).length;
    // The public Reputation total shown on this Hall (see computeAuthorReputation). Completed
    // projects and guild contributions are only knowable for your OWN Hall — this device has no
    // way to see another author's private project list or their guild activity, so those two
    // sources honestly stay at 0 on anyone else's Hall, same as everywhere else in Inkroot that
    // only shows what's actually public. Recomputes instantly off `everFollowedMap` state, so a
    // fresh follow updates the number the moment it happens, with no reload needed — but because
    // that number only ever moves by the diminishing-returns curve inside computeAuthorReputation,
    // "instantly" here means "correctly," not "by a large amount."
    const reputation = computeAuthorReputation({
        followCount: everFollowedMap[authorFollowKey] ? 1 : 0,
        publishedCount: isSelf ? myPublishedCount : qualityPublicBooksCount,
        completedCount: isSelf ? meaningfulCompletedCount : 0,
        guildContribution: isSelf ? (guildReputation || 0) : 0,
    });
    if (showHall) {
        const lifetimeAchievements = stats ? stats.lifetimeAchievements : [];
        const unlockedInHall = lifetimeAchievements.filter((a) => a.unlocked).length;
        return React.createElement(React.Fragment, null,
            authorLevelUpEvent && React.createElement(AuthorLevelUpOverlay, {
                key: "authorlevelup-" + authorLevelUpEvent.level, level: authorLevelUpEvent.level, rank: authorLevelUpEvent.rank,
                xpEarned: authorLevelUpEvent.xpEarned,
                onDone: () => {
                    const pendingPromotion = authorLevelUpEvent.pendingPromotion;
                    setAuthorLevelUpEvent(null);
                    if (pendingPromotion)
                        setRankPromotionEvent(pendingPromotion);
                },
            }),
            rankPromotionEvent && React.createElement(RankPromotionOverlay, {
                key: "rankpromo-" + rankPromotionEvent.newRank.tier, previousRank: rankPromotionEvent.previousRank,
                newRank: rankPromotionEvent.newRank, onDone: () => setRankPromotionEvent(null),
            }),
            React.createElement("div", { style: { minHeight: '100vh', background: '#17171B', color: '#EFE7D2', fontFamily: "ui-sans-serif, -apple-system, 'Segoe UI', Roboto, sans-serif", display: 'flex', justifyContent: 'center' } },
            React.createElement("div", { style: { width: '100%', maxWidth: 640, padding: '48px 24px 72px' } },
                React.createElement("button", { onClick: () => setShowHall(false), style: {
                        background: 'none', border: 'none', color: '#7A7A82', fontSize: TYPE_SCALE[13.5], cursor: 'pointer',
                        display: 'flex', alignItems: 'center', gap: SPACE_SCALE[6], padding: 0, marginBottom: 28,
                    } }, isSelf ? "\u2039 Profile" : "\u2039 " + (authorName || 'Author')),
                React.createElement("div", { style: { textAlign: 'center', marginBottom: 30 } },
                    React.createElement("div", { style: { fontSize: TYPE_SCALE[22], color: '#C89B3C', opacity: 0.85, marginBottom: 6 } }, "\u2766"),
                    React.createElement("div", { style: { fontFamily: "'Fraunces', Georgia, serif", fontSize: TYPE_SCALE[28], fontStyle: 'italic', fontWeight: 600, color: '#EFE7D2' } }, "Hall of Legends"),
                    React.createElement("div", { style: { fontSize: TYPE_SCALE[12.5], color: '#7A7A82', marginTop: 6 } }, "Lifetime achievements across every tale you've told \u2014 these never reset"),
                    stats && React.createElement("div", { style: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: SPACE_SCALE[8], marginTop: 14 } },
                        React.createElement(RankCrest, { rank: writer.rank, size: 28 }),
                        React.createElement("span", { style: { fontFamily: "'Fraunces', Georgia, serif", fontStyle: 'italic', fontSize: TYPE_SCALE[14], color: '#EFE7D2' } }, writer.rank.name)),
                    stats && React.createElement("div", { style: { fontSize: TYPE_SCALE[11.5], color: '#C89B3C', marginTop: 8 } }, `${unlockedInHall} / ${lifetimeAchievements.length} unlocked`)),
                stats === null
                    ? React.createElement("div", { style: { textAlign: 'center', fontSize: TYPE_SCALE[12.5], color: '#5C5C64', padding: '20px 0' } }, "Consulting the archives\u2026")
                    : React.createElement("div", { style: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: SPACE_SCALE[12] } }, lifetimeAchievements.map((a) => React.createElement(AchievementCard, { key: a.id, achievement: a }))))));
    }
    return React.createElement(React.Fragment, null,
        // Suppressed for as long as authorXpGainEvent is still animating the bar up to full —
        // otherwise the overlay would pop in instantly and hide that small animation, instead of
        // the two reading as one continuous "gain, then arrival" motion (see WriterLevelBanner
        // below, and onXpGainEnd's handling further down).
        authorLevelUpEvent && !(authorXpGainEvent && authorXpGainEvent.leveledUp) && React.createElement(AuthorLevelUpOverlay, {
            key: "authorlevelup-" + authorLevelUpEvent.level, level: authorLevelUpEvent.level, rank: authorLevelUpEvent.rank,
            xpEarned: authorLevelUpEvent.xpEarned,
            onDone: () => {
                const pendingPromotion = authorLevelUpEvent.pendingPromotion;
                setAuthorLevelUpEvent(null);
                if (pendingPromotion)
                    setRankPromotionEvent(pendingPromotion);
            },
        }),
        // No xpGain guard needed here — rankPromotionEvent is only ever set from the onDone above,
        // which by then has already outlasted the (much shorter) XP-gain animation, so the two
        // conditions can never be true at once.
        rankPromotionEvent && React.createElement(RankPromotionOverlay, {
            key: "rankpromo-" + rankPromotionEvent.newRank.tier, previousRank: rankPromotionEvent.previousRank,
            newRank: rankPromotionEvent.newRank, onDone: () => setRankPromotionEvent(null),
        }),
        React.createElement("div", { style: { minHeight: '100vh', background: '#17171B', color: '#EFE7D2', fontFamily: "ui-sans-serif, -apple-system, 'Segoe UI', Roboto, sans-serif", display: 'flex', justifyContent: 'center' } },
        React.createElement("div", { style: { width: '100%', maxWidth: 640, padding: '48px 24px 72px' } },
            React.createElement(UniversalBackButton, { compact: true, style: { marginBottom: 28 } }),
            React.createElement(Breadcrumbs, null),
            React.createElement("div", { style: { textAlign: 'center', marginBottom: 8 } },
                React.createElement("div", { style: { fontSize: TYPE_SCALE[22], color: '#C89B3C', opacity: 0.85, marginBottom: 6 } }, "\u2766"),
                React.createElement("div", { style: { fontFamily: "'Fraunces', Georgia, serif", fontSize: TYPE_SCALE[28], fontStyle: 'italic', fontWeight: 600, color: '#EFE7D2' } }, "The Author's Hall"),
                React.createElement("div", { style: { fontSize: TYPE_SCALE[12.5], color: '#7A7A82', marginTop: 6 } }, isSelf
                    ? "Your personal chamber \u2014 a record kept apart from any single tale"
                    : `${authorName || 'This writer'}'s public chamber \u2014 what every reader can see`)),
            isSelf && onOpenCreatorDashboard && React.createElement("button", { onClick: onOpenCreatorDashboard, style: {
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: SPACE_SCALE[8], width: '100%', marginBottom: 22,
                    background: 'none', border: '1px solid #3A3020', color: '#C89B3C',
                    borderRadius: RADIUS_SCALE[10], padding: '11px 18px', fontSize: TYPE_SCALE[13], fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
                } }, "\uD83D\uDDDD\uFE0F Open Creator Dashboard"),
            isSelf
                ? React.createElement(WriterIdentityCard, {
                    profile, fileInputRef, handleAvatarFile, avatarError, onSaveProfile, writer, joinDateLabel,
                    reputation,
                })
                : React.createElement(PublicIdentityCard, { authorName, writer, reputation, following: isFollowing, onToggleFollow: handleToggleFollow }),
            isSelf && writerGuildName && React.createElement("div", { style: {
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: SPACE_SCALE[6], marginTop: -14, marginBottom: 30,
                    fontSize: TYPE_SCALE[12], color: '#A6A6AD',
                } }, "\u2666 ", writerGuildName),
            React.createElement(WriterLevelBanner, { level: writer.level, rank: writer.rank, totalXP: writer.totalXP,
                xpIntoLevel: writer.xpIntoLevel, xpPerLevel: writer.xpPerLevel, isMaxLevel: writer.isMaxLevel,
                unlockedCount: writer.totalAchievements, totalCount: '\u2014',
                xpGain: authorXpGainEvent, onXpGainEnd: () => setAuthorXpGainEvent(null) }),
            stats === null
                ? React.createElement("div", { style: { textAlign: 'center', fontSize: TYPE_SCALE[12.5], color: '#5C5C64', padding: '20px 0' } }, "Consulting the archives\u2026")
                : React.createElement("div", { style: { marginTop: 12 } },
                    isSelf && React.createElement(ArchiveSectionHeading, { icon: "\uD83D\uDCDC", label: "Lifetime Statistics" }),
                    isSelf && React.createElement("div", { style: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: SPACE_SCALE[10], marginTop: 18 } },
                        React.createElement(LifetimeStatTile, { icon: "\uD83D\uDCD6", label: "Projects Created", value: projects.length }),
                        React.createElement(LifetimeStatTile, { icon: "\u2705", label: "Projects Completed", value: stats.completedCount }),
                        React.createElement(LifetimeStatTile, { icon: "\u270D\uFE0F", label: "Total Words Written", value: stats.totalWords }),
                        React.createElement(LifetimeStatTile, { icon: "\uD83D\uDDC2", label: "Chapters Written", value: stats.chapters }),
                        React.createElement(LifetimeStatTile, { icon: "\uD83D\uDC64", label: "Characters Created", value: stats.characters }),
                        React.createElement(LifetimeStatTile, { icon: "\uD83D\uDCD6", label: "World Bible Entries", value: stats.worldEntries }),
                        React.createElement(LifetimeStatTile, { icon: "\uD83D\uDDFA", label: "Maps Created", value: stats.maps }),
                        React.createElement(LifetimeStatTile, { icon: "\uD83D\uDCC5", label: "Timeline Events", value: stats.timelineEvents }),
                        React.createElement(LifetimeStatTile, { icon: "\uD83D\uDD25", label: "Writing Days", value: stats.writingDayCount }),
                        React.createElement(LifetimeStatTile, { icon: "\u26A1", label: "Longest Streak", value: stats.longestStreak }),
                        React.createElement(LifetimeStatTile, { icon: "\uD83C\uDFC6", label: "Total Achievements", value: stats.totalAchievements }),
                        React.createElement(LifetimeStatTile, { icon: "\uD83D\uDD2E", label: "Secret Achievements", value: stats.secretAchievementsFound })),
                    React.createElement("button", { onClick: () => setShowHall(true), style: {
                            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: SPACE_SCALE[8], width: '100%', marginTop: isSelf ? 22 : 0,
                            background: 'linear-gradient(160deg, #241F14, #17140F)', border: '1px solid #4A3D22', color: '#E8C468',
                            borderRadius: RADIUS_SCALE[10], padding: '14px 18px', fontSize: TYPE_SCALE[14], fontWeight: 600, cursor: 'pointer',
                            fontFamily: "'Fraunces', Georgia, serif",
                        } }, "\uD83D\uDC51 Enter the Hall of Legends"),
                    isSelf && React.createElement("div", { style: { marginTop: 40 } },
                        React.createElement(ArchiveSectionHeading, { icon: "\uD83E\uDEB5", label: "Legacy Shelf" }),
                        React.createElement("div", { style: { fontSize: TYPE_SCALE[12], color: '#7A7A82', textAlign: 'center', marginTop: 6, marginBottom: 4 } }, "Every finished tale, kept on display \u2014 select a book to revisit its own Hall of Achievements"),
                        React.createElement(LegacyShelf, { books: legacyBooks || [], onOpenBook: onOpenProjectHall })),
                    !isSelf && React.createElement("div", { style: { marginTop: 40 } },
                        React.createElement(ArchiveSectionHeading, { icon: React.createElement(InkIcon, { name: "library", size: 20, style: { display: "inline-block" } }), label: "Published Books" }),
                        publicBooks.length === 0
                            ? React.createElement("div", { style: { fontSize: TYPE_SCALE[12], color: '#5C5C64', fontStyle: 'italic', textAlign: 'center', marginTop: 10 } }, `${authorName || 'This writer'} hasn't published anything to the Grand Library yet.`)
                            : React.createElement("div", { className: "ink-grid-cards", style: { marginTop: 16 } },
                                publicBooks.map((book) => React.createElement(LibraryDiscoverCard, {
                                    key: book.id, book, isFavorite: false, onToggleFavorite: () => { }, onRead,
                                    onPreview: () => openPublicBook(book.id, book.title), myRating: null,
                                })))),
                    !isSelf && selectedPublicBook && React.createElement(BookDetailModal, {
                        book: selectedPublicBook, isFavorite: false, onToggleFavorite: () => { }, myRating: null, onSetRating: () => { },
                        onReadFull: (id) => { nav.pop(); onRead(id); }, onClose: closePublicBook,
                    })))));
}
