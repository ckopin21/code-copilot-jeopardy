import React from 'react';
import ReactDOM from 'react-dom/client';
import './lib/roomStorageRecovery';
import './lib/lobbySetupEnhancements';
import './lib/hostFullscreenControl';
import App from './App';
import { DevModeOverlay } from './components/DevModeOverlay';
import { DevPresentationLab } from './components/DevPresentationLab';
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
import './comeback-boosts.css';
import './dev-mode.css';
import './dev-presentation-lab.css';

ReactDOM.createRoot(document.getElementById('root')!).render(<React.StrictMode><App/><DevModeOverlay/><DevPresentationLab/></React.StrictMode>);

// Late-loaded regression styles intentionally win cascade conflicts in game overlays.
