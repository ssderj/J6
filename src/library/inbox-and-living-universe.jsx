import React, { useState, useEffect, useRef, useMemo } from 'react';
import { storage } from '../lib/storage.js';
import { FOUNDER_GUILDS } from '../guild/guild-hall.jsx';
import { GUILD_RANK_TIERS } from '../guild/guild-reputation-panel.jsx';
import { REPUTATION_TITLES } from './author-reputation.jsx';
import { GrandLibraryAtmosphere } from './grand-library-cards.jsx';
import { Field } from '../shared-ui/form-fields.jsx';
import { INBOX_KEY, uuid } from '../shared-utils/storage-keys.jsx';
import { RADIUS_SCALE, SPACE_SCALE, TYPE_SCALE } from '../shell/nav-context.jsx';
import { ACHIEVEMENTS, RARITY_META, WRITER_RANKS } from '../writing/health-checks.jsx';


// Sticky segmented nav for the Home screen: Home | Guild. The Guild segment stays locked until
// the writer's lifetime level reaches GUILD_UNLOCK_LEVEL — while locked, tapping it can't switch
// tabs (there's nowhere to go yet), so it surfaces a small tooltip instead. As the writer nears
// level 10 the lock's gold glow gradually intensifies, gaining a faint shimmer at level 9, and the
// moment level 10 is first reached the lock cracks apart into particles, the glow flares briefly,
// a ceremonial chime plays, and a banner announces the Guild Hall is open — a once-ever ceremony,
// guarded by GUILD_UNLOCK_SEEN_KEY so reopening the app afterward just shows the plain, unlocked tab.
// ---------- Author Inbox — "The Correspondence Hall" ----------
// The writer's communication hub: reviews, reader letters, reputation notices, sales ledgers,
// guild post, marketplace trade, honor medals, and town-crier notices, gathered as one hall of
// mail — rendered inside GrandLibraryAtmosphere so it reads as the same Hall as Home and the
// Grand Library rather than a bolted-on screen. Unread letters render sealed in wax (a color +
// emblem per category, see INBOX_CATEGORIES); opening one plays a quick seal-crack (ai-seal-crack)
// before the letter unfolds and is marked read. Starred/archived/unread state persists via
// `storage` under INBOX_KEY, the same on-device pattern as the Writer Profile and Guild.
export const INBOX_CATEGORIES = [
    { id: 'reviews', label: 'Reviews', icon: '\u2B50', accent: { light: '#F0D68C', mid: '#C89B3C', deep: '#5C4517' },
        empty: "No reviews have arrived yet \u2014 when readers finish your chronicles, their words will be filed here." },
    { id: 'messages', label: 'Reader Messages', icon: '\u2709\uFE0F', accent: { light: '#E29B9B', mid: '#A24747', deep: '#3D1919' },
        empty: "Your desk is clear \u2014 no letters from readers waiting." },
    { id: 'reputation', label: 'Reputation', icon: '\u231B', accent: { light: '#C7A3DE', mid: '#8A5AA8', deep: '#2E1A3A' },
        empty: "No reputation notices yet \u2014 your standing in the guild will be chronicled here as it grows." },
    { id: 'sales', label: 'Sales', icon: '\uD83E\uDE99', accent: { light: '#9FCBAE', mid: '#4E8064', deep: '#17291F' },
        empty: "No sales recorded yet \u2014 every purchase of your work will be entered in this ledger." },
    { id: 'guild', label: 'Guild Notifications', icon: '\uD83C\uDFDB\uFE0F', accent: { light: '#A9C0E0', mid: '#4A6690', deep: '#182437' },
        empty: "Nothing from the Guild Hall right now \u2014 invitations, anthology news, and mentions will post here." },
    { id: 'marketplace', label: 'Marketplace Sales', icon: '\uD83C\uDFF7\uFE0F', accent: { light: '#E3B279', mid: '#B5793A', deep: '#3E2611' },
        empty: "No trade yet \u2014 packs and templates you sell to fellow authors will be recorded here." },
    { id: 'achievements', label: 'Achievement Rewards', icon: '\uD83C\uDFC5', accent: { light: '#F5DE9C', mid: '#D8A93F', deep: '#4A3610' },
        empty: "No honors claimed yet \u2014 medals earned along the road will be presented here." },
    { id: 'system', label: 'System Announcements', icon: '\uD83D\uDCEF', accent: { light: '#C9C9D1', mid: '#7A7A85', deep: '#232327' },
        empty: "Quiet for now \u2014 word from the Scriptorium will be posted here when there's news." },
];


export const INBOX_CATEGORY_BY_ID = Object.fromEntries(INBOX_CATEGORIES.map((c) => [c.id, c]));


