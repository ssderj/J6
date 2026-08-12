import React, { useState, useEffect, useRef } from 'react';
import { storage } from '../lib/storage.js';
import { FiresideBoard } from '../guild/fireside-board.jsx';
import { GuildBookFeedbackModal, GuildBookshelf } from '../guild/guild-book-feedback-modal.jsx';
import { readGuildFeedback, writeGuildFeedback } from '../guild/guild-feedback.jsx';
import { FIRESIDE_KEY, GUILD_LEVEL_UP_DURATION_MS, GUILD_QUEST_DEFS, GuildBanner, GuildBenefitsPanel, GuildContributionPanel, GuildHallDecorFlourish, GuildLevelPanel, GuildLevelUpOverlay, GuildQuestBoard, GuildTrophyDisplay, GuildWelcomeScreen, MembersHall, NoticeBoard, PlayerGuildRoster, formatCooldownRemaining, founderGuildById, guildCooldownRemainingMs, readSeenGuildLevel, writeSeenGuildLevel } from '../guild/guild-hall.jsx';
import { GuildHallEnvironment } from '../guild/guild-hall-environment.jsx';
import { GuildOrderScreen } from '../guild/guild-order.jsx';
import { GUILD_LEVEL_REWARDS, computeGuildProgress, computeGuildReputation, computeGuildXP } from '../guild/guild-progression.jsx';
import { GuildReputationPanel, guildRankForReputation } from '../guild/guild-reputation-panel.jsx';
import { hashSeed } from '../library/author-reputation.jsx';
import { AuthorsHallScreen } from '../library/authors-hall-screen.jsx';
import { GrandLibraryScreen } from '../library/grand-library-screen.jsx';
import { AuthorInboxScreen, seedInboxItems } from '../library/inbox-and-living-universe.jsx';
import { LivingUniverseScreen } from '../library/living-universe-screen.jsx';
import { IconPlus, IconTrash } from '../shared-ui/icons.jsx';
import { readLocalImageFile } from '../shared-ui/image-utils.jsx';
import { ArchiveSectionHeading, SectionLabel } from '../shared-ui/ui-cards.jsx';
import { ConfirmDialog } from '../shared-ui/ui-primitives.jsx';
import { formatBytes } from '../shared-utils/format-bytes.jsx';
import { formatRelativeTime } from '../shared-utils/format-duration.jsx';
import { INBOX_KEY, projectKey } from '../shared-utils/storage-keys.jsx';
import { wordCount } from '../shared-utils/strip-html.jsx';
import { HomeNav, HomeQuickActionTile, InkIcon, InkrootNewsCard, LibraryHero, TodaysInspirationCard } from './ink-icon.jsx';
import { AccountSyncControl } from './account-sync-control.jsx';
import { InkRoot } from './ink-root.jsx';
import { Breadcrumbs, RADIUS_SCALE, SPACE_SCALE, TYPE_SCALE, useNav } from './nav-context.jsx';
import { BookCover } from '../worldbuilding/book-cover.jsx';
import { HealthScoreSummary, WRITER_RANKS, runHealthChecks } from '../writing/health-checks.jsx';
import { chapterLabel, patchProjectDefaults } from '../writing/project-schema-and-backups.jsx';
import { ProjectWorkspace } from '../writing/project-workspace.jsx';


