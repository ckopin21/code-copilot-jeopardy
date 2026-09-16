from pathlib import Path

path = Path('src/App.tsx')
text = path.read_text()

preview = '''      {hasSavedHost && savedHost && <article
        className="saved-game-preview"
        role="button"
        tabIndex={0}
        aria-label={`Continue saved game in room ${savedHost.roomCode}`}
        onClick={() => void onNavigate('host')}
        onKeyDown={(event) => {
          if (event.key !== 'Enter' && event.key !== ' ') return;
          event.preventDefault();
          void onNavigate('host');
        }}
      >
        <div className="saved-game-icon" aria-hidden="true">▶</div>
        <div className="saved-game-main"><small>CONTINUE SAVED GAME</small><strong>Room {savedHost.roomCode}</strong><span>{savedPhase}</span></div>
        <div className="saved-game-meta"><b>{savedPlayers}</b>{preview && preview.phase !== 'lobby' && preview.phase !== 'recap' && <span>{preview.remainingQuestions} questions left</span>}<small>Last played {savedActivity}</small></div>
      </article>}

'''

if preview not in text:
    raise SystemExit('saved preview block not found')
text = text.replace(preview, '', 1)

old_actions = '''          <div className="menu-actions host-menu-actions">
            {hasSavedHost && <button className="primary-button menu-primary menu-continue" onClick={() => void onNavigate('host')}><span>Continue Game</span><small>Return to room {savedHost?.roomCode}</small></button>}
            <button className={`${hasSavedHost ? 'secondary-button menu-secondary' : 'primary-button menu-primary'} menu-new-game`} onClick={startNewGame}><span>Start New Game</span><small>Fresh room, fresh board, zero scores</small></button>
          </div>'''

new_actions = '''          <div className="menu-actions host-menu-actions">
            <button className={`${hasSavedHost ? 'secondary-button menu-secondary' : 'primary-button menu-primary'} menu-new-game`} onClick={startNewGame}><span>Start New Game</span><small>Fresh room, fresh board, zero scores</small></button>
            {hasSavedHost && savedHost && <article
              className="saved-game-preview saved-game-inline"
              role="button"
              tabIndex={0}
              aria-label={`Continue saved game in room ${savedHost.roomCode}`}
              onClick={() => void onNavigate('host')}
              onKeyDown={(event) => {
                if (event.key !== 'Enter' && event.key !== ' ') return;
                event.preventDefault();
                void onNavigate('host');
              }}
            >
              <div className="saved-game-icon" aria-hidden="true">▶</div>
              <div className="saved-game-main"><small>CONTINUE SAVED GAME</small><strong>Room {savedHost.roomCode}</strong><span>{savedPhase}</span></div>
              <div className="saved-game-meta"><b>{savedPlayers}</b>{preview && preview.phase !== 'lobby' && preview.phase !== 'recap' && <span>{preview.remainingQuestions} questions left</span>}<small>Last played {savedActivity}</small></div>
            </article>}
          </div>'''

if old_actions not in text:
    raise SystemExit('host actions block not found')
text = text.replace(old_actions, new_actions, 1)
path.write_text(text)