// Sample correspondence a fresh device starts with — same role as NoticeBoard's starter notices:
// evergreen content standing in for a real mail system this on-device app doesn't have yet.
// Once saved under INBOX_KEY, a writer's own read/starred/archived edits persist from here.
export function seedInboxItems() {
    return [
        { id: 'rev-1', category: 'reviews', unread: true, starred: false, archived: false, time: '2h ago',
            bookTitle: 'The Salt-Iron Crown', rating: 5, reviewerName: 'Wrenna Locke',
            body: "I stayed up until three in the morning finishing this. The way the treaty scenes mirror the sibling rivalry in the third act is the best structural trick I've read all year. Please tell me there's a sequel coming." },
        { id: 'rev-2', category: 'reviews', unread: true, starred: false, archived: false, time: '6h ago',
            bookTitle: 'Ashes of the Nine Courts', rating: 4, reviewerName: 'Dobrin Vael',
            body: "Strong voice, strong worldbuilding. Docking one star only because the middle third slows down \u2014 the court politics chapters could lose a scene or two without losing anything essential." },
        { id: 'rev-3', category: 'reviews', unread: false, starred: true, archived: false, time: 'Yesterday',
            bookTitle: "The Cartographer's Oath", rating: 5, reviewerName: 'M. Thistlewood',
            body: "A map that lies on purpose is such a small idea and you built an entire moral universe out of it. This is the book I'm recommending to everyone in my guild this season." },
        { id: 'rev-4', category: 'reviews', unread: false, starred: false, archived: false, time: '3 days ago',
            bookTitle: 'Ashes of the Nine Courts', rating: 3, reviewerName: 'quietinkwell',
            body: "Good bones, but I never felt like I knew the second court well enough to care when it fell. Might just be me \u2014 curious what others thought." },
        { id: 'rev-5', category: 'reviews', unread: false, starred: false, archived: false, time: '1 week ago',
            bookTitle: 'The Salt-Iron Crown', rating: 4, reviewerName: 'Halcyon_Reads',
            body: "Beautiful prose, and the ending genuinely surprised me, which is rare these days. Would have liked a touch more time with the younger prince before the twist." },

        { id: 'msg-1', category: 'messages', unread: true, starred: false, archived: false, time: '40m ago',
            senderName: 'Perrin Oakhale', subject: 'A question about Chapter 12',
            body: "Hi! Loved the reveal at the border post, but I'm confused about the timeline \u2014 was the ambush before or after the coronation? Rereading now but wanted to ask in case I missed a line." },
        { id: 'msg-2', category: 'messages', unread: true, starred: false, archived: false, time: '5h ago',
            senderName: 'SilverQuillFan', subject: "When's the sequel??",
            body: "No pressure at all (okay, some pressure) but is there any chance we get news on book two this year? I've reread the ending four times." },
        { id: 'msg-3', category: 'messages', unread: false, starred: true, archived: false, time: '2 days ago',
            senderName: 'Yorick Bramblewood', subject: "A theory I can't stop thinking about",
            body: "Is the cartographer's mother actually the exiled queen from the prologue? The compass motif lines up a little too well to be a coincidence. Tell me I'm not losing my mind." },
        { id: 'msg-4', category: 'messages', unread: false, starred: false, archived: false, time: '4 days ago',
            senderName: 'Iris Delacroix', subject: 'Translation request',
            body: "I run a small reading circle that translates chapters informally for friends who don't read English well. Would you be comfortable with that, purely non-commercial?" },
        { id: 'msg-5', category: 'messages', unread: false, starred: false, archived: true, time: '2 weeks ago',
            senderName: 'Cass Windermere', subject: 'Just wanted to say thank you',
            body: "This book got me through a rough winter. That's all \u2014 just wanted you to know it mattered to someone." },

        { id: 'rep-1', category: 'reputation', unread: true, starred: false, archived: false, time: '1h ago',
            title: 'Reader Milestone', amount: 40,
            body: 'The Salt-Iron Crown passed 500 reads in the Grand Library. Word is spreading through the stacks.' },
        { id: 'rep-2', category: 'reputation', unread: true, starred: false, archived: false, time: '6h ago',
            title: 'Glowing Review', amount: 15,
            body: 'A new five-star review was left on Ashes of the Nine Courts by Dobrin Vael.' },
        { id: 'rep-3', category: 'reputation', unread: false, starred: false, archived: false, time: 'Yesterday',
            title: 'Work Completed', amount: 25,
            body: "The Cartographer's Oath was marked complete \u2014 finished chronicles carry weight in the guild's eyes." },
        { id: 'rep-4', category: 'reputation', unread: false, starred: false, archived: false, time: '5 days ago',
            title: 'Guild Contribution', amount: 10,
            body: "You submitted a short story to the Founders' Anthology. Contribution noted by the guild scribes." },
        { id: 'rep-5', category: 'reputation', unread: false, starred: true, archived: false, time: '1 week ago',
            title: 'Featured Work', amount: 60,
            body: "The Salt-Iron Crown was chosen for the Grand Library's New Releases shelf \u2014 a featured placement." },

        { id: 'sale-1', category: 'sales', unread: true, starred: false, archived: false, time: '3h ago',
            itemTitle: 'The Salt-Iron Crown', itemType: 'Book', copies: 3, earnings: 27,
            body: "3 copies purchased today, bringing this week's total for The Salt-Iron Crown to 11 copies sold." },
        { id: 'sale-2', category: 'sales', unread: false, starred: false, archived: false, time: 'Yesterday',
            itemTitle: 'World Bible: The Nine Courts', itemType: 'Pack', copies: 1, earnings: 6,
            body: 'A reader purchased the companion World Bible pack alongside Ashes of the Nine Courts.' },
        { id: 'sale-3', category: 'sales', unread: false, starred: false, archived: false, time: '2 days ago',
            itemTitle: 'Ashes of the Nine Courts', itemType: 'Book', copies: 7, earnings: 63,
            body: 'A strong day \u2014 7 copies sold following your reader message thread about the second court.' },
        { id: 'sale-4', category: 'sales', unread: false, starred: false, archived: false, time: '5 days ago',
            itemTitle: "The Cartographer's Oath", itemType: 'Book', copies: 2, earnings: 18,
            body: '2 copies purchased. Earnings have been added to your ledger.' },

        { id: 'gld-1', category: 'guild', unread: true, starred: false, archived: false, time: '20m ago',
            kind: 'Invitation', title: "The Cartographer's Guild invites you to join",
            body: 'Guild Master M. Thistlewood has extended an invitation. The Cartographer\u2019s Guild focuses on worldbuilding-heavy chronicles and hosts a monthly map-lore critique.' },
        { id: 'gld-2', category: 'guild', unread: true, starred: false, archived: false, time: '3h ago',
            kind: 'Anthology Update', title: 'Founders\u2019 Anthology: your submission advanced to final review',
            body: "Your short story has cleared the first round of readings and moves to the guild's final review panel. Results are expected within the fortnight." },
        { id: 'gld-3', category: 'guild', unread: false, starred: true, archived: false, time: '1 day ago',
            kind: 'Mention', title: 'You were mentioned in the Guild Hall',
            body: "Guild Master Thistlewood mentioned you in the Members' Hall discussion: worth reading if you want to see restraint done well in a political arc." },
        { id: 'gld-4', category: 'guild', unread: false, starred: false, archived: false, time: '4 days ago',
            kind: 'Anthology Update', title: "Founders' Anthology submissions close in 5 days",
            body: 'A reminder that the submission window for this season\u2019s anthology closes soon.' },
        { id: 'gld-5', category: 'guild', unread: false, starred: false, archived: false, time: '1 week ago',
            kind: 'Guild Milestone', title: 'Your guild crossed 1,000 combined reads',
            body: "A shared milestone for every member's contribution this season. The Guild Hall's banner has been raised in celebration." },

        { id: 'mkt-1', category: 'marketplace', unread: true, starred: false, archived: false, time: '5h ago',
            itemTitle: 'Political Intrigue Character Pack', buyerCount: 2, earnings: 14,
            body: '2 fellow authors purchased your character-relationship template pack for their own courtly-intrigue projects.' },
        { id: 'mkt-2', category: 'marketplace', unread: false, starred: false, archived: false, time: '3 days ago',
            itemTitle: 'Coastal Kingdom Cover Set', buyerCount: 1, earnings: 9,
            body: 'One purchase of your cover art pack from an author building a seafaring trilogy.' },
        { id: 'mkt-3', category: 'marketplace', unread: false, starred: false, archived: false, time: '6 days ago',
            itemTitle: 'Nine Courts World Bible Template', buyerCount: 4, earnings: 32,
            body: 'Your world-bible structure template continues to be one of the more traded packs in the marketplace this month.' },

        { id: 'ach-1', category: 'achievements', unread: true, starred: false, archived: false, time: '1h ago',
            title: "Reader's Favorite", reward: '+50 Reputation', body: 'Your chronicles have collectively received 50 reviews. A medal has been struck in your name.' },
        { id: 'ach-2', category: 'achievements', unread: false, starred: false, archived: false, time: '3 days ago',
            title: 'Century Club', reward: '+30 Reputation', body: '100,000 words written across your library. The scribes are impressed.' },
        { id: 'ach-3', category: 'achievements', unread: false, starred: true, archived: false, time: '2 weeks ago',
            title: 'The Long Road', reward: 'Golden Name cosmetic', body: 'You completed a full trilogy from first word to final chapter. Your name now catches the light in the Guild Hall roster.' },

        { id: 'sys-1', category: 'system', unread: true, starred: false, archived: false, time: 'Today',
            title: 'Scheduled Maintenance', body: 'The Scriptorium will close briefly this weekend for routine upkeep. Drafts in progress are saved locally and unaffected.' },
        { id: 'sys-2', category: 'system', unread: false, starred: false, archived: false, time: '4 days ago',
            title: 'New: Distance Calculator route previews', body: 'Route lines on the map now glow while you plan travel between locations in your world.' },
        { id: 'sys-3', category: 'system', unread: false, starred: false, archived: false, time: '2 weeks ago',
            title: 'Guild Hall Update', body: 'Level 30 guild cosmetics \u2014 including golden lighting across the Hall \u2014 are now live for qualifying guilds.' },
    ];
}


