import React from 'react';
import ReactDOM from 'react-dom/client';
import './lib/roomStorageRecovery';
import App from './App';
import './responsive-player-cards.css';
import './endgame-menu-fixes.css';
import './menu-desktop-layout.css';
import './space-efficiency.css';
import './turn-rules-polish.css';
import './pack-library.css';
import './gameplay-regression-fixes.css';

ReactDOM.createRoot(document.getElementById('root')!).render(<React.StrictMode><App/></React.StrictMode>);

// Late-loaded regression styles intentionally win cascade conflicts in game overlays.
