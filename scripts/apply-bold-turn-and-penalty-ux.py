from pathlib import Path


def replace_once(path: str, old: str, new: str) -> None:
    file = Path(path)
    text = file.read_text()
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{path}: expected exactly one match, found {count}: {old[:120]!r}")
    file.write_text(text.replace(old, new, 1))


# Make unanswered manual reveals use the same visible score-flight system as judged answers.
replace_once(
    "src/components/HostAppV3.tsx",
    "  const revealAnswer = async () => {\n    if (!current || revealRunningRef.current) return;\n    const ok = await perform('host:reveal-answer');\n    if (!ok) return;\n    audio.cue('reveal');\n  };",
    "  const revealAnswer = async () => {\n    if (!current || revealRunningRef.current) return;\n    const unansweredOwnerId = current.responseMode !== 'text' && !current.dailyDouble && !current.buzzWinnerId && !current.answerRevealed\n      ? current.turnPlayerId\n      : null;\n    const penaltyFlight = unansweredOwnerId ? prepareScoreFlight(unansweredOwnerId, false) : null;\n    const ok = await perform('host:reveal-answer');\n    if (!ok) {\n      if (unansweredOwnerId) cancelPreparedScore(unansweredOwnerId);\n      return;\n    }\n    if (penaltyFlight) setScoreFlights((previous) => [...previous, penaltyFlight]);\n    audio.cue('reveal');\n  };",
)
replace_once(
    "src/components/HostAppV3.tsx",
    '<article className="question-card-v2 showcase-question-card">',
    '<article className="question-card-v2 showcase-question-card" data-question-id={current.questionId}>',
)

# Remote presentation uses the same authoritative turn ownership as the host scoreboard.
replace_once(
    "src/components/PresentationApp.tsx",
    '<PlayerStrip players={room.players} activeId={active}/>',
    '<PlayerStrip players={room.players} activeId={active} turnId={room.phase === \'lobby\' || room.phase === \'recap\' ? null : room.turnPlayerId}/>',
)

# Replace the small TURN chip with a stronger stage cue.
replace_once(
    "src/components/PlayerStrip.tsx",
    '{turnId === player.id && <span className="turn-pill">TURN</span>}',
    '{turnId === player.id && <span className="turn-beacon"><i>★</i><b>SELECTS NEXT</b></span>}',
)

# Local board presentation also gets the turn treatment.
replace_once(
    "src/components/BoardPresentation.tsx",
    "          return <div className={`presentation-name-card ${player.onFire ? 'is-fire' : ''} ${player.isCold ? 'is-cold' : ''}`} key={player.id} style={{ '--accent': player.accent } as React.CSSProperties}>",
    "          return <div className={`presentation-name-card ${room.turnPlayerId === player.id ? 'is-turn' : ''} ${player.onFire ? 'is-fire' : ''} ${player.isCold ? 'is-cold' : ''}`} key={player.id} style={{ '--accent': player.accent } as React.CSSProperties}>",
)
replace_once(
    "src/components/BoardPresentation.tsx",
    '<div className="presentation-player-main"><strong>{player.name}</strong><small>{status}</small></div>',
    '<div className="presentation-player-main"><strong>{player.name}</strong>{room.turnPlayerId === player.id ? <span className="presentation-turn-beacon">★ SELECTS NEXT</span> : <small>{status}</small>}</div>',
)

# Stronger visual hierarchy and a collision-proof categories intro.
css = Path("src/turn-rules-polish.css")
css_text = css.read_text()
marker = "/* Bold turn spotlight, safe category reveal layout, and unanswered-score animation source. */"
if marker in css_text:
    raise SystemExit("bold turn/category CSS block already exists")
