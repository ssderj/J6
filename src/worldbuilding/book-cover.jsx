import React from 'react';
import { truncate } from '../shared-utils/truncate.jsx';


export const WORLD_CATEGORIES = [
    { key: 'houses', icon: '⚜', label: 'Houses & Clans', placeholder: 'House, family, or clan name…' },
    { key: 'organizations', icon: '🏛', label: 'Organizations', placeholder: 'Organization or faction name…' },
    { key: 'artifacts', icon: '🗝', label: 'Artifacts', placeholder: 'Artifact or relic name…' },
    { key: 'magic', icon: '✨', label: 'Magic', placeholder: 'System, spell, or rule of magic…' },
    { key: 'religions', icon: '⛩', label: 'Religions', placeholder: 'Faith, deity, or order…' },
    { key: 'creatures', icon: '🐉', label: 'Creatures', placeholder: 'Species or creature name…' },
];


export function worldCategoryMeta(key) {
    return WORLD_CATEGORIES.find((c) => c.key === key) || { key: '', icon: '🌍', label: 'General', placeholder: 'Topic (custom, faction, rule, history…)' };
}


// Category-specific structured fields for Organizations, Magic, Religions, and Artifacts — each
// returns the extra editable `fields` CardList should render, and the matching `quickStats` rows
// (a subset of those same keys) surfaced in the Quick Stats card at the top of each entry. Houses
// have their own dedicated page (HouseDatabasePage) with a much richer field set, so they're not
// included here.
export function worldExtraFields(category) {
    if (category === 'organizations') {
        return {
            fields: [
                { key: 'leader', placeholder: 'Who leads this organization…' },
                { key: 'orgType', kind: 'select', options: [{ value: '', label: 'Type…' }, ...ORG_TYPES.map((t) => ({ value: t, label: t }))] },
                { key: 'headquarters', placeholder: 'Where it operates from…' },
                { key: 'orgStatus', kind: 'select', options: [{ value: '', label: 'Status…' }, ...ORG_STATUSES.map((s) => ({ value: s, label: s }))] },
            ],
            quickStats: [
                { key: 'leader', label: 'Leader' },
                { key: 'orgType', label: 'Type' },
                { key: 'headquarters', label: 'Headquarters' },
                { key: 'orgStatus', label: 'Status' },
            ],
            defaults: { leader: '', orgType: '', headquarters: '', orgStatus: '' },
        };
    }
    if (category === 'magic') {
        return {
            fields: [
                { key: 'source', placeholder: 'Where its power comes from\u2014bloodline, the Weave, pacts\u2026' },
                { key: 'cost', placeholder: 'The price of using it\u2014life force, memories, sanity\u2026' },
                { key: 'practitioners', placeholder: 'Who can wield it…' },
            ],
            quickStats: [
                { key: 'source', label: 'Source' },
                { key: 'cost', label: 'Cost / Limitation' },
                { key: 'practitioners', label: 'Practitioners' },
            ],
            defaults: { source: '', cost: '', practitioners: '' },
        };
    }
    if (category === 'religions') {
        return {
            fields: [
                { key: 'deity', placeholder: 'Deity or pantheon\u2026' },
                { key: 'domain', placeholder: 'Domain\u2014death, war, harvest\u2026' },
                { key: 'holySite', placeholder: 'Holy site or seat of worship\u2026' },
                { key: 'followers', placeholder: 'Who follows this faith\u2026' },
            ],
            quickStats: [
                { key: 'deity', label: 'Deity / Pantheon' },
                { key: 'domain', label: 'Domain' },
                { key: 'holySite', label: 'Holy Site' },
                { key: 'followers', label: 'Followers' },
            ],
            defaults: { deity: '', domain: '', holySite: '', followers: '' },
        };
    }
    if (category === 'artifacts') {
        return {
            fields: [
                { key: 'power', placeholder: 'What it does…' },
                { key: 'currentOwner', placeholder: 'Who holds it now…' },
                { key: 'artifactStatus', kind: 'select', options: [{ value: '', label: 'Status…' }, ...ARTIFACT_STATUSES.map((s) => ({ value: s, label: s }))] },
            ],
            quickStats: [
                { key: 'power', label: 'Power' },
                { key: 'currentOwner', label: 'Current Owner' },
                { key: 'artifactStatus', label: 'Status' },
            ],
            defaults: { power: '', currentOwner: '', artifactStatus: '' },
        };
    }
    return { fields: [], quickStats: null, defaults: {} };
}


