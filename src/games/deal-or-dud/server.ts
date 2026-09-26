// Server registration for Deal or Dud. Runs only in the Node room server.
import type { ServerGame } from '../../platform/rooms/types';
import type { DealSettings, DealSnapshot, TimerSettings } from './types';
import { DealEngine } from './engine/DealEngine';
import { sanitizeDealSnapshot } from './engine/sanitize';
import { voiceRoute } from './voiceRoute';
import { prepareVoices } from './voicePrep';
import { startVoiceService } from './voiceService';

export const dealServerGame: ServerGame<DealEngine, DealSnapshot> = {
  id: 'deal-or-dud',
  storageFile: 'deal-or-dud-rooms.json',
  createEngine: (storage, { isRoomCodeTaken }) => new DealEngine(storage, { isRoomCodeTaken }),
  sanitize: sanitizeDealSnapshot,
  fileRoutes: { '/api/deal-or-dud/voice': (query) => voiceRoute(query) },
  startServices: (log) => startVoiceService(log),
  // Renders name lines and pitch intros ahead of time; see voicePrep.ts.
  onStateChange: ({ after }) => { if (after) prepareVoices(after); },

  hostActions: {
    'host:update-settings': ({ engine, roomCode, hostToken, payload }) => void engine.updateSettings(roomCode, hostToken, (payload.updates ?? {}) as Partial<DealSettings> & { timerSteps?: Partial<TimerSettings> }),
    'host:reset-settings': ({ engine, roomCode, hostToken }) => void engine.resetSettings(roomCode, hostToken),
    'host:set-say-as': ({ engine, roomCode, hostToken, payload }) => void engine.setSayAs(roomCode, hostToken, payload.playerId, payload.sayAs),
    'host:start-game': ({ engine, roomCode, hostToken }) => void engine.startGame(roomCode, hostToken),
    'host:replay-tutorial': ({ engine, roomCode, hostToken }) => void engine.replayTutorial(roomCode, hostToken),
    'host:skip-tutorial': ({ engine, roomCode, hostToken }) => void engine.skipTutorial(roomCode, hostToken),
    'host:pause': ({ engine, roomCode, hostToken }) => void engine.pause(roomCode, hostToken),
    'host:resume': ({ engine, roomCode, hostToken }) => void engine.resume(roomCode, hostToken),
    'host:continue': ({ engine, roomCode, hostToken }) => void engine.continue(roomCode, hostToken),
    'host:new-game': ({ engine, roomCode, hostToken }) => void engine.newGame(roomCode, hostToken)
  },

  playerActions: {
    'player:set-look': ({ engine, roomCode, playerId, payload }) => void engine.setLook(roomCode, playerId, payload),
    'player:builder-toggle': ({ engine, roomCode, playerId, payload }) => void engine.toggleBuilder(roomCode, playerId, payload.column, payload.id),
    'player:builder-main': ({ engine, roomCode, playerId, payload }) => void engine.setMainProduct(roomCode, playerId, payload.id),
    'player:builder-reshuffle': ({ engine, roomCode, playerId }) => void engine.reshuffleSupplied(roomCode, playerId),
    'player:builder-lock': ({ engine, roomCode, playerId }) => void engine.lockPremiseRequest(roomCode, playerId),
    'player:names-reshuffle': ({ engine, roomCode, playerId }) => void engine.reshuffleNames(roomCode, playerId),
    'player:name-choose': ({ engine, roomCode, playerId, payload }) => void engine.chooseName(roomCode, playerId, payload.index),
    'player:end-pitch': ({ engine, roomCode, playerId }) => void engine.endPitch(roomCode, playerId),
    'player:reveal-card': ({ engine, roomCode, playerId, payload }) => void engine.revealCard(roomCode, playerId, payload.cardId),
    'player:ready-to-bid': ({ engine, roomCode, playerId }) => void engine.toggleReadyToBid(roomCode, playerId),
    'player:offer': ({ engine, roomCode, playerId, payload }) => void engine.chooseOffer(roomCode, playerId, payload.choice),
    'player:offer-lock': ({ engine, roomCode, playerId, payload }) => void engine.lockOffer(roomCode, playerId, payload.choice),
    'player:partner': ({ engine, roomCode, playerId, payload }) => void engine.choosePartner(roomCode, playerId, payload.sharkId),
    'player:forecast': ({ engine, roomCode, playerId, payload }) => void engine.submitForecast(roomCode, playerId, payload.value),
    'player:vip': ({ engine, roomCode, playerId, payload }) => void engine.vipAction(roomCode, playerId, payload.action, payload)
  }
};
