// The lobby's "Join on your phone" card: QR code, room key and link. Shown on the Host tab and the TV display.
import { useEffect, useState, type ReactNode } from 'react';
import type { DealSnapshot } from '../types';

function useQr(value: string | undefined): string | null {
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!value) return;
    fetch(`/api/qr?value=${encodeURIComponent(value)}`).then((response) => response.json()).then((data: { dataUrl?: string }) => setDataUrl(data.dataUrl ?? null)).catch(() => setDataUrl(null));
  }, [value]);
  return dataUrl;
}

/** `children` is the player list, which differs between the Host tab (with host tools) and the TV display. */
export function JoinCard({ room, joinUrl, children }: { room: DealSnapshot; joinUrl: string; children?: ReactNode }) {
  const qr = useQr(joinUrl || undefined);
  return <aside className="dod-join">
    <h2>Join on your phone</h2>
    {qr ? <img src={qr} alt="QR code to join"/> : <div className="dod-qr-placeholder"/>}
    <p className="dod-room-key">Room key <b>{room.code}</b></p>
    {joinUrl && <p className="dod-url">{joinUrl.replace(/^https?:\/\//, '')}</p>}
    {children}
  </aside>;
}

/** The plain player list for screens without host tools. */
export function JoinedList({ room }: { room: DealSnapshot }) {
  return <ul>{room.players.map((player) => <li key={player.id} className={player.lookSet ? 'ready' : ''}>
    {player.name}{player.lookSet ? ' ✓' : ' (choosing avatar…)'}{player.connected ? '' : ' · offline'}
  </li>)}</ul>;
}
