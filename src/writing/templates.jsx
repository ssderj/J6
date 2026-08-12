import React, { useState } from 'react';
import { ArchiveSectionHeading, SectionLabel } from '../shared-ui/ui-cards.jsx';
import { CardList } from '../shared-ui/ui-primitives.jsx';
import { uuid } from '../shared-utils/storage-keys.jsx';
import { InkIcon } from '../shell/ink-icon.jsx';
import { RADIUS_SCALE, SPACE_SCALE, TYPE_SCALE } from '../shell/nav-context.jsx';
import { WORLD_BIBLE_CATEGORIES, worldExtraFields } from '../worldbuilding/book-cover.jsx';
import { ComingSoonNotice } from './coming-soon-notice.jsx';


// ---------- Templates: reusable starting points, saved once and used everywhere ----------
// Stored per-device (not per-project) under one key, same read/write-with-fallback shape as
// every other localStorage-backed list in the app (see readLibraryFavorites) — so a template
// made while working on one novel is still there for the next one. Applying a template just
// pushes a new item onto the *current* project through its own update() function, exactly the
// same path every other "+ Add" button in this app already uses — there's no second write path
// to keep in sync. Publishing/sharing templates with other writers needs a shared backend Inkroot
// doesn't have yet, so that stays an honest Coming Soon rather than a fake "Share" button.
export const TEMPLATES_KEY = 'inkroot:templates';


export const TEMPLATE_TYPES = [
    { key: 'book', label: 'Book', icon: 'book' },
    { key: 'chapter', label: 'Chapter', icon: 'library' },
    { key: 'character', label: 'Character', icon: 'guild' },
    { key: 'worldbuilding', label: 'Worldbuilding', icon: 'universe' },
];


export function readTemplates() {
    try {
        const raw = JSON.parse(localStorage.getItem(TEMPLATES_KEY) || '[]');
        return Array.isArray(raw) ? raw : [];
    }
    catch (e) {
        return [];
    }
}


export function writeTemplates(list) {
    try {
        localStorage.setItem(TEMPLATES_KEY, JSON.stringify(list));
    }
    catch (e) { }
}


function emptyTemplate(type) {
    const base = { id: uuid(), type, name: '' };
    if (type === 'book')
        return { ...base, title: '', subtitle: '', seriesName: '', author: '' };
    if (type === 'chapter')
        return { ...base, chapterTitle: '', text: '' };
    if (type === 'character')
        return { ...base, role: '', occupation: '', goals: '', personality: '', biography: '' };
    return { ...base, category: 'houses', topic: '', detail: '' };
}


const FIELD_SETS = {
    book: [
        { key: 'name', placeholder: 'Template name (e.g. "Epic Fantasy Starter")' },
        { key: 'title', placeholder: 'Working title' },
        { key: 'subtitle', placeholder: 'Subtitle (optional)' },
        { key: 'seriesName', placeholder: 'Series name (optional)' },
        { key: 'author', placeholder: 'Author name' },
    ],
    chapter: [
        { key: 'name', placeholder: 'Template name (e.g. "Action Scene Opener")' },
        { key: 'chapterTitle', placeholder: 'Chapter title' },
        { key: 'text', placeholder: 'Starting text\u2026', kind: 'textarea' },
    ],
    character: [
        { key: 'name', placeholder: 'Template name (e.g. "Chosen One Archetype")' },
        { key: 'role', placeholder: 'Role (e.g. Protagonist)' },
        { key: 'occupation', placeholder: 'Occupation' },
        { key: 'goals', placeholder: 'Goals', kind: 'textarea' },
        { key: 'personality', placeholder: 'Personality', kind: 'textarea' },
        { key: 'biography', placeholder: 'Biography', kind: 'textarea' },
    ],
    worldbuilding: [
        { key: 'name', placeholder: 'Template name (e.g. "Border Kingdom")' },
        { key: 'category', placeholder: 'Category', kind: 'select', options: WORLD_BIBLE_CATEGORIES.filter((c) => c.key !== 'all').map((c) => ({ value: c.key, label: c.label })) },
        { key: 'topic', placeholder: 'Topic / name' },
        { key: 'detail', placeholder: 'Detail', kind: 'textarea' },
    ],
};