css.write_text(css_text + r'''

/* Bold turn spotlight, safe category reveal layout, and unanswered-score animation source. */
.showcase-player-card.is-turn {
  position: relative;
  isolation: isolate;
  border-color: #ffd166 !important;
  background:
    radial-gradient(circle at 50% 0%, rgba(255,209,102,.20), transparent 54%),
    linear-gradient(135deg, rgba(102,72,0,.38), rgba(10,31,47,.97) 58%) !important;
  box-shadow:
    0 0 0 3px rgba(255,209,102,.72),
    0 0 34px rgba(255,209,102,.38),
    0 14px 34px rgba(0,0,0,.38) !important;
  transform: translateY(-2px) scale(1.025) !important;
  overflow: visible !important;
}
.showcase-player-card.is-turn::before {
  content: '';
  position: absolute;
  inset: -5px;
  z-index: -1;
  border-radius: inherit;
  border: 2px solid rgba(255,234,164,.34);
  box-shadow: 0 0 24px rgba(255,209,102,.35);
  animation: turnSpotlightPulse 1.15s ease-in-out infinite alternate;
  pointer-events: none;
}
.turn-beacon {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  margin-left: auto;
  padding: 4px 8px;
  border: 2px solid #ffe7a3;
  border-radius: 999px;
  background: linear-gradient(180deg,#ffd166,#d99b13);
  color: #211600;
  box-shadow: 0 3px 0 #7a5300, 0 0 16px rgba(255,209,102,.45);
  font-size: .5rem;
  line-height: 1;
  font-weight: 1000;
  letter-spacing: .08em;
  white-space: nowrap;
}
.turn-beacon i { font-style: normal; font-size: .72rem; }
.turn-beacon b { font: inherit; }

.presentation-name-card.is-turn {
  position: relative;
  isolation: isolate;
  border: 4px solid #ffd166 !important;
  background:
    radial-gradient(circle at 50% 0%, rgba(255,221,122,.28), transparent 60%),
    linear-gradient(160deg,#76510a,#123d57 70%) !important;
  box-shadow:
    0 0 0 3px rgba(255,231,163,.44),
    0 0 38px rgba(255,209,102,.48),
    0 12px 30px rgba(0,0,0,.4) !important;
  transform: translateY(-4px) scale(1.035);
  overflow: visible;
}
.presentation-name-card.is-turn::after {
  content: '★';
  position: absolute;
  top: -15px;
  left: 50%;
  translate: -50% 0;
  width: 28px;
  height: 28px;
  display: grid;
  place-items: center;
  border: 2px solid #fff0b8;
  border-radius: 50%;
  background: #ffd166;
  color: #281b00;
  box-shadow: 0 0 22px rgba(255,209,102,.65);
  font-size: .8rem;
  animation: turnStarPulse .9s ease-in-out infinite alternate;
}
.presentation-turn-beacon {
  width: max-content;
  max-width: 100%;
  margin-top: 3px;
  padding: 3px 7px;
  border-radius: 999px;
  background: #ffd166;
  color: #241800;
  font-size: .56rem;
  font-weight: 1000;
  letter-spacing: .08em;
  white-space: nowrap;
}

.game-transition-overlay.category-transition {
  overflow: hidden;
  padding: clamp(22px,4vh,52px) clamp(20px,4vw,64px) !important;
}
.game-transition-overlay.category-transition > section {
  width: min(1180px, 96vw);
  max-height: calc(100dvh - clamp(44px,8vh,104px));
  display: grid;
  grid-template-rows: auto auto minmax(0,1fr);
  align-content: center;
  gap: clamp(12px,2vh,22px);
  overflow: visible;
}
.game-transition-overlay.category-transition h1 {
  max-width: 100%;
  margin: 0 !important;
  font-size: clamp(2.8rem,min(7vw,9vh),6.4rem) !important;
  line-height: .94 !important;
}
.game-transition-overlay.category-transition .category-intro-grid {
  width: 100%;
  min-height: 0;
  margin: 0 !important;
  display: grid;
  grid-template-columns: repeat(3,minmax(0,1fr));
  gap: clamp(10px,1.4vw,16px);
  align-content: center;
}
.game-transition-overlay.category-transition .category-intro-grid span {
  min-width: 0;
  min-height: clamp(64px,9vh,92px);
  display: grid;
  place-items: center;
  padding: 12px 14px;
  line-height: 1.12;
  white-space: normal;
  overflow-wrap: anywhere;
  text-wrap: balance;
  opacity: 0;
  transform: none;
  animation: categoryIntroSafe .45s cubic-bezier(.18,.9,.25,1.1) forwards !important;
  animation-delay: calc(var(--intro-index) * 140ms + 420ms) !important;
}

@keyframes turnSpotlightPulse {
  from { opacity:.58; transform:scale(.985); filter:brightness(1); }
  to { opacity:1; transform:scale(1.018); filter:brightness(1.16); }
}
@keyframes turnStarPulse {
  from { transform:scale(.92) rotate(-5deg); filter:brightness(1); }
  to { transform:scale(1.12) rotate(5deg); filter:brightness(1.15); }
}
@keyframes categoryIntroSafe {
  from { opacity:0; transform:scale(.92); }
  to { opacity:1; transform:scale(1); }
}

@media (max-width: 760px) {
  .game-transition-overlay.category-transition .category-intro-grid {
    grid-template-columns: repeat(2,minmax(0,1fr));
  }
  .game-transition-overlay.category-transition .category-intro-grid span {
    min-height: 56px;
    padding: 9px 10px;
    font-size: .76rem;
  }
  .turn-beacon { padding: 3px 6px; font-size: .44rem; }
}

@media (prefers-reduced-motion: reduce) {
  .showcase-player-card.is-turn::before,
  .presentation-name-card.is-turn::after,
  .game-transition-overlay.category-transition .category-intro-grid span {
    animation: none !important;
    opacity: 1 !important;
    transform: none !important;
  }
}
''')
