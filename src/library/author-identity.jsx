import React from 'react';
import { IdentityPlaque } from '../guild/guild-hall.jsx';
import { reputationTitleFor } from './author-reputation.jsx';
import { ArchiveDivider } from '../shared-ui/ui-cards.jsx';
import { RADIUS_SCALE, SPACE_SCALE, TYPE_SCALE } from '../shell/nav-context.jsx';
import { WRITER_LEVEL_MAX } from '../writing/health-checks.jsx';


// The Writer Identity Card: the premium centerpiece at the top of the Author's Hall — meant to
// read like a carved identity plate kept in a respected medieval author's personal chamber, not a
// form. Holds every piece of who-this-writer-is (avatar, name, pen name, motto) plus the four
// lifetime measures (Rank, Level, Lifetime XP, Reputation) as a row of engraved plaques beneath it.
export function WriterIdentityCard({ profile, fileInputRef, handleAvatarFile, avatarError, onSaveProfile, writer, joinDateLabel, reputation }) {
    const repTitle = reputationTitleFor(reputation);
    return React.createElement("div", {
        style: {
            textAlign: 'center', padding: '34px 26px 24px', borderRadius: RADIUS_SCALE[16], marginBottom: 30,
            background: 'radial-gradient(ellipse at 50% 0%, rgba(200,155,60,0.14), transparent 65%), linear-gradient(160deg, #211C13, #17130E)',
            border: '1px solid #4A3D22', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.05), 0 10px 30px rgba(0,0,0,0.35)',
        },
    },
        React.createElement("div", { onClick: () => fileInputRef.current && fileInputRef.current.click(), style: {
                width: 108, height: 108, borderRadius: '50%', margin: '0 auto 16px', cursor: 'pointer', position: 'relative',
                background: profile.avatar ? `center/cover url(${profile.avatar})` : 'radial-gradient(circle at 34% 28%, #2A2620, #17140F 72%)',
                border: '3px solid #C89B3C', boxShadow: '0 0 0 3px #100E0A, 0 0 28px rgba(200,155,60,0.32), 0 4px 16px rgba(0,0,0,0.5)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
            } },
            !profile.avatar && React.createElement("span", { style: { fontSize: TYPE_SCALE[38], opacity: 0.5 } }, "\uD83E\uDDD1\u200D\uD83C\uDF93"),
            React.createElement("span", { style: {
                    position: 'absolute', bottom: -2, right: -2, width: 30, height: 30, borderRadius: '50%',
                    background: '#C89B3C', border: '2px solid #17140F', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: TYPE_SCALE[13],
                } }, "\u270E")),
        React.createElement("input", { ref: fileInputRef, type: "file", accept: "image/*", onChange: handleAvatarFile, style: { display: 'none' } }),
        avatarError && React.createElement("div", { style: { fontSize: TYPE_SCALE[11.5], color: '#D97757', marginBottom: 10 } }, avatarError),
        React.createElement("input", { value: profile.name, onChange: (e) => onSaveProfile({ name: e.target.value }), placeholder: "Your name", style: {
                display: 'block', margin: '0 auto', textAlign: 'center', background: 'none', border: 'none', outline: 'none',
                fontFamily: "'Fraunces', Georgia, serif", fontSize: TYPE_SCALE[22], fontWeight: 600, color: '#EFE7D2', width: '100%', maxWidth: 280,
            } }),
        React.createElement("input", { value: profile.penName, onChange: (e) => onSaveProfile({ penName: e.target.value }), placeholder: "Pen name (optional)", style: {
                display: 'block', margin: '4px auto 0', textAlign: 'center', background: 'none', border: 'none', outline: 'none',
                fontFamily: "'Fraunces', Georgia, serif", fontStyle: 'italic', fontSize: TYPE_SCALE[14], color: '#A6A6AD', width: '100%', maxWidth: 280,
            } }),
        React.createElement("div", { style: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: SPACE_SCALE[6], marginTop: 10, maxWidth: 340, marginLeft: 'auto', marginRight: 'auto' } },
            React.createElement("span", { style: { fontSize: TYPE_SCALE[12], color: '#4A4A52' } }, "\u201C"),
            React.createElement("input", { value: profile.motto || '', onChange: (e) => onSaveProfile({ motto: e.target.value }), placeholder: "A motto or words to write by\u2026", style: {
                    flex: 1, minWidth: 0, background: 'none', border: 'none', outline: 'none', textAlign: 'center',
                    fontFamily: "'Fraunces', Georgia, serif", fontStyle: 'italic', fontSize: TYPE_SCALE[12.5], color: '#C9BE8D',
                } }),
            React.createElement("span", { style: { fontSize: TYPE_SCALE[12], color: '#4A4A52' } }, "\u201D")),
        React.createElement(ArchiveDivider, { maxWidth: 300, margin: '22px auto 18px', fontSize: TYPE_SCALE[11], color: '#4A3D22', opacity: 1 }),
        React.createElement("div", { style: { display: 'flex', alignItems: 'stretch' } },
            React.createElement(IdentityPlaque, { icon: writer.rank.icon, label: "Rank", value: writer.rank.name, valueColor: writer.rank.color }),
            React.createElement("div", { style: { width: 1, background: '#2E2818', margin: '2px 0' } }),
            React.createElement(IdentityPlaque, { icon: "\uD83C\uDF9A", label: "Level", value: `${writer.level} / ${writer.maxLevel || WRITER_LEVEL_MAX}` }),
            React.createElement("div", { style: { width: 1, background: '#2E2818', margin: '2px 0' } }),
            React.createElement(IdentityPlaque, { icon: "\u2726", label: "Lifetime XP", value: writer.totalXP.toLocaleString() }),
            React.createElement("div", { style: { width: 1, background: '#2E2818', margin: '2px 0' } }),
            React.createElement(IdentityPlaque, { icon: repTitle.icon, label: "Reputation", value: reputation.toLocaleString(), valueColor: repTitle.color, caption: repTitle.name })),
        joinDateLabel && React.createElement("div", { style: { fontSize: TYPE_SCALE[11.5], color: '#5C5C64', marginTop: 20 } }, "Writing since ", joinDateLabel));
}


