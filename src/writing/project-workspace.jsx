import React, { useState, useEffect, useRef, useMemo } from 'react';
import { storage } from '../lib/storage.js';
import { founderGuildById } from '../guild/guild-hall.jsx';
import { AuthorLevelUpOverlay } from '../library/author-level-up-overlay.jsx';
import { AuthorStudioBookCard } from '../library/grand-library-cards.jsx';
import { GrandLibraryScreen } from '../library/grand-library-screen.jsx';
import { PublishingWizard, WorldbuildingPackBuilderModal, resolvePublishStatus } from '../library/publishing.jsx';
import { IconAt, IconGear, IconSearch, IconX } from '../shared-ui/icons.jsx';
import { ConfirmDialog } from '../shared-ui/ui-primitives.jsx';
import { projectKey, uuid } from '../shared-utils/storage-keys.jsx';
import { wordCount } from '../shared-utils/strip-html.jsx';
import { todayKey } from '../shared-utils/truncate.jsx';
import { InkRoot } from '../shell/ink-root.jsx';
import { Breadcrumbs, NavScrollBox, RADIUS_SCALE, SPACE_SCALE, TYPE_SCALE, useNav } from '../shell/nav-context.jsx';
import { NAV_GROUPS, TAB_BREADCRUMB_LABELS } from '../shell/nav-labels.jsx';
import { NATIVE_WORLD_KEYS, matchesWorldBibleSearch, normalizeWorldBibleEntry, packSummaryForIndex, worldBibleEntries } from '../worldbuilding/book-cover.jsx';
import { buildFamilyGraph, chaptersContainingCharacter, familyComponent, locationAncestorIds, locationBreadcrumbChain } from '../worldbuilding/family-graph.jsx';
import { CollapsibleSection, HouseDatabasePage, SectionNav } from '../worldbuilding/family-tree-gallery.jsx';
import { MapsSection } from '../worldbuilding/maps-section.jsx';
import { FamilyTreeModal } from '../worldbuilding/relationship-web.jsx';
import { charactersAtLocation } from '../worldbuilding/world-bible-browse-list.jsx';
import { AchievementUnlockOverlay, AchievementUnlockToast, LEVEL_UP_DURATION_MS, LevelUpMiniToast, LevelUpOverlay, RARITY_UNLOCK_FX, WriterLevelBanner, useDailyLog } from './achievements.jsx';
import { ChapterEditor, GlobalSearchOverlay, ReadingSettingsPanel } from './chapter-editor.jsx';
import { buildHealthIssues, chaptersContainingMentionType, computeAchievements, computeDailyDeltas, computeStreak, computeWeeklyTotal, computeWriterProgress, runHealthChecks, writerLevelFloor } from './health-checks.jsx';
import { emptyProject, extractCoMentionEdges, patchProjectDefaults, setActiveViewProject, storyFormatTerm, useAutosave, useMetaReport, usePersistedViewState } from './project-schema-and-backups.jsx';
import { READING_SETTINGS_KEY, READING_THEMES, loadReadingSettings, loadSoundSettings, saveSoundSettings } from './reading-and-sound-settings.jsx';
import { HubTab } from './project-workspace/tab-hub.jsx';
import { ManuscriptTab } from './project-workspace/tab-manuscript.jsx';
import { CharactersTab } from './project-workspace/tab-characters.jsx';
import { LocationsTab } from './project-workspace/tab-locations.jsx';
import { MapsTab } from './project-workspace/tab-maps.jsx';
import { TimelineTab } from './project-workspace/tab-timeline.jsx';
import { WorldTab } from './project-workspace/tab-world.jsx';
import { GlossaryTab } from './project-workspace/tab-glossary.jsx';
import { NotesTab } from './project-workspace/tab-notes.jsx';
import { PacksTab } from './project-workspace/tab-packs.jsx';
import { HealthTab } from './project-workspace/tab-health.jsx';
import { ProgressTab } from './project-workspace/tab-progress.jsx';
import { AchievementsTab } from './project-workspace/tab-achievements.jsx';
import { SettingsTab } from './project-workspace/tab-settings.jsx';


