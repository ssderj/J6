import React, { createContext, useContext, useState, useRef, useEffect } from 'react';


// ---------- Universal navigation (Back button, breadcrumbs, scroll restoration) ----------
// A single history stack shared by the whole app — Home, the Grand Library, the Writer Profile,
// every Project Workspace tab, and anything nested inside them. Any screen that descends a level
// calls nav.push() with a breadcrumb label and an `undo` function that restores whatever was
// showing before. UniversalBackButton and Breadcrumbs both read this same stack, so Back always
// returns to wherever the reader actually came from (never hard-coded to Home), and the
// breadcrumb trail always matches exactly what Back will do.
export const NavContext = createContext(null);


export function useNav() {
    return useContext(NavContext);
}


// Single registry of every font-size value currently in use, keyed by that same pixel value.
// This pass only centralizes the numbers (each call site now reads TYPE_SCALE[N] instead of a
// bare N) without changing any of them, so nothing should look different. It's a literal
// registry, not a designed scale -- a real type scale (fewer, deliberately-chosen steps) is a
// good follow-up once someone can review the visual result in-browser rather than from code alone.
export const TYPE_SCALE = {
  8.5: 9, 9: 9, 9.5: 10, 10: 10, 10.5: 11, 11: 11, 11.5: 12, 12: 12, 12.5: 13, 13: 13, 13.5: 14, 14: 14, 14.5: 15, 15: 15, 15.5: 16, 16: 16, 17: 18, 18: 18, 19: 20, 20: 20, 21: 22, 22: 22, 24: 26, 25: 26, 26: 26, 28: 30, 30: 30, 32: 34, 34: 34, 38: 38, 46: 46, 6: 6
};


// Single registry of every border-radius value currently in use. Same non-consolidating
// approach as TYPE_SCALE above -- centralizes without changing any values.
export const RADIUS_SCALE = {
  1: 2, 2: 2, 3: 2, 4: 5, 5: 5, 6: 6, 7: 6, 8: 8, 9: 8, 10: 10, 11: 12, 12: 12, 14: 14, 15: 14, 16: 16, 18: 16, 20: 20, 100: 100, 999: 999
};


// Single registry of every gap value currently in use. Same non-consolidating approach as
// TYPE_SCALE above. (padding/margin strings are not yet tokenized -- separate follow-up.)
export const SPACE_SCALE = {
  1: 2, 2: 2, 3: 4, 4: 4, 5: 6, 6: 6, 7: 6, 8: 8, 9: 10, 10: 10, 12: 12, 14: 14, 16: 16, 18: 18, 20: 20, 22: 22, 24: 24
};


export function NavigationProvider({ rootLabel, children }) {
    const [stack, setStack] = useState([{ label: rootLabel || 'Home', key: 'root' }]);
    // Scroll offsets keyed by a caller-chosen string (see NavScrollBox) so returning to a screen —
    // via Back, a breadcrumb click, or just switching tabs and back — restores exactly where the
    // reader left off instead of snapping to the top.
    const scrollPositions = useRef({});
    const push = (entry) => {
        setStack((s) => [...s, { key: entry.label + ':' + s.length + ':' + Date.now(), ...entry }]);
    };
    const pop = () => {
        setStack((s) => {
            if (s.length <= 1)
                return s;
            const leaving = s[s.length - 1];
            if (leaving.undo)
                leaving.undo();
            return s.slice(0, -1);
        });
    };
    const goTo = (index) => {
        setStack((s) => {
            if (index >= s.length - 1 || index < 0)
                return s;
            // Undo every level from the top down to (but not including) the target, so jumping
            // straight to a breadcrumb three levels up leaves state exactly as three Backs would.
            for (let i = s.length - 1; i > index; i--) {
                if (s[i].undo)
                    s[i].undo();
            }
            return s.slice(0, index + 1);
        });
    };
    // Used when a whole new top-level context replaces the current one outright (deleting the
    // project you're standing in, for instance) rather than descending from it — trail restarts
    // from Home instead of trying to undo a screen that no longer makes sense.
    const resetTo = (entry) => {
        setStack(entry ? [{ label: rootLabel || 'Home', key: 'root' }, entry] : [{ label: rootLabel || 'Home', key: 'root' }]);
    };
    const saveScroll = (key, top) => { scrollPositions.current[key] = top; };
    const getScroll = (key) => scrollPositions.current[key] || 0;
    const value = { stack, push, pop, goTo, resetTo, saveScroll, getScroll };
    return React.createElement(NavContext.Provider, { value }, children);
}


// Consistent Back button for every page in the app. Always labeled with, and always returns to,
// whatever page the reader actually came from — not a hard-coded trip to Home.
export function UniversalBackButton({ style, compact }) {
    const nav = useNav();
    if (!nav || nav.stack.length <= 1)
        return null;
    const prev = nav.stack[nav.stack.length - 2];
    return React.createElement("button", {
        onClick: () => nav.pop(), className: "ink-universal-back", title: "Back to " + prev.label,
        style: Object.assign({
            display: 'inline-flex', alignItems: 'center', gap: SPACE_SCALE[6], background: 'none',
            border: '1px solid #2A2A30', color: '#C4C4CC', borderRadius: RADIUS_SCALE[8],
            padding: compact ? '5px 10px' : '7px 13px', fontSize: compact ? 12 : 13, cursor: 'pointer',
            fontFamily: 'inherit', transition: 'border-color var(--ink-dur) var(--ink-ease), color var(--ink-dur) var(--ink-ease)',
        }, style),
    }, "\u2190 ", prev.label);
}


// Breadcrumb trail, e.g. Home › Grand Library › Book › Reviews. Every crumb but the last is
// clickable and jumps straight back to that level via nav.goTo — same restore logic Back uses.
export function Breadcrumbs({ style }) {
    const nav = useNav();
    if (!nav || nav.stack.length <= 1)
        return null;
    return React.createElement("div", { style: Object.assign({
            display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: SPACE_SCALE[4], fontSize: TYPE_SCALE[12.5],
            color: '#8A8A92', marginBottom: 14,
        }, style) },
        nav.stack.map((entry, i) => {
            const isLast = i === nav.stack.length - 1;
            return React.createElement(React.Fragment, { key: entry.key },
                i > 0 && React.createElement("span", { style: { opacity: 0.5, padding: '0 2px' } }, "\u203A"),
                React.createElement("button", {
                    onClick: () => !isLast && nav.goTo(i), disabled: isLast,
                    style: {
                        background: 'none', border: 'none', padding: '2px 3px', font: 'inherit',
                        color: isLast ? '#EFE7D2' : '#8A8A92', fontWeight: isLast ? 600 : 400,
                        cursor: isLast ? 'default' : 'pointer',
                    },
                }, entry.label));
        }));
}


// Wraps a scrollable region so its scroll position survives navigating away and back — through
// Back, a breadcrumb jump, or switching tabs and returning. `navKey` should be unique to the
// content shown (include a project/book id and tab) so different screens don't share one offset.
export function NavScrollBox({ navKey, className, style, children }) {
    const nav = useNav();
    const ref = useRef(null);
    useEffect(() => {
        const el = ref.current;
        if (!el || !nav)
            return;
        el.scrollTop = nav.getScroll(navKey);
        const onScroll = () => nav.saveScroll(navKey, el.scrollTop);
        el.addEventListener('scroll', onScroll, { passive: true });
        return () => {
            nav.saveScroll(navKey, el.scrollTop);
            el.removeEventListener('scroll', onScroll);
        };
    }, [navKey]);
    return React.createElement("div", { ref, className, style }, children);
}