export function inboxWax(accent) {
    return `radial-gradient(circle at 34% 30%, ${accent.light}, ${accent.mid} 58%, ${accent.deep} 100%)`;
}


export function InboxStars({ rating }) {
    return React.createElement("span", { style: { letterSpacing: 1, fontSize: TYPE_SCALE[13] } },
        [1, 2, 3, 4, 5].map((n) => React.createElement("span", { key: n, style: { color: n <= rating ? '#E8C468' : 'rgba(154,154,162,0.35)' } }, "\u2605")));
}


export function InboxPill({ children, active, onClick, count }) {
    return React.createElement("button", {
        onClick, style: {
            fontSize: TYPE_SCALE[12], fontWeight: 600, letterSpacing: '0.02em',
            color: active ? '#1A1610' : '#9A9AA2',
            background: active ? '#E8C468' : 'rgba(255,255,255,0.04)',
            border: `1px solid ${active ? '#E8C468' : 'rgba(232,196,104,0.14)'}`,
            borderRadius: RADIUS_SCALE[999], padding: '6px 13px', cursor: 'pointer',
            display: 'inline-flex', alignItems: 'center', gap: SPACE_SCALE[6],
            transition: 'all var(--ink-dur) var(--ink-ease)',
        },
    },
        children,
        count > 0 && React.createElement("span", { style: {
                fontSize: TYPE_SCALE[10.5], fontWeight: 700, background: active ? 'rgba(26,22,16,0.25)' : 'rgba(232,196,104,0.16)',
                color: active ? '#1A1610' : '#E8C468', borderRadius: RADIUS_SCALE[999], padding: '1px 6px',
            } }, count));
}