// ---------- World Bible: unified category architecture (V9) ----------
// The World Bible screen's sidebar. Five of these (houses, organizations, magic, religions,
// artifacts) still edit project.world directly via the existing category-tagged CardList.
// Four more (characters, locations, timeline, glossary) surface each database's OWN full tab —
// this screen just browses and jumps to them, since duplicating their editors here would mean
// maintaining two copies of each. Family Trees isn't a new dataset: a "family tree" IS a House &
// Clan entry (its members come from characters tagged with that house) — this category just
// gives that existing view its own front door instead of hiding it as a footer link. "All"
// combines every one of the above into a single searchable list.
export const WORLD_BIBLE_CATEGORIES = [
    { key: 'all', icon: '🌍', label: 'All' },
    { key: 'characters', icon: '👤', label: 'Characters' },
    { key: 'houses', icon: '👑', label: 'Houses & Clans' },
    { key: 'familyTrees', icon: '🌳', label: 'Family Trees', isNew: true },
    { key: 'locations', icon: '📍', label: 'Locations' },
    { key: 'timeline', icon: '📅', label: 'Timeline' },
    { key: 'organizations', icon: '🏛', label: 'Organizations' },
    { key: 'magic', icon: '✨', label: 'Magic' },
    { key: 'religions', icon: '⛩', label: 'Religions' },
    { key: 'artifacts', icon: '🔑', label: 'Artifacts' },
    { key: 'glossary', icon: '📚', label: 'Glossary' },
];


export const NATIVE_WORLD_KEYS = ['houses', 'organizations', 'magic', 'religions', 'artifacts'];

 // still use the full CardList editor
// ---------- Worldbuilding Packs ----------
// Every browsable World Bible category (everything in WORLD_BIBLE_CATEGORIES except the two
// meta-views 'all' and 'familyTrees', which aren't datasets of their own) can be included in a
// Worldbuilding Pack. A pack doesn't copy this data — it stores which entry ids from THIS
// project it includes (pack.selection), so editing an entry later is reflected everywhere the
// pack is shown without needing to "republish".
export const PACK_CATEGORY_KEYS = ['characters', 'locations', 'houses', 'organizations', 'magic', 'religions', 'artifacts', 'timeline', 'glossary'];


// Turns one entry from any source into a common shape for the unified "All" browse view and
// cross-category search. `type` matches the type strings goToCharacter/goToLocation/handleJump
// already understand, so a row can jump straight to wherever that entry actually lives.
export function normalizeWorldBibleEntry(sourceKey, item) {
    if (sourceKey === 'characters')
        return { id: item.id, type: 'character', typeLabel: 'Character', name: item.name || 'Unnamed', snippet: item.role || item.occupation || '' };
    if (sourceKey === 'locations')
        return { id: item.id, type: 'location', typeLabel: 'Location', name: item.name || 'Unnamed', snippet: item.region || '' };
    if (sourceKey === 'timeline')
        return { id: item.id, type: 'timeline', typeLabel: 'Timeline Event', name: item.what || 'Untitled event', snippet: item.when || '' };
    if (sourceKey === 'glossary')
        return { id: item.id, type: 'glossary', typeLabel: 'Glossary Term', name: item.term || 'Unnamed', snippet: truncate(item.definition || '', 60) };
    return { id: item.id, type: 'world', category: item.category, typeLabel: worldCategoryMeta(item.category).label, name: item.topic || 'Unnamed', snippet: truncate(item.detail || '', 60), crestUrl: item.category === 'houses' ? (item.crestUrl || '') : '' };
}


// Returns the normalized, searchable entry list for one World Bible sidebar category. Native
// world categories (houses, organizations, ...) aren't included — those still use the full
// CardList editor, filtered separately.
export function worldBibleEntries(project, key) {
    if (key === 'characters')
        return project.characters.map((c) => normalizeWorldBibleEntry('characters', c));
    if (key === 'locations')
        return project.locations.map((l) => normalizeWorldBibleEntry('locations', l));
    if (key === 'timeline')
        return project.timeline.map((t) => normalizeWorldBibleEntry('timeline', t));
    if (key === 'glossary')
        return project.glossary.map((g) => normalizeWorldBibleEntry('glossary', g));
    if (key === 'familyTrees')
        return project.world.filter((w) => w.category === 'houses').map((w) => normalizeWorldBibleEntry('world', w));
    if (key === 'all') {
        return [
            ...project.characters.map((c) => normalizeWorldBibleEntry('characters', c)),
            ...project.locations.map((l) => normalizeWorldBibleEntry('locations', l)),
            ...project.timeline.map((t) => normalizeWorldBibleEntry('timeline', t)),
            ...project.glossary.map((g) => normalizeWorldBibleEntry('glossary', g)),
            ...project.world.map((w) => normalizeWorldBibleEntry('world', w)),
        ];
    }
    return project.world.filter((w) => w.category === key).map((w) => normalizeWorldBibleEntry('world', w));
}


