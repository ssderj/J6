import React from 'react';


// ---------- Text helpers ----------
export function stripHtml(html) {
    return (html || '').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ');
}


export function wordCount(text) {
    const t = stripHtml(text).trim();
    return t ? t.split(/\s+/).length : 0;
}