export function InboxItemHeader({ item, cat }) {
    switch (item.category) {
        case 'reviews':
            return React.createElement("div", null,
                React.createElement("div", { style: { fontFamily: "'Fraunces', Georgia, serif", fontSize: TYPE_SCALE[15.5], fontWeight: 600, color: '#EFE7D2' } }, item.bookTitle),
                React.createElement("div", { style: { marginTop: 4, display: 'flex', alignItems: 'center', gap: SPACE_SCALE[8] } },
                    React.createElement(InboxStars, { rating: item.rating }),
                    React.createElement("span", { style: { fontSize: TYPE_SCALE[12], color: '#9A9AA2' } }, `\u00B7 ${item.reviewerName}`)));
        case 'messages':
            return React.createElement("div", null,
                React.createElement("div", { style: { fontFamily: "'Fraunces', Georgia, serif", fontSize: TYPE_SCALE[15.5], fontWeight: 600, color: '#EFE7D2' } }, item.subject),
                React.createElement("div", { style: { marginTop: 4, fontSize: TYPE_SCALE[12], color: '#9A9AA2' } }, `from ${item.senderName}`));
        case 'reputation':
            return React.createElement("div", null,
                React.createElement("div", { style: { fontFamily: "'Fraunces', Georgia, serif", fontSize: TYPE_SCALE[15.5], fontWeight: 600, color: '#EFE7D2' } }, item.title),
                React.createElement("div", { style: { marginTop: 4, fontSize: TYPE_SCALE[12.5], fontWeight: 700, color: cat.accent.light } }, `+${item.amount} Reputation`));
        case 'sales':
            return React.createElement("div", null,
                React.createElement("div", { style: { fontFamily: "'Fraunces', Georgia, serif", fontSize: TYPE_SCALE[15.5], fontWeight: 600, color: '#EFE7D2' } }, item.itemTitle),
                React.createElement("div", { style: { marginTop: 4, fontSize: TYPE_SCALE[12], color: '#9A9AA2' } },
                    `${item.itemType} \u00B7 ${item.copies} sold \u00B7 `,
                    React.createElement("span", { style: { color: cat.accent.light, fontWeight: 700 } }, `${item.earnings} \uD83E\uDE99 earned`)));
        case 'guild':
            return React.createElement("div", null,
                React.createElement("div", { style: { fontSize: TYPE_SCALE[10.5], fontWeight: 700, letterSpacing: '0.09em', textTransform: 'uppercase', color: cat.accent.light, marginBottom: 3 } }, item.kind),
                React.createElement("div", { style: { fontFamily: "'Fraunces', Georgia, serif", fontSize: TYPE_SCALE[15.5], fontWeight: 600, color: '#EFE7D2' } }, item.title));
        case 'marketplace':
            return React.createElement("div", null,
                React.createElement("div", { style: { fontFamily: "'Fraunces', Georgia, serif", fontSize: TYPE_SCALE[15.5], fontWeight: 600, color: '#EFE7D2' } }, item.itemTitle),
                React.createElement("div", { style: { marginTop: 4, fontSize: TYPE_SCALE[12], color: '#9A9AA2' } },
                    `${item.buyerCount} author${item.buyerCount === 1 ? '' : 's'} purchased \u00B7 `,
                    React.createElement("span", { style: { color: cat.accent.light, fontWeight: 700 } }, `${item.earnings} \uD83E\uDE99 earned`)));
        case 'achievements':
            return React.createElement("div", null,
                React.createElement("div", { style: { fontFamily: "'Fraunces', Georgia, serif", fontSize: TYPE_SCALE[15.5], fontWeight: 600, color: '#EFE7D2' } }, item.title),
                React.createElement("div", { style: { marginTop: 4, fontSize: TYPE_SCALE[12.5], fontWeight: 700, color: cat.accent.light } }, item.reward));
        case 'system':
            return React.createElement("div", { style: { fontFamily: "'Fraunces', Georgia, serif", fontSize: TYPE_SCALE[15.5], fontWeight: 600, color: '#EFE7D2' } }, item.title);
        default:
            return null;
    }
}


export function inboxActionBtnStyle(active) {
    return {
        fontSize: TYPE_SCALE[12], fontWeight: 600, color: active ? '#1A1610' : '#EFE7D2',
        background: active ? '#E8C468' : 'rgba(255,255,255,0.05)',
        border: `1px solid ${active ? '#E8C468' : 'rgba(255,255,255,0.14)'}`,
        borderRadius: RADIUS_SCALE[7], padding: '6px 12px', cursor: 'pointer',
    };
}


export function InboxLetterCard({ item, cat, index, expanded, cracking, onOpen, onToggleStar, onArchive, onUnarchive }) {
    return React.createElement("div", {
        className: "ai-card-in",
        style: {
            animationDelay: `${Math.min(index, 8) * 45}ms`, position: 'relative',
            background: item.unread ? 'linear-gradient(160deg, #221E15, #1C1912)' : 'linear-gradient(160deg, rgba(28,25,18,0.55), rgba(20,17,13,0.55))',
            border: `1px solid ${item.unread ? 'rgba(232,196,104,0.22)' : 'rgba(232,196,104,0.14)'}`,
            borderLeft: `3px solid ${cat.accent.mid}`, borderRadius: RADIUS_SCALE[10], padding: '16px 18px', marginBottom: 12, cursor: 'pointer',
            boxShadow: item.unread ? '0 6px 18px rgba(0,0,0,0.35)' : '0 2px 8px rgba(0,0,0,0.2)',
            transition: 'border-color 240ms ease, background 240ms ease',
        },
        onClick: () => onOpen(item),
    },
        React.createElement("div", { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: SPACE_SCALE[12] } },
            React.createElement("div", { style: { display: 'flex', gap: SPACE_SCALE[12], alignItems: 'flex-start', flex: 1, minWidth: 0 } },
                React.createElement("div", { style: { position: 'relative', width: 30, height: 30, flexShrink: 0, marginTop: 2 } },
                    item.unread
                        ? React.createElement("div", {
                            className: cracking ? 'ai-seal-crack' : 'ai-seal-breathe',
                            style: {
                                width: 26, height: 26, borderRadius: '50%', background: inboxWax(cat.accent),
                                boxShadow: '0 0 0 1px rgba(0,0,0,0.35), 0 2px 5px rgba(0,0,0,0.4)',
                                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: TYPE_SCALE[11.5],
                            },
                        }, React.createElement("span", { style: { filter: 'drop-shadow(0 1px 1px rgba(0,0,0,0.4))' } }, cat.icon))
                        : React.createElement("div", {
                            style: {
                                width: 26, height: 26, borderRadius: '50%', border: `1px solid ${cat.accent.mid}`, opacity: 0.55,
                                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: TYPE_SCALE[11.5],
                            },
                        }, cat.icon)),
                React.createElement("div", { style: { flex: 1, minWidth: 0 } },
                    React.createElement(InboxItemHeader, { item, cat }),
                    !expanded && React.createElement("div", {
                        style: {
                            marginTop: 6, fontSize: TYPE_SCALE[12.5], color: '#9A9AA2', lineHeight: 1.5,
                            display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
                        },
                    }, item.body))),
            React.createElement("div", { style: { display: 'flex', alignItems: 'center', gap: SPACE_SCALE[10], flexShrink: 0 } },
                React.createElement("span", { style: { fontSize: TYPE_SCALE[11], color: '#6B6B72', whiteSpace: 'nowrap' } }, item.time),
                React.createElement("button", {
                    onClick: (e) => { e.stopPropagation(); onToggleStar(item); },
                    title: item.starred ? 'Unstar' : 'Star',
                    style: { background: 'none', border: 'none', cursor: 'pointer', fontSize: TYPE_SCALE[16], padding: 2, lineHeight: 1, color: item.starred ? '#E8C468' : 'rgba(154,154,162,0.45)' },
                }, item.starred ? "\u2605" : "\u2606"))),
        expanded && React.createElement("div", { className: "ai-unfold", style: { marginTop: 12, paddingTop: 12, borderTop: '1px solid rgba(232,196,104,0.14)' } },
            React.createElement("div", { style: { fontSize: TYPE_SCALE[13.5], color: '#EFE7D2', lineHeight: 1.65 } }, item.body),
            React.createElement("div", { style: { marginTop: 14, display: 'flex', gap: SPACE_SCALE[8] } },
                React.createElement("button", {
                    onClick: (e) => { e.stopPropagation(); onToggleStar(item); },
                    style: inboxActionBtnStyle(item.starred),
                }, item.starred ? "\u2605 Starred" : "\u2606 Star"),
                item.archived
                    ? React.createElement("button", { onClick: (e) => { e.stopPropagation(); onUnarchive(item); }, style: inboxActionBtnStyle(false) }, "\u21A9 Restore")
                    : React.createElement("button", { onClick: (e) => { e.stopPropagation(); onArchive(item); }, style: inboxActionBtnStyle(false) }, "\uD83D\uDDC4 Archive"))));
}