export function worldBibleCount(project, key) {
    return worldBibleEntries(project, key).length;
}


export function matchesWorldBibleSearch(entry, query) {
    const q = query.trim().toLowerCase();
    if (!q)
        return true;
    return entry.name.toLowerCase().includes(q) || (entry.snippet || '').toLowerCase().includes(q);
}


// Turns one Worldbuilding Pack, live against its source project's current data, into the small
// summary that gets mirrored onto that project's Home-screen index entry (see useMetaReport and
// InkRoot's setPackPublishStatus). This is what lets the Grand Library show a pack's contents —
// and unpublish one — without loading the full project, the same way a book's blurb/genre/price
// already live at the index level rather than inside the project file.
export function packSummaryForIndex(project, pack) {
    const categories = PACK_CATEGORY_KEYS.map((key) => {
        const ids = (pack.selection && pack.selection[key]) || [];
        const entries = worldBibleEntries(project, key).filter((e) => ids.includes(e.id));
        const meta = WORLD_BIBLE_CATEGORIES.find((c) => c.key === key);
        return { key, icon: meta ? meta.icon : '', label: meta ? meta.label : key, entries: entries.map((e) => ({ name: e.name, snippet: e.snippet })) };
    }).filter((c) => c.entries.length > 0);
    return {
        id: pack.id, title: pack.title, subtitle: pack.subtitle || '', description: pack.description || '',
        coverImageUrl: pack.coverImageUrl || '', price: typeof pack.price === 'number' ? pack.price : 0,
        genre: pack.genre || 'Unspecified', tags: pack.tags || [],
        publishStatus: pack.publishStatus || 'none', publishedAt: pack.publishedAt || null, updatedAt: pack.updatedAt || Date.now(),
        categories, totalEntries: categories.reduce((s, c) => s + c.entries.length, 0),
    };
}


export const MENTION_TYPE_LABELS = { character: 'Character', location: 'Location', world: 'World Bible entry', glossary: 'Glossary term', timeline: 'Timeline event' };


export const CHARACTER_ROLES = [
    { key: 'protagonist', label: 'Protagonists' },
    { key: 'supporting', label: 'Supporting' },
    { key: 'villain', label: 'Villains' },
];


export const LOCATION_TYPES = ['Capital', 'City', 'Town', 'Village', 'Kingdom', 'Continent', 'Region', 'Castle', 'Fortress', 'Mine', 'Forest', 'Harbor', 'Ruin', 'Landmark'];


export const LOCATION_STATUSES = ['Prospering', 'Stable', 'Declining', 'At War', 'Under Siege', 'Destroyed', 'Abandoned'];


export const ORG_TYPES = ['Guild', 'Cult', 'Military Order', 'Political Faction', 'Trade Company', 'Secret Society', 'Religious Order', 'Criminal Syndicate'];


export const ORG_STATUSES = ['Active', 'Disbanded', 'Outlawed', 'Dormant'];


export const ARTIFACT_STATUSES = ['Found', 'Lost', 'Destroyed', 'Hidden', 'Sealed'];


// ---------- Generated book covers (Home screen + Settings) ----------
// A cover's color comes from one of these hues, applied differently depending on the chosen
// material (COVER_STYLES below) — e.g. "crimson" reads as a wine-dark dyed leather, a burgundy
// cloth binding, or a deep rose-red painted sky, all from the same three hex stops.
export const COVER_ACCENTS = {
    gold: { light: '#C89B3C', mid: '#8a6a2e', deep: '#3d2f14' },
    crimson: { light: '#c96b6b', mid: '#7a2e2e', deep: '#2c1414' },
    forest: { light: '#7fa98a', mid: '#2e4a3a', deep: '#141f19' },
    navy: { light: '#7c93b8', mid: '#25344c', deep: '#10161f' },
    plum: { light: '#a97cc6', mid: '#4a2e5c', deep: '#1c1220' },
    charcoal: { light: '#9a9aa2', mid: '#3a3a42', deep: '#161619' },
};


