import React, { useState } from 'react';
import { AUTHOR_FOLLOWS_KEY, authorKeyFor, readAuthorFollowMap, writeAuthorFollowMap } from './author-reputation.jsx';
import { AuthorsHallScreen } from './authors-hall-screen.jsx';
import { CreatorDashboard } from './creator-dashboard.jsx';
import { AuthorStudioBookCard, AuthorStudioPackCard, BookDetailModal, CartDrawer, ComingSoonShelf, DiscussionHallModal, FeaturedChronicleCard, GrandLibraryAtmosphere, LibraryDiscoverCard, WorldbuildingPackDetailModal, WorldbuildingPackLibraryCard } from './grand-library-cards.jsx';
import { GrandLibraryShelfRow, GrandLibraryShelfStyles, LIBRARY_CART_KEY, LIBRARY_DISCUSSIONS_KEY, LIBRARY_SORTS, LibraryAuthorLink, LibrarySectionHeading, PublishingWizard, TipAuthorModal, readLibraryCart, readLibraryDiscussions, readLibraryFavorites, readLibraryRatings, resolvePublishStatus, writeLibraryCart, writeLibraryFavorites, writeLibraryRatings } from './publishing.jsx';
import { EmptyState } from '../shared-ui/ui-cards.jsx';
import { wordCount } from '../shared-utils/strip-html.jsx';
import { InkIcon } from '../shell/ink-icon.jsx';
import { InkRoot } from '../shell/ink-root.jsx';
import { RADIUS_SCALE, SPACE_SCALE, TYPE_SCALE, useNav } from '../shell/nav-context.jsx';
import { packSummaryForIndex } from '../worldbuilding/book-cover.jsx';