// The Author Inbox screen itself — owns its own items (loaded from / saved to storage under
// INBOX_KEY, same pattern as GrandLibraryScreen owning its own reader/author state) so HomeScreen
// doesn't need to thread mail state through props. HomeScreen still peeks at INBOX_KEY separately
// for the unread badge on the nav tab (see its inboxUnreadCount effect) since this component only
// mounts while the Inbox tab is actually open.
export function AuthorInboxScreen({ hasPublished }) {
    const [items, setItems] = useState(null); // null while loading
    const [activeCat, setActiveCat] = useState('reviews');
    const [filter, setFilter] = useState('all'); // all | unread | starred | archived
    const [query, setQuery] = useState('');
    const [expandedId, setExpandedId] = useState(null);
    const [crackingId, setCrackingId] = useState(null);
    const crackTimeout = useRef(null);
    useEffect(() => {
        let cancelled = false;
        (async () => {
            const res = await storage.get(INBOX_KEY);
            if (cancelled)
                return;
            if (res) {
                try {
                    setItems(JSON.parse(res.value));
                    return;
                }
                catch (e) { /* fall through to seeding below */ }
            }
            // Reviews, sales, and guild mail about books that don't exist yet would be actively
            // misleading for a writer who hasn't published anything — an honest empty inbox beats
            // a fake-populated one. Sample correspondence only seeds in once there's at least one
            // published work for it to plausibly be about.
            setItems(hasPublished ? seedInboxItems() : []);
        })();
        return () => { cancelled = true; };
    }, []);
    useEffect(() => {
        if (items === null)
            return;
        storage.set(INBOX_KEY, JSON.stringify(items)).catch(() => { });
    }, [items]);
    useEffect(() => () => clearTimeout(crackTimeout.current), []);
    const cat = INBOX_CATEGORY_BY_ID[activeCat];
    const tabItems = useMemo(() => (items || []).filter((i) => i.category === activeCat), [items, activeCat]);
    const unreadCounts = useMemo(() => {
        const m = {};
        INBOX_CATEGORIES.forEach((c) => { m[c.id] = (items || []).filter((i) => i.category === c.id && i.unread && !i.archived).length; });
        return m;
    }, [items]);
    const filtered = useMemo(() => {
        let list = tabItems;
        if (filter === 'archived')
            list = list.filter((i) => i.archived);
        else {
            list = list.filter((i) => !i.archived);
            if (filter === 'unread')
                list = list.filter((i) => i.unread);
            if (filter === 'starred')
                list = list.filter((i) => i.starred);
        }
        if (query.trim()) {
            const q = query.trim().toLowerCase();
            list = list.filter((i) => JSON.stringify(i).toLowerCase().includes(q));
        }
        return list;
    }, [tabItems, filter, query]);
    const filterCounts = useMemo(() => {
        const base = tabItems.filter((i) => !i.archived);
        return {
            unread: base.filter((i) => i.unread).length,
            starred: base.filter((i) => i.starred).length,
            archived: tabItems.filter((i) => i.archived).length,
        };
    }, [tabItems]);
    function selectCat(id) {
        setActiveCat(id);
        setExpandedId(null);
        setQuery('');
        setFilter('all');
    }
    function openItem(item) {
        if (expandedId === item.id) {
            setExpandedId(null);
            return;
        }
        if (item.unread) {
            setCrackingId(item.id);
            crackTimeout.current = setTimeout(() => {
                setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, unread: false } : i)));
                setCrackingId(null);
                setExpandedId(item.id);
            }, 420);
        }
        else {
            setExpandedId(item.id);
        }
    }
    function toggleStar(item) {
        setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, starred: !i.starred } : i)));
    }
    function archiveItem(item) {
        setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, archived: true } : i)));
        setExpandedId(null);
    }
    function unarchiveItem(item) {
        setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, archived: false } : i)));
    }
    function markAllRead() {
        setItems((prev) => prev.map((i) => (i.category === activeCat ? { ...i, unread: false } : i)));
    }
    if (items === null) {
        return React.createElement(GrandLibraryAtmosphere, null,
            React.createElement("div", { style: { textAlign: 'center', padding: '64px 12px', fontSize: TYPE_SCALE[12.5], color: '#5C5C64' } }, "Sorting the morning post\u2026"));
    }
    const totalUnread = Object.values(unreadCounts).reduce((a, b) => a + b, 0);
    return React.createElement(GrandLibraryAtmosphere, null,
        React.createElement("div", { style: { marginBottom: 22 } },
            React.createElement("div", { style: { fontFamily: "'Fraunces', Georgia, serif", fontSize: TYPE_SCALE[22], fontStyle: 'italic', fontWeight: 600, color: '#EFE7D2' } }, "The Correspondence Hall"),
            React.createElement("div", { style: { fontSize: TYPE_SCALE[12.5], color: totalUnread > 0 ? '#C89B3C' : '#7A7A82', marginTop: 4 } },
                totalUnread > 0 ? `${totalUnread} unopened letter${totalUnread === 1 ? '' : 's'} across the Hall` : "You're caught up on every letter in the Hall.")),
        React.createElement("div", { style: { display: 'flex', flexWrap: 'wrap', gap: SPACE_SCALE[6], marginBottom: 18 } },
            INBOX_CATEGORIES.map((c) => {
                const active = c.id === activeCat;
                const count = unreadCounts[c.id];
                return React.createElement("button", {
                    key: c.id, onClick: () => selectCat(c.id),
                    style: {
                        display: 'flex', alignItems: 'center', gap: SPACE_SCALE[6], padding: '8px 12px', borderRadius: RADIUS_SCALE[9], cursor: 'pointer',
                        background: active ? 'rgba(232,196,104,0.12)' : 'rgba(255,255,255,0.03)',
                        border: `1px solid ${active ? 'rgba(232,196,104,0.32)' : 'rgba(232,196,104,0.14)'}`,
                        fontSize: TYPE_SCALE[12.5], fontWeight: active ? 700 : 500, color: active ? '#EFE7D2' : '#9A9AA2',
                        transition: 'background 200ms ease',
                    },
                },
                    React.createElement("span", { style: { fontSize: TYPE_SCALE[13.5] } }, c.icon),
                    React.createElement("span", null, c.label),
                    count > 0 && React.createElement("span", {
                        style: {
                            fontSize: TYPE_SCALE[10], fontWeight: 700, color: '#1A1610', background: '#E8C468', borderRadius: RADIUS_SCALE[999],
                            minWidth: 16, textAlign: 'center', padding: '1px 5px', lineHeight: '14px',
                        },
                    }, count));
            })),
        React.createElement("div", { style: { background: 'rgba(20,17,13,0.6)', border: '1px solid rgba(232,196,104,0.14)', borderRadius: RADIUS_SCALE[10], padding: '12px 14px', marginBottom: 16 } },
            React.createElement("div", { style: { position: 'relative', marginBottom: 10 } },
                React.createElement("span", { style: { position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', fontSize: TYPE_SCALE[13], opacity: 0.6 } }, "\uD83D\uDD0D"),
                React.createElement("input", {
                    value: query, onChange: (e) => setQuery(e.target.value),
                    placeholder: `Search ${cat.label.toLowerCase()}\u2026`,
                    style: {
                        width: '100%', background: 'rgba(0,0,0,0.25)', border: '1px solid rgba(232,196,104,0.14)',
                        borderRadius: RADIUS_SCALE[7], padding: '9px 12px 9px 32px', color: '#EFE7D2', fontSize: TYPE_SCALE[13],
                    },
                })),
            React.createElement("div", { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: SPACE_SCALE[8] } },
                React.createElement("div", { style: { display: 'flex', gap: SPACE_SCALE[6], flexWrap: 'wrap' } },
                    React.createElement(InboxPill, { active: filter === 'all', onClick: () => setFilter('all'), count: 0 }, "All"),
                    React.createElement(InboxPill, { active: filter === 'unread', onClick: () => setFilter('unread'), count: filterCounts.unread }, "Unread"),
                    React.createElement(InboxPill, { active: filter === 'starred', onClick: () => setFilter('starred'), count: filterCounts.starred }, "Starred"),
                    React.createElement(InboxPill, { active: filter === 'archived', onClick: () => setFilter('archived'), count: filterCounts.archived }, "Archived")),
                filterCounts.unread > 0 && filter !== 'archived' && React.createElement("button", {
                    onClick: markAllRead,
                    style: { background: 'none', border: 'none', color: '#C89B3C', fontSize: TYPE_SCALE[12], cursor: 'pointer', fontWeight: 600 },
                }, "Mark all read"))),
        filtered.length === 0
            ? React.createElement("div", {
                style: { textAlign: 'center', padding: '48px 20px', color: '#5C5C64', fontSize: TYPE_SCALE[13.5], border: '1px dashed rgba(232,196,104,0.14)', borderRadius: RADIUS_SCALE[10], fontStyle: 'italic' },
            }, query.trim()
                ? "No correspondence matches your search."
                : filter === 'archived' ? "Nothing archived yet \u2014 letters you tuck away will rest here."
                    : filter === 'starred' ? "No starred items in this tab yet."
                        : filter === 'unread' ? "Nothing unread here \u2014 you're all caught up."
                            : cat.empty)
            : filtered.map((item, idx) => React.createElement(InboxLetterCard, {
                key: item.id, item, cat, index: idx,
                expanded: expandedId === item.id, cracking: crackingId === item.id,
                onOpen: openItem, onToggleStar: toggleStar, onArchive: archiveItem, onUnarchive: unarchiveItem,
            })));
}


// ---------- The Living Universe ----------
// A single, unbroken chronicle of everything happening across Inkroot: new releases, rank
// ascensions, reputation milestones, achievement unlocks, guild news, anthologies, world packs,
// trending books, featured authors, and reader activity.
//
// HONESTY NOTE (read before wiring this to anything real): Inkroot has no backend yet — this
// device is still the only writer and the only reader it knows about (see REPUTATION_SOURCES
// and the "Inkroot runs on one device" comment above). So for now this screen generates its own
// atmosphere client-side, reusing Inkroot's *real* vocabulary (WRITER_RANKS, REPUTATION_TITLES,
// GUILD_RANK_TIERS, FOUNDER_GUILDS, ACHIEVEMENTS) so it reads as this universe rather than a
// generic feed, and persists what it generates to this device's own storage (LU_FEED_KEY) so
// re-opening the tab doesn't reset it. It is explicitly labelled as a preview in its own footer.
// The moment there's a real backend, swap useLivingUniverseFeed's seed/ambient-write logic for a
// real fetch/subscribe and every component below keeps working unchanged — they only care about
// the entries array's shape ({ id, ts, seal, color, title, sub, tag, kind }).
export const LU_FEED_KEY = 'inkroot:livingUniverseFeed';


export const LU_AUTHORS = ['Elara Voss', 'Kael Thorne', 'Wren Ashbury', 'Marlowe Finch', 'Isolde Graye', 'Thane Ashford',
    'Briony Vale', 'Corin Blackwood', 'Seraphine Wilde', 'Dorian Marsh', 'Lyra Fenwick', 'Adric Stone',
    'Hollis Bramwell', 'Wynne Castellan', 'Osric Falk', 'Maren Loch', 'Tamsin Ridley', 'Callum Drake',
    'Ines Solari', 'Percival Rook', 'Sable Quinn', 'Rowan Ashcombe'];


export const LU_BOOK_TITLES = {
    fantasy: ['The Ember Crown', 'Salt and Starlight', 'The Last Warden of Thorn', 'A Ledger of Ash', 'The Nine-Petaled King', 'Wolves of the Long Winter'],
    romance: ['A Season for Second Chances', "The Cartographer's Heart", 'Letters to a Stranger in Rome', 'Somewhere Softer', 'The Vineyard Promise'],
    scifi: ['The Drift Between Stars', 'Signal from the Cradle', 'Ninety Days to Proxima', 'The Last Uploaded', 'Static in the Long Dark'],
    historical: ['The Weight of Silk', 'Daughters of the Iron Coast', 'The Cartwright Ledger', 'Ashes Over Avignon'],
    horror: ['What the Orchard Remembers', 'The Hollow Choir', 'Something in the Waterline', 'The House That Counts'],
    mystery: ['The Quiet Between Confessions', 'Ninth Street Vanishing', "The Locksmith's Widow"],
    comedy: ['My Year of Accidental Wizardry', 'The Etiquette of Dragons', 'Reasonably Cursed'],
    worldbuilders: ['Atlas of the Sundered Coast', 'The Bestiary of Hollow Vale', 'Chronicle of the Ember Reaches'],
    poetry: ['Small Weather', 'Everything I Meant to Burn', 'A Field Guide to Leaving'],
    general: ['The Unfinished Map', 'Ordinary Miracles', 'What We Carried Home'],
};


export const LU_GENRE_COLOR = { fantasy: '#B08D57', romance: '#C97B8B', scifi: '#7FB2C9', historical: '#A8916A',
    horror: '#8C7A93', mystery: '#7A8FA3', comedy: '#D4A63A', worldbuilders: '#A184D6', poetry: '#8FA37A', general: '#C7CCD6' };


export const LU_WORLD_PACKS = [
    { name: 'The Sundered Coast', tags: ['Region', 'Bestiary'] },
    { name: 'Embercrown Archive', tags: ['Magic System', 'Culture'] },
    { name: 'The Hollow Vale Bestiary', tags: ['Bestiary'] },
    { name: 'Ashreach Atlas', tags: ['Region', 'Cartography'] },
    { name: 'The Long Winter Courts', tags: ['Culture', 'Politics'] },
    { name: 'Saltmere & the Drowned Roads', tags: ['Region'] },
    { name: 'The Nine Provinces of Ver', tags: ['Cartography', 'Culture'] },
    { name: 'Thornfield Cartography Set', tags: ['Cartography'] },
];


export const LU_ANTHOLOGY_TITLES = ["Winter's Ledger, Vol. III", 'Tales from the Long Table', "The Founders' Reader: Autumn Edition", 'Nine Voices, One Hearth', 'The Guild Table, Volume II'];


export const LU_ACHIEVEMENT_POOL = ACHIEVEMENTS.filter((a) => ['legendary', 'epic', 'rare', 'uncommon'].includes(a.rarity) && !a.secret).slice(0, 30);


export function luPick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }


