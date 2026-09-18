import type { PackSummary, Player, RoomSnapshot } from '../shared/types';
import { clampDailyDoubleCount } from '../shared/config';
import { gameModeDefinition } from '../shared/gameModes';
import { readActiveHostCredentials } from './hostCredentials';
import { emitAck, socket } from './socket';

type PackFamily = { key: string; title: string; variants: PackSummary[] };

const ORDER_KEY_PREFIX = 'blue-stage-manual-turn-order-';
let room: RoomSnapshot | null = null;
let previousRoom: RoomSnapshot | null = null;
let packs: PackSummary[] = [];
let settingsUpdatePending = false;
let turnUpdatePending = false;
let draggedPlayerId = '';
let renderFrame = 0;

function isHostMode(): boolean {
  return new URLSearchParams(location.search).get('mode') === 'host';
}

function activeCredentials(roomCode?: string) {
  try {
    const credentials = readActiveHostCredentials();
    if (!credentials || (roomCode && credentials.roomCode !== roomCode)) return null;
    return credentials;
  } catch {
    return null;
  }
}

async function hostAction(event: string, payload: Record<string, unknown> = {}): Promise<void> {
  const credentials = activeCredentials(room?.code);
  if (!credentials) return;
  await emitAck(event, { roomCode: credentials.roomCode, hostToken: credentials.hostToken, ...payload });
}

function packFamilyKey(pack: PackSummary): string {
  return pack.id.replace(/-\d+$/, '');
}

function packBaseTitle(pack: PackSummary): string {
  return pack.id === packFamilyKey(pack) ? pack.title : pack.title.replace(/\s+\d+$/, '').trim();
}

function packFamilies(items: PackSummary[]): PackFamily[] {
  const families = new Map<string, PackFamily>();
  for (const pack of items) {
    const key = packFamilyKey(pack);
    const existing = families.get(key);
    if (existing) existing.variants.push(pack);
    else families.set(key, { key, title: packBaseTitle(pack), variants: [pack] });
  }
  return [...families.values()];
}

function orderStorageKey(roomCode: string): string {
  return `${ORDER_KEY_PREFIX}${roomCode}`;
}

function readStoredOrder(roomCode: string): string[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(orderStorageKey(roomCode)) ?? '[]') as unknown;
    return Array.isArray(parsed) ? parsed.filter((value): value is string => typeof value === 'string') : [];
  } catch {
    return [];
  }
}

function writeStoredOrder(roomCode: string, order: string[]): void {
  try { localStorage.setItem(orderStorageKey(roomCode), JSON.stringify(order)); } catch { /* optional preference storage */ }
}

function normalizedOrder(snapshot: RoomSnapshot): string[] {
  const validIds = new Set(snapshot.players.map((player) => player.id));
  const stored = readStoredOrder(snapshot.code).filter((playerId) => validIds.has(playerId));
  const missing = [...snapshot.players]
    .sort((left, right) => left.seat - right.seat)
    .map((player) => player.id)
    .filter((playerId) => !stored.includes(playerId));
  const next = [...stored, ...missing];
  if (next.join('|') !== readStoredOrder(snapshot.code).join('|')) writeStoredOrder(snapshot.code, next);
  return next;
}

function connectedInOrder(snapshot: RoomSnapshot): Player[] {
  const byId = new Map(snapshot.players.map((player) => [player.id, player]));
  return normalizedOrder(snapshot)
    .map((playerId) => byId.get(playerId))
    .filter((player): player is Player => Boolean(player?.connected));
}

function nextConnectedAfter(snapshot: RoomSnapshot, playerId: string | null | undefined): Player | null {
  const connected = connectedInOrder(snapshot);
  if (!connected.length) return null;
  const currentIndex = connected.findIndex((player) => player.id === playerId);
  return currentIndex < 0 ? connected[0] : connected[(currentIndex + 1) % connected.length];
}

