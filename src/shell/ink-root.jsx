import React, { useState, useEffect } from 'react';
import { storage } from '../lib/storage.js';
import { publishBookRemote, unpublishBookRemote } from '../lib/library.js';
import { joinPlayerGuildByCode, leavePlayerGuildRemote, syncPlayerGuild } from '../lib/player-guild.js';
import { syncProfile } from '../lib/profile.js';
import { founderGuildById, freshGuildMembership, guildCooldownRemainingMs, normalizeGuildMembership } from '../guild/guild-hall.jsx';
import { PublishedBookReader } from '../library/author-reputation.jsx';
import { AuthorsHallScreen } from '../library/authors-hall-screen.jsx';
import { GrandLibraryScreen } from '../library/grand-library-screen.jsx';
import { LibraryAuthorLink, PublishingWizard } from '../library/publishing.jsx';
import { optimizeProjectImages } from '../shared-ui/image-utils.jsx';
import { GUILD_KEY, INDEX_KEY, LEGACY_KEY, PROFILE_KEY, projectKey, uuid } from '../shared-utils/storage-keys.jsx';
import { wordCount } from '../shared-utils/strip-html.jsx';
import { dateKey } from '../shared-utils/truncate.jsx';
import { HomeScreen } from './home-screen.jsx';
import { useNav } from './nav-context.jsx';
import { packSummaryForIndex } from '../worldbuilding/book-cover.jsx';
import { aggregateWriterStats } from '../writing/achievements.jsx';
import { SCHEMA_VERSION, backupsKey, emptyProject, patchProjectDefaults, reclaimBackupSpace, restoreProject } from '../writing/project-schema-and-backups.jsx';
import { ProjectWorkspace } from '../writing/project-workspace.jsx';