export function luTimeAgo(ts) {
    const s = Math.max(1, Math.floor((Date.now() - ts) / 1000));
    if (s < 60) return 'just now';
    const m = Math.floor(s / 60); if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60); if (h < 24) return `${h}h ago`;
    const d = Math.floor(h / 24); if (d < 7) return `${d}d ago`;
    return `${Math.floor(d / 7)}w ago`;
}


export const LU_KIND_WEIGHTS = [['release', 3], ['rank', 2], ['reputation', 2], ['achievement', 3], ['guild', 2], ['anthology', 1], ['worldpack', 1], ['reader', 3]];


export function luWeightedKind() {
    const total = LU_KIND_WEIGHTS.reduce((s, [, w]) => s + w, 0);
    let r = Math.random() * total;
    for (const [k, w] of LU_KIND_WEIGHTS) { if ((r -= w) <= 0) return k; }
    return 'release';
}


export function luMakeEntry(kind, ts) {
    const author = luPick(LU_AUTHORS);
    const guild = luPick(FOUNDER_GUILDS);
    const genre = guild.id;
    const bookPool = LU_BOOK_TITLES[genre] || LU_BOOK_TITLES.general;
    const book = luPick(bookPool);
    const base = { id: uuid(), ts: ts || Date.now(), kind };
    switch (kind) {
        case 'release':
            return { ...base, seal: '\uD83D\uDCD6', color: LU_GENRE_COLOR[genre] || '#B08D57',
                title: `${author} published “${book}”`, sub: `A ${guild.name.replace('The ', '').replace(' Guild', '')} novel`, tag: 'New Release', book, author, genre };
        case 'rank': {
            const r = luPick(WRITER_RANKS.slice(1));
            return { ...base, seal: r.icon, color: r.color, title: `${author} has ascended to ${r.icon} ${r.name}`, sub: 'Writer Rank promotion', tag: 'Rank Ascension' };
        }
        case 'reputation': {
            const t = luPick(REPUTATION_TITLES.slice(1));
            return { ...base, seal: t.icon, color: t.color, title: `${author}\u2019s legacy has grown to ${t.icon} ${t.name}`, sub: 'Reputation milestone', tag: 'Reputation' };
        }
        case 'achievement': {
            const a = luPick(LU_ACHIEVEMENT_POOL.length ? LU_ACHIEVEMENT_POOL : ACHIEVEMENTS);
            const meta = RARITY_META[a.rarity] || RARITY_META.common;
            return { ...base, seal: a.icon, color: meta.color, title: `${author} unlocked \u201C${a.title}\u201D`, sub: `${meta.label} achievement`, tag: 'Achievement' };
        }
        case 'guild': {
            const templates = [
                `${guild.name} welcomed a new wave of scribes this season.`,
                `${guild.name}'s Hall reached ${luPick(GUILD_RANK_TIERS).name} standing.`,
                `${guild.name} raised its banner: "${guild.motto}"`,
            ];
            return { ...base, seal: guild.icon, color: '#C89B3C', title: luPick(templates), sub: 'Guild announcement', tag: 'Guild Hall' };
        }
        case 'anthology': {
            const at = luPick(LU_ANTHOLOGY_TITLES);
            const templates = [`${guild.name} released its seasonal anthology, \u201C${at}\u201D.`, `${guild.name}'s anthology submissions are now open for the season.`];
            return { ...base, seal: '\uD83D\uDCDC', color: '#E8C468', title: luPick(templates), sub: 'Anthology', tag: 'Anthology' };
        }
        case 'worldpack': {
            const p = luPick(LU_WORLD_PACKS);
            return { ...base, seal: '\uD83C\uDF0D', color: '#A184D6', title: `The ${p.name} pack entered the Atlas`, sub: p.tags.join(' \u00B7 '), tag: 'World Pack', pack: p };
        }
        case 'reader': {
            const templates = [`A reader turned the final page of \u201C${book}\u201D.`, `\u201C${book}\u201D was added to a new shelf.`, `\u201C${book}\u201D found new readers across the guild halls.`];
            return { ...base, seal: '\uD83D\uDD6F\uFE0F', color: '#7FB2C9', title: luPick(templates), sub: 'Reader activity', tag: 'Reader' };
        }
        default: return null;
    }
}


