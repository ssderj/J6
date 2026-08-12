import React, { useState, useEffect, useRef, useMemo } from 'react';
import { storage } from '../lib/storage.js';
import { fetchAuthorRatingsSummary, fetchBookStats } from '../lib/library.js';
import { IdentityPlaque } from '../guild/guild-hall.jsx';
import { LibraryAuthorLink, LibraryCardBadge, LibraryCardRating, LibraryQuickActions, LibrarySectionHeading, SeriesTag, estimateReadingTime, formatLibraryPrice, getLibraryBadge, isSerialFormat, readLibraryDiscussions, resolvePublishStatus, writeLibraryDiscussions } from './publishing.jsx';
import { formatRelativeTime } from '../shared-utils/format-duration.jsx';
import { projectKey, uuid } from '../shared-utils/storage-keys.jsx';
import { stripHtml, wordCount } from '../shared-utils/strip-html.jsx';
import { truncate } from '../shared-utils/truncate.jsx';
import { InkIcon } from '../shell/ink-icon.jsx';
import { RADIUS_SCALE, SPACE_SCALE, TYPE_SCALE } from '../shell/nav-context.jsx';
import { BookCover } from '../worldbuilding/book-cover.jsx';
import { ComingSoonNotice } from '../writing/coming-soon-notice.jsx';
import { WRITER_LEVEL_MAX, WRITER_RANKS } from '../writing/health-checks.jsx';
import { patchProjectDefaults } from '../writing/project-schema-and-backups.jsx';


// "Book Discussion Hall" — a real, working thread of the reader's own posts about a book, kept
// on this device (see LIBRARY_DISCUSSIONS_KEY). Same honesty policy as Guild feedback
// (GuildBookFeedbackModal) and personal ratings: genuinely functional today, honestly marked as
// device-local until Inkroot has a shared backend to carry every reader's posts to every device.
export function DiscussionHallModal({ book, writerName, onClose }) {
    const [posts, setPosts] = useState(() => (readLibraryDiscussions()[book.id] || []));
    const [note, setNote] = useState('');
    const handlePost = () => {
        if (!note.trim())
            return;
        const entry = { id: uuid(), author: writerName || 'You', note: note.trim().slice(0, 500), at: Date.now() };
        const next = [...posts, entry];
        setPosts(next);
        const all = readLibraryDiscussions();
        all[book.id] = next;
        writeLibraryDiscussions(all);
        setNote('');
    };
    return React.createElement("div", { onClick: onClose, style: {
            position: 'fixed', inset: 0, zIndex: 65, background: 'rgba(10,9,7,0.72)', backdropFilter: 'blur(3px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
        } },
        React.createElement("div", { onClick: (e) => e.stopPropagation(), style: {
                width: '100%', maxWidth: 460, maxHeight: '86vh', overflowY: 'auto',
                background: 'linear-gradient(160deg, #241F16, #17130E)', border: '1px solid #4A3D22', borderRadius: RADIUS_SCALE[16],
                padding: 22, boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
            } },
            React.createElement("div", { style: { display: 'flex', justifyContent: 'flex-end' } },
                React.createElement("button", { onClick: onClose, style: {
                        background: 'none', border: 'none', color: '#7A7A82', fontSize: TYPE_SCALE[18], cursor: 'pointer', padding: 0, lineHeight: 1,
                    } }, "\u2715")),
            React.createElement("div", { style: { display: 'flex', alignItems: 'center', gap: SPACE_SCALE[8], marginTop: -8 } },
                React.createElement("span", { style: { fontSize: TYPE_SCALE[17] } }, "\uD83D\uDCAC"),
                React.createElement("div", null,
                    React.createElement("div", { style: { fontFamily: "'Fraunces', Georgia, serif", fontSize: TYPE_SCALE[16], fontWeight: 600, color: '#EFE7D2' } }, "Discussion Hall"),
                    React.createElement("div", { style: { fontSize: TYPE_SCALE[11.5], color: '#A6A6AD' } }, book.title || 'Untitled Novel'))),
            React.createElement("div", { style: { marginTop: 18 } },
                posts.length === 0
                    ? React.createElement("div", { style: { fontSize: TYPE_SCALE[11.5], color: '#5C5C64', fontStyle: 'italic' } }, "No posts yet — start the conversation.")
                    : React.createElement("div", { style: { display: 'flex', flexDirection: 'column', gap: SPACE_SCALE[10], marginBottom: 14 } },
                        posts.map((p) => React.createElement("div", { key: p.id, style: { background: '#1D1D22', border: '1px solid #2A2A30', borderRadius: RADIUS_SCALE[8], padding: 10 } },
                            React.createElement("div", { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 } },
                                React.createElement("span", { style: { fontSize: TYPE_SCALE[11.5], fontWeight: 600, color: '#C9BE8D' } }, p.author),
                                React.createElement("span", { style: { fontSize: TYPE_SCALE[10], color: '#5C5C64' } }, formatRelativeTime(p.at))),
                            React.createElement("div", { style: { fontSize: TYPE_SCALE[12], color: '#D9D2BE', lineHeight: 1.5, whiteSpace: 'pre-wrap' } }, p.note))))),
            React.createElement("textarea", { value: note, onChange: (e) => setNote(e.target.value), maxLength: 500, rows: 3,
                    placeholder: "Share a thought about this book…", style: {
                    width: '100%', background: '#1D1D22', border: '1px solid #2A2A30', color: '#EFE7D2',
                    borderRadius: RADIUS_SCALE[8], padding: '8px 10px', fontSize: TYPE_SCALE[12.5], resize: 'vertical', fontFamily: 'inherit',
                } }),
            React.createElement("button", { onClick: handlePost, disabled: !note.trim(), style: {
                    marginTop: 8, background: 'linear-gradient(160deg, #241F14, #17140F)', border: '1px solid #4A3D22',
                    color: note.trim() ? '#E8C468' : '#5C5C64', borderRadius: RADIUS_SCALE[8], padding: '7px 16px', fontSize: TYPE_SCALE[12],
                    cursor: note.trim() ? 'pointer' : 'default', fontWeight: 600,
                } }, "Post"),
            React.createElement("div", { style: { marginTop: 14 } },
                React.createElement(ComingSoonNotice, { text: "Only your own posts show here for now — a Discussion Hall shared with every reader is coming soon." }))));
}


