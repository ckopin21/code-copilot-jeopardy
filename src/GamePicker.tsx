import { useState } from 'react';
import type { ClientGame } from './games/registry';
import { emitAck } from './platform/net/socket';
import { navigateInApp, pickerUrl } from './platform/session/resetInstance';

/**
 * The launcher at `/`: pick a game, or type a room key to join whichever game owns it.
 * Old links without `?game=` but with `?mode=` still open trivia (see gameForUrl).
 */
export function GamePicker({ games }: { games: readonly ClientGame[] }) {
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const join = async () => {
    const roomCode = code.trim().toUpperCase();
    if (roomCode.length < 4) return;
    setBusy(true);
    setError('');
    try {
      const { game } = await emitAck<{ game: string }>('room:lookup', { roomCode });
      const url = new URL(pickerUrl());
      url.search = new URLSearchParams({ game, mode: 'player', room: roomCode }).toString();
      navigateInApp(url.toString());
    } catch {
      setError('No game with that room key is running. Check the key on the TV.');
    } finally {
      setBusy(false);
    }
  };

  return <main className="game-picker">
    <h1>Blue Stage Games</h1>
    <form className="game-picker-join" onSubmit={(event) => { event.preventDefault(); void join(); }}>
      <label htmlFor="picker-room">Joining a game? Enter the room key</label>
      <div>
        <input id="picker-room" value={code} onChange={(event) => setCode(event.target.value.toUpperCase())} maxLength={8} autoCapitalize="characters" autoComplete="off" placeholder="ABCD"/>
        <button disabled={busy || code.trim().length < 4}>{busy ? '…' : 'Join'}</button>
      </div>
      {error && <p role="alert">{error}</p>}
    </form>
    <h2>Or pick a game to host</h2>
    <ul>
      {games.map((game) => <li key={game.id}>
        <button onClick={() => { const url = new URL(pickerUrl()); url.searchParams.set('game', game.id); navigateInApp(url.toString()); }}>
          <b>{game.title}</b>
          <span>{game.blurb}</span>
        </button>
      </li>)}
    </ul>
    <style>{PICKER_CSS}</style>
  </main>;
}

const PICKER_CSS = `
.game-picker { min-height: 100vh; box-sizing: border-box; padding: 32px 16px; display: grid; align-content: start; justify-items: center; gap: 18px;
  background: radial-gradient(circle at 30% 0%, #1d3f8f, #071a52 55%, #040c28); color: #eaf4ff; font-family: system-ui, "Segoe UI", sans-serif; }
.game-picker h1 { margin: 12px 0 0; font-size: clamp(28px, 6vw, 48px); letter-spacing: 0.02em; }
.game-picker h2 { margin: 8px 0 0; font-size: 18px; font-weight: 600; opacity: 0.85; }
.game-picker-join { width: min(460px, 100%); display: grid; gap: 8px; background: #ffffff14; border: 1px solid #ffffff2a; border-radius: 16px; padding: 16px; }
.game-picker-join div { display: flex; gap: 8px; }
.game-picker-join input { flex: 1; min-width: 0; font-size: 26px; letter-spacing: 0.2em; text-align: center; padding: 10px; border-radius: 10px; border: 0; }
.game-picker-join button { font-size: 18px; padding: 0 18px; border-radius: 10px; border: 0; background: #ffc24a; color: #1d1300; font-weight: 800; }
.game-picker-join button:disabled { opacity: 0.5; }
.game-picker-join p { margin: 0; color: #ffb3b3; }
.game-picker ul { list-style: none; padding: 0; margin: 0; width: min(460px, 100%); display: grid; gap: 12px; }
.game-picker li button { width: 100%; text-align: left; display: grid; gap: 4px; padding: 18px; border-radius: 16px; border: 1px solid #ffffff33; background: #ffffff10; color: inherit; cursor: pointer; }
.game-picker li button:hover { background: #ffffff1e; }
.game-picker li b { font-size: 22px; }
.game-picker li span { opacity: 0.8; }
`;