export function luSeedFeed() {
    const now = Date.now();
    const entries = [];
    for (let i = 0; i < 30; i++) {
        const back = Math.floor(Math.random() * 1000 * 60 * 60 * 24 * 6);
        entries.push(luMakeEntry(luWeightedKind(), now - back));
    }
    return entries.sort((a, b) => b.ts - a.ts);
}


// Local-only for now (see honesty note above): seeds once from this device's storage, then inks a
// new entry on an interval and persists the running list back to the same key. No cross-device
// merge — there's nowhere for that to come from yet.
export function useLivingUniverseFeed() {
    const [entries, setEntries] = useState(null);
    const persist = React.useCallback(async (next) => {
        try { await storage.set(LU_FEED_KEY, JSON.stringify(next.slice(0, 120))); } catch (e) { /* best-effort */ }
    }, []);
    useEffect(() => {
        let cancelled = false;
        (async () => {
            let seeded = null;
            try {
                const res = await storage.get(LU_FEED_KEY);
                if (res && res.value) seeded = JSON.parse(res.value);
            } catch (e) { /* nothing stored yet */ }
            if (!seeded || !seeded.length) seeded = luSeedFeed();
            if (!cancelled) { setEntries(seeded); persist(seeded); }
        })();
        return () => { cancelled = true; };
    }, [persist]);
    useEffect(() => {
        const interval = setInterval(() => {
            setEntries((prev) => {
                if (!prev) return prev;
                const next = [luMakeEntry(luWeightedKind(), Date.now()), ...prev].slice(0, 120);
                persist(next);
                return next;
            });
        }, 16000 + Math.random() * 14000);
        return () => clearInterval(interval);
    }, [persist]);
    return entries;
}


