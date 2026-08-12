import React from 'react';


// Display names for the breadcrumb trail / Back button label when a Project Workspace tab isn't
// the Hub — kept separate from NAV_GROUPS' per-worldCategory labels since the breadcrumb only
// needs one name per underlying tab, not one per sidebar shortcut into it.
export const TAB_BREADCRUMB_LABELS = {
    manuscript: 'Manuscript', characters: 'Characters', locations: 'Locations', maps: 'Maps',
    timeline: 'Timeline', world: 'World Bible', glossary: 'Glossary', notes: 'Notes',
    health: 'Story Health', progress: 'Progress', achievements: 'Achievement Hall', settings: 'Settings',
    packs: 'Publishing',
};


// The single source of truth for how the sidebar and the Project Home hub group every section.
// Several items point at the 'world' tab with a specific worldCategory — clicking them opens the
// World Bible pre-filtered to that category, so Houses & Clans, Organizations, Magic, Religions,
// and Artifacts each get their own nav entry even though they all live in the same underlying tab.
export const NAV_GROUPS = [
    { key: 'story', icon: '📖', label: 'Story', items: [
            { key: 'manuscript', icon: '📝', label: 'Manuscript' },
            { key: 'notes', icon: '🗒', label: 'Notes' },
        ] },
    { key: 'world', icon: '🌍', label: 'World', items: [
            { key: 'world', icon: '📘', label: 'World Bible', worldCategory: 'all' },
            { key: 'locations', icon: '🏰', label: 'Locations' },
            { key: 'maps', icon: '🗺', label: 'Maps' },
            { key: 'timeline', icon: '📅', label: 'Timeline' },
            { key: 'glossary', icon: '📚', label: 'Glossary' },
        ] },
    { key: 'people', icon: '👑', label: 'People', items: [
            { key: 'characters', icon: '👥', label: 'Characters' },
            { key: 'world', icon: '⚜', label: 'Houses & Clans', worldCategory: 'houses' },
            { key: 'world', icon: '🏛', label: 'Organizations', worldCategory: 'organizations' },
        ] },
    { key: 'lore', icon: '✨', label: 'Lore', items: [
            { key: 'world', icon: '✨', label: 'Magic', worldCategory: 'magic' },
            { key: 'world', icon: '⛩', label: 'Religions', worldCategory: 'religions' },
            { key: 'world', icon: '🗝', label: 'Artifacts', worldCategory: 'artifacts' },
        ] },
    { key: 'project', icon: '📊', label: 'Project', items: [
            { key: 'health', icon: '🩺', label: 'Story Health' },
            { key: 'progress', icon: '📊', label: 'Progress' },
            { key: 'achievements', icon: '🏆', label: 'Achievements' },
            { key: 'settings', icon: '⚙', label: 'Settings' },
        ] },
    { key: 'publishing', icon: '📦', label: 'Publishing', items: [
            { key: 'packs', icon: '📦', label: 'Publishing' },
        ] },
];
