import { useRef, useState } from 'react';
import type { PackSummary, Player } from '../types';

type PackFamily = { key: string; title: string; variants: PackSummary[] };

/** Packs whose ids differ only by a numeric suffix (`movies-tv`, `movies-tv-2`) share one card. */
function packFamilyKey(pack: PackSummary): string {
  return pack.id.replace(/-\d+$/, '');
}

function packFamilies(packs: PackSummary[]): PackFamily[] {
  const families = new Map<string, PackFamily>();
  for (const pack of packs) {
    const key = packFamilyKey(pack);
    const existing = families.get(key);
    if (existing) existing.variants.push(pack);
    else families.set(key, { key, title: pack.id === key ? pack.title : pack.title.replace(/\s+\d+$/, '').trim(), variants: [pack] });
  }
  return [...families.values()];
}

export function PackFamilyPicker({ packs, selectedId, onSelect }: { packs: PackSummary[]; selectedId: string | undefined; onSelect: (pack: PackSummary) => void }) {
  return <div className="lobby-pack-enhancement-mount">
    <div className="enhanced-pack-grid">
      {packFamilies(packs).map((family) => {
        const selectedVariant = family.variants.find((variant) => variant.id === selectedId);
        const activeVariant = selectedVariant ?? family.variants[0];
        return <article key={family.key} className={`enhanced-pack-card${selectedVariant ? ' selected' : ''}`}>
          <button type="button" className="enhanced-pack-main" aria-pressed={Boolean(selectedVariant)} onClick={() => onSelect(activeVariant)}>
            <strong>{family.title}</strong>
            <span>{activeVariant.theme}</span>
            <small>{activeVariant.questionCount} questions</small>
          </button>
          {family.variants.length > 1 && <select
            className="pack-version-select"
            aria-label={`${family.title} version`}
            value={activeVariant.id}
            onChange={(event) => {
              const pack = family.variants.find((variant) => variant.id === event.target.value);
              if (pack) onSelect(pack);
            }}
          >
            {family.variants.map((variant) => <option key={variant.id} value={variant.id}>{variant.title}</option>)}
          </select>}
        </article>;
      })}
    </div>
  </div>;
}

/** Same ordering the engine uses: the saved custom order first, then everyone else by seat. */
function orderedForRotation(players: Player[], turnOrder: string[]): Player[] {
  const rank = new Map(turnOrder.map((playerId, index) => [playerId, index]));
  return [...players].sort((a, b) => (rank.get(a.id) ?? Infinity) - (rank.get(b.id) ?? Infinity) || a.seat - b.seat);
}

export function TurnOrderEditor({ players, turnOrder, onReorder }: { players: Player[]; turnOrder: string[]; onReorder: (order: string[]) => void }) {
  const draggedIdRef = useRef('');
  const [draggingId, setDraggingId] = useState('');
  const ordered = orderedForRotation(players, turnOrder);

  const moveBefore = (sourceId: string, targetId: string) => {
    if (!sourceId || sourceId === targetId) return;
    const order = ordered.map((player) => player.id).filter((playerId) => playerId !== sourceId);
    const targetIndex = order.indexOf(targetId);
    order.splice(targetIndex < 0 ? order.length : targetIndex, 0, sourceId);
    onReorder(order);
  };

  return <div className="lobby-turn-order-mount">
    <section className="manual-turn-order-v2">
      <div className="manual-turn-order-head">
        <strong>Custom turn rotation</strong>
        <small>Drag players to set the rotation order.</small>
      </div>
      <div className="manual-turn-order-list" role="list">
        {ordered.length ? ordered.map((player, index) => <div
          key={player.id}
          role="listitem"
          draggable
          data-player-id={player.id}
          className={`turn-order-chip${player.connected ? '' : ' disconnected'}${draggingId === player.id ? ' dragging' : ''}`}
          title={player.connected ? `Drag ${player.name} to reorder` : `${player.name} is disconnected but keeps this rotation slot`}
          onDragStart={(event) => {
            draggedIdRef.current = player.id;
            setDraggingId(player.id);
            event.dataTransfer.setData('text/plain', player.id);
            event.dataTransfer.effectAllowed = 'move';
          }}
          onDragEnd={() => { draggedIdRef.current = ''; setDraggingId(''); }}
          onDragOver={(event) => { event.preventDefault(); event.dataTransfer.dropEffect = 'move'; }}
          onDrop={(event) => {
            event.preventDefault();
            moveBefore(event.dataTransfer.getData('text/plain') || draggedIdRef.current, player.id);
          }}
        >
          <b>{index + 1}</b><span className="drag-grip" aria-hidden="true">⋮⋮</span><span className="turn-order-avatar">{player.avatar}</span><strong>{player.name}</strong>
        </div>) : <span className="manual-turn-order-empty">Players will appear here as they join.</span>}
      </div>
    </section>
  </div>;
}
