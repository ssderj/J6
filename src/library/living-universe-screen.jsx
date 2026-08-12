import React, { useState, useRef, useMemo } from 'react';
import { FOUNDER_GUILDS } from '../guild/guild-hall.jsx';
import { LU_AUTHORS, LU_BOOK_TITLES, LU_WORLD_PACKS, LuSectionHeader, luPick, luTimeAgo, useLivingUniverseFeed, useLuTrending } from './inbox-and-living-universe.jsx';
import { uuid } from '../shared-utils/storage-keys.jsx';
import { RADIUS_SCALE, SPACE_SCALE, TYPE_SCALE } from '../shell/nav-context.jsx';
import { WRITER_RANKS } from '../writing/health-checks.jsx';


export function LivingUniverseScreen() {
    const entries = useLivingUniverseFeed();
    const trending = useLuTrending();
    const [visibleCount, setVisibleCount] = useState(10);
    const lastSeenIds = useRef(new Set());

    const weekNumber = Math.floor(Date.now() / (1000 * 60 * 60 * 24 * 7));
    const spotlight = React.useMemo(() => {
        const author = LU_AUTHORS[weekNumber % LU_AUTHORS.length];
        const guild = FOUNDER_GUILDS[weekNumber % FOUNDER_GUILDS.length];
        const bookPool = LU_BOOK_TITLES[guild.id] || LU_BOOK_TITLES.general;
        const book = bookPool[weekNumber % bookPool.length];
        return { author, guild, book };
    }, [weekNumber]);
    const featuredAuthors = React.useMemo(() => {
        return [...LU_AUTHORS].sort(() => Math.random() - 0.5).slice(0, 6).map((name) => {
            const rank = luPick(WRITER_RANKS.slice(1));
            const guild = luPick(FOUNDER_GUILDS);
            const bookPool = LU_BOOK_TITLES[guild.id] || LU_BOOK_TITLES.general;
            return { name, rank, blurb: `Known for \u201C${luPick(bookPool)}\u201D` };
        });
    }, []);

    if (!entries) {
        return React.createElement("div", { style: { textAlign: 'center', padding: '64px 12px', fontSize: TYPE_SCALE[12.5], color: '#5C5C64' } }, "Opening the Chronicle\u2026");
    }
    const newIds = new Set();
    entries.forEach((e) => { if (!lastSeenIds.current.has(e.id) && Date.now() - e.ts < 20000) newIds.add(e.id); });
    entries.forEach((e) => lastSeenIds.current.add(e.id));

    const releases = entries.filter((e) => e.kind === 'release').slice(0, 8);
    const worldPackEntries = entries.filter((e) => e.kind === 'worldpack');
    const worldPacks = (worldPackEntries.length ? worldPackEntries : LU_WORLD_PACKS.slice(0, 6).map((p) => ({ id: uuid(), pack: p }))).slice(0, 6);
    const guildEvents = entries.filter((e) => e.kind === 'guild' || e.kind === 'anthology').slice(0, 4);
    const readerEvents = entries.filter((e) => e.kind === 'reader').slice(0, 6);
    const publishedToday = entries.filter((e) => e.kind === 'release' && Date.now() - e.ts < 1000 * 60 * 60 * 24).length;

    return React.createElement("div", { className: "ink-page-in" },
        React.createElement("style", null, `
            .lu-eyebrow{display:flex;align-items:center;gap: 12px;margin:0 0 14px;}
            .lu-tag{display:flex;align-items:center;gap: 8px;font-size:10.5px;letter-spacing:0.14em;text-transform:uppercase;color:var(--lu-eyebrow-color,#E8C468);white-space:nowrap;}
            .lu-rule{flex:1;height:1px;background:linear-gradient(90deg,#2A2A30,transparent);}
            .lu-title{font-family:'Fraunces',Georgia,serif;font-size:19px;font-weight:600;margin:0 0 4px;color:#EFE7D2;}
            .lu-sub{color:#8A8680;font-size:12px;margin:0 0 18px;line-height:1.5;}
            .lu-section{margin-bottom:44px;}
            .lu-chronicle{position:relative;padding-left:30px;}
            .lu-chronicle::before{content:'';position:absolute;left:8px;top:4px;bottom:4px;width:1px;background:linear-gradient(to bottom, rgba(232,196,104,0.45), #2A2A30 12%, #2A2A30 88%, transparent);}
            .lu-entry{position:relative;padding-bottom:20px;}
            .lu-entry:last-child{padding-bottom:0;}
            .lu-entry-seal{position:absolute;left:-30px;top:0px;width:18px;height:18px;border-radius:50%;border:1.5px solid var(--lu-seal-color,#B08D57);background:#17140F;display:flex;align-items:center;justify-content:center;font-size:9.5px;box-shadow:0 0 0 4px #17171B;}
            .lu-entry-title{font-family:'Fraunces',Georgia,serif;font-size:14px;color:#EFE7D2;line-height:1.5;}
            .lu-entry-time{font-size:10px;color:#5C5C64;white-space:nowrap;margin-left:8px;}
            .lu-entry-sub{font-size:11.5px;color:#7A7A82;margin-top:2px;}
            @keyframes luInkIn{0%{opacity:0;transform:translateY(-6px);}100%{opacity:1;transform:translateY(0);}}
            .lu-entry-new{animation:luInkIn 700ms var(--ink-ease);}
            .lu-shelf{display:flex;gap: 12px;overflow-x:auto;padding:2px 2px 10px;-webkit-overflow-scrolling:touch;}
            .lu-book{flex:0 0 128px;}
            .lu-book-cover{width:128px;height:180px;border-radius:6px;position:relative;overflow:hidden;display:flex;align-items:flex-end;padding:11px;box-shadow:0 8px 18px rgba(0,0,0,0.45);}
            .lu-book-cover::after{content:'';position:absolute;inset:0;background:linear-gradient(180deg,rgba(0,0,0,0) 30%,rgba(0,0,0,0.65) 100%);}
            .lu-book-title{position:relative;font-family:'Fraunces',Georgia,serif;font-style:italic;font-weight:600;font-size:12px;line-height:1.28;color:#F4EEDD;z-index:1;}
            .lu-book-meta{margin-top:7px;font-size:10.5px;color:#7A7A82;}
            .lu-trend-row{display:flex;align-items:center;gap: 12px;padding:11px 2px;border-bottom:1px solid #2A2A30;}
            .lu-trend-rank{width:20px;font-family:'Fraunces',Georgia,serif;font-style:italic;font-size:15px;color:#5C5C64;flex-shrink:0;text-align:center;}
            .lu-trend-title{font-family:'Fraunces',Georgia,serif;font-style:italic;font-size:13.5px;color:#EFE7D2;}
            .lu-trend-author{font-size:11px;color:#7A7A82;margin-top:1px;}
            .lu-trend-move{font-size:11px;flex-shrink:0;}
            .lu-pack{flex:0 0 178px;border:1px solid #2A2A30;border-radius:10px;padding:16px;background:#1D1D22;}
            .lu-pack h4{font-family:'Fraunces',Georgia,serif;font-size:13.5px;margin:0 0 5px;color:#EFE7D2;}
            .lu-pack p{font-size:11px;color:#7A7A82;margin:0;line-height:1.5;}
            .lu-pack-tags{margin-top:9px;display:flex;gap: 6px;flex-wrap:wrap;}
            .lu-pack-tag{font-size:9px;color:#A184D6;border:1px solid rgba(161,132,214,0.3);padding:2px 6px;border-radius:100px;}
            .lu-guild-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap: 10px;}
            .lu-guild-card{border:1px solid #2A2A30;border-radius:10px;padding:16px;background:#1D1D22;}
            .lu-guild-head{display:flex;align-items:center;gap: 10px;margin-bottom:8px;}
            .lu-guild-icon{width:28px;height:28px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:13px;background:rgba(232,196,104,0.1);border:1px solid rgba(232,196,104,0.28);flex-shrink:0;}
            .lu-guild-name{font-family:'Fraunces',Georgia,serif;font-size:13px;color:#EFE7D2;}
            .lu-guild-card p{font-size:11.5px;color:#8A8680;margin:0;line-height:1.5;}
            .lu-guild-time{margin-top:8px;font-size:9.5px;color:#5C5C64;}
            .lu-author{flex:0 0 152px;text-align:center;padding:18px 12px;border:1px solid #2A2A30;border-radius:12px;background:#1D1D22;}
            .lu-author-avatar{width:46px;height:46px;border-radius:50%;margin:0 auto 10px;display:flex;align-items:center;justify-content:center;font-family:'Fraunces',Georgia,serif;font-size:16px;font-weight:600;background:#17140F;}
            .lu-author h4{font-family:'Fraunces',Georgia,serif;font-style:italic;font-size:13px;margin:0 0 3px;color:#EFE7D2;}
            .lu-author .lu-a-rank{font-size:10px;margin-bottom:6px;}
            .lu-author .lu-a-blurb{font-size:10.5px;color:#7A7A82;line-height:1.4;}
            .lu-reader-row{display:flex;align-items:center;gap: 10px;padding:9px 0;border-bottom:1px solid #2A2A30;}
            .lu-reader-row:last-child{border-bottom:none;}
            .lu-reader-dot{width:5px;height:5px;border-radius:50%;background:#7FB2C9;flex-shrink:0;}
            .lu-reader-text{font-size:12px;color:#8A8680;}
            .lu-reader-time{margin-left:auto;font-size:9.5px;color:#5C5C64;flex-shrink:0;}
        `),
        React.createElement("div", { style: { textAlign: 'center', marginBottom: 30 } },
            React.createElement("div", { style: { fontSize: TYPE_SCALE[10.5], letterSpacing: '0.18em', textTransform: 'uppercase', color: '#5C5C64', marginBottom: 12 } }, "Preview \u00B7 device-local"),
            React.createElement("h1", { style: { fontFamily: "'Fraunces', Georgia, serif", fontStyle: 'italic', fontWeight: 600, fontSize: TYPE_SCALE[32], margin: '0 0 12px', color: '#EFE7D2' } }, "The Living Universe"),
            React.createElement("p", { style: { maxWidth: 440, margin: '0 auto', color: '#8A8680', fontSize: TYPE_SCALE[13.5], lineHeight: 1.6 } },
                "Every book, rank, and milestone across Inkroot \u2014 gathered as one continuous chronicle."),
            React.createElement("div", { style: { display: 'flex', justifyContent: 'center', gap: SPACE_SCALE[22], marginTop: 24, flexWrap: 'wrap' } },
                React.createElement("div", { style: { textAlign: 'center' } },
                    React.createElement("div", { style: { fontFamily: "'Fraunces', Georgia, serif", fontSize: TYPE_SCALE[20], fontWeight: 600, color: '#E8C468' } }, publishedToday),
                    React.createElement("div", { style: { fontSize: TYPE_SCALE[9.5], color: '#5C5C64', textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: 2 } }, "Published today")),
                React.createElement("div", { style: { textAlign: 'center' } },
                    React.createElement("div", { style: { fontFamily: "'Fraunces', Georgia, serif", fontSize: TYPE_SCALE[20], fontWeight: 600, color: '#E8C468' } }, FOUNDER_GUILDS.length),
                    React.createElement("div", { style: { fontSize: TYPE_SCALE[9.5], color: '#5C5C64', textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: 2 } }, "Guild halls")),
                React.createElement("div", { style: { textAlign: 'center' } },
                    React.createElement("div", { style: { fontFamily: "'Fraunces', Georgia, serif", fontSize: TYPE_SCALE[20], fontWeight: 600, color: '#E8C468' } }, entries.length),
                    React.createElement("div", { style: { fontSize: TYPE_SCALE[9.5], color: '#5C5C64', textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: 2 } }, "Chronicle entries")))),

        React.createElement("div", { className: "lu-section", style: {
                position: 'relative', borderRadius: RADIUS_SCALE[14], border: '1px solid rgba(232,196,104,0.32)',
                background: 'linear-gradient(160deg, #211D14 0%, #1A171F 100%)', padding: '24px 22px',
                display: 'flex', gap: SPACE_SCALE[18], alignItems: 'center', boxShadow: '0 0 26px 2px rgba(232,196,104,0.14)',
            } },
            React.createElement("div", { style: {
                    flexShrink: 0, width: 58, height: 58, borderRadius: '50%', border: '2px solid #E8C468',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: TYPE_SCALE[24],
                    background: 'radial-gradient(circle at 34% 28%, rgba(232,196,104,0.4), #17140F 72%)',
                } }, spotlight.guild.icon),
            React.createElement("div", null,
                React.createElement("div", { style: { fontSize: TYPE_SCALE[10], letterSpacing: '0.16em', textTransform: 'uppercase', color: '#E8C468', marginBottom: 6 } }, "Weekly Spotlight"),
                React.createElement("div", { style: { fontFamily: "'Fraunces', Georgia, serif", fontStyle: 'italic', fontWeight: 600, fontSize: TYPE_SCALE[18], color: '#EFE7D2', marginBottom: 4 } }, spotlight.author),
                React.createElement("div", { style: { fontSize: TYPE_SCALE[12.5], color: '#8A8680', lineHeight: 1.55 } },
                    `Author of \u201C${spotlight.book}\u201D, chosen this week from ${spotlight.guild.name}.`))),

        React.createElement("div", { className: "lu-section" },
            React.createElement(LuSectionHeader, { eyebrow: "The Chronicle", title: "Written as it happens", color: '#E8C468',
                sub: "Rank ascensions, milestones, achievements, guild news, and new pages, in the order they were written." }),
            React.createElement("div", { className: "lu-chronicle" },
                entries.slice(0, visibleCount).map((e) => React.createElement("div", {
                    key: e.id, className: `lu-entry ${newIds.has(e.id) ? 'lu-entry-new' : ''}`, style: { '--lu-seal-color': e.color },
                },
                    React.createElement("div", { className: "lu-entry-seal" }, e.seal),
                    React.createElement("div", { style: { display: 'flex', alignItems: 'baseline', flexWrap: 'wrap' } },
                        React.createElement("div", { className: "lu-entry-title" }, e.title),
                        React.createElement("div", { className: "lu-entry-time" }, luTimeAgo(e.ts))),
                    e.sub && React.createElement("div", { className: "lu-entry-sub" }, e.sub)))),
            visibleCount < entries.length && React.createElement("button", {
                onClick: () => setVisibleCount((v) => v + 10),
                style: { marginTop: 4, background: 'none', border: '1px solid #2A2A30', color: '#8A8680', fontSize: TYPE_SCALE[12], padding: '8px 14px', borderRadius: RADIUS_SCALE[100], cursor: 'pointer' },
            }, "Read further back")),

        React.createElement("div", { className: "lu-section" },
            React.createElement(LuSectionHeader, { eyebrow: "New Releases", title: "Fresh off the press", color: '#B08D57', sub: "Newly published books, newest first." }),
            React.createElement("div", { className: "lu-shelf" },
                releases.map((e) => React.createElement("div", { className: "lu-book", key: e.id },
                    React.createElement("div", { className: "lu-book-cover", style: { background: `linear-gradient(155deg, ${e.color}55, #17151B 70%)` } },
                        React.createElement("div", { className: "lu-book-title" }, e.book)),
                    React.createElement("div", { className: "lu-book-meta" }, e.author))))),

        React.createElement("div", { className: "lu-section" },
            React.createElement(LuSectionHeader, { eyebrow: "Trending Now", title: "What readers are turning to", color: '#8FA37A', sub: "Momentum across the guild halls." }),
            trending.map((b, i) => React.createElement("div", { className: "lu-trend-row", key: b.id },
                React.createElement("div", { className: "lu-trend-rank" }, i + 1),
                React.createElement("div", { style: { flex: 1, minWidth: 0 } },
                    React.createElement("div", { className: "lu-trend-title" }, b.title),
                    React.createElement("div", { className: "lu-trend-author" }, `${b.author} \u00B7 ${b.genreLabel}`)),
                React.createElement("div", { className: "lu-trend-move", style: { color: i < 2 ? '#8FA37A' : i > 3 ? '#B8735C' : '#5C5C64' } },
                    `${i < 2 ? '\u25B2' : i > 3 ? '\u25BC' : '\u2014'} ${Math.round(b.score)}`)))),

        React.createElement("div", { className: "lu-section" },
            React.createElement(LuSectionHeader, { eyebrow: "New World Packs", title: "The Atlas keeps growing", color: '#A184D6', sub: "Newly entered regions, bestiaries, and magic systems." }),
            React.createElement("div", { className: "lu-shelf" },
                worldPacks.map((w) => {
                    const p = w.pack || luPick(LU_WORLD_PACKS);
                    return React.createElement("div", { className: "lu-pack", key: w.id },
                        React.createElement("h4", null, p.name),
                        React.createElement("p", null, "Newly catalogued in the Atlas."),
                        React.createElement("div", { className: "lu-pack-tags" }, p.tags.map((t) => React.createElement("span", { className: "lu-pack-tag", key: t }, t))));
                }))),

        React.createElement("div", { className: "lu-section" },
            React.createElement(LuSectionHeader, { eyebrow: "Guild Halls & Anthologies", title: "News from the halls", color: '#C89B3C', sub: "Announcements and anthology releases from every Founder Guild." }),
            React.createElement("div", { className: "lu-guild-grid" },
                (guildEvents.length ? guildEvents : FOUNDER_GUILDS.slice(0, 4).map((g) => ({ id: uuid(), seal: g.icon, title: g.motto, ts: Date.now(), tag: g.name }))).map((e) =>
                    React.createElement("div", { className: "lu-guild-card", key: e.id },
                        React.createElement("div", { className: "lu-guild-head" },
                            React.createElement("div", { className: "lu-guild-icon" }, e.seal),
                            React.createElement("div", { className: "lu-guild-name" }, e.tag || 'Guild Hall')),
                        React.createElement("p", null, e.title),
                        React.createElement("div", { className: "lu-guild-time" }, luTimeAgo(e.ts)))))),

        React.createElement("div", { className: "lu-section" },
            React.createElement(LuSectionHeader, { eyebrow: "Featured Authors", title: "Voices worth following", color: '#E8C468' }),
            React.createElement("div", { className: "lu-shelf" },
                featuredAuthors.map((a) => React.createElement("div", { className: "lu-author", key: a.name },
                    React.createElement("div", { className: "lu-author-avatar", style: { border: `1.5px solid ${a.rank.color}` } }, a.name.split(' ').map((n) => n[0]).join('')),
                    React.createElement("h4", null, a.name),
                    React.createElement("div", { className: "lu-a-rank", style: { color: a.rank.color } }, `${a.rank.icon} ${a.rank.name}`),
                    React.createElement("div", { className: "lu-a-blurb" }, a.blurb))))),

        React.createElement("div", { className: "lu-section", style: { marginBottom: 8 } },
            React.createElement(LuSectionHeader, { eyebrow: "Reader Activity", title: "The quiet side of the ledger", color: '#7FB2C9' }),
            (readerEvents.length ? readerEvents : entries.slice(0, 5)).map((e) => React.createElement("div", { className: "lu-reader-row", key: e.id },
                React.createElement("div", { className: "lu-reader-dot" }),
                React.createElement("div", { className: "lu-reader-text" }, e.title),
                React.createElement("div", { className: "lu-reader-time" }, luTimeAgo(e.ts))))),

        React.createElement("div", { style: { textAlign: 'center', padding: '24px 12px 4px', color: '#5C5C64', fontSize: TYPE_SCALE[11], lineHeight: 1.7 } },
            "This chronicle is generated on this device as a preview \u2014 Inkroot doesn't have a shared backend yet, so it isn't drawing from other real writers. Once Inkroot has one, this page is built to plug straight into it."));
}