// ---------- App root: routes between home and a project ----------
export function InkRoot() {
    const [projects, setProjects] = useState(null);
    const [currentId, setCurrentId] = useState(null);
    const [openTab, setOpenTab] = useState('hub'); // which tab ProjectWorkspace should land on next open
    const [writerProfile, setWriterProfile] = useState(null); // the writer's identity — separate from any project
    const [guildProfile, setGuildProfile] = useState(null); // the writer's Guild — also separate from any project
    // Reputation earned inside a guild (published books, completed guild quests, Fireside posts) —
    // computed once in the Guild Hall and shared here so it also shows up on the Writer Profile.
    const [writerReputation, setWriterReputation] = useState(null);
    // Which author's Author's Hall (if any) is currently showing. null = not showing one. Any
    // string (including '') identifies the pen name being viewed — resolved to either the private
    // (isSelf) or public view further down, depending on whether it matches this device's own
    // writer identity.
    const [viewingAuthorName, setViewingAuthorName] = useState(null);
    // Whether the Hall currently open is this device's own, decided once at navigation time in
    // openAuthorHall — NOT recomputed from a live name comparison on every render. It used to be
    // re-derived by comparing viewingAuthorName against the writer's current name each render,
    // which meant editing your own name (which updates writerProfile live, keystroke by keystroke)
    // made the comparison stop matching mid-edit and flip you onto the read-only "someone else's
    // Hall" view — a forced remount that looked like being kicked to another profile while typing.
    const [viewingIsSelf, setViewingIsSelf] = useState(false);
    // Lets "Open Creator Dashboard" (on the Author's Hall) land Author Studio's segmented switch
    // straight on 'studio' instead of the default 'reader' mode — see GrandLibraryScreen's
    // initialMode prop, which only reads this once per mount, same pattern as ProjectWorkspace's
    // initialTab below.
    const [libraryInitialMode, setLibraryInitialMode] = useState('reader');
    const [writerRank, setWriterRank] = useState(null); // lifetime rank, lazily tallied for the completed-project shelf badge
    const [writerLevel, setWriterLevel] = useState(1); // lifetime level, tallied alongside writerRank — feeds the Home screen's Guild-lock progress
    const [lifetimeStats, setLifetimeStats] = useState({ totalWords: 0, chapters: 0, completedCount: 0 }); // feeds Guild Quests' real progress bars
    // Which of Home's three tabs ('home' | 'guild' | 'library') is showing. Owned here rather than
    // inside HomeScreen because HomeScreen itself unmounts and remounts every time the writer opens
    // a project or their Writer Profile and comes back — InkRoot never unmounts, so this is the one
    // place the value (and the undo closures the nav stack holds onto for it) can stay valid for as
    // long as the nav stack itself remembers being on the Guild Hall or Grand Library.
    const [homeActiveTab, setHomeActiveTab] = useState('home');
    // The reader-facing counterpart to currentId/ProjectWorkspace below: set when a reader taps a
    // book in the Grand Library or a Guild's bookshelf. Kept entirely separate from currentId so
    // there is no code path from a published book into the author's full project workspace —
    // readingBookProject only ever holds what PublishedBookReader is given (chapters, title,
    // author), fetched fresh from storage rather than reusing any in-memory author session state.
    const [readingBookId, setReadingBookId] = useState(null);
    const [readingBookProject, setReadingBookProject] = useState(null);
    const nav = useNav();
    const openProject = (id, tab) => {
        const proj = (projects || []).find((p) => p.id === id);
        nav.push({ label: (proj && proj.title) || 'Project', undo: () => setCurrentId(null) });
        setOpenTab(tab || 'hub'); setCurrentId(id);
    };
    const openReaderBook = (id) => {
        const meta = (projects || []).find((p) => p.id === id);
        nav.push({ label: (meta && meta.title) || 'Book', undo: () => { setReadingBookId(null); setReadingBookProject(null); } });
        setReadingBookProject(null); // clear any previous book while the new one loads
        setReadingBookId(id);
        storage.get(projectKey(id)).then((res) => {
            if (!res)
                return;
            try {
                setReadingBookProject(patchProjectDefaults(JSON.parse(res.value)));
            }
            catch (e) { }
        });
    };
    // The single entry point every clickable author name/avatar/rank in the app routes through —
    // published books, the Grand Library, Author Studio listings, guilds, guild feedback, and book
    // pages alike (see LibraryAuthorLink and its call sites). A blank/omitted name means "open my
    // own Hall"; any other name opens that pen name's Hall, which the render logic below resolves
    // to either the private (isSelf) or public view depending on whether it matches this device's
    // own writer identity.
    const openAuthorHall = (name) => {
        const trimmed = (name || '').trim();
        const selfName = (writerProfile && (writerProfile.penName || writerProfile.name) || '').trim();
        const isSelf = !trimmed || (selfName && trimmed.toLowerCase() === selfName.toLowerCase());
        nav.push({ label: isSelf ? "Your Author's Hall" : trimmed, undo: () => { setViewingAuthorName(null); setViewingIsSelf(false); } });
        setViewingAuthorName(isSelf ? selfName : trimmed);
        setViewingIsSelf(isSelf);
    };
    const openProfile = () => openAuthorHall(null);
    // From the Author's Hall's "Open Creator Dashboard" button: leaves the Hall, lands on Home with
    // the Grand Library tab active and Author Studio's segmented switch pre-set to 'studio' — the
    // same place Author Studio has always lived, just reached in one tap from the Hall now too.
    const openCreatorDashboard = () => {
        setLibraryInitialMode('studio');
        setHomeActiveTab('library');
        setViewingAuthorName(null);
        nav.resetTo({ label: 'Grand Library', key: 'library:' + Date.now() });
    };
    useEffect(() => {
        if (!projects || !projects.length) {
            setWriterRank(null);
            setWriterLevel(1);
            setLifetimeStats({ totalWords: 0, chapters: 0, completedCount: 0 });
            return;
        }
        let cancelled = false;
        (async () => {
            const full = [];
            for (const meta of projects) {
                try {
                    const res = await storage.get(projectKey(meta.id));
                    if (res)
                        full.push(patchProjectDefaults(JSON.parse(res.value)));
                }
                catch (e) { /* skip a project that fails to parse rather than blocking the tally */ }
            }
            if (!cancelled) {
                const aggregated = aggregateWriterStats(full);
                setWriterRank(aggregated.rank);
                setWriterLevel(aggregated.level);
                setLifetimeStats(aggregated);
            }
        })();
        return () => { cancelled = true; };
    }, [projects]);
    useEffect(() => {
        (async () => {
            const res = await storage.get(PROFILE_KEY);
            if (res) {
                setWriterProfile(JSON.parse(res.value));
                return;
            }
            const fresh = { name: '', penName: '', motto: '', avatar: null, joinDate: new Date().toISOString() };
            await storage.set(PROFILE_KEY, JSON.stringify(fresh));
            setWriterProfile(fresh);
        })();
    }, []);
    const saveProfile = (patch) => {
        setWriterProfile((prev) => {
            const next = { ...(prev || { name: '', penName: '', motto: '', avatar: null, joinDate: new Date().toISOString() }), ...patch };
            storage.set(PROFILE_KEY, JSON.stringify(next));
            // Best-effort, non-blocking — a no-op when signed out, so local-only profile
            // editing is completely unaffected. Pushes the full current profile (not just the
            // patch) since profiles.* columns are simple overwrites, not merges.
            syncProfile({ name: next.name, penName: next.penName, avatar: next.avatar }).catch((e) => console.warn('Inkroot: profile sync failed', e));
            return next;
        });
    };
    useEffect(() => {
        (async () => {
            const res = await storage.get(GUILD_KEY);
            if (res) {
                setGuildProfile(normalizeGuildMembership(JSON.parse(res.value)));
                return;
            }
            const fresh = freshGuildMembership();
            await storage.set(GUILD_KEY, JSON.stringify(fresh));
            setGuildProfile(fresh);
        })();
    }, []);
    // Takes a seat in one of the ten permanent Founder Guilds — required before a writer can go
    // on to found a Guild of their own. A writer belongs to only one Guild at a time, so this is a
    // no-op if they're already in a guild or still cooling down from having left one.
    const joinFounderGuild = (founderGuildId) => {
        setGuildProfile((prev) => {
            const base = prev || freshGuildMembership();
            if (base.guildType || guildCooldownRemainingMs(base) > 0)
                return base;
            const next = { ...base, guildType: 'founder', founderGuildId, founderJoinedDate: new Date().toISOString() };
            storage.set(GUILD_KEY, JSON.stringify(next));
            return next;
        });
    };
    // Leaves whichever guild the writer currently holds a seat in (Founder, Player, or Joined)
    // and starts the cooldown before another can be joined. The guild itself isn't affected —
    // Founder Guilds are permanent regardless, and a Player Guild's data (owned or the record of
    // which guild was joined) is kept so the writer can return to it later, once the cooldown
    // has passed.
    const leaveCurrentGuild = () => {
        setGuildProfile((prev) => {
            const base = prev || freshGuildMembership();
            if (!base.guildType)
                return base;
            const next = { ...base, guildType: null, leftAt: new Date().toISOString() };
            storage.set(GUILD_KEY, JSON.stringify(next));
            if (base.guildType === 'joined' && base.joinedGuild && base.joinedGuild.id) {
                leavePlayerGuildRemote(base.joinedGuild.id).catch((e) => console.warn('Inkroot: remote guild leave failed', e));
            }
            return next;
        });
    };
    // Takes the seat in the writer's own Player Guild — founding it on first use, or simply
    // returning to it later. Like joining a Founder Guild, this requires not currently being in a
    // guild and not still cooling down from having left one.
    const enterOwnGuild = () => {
        setGuildProfile((prev) => {
            const base = prev || freshGuildMembership();
            if (base.guildType || guildCooldownRemainingMs(base) > 0)
                return base;
            const isFirstFounding = !base.playerGuild;
            const existingPlayer = base.playerGuild || { id: uuid(), name: '', crest: null, motto: '', createdDate: new Date().toISOString() };
            const next = { ...base, guildType: 'player', playerGuild: existingPlayer };
            storage.set(GUILD_KEY, JSON.stringify(next));
            // Best-effort remote sync, same non-blocking philosophy as everywhere else signed-
            // in-only in this app — a no-op when signed out. Only meaningful to announce (via
            // the log below) the very first time, since every later re-entry already has a
            // synced row from before.
            syncPlayerGuild(existingPlayer.id, { name: existingPlayer.name, motto: existingPlayer.motto, crestUrl: existingPlayer.crest })
                .then((row) => { if (row && isFirstFounding)
                    saveOwnGuild({ inviteCode: row.invite_code }); })
                .catch((e) => console.warn('Inkroot: guild sync failed', e));
            return next;
        });
    };
    // Edits the writer's own Player Guild (name, motto, crest) once they're seated in it.
    const saveOwnGuild = (patch) => {
        setGuildProfile((prev) => {
            const base = prev || freshGuildMembership();
            const existingPlayer = base.playerGuild || { id: uuid(), name: '', crest: null, motto: '', createdDate: new Date().toISOString() };
            const next = { ...base, playerGuild: { ...existingPlayer, ...patch } };
            storage.set(GUILD_KEY, JSON.stringify(next));
            // Only push name/motto/crest edits remotely, never inviteCode itself (that field is
            // server-generated and only ever written locally as a mirror of what came back from
            // syncPlayerGuild above — pushing it back up would be redundant, not wrong, but
            // there's no reason to).
            if ('name' in patch || 'motto' in patch || 'crest' in patch) {
                syncPlayerGuild(existingPlayer.id, {
                    name: patch.name != null ? patch.name : existingPlayer.name,
                    motto: patch.motto != null ? patch.motto : existingPlayer.motto,
                    crestUrl: patch.crest != null ? patch.crest : existingPlayer.crest,
                }).catch((e) => console.warn('Inkroot: guild sync failed', e));
            }
            return next;
        });
    };
    // Joins another writer's Player Guild by invite code. Requires being signed in (the remote
    // call itself enforces this) and not currently seated in — or cooling down from — a guild.
    const [joinCodeError, setJoinCodeError] = useState('');
    const joinGuildByCode = async (code) => {
        setJoinCodeError('');
        if (guildProfile && (guildProfile.guildType || guildCooldownRemainingMs(guildProfile) > 0))
            return;
        try {
            const guild = await joinPlayerGuildByCode(code);
            setGuildProfile((prev) => {
                const base = prev || freshGuildMembership();
                const next = {
                    ...base, guildType: 'joined',
                    joinedGuild: { id: guild.id, name: guild.name, motto: guild.motto, crest: guild.crest_url, ownerId: guild.owner_id, joinedDate: new Date().toISOString() },
                };
                storage.set(GUILD_KEY, JSON.stringify(next));
                return next;
            });
        }
        catch (e) {
            setJoinCodeError(e.message || 'Could not join that guild.');
        }
    };
    useEffect(() => {
        (async () => {
            try {
                const res = await storage.get(INDEX_KEY);
                if (res) {
                    setProjects(JSON.parse(res.value));
                    return;
                }
                // Migrate a pre-multi-project save, if one exists, so nobody loses work.
                const legacy = await storage.get(LEGACY_KEY);
                if (legacy) {
                    const data = patchProjectDefaults(JSON.parse(legacy.value));
                    const id = uuid();
                    await storage.set(projectKey(id), JSON.stringify(data));
                    const total = data.chapters.reduce((s, c) => s + wordCount(c.text), 0);
                    const index = [{ id, title: data.title, subtitle: data.subtitle || '', seriesName: data.seriesName || '', author: data.author || '', cover: data.cover || null, wordCount: total, updatedAt: Date.now() }];
                    await storage.set(INDEX_KEY, JSON.stringify(index));
                    setProjects(index);
                    return;
                }
                setProjects([]);
            }
            catch (e) {
                setProjects([]);
            }
        })();
    }, []);
    const saveIndex = (next) => {
        setProjects(next);
        storage.set(INDEX_KEY, JSON.stringify(next));
    };
    const handleCreate = () => {
        const id = uuid();
        const fresh = emptyProject();
        storage.set(projectKey(id), JSON.stringify(fresh));
        const entry = { id, title: fresh.title, subtitle: '', seriesName: '', author: '', cover: fresh.cover, wordCount: 0, updatedAt: Date.now() };
        saveIndex([...(projects || []), entry]);
        nav.push({ label: fresh.title || 'Project', undo: () => setCurrentId(null) });
        setOpenTab('hub');
        setCurrentId(id);
    };
    const handleMeta = (id, meta) => {
        setProjects((prev) => {
            const next = (prev || []).map((p) => (p.id === id ? { ...p, ...meta } : p));
            storage.set(INDEX_KEY, JSON.stringify(next));
            return next;
        });
    };
    // Grand Library > Author Studio: sets a completed project's publish destination ('none',
    // 'inkroot', or 'guild') from outside the project itself. The full project object (not just
    // the index entry) is the source of truth — same reasoning as `completed` elsewhere in the
    // app (Legacy Shelf, Guild XP, Guild Reputation) — so this loads it, sets the one field, and
    // saves it back, then patches the index via handleMeta so Home and the Grand Library reflect
    // it immediately without needing to open the project. Promoting a Guild publication to
    // Inkroot is just this same call with 'inkroot' — the project record never gets duplicated.
    const setPublishStatus = async (id, status) => {
        const res = await storage.get(projectKey(id));
        if (!res)
            return;
        let proj;
        try {
            proj = JSON.parse(res.value);
        }
        catch (e) {
            return;
        }
        const publishedAt = status !== 'none' ? Date.now() : null;
        proj.publishStatus = status;
        proj.publishedAt = publishedAt;
        await storage.set(projectKey(id), JSON.stringify(proj));
        handleMeta(id, { publishStatus: status, publishedAt });
        // Best-effort remote sync — a no-op if not signed in, so local-only publishing behaves
        // exactly as it did before Phase 2. Not awaited: the local write above is what the
        // writer's own UI reflects immediately, same as everything else storage-backed in this
        // app; a failed remote push just means the listing stays local until the next attempt,
        // it never blocks or fails the local action itself.
        if (status === 'none') {
            unpublishBookRemote(id).catch((e) => console.warn('Inkroot: remote unpublish failed', e));
        }
        else {
            publishBookRemote({
                id, title: proj.title, blurb: proj.blurb, genre: proj.genre, tags: proj.tags,
                price: proj.price, destination: status, publishedAt,
            }).catch((e) => console.warn('Inkroot: remote publish failed', e));
        }
    };
    // Same idea as setPublishStatus above, but for a single Worldbuilding Pack inside a project
    // rather than the project's own book publication. Lets the Grand Library's Author Studio
    // unpublish a pack directly, without opening the project that owns it — the project file is
    // still the source of truth, this just loads it, updates the one pack, saves it back, and
    // re-mirrors every pack's summary onto the index (see packSummaryForIndex) so what the
    // Library shows stays current.
    const setPackPublishStatus = async (projectId, packId, status) => {
        const res = await storage.get(projectKey(projectId));
        if (!res)
            return;
        let proj;
        try {
            proj = JSON.parse(res.value);
        }
        catch (e) {
            return;
        }
        const patched = patchProjectDefaults(proj);
        const pack = patched.worldbuildingPacks.find((p) => p.id === packId);
        if (!pack)
            return;
        pack.publishStatus = status;
        pack.publishedAt = status !== 'none' ? Date.now() : null;
        pack.updatedAt = Date.now();
        await storage.set(projectKey(projectId), JSON.stringify(patched));
        handleMeta(projectId, { worldbuildingPacks: patched.worldbuildingPacks.map((pk) => packSummaryForIndex(patched, pk)) });
    };
    // Confirm handlers for the Publishing Wizard (see PublishingWizard) when it's opened from
    // Author Studio, which — unlike a project's own Settings tab — doesn't have the project
    // loaded, only its index entry. Same read-modify-write pattern as setPublishStatus /
    // setPackPublishStatus just above, just also writing the listing fields Step 3 collected
    // (title, description, genre, tags, price, and — for a pack — its cover) rather than only
    // the publish status, and mirroring the same fields onto the index afterward.
    const publishBookWithDetails = async (id, destination, details) => {
        const res = await storage.get(projectKey(id));
        if (!res)
            return;
        let proj;
        try {
            proj = JSON.parse(res.value);
        }
        catch (e) {
            return;
        }
        const publishedAt = Date.now();
        proj.publishStatus = destination;
        proj.publishedAt = publishedAt;
        proj.title = details.title || proj.title;
        proj.genre = details.genre;
        proj.blurb = details.description;
        proj.tags = details.tags;
        proj.price = details.priceMode === 'paid' ? details.price : 0;
        if (details.storyFormat === 'series' || details.storyFormat === 'book')
            proj.storyFormat = details.storyFormat;
        await storage.set(projectKey(id), JSON.stringify(proj));
        handleMeta(id, { publishStatus: destination, publishedAt, title: proj.title, genre: proj.genre, blurb: proj.blurb, tags: proj.tags, price: proj.price, storyFormat: proj.storyFormat || 'book' });
        // See the matching comment in setPublishStatus above — same best-effort, non-blocking
        // remote push, using the freshly-set listing details from this wizard step.
        publishBookRemote({
            id, title: proj.title, blurb: proj.blurb, genre: proj.genre, tags: proj.tags,
            price: proj.price, destination, publishedAt, storyFormat: proj.storyFormat || 'book',
        }).catch((e) => console.warn('Inkroot: remote publish failed', e));
    };
    const publishPackWithDetails = async (projectId, packId, destination, details) => {
        const res = await storage.get(projectKey(projectId));
        if (!res)
            return;
        let proj;
        try {
            proj = JSON.parse(res.value);
        }
        catch (e) {
            return;
        }
        const patched = patchProjectDefaults(proj);
        const pack = patched.worldbuildingPacks.find((p) => p.id === packId);
        if (!pack)
            return;
        pack.publishStatus = destination;
        pack.publishedAt = Date.now();
        pack.title = details.title || pack.title;
        pack.description = details.description;
        pack.genre = details.genre;
        pack.tags = details.tags;
        pack.coverImageUrl = details.coverImageUrl;
        pack.price = details.priceMode === 'paid' ? details.price : 0;
        pack.updatedAt = Date.now();
        await storage.set(projectKey(projectId), JSON.stringify(patched));
        handleMeta(projectId, { worldbuildingPacks: patched.worldbuildingPacks.map((pk) => packSummaryForIndex(patched, pk)) });
    };
    const handleDelete = (id) => {
        storage.delete(projectKey(id));
        storage.delete(backupsKey(projectKey(id)));
        saveIndex((projects || []).filter((p) => p.id !== id));
    };
    const handleDeleteCurrent = (id) => {
        storage.delete(projectKey(id));
        storage.delete(backupsKey(projectKey(id)));
        saveIndex((projects || []).filter((p) => p.id !== id));
        // The project this trail was pointing at no longer exists, so restart from Home rather
        // than trying to "undo" back into a screen that's now gone.
        nav.resetTo(null);
        setCurrentId(null);
    };
    // Storage quota is shared across every project in this browser, not allocated per-project —
    // so a project can still fail to save even after its own images are optimized, if other
    // projects (or their old backups, from before backups stripped heavy media) are what's using
    // up the room. This sweeps every project on the device, not just the one currently open.
    const handleOptimizeAllStorage = async () => {
        let totalFreed = 0, touchedProjects = 0;
        for (const meta of (projects || [])) {
            const res = await storage.get(projectKey(meta.id));
            if (!res)
                continue;
            let proj;
            try {
                proj = JSON.parse(res.value);
            }
            catch (e) {
                continue;
            }
            const before = res.value.length;
            const { project: optimized, freedBytes } = await optimizeProjectImages(proj);
            const backupFreed = await reclaimBackupSpace(projectKey(meta.id));
            const serialized = JSON.stringify(optimized);
            if (serialized.length < before) {
                try {
                    await storage.set(projectKey(meta.id), serialized);
                    touchedProjects++;
                }
                catch (e) { }
            }
            totalFreed += freedBytes + backupFreed;
        }
        return { totalFreed, touchedProjects };
    };
    const handleExportAll = async () => {
        const bundle = { exportedFrom: 'inkroot', schemaVersion: SCHEMA_VERSION, exportedAt: new Date().toISOString(), projects: [] };
        for (const meta of (projects || [])) {
            const res = await storage.get(projectKey(meta.id));
            if (res)
                bundle.projects.push(JSON.parse(res.value));
        }
        const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `inkroot-backup-${dateKey(new Date())}.json`;
        a.click();
        URL.revokeObjectURL(url);
    };
    const handleImportFile = (file) => new Promise((resolve) => {
        const reader = new FileReader();
        reader.onerror = () => resolve('Could not read that file.');
        reader.onload = () => {
            try {
                const parsed = JSON.parse(reader.result);
                const incoming = Array.isArray(parsed.projects) ? parsed.projects : (parsed.chapters ? [parsed] : null);
                if (!incoming || incoming.length === 0) {
                    resolve('That file doesn\'t look like an Inkroot backup.');
                    return;
                }
                const newEntries = incoming.map((raw) => {
                    // restoreProject (not just patchProjectDefaults) so we also get back which, if
                    // any, schema migrations ran for this specific project being restored.
                    const { data, log } = restoreProject(raw);
                    const id = uuid();
                    storage.set(projectKey(id), JSON.stringify(data));
                    const total = data.chapters.reduce((s, c) => s + wordCount(c.text), 0);
                    return { id, title: data.title, subtitle: data.subtitle || '', seriesName: data.seriesName || '', author: data.author || '', cover: data.cover || null, wordCount: total, updatedAt: Date.now(), migrated: log.length > 0 };
                });
                saveIndex([...(projects || []), ...newEntries]);
                const migratedCount = newEntries.filter((e) => e.migrated).length;
                const migratedNote = migratedCount > 0
                    ? ` (${migratedCount} upgraded from an older backup format — see console for details)`
                    : '';
                resolve(`Imported ${newEntries.length} project${newEntries.length === 1 ? '' : 's'}${migratedNote}.`);
            }
            catch (e) {
                resolve('Could not read that file — is it an Inkroot backup?');
            }
        };
        reader.readAsText(file);
    });
    if (projects === null) {
        return (React.createElement("div", { style: { minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#17171B', color: '#EFE7D2', fontFamily: 'ui-sans-serif, system-ui' } }, "Opening Inkroot\u2026"));
    }
    if (currentId) {
        return React.createElement("div", { key: "workspace-" + currentId, className: "ink-page-in" },
            React.createElement(ProjectWorkspace, { projectId: currentId, onBack: () => nav.pop(), onMeta: handleMeta, onDeleteProject: handleDeleteCurrent, initialTab: openTab, guildProfile: guildProfile }));
    }
    if (readingBookId) {
        return React.createElement("div", { key: "reader-" + readingBookId, className: "ink-page-in" },
            readingBookProject
                ? React.createElement(PublishedBookReader, { project: readingBookProject, onBack: () => nav.pop() })
                : React.createElement("div", { style: { minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#17171B', color: '#EFE7D2', fontFamily: 'ui-sans-serif, system-ui' } }, "Opening book\u2026"));
    }
    if (viewingAuthorName !== null && writerProfile) {
        const selfName = ((writerProfile.penName || writerProfile.name) || '').trim();
        const isSelf = viewingIsSelf;
        const authorHallGuildName = (() => {
            if (!guildProfile || !guildProfile.guildType)
                return null;
            if (guildProfile.guildType === 'player')
                return (guildProfile.playerGuild && guildProfile.playerGuild.name) || 'my guild';
            const fg = founderGuildById(guildProfile.founderGuildId);
            return (fg && fg.name) || 'my guild';
        })();
        return React.createElement("div", { key: "authorhall-" + (isSelf ? 'self' : viewingAuthorName), className: "ink-page-in" },
            React.createElement(AuthorsHallScreen, {
                isSelf, authorName: isSelf ? selfName : viewingAuthorName,
                profile: writerProfile, projects: projects, onSaveProfile: saveProfile,
                onBack: () => nav.pop(), onOpenProjectHall: (id) => openProject(id, 'achievements'),
                guildReputation: writerReputation, writerGuildName: authorHallGuildName,
                onOpenCreatorDashboard: openCreatorDashboard, onRead: openReaderBook,
            }));
    }
    return React.createElement("div", { key: "home", className: "ink-page-in" },
        React.createElement(HomeScreen, { projects: projects, onOpen: (id) => openProject(id, 'hub'), onReadBook: openReaderBook, onOpenHealth: (id) => openProject(id, 'health'), onOpenPacks: (id) => openProject(id, 'packs'), onCreate: handleCreate, onDelete: handleDelete, onExportAll: handleExportAll, onImportFile: handleImportFile, onOptimizeAll: handleOptimizeAllStorage, writerProfile: writerProfile, onOpenProfile: openProfile, writerRank: writerRank, writerLevel: writerLevel, writerReputation: writerReputation, guildProfile: guildProfile, onJoinFounderGuild: joinFounderGuild, onLeaveGuild: leaveCurrentGuild, onEnterOwnGuild: enterOwnGuild, onSaveOwnGuild: saveOwnGuild, onJoinGuildByCode: joinGuildByCode, joinCodeError: joinCodeError, lifetimeStats: lifetimeStats, onReputationChange: setWriterReputation, onSetPublishStatus: setPublishStatus, onSetPackPublishStatus: setPackPublishStatus, onPublishBookWithDetails: publishBookWithDetails, onPublishPackWithDetails: publishPackWithDetails, activeTab: homeActiveTab, setActiveTab: setHomeActiveTab, onOpenAuthor: openAuthorHall, libraryInitialMode: libraryInitialMode }));
}