export function HomeScreen({ projects, onOpen, onReadBook, onOpenHealth, onOpenPacks, onCreate, onDelete, onExportAll, onImportFile, onOptimizeAll, writerProfile, onOpenProfile, writerRank, writerLevel, writerReputation, guildProfile, onJoinFounderGuild, onLeaveGuild, onEnterOwnGuild, onSaveOwnGuild, onJoinGuildByCode, joinCodeError, lifetimeStats, onReputationChange, onSetPublishStatus, onSetPackPublishStatus, onPublishBookWithDetails, onPublishPackWithDetails, activeTab, setActiveTab, onOpenAuthor, libraryInitialMode }) {
    const sorted = [...projects].sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
    const featured = sorted.length > 0 ? sorted[0] : null;
    const rest = featured ? sorted.slice(1) : sorted;
    const fileInputRef = useRef(null);
    const crestFileInputRef = useRef(null);
    const [crestError, setCrestError] = useState('');
    const [inviteStatus, setInviteStatus] = useState('');
    const inviteStatusTimer = useRef(null);
    useEffect(() => () => { if (inviteStatusTimer.current)
        clearTimeout(inviteStatusTimer.current); }, []);
    // Guild Bookshelf feedback (see GuildBookshelf / GuildBookFeedbackModal) — local-only today,
    // keyed the same way as the rest of the Grand Library's on-device data.
    const [guildFeedback, setGuildFeedback] = useState(() => readGuildFeedback());
    const handleAddGuildFeedback = (bookId, entry) => {
        setGuildFeedback((prev) => {
            const next = { ...prev, [bookId]: [...(prev[bookId] || []), entry] };
            writeGuildFeedback(next);
            return next;
        });
    };
    const handleCrestFile = async (e) => {
        const file = e.target.files && e.target.files[0];
        e.target.value = '';
        if (!file)
            return;
        setCrestError('');
        try {
            const dataUrl = await readLocalImageFile(file, 480, 0.85);
            onSaveOwnGuild({ crest: dataUrl });
        }
        catch (err) {
            setCrestError(err.message || 'Could not use that image.');
        }
    };
    const playerGuild = guildProfile && guildProfile.playerGuild;
    const joinedGuild = guildProfile && guildProfile.joinedGuild;
    const activeFounderGuild = guildProfile && guildProfile.guildType === 'founder' ? founderGuildById(guildProfile.founderGuildId) : null;
    const activeGuildName = guildProfile && guildProfile.guildType === 'player'
        ? (playerGuild && playerGuild.name) || 'my guild'
        : guildProfile && guildProfile.guildType === 'joined'
            ? (joinedGuild && joinedGuild.name) || 'my guild'
            : (activeFounderGuild && activeFounderGuild.name) || 'my guild';
    const handleInviteGuild = () => {
        // Real invite code once the guild has synced remotely (see enterOwnGuild/saveOwnGuild
        // in InkRoot); falls back to the old generic message if it hasn't synced yet — e.g.
        // signed out, or the very first save hasn't round-tripped to Supabase yet.
        const message = playerGuild && playerGuild.inviteCode
            ? `Join ${activeGuildName} on Inkroot! Use invite code: ${playerGuild.inviteCode}`
            : `Join ${activeGuildName} on Inkroot!`;
        const showStatus = (text) => {
            setInviteStatus(text);
            if (inviteStatusTimer.current)
                clearTimeout(inviteStatusTimer.current);
            inviteStatusTimer.current = setTimeout(() => setInviteStatus(''), 3000);
        };
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(message).then(() => showStatus('Invite message copied \u2014 paste it anywhere to share.'), () => showStatus('Could not copy the invite \u2014 your browser may be blocking it.'));
        }
        else {
            showStatus('Could not copy the invite \u2014 your browser may be blocking it.');
        }
    };
    const [status, setStatus] = useState('');
    const [confirmState, setConfirmState] = useState(null); // { message, onConfirm }
    // activeTab ('home' | 'guild' | 'library') is owned by InkRoot, not this component: HomeScreen
    // unmounts every time a project or the Writer Profile is opened (InkRoot swaps it out for
    // ProjectWorkspace/AuthorsHallScreen entirely) and remounts fresh when the writer comes back.
    // Local state here would reset to 'home' on every such remount even though the nav breadcrumb
    // stack still remembered "Grand Library"/"Guild Hall" — that mismatch was what let repeated
    // trips into a project stack duplicate, dead "Grand Library" crumbs whose undo() pointed at a
    // setActiveTab from an already-unmounted instance. Keeping the state in InkRoot (which never
    // unmounts) keeps it in sync with the nav stack no matter how many times the writer dips into
    // a project and back.
    const nav = useNav();
    // Home itself is the breadcrumb root, so only Guild/Library push a level; switching straight
    // between those two siblings swaps the crumb in place instead of stacking a second one.
    const changeHomeTab = (next) => {
        if (next === activeTab)
            return;
        const label = next === 'guild' ? 'Guild Hall' : next === 'library' ? 'Grand Library' : next === 'inbox' ? 'Author Inbox' : next === 'universe' ? 'Living Universe' : next === 'guildorder' ? 'The Guild Order' : 'Home';
        if (next === 'home') {
            nav.pop();
        }
        else if (activeTab === 'home') {
            nav.push({ label, undo: () => setActiveTab('home') });
        }
        else {
            nav.goTo(nav.stack.length - 2);
            nav.push({ label, undo: () => setActiveTab('home') });
        }
        setActiveTab(next);
    };
    const [firesidePostCount, setFiresidePostCount] = useState(0); // feeds the "community participation" leg of Guild Reputation
    useEffect(() => {
        let cancelled = false;
        (async () => {
            const res = await storage.get(FIRESIDE_KEY);
            if (!cancelled && res) {
                try {
                    setFiresidePostCount(JSON.parse(res.value).length);
                }
                catch (e) { /* leave the count as-is if the stored value is unreadable */ }
            }
        })();
        return () => { cancelled = true; };
    }, [activeTab]); // re-tally whenever the Guild tab is (re)opened, so a fresh Fireside post is reflected
    // Unread-letter tally for HomeNav's Inbox badge — AuthorInboxScreen only mounts while the Inbox
    // tab is actually open, so this peeks at INBOX_KEY directly (same trick as firesidePostCount
    // above) and re-tallies whenever any Home tab is opened, including right after leaving the
    // Inbox itself, so the badge count is never stale.
    const [inboxUnreadCount, setInboxUnreadCount] = useState(0);
    useEffect(() => {
        let cancelled = false;
        (async () => {
            const res = await storage.get(INBOX_KEY);
            if (cancelled)
                return;
            try {
                const list = res ? JSON.parse(res.value) : (projects.some((p) => p.completed) ? seedInboxItems() : []);
                setInboxUnreadCount(list.filter((i) => i.unread && !i.archived).length);
            }
            catch (e) { /* leave the count as-is if the stored value is unreadable */ }
        })();
        return () => { cancelled = true; };
    }, [activeTab]);
    // Guild Level Up detection — fires regardless of which tab is active (like the Author Level Up
    // check), from the exact same inputs GuildLevelPanel's progress is built from below, so the
    // celebration and the number on the panel can never disagree. Guild XP only ever moves in step
    // with these inputs, so a level "drop" here (e.g. a published project got deleted) just resyncs
    // the saved baseline silently rather than celebrating backwards.
    const [guildLevelUpEvent, setGuildLevelUpEvent] = useState(null);
    useEffect(() => {
        if (!guildProfile || !guildProfile.guildType)
            return;
        const publishedCount = projects.filter((p) => p.completed).length;
        const completedQuestDefs = GUILD_QUEST_DEFS.filter((def) => def.statKey && (lifetimeStats[def.statKey] || 0) >= def.target);
        const progress = computeGuildProgress({
            publishedCount, questDefs: completedQuestDefs,
            writingDayCount: lifetimeStats.writingDayCount, firesidePostCount,
        });
        const seen = readSeenGuildLevel();
        if (seen === null) {
            // First time this device has ever tallied Guild XP — adopt silently.
            writeSeenGuildLevel(progress.level, progress.totalXP);
            return;
        }
        if (progress.level > seen.level) {
            setGuildLevelUpEvent({
                previousLevel: seen.level, level: progress.level,
                xpIntoLevel: progress.xpIntoLevel, xpPerLevel: progress.xpPerLevel, isMaxLevel: progress.isMaxLevel,
                newRewards: GUILD_LEVEL_REWARDS.filter((r) => r.level > seen.level && r.level <= progress.level),
            });
            writeSeenGuildLevel(progress.level, progress.totalXP);
        }
        else if (progress.totalXP !== seen.totalXP) {
            writeSeenGuildLevel(progress.level, progress.totalXP);
        }
    }, [guildProfile, projects, lifetimeStats, firesidePostCount]);
    // Loads the featured project's full data (the index only stores title/word count/etc.) just
    // to run the same Story Health checks used inside the project, so this card can show a real
    // count without waiting for the user to open the project first.
    const [featuredHealth, setFeaturedHealth] = useState(null); // null while loading (or no featured project); else { score, issueCount }
    useEffect(() => {
        let cancelled = false;
        if (!featured) {
            setFeaturedHealth(null);
            return;
        }
        setFeaturedHealth(null);
        (async () => {
            try {
                const res = await storage.get(projectKey(featured.id));
                if (!res) return;
                const data = patchProjectDefaults(JSON.parse(res.value));
                const { score, totalIssues } = runHealthChecks(data);
                if (!cancelled)
                    setFeaturedHealth({ score, issueCount: totalIssues });
            }
            catch (e) {
                // Leave featuredHealth null — the card just won't render rather than show a wrong count.
            }
        })();
        return () => { cancelled = true; };
    }, [featured && featured.id, featured && featured.updatedAt]);
    const handleFileChosen = async (e) => {
        const file = e.target.files && e.target.files[0];
        e.target.value = ''; // allow re-selecting the same file later
        if (!file)
            return;
        setStatus('Importing…');
        const msg = await onImportFile(file);
        setStatus(msg);
        setTimeout(() => setStatus(''), 5000);
    };
    const handleOptimizeAllClick = async () => {
        setStatus('Optimizing images across all projects\u2026');
        try {
            const { totalFreed, touchedProjects } = await onOptimizeAll();
            setStatus(touchedProjects > 0
                ? `Freed about ${formatBytes(totalFreed)} across ${touchedProjects} project${touchedProjects === 1 ? '' : 's'}.`
                : "Nothing needed optimizing across your projects.");
        }
        catch (e) {
            setStatus('Could not finish optimizing \u2014 try again.');
        }
        setTimeout(() => setStatus(''), 8000);
    };
    // "Continue Writing" hero card for the most recently edited project — a generated book cover
    // stands in for the old plain-text title, so the featured project reads as an actual book.
    let featuredCard = null;
    if (featured) {
        const featuredTitle = featured.title && featured.title.trim() ? featured.title : 'Untitled Novel';
        const glow = React.createElement("div", { style: {
                position: 'absolute', top: -60, right: -60, width: 180, height: 180, borderRadius: '50%',
                background: 'radial-gradient(circle, rgba(200,155,60,0.10) 0%, rgba(200,155,60,0) 70%)',
            } });
        const eyebrow = React.createElement("div", { style: {
                fontSize: TYPE_SCALE[11], fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase',
                color: '#C89B3C', marginBottom: 14,
            } }, "Continue Writing");
        const titleEl = React.createElement("div", { style: {
                fontFamily: "'Fraunces', Georgia, serif", fontSize: TYPE_SCALE[19], fontWeight: 600, lineHeight: 1.2,
            } }, featuredTitle);
        const chapterEl = featured.chapterLabel ? React.createElement("div", { style: { fontSize: TYPE_SCALE[14.5], color: '#A6A6AD', marginTop: 10 } }, featured.chapterLabel) : null;
        const wordsEl = React.createElement("div", { style: { fontSize: TYPE_SCALE[13], color: '#7A7A82', marginTop: 6 } }, (featured.wordCount || 0).toLocaleString(), " words");
        const editedEl = featured.updatedAt ? React.createElement("div", { style: { fontSize: TYPE_SCALE[12], color: '#5C5C64', marginTop: 14 } }, "Last edited ", formatRelativeTime(featured.updatedAt)) : null;
        const resumeEl = React.createElement("div", { style: {
                display: 'inline-flex', alignItems: 'center', gap: SPACE_SCALE[6], marginTop: 18,
                color: '#C89B3C', fontSize: TYPE_SCALE[14], fontWeight: 600,
            } }, "Resume \u2192");
        const coverEl = React.createElement(BookCover, { title: featured.title, subtitle: featured.subtitle, seriesName: featured.seriesName, author: featured.author, cover: featured.cover, size: 'md' });
        const textCol = React.createElement("div", { style: { flex: 1, minWidth: 0 } }, eyebrow, titleEl, chapterEl, wordsEl, editedEl, resumeEl);
        featuredCard = React.createElement("div", {
            onClick: () => onOpen(featured.id), className: "continue-card", style: {
                cursor: 'pointer', borderRadius: RADIUS_SCALE[14], padding: '26px 28px', marginBottom: 28,
                background: 'linear-gradient(165deg, #1D1D22 0%, #1A1A1F 100%)',
                border: '1px solid #2A2A30', position: 'relative', overflow: 'hidden',
                display: 'flex', gap: SPACE_SCALE[20], alignItems: 'flex-start',
            }
        }, glow, coverEl, textCol);
    }
    // Story Health summary card for that same featured project — sits between "Continue
    // Writing" and "+ New Project". Loading state and healthy/issues states share one layout so
    // this doesn't jump around as featuredHealth resolves.
    let storyHealthCard = null;
    if (featured) {
        const loading = !featuredHealth;
        storyHealthCard = React.createElement("div", {
            onClick: () => onOpenHealth(featured.id), className: "health-card", style: {
                cursor: 'pointer', borderRadius: RADIUS_SCALE[14], padding: '20px 22px', marginBottom: 14,
                background: '#1D1D22', border: '1px solid #2A2A30',
            }
        },
            React.createElement("div", { style: { display: 'flex', alignItems: 'center', gap: SPACE_SCALE[8], marginBottom: 12 } },
                React.createElement("span", { style: { fontSize: TYPE_SCALE[16] } }, "🩺"),
                React.createElement("div", { style: { fontFamily: "'Fraunces', Georgia, serif", fontSize: TYPE_SCALE[16], fontWeight: 600 } }, "Story Health")),
            loading
                ? React.createElement("div", { style: { fontSize: TYPE_SCALE[14.5], color: '#7A7A82' } }, "Checking\u2026")
                : React.createElement(HealthScoreSummary, { score: featuredHealth.score, totalIssues: featuredHealth.issueCount, tapHint: featuredHealth.issueCount === 0 ? 'Tap to open.' : 'Tap to review.' }));
    }
    // Remaining projects, shown as a shelf of generated book covers below the featured card.
    // Rendered as a real horizontal shelf, not a wrapping grid: fixed-width, non-stretching
    // rows in a scrollable flex row. That's what makes a shelf of 2 books sit compactly with
    // natural breathing room instead of stretching to fill the row the way a grid would.
    // Each book is wrapped in .shelf-item-cover, which carries its own soft contact shadow
    // (a ::after ellipse) so it reads as resting on the wood rather than floating above it.
    const projectRows = rest.map((p) => {
        const deleteBtn = React.createElement("button", {
            className: "proj-delete", onClick: (e) => {
                e.stopPropagation();
                const label = p.title && p.title.trim() ? `"${p.title.trim()}"` : 'this project';
                const words = p.wordCount ? ` (${p.wordCount.toLocaleString()} words)` : '';
                setConfirmState({ message: `Delete ${label}${words}? This cannot be undone — everything in it will be permanently lost.`, onConfirm: () => onDelete(p.id) });
            }, style: {
                position: 'absolute', top: 6, right: 6, background: 'rgba(23,23,27,0.82)', border: 'none',
                color: '#EFE7D2', cursor: 'pointer', display: 'flex', borderRadius: RADIUS_SCALE[6],
                padding: 6, opacity: 0, transition: 'opacity 0.15s', zIndex: 2,
            }
        }, React.createElement(IconTrash, null));
        // Subtle, deterministic per-book size variation — every book is a slightly different
        // width/height (independently, so some read as taller-and-narrower or shorter-and-wider,
        // not just uniformly bigger/smaller) rather than identical stamped-out covers. Scaled
        // from the bottom edge so every book still sits flush on the shelf regardless of its
        // height, keeping the row looking organized rather than jagged.
        const seed = hashSeed(p.id);
        const scaleW = 0.94 + ((seed % 13) / 12) * 0.12; // ~0.94–1.06
        const scaleH = 0.95 + (((seed >> 4) % 11) / 10) * 0.12; // ~0.95–1.07, independent of width
        const scaledCover = React.createElement("div", { style: { transform: `scale(${scaleW}, ${scaleH})`, transformOrigin: 'center bottom' } },
            React.createElement(BookCover, { title: p.title, subtitle: p.subtitle, seriesName: p.seriesName, author: p.author, cover: p.cover, size: 'sm' }));
        const rankBadge = (p.completed && writerRank) ? React.createElement("div", { title: writerRank.name, style: {
                position: 'absolute', top: 6, left: 6, width: 20, height: 20, borderRadius: '50%', zIndex: 2,
                background: `radial-gradient(circle at 34% 28%, ${writerRank.color}66, #17140F 72%)`,
                border: `1.5px solid ${writerRank.color}`, boxShadow: '0 0 0 2px #100E0A',
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: TYPE_SCALE[10],
            } }, writerRank.icon) : null;
        const coverWrap = React.createElement("div", { className: "shelf-item-cover", style: { borderRadius: RADIUS_SCALE[5] } },
            scaledCover,
            deleteBtn,
            rankBadge);
        const rowWords = React.createElement("div", { className: "shelf-label", style: { width: 94 } }, (p.wordCount || 0).toLocaleString(), " words");
        return React.createElement("div", {
            key: p.id, onClick: () => onOpen(p.id), className: "proj-row shelf-item", style: {
                cursor: 'pointer', position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center',
                flexShrink: 0, scrollSnapAlign: 'start',
            }
        }, coverWrap, rowWords);
    });
    // Closing "book" at the end of the shelf, in place of trailing empty space: same footprint
    // as a real cover (94×141) so it sits naturally in the row, but a fixed size and a dashed
    // gold-tinted outline (echoing the "+ New Project" CTA below) rather than a generated cover,
    // so it reads clearly as an action slot and not one more novel. Shares .proj-row/.shelf-item-cover
    // so it gets the same resting lower/hover-lift and contact shadow as every other book.
    const newProjectTile = React.createElement("div", {
        key: "__new_project__", onClick: onCreate, className: "proj-row shelf-item", style: {
            cursor: 'pointer', position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center',
            flexShrink: 0, scrollSnapAlign: 'start',
        }
    }, React.createElement("div", { className: "shelf-item-cover", style: { borderRadius: RADIUS_SCALE[5] } },
        React.createElement("div", { className: "shelf-add-cover" },
            React.createElement(IconPlus, { width: 17, height: 17 }),
            React.createElement("div", { className: "shelf-add-label" }, "New", React.createElement("br", null), "project"))));
    // The shelf itself: .shelf-ambient is a soft, blurred shadow sitting behind everything, so
    // the shelf reads as mounted a little off the page rather than pasted flat onto it.
    // .shelf-wood is a slim, absolutely-positioned walnut ledge (fixed, so it doesn't scroll
    // with the books — a shelf mounted on the wall, not moving with its books) positioned to
    // sit just under the cover row. .shelf-bookend-left/-right are small turned-wood posts
    // flanking the shelf, purely decorative. .shelf-scroll holds the actual scrolling row of
    // books plus the closing "New project" tile, z-indexed above all of it; captions render
    // below, off the wood entirely. Shown whenever there's at least a featured project, so the
    // shelf — and its closing tile — is always there rather than only appearing once a second
    // project exists.
    const listSection = !featured
        ? React.createElement(React.Fragment, null,
            React.createElement(SectionLabel, null, "\uD83D\uDCDC Begin Your Shelf"),
            React.createElement("div", { className: "shelf-stage" },
                React.createElement("div", { className: "shelf-ambient" }),
                React.createElement("div", { className: "shelf-wood" }),
                React.createElement("div", { className: "shelf-bookend shelf-bookend-left" }),
                React.createElement("div", { className: "shelf-bookend shelf-bookend-right" }),
                React.createElement("div", { className: "shelf-scroll" }, newProjectTile)))
        : React.createElement(React.Fragment, null,
            React.createElement(SectionLabel, null, "\uD83D\uDCDC Recent Activity"),
            React.createElement("div", { className: "shelf-stage" },
                React.createElement("div", { className: "shelf-ambient" }),
                React.createElement("div", { className: "shelf-wood" }),
                React.createElement("div", { className: "shelf-bookend shelf-bookend-left" }),
                React.createElement("div", { className: "shelf-bookend shelf-bookend-right" }),
                React.createElement("div", { className: "shelf-scroll" }, ...projectRows, newProjectTile)));
    const confirmDialog = confirmState && React.createElement(ConfirmDialog, { message: confirmState.message, onCancel: () => setConfirmState(null), onConfirm: () => { confirmState.onConfirm(); setConfirmState(null); } });
    const inboxContent = React.createElement(AuthorInboxScreen, { hasPublished: projects.some((p) => p.completed) });
    const universeContent = React.createElement(LivingUniverseScreen, null);
    const libraryContent = React.createElement(GrandLibraryScreen, {
        projects, writerName: writerProfile && (writerProfile.penName || writerProfile.name),
        writerGuildName: (guildProfile && guildProfile.guildType) ? activeGuildName : null,
        writerProfile, writerRank, writerLevel, writerReputation,
        onOpen, onRead: onReadBook, onSetPublishStatus, onOpenPacks, onSetPackPublishStatus, onPublishBookWithDetails, onPublishPackWithDetails,
        onOpenAuthor, initialMode: libraryInitialMode, inboxUnreadCount, onOpenInbox: () => setActiveTab('inbox'),
    });
    const guildContent = (!guildProfile || !writerProfile)
        ? React.createElement("div", { style: { textAlign: 'center', padding: '64px 12px', fontSize: TYPE_SCALE[12.5], color: '#5C5C64' } }, "Consulting the archives\u2026")
        : (() => {
            const rank = writerRank || WRITER_RANKS[0];
            const currentProjectTitle = featured ? featured.title : null;
            const publishedCount = projects.filter((p) => p.completed).length;
            const completedQuestDefs = GUILD_QUEST_DEFS.filter((def) => def.statKey && (lifetimeStats[def.statKey] || 0) >= def.target);
            const questsCompleted = completedQuestDefs.length;
            const guildReputation = computeGuildReputation({ publishedCount, questsCompleted, firesidePostCount });
            const guildRank = guildRankForReputation(guildReputation);
            const guildProgress = computeGuildProgress({
                publishedCount, questDefs: completedQuestDefs,
                writingDayCount: lifetimeStats.writingDayCount, firesidePostCount,
            });
            // Guild of one: every Guild XP source is the writer's own activity, so "your
            // contribution" is the guild's whole tracked total today — see GuildContributionPanel's
            // comment for why that's an honest reflection of Inkroot's current single-member reality
            // rather than a shortcut. The weekly figure deliberately only covers the one Guild XP
            // source with day-level granularity (daily writing activity), at the same 15 XP/day rate
            // computeGuildXP already uses, rather than guessing at a weekly slice of manuscripts or
            // quests that were never stamped with a completion date.
            const yourGuildXP = guildProgress.totalXP;
            const weeklyGuildXP = (lifetimeStats.weeklyWritingDayCount || 0) * 15;
            const hasPlayerGuild = !!(playerGuild && playerGuild.name);
            if (!guildProfile.guildType) {
                const cooldownMs = guildCooldownRemainingMs(guildProfile);
                const everJoinedBefore = !!(guildProfile.founderGuildId || guildProfile.playerGuild || guildProfile.leftAt);
                const mode = cooldownMs > 0 ? 'cooldown' : (everJoinedBefore ? 'return' : 'first');
                return React.createElement(GuildWelcomeScreen, {
                    mode, cooldownLabel: cooldownMs > 0 ? formatCooldownRemaining(cooldownMs) : '',
                    hasPlayerGuild, playerGuildName: playerGuild && playerGuild.name, onJoin: onJoinFounderGuild, onEnterOwnGuild,
                    onJoinByCode: onJoinGuildByCode, joinCodeError,
                });
            }
            const isFounderView = guildProfile.guildType === 'founder';
            const isJoinedView = guildProfile.guildType === 'joined';
            const founderGuild = isFounderView ? founderGuildById(guildProfile.founderGuildId) : null;
            const activeGuild = isFounderView
                ? { name: (founderGuild && founderGuild.name) || 'Founder Guild', crest: null, motto: (founderGuild && founderGuild.motto) || '', createdDate: guildProfile.founderJoinedDate }
                : isJoinedView
                    ? (joinedGuild ? { name: joinedGuild.name, crest: joinedGuild.crest, motto: joinedGuild.motto, createdDate: joinedGuild.joinedDate } : { name: '', crest: null, motto: '', createdDate: new Date().toISOString() })
                    : (playerGuild || { name: '', crest: null, motto: '', createdDate: new Date().toISOString() });
            const activeGuildRemoteId = isJoinedView ? (joinedGuild && joinedGuild.id) : (playerGuild && playerGuild.id);
            const memberSinceLabel = (() => {
                try {
                    return new Date(activeGuild.createdDate).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
                }
                catch (e) {
                    return '';
                }
            })();
            return React.createElement("div", { style: { textAlign: 'center' } },
                React.createElement("div", { style: { textAlign: 'center', marginBottom: 8 } },
                    React.createElement("div", { style: { fontSize: TYPE_SCALE[22], color: '#C89B3C', opacity: 0.85, marginBottom: 6 } }, "\u2766"),
                    React.createElement("div", { style: { fontFamily: "'Fraunces', Georgia, serif", fontSize: TYPE_SCALE[28], fontStyle: 'italic', fontWeight: 600, color: '#EFE7D2' } }, "The Guild Hall"),
                    React.createElement("div", { style: { fontSize: TYPE_SCALE[12.5], color: '#7A7A82', marginTop: 6, marginBottom: 30 } }, "A fortress raised for writers, not a feed to scroll")),
                React.createElement(GuildHallEnvironment, { level: guildProgress.level }),
                guildProgress.level >= 25 && React.createElement(GuildHallDecorFlourish, null),
                React.createElement(GuildBanner, {
                    guild: activeGuild, fileInputRef: crestFileInputRef, handleCrestFile, crestError,
                    onSaveGuild: onSaveOwnGuild, onLeave: onLeaveGuild, onInvite: handleInviteGuild, inviteStatus,
                    reputation: guildReputation, isFounder: isFounderView, isJoinedMember: isJoinedView, founderIcon: founderGuild && founderGuild.icon,
                    guildLevel: guildProgress.level,
                }),
                activeGuildRemoteId && React.createElement(PlayerGuildRoster, { guildId: activeGuildRemoteId }),
                React.createElement(GuildLevelPanel, { progress: guildProgress }),
                React.createElement("div", { onClick: () => changeHomeTab('guildorder'), style: {
                        marginTop: 22, marginBottom: 8, cursor: 'pointer', textAlign: 'center',
                        background: 'linear-gradient(160deg, #211D14 0%, #1A171F 100%)',
                        border: '1px solid rgba(232,196,104,0.35)', borderRadius: RADIUS_SCALE[16], padding: '26px 20px',
                        boxShadow: '0 0 24px 1px rgba(232,196,104,0.12)',
                    } },
                    React.createElement("div", { style: { fontSize: TYPE_SCALE[22], marginBottom: 8 } }, "\u2766"),
                    React.createElement("div", { style: { fontFamily: "'Fraunces', Georgia, serif", fontSize: TYPE_SCALE[17], fontStyle: 'italic', fontWeight: 600, color: '#EFE7D2' } }, "The Guild Order"),
                    React.createElement("div", { style: { fontSize: TYPE_SCALE[12], color: '#8A8680', marginTop: 6, lineHeight: 1.55 } }, "Roles, a shared manuscript, a shared World Bible, the anthology, workshops, the Council, and more \u2192")),
                guildProgress.level >= 20 && React.createElement(GuildTrophyDisplay, {
                    guildRank, guildLevel: guildProgress.level, questsCompleted, totalQuests: GUILD_QUEST_DEFS.length,
                }),
                isFounderView && React.createElement(GuildBenefitsPanel, null),
                React.createElement(NoticeBoard, { guild: activeGuild }),
                React.createElement(MembersHall, {
                    profile: writerProfile, rank, guild: activeGuild,
                    reputation: guildReputation, currentProject: currentProjectTitle,
                    publishedCount, memberSinceLabel, onOpen: onOpenProfile, isFounder: isFounderView,
                }),
                React.createElement(GuildContributionPanel, {
                    profile: writerProfile, rank, totalXP: guildProgress.totalXP, yourXP: yourGuildXP, weeklyXP: weeklyGuildXP,
                }),
                React.createElement("div", { style: { marginTop: 34 } }, React.createElement(GuildQuestBoard, { lifetimeStats })),
                React.createElement("div", { style: { marginTop: 34, marginBottom: 8 } },
                    React.createElement(ArchiveSectionHeading, { icon: "\uD83D\uDD25", label: "The Fireside" }),
                    React.createElement("div", { style: { marginTop: 16 } }, React.createElement(FiresideBoard, { profile: writerProfile, guildId: isFounderView ? guildProfile.founderGuildId : null }))),
                React.createElement(GuildBookshelf, {
                    projects, writerName: writerProfile && (writerProfile.penName || writerProfile.name),
                    guildName: activeGuildName, feedback: guildFeedback, onAddFeedback: handleAddGuildFeedback, onSetPublishStatus, onOpen: onReadBook,
                    onOpenAuthor, guildId: isFounderView ? guildProfile.founderGuildId : null,
                }),
                React.createElement("div", { onClick: () => changeHomeTab('library'), style: {
                        marginTop: 34, cursor: 'pointer', textAlign: 'center', background: 'linear-gradient(160deg, #211C13, #17130E)',
                        border: '1px solid #3A3020', borderRadius: RADIUS_SCALE[14], padding: '20px 18px',
                    } },
                    React.createElement("div", { style: { fontSize: TYPE_SCALE[19], marginBottom: 6 } }, React.createElement(InkIcon, { name: "library", size: 20, style: { display: "inline-block" } })),
                    React.createElement("div", { style: { fontFamily: "'Fraunces', Georgia, serif", fontSize: TYPE_SCALE[15], fontWeight: 600, color: '#EFE7D2' } }, "The Grand Library"),
                    React.createElement("div", { style: { fontSize: TYPE_SCALE[12], color: '#7A7A82', marginTop: 4 } }, "Publish books, browse the guild's shelves, and manage your marketplace listings \u2192")),
                React.createElement(GuildReputationPanel, { reputation: guildReputation, rank: guildRank }));
        })();
    const guildOrderContent = (!guildProfile || !writerProfile || !guildProfile.guildType)
        ? React.createElement("div", { style: { textAlign: 'center', padding: '64px 12px', fontSize: TYPE_SCALE[12.5], color: '#5C5C64' } }, "Join a guild first to enter the Guild Order.")
        : (() => {
            const rank = writerRank || WRITER_RANKS[0];
            const publishedCount = projects.filter((p) => p.completed).length;
            const completedQuestDefs = GUILD_QUEST_DEFS.filter((def) => def.statKey && (lifetimeStats[def.statKey] || 0) >= def.target);
            const questsCompleted = completedQuestDefs.length;
            const guildReputation = computeGuildReputation({ publishedCount, questsCompleted, firesidePostCount });
            const guildRank = guildRankForReputation(guildReputation);
            const guildProgress = computeGuildProgress({
                publishedCount, questDefs: completedQuestDefs,
                writingDayCount: lifetimeStats.writingDayCount, firesidePostCount,
            });
            const isFounderView = guildProfile.guildType === 'founder';
            const founderGuild = isFounderView ? founderGuildById(guildProfile.founderGuildId) : null;
            const activeGuild = isFounderView
                ? { name: (founderGuild && founderGuild.name) || 'Founder Guild', icon: (founderGuild && founderGuild.icon) || "\uD83C\uDFF0", motto: (founderGuild && founderGuild.motto) || '' }
                : { name: (playerGuild && playerGuild.name) || 'Your Guild', icon: "\uD83C\uDFF0", motto: (playerGuild && playerGuild.motto) || '' };
            const guildKey = isFounderView ? (guildProfile.founderGuildId || 'founder') : ('own:' + (activeGuild.name || 'guild'));
            return React.createElement(GuildOrderScreen, {
                guild: activeGuild, guildKey, isFounderView, guildProgress, guildRank,
                writerProfile, writerRank: rank, projects, lifetimeStats,
            });
        })();
    // The reputation earned here (published books, completed guild quests, Fireside posts) also
    // shows up on the Writer Profile — it's the same number, just surfaced in two places.
    useEffect(() => {
        if (!writerProfile || !onReputationChange)
            return;
        const publishedCount = projects.filter((p) => p.completed).length;
        const questsCompleted = GUILD_QUEST_DEFS.filter((def) => def.statKey && (lifetimeStats[def.statKey] || 0) >= def.target).length;
        onReputationChange(computeGuildReputation({ publishedCount, questsCompleted, firesidePostCount }));
    }, [writerProfile, projects, lifetimeStats, firesidePostCount]);
    return (React.createElement(React.Fragment, null,
        React.createElement("div", { style: { minHeight: '100vh', background: '#17171B', color: '#EFE7D2', fontFamily: "ui-sans-serif, -apple-system, 'Segoe UI', Roboto, sans-serif", display: 'flex', flexDirection: 'column', alignItems: 'center' } },
            React.createElement("style", null, `
        * { box-sizing: border-box; }
        .proj-row > div:first-child { transition: transform var(--ink-dur) var(--ink-ease), box-shadow var(--ink-dur) var(--ink-ease); transform: translateY(6px); }
        .proj-row:hover > div:first-child { transform: translateY(-2px); box-shadow: 0 10px 22px rgba(0,0,0,0.45); }
        .proj-row:hover .proj-delete { opacity: 1 !important; }

        /* ---------- Bookshelf: dark walnut plank ----------
           .shelf-stage holds a slim .shelf-wood ledge (bottom-anchored, does not scroll) behind
           a scrolling row of books, so the wood reads as one continuous shelf the books glide
           along rather than moving with them. It's deliberately thin and quiet — a ledge the
           books rest on, not a slab competing with them for attention. Grain is just two wide,
           very-low-opacity linear bands rather than a repeating photographic texture, so it
           stays refined rather than reading as cartoon wood.
           Position math (kept in one place so it's easy to re-tune): shelf-scroll has 16px
           padding-top, and 'sm' covers are 94×141 — so a cover's laid-out bottom edge is 157px
           down. Covers are then visually lowered 6px onto the shelf (.proj-row > div:first-child
           transform) so their bottom edge sits right at/into the plank's top rather than
           floating just above it. The plank's top (155px) is positioned against that same
           157px line; captions start 22px below the cover's laid-out bottom so they clear the
           plank's bottom edge (175px) regardless of the visual lowering. */
        .shelf-stage { position: relative; margin: 4px -24px 20px -24px; }
        /* Faint ambient shadow behind the whole assembly — a soft, blurred dark glow, not a
           hard shape — so the shelf feels lifted slightly off the page rather than flat. */
        .shelf-ambient {
          position: absolute; left: 8px; right: 8px; top: 18px; height: 150px; z-index: 0;
          pointer-events: none; filter: blur(20px);
          background: radial-gradient(ellipse at center, rgba(0,0,0,0.4) 0%, rgba(0,0,0,0) 68%);
        }
        .shelf-wood {
          position: absolute; left: 24px; right: 24px; top: 155px; height: 20px; border-radius: 3px;
          z-index: 1;
          background:
            linear-gradient(120deg, rgba(255,255,255,0.035) 0%, rgba(255,255,255,0) 35%),
            linear-gradient(90deg, rgba(0,0,0,0.10) 0%, rgba(0,0,0,0) 16%, rgba(0,0,0,0) 84%, rgba(0,0,0,0.10) 100%),
            linear-gradient(180deg, #4A3220 0%, #35210F 50%, #281709 100%);
          box-shadow:
            0 5px 10px -3px rgba(0,0,0,0.42),
            inset 0 1px 0 rgba(212,177,116,0.3),
            inset 0 1px 2px rgba(255,255,255,0.04),
            inset 0 -5px 7px -5px rgba(0,0,0,0.55);
        }
        /* Carved wooden bookends — small turned posts flanking the shelf. A rounded cap
           (::before) stands in for a lathe-turned finial, and a thin inlay ring (::after)
           gives one restrained carved detail, echoing the app's medieval touches elsewhere
           without becoming decorative clutter. */
        .shelf-bookend {
          position: absolute; top: 8px; width: 14px; height: 168px; border-radius: 6px 6px 3px 3px;
          z-index: 1; pointer-events: none;
          background:
            linear-gradient(100deg, rgba(255,255,255,0.07) 0%, rgba(255,255,255,0) 26%),
            linear-gradient(180deg, #4E3624 0%, #382312 55%, #241408 100%);
          box-shadow:
            0 6px 12px rgba(0,0,0,0.4),
            inset 0 1px 0 rgba(212,177,116,0.28),
            inset -2px 0 4px rgba(0,0,0,0.35),
            inset 2px 0 3px rgba(255,255,255,0.04);
        }
        .shelf-bookend::before {
          content: ''; position: absolute; top: -5px; left: 50%; transform: translateX(-50%);
          width: 21px; height: 9px; border-radius: 5px;
          background: linear-gradient(180deg, #5C4230 0%, #3C2814 100%);
          box-shadow: 0 1px 2px rgba(0,0,0,0.4), inset 0 1px 0 rgba(216,181,120,0.35);
        }
        .shelf-bookend::after {
          content: ''; position: absolute; left: 2px; right: 2px; top: 30px; height: 1.5px;
          border-radius: 1px; background: rgba(212,177,116,0.28);
        }
        .shelf-bookend-left { left: 8px; }
        .shelf-bookend-right { right: 8px; }
        .shelf-scroll {
          position: relative; z-index: 2; display: flex; align-items: flex-start; gap: 20px;
          overflow-x: auto; overflow-y: hidden; scroll-snap-type: x proximity;
          -webkit-overflow-scrolling: touch; scrollbar-width: none;
          padding: 16px 24px 6px 24px;
        }
        .shelf-scroll::-webkit-scrollbar { display: none; }
        .shelf-item-cover { position: relative; }
        .shelf-item-cover::after {
          content: ''; position: absolute; left: 50%; bottom: -7px; transform: translateX(-50%);
          width: 74%; height: 10px; pointer-events: none; filter: blur(1px);
          background: radial-gradient(ellipse at center, rgba(0,0,0,0.48) 0%, rgba(0,0,0,0) 72%);
        }
        .shelf-label {
          font-family: ui-monospace, 'SF Mono', Menlo, monospace; font-size: 10.5; letter-spacing: 0.02em;
          color: #7A7A82; text-align: center; margin-top: 22px; opacity: 0.9;
        }
        /* Closing "New project" tile — same footprint as a book (94×141) so it sits naturally
           at the end of the row, but dashed and gold-tinted so it's unmistakably an action, not
           another spine. */
        .shelf-add-cover {
          width: 94px; height: 141px; box-sizing: border-box; border-radius: 5px;
          display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 6px;
          border: 1px dashed rgba(200,155,60,0.4); color: #C89B3C;
          background: linear-gradient(180deg, rgba(200,155,60,0.05) 0%, rgba(200,155,60,0.015) 100%);
          transition: border-color var(--ink-dur) var(--ink-ease), background var(--ink-dur) var(--ink-ease);
        }
        .proj-row:hover .shelf-add-cover { border-color: rgba(200,155,60,0.7); background: rgba(200,155,60,0.09); }
        .shelf-add-label {
          font-family: 'Fraunces', Georgia, serif; font-size: 11.5; font-weight: 600; line-height: 1.3;
          text-align: center; letter-spacing: 0.01em;
        }

        .ghost-btn:hover { background: #1F1F24 !important; }
        .continue-card:hover { border-color: #3A3A42 !important; }
        .health-card:hover { border-color: #3A3A42 !important; }
        /* Guild nav tab, while locked: a gold glow that pulses every few seconds, gradually
           intensifying as the writer nears level 10 via the --guild-glow-* custom properties set
           inline per-level (see HomeNav). */
        @keyframes inkGuildLockPulse {
            0%, 100% { box-shadow: 0 0 0 0 rgba(200,155,60,0); }
            50% { box-shadow: 0 0 var(--guild-glow-blur, 16px) var(--guild-glow-spread, 2px) rgba(200,155,60, var(--guild-glow-opacity, 0.32)); }
        }
        .ink-guild-lock-pulse { animation: inkGuildLockPulse var(--guild-glow-duration, 3.2s) ease-in-out infinite; }
        /* A faint magical shimmer sweeping across the Guild tab, added only at level 9 — a quiet
           sign that something is close to breaking open. */
        @keyframes inkGuildShimmerSweep {
            0% { transform: translateX(-120%) skewX(-12deg); opacity: 0; }
            10% { opacity: 0.5; }
            35% { opacity: 0.5; }
            55% { transform: translateX(160%) skewX(-12deg); opacity: 0; }
            100% { transform: translateX(160%) skewX(-12deg); opacity: 0; }
        }
        .ink-guild-shimmer-sweep {
            position: absolute; top: 0; left: 0; width: 45%; height: 100%; pointer-events: none;
            background: linear-gradient(100deg, transparent, rgba(255,240,200,0.4), transparent);
            animation: inkGuildShimmerSweep 4.6s ease-in-out infinite;
        }
        /* The unlock ceremony: the lock cracks and scales away while its particles fly outward,
           the tab's glow flares once, and the "unlocked" banner fades in and back out. */
        @keyframes inkGuildLockCrack {
            0% { transform: scale(1) rotate(0deg); opacity: 1; }
            35% { transform: scale(1.2) rotate(-10deg); opacity: 1; }
            100% { transform: scale(0.2) rotate(16deg); opacity: 0; }
        }
        .ink-guild-lock-crack { animation: inkGuildLockCrack 0.5s ease-in forwards; }
        @keyframes inkGuildShatterFly {
            0% { transform: translate(-50%, -50%) scale(1); opacity: 1; }
            100% { transform: translate(calc(-50% + var(--tx)), calc(-50% + var(--ty))) scale(0.2); opacity: 0; }
        }
        .ink-guild-shatter-particle {
            position: absolute; top: 50%; left: 50%; width: 4px; height: 4px; border-radius: 50%;
            background: radial-gradient(circle, #F5DFA0, #C89B3C 70%, transparent);
            transform: translate(-50%, -50%);
            animation: inkGuildShatterFly 0.8s ease-out forwards;
        }
        @keyframes inkGuildUnlockBurst {
            0% { box-shadow: 0 0 0 0 rgba(232,196,104,0); }
            30% { box-shadow: 0 0 36px 10px rgba(232,196,104,0.55); }
            100% { box-shadow: 0 0 0 0 rgba(232,196,104,0); }
        }
        .ink-guild-unlock-burst { animation: inkGuildUnlockBurst 1.5s ease-out; }
        @keyframes inkGuildUnlockBannerFade {
            0% { opacity: 0; transform: translateY(-3px); }
            15% { opacity: 1; transform: translateY(0); }
            75% { opacity: 1; transform: translateY(0); }
            100% { opacity: 0; transform: translateY(2px); }
        }
        .ink-guild-unlock-banner { animation: inkGuildUnlockBannerFade 2.6s ease; }
        /* The Guild Notice Board: a thick wooden frame with a subtle grain, holding parchment
           notices pinned at gentle, alternating angles (each card's own inline rotation). */
        .notice-board {
            position: relative; border-radius: 16px; padding: 26px 22px;
            background:
                repeating-linear-gradient(90deg, rgba(0,0,0,0.12) 0px, transparent 2px, transparent 7px),
                linear-gradient(180deg, #4A3220 0%, #35210F 55%, #281709 100%);
            border: 6px solid #241408;
            box-shadow: inset 0 2px 3px rgba(255,255,255,0.05), inset 0 -8px 14px rgba(0,0,0,0.5), 0 12px 26px rgba(0,0,0,0.4);
        }
        .notice-card {
            position: relative;
            background: linear-gradient(160deg, #EFE3C4 0%, #E1CE9F 55%, #CBB07E 100%);
            border-radius: 3px; padding: 20px 14px 14px; text-align: left;
            box-shadow: 0 8px 16px rgba(0,0,0,0.4), inset 0 0 0 1px rgba(59,42,24,0.15);
        }
        .notice-pin {
            position: absolute; top: -7px; left: 50%; transform: translateX(-50%); width: 13px; height: 13px; border-radius: 50%;
            background: radial-gradient(circle at 35% 30%, #F0D48A, #8A6B25 75%); border: 1.5px solid #100E0A;
            box-shadow: 0 2px 4px rgba(0,0,0,0.5);
        }
        .member-card:hover { border-color: #4A3D22 !important; }
        /* The Fireside: a small glowing hearth above a discussion space, with a flickering
           three-flame fire (each flame on its own slightly offset cycle so it never looks static)
           and a plain wooden bench-plank as a quiet floor beneath the messages. */
        .fireside-hall {
            position: relative; border-radius: 16px; overflow: hidden; padding-bottom: 14px;
            background: radial-gradient(ellipse at 50% 0%, rgba(232,140,60,0.16), transparent 60%), linear-gradient(180deg, #1C140D 0%, #17130E 100%);
            border: 1px solid #3A2A18;
        }
        .fireside-fire {
            position: relative; height: 84px; width: 132px; margin: 18px auto 0;
            background: radial-gradient(ellipse at 50% 100%, #2A1810 0%, #17110A 70%);
            border-radius: 50% 50% 8px 8px / 60% 60% 8px 8px;
            border: 3px solid #2E2014;
            box-shadow: 0 0 40px rgba(232,140,60,0.32), inset 0 0 20px rgba(0,0,0,0.6);
            overflow: hidden;
        }
        .fireside-flame {
            position: absolute; bottom: 4px; left: 50%; border-radius: 50% 50% 50% 50% / 60% 60% 40% 40%;
            background: linear-gradient(0deg, #FF7A1A 0%, #FFC24D 55%, #FFE9A8 100%);
            opacity: 0.9; transform-origin: bottom center;
        }
        .fireside-flame.f1 { width: 24px; height: 42px; margin-left: -28px; animation: inkFireFlicker1 2.6s ease-in-out infinite; }
        .fireside-flame.f2 { width: 18px; height: 34px; margin-left: -2px; animation: inkFireFlicker2 2.1s ease-in-out infinite; background: linear-gradient(0deg, #FF5A1A 0%, #FFB23D 60%, #FFE9A8 100%); }
        .fireside-flame.f3 { width: 20px; height: 38px; margin-left: 16px; animation: inkFireFlicker3 2.4s ease-in-out infinite; }
        @keyframes inkFireFlicker1 { 0%, 100% { transform: scaleY(1) skewX(-2deg); opacity: 0.85; } 50% { transform: scaleY(1.15) skewX(3deg); opacity: 1; } }
        @keyframes inkFireFlicker2 { 0%, 100% { transform: scaleY(1) skewX(2deg); opacity: 0.8; } 50% { transform: scaleY(0.85) skewX(-3deg); opacity: 1; } }
        @keyframes inkFireFlicker3 { 0%, 100% { transform: scaleY(1.05) skewX(-1deg); opacity: 0.9; } 50% { transform: scaleY(0.9) skewX(4deg); opacity: 1; } }
        .fireside-bench {
            height: 14px; margin: 14px 18px 0;
            background: repeating-linear-gradient(90deg, #4A3220 0px, #5A3E26 4px, #4A3220 8px);
            border-radius: 3px; box-shadow: inset 0 2px 3px rgba(255,255,255,0.06), inset 0 -3px 4px rgba(0,0,0,0.5);
        }
        /* Guild Level Up overlay: the whole thing fades in, holds, then fades out as one piece —
           timed to GUILD_LEVEL_UP_DURATION_MS (5400ms, extended to fit the construction sequence
           below before the reveal) so nothing needs its own separate exit animation beyond that
           single JS timeout. */
        @keyframes inkGuildLevelUpOverlay { 0% { opacity: 0; } 6% { opacity: 1; } 92% { opacity: 1; } 100% { opacity: 0; } }
        .guildlevelup-overlay { animation: inkGuildLevelUpOverlay ${GUILD_LEVEL_UP_DURATION_MS}ms ease-in-out both; }
        /* ---- Construction sequence (0 - ~1.7s): scaffolding rises, workers hammer, stone blocks
           drop into place, dust kicks up (reuses the Guild Hall's own gh-dust), and a ring of
           golden light spreads outward — then the whole group fades before the crest reveal. ---- */
        @keyframes inkConstructionFade { 0%, 62% { opacity: 1; } 100% { opacity: 0; } }
        .guildlevelup-construction { animation: inkConstructionFade 1.7s ease-in-out both; }
        @keyframes inkScaffoldFade { 0% { opacity: 0; } 18% { opacity: 1; } 80% { opacity: 1; } 100% { opacity: 0; } }
        .guildlevelup-scaffold { animation: inkScaffoldFade 1.6s ease-in-out both; }
        @keyframes inkWorkerHammer {
          0% { opacity: 1; transform: translateY(0) rotate(0deg); } 20% { transform: translateY(-4px) rotate(-10deg); }
          40% { transform: translateY(0) rotate(6deg); } 60% { transform: translateY(-3px) rotate(-8deg); }
          80% { opacity: 1; transform: translateY(0) rotate(0deg); } 100% { opacity: 0; transform: translateY(0) rotate(0deg); }
        }
        .guildlevelup-worker { animation: inkWorkerHammer 1.4s ease-in-out both; }
        @keyframes inkBlockDrop { 0% { opacity: 0; transform: translateY(-26px); } 65% { opacity: 1; transform: translateY(2px); } 100% { opacity: 1; transform: translateY(0); } }
        .guildlevelup-block { animation: inkBlockDrop 500ms cubic-bezier(0.16, 1, 0.3, 1) both; }
        @keyframes inkGoldSpread { 0% { transform: translateX(-50%) scale(0.3); opacity: 0; } 35% { opacity: 0.9; } 100% { transform: translateX(-50%) scale(4.2); opacity: 0; } }
        .guildlevelup-goldspread { animation: inkGoldSpread 1.3s ease-out 600ms both; }
        /* ---- Reveal (from ~1.5s): the crest, title, and the rest of the ceremony, retimed to
           begin only once the construction sequence above has finished. ---- */
        @keyframes inkGuildLightBurst { 0% { transform: scale(0.3); opacity: 0; } 50% { opacity: 1; } 100% { transform: scale(1.15); opacity: 0.5; } }
        .guildlevelup-burst { animation: inkGuildLightBurst 900ms cubic-bezier(0.16, 1, 0.3, 1) 1550ms both; }
        /* The Guild Banner's crest settles in, then glows on a slow steady pulse for the rest of
           the ceremony — the "Guild Banner glows" beat. */
        @keyframes inkGuildCrestIn { from { transform: scale(0.6); opacity: 0; } to { transform: scale(1); opacity: 1; } }
        @keyframes inkGuildCrestGlow { 0%, 100% { filter: drop-shadow(0 0 8px rgba(232,196,104,0.45)); } 50% { filter: drop-shadow(0 0 26px rgba(232,196,104,0.9)); } }
        .guildlevelup-crest { animation: inkGuildCrestIn 650ms cubic-bezier(0.16, 1, 0.3, 1) 1550ms both, inkGuildCrestGlow 1.3s ease-in-out 2200ms infinite; }
        /* "The Guild has grown", title, level line, XP bar, newly-built structures, and unlocked
           rewards each fade up in their own beat rather than appearing all at once. */
        @keyframes inkGuildTextIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        .guildlevelup-title { animation: inkGuildTextIn 450ms var(--ink-ease) 1850ms both; }
        .guildlevelup-grown { animation: inkGuildTextIn 450ms var(--ink-ease) 2100ms both; }
        .guildlevelup-levelline { animation: inkGuildTextIn 450ms var(--ink-ease) 2350ms both; }
        .guildlevelup-bar-wrap { animation: inkGuildTextIn 450ms var(--ink-ease) 2600ms both; }
        .guildlevelup-structures { animation: inkGuildTextIn 450ms var(--ink-ease) 2950ms both; }
        .guildlevelup-rewards { animation: inkGuildTextIn 450ms var(--ink-ease) 3300ms both; }
      `),
            React.createElement(HomeNav, { activeTab, onSelect: changeHomeTab, writerLevel: writerLevel == null ? 1 : writerLevel, inboxUnreadCount, hasProjects: projects.length > 0 }),
            React.createElement("div", { className: "ink-page-container", style: { padding: activeTab !== 'home' ? '10px 24px 0' : '0' } },
                activeTab !== 'home' && React.createElement(Breadcrumbs, { style: { justifyContent: 'center', marginBottom: 0 } })),
            React.createElement("div", { className: "ink-page-container", style: { padding: '32px 24px 64px' } },
                activeTab !== 'home' && React.createElement("div", { style: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' } },
                    React.createElement("div", null,
                        React.createElement("div", { style: { fontFamily: "'Fraunces', Georgia, serif", fontSize: TYPE_SCALE[30], fontWeight: 600 } }, "Inkroot"),
                        React.createElement("div", { style: { fontSize: TYPE_SCALE[13.5], color: '#7A7A82', marginTop: 4 } }, "a home for the whole story")),
                    React.createElement("button", { onClick: onOpenProfile, title: "Writer Profile", style: {
                            width: 44, height: 44, borderRadius: '50%', flexShrink: 0, cursor: 'pointer', padding: 0,
                            background: writerProfile && writerProfile.avatar ? `center/cover url(${writerProfile.avatar})` : 'radial-gradient(circle at 34% 28%, #2A2620, #17140F 72%)',
                            border: '2px solid #C89B3C', boxShadow: '0 0 0 2px #100E0A, 0 0 14px rgba(200,155,60,0.25)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: TYPE_SCALE[17],
                        } }, !(writerProfile && writerProfile.avatar) && "\uD83E\uDDD1\u200D\uD83C\uDF93")),
                activeTab !== 'home' && React.createElement("div", { style: { marginBottom: 32 } }),
                activeTab === 'home'
                    ? React.createElement(React.Fragment, null,
                        React.createElement("div", { style: { display: 'flex', justifyContent: 'flex-end', marginBottom: 10 } },
                            React.createElement(AccountSyncControl, null)),
                        React.createElement("div", { className: "ink-parchment-in", style: { marginBottom: 28 } },
                            React.createElement(LibraryHero, { writerName: writerProfile && (writerProfile.penName || writerProfile.name), writerProfile, onOpenProfile, hasProjects: !!featured })),
                        React.createElement("div", { className: "ink-parchment-in", style: { animationDelay: '90ms', marginBottom: 8 } }, listSection),
                        // Featured Book + Story Health pair against Today's Inspiration + Quick Actions +
                        // News in a responsive two-column layout from tablet-landscape/laptop up (see
                        // .ink-grid-2 in app.css) — but only once there's actually a left column to pair
                        // against (a returning writer with a project). A brand-new account with nothing
                        // featured yet has nothing to put there, and reserving an empty column would just
                        // strand Quick Actions in a lopsided right-hand strip with a blank gap beside it;
                        // for that case this renders as one plain stacked column instead, same as mobile.
                        React.createElement("div", { className: (featuredCard || storyHealthCard) ? "ink-grid-2" : "" },
                            (featuredCard || storyHealthCard) && React.createElement("div", null,
                                React.createElement("div", { className: "ink-parchment-in", style: { animationDelay: '150ms' } },
                                    featuredCard,
                                    storyHealthCard && React.createElement("div", { style: { marginTop: featuredCard ? 20 : 0 } }, storyHealthCard))),
                            React.createElement("div", null,
                                React.createElement("div", { className: "ink-parchment-in", style: { animationDelay: '270ms' } },
                                    React.createElement(TodaysInspirationCard, null)),
                                React.createElement("div", { className: "ink-parchment-in", style: { animationDelay: '330ms', marginTop: 20 } },
                                    React.createElement(SectionLabel, null, "\u2699\uFE0F Quick Actions"),
                                    React.createElement("div", { style: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: SPACE_SCALE[10], marginBottom: 8 } },
                                        React.createElement(HomeQuickActionTile, { icon: React.createElement(InkIcon, { name: "plus", size: 19, color: "#C89B3C" }), label: "New Project", onClick: onCreate }),
                                        React.createElement(HomeQuickActionTile, { icon: React.createElement(InkIcon, { name: "download", size: 19, color: "#C89B3C" }), label: "Backup All", onClick: onExportAll }),
                                        React.createElement(HomeQuickActionTile, { icon: React.createElement(InkIcon, { name: "upload", size: 19, color: "#C89B3C" }), label: "Import Backup", onClick: () => fileInputRef.current && fileInputRef.current.click() }),
                                        React.createElement(HomeQuickActionTile, { icon: React.createElement(InkIcon, { name: "broom", size: 19, color: "#C89B3C" }), label: "Free Up Storage", onClick: handleOptimizeAllClick })),
                                    React.createElement("input", { ref: fileInputRef, type: "file", accept: "application/json", onChange: handleFileChosen, style: { display: 'none' } }),
                                    status && React.createElement("div", { style: { fontSize: TYPE_SCALE[12.5], color: '#C89B3C', marginTop: 6 } }, status)),
                                featured && React.createElement("div", { className: "ink-parchment-in", style: { animationDelay: '390ms', marginTop: 20 } },
                                    React.createElement(SectionLabel, null, "\uD83D\uDCF0 Inkroot News"),
                                    React.createElement(InkrootNewsCard, { icon: "\u2696\uFE0F", title: "Community Bookshelves", description: "Real reviews and ratings from other readers across Inkroot, not just your own." }),
                                    React.createElement(InkrootNewsCard, { icon: "\uD83C\uDFC6", title: "Guild Tournaments", description: "Timed writing challenges you take on together with the rest of your Guild." }),
                                    React.createElement(InkrootNewsCard, { icon: "\u2601\uFE0F", title: "Cross-Device Sync", description: "Carry your Author's Hall, Guild, and Library to any device you write from." })))),
                        React.createElement("div", { style: { marginTop: 32, fontSize: TYPE_SCALE[12], color: '#5C5C64', lineHeight: 1.6 } }, "Everything autosaves to this browser as you type \u2014 no button to press. There's no cloud account (that would cost money to run, which goes against the point), so \"Backup All\" is the free equivalent: download it, keep it in Drive, Dropbox, or email \u2014 then \"Import Backup\" restores it on any device's browser."))
                    : activeTab === 'guild'
                        ? guildContent
                        : activeTab === 'inbox'
                            ? inboxContent
                            : activeTab === 'universe'
                                ? universeContent
                                : activeTab === 'guildorder'
                                    ? guildOrderContent
                                    : libraryContent),
            confirmDialog),
        guildLevelUpEvent && React.createElement(GuildLevelUpOverlay, {
            key: "guildlevelup-" + guildLevelUpEvent.level, previousLevel: guildLevelUpEvent.previousLevel, level: guildLevelUpEvent.level,
            xpIntoLevel: guildLevelUpEvent.xpIntoLevel, xpPerLevel: guildLevelUpEvent.xpPerLevel, isMaxLevel: guildLevelUpEvent.isMaxLevel,
            newRewards: guildLevelUpEvent.newRewards, onDone: () => setGuildLevelUpEvent(null),
        })));
}