function enforceAutomaticRules(snapshot: RoomSnapshot): void {
  if (snapshot.phase !== 'lobby' || settingsUpdatePending) return;
  const updates: Record<string, unknown> = {};
  if (snapshot.settings.coldStreakThreshold !== 3) updates.coldStreakThreshold = 3;
  if (!Object.keys(updates).length) return;

  settingsUpdatePending = true;
  void hostAction('host:update-settings', { updates }).finally(() => { settingsUpdatePending = false; });
}

function syncManualTurnRotation(snapshot: RoomSnapshot, previous: RoomSnapshot | null): void {
  if (snapshot.settings.turnOrderMode !== 'manual' || snapshot.phase !== 'board' || turnUpdatePending) return;
  const connected = connectedInOrder(snapshot);
  if (!connected.length) return;

  const currentConnected = connected.some((player) => player.id === snapshot.turnPlayerId);
  let target: Player | null = null;
  const sameRoom = previous?.code === snapshot.code;
  const gameJustStarted = sameRoom && previous?.phase === 'lobby';
  const questionJustFinished = sameRoom
    && previous?.phase !== 'board'
    && previous?.phase !== 'lobby'
    && Boolean(previous?.currentQuestion?.answerRevealed);

  if (gameJustStarted) {
    target = connected[0];
  } else if (questionJustFinished) {
    const previousOwner = previous?.currentQuestion?.turnPlayerId ?? previous?.turnPlayerId ?? snapshot.turnPlayerId;
    target = nextConnectedAfter(snapshot, previousOwner);
  } else if (!currentConnected) {
    target = nextConnectedAfter(snapshot, snapshot.turnPlayerId);
  }

  if (!target || target.id === snapshot.turnPlayerId) return;
  turnUpdatePending = true;
  void hostAction('host:set-turn-player', { playerId: target.id }).finally(() => { turnUpdatePending = false; });
}

function selectPack(packId: string): void {
  const pack = packs.find((candidate) => candidate.id === packId);
  const currentDailyDoubleCount = room?.settings.dailyDoubleCount ?? 0;
  const dailyDoubleCount = pack ? clampDailyDoubleCount(currentDailyDoubleCount, pack.questionCount) : currentDailyDoubleCount;
  void hostAction('host:update-settings', {
    updates: {
      selectedPackIds: [packId],
      mixedPacks: false,
      dailyDoubleCount,
      dailyDoublesEnabled: dailyDoubleCount > 0
    }
  });
}

function renderPackSelector(mount: HTMLElement, snapshot: RoomSnapshot): void {
  // Replacing a focused native <select> closes its open dropdown. Room snapshots arrive
  // frequently, so leave the pack selector DOM untouched until the user finishes interacting.
  if (mount.querySelector('.pack-version-select:focus')) return;
  mount.replaceChildren();
  const grid = document.createElement('div');
  grid.className = 'enhanced-pack-grid';
  const selectedId = snapshot.settings.selectedPackIds[0];

  for (const family of packFamilies(packs)) {
    const selectedVariant = family.variants.find((variant) => variant.id === selectedId);
    const activeVariant = selectedVariant ?? family.variants[0];
    const card = document.createElement('article');
    card.className = `enhanced-pack-card${selectedVariant ? ' selected' : ''}`;

    const main = document.createElement('button');
    main.type = 'button';
    main.className = 'enhanced-pack-main';
    main.setAttribute('aria-pressed', String(Boolean(selectedVariant)));
    const title = document.createElement('strong');
    title.textContent = family.title;
    const theme = document.createElement('span');
    theme.textContent = activeVariant.theme;
    const count = document.createElement('small');
    count.textContent = `${activeVariant.questionCount} questions`;
    main.append(title, theme, count);
    main.addEventListener('click', () => selectPack(activeVariant.id));
    card.append(main);

    if (family.variants.length > 1) {
      const select = document.createElement('select');
      select.className = 'pack-version-select';
      select.setAttribute('aria-label', `${family.title} version`);
      for (const variant of family.variants) {
        const option = document.createElement('option');
        option.value = variant.id;
        option.textContent = variant.title;
        select.append(option);
      }
      select.value = selectedVariant?.id ?? activeVariant.id;
      select.addEventListener('change', () => selectPack(select.value));
      select.addEventListener('blur', scheduleRender);
      card.append(select);
    }
    grid.append(card);
  }
  mount.append(grid);
}

