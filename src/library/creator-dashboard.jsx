import React, { useState, useEffect } from 'react';
import { fetchFollowers } from '../lib/library.js';
import { AuthorStudioPackCard, CreatorBookCard, CreatorComingSoonPanel, CreatorDashboardHeader, CreatorDashboardStyles, CreatorOverviewRow, CreatorRatingsPanel, CreatorTabBar } from './grand-library-cards.jsx';
import { resolvePublishStatus } from './publishing.jsx';
import { EmptyState } from '../shared-ui/ui-cards.jsx';
import { InkIcon } from '../shell/ink-icon.jsx';
import { RADIUS_SCALE, SPACE_SCALE, TYPE_SCALE } from '../shell/nav-context.jsx';


// Real followers — the honest slice of "who's reading your work" this phase can deliver (see
// the comment in library.js's fetchFollowers). Page-view/traffic-source tracking isn't part of
// this phase; the description below says so rather than implying it's covered.
export function CreatorReadersPanel() {
    const [state, setState] = useState({ loading: true, error: null, followers: [] });
    useEffect(() => {
        let cancelled = false;
        fetchFollowers()
            .then((followers) => { if (!cancelled) setState({ loading: false, error: null, followers }); })
            .catch((e) => { if (!cancelled) setState({ loading: false, error: e, followers: [] }); });
        return () => { cancelled = true; };
    }, []);
    if (state.loading) {
        return React.createElement("div", { style: { textAlign: 'center', padding: '30px 0', color: '#7A7A82', fontSize: TYPE_SCALE[12] } }, "Loading followers\u2026");
    }
    return React.createElement(React.Fragment, null,
        React.createElement("div", { style: { fontSize: TYPE_SCALE[11.5], color: '#5C5C64', textAlign: 'center', marginBottom: 16, fontStyle: 'italic' } },
            "Real followers \u2014 traffic sources and page-view analytics aren't tracked yet"),
        state.error && React.createElement("div", { style: { textAlign: 'center', padding: '20px 0', color: '#D98A8A', fontSize: TYPE_SCALE[12] } }, "Couldn't load followers right now \u2014 check your connection and try again."),
        !state.error && state.followers.length === 0 && React.createElement("div", { style: { textAlign: 'center', padding: '30px 0', color: '#7A7A82', fontSize: TYPE_SCALE[12] } }, "No followers yet \u2014 once other readers follow you, they'll show up here."),
        !state.error && state.followers.length > 0 && React.createElement("div", { style: { display: 'grid', gap: SPACE_SCALE[8] } },
            state.followers.map((f) => React.createElement("div", {
                key: f.follower_id, style: {
                    display: 'flex', justifyContent: 'space-between', padding: '10px 14px',
                    borderRadius: RADIUS_SCALE[10], background: '#1D1D22', border: '1px solid #2A2417',
                    fontSize: TYPE_SCALE[12], color: '#D9D2BE',
                },
            }, `Reader ${f.follower_id.slice(0, 8)}`, React.createElement("span", { style: { color: '#5C5C64' } }, new Date(f.created_at).toLocaleDateString())))));
}


