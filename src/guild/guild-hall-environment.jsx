import React, { useEffect, useRef } from 'react';
import { readSeenGuildHallStage, writeSeenGuildHallStage } from './guild-progression.jsx';
import { RADIUS_SCALE, SPACE_SCALE, TYPE_SCALE } from '../shell/nav-context.jsx';


export function GuildHallEnvironment({ level }) {
    // Captured once per mount: everything at or below this was already standing before this visit,
    // so it renders plainly. Anything above it (up to the current level) is being built right now.
    const seenRef = useRef(null);
    if (seenRef.current === null)
        seenRef.current = readSeenGuildHallStage();
    const justBuilt = (threshold) => level >= threshold && seenRef.current < threshold;
    useEffect(() => {
        if (level > seenRef.current) {
            writeSeenGuildHallStage(level);
            seenRef.current = level;
        }
    }, [level]);
    // Level 1 "The Campfire", Level 5 "The Outpost", Level 10 "The Lodge", and Level 15
    // "The Fortress" are one continuous campsite that grows into a real settlement. Watchtowers
    // moved here to Level 15 (the Fortress unlock they were always meant to be part of) rather than
    // the placeholder Level 20 they briefly sat at. Level 20 "The Castle" and Level 25 "The
    // Citadel" now have their own bespoke designs (a keep, staircase, guards, and gardens; then
    // taller walls, more towers, an observatory, archives, and a courtyard) rather than sitting as
    // placeholders. Level 30's gold flag/name shimmer is still pending its own redesign pass.
    const hasOutpost = level >= 5;
    const hasLodge = level >= 10;
    const hasFortress = level >= 15;
    // Level 20 "The Castle" and Level 25 "The Citadel" are the Hall's grandest stages yet — the
    // Fortress's stone wall and towers stay standing underneath both, and each new stage only adds
    // to them (a keep, a staircase, guards, gardens at the Castle; taller walls, more towers, an
    // observatory, archives, a courtyard at the Citadel), exactly like every earlier stage.
    const hasCastle = level >= 20;
    const hasSpires = level >= 25;
    const hasCitadel = level >= 25;
    const hasGoldFlag = level >= 30;
    // Level 30 "The Legendary Kingdom" is the Hall's final evolution — everything from the
    // Campfire through the Citadel keeps standing underneath it; this stage crowns it with a
    // cathedral, a living city skyline, a monument, book stacks, flying banners, and a warm
    // golden haze over the whole scene.
    const hasKingdom = level >= 30;
    const accent = '#C89B3C';
    const glow = 'rgba(200,155,60,0.3)';
    const stone = '#9AA0AA';
    const stoneDark = '#5C6068';
    const stoneGlow = 'rgba(154,160,170,0.4)';
    const anyBuilding = [1, 5, 10, 15, 20, 25, 30].some(justBuilt);
    const recolorTransition = { transition: 'background 900ms ease, border-color 900ms ease, box-shadow 900ms ease' };
    const stageLabel = hasKingdom ? 'The Legendary Kingdom' : hasCitadel ? 'The Citadel' : hasCastle ? 'The Castle' : hasFortress ? 'The Fortress' : hasLodge ? 'The Lodge' : hasOutpost ? 'The Outpost' : 'The Campfire';
    return React.createElement("div", { style: {
            position: 'relative', height: 250, margin: '0 auto 28px', maxWidth: 460, overflow: 'hidden',
            borderRadius: RADIUS_SCALE[16], border: '1px solid #2A2A30',
            background: 'linear-gradient(180deg, #14181A 0%, #1B2018 55%, #171B15 100%)',
        } },
        // ---------- Level 15: The Fortress — a stone wall along the horizon, behind everything else. ----------
        hasFortress && React.createElement("div", { className: justBuilt(15) ? 'gh-building' : undefined, style: {
                position: 'absolute', top: 0, left: 0, right: 0, height: 34,
                background: `linear-gradient(180deg, ${stone}, ${stoneDark})`, borderBottom: `1px solid ${stoneDark}`,
            } },
            React.createElement("div", { style: { position: 'absolute', bottom: -6, left: 0, right: 0, display: 'flex', justifyContent: 'space-evenly' } },
                Array.from({ length: 10 }).map((_, i) => React.createElement("div", { key: i, style: { width: 10, height: 6, background: stone } })))),
        // ground
        React.createElement("div", { style: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 50, background: 'linear-gradient(180deg, #3A2E1E, #201A10)' } }),
        // stone pathway leading to the entrance
        hasFortress && React.createElement("div", { className: justBuilt(15) ? 'gh-building' : undefined, style: {
                position: 'absolute', left: '50%', transform: 'translateX(-50%)', bottom: 0, width: 60, height: 50,
                background: `repeating-linear-gradient(180deg, ${stone}, ${stone} 8px, ${stoneDark} 8px, ${stoneDark} 10px)`, opacity: 0.55,
            } }),
        // ---------- Level 1: The Campfire — a simple campsite. Quiet, warm. ----------
        React.createElement("div", { className: justBuilt(1) ? 'gh-building' : undefined, style: { position: 'absolute', inset: 0 } },
            // few tents, back row — replaced by the Lodge once the guild outgrows them
            !hasLodge && React.createElement("div", { style: { position: 'absolute', left: '10%', bottom: 50, width: 0, height: 0, borderLeft: '20px solid transparent', borderRight: '20px solid transparent', borderBottom: '34px solid #5C4A36' } }),
            !hasLodge && React.createElement("div", { style: { position: 'absolute', right: '10%', bottom: 50, width: 0, height: 0, borderLeft: '20px solid transparent', borderRight: '20px solid transparent', borderBottom: '34px solid #5C4A36' } }),
            // wooden notice board
            React.createElement("div", { style: { position: 'absolute', left: '20%', bottom: 50 } },
                React.createElement("div", { style: { width: 3, height: 34, background: '#4A3D22', margin: '0 auto' } }),
                React.createElement("div", { style: { width: 30, height: 20, background: '#5C4A2E', border: '1px solid #3A2E1A', borderRadius: RADIUS_SCALE[2], marginTop: -4 } })),
            // crates and supplies
            React.createElement("div", { style: { position: 'absolute', right: '19%', bottom: 50, display: 'flex', flexDirection: 'column-reverse', gap: SPACE_SCALE[2] } },
                React.createElement("div", { style: { width: 20, height: 14, background: '#6B5230', border: '1px solid #3A2E1A', borderRadius: RADIUS_SCALE[2] } }),
                React.createElement("div", { style: { width: 22, height: 14, background: '#5C4426', border: '1px solid #3A2E1A', borderRadius: RADIUS_SCALE[2] } })),
            // small book chest (a second chest joins it once the Outpost's "more books" arrives)
            React.createElement("div", { style: { position: 'absolute', left: '50%', transform: 'translateX(54px)', bottom: 50, display: 'flex', gap: SPACE_SCALE[3], alignItems: 'flex-end' } },
                React.createElement("div", { className: justBuilt(5) ? 'gh-building' : undefined, style: { width: 22, height: 16, background: '#4A3620', border: '1px solid #2E2214', borderRadius: RADIUS_SCALE[2], position: 'relative', ...recolorTransition } },
                    React.createElement("div", { style: { position: 'absolute', top: '40%', left: 2, right: 2, height: 1, background: '#2E2214' } })),
                hasOutpost && React.createElement("div", { className: justBuilt(5) ? 'gh-building' : undefined, style: { width: 22, height: 16, background: '#4A3620', border: '1px solid #2E2214', borderRadius: RADIUS_SCALE[2], position: 'relative' } },
                    React.createElement("div", { style: { position: 'absolute', top: '40%', left: 2, right: 2, height: 1, background: '#2E2214' } }))),
            // wooden benches flanking the fire
            React.createElement("div", { style: { position: 'absolute', left: '50%', transform: 'translateX(-70px)', bottom: 52, width: 26, height: 6, background: '#4A3620', borderRadius: RADIUS_SCALE[2] } }),
            React.createElement("div", { style: { position: 'absolute', left: '50%', transform: 'translateX(44px)', bottom: 52, width: 26, height: 6, background: '#4A3620', borderRadius: RADIUS_SCALE[2] } }),
            // the campfire — grows into a larger campfire once the camp becomes an Outpost
            React.createElement("div", { style: {
                    position: 'absolute', left: '50%', transform: 'translateX(-50%)', bottom: 50, width: 0, height: 0,
                    borderLeft: (hasOutpost ? 16 : 11) + 'px solid transparent', borderRight: (hasOutpost ? 16 : 11) + 'px solid transparent',
                    borderBottom: (hasOutpost ? 12 : 8) + 'px solid #3A2E1A', ...recolorTransition,
                } }),
            React.createElement("div", { className: 'gh-flame', style: {
                    position: 'absolute', left: '50%', transform: 'translateX(-50%)', bottom: hasOutpost ? 58 : 56,
                    width: hasOutpost ? 18 : 12, height: hasOutpost ? 26 : 18, borderRadius: '50% 50% 50% 50% / 60% 60% 40% 40%',
                    background: 'radial-gradient(circle at 50% 70%, #FFDD8A, #F2924A 55%, #C4522A 85%)',
                    boxShadow: `0 0 ${hasOutpost ? 22 : 14}px ${glow}`, ...recolorTransition,
                } })),
        // ---------- Level 5: The Outpost — the camp expands. ----------
        hasOutpost && React.createElement("div", { className: justBuilt(5) ? 'gh-building' : undefined, style: { position: 'absolute', inset: 0 } },
            // wooden archway framing the entrance — gains lanterns and trim once the Fortress arrives ("decorated entrance")
            React.createElement("div", { style: { position: 'absolute', left: '50%', transform: 'translateX(-50%)', bottom: 50, width: 70, height: 40 } },
                React.createElement("div", { style: { position: 'absolute', left: 0, bottom: 0, width: 6, height: 40, background: '#5C4426', borderRadius: RADIUS_SCALE[2] } }),
                React.createElement("div", { style: { position: 'absolute', right: 0, bottom: 0, width: 6, height: 40, background: '#5C4426', borderRadius: RADIUS_SCALE[2] } }),
                React.createElement("div", { style: { position: 'absolute', top: 0, left: 0, right: 0, height: 10, borderRadius: '50% 50% 0 0 / 100% 100% 0 0', background: '#5C4426', border: `1px solid ${accent}55`, ...recolorTransition } }),
                hasFortress && React.createElement("div", { className: justBuilt(15) ? 'gh-building' : undefined, style: {
                        position: 'absolute', top: -2, left: -10, right: -10, height: 2,
                        background: `repeating-linear-gradient(90deg, ${accent}, ${accent} 6px, transparent 6px, transparent 12px)`,
                    } }),
                hasFortress && [-16, 76].map((x) => React.createElement("div", { key: 'lt' + x, className: 'gh-window-lit', style: {
                        position: 'absolute', bottom: 8, left: x, width: 6, height: 6, borderRadius: '50%',
                        background: 'radial-gradient(circle, #F2CE7A, #C89B3C 80%)', boxShadow: `0 0 8px ${glow}`,
                    } }))),
            // guild banner (a gold flag once the Golden Guild Name reward is reached)
            React.createElement("div", { style: { position: 'absolute', left: '26%', bottom: 50 } },
                React.createElement("div", { style: { width: 3, height: 52, background: '#5C4426', margin: '0 auto' } }),
                React.createElement("div", { className: hasGoldFlag ? 'gh-flag-wave guild-name-golden' : 'gh-flag-wave', style: {
                        position: 'absolute', top: 0, left: 3, width: 22, height: 14,
                        background: hasGoldFlag ? 'linear-gradient(90deg, #A9812E, #FCEABB, #E8C468)' : `linear-gradient(180deg, ${accent}, #8A6423)`,
                        clipPath: 'polygon(0 0, 100% 20%, 0 100%)', ...recolorTransition,
                    } })),
            // wooden cabins, either side of camp
            React.createElement("div", { style: { position: 'absolute', left: '6%', bottom: 50, width: 32, height: 26, background: '#4A3820', border: `1px solid ${accent}44` } },
                React.createElement("div", { style: { position: 'absolute', top: -12, left: -4, right: -4, height: 0, borderLeft: '20px solid transparent', borderRight: '20px solid transparent', borderBottom: '14px solid #3A2C18' } }),
                React.createElement("div", { className: 'gh-window-lit', style: { position: 'absolute', bottom: 5, left: '50%', transform: 'translateX(-50%)', width: 8, height: 8, borderRadius: RADIUS_SCALE[2], background: 'radial-gradient(circle, #F2CE7A, #C89B3C 80%)', boxShadow: `0 0 6px ${glow}` } })),
            React.createElement("div", { style: { position: 'absolute', right: '6%', bottom: 50, width: 32, height: 26, background: '#4A3820', border: `1px solid ${accent}44` } },
                React.createElement("div", { style: { position: 'absolute', top: -12, left: -4, right: -4, height: 0, borderLeft: '20px solid transparent', borderRight: '20px solid transparent', borderBottom: '14px solid #3A2C18' } }),
                React.createElement("div", { className: 'gh-window-lit', style: { position: 'absolute', bottom: 5, left: '50%', transform: 'translateX(-50%)', width: 8, height: 8, borderRadius: RADIUS_SCALE[2], background: 'radial-gradient(circle, #F2CE7A, #C89B3C 80%)', boxShadow: `0 0 6px ${glow}` } })),
            // training yard — a fenced patch with a practice target
            React.createElement("div", { style: { position: 'absolute', right: '22%', bottom: 50, width: 44, height: 26, border: `1px dashed ${accent}88`, borderRadius: RADIUS_SCALE[3] } },
                React.createElement("div", { style: { position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: 14, height: 14, borderRadius: '50%', border: `2px solid ${accent}`, boxShadow: `0 0 6px ${glow}` } })),
            // more decorations — bunting strung across the camp
            React.createElement("div", { style: { position: 'absolute', top: 40, left: 20, right: 20, display: 'flex', justifyContent: 'space-between' } },
                Array.from({ length: 7 }).map((_, i) => React.createElement("div", { key: i, style: {
                        width: 0, height: 0, borderLeft: '5px solid transparent', borderRight: '5px solid transparent',
                        borderTop: `9px solid ${i % 2 === 0 ? accent : '#EFE7D2'}`,
                    } }))),
            // NPC scribes walking around
            React.createElement("div", { className: 'gh-scribe-walk', style: { position: 'absolute', left: '34%', bottom: 52, width: 8, height: 8, borderRadius: '50%', background: '#D9D2BE' } }),
            React.createElement("div", { className: 'gh-scribe-walk', style: { position: 'absolute', right: '32%', bottom: 52, width: 8, height: 8, borderRadius: '50%', background: '#D9D2BE', animationDelay: '-3s' } })),
        // ---------- Level 10: The Lodge — tents give way to a proper wooden lodge. ----------
        hasLodge && React.createElement("div", { className: justBuilt(10) ? 'gh-building' : undefined, style: { position: 'absolute', inset: 0 } },
            // the Guild Hall building itself, standing where the tents used to be
            React.createElement("div", { style: {
                    position: 'absolute', left: '50%', transform: 'translateX(-50%)', bottom: 50, width: 130, height: 62,
                    background: 'linear-gradient(180deg, #4A3B26, #2E2416)', border: `1px solid ${accent}55`,
                } },
                React.createElement("div", { style: {
                        position: 'absolute', top: -26, left: -12, right: -12, height: 0,
                        borderLeft: '77px solid transparent', borderRight: '77px solid transparent', borderBottom: '26px solid #2E2214',
                    } }),
                // stone fireplace — a chimney rising through the roof with a warm interior glow
                React.createElement("div", { style: { position: 'absolute', top: -44, left: 18, width: 12, height: 26, background: `linear-gradient(180deg, ${stone}, ${stoneDark})` } },
                    React.createElement("div", { className: 'gh-window-lit', style: { position: 'absolute', top: -6, left: 2, width: 8, height: 8, borderRadius: '50%', background: 'radial-gradient(circle, #FFDD8A, #F2924A 70%)', boxShadow: `0 0 10px ${glow}` } })),
                // Guild Library entrance — a warmly lit door with a hanging sign
                React.createElement("div", { style: { position: 'absolute', bottom: 0, left: '50%', transform: 'translateX(-50%)', width: 26, height: 40 } },
                    React.createElement("div", { className: 'gh-window-lit', style: { position: 'absolute', inset: 0, borderRadius: '6px 6px 0 0', background: 'radial-gradient(circle at 50% 30%, #F2CE7A, #8A6423 85%)', border: '1px solid #2E2214' } }),
                    React.createElement("div", { style: { position: 'absolute', top: -14, left: '50%', transform: 'translateX(-50%)', width: 34, height: 10, background: '#5C4426', border: `1px solid ${accent}88`, borderRadius: RADIUS_SCALE[2], fontSize: TYPE_SCALE[6] } })),
                // bookshelves against the facade — become the Large Guild Library once the Fortress arrives
                [-52, 52].map((x) => React.createElement("div", { key: 'bs' + x, style: {
                        position: 'absolute', bottom: 0, left: `calc(50% + ${x}px)`, width: hasFortress ? 16 : 12, height: hasFortress ? 46 : 34,
                        background: '#3A2C18', border: '1px solid #2E2214', ...recolorTransition,
                    } },
                    Array.from({ length: hasFortress ? 4 : 3 }).map((_, i) => React.createElement("div", { key: i, style: { position: 'absolute', left: 1, right: 1, top: (i + 1) * (hasFortress ? 10 : 8), height: 1, background: '#5C4426' } })))),
                // lit windows either side of the door
                [-30, 30].map((x) => React.createElement("div", { key: 'lw' + x, className: 'gh-window-lit', style: {
                        position: 'absolute', bottom: 12, left: `calc(50% + ${x}px)`, width: 14, height: 16, borderRadius: RADIUS_SCALE[2],
                        background: 'radial-gradient(circle, #F2CE7A, #C89B3C 80%)', border: '1px solid #2E2214', boxShadow: `0 0 8px ${glow}`,
                    } }))),
            // reading tables and writing desks out front
            React.createElement("div", { style: { position: 'absolute', left: '50%', transform: 'translateX(-108px)', bottom: 50, width: 24, height: 8, background: '#5C4426', borderRadius: RADIUS_SCALE[1] } },
                React.createElement("div", { style: { position: 'absolute', top: -3, left: 4, width: 4, height: 3, background: '#EFE7D2' } })),
            React.createElement("div", { style: { position: 'absolute', left: '50%', transform: 'translateX(84px)', bottom: 50, width: 24, height: 8, background: '#5C4426', borderRadius: RADIUS_SCALE[1] } },
                React.createElement("div", { style: { position: 'absolute', top: -3, left: 4, width: 4, height: 3, background: '#EFE7D2' } })),
            // more animated NPC writers
            React.createElement("div", { className: 'gh-scribe-walk', style: { position: 'absolute', left: '46%', bottom: 52, width: 8, height: 8, borderRadius: '50%', background: '#D9D2BE', animationDelay: '-1.5s' } }),
            React.createElement("div", { className: 'gh-scribe-walk', style: { position: 'absolute', right: '44%', bottom: 52, width: 8, height: 8, borderRadius: '50%', background: '#D9D2BE', animationDelay: '-4.2s' } })),
        // ---------- Level 15: The Fortress — the guild becomes respected. ----------
        hasFortress && React.createElement("div", { className: justBuilt(15) ? 'gh-building' : undefined, style: { position: 'absolute', inset: 0 } },
            // watchtowers
            React.createElement("div", { style: { position: 'absolute', left: '2%', bottom: 50, width: 22, height: 90, borderRadius: '4px 4px 0 0', background: `linear-gradient(180deg, ${stone}, ${stoneDark})`, border: `1px solid ${stoneDark}` } }),
            React.createElement("div", { style: { position: 'absolute', right: '2%', bottom: 50, width: 22, height: 90, borderRadius: '4px 4px 0 0', background: `linear-gradient(180deg, ${stone}, ${stoneDark})`, border: `1px solid ${stoneDark}` } }),
            hasSpires && React.createElement("div", { className: justBuilt(25) ? 'gh-building' : undefined, style: {
                    position: 'absolute', left: 'calc(2% + 4px)', bottom: 136, width: 0, height: 0,
                    borderLeft: '7px solid transparent', borderRight: '7px solid transparent', borderBottom: `14px solid ${accent}`,
                } }),
            hasSpires && React.createElement("div", { className: justBuilt(25) ? 'gh-building' : undefined, style: {
                    position: 'absolute', right: 'calc(2% + 4px)', bottom: 136, width: 0, height: 0,
                    borderLeft: '7px solid transparent', borderRight: '7px solid transparent', borderBottom: `14px solid ${accent}`,
                } }),
            // large banners hanging from the stone wall
            React.createElement("div", { style: {
                    position: 'absolute', left: '30%', top: 34, width: 16, height: 44,
                    background: `linear-gradient(180deg, ${accent}, #8A6423)`, clipPath: 'polygon(0 0, 100% 0, 100% 85%, 50% 100%, 0 85%)',
                } }),
            React.createElement("div", { style: {
                    position: 'absolute', right: '30%', top: 34, width: 16, height: 44,
                    background: `linear-gradient(180deg, ${accent}, #8A6423)`, clipPath: 'polygon(0 0, 100% 0, 100% 85%, 50% 100%, 0 85%)',
                } }),
            // statues flanking the entrance
            React.createElement("div", { style: { position: 'absolute', left: '39%', bottom: 50, width: 10, height: 30, textAlign: 'center' } },
                React.createElement("div", { style: { width: 10, height: 20, background: stone, borderRadius: '5px 5px 0 0', margin: '0 auto' } }),
                React.createElement("div", { style: { width: 14, height: 6, background: stoneDark, marginTop: 1 } })),
            React.createElement("div", { style: { position: 'absolute', right: '39%', bottom: 50, width: 10, height: 30, textAlign: 'center' } },
                React.createElement("div", { style: { width: 10, height: 20, background: stone, borderRadius: '5px 5px 0 0', margin: '0 auto' } }),
                React.createElement("div", { style: { width: 14, height: 6, background: stoneDark, marginTop: 1 } })),
            // fountain
            React.createElement("div", { style: { position: 'absolute', left: '17%', bottom: 50, width: 26, height: 26, borderRadius: '50%', border: `2px solid ${stone}`, boxShadow: `0 0 10px ${stoneGlow}` } },
                React.createElement("div", { className: 'gh-window-lit', style: { position: 'absolute', inset: 5, borderRadius: '50%', background: 'radial-gradient(circle, #BFE3EA, #6F97A3 80%)' } })),
            // more visitors, walking the stone pathway
            React.createElement("div", { className: 'gh-scribe-walk', style: { position: 'absolute', left: '48%', bottom: 52, width: 8, height: 8, borderRadius: '50%', background: stone, animationDelay: '-2.4s' } }),
            React.createElement("div", { className: 'gh-scribe-walk', style: { position: 'absolute', right: '46%', bottom: 52, width: 8, height: 8, borderRadius: '50%', background: stone, animationDelay: '-5s' } })),
        // ---------- Level 20: The Castle — the Guild Hall becomes a magnificent castle. ----------
        hasCastle && React.createElement("div", { className: justBuilt(20) ? 'gh-building' : undefined, style: { position: 'absolute', inset: 0 } },
            // the grand keep rising behind the entrance — the throne room, topped with a gold roof
            React.createElement("div", { style: { position: 'absolute', left: '50%', transform: 'translateX(-50%)', bottom: 108, width: 54, height: 46, background: 'linear-gradient(180deg, #5C4A2E, #2E2416)', border: `1px solid ${accent}66` } },
                React.createElement("div", { style: { position: 'absolute', top: -20, left: -10, right: -10, height: 0, borderLeft: '37px solid transparent', borderRight: '37px solid transparent', borderBottom: `20px solid ${accent}` } }),
                // the throne room's grand window, glowing warm gold
                React.createElement("div", { className: 'gh-window-lit', style: { position: 'absolute', top: 8, left: '50%', transform: 'translateX(-50%)', width: 18, height: 22, borderRadius: '9px 9px 0 0', background: 'radial-gradient(circle at 50% 30%, #FCEABB, #C89B3C 80%)', border: '1px solid #2E2214', boxShadow: `0 0 12px ${glow}` } }),
                // a golden chandelier's glow spilling from just above the window
                React.createElement("div", { className: 'gh-window-lit', style: { position: 'absolute', top: -6, left: '50%', transform: 'translateX(-50%)', width: 7, height: 7, borderRadius: '50%', background: 'radial-gradient(circle, #FCEABB, #E8C468 80%)', boxShadow: `0 0 10px ${glow}` } })),
            // the grand staircase sweeping up to the entrance, wider with every step
            React.createElement("div", { style: { position: 'absolute', left: '50%', transform: 'translateX(-50%)', bottom: 0, display: 'flex', flexDirection: 'column-reverse', alignItems: 'center' } },
                [0, 1, 2, 3].map((i) => React.createElement("div", { key: i, style: { width: 92 - i * 16, height: 6, background: i % 2 === 0 ? stone : stoneDark, marginTop: -1, borderRadius: RADIUS_SCALE[1] } }))),
            // beautiful gardens — trimmed hedges either side of the staircase
            [-72, 72].map((x) => React.createElement("div", { key: 'garden' + x, style: { position: 'absolute', left: `calc(50% + ${x}px)`, bottom: 50, width: 26, height: 16, borderRadius: '50% 50% 20% 20%', background: 'linear-gradient(180deg, #5C8A4A, #3A5C2E)', border: '1px solid #2E4622' } })),
            // knight guards standing watch at the staircase
            [-44, 44].map((x) => React.createElement("div", { key: 'knight' + x, style: { position: 'absolute', left: `calc(50% + ${x}px)`, bottom: 50, width: 10, height: 28, textAlign: 'center' } },
                React.createElement("div", { style: { width: 10, height: 18, background: 'linear-gradient(180deg, #C7D0DA, #8A96A4)', borderRadius: '4px 4px 0 0', margin: '0 auto', border: '1px solid #5C6068' } }),
                React.createElement("div", { style: { width: 3, height: 12, background: accent, margin: '0 auto', marginTop: -14 } }))),
            // animated flags along the castle roofline
            [-24, 24].map((x) => React.createElement("div", { key: 'castleflag' + x, style: { position: 'absolute', left: `calc(50% + ${x}px)`, bottom: 152 } },
                React.createElement("div", { style: { width: 2, height: 18, background: '#5C4426' } }),
                React.createElement("div", { className: 'gh-flag-wave', style: { position: 'absolute', top: 0, left: 2, width: 14, height: 9, background: `linear-gradient(180deg, ${accent}, #8A6423)`, clipPath: 'polygon(0 0, 100% 20%, 0 100%)' } }))),
            // the huge fireplace's warm glow, visible through a low window
            React.createElement("div", { className: 'gh-window-lit', style: { position: 'absolute', left: '50%', transform: 'translateX(-86px)', bottom: 58, width: 12, height: 10, borderRadius: RADIUS_SCALE[2], background: 'radial-gradient(circle, #FFDD8A, #C4522A 80%)', boxShadow: `0 0 10px ${glow}` } }),
            // a small trophy shelf — the Guild Museum — beside the entrance
            React.createElement("div", { style: { position: 'absolute', left: '50%', transform: 'translateX(66px)', bottom: 50, width: 16, height: 20, background: '#3A2C18', border: `1px solid ${accent}55` } },
                React.createElement("div", { style: { position: 'absolute', top: 3, left: 3, width: 4, height: 4, borderRadius: '50%', background: accent } }),
                React.createElement("div", { style: { position: 'absolute', top: 10, left: 8, width: 4, height: 4, borderRadius: '50%', background: accent } }))),
        // ---------- Level 25: The Citadel — the Guild becomes legendary. ----------
        hasCitadel && React.createElement("div", { className: justBuilt(25) ? 'gh-building' : undefined, style: { position: 'absolute', inset: 0 } },
            // the castle walls grow massive — a taller battlement line above the original Fortress wall
            React.createElement("div", { style: { position: 'absolute', top: -10, left: 0, right: 0, height: 12, background: `linear-gradient(180deg, ${stone}, ${stoneDark})`, borderBottom: `1px solid ${stoneDark}` } },
                React.createElement("div", { style: { position: 'absolute', bottom: -5, left: 0, right: 0, display: 'flex', justifyContent: 'space-evenly' } },
                    Array.from({ length: 12 }).map((_, i) => React.createElement("div", { key: i, style: { width: 8, height: 5, background: stone } })))),
            // two further corner towers, standing beyond the Fortress's original watchtowers
            React.createElement("div", { style: { position: 'absolute', left: '-3%', bottom: 50, width: 16, height: 66, borderRadius: '3px 3px 0 0', background: `linear-gradient(180deg, ${stone}, ${stoneDark})`, border: `1px solid ${stoneDark}` } }),
            React.createElement("div", { style: { position: 'absolute', right: '-3%', bottom: 50, width: 16, height: 66, borderRadius: '3px 3px 0 0', background: `linear-gradient(180deg, ${stone}, ${stoneDark})`, border: `1px solid ${stoneDark}` } }),
            // the observatory — a domed tower rising above the citadel
            React.createElement("div", { style: { position: 'absolute', left: '50%', transform: 'translateX(80px)', bottom: 154, width: 20, height: 22, background: `linear-gradient(180deg, ${stone}, ${stoneDark})`, border: `1px solid ${stoneDark}` } },
                React.createElement("div", { style: { position: 'absolute', top: -10, left: 0, right: 0, height: 10, borderRadius: '50% 50% 0 0', background: stone } }),
                React.createElement("div", { className: 'gh-window-lit', style: { position: 'absolute', top: 3, left: '50%', transform: 'translateX(-50%)', width: 6, height: 6, borderRadius: '50%', background: 'radial-gradient(circle, #BFE3EA, #6F97A3 80%)', boxShadow: `0 0 8px ${stoneGlow}` } })),
            // the Archives and Guild Academy — low stone wings either side of the keep
            React.createElement("div", { style: { position: 'absolute', left: '50%', transform: 'translateX(-102px)', bottom: 50, width: 30, height: 34, background: 'linear-gradient(180deg, #4A3B26, #2E2416)', border: `1px solid ${accent}44` } },
                React.createElement("div", { className: 'gh-window-lit', style: { position: 'absolute', bottom: 6, left: '50%', transform: 'translateX(-50%)', width: 10, height: 12, borderRadius: RADIUS_SCALE[2], background: 'radial-gradient(circle, #F2CE7A, #C89B3C 80%)', boxShadow: `0 0 6px ${glow}` } })),
            React.createElement("div", { style: { position: 'absolute', left: '50%', transform: 'translateX(72px)', bottom: 50, width: 30, height: 34, background: 'linear-gradient(180deg, #4A3B26, #2E2416)', border: `1px solid ${accent}44` } },
                React.createElement("div", { className: 'gh-window-lit', style: { position: 'absolute', bottom: 6, left: '50%', transform: 'translateX(-50%)', width: 10, height: 12, borderRadius: RADIUS_SCALE[2], background: 'radial-gradient(circle, #F2CE7A, #C89B3C 80%)', boxShadow: `0 0 6px ${glow}` } })),
            // a large stained-glass window set into the central keep
            React.createElement("div", { style: { position: 'absolute', left: '50%', transform: 'translateX(-50%)', bottom: 124, width: 16, height: 20, borderRadius: '8px 8px 0 0', overflow: 'hidden', border: '1px solid #2E2214', display: 'flex' } },
                ['#C4522A', '#4A7A3C', '#3F6FA8', '#C89B3C'].map((c, i) => React.createElement("div", { key: i, className: 'gh-window-lit', style: { flex: 1, background: c, animationDelay: `${i * 0.3}s` } }))),
            // a decorative bridge over the approach to the citadel
            React.createElement("div", { style: { position: 'absolute', left: '50%', transform: 'translateX(-46px)', bottom: 6, width: 40, height: 10, borderTop: `3px solid ${stone}`, borderRadius: '50% 50% 0 0 / 100% 100% 0 0' } }),
            // the marketplace courtyard — small colorful stalls out front
            [-98, -62, 62, 98].map((x, i) => React.createElement("div", { key: 'stall' + x, style: { position: 'absolute', left: `calc(50% + ${x}px)`, bottom: 50, width: 14, height: 12 } },
                React.createElement("div", { style: { width: 0, height: 0, borderLeft: '7px solid transparent', borderRight: '7px solid transparent', borderBottom: `8px solid ${['#8A3A3A', '#3A6B8A', '#6B8A3A', '#8A6B3A'][i]}` } }),
                React.createElement("div", { style: { width: 10, height: 6, background: '#5C4426', margin: '0 auto' } }))),
            // the elite guard — a feathered plume added atop the Castle's knight guards
            hasCastle && [-44, 44].map((x) => React.createElement("div", { key: 'plume' + x, style: { position: 'absolute', left: `calc(50% + ${x}px)`, bottom: 78, width: 4, height: 8, borderRadius: '50% 50% 0 0', background: '#8A3A3A' } }))),
        // ---------- Level 30: The Legendary Kingdom — the Guild reaches its final evolution. ----------
        hasKingdom && React.createElement("div", { className: justBuilt(30) ? 'gh-building' : undefined, style: { position: 'absolute', inset: 0 } },
            // the skyline of a living city, grown up around the guild, along the horizon — the Royal Capital
            React.createElement("div", { style: { position: 'absolute', top: -22, left: 0, right: 0, height: 14, display: 'flex', justifyContent: 'space-evenly', alignItems: 'flex-end', opacity: 0.7 } },
                Array.from({ length: 9 }).map((_, i) => React.createElement("div", { key: i, style: { width: 10 + (i % 3) * 4, height: 8 + (i % 4) * 4, background: stoneDark } }))),
            // the grand cathedral spire, rising above the keep — the Hall of Legends
            React.createElement("div", { style: { position: 'absolute', left: '50%', transform: 'translateX(-50%)', bottom: 152, width: 26, height: 46, background: `linear-gradient(180deg, ${stone}, ${stoneDark})`, border: `1px solid ${stoneDark}` } },
                React.createElement("div", { style: { position: 'absolute', top: -20, left: 3, right: 3, height: 0, borderLeft: '10px solid transparent', borderRight: '10px solid transparent', borderBottom: `20px solid ${stoneDark}` } }),
                React.createElement("div", { style: { position: 'absolute', top: -26, left: '50%', transform: 'translateX(-50%)', width: 3, height: 10, background: accent } }),
                // its rose window, glowing with golden light
                React.createElement("div", { className: 'gh-window-lit', style: { position: 'absolute', top: 10, left: '50%', transform: 'translateX(-50%)', width: 12, height: 12, borderRadius: '50%', background: 'radial-gradient(circle, #FCEABB, #C89B3C 75%)', border: '1px solid #2E2214', boxShadow: `0 0 10px ${glow}` } })),
            // the Guild monument, standing in Founders' Plaza
            React.createElement("div", { style: { position: 'absolute', left: '18%', bottom: 50, width: 22, textAlign: 'center' } },
                React.createElement("div", { style: { width: 6, height: 22, background: accent, margin: '0 auto', borderRadius: '3px 3px 0 0', boxShadow: `0 0 8px ${glow}` } }),
                React.createElement("div", { style: { width: 18, height: 6, background: stoneDark, margin: '0 auto' } }),
                React.createElement("div", { style: { width: 22, height: 4, background: stone, margin: '0 auto' } })),
            // book stacks scattered around — hundreds of books overflowing the Ancient Library
            [['14%', 3], ['84%', 4]].map(([x, n], gi) => React.createElement("div", { key: 'books' + gi, style: { position: 'absolute', left: x, bottom: 50, display: 'flex', flexDirection: 'column-reverse' } },
                Array.from({ length: n }).map((_, i) => React.createElement("div", { key: i, style: { width: 20 - (i % 2) * 3, height: 5, marginTop: -1, background: ['#6B3F2E', '#3F5C6B', '#5C6B3F', '#6B5C3F'][i % 4], border: '1px solid #2E2214' } })))),
            // flying banners strung high above Founders' Plaza
            Array.from({ length: 5 }).map((_, i) => React.createElement("div", { key: 'fb' + i, style: { position: 'absolute', left: `${18 + i * 16}%`, top: 6 } },
                React.createElement("div", { className: 'gh-flag-wave', style: {
                        width: 12, height: 16, background: ['#8A3A3A', '#3A6B8A', '#6B8A3A', '#8A6B3A', accent][i],
                        clipPath: 'polygon(0 0, 100% 0, 100% 70%, 50% 100%, 0 70%)', animationDelay: `${i * 0.3}s`, boxShadow: `0 0 6px ${glow}`,
                    } }))),
            // seasonal garlands strung along the entrance, twinkling with light
            React.createElement("div", { style: { position: 'absolute', left: '50%', transform: 'translateX(-50%)', bottom: 148, display: 'flex', gap: SPACE_SCALE[6] } },
                Array.from({ length: 7 }).map((_, i) => React.createElement("div", { key: 'sd' + i, className: 'gh-window-lit', style: {
                        width: 5, height: 5, borderRadius: '50%', background: ['#F2CE7A', '#8A3A6B', '#3A8A6B', '#C89B3C'][i % 4],
                        boxShadow: `0 0 6px ${glow}`, animationDelay: `${i * 0.2}s`,
                    } }))),
            // many more animated citizens roaming the plaza — the Guild's Living City
            [['20%', '-3.6s'], ['62%', '-1.2s'], ['76%', '-4.8s'], ['30%', '-2.1s']].map(([x, d], i) => React.createElement("div", { key: 'cit' + i, className: 'gh-scribe-walk', style: {
                    position: 'absolute', left: x, bottom: 52, width: 8, height: 8, borderRadius: '50%',
                    background: ['#D9D2BE', '#C89B3C', '#8A96A4', '#D9D2BE'][i], animationDelay: d,
                } })),
            // a warm golden haze breathing over the whole kingdom — Golden Lighting
            React.createElement("div", { className: 'gh-golden-haze', style: { position: 'absolute', inset: 0, background: 'radial-gradient(ellipse at 50% 40%, rgba(252,234,187,0.28), transparent 70%)', pointerEvents: 'none' } })),
        anyBuilding && React.createElement("div", { className: "gh-dust", style: { position: 'absolute', inset: 0, pointerEvents: 'none' } },
            Array.from({ length: 10 }).map((_, i) => React.createElement("span", { key: i, style: {
                    position: 'absolute', left: `${10 + i * 8}%`, bottom: 50, width: 3, height: 3, borderRadius: '50%',
                    background: accent, animationDelay: `${i * 60}ms`,
                } }))),
        React.createElement("div", { style: {
                position: 'absolute', bottom: 8, left: 0, right: 0, textAlign: 'center', fontSize: TYPE_SCALE[10], letterSpacing: '0.08em',
                textTransform: 'uppercase', color: '#8A8A92',
            } }, `Level ${level} \u2014 ${stageLabel}`));
}
