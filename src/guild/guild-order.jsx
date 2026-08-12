import React, { useState, useEffect, useMemo } from 'react';
import { storage } from '../lib/storage.js';
import { GuildQuestBoard } from './guild-hall.jsx';
import { LU_AUTHORS } from '../library/inbox-and-living-universe.jsx';
import { resolvePublishStatus } from '../library/publishing.jsx';
import { ProgressBar, StatCard } from '../shared-ui/ui-cards.jsx';
import { uuid } from '../shared-utils/storage-keys.jsx';
import { wordCount } from '../shared-utils/strip-html.jsx';
import { InkIcon, dayOfYear } from '../shell/ink-icon.jsx';
import { RADIUS_SCALE, SPACE_SCALE, TYPE_SCALE } from '../shell/nav-context.jsx';


// ---------- The Guild Order ----------
// A prestigious creative-organization layer on top of the existing Guild Hall: roles, a shared
// manuscript, a shared World Bible, a seasonal anthology, workshops, the same real Guild Quests
// board, a calendar, a treasury, a library, Council voting, and a monthly competition.
//
// HONESTY NOTE (same policy as the Living Universe screen): Inkroot has no backend, so there are
// no other real writers in this guild yet. Every *other* member below is a simulated presence —
// deterministically generated from the guild's own name, so it's stable across visits rather than
// reshuffling — clearly labelled as a preview in the header and footer of each tab. What IS real:
// your own role (computed from your actual Writer Rank), your own passages, World Bible entries,
// anthology submissions, workshop feedback, treasury commissions, votes, and competition entries —
// all genuinely saved to this device via `storage`, all attributed to you specifically. The Guild
// Quests tab doesn't duplicate anything; it just renders the real GuildQuestBoard defined above.
// Swapping the simulated roster/seed content for real members later only touches goBuildRoster and
// the *_SEED constants below — every tab already reads from state shaped the same way either way.
export const GO_ROLES = [
    { key: 'guildmaster', label: 'Guild Master', icon: "\uD83D\uDC51", color: '#E8C468', rung: 6 },
    { key: 'council', label: 'Council', icon: "\uD83D\uDDF3\uFE0F", color: '#C89B3C', rung: 5 },
    { key: 'editor', label: 'Editor', icon: "\uD83D\uDDA5\uFE0F", color: '#A184D6', rung: 4 },
    { key: 'mentor', label: 'Mentor', icon: "\uD83D\uDD6F\uFE0F", color: '#7FB2C9', rung: 3 },
    { key: 'writer', label: 'Writer', icon: "\uD83D\uDCD6", color: '#B08D57', rung: 2 },
    { key: 'apprentice', label: 'Apprentice', icon: "\uD83C\uDF31", color: '#8FA37A', rung: 1 },
];


export function goRoleByKey(key) { return GO_ROLES.find((r) => r.key === key) || GO_ROLES[GO_ROLES.length - 1]; }


export const GO_PERMISSIONS = {
    proposeChapter: 1, draftChapter: 2, editChapter: 4, approveChapter: 4, lockManuscript: 5,
    addWorldEntry: 2, curateWorldEntry: 4, submitAnthology: 1, manageAnthology: 4,
    hostWorkshop: 3, giveWorkshopFeedback: 3, spendTreasury: 5, openVote: 5, castVote: 1,
};


// A member's own role is the one thing here that's real, not simulated: whoever runs their own
// guild is its Guild Master; inside a Founder Guild, rung follows the writer's actual Writer Rank
// tier, so climbing WRITER_RANKS for real climbs the guild hierarchy for real too.
export function goPlayerRung(writerRank, isFounderView) {
    if (!isFounderView)
        return 6;
    const tier = (writerRank && writerRank.tier) || 1;
    if (tier >= 9) return 5;
    if (tier >= 7) return 4;
    if (tier >= 5) return 3;
    if (tier >= 3) return 2;
    return 1;
}


export function goHash(str) {
    let h = 0;
    for (let i = 0; i < String(str).length; i++) { h = (Math.imul(31, h) + String(str).charCodeAt(i)) | 0; }
    return h >>> 0;
}


