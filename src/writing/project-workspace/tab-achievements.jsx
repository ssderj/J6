import React from 'react';
import { NavScrollBox, SPACE_SCALE, TYPE_SCALE } from '../../shell/nav-context.jsx';
import { AchievementCard, AchievementCategoryHeading, AchievementUnlockOverlay, LevelUpOverlay, WriterLevelBanner } from '../achievements.jsx';
import { ACHIEVEMENT_CATEGORIES } from '../health-checks.jsx';

// Extracted unchanged from the monolithic project-workspace.jsx tab === 'achievements' block — only the
// state it read is now passed in as props instead of closed over.
export function AchievementsTab({ achievements, handleUnlockContinue, levelUpEvent, project, projectId, setLevelUpEvent, setXpGainEvent, unlockQueue, unlockedAchievementCount, writerProgress, xpGainEvent }) {
    return (React.createElement(React.Fragment, null,
                unlockQueue[0] && React.createElement(AchievementUnlockOverlay, {
                    key: "unlock-" + unlockQueue[0].id, achievement: unlockQueue[0], onContinue: handleUnlockContinue,
                }),
                // Suppressed for as long as an XP gain that caused this very level-up is still
                // animating its bar up to full — otherwise the full-screen overlay would pop in
                // instantly and hide that small animation entirely, instead of the two reading as
                // one continuous "gain, then arrival" motion. Also suppressed while unlockQueue
                // still has items: levelUpEvent.newAchievements is the same list unlockQueue was
                // seeded from, so without this the two would render stacked on top of each other
                // and the same achievement would get celebrated twice at once — once as its own
                // AchievementUnlockOverlay, once as a line in this overlay's recap. Waiting for the
                // queue to drain first turns that into one clean sequence: achievement(s), then the
                // level-up overlay's recap reads as a fitting summary instead of a duplicate.
                levelUpEvent && unlockQueue.length === 0 && !(xpGainEvent && xpGainEvent.leveledUp) && React.createElement(LevelUpOverlay, {
                    key: "levelup-" + levelUpEvent.level, project: project, level: levelUpEvent.level,
                    xpEarned: levelUpEvent.xpEarned, newAchievements: levelUpEvent.newAchievements,
                    onDone: () => setLevelUpEvent(null),
                }),
                React.createElement(NavScrollBox, { navKey: `ws-${projectId}-achievements`, style: { flex: 1, padding: '40px 40px 64px', overflowY: 'auto', display: 'flex', justifyContent: 'center' }, className: "scrollbox tab-fade" },
                    React.createElement("div", { style: { width: '100%', maxWidth: 720 } },
                        React.createElement("div", { style: { textAlign: 'center', marginBottom: 26 } },
                            React.createElement("div", { style: { fontSize: TYPE_SCALE[22], color: '#C89B3C', opacity: 0.85, marginBottom: 6 } }, "\u2766"),
                            React.createElement("div", { style: { fontFamily: "'Fraunces', Georgia, serif", fontSize: TYPE_SCALE[28], fontStyle: 'italic', fontWeight: 600, color: '#EFE7D2' } }, "Hall of Achievements"),
                            React.createElement("div", { style: { fontSize: TYPE_SCALE[12.5], color: '#7A7A82', marginTop: 6 } }, "Honors earned in the writing of ", project.title || 'your novel')),
                        React.createElement(WriterLevelBanner, { level: writerProgress.level, subtitle: 'This Project', totalXP: writerProgress.totalXP,
                            xpIntoLevel: writerProgress.xpIntoLevel, xpPerLevel: writerProgress.xpPerLevel, isMaxLevel: writerProgress.isMaxLevel,
                            unlockedCount: unlockedAchievementCount, totalCount: achievements.length,
                            xpGain: xpGainEvent, onXpGainEnd: () => setXpGainEvent(null) }),
                        ACHIEVEMENT_CATEGORIES.map((cat, gIdx) => {
                            const items = achievements.filter((a) => a.group === cat.key);
                            const unlockedInCat = items.filter((a) => a.unlocked).length;
                            return React.createElement("div", { key: cat.key, className: "archive-section-in", style: { marginBottom: 46, '--i': gIdx } },
                                React.createElement(AchievementCategoryHeading, { icon: cat.icon, label: cat.label, unlocked: unlockedInCat, total: items.length }),
                                React.createElement("div", { style: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: SPACE_SCALE[12], marginTop: 18 } }, items.map((a) => React.createElement(AchievementCard, { key: a.id, achievement: a }))));
                        })))));
}
