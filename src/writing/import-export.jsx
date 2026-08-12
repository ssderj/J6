import React, { useState } from 'react';
import { EmptyState, SectionLabel } from '../shared-ui/ui-cards.jsx';
import { stripHtml } from '../shared-utils/strip-html.jsx';
import { uuid } from '../shared-utils/storage-keys.jsx';
import { RADIUS_SCALE, SPACE_SCALE, TYPE_SCALE } from '../shell/nav-context.jsx';
import { ComingSoonNotice } from './coming-soon-notice.jsx';


// ---------- Import Work ----------
// Plain-text (.txt) manuscripts are fully supported: read entirely on-device with FileReader,
// no upload anywhere. If the text contains lines that look like chapter headings ("Chapter 3",
// "Chapter Two \u2014 Homecoming"\u2026) it's split into real chapters with real titles; otherwise the
// whole file becomes a single chapter, exactly as the user wrote it \u2014 text is never trimmed,
// summarized, or rewritten. DOCX/PDF/EPUB import needs real parsing libraries this build doesn't
// carry yet, so rather than half-support them (and quietly mangle someone's manuscript), they're
// an honest Coming Soon \u2014 same policy as every other Coming Soon spot in Inkroot.
const CHAPTER_HEADING_RE = /^\s*chapter\s+([A-Za-z0-9]+)\s*[:\-\u2013]?\s*(.*)$/i;


function escapeHtmlText(s) {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}


function textToChapterHtml(paragraphs) {
    return paragraphs.filter((p) => p.trim() !== '').map((p) => `<div>${escapeHtmlText(p)}</div>`).join('') || '<div><br></div>';
}


// Splits raw .txt content into { title, text } chapters. Falls back to a single chapter
// containing everything when no "Chapter \u2026" headings are found.
export function parseTxtManuscript(raw) {
    const lines = (raw || '').replace(/\r\n/g, '\n').split('\n');
    const headingIdx = [];
    lines.forEach((line, i) => { if (CHAPTER_HEADING_RE.test(line))
        headingIdx.push(i); });
    if (headingIdx.length === 0) {
        return [{ title: 'Chapter 1', text: textToChapterHtml(lines) }];
    }
    const chapters = [];
    headingIdx.forEach((startIdx, i) => {
        const endIdx = i + 1 < headingIdx.length ? headingIdx[i + 1] : lines.length;
        const m = lines[startIdx].match(CHAPTER_HEADING_RE);
        const title = (m[2] && m[2].trim()) || `Chapter ${m[1]}`;
        const body = lines.slice(startIdx + 1, endIdx);
        chapters.push({ title, text: textToChapterHtml(body) });
    });
    return chapters;
}