export function goMulberry32(seed) {
    let s = seed >>> 0;
    return function () {
        s = (s + 0x6D2B79F5) | 0;
        let t = Math.imul(s ^ (s >>> 15), 1 | s);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}


// Deterministic per-guild roster: the same guild always shows the same simulated members (so
// re-opening it doesn't reshuffle everyone's identity), while a different guild gets a different
// cast, seeded from its own name.
export function goBuildRoster(guildKey, guildName, playerName, playerRung) {
    const rng = goMulberry32(goHash(guildKey || guildName || 'guild'));
    const pool = [...LU_AUTHORS].sort(() => rng() - 0.5);
    const slotCounts = { 6: 1, 5: 3, 4: 4, 3: 4, 2: 8, 1: 6 };
    const members = [];
    let idx = 0;
    GO_ROLES.forEach((role) => {
        let n = slotCounts[role.rung] || 0;
        if (role.rung === playerRung) n = Math.max(0, n - 1);
        for (let i = 0; i < n; i++) {
            const name = pool[idx % pool.length]; idx++;
            members.push({ id: `npc-${role.key}-${i}`, name, role: role.key, rung: role.rung, contribution: Math.round(20 + rng() * 480) });
        }
    });
    members.push({ id: 'you', name: playerName || 'You', role: goRoleByKey(GO_ROLES.find((r) => r.rung === playerRung).key).key, rung: playerRung, isPlayer: true, contribution: null });
    return members.sort((a, b) => b.rung - a.rung || (b.contribution || 0) - (a.contribution || 0));
}


export const GO_CHAPTER_TITLES = ['The Gathering', 'Omens at the Border', 'What the Old Scribe Knew', 'A Council Divided', 'The Long March', 'Embers of the First Vow', 'What the Maps Would Not Show', 'The Reckoning'];


export function goBuildManuscript(roster) {
    const contributors = roster.filter((m) => !m.isPlayer);
    return GO_CHAPTER_TITLES.slice(0, 6).map((title, i) => ({
        id: `ch-${i}`, title, order: i + 1,
        contributor: contributors.length ? contributors[i % contributors.length].name : 'Unassigned',
        contributorRole: contributors.length ? contributors[i % contributors.length].role : 'writer',
        status: i < 3 ? 'approved' : i < 5 ? 'in review' : 'draft',
    }));
}


export const GO_WORLD_CATEGORIES = ['Houses & Orders', 'Magic & Rites', 'Realms & Regions', 'Bestiary', 'Artifacts & Relics'];


export const GO_WORLD_SEED = [
    { id: 'ws1', category: 'Houses & Orders', title: 'The Ashgrove Concord', blurb: "A pact between three founding families, sealed in the guild's first year.", author: 'Elara Voss' },
    { id: 'ws2', category: 'Magic & Rites', title: 'The Ember Vow', blurb: 'A binding oath sworn over open flame; breaking it is said to cost the breaker their voice.', author: 'Kael Thorne' },
    { id: 'ws3', category: 'Realms & Regions', title: 'The Sundered Coast', blurb: 'A fractured shoreline where the tide runs backward twice a year.', author: 'Wren Ashbury' },
    { id: 'ws4', category: 'Bestiary', title: 'The Long-Toothed Kestrel', blurb: 'A hawk the size of a wolf, native to the Long Winter Courts.', author: 'Marlowe Finch' },
    { id: 'ws5', category: 'Artifacts & Relics', title: "The Cartographer's Compass", blurb: 'Never points north \u2014 only toward what its bearer has lost.', author: 'Isolde Graye' },
    { id: 'ws6', category: 'Houses & Orders', title: 'The Hollow Vale Wardens', blurb: 'A militia turned monastic order after the Long Winter.', author: 'Thane Ashford' },
];


export function goBuildAnthologySeed(roster) {
    const contributors = roster.filter((m) => !m.isPlayer).slice(0, 4);
    const titles = ['The Last Ember', 'Between Two Vows', 'What the Guild Remembers', 'A Quiet Reckoning'];
    return contributors.map((m, i) => ({ id: `as-${i}`, title: titles[i % titles.length], author: m.name, words: 2200 + (m.contribution || 50) * 20, ts: Date.now() - i * 86400000 }));
}


export function goBuildLibrarySeed(roster) {
    const contributors = roster.filter((m) => !m.isPlayer).slice(0, 6);
    const titles = ['The Ember Crown', 'Salt and Starlight', 'Signal from the Cradle', 'The Weight of Silk', 'The Hollow Choir', 'Atlas of the Sundered Coast'];
    return contributors.map((m, i) => ({ id: `gl-${i}`, title: titles[i % titles.length], author: m.name }));
}


export const GO_WORKSHOP_SEED = [
    { id: 'w1', title: 'Opening pages of "The Drift Between Stars"', author: 'Ines Solari', mentor: 'Osric Falk', feedback: ['The pacing in the second scene pulls ahead of the emotional beat \u2014 let it breathe a paragraph longer.'] },
    { id: 'w2', title: 'Chapter Three of "The Ember Crown"', author: 'Callum Drake', mentor: 'Maren Loch', feedback: ['Strong voice. Watch the dialogue tags \u2014 a few too many "he said, gesturing broadly."'] },
];


export const GO_COMMISSIONS = [
    { id: 'seal', icon: "\uD83E\uDE99", title: 'Commission an Illuminated Guild Seal', cost: 150, desc: 'A hand-drawn seal for official guild correspondence.' },
    { id: 'apprentice', icon: "\uD83C\uDF31", title: "Fund an Apprentice's First Year", cost: 300, desc: "Sponsor a new writer's first year of guild dues." },
    { id: 'banner', icon: "\uD83C\uDFF4", title: 'Restore the Guild Banner', cost: 500, desc: 'Reweave the banner hanging in the Hall.' },
    { id: 'feast', icon: "\uD83C\uDF77", title: 'Host a Grand Feast', cost: 250, desc: 'A celebration for the whole guild.' },
    { id: 'scholars', icon: "\uD83D\uDCDA", title: "Endow the Scholars' Shelf", cost: 400, desc: "Reserve library shelf space for members' research." },
];


export const GO_HISTORICAL_PROPOSALS = [
    { title: 'Adopt a shared style guide for guild anthologies', outcome: 'Passed', forPct: 78 },
    { title: 'Meet twice monthly instead of weekly', outcome: 'Rejected', forPct: 41 },
    { title: 'Open a Mentor track for new Apprentices', outcome: 'Passed', forPct: 86 },
];


export const GO_ACTIVE_PROPOSAL = { title: 'Commission a guild anthology this season', desc: 'Formally open submissions and appoint an Editor to run the process.' };


export const GO_PROMPTS = ["Write the first page of a story that begins with a broken promise.", "A character discovers a door that wasn't there yesterday.", 'Tell a story entirely through letters never sent.', 'Write the moment a villain realizes they were right all along.', 'A reunion, twenty years later than planned.', "The last entry in someone's field journal.", 'Something ancient wakes up in a modern city.', 'A map that only tells the truth at night.', 'The apprentice outgrows the master.', 'A guild feast where every dish tells a story.', "The war ended, but nobody told the border.", 'What the lighthouse keeper never wrote down.'];


export const GO_COMPETITION_SEED = [
    { id: 'e1', author: 'Wren Ashbury', title: 'The Unlit Wick', votes: 24 },
    { id: 'e2', author: 'Corin Blackwood', title: 'What the Tide Kept', votes: 31 },
    { id: 'e3', author: 'Sable Quinn', title: 'Second Draft of a Life', votes: 18 },
];


export const GO_TABS = [
    { key: 'roster', label: 'Roster', icon: "\uD83D\uDC51" },
    { key: 'manuscript', label: 'Manuscript', icon: "\uD83D\uDCD6" },
    { key: 'worldbible', label: 'World Bible', icon: "\uD83D\uDDFA\uFE0F" },
    { key: 'anthology', label: 'Anthology', icon: "\uD83D\uDCDC" },
    { key: 'workshops', label: 'Workshops', icon: "\uD83D\uDD6F\uFE0F" },
    { key: 'quests', label: 'Quests', icon: "\u2694\uFE0F" },
    { key: 'calendar', label: 'Calendar', icon: "\uD83D\uDCC5" },
    { key: 'treasury', label: 'Treasury', icon: "\uD83D\uDCB0" },
    { key: 'library', label: 'Library', icon: "\uD83D\uDCDA" },
    { key: 'council', label: 'Council', icon: "\uD83D\uDDF3\uFE0F" },
    { key: 'competitions', label: 'Competitions', icon: "\uD83C\uDFC6" },
];


export function goBtnStyle(primary) {
    return {
        fontSize: TYPE_SCALE[11.5], fontWeight: 600, padding: '7px 13px', borderRadius: RADIUS_SCALE[8], cursor: 'pointer',
        border: primary ? '1px solid rgba(232,196,104,0.5)' : '1px solid #2A2A30',
        background: primary ? 'linear-gradient(160deg, #241F14, #1A160D)' : 'transparent',
        color: primary ? '#E8C468' : '#8A8680',
    };
}


export const goInputStyle = {
    width: '100%', boxSizing: 'border-box', background: '#100E0A', border: '1px solid #2A2A30', borderRadius: RADIUS_SCALE[8],
    padding: '10px 12px', color: '#EFE7D2', fontSize: TYPE_SCALE[12.5], fontFamily: 'inherit', resize: 'vertical',
};


export function GoTabNav({ active, onSelect }) {
    return React.createElement("div", { style: { display: 'flex', gap: SPACE_SCALE[6], overflowX: 'auto', padding: '2px 2px 16px', marginBottom: 6, WebkitOverflowScrolling: 'touch' } },
        GO_TABS.map((t) => React.createElement("button", {
            key: t.key, onClick: () => onSelect(t.key),
            style: {
                flexShrink: 0, display: 'flex', alignItems: 'center', gap: SPACE_SCALE[6], padding: '8px 13px', borderRadius: RADIUS_SCALE[100],
                border: `1px solid ${active === t.key ? 'rgba(232,196,104,0.5)' : '#2A2A30'}`,
                background: active === t.key ? 'linear-gradient(160deg, #241F14, #1A160D)' : '#1D1D22',
                color: active === t.key ? '#E8C468' : '#8A8680', fontSize: TYPE_SCALE[12.5], fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap',
            },
        }, `${t.icon} ${t.label}`)));
}


export function GoRoleBadge({ role, size }) {
    const r = goRoleByKey(role);
    return React.createElement("span", { style: { display: 'inline-flex', alignItems: 'center', gap: SPACE_SCALE[5], fontSize: size || 11, fontWeight: 600, color: r.color, border: `1px solid ${r.color}55`, borderRadius: RADIUS_SCALE[100], padding: '3px 9px' } }, `${r.icon} ${r.label}`);
}


export function GoLocked({ text }) {
    return React.createElement("div", { style: { fontSize: TYPE_SCALE[11.5], color: '#5C5C64', fontStyle: 'italic', textAlign: 'center', padding: '10px 6px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: SPACE_SCALE[6] } },
        React.createElement(InkIcon, { name: "lock", size: 11 }), text);
}


export function GoRosterTab({ guild, roster, guildProgress, guildRank }) {
    const grouped = GO_ROLES.map((role) => ({ role, members: roster.filter((m) => m.role === role.key) }));
    return React.createElement("div", null,
        React.createElement("div", { style: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px,1fr))', gap: SPACE_SCALE[10], marginBottom: 26 } },
            React.createElement(StatCard, { label: 'Members', value: roster.length }),
            React.createElement(StatCard, { label: 'Guild Level', value: guildProgress.level, accent: true }),
            React.createElement(StatCard, { label: 'Standing', value: guildRank.name })),
        grouped.map(({ role, members }) => members.length === 0 ? null : React.createElement("div", { key: role.key, style: { marginBottom: 22 } },
            React.createElement("div", { style: { display: 'flex', alignItems: 'center', gap: SPACE_SCALE[8], marginBottom: 10 } },
                React.createElement("span", { style: { fontSize: TYPE_SCALE[15] } }, role.icon),
                React.createElement("span", { style: { fontFamily: "'Fraunces', Georgia, serif", fontSize: TYPE_SCALE[13.5], fontWeight: 600, color: role.color } }, role.label),
                React.createElement("span", { style: { fontSize: TYPE_SCALE[10.5], color: '#5C5C64' } }, `(${members.length})`)),
            React.createElement("div", { style: { display: 'flex', flexDirection: 'column', gap: SPACE_SCALE[6] } },
                members.map((m) => React.createElement("div", {
                    key: m.id, style: {
                        display: 'flex', alignItems: 'center', gap: SPACE_SCALE[10], padding: '9px 12px', borderRadius: RADIUS_SCALE[9],
                        background: m.isPlayer ? 'linear-gradient(160deg, #241F14, #1A160D)' : '#1D1D22',
                        border: `1px solid ${m.isPlayer ? 'rgba(232,196,104,0.4)' : '#2A2A30'}`,
                    },
                },
                    React.createElement("div", { style: { width: 30, height: 30, borderRadius: '50%', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Fraunces', Georgia, serif", fontSize: TYPE_SCALE[12], fontWeight: 600, color: role.color, background: '#17140F', border: `1.5px solid ${role.color}` } }, m.name.split(' ').map((n) => n[0]).join('')),
                    React.createElement("div", { style: { flex: 1, minWidth: 0 } },
                        React.createElement("div", { style: { fontSize: TYPE_SCALE[13], color: '#EFE7D2', fontWeight: m.isPlayer ? 600 : 400 } }, m.isPlayer ? `${m.name} (you)` : m.name),
                        !m.isPlayer && React.createElement("div", { style: { fontSize: TYPE_SCALE[10], color: '#5C5C64' } }, `${m.contribution} Guild XP contributed`))))))),
        React.createElement("div", { style: { marginTop: 10, fontSize: TYPE_SCALE[10.5], color: '#5C5C64', fontStyle: 'italic', textAlign: 'center' } }, "Other members preview what the Guild Order will look like once real writers can join \u2014 your own role and actions here are real."));
}


export function GoManuscriptTab({ guild, chapters, playerRung, state, patchState }) {
    const [openChapter, setOpenChapter] = useState(null);
    const [draft, setDraft] = useState('');
    const canDraft = playerRung >= GO_PERMISSIONS.draftChapter;
    const canEdit = playerRung >= GO_PERMISSIONS.editChapter;
    const addNote = (chId) => {
        if (!draft.trim()) return;
        const notes = state.manuscriptNotes[chId] || [];
        patchState({ manuscriptNotes: { ...state.manuscriptNotes, [chId]: [...notes, { text: draft.trim(), ts: Date.now() }] } });
        setDraft('');
    };
    const advanceStatus = (chId, current) => {
        const next = current === 'draft' ? 'in review' : 'approved';
        patchState({ manuscriptStatus: { ...state.manuscriptStatus, [chId]: next } });
    };
    return React.createElement("div", null,
        React.createElement("div", { style: { textAlign: 'center', fontFamily: "'Fraunces', Georgia, serif", fontStyle: 'italic', fontSize: TYPE_SCALE[16], color: '#EFE7D2', marginBottom: 4 } }, `${guild.name}: A Chronicle Unwritten`),
        React.createElement("div", { style: { textAlign: 'center', fontSize: TYPE_SCALE[11.5], color: '#5C5C64', marginBottom: 22 } }, canEdit ? 'You may draft, edit, and approve chapters.' : canDraft ? 'You may draft and comment on chapters.' : 'You may read and comment on chapters.'),
        chapters.map((ch) => {
            const status = state.manuscriptStatus[ch.id] || ch.status;
            const notes = state.manuscriptNotes[ch.id] || [];
            const statusColor = status === 'approved' ? '#8FCB8F' : status === 'in review' ? '#C89B3C' : '#7A7A82';
            return React.createElement("div", { key: ch.id, style: { background: '#1D1D22', border: '1px solid #2A2A30', borderRadius: RADIUS_SCALE[12], padding: 16, marginBottom: 12 } },
                React.createElement("div", { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: SPACE_SCALE[10] } },
                    React.createElement("div", null,
                        React.createElement("div", { style: { fontSize: TYPE_SCALE[10.5], color: '#5C5C64' } }, `Chapter ${ch.order}`),
                        React.createElement("div", { style: { fontFamily: "'Fraunces', Georgia, serif", fontSize: TYPE_SCALE[14.5], color: '#EFE7D2', fontWeight: 600 } }, ch.title)),
                    React.createElement("span", { style: { fontSize: TYPE_SCALE[9.5], fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: statusColor, border: `1px solid ${statusColor}55`, borderRadius: RADIUS_SCALE[5], padding: '3px 7px', whiteSpace: 'nowrap' } }, status)),
                React.createElement("div", { style: { fontSize: TYPE_SCALE[11], color: '#7A7A82', marginTop: 8 } }, `Led by ${ch.contributor} \u00B7 ${goRoleByKey(ch.contributorRole).label}`),
                notes.length > 0 && React.createElement("div", { style: { marginTop: 10, borderTop: '1px solid #2A2A30', paddingTop: 10, display: 'flex', flexDirection: 'column', gap: SPACE_SCALE[7] } },
                    notes.map((n, i) => React.createElement("div", { key: i, style: { fontSize: TYPE_SCALE[11.5], color: '#B9B2A0', lineHeight: 1.5 } }, `\u201C${n.text}\u201D`))),
                React.createElement("div", { style: { display: 'flex', gap: SPACE_SCALE[8], marginTop: 12, flexWrap: 'wrap' } },
                    React.createElement("button", { onClick: () => setOpenChapter(openChapter === ch.id ? null : ch.id), style: goBtnStyle(false) }, openChapter === ch.id ? 'Cancel' : (canDraft ? 'Add your passage' : 'Add a note')),
                    canEdit && status !== 'approved' && React.createElement("button", { onClick: () => advanceStatus(ch.id, status), style: goBtnStyle(true) }, status === 'draft' ? 'Send to review' : 'Approve chapter')),
                openChapter === ch.id && React.createElement("div", { style: { marginTop: 10 } },
                    React.createElement("textarea", { value: draft, onChange: (e) => setDraft(e.target.value), placeholder: "Write your contribution\u2026", rows: 3, style: goInputStyle }),
                    React.createElement("button", { onClick: () => { addNote(ch.id); setOpenChapter(null); }, style: { ...goBtnStyle(true), marginTop: 8 } }, "Save to the manuscript")));
        }));
}


export function GoWorldBibleTab({ seedEntries, state, patchState, playerRung, playerName }) {
    const [form, setForm] = useState({ category: GO_WORLD_CATEGORIES[0], title: '', blurb: '' });
    const [showForm, setShowForm] = useState(false);
    const canAdd = playerRung >= GO_PERMISSIONS.addWorldEntry;
    const allEntries = [...state.worldEntries, ...seedEntries];
    const submit = () => {
        if (!form.title.trim()) return;
        patchState({ worldEntries: [{ id: uuid(), ...form, author: playerName || 'You', ts: Date.now(), isPlayer: true }, ...state.worldEntries] });
        setForm({ category: GO_WORLD_CATEGORIES[0], title: '', blurb: '' });
        setShowForm(false);
    };
    return React.createElement("div", null,
        canAdd ? React.createElement("div", { style: { textAlign: 'center', marginBottom: 18 } },
            React.createElement("button", { onClick: () => setShowForm((s) => !s), style: goBtnStyle(true) }, showForm ? 'Cancel' : '+ Add an entry'))
            : React.createElement(GoLocked, { text: 'Writers and above can add entries to the shared World Bible.' }),
        showForm && React.createElement("div", { style: { background: '#1D1D22', border: '1px solid #2A2A30', borderRadius: RADIUS_SCALE[12], padding: 16, marginBottom: 20, display: 'flex', flexDirection: 'column', gap: SPACE_SCALE[10] } },
            React.createElement("select", { value: form.category, onChange: (e) => setForm({ ...form, category: e.target.value }), style: goInputStyle },
                GO_WORLD_CATEGORIES.map((c) => React.createElement("option", { key: c, value: c }, c))),
            React.createElement("input", { value: form.title, onChange: (e) => setForm({ ...form, title: e.target.value }), placeholder: 'Entry title', style: goInputStyle }),
            React.createElement("textarea", { value: form.blurb, onChange: (e) => setForm({ ...form, blurb: e.target.value }), placeholder: "A few sentences\u2026", rows: 3, style: goInputStyle }),
            React.createElement("button", { onClick: submit, style: goBtnStyle(true) }, "Add to the World Bible")),
        React.createElement("div", { style: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px,1fr))', gap: SPACE_SCALE[12] } },
            allEntries.map((e) => React.createElement("div", { key: e.id, style: { background: '#1D1D22', border: e.isPlayer ? '1px solid rgba(232,196,104,0.4)' : '1px solid #2A2A30', borderRadius: RADIUS_SCALE[11], padding: 15 } },
                React.createElement("div", { style: { fontSize: TYPE_SCALE[9.5], textTransform: 'uppercase', letterSpacing: '0.06em', color: '#A184D6', marginBottom: 6 } }, e.category),
                React.createElement("div", { style: { fontFamily: "'Fraunces', Georgia, serif", fontSize: TYPE_SCALE[14], fontWeight: 600, color: '#EFE7D2', marginBottom: 5 } }, e.title),
                React.createElement("div", { style: { fontSize: TYPE_SCALE[11.5], color: '#8A8680', lineHeight: 1.55, marginBottom: 8 } }, e.blurb),
                React.createElement("div", { style: { fontSize: TYPE_SCALE[10], color: '#5C5C64' } }, `Contributed by ${e.author}${e.isPlayer ? ' (you)' : ''}`)))));
}


export function GoAnthologyTab({ guild, seedSubs, state, patchState, projects, playerName }) {
    const [showPicker, setShowPicker] = useState(false);
    const submissions = [...seedSubs, ...state.anthologySubmissions];
    const totalWords = submissions.reduce((s, x) => s + x.words, 0) || 1;
    const eligible = (projects || []).filter((p) => (p.wordCount || 0) > 0 && !state.anthologySubmissions.some((s) => s.id === `pj-${p.id}`));
    const submit = (p) => {
        patchState({ anthologySubmissions: [...state.anthologySubmissions, { id: `pj-${p.id}`, title: p.title, author: playerName || 'You', words: p.wordCount || 0, ts: Date.now(), isPlayer: true }] });
        setShowPicker(false);
    };
    const byContributor = {};
    submissions.forEach((s) => { byContributor[s.author] = (byContributor[s.author] || 0) + s.words; });
    const splits = Object.entries(byContributor).map(([author, words]) => ({ author, words, pct: Math.round((words / totalWords) * 1000) / 10 })).sort((a, b) => b.words - a.words);
    return React.createElement("div", null,
        React.createElement("div", { style: { textAlign: 'center', fontFamily: "'Fraunces', Georgia, serif", fontStyle: 'italic', fontSize: TYPE_SCALE[16], color: '#EFE7D2', marginBottom: 4 } }, `The ${guild.name} Anthology`),
        React.createElement("div", { style: { textAlign: 'center', fontSize: TYPE_SCALE[11.5], color: '#5C5C64', marginBottom: 20 } }, "Submissions open \u2014 contributors and revenue share update automatically as work comes in."),
        React.createElement("div", { style: { textAlign: 'center', marginBottom: 20 } },
            React.createElement("button", { onClick: () => setShowPicker((s) => !s), style: goBtnStyle(true) }, showPicker ? 'Cancel' : 'Submit your work')),
        showPicker && React.createElement("div", { style: { marginBottom: 20, display: 'flex', flexDirection: 'column', gap: SPACE_SCALE[8] } },
            eligible.length === 0 ? React.createElement("div", { style: { fontSize: TYPE_SCALE[11.5], color: '#5C5C64', textAlign: 'center' } }, 'No eligible manuscripts to submit yet.')
                : eligible.map((p) => React.createElement("button", { key: p.id, onClick: () => submit(p), style: { ...goBtnStyle(false), textAlign: 'left' } }, `${p.title} (${(p.wordCount || 0).toLocaleString()} words)`))),
        React.createElement("div", { style: { fontSize: TYPE_SCALE[11], textTransform: 'uppercase', letterSpacing: '0.08em', color: '#5C5C64', marginBottom: 10 } }, `Contributors (${submissions.length})`),
        submissions.map((s) => React.createElement("div", { key: s.id, style: { display: 'flex', justifyContent: 'space-between', fontSize: TYPE_SCALE[12.5], color: '#EFE7D2', padding: '8px 0', borderBottom: '1px solid #2A2A30' } },
            React.createElement("span", null, `${s.title} \u2014 ${s.author}${s.isPlayer ? ' (you)' : ''}`),
            React.createElement("span", { style: { color: '#7A7A82', fontSize: TYPE_SCALE[11] } }, `${s.words.toLocaleString()} words`))),
        React.createElement("div", { style: { fontSize: TYPE_SCALE[11], textTransform: 'uppercase', letterSpacing: '0.08em', color: '#5C5C64', margin: '22px 0 10px' } }, 'Projected Revenue Split'),
        splits.map((s) => React.createElement("div", { key: s.author, style: { marginBottom: 10 } },
            React.createElement("div", { style: { display: 'flex', justifyContent: 'space-between', fontSize: TYPE_SCALE[12], color: '#8A8680', marginBottom: 3 } },
                React.createElement("span", null, s.author), React.createElement("span", null, `${s.pct}%`)),
            React.createElement(ProgressBar, { value: s.words, max: totalWords, color: '#C89B3C' }))),
        React.createElement("div", { style: { fontSize: TYPE_SCALE[10.5], color: '#5C5C64', fontStyle: 'italic', marginTop: 14, textAlign: 'center' } }, "Split by contributed word count, shown for planning \u2014 Inkroot doesn't process real anthology sales yet."));
}


export function GoWorkshopsTab({ projects, playerName, playerRung, state, patchState }) {
    const [showPicker, setShowPicker] = useState(false);
    const [feedbackDraft, setFeedbackDraft] = useState({});
    const canGiveFeedback = playerRung >= GO_PERMISSIONS.giveWorkshopFeedback;
    const submissions = [...GO_WORKSHOP_SEED, ...state.workshopSubmissions];
    const eligible = (projects || []).filter((p) => (p.wordCount || 0) > 0);
    const submit = (p) => { patchState({ workshopSubmissions: [...state.workshopSubmissions, { id: uuid(), title: p.title, author: playerName || 'You', mentor: 'A Mentor', feedback: [], isPlayer: true }] }); setShowPicker(false); };
    const addFeedback = (id) => {
        const text = (feedbackDraft[id] || '').trim();
        if (!text) return;
        const extra = state.workshopFeedback[id] || [];
        patchState({ workshopFeedback: { ...state.workshopFeedback, [id]: [...extra, text] } });
        setFeedbackDraft({ ...feedbackDraft, [id]: '' });
    };
    return React.createElement("div", null,
        React.createElement("div", { style: { textAlign: 'center', fontSize: TYPE_SCALE[11.5], color: '#5C5C64', marginBottom: 20, fontStyle: 'italic' } }, "Structured feedback on craft, pacing, voice, and world \u2014 hosted by Mentors and Editors."),
        React.createElement("div", { style: { textAlign: 'center', marginBottom: 20 } },
            React.createElement("button", { onClick: () => setShowPicker((s) => !s), style: goBtnStyle(true) }, showPicker ? 'Cancel' : 'Submit a chapter for workshop')),
        showPicker && React.createElement("div", { style: { marginBottom: 20, display: 'flex', flexDirection: 'column', gap: SPACE_SCALE[8] } },
            eligible.length === 0 ? React.createElement("div", { style: { fontSize: TYPE_SCALE[11.5], color: '#5C5C64', textAlign: 'center' } }, 'No eligible manuscripts yet \u2014 write a little more first.')
                : eligible.map((p) => React.createElement("button", { key: p.id, onClick: () => submit(p), style: { ...goBtnStyle(false), textAlign: 'left' } }, p.title))),
        submissions.map((s) => {
            const extra = state.workshopFeedback[s.id] || [];
            const allFeedback = [...(s.feedback || []), ...extra];
            return React.createElement("div", { key: s.id, style: { background: '#1D1D22', border: '1px solid #2A2A30', borderRadius: RADIUS_SCALE[12], padding: 16, marginBottom: 12 } },
                React.createElement("div", { style: { fontFamily: "'Fraunces', Georgia, serif", fontSize: TYPE_SCALE[14], color: '#EFE7D2', fontWeight: 600, marginBottom: 4 } }, s.title),
                React.createElement("div", { style: { fontSize: TYPE_SCALE[11], color: '#7A7A82', marginBottom: 10 } }, `${s.author}${s.isPlayer ? ' (you)' : ''} \u00B7 hosted by ${s.mentor}`),
                allFeedback.length > 0 && React.createElement("div", { style: { display: 'flex', flexDirection: 'column', gap: SPACE_SCALE[8], marginBottom: 10 } },
                    allFeedback.map((f, i) => React.createElement("div", { key: i, style: { fontSize: TYPE_SCALE[11.5], color: '#B9B2A0', lineHeight: 1.5, borderLeft: '2px solid #3A3020', paddingLeft: 10 } }, f))),
                canGiveFeedback && React.createElement("div", { style: { display: 'flex', gap: SPACE_SCALE[8] } },
                    React.createElement("input", { value: feedbackDraft[s.id] || '', onChange: (e) => setFeedbackDraft({ ...feedbackDraft, [s.id]: e.target.value }), placeholder: "Leave feedback\u2026", style: { ...goInputStyle, flex: 1 } }),
                    React.createElement("button", { onClick: () => addFeedback(s.id), style: goBtnStyle(true) }, "Send")));
        }));
}


export function goNextWeekday(from, weekday) {
    const d = new Date(from);
    const diff = (weekday - d.getDay() + 7) % 7 || 7;
    d.setDate(d.getDate() + diff);
    return d;
}


export function goEndOfMonth(from) { return new Date(from.getFullYear(), from.getMonth() + 1, 0); }


export function GoCalendarTab({ guild }) {
    const now = new Date();
    const events = [
        { icon: "\uD83D\uDD6F\uFE0F", title: 'Workshop Night', date: goNextWeekday(now, 3), desc: 'Bring a chapter for structured feedback from Mentors and Editors.' },
        { icon: "\uD83D\uDCDC", title: 'Anthology Submission Window Closes', date: goEndOfMonth(now), desc: `Final day to submit to ${guild.name}'s seasonal anthology.` },
        { icon: "\uD83D\uDDF3\uFE0F", title: 'Council Vote Closes', date: new Date(now.getTime() + 4 * 86400000), desc: 'The active Council proposal resolves.' },
        { icon: "\uD83C\uDFC6", title: 'Competition Entries Close', date: goEndOfMonth(now), desc: "Last day to submit this month's creative competition entry." },
        { icon: "\uD83C\uDF89", title: 'Guild Feast', date: goNextWeekday(now, 5), desc: 'An informal gathering \u2014 no agenda, just the guild.' },
    ].sort((a, b) => a.date - b.date);
    return React.createElement("div", null,
        events.map((e, i) => React.createElement("div", { key: i, style: { display: 'flex', gap: SPACE_SCALE[14], padding: '13px 4px', borderBottom: i < events.length - 1 ? '1px solid #2A2A30' : 'none' } },
            React.createElement("div", { style: { flexShrink: 0, width: 52, textAlign: 'center' } },
                React.createElement("div", { style: { fontFamily: "'Fraunces', Georgia, serif", fontSize: TYPE_SCALE[19], fontWeight: 600, color: '#E8C468' } }, e.date.getDate()),
                React.createElement("div", { style: { fontSize: TYPE_SCALE[9], textTransform: 'uppercase', color: '#5C5C64', letterSpacing: '0.04em' } }, e.date.toLocaleDateString(undefined, { month: 'short' }))),
            React.createElement("div", null,
                React.createElement("div", { style: { fontSize: TYPE_SCALE[13.5], color: '#EFE7D2', fontWeight: 600 } }, `${e.icon} ${e.title}`),
                React.createElement("div", { style: { fontSize: TYPE_SCALE[11.5], color: '#7A7A82', marginTop: 3 } }, e.desc)))));
}


export function GoTreasuryTab({ totalXP, playerRung, state, patchState }) {
    const balance = Math.max(0, Math.round(totalXP / 8) - state.treasurySpent);
    const canSpend = playerRung >= GO_PERMISSIONS.spendTreasury;
    const commission = (c) => {
        if (balance < c.cost || !canSpend) return;
        patchState({ treasurySpent: state.treasurySpent + c.cost, treasuryLedger: [{ title: c.title, cost: c.cost, ts: Date.now() }, ...state.treasuryLedger] });
    };
    return React.createElement("div", null,
        React.createElement("div", { style: { textAlign: 'center', marginBottom: 22 } },
            React.createElement("div", { style: { fontFamily: "'Fraunces', Georgia, serif", fontSize: TYPE_SCALE[34], fontWeight: 600, color: '#E8C468' } }, balance.toLocaleString()),
            React.createElement("div", { style: { fontSize: TYPE_SCALE[11], color: '#5C5C64', textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: 4 } }, 'Guild Coin'),
            React.createElement("div", { style: { fontSize: TYPE_SCALE[10.5], color: '#5C5C64', marginTop: 8, fontStyle: 'italic' } }, "Drawn from a share of Guild XP \u2014 a ledger for now, not real currency.")),
        !canSpend && React.createElement(GoLocked, { text: 'Only the Council and Guild Master may authorize spending from the treasury.' }),
        React.createElement("div", { style: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px,1fr))', gap: SPACE_SCALE[12], marginBottom: 26, opacity: canSpend ? 1 : 0.5 } },
            GO_COMMISSIONS.map((c) => React.createElement("div", { key: c.id, style: { background: '#1D1D22', border: '1px solid #2A2A30', borderRadius: RADIUS_SCALE[11], padding: 15 } },
                React.createElement("div", { style: { fontSize: TYPE_SCALE[18], marginBottom: 6 } }, c.icon),
                React.createElement("div", { style: { fontFamily: "'Fraunces', Georgia, serif", fontSize: TYPE_SCALE[13.5], color: '#EFE7D2', fontWeight: 600, marginBottom: 4 } }, c.title),
                React.createElement("div", { style: { fontSize: TYPE_SCALE[11], color: '#7A7A82', marginBottom: 10, lineHeight: 1.5 } }, c.desc),
                React.createElement("button", { disabled: !canSpend || balance < c.cost, onClick: () => commission(c), style: { ...goBtnStyle(true), opacity: (!canSpend || balance < c.cost) ? 0.4 : 1, cursor: (!canSpend || balance < c.cost) ? 'default' : 'pointer' } }, `Commission \u2014 ${c.cost} coin`)))),
        state.treasuryLedger.length > 0 && React.createElement("div", null,
            React.createElement("div", { style: { fontSize: TYPE_SCALE[11], textTransform: 'uppercase', letterSpacing: '0.08em', color: '#5C5C64', marginBottom: 10 } }, 'Ledger'),
            state.treasuryLedger.slice(0, 8).map((l, i) => React.createElement("div", { key: i, style: { display: 'flex', justifyContent: 'space-between', fontSize: TYPE_SCALE[12], color: '#8A8680', padding: '7px 0', borderBottom: '1px solid #2A2A30' } },
                React.createElement("span", null, l.title), React.createElement("span", { style: { color: '#C89B3C' } }, `-${l.cost}`)))));
}


export function GoLibraryTab({ projects, seedBooks, playerName }) {
    const mine = (projects || []).filter((p) => resolvePublishStatus(p) !== 'none').map((p) => ({ id: p.id, title: p.title, author: playerName || 'You', isPlayer: true }));
    const all = [...mine, ...seedBooks];
    return React.createElement("div", null,
        all.length === 0 ? React.createElement("div", { style: { textAlign: 'center', color: '#5C5C64', fontSize: TYPE_SCALE[12.5], padding: '30px 10px' } }, 'No books on the shelf yet.')
            : React.createElement("div", { style: { display: 'flex', flexWrap: 'wrap', gap: SPACE_SCALE[12], justifyContent: 'center' } },
                all.map((b) => React.createElement("div", { key: b.id, style: { width: 118, textAlign: 'center' } },
                    React.createElement("div", { style: { width: 118, height: 164, borderRadius: RADIUS_SCALE[6], background: b.isPlayer ? 'linear-gradient(155deg, #C89B3C55, #17151B 70%)' : 'linear-gradient(155deg, #6B5B8C55, #17151B 70%)', display: 'flex', alignItems: 'flex-end', padding: 10, boxShadow: '0 8px 18px rgba(0,0,0,0.45)' } },
                        React.createElement("div", { style: { fontFamily: "'Fraunces', Georgia, serif", fontStyle: 'italic', fontWeight: 600, fontSize: TYPE_SCALE[11.5], color: '#F4EEDD', lineHeight: 1.25 } }, b.title)),
                    React.createElement("div", { style: { fontSize: TYPE_SCALE[10.5], color: '#7A7A82', marginTop: 6 } }, b.isPlayer ? `${b.author} (you)` : b.author)))),
        React.createElement("div", { style: { textAlign: 'center', marginTop: 20, fontSize: TYPE_SCALE[10.5], color: '#5C5C64', fontStyle: 'italic' } }, "Your own published work is real \u2014 the rest of the shelf previews what a full guild library will hold."));
}


export function GoCouncilTab({ playerRung, state, patchState }) {
    const seedFor = 34, seedAgainst = 9, seedAbstain = 4;
    const votes = { yes: seedFor + (state.councilVote === 'yes' ? 1 : 0), no: seedAgainst + (state.councilVote === 'no' ? 1 : 0), abstain: seedAbstain + (state.councilVote === 'abstain' ? 1 : 0) };
    const total = votes.yes + votes.no + votes.abstain;
    const cast = (choice) => patchState({ councilVote: choice });
    const canPropose = playerRung >= GO_PERMISSIONS.openVote;
    const [proposalDraft, setProposalDraft] = useState('');
    const raiseProposal = () => { if (!proposalDraft.trim()) return; patchState({ proposals: [{ id: uuid(), text: proposalDraft.trim(), ts: Date.now() }, ...state.proposals] }); setProposalDraft(''); };
    return React.createElement("div", null,
        React.createElement("div", { style: { background: '#1D1D22', border: '1px solid rgba(232,196,104,0.3)', borderRadius: RADIUS_SCALE[12], padding: 18, marginBottom: 20 } },
            React.createElement("div", { style: { fontSize: TYPE_SCALE[10], textTransform: 'uppercase', letterSpacing: '0.1em', color: '#E8C468', marginBottom: 8 } }, 'Active Proposal'),
            React.createElement("div", { style: { fontFamily: "'Fraunces', Georgia, serif", fontSize: TYPE_SCALE[15.5], color: '#EFE7D2', fontWeight: 600, marginBottom: 6 } }, GO_ACTIVE_PROPOSAL.title),
            React.createElement("div", { style: { fontSize: TYPE_SCALE[12], color: '#8A8680', marginBottom: 14, lineHeight: 1.55 } }, GO_ACTIVE_PROPOSAL.desc),
            ['yes', 'no', 'abstain'].map((choice) => React.createElement("div", { key: choice, style: { marginBottom: 8 } },
                React.createElement("div", { style: { display: 'flex', justifyContent: 'space-between', fontSize: TYPE_SCALE[11.5], color: '#8A8680', marginBottom: 3 } },
                    React.createElement("span", null, choice === 'yes' ? 'For' : choice === 'no' ? 'Against' : 'Abstain'), React.createElement("span", null, `${Math.round((votes[choice] / total) * 100)}%`)),
                React.createElement(ProgressBar, { value: votes[choice], max: total, color: choice === 'yes' ? '#8FCB8F' : choice === 'no' ? '#B8735C' : '#5C5C64' }))),
            React.createElement("div", { style: { display: 'flex', gap: SPACE_SCALE[8], marginTop: 14 } },
                ['yes', 'no', 'abstain'].map((choice) => React.createElement("button", { key: choice, onClick: () => cast(choice), style: { ...goBtnStyle(state.councilVote === choice), flex: 1 } }, choice === 'yes' ? 'Vote For' : choice === 'no' ? 'Vote Against' : 'Abstain'))),
            state.councilVote && React.createElement("div", { style: { textAlign: 'center', fontSize: TYPE_SCALE[10.5], color: '#5C5C64', marginTop: 10 } }, `Your vote is recorded as "${state.councilVote}."`)),
        canPropose ? React.createElement("div", { style: { marginBottom: 22 } },
            React.createElement("textarea", { value: proposalDraft, onChange: (e) => setProposalDraft(e.target.value), placeholder: "Raise a new proposal to the Council\u2026", rows: 2, style: goInputStyle }),
            React.createElement("button", { onClick: raiseProposal, style: { ...goBtnStyle(true), marginTop: 8 } }, "Bring before the Council"))
            : React.createElement(GoLocked, { text: 'Only the Council and Guild Master may raise new proposals.' }),
        state.proposals.length > 0 && React.createElement("div", { style: { marginBottom: 22 } },
            React.createElement("div", { style: { fontSize: TYPE_SCALE[11], textTransform: 'uppercase', letterSpacing: '0.08em', color: '#5C5C64', marginBottom: 10 } }, 'Your Proposals, Pending'),
            state.proposals.map((p) => React.createElement("div", { key: p.id, style: { fontSize: TYPE_SCALE[12.5], color: '#B9B2A0', padding: '8px 0', borderBottom: '1px solid #2A2A30' } }, p.text))),
        React.createElement("div", null,
            React.createElement("div", { style: { fontSize: TYPE_SCALE[11], textTransform: 'uppercase', letterSpacing: '0.08em', color: '#5C5C64', marginBottom: 10 } }, 'Past Proposals'),
            GO_HISTORICAL_PROPOSALS.map((p, i) => React.createElement("div", { key: i, style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: TYPE_SCALE[12], padding: '9px 0', borderBottom: i < GO_HISTORICAL_PROPOSALS.length - 1 ? '1px solid #2A2A30' : 'none', gap: SPACE_SCALE[10] } },
                React.createElement("span", { style: { color: '#8A8680' } }, p.title),
                React.createElement("span", { style: { fontSize: TYPE_SCALE[10], fontWeight: 700, color: p.outcome === 'Passed' ? '#8FCB8F' : '#B8735C', whiteSpace: 'nowrap' } }, `${p.outcome} \u00B7 ${p.forPct}%`)))));
}


export function GoCompetitionsTab({ playerName, state, patchState }) {
    const now = new Date();
    const monthIdx = now.getMonth();
    const prompt = GO_PROMPTS[monthIdx % GO_PROMPTS.length];
    const [form, setForm] = useState({ title: '', blurb: '' });
    const entries = state.competitionEntry ? [...GO_COMPETITION_SEED, { id: 'you', author: playerName || 'You', title: state.competitionEntry.title, votes: 12, isPlayer: true }] : GO_COMPETITION_SEED;
    const totalVotes = entries.reduce((s, e) => s + e.votes + (state.competitionVote === e.id ? 1 : 0), 0) || 1;
    const submit = () => { if (!form.title.trim()) return; patchState({ competitionEntry: { title: form.title.trim(), blurb: form.blurb.trim(), ts: Date.now() } }); setForm({ title: '', blurb: '' }); };
    const vote = (id) => { if (!state.competitionVote) patchState({ competitionVote: id }); };
    const winner = [...GO_COMPETITION_SEED].sort((a, b) => b.votes - a.votes)[0];
    return React.createElement("div", null,
        React.createElement("div", { style: { background: '#1D1D22', border: '1px solid rgba(232,196,104,0.3)', borderRadius: RADIUS_SCALE[12], padding: 18, marginBottom: 20, textAlign: 'center' } },
            React.createElement("div", { style: { fontSize: TYPE_SCALE[10], textTransform: 'uppercase', letterSpacing: '0.1em', color: '#E8C468', marginBottom: 8 } }, now.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })),
            React.createElement("div", { style: { fontFamily: "'Fraunces', Georgia, serif", fontStyle: 'italic', fontSize: TYPE_SCALE[15.5], color: '#EFE7D2', lineHeight: 1.5 } }, `\u201C${prompt}\u201D`)),
        !state.competitionEntry ? React.createElement("div", { style: { marginBottom: 22 } },
            React.createElement("input", { value: form.title, onChange: (e) => setForm({ ...form, title: e.target.value }), placeholder: "Your entry's title", style: goInputStyle }),
            React.createElement("textarea", { value: form.blurb, onChange: (e) => setForm({ ...form, blurb: e.target.value }), placeholder: "A line or two about it\u2026", rows: 2, style: { ...goInputStyle, marginTop: 8 } }),
            React.createElement("button", { onClick: submit, style: { ...goBtnStyle(true), marginTop: 8 } }, "Submit your entry"))
            : React.createElement("div", { style: { textAlign: 'center', fontSize: TYPE_SCALE[12], color: '#8FCB8F', marginBottom: 22 } }, `\u2713 Entered with \u201C${state.competitionEntry.title}\u201D`),
        React.createElement("div", { style: { fontSize: TYPE_SCALE[11], textTransform: 'uppercase', letterSpacing: '0.08em', color: '#5C5C64', marginBottom: 10 } }, "This Month's Entries"),
        entries.map((e) => React.createElement("div", { key: e.id, style: { marginBottom: 12 } },
            React.createElement("div", { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: TYPE_SCALE[12.5], color: '#EFE7D2', marginBottom: 4, gap: SPACE_SCALE[10] } },
                React.createElement("span", null, `${e.title} \u2014 ${e.author}${e.isPlayer ? ' (you)' : ''}`),
                React.createElement("button", { onClick: () => vote(e.id), disabled: !!state.competitionVote, style: { ...goBtnStyle(state.competitionVote === e.id), fontSize: TYPE_SCALE[10.5], padding: '4px 9px', opacity: state.competitionVote && state.competitionVote !== e.id ? 0.4 : 1, flexShrink: 0 } }, state.competitionVote === e.id ? 'Voted' : 'Vote')),
            React.createElement(ProgressBar, { value: e.votes + (state.competitionVote === e.id ? 1 : 0), max: totalVotes, color: '#C89B3C' }))),
        React.createElement("div", { style: { marginTop: 24, paddingTop: 18, borderTop: '1px solid #2A2A30', textAlign: 'center' } },
            React.createElement("div", { style: { fontSize: TYPE_SCALE[10.5], color: '#5C5C64', marginBottom: 6 } }, "Last month's winner"),
            React.createElement("div", { style: { fontSize: TYPE_SCALE[13], color: '#E8C468', fontFamily: "'Fraunces', Georgia, serif", fontStyle: 'italic' } }, `\uD83C\uDFC6 \u201C${winner.title}\u201D by ${winner.author}`)));
}