export function GrandLibraryScreen({ projects, writerName, writerGuildName, writerProfile, writerRank, writerLevel, writerReputation, onOpen, onRead, onSetPublishStatus, onOpenPacks, onSetPackPublishStatus, onPublishBookWithDetails, onPublishPackWithDetails, onOpenAuthor, initialMode, inboxUnreadCount, onOpenInbox }) {
    const [mode, setMode] = useState(initialMode || 'reader'); // 'reader' | 'studio'
    // The shared Publishing Wizard (see PublishingWizard), opened for whichever project/pack the
    // Publish or Manage listing button on an AuthorStudioBookCard / AuthorStudioPackCard was
    // clicked for. null | { projectId, type: 'book' | 'pack', packId }.
    const [publishWizard, setPublishWizard] = useState(null);
    const [search, setSearch] = useState('');
    const [genreFilter, setGenreFilter] = useState('all');
    const [sortKey, setSortKey] = useState('newest');
    const [favorites, setFavorites] = useState(() => readLibraryFavorites());
    const [ratings, setRatings] = useState(() => readLibraryRatings());
    const [selectedBookId, setSelectedBookId] = useState(null);
    const [selectedPackKey, setSelectedPackKey] = useState(null); // `${projectId}:${packId}`, or null
    // Follow Author (see AUTHOR_FOLLOWS_KEY) — same shared map AuthorsHallScreen's own Follow
    // button reads and writes, so a follow toggled from a Discover book card is instantly
    // reflected on that writer's Hall page too, and vice versa.
    const [followingMap, setFollowingMap] = useState(() => readAuthorFollowMap(AUTHOR_FOLLOWS_KEY));
    const isFollowingAuthor = (author) => !!followingMap[authorKeyFor(author)];
    const toggleFollowAuthor = (author) => {
        setFollowingMap((prev) => {
            const key = authorKeyFor(author);
            const next = { ...prev, [key]: !prev[key] };
            writeAuthorFollowMap(AUTHOR_FOLLOWS_KEY, next);
            return next;
        });
    };
    // Cart — a real, on-device queue of books a reader means to buy (see LIBRARY_CART_KEY). Buy
    // isn't a purchase yet (Inkroot has no payment processor), but the queue itself persists.
    const [cart, setCart] = useState(() => readLibraryCart());
    const [cartOpen, setCartOpen] = useState(false);
    const addToCart = (book) => {
        setCart((prev) => {
            if (prev.some((it) => it.id === book.id))
                return prev;
            const next = [...prev, { id: book.id, title: book.title, author: book.author, price: book.price }];
            writeLibraryCart(next);
            return next;
        });
        openCart();
    };
    const removeFromCart = (id) => {
        setCart((prev) => {
            const next = prev.filter((it) => it.id !== id);
            writeLibraryCart(next);
            return next;
        });
    };
    const [tipBook, setTipBook] = useState(null);
    const [discussBook, setDiscussBook] = useState(null);
    const nav = useNav();
    const openBook = (id, title) => {
        nav.push({ label: title || 'Book', undo: () => setSelectedBookId(null) });
        setSelectedBookId(id);
    };
    const closeBook = () => nav.pop();
    // Worldbuilding Pack detail, Cart, Tip Author, Discussion Hall, and the Publish Wizard used to
    // be plain useState toggles with no nav.push — they'd appear as an overlay on top of the
    // Library but never register on the Back/breadcrumb stack the way openBook/closeBook above
    // does. That left Back either doing nothing visible or popping an unrelated earlier screen
    // while the overlay stayed put, so the only way out was the Home breadcrumb's full stack
    // reset. Giving each one the same push-on-open / pop-on-close treatment as the book detail
    // above fixes that: Back and the breadcrumb trail now both know these are open, and closing
    // them (via nav.pop, whether that's the Back button, a breadcrumb click, or the modal's own
    // close button below) runs the matching undo and nothing else.
    const openPack = (key, title) => { nav.push({ label: title || 'Worldbuilding Pack', undo: () => setSelectedPackKey(null) }); setSelectedPackKey(key); };
    const closePack = () => nav.pop();
    const openCart = () => { nav.push({ label: 'Cart', undo: () => setCartOpen(false) }); setCartOpen(true); };
    const closeCart = () => nav.pop();
    const openTip = (book) => { nav.push({ label: 'Tip ' + (book.author || 'Author'), undo: () => setTipBook(null) }); setTipBook(book); };
    const closeTip = () => nav.pop();
    const openDiscuss = (book) => { nav.push({ label: 'Discussion', undo: () => setDiscussBook(null) }); setDiscussBook(book); };
    const closeDiscuss = () => nav.pop();
    const openPublishWizard = (projectId, type, packId) => { nav.push({ label: 'Publish', undo: () => setPublishWizard(null) }); setPublishWizard({ projectId, type, packId }); };
    const closePublishWizard = () => nav.pop();
    // Every clickable author name in the Grand Library routes through the Author's Hall (see
    // AuthorsHallScreen) via this same handler, passed down from InkRoot.
    const openAuthorProfile = (author) => { if (onOpenAuthor) onOpenAuthor(author); };
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
    const handleSetRating = (id, rating) => {
        setRatings((prev) => {
            const next = { ...prev, [id]: { ...rating, ratedAt: Date.now() } };
            writeLibraryRatings(next);
            return next;
        });
    };
    const published = projects.filter((p) => resolvePublishStatus(p) === 'inkroot');
    const books = published.map((p) => ({
        id: p.id, title: p.title, subtitle: p.subtitle, seriesName: p.seriesName, cover: p.cover,
        author: (p.author && p.author.trim()) || writerName || 'Unnamed Writer',
        wordCount: p.wordCount || 0, updatedAt: p.updatedAt || 0,
        genre: p.genre || 'Unspecified', blurb: p.blurb || '', price: typeof p.price === 'number' ? p.price : 0,
        guildName: writerGuildName || null,
    }));
    // Every published Worldbuilding Pack across every project, flattened into one list — each
    // pack already carries its own full summary (see packSummaryForIndex), so nothing further
    // needs to be loaded to browse it.
    const publishedPacks = projects.flatMap((p) => (p.worldbuildingPacks || [])
        .filter((pk) => pk.publishStatus === 'inkroot')
        .map((pk) => ({ ...pk, projectId: p.id, projectTitle: p.title, author: (p.author && p.author.trim()) || writerName || 'Unnamed Writer' })));
    const selectedPack = selectedPackKey ? publishedPacks.find((pk) => `${pk.projectId}:${pk.id}` === selectedPackKey) : null;
    const genresPresent = ['all', ...Array.from(new Set(books.map((b) => b.genre)))];
    const filtered = books.filter((b) => {
        if (genreFilter !== 'all' && b.genre !== genreFilter)
            return false;
        const q = search.trim().toLowerCase();
        if (q) {
            const haystack = [b.title, b.author, b.genre, b.guildName].filter(Boolean).join(' ').toLowerCase();
            if (!haystack.includes(q))
                return false;
        }
        return true;
    });
    const ratedBooks = books.filter((b) => ratings[b.id] && ratings[b.id].stars > 0)
        .sort((a, b) => ratings[b.id].stars - ratings[a.id].stars || b.updatedAt - a.updatedAt);
    const sorted = [...filtered];
    if (sortKey === 'favorites')
        sorted.sort((a, b) => (favorites.has(b.id) ? 1 : 0) - (favorites.has(a.id) ? 1 : 0) || b.updatedAt - a.updatedAt);
    else if (sortKey === 'rated')
        sorted.sort((a, b) => ((ratings[b.id] && ratings[b.id].stars) || 0) - ((ratings[a.id] && ratings[a.id].stars) || 0) || b.updatedAt - a.updatedAt);
    else
        sorted.sort((a, b) => b.updatedAt - a.updatedAt); // 'mostRead' has no real data yet — falls back to newest
    const newReleases = [...books].sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 10);
    const selectedBook = selectedBookId ? books.find((b) => b.id === selectedBookId) : null;
    // Exactly one Featured Chronicle at a time (see FeaturedChronicleCard) — the reader's own
    // top-rated pick if they've rated anything, otherwise whatever's newest. Nothing renders at
    // all once there's nothing published yet.
    const featuredBook = ratedBooks[0] || newReleases[0] || null;
    // Featured Creators — every distinct author with at least one published book, most-published
    // first, each with a real Follow toggle (same AUTHOR_FOLLOWS_KEY as their own Hall page).
    const creatorTally = new Map();
    books.forEach((b) => {
        const key = authorKeyFor(b.author);
        if (!creatorTally.has(key))
            creatorTally.set(key, { name: b.author, count: 0 });
        creatorTally.get(key).count += 1;
    });
    const featuredCreators = Array.from(creatorTally.values()).sort((a, b) => b.count - a.count).slice(0, 8);
    // Book Discussion Halls — every published book with at least one local post (see
    // LIBRARY_DISCUSSIONS_KEY), most-discussed first.
    const discussionsMap = readLibraryDiscussions();
    const discussedBooks = books
        .map((b) => ({ book: b, count: (discussionsMap[b.id] || []).length }))
        .filter((d) => d.count > 0)
        .sort((a, b) => b.count - a.count)
        .slice(0, 8);
    const quickActionProps = (book) => ({
        following: isFollowingAuthor(book.author), inCart: cart.some((it) => it.id === book.id),
        onToggleFollow: toggleFollowAuthor, onBuy: addToCart, onTip: openTip, onDiscuss: openDiscuss,
    });
    const topBar = React.createElement("div", { className: "gl-topbar" },
        React.createElement("div", { className: "gl-topbar-search" },
            React.createElement("span", null, "\uD83D\uDD0D"),
            React.createElement("input", { type: "text", value: search, onChange: (e) => setSearch(e.target.value), placeholder: "Search title, author, genre, or guild\u2026" })),
        React.createElement("div", { style: { flex: 1 } }),
        React.createElement("button", { className: "gl-topbar-icon", title: "Cart", onClick: openCart },
            "\uD83D\uDED2", cart.length > 0 && React.createElement("span", { className: "gl-topbar-badge" }, cart.length)),
        onOpenInbox && React.createElement("button", { className: "gl-topbar-icon", title: "Notifications & Inbox", onClick: onOpenInbox },
            "\uD83D\uDD14", inboxUnreadCount > 0 && React.createElement("span", { className: "gl-topbar-badge" }, inboxUnreadCount)));
    const featuredEl = featuredBook && React.createElement(FeaturedChronicleCard, Object.assign({
        book: featuredBook, myRating: ratings[featuredBook.id],
        onRead: () => onRead(featuredBook.id),
        onViewDetails: () => openBook(featuredBook.id, featuredBook.title),
        onOpenAuthor: openAuthorProfile,
        onRate: () => openBook(featuredBook.id, featuredBook.title),
        onSample: () => openBook(featuredBook.id, featuredBook.title),
    }, quickActionProps(featuredBook)));
    const newReleasesShelf = React.createElement(GrandLibraryShelfRow, {
        icon: "\uD83C\uDD95", label: "New Releases", note: newReleases.length ? "Freshly published or updated chronicles" : null,
        books: newReleases, onSelectBook: (b) => openBook(b.id, b.title),
        emptyText: "No books published yet.",
    });
    const trendingShelf = React.createElement(ComingSoonShelf, { icon: "\uD83D\uDD25", label: "Trending", description: "What every reader's opening this week \u2014 coming soon." });
    const highestRatedShelf = React.createElement(GrandLibraryShelfRow, {
        icon: React.createElement(InkIcon, { name: "star", size: 15 }), label: "Highest Rated", note: ratedBooks.length ? "Based on your own ratings" : null,
        books: ratedBooks, onSelectBook: (b) => openBook(b.id, b.title),
        emptyText: "Rate a book below and it'll rise here \u2014 public ratings from every reader are coming soon.",
    });
    const worldbuildingPacksSection = React.createElement("div", { style: { marginBottom: 30 } },
        React.createElement(LibrarySectionHeading, { icon: React.createElement(InkIcon, { name: "package", size: 15 }), label: "Worldbuilding Packs", note: publishedPacks.length ? "Lore, characters, and locations \u2014 shared on their own" : null }),
        publishedPacks.length === 0
            ? React.createElement("div", { style: { fontSize: TYPE_SCALE[11.5], color: '#5C5C64', fontStyle: 'italic', padding: '6px 2px' } }, "No Worldbuilding Packs published yet.")
            : React.createElement("div", { className: "ink-grid-cards" },
                publishedPacks.map((pack) => React.createElement(WorldbuildingPackLibraryCard, { key: `${pack.projectId}:${pack.id}`, pack, onOpen: () => openPack(`${pack.projectId}:${pack.id}`, pack.title) }))));
    const mostReadShelf = React.createElement(ComingSoonShelf, { icon: React.createElement(InkIcon, { name: "chart", size: 15 }), label: "Most Read", description: "Reading activity across every reader \u2014 coming soon." });
    const templatesShelf = React.createElement(ComingSoonShelf, { icon: React.createElement(InkIcon, { name: "puzzle", size: 15 }), label: "Templates", description: "Outline, beat-sheet, and series-bible templates from other writers \u2014 coming soon." });
    const addonsShelf = React.createElement(ComingSoonShelf, { icon: React.createElement(InkIcon, { name: "sparkle", size: 15 }), label: "Add-ons", description: "Covers, dividers, and other flourishes \u2014 coming soon." });
    const editorsChoiceShelf = React.createElement(ComingSoonShelf, { icon: "\uD83C\uDFC5", label: "Editor's Choice", description: "Hand-picked by Inkroot's editors \u2014 coming soon." });
    const guildAnthologiesShelf = React.createElement(ComingSoonShelf, { icon: "\uD83C\uDFF0", label: "Guild Anthologies", description: "Curated shelves from Guilds across the Grand Library \u2014 coming soon." });
    const hallOfLegendsShelf = React.createElement(ComingSoonShelf, { icon: "\uD83D\uDC51", label: "Hall of Legends", description: "Chronicles recognized across the whole community \u2014 coming soon." });
    const featuredCreatorsSection = React.createElement("div", { style: { marginBottom: 30 } },
        React.createElement(LibrarySectionHeading, { icon: "\uD83E\uDE84", label: "Featured Creators", note: featuredCreators.length ? "Writers with something published in the Grand Library" : null }),
        featuredCreators.length === 0
            ? React.createElement("div", { style: { fontSize: TYPE_SCALE[11.5], color: '#5C5C64', fontStyle: 'italic', padding: '6px 2px' } }, "No creators published yet.")
            : React.createElement("div", { className: "gl-shelf-scroll" },
                featuredCreators.map((c) => React.createElement("div", { key: c.name, className: "gl-shelf-item", style: { width: 108 } },
                    React.createElement("div", { onClick: () => openAuthorProfile(c.name), style: {
                            width: 64, height: 64, margin: '0 auto', borderRadius: '50%', cursor: 'pointer',
                            background: 'linear-gradient(160deg, #3C2A18, #241407)', border: '2px solid rgba(232,196,104,0.35)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontFamily: "'Fraunces', Georgia, serif", fontSize: TYPE_SCALE[22], color: '#E8C468',
                        } }, (c.name || '?')[0].toUpperCase()),
                    React.createElement(LibraryAuthorLink, { author: c.name, onOpenAuthor: openAuthorProfile }),
                    React.createElement("div", { style: { fontSize: TYPE_SCALE[10.5], color: '#7A7A82', marginTop: 2 } }, `${c.count} work${c.count === 1 ? '' : 's'}`),
                    React.createElement("button", { onClick: () => toggleFollowAuthor(c.name), style: {
                            marginTop: 6, width: '100%', background: isFollowingAuthor(c.name) ? 'rgba(232,196,104,0.14)' : 'none',
                            border: '1px solid #3A3020', color: isFollowingAuthor(c.name) ? '#E8C468' : '#A6A6AD',
                            borderRadius: RADIUS_SCALE[999], padding: '4px 8px', fontSize: TYPE_SCALE[10.5], cursor: 'pointer', fontWeight: 600,
                        } }, isFollowingAuthor(c.name) ? "\u2713 Following" : "\u2795 Follow")))));
    const discussionHallsSection = React.createElement("div", { style: { marginBottom: 30 } },
        React.createElement(LibrarySectionHeading, { icon: "\uD83D\uDCAC", label: "Book Discussion Halls", note: "Jump into what readers have posted \u2014 on this device for now" }),
        discussedBooks.length === 0
            ? React.createElement("div", { style: { fontSize: TYPE_SCALE[11.5], color: '#5C5C64', fontStyle: 'italic', padding: '6px 2px' } }, "No discussions yet \u2014 open a book and start one.")
            : React.createElement("div", { className: "gl-shelf-scroll" },
                discussedBooks.map(({ book, count }) => React.createElement("div", { key: book.id, className: "gl-shelf-item", style: { width: 150, textAlign: 'left', cursor: 'pointer' }, onClick: () => openDiscuss(book) },
                    React.createElement("div", { style: { fontFamily: "'Fraunces', Georgia, serif", fontSize: TYPE_SCALE[13], fontWeight: 600, color: '#EFE7D2' } }, book.title || 'Untitled Novel'),
                    React.createElement("div", { style: { fontSize: TYPE_SCALE[10.5], color: '#7A7A82', marginTop: 4 } }, `\uD83D\uDCAC ${count} post${count === 1 ? '' : 's'}`)))));
    const browseSearchSection = React.createElement("div", { style: { marginTop: 8, paddingTop: 22, borderTop: '1px solid #2A2417' } },
        React.createElement(LibrarySectionHeading, { icon: "\uD83D\uDD0D", label: "Browse & Search" }),
        genresPresent.length > 1 && React.createElement("div", { style: { display: 'flex', gap: SPACE_SCALE[6], flexWrap: 'wrap', justifyContent: 'center', marginBottom: 10, marginTop: 8 } },
            genresPresent.map((g) => React.createElement("button", { key: g, onClick: () => setGenreFilter(g), style: {
                    background: genreFilter === g ? 'linear-gradient(160deg, #241F14, #1A160D)' : 'none',
                    border: '1px solid #3A3020', color: genreFilter === g ? '#E8C468' : '#A6A6AD',
                    borderRadius: RADIUS_SCALE[999], padding: '5px 11px', fontSize: TYPE_SCALE[11], cursor: 'pointer',
                } }, g === 'all' ? 'All categories' : g))),
        React.createElement("div", { style: { fontSize: TYPE_SCALE[11.5], color: '#5C5C64', textAlign: 'center', marginBottom: 16, fontStyle: 'italic' } }, "Every book can be read in full today \u2014 purchasing is coming soon, so try a sample first if you like"),
        React.createElement("div", { style: { display: 'flex', gap: SPACE_SCALE[6], flexWrap: 'wrap', justifyContent: 'center', marginBottom: 10 } },
            LIBRARY_SORTS.map((s) => React.createElement("button", { key: s.key, onClick: () => setSortKey(s.key), style: {
                    background: sortKey === s.key ? 'linear-gradient(160deg, #241F14, #1A160D)' : 'none',
                    border: '1px solid #3A3020', color: sortKey === s.key ? '#E8C468' : '#A6A6AD',
                    borderRadius: RADIUS_SCALE[999], padding: '6px 12px', fontSize: TYPE_SCALE[11.5], cursor: 'pointer',
                } }, s.label))),
        sortKey === 'mostRead' && React.createElement("div", { style: { fontSize: TYPE_SCALE[10.5], color: '#5C5C64', textAlign: 'center', marginBottom: 14, fontStyle: 'italic' } }, "no reading-count data tracked yet \u2014 showing newest first"),
        sortKey === 'rated' && ratedBooks.length === 0 && React.createElement("div", { style: { fontSize: TYPE_SCALE[10.5], color: '#5C5C64', textAlign: 'center', marginBottom: 14, fontStyle: 'italic' } }, "no ratings yet \u2014 showing newest first"),
        sorted.length === 0
            ? React.createElement(EmptyState, { text: books.length === 0 ? "No books published yet \u2014 switch to Creator Studio to publish your first one." : "No books match that search." })
            : React.createElement("div", { className: "ink-grid-cards" },
                sorted.map((book) => React.createElement(LibraryDiscoverCard, Object.assign({
                    key: book.id, book, isFavorite: favorites.has(book.id), onToggleFavorite: toggleFavorite, onRead: onRead,
                    onPreview: () => openBook(book.id, book.title), myRating: ratings[book.id], onOpenAuthor: openAuthorProfile,
                }, quickActionProps(book))))));
    const selectedBookModal = selectedBook && React.createElement(BookDetailModal, Object.assign({
        book: selectedBook, isFavorite: favorites.has(selectedBook.id), onToggleFavorite: toggleFavorite,
        myRating: ratings[selectedBook.id], onSetRating: handleSetRating,
        onReadFull: (id) => { nav.pop(); onRead(id); }, onClose: closeBook, onOpenAuthor: openAuthorProfile,
    }, quickActionProps(selectedBook)));
    const selectedPackModal = selectedPack && React.createElement(WorldbuildingPackDetailModal, { pack: selectedPack, onClose: closePack });
    const cartDrawerModal = cartOpen && React.createElement(CartDrawer, {
        items: cart, onClose: closeCart, onRemove: removeFromCart,
        onOpenBook: (id) => { closeCart(); const b = books.find((bk) => bk.id === id); if (b) openBook(b.id, b.title); },
    });
    const tipModal = tipBook && React.createElement(TipAuthorModal, { book: tipBook, onClose: closeTip, onOpenAuthor: openAuthorProfile });
    const discussModal = discussBook && React.createElement(DiscussionHallModal, { book: discussBook, writerName, onClose: closeDiscuss });
    const readerView = React.createElement(React.Fragment, null,
        React.createElement(GrandLibraryShelfStyles, null),
        topBar, featuredEl, newReleasesShelf, trendingShelf, highestRatedShelf, worldbuildingPacksSection,
        mostReadShelf, templatesShelf, addonsShelf, editorsChoiceShelf, guildAnthologiesShelf, hallOfLegendsShelf,
        featuredCreatorsSection, discussionHallsSection, browseSearchSection,
        selectedBookModal, selectedPackModal, cartDrawerModal, tipModal, discussModal);
    // Author Studio's 'studio' mode now renders the full Creator Dashboard (see CreatorDashboard
    // above) — same underlying project/pack data and Publishing Wizard wiring as before, just with
    // a proper identity header, overview cards, and an eight-tab layout in place of the single
    // scrolling list this used to be.
    const studioView = React.createElement(CreatorDashboard, {
        projects, writerProfile, writerRank, writerLevel, writerReputation, writerGuildName,
        onOpen, onRead, onSetPublishStatus, onOpenPacks, onSetPackPublishStatus,
        onOpenPublishWizard: openPublishWizard,
    });
    return React.createElement(GrandLibraryAtmosphere, null,
        React.createElement("div", { style: { textAlign: 'center', marginBottom: 8 } },
            React.createElement("div", { style: { fontSize: TYPE_SCALE[22], color: '#C89B3C', opacity: 0.85, marginBottom: 6 } }, "\u2766"),
            React.createElement("div", { style: { fontFamily: "'Fraunces', Georgia, serif", fontSize: TYPE_SCALE[28], fontStyle: 'italic', fontWeight: 600, color: '#EFE7D2', textShadow: '0 0 18px rgba(232,196,104,0.25)' } }, "The Grand Library"),
            React.createElement("div", { style: { fontSize: TYPE_SCALE[12.5], color: '#B9AE8F', marginTop: 6, marginBottom: 34, fontStyle: 'italic' } }, "Publish, discover, and manage every chronicle, all in one hall")),
        React.createElement("div", { style: {
                position: 'sticky', top: 84, zIndex: 20,
                display: 'flex', gap: SPACE_SCALE[4], background: 'linear-gradient(160deg, #2A2115, #17130E)', border: '1px solid #4A3D22',
                borderRadius: RADIUS_SCALE[12], padding: 4, marginBottom: 28, boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04), 0 6px 18px rgba(0,0,0,0.35)',
            } },
            React.createElement("button", { onClick: () => setMode('reader'), style: {
                    flex: 1, border: 'none', cursor: 'pointer', borderRadius: RADIUS_SCALE[9], padding: '10px 12px',
                    fontSize: TYPE_SCALE[13], fontWeight: 600, letterSpacing: '0.03em',
                    background: mode === 'reader' ? 'linear-gradient(160deg, #3A2F1C, #241E12)' : 'transparent',
                    color: mode === 'reader' ? '#E8C468' : '#8A8272',
                    boxShadow: mode === 'reader' ? 'inset 0 1px 0 rgba(255,255,255,0.06), 0 0 14px rgba(232,196,104,0.32)' : 'none',
                    transition: 'background var(--ink-dur) var(--ink-ease), color var(--ink-dur) var(--ink-ease), box-shadow var(--ink-dur) var(--ink-ease)',
                } }, "\uD83D\uDD0D Discover"),
            React.createElement("button", { onClick: () => setMode('studio'), style: {
                    flex: 1, border: 'none', cursor: 'pointer', borderRadius: RADIUS_SCALE[9], padding: '10px 12px',
                    fontSize: TYPE_SCALE[13], fontWeight: 600, letterSpacing: '0.03em',
                    background: mode === 'studio' ? 'linear-gradient(160deg, #3A2F1C, #241E12)' : 'transparent',
                    color: mode === 'studio' ? '#E8C468' : '#8A8272',
                    boxShadow: mode === 'studio' ? 'inset 0 1px 0 rgba(255,255,255,0.06), 0 0 14px rgba(232,196,104,0.32)' : 'none',
                    transition: 'background var(--ink-dur) var(--ink-ease), color var(--ink-dur) var(--ink-ease), box-shadow var(--ink-dur) var(--ink-ease)',
                } }, "\uD83D\uDD8B\uFE0F Creator Studio")),
        mode === 'reader' ? readerView : studioView,
        publishWizard && (() => {
            const wizProject = projects.find((p) => p.id === publishWizard.projectId);
            return wizProject && React.createElement(PublishingWizard, {
                project: wizProject, initialTarget: { type: publishWizard.type, packId: publishWizard.packId }, writerGuildName,
                onClose: closePublishWizard,
                onPublishBook: (destination, details) => onPublishBookWithDetails(publishWizard.projectId, destination, details),
                onPublishPack: (packId, destination, details) => onPublishPackWithDetails(publishWizard.projectId, packId, destination, details),
            });
        })());
}
