import React from 'react';
import { InkRoot } from './ink-root.jsx';
import { NavigationProvider } from './nav-context.jsx';


// The original file's own mount call (`ReactDOM.createRoot(...).render(...)`) has been removed
// — main.jsx owns mounting now. This wrapper is what main.jsx renders in place of the
// placeholder, once you swap it in (see the TODO comment there).
export default function InkrootApp() {
    return React.createElement(NavigationProvider, { rootLabel: 'Home' }, React.createElement(InkRoot, null));
}
