import React, { useState } from 'react';
import { LIBRARY_SORTS, LibraryBookCard, readLibraryFavorites, writeLibraryFavorites } from '../library/publishing.jsx';
import { ArchiveSectionHeading, EmptyState } from '../shared-ui/ui-cards.jsx';
import { wordCount } from '../shared-utils/strip-html.jsx';
import { InkIcon } from '../shell/ink-icon.jsx';
import { RADIUS_SCALE, SPACE_SCALE, TYPE_SCALE } from '../shell/nav-context.jsx';


export function GuildLibrary({ projects, writerName, onOpen, onOpenAuthor }) {
    const [sortKey, setSortKey] = useState('newest');
    const [favorites, setFavorites] = useState(() => readLibraryFavorites());
    const toggleFavorite = (id) => {
        setFavorites((prev) => {
            const next = new Set(prev);
            if (next.has(id))
                next.delete(id);
            else
                next.add(id);
            writeLibraryFavorites(next);
            return next;
        });
    };
    const books = projects.filter((p) => p.completed).map((p) => ({
        id: p.id, title: p.title, subtitle: p.subtitle, seriesName: p.seriesName, cover: p.cover,
        author: (p.author && p.author.trim()) || writerName || 'Unnamed Writer',
        wordCount: p.wordCount || 0, genre: 'Unspecified', updatedAt: p.updatedAt || 0,
    }));
    const sorted = [...books];
    if (sortKey === 'favorites')
        sorted.sort((a, b) => (favorites.has(b.id) ? 1 : 0) - (favorites.has(a.id) ? 1 : 0) || b.updatedAt - a.updatedAt);
    else
        sorted.sort((a, b) => b.updatedAt - a.updatedAt); // 'rated' and 'mostRead' have no real data yet — falls back to newest, see caption below
    return React.createElement("div", { style: { marginTop: 34 } },
        React.createElement(ArchiveSectionHeading, { icon: React.createElement(InkIcon, { name: "library", size: 20, style: { display: "inline-block" } }), label: "The Guild Library" }),
        React.createElement("div", { style: { fontSize: TYPE_SCALE[11.5], color: '#5C5C64', textAlign: 'center', marginTop: 6, marginBottom: 16, fontStyle: 'italic' } }, "Every book here is yours to read in full \u2014 no samples or purchases needed"),
        React.createElement("div", { style: { display: 'flex', gap: SPACE_SCALE[6], flexWrap: 'wrap', justifyContent: 'center', marginBottom: 10 } },
            LIBRARY_SORTS.map((s) => React.createElement("button", { key: s.key, onClick: () => setSortKey(s.key), style: {
                    background: sortKey === s.key ? 'linear-gradient(160deg, #241F14, #1A160D)' : 'none',
                    border: '1px solid #3A3020', color: sortKey === s.key ? '#E8C468' : '#A6A6AD',
                    borderRadius: RADIUS_SCALE[999], padding: '6px 12px', fontSize: TYPE_SCALE[11.5], cursor: 'pointer',
                } }, s.label))),
        (sortKey === 'rated' || sortKey === 'mostRead') && React.createElement("div", { style: { fontSize: TYPE_SCALE[10.5], color: '#5C5C64', textAlign: 'center', marginBottom: 14, fontStyle: 'italic' } }, "no ratings or reading data tracked yet \u2014 showing newest first"),
        sorted.length === 0
            ? React.createElement(EmptyState, { text: "No books published yet \u2014 complete a project to add it to the Guild Library." })
            : React.createElement("div", { className: "ink-grid-cards" },
                sorted.map((book) => React.createElement(LibraryBookCard, { key: book.id, book, isFavorite: favorites.has(book.id), onToggleFavorite: toggleFavorite, onRead: onOpen, onOpenAuthor }))));
}