function movePlayerBefore(snapshot: RoomSnapshot, sourceId: string, targetId: string): void {
  if (!sourceId || !targetId || sourceId === targetId) return;
  const order = normalizedOrder(snapshot).filter((playerId) => playerId !== sourceId);
  const targetIndex = order.indexOf(targetId);
  order.splice(targetIndex < 0 ? order.length : targetIndex, 0, sourceId);
  writeStoredOrder(snapshot.code, order);
  scheduleRender();
}

function renderTurnOrder(mount: HTMLElement, snapshot: RoomSnapshot): void {
  mount.replaceChildren();
  if (snapshot.settings.turnOrderMode !== 'manual') {
    mount.hidden = true;
    return;
  }
  mount.hidden = false;

  const section = document.createElement('section');
  section.className = 'manual-turn-order-v2';
  const header = document.createElement('div');
  header.className = 'manual-turn-order-head';
  const title = document.createElement('strong');
  title.textContent = 'Custom turn rotation';
  const helper = document.createElement('small');
  helper.textContent = 'Drag players to set the rotation order.';
  header.append(title, helper);
  section.append(header);

  const list = document.createElement('div');
  list.className = 'manual-turn-order-list';
  list.setAttribute('role', 'list');
  const byId = new Map(snapshot.players.map((player) => [player.id, player]));
  const order = normalizedOrder(snapshot);

  if (!order.length) {
    const empty = document.createElement('span');
    empty.className = 'manual-turn-order-empty';
    empty.textContent = 'Players will appear here as they join.';
    list.append(empty);
  } else {
    order.forEach((playerId, index) => {
      const player = byId.get(playerId);
      if (!player) return;
      const chip = document.createElement('div');
      chip.className = `turn-order-chip${player.connected ? '' : ' disconnected'}`;
      chip.draggable = true;
      chip.dataset.playerId = player.id;
      chip.setAttribute('role', 'listitem');
      chip.innerHTML = `<b>${index + 1}</b><span class="drag-grip" aria-hidden="true">⋮⋮</span><span class="turn-order-avatar"></span><strong></strong>`;
      (chip.querySelector('.turn-order-avatar') as HTMLElement).textContent = player.avatar;
      (chip.querySelector('strong') as HTMLElement).textContent = player.name;
      chip.title = player.connected ? `Drag ${player.name} to reorder` : `${player.name} is disconnected but keeps this rotation slot`;
      chip.addEventListener('dragstart', (event) => {
        draggedPlayerId = player.id;
        chip.classList.add('dragging');
        const dragEvent = event as DragEvent;
        dragEvent.dataTransfer?.setData('text/plain', player.id);
        if (dragEvent.dataTransfer) dragEvent.dataTransfer.effectAllowed = 'move';
      });
      chip.addEventListener('dragend', () => {
        draggedPlayerId = '';
        chip.classList.remove('dragging');
      });
      chip.addEventListener('dragover', (event) => {
        event.preventDefault();
        const dragEvent = event as DragEvent;
        if (dragEvent.dataTransfer) dragEvent.dataTransfer.dropEffect = 'move';
      });
      chip.addEventListener('drop', (event) => {
        event.preventDefault();
        const sourceId = (event as DragEvent).dataTransfer?.getData('text/plain') || draggedPlayerId;
        movePlayerBefore(snapshot, sourceId, player.id);
      });
      list.append(chip);
    });
  }

  section.append(list);
  mount.append(section);
}