export function ImportWorkPanel({ project, update }) {
    const [preview, setPreview] = useState(null); // { fileName, chapters } | null
    const [imported, setImported] = useState(false);
    const handleFile = (e) => {
        const file = e.target.files && e.target.files[0];
        e.target.value = '';
        if (!file)
            return;
        setImported(false);
        const reader = new FileReader();
        reader.onload = () => {
            const chapters = parseTxtManuscript(String(reader.result || ''));
            setPreview({ fileName: file.name, chapters });
        };
        reader.readAsText(file);
    };
    const handleImport = () => {
        if (!preview)
            return;
        update((p) => {
            const startNumber = (p.chapters.reduce((m, c) => Math.max(m, c.number || 0), 0) || 0) + 1;
            preview.chapters.forEach((ch, i) => {
                p.chapters.push({ id: uuid(), title: ch.title, text: ch.text, number: startNumber + i, isCopy: false });
            });
        });
        setImported(true);
        setPreview(null);
    };
    return React.createElement("div", null,
        React.createElement(SectionLabel, null, "Import Work"),
        React.createElement("div", { style: { fontSize: TYPE_SCALE[13], color: '#7A7A82', marginBottom: 20, maxWidth: 560, lineHeight: 1.6 } }, "Bring an existing manuscript into this project. Chapters, text, and any \"Chapter \u2026\" headings are preserved \u2014 imported chapters are added after what's already here, never replacing it."),
        React.createElement("div", { style: { display: 'flex', flexDirection: 'column', gap: SPACE_SCALE[10], maxWidth: 560, marginBottom: 20 } },
            React.createElement("div", { style: { background: '#1D1D22', border: '1px solid #2A2A30', borderRadius: RADIUS_SCALE[10], padding: 16 } },
                React.createElement("div", { style: { fontSize: TYPE_SCALE[14], fontWeight: 600, color: '#EFE7D2', marginBottom: 4 } }, "\uD83D\uDCC4 Plain text (.txt)"),
                React.createElement("div", { style: { fontSize: TYPE_SCALE[11.5], color: '#7A7A82', marginBottom: 12, lineHeight: 1.5 } }, "Lines like \"Chapter 3\" or \"Chapter Two \u2014 Homecoming\" become real chapter breaks; otherwise the whole file imports as one chapter."),
                React.createElement("label", { style: {
                        display: 'inline-block', background: 'linear-gradient(160deg, #241F14, #1A160D)', border: '1px solid #4A3D22', color: '#E8C468',
                        borderRadius: RADIUS_SCALE[8], padding: '9px 16px', fontSize: TYPE_SCALE[13], fontWeight: 600, cursor: 'pointer',
                    } }, "Choose a .txt file\u2026",
                    React.createElement("input", { type: "file", accept: ".txt,text/plain", onChange: handleFile, style: { display: 'none' } }))),
            React.createElement(ComingSoonNotice, { icon: "\uD83D\uDCD8", text: "Word (.docx) import needs a document parser this build doesn't carry yet." }),
            React.createElement(ComingSoonNotice, { icon: "\uD83D\uDCD5", text: "PDF import needs a PDF text extractor this build doesn't carry yet." }),
            React.createElement(ComingSoonNotice, { icon: "\uD83D\uDCD7", text: "EPUB import needs an EPUB parser this build doesn't carry yet." })),
        preview && React.createElement("div", { style: { maxWidth: 560, background: 'linear-gradient(160deg, #211C13, #17130E)', border: '1px solid #3A3020', borderRadius: RADIUS_SCALE[12], padding: 16, marginBottom: 20 } },
            React.createElement("div", { style: { fontSize: TYPE_SCALE[13], fontWeight: 600, color: '#EFE7D2', marginBottom: 6 } }, preview.fileName),
            React.createElement("div", { style: { fontSize: TYPE_SCALE[12], color: '#A6A6AD', marginBottom: 14 } }, `${preview.chapters.length} chapter${preview.chapters.length === 1 ? '' : 's'} found \u2014 will be added after this project's existing ${project.chapters.length} chapter${project.chapters.length === 1 ? '' : 's'}.`),
            React.createElement("div", { style: { display: 'flex', flexDirection: 'column', gap: SPACE_SCALE[4], marginBottom: 14, maxHeight: 160, overflowY: 'auto' } },
                preview.chapters.map((ch, i) => React.createElement("div", { key: i, style: { fontSize: TYPE_SCALE[11.5], color: '#7A7A82' } }, `${i + 1}. ${ch.title}`))),
            React.createElement("div", { style: { display: 'flex', gap: SPACE_SCALE[10] } },
                React.createElement("button", { onClick: handleImport, style: {
                        background: 'linear-gradient(160deg, #241F14, #1A160D)', border: '1px solid #4A3D22', color: '#E8C468',
                        borderRadius: RADIUS_SCALE[8], padding: '9px 16px', fontSize: TYPE_SCALE[13], fontWeight: 600, cursor: 'pointer',
                    } }, "Import into this project"),
                React.createElement("button", { onClick: () => setPreview(null), style: {
                        background: 'none', border: '1px solid #2A2A30', color: '#A6A6AD', borderRadius: RADIUS_SCALE[8],
                        padding: '9px 16px', fontSize: TYPE_SCALE[13], cursor: 'pointer',
                    } }, "Cancel"))),
        imported && React.createElement("div", { style: { fontSize: TYPE_SCALE[12.5], color: '#8FCB8F', maxWidth: 560 } }, "Imported \u2014 the new chapters are now in this project's Manuscript."));
}