export const COVER_ACCENT_ORDER = ['gold', 'crimson', 'forest', 'navy', 'plum', 'charcoal'];


// Each style returns everything BookCover needs to render one material: the surface background,
// a foil/ink border color, an inner hairline color, and text colors legible on that surface.
export const COVER_STYLES = {
    leather: (a) => ({
        label: 'Dark Leather',
        background: `radial-gradient(120% 90% at 50% -8%, ${a.light}26 0%, transparent 55%), linear-gradient(160deg, ${a.mid} 0%, ${a.deep} 78%, #100c08 100%)`,
        border: `${a.light}55`,
        hairline: `${a.light}33`,
        title: '#F3E9CE', subtitle: `${a.light}cc`, author: `${a.light}99`, motif: `${a.light}59`,
    }),
    cloth: (a) => ({
        label: 'Woven Cloth',
        background: `repeating-linear-gradient(115deg, rgba(0,0,0,0.05) 0px, rgba(0,0,0,0.05) 1px, transparent 1px, transparent 3px), linear-gradient(170deg, ${a.mid} 0%, ${a.deep} 100%)`,
        border: `${a.light}40`,
        hairline: `${a.light}26`,
        title: '#F0EAD8', subtitle: `${a.light}c2`, author: `${a.light}8f`, motif: `${a.light}4d`,
    }),
    parchment: (a) => ({
        label: 'Parchment',
        background: `radial-gradient(70% 60% at 25% 20%, rgba(255,255,255,0.25) 0%, transparent 60%), radial-gradient(80% 70% at 80% 90%, ${a.mid}22 0%, transparent 60%), linear-gradient(160deg, #EFE3C4 0%, #E1CE9F 55%, #CBB07E 100%)`,
        border: `${a.deep}55`,
        hairline: `${a.deep}30`,
        title: '#3B2A18', subtitle: `${a.deep}cc`, author: `${a.deep}99`, motif: `${a.deep}66`,
    }),
    painted: (a) => ({
        label: 'Painted',
        background: `radial-gradient(110% 70% at 30% 15%, ${a.light}3d 0%, transparent 55%), linear-gradient(200deg, ${a.mid} 0%, ${a.deep} 85%, #0c0a10 100%)`,
        border: `${a.light}4d`,
        hairline: `${a.light}2e`,
        title: '#F5EEDD', subtitle: `${a.light}cc`, author: `${a.light}96`, motif: `${a.light}52`,
    }),
};


export const COVER_STYLE_ORDER = ['leather', 'cloth', 'parchment', 'painted'];