export function ProjectWorkspace({ projectId, onBack, onMeta, onDeleteProject, initialTab, guildProfile }) {
    // Must happen before any child (CollapsibleSection, MapsSection, etc.) reads persisted view
    // state during its own initial render — projectId only ever changes together with a full
    // remount of this component (the Home screen sits between opening different projects), so
    // setting it directly in the render body, rather than in an effect, is safe here.
    setActiveViewProject(projectId);
    const [project, setProject] = useState(null);
    const [ready, setReady] = useState(false);
    const [tab, setTabRaw] = useState(initialTab || 'hub');
    const nav = useNav();
    // Every existing call site in this file (sidebar links, "jump to character/location", the
    // mobile back chevron, etc.) already calls plain setTab(...) — wrapping the setter itself
    // here, instead of touching every call site, is what makes all of them nav/breadcrumb-aware
    // for free. The Hub is this workspace's "home level": leaving it pushes a breadcrumb, going
    // back to it pops one, and hopping directly between two non-Hub tabs swaps the crumb in place
    // rather than stacking a second level.
    const setTab = (next) => {
        if (next === tab)
            return;
        if (next === 'hub') {
            nav.pop();
            setTabRaw('hub');
            return;
        }
        const label = TAB_BREADCRUMB_LABELS[next] || next;
        if (tab === 'hub') {
            nav.push({ label, undo: () => setTabRaw('hub') });
        }
        else {
            nav.goTo(nav.stack.length - 2);
            nav.push({ label, undo: () => setTabRaw('hub') });
        }
        setTabRaw(next);
    };
    // If the workspace was opened straight into a non-Hub tab (e.g. the Home screen's "Story
    // Health" shortcut, or the Writer Profile's "Achievement Hall" link), the breadcrumb for that
    // tab wasn't pushed yet — InkRoot only pushed the project itself. Add it once on mount so the
    // trail reads Home › Project › Tab from the very first render instead of just Home › Project.
    useEffect(() => {
        if (initialTab && initialTab !== 'hub') {
            nav.push({ label: TAB_BREADCRUMB_LABELS[initialTab] || initialTab, undo: () => setTabRaw('hub') });
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    const [activeChapter, setActiveChapter] = useState(null);
    // Instant word count for the header hint while typing (see ChapterEditor's onWordCountChange)
    // — kept separate from `project` so it isn't tied to the debounced manuscript commit. Reset
    // whenever the active chapter changes so it never shows a stale count from the last chapter.
    const [liveChapterWordCount, setLiveChapterWordCount] = useState(null);
    useEffect(() => { setLiveChapterWordCount(null); }, [activeChapter]);
    const [activeCharacter, setActiveCharacter] = useState(null);
    const [activeLocation, setActiveLocation] = usePersistedViewState('activeLocation', null);
    const [newPoiName, setNewPoiName] = useState('');
    const [distanceToId, setDistanceToId] = useState('');
    const [charView, setCharView] = usePersistedViewState('charView', 'list'); // 'list' | 'web'
    const [pendingHighlight, setPendingHighlight] = useState(null); // { type, id }
    const [packBuilderState, setPackBuilderState] = useState(null); // null | 'new' | a pack id being edited
    // The same Publishing Wizard Author Studio uses (see PublishingWizard) — offered here too,
    // from Settings and from a Worldbuilding Pack's own Publish button, so publishing never
    // requires leaving the project. null | { type: 'book' } | { type: 'pack', packId }.
    const [publishWizard, setPublishWizard] = useState(null);
    const [navOpen, setNavOpen] = useState(false); // mobile drawer
    const [subNavOpen, setSubNavOpen] = useState(false); // mobile: chapters/cast/locations list overlay
    const [readingMode, setReadingMode] = useState(false); // distraction-free reading: editing disabled, side panels hidden
    const [readingSettings, setReadingSettingsState] = useState(() => loadReadingSettings());
    const [readingSettingsOpen, setReadingSettingsOpen] = useState(false); // Reading Settings popover
    // Sound Settings, like Reading Settings above, are a device-level preference (not project
    // data) shared across every project opened in this browser — edited from this project's
    // Settings tab for convenience, but not scoped to it.
    const [soundSettings, setSoundSettingsState] = useState(() => loadSoundSettings());
    const updateSoundSettings = (patch) => {
        setSoundSettingsState((prev) => {
            const next = { ...prev, ...patch };
            saveSoundSettings(next);
            return next;
        });
    };
    // Swipe-between-chapters (Reading Mode only): each chapter's scroll offset is remembered so
    // flipping back to a chapter you already started restores exactly where you left off, and
    // `pageAnim` drives the brief slide transition that plays while the new chapter mounts.
    const scrollPositionsRef = useRef({});
    const editorPaneRef = useRef(null);
    const characterPaneRef = useRef(null);
    const locationPaneRef = useRef(null);
    const swipeRef = useRef(null); // { x, y, t } of the active touch, while one is in progress
    const readerMouseDownRef = useRef(false); // true while a mouse-drag swipe gesture is in progress (Reading Mode)
    const [pageAnim, setPageAnim] = useState(null); // 'from-right' | 'from-left' | null
    // Reading Settings are device-level preferences (not project data) — every change is saved
    // to localStorage immediately so they carry over next time the reader is opened.
    const updateReadingSettings = (patch) => {
        setReadingSettingsState((prev) => {
            const next = { ...prev, ...patch };
            try {
                localStorage.setItem(READING_SETTINGS_KEY, JSON.stringify(next));
            }
            catch (e) { }
            return next;
        });
    };
    const [searchOpen, setSearchOpen] = useState(false); // global search overlay
    const [worldCategory, setWorldCategory] = usePersistedViewState('worldCategory', 'all'); // World Bible category filter
    const [navGroupsOpen, setNavGroupsOpen] = usePersistedViewState('navGroupsOpen', { story: true, world: true, people: true, lore: true, project: true });
    const [worldBibleSearch, setWorldBibleSearch] = useState(''); // World Bible cross-category search
    const [charRoleFilter, setCharRoleFilter] = usePersistedViewState('charRoleFilter', 'all'); // Characters role filter
    const [houseTreeId, setHouseTreeId] = useState(null); // world entry id whose family tree modal is open
    const [generatedTreeOpen, setGeneratedTreeOpen] = useState(false); // "Generate Family Tree" modal, built from every family relationship in the Relationship Web
    const [houseDbId, setHouseDbId] = useState(null); // world entry id whose House Database page is open
    const [chapterMenuId, setChapterMenuId] = useState(null); // chapter whose ⋮ menu is open
    const [renamingChapterId, setRenamingChapterId] = useState(null);
    const [renameDraft, setRenameDraft] = useState('');
    const [confirmState, setConfirmState] = useState(null); // { message, onConfirm }
    const [sessionStart] = useState(() => new Date());
    const [now, setNow] = useState(() => new Date());
    useEffect(() => {
        const id = setInterval(() => setNow(new Date()), 30000);
        return () => clearInterval(id);
    }, []);
    // Restore the reader's scroll position whenever the visible chapter changes (including right
    // after a swipe). Keyed on the chapter id alone (not the chapter object or `project`) so this
    // stays a hook that's always called, regardless of whether `project` has finished loading yet.
    useEffect(() => {
        if (!readingMode || !activeChapter || !editorPaneRef.current) return;
        editorPaneRef.current.scrollTop = scrollPositionsRef.current[activeChapter] || 0;
    }, [readingMode, activeChapter]);
    // Clear the slide-in class once its animation has played so it's ready to fire again next swipe.
    useEffect(() => {
        if (!pageAnim) return;
        const id = setTimeout(() => setPageAnim(null), 260);
        return () => clearTimeout(id);
    }, [pageAnim]);
    // Manuscript/Characters/Locations each keep their own scroll pane (editorPaneRef,
    // characterPaneRef, locationPaneRef) for reasons unrelated to tab navigation — SectionNav
    // jumping, and (for the editor) per-chapter reading-mode restoration above. This piggybacks on
    // those same refs to additionally remember each tab's own scroll offset in the shared nav
    // store, so switching tabs and coming back — same as the simpler tabs wrapped in NavScrollBox —
    // doesn't snap back to the top. It saves on the way out and restores on the way in, keyed by
    // whichever tab is being left/entered, so it doesn't fight the chapter-level effect above
    // (that one only ever runs on activeChapter/readingMode changes, this one only on tab changes).
    const paneScrollRefs = { manuscript: editorPaneRef, characters: characterPaneRef, locations: locationPaneRef };
    const prevPaneTabRef = useRef(tab);
    useEffect(() => {
        const leavingTab = prevPaneTabRef.current;
        const leavingRef = paneScrollRefs[leavingTab];
        if (leavingTab !== tab && leavingRef && leavingRef.current) {
            nav.saveScroll(`ws-${projectId}-${leavingTab}`, leavingRef.current.scrollTop);
        }
        const enteringRef = paneScrollRefs[tab];
        if (enteringRef && enteringRef.current) {
            enteringRef.current.scrollTop = nav.getScroll(`ws-${projectId}-${tab}`);
        }
        prevPaneTabRef.current = tab;
    }, [tab]);
    const askConfirm = (message, onConfirm) => setConfirmState({ message, onConfirm });
    useEffect(() => {
        (async () => {
            var _a, _b, _c, _d;
            try {
                const res = await storage.get(projectKey(projectId));
                const loaded = patchProjectDefaults(res ? JSON.parse(res.value) : emptyProject());
                setProject(loaded);
                setActiveChapter((_b = (_a = loaded.chapters[0]) === null || _a === void 0 ? void 0 : _a.id) !== null && _b !== void 0 ? _b : null);
            }
            catch (e) {
                const fresh = emptyProject();
                setProject(fresh);
                setActiveChapter((_d = (_c = fresh.chapters[0]) === null || _c === void 0 ? void 0 : _c.id) !== null && _d !== void 0 ? _d : null);
            }
            finally {
                setReady(true);
            }
        })();
    }, [projectId]);
    const status = useAutosave(project, ready, projectKey(projectId));
    useMetaReport(project, ready, projectId, onMeta, activeChapter);
    useDailyLog(project, ready, setProject);
    const anchorTabFor = { world: 'world', glossary: 'glossary', notes: 'notes', timeline: 'timeline' };
    useEffect(() => {
        if (!pendingHighlight)
            return;
        const expectedTab = anchorTabFor[pendingHighlight.type];
        if (tab !== expectedTab)
            return;
        const el = document.getElementById(expectedTab + '-' + pendingHighlight.id);
        if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
            el.classList.add('flash-highlight');
            const t = setTimeout(() => el.classList.remove('flash-highlight'), 1600);
            setPendingHighlight(null);
            return () => clearTimeout(t);
        }
    }, [tab, pendingHighlight, project]);
    // IMPORTANT: all hooks above this line run on every render, including
    // before "project" has loaded, so the hook order never changes.
    //
    // PERFORMANCE FIX: these used to depend on the whole `project` object,
    // which gets a new reference on every single keystroke anywhere in the
    // app (not just the manuscript) because update() deep-clones it. Each of
    // these functions re-parses chapter HTML to find @mentions, which is
    // expensive — recomputing it on every keystroke, everywhere, is what was
    // making the app slow and occasionally unresponsive. Depending instead on
    // cheap content signatures means the expensive work only reruns when the
    // manuscript text (or the relevant character/location) actually changes.
    const chapSig = project ? project.chapters.map((c) => c.id + ':' + (c.text ? c.text.length : 0)).join('|') : '';
    const charIdsSig = project ? project.characters.map((c) => c.id).join(',') : '';
    const autoEdges = useMemo(() => (project ? extractCoMentionEdges(project.chapters) : []), [chapSig]);
    const characterAppearsIn = useMemo(() => {
        if (!project || !activeCharacter) return [];
        return chaptersContainingCharacter(project.chapters, activeCharacter);
    }, [chapSig, activeCharacter]);
    const locationAppearsIn = useMemo(() => {
        if (!project || !activeLocation) return [];
        return chaptersContainingMentionType(project.chapters, activeLocation, 'location');
    }, [chapSig, activeLocation]);
    const locationImportantCharacters = useMemo(() => {
        if (!project || !activeLocation) return [];
        return charactersAtLocation(project.chapters, activeLocation, project.characters);
    }, [chapSig, activeLocation, charIdsSig]);
    const entityIdsSig = project ? [
        project.characters.map((c) => `${c.id}:${c.name || ''}`).join(','),
        project.locations.map((l) => `${l.id}:${l.name || ''}`).join(','),
        project.world.map((w) => `${w.id}:${w.topic || ''}`).join(','),
        project.glossary.map((g) => `${g.id}:${g.term || ''}`).join(','),
        project.timeline.map((t) => `${t.id}:${t.what || ''}:${t.when || ''}`).join(','),
    ].join('|') : '';
    // Pure results only (no click handlers yet — jumpToChapter/update aren't defined until
    // below the early "!project" return, so this can't reference them). Cheap to recompute:
    // each check's run() only reruns when the manuscript or the relevant entity ids change.
    const healthRaw = useMemo(() => {
        if (!project) return { sections: [], score: 100, totalIssues: 0 };
        return runHealthChecks(project);
    }, [chapSig, entityIdsSig]);
    const totalHealthIssues = healthRaw.totalIssues;
    const healthScore = healthRaw.score;
    // PERFORMANCE: this is the manuscript's total word count, used below by achievements/writer
    // progress and again further down for the stats displayed on the hub. It only actually needs
    // to change when a chapter's text changes, so it's keyed on chapSig (cheap: chapter id +
    // length) rather than recomputing on every render/edit — summing wordCount() across every
    // chapter of a very large (e.g. ~1M word) manuscript isn't free, and it was previously being
    // done unmemoized on every render, plus a second time inside the achievements memo below.
    const totalWordsMemo = useMemo(() => (project ? project.chapters.reduce((s, c) => s + wordCount(c.text), 0) : 0), [chapSig]);
    // Same guard-inside-the-memo pattern as healthRaw above, and for the same reason: this has
    // to be declared before the early "!project" return below so hook order never changes
    // between the loading render and every render after.
    const achievements = useMemo(() => {
        if (!project)
            return [];
        const strk = computeStreak((project.stats && project.stats.log) || {});
        return computeAchievements(project, { totalWords: totalWordsMemo, streak: strk, healthScore: healthRaw.score, totalHealthIssues: healthRaw.totalIssues });
    }, [project, healthRaw, totalWordsMemo]);
    const writerProgress = useMemo(() => computeWriterProgress(achievements), [achievements]);
    // Detects the moment an achievement flips from locked to unlocked (comparing this render's
    // set against the last one seen) so the "Achievement Unlocked" toast can fire right when it
    // happens. Session-only by design — no unlock history is written to the project, so nothing
    // here needs a schema migration; the toast simply won't replay for older unlocks after a
    // reload, which is the right tradeoff for a purely celebratory effect.
    const seenUnlockedRef = useRef(null);
    const seenLevelRef = useRef(null);
    const [unlockQueue, setUnlockQueue] = useState([]);
    const [levelUpEvent, setLevelUpEvent] = useState(null);
    const [xpGainEvent, setXpGainEvent] = useState(null);
    useEffect(() => {
        if (!project)
            return;
        const unlockedIds = new Set(achievements.filter((a) => a.unlocked).map((a) => a.id));
        if (seenUnlockedRef.current === null) {
            // First render for this project: adopt the current set/level silently, nothing to celebrate.
            seenUnlockedRef.current = unlockedIds;
            seenLevelRef.current = writerProgress.level;
            return;
        }
        const newlyUnlocked = achievements.filter((a) => a.unlocked && !seenUnlockedRef.current.has(a.id));
        seenUnlockedRef.current = unlockedIds;
        if (newlyUnlocked.length) {
            setUnlockQueue((q) => [...q, ...newlyUnlocked]);
        }
        // Level only ever moves forward, driven purely by XP from achievements above, so a level
        // increase always lands in the very same render as the achievement(s) that caused it —
        // which is what lets the "+XP Earned" figure below just be that achievement XP, rather
        // than needing its own separately-tracked running total.
        const previousLevel = seenLevelRef.current;
        seenLevelRef.current = writerProgress.level;
        const xpGained = newlyUnlocked.reduce((s, a) => s + a.xp, 0);
        const leveledUp = writerProgress.level > previousLevel;
        if (leveledUp) {
            // levelUpEvent is still recorded here on every level-up regardless of tab — the
            // Achievement Hall's full-screen LevelUpOverlay reads it when the writer visits later.
            // It used to also drive a small mini-toast shown live in the manuscript tab, but that
            // interrupted the writing flow, so it was removed; level-ups while writing are now
            // silent and simply visible next time the writer checks Achievements.
            setLevelUpEvent({ level: writerProgress.level, xpEarned: xpGained, newAchievements: newlyUnlocked });
        }
        if (xpGained > 0) {
            // xpIntoLevel wraps to a small number on the render a level-up happens, so the *before*
            // value for the bar-fill animation has to be reconstructed from the running total
            // rather than read directly off writerProgress. Each level now costs a different amount
            // of XP, so this is a lookup against where `previousLevel` actually started rather than
            // a flat modulo.
            const previousTotalXP = writerProgress.totalXP - xpGained;
            const previousXpIntoLevel = previousTotalXP - writerLevelFloor(previousLevel);
            setXpGainEvent({ id: uuid(), amount: xpGained, previousLevel, previousXpIntoLevel, leveledUp });
        }
    }, [achievements, project, writerProgress.level]);
    // The cinematic unlock overlay (shown only in the Achievement Hall — see the tab === 'achievements'
    // render below) holds until the writer taps Continue rather than auto-dismissing, so multiple
    // queued unlocks play one at a time at the writer's own pace. Everywhere else EXCEPT the
    // manuscript tab, the small corner toast (AchievementUnlockToast) shows instead — non-blocking.
    // While actively writing (tab === 'manuscript'), neither the corner toast nor the old mini-toast
    // shows at all: the queue below still auto-advances silently on its usual timer, so nothing
    // stalls or piles up, it just doesn't surface visually until the writer leaves the manuscript
    // or checks the Achievements tab, where every unlock is already reflected normally.
    const handleUnlockContinue = () => setUnlockQueue((q) => q.slice(1));
    useEffect(() => {
        if (!unlockQueue.length || tab === 'achievements')
            return;
        const t = setTimeout(() => setUnlockQueue((q) => q.slice(1)), 2000);
        return () => clearTimeout(t);
    }, [unlockQueue, tab]);
    if (!project) {
        return (React.createElement("div", { style: { minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#17171B', color: '#EFE7D2', fontFamily: 'ui-sans-serif, system-ui' } }, "Opening your workspace\u2026"));
    }
    const handleJump = (type, id) => {
        if (type === 'character') {
            setTab('characters');
            setCharView('list');
            setActiveCharacter(id);
            return;
        }
        if (type === 'location') {
            setTab('locations');
            setActiveLocation(id);
            return;
        }
        const t = anchorTabFor[type];
        if (t) {
            setTab(t);
            setPendingHighlight({ type, id });
        }
    };
    const jumpToChapter = (chapterId) => { setTab('manuscript'); setActiveChapter(chapterId); };
    // Swipe navigation between adjacent chapters, used by Reading Mode's touch handlers below.
    // Saves the current chapter's scroll offset before leaving, switches chapters, and plays a
    // short slide so the transition reads as one page giving way to the next rather than a cut.
    const goToAdjacentChapter = (direction) => {
        const list = project.chapters;
        const idx = list.findIndex((c) => c.id === activeChapter);
        if (idx === -1) return;
        const nextIdx = idx + direction;
        if (nextIdx < 0 || nextIdx >= list.length) return; // no chapter that way — nothing to do
        if (editorPaneRef.current) {
            scrollPositionsRef.current[list[idx].id] = editorPaneRef.current.scrollTop;
        }
        setPageAnim(direction > 0 ? 'from-right' : 'from-left');
        setActiveChapter(list[nextIdx].id);
    };
    // Shared by touch (real devices) and mouse (desktop/trackpad — touch events never fire
    // there, which is the usual reason a touch-only swipe "does nothing" while testing in a
    // regular browser). Both paths funnel into the same start/end resolution below.
    const resolveSwipeStart = (x, y) => { swipeRef.current = { x, y, t: Date.now() }; };
    const resolveSwipeEnd = (x, y) => {
        const start = swipeRef.current;
        swipeRef.current = null;
        if (!start) return;
        const dx = x - start.x;
        const dy = y - start.y;
        const elapsed = Date.now() - start.t;
        // Require a deliberate, mostly-horizontal flick so ordinary vertical scrolling (or a
        // slow diagonal drag) never accidentally flips the chapter. Loose enough to catch a
        // relaxed reading-pace swipe, tight enough not to fire on an idle tap or a scroll.
        if (elapsed > 1200 || Math.abs(dx) < 40 || Math.abs(dx) < Math.abs(dy) * 1.2) return;
        goToAdjacentChapter(dx < 0 ? 1 : -1); // swipe left -> next chapter, swipe right -> previous
    };
    const handleReaderTouchStart = (e) => {
        if (e.touches.length !== 1) { swipeRef.current = null; return; }
        const t = e.touches[0];
        resolveSwipeStart(t.clientX, t.clientY);
    };
    const handleReaderTouchEnd = (e) => {
        if (!swipeRef.current) return;
        const t = e.changedTouches[0];
        resolveSwipeEnd(t.clientX, t.clientY);
    };
    // Cancelled touches (e.g. the OS stepping in mid-gesture for its own edge-swipe/back
    // navigation) never fire touchend — without this the pending start would just sit there
    // silently instead of ever being cleared.
    const handleReaderTouchCancel = () => { swipeRef.current = null; };
    const handleReaderMouseDown = (e) => {
        if (e.button !== 0) return;
        readerMouseDownRef.current = true;
        resolveSwipeStart(e.clientX, e.clientY);
    };
    const handleReaderMouseUp = (e) => {
        if (!readerMouseDownRef.current) return;
        readerMouseDownRef.current = false;
        resolveSwipeEnd(e.clientX, e.clientY);
    };
    // Maps a search result's group (organizations/items collapse to the underlying 'world' entry
    // type; manuscript is its own case since it opens a chapter rather than a sidebar panel) to
    // the existing navigation used for @mention links, then closes the search overlay.
    const handleSearchJump = (groupKey, id) => {
        setSearchOpen(false);
        if (groupKey === 'manuscript') {
            jumpToChapter(id);
            return;
        }
        const typeFor = { characters: 'character', locations: 'location', organizations: 'world', items: 'world', world: 'world', notes: 'notes', timeline: 'timeline', glossary: 'glossary' };
        handleJump(typeFor[groupKey] || groupKey, id);
    };
    const update = (fn) => setProject((p) => {
        const next = structuredClone(p);
        fn(next);
        return next;
    });
    // PERFORMANCE: update() above deep-clones the *entire* project (every chapter's full text,
    // every character/location/world entry, embedded images, everything) on every call via
    // structuredClone. That's fine for occasional edits, but the manuscript editor calls this on
    // every committed change to the chapter being written — for a very large (e.g. ~1M word)
    // manuscript, deep-cloning the whole project just to change one chapter's text is by far the
    // single biggest cost per edit. This does the same immutable update (nothing already in
    // `project` is ever mutated in place, so every other update() elsewhere still sees consistent,
    // untouched data) without touching anything that didn't change: only the project's own top
    // level, the chapters array, and the one edited chapter get new references. Every other
    // chapter, and every other section of the project (characters, locations, world, etc.), keeps
    // its exact previous reference — which also means anything memoized on those references
    // elsewhere correctly sees "nothing changed" instead of being invalidated by an unrelated
    // manuscript edit, same as before.
    const updateChapterText = (chapterId, html) => setProject((p) => {
        if (!p)
            return p;
        const idx = p.chapters.findIndex((x) => x.id === chapterId);
        if (idx === -1 || p.chapters[idx].text === html)
            return p;
        const chapters = p.chapters.slice();
        chapters[idx] = { ...chapters[idx], text: html };
        return { ...p, chapters };
    });
    // Worldbuilding Packs live inside the project itself (project.worldbuildingPacks) so they
    // autosave, back up, and import/export along with everything else — the same reasoning as
    // every other section here. See WorldbuildingPackBuilderModal/WorldbuildingPackCard.
    const handleSavePack = (packData) => {
        update((p) => {
            const idx = p.worldbuildingPacks.findIndex((x) => x.id === packData.id);
            if (idx >= 0)
                p.worldbuildingPacks[idx] = packData;
            else
                p.worldbuildingPacks.push(packData);
        });
        setPackBuilderState(null);
    };
    const handleDeletePack = (id) => update((p) => { p.worldbuildingPacks = p.worldbuildingPacks.filter((x) => x.id !== id); });
    const handleSetPackPublishStatus = (id, status) => update((p) => {
        const pk = p.worldbuildingPacks.find((x) => x.id === id);
        if (pk) {
            pk.publishStatus = status;
            pk.publishedAt = status !== 'none' ? Date.now() : null;
            pk.updatedAt = Date.now();
        }
    });
    // This project's own book-level publish state (see resolvePublishStatus, PublishingWizard,
    // AuthorStudioBookCard) — the very same 'none' | 'inkroot' | 'guild' status Author Studio
    // sets from outside the project via setPublishStatus. Edited from in here, it goes through
    // this project's own local update()/autosave (like handleSetPackPublishStatus above) rather
    // than a direct storage write, and reaches the Grand Library through the same debounced
    // index report that already mirrors title, cover, and worldbuildingPacks (see
    // useMetaReport) — so there is still exactly one publishing system, not two.
    const handleSetPublishStatus = (status) => update((p) => {
        p.publishStatus = status;
        p.publishedAt = status !== 'none' ? Date.now() : null;
    });
    // Confirm handlers for the Publishing Wizard (see PublishingWizard) when it's opened from
    // inside this project — Settings' Publish button, or a Worldbuilding Pack's own Publish
    // button. Same local update()/autosave path as the quick-action setters just above, just
    // also writing the listing fields Step 3 collected. From Author Studio, the very same fields
    // get set by publishBookWithDetails / publishPackWithDetails instead, since that view doesn't
    // have this project loaded — but it's the same wizard, the same fields, and the same index
    // mirroring (see useMetaReport / packSummaryForIndex) either way.
    const handleWizardPublishBook = (destination, details) => update((p) => {
        p.publishStatus = destination;
        p.publishedAt = Date.now();
        p.title = details.title || p.title;
        p.genre = details.genre;
        p.blurb = details.description;
        p.tags = details.tags;
        p.price = details.priceMode === 'paid' ? details.price : 0;
        if (details.storyFormat === 'series' || details.storyFormat === 'book')
            p.storyFormat = details.storyFormat;
    });
    const handleWizardPublishPack = (id, destination, details) => update((p) => {
        const pk = p.worldbuildingPacks.find((x) => x.id === id);
        if (pk) {
            pk.publishStatus = destination;
            pk.publishedAt = Date.now();
            pk.title = details.title || pk.title;
            pk.description = details.description;
            pk.genre = details.genre;
            pk.tags = details.tags;
            pk.coverImageUrl = details.coverImageUrl;
            pk.price = details.priceMode === 'paid' ? details.price : 0;
            pk.updatedAt = Date.now();
        }
    });
    // Turns each check's raw results into interactive issues (jump-to-chapter / fix buttons).
    // Cheap — it's just wrapping already-computed arrays, not rescanning the manuscript — so it
    // doesn't need its own memo, and can freely close over jumpToChapter/update.
    const goToCharacter = (characterId) => { setTab('characters'); setCharView('list'); setActiveCharacter(characterId); };
    const goToLocation = (locationId) => { setTab('locations'); setActiveLocation(locationId); };
    // Rows in the World Bible's read-only browse views (Characters/Locations/Timeline/Glossary/
    // All) jump to wherever that entry actually lives. A "world" entry has no separate home tab
    // of its own — it lives right here — so it just switches this screen to that entry's own
    // category instead.
    const jumpToWorldBibleEntry = (entry) => {
        if (entry.type === 'character') { goToCharacter(entry.id); return; }
        if (entry.type === 'location') { goToLocation(entry.id); return; }
        if (entry.type === 'world') { setWorldCategory(entry.category || 'houses'); return; }
        handleJump(entry.type, entry.id);
    };
    // Opens the relevant tab showing the full list (rather than one specific entry), so the
    // writer can see every duplicate side by side and decide what to do about them.
    const viewDuplicateGroup = (category) => {
        if (category === 'characters') { setTab('characters'); setCharView('list'); setActiveCharacter(null); return; }
        if (category === 'locations') { setTab('locations'); setActiveLocation(null); return; }
        setTab(category);
    };
    const healthHelpers = { jumpToChapter, update, goToCharacter, goToLocation, viewDuplicateGroup, handleJump, askConfirm };
    const healthSections = healthRaw.sections.map((section) => ({
        key: section.key,
        label: section.label,
        icon: section.icon,
        emptyText: section.emptyText,
        issues: buildHealthIssues(section.key, section.raw, project, healthHelpers),
    }));
    const chapters = project.chapters;
    const chapter = chapters.find((c) => c.id === activeChapter) || chapters[0];
    // Book Premiere format term ("Chapter"/"Episode") — see storyFormatTerm. Drives the
    // manuscript sidebar's heading, the "New …" button, rename placeholders, and the in-editor
    // chapter/episode title (see ChapterEditor's unitTerm prop) so a serialized story reads as
    // Episodes everywhere the author writes it, not just once it's published.
    const unitTerm = storyFormatTerm(project);
    const unitTermPlural = storyFormatTerm(project, true);
    // World Bible (V9): derived once per render, then just read inside the tab === 'world' block.
    const worldBibleBrowseKeys = ['characters', 'locations', 'timeline', 'glossary', 'all'];
    const worldBibleFilteredBrowseEntries = worldBibleBrowseKeys.includes(worldCategory)
        ? worldBibleEntries(project, worldCategory).filter((e) => matchesWorldBibleSearch(e, worldBibleSearch))
        : [];
    const worldBibleAllHouses = project.world.filter((w) => w.category === 'houses');
    const worldBibleFilteredHouses = worldBibleAllHouses.filter((w) => matchesWorldBibleSearch(normalizeWorldBibleEntry('world', w), worldBibleSearch));
    const worldBibleNativeItems = NATIVE_WORLD_KEYS.includes(worldCategory)
        ? project.world.filter((w) => w.category === worldCategory).filter((w) => matchesWorldBibleSearch(normalizeWorldBibleEntry('world', w), worldBibleSearch))
        : [];
    const worldBibleNativeUnfilteredCount = NATIVE_WORLD_KEYS.includes(worldCategory)
        ? project.world.filter((w) => w.category === worldCategory).length
        : 0;
    const character = project.characters.find((c) => c.id === activeCharacter);
    const location = project.locations.find((l) => l.id === activeLocation);
    const locationBreadcrumb = location ? locationBreadcrumbChain(location.id, project.locations) : [];
    const locationParentCandidates = location
        ? project.locations.filter((l) => l.id !== location.id && !locationAncestorIds(l.id, project.locations).has(location.id))
        : [];
    const locationChildren = location ? project.locations.filter((l) => l.parentLocationId === location.id) : [];
    const locationConnections = location ? project.locationConnections.filter((c) => c.fromId === location.id || c.toId === location.id) : [];
    const locationConnectionCandidates = location
        ? project.locations.filter((l) => l.id !== location.id && !locationConnections.some((c) => c.fromId === l.id || c.toId === l.id))
        : [];
    const familyGraph = buildFamilyGraph(project.relationships);
    const characterFamilyIds = character ? familyComponent(character.id, familyGraph) : [];
    const generatedFamilyMemberIds = (() => {
        // "Family relationship types" = any relationship with a familyKind — Parent, Mother, Father,
        // Child, Son, Daughter, Husband, Wife, Spouse, Brother, Sister, Grandparent, Grandchild,
        // Uncle, Aunt, Cousin, Adoptive Parent, Adopted Child. Custom labels (Friend, Rival, Mentor,
        // Enemy…) have no familyKind, so they're ignored here even though they show on the web.
        const seedIds = new Set();
        project.relationships.forEach((r) => {
            if (r.familyKind && r.fromId && r.toId) {
                seedIds.add(r.fromId);
                seedIds.add(r.toId);
            }
        });
        const expanded = new Set();
        Array.from(seedIds).forEach((id) => familyComponent(id, familyGraph).forEach((x) => expanded.add(x)));
        return Array.from(expanded).filter((id) => project.characters.some((c) => c.id === id));
    })();
    const houseTreeEntry = houseTreeId ? project.world.find((w) => w.id === houseTreeId) : null;
    const houseTreeMemberIds = (() => {
        if (!houseTreeEntry)
            return [];
        const tagged = project.characters.filter((c) => c.houseId === houseTreeEntry.id).map((c) => c.id);
        const expanded = new Set();
        tagged.forEach((id) => familyComponent(id, familyGraph).forEach((x) => expanded.add(x)));
        return Array.from(expanded);
    })();
    const houseDbEntry = houseDbId ? project.world.find((w) => w.id === houseDbId) : null;
    const totalWords = totalWordsMemo;
    const avgChapterLength = chapters.length ? Math.round(totalWords / chapters.length) : 0;
    // Same derivation GrandLibraryScreen uses to label AuthorStudioBookCard's Guild option
    // (see the writerGuildName passed into GrandLibraryScreen), so the Publish dialog offers
    // the identical destination name no matter which Publish button opened it.
    const publishStatus = resolvePublishStatus(project);
    const publishGuildPlayerGuild = guildProfile && guildProfile.playerGuild;
    const publishActiveFounderGuild = guildProfile && guildProfile.guildType === 'founder' ? founderGuildById(guildProfile.founderGuildId) : null;
    const writerGuildName = (guildProfile && guildProfile.guildType)
        ? (guildProfile.guildType === 'player' ? (publishGuildPlayerGuild && publishGuildPlayerGuild.name) || 'my guild' : (publishActiveFounderGuild && publishActiveFounderGuild.name) || 'my guild')
        : null;
    const statsLog = (project.stats && project.stats.log) || {};
    const wordsToday = computeDailyDeltas(statsLog)[todayKey()] || 0;
    const weeklyWords = computeWeeklyTotal(statsLog);
    const streak = computeStreak(statsLog);
    const dailyGoal = (project.stats && project.stats.dailyGoal) || 500;
    const weeklyGoal = (project.stats && project.stats.weeklyGoal) || 3000;
    const sessionMinutes = Math.max(0, (now - sessionStart) / 60000);
    const unlockedAchievementCount = achievements.filter((a) => a.unlocked).length;
    const activeReadingTheme = READING_THEMES[readingSettings.theme] || READING_THEMES.dark;
    return (React.createElement(React.Fragment, null, React.createElement("div", { className: "app-shell" + (readingMode ? ' reading-mode theme-' + readingSettings.theme : '') + (readingMode && readingSettings.immersive ? ' immersive' : ''), style: Object.assign({ minHeight: '100vh', background: readingMode ? activeReadingTheme.bg : '#17171B', color: readingMode ? activeReadingTheme.text : '#EFE7D2', fontFamily: "ui-sans-serif, -apple-system, 'Segoe UI', Roboto, sans-serif", display: 'flex', transition: 'background var(--ink-dur) var(--ink-ease), color var(--ink-dur) var(--ink-ease)' }, readingMode ? {
                // Single source of truth for the active reading theme. Every reading-mode-scoped
                // CSS rule below (headings, links, blockquotes, selection, editor content) reads
                // from these instead of hard-coding a color that only matched one theme.
                '--ink-r-bg': activeReadingTheme.bg,
                '--ink-r-text': activeReadingTheme.text,
                '--ink-r-muted': activeReadingTheme.muted,
                '--ink-r-border': activeReadingTheme.border,
                '--ink-r-link': activeReadingTheme.link,
                '--ink-r-selection': activeReadingTheme.selection,
            } : null) },
        React.createElement("style", null, `
        * { box-sizing: border-box; }
        .app-shell {
          height: 100vh; height: 100dvh; overflow: hidden;
        }
        ::selection { background: #C89B3C55; }
        /* Reading Mode: every themed surface reads from the CSS variables set on .app-shell for
           the active theme (see activeReadingTheme above), so switching Light/Sepia/Dark updates
           background, text, headings, links, blockquotes, selection, and editor content in one
           consistent pass instead of some pieces lagging behind on the old theme's colors. */
        .app-shell.reading-mode { background: var(--ink-r-bg); color: var(--ink-r-text); }
        .app-shell.reading-mode ::selection { background: var(--ink-r-selection); }
        .app-shell.reading-mode .editor-pane,
        .app-shell.reading-mode .reading-content { background: var(--ink-r-bg); color: var(--ink-r-text); }
        /* Some paragraphs carry their own inline color (left over from pasted content, or from
           edits made before this theme system existed). An inline style always beats a class
           rule, so without !important here those paragraphs would keep whatever color they were
           saved with — invisible on Light, barely visible on Sepia — no matter which theme is
           selected. Force every descendant back to the active theme's text color; headings,
           blockquotes, and links below are more specific (or come later) so they still win. */
        .app-shell.reading-mode .reading-content * { color: var(--ink-r-text) !important; }
        .app-shell.reading-mode .reading-content h1,
        .app-shell.reading-mode .reading-content h2,
        .app-shell.reading-mode .reading-content h3,
        .app-shell.reading-mode .reading-content h4,
        .app-shell.reading-mode .reading-content h5,
        .app-shell.reading-mode .reading-content h6 { color: var(--ink-r-text) !important; }
        .app-shell.reading-mode .reading-content blockquote {
          margin: 0 0 var(--ink-para-gap, 1em) 0; padding-left: 16px;
          border-left: 3px solid var(--ink-r-border); color: var(--ink-r-muted) !important;
        }
        .app-shell.reading-mode .mention-chip,
        .app-shell.reading-mode .ref-link { color: var(--ink-r-link) !important; text-decoration: none; }
        .app-shell.reading-mode .mention-chip:active, .app-shell.reading-mode .mention-chip.link-open,
        .app-shell.reading-mode .ref-link:active, .app-shell.reading-mode .ref-link.link-open {
          background: var(--ink-r-link); color: var(--ink-r-bg) !important;
        }
        textarea, input { font-family: inherit; }
        textarea:focus, input:focus, button:focus-visible, [contenteditable]:focus {
          outline: 2px solid #C89B3C; outline-offset: 2px;
        }
        .scrollbox { -webkit-overflow-scrolling: touch; }
        .scrollbox::-webkit-scrollbar { width: 8px; }
        .scrollbox::-webkit-scrollbar-thumb { background: #33333A; border-radius: 8px; }
        .hoverable:hover { background: #232328 !important; }
        .navitem:hover { color: #EFE7D2 !important; }
        .proj-row:hover { background: #1F1F24 !important; }
        [data-placeholder]:empty:before { content: attr(data-placeholder); color: #5C5C64; }
        .mention-chip, .ref-link {
          cursor: pointer; background: transparent; padding: 1px 3px; margin: 0 -3px; border-radius: 4px;
          transition: background 0.08s ease, color 0.08s ease;
        }
        /* @mentions are inserted inline as part of the sentence — to the writer they should read
           as ordinary text until actively touched, not stand out as a "chip". */
        .mention-chip { color: inherit; font: inherit; text-decoration: none; }
        /* A manually selected-and-linked phrase stays visibly marked, since the writer chose to
           highlight that specific text. */
        .ref-link {
          color: #DCC38A; text-decoration: underline; text-decoration-style: dotted;
          text-decoration-color: #C89B3C99; text-underline-offset: 3px;
        }
        .ref-link:hover { text-decoration-style: solid; color: #EFE7D2; }
        /* Pressed: while the mouse/finger is actively down on the link. */
        .mention-chip:active, .ref-link:active,
        /* Open: while this link's preview card is showing — same look, cleared the instant it closes. */
        .mention-chip.link-open, .ref-link.link-open {
          background: #DDB35C; color: #17171B; text-decoration: none;
        }
        .flash-highlight { animation: flashPulse 1.6s ease; }
        @keyframes flashPulse {
          0% { box-shadow: 0 0 0 2px #C89B3C; } 100% { box-shadow: 0 0 0 0px transparent; }
        }
        .mobile-nav-btn { display: none; }
        /* ---------- Visual polish pass ----------
           Additive only — nothing here overrides a color or size an existing element already
           sets, so it can't regress a screen that hasn't been looked at yet. The app's inline
           styles win on anything they already specify (background, radius, layout); this layer
           fills in the parts inline styles structurally can't reach (::selection, ::placeholder,
           :hover/:active affordances) and adds one shared texture to the app shell.
        */
        /* A page of raw #17171B reads flat under real light — this puts the faintest lift behind
           the content (barely perceptible, brightest a few hundred px from the top) so the shell
           has a hint of depth without competing with anything drawn on top of it. */
        html, body { background: radial-gradient(ellipse 1200px 700px at 50% -10%, #1c1c21 0%, #17171B 55%); }
        /* Every button in the app already gets its resting color from its own inline style —
           this only adds the part inline styles can't: a hover/press response, so the ~100
           buttons that never had one (anything without a bespoke :hover class) stop feeling
           inert. brightness() and a soft shadow read correctly whether the button is solid gold,
           a ghost outline, or plain text, without needing to know which. */
        button:not(:disabled) {
          transition: filter 0.12s var(--ink-ease), transform 0.12s var(--ink-ease), box-shadow 0.12s var(--ink-ease);
        }
        button:not(:disabled):hover { filter: brightness(1.1); }
        button:not(:disabled):active { transform: translateY(1px) scale(0.98); filter: brightness(0.97); }
        button:disabled { cursor: default; }
        /* Text selection tinted to the same gold as everything else the app calls "active" —
           previously only Reading Mode set this, so selecting text anywhere else in the app fell
           back to the browser's default blue, which read as a seam between two apps. */
        ::selection { background: #C89B3C; color: #17171B; }
        /* Placeholders are the one thing here inline styles genuinely cannot reach (no ::placeholder
           equivalent in the style prop) — without this each browser picks its own default tint,
           so the same input looked a different shade of gray in Safari than in Chrome. */
        input::placeholder, textarea::placeholder, [contenteditable]:empty:before { color: #5C5C64; opacity: 1; }
        .scrollbox::-webkit-scrollbar-thumb:hover { background: #45454E; }
        /* The hub's Project Home rows (Manuscript, World Bible, ...) already brighten on hover via
           .proj-row — this adds the missing transition (so that brightening fades in rather than
           snapping) and nudges the chevron forward and gold, a small "this is a door" cue. */
        .proj-row { transition: background var(--ink-dur) var(--ink-ease); }
        .proj-row:hover > span:last-child { color: #C89B3C !important; transform: translateX(2px); transition: transform var(--ink-dur) var(--ink-ease), color var(--ink-dur) var(--ink-ease); }
        .proj-row > span:last-child { display: inline-block; transition: transform var(--ink-dur) var(--ink-ease), color var(--ink-dur) var(--ink-ease); }
        /* The one moment before anything has loaded — give it the same unhurried motion as the
           rest of the app instead of sitting completely static. */
        @keyframes inkLoadingPulse { 0%, 100% { opacity: 0.6; } 50% { opacity: 1; } }
        #load-fallback { animation: inkLoadingPulse 1.6s ease-in-out infinite; }
        .nav-backdrop { display: none; }
        .mobile-subnav-btn { display: none; }
        .subnav-backdrop { display: none; }
        .app-shell.reading-mode .sidebar,
        .app-shell.reading-mode .sub-sidebar,
        .app-shell.reading-mode .mobile-nav-btn,
        .app-shell.reading-mode .mobile-subnav-btn,
        .app-shell.reading-mode .wordcount-hint { display: none !important; }
        .app-shell.reading-mode [data-placeholder]:empty:before { display: none; }
        /* Paragraph spacing: applied to whatever block-level children the browser produced while
           typing (div or p), scoped to the reader only — the editor keeps its own fixed spacing. */
        .reading-content > div, .reading-content > p { margin: 0 0 var(--ink-para-gap, 0) 0; }
        .app-shell.reading-mode.immersive .top-toolbar { display: none !important; }
        /* Responsive reading container: used by the manuscript pane and World Bible so long
           pages of text stay a comfortable line length instead of stretching edge-to-edge.
           Phones get consistent side padding with a modest cap; tablets and desktops step the
           cap up gradually rather than jumping straight to full width. */
        .reading-container {
          width: 100%; max-width: 640px; margin: 0 auto; padding: 0 20px; box-sizing: border-box;
        }
        @media (min-width: 640px) {
          .reading-container { max-width: 760px; padding: 0 32px; }
        }
        @media (min-width: 900px) {
          .reading-container { max-width: 860px; padding: 0 40px; }
        }
        @media (min-width: 1200px) {
          .reading-container { max-width: 960px; padding: 0 48px; }
        }
        /* Swipe-between-chapters: the incoming chapter slides in from the direction it was
           pulled from, so the gesture reads as one page giving way to the next. */
        .page-slide-from-right { animation: pageSlideFromRight 0.26s ease-out; }
        .page-slide-from-left { animation: pageSlideFromLeft 0.26s ease-out; }
        @keyframes pageSlideFromRight {
          from { transform: translateX(28px); opacity: 0; } to { transform: translateX(0); opacity: 1; }
        }
        @keyframes pageSlideFromLeft {
          from { transform: translateX(-28px); opacity: 0; } to { transform: translateX(0); opacity: 1; }
        }
        @media (max-width: 760px) {
          .sidebar {
            position: fixed; top: 0; left: 0; bottom: 0; z-index: 2000; width: 250px;
            height: 100vh; height: 100dvh;
            transform: translateX(-100%); transition: transform 0.2s ease; box-shadow: 0 0 40px rgba(0,0,0,0.5);
            overflow-y: auto; -webkit-overflow-scrolling: touch;
          }
          .sidebar.open { transform: translateX(0); }
          .mobile-nav-btn { display: flex !important; }
          .nav-backdrop.open { display: block; position: fixed; inset: 0; background: rgba(0,0,0,0.5); z-index: 1900; }
          .sub-sidebar {
            position: fixed; top: 0; left: 0; bottom: 0; z-index: 2100; width: 270px !important;
            height: 100vh; height: 100dvh;
            transform: translateX(-100%); transition: transform 0.2s ease; box-shadow: 0 0 40px rgba(0,0,0,0.5);
            background: #17171B;
            overflow-y: auto; -webkit-overflow-scrolling: touch;
          }
          .sub-sidebar.open { transform: translateX(0); }
          .mobile-subnav-btn { display: flex !important; }
          .subnav-backdrop.open { display: block; position: fixed; inset: 0; background: rgba(0,0,0,0.5); z-index: 2050; }
          .editor-pane { padding: 18px 0 !important; }
          .mention-hint { display: none; }
        }
        /* Sticky in-page section nav for long profile pages (House / Location / Character). Sticks
           to the top of its own scrollable pane (not the whole viewport) so it never covers the
           fixed page header above it, and scrolls horizontally on narrow screens instead of wrapping
           or overflowing. */
        .section-nav {
          position: sticky; top: 0; z-index: 40;
          background: rgba(23,23,27,0.94); backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px);
          border-bottom: 1px solid #2A2A30; margin: 0 0 18px; padding: 0;
        }
        .section-nav-inner {
          display: flex; gap: 6px; overflow-x: auto; padding: 10px 2px;
          -ms-overflow-style: none; scrollbar-width: none;
        }
        .section-nav-inner::-webkit-scrollbar { display: none; }
        .section-nav-btn {
          flex-shrink: 0; white-space: nowrap; background: transparent; border: 1px solid transparent;
          color: #A6A6AD; border-radius: 20px; padding: 7px 14px; font-size: 13px; font-weight: 600;
          cursor: pointer; font-family: 'Inter', sans-serif; transition: background 0.15s ease, color 0.15s ease, border-color 0.15s ease;
        }
        .section-nav-btn:hover { color: #D9D2BE; }
        .section-nav-btn.active { background: rgba(200,155,60,0.14); border-color: #C89B3C; color: #C89B3C; }
        .section-nav-btn { transition: background var(--ink-dur) var(--ink-ease), color var(--ink-dur) var(--ink-ease), border-color var(--ink-dur) var(--ink-ease); }
        @media (max-width: 640px) {
          .section-nav-btn { padding: 6px 11px; font-size: 12.5px; }
        }
        /* Sticky nav gains a soft shadow once the page has scrolled under it, so it reads as
           lifted above the content rather than just a hard-pinned bar. */
        .section-nav { box-shadow: 0 0 0 rgba(0,0,0,0); transition: box-shadow var(--ink-dur) var(--ink-ease); }
        .section-nav.scrolled { box-shadow: 0 6px 16px rgba(0,0,0,0.28); }
        /* Tab switches inside the workspace (Manuscript / Characters / World / Timeline…) —
           each tab's panel plays this once on mount, which is every time you switch to it,
           since the previous tab has already unmounted. */
        @keyframes inkTabIn { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: translateY(0); } }
        .tab-fade { animation: inkTabIn var(--ink-dur) var(--ink-ease); }
        /* Modals (Confirm dialog, Family Tree modal, image pickers, etc): backdrop fades,
           panel fades + rises slightly and settles — quick enough not to feel like it's
           blocking the tap that opened it. */
        @keyframes inkBackdropIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes inkModalIn { from { opacity: 0; transform: translateY(10px) scale(0.98); } to { opacity: 1; transform: translateY(0) scale(1); } }
        .ink-modal-backdrop { animation: inkBackdropIn var(--ink-dur) var(--ink-ease); }
        .ink-modal-panel { animation: inkModalIn var(--ink-dur) var(--ink-ease); }
        /* Full-screen overlays (Global Search, Family Tree full view) — a gentler fade since
           there's no backdrop to distinguish from a "panel". */
        @keyframes inkOverlayIn { from { opacity: 0; } to { opacity: 1; } }
        .ink-overlay-in { animation: inkOverlayIn var(--ink-dur) var(--ink-ease); }
        /* @mention / link-picker dropdowns: quick scale + fade from the anchor point so they
           feel like they're popping out of the text rather than just appearing. */
        @keyframes inkDropdownIn { from { opacity: 0; transform: scale(0.96) translateY(-2px); } to { opacity: 1; transform: scale(1) translateY(0); } }
        .ink-dropdown-in { animation: inkDropdownIn 180ms var(--ink-ease); transform-origin: top left; }
        .ink-fade-in { animation: inkBackdropIn 180ms var(--ink-ease); }
        /* Search results, timeline entries: a light stagger (via each row's --i custom
           property, set inline) so a results list reads as settling into place rather than
           popping in as one flat block. Capped low so long lists never feel slow to finish. */
        @keyframes inkRowIn { from { opacity: 0; transform: translateY(5px); } to { opacity: 1; transform: translateY(0); } }
        .ink-row-in { animation: inkRowIn var(--ink-dur) var(--ink-ease) both; animation-delay: calc(var(--i, 0) * 18ms); }
        /* Project Home ("the archive") — each nav group fades and settles in with a slight
           stagger by section order (--i), so the page reads as unveiling shelf by shelf rather
           than appearing as one flat block. */
        @keyframes inkArchiveSectionIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
        .archive-section-in { animation: inkArchiveSectionIn 520ms var(--ink-ease) both; animation-delay: calc(var(--i, 0) * 90ms); }
        .archive-row { transition: background var(--ink-dur) var(--ink-ease), border-color var(--ink-dur) var(--ink-ease), transform var(--ink-dur) var(--ink-ease); }
        .archive-row:hover { background: #201C13 !important; border-color: #4A3D22 !important; transform: translateX(2px); }
        .archive-row:hover .archive-row-arrow { color: #C89B3C !important; transform: translateX(2px); }
        .archive-row-arrow { display: inline-block; transition: transform var(--ink-dur) var(--ink-ease), color var(--ink-dur) var(--ink-ease); }
        /* Achievements page: a slow breathing glow on unlocked epic/legendary medals so the
           rarest badges read as quietly prestigious rather than static images. */
        @keyframes inkMedalGlow { 0%, 100% { box-shadow: 0 0 0 3px #100E0A, 0 0 0 4px var(--medal-glow), 0 3px 10px rgba(0,0,0,0.5), inset 0 2px 3px rgba(255,255,255,0.25), inset 0 -4px 7px rgba(0,0,0,0.45); } 50% { box-shadow: 0 0 0 3px #100E0A, 0 0 0 8px var(--medal-glow), 0 3px 14px rgba(0,0,0,0.5), inset 0 2px 3px rgba(255,255,255,0.25), inset 0 -4px 7px rgba(0,0,0,0.45); } }
        .medal-glow { animation: inkMedalGlow 2.6s ease-in-out infinite; }
        /* The Grandmaster rank's crest gets a slow-turning gold aura behind it — the top of the
           rank ladder should visibly look like the most elaborate badge in the app. */
        @keyframes inkRankAuraSpin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .rank-aura { animation: inkRankAuraSpin 7s linear infinite; opacity: 0.55; filter: blur(2.5px); }
        .achievement-card { transition: transform var(--ink-dur) var(--ink-ease), border-color var(--ink-dur) var(--ink-ease); }
        .achievement-card.unlocked:hover { transform: translateY(-2px); }
        /* Achievement Unlock overlay: a staggered ~2.2s sequence — backdrop dims and blurs in,
           a warm gold glow blooms behind the medal, the medal springs to size while sparkles
           orbit it, then title, rarity, and checkmark reveal in turn before Continue fades in
           last. Every piece below runs on its own delay off this one shared timeline rather than
           chaining JS timers, so the whole thing stays smooth even if a render is skipped. */
        @keyframes inkAunlockOverlayIn {
          0% { opacity: 0; backdrop-filter: blur(0px); -webkit-backdrop-filter: blur(0px); }
          100% { opacity: 1; backdrop-filter: blur(6px); -webkit-backdrop-filter: blur(6px); }
        }
        .aunlock-overlay { animation: inkAunlockOverlayIn 380ms ease-out both; }
        /* The glow radiating from the center, behind the medal — size, color/tint, peak opacity,
           and duration all come from the rarity's fx (see RARITY_UNLOCK_FX and the inline
           --glow-peak/--glow-end custom properties AchievementUnlockOverlay sets per instance). */
        @keyframes inkAunlockGlow {
          0% { transform: translate(-50%, -50%) scale(0.3); opacity: 0; }
          55% { opacity: var(--glow-peak, 0.7); }
          100% { transform: translate(-50%, -50%) scale(1); opacity: var(--glow-end, 0.6); }
        }
        .aunlock-glow {
          position: absolute; top: 50%; left: 50%; border-radius: 50%; pointer-events: none; z-index: 0;
          animation-name: inkAunlockGlow; animation-timing-function: cubic-bezier(0.16, 1, 0.3, 1); animation-delay: 60ms; animation-fill-mode: both;
        }
        /* Epic's rotating light rays behind the medal — a conic gradient alternating gold and
           purple that spins for the duration of the sequence and fades in/out around it. */
        @keyframes inkAunlockRaysSpin { from { transform: translate(-50%, -50%) rotate(0deg); } to { transform: translate(-50%, -50%) rotate(360deg); } }
        @keyframes inkAunlockRaysFade { 0% { opacity: 0; } 18% { opacity: 1; } 78% { opacity: 1; } 100% { opacity: 0; } }
        .aunlock-rays {
          position: absolute; top: 50%; left: 50%; border-radius: 50%; pointer-events: none; z-index: 0;
          background: conic-gradient(from 0deg,
            transparent 0deg, #A184D677 8deg, transparent 22deg, transparent 68deg, #E8C46877 78deg, transparent 92deg,
            transparent 158deg, #A184D666 168deg, transparent 182deg, transparent 248deg, #E8C46866 258deg, transparent 272deg,
            transparent 338deg, #A184D677 350deg, transparent 360deg);
          animation-name: inkAunlockRaysSpin, inkAunlockRaysFade; animation-timing-function: linear, ease-in-out; animation-fill-mode: both, both;
        }
        /* Rare's single ring, and Legendary's three staggered ones — each expands outward from the
           medal and fades, echoing a rank crest's rings rather than a game-y radial burst. */
        @keyframes inkAunlockRingExpand {
          0% { transform: translate(-50%, -50%) scale(0.3); opacity: 0; }
          40% { opacity: 0.85; }
          100% { transform: translate(-50%, -50%) scale(1.6); opacity: 0; }
        }
        .aunlock-ring {
          position: absolute; top: 50%; left: 50%; border-radius: 50%; pointer-events: none; z-index: 0;
          border: 1.5px solid #E8C46899; box-shadow: 0 0 18px 2px #C89B3C55;
          animation: inkAunlockRingExpand 900ms cubic-bezier(0.16, 1, 0.3, 1) both;
        }
        .aunlock-badge-wrap { position: relative; width: 100px; height: 100px; display: flex; align-items: center; justify-content: center; }
        /* The medal's spring — how far it overshoots past 100% (--overshoot) and how long the
           spring takes (animation-duration) both come from the rarity's fx, so Common gets a
           gentle pop while Legendary gets a fuller, slightly slower bounce. */
        @keyframes inkAunlockBadgeSpring {
          0% { transform: scale(0.7); opacity: 0; }
          10% { opacity: 1; }
          55% { transform: scale(var(--overshoot, 1.1)); opacity: 1; }
          75% { transform: scale(calc(var(--overshoot, 1.1) - 0.19)); }
          100% { transform: scale(1); opacity: 1; }
        }
        .aunlock-badge-spring { animation-name: inkAunlockBadgeSpring; animation-timing-function: cubic-bezier(0.22, 1, 0.36, 1); animation-delay: 150ms; animation-fill-mode: both; }
        /* Sparkles orbit the badge for roughly a second then fade — each rides its own fixed angle
           (--a) and orbit radius (--radius, set per rarity), sweeping through about a full turn. */
        @keyframes inkAunlockSparkleOrbit {
          0% { transform: rotate(var(--a)) translateX(var(--radius, 28px)) scale(0); opacity: 0; }
          18% { transform: rotate(calc(var(--a) + 60deg)) translateX(calc(var(--radius, 28px) * 1.25)) scale(1); opacity: 1; }
          80% { opacity: 0.9; }
          100% { transform: rotate(calc(var(--a) + 360deg)) translateX(var(--radius, 28px)) scale(0.4); opacity: 0; }
        }
        .aunlock-sparkle {
          position: absolute; top: 50%; left: 50%; border-radius: 50%; margin: -2.5px; pointer-events: none;
          animation-name: inkAunlockSparkleOrbit; animation-timing-function: ease-out; animation-fill-mode: both;
        }
        /* Rare's brighter particle burst — flies outward from center and fades, distinct from the
           gentler orbiting sparkles above. */
        @keyframes inkAunlockBurst {
          0% { transform: translate(-50%, -50%) rotate(var(--a)) translateY(0) scale(1); opacity: 1; }
          100% { transform: translate(-50%, -50%) rotate(var(--a)) translateY(-46px) scale(0.3); opacity: 0; }
        }
        .aunlock-burst {
          position: absolute; top: 50%; left: 50%; border-radius: 50%; pointer-events: none;
          animation-name: inkAunlockBurst; animation-timing-function: ease-out; animation-fill-mode: both;
        }
        /* Legendary's drifting golden particles — slower embers rising and fading, layered on top
           of the orbiting sparkles for the biggest-feeling unlock in the app. */
        @keyframes inkAunlockDrift {
          0% { transform: translate(-50%, 0) scale(1); opacity: 0; }
          20% { opacity: 1; }
          100% { transform: translate(calc(-50% + var(--dx, 0px)), -80px) scale(0.4); opacity: 0; }
        }
        .aunlock-drift {
          position: absolute; bottom: 6px; left: 50%; width: 4px; height: 4px; border-radius: 50%; pointer-events: none;
          background: radial-gradient(circle, #FFEFC0, #E8C468 60%, transparent 100%);
          animation: inkAunlockDrift 1400ms ease-out both;
        }
        /* Legendary's subtle camera shake, timed to land right as the medal's spring settles. */
        @keyframes inkAunlockShake {
          0%, 100% { transform: translate(0, 0); }
          20% { transform: translate(-3px, 1px); }
          40% { transform: translate(3px, -1px); }
          60% { transform: translate(-2px, 1px); }
          80% { transform: translate(2px, -1px); }
        }
        .aunlock-shake { animation: inkAunlockShake 420ms ease-in-out 620ms; }
        /* Title (with the "Achievement Unlocked" eyebrow) fades upward beneath the badge. */
        @keyframes inkAunlockTextUp { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
        .aunlock-title { margin-top: 22px; animation-name: inkAunlockTextUp; animation-duration: 450ms; animation-timing-function: var(--ink-ease); animation-fill-mode: both; }
        /* The rarity chip follows with a shorter fade and a slighter upward drift. */
        @keyframes inkAunlockChipUp { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
        .aunlock-rarity { animation-name: inkAunlockChipUp; animation-duration: 400ms; animation-timing-function: var(--ink-ease); animation-fill-mode: both; }
        /* The XP line fades in right as the count-up itself begins (fx.xpDelay), so "+0 XP" is
           never visible sitting idle. */
        .aunlock-xp { animation-name: inkAunlockChipUp; animation-duration: 350ms; animation-timing-function: var(--ink-ease); animation-fill-mode: both; }
        /* The "Unlocked ✓" line slides in from the side rather than fading, so it reads as a
           distinct, deliberate stamp of confirmation after the XP count finishes. */
        @keyframes inkAunlockCheckIn { from { opacity: 0; transform: translateX(-10px); } to { opacity: 1; transform: translateX(0); } }
        .aunlock-check { animation-name: inkAunlockCheckIn; animation-duration: 400ms; animation-timing-function: var(--ink-ease); animation-fill-mode: both; }
        /* Continue only fades in once every other beat above has finished landing, and stays
           unclickable until then so it can't be tapped away before the moment has played out. */
        @keyframes inkAunlockContinueIn {
          0% { opacity: 0; transform: translateY(6px); pointer-events: none; }
          100% { opacity: 1; transform: translateY(0); pointer-events: auto; }
        }
        .aunlock-continue { animation-name: inkAunlockContinueIn; animation-duration: 400ms; animation-timing-function: var(--ink-ease); animation-fill-mode: both; }
        /* The small corner toast (AchievementUnlockToast) shown outside the Achievement Hall: drops
           in from above, holds, and its particle burst plays once on mount — each particle flies
           outward along its own fixed angle (--a) and fades (reuses .gold-particle below). */
        @keyframes inkAunlockToastInOut {
          0% { opacity: 0; transform: translate(-50%, -14px); }
          15% { opacity: 1; transform: translate(-50%, 0); }
          82% { opacity: 1; transform: translate(-50%, 0); }
          100% { opacity: 0; transform: translate(-50%, -10px); }
        }
        .aunlock-toast-in { animation: inkAunlockToastInOut 2000ms var(--ink-ease) both; }
        /* The floating "+XP" that rises and fades over WriterLevelBanner during an XP-gain
           animation — a quiet, elegant cue rather than an arcade-style popup. */
        @keyframes inkXpFloat {
          0% { opacity: 0; transform: translate(-50%, 0); }
          15% { opacity: 1; }
          70% { opacity: 1; }
          100% { opacity: 0; transform: translate(-50%, -22px); }
        }
        .xpgain-float {
          position: absolute; top: 8px; left: 50%; transform: translate(-50%, 0); pointer-events: none;
          font-family: 'Fraunces', Georgia, serif; font-weight: 700; font-size: 15px; color: #E8C468;
          text-shadow: 0 0 10px #C89B3C99; animation: inkXpFloat 1100ms ease-out both;
        }
        @keyframes inkGoldParticle {
          0% { transform: translate(-50%, -50%) rotate(var(--a)) translateY(0) scale(1); opacity: 1; }
          100% { transform: translate(-50%, -50%) rotate(var(--a)) translateY(-38px) scale(0.3); opacity: 0; }
        }
        .gold-particle {
          position: absolute; top: 50%; left: 50%; width: 5px; height: 5px; border-radius: 50%;
          background: radial-gradient(circle, #FFEFC0, #E8C468 60%, transparent 100%);
          animation: inkGoldParticle 900ms ease-out both; pointer-events: none;
        }
        /* Level Up celebration (Achievement Hall): a slower, more ceremonial sequence than the
           everyday unlock toast above — the whole overlay fades in, holds for the sequence below
           to play out, then fades away as one piece, so nothing needs its own separate exit
           animation or JS-driven unmount timing beyond the single LEVEL_UP_DURATION_MS timeout. */
        @keyframes inkLevelUpOverlay { 0% { opacity: 0; } 12% { opacity: 1; } 82% { opacity: 1; } 100% { opacity: 0; } }
        .levelup-overlay { animation: inkLevelUpOverlay 2800ms ease-in-out both; }
        /* The golden ring expands outward from the center and settles, echoing a rank crest's
           rings rather than a game-y radial burst. */
        @keyframes inkLevelRingExpand {
          0% { transform: scale(0.2); opacity: 0; }
          45% { opacity: 1; }
          70% { transform: scale(1); opacity: 1; }
          100% { transform: scale(1.08); opacity: 0.85; }
        }
        .levelup-ring { animation: inkLevelRingExpand 900ms cubic-bezier(0.16, 1, 0.3, 1) 150ms both; }
        /* Shimmering particles ride along with the ring's expansion (reuses the same gold-particle
           dot/keyframe as the achievement toast, just staggered further out and later). */
        .levelup-shimmer { animation-duration: 1100ms; }
        /* The project's crest settles in with a gentle scale rather than popping or bouncing. */
        @keyframes inkLevelCrestIn { from { transform: scale(0.55); opacity: 0; } to { transform: scale(1); opacity: 1; } }
        .levelup-crest { animation: inkLevelCrestIn 620ms cubic-bezier(0.16, 1, 0.3, 1) 380ms both; }
        /* "LEVEL UP" and the subtitle beneath it: a smooth fade with a slight rise, matching the
           app's shared easing rather than a flashier entrance. */
        @keyframes inkLevelTextIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        .levelup-title { animation: inkLevelTextIn 560ms var(--ink-ease) 640ms both; }
        .levelup-bar-wrap { animation: inkLevelTextIn 560ms var(--ink-ease) 1080ms both; }
        .levelup-xp { animation: inkLevelTextIn 560ms var(--ink-ease) 1520ms both; }
        /* The progress bar's glowing fill to the new level. */
        @keyframes inkLevelBarFill { from { width: 0%; box-shadow: none; } to { width: 100%; box-shadow: 0 0 12px 1px #E8C468aa; } }
        .levelup-bar-fill { height: 100%; border-radius: 6px; background: linear-gradient(90deg, #B08D57, #E8C468); animation: inkLevelBarFill 700ms cubic-bezier(0.16, 1, 0.3, 1) 1180ms both; }
        /* A single soft golden flash at the very end — deliberately calmer than the shimmer burst
           at the start, so the sequence closes rather than repeating its own opening beat. */
        @keyframes inkLevelSparkleFinal {
          0% { transform: translate(-50%, -50%) scale(0.5); opacity: 0; }
          50% { opacity: 0.9; }
          100% { transform: translate(-50%, -50%) scale(1.6); opacity: 0; }
        }
        .levelup-final-sparkle {
          position: absolute; top: 78px; left: 50%; width: 160px; height: 160px; border-radius: 50%; pointer-events: none;
          background: radial-gradient(circle, #FFEFC0cc, #E8C46866 55%, transparent 78%);
          animation: inkLevelSparkleFinal 900ms ease-out 2050ms both;
        }
        /* Manuscript editor's non-intrusive Level Up toast: fades in, holds for ~4s, fades out —
           entirely on its own timeline so it never needs a JS-driven opacity transition, only the
           unmount timer in LevelUpMiniToast to match. A subtle border highlight on hover signals
           it's tappable without competing with the entrance/exit animation's own transform. */
        @keyframes inkLevelToastInOut {
          0% { opacity: 0; transform: translateY(-6px); }
          7% { opacity: 1; transform: translateY(0); }
          93% { opacity: 1; transform: translateY(0); }
          100% { opacity: 0; transform: translateY(-6px); }
        }
        .levelup-mini-toast { animation: inkLevelToastInOut 4600ms ease-in-out both; transition: border-color var(--ink-dur) var(--ink-ease); }
        .levelup-mini-toast:hover { border-color: #C89B3Caa !important; }
        .levelup-mini-particle { width: 3px; height: 3px; animation-duration: 700ms; }
        /* Author Level Up (Writer Profile): the whole overlay fades in, holds through the sequence
           below, then fades out as one piece — same reasoning as the project version, just
           stretched to ~4s to feel unhurried and ceremonial rather than a quick pop-up. */
        @keyframes inkAuthorLevelUpOverlay { 0% { opacity: 0; } 8% { opacity: 1; } 88% { opacity: 1; } 100% { opacity: 0; } }
        .authorlevelup-overlay { animation: inkAuthorLevelUpOverlay 4000ms ease-in-out both; }
        /* Golden light radiating outward — two layered rings/glows rather than one, for a grander
           read than the project version's single ring. */
        @keyframes inkAuthorLightBurst { 0% { transform: scale(0.3); opacity: 0; } 50% { opacity: 1; } 100% { transform: scale(1.15); opacity: 0.55; } }
        .authorlevelup-burst { animation: inkAuthorLightBurst 1150ms cubic-bezier(0.16, 1, 0.3, 1) 150ms both; }
        /* The crest "slowly appears" — a longer, gentler fade/scale than a project's crest pop. */
        @keyframes inkAuthorCrestIn { from { transform: scale(0.6); opacity: 0; } to { transform: scale(1); opacity: 1; } }
        .authorlevelup-crest { animation: inkAuthorCrestIn 900ms cubic-bezier(0.16, 1, 0.3, 1) 450ms both; }
        /* The headline, then the new level, then the current rank, then the lifetime XP gained —
           each its own smooth fade-with-rise, staggered so they read as a sequence of ceremonial
           beats rather than appearing all at once. */
        @keyframes inkAuthorTextIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        .authorlevelup-title { animation: inkAuthorTextIn 620ms var(--ink-ease) 1150ms both; }
        .authorlevelup-levelline { animation: inkAuthorTextIn 600ms var(--ink-ease) 1500ms both; }
        .authorlevelup-rankline { animation: inkAuthorTextIn 600ms var(--ink-ease) 1850ms both; }
        .authorlevelup-xp { animation: inkAuthorTextIn 600ms var(--ink-ease) 2200ms both; }
        /* Small embers drifting upward and fading — each element's own duration/delay/--dx come
           from inline style (see AuthorLevelUpOverlay), so this keyframe just describes the shape
           of one ember's rise. */
        @keyframes inkAuthorEmberDrift {
          0% { transform: translate(-50%, 0) scale(1); opacity: 0; }
          20% { opacity: 1; }
          100% { transform: translate(calc(-50% + var(--dx, 0px)), -120px) scale(0.35); opacity: 0; }
        }
        .authorlevelup-ember {
          position: absolute; width: 4px; height: 4px; border-radius: 50%; pointer-events: none;
          background: radial-gradient(circle, #FFEFC0, #E8C468 60%, transparent 100%);
          animation-name: inkAuthorEmberDrift; animation-timing-function: ease-out; animation-fill-mode: both;
        }
        /* The "satisfying glow" close, right before the overlay's own fade-out begins. */
        @keyframes inkAuthorFinalGlow { 0% { transform: scale(0.6); opacity: 0; } 45% { opacity: 1; } 100% { transform: scale(1.6); opacity: 0; } }
        .authorlevelup-finalglow {
          position: absolute; border-radius: 50%; pointer-events: none;
          background: radial-gradient(circle, #FFEFC0dd, #E8C46870 55%, transparent 78%);
          animation: inkAuthorFinalGlow 1000ms ease-out 3150ms both;
        }
        /* Writer Rank Promotion: the rarer, grander sibling of the Author Level Up overlay above —
           same overall shape (fade in/hold/fade out, radiating light, drifting embers, a final
           glow) stretched a little longer (4.5s) to feel weightier, plus a crest that transitions
           from the old rank to the new one instead of a single static crest. */
        @keyframes inkRankPromoOverlay { 0% { opacity: 0; } 7% { opacity: 1; } 88% { opacity: 1; } 100% { opacity: 0; } }
        .rankpromo-overlay { animation: inkRankPromoOverlay 4500ms ease-in-out both; }
        .rankpromo-burst { animation: inkAuthorLightBurst 1200ms cubic-bezier(0.16, 1, 0.3, 1) 150ms both; }
        .rankpromo-ember {
          position: absolute; width: 4px; height: 4px; border-radius: 50%; pointer-events: none;
          background: radial-gradient(circle, #FFEFC0, #E8C468 60%, transparent 100%);
          animation-name: inkAuthorEmberDrift; animation-timing-function: ease-out; animation-fill-mode: both;
        }
        /* The old rank's crest holds briefly, then fades and shrinks away... */
        @keyframes inkRankPrevCrestOut {
          0% { opacity: 0; transform: scale(0.85); }
          22% { opacity: 1; transform: scale(1); }
          100% { opacity: 0; transform: scale(0.55); }
        }
        .rankpromo-prevcrest { animation: inkRankPrevCrestOut 1500ms cubic-bezier(0.4, 0, 0.2, 1) 300ms both; }
        /* ...while the new rank's crest slowly grows in to take its place, overlapping the old
           crest's exit slightly so the transition reads as one continuous motion. */
        @keyframes inkRankNewCrestIn { from { opacity: 0; transform: scale(0.5); } to { opacity: 1; transform: scale(1); } }
        .rankpromo-newcrest { animation: inkRankNewCrestIn 900ms cubic-bezier(0.16, 1, 0.3, 1) 1300ms both; }
        .rankpromo-title { animation: inkAuthorTextIn 640ms var(--ink-ease) 2300ms both; }
        .rankpromo-transition { animation: inkAuthorTextIn 600ms var(--ink-ease) 2700ms both; }
        .rankpromo-finalglow {
          position: absolute; border-radius: 50%; pointer-events: none;
          background: radial-gradient(circle, #FFEFC0dd, #E8C46870 55%, transparent 78%);
          animation: inkAuthorFinalGlow 1100ms ease-out 3900ms both;
        }
        /* Accordion sections (World Bible profile blocks): animates the content's own height
           via a 0fr/1fr grid track so both opening and closing animate smoothly without ever
           needing to measure pixel heights in JS. */
        .ink-accordion-body {
          display: grid; grid-template-rows: 0fr; transition: grid-template-rows var(--ink-dur) var(--ink-ease);
        }
        .ink-accordion-body.open { grid-template-rows: 1fr; }
        .ink-accordion-body > div { overflow: hidden; }
        /* Family tree / relationship web nodes: position changes (a member added, the layout
           re-flowing) glide to their new spot instead of snapping; a freshly-added node fades
           and scales in. Deliberately NOT applied to the pan/zoom group itself, so an active
           drag or pinch stays perfectly responsive. */
        .ink-node { transition: transform var(--ink-dur) var(--ink-ease); }
        /* Opacity only, deliberately: this class sits on the same <g> whose 'transform' attribute
           positions the node, and an animated CSS transform would override that positioning
           attribute for the animation's duration, making the node jump to the origin. */
        @keyframes inkNodeIn { from { opacity: 0; } to { opacity: 1; } }
        .ink-node-in { animation: inkNodeIn var(--ink-dur) var(--ink-ease); }
        .ink-edge { transition: opacity var(--ink-dur) var(--ink-ease); }
        /* Map markers: a small pop when a pin is placed. */
        @keyframes inkMarkerIn { 0% { opacity: 0; transform: translate(-50%, -100%) scale(0.5); } 70% { opacity: 1; transform: translate(-50%, -100%) scale(1.08); } 100% { opacity: 1; transform: translate(-50%, -100%) scale(1); } }
        .ink-marker-in { animation: inkMarkerIn var(--ink-dur) var(--ink-ease); }
        /* Interactive map: the floating "Jump to Map" / home button and its zoom + rotate
           controls. Dark steel body, a dashed rune-like ring etched just inside the edge,
           and a gold glow on hover/focus so it reads as an ever-present, always-tappable
           control rather than part of the map artwork underneath it. */
        .map-home-btn {
          position: relative; width: 50px; height: 50px; border-radius: 50%; flex-shrink: 0;
          display: flex; align-items: center; justify-content: center;
          background: radial-gradient(circle at 32% 28%, #3a3d43, #1a1c1f 72%);
          border: 2px solid #4a4a52; color: #C89B3C; cursor: pointer;
          box-shadow: inset 0 0 0 1px rgba(200,155,60,0.2), 0 4px 10px rgba(0,0,0,0.5);
          transition: box-shadow 0.25s ease, border-color 0.25s ease, transform 0.15s ease;
        }
        .map-home-btn::before {
          content: ''; position: absolute; inset: 5px; border-radius: 50%; pointer-events: none;
          border: 1px dashed rgba(200,155,60,0.4);
        }
        .map-home-btn.has-custom-home::before { border-style: solid; border-color: rgba(200,155,60,0.65); }
        .map-home-btn:hover, .map-home-btn:focus-visible {
          border-color: #C89B3C; transform: translateY(-1px);
          box-shadow: inset 0 0 0 1px rgba(200,155,60,0.45), 0 0 18px 4px rgba(200,155,60,0.5), 0 4px 10px rgba(0,0,0,0.5);
        }
        .map-home-btn:active { transform: translateY(0) scale(0.94); }
        .map-ctrl-cluster { display: flex; flex-direction: column; gap: 6px; }
        .map-ctrl-btn {
          width: 34px; height: 34px; border-radius: 8px; display: flex; align-items: center; justify-content: center;
          background: linear-gradient(160deg, #2c2e33, #17181b); border: 1px solid #3A3A42; color: #D9D2BE;
          font-size: 16px; line-height: 1; cursor: pointer; transition: border-color 0.2s ease, color 0.2s ease;
        }
        .map-ctrl-btn:hover { border-color: #C89B3C; color: #C89B3C; }
        .map-ctrl-btn:active { transform: scale(0.94); }
        @media (max-width: 760px) {
          .map-home-btn { width: 46px; height: 46px; }
          .map-ctrl-btn { width: 38px; height: 38px; font-size: 17px; }
        }
        /* Location pins: a colored badge (unique per location type) with a dark-fantasy iron
           rim. Hover enlarges the badge and reveals a name/type tooltip above it; a click keeps
           it selected — pulsing with a gold glow — until a different pin is chosen. */
        .ink-loc-pin { cursor: pointer; display: flex; flex-direction: column; align-items: center; }
        .ink-loc-pin-icon {
          width: 24px; height: 24px; border-radius: 50%; display: flex; align-items: center; justify-content: center;
          border: 2px solid #17171B; box-shadow: 0 2px 6px rgba(0,0,0,0.55);
          transition: transform 0.18s ease, box-shadow 0.18s ease;
        }
        .ink-loc-pin.hovered .ink-loc-pin-icon { transform: scale(1.28); }
        @keyframes inkPinSelectedGlow {
          0%, 100% { box-shadow: 0 2px 6px rgba(0,0,0,0.55), 0 0 0 0 rgba(200,155,60,0.6); }
          50% { box-shadow: 0 2px 6px rgba(0,0,0,0.55), 0 0 12px 5px rgba(200,155,60,0.75); }
        }
        .ink-loc-pin.selected .ink-loc-pin-icon {
          transform: scale(1.15);
          animation: inkPinSelectedGlow 1.6s ease-in-out infinite;
        }
        .ink-loc-tooltip {
          position: absolute; bottom: 100%; left: 50%; transform: translateX(-50%); margin-bottom: 7px;
          background: #0F0F12; border: 1px solid #3A3A42; border-radius: 6px; padding: 5px 9px;
          white-space: nowrap; pointer-events: none; box-shadow: 0 6px 14px rgba(0,0,0,0.5);
        }
        .ink-loc-tooltip > div:first-child { font-size: 12px; color: #EFE7D2; font-weight: 600; }
        .ink-loc-tooltip .type { font-size: 10.5px; color: #C89B3C; margin-top: 1px; }
        /* Cluster badge: replaces overlapping pins at low zoom; count shown, click zooms in. */
        .ink-loc-cluster {
          width: 30px; height: 30px; border-radius: 50%; display: flex; align-items: center; justify-content: center;
          background: radial-gradient(circle at 32% 28%, #3a3d43, #1a1c1f 72%); border: 2px solid #C89B3C;
          color: #EFE7D2; font-size: 12.5px; font-weight: 700; font-family: 'Inter', sans-serif;
          cursor: pointer; box-shadow: 0 2px 8px rgba(0,0,0,0.55); transition: transform 0.18s ease;
        }
        .ink-loc-cluster:hover { transform: scale(1.15); }
        .map-legend-btn {
          display: flex; align-items: center; gap: 6px; background: rgba(15,15,18,0.82);
          border: 1px solid #3A3A42; color: #D9D2BE; border-radius: 8px; padding: 7px 11px;
          font-size: 12px; font-weight: 600; font-family: 'Inter', sans-serif; cursor: pointer;
          transition: border-color 0.2s ease, color 0.2s ease;
        }
        .map-legend-btn:hover { border-color: #C89B3C; color: #C89B3C; }
        /* Nearby Locations panel: appears beside a selected pin listing every other location on
           the same map, nearest first. It stays mounted at all times so the collapse (deselecting
           the pin) can animate closed instead of just vanishing. */
        .ink-nearby-panel {
          position: absolute; top: 12px; right: 12px; width: 232px; max-width: calc(100% - 24px);
          max-height: calc(100% - 24px); z-index: 5; display: flex; flex-direction: column;
          background: rgba(15,15,18,0.94); border: 1px solid #3A3A42; border-radius: 10px;
          box-shadow: 0 12px 28px rgba(0,0,0,0.5); transform-origin: top right;
          transform: translateX(14px) scale(0.97); opacity: 0; pointer-events: none;
          transition: transform var(--ink-dur) var(--ink-ease), opacity var(--ink-dur) var(--ink-ease);
        }
        .ink-nearby-panel.open { transform: translateX(0) scale(1); opacity: 1; pointer-events: auto; }
        .ink-nearby-header {
          font-family: 'Fraunces', Georgia, serif; font-size: 13.5px; font-weight: 600; color: #EFE7D2;
          padding: 11px 13px 9px; border-bottom: 1px solid #2A2A30; flex-shrink: 0;
        }
        .ink-nearby-list { overflow-y: auto; padding: 6px; }
        .ink-nearby-empty { padding: 10px 13px 13px; font-size: 12px; color: #5C5C64; }
        .ink-nearby-item {
          display: flex; align-items: center; gap: 10px; padding: 7px 8px; border-radius: 7px;
          cursor: pointer; transition: background 0.15s ease;
        }
        .ink-nearby-item:hover { background: #232328; }
        .ink-nearby-icon {
          width: 24px; height: 24px; border-radius: 50%; flex-shrink: 0; display: flex;
          align-items: center; justify-content: center; color: #17171B; border: 2px solid #17171B;
        }
        .ink-nearby-info { min-width: 0; }
        .ink-nearby-name {
          font-size: 12.5px; font-weight: 600; color: #D9D2BE; white-space: nowrap;
          overflow: hidden; text-overflow: ellipsis;
        }
        .ink-nearby-meta {
          font-size: 11px; color: #7A7A82; margin-top: 1px; white-space: nowrap;
          overflow: hidden; text-overflow: ellipsis;
        }
        /* Static glow ring (no pulse, unlike .selected) so hovering a panel entry reads as a
           distinct "here it is" highlight rather than being mistaken for the selected pin. */
        .ink-loc-pin.panel-glow .ink-loc-pin-icon {
          transform: scale(1.18);
          box-shadow: 0 2px 6px rgba(0,0,0,0.55), 0 0 0 4px rgba(200,155,60,0.5), 0 0 16px 6px rgba(200,155,60,0.65);
        }
        /* Actively being dragged (Coordinate Lock off, mid-reposition): no transition lag so the
           marker tracks the pointer 1:1, plus a distinct dashed ring so it can't be mistaken for
           .selected or .panel-glow while it's mid-move. */
        .ink-loc-pin.dragging { cursor: grabbing; }
        .ink-loc-pin.dragging .ink-loc-pin-icon {
          transition: none; transform: scale(1.22);
          box-shadow: 0 4px 14px rgba(0,0,0,0.65), 0 0 0 3px rgba(239,231,210,0.7);
        }
        .sidebar, .sub-sidebar { transition: transform var(--ink-dur) var(--ink-ease) !important; }
      `),
        navOpen && React.createElement("div", { className: "nav-backdrop open", onClick: () => setNavOpen(false) }),
        React.createElement("div", { className: 'sidebar scrollbox' + (navOpen ? ' open' : ''), style: { width: 220, borderRight: '1px solid #2A2A30', padding: '24px 16px', display: 'flex', flexDirection: 'column', gap: SPACE_SCALE[20], flexShrink: 0, background: '#17171B', overflowY: 'auto', WebkitOverflowScrolling: 'touch' } },
            React.createElement("div", null,
                React.createElement("button", { onClick: () => { setNavOpen(false); onBack(); }, className: "navitem", style: {
                        background: 'none', border: 'none', color: '#7A7A82', fontSize: TYPE_SCALE[12.5], cursor: 'pointer',
                        padding: 0, marginBottom: 12, display: 'flex', alignItems: 'center', gap: SPACE_SCALE[4],
                    } }, "\u2039 All Projects"),
                React.createElement("button", { onClick: () => { setTab('hub'); setNavOpen(false); }, style: { background: 'none', border: 'none', cursor: 'pointer', padding: 0, textAlign: 'left' } },
                    React.createElement("div", { style: { fontFamily: "'Fraunces', Georgia, serif", fontSize: TYPE_SCALE[22], fontWeight: 600, color: '#EFE7D2' } }, "Inkroot"),
                    React.createElement("div", { style: { fontSize: TYPE_SCALE[12], color: '#7A7A82', marginTop: 2 } }, "a home for the whole story"))),
            React.createElement("nav", { style: { display: 'flex', flexDirection: 'column', gap: SPACE_SCALE[10] } }, NAV_GROUPS.map((group) => {
                const isGroupOpen = navGroupsOpen[group.key] !== false;
                return React.createElement("div", { key: group.key },
                    React.createElement("button", { onClick: () => setNavGroupsOpen((prev) => ({ ...prev, [group.key]: !isGroupOpen })), style: {
                            width: '100%', textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer',
                            display: 'flex', alignItems: 'center', gap: SPACE_SCALE[7], padding: '4px 10px 4px 2px',
                            fontSize: TYPE_SCALE[11.5], letterSpacing: '0.08em', textTransform: 'uppercase', fontWeight: 700, color: '#5C5C64',
                        } },
                        React.createElement("span", { style: { fontSize: TYPE_SCALE[13] } }, group.icon),
                        React.createElement("span", { style: { flex: 1 } }, group.label),
                        React.createElement("span", { style: { fontSize: TYPE_SCALE[10], transform: isGroupOpen ? 'rotate(0deg)' : 'rotate(-90deg)', transition: 'transform var(--ink-dur) var(--ink-ease)' } }, "\u25BE")),
                    isGroupOpen && React.createElement("div", { style: { display: 'flex', flexDirection: 'column', gap: SPACE_SCALE[1] } }, group.items.map((item, idx) => {
                        const active = tab === item.key && (item.worldCategory === undefined
                            ? (item.key !== 'world' || !NATIVE_WORLD_KEYS.includes(worldCategory))
                            : worldCategory === item.worldCategory);
                        return React.createElement("button", { key: `${item.key}-${item.worldCategory || idx}`, onClick: () => { setTab(item.key); if (item.worldCategory)
                                setWorldCategory(item.worldCategory); setNavOpen(false); }, className: "navitem", style: {
                                textAlign: 'left', border: 'none', cursor: 'pointer', padding: '7px 10px', borderRadius: RADIUS_SCALE[6], fontSize: TYPE_SCALE[14],
                                color: active ? '#C89B3C' : '#A6A6AD', fontWeight: active ? 600 : 500,
                                background: active ? '#1F1F24' : 'transparent', display: 'flex', alignItems: 'center', gap: SPACE_SCALE[8],
                            } },
                            React.createElement("span", null, item.icon),
                            item.label);
                    })));
            })),
            React.createElement("div", { style: { marginTop: 'auto', fontSize: TYPE_SCALE[11.5], color: '#5C5C64', lineHeight: 1.6 } },
                React.createElement("div", null,
                    totalWords.toLocaleString(),
                    " words total"),
                React.createElement("div", { style: { marginTop: 4, display: 'flex', alignItems: 'center', gap: SPACE_SCALE[5] } },
                    status === 'saving' && React.createElement("span", { style: { color: '#A6A6AD' } }, "Saving\u2026"),
                    status === 'saved' && React.createElement("span", { style: { color: '#7FA98A' } }, "Saved \u2713"),
                    status === 'error' && React.createElement("span", { style: { color: '#D98A8A' } }, "Could not save \u2014 try Settings \u2192 Optimize Images")))),
        React.createElement("div", { style: { flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, minHeight: 0 } },
            !readingMode && React.createElement("div", { className: "desktop-breadcrumb-row", style: { padding: '10px 16px 0' } },
                React.createElement(Breadcrumbs, { style: { marginBottom: 0 } })),
            React.createElement("div", { className: "top-toolbar", style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', borderBottom: `1px solid ${readingMode ? activeReadingTheme.border : '#2A2A30'}`, gap: SPACE_SCALE[8], flexWrap: 'wrap', rowGap: 6, transition: 'border-color var(--ink-dur) var(--ink-ease)', position: 'sticky', top: 0, zIndex: 50, background: readingMode ? activeReadingTheme.bg : '#17171B' } },
                React.createElement("div", { style: { display: 'flex', alignItems: 'center', gap: SPACE_SCALE[8], minWidth: 0, flex: '1 1 160px' } },
                    React.createElement("button", { className: "mobile-nav-btn", onClick: () => { if (tab === 'hub')
                            onBack();
                        else
                            setTab('hub'); }, style: {
                            background: 'none', border: '1px solid #2A2A30', color: '#EFE7D2', borderRadius: RADIUS_SCALE[6], width: 32, height: 32,
                            alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: TYPE_SCALE[16], flexShrink: 0,
                        } }, "\u2039"),
                    React.createElement("button", { className: "mobile-nav-btn", onClick: () => setNavOpen(true), style: {
                            background: 'none', border: '1px solid #2A2A30', color: '#EFE7D2', borderRadius: RADIUS_SCALE[6], width: 32, height: 32,
                            alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: TYPE_SCALE[14], flexShrink: 0,
                        } }, "\u2630"),
                    (tab === 'manuscript' || tab === 'locations' || (tab === 'characters' && charView === 'list')) && (React.createElement("button", { className: "mobile-subnav-btn", onClick: () => setSubNavOpen(true), style: {
                            background: 'none', border: '1px solid #2A2A30', color: '#EFE7D2', borderRadius: RADIUS_SCALE[6], width: 32, height: 32,
                            alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: TYPE_SCALE[14], flexShrink: 0,
                        } }, "\uD83D\uDCD1")),
                    React.createElement("input", { value: project.title, onChange: (e) => update((p) => { p.title = e.target.value; }), style: {
                            background: 'transparent', border: 'none', color: readingMode ? activeReadingTheme.text : '#EFE7D2', fontFamily: "'Fraunces', Georgia, serif", fontSize: TYPE_SCALE[19], fontWeight: 600, flex: '1 1 auto', minWidth: 0,
                        } })),
                React.createElement("div", { style: { display: 'flex', alignItems: 'center', gap: SPACE_SCALE[10], flexShrink: 0, marginLeft: 'auto' } },
                    tab === 'manuscript' && chapter && (React.createElement("span", { className: "wordcount-hint", style: { fontSize: TYPE_SCALE[12.5], color: '#7A7A82', display: 'flex', alignItems: 'center', gap: SPACE_SCALE[6], whiteSpace: 'nowrap' } },
                        React.createElement(IconAt, { style: { color: '#C89B3C' } }),
                        " ",
                        liveChapterWordCount !== null ? liveChapterWordCount : wordCount(chapter.text),
                        React.createElement("span", { className: "mention-hint" }, " words \u00B7 type @ to link"))),
                    React.createElement("button", { onClick: () => setSearchOpen(true), title: "Search this project", "aria-label": "Search this project", style: {
                            display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'none',
                            border: `1px solid ${readingMode ? activeReadingTheme.border : '#2A2A30'}`, color: readingMode ? activeReadingTheme.muted : '#A6A6AD', borderRadius: RADIUS_SCALE[6], width: 32, height: 32, cursor: 'pointer', flexShrink: 0,
                        } }, React.createElement(IconSearch, null)),
                    readingMode && (React.createElement("button", { onClick: () => setReadingSettingsOpen((o) => !o), title: "Reading Settings", "aria-label": "Reading Settings", style: {
                            display: 'flex', alignItems: 'center', justifyContent: 'center', background: readingSettingsOpen ? activeReadingTheme.border : 'none',
                            border: `1px solid ${activeReadingTheme.border}`, color: activeReadingTheme.muted, borderRadius: RADIUS_SCALE[6], width: 32, height: 32, cursor: 'pointer', flexShrink: 0,
                        } }, React.createElement(IconGear, null))),
                    React.createElement("button", { onClick: () => setReadingMode((r) => !r), title: readingMode ? "Exit Reading Mode \u2014 resume editing" : "Reading Mode \u2014 distraction-free reading", style: {
                            display: 'flex', alignItems: 'center', gap: SPACE_SCALE[6], background: readingMode ? '#C89B3C' : 'none',
                            border: readingMode ? '1px solid #C89B3C' : '1px solid #2A2A30', color: readingMode ? '#17171B' : '#A6A6AD',
                            borderRadius: RADIUS_SCALE[6], padding: '6px 10px', fontSize: TYPE_SCALE[12.5], fontWeight: 600, cursor: 'pointer', flexShrink: 0, whiteSpace: 'nowrap',
                        } }, readingMode ? '\u270D\uFE0F Edit' : '\uD83D\uDCD6 Read'))),
            readingMode && readingSettingsOpen && (React.createElement(ReadingSettingsPanel, { settings: readingSettings, onChange: updateReadingSettings, onClose: () => setReadingSettingsOpen(false) })),
            readingMode && readingSettings.immersive && (React.createElement("div", { className: "immersive-bar", style: {
                    position: 'fixed', top: 14, right: 16, zIndex: 1500, display: 'flex', gap: SPACE_SCALE[6],
                } },
                React.createElement("button", { onClick: () => setReadingSettingsOpen((o) => !o), title: "Reading Settings", "aria-label": "Reading Settings", style: {
                        display: 'flex', alignItems: 'center', justifyContent: 'center', background: activeReadingTheme.panel + 'ee',
                        border: `1px solid ${activeReadingTheme.border}`, color: activeReadingTheme.muted, borderRadius: RADIUS_SCALE[6], width: 32, height: 32, cursor: 'pointer',
                    } }, React.createElement(IconGear, null)),
                React.createElement("button", { onClick: () => updateReadingSettings({ immersive: false }), title: "Exit immersive reading", "aria-label": "Exit immersive reading", style: {
                        display: 'flex', alignItems: 'center', justifyContent: 'center', background: activeReadingTheme.panel + 'ee',
                        border: `1px solid ${activeReadingTheme.border}`, color: activeReadingTheme.muted, borderRadius: RADIUS_SCALE[6], width: 32, height: 32, cursor: 'pointer',
                    } }, React.createElement(IconX, { width: "15", height: "15" })))),
            tab === 'hub' && React.createElement(HubTab, {
                projectId, project, chapters, totalHealthIssues, streak, totalWords,
                achievements, unlockedAchievementCount, setTab, setWorldCategory,
            }),
            unlockQueue[0] && tab !== 'achievements' && tab !== 'manuscript' && React.createElement(AchievementUnlockToast, { key: unlockQueue[0].id, achievement: unlockQueue[0], onView: () => setTab('achievements') }),
            tab === 'manuscript' && React.createElement(ManuscriptTab, { activeChapter: activeChapter, activeReadingTheme: activeReadingTheme, askConfirm: askConfirm, chapter: chapter, chapterMenuId: chapterMenuId, chapters: chapters, editorPaneRef: editorPaneRef, handleJump: handleJump, handleReaderMouseDown: handleReaderMouseDown, handleReaderMouseUp: handleReaderMouseUp, handleReaderTouchCancel: handleReaderTouchCancel, handleReaderTouchEnd: handleReaderTouchEnd, handleReaderTouchStart: handleReaderTouchStart, pageAnim: pageAnim, project: project, readingMode: readingMode, readingSettings: readingSettings, renameDraft: renameDraft, renamingChapterId: renamingChapterId, scrollPositionsRef: scrollPositionsRef, setActiveChapter: setActiveChapter, setChapterMenuId: setChapterMenuId, setLiveChapterWordCount: setLiveChapterWordCount, setRenameDraft: setRenameDraft, setRenamingChapterId: setRenamingChapterId, setSubNavOpen: setSubNavOpen, subNavOpen: subNavOpen, unitTerm: unitTerm, unitTermPlural: unitTermPlural, update: update, updateChapterText: updateChapterText }),
            tab === 'characters' && React.createElement(CharactersTab, { activeCharacter: activeCharacter, askConfirm: askConfirm, autoEdges: autoEdges, chapters: chapters, charRoleFilter: charRoleFilter, charView: charView, character: character, characterAppearsIn: characterAppearsIn, characterFamilyIds: characterFamilyIds, characterPaneRef: characterPaneRef, jumpToChapter: jumpToChapter, project: project, setActiveCharacter: setActiveCharacter, setCharRoleFilter: setCharRoleFilter, setCharView: setCharView, setGeneratedTreeOpen: setGeneratedTreeOpen, setSubNavOpen: setSubNavOpen, setTab: setTab, status: status, subNavOpen: subNavOpen, unitTerm: unitTerm, update: update }),
            tab === 'locations' && React.createElement(LocationsTab, { activeLocation: activeLocation, askConfirm: askConfirm, chapters: chapters, distanceToId: distanceToId, jumpToChapter: jumpToChapter, location: location, locationAppearsIn: locationAppearsIn, locationBreadcrumb: locationBreadcrumb, locationChildren: locationChildren, locationConnectionCandidates: locationConnectionCandidates, locationConnections: locationConnections, locationImportantCharacters: locationImportantCharacters, locationPaneRef: locationPaneRef, locationParentCandidates: locationParentCandidates, newPoiName: newPoiName, project: project, setActiveCharacter: setActiveCharacter, setActiveLocation: setActiveLocation, setCharView: setCharView, setDistanceToId: setDistanceToId, setNewPoiName: setNewPoiName, setSubNavOpen: setSubNavOpen, setTab: setTab, status: status, subNavOpen: subNavOpen, unitTerm: unitTerm, update: update }),
            tab === 'maps' && React.createElement(MapsTab, { askConfirm: askConfirm, handleJump: handleJump, project: project, projectId: projectId, update: update }),
            tab === 'timeline' && React.createElement(TimelineTab, { askConfirm: askConfirm, project: project, projectId: projectId, update: update }),
            tab === 'world' && React.createElement(WorldTab, { askConfirm: askConfirm, jumpToWorldBibleEntry: jumpToWorldBibleEntry, project: project, projectId: projectId, setHouseDbId: setHouseDbId, setWorldBibleSearch: setWorldBibleSearch, setWorldCategory: setWorldCategory, update: update, worldBibleAllHouses: worldBibleAllHouses, worldBibleFilteredBrowseEntries: worldBibleFilteredBrowseEntries, worldBibleFilteredHouses: worldBibleFilteredHouses, worldBibleNativeItems: worldBibleNativeItems, worldBibleNativeUnfilteredCount: worldBibleNativeUnfilteredCount, worldBibleSearch: worldBibleSearch, worldCategory: worldCategory }),
            tab === 'glossary' && React.createElement(GlossaryTab, { askConfirm: askConfirm, project: project, projectId: projectId, update: update }),
            tab === 'notes' && React.createElement(NotesTab, { askConfirm: askConfirm, project: project, projectId: projectId, update: update }),
            tab === 'packs' && React.createElement(PacksTab, { askConfirm: askConfirm, handleDeletePack: handleDeletePack, handleSetPackPublishStatus: handleSetPackPublishStatus, handleSetPublishStatus: handleSetPublishStatus, project: project, projectId: projectId, publishStatus: publishStatus, setPackBuilderState: setPackBuilderState, setPublishWizard: setPublishWizard, update: update, writerGuildName: writerGuildName }),
            tab === 'health' && React.createElement(HealthTab, { healthScore: healthScore, healthSections: healthSections, projectId: projectId, totalHealthIssues: totalHealthIssues }),
            tab === 'progress' && React.createElement(ProgressTab, { avgChapterLength: avgChapterLength, dailyGoal: dailyGoal, projectId: projectId, sessionMinutes: sessionMinutes, sessionStart: sessionStart, streak: streak, totalWords: totalWords, update: update, weeklyGoal: weeklyGoal, weeklyWords: weeklyWords, wordsToday: wordsToday }),
            tab === 'achievements' && React.createElement(AchievementsTab, { achievements: achievements, handleUnlockContinue: handleUnlockContinue, levelUpEvent: levelUpEvent, project: project, projectId: projectId, setLevelUpEvent: setLevelUpEvent, setXpGainEvent: setXpGainEvent, unlockQueue: unlockQueue, unlockedAchievementCount: unlockedAchievementCount, writerProgress: writerProgress, xpGainEvent: xpGainEvent }),
            tab === 'settings' && React.createElement(SettingsTab, { askConfirm: askConfirm, chapters: chapters, handleSetPublishStatus: handleSetPublishStatus, now: now, onDeleteProject: onDeleteProject, project: project, projectId: projectId, publishStatus: publishStatus, setProject: setProject, setPublishWizard: setPublishWizard, soundSettings: soundSettings, totalWords: totalWords, update: update, updateSoundSettings: updateSoundSettings, writerGuildName: writerGuildName }))), houseTreeEntry && React.createElement(FamilyTreeModal, { title: houseTreeEntry.topic || 'Unnamed house', subtitle: "Every generation, one tap away.", crestUrl: houseTreeEntry.crestUrl || '', memberIds: houseTreeMemberIds, characters: project.characters, relationships: project.relationships, onSelectCharacter: (id) => { setHouseTreeId(null); setTab('characters'); setCharView('list'); setActiveCharacter(id); }, onClose: () => setHouseTreeId(null), emptyText: "No characters are tagged with this house yet \u2014 open a character's profile and set their House / Clan, then mark family relationships as Parent of / Spouse of / Sibling of." }), generatedTreeOpen && React.createElement(FamilyTreeModal, { title: "Generated Family Tree", subtitle: "Built from every family relationship in the Relationship Web \u2014 non-family links (Friend, Rival, Mentor, Enemy\u2026) are left out.", memberIds: generatedFamilyMemberIds, characters: project.characters, relationships: project.relationships, onSelectCharacter: (id) => { setGeneratedTreeOpen(false); setCharView('list'); setActiveCharacter(id); }, onClose: () => setGeneratedTreeOpen(false), emptyText: "No family relationships yet \u2014 use the form below the web to set Parent, Spouse, Sibling, Grandparent, Uncle/Aunt, Cousin, or another family type between two characters." }), houseDbEntry && React.createElement(HouseDatabasePage, {
        house: houseDbEntry,
        characters: project.characters,
        relationships: project.relationships,
        onSelectMember: (id) => { setHouseDbId(null); setTab('characters'); setCharView('list'); setActiveCharacter(id); },
        onAddMember: () => {
            const nc = { id: uuid(), name: '', alias: '', age: '', birthday: '', race: '', occupation: '', status: '', lifeStatus: '', role: '', portraitUrl: '', houseId: houseDbEntry.id, tags: [], goals: '', personality: '', biography: '', notes: '' };
            update((p) => { p.characters.push(nc); });
            setHouseDbId(null);
            setTab('characters');
            setCharView('list');
            setActiveCharacter(nc.id);
        },
        onViewTree: () => { setHouseTreeId(houseDbEntry.id); setHouseDbId(null); },
        onUpdateField: (key, val) => update((p) => { p.world.find((x) => x.id === houseDbEntry.id)[key] = val; }),
        allHouses: worldBibleAllHouses,
        onNavigateHouse: (id) => setHouseDbId(id),
        onUpdateHouse: (id, key, val) => update((p) => { const w = p.world.find((x) => x.id === id); if (w) w[key] = val; }),
        onCreateBranch: () => {
            const nid = uuid();
            update((p) => { p.world.push({ id: nid, topic: '', category: 'houses', detail: '', crestUrl: '', bannerUrl: '', parentHouseId: houseDbEntry.id, parentRelationship: '' }); });
            setHouseDbId(nid);
        },
        onClose: () => setHouseDbId(null),
    }), packBuilderState && React.createElement(WorldbuildingPackBuilderModal, {
        project: project,
        pack: packBuilderState === 'new' ? null : project.worldbuildingPacks.find((x) => x.id === packBuilderState),
        onSave: handleSavePack,
        onClose: () => setPackBuilderState(null),
    }), publishWizard && React.createElement(PublishingWizard, {
        project: project, initialTarget: publishWizard, writerGuildName: writerGuildName,
        onClose: () => setPublishWizard(null),
        onPublishBook: handleWizardPublishBook,
        onPublishPack: handleWizardPublishPack,
    }), confirmState && React.createElement(ConfirmDialog, { message: confirmState.message, onCancel: () => setConfirmState(null), onConfirm: () => { confirmState.onConfirm(); setConfirmState(null); } }), searchOpen && React.createElement(GlobalSearchOverlay, { project: project, onClose: () => setSearchOpen(false), onJumpResult: handleSearchJump })));
}