export function CreatorDashboard({ projects, writerProfile, writerRank, writerLevel, writerReputation, writerGuildName, onOpen, onRead, onSetPublishStatus, onOpenPacks, onSetPackPublishStatus, onOpenPublishWizard }) {
    const [tab, setTab] = useState('books');
    const projectsWithPacks = projects.filter((p) => (p.worldbuildingPacks || []).length > 0);
    const publishedBooksCount = projects.filter((p) => resolvePublishStatus(p) !== 'none').length;
    const publishedPacksCount = projects.reduce((sum, p) => sum + (p.worldbuildingPacks || []).filter((pk) => pk.publishStatus && pk.publishStatus !== 'none').length, 0);
    const publishedWorksCount = publishedBooksCount + publishedPacksCount;
    let body = null;
    if (projects.length === 0) {
        body = React.createElement(EmptyState, { text: "No projects yet \u2014 start one from Home, then come back here to publish it." });
    }
    else if (tab === 'books') {
        body = React.createElement(React.Fragment, null,
            React.createElement("div", { style: { fontSize: TYPE_SCALE[11.5], color: '#5C5C64', textAlign: 'center', marginBottom: 16, fontStyle: 'italic' } }, "Publish a project and set its marketplace listing \u2014 both live here, together"),
            React.createElement("div", { className: "ink-grid-cards" },
                [...projects].sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0)).map((p) => React.createElement(CreatorBookCard, {
                    key: p.id, project: p, writerGuildName, onSetPublishStatus, onOpenPublishWizard, onOpen, onRead,
                }))));
    }
    else if (tab === 'packs') {
        body = projectsWithPacks.length === 0
            ? React.createElement("div", { style: { fontSize: TYPE_SCALE[11.5], color: '#5C5C64', fontStyle: 'italic', padding: '6px 2px', textAlign: 'center' } }, "No packs yet \u2014 open a project's Publishing \u2192 Worldbuilding Packs tab to create one.")
            : React.createElement("div", { className: "ink-grid-cards" },
                projectsWithPacks.flatMap((p) => (p.worldbuildingPacks || []).map((pack) => React.createElement(AuthorStudioPackCard, {
                    key: `${p.id}:${pack.id}`, projectId: p.id, projectTitle: p.title, pack, onOpen: onOpenPacks, onUnpublish: onSetPackPublishStatus, onOpenPublishWizard,
                }))));
    }
    else if (tab === 'templates') {
        body = React.createElement(CreatorComingSoonPanel, { icon: React.createElement(InkIcon, { name: "puzzle", size: 28, style: { display: "inline-block" } }), label: "Templates", description: "Sell or share reusable book and Worldbuilding Pack templates with other writers." });
    }
    else if (tab === 'addons') {
        body = React.createElement(CreatorComingSoonPanel, { icon: React.createElement(InkIcon, { name: "sparkle", size: 28, style: { display: "inline-block" } }), label: "Add-ons", description: "Sell covers, chapter dividers, and other flourishes readers can add to a listing." });
    }
    else if (tab === 'analytics') {
        body = React.createElement(CreatorComingSoonPanel, { icon: React.createElement(InkIcon, { name: "chart", size: 28, style: { display: "inline-block" } }), label: "Analytics", description: "Reader activity, traffic sources, and trends across every published work." });
    }
    else if (tab === 'earnings') {
        body = React.createElement(CreatorComingSoonPanel, { icon: React.createElement(InkIcon, { name: "coin", size: 28, style: { display: "inline-block" } }), label: "Earnings", description: "A full ledger of sales and royalties. Inkroot has no payment processor yet, so pricing today is a listing shown to readers, not something that can actually be charged." });
    }
    else if (tab === 'withdrawals') {
        body = React.createElement(CreatorComingSoonPanel, { icon: React.createElement(InkIcon, { name: "cash", size: 28, style: { display: "inline-block" } }), label: "Withdrawals", description: "Cash out your earnings to a bank account or payment provider, once real payments exist." });
    }
    else if (tab === 'ratings') {
        body = React.createElement(CreatorRatingsPanel, { projects });
    }
    else if (tab === 'readers') {
        body = React.createElement(CreatorReadersPanel, null);
    }
    return React.createElement("div", { className: "ink-page-in" },
        React.createElement(CreatorDashboardStyles, null),
        React.createElement(CreatorDashboardHeader, { profile: writerProfile, rank: writerRank, level: writerLevel, reputation: writerReputation }),
        React.createElement(CreatorOverviewRow, { publishedWorksCount }),
        React.createElement(CreatorTabBar, { activeTab: tab, onSelect: setTab }),
        body);
}