// The Cart — a real, persisted queue of books a reader means to buy (see LIBRARY_CART_KEY),
// opened from the Search Bar / Cart / Notifications row at the top of Discover. Same honesty
// policy as the rest of the marketplace: the queue itself is genuine, but checking out can't
// actually charge anyone until Inkroot has a payment processor.
export function CartDrawer({ items, onClose, onRemove, onOpenBook }) {
    const total = items.reduce((sum, it) => sum + (it.price > 0 ? it.price : 0), 0);
    return React.createElement("div", { onClick: onClose, style: {
            position: 'fixed', inset: 0, zIndex: 65, background: 'rgba(10,9,7,0.72)', backdropFilter: 'blur(3px)',
            display: 'flex', alignItems: 'flex-start', justifyContent: 'flex-end', padding: 0,
        } },
        React.createElement("div", { onClick: (e) => e.stopPropagation(), style: {
                width: 'min(400px, 92vw)', minHeight: '100vh',
                background: 'linear-gradient(160deg, #201B12, #15120C)', borderLeft: '1px solid #4A3D22',
                padding: 22, boxShadow: '-20px 0 50px rgba(0,0,0,0.5)',
            } },
            React.createElement("div", { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 } },
                React.createElement("div", { style: { fontFamily: "'Fraunces', Georgia, serif", fontSize: TYPE_SCALE[17], fontWeight: 600, color: '#EFE7D2' } }, "\uD83D\uDED2 Cart"),
                React.createElement("button", { onClick: onClose, style: {
                        background: 'none', border: 'none', color: '#7A7A82', fontSize: TYPE_SCALE[18], cursor: 'pointer', padding: 0, lineHeight: 1,
                    } }, "\u2715")),
            items.length === 0
                ? React.createElement("div", { style: { fontSize: TYPE_SCALE[12], color: '#5C5C64', fontStyle: 'italic' } }, "Your cart is empty — add a book with its Buy button.")
                : React.createElement("div", { style: { display: 'flex', flexDirection: 'column', gap: SPACE_SCALE[10] } },
                    items.map((it) => React.createElement("div", { key: it.id, style: {
                            display: 'flex', alignItems: 'center', gap: SPACE_SCALE[10], background: '#1D1D22', border: '1px solid #2A2A30',
                            borderRadius: RADIUS_SCALE[8], padding: 10,
                        } },
                        React.createElement("div", { onClick: () => onOpenBook(it.id), style: { flex: 1, minWidth: 0, cursor: 'pointer' } },
                            React.createElement("div", { style: { fontSize: TYPE_SCALE[12.5], fontWeight: 600, color: '#EFE7D2', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' } }, it.title),
                            React.createElement("div", { style: { fontSize: TYPE_SCALE[10.5], color: '#7A7A82', marginTop: 2 } }, it.author)),
                        React.createElement("span", { style: { fontSize: TYPE_SCALE[11.5], fontWeight: 600, color: it.price > 0 ? '#E8C468' : '#8FCB8F', flexShrink: 0 } }, formatLibraryPrice(it.price)),
                        React.createElement("button", { onClick: () => onRemove(it.id), style: {
                                background: 'none', border: 'none', color: '#7A7A82', fontSize: TYPE_SCALE[15], cursor: 'pointer', padding: 0, flexShrink: 0,
                            } }, "\u2715")))),
            items.length > 0 && React.createElement("div", { style: { marginTop: 18, paddingTop: 14, borderTop: '1px solid #2A2417' } },
                React.createElement("div", { style: { display: 'flex', justifyContent: 'space-between', fontSize: TYPE_SCALE[13], fontWeight: 600, color: '#EFE7D2', marginBottom: 12 } },
                    React.createElement("span", null, "Total"), React.createElement("span", null, formatLibraryPrice(total))),
                React.createElement(ComingSoonNotice, { text: "Checkout isn't wired up yet — Inkroot has no payment processor. Every book here can still be read in full, for free." }))));
}


// The single Featured Chronicle spotlighted above New Releases — always exactly one book, picked
// from what's actually published: the reader's own highest-rated pick if they've rated anything
// (see ratedBooks in GrandLibraryScreen), otherwise the newest release. The star row shown here
// is that same personal rating, since a reader's own rating is the only rating data that's real
// today (see BookDetailModal) — an unrated book shows five empty stars rather than a number
// invented for the occasion. The golden glow and the soft light drifting above it (see the
// .gl-featured-card / .gl-lamp-light keyframes) are purely atmospheric, echoing the chandelier
// hanging over the rest of the Grand Library (see GrandLibraryAtmosphere).
export function FeaturedChronicleCard({ book, myRating, onRead, onViewDetails, onOpenAuthor, following, inCart, onToggleFollow, onBuy, onTip, onRate, onDiscuss, onSample }) {
    const stars = (myRating && myRating.stars) || 0;
    const badge = getLibraryBadge(book);
    return React.createElement("div", { className: "gl-featured-card", style: {
            position: 'relative', display: 'flex', gap: SPACE_SCALE[22], alignItems: 'flex-start', flexWrap: 'wrap',
            background: 'linear-gradient(160deg, #2A2317, #17130E)', border: '1px solid #4A3D22',
            borderRadius: RADIUS_SCALE[18], padding: '26px 28px', marginBottom: 30,
        } },
        React.createElement("div", { className: "gl-lamp-light", style: {
                position: 'absolute', top: -50, left: '50%', width: 170, height: 220, zIndex: 0, pointerEvents: 'none',
                background: 'linear-gradient(180deg, rgba(255,224,153,0.30), rgba(255,224,153,0.05) 55%, transparent)',
                filter: 'blur(12px)',
            } }),
        React.createElement("div", { style: { position: 'relative', zIndex: 1, flexShrink: 0, margin: '0 auto' } },
            React.createElement(BookCover, { title: book.title, subtitle: book.subtitle, seriesName: book.seriesName, author: book.author, cover: book.cover, size: 'lg' })),
        React.createElement("div", { style: { position: 'relative', zIndex: 1, flex: 1, minWidth: 220 } },
            React.createElement("div", { style: { fontSize: TYPE_SCALE[10.5], fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#C89B3C', marginBottom: 8 } }, "\u2726 Featured Chronicle"),
            React.createElement("div", { style: { display: 'flex', alignItems: 'center', gap: SPACE_SCALE[8], flexWrap: 'wrap' } },
                React.createElement("div", { style: { fontFamily: "'Fraunces', Georgia, serif", fontSize: TYPE_SCALE[24], fontWeight: 600, color: '#EFE7D2', lineHeight: 1.2 } }, book.title || 'Untitled Novel'),
                React.createElement(LibraryCardBadge, { badge }),
                isSerialFormat(book) && React.createElement(SeriesTag, null)),
            React.createElement(LibraryAuthorLink, { author: book.author, onOpenAuthor }),
            React.createElement("div", { style: { display: 'flex', alignItems: 'center', gap: SPACE_SCALE[10], marginTop: 16, flexWrap: 'wrap' } },
                React.createElement("span", { style: {
                        fontSize: TYPE_SCALE[10.5], fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase',
                        padding: '3px 9px', borderRadius: RADIUS_SCALE[999], background: 'rgba(200,155,60,0.12)', color: '#C89B3C',
                    } }, book.genre),
                React.createElement("span", { style: { fontSize: TYPE_SCALE[13], color: stars > 0 ? '#E8C468' : '#4A4A50', letterSpacing: 1 } }, "\u2605".repeat(stars) + "\u2606".repeat(5 - stars)),
                React.createElement("span", { style: { fontSize: TYPE_SCALE[12.5], fontWeight: 600, color: book.price > 0 ? '#E8C468' : '#8FCB8F' } }, formatLibraryPrice(book.price))),
            book.blurb && React.createElement("div", { style: {
                    fontSize: TYPE_SCALE[13], color: '#C9BE8D', marginTop: 14, lineHeight: 1.6, fontStyle: 'italic', maxWidth: 480,
                    display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden',
                } }, book.blurb),
            React.createElement("div", { style: { display: 'flex', gap: SPACE_SCALE[10], marginTop: 20, flexWrap: 'wrap' } },
                React.createElement("button", { onClick: onRead, style: {
                        background: 'linear-gradient(160deg, #E8C468, #C89B3C)', border: 'none', color: '#17171B',
                        borderRadius: RADIUS_SCALE[9], padding: '10px 20px', fontSize: TYPE_SCALE[13], fontWeight: 700, cursor: 'pointer',
                        boxShadow: '0 4px 14px rgba(200,155,60,0.35)',
                    } }, "\uD83D\uDCD6 Read Now"),
                React.createElement("button", { onClick: onViewDetails, style: {
                        background: 'none', border: '1px solid #4A3D22', color: '#E8C468',
                        borderRadius: RADIUS_SCALE[9], padding: '10px 20px', fontSize: TYPE_SCALE[13], fontWeight: 600, cursor: 'pointer',
                    } }, "View Details")),
            React.createElement("div", { style: { maxWidth: 420 } },
                React.createElement(LibraryQuickActions, {
                    book, following, inCart, onToggleFollow, onBuy, onTip, onRate, onDiscuss, onSample,
                }))));
}


// A Coming Soon section — same heading treatment as a real shelf, but with a row of faint,
// unlit "ghost" spines standing in for books that can't be shown yet, plus the honest notice
// explaining why (it needs a shared backend service Inkroot doesn't have today).
export function ComingSoonShelf({ icon, label, description }) {
    return React.createElement("div", { style: { marginBottom: 30 } },
        React.createElement(LibrarySectionHeading, { icon, label }),
        React.createElement("div", { style: { display: 'flex', gap: SPACE_SCALE[10], marginBottom: 10 } },
            [0, 1, 2, 3, 4].map((i) => React.createElement("div", { key: i, style: {
                    width: 40, height: 60, borderRadius: '2px 5px 5px 2px', flexShrink: 0,
                    background: 'linear-gradient(160deg, rgba(122,122,130,0.10), rgba(122,122,130,0.03))',
                    border: '1px solid rgba(122,122,130,0.14)',
                } }))),
        React.createElement(ComingSoonNotice, { icon: React.createElement(InkIcon, { name: "lock", size: 12 }), text: description }));
}


// A discovery card for Reader mode — the same shelf-card shape as the old Guild Library's
// LibraryBookCard, plus the two things a marketplace listing actually adds: a genre badge (already
// present) and a blurb, and a real (if unenforceable) price in place of the hardcoded "Free".
export function LibraryDiscoverCard({ book, isFavorite, onToggleFavorite, onRead, onPreview, myRating, onOpenAuthor, following, inCart, onToggleFollow, onBuy, onTip, onRate, onDiscuss, onSample }) {
    const badge = getLibraryBadge(book);
    return React.createElement("div", { className: "gl-book-cover", style: {
            position: 'relative', display: 'flex', gap: SPACE_SCALE[14], background: 'linear-gradient(160deg, #211C13, #17130E)',
            border: '1px solid #3A3020', borderLeft: '4px solid #4A3D22',
            borderRadius: '4px 14px 14px 4px', padding: 16, textAlign: 'left',
            boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.03), 0 6px 16px rgba(0,0,0,0.3)',
        } },
        React.createElement("div", { onClick: onPreview, style: { cursor: onPreview ? 'pointer' : 'default' }, title: onPreview ? 'View details' : undefined },
            React.createElement(BookCover, { title: book.title, subtitle: book.subtitle, seriesName: book.seriesName, author: book.author, cover: book.cover, size: 'sm' })),
        React.createElement("div", { style: { flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' } },
            React.createElement("div", { style: { display: 'flex', alignItems: 'flex-start', gap: SPACE_SCALE[8] } },
                React.createElement("div", { style: { flex: 1, minWidth: 0 } },
                    React.createElement("div", { style: { display: 'flex', alignItems: 'center', gap: SPACE_SCALE[8], flexWrap: 'wrap', cursor: onPreview ? 'pointer' : 'default' }, onClick: onPreview },
                        React.createElement("div", { style: { fontFamily: "'Fraunces', Georgia, serif", fontSize: TYPE_SCALE[15], fontWeight: 600, color: '#EFE7D2' } }, book.title || 'Untitled Novel'),
                        React.createElement(LibraryCardBadge, { badge }),
                        isSerialFormat(book) && React.createElement(SeriesTag, null)),
                    React.createElement(LibraryAuthorLink, { author: book.author, onOpenAuthor })),
                React.createElement("button", { onClick: () => onToggleFavorite(book.id), title: "Save to My Library", style: {
                        background: 'none', border: 'none', cursor: 'pointer', fontSize: TYPE_SCALE[16], color: isFavorite ? '#E8C468' : '#4A4A52', flexShrink: 0,
                    } }, isFavorite ? "\u2605" : "\u2606")),
            React.createElement("div", { style: { display: 'flex', alignItems: 'center', gap: SPACE_SCALE[10], marginTop: 12, flexWrap: 'wrap' } },
                React.createElement("span", { style: {
                        fontSize: TYPE_SCALE[10.5], fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase',
                        padding: '3px 9px', borderRadius: RADIUS_SCALE[999], background: 'rgba(200,155,60,0.12)', color: '#C89B3C',
                    } }, book.genre),
                React.createElement(LibraryCardRating, { myRating })),
            React.createElement("div", { style: { fontSize: TYPE_SCALE[10.5], color: '#7A7A82', marginTop: 8, display: 'flex', flexWrap: 'wrap', gap: '4px 10px' } },
                isSerialFormat(book) && book.chapterCount
                    ? React.createElement("span", null, `${book.chapterCount} episode${book.chapterCount === 1 ? '' : 's'}`)
                    : React.createElement("span", null, `${book.wordCount.toLocaleString()} words`),
                React.createElement("span", null, estimateReadingTime(book.wordCount)),
                book.guildName && React.createElement("span", null, "\u2666 ", book.guildName)),
            book.blurb && React.createElement("div", { style: { fontSize: TYPE_SCALE[11.5], color: '#A6A6AD', marginTop: 8, lineHeight: 1.5, fontStyle: 'italic' } }, book.blurb),
            React.createElement("div", { style: { display: 'flex', alignItems: 'center', gap: SPACE_SCALE[10], marginTop: 'auto', paddingTop: 12 } },
                React.createElement("span", { title: formatLibraryPrice(book.price), style: {
                        display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 30, height: 30, borderRadius: '50%',
                        fontSize: book.price > 0 ? 9 : 14, fontWeight: 700, textAlign: 'center', lineHeight: 1,
                        color: book.price > 0 ? '#E8C468' : '#8FCB8F',
                        background: 'radial-gradient(circle at 34% 30%, #241F14, #17130E 75%)',
                        border: `1px solid ${book.price > 0 ? '#4A3D22' : '#2E4A2E'}`,
                        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.05), 0 2px 6px rgba(0,0,0,0.4)',
                    } }, book.price > 0 ? formatLibraryPrice(book.price) : "\u2726"),
                React.createElement("span", { style: { fontSize: TYPE_SCALE[12], fontWeight: 600, color: book.price > 0 ? '#E8C468' : '#8FCB8F' } }, formatLibraryPrice(book.price)),
                React.createElement("button", { onClick: () => onRead(book.id), style: {
                        position: 'relative', overflow: 'visible', background: 'linear-gradient(160deg, #241F14, #17140F)',
                        border: '1px solid #4A3D22', color: '#E8C468',
                        borderRadius: RADIUS_SCALE[8], padding: '7px 16px', fontSize: TYPE_SCALE[12], fontWeight: 600, cursor: 'pointer', marginLeft: 'auto',
                    } }, "\uD83D\uDCD6 Open the tome",
                    React.createElement("span", { className: "gl-page-corner", style: {
                            display: 'inline-block', marginLeft: 6, transformOrigin: 'left center',
                        } }, "\u276F"))),
            React.createElement(LibraryQuickActions, {
                book, following, inCart, onToggleFollow, onBuy, onTip,
                onRate: onRate || onPreview, onDiscuss, onSample: onSample || onPreview,
            })));
}


// One book in Author Studio — a Publish button (completed projects only) opening the shared
// Publishing Wizard (see PublishingWizard), plus a "Manage listing" button to reopen that same
// wizard once published, so the listing (title, description, category, tags, price) is always
// edited through the same four-step flow. A Guild publication shows a one-click "Promote to
// Inkroot" instead, since it's the same project record either way — no duplicate upload.
export function AuthorStudioBookCard({ project, writerGuildName, onSetPublishStatus, onOpenPublishWizard, onOpen }) {
    const publishStatus = resolvePublishStatus(project);
    return React.createElement("div", { style: { background: 'linear-gradient(160deg, #211C13, #17130E)', border: '1px solid #3A3020', borderRadius: RADIUS_SCALE[14], padding: 16 } },
        React.createElement("div", { style: { display: 'flex', gap: SPACE_SCALE[14], alignItems: 'flex-start' } },
            React.createElement(BookCover, { title: project.title, subtitle: project.subtitle, seriesName: project.seriesName, author: project.author, cover: project.cover, size: 'sm' }),
            React.createElement("div", { style: { flex: 1, minWidth: 0 } },
                React.createElement("div", { style: { display: 'flex', alignItems: 'center', gap: SPACE_SCALE[6], flexWrap: 'wrap' } },
                    React.createElement("div", { style: { fontFamily: "'Fraunces', Georgia, serif", fontSize: TYPE_SCALE[15], fontWeight: 600, color: '#EFE7D2' } }, project.title || 'Untitled Novel'),
                    isSerialFormat(project) && React.createElement(SeriesTag, null)),
                React.createElement("div", { style: { fontSize: TYPE_SCALE[11.5], color: '#7A7A82', marginTop: 2 } }, isSerialFormat(project) && project.chapterCount
                    ? `${project.chapterCount} ${project.chapterCount === 1 ? 'episode' : 'episodes'}`
                    : `${(project.wordCount || 0).toLocaleString()} words`),
                React.createElement("div", { style: { display: 'flex', alignItems: 'center', gap: SPACE_SCALE[8], marginTop: 10, flexWrap: 'wrap' } },
                    React.createElement("span", { style: {
                            fontSize: TYPE_SCALE[10.5], fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase',
                            padding: '3px 9px', borderRadius: RADIUS_SCALE[999],
                            background: project.completed ? 'rgba(143,203,143,0.12)' : 'rgba(122,122,130,0.14)',
                            color: project.completed ? '#8FCB8F' : '#A6A6AD',
                        } }, project.completed ? 'Completed' : 'In Progress'),
                    project.completed && publishStatus !== 'none' && React.createElement("span", { style: {
                            fontSize: TYPE_SCALE[10.5], fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase',
                            padding: '3px 9px', borderRadius: RADIUS_SCALE[999], background: 'rgba(200,155,60,0.12)', color: '#C89B3C',
                        } }, publishStatus === 'inkroot' ? 'Published \u00B7 Inkroot' : `Published \u00B7 ${writerGuildName || 'Guild'}`),
                    project.completed && publishStatus === 'none' && React.createElement("button", { onClick: () => onOpenPublishWizard(project.id, 'book'), style: {
                            background: 'none', border: '1px solid #3A3020', color: '#C89B3C', borderRadius: RADIUS_SCALE[8],
                            padding: '5px 12px', fontSize: TYPE_SCALE[11.5], cursor: 'pointer', fontWeight: 600,
                        } }, "Publish"),
                    project.completed && publishStatus !== 'none' && React.createElement("button", { onClick: () => onOpenPublishWizard(project.id, 'book'), style: {
                            background: 'none', border: '1px solid #3A3020', color: '#C89B3C', borderRadius: RADIUS_SCALE[8],
                            padding: '5px 12px', fontSize: TYPE_SCALE[11.5], cursor: 'pointer', fontWeight: 600,
                        } }, "Manage listing"),
                    project.completed && publishStatus === 'guild' && React.createElement("button", { onClick: () => onSetPublishStatus(project.id, 'inkroot'), style: {
                            background: 'none', border: '1px solid #3A3020', color: '#C89B3C', borderRadius: RADIUS_SCALE[8],
                            padding: '5px 12px', fontSize: TYPE_SCALE[11.5], cursor: 'pointer', fontWeight: 600,
                        } }, "Promote to Inkroot"),
                    project.completed && publishStatus !== 'none' && React.createElement("button", { onClick: () => onSetPublishStatus(project.id, 'none'), style: {
                            background: 'none', border: 'none', color: '#7A7A82', fontSize: TYPE_SCALE[11.5], cursor: 'pointer', textDecoration: 'underline', padding: 0,
                        } }, "Unpublish"),
                    !project.completed && React.createElement("span", { style: { fontSize: TYPE_SCALE[10.5], color: '#5C5C64', fontStyle: 'italic' } }, "Mark as completed in Settings to publish"),
                    project.completed && React.createElement("button", { onClick: () => onOpen(project.id), style: {
                            background: 'none', border: 'none', color: '#7A7A82', fontSize: TYPE_SCALE[11.5], cursor: 'pointer', textDecoration: 'underline', padding: 0,
                        } }, "Open")),
                project.completed && publishStatus !== 'none' && React.createElement("div", { style: { display: 'flex', gap: SPACE_SCALE[14], marginTop: 10, flexWrap: 'wrap' } },
                    [['Readers', React.createElement(InkIcon, { name: "users", size: 12 })], ['Rating', React.createElement(InkIcon, { name: "star", size: 12 })], ['Sales', React.createElement(InkIcon, { name: "moneybag", size: 12 })], ['Earnings', React.createElement(InkIcon, { name: "coin", size: 12 })]].map(([label, icon]) => React.createElement("div", { key: label, style: {
                            fontSize: TYPE_SCALE[10.5], color: '#5C5C64', display: 'flex', alignItems: 'center', gap: SPACE_SCALE[4],
                        } }, React.createElement("span", null, icon), React.createElement("span", null, `${label}: \u2014`)))))));
}


// The book detail modal — opened from a shelf row or a search-result card. Brings everything a
// reader might want onto one page: the listing (blurb/genre/price), a real on-demand sample of
// the opening prose, a way to read the full book today (still free — see the note above the
// search bar in GrandLibraryScreen), a personal star rating saved to this device, and clearly
// marked Coming Soon panels for the two parts that genuinely need a shared backend: purchasing
// and public reviews from other readers.
export function BookDetailModal({ book, isFavorite, onToggleFavorite, myRating, onSetRating, onReadFull, onClose, onOpenAuthor, following, inCart, onToggleFollow, onBuy, onTip, onDiscuss }) {
    const [sample, setSample] = useState(null); // null = not loaded yet, '' = loaded but empty, string = text
    const [sampleLoading, setSampleLoading] = useState(false);
    const [stars, setStars] = useState((myRating && myRating.stars) || 0);
    const [note, setNote] = useState((myRating && myRating.note) || '');
    const [ratingSaved, setRatingSaved] = useState(false);
    const savedTimer = useRef(null);
    const ratingSectionRef = useRef(null);
    useEffect(() => () => { if (savedTimer.current)
        clearTimeout(savedTimer.current); }, []);
    const loadSample = async () => {
        if (sample !== null || sampleLoading)
            return;
        setSampleLoading(true);
        try {
            const res = await storage.get(projectKey(book.id));
            const proj = res ? patchProjectDefaults(JSON.parse(res.value)) : null;
            const firstChapter = proj && Array.isArray(proj.chapters) ? proj.chapters.find((c) => stripHtml(c.text).trim().length > 0) : null;
            const plain = firstChapter ? stripHtml(firstChapter.text).trim() : '';
            setSample(plain ? (plain.slice(0, 640) + (plain.length > 640 ? '\u2026' : '')) : '');
        }
        catch (e) {
            setSample('');
        }
        setSampleLoading(false);
    };
    const handleSaveRating = () => {
        onSetRating(book.id, { stars, note: note.slice(0, 300) });
        setRatingSaved(true);
        if (savedTimer.current)
            clearTimeout(savedTimer.current);
        savedTimer.current = setTimeout(() => setRatingSaved(false), 2200);
    };
    return React.createElement("div", { onClick: onClose, style: {
            position: 'fixed', inset: 0, zIndex: 60, background: 'rgba(10,9,7,0.72)', backdropFilter: 'blur(3px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
        } },
        React.createElement("div", { onClick: (e) => e.stopPropagation(), style: {
                width: '100%', maxWidth: 440, maxHeight: '86vh', overflowY: 'auto',
                background: 'linear-gradient(160deg, #241F16, #17130E)', border: '1px solid #4A3D22', borderRadius: RADIUS_SCALE[16],
                padding: 22, boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
            } },
            React.createElement("div", { style: { display: 'flex', justifyContent: 'flex-end' } },
                React.createElement("button", { onClick: onClose, style: {
                        background: 'none', border: 'none', color: '#7A7A82', fontSize: TYPE_SCALE[18], cursor: 'pointer', padding: 0, lineHeight: 1,
                    } }, "\u2715")),
            React.createElement("div", { style: { display: 'flex', gap: SPACE_SCALE[16], marginTop: -8 } },
                React.createElement(BookCover, { title: book.title, subtitle: book.subtitle, seriesName: book.seriesName, author: book.author, cover: book.cover, size: 'sm' }),
                React.createElement("div", { style: { flex: 1, minWidth: 0 } },
                    React.createElement("div", { style: { display: 'flex', alignItems: 'center', gap: SPACE_SCALE[6], flexWrap: 'wrap' } },
                        React.createElement("div", { style: { fontFamily: "'Fraunces', Georgia, serif", fontSize: TYPE_SCALE[18], fontWeight: 600, color: '#EFE7D2' } }, book.title || 'Untitled Novel'),
                        isSerialFormat(book) && React.createElement(SeriesTag, null)),
                    React.createElement(LibraryAuthorLink, { author: book.author, onOpenAuthor }),
                    React.createElement("div", { style: { fontSize: TYPE_SCALE[10.5], color: '#7A7A82', marginTop: 8, display: 'flex', flexWrap: 'wrap', gap: '4px 10px' } },
                        React.createElement("span", null, book.genre),
                        isSerialFormat(book) && book.chapterCount
                            ? React.createElement("span", null, `${book.chapterCount} episode${book.chapterCount === 1 ? '' : 's'}`)
                            : React.createElement("span", null, `${book.wordCount.toLocaleString()} words`),
                        React.createElement("span", null, estimateReadingTime(book.wordCount)),
                        book.guildName && React.createElement("span", null, "\u2666 ", book.guildName)),
                    React.createElement("button", { onClick: () => onToggleFavorite(book.id), style: {
                            marginTop: 10, background: 'none', border: '1px solid #3A3020', color: isFavorite ? '#E8C468' : '#A6A6AD',
                            borderRadius: RADIUS_SCALE[8], padding: '5px 11px', fontSize: TYPE_SCALE[11.5], cursor: 'pointer',
                        } }, isFavorite ? "\u2605 Saved to My Library" : "\u2606 Save to My Library"))),
            React.createElement(LibraryQuickActions, {
                book, following, inCart, onToggleFollow, onBuy, onTip, onDiscuss,
                onRate: () => ratingSectionRef.current && ratingSectionRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' }),
                onSample: loadSample,
            }),
            book.blurb && React.createElement("div", { style: { fontSize: TYPE_SCALE[12.5], color: '#C9BE8D', marginTop: 16, lineHeight: 1.6, fontStyle: 'italic' } }, book.blurb),
            React.createElement("div", { style: { marginTop: 20, paddingTop: 16, borderTop: '1px solid #2A2417' } },
                React.createElement("div", { style: { fontSize: TYPE_SCALE[11], color: '#7A7A82', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 8 } }, "Read a sample"),
                sample === null
                    ? React.createElement("button", { onClick: loadSample, disabled: sampleLoading, style: {
                            background: 'none', border: '1px solid #3A3020', color: '#C89B3C', borderRadius: RADIUS_SCALE[8],
                            padding: '7px 14px', fontSize: TYPE_SCALE[12], cursor: sampleLoading ? 'default' : 'pointer', fontWeight: 600,
                        } }, sampleLoading ? 'Opening the pages\u2026' : "\uD83D\uDCD6 Peek at the opening")
                    : React.createElement("div", { style: { position: 'relative' } },
                        React.createElement("div", { style: { fontSize: TYPE_SCALE[12.5], color: '#D9D2BE', lineHeight: 1.7, maxHeight: 160, overflow: 'hidden' } }, sample || 'This book has no written pages yet.'),
                        sample && React.createElement("div", { style: {
                                position: 'absolute', left: 0, right: 0, bottom: 0, height: 40,
                                background: 'linear-gradient(180deg, transparent, #17130E)',
                            } }))),
            React.createElement("div", { style: { marginTop: 20, paddingTop: 16, borderTop: '1px solid #2A2417', display: 'flex', flexDirection: 'column', gap: SPACE_SCALE[10] } },
                React.createElement("div", { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between' } },
                    React.createElement("span", { style: { fontSize: TYPE_SCALE[13], fontWeight: 600, color: book.price > 0 ? '#E8C468' : '#8FCB8F' } }, formatLibraryPrice(book.price)),
                    React.createElement("button", { onClick: () => onReadFull(book.id), style: {
                            background: 'linear-gradient(160deg, #241F14, #17140F)', border: '1px solid #4A3D22', color: '#E8C468',
                            borderRadius: RADIUS_SCALE[8], padding: '8px 16px', fontSize: TYPE_SCALE[12.5], fontWeight: 600, cursor: 'pointer',
                        } }, "\uD83D\uDCD6 Read the full book")),
                book.price > 0
                    ? React.createElement(ComingSoonNotice, { text: "Purchasing isn't wired up yet \u2014 reading in full stays free while that's being built." })
                    : React.createElement("div", { style: { fontSize: TYPE_SCALE[11], color: '#5C5C64', fontStyle: 'italic' } }, "Free \u2014 no purchase needed.")),
            React.createElement("div", { ref: ratingSectionRef, style: { marginTop: 20, paddingTop: 16, borderTop: '1px solid #2A2417' } },
                React.createElement("div", { style: { fontSize: TYPE_SCALE[11], color: '#7A7A82', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 8 } }, "Your rating"),
                React.createElement("div", { style: { display: 'flex', gap: SPACE_SCALE[4], marginBottom: 8 } },
                    [1, 2, 3, 4, 5].map((n) => React.createElement("button", { key: n, onClick: () => setStars(n), style: {
                            background: 'none', border: 'none', cursor: 'pointer', fontSize: TYPE_SCALE[20], padding: 0,
                            color: n <= stars ? '#E8C468' : '#3A3A42',
                        } }, "\u2605"))),
                React.createElement("textarea", { value: note, onChange: (e) => setNote(e.target.value), maxLength: 300, rows: 2,
                        placeholder: "A private note to yourself about this book (optional)\u2026", style: {
                        width: '100%', background: '#1D1D22', border: '1px solid #2A2A30', color: '#EFE7D2',
                        borderRadius: RADIUS_SCALE[8], padding: '8px 10px', fontSize: TYPE_SCALE[12.5], resize: 'vertical', fontFamily: 'inherit',
                    } }),
                React.createElement("button", { onClick: handleSaveRating, disabled: stars === 0, style: {
                        marginTop: 8, alignSelf: 'flex-start', background: 'none', border: '1px solid #3A3020',
                        color: stars === 0 ? '#5C5C64' : '#C89B3C', borderRadius: RADIUS_SCALE[8], padding: '6px 14px', fontSize: TYPE_SCALE[12],
                        cursor: stars === 0 ? 'default' : 'pointer', fontWeight: 600,
                    } }, ratingSaved ? 'Saved \u2713' : 'Save my rating'),
                React.createElement("div", { style: { fontSize: TYPE_SCALE[10], color: '#5C5C64', marginTop: 6, fontStyle: 'italic' } }, "Kept privately on this device."),
                React.createElement("div", { style: { marginTop: 12 } },
                    React.createElement(ComingSoonNotice, { text: "Public reviews from other readers \u2014 coming soon." })))));
}


// Purely decorative backdrop for the Grand Library: a stone-block wall, two tall arched windows
// with warm light pouring in, a hanging candle chandelier, and drifting dust motes. Renders as an
// absolutely-positioned layer (z-index 0) behind whatever's passed as children (z-index 1), so
// none of it ever intercepts clicks or scroll on the real screen content above it. The dust mote
// positions/timings are randomized once per mount via useMemo rather than re-rolled on every
// render, so they don't visibly jump around as the reader filters or sorts books.
export function GrandLibraryAtmosphere({ children }) {
    const dustMotes = useMemo(() => Array.from({ length: 14 }, (_, i) => ({
        id: i,
        left: 4 + Math.random() * 92,
        size: 2 + Math.random() * 3,
        delay: Math.random() * 6,
        duration: 7 + Math.random() * 6,
    })), []);
    return React.createElement("div", { style: { position: 'relative', borderRadius: RADIUS_SCALE[18], overflow: 'hidden', isolation: 'isolate' } },
        React.createElement("div", { style: {
                position: 'absolute', inset: 0, zIndex: 0,
                background: 'radial-gradient(ellipse at 50% 0%, rgba(232,196,104,0.16), transparent 55%),' +
                    'repeating-linear-gradient(0deg, rgba(0,0,0,0.22) 0px, rgba(0,0,0,0.22) 2px, transparent 2px, transparent 46px),' +
                    'repeating-linear-gradient(90deg, rgba(0,0,0,0.14) 0px, rgba(0,0,0,0.14) 2px, transparent 2px, transparent 64px),' +
                    'linear-gradient(160deg, #322C24, #1D1A15)',
            } }),
        React.createElement("div", { className: "gl-window-light", style: {
                position: 'absolute', top: -20, left: '4%', width: 70, height: 220, zIndex: 0,
                background: 'linear-gradient(180deg, rgba(255,224,153,0.28), rgba(255,224,153,0.04) 70%, transparent)',
                borderRadius: '50% 50% 6px 6px / 30% 30% 6px 6px', border: '1px solid rgba(200,155,60,0.25)',
                filter: 'blur(1px)',
            } }),
        React.createElement("div", { className: "gl-window-light", style: {
                position: 'absolute', top: -20, right: '4%', width: 70, height: 220, zIndex: 0, animationDelay: '1.2s',
                background: 'linear-gradient(180deg, rgba(255,224,153,0.24), rgba(255,224,153,0.03) 70%, transparent)',
                borderRadius: '50% 50% 6px 6px / 30% 30% 6px 6px', border: '1px solid rgba(200,155,60,0.2)',
                filter: 'blur(1px)',
            } }),
        React.createElement("div", { className: "gl-chandelier", style: { position: 'absolute', top: 0, left: '50%', zIndex: 0 } },
            React.createElement("div", { style: { width: 1, height: 22, background: 'linear-gradient(180deg, #4A3D22, #2A2418)', margin: '0 auto' } }),
            React.createElement("div", { style: { width: 92, height: 6, borderRadius: RADIUS_SCALE[3], background: 'linear-gradient(160deg, #C89B3C, #7A5E24)', boxShadow: '0 2px 8px rgba(0,0,0,0.4)' } }),
            React.createElement("div", { style: { display: 'flex', justifyContent: 'space-between', width: 92, marginTop: -2 } },
                [0, 1, 2].map((i) => React.createElement("div", { key: i, style: { display: 'flex', flexDirection: 'column', alignItems: 'center' } },
                    React.createElement("div", { style: { width: 1, height: 10, background: '#4A3D22' } }),
                    React.createElement("div", { style: { width: 5, height: 12, borderRadius: '2px 2px 1px 1px', background: 'linear-gradient(180deg, #EFE7D2, #C9BE8D)' } }),
                    React.createElement("div", { className: "gl-flame", style: {
                            width: 5, height: 9, marginTop: -1, borderRadius: '50% 50% 50% 50% / 60% 60% 40% 40%',
                            background: 'radial-gradient(circle at 50% 30%, #FFF3C4, #E8C468 55%, #C25E2E 100%)',
                            boxShadow: '0 0 8px 2px rgba(232,196,104,0.6), 0 0 16px 4px rgba(232,196,104,0.25)',
                        } }))))),
        React.createElement("div", { style: { position: 'absolute', inset: 0, zIndex: 0, pointerEvents: 'none' } },
            dustMotes.map((m) => React.createElement("span", { key: m.id, className: "gl-dust-mote", style: {
                    position: 'absolute', left: `${m.left}%`, bottom: 0, width: m.size, height: m.size, borderRadius: '50%',
                    background: 'radial-gradient(circle, rgba(255,238,200,0.9), rgba(255,238,200,0))',
                    animationDuration: `${m.duration}s`, animationDelay: `${m.delay}s`,
                } }))),
        React.createElement("div", { style: { position: 'relative', zIndex: 1, padding: '46px 8px 8px' } }, children));
}


// The Grand Library screen itself: a small segmented switch between Reader and Author Studio,
// each rendering into the same wrapper so the two modes read as one place, not two pages.
// Reader mode: browse curated shelves (New Releases, Highest Rated) and Coming Soon sections
// (Most Read, Editor's Choice, Guild Collections, Hall of Legends — all need a shared backend
// this on-device app doesn't have), search/filter/sort the full catalog, and open any book in a
// BookDetailModal for a sample, a personal rating, saving to My Library, and reading in full.
// Author Studio: publish/unpublish, edit the marketplace listing, and see (currently Coming Soon)
// readers/reviews/ratings/sales/earnings for each published book. The architecture stays modular
// on purpose — every backend-shaped feature reads its data from one clearly-marked spot
// (ComingSoonNotice / ComingSoonShelf) so a real service can slot in later without touching the
// surrounding layout.
// ---------- Worldbuilding Packs in the Grand Library ----------
// Every card and modal below works from the lightweight pack summary mirrored onto a project's
// Home-screen index entry (see packSummaryForIndex) — never the full project file — the same way
// a book's blurb/genre/price already live at the index level. That's what lets a pack be browsed,
// and unpublished, from the Grand Library without opening the project that owns it.
export function formatPackPrice(price) {
    return (!price || price <= 0) ? 'Free' : `$${price.toFixed(2)}`;
}


// A reader-facing card for the Browse & Search grid — same shape as LibraryDiscoverCard, but for
// a pack rather than a book: no reading-time/word-count (that's a book metric), a category
// breakdown instead of a genre, and "View Pack" opens the full contents rather than reading prose.
export function WorldbuildingPackLibraryCard({ pack, onOpen }) {
    return React.createElement("div", { style: {
            display: 'flex', gap: SPACE_SCALE[14], background: 'linear-gradient(160deg, #211C13, #17130E)',
            border: '1px solid #3A3020', borderLeft: '4px solid #4A3D22', borderRadius: '4px 14px 14px 4px',
            padding: 16, textAlign: 'left', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.03), 0 6px 16px rgba(0,0,0,0.3)',
        } },
        React.createElement("div", { onClick: onOpen, style: {
                width: 52, height: 72, borderRadius: RADIUS_SCALE[8], flexShrink: 0, cursor: 'pointer', overflow: 'hidden',
                background: pack.coverImageUrl ? `center/cover url(${pack.coverImageUrl})` : 'radial-gradient(circle at 34% 30%, #2A2115, #17130E 75%)',
                border: '1px solid #4A3D22', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: TYPE_SCALE[22],
            } }, !pack.coverImageUrl && React.createElement(InkIcon, { name: "package", size: 24, color: "#5C5245" })),
        React.createElement("div", { style: { flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' } },
            React.createElement("div", { onClick: onOpen, style: { cursor: 'pointer' } },
                React.createElement("div", { style: { fontFamily: "'Fraunces', Georgia, serif", fontSize: TYPE_SCALE[15], fontWeight: 600, color: '#EFE7D2' } }, pack.title || 'Untitled Pack'),
                React.createElement("div", { style: { fontSize: TYPE_SCALE[11.5], color: '#A6A6AD', marginTop: 2 } }, "From ", pack.projectTitle || 'a project', " \u00B7 ", pack.author)),
            React.createElement("div", { style: { fontSize: TYPE_SCALE[10.5], color: '#7A7A82', marginTop: 8, display: 'flex', flexWrap: 'wrap', gap: '4px 10px' } },
                pack.categories.map((c) => React.createElement("span", { key: c.key }, c.icon, " ", c.entries.length))),
            pack.description && React.createElement("div", { style: { fontSize: TYPE_SCALE[11.5], color: '#A6A6AD', marginTop: 8, lineHeight: 1.5, fontStyle: 'italic' } }, truncate(pack.description, 140)),
            React.createElement("div", { style: { display: 'flex', alignItems: 'center', gap: SPACE_SCALE[10], marginTop: 'auto', paddingTop: 12 } },
                React.createElement("span", { style: {
                        display: 'inline-flex', alignItems: 'center', justifyContent: 'center', height: 30, minWidth: 30, padding: '0 8px', borderRadius: RADIUS_SCALE[15],
                        fontSize: pack.price > 0 ? 11 : 14, fontWeight: 700, color: pack.price > 0 ? '#E8C468' : '#8FCB8F',
                        background: 'radial-gradient(circle at 34% 30%, #241F14, #17130E 75%)', border: `1px solid ${pack.price > 0 ? '#4A3D22' : '#2E4A2E'}`,
                    } }, pack.price > 0 ? formatPackPrice(pack.price) : "\u2726"),
                React.createElement("button", { onClick: onOpen, style: {
                        background: 'linear-gradient(160deg, #241F14, #17140F)', border: '1px solid #4A3D22', color: '#E8C468',
                        borderRadius: RADIUS_SCALE[8], padding: '7px 16px', fontSize: TYPE_SCALE[12], fontWeight: 600, cursor: 'pointer', marginLeft: 'auto',
                    } }, React.createElement(InkIcon, { name: "package", size: 13 }), " View Pack"))));
}


// The full-contents view for one published pack: description, price, and every category it
// includes with the entries' names and short snippets — enough to see what's in it without
// duplicating a full World Bible browser here.
export function WorldbuildingPackDetailModal({ pack, onClose }) {
    return React.createElement("div", { onClick: onClose, style: {
            position: 'fixed', inset: 0, zIndex: 60, background: 'rgba(10,9,7,0.78)', backdropFilter: 'blur(3px)',
            display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '24px 16px', overflowY: 'auto',
        } },
        React.createElement("div", { onClick: (e) => e.stopPropagation(), style: {
                width: '100%', maxWidth: 560, background: 'linear-gradient(160deg, #241F16, #17130E)', border: '1px solid #4A3D22',
                borderRadius: RADIUS_SCALE[16], padding: 24, boxShadow: '0 24px 70px rgba(0,0,0,0.55)',
            } },
            React.createElement("div", { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: SPACE_SCALE[12], marginBottom: 4 } },
                React.createElement("div", null,
                    React.createElement("div", { style: { fontFamily: "'Fraunces', Georgia, serif", fontSize: TYPE_SCALE[19], fontWeight: 600, color: '#EFE7D2' } }, pack.title || 'Untitled Pack'),
                    pack.subtitle && React.createElement("div", { style: { fontSize: TYPE_SCALE[12.5], color: '#A6A6AD', marginTop: 3, fontStyle: 'italic' } }, pack.subtitle),
                    React.createElement("div", { style: { fontSize: TYPE_SCALE[11.5], color: '#7A7A82', marginTop: 6 } }, "From ", pack.projectTitle || 'a project', pack.author ? ` \u00B7 ${pack.author}` : '')),
                React.createElement("button", { onClick: onClose, style: { background: 'none', border: 'none', color: '#7A7A82', fontSize: TYPE_SCALE[18], cursor: 'pointer', padding: 0, lineHeight: 1, flexShrink: 0 } }, "\u2715")),
            React.createElement("div", { style: { display: 'flex', alignItems: 'center', gap: SPACE_SCALE[10], margin: '14px 0' } },
                React.createElement("span", { style: {
                        fontSize: TYPE_SCALE[12.5], fontWeight: 700, padding: '4px 12px', borderRadius: RADIUS_SCALE[999],
                        color: pack.price > 0 ? '#E8C468' : '#8FCB8F', background: 'rgba(200,155,60,0.10)', border: `1px solid ${pack.price > 0 ? '#4A3D22' : '#2E4A2E'}`,
                    } }, formatPackPrice(pack.price)),
                React.createElement("span", { style: { fontSize: TYPE_SCALE[11.5], color: '#7A7A82' } }, pack.totalEntries, " entries across ", pack.categories.length, " categories")),
            pack.description && React.createElement("div", { style: { fontSize: TYPE_SCALE[13], color: '#A6A6AD', lineHeight: 1.6, marginBottom: 18 } }, pack.description),
            React.createElement("div", { style: { display: 'flex', flexDirection: 'column', gap: SPACE_SCALE[16] } },
                pack.categories.map((cat) => React.createElement("div", { key: cat.key },
                    React.createElement("div", { style: { fontSize: TYPE_SCALE[11], fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: '#C89B3C', marginBottom: 8 } }, cat.icon, " ", cat.label),
                    React.createElement("div", { style: { display: 'flex', flexDirection: 'column', gap: SPACE_SCALE[5] } },
                        cat.entries.map((e, i) => React.createElement("div", { key: i, style: { display: 'flex', justifyContent: 'space-between', gap: SPACE_SCALE[10], fontSize: TYPE_SCALE[12.5], padding: '5px 0', borderBottom: '1px solid #2A2417' } },
                            React.createElement("span", { style: { color: '#EFE7D2' } }, e.name),
                            e.snippet && React.createElement("span", { style: { color: '#7A7A82', textAlign: 'right' } }, e.snippet)))))),
            React.createElement(ComingSoonNotice, { text: "Purchasing and downloading a pack's contents \u2014 coming soon.", icon: React.createElement(InkIcon, { name: "lock", size: 12 }) }))));
}


// One project's Worldbuilding Packs, in Author Studio — cross-project, so this only shows what's
// already mirrored to the index (see packSummaryForIndex). Publishing a new pack, or editing what
// it includes, still happens inside the project itself; from here an author can only unpublish,
// or jump back into the project to manage it.
export function AuthorStudioPackCard({ projectId, projectTitle, pack, onOpen, onUnpublish, onOpenPublishWizard }) {
    const published = pack.publishStatus && pack.publishStatus !== 'none';
    return React.createElement("div", { style: { display: 'flex', gap: SPACE_SCALE[14], background: 'linear-gradient(160deg, #211C13, #17130E)', border: '1px solid #3A3020', borderRadius: RADIUS_SCALE[14], padding: 16, alignItems: 'flex-start' } },
        React.createElement("div", { style: {
                width: 44, height: 44, borderRadius: RADIUS_SCALE[9], flexShrink: 0, overflow: 'hidden',
                background: pack.coverImageUrl ? `center/cover url(${pack.coverImageUrl})` : 'radial-gradient(circle at 34% 30%, #2A2115, #17130E 75%)',
                border: '1px solid #4A3D22', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: TYPE_SCALE[18],
            } }, !pack.coverImageUrl && React.createElement(InkIcon, { name: "package", size: 19, color: "#5C5245" })),
        React.createElement("div", { style: { flex: 1, minWidth: 0 } },
            React.createElement("div", { style: { fontFamily: "'Fraunces', Georgia, serif", fontSize: TYPE_SCALE[14.5], fontWeight: 600, color: '#EFE7D2' } }, pack.title || 'Untitled Pack'),
            React.createElement("div", { style: { fontSize: TYPE_SCALE[11], color: '#7A7A82', marginTop: 2 } }, projectTitle, " \u00B7 ", pack.totalEntries, " entries"),
            React.createElement("div", { style: { display: 'flex', alignItems: 'center', gap: SPACE_SCALE[10], marginTop: 10, flexWrap: 'wrap' } },
                React.createElement("span", { style: {
                        fontSize: TYPE_SCALE[10.5], fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase', padding: '3px 9px', borderRadius: RADIUS_SCALE[999],
                        background: published ? 'rgba(200,155,60,0.12)' : 'rgba(122,122,130,0.14)', color: published ? '#C89B3C' : '#A6A6AD',
                    } }, published ? 'Published \u00B7 Inkroot' : 'Unpublished'),
                !published && pack.totalEntries > 0 && React.createElement("button", { onClick: () => onOpenPublishWizard(projectId, 'pack', pack.id), style: { background: 'none', border: '1px solid #3A3020', color: '#C89B3C', borderRadius: RADIUS_SCALE[8], padding: '5px 12px', fontSize: TYPE_SCALE[11.5], cursor: 'pointer', fontWeight: 600 } }, "Publish"),
                published && React.createElement("button", { onClick: () => onOpenPublishWizard(projectId, 'pack', pack.id), style: { background: 'none', border: '1px solid #3A3020', color: '#C89B3C', borderRadius: RADIUS_SCALE[8], padding: '5px 12px', fontSize: TYPE_SCALE[11.5], cursor: 'pointer', fontWeight: 600 } }, "Manage listing"),
                published && React.createElement("button", { onClick: () => onUnpublish(projectId, pack.id), style: { background: 'none', border: 'none', color: '#7A7A82', fontSize: TYPE_SCALE[11.5], cursor: 'pointer', textDecoration: 'underline', padding: 0 } }, "Unpublish"),
                React.createElement("button", { onClick: () => onOpen(projectId), style: { background: 'none', border: 'none', color: '#7A7A82', fontSize: TYPE_SCALE[11.5], cursor: 'pointer', textDecoration: 'underline', padding: 0 } }, "Manage in project"))));
}


// ---------- Creator Dashboard ----------
// A professional control room inside Author Studio: who-you-are at a glance up top (avatar, name,
// rank, reputation, and creator level — the exact same lifetime figures the Writer Profile and
// Guild Hall already track; see WriterIdentityCard and GuildContributionPanel), five overview
// cards, and eight tabs covering every facet of running a catalog on Inkroot. Only Published Books
// and World Packs have real data behind them today (they're a restyle of the data
// AuthorStudioBookCard / AuthorStudioPackCard already show); the other six tabs are honestly
// marked Coming Soon rather than inventing numbers — same policy as ComingSoonNotice/ComingSoonShelf
// elsewhere in the Grand Library.
export const CREATOR_DASHBOARD_TABS = [
    { key: 'books', label: 'Published Books', icon: React.createElement(InkIcon, { name: "library", size: 15 }) },
    { key: 'packs', label: 'World Packs', icon: React.createElement(InkIcon, { name: "package", size: 15 }) },
    { key: 'templates', label: 'Templates', icon: React.createElement(InkIcon, { name: "puzzle", size: 15 }) },
    { key: 'addons', label: 'Add-ons', icon: React.createElement(InkIcon, { name: "sparkle", size: 15 }) },
    { key: 'analytics', label: 'Analytics', icon: React.createElement(InkIcon, { name: "chart", size: 15 }) },
    { key: 'earnings', label: 'Earnings', icon: React.createElement(InkIcon, { name: "coin", size: 15 }) },
    { key: 'withdrawals', label: 'Withdrawals', icon: React.createElement(InkIcon, { name: "cash", size: 15 }) },
    { key: 'ratings', label: 'Ratings', icon: React.createElement(InkIcon, { name: "star", size: 15 }) },
    { key: 'readers', label: 'Readers', icon: React.createElement(InkIcon, { name: "users", size: 15 }) },
];


// Scoped styles for the dashboard's own interactive chrome (tab pills, overview/book cards, quick
// action buttons). Namespaced "cd-" and self-contained like GrandLibraryShelfStyles above it, so
// this can mount without depending on Home's own <style> tag being present.
export function CreatorDashboardStyles() {
    return React.createElement("style", null, `
      .cd-tab-scroll { display: flex; gap: 6px; overflow-x: auto; scrollbar-width: none; -webkit-overflow-scrolling: touch; padding-bottom: 2px; }
      .cd-tab-scroll::-webkit-scrollbar { display: none; }
      .cd-tab-btn {
        flex-shrink: 0; border: 1px solid #3A3020; border-radius: 999px; padding: 8px 15px; font-size: 12px; font-weight: 600;
        cursor: pointer; background: none; color: #A6A6AD; white-space: nowrap; letter-spacing: 0.02em; font-family: inherit;
        transition: background var(--ink-dur) var(--ink-ease), color var(--ink-dur) var(--ink-ease), border-color var(--ink-dur) var(--ink-ease), box-shadow var(--ink-dur) var(--ink-ease);
      }
      .cd-tab-btn.active {
        background: linear-gradient(160deg, #3A2F1C, #241E12); color: #E8C468; border-color: #4A3D22;
        box-shadow: inset 0 1px 0 rgba(255,255,255,0.06), 0 0 14px rgba(232,196,104,0.28);
      }
      .cd-overview-card { transition: transform var(--ink-dur) var(--ink-ease), border-color var(--ink-dur) var(--ink-ease); }
      .cd-overview-card:hover { transform: translateY(-2px); border-color: #4A3D22; }
      .cd-book-card { transition: transform var(--ink-dur) var(--ink-ease), border-color var(--ink-dur) var(--ink-ease), box-shadow var(--ink-dur) var(--ink-ease); }
      .cd-book-card:hover { transform: translateY(-2px); border-color: #4A3D22; box-shadow: 0 10px 26px rgba(0,0,0,0.35); }
      .cd-metric { display: flex; flex-direction: column; align-items: center; gap: 2px; min-width: 52px; }
      .cd-action-btn {
        background: none; border: 1px solid #3A3020; color: #C89B3C; border-radius: 8px; padding: 6px 13px;
        font-size: 11.5px; font-weight: 600; cursor: pointer; font-family: inherit;
        transition: border-color var(--ink-dur) var(--ink-ease);
      }
      .cd-action-btn.danger { color: #7A7A82; border-color: transparent; text-decoration: underline; padding-left: 2px; padding-right: 2px; }
    `);
}


// Small circular author avatar for the dashboard header — same fallback treatment (a soft radial
// vignette plus a faint silhouette glyph) as every other avatar spot in the app (WriterIdentityCard,
// MemberCard, HomeScreen's own profile shortcut), just sized for a compact dashboard header rather
// than a full profile card.
export function CreatorAvatar({ avatar, size }) {
    const s = size || 52;
    return React.createElement("div", { style: {
            width: s, height: s, borderRadius: '50%', flexShrink: 0,
            background: avatar ? `center/cover url(${avatar})` : 'radial-gradient(circle at 34% 28%, #2A2620, #17140F 72%)',
            border: '2px solid #C89B3C', boxShadow: '0 0 0 2px #100E0A, 0 0 16px rgba(200,155,60,0.28)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
        } }, !avatar && React.createElement("span", { style: { fontSize: Math.round(s * 0.38), opacity: 0.5 } }, "\uD83E\uDDD1\u200D\uD83C\uDF93"));
}


// The dashboard's top identity strip: avatar, writer name, and the same Rank / Reputation / Level
// plaques WriterIdentityCard shows on the full Writer Profile (see IdentityPlaque above) — reused
// here rather than re-invented, so a writer's standing always reads identically everywhere it
// appears.
export function CreatorDashboardHeader({ profile, rank, level, reputation }) {
    const name = (profile && (profile.penName || profile.name)) || 'Unnamed Writer';
    const rk = rank || WRITER_RANKS[0];
    return React.createElement("div", { style: {
            display: 'flex', alignItems: 'center', gap: SPACE_SCALE[16], flexWrap: 'wrap',
            background: 'radial-gradient(ellipse at 50% 0%, rgba(200,155,60,0.12), transparent 65%), linear-gradient(160deg, #211C13, #17130E)',
            border: '1px solid #4A3D22', borderRadius: RADIUS_SCALE[16], padding: '18px 20px', marginBottom: 20,
            boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.05), 0 10px 26px rgba(0,0,0,0.32)',
        } },
        React.createElement(CreatorAvatar, { avatar: profile && profile.avatar, size: 52 }),
        React.createElement("div", { style: { flex: '1 1 160px', minWidth: 0 } },
            React.createElement("div", { style: {
                    fontFamily: "'Fraunces', Georgia, serif", fontSize: TYPE_SCALE[18], fontWeight: 600, color: '#EFE7D2',
                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                } }, name),
            React.createElement("div", { style: { fontSize: TYPE_SCALE[11], color: '#7A7A82', marginTop: 2, letterSpacing: '0.03em', textTransform: 'uppercase' } }, "Creator Dashboard")),
        React.createElement("div", { style: { display: 'flex', alignItems: 'stretch', gap: SPACE_SCALE[4], flex: '2 1 260px', minWidth: 0 } },
            React.createElement(IdentityPlaque, { icon: rk.icon, label: "Rank", value: rk.name, valueColor: rk.color }),
            React.createElement("div", { style: { width: 1, background: '#2E2818', margin: '2px 0' } }),
            React.createElement(IdentityPlaque, {
                icon: "\u231B", label: "Reputation", value: (reputation === null || reputation === undefined) ? "\u2014" : reputation,
                valueColor: '#7A7A82', caption: (reputation === null || reputation === undefined) ? 'not yet chronicled' : null,
            }),
            React.createElement("div", { style: { width: 1, background: '#2E2818', margin: '2px 0' } }),
            React.createElement(IdentityPlaque, { icon: "\uD83C\uDF9A", label: "Creator Level", value: `${level || 1} / ${WRITER_LEVEL_MAX}` })));
}


// One overview stat card (Total Sales, Total Revenue, Total Readers, Average Rating, Published
// Works). Honest by default: a card only shows a real number when the caller has one (today, only
// Published Works does — it's a straight count of this writer's own published books and packs);
// everything else reads "\u2014" with a plain caption rather than a fabricated figure.
export function CreatorOverviewCard({ icon, label, value, caption, valueColor }) {
    return React.createElement("div", { className: "cd-overview-card", style: {
            background: 'linear-gradient(160deg, #211C13, #17130E)', border: '1px solid #3A3020', borderRadius: RADIUS_SCALE[14], padding: 14,
        } },
        React.createElement("div", { style: { display: 'flex', alignItems: 'center', gap: SPACE_SCALE[8], marginBottom: 8 } },
            React.createElement("span", { style: { fontSize: TYPE_SCALE[15] } }, icon),
            React.createElement("span", { style: { fontSize: TYPE_SCALE[10], letterSpacing: '0.05em', textTransform: 'uppercase', color: '#7A7A82' } }, label)),
        React.createElement("div", { style: { fontFamily: "'Fraunces', Georgia, serif", fontSize: TYPE_SCALE[22], fontWeight: 600, color: valueColor || '#E8C468' } }, value),
        caption && React.createElement("div", { style: { fontSize: TYPE_SCALE[10], color: '#5C5C64', fontStyle: 'italic', marginTop: 4 } }, caption));
}


export function CreatorOverviewRow({ publishedWorksCount }) {
    const notTracked = { value: "\u2014", caption: 'not tracked yet', valueColor: '#5C5C64' };
    return React.createElement("div", { style: {
            display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(128px, 1fr))', gap: SPACE_SCALE[12], marginBottom: 22,
        } },
        React.createElement(CreatorOverviewCard, Object.assign({ icon: React.createElement(InkIcon, { name: "moneybag", size: 15 }), label: "Total Sales" }, notTracked)),
        React.createElement(CreatorOverviewCard, Object.assign({ icon: React.createElement(InkIcon, { name: "coin", size: 15 }), label: "Total Revenue" }, notTracked)),
        React.createElement(CreatorOverviewCard, Object.assign({ icon: React.createElement(InkIcon, { name: "users", size: 15 }), label: "Total Readers" }, notTracked)),
        React.createElement(CreatorOverviewCard, Object.assign({ icon: React.createElement(InkIcon, { name: "star", size: 15 }), label: "Average Rating" }, notTracked)),
        React.createElement(CreatorOverviewCard, { icon: React.createElement(InkIcon, { name: "library", size: 15 }), label: "Published Works", value: publishedWorksCount, valueColor: '#E8C468' }));
}


// The eight-tab switch itself — a horizontally-scrollable pill row so it degrades gracefully on
// narrow phone widths instead of wrapping into a ragged multi-line block.
export function CreatorTabBar({ activeTab, onSelect }) {
    return React.createElement("div", { className: "cd-tab-scroll", style: { marginBottom: 20 } },
        CREATOR_DASHBOARD_TABS.map((t) => React.createElement("button", {
            key: t.key, className: `cd-tab-btn${activeTab === t.key ? ' active' : ''}`, onClick: () => onSelect(t.key),
        }, t.icon, " ", t.label)));
}


// One readers/rating/sales/earnings figure on a Published Books card. Every value is "\u2014"
// today — there's no shared backend tallying any of these yet (same honesty policy as
// AuthorStudioBookCard's own metric row, which this replaces with a nicer dashboard layout).
export function CreatorMetric({ icon, label, value }) {
    return React.createElement("div", { className: "cd-metric" },
        React.createElement("span", { style: { fontSize: TYPE_SCALE[13] } }, icon),
        React.createElement("span", { style: { fontSize: TYPE_SCALE[12.5], fontWeight: 600, color: '#C9BE8D' } }, value),
        React.createElement("span", { style: { fontSize: TYPE_SCALE[8.5], letterSpacing: '0.05em', textTransform: 'uppercase', color: '#5C5C64' } }, label));
}


// One project on the Published Books tab: cover, title, status, the four metrics above, and a row
// of quick actions (Edit / View / Manage Listing / Unpublish), plus the same Publish flow
// AuthorStudioBookCard already offers for a completed-but-unpublished project. Edit opens the
// project workspace itself (onOpen); View reads it exactly as a reader would (onRead) — no
// separate preview system, so what an author sees in View is always exactly what's live.
export function CreatorBookCard({ project, writerGuildName, onSetPublishStatus, onOpenPublishWizard, onOpen, onRead }) {
    const publishStatus = resolvePublishStatus(project);
    const isPublished = publishStatus !== 'none';
    // Real rating/review count once published — "\u2014" while loading or if there's nothing yet,
    // same as before Phase 2 existed. Readers/Sales/Earnings stay "\u2014": those need page-view
    // tracking and a payment processor respectively, neither of which is part of this phase.
    const [ratingStats, setRatingStats] = useState(null);
    useEffect(() => {
        if (!isPublished) return;
        let cancelled = false;
        fetchBookStats(project.id).then((stats) => { if (!cancelled) setRatingStats(stats); }).catch(() => {});
        return () => { cancelled = true; };
    }, [isPublished, project.id]);
    return React.createElement("div", { className: "cd-book-card", style: {
            background: 'linear-gradient(160deg, #211C13, #17130E)', border: '1px solid #3A3020', borderRadius: RADIUS_SCALE[14], padding: 16,
        } },
        React.createElement("div", { style: { display: 'flex', gap: SPACE_SCALE[14], alignItems: 'flex-start', flexWrap: 'wrap' } },
            React.createElement(BookCover, { title: project.title, subtitle: project.subtitle, seriesName: project.seriesName, author: project.author, cover: project.cover, size: 'sm' }),
            React.createElement("div", { style: { flex: '1 1 200px', minWidth: 0 } },
                React.createElement("div", { style: { display: 'flex', alignItems: 'center', gap: SPACE_SCALE[6], flexWrap: 'wrap' } },
                    React.createElement("div", { style: { fontFamily: "'Fraunces', Georgia, serif", fontSize: TYPE_SCALE[15.5], fontWeight: 600, color: '#EFE7D2' } }, project.title || 'Untitled Novel'),
                    isSerialFormat(project) && React.createElement(SeriesTag, null)),
                React.createElement("div", { style: { fontSize: TYPE_SCALE[11], color: '#7A7A82', marginTop: 2 } }, isSerialFormat(project) && project.chapterCount
                    ? `${project.chapterCount} ${project.chapterCount === 1 ? 'episode' : 'episodes'}`
                    : `${(project.wordCount || 0).toLocaleString()} words`),
                React.createElement("div", { style: { display: 'flex', alignItems: 'center', gap: SPACE_SCALE[8], marginTop: 10, flexWrap: 'wrap' } },
                    React.createElement("span", { style: {
                            fontSize: TYPE_SCALE[10.5], fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase',
                            padding: '3px 9px', borderRadius: RADIUS_SCALE[999],
                            background: project.completed ? 'rgba(143,203,143,0.12)' : 'rgba(122,122,130,0.14)',
                            color: project.completed ? '#8FCB8F' : '#A6A6AD',
                        } }, project.completed ? 'Completed' : 'In Progress'),
                    isPublished && React.createElement("span", { style: {
                            fontSize: TYPE_SCALE[10.5], fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase',
                            padding: '3px 9px', borderRadius: RADIUS_SCALE[999], background: 'rgba(200,155,60,0.12)', color: '#C89B3C',
                        } }, publishStatus === 'inkroot' ? 'Published \u00B7 Inkroot' : `Published \u00B7 ${writerGuildName || 'Guild'}`),
                    !isPublished && project.completed && React.createElement("span", { style: {
                            fontSize: TYPE_SCALE[10.5], fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase',
                            padding: '3px 9px', borderRadius: RADIUS_SCALE[999], background: 'rgba(122,122,130,0.14)', color: '#A6A6AD',
                        } }, 'Unpublished'),
                    !isPublished && !project.completed && React.createElement("span", { style: { fontSize: TYPE_SCALE[10.5], color: '#5C5C64', fontStyle: 'italic' } }, "Mark as completed in Settings to publish"))),
            isPublished && React.createElement("div", { style: { display: 'flex', gap: SPACE_SCALE[14], flexWrap: 'wrap', marginLeft: 'auto' } },
                React.createElement(CreatorMetric, { icon: React.createElement(InkIcon, { name: "users", size: 13 }), label: "Readers", value: "\u2014" }),
                React.createElement(CreatorMetric, { icon: React.createElement(InkIcon, { name: "star", size: 13 }), label: "Rating", value: ratingStats && ratingStats.reviewCount > 0 ? `${ratingStats.avgRating.toFixed(1)} (${ratingStats.reviewCount})` : "\u2014" }),
                React.createElement(CreatorMetric, { icon: React.createElement(InkIcon, { name: "moneybag", size: 13 }), label: "Sales", value: "\u2014" }),
                React.createElement(CreatorMetric, { icon: React.createElement(InkIcon, { name: "coin", size: 13 }), label: "Earnings", value: "\u2014" }))),
        React.createElement("div", { style: { display: 'flex', gap: SPACE_SCALE[8], flexWrap: 'wrap', marginTop: 14, paddingTop: 14, borderTop: '1px solid #2A2417' } },
            project.completed && React.createElement("button", { className: "cd-action-btn", onClick: () => onOpen(project.id) }, "\u270F\uFE0F Edit"),
            isPublished && React.createElement("button", { className: "cd-action-btn", onClick: () => onRead(project.id) }, "\uD83D\uDC41\uFE0F View"),
            project.completed && !isPublished && React.createElement("button", { className: "cd-action-btn", onClick: () => onOpenPublishWizard(project.id, 'book') }, "Publish"),
            isPublished && React.createElement("button", { className: "cd-action-btn", onClick: () => onOpenPublishWizard(project.id, 'book') }, "Manage Listing"),
            isPublished && publishStatus === 'guild' && React.createElement("button", { className: "cd-action-btn", onClick: () => onSetPublishStatus(project.id, 'inkroot') }, "Promote to Inkroot"),
            isPublished && React.createElement("button", { className: "cd-action-btn danger", onClick: () => onSetPublishStatus(project.id, 'none') }, "Unpublish"),
            !project.completed && React.createElement("button", { className: "cd-action-btn", onClick: () => onOpen(project.id) }, "Open")));
}


// A full-tab Coming Soon placeholder for the four backend-dependent tabs (Templates, Analytics,
// Withdrawals, Ratings, Readers) plus Earnings, which additionally notes Inkroot has no payment
// processor today — the same honesty this app already gives pricing everywhere else (see
// formatLibraryPrice, PublishingWizard's price step).
export function CreatorComingSoonPanel({ icon, label, description }) {
    return React.createElement("div", { style: {
            textAlign: 'center', padding: '44px 20px', borderRadius: RADIUS_SCALE[16],
            background: 'linear-gradient(160deg, #211C13, #17130E)', border: '1px dashed #3A3020',
        } },
        React.createElement("div", { style: { fontSize: TYPE_SCALE[30], marginBottom: 10, opacity: 0.7 } }, icon),
        React.createElement("div", { style: { fontFamily: "'Fraunces', Georgia, serif", fontSize: TYPE_SCALE[16], fontWeight: 600, color: '#C9BE8D', marginBottom: 6 } }, label, " \u2014 Coming Soon"),
        React.createElement("div", { style: { fontSize: TYPE_SCALE[12], color: '#7A7A82', maxWidth: 380, margin: '0 auto', lineHeight: 1.6 } }, description),
        React.createElement("div", { style: { marginTop: 18, display: 'flex', justifyContent: 'center' } },
            React.createElement(ComingSoonNotice, { icon: React.createElement(InkIcon, { name: "lock", size: 12 }), text: "Needs a shared backend service Inkroot doesn't have yet." })));
}


// The Creator Dashboard itself: header identity strip, five overview cards, and the eight-tab
// switch. Published Books and World Packs reuse the real project/pack data Author Studio already
// had (just restyled); the remaining six tabs are honest Coming Soon panels. This is what
// Author Studio's segmented switch now renders in 'studio' mode (see GrandLibraryScreen below) —
// Reader mode is untouched.
// Real aggregate ratings/reviews across every book this writer has published — backs the
// Ratings tab. Reviews are publicly readable (see schema_phase2.sql), so this works whether or
// not the person viewing it is currently signed in; there's simply nothing to show until at
// least one of their books has been published (which itself requires having been signed in at
// publish time) and read by someone else.
export function CreatorRatingsPanel({ projects }) {
    const publishedIds = React.useMemo(() => projects.filter((p) => resolvePublishStatus(p) !== 'none').map((p) => p.id), [projects]);
    const [state, setState] = useState({ loading: true, error: null, summary: [] });
    useEffect(() => {
        let cancelled = false;
        if (publishedIds.length === 0) {
            setState({ loading: false, error: null, summary: [] });
            return;
        }
        setState((s) => ({ ...s, loading: true }));
        fetchAuthorRatingsSummary(publishedIds)
            .then((summary) => { if (!cancelled) setState({ loading: false, error: null, summary }); })
            .catch((e) => { if (!cancelled) setState({ loading: false, error: e, summary: [] }); });
        return () => { cancelled = true; };
    }, [publishedIds.join(',')]);
    const titleFor = (id) => (projects.find((p) => p.id === id) || {}).title || 'Untitled';
    if (publishedIds.length === 0) {
        return React.createElement(CreatorComingSoonPanel, {
            icon: React.createElement(InkIcon, { name: "star", size: 28, style: { display: "inline-block" } }),
            label: "Ratings", description: "Publish a book first \u2014 once readers can find it, their ratings and reviews will show up here.",
        });
    }
    if (state.loading) {
        return React.createElement("div", { style: { textAlign: 'center', padding: '30px 0', color: '#7A7A82', fontSize: TYPE_SCALE[12] } }, "Loading ratings\u2026");
    }
    if (state.error) {
        return React.createElement("div", { style: { textAlign: 'center', padding: '30px 0', color: '#D98A8A', fontSize: TYPE_SCALE[12] } }, "Couldn't load ratings right now \u2014 check your connection and try again.");
    }
    if (state.summary.length === 0) {
        return React.createElement("div", { style: { textAlign: 'center', padding: '30px 0', color: '#7A7A82', fontSize: TYPE_SCALE[12] } }, "No reviews yet \u2014 they'll appear here as readers rate your published work.");
    }
    return React.createElement("div", { style: { display: 'grid', gap: SPACE_SCALE[16] } },
        state.summary.map((entry) => React.createElement("div", {
            key: entry.bookId, style: { padding: 16, borderRadius: RADIUS_SCALE[12], background: '#1D1D22', border: '1px solid #2A2417' },
        },
            React.createElement("div", { style: { display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 10 } },
                React.createElement("span", { style: { fontFamily: "'Fraunces', Georgia, serif", fontSize: TYPE_SCALE[14], color: '#EFE7D2' } }, titleFor(entry.bookId)),
                React.createElement("span", { style: { fontSize: TYPE_SCALE[12], color: '#E8C468' } }, `\u2605 ${entry.avgRating.toFixed(1)} \u00b7 ${entry.reviews.length} review${entry.reviews.length === 1 ? '' : 's'}`)),
            React.createElement("div", { style: { display: 'grid', gap: SPACE_SCALE[8] } },
                entry.reviews.slice(0, 5).map((r, i) => React.createElement("div", { key: i, style: { fontSize: TYPE_SCALE[11.5], color: '#A6A6AD' } },
                    React.createElement("span", { style: { color: '#E8C468' } }, '\u2605'.repeat(r.rating)), ' ',
                    React.createElement("span", { style: { color: '#7A7A82' } }, r.reviewer_name || 'A reader'), r.body ? ` \u2014 ${r.body}` : '')))))); 
}