function enhanceExistingControls(settingsCard: HTMLElement, snapshot: RoomSnapshot): void {
  const settingsGrid = settingsCard.querySelector<HTMLElement>('.settings-grid-v2');
  if (!settingsGrid) return;
  const labels = [...settingsGrid.querySelectorAll<HTMLLabelElement>(':scope > label')];
  const turnLabel = labels.find((label) => label.textContent?.trim().startsWith('Turn rotation'));
  const dailyLabel = labels.find((label) => label.textContent?.trim().startsWith('Daily Doubles'));
  const coldLabel = labels.find((label) => label.textContent?.trim().startsWith('Cold streak'));

  const manualOption = turnLabel?.querySelector<HTMLOptionElement>('option[value="manual"]');
  if (manualOption) manualOption.textContent = 'Manual · drag order';
  turnLabel?.setAttribute('data-tooltip', 'Join order rotates by seat. Manual lets you drag players into a custom rotation order.');

  if (dailyLabel) {
    const mode = gameModeDefinition(snapshot.settings.gameMode);
    dailyLabel.classList.remove('automatic-daily-double-control');
    dailyLabel.setAttribute('data-tooltip', mode.dailyDoubles
      ? 'Choose how many hidden Daily Doubles appear on this board. Set 0 to disable them.'
      : 'Daily Doubles are disabled in Free Response mode so every standard board question stays open to everyone.');
    const input = dailyLabel.querySelector<HTMLInputElement>('input');
    if (input) {
      input.readOnly = false;
      input.removeAttribute('aria-readonly');
      input.title = mode.dailyDoubles ? 'Daily Double count' : 'Daily Doubles are unavailable in this game mode';
    }
  }
  coldLabel?.classList.add('cold-streak-hidden-control');
}

function ensureMounts(): { packMount: HTMLElement; turnMount: HTMLElement } | null {
  if (!isHostMode() || !room || room.phase !== 'lobby') return null;
  const settingsCard = document.querySelector<HTMLElement>('.showcase-lobby .settings-card');
  if (!settingsCard) return null;
  settingsCard.classList.add('enhanced-lobby-setup');
  enhanceExistingControls(settingsCard, room);

  const originalPackGrid = settingsCard.querySelector<HTMLElement>('.pack-grid-v2');
  if (!originalPackGrid) return null;
  let packMount = settingsCard.querySelector<HTMLElement>('.lobby-pack-enhancement-mount');
  if (!packMount) {
    packMount = document.createElement('div');
    packMount.className = 'lobby-pack-enhancement-mount';
    originalPackGrid.before(packMount);
  }

  const settingsGrid = settingsCard.querySelector<HTMLElement>('.settings-grid-v2');
  if (!settingsGrid) return null;
  let turnMount = settingsCard.querySelector<HTMLElement>('.lobby-turn-order-mount');
  if (!turnMount) {
    turnMount = document.createElement('div');
    turnMount.className = 'lobby-turn-order-mount';
    settingsGrid.after(turnMount);
  }
  return { packMount, turnMount };
}

function renderEnhancements(): void {
  if (!room || room.phase !== 'lobby') return;
  const mounts = ensureMounts();
  if (!mounts) return;
  renderPackSelector(mounts.packMount, room);
  renderTurnOrder(mounts.turnMount, room);
}

function scheduleRender(): void {
  if (renderFrame) return;
  renderFrame = requestAnimationFrame(() => {
    renderFrame = 0;
    renderEnhancements();
  });
}

function onRoomState(snapshot: RoomSnapshot): void {
  if (!isHostMode()) return;
  previousRoom = room;
  room = snapshot;
  normalizedOrder(snapshot);
  enforceAutomaticRules(snapshot);
  syncManualTurnRotation(snapshot, previousRoom);
  scheduleRender();
}

if (typeof window !== 'undefined') {
  socket.on('room:state', onRoomState);
  void fetch('/api/packs')
    .then((response) => response.json())
    .then((items: PackSummary[]) => { packs = items; scheduleRender(); })
    .catch(() => {});

  const observer = new MutationObserver(() => {
    if (!isHostMode() || !room || room.phase !== 'lobby') return;
    if (!document.querySelector('.lobby-pack-enhancement-mount') || !document.querySelector('.lobby-turn-order-mount')) scheduleRender();
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });
}