// Minimal fantasy-inspired line-art, drawn stroke-only in currentColor so it inherits each
// cover's motif color at low opacity — meant to sit quietly behind the title, not compete with it.
export const COVER_MOTIFS = {
    none: null,
    compass: React.createElement("svg", { viewBox: "0 0 100 100", fill: "none", stroke: "currentColor", strokeWidth: 1.1 },
        React.createElement("circle", { cx: 50, cy: 50, r: 30 }),
        React.createElement("circle", { cx: 50, cy: 50, r: 2.2, fill: "currentColor", stroke: "none" }),
        React.createElement("path", { d: "M50 14 L55 46 L50 50 L45 46 Z" }),
        React.createElement("path", { d: "M50 86 L55 54 L50 50 L45 54 Z" }),
        React.createElement("path", { d: "M14 50 L46 45 L50 50 L46 55 Z" }),
        React.createElement("path", { d: "M86 50 L54 45 L50 50 L54 55 Z" })),
    moon: React.createElement("svg", { viewBox: "0 0 100 100", fill: "none", stroke: "currentColor", strokeWidth: 1.1 },
        React.createElement("path", { d: "M58 20a26 26 0 1 0 0 52 32 32 0 0 1 0-52Z" }),
        React.createElement("path", { d: "M30 70c8-2 14-8 16-16" }),
        React.createElement("path", { d: "M34 62c4 2 9 2 13-1" }),
        React.createElement("path", { d: "M40 74c3 1 7 1 10-1" })),
    mountains: React.createElement("svg", { viewBox: "0 0 100 100", fill: "none", stroke: "currentColor", strokeWidth: 1.1 },
        React.createElement("circle", { cx: 70, cy: 26, r: 9 }),
        React.createElement("path", { d: "M12 68 L34 40 L48 56 L62 34 L88 68 Z" }),
        React.createElement("path", { d: "M12 68 L88 68", strokeWidth: 0.9 })),
    laurel: React.createElement("svg", { viewBox: "0 0 100 100", fill: "none", stroke: "currentColor", strokeWidth: 1.1 },
        React.createElement("path", { d: "M50 18c-18 8-26 24-22 46" }),
        React.createElement("path", { d: "M50 18c18 8 26 24 22 46" }),
        ...[0, 1, 2, 3, 4].map((i) => React.createElement("path", { key: 'l' + i, d: `M${34 - i * 2} ${30 + i * 8}c-6 1-10 4-12 8` })),
        ...[0, 1, 2, 3, 4].map((i) => React.createElement("path", { key: 'r' + i, d: `M${66 + i * 2} ${30 + i * 8}c6 1 10 4 12 8` }))),
    orbit: React.createElement("svg", { viewBox: "0 0 100 100", fill: "none", stroke: "currentColor", strokeWidth: 1.1 },
        React.createElement("circle", { cx: 50, cy: 50, r: 11 }),
        React.createElement("ellipse", { cx: 50, cy: 50, rx: 38, ry: 13, transform: "rotate(-18 50 50)" }),
        React.createElement("ellipse", { cx: 50, cy: 50, rx: 38, ry: 13, transform: "rotate(18 50 50)", strokeOpacity: 0.6 }),
        React.createElement("circle", { cx: 82, cy: 42, r: 1.6, fill: "currentColor", stroke: "none" }),
        React.createElement("circle", { cx: 22, cy: 60, r: 1.2, fill: "currentColor", stroke: "none" })),
    keyhole: React.createElement("svg", { viewBox: "0 0 100 100", fill: "none", stroke: "currentColor", strokeWidth: 1.1 },
        React.createElement("circle", { cx: 50, cy: 60, r: 34 }),
        React.createElement("circle", { cx: 50, cy: 44, r: 8 }),
        React.createElement("path", { d: "M46 51 L42 70 L58 70 L54 51 Z" })),
    bloom: React.createElement("svg", { viewBox: "0 0 100 100", fill: "none", stroke: "currentColor", strokeWidth: 1.1 },
        React.createElement("path", { d: "M50 90c0-24 0-40 0-52" }),
        React.createElement("path", { d: "M50 60c-8-4-14-2-18 6" }),
        React.createElement("path", { d: "M50 72c8-3 13-1 17 6" }),
        ...[0, 1, 2, 3, 4].map((i) => {
            const angle = (i / 5) * Math.PI * 2;
            const x = 50 + Math.cos(angle) * 12, y = 30 + Math.sin(angle) * 12;
            return React.createElement("path", { key: 'p' + i, d: `M50 30 Q${x} ${y} 50 30` });
        }),
        React.createElement("circle", { cx: 50, cy: 30, r: 3 })),
    briar: React.createElement("svg", { viewBox: "0 0 100 100", fill: "none", stroke: "currentColor", strokeWidth: 1.1 },
        React.createElement("path", { d: "M20 85C35 65 30 45 45 30S75 15 82 15" }),
        ...[[28, 70], [38, 52], [50, 40], [62, 27], [72, 19]].map(([x, y], i) => React.createElement("path", { key: 't' + i, d: `M${x} ${y}l-7 -5M${x} ${y}l7 -3` }))),
};


// A curated starting point per genre — one tap sets material + accent + ornament together, and
// the granular pickers below stay fully editable afterward for anyone who wants to fine-tune.
export const COVER_THEMES = {
    fantasy: { label: 'Fantasy', style: 'leather', accent: 'gold', motif: 'compass' },
    medieval: { label: 'Medieval', style: 'cloth', accent: 'crimson', motif: 'laurel' },
    darkFantasy: { label: 'Dark Fantasy', style: 'painted', accent: 'charcoal', motif: 'moon' },
    historical: { label: 'Historical', style: 'parchment', accent: 'gold', motif: 'laurel' },
    sciFi: { label: 'Sci-Fi', style: 'painted', accent: 'navy', motif: 'orbit' },
    mystery: { label: 'Mystery', style: 'leather', accent: 'charcoal', motif: 'keyhole' },
    romance: { label: 'Romance', style: 'cloth', accent: 'plum', motif: 'bloom' },
    horror: { label: 'Horror', style: 'painted', accent: 'charcoal', motif: 'briar' },
    minimal: { label: 'Minimal', style: 'parchment', accent: 'charcoal', motif: 'none' },
};


