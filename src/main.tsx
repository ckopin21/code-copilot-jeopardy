import React from 'react';
import ReactDOM from 'react-dom/client';
import './lib/roomStorageRecovery';
import './lib/lobbySetupEnhancements';
import './lib/hostFullscreenControl';
import App from './App';
import { MenuMusicPickerPortal } from './components/BackgroundMusicPicker';
import './responsive-player-cards.css';
import './endgame-menu-fixes.css';
import './menu-desktop-layout.css';
import './space-efficiency.css';
import './turn-rules-polish.css';
import './pack-library.css';
import './gameplay-regression-fixes.css';
import './lobby-setup-fixes.css';
import './round-start-result-fixes.css';
import './background-music.css';

ReactDOM.createRoot(document.getElementById('root')!).render(<React.StrictMode><App/><MenuMusicPickerPortal/></React.StrictMode>);

// Late-loaded regression styles intentionally win cascade conflicts in game overlays.
