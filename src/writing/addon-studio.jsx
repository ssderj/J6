import React, { useState } from 'react';
import { SectionLabel } from '../shared-ui/ui-cards.jsx';
import { CardList } from '../shared-ui/ui-primitives.jsx';
import { uuid } from '../shared-utils/storage-keys.jsx';
import { RADIUS_SCALE, SPACE_SCALE, TYPE_SCALE } from '../shell/nav-context.jsx';
import { ComingSoonNotice } from './coming-soon-notice.jsx';


// ---------- Addon Studio: author, don't yet run ----------
// Addons are metadata records today — name, icon, description, category, version, and a
// Draft/Published status the author controls themselves. That's deliberate: actually installing
// an addon into a project, executing whatever it does, or listing it for other writers all need
// a real sandbox (a locked-down execution boundary with no access to a project's data beyond what
// the addon is explicitly granted) and a shared backend, neither of which exists yet. Rather than
// pretend an addon does something, every action past "describe it" stays an honest Coming Soon —
// same policy as ComingSoonNotice everywhere else in Inkroot. Stored on-device, same
// read/write-with-fallback shape as Templates and every other localStorage-backed list here.
export const ADDONS_KEY = 'inkroot:addons';


export const ADDON_CATEGORIES = ['Editor Tools', 'World Bible', 'Writing Aids', 'Themes & Covers', 'Import & Export', 'Guild & Community', 'Other'];


export const ADDON_STATUSES = [
    { value: 'draft', label: 'Draft' },
    { value: 'published', label: 'Published' },
];


export function readAddons() {
    try {
        const raw = JSON.parse(localStorage.getItem(ADDONS_KEY) || '[]');
        return Array.isArray(raw) ? raw : [];
    }
    catch (e) {
        return [];
    }
}


export function writeAddons(list) {
    try {
        localStorage.setItem(ADDONS_KEY, JSON.stringify(list));
    }
    catch (e) { }
}


function emptyAddon() {
    return { id: uuid(), name: '', icon: '\uD83E\uDDE9', description: '', category: ADDON_CATEGORIES[0], version: '0.1.0', status: 'draft' };
}


const ADDON_FIELDS = [
    { key: 'name', placeholder: 'Addon name' },
    { key: 'icon', placeholder: 'Icon (emoji, e.g. \uD83E\uDDE9)' },
    { key: 'description', placeholder: 'What does this addon do\u2026', kind: 'textarea' },
    { key: 'category', placeholder: 'Category', kind: 'select', options: ADDON_CATEGORIES.map((c) => ({ value: c, label: c })) },
    { key: 'version', placeholder: 'Version (e.g. 1.0.0)' },
    { key: 'status', placeholder: 'Status', kind: 'select', options: ADDON_STATUSES },
];


function AddonStatusBadge({ status }) {
    const published = status === 'published';
    return React.createElement("span", { style: {
            fontSize: TYPE_SCALE[10.5], fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase',
            padding: '3px 9px', borderRadius: RADIUS_SCALE[999],
            background: published ? 'rgba(200,155,60,0.12)' : 'rgba(122,122,130,0.12)',
            color: published ? '#C89B3C' : '#8A8272',
        } }, published ? 'Published' : 'Draft');
}


export function AddonStudioPanel({ askConfirm }) {
    const [addons, setAddons] = useState(readAddons());
    const onChange = (next) => { setAddons(next); writeAddons(next); };
    return React.createElement("div", null,
        React.createElement(SectionLabel, null, "Addon Studio"),
        React.createElement("div", { style: { fontSize: TYPE_SCALE[13], color: '#7A7A82', marginBottom: 18, maxWidth: 560, lineHeight: 1.6 } }, "Create and manage addons \u2014 name, icon, description, category, version, and a Draft/Published status you control. Addons are designed to run in a locked-down sandbox with no access beyond what you explicitly grant, once that sandbox exists."),
        React.createElement("div", { style: { display: 'flex', flexDirection: 'column', gap: SPACE_SCALE[10], marginBottom: 22 } },
            React.createElement(ComingSoonNotice, { icon: "\uD83E\uDDEA", text: "Test runs need a real sandbox \u2014 an execution boundary that can't reach a project's data beyond what an addon is explicitly granted. That doesn't exist yet, so test runs aren't wired up." }),
            React.createElement(ComingSoonNotice, { icon: "\u2699\uFE0F", text: "Installing a Published addon into a project isn't wired up yet \u2014 Draft/Published only records your own intent for now." }),
            React.createElement(ComingSoonNotice, { icon: "\uD83C\uDFEA", text: "A marketplace for browsing and installing other writers' addons needs a shared backend Inkroot doesn't have yet." })),
        React.createElement(CardList, {
            items: addons, fields: ADDON_FIELDS, anchorPrefix: "addon", askConfirm: askConfirm,
            itemLabel: (item) => item.name || 'this addon',
            addLabel: "New addon", emptyText: "No addons yet. Create one to start sketching what it should do.",
            onAdd: () => onChange([...addons, emptyAddon()]),
            onRemove: (id) => onChange(addons.filter((a) => a.id !== id)),
            onChange: (id, key, val) => onChange(addons.map((a) => a.id === id ? { ...a, [key]: val } : a)),
            renderFooter: (item) => React.createElement("div", { style: { display: 'flex', alignItems: 'center', gap: SPACE_SCALE[10], marginTop: 10 } },
                React.createElement(AddonStatusBadge, { status: item.status }),
                React.createElement("span", { style: { fontSize: TYPE_SCALE[11], color: '#5C5C64' } }, `v${item.version || '0.1.0'} \u00B7 ${item.category || 'Other'}`)),
        }));
}