export const GO_STATE_KEY_PREFIX = 'inkroot:guildOrder:v1:';


export function goDefaultState() {
    return {
        manuscriptNotes: {}, manuscriptStatus: {}, worldEntries: [], anthologySubmissions: [],
        workshopSubmissions: [], workshopFeedback: {}, treasurySpent: 0, treasuryLedger: [],
        councilVote: null, proposals: [], competitionEntry: null, competitionVote: null,
    };
}


export function useGoState(guildKey) {
    const [state, setState] = useState(null);
    const key = GO_STATE_KEY_PREFIX + (guildKey || 'guild');
    useEffect(() => {
        let cancelled = false;
        (async () => {
            let loaded = null;
            try { const res = await storage.get(key); if (res && res.value) loaded = JSON.parse(res.value); } catch (e) { /* nothing stored yet */ }
            if (!cancelled) setState({ ...goDefaultState(), ...(loaded || {}) });
        })();
        return () => { cancelled = true; };
    }, [key]);
    const patchState = (patch) => {
        setState((prev) => {
            const next = { ...prev, ...patch };
            storage.set(key, JSON.stringify(next)).catch(() => { });
            return next;
        });
    };
    return [state, patchState];
}


export function GuildOrderScreen({ guild, guildKey, isFounderView, guildProgress, guildRank, writerProfile, writerRank, projects, lifetimeStats }) {
    const [tab, setTab] = useState('roster');
    const [state, patchState] = useGoState(guildKey);
    const playerName = (writerProfile && (writerProfile.penName || writerProfile.name)) || 'You';
    const playerRung = goPlayerRung(writerRank, isFounderView);
    const roster = useMemo(() => goBuildRoster(guildKey, guild.name, playerName, playerRung), [guildKey, guild.name, playerName, playerRung]);
    const chapters = useMemo(() => goBuildManuscript(roster), [roster]);
    const anthologySeed = useMemo(() => goBuildAnthologySeed(roster), [roster]);
    const librarySeed = useMemo(() => goBuildLibrarySeed(roster), [roster]);
    const playerRoleKey = (GO_ROLES.find((r) => r.rung === playerRung) || GO_ROLES[GO_ROLES.length - 1]).key;
    const pulseLines = useMemo(() => {
        const mentor = roster.find((m) => m.role === 'mentor');
        const editor = roster.find((m) => m.role === 'editor');
        const writer = roster.find((m) => m.role === 'writer');
        return [
            `${(mentor && mentor.name) || 'A Mentor'} left feedback in Workshops.`,
            `${(editor && editor.name) || 'An Editor'} approved a chapter in the shared manuscript.`,
            `${(writer && writer.name) || 'A Writer'} added an entry to the World Bible.`,
        ];
    }, [roster]);
    const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0)) / 86400000);
    const pulseLine = pulseLines[dayOfYear % pulseLines.length];

    if (!state) {
        return React.createElement("div", { style: { textAlign: 'center', padding: '64px 12px', fontSize: TYPE_SCALE[12.5], color: '#5C5C64' } }, "Opening the Guild Order\u2026");
    }
    return React.createElement("div", { className: "ink-page-in" },
        React.createElement("div", { style: { textAlign: 'center', marginBottom: 22 } },
            React.createElement("div", { style: { fontSize: TYPE_SCALE[10.5], letterSpacing: '0.18em', textTransform: 'uppercase', color: '#5C5C64', marginBottom: 10 } }, "The Guild Order \u00B7 Preview"),
            React.createElement("div", { style: { fontFamily: "'Fraunces', Georgia, serif", fontStyle: 'italic', fontSize: TYPE_SCALE[24], fontWeight: 600, color: '#EFE7D2', marginBottom: 10 } }, guild.name),
            React.createElement(GoRoleBadge, { role: playerRoleKey, size: 12 }),
            React.createElement("div", { style: { fontSize: TYPE_SCALE[11], color: '#5C5C64', marginTop: 12, fontStyle: 'italic' } }, pulseLine)),
        React.createElement(GoTabNav, { active: tab, onSelect: setTab }),
        (() => {
            switch (tab) {
                case 'roster': return React.createElement(GoRosterTab, { guild, roster, guildProgress, guildRank });
                case 'manuscript': return React.createElement(GoManuscriptTab, { guild, chapters, playerRung, state, patchState });
                case 'worldbible': return React.createElement(GoWorldBibleTab, { seedEntries: GO_WORLD_SEED, state, patchState, playerRung, playerName });
                case 'anthology': return React.createElement(GoAnthologyTab, { guild, seedSubs: anthologySeed, state, patchState, projects, playerName });
                case 'workshops': return React.createElement(GoWorkshopsTab, { projects, playerName, playerRung, state, patchState });
                case 'quests': return React.createElement(GuildQuestBoard, { lifetimeStats });
                case 'calendar': return React.createElement(GoCalendarTab, { guild });
                case 'treasury': return React.createElement(GoTreasuryTab, { totalXP: guildProgress.totalXP, playerRung, state, patchState });
                case 'library': return React.createElement(GoLibraryTab, { projects, seedBooks: librarySeed, playerName });
                case 'council': return React.createElement(GoCouncilTab, { playerRung, state, patchState });
                case 'competitions': return React.createElement(GoCompetitionsTab, { playerName, state, patchState });
                default: return null;
            }
        })());
}