export const COVER_THEME_ORDER = ['fantasy', 'medieval', 'darkFantasy', 'historical', 'sciFi', 'mystery', 'romance', 'horror', 'minimal'];


// Per-size typography/layout for BookCover — 'sm' for shelf thumbnails, 'md' for the Home
// screen's featured card, 'lg' for the live preview in Settings.
export const COVER_SIZES = {
    sm: { width: 94, radius: 5, pad: 10, title: 11.5, subtitle: 8.5, series: 7, author: 7.5, motif: 40 },
    md: { width: 172, radius: 9, pad: 18, title: 20, subtitle: 13.5, series: 11, author: 11.5, motif: 74 },
    lg: { width: 200, radius: 9, pad: 20, title: 22, subtitle: 14, series: 10.5, author: 11.5, motif: 84 },
};


export function BookCover({ title, subtitle, seriesName, author, cover, size }) {
    const dims = COVER_SIZES[size] || COVER_SIZES.sm;
    if (cover && cover.customImageUrl) {
        return React.createElement("div", {
            style: {
                width: dims.width, aspectRatio: '2 / 3', borderRadius: dims.radius, position: 'relative',
                boxShadow: '0 6px 16px rgba(0,0,0,0.35), inset 0 0 0 1px rgba(0,0,0,0.15)',
                overflow: 'hidden', flexShrink: 0, backgroundImage: `url(${cover.customImageUrl})`,
                backgroundSize: 'cover', backgroundPosition: 'center',
            }
        });
    }
    const styleKey = (cover && COVER_STYLES[cover.style]) ? cover.style : 'leather';
    const accentKey = (cover && COVER_ACCENTS[cover.accent]) ? cover.accent : 'gold';
    const motifKey = cover && Object.prototype.hasOwnProperty.call(COVER_MOTIFS, cover.motif) ? cover.motif : 'compass';
    const palette = COVER_STYLES[styleKey](COVER_ACCENTS[accentKey]);
    const motifEl = COVER_MOTIFS[motifKey];
    const displayTitle = (title && title.trim()) ? title : 'Untitled Novel';
    return React.createElement("div", {
        style: {
            width: dims.width, aspectRatio: '2 / 3', borderRadius: dims.radius, position: 'relative',
            background: palette.background, border: `1px solid ${palette.border}`, boxShadow: '0 6px 16px rgba(0,0,0,0.35), inset 0 0 0 1px rgba(0,0,0,0.15)',
            display: 'flex', flexDirection: 'column', justifyContent: 'space-between', overflow: 'hidden',
            padding: dims.pad, flexShrink: 0,
        }
    },
        React.createElement("div", { style: {
                position: 'absolute', inset: 5, border: `1px solid ${palette.hairline}`, borderRadius: Math.max(dims.radius - 2, 2), pointerEvents: 'none',
            } }),
        motifEl && React.createElement("div", { style: {
                position: 'absolute', left: '50%', top: '50%', width: dims.motif, height: dims.motif,
                transform: 'translate(-50%, -50%)', color: palette.motif, pointerEvents: 'none',
            } }, motifEl),
        React.createElement("div", { style: { position: 'relative', zIndex: 1, textAlign: 'center' } },
            seriesName && seriesName.trim() && React.createElement("div", { style: {
                    fontSize: dims.series, letterSpacing: '0.14em', textTransform: 'uppercase', color: palette.subtitle,
                    marginBottom: 6, fontFamily: "'Inter', sans-serif",
                } }, seriesName.trim())),
        React.createElement("div", { style: { position: 'relative', zIndex: 1, textAlign: 'center' } },
            React.createElement("div", { style: {
                    fontFamily: "'Fraunces', Georgia, serif", fontWeight: 600, fontSize: dims.title, lineHeight: 1.15,
                    color: palette.title, textShadow: '0 1px 3px rgba(0,0,0,0.35)',
                } }, displayTitle),
            subtitle && subtitle.trim() && React.createElement("div", { style: {
                    fontFamily: "'Fraunces', Georgia, serif", fontStyle: 'italic', fontSize: dims.subtitle, marginTop: 6,
                    color: palette.subtitle, lineHeight: 1.3,
                } }, subtitle.trim())),
        React.createElement("div", { style: {
                position: 'relative', zIndex: 1, textAlign: 'center', fontSize: dims.author, letterSpacing: '0.1em',
                textTransform: 'uppercase', color: palette.author, fontFamily: "'Inter', sans-serif",
            } }, (author && author.trim()) ? author.trim() : ' '));
}
