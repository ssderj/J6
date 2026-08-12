import React from 'react';
import { RADIUS_SCALE, SPACE_SCALE, TYPE_SCALE } from '../../shell/nav-context.jsx';
import { SectionLabel } from '../../shared-ui/ui-cards.jsx';
import { IconDots, IconPlus } from '../../shared-ui/icons.jsx';
import { ChapterEditor } from '../chapter-editor.jsx';
import { chapterLabel, highestChapterNumber } from '../project-schema-and-backups.jsx';
import { uuid } from '../../shared-utils/storage-keys.jsx';
import { wordCount } from '../../shared-utils/strip-html.jsx';

// Extracted unchanged from the monolithic project-workspace.jsx tab === 'manuscript' block — only the
// state it read is now passed in as props instead of closed over.
// LevelUpMiniToast used to render here on every level-up while actively writing — removed since
// it interrupted the writing flow. Level-ups (and achievement unlocks generally) are still
// tracked exactly the same via levelUpEvent/unlockQueue in the shell; they just aren't announced
// here anymore. They show up normally next time the writer visits the Achievements tab.
export function ManuscriptTab({ activeChapter, activeReadingTheme, askConfirm, chapter, chapterMenuId, chapters, editorPaneRef, handleJump, handleReaderMouseDown, handleReaderMouseUp, handleReaderTouchCancel, handleReaderTouchEnd, handleReaderTouchStart, pageAnim, project, readingMode, readingSettings, renameDraft, renamingChapterId, scrollPositionsRef, setActiveChapter, setChapterMenuId, setLiveChapterWordCount, setRenameDraft, setRenamingChapterId, setSubNavOpen, subNavOpen, unitTerm, unitTermPlural, update, updateChapterText }) {
    return (React.createElement("div", { className: "tab-fade", style: { display: 'flex', flex: 1, minHeight: 0, position: 'relative' } },
                subNavOpen && React.createElement("div", { className: "subnav-backdrop open", onClick: () => setSubNavOpen(false) }),
                React.createElement("div", { className: "scrollbox sub-sidebar" + (subNavOpen ? ' open' : ''), style: { width: 210, borderRight: '1px solid #2A2A30', padding: 16, overflowY: 'auto', flexShrink: 0 } },
                    React.createElement(SectionLabel, null, unitTermPlural),
                    chapters.map((c, idx) => {
                        const isRenaming = renamingChapterId === c.id;
                        const isMenuOpen = chapterMenuId === c.id;
                        const commitRename = () => {
                            update((p) => { p.chapters.find((x) => x.id === c.id).title = renameDraft.trim(); });
                            setRenamingChapterId(null);
                        };
                        return React.createElement("div", { key: c.id, style: { position: 'relative', marginBottom: 2 } },
                            React.createElement("div", { onClick: () => { if (!isRenaming) {
                                        setActiveChapter(c.id);
                                        setSubNavOpen(false);
                                    } }, className: "hoverable", style: {
                                    padding: '8px 4px 8px 10px', borderRadius: RADIUS_SCALE[6], cursor: isRenaming ? 'default' : 'pointer',
                                    background: c.id === activeChapter ? '#232328' : 'transparent',
                                    display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: SPACE_SCALE[4],
                                } },
                                isRenaming
                                    ? React.createElement("input", { value: renameDraft, autoFocus: true, placeholder: `${unitTerm} ${typeof c.number === 'number' ? c.number : idx + 1} (optional title)`, onChange: (e) => setRenameDraft(e.target.value), onClick: (e) => e.stopPropagation(), onKeyDown: (e) => { if (e.key === 'Enter')
                                            commitRename(); if (e.key === 'Escape')
                                            setRenamingChapterId(null); }, onBlur: commitRename, style: { background: 'transparent', border: 'none', borderBottom: '1px solid #3A3A42', color: '#D9D2BE', fontSize: TYPE_SCALE[13.5], width: '100%', padding: '2px 0' } })
                                    : React.createElement("span", { style: { fontSize: TYPE_SCALE[13.5], color: '#D9D2BE', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, minWidth: 0 } }, chapterLabel(chapters, c.id, unitTerm)),
                                !isRenaming && React.createElement("button", { onClick: (e) => { e.stopPropagation(); setChapterMenuId(isMenuOpen ? null : c.id); }, style: { background: 'none', border: 'none', color: '#7A7A82', cursor: 'pointer', display: 'flex', padding: '4px 6px', flexShrink: 0 } },
                                    React.createElement(IconDots, null))),
                            isMenuOpen && React.createElement(React.Fragment, null,
                                React.createElement("div", { onClick: () => setChapterMenuId(null), style: { position: 'fixed', inset: 0, zIndex: 2200 } }),
                                React.createElement("div", { style: { position: 'absolute', right: 0, top: '100%', marginTop: 2, background: '#232328', border: '1px solid #3A3A42', borderRadius: RADIUS_SCALE[8], boxShadow: '0 8px 24px rgba(0,0,0,0.45)', zIndex: 2201, minWidth: 140, overflow: 'hidden', display: 'flex', flexDirection: 'column' } },
                                    React.createElement("button", { onClick: () => { setRenameDraft(c.title || ''); setRenamingChapterId(c.id); setChapterMenuId(null); }, style: { background: 'none', border: 'none', color: '#D9D2BE', fontSize: TYPE_SCALE[13], textAlign: 'left', padding: '10px 14px', cursor: 'pointer' } }, "Rename"),
                                    React.createElement("button", { onClick: () => {
                                            const newId = uuid();
                                            update((p) => {
                                                const srcIdx = p.chapters.findIndex((x) => x.id === c.id);
                                                const src = p.chapters[srcIdx];
                                                p.chapters.splice(srcIdx + 1, 0, {
                                                    id: newId,
                                                    title: src.title,
                                                    text: src.text,
                                                    number: src.number,
                                                    isCopy: true,
                                                });
                                            });
                                            setActiveChapter(newId);
                                            setChapterMenuId(null);
                                            setSubNavOpen(false);
                                        }, style: { background: 'none', border: 'none', color: '#D9D2BE', fontSize: TYPE_SCALE[13], textAlign: 'left', padding: '10px 14px', cursor: 'pointer', borderTop: '1px solid #2A2A30' } }, "Duplicate"),
                                    chapters.length > 1 && React.createElement("button", { onClick: () => {
                                            setChapterMenuId(null);
                                            const words = wordCount(c.text);
                                            const label = chapterLabel(chapters, c.id, unitTerm);
                                            const wordsMsg = words > 0 ? ` It has ${words.toLocaleString()} word${words === 1 ? '' : 's'} that will be permanently lost.` : '';
                                            askConfirm(`Delete "${label}"?${wordsMsg} This cannot be undone. ${unitTermPlural} after it will renumber automatically.`, () => {
                                                var _a, _b;
                                                update((p) => { p.chapters = p.chapters.filter((x) => x.id !== c.id); });
                                                if (activeChapter === c.id)
                                                    setActiveChapter((_b = (_a = chapters.find((x) => x.id !== c.id)) === null || _a === void 0 ? void 0 : _a.id) !== null && _b !== void 0 ? _b : null);
                                            });
                                        }, style: { background: 'none', border: 'none', color: '#D9736C', fontSize: TYPE_SCALE[13], textAlign: 'left', padding: '10px 14px', cursor: 'pointer', borderTop: '1px solid #2A2A30' } }, "Delete"))));
                    }),
                    React.createElement("button", { onClick: () => update((p) => {
                            const nc = { id: uuid(), title: '', text: '', number: highestChapterNumber(p.chapters) + 1, isCopy: false };
                            p.chapters.push(nc);
                            setActiveChapter(nc.id);
                        }), style: { display: 'flex', alignItems: 'center', gap: SPACE_SCALE[6], marginTop: 8, background: 'none', border: '1px dashed #3A3A42', color: '#A6A6AD', borderRadius: RADIUS_SCALE[6], padding: '7px 10px', fontSize: TYPE_SCALE[13], cursor: 'pointer', width: '100%' } },
                        React.createElement(IconPlus, null),
                        ` New ${unitTerm.toLowerCase()}`)),
                React.createElement("div", { ref: editorPaneRef, className: "scrollbox editor-pane", style: { flex: 1, padding: readingMode ? '28px 0' : '28px 0', overflowY: 'auto', overflowX: 'hidden', position: 'relative', background: readingMode ? activeReadingTheme.bg : 'transparent', transition: 'background var(--ink-dur) var(--ink-ease)' },
                    ...(readingMode ? {
                        onTouchStart: handleReaderTouchStart,
                        onTouchEnd: handleReaderTouchEnd,
                        onTouchCancel: handleReaderTouchCancel,
                        onMouseDown: handleReaderMouseDown,
                        onMouseUp: handleReaderMouseUp,
                        onMouseLeave: handleReaderMouseUp,
                        onScroll: (e) => { if (chapter) scrollPositionsRef.current[chapter.id] = e.currentTarget.scrollTop; },
                    } : {}) },
                    chapter ? (React.createElement("div", { key: readingMode ? chapter.id : 'editor', className: "reading-container" + (readingMode && pageAnim ? ' page-slide-' + pageAnim : '') },
                        React.createElement(ChapterEditor, { chapter: chapter, onChangeHtml: (html) => updateChapterText(chapter.id, html), onWordCountChange: setLiveChapterWordCount, characters: project.characters, world: project.world, locations: project.locations, glossary: project.glossary, timeline: project.timeline, chapters: project.chapters, onJump: handleJump, readingMode: readingMode, readingSettings: readingSettings, unitTerm: unitTerm }))
                    ) : React.createElement("div", { className: "reading-container", style: { color: readingMode ? activeReadingTheme.muted : '#7A7A82' } }, "No chapter selected."))));
}