// ---------- Export Work ----------
// A manuscript export is a *copy of the writing itself* for use outside Inkroot \u2014 separate
// from the Settings tab's "Download backup (.json)" button, which saves this project's entire
// working data (characters, world, timeline, everything) so it can be restored back into Inkroot.
// The two never merge: exporting a manuscript here never replaces or touches that JSON backup.
// Plain text export is real, on-device, no dependencies. DOCX/PDF/EPUB each need a real generator
// library this build doesn't carry yet \u2014 marked Coming Soon rather than producing a file that
// only looks right.
function downloadTextFile(filename, content) {
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
}


export function buildManuscriptText(project) {
    const parts = [];
    if (project.title)
        parts.push(project.title.toUpperCase());
    if (project.author)
        parts.push(`by ${project.author}`);
    parts.push('');
    (project.chapters || []).slice().sort((a, b) => (a.number || 0) - (b.number || 0)).forEach((ch) => {
        parts.push(ch.title || `Chapter ${ch.number || ''}`);
        parts.push('');
        parts.push(stripHtml(ch.text).trim());
        parts.push('');
        parts.push('');
    });
    return parts.join('\n');
}


export function ExportWorkPanel({ project }) {
    const handleTxt = () => {
        const filename = (project.title || 'manuscript').trim().toLowerCase().replace(/\s+/g, '-') + '.txt';
        downloadTextFile(filename, buildManuscriptText(project));
    };
    return React.createElement("div", null,
        React.createElement(SectionLabel, null, "Export Work"),
        React.createElement("div", { style: { fontSize: TYPE_SCALE[13], color: '#7A7A82', marginBottom: 20, maxWidth: 560, lineHeight: 1.6 } }, "Export this manuscript for reading or editing outside Inkroot. This is separate from the project backup in Settings, which saves everything (characters, world, timeline) so it can be restored back into Inkroot."),
        project.chapters.length === 0
            ? React.createElement(EmptyState, { text: "Nothing to export yet \u2014 add a chapter first." })
            : React.createElement("div", { style: { display: 'flex', flexDirection: 'column', gap: SPACE_SCALE[10], maxWidth: 560 } },
                React.createElement("div", { style: { background: '#1D1D22', border: '1px solid #2A2A30', borderRadius: RADIUS_SCALE[10], padding: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: SPACE_SCALE[12], flexWrap: 'wrap' } },
                    React.createElement("div", null,
                        React.createElement("div", { style: { fontSize: TYPE_SCALE[14], fontWeight: 600, color: '#EFE7D2' } }, "\uD83D\uDCC4 Plain text (.txt)"),
                        React.createElement("div", { style: { fontSize: TYPE_SCALE[11.5], color: '#7A7A82', marginTop: 4 } }, "All chapters, in order, as plain text.")),
                    React.createElement("button", { onClick: handleTxt, style: {
                            background: 'linear-gradient(160deg, #241F14, #1A160D)', border: '1px solid #4A3D22', color: '#E8C468',
                            borderRadius: RADIUS_SCALE[8], padding: '9px 16px', fontSize: TYPE_SCALE[13], fontWeight: 600, cursor: 'pointer', flexShrink: 0,
                        } }, "Export .txt")),
                React.createElement(ComingSoonNotice, { icon: "\uD83D\uDCD8", text: "Word (.docx) export needs a document generator this build doesn't carry yet." }),
                React.createElement(ComingSoonNotice, { icon: "\uD83D\uDCD5", text: "PDF export needs a PDF generator this build doesn't carry yet." }),
                React.createElement(ComingSoonNotice, { icon: "\uD83D\uDCD7", text: "EPUB export needs an EPUB generator this build doesn't carry yet." })));
}
