import { randomInt } from 'node:crypto';
import { GameEngine } from '../core/GameEngine';
import { CombinationEngine } from './CombinationEngine';
import { DeckService } from './DeckService';
import { DEFAULT_TIEN_LEN_RULESET, TienLenAction, TienLenCard, TienLenPlayer, TienLenResult, TienLenRuleset, TienLenState, cardValue } from './tien-len.types';

export class TienLenEngine implements GameEngine<TienLenState, TienLenAction, TienLenResult> {
  private readonly deckService = new DeckService();
  private readonly combinations = new CombinationEngine();

  initialize(playerIds: string[], config: Partial<TienLenRuleset> & { gameId?: string; roomId?: string; seed?: number } = {}): TienLenState {
    if (playerIds.length < 2 || playerIds.length > 4) throw new Error('Tiến Lên Miền Nam hỗ trợ 2–4 người chơi.');
    const ruleset: TienLenRuleset = { ...DEFAULT_TIEN_LEN_RULESET, ...config, playerCount: playerIds.length };
    const players: TienLenPlayer[] = playerIds.map((playerId, seat) => ({ playerId, seat, cards: [], isConnected: true, isAFK: false, isFinished: false, score: 0, currencyChange: 0 }));
    const shuffled = this.deckService.secureShuffle(this.deckService.createDeck(), config.seed ?? randomInt(1, 0x7fffffff));
    this.deckService.dealCards(shuffled.cards, players);
    const startingPlayer = players.find((player) => player.cards.some((card) => card.cardId === ruleset.firstCardId))?.playerId || players[0].playerId;
    const now = new Date().toISOString();
    return { gameId: config.gameId ?? `tien_len_${Date.now()}`, roomId: config.roomId, status: 'PLAYING', round: 1, phase: 'PLAYING', currentPlayer: startingPlayer, leaderPlayer: startingPlayer, turnNumber: 1, players, table: [], passCount: 0, startingPlayer, ruleset, timer: { startedAt: now, endsAt: new Date(Date.now() + 60000).toISOString() }, eventLog: [{ type: 'GAME_STARTED', at: now }, { type: 'DEALT', at: now, payload: { seed: shuffled.seed } }], actionIds: [], shuffleSeed: shuffled.seed };
  }

  validateAction(state: TienLenState, action: TienLenAction, playerId: string): boolean {
    const player = state.players.find((item) => item.playerId === playerId);
    if (!player || state.phase !== 'PLAYING' || state.winner || state.currentPlayer !== playerId) return false;
    if (action.actionId && state.actionIds.includes(action.actionId)) return false;
    if (action.type === 'PASS') return Boolean(state.lastPlay && state.lastPlay.playerId !== playerId);
    if (action.type !== 'PLAY_CARDS') return false;
    const ids = action.cardIds || [];
    if (!ids.length || new Set(ids).size !== ids.length) return false;
    const cards = ids.map((id) => player.cards.find((card) => card.cardId === id));
    if (cards.some((card) => !card)) return false;
    const combination = this.combinations.evaluate(cards as TienLenCard[], state.ruleset);
    return this.combinations.canBeat(state.lastPlay?.combination, combination, state.ruleset);
  }

  applyAction(state: TienLenState, action: TienLenAction, playerId: string): { newState: TienLenState; events: any[] } {
    if (!this.validateAction(state, action, playerId)) throw new Error('INVALID_ACTION');
    const next = clone(state); const player = next.players.find((item) => item.playerId === playerId)!; const events: any[] = [];
    if (action.actionId) next.actionIds.push(action.actionId);
    if (action.type === 'PASS') {
      next.passCount += 1; events.push(this.event(next, 'PLAYER_PASSED', playerId));
      if (next.passCount >= next.players.filter((item) => !item.isFinished).length - 1) { next.table = []; next.lastPlay = undefined; next.passCount = 0; next.leaderPlayer = playerId; events.push(this.event(next, 'TRICK_RESET', playerId)); }
      this.advance(next);
    } else {
      const cards = (action.cardIds || []).map((id) => player.cards.find((card) => card.cardId === id)!).filter(Boolean);
      player.cards = player.cards.filter((card) => !action.cardIds!.includes(card.cardId));
      const combination = this.combinations.evaluate(cards, next.ruleset);
      next.table.push(...cards); next.lastPlay = { playerId, cards, combination }; next.leaderPlayer = playerId; next.passCount = 0;
      events.push(this.event(next, 'CARDS_PLAYED', playerId, { cards: cards.map((card) => card.cardId), combinationType: combination.combinationType }));
      if (!player.cards.length) { player.isFinished = true; player.rank = next.players.filter((item) => item.isFinished).length; events.push(this.event(next, 'PLAYER_FINISHED', playerId, { rank: player.rank })); }
      if (next.players.filter((item) => !item.isFinished).length <= 1) { const remaining = next.players.find((item) => !item.isFinished); if (remaining) { remaining.isFinished = true; remaining.rank = next.players.length; } next.winner = playerId; next.phase = 'ROUND_END'; next.status = 'ROUND_END'; next.gameResult = { rankings: [...next.players].sort((a, b) => (a.rank || 99) - (b.rank || 99)).map((item) => item.playerId), scores: Object.fromEntries(next.players.map((item) => [item.playerId, item.rank === 1 ? 3 : item.rank === 2 ? 2 : item.rank === 3 ? 1 : 0])) }; events.push(this.event(next, 'GAME_FINISHED', playerId)); }
      else this.advance(next);
    }
    return { newState: next, events };
  }

  getPublicState(state: TienLenState, playerId: string): any {
    const viewer = state.players.find((player) => player.playerId === playerId);
    return { ...state, players: state.players.map(({ cards, ...player }) => ({ ...player, cardsCount: cards.length })), ownCards: viewer?.cards || [], table: state.table, lastPlay: state.lastPlay ? { ...state.lastPlay, cards: state.lastPlay.cards } : undefined, shuffleSeed: undefined, eventLog: state.eventLog.slice(-30) };
  }

  isFinished(state: TienLenState): boolean { return state.phase === 'ROUND_END' || state.phase === 'FINISHED' || Boolean(state.winner); }
  calculateResult(state: TienLenState): TienLenResult { return { gameId: state.gameId, winner: state.winner, rankings: state.gameResult?.rankings || state.players.sort((a, b) => (a.rank || 99) - (b.rank || 99)).map((player) => player.playerId), scores: state.gameResult?.scores || {} }; }
  getAiAction(state: TienLenState, playerId: string): TienLenAction | null { const player = state.players.find((item) => item.playerId === playerId); if (!player || state.currentPlayer !== playerId) return null; const candidate = player.cards.map((card) => ({ type: 'PLAY_CARDS' as const, cardIds: [card.cardId] })).find((action) => this.validateAction(state, action, playerId)); return candidate || (state.lastPlay ? { type: 'PASS' } : null); }

  private advance(state: TienLenState): void { const active = state.players.filter((player) => !player.isFinished); if (!active.length) return; const index = active.findIndex((player) => player.playerId === state.currentPlayer); state.currentPlayer = active[(index + 1 + active.length) % active.length].playerId; state.turnNumber += 1; state.timer = { startedAt: new Date().toISOString(), endsAt: new Date(Date.now() + 60000).toISOString() }; }
  private event(state: TienLenState, type: string, playerId?: string, payload?: Record<string, unknown>) { const event = { type, at: new Date().toISOString(), playerId, payload }; state.eventLog.push(event); return event; }
}
function clone<T>(value: T): T { return JSON.parse(JSON.stringify(value)) as T; }