// "Follow Author" — shown only on someone else's Author's Hall, never your own. The label and
// styling flip to reflect this device's current follow state, but the Reputation point behind it
// is only ever awarded the first time a reader follows a given author (see AUTHOR_EVER_FOLLOWED_KEY
// / handleToggleFollow in AuthorsHallScreen) — toggling follow/unfollow after that never changes
// their Reputation again.
export function FollowAuthorButton({ following, onToggle }) {
    return React.createElement("button", {
        onClick: onToggle,
        style: {
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: SPACE_SCALE[7],
            margin: '14px auto 0', background: following ? 'rgba(200,155,60,0.10)' : '#C89B3C',
            border: following ? '1px solid #4A3D22' : '1px solid #C89B3C',
            color: following ? '#C89B3C' : '#17130E',
            borderRadius: RADIUS_SCALE[10], padding: '9px 22px', fontSize: TYPE_SCALE[12.5], fontWeight: 600,
            cursor: 'pointer', fontFamily: 'inherit', transition: 'all var(--ink-dur) var(--ink-ease)',
        },
    }, following ? "\u2713 Following" : "+ Follow Author");
}


// Read-only counterpart to WriterIdentityCard, shown on another author's Author's Hall — same
// carved-plate visual language, but nothing here is editable and there's no avatar upload, since
// none of that is this viewer's to change. `reputation` is this author's own public Reputation
// total (see computeAuthorReputation) — never this device's own writer's number, and never a raw
// follower count.
export function PublicIdentityCard({ authorName, writer, reputation, following, onToggleFollow }) {
    const repTitle = reputationTitleFor(reputation);
    return React.createElement("div", {
        style: {
            textAlign: 'center', padding: '34px 26px 24px', borderRadius: RADIUS_SCALE[16], marginBottom: 30,
            background: 'radial-gradient(ellipse at 50% 0%, rgba(200,155,60,0.14), transparent 65%), linear-gradient(160deg, #211C13, #17130E)',
            border: '1px solid #4A3D22', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.05), 0 10px 30px rgba(0,0,0,0.35)',
        },
    },
        React.createElement("div", { style: {
                width: 108, height: 108, borderRadius: '50%', margin: '0 auto 16px', position: 'relative',
                background: 'radial-gradient(circle at 34% 28%, #2A2620, #17140F 72%)',
                border: '3px solid #C89B3C', boxShadow: '0 0 0 3px #100E0A, 0 0 28px rgba(200,155,60,0.32), 0 4px 16px rgba(0,0,0,0.5)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
            } }, React.createElement("span", { style: { fontSize: TYPE_SCALE[38], opacity: 0.5 } }, "\uD83E\uDDD1\u200D\uD83C\uDF93")),
        React.createElement("div", { style: {
                fontFamily: "'Fraunces', Georgia, serif", fontSize: TYPE_SCALE[22], fontWeight: 600, color: '#EFE7D2',
            } }, authorName || 'Unnamed Writer'),
        onToggleFollow && React.createElement(FollowAuthorButton, { following, onToggle: onToggleFollow }),
        React.createElement(ArchiveDivider, { maxWidth: 300, margin: '22px auto 18px', fontSize: TYPE_SCALE[11], color: '#4A3D22', opacity: 1 }),
        React.createElement("div", { style: { display: 'flex', alignItems: 'stretch' } },
            React.createElement(IdentityPlaque, { icon: writer.rank.icon, label: "Rank", value: writer.rank.name, valueColor: writer.rank.color }),
            React.createElement("div", { style: { width: 1, background: '#2E2818', margin: '2px 0' } }),
            React.createElement(IdentityPlaque, { icon: "\uD83C\uDF9A", label: "Level", value: `${writer.level} / ${writer.maxLevel || WRITER_LEVEL_MAX}` }),
            React.createElement("div", { style: { width: 1, background: '#2E2818', margin: '2px 0' } }),
            React.createElement(IdentityPlaque, { icon: repTitle.icon, label: "Reputation", value: reputation.toLocaleString(), valueColor: repTitle.color, caption: repTitle.name })));
}