export function useLuTrending() {
    const seedRef = useRef(null);
    if (!seedRef.current) {
        seedRef.current = Array.from({ length: 8 }).map(() => {
            const guild = luPick(FOUNDER_GUILDS);
            const genre = guild.id;
            return { id: uuid(), title: luPick(LU_BOOK_TITLES[genre] || LU_BOOK_TITLES.general), author: luPick(LU_AUTHORS), genreLabel: guild.name.replace('The ', '').replace(' Guild', ''), score: 50 + Math.random() * 50 };
        });
    }
    const [list, setList] = useState(seedRef.current);
    useEffect(() => {
        const interval = setInterval(() => {
            setList((prev) => [...prev].map((b) => ({ ...b, score: Math.max(5, b.score + (Math.random() - 0.48) * 9) })).sort((a, b) => b.score - a.score));
        }, 7000);
        return () => clearInterval(interval);
    }, []);
    return list.slice(0, 5);
}


export function LuSectionHeader({ eyebrow, title, sub, color }) {
    return React.createElement(React.Fragment, null,
        React.createElement("div", { className: "lu-eyebrow", style: { '--lu-eyebrow-color': color } },
            React.createElement("span", { className: "lu-tag" }, `\u00A7 ${eyebrow}`),
            React.createElement("span", { className: "lu-rule" })),
        React.createElement("h2", { className: "lu-title" }, title),
        sub && React.createElement("p", { className: "lu-sub" }, sub));
}