// One CRUD list for a single template type, plus an "Apply to this project" action per card
// that writes straight into the current project through the same update() every other tab uses.
function TemplateTypeSection({ type, icon, label, templates, onChange, askConfirm, project, update }) {
    const items = templates.filter((t) => t.type === type);
    const applyLabel = type === 'book' ? 'Apply to Settings'
        : type === 'chapter' ? 'Add as new chapter'
            : type === 'character' ? 'Add as new character'
                : 'Add as new world entry';
    const handleApply = (t) => {
        if (type === 'book') {
            update((p) => {
                if (t.title)
                    p.title = t.title;
                if (t.subtitle)
                    p.subtitle = t.subtitle;
                if (t.seriesName)
                    p.seriesName = t.seriesName;
                if (t.author)
                    p.author = t.author;
            });
        }
        else if (type === 'chapter') {
            update((p) => {
                const number = (p.chapters.reduce((m, c) => Math.max(m, c.number || 0), 0) || 0) + 1;
                p.chapters.push({ id: uuid(), title: t.chapterTitle || `Chapter ${number}`, text: t.text || '', number, isCopy: false });
            });
        }
        else if (type === 'character') {
            update((p) => {
                p.characters.push({
                    id: uuid(), name: '', alias: '', age: '', birthday: '', race: '', occupation: t.occupation || '',
                    status: '', lifeStatus: '', role: t.role || '', portraitUrl: '', houseId: '', tags: [],
                    goals: t.goals || '', personality: t.personality || '', biography: t.biography || '', notes: '',
                });
            });
        }
        else {
            const defaults = worldExtraFields(t.category || 'houses').defaults;
            update((p) => {
                p.world.push({ id: uuid(), topic: t.topic || '', category: t.category || 'houses', detail: t.detail || '', crestUrl: '', bannerUrl: '', ...defaults });
            });
        }
    };
    return React.createElement("div", { style: { marginBottom: 34 } },
        React.createElement(ArchiveSectionHeading, { icon: React.createElement(InkIcon, { name: icon, size: 14 }), label }),
        React.createElement("div", { style: { marginTop: 14 } },
            React.createElement(CardList, {
                items, fields: FIELD_SETS[type], anchorPrefix: `tpl-${type}`, askConfirm,
                itemLabel: (item) => item.name || 'this template',
                addLabel: `New ${label.toLowerCase()} template`,
                emptyText: `No ${label.toLowerCase()} templates yet.`,
                onAdd: () => onChange([...templates, emptyTemplate(type)]),
                onRemove: (id) => onChange(templates.filter((t) => t.id !== id)),
                onChange: (id, key, val) => onChange(templates.map((t) => t.id === id ? { ...t, [key]: val } : t)),
                renderFooter: (item) => React.createElement("button", {
                    onClick: () => handleApply(item), style: {
                        marginTop: 10, background: 'none', border: '1px solid #3A3020', color: '#C89B3C', borderRadius: RADIUS_SCALE[8],
                        padding: '6px 13px', fontSize: TYPE_SCALE[11.5], cursor: 'pointer', fontWeight: 600,
                    },
                }, applyLabel),
            })));
}


export function TemplatesPanel({ project, update, askConfirm }) {
    const [templates, setTemplates] = useState(readTemplates());
    const onChange = (next) => { setTemplates(next); writeTemplates(next); };
    return React.createElement("div", null,
        React.createElement(SectionLabel, null, "Templates"),
        React.createElement("div", { style: { fontSize: TYPE_SCALE[13], color: '#7A7A82', marginBottom: 18, maxWidth: 560, lineHeight: 1.6 } }, "Save reusable starting points for books, chapters, characters, and worldbuilding entries. Templates live on this device and are available from every project."),
        React.createElement("div", { style: { marginBottom: 22 } },
            React.createElement(ComingSoonNotice, { icon: "\uD83D\uDCE4", text: "Publishing templates to share with other writers needs a shared backend Inkroot doesn't have yet \u2014 for now, templates stay private to this device." })),
        TEMPLATE_TYPES.map((t) => React.createElement(TemplateTypeSection, {
            key: t.key, type: t.key, icon: t.icon, label: t.label, templates, onChange, askConfirm, project, update,
        })));
}
