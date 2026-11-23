import type { GameEngine } from '../core/GameEngine';
import { CombinationEngine } from './CombinationEngine';
import { DeckService } from './DeckService';
import { DEFAULT_TIEN_LEN_RULESET, type TienLenAction, type TienLenCard, type TienLenPlayer, type TienLenResult, type TienLenRuleset, type TienLenState, cardValue } from './tien-len.types';

export class TienLenEngine implements GameEngine<TienLenState, TienLenAction, TienLenResult> {
  private readonly deckService = new DeckService();
  private readonly combinations = new CombinationEngine();

  initialize(playerIds: string[], config: Partial<TienLenRuleset> & { gameId?: string; roomId?: string; seed?: number } = {}): TienLenState {
    if (playerIds.length < 2 || playerIds.length > 4) throw new Error('Tiến Lên Miền Nam hỗ trợ 2–4 người chơi.');
    const { seed, roomId, gameId, ...overrides } = config;
    const ruleset: TienLenRuleset = { ...DEFAULT_TIEN_LEN_RULESET, ...overrides, playerCount: playerIds.length };
    const players: TienLenPlayer[] = playerIds.map((playerId, seat) => ({ playerId, seat, cards: [], isConnected: true, isAFK: false, isFinished: false, score: 0, currencyChange: 0 }));
    const shuffled = this.deckService.secureShuffle(this.deckService.createDeck(), seed);
    this.deckService.dealCards(shuffled.cards, players);
    const openingCard = players.flatMap((player) => player.cards).find((card) => card.cardId === ruleset.firstCardId) ??
      players.flatMap((player) => player.cards).sort((a, b) => cardValue(a, ruleset) - cardValue(b, ruleset))[0];
    const startingPlayer = players.find((player) => player.cards.includes(openingCard))!.playerId;
    const now = new Date().toISOString();
    return { gameId: gameId ?? `tien_len_${Date.now()}`, roomId, status: 'PLAYING', round: 1, phase: 'PLAYING', currentPlayer: startingPlayer, leaderPlayer: startingPlayer, turnNumber: 1, players, table: [], passCount: 0, passedPlayers: [], openingCardId: openingCard.cardId, startingPlayer, ruleset, timer: { startedAt: now, endsAt: new Date(Date.now() + 60000).toISOString() }, eventLog: [{ type: 'GAME_STARTED', at: now }, { type: 'DEALT', at: now }], actionIds: [], shuffleSeed: shuffled.seed };
  }

  validateAction(state: TienLenState, action: TienLenAction, playerId: string): boolean {
    const player = state.players.find((item) => item.playerId === playerId);
    if (!action || !player || state.phase !== 'PLAYING' || state.winner || state.currentPlayer !== playerId) return false;
    if (action.actionId && state.actionIds.includes(action.actionId)) return false;
    if (action.type === 'PASS') return Boolean(state.lastPlay && state.lastPlay.playerId !== playerId);
    if (action.type !== 'PLAY_CARDS') return false;
    const ids = action.cardIds || [];
    if (!Array.isArray(ids) || !ids.length || new Set(ids).size !== ids.length || (state.turnNumber === 1 && state.openingCardId && !ids.includes(state.openingCardId))) return false;
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
      (next.passedPlayers ??= []).push(playerId);
      next.passCount += 1;
      events.push(this.event(next, 'PLAYER_PASSED', playerId));
      this.advance(next);
    } else {
      const cards = (action.cardIds || []).map((id) => player.cards.find((card) => card.cardId === id)!).filter(Boolean);
      player.cards = player.cards.filter((card) => !action.cardIds!.includes(card.cardId));
      const combination = this.combinations.evaluate(cards, next.ruleset);
      next.table = cards; next.lastPlay = { playerId, cards, combination }; next.leaderPlayer = playerId;
      events.push(this.event(next, 'CARDS_PLAYED', playerId, { cards: cards.map((card) => card.cardId), combinationType: combination.combinationType }));
      if (!player.cards.length) { player.isFinished = true; player.rank = next.players.filter((item) => item.isFinished).length; events.push(this.event(next, 'PLAYER_FINISHED', playerId, { rank: player.rank })); }
      if (next.players.filter((item) => !item.isFinished).length <= 1) { const remaining = next.players.find((item) => !item.isFinished); if (remaining) { remaining.isFinished = true; remaining.rank = next.players.length; } next.winner = next.players.find((item) => item.rank === 1)!.playerId; next.phase = 'ROUND_END'; next.status = 'ROUND_END'; next.gameResult = { rankings: [...next.players].sort((a, b) => (a.rank || 99) - (b.rank || 99)).map((item) => item.playerId), scores: Object.fromEntries(next.players.map((item) => [item.playerId, item.rank === 1 ? 3 : item.rank === 2 ? 2 : item.rank === 3 ? 1 : 0])) }; events.push(this.event(next, 'GAME_FINISHED', playerId)); }
      else this.advance(next);
    }
    return { newState: next, events };
  }

  getPublicState(state: TienLenState, playerId: string): any {
    const viewer = state.players.find((player) => player.playerId === playerId);
    const { seed: _seed, ...publicRules } = state.ruleset as TienLenRuleset & { seed?: number };

    return { ...state, ruleset: publicRules, players: state.players.map(({ cards, ...player }) => ({ ...player, cardsCount: cards.length })), ownCards: viewer?.cards || [], table: state.table, lastPlay: state.lastPlay ? { ...state.lastPlay, cards: state.lastPlay.cards } : undefined, shuffleSeed: undefined, eventLog: state.eventLog.slice(-30).map((event) => event.type === 'DEALT' ? { type: event.type, at: event.at } : event) };
  }

  isFinished(state: TienLenState): boolean { return state.phase === 'ROUND_END' || state.phase === 'FINISHED' || Boolean(state.winner); }
  calculateResult(state: TienLenState): TienLenResult { return { gameId: state.gameId, winner: state.winner, rankings: state.gameResult?.rankings || [...state.players].sort((a, b) => (a.rank || 99) - (b.rank || 99)).map((player) => player.playerId), scores: state.gameResult?.scores || {} }; }
  getAiAction(state: TienLenState, playerId: string): TienLenAction | null {
    const player = state.players.find((item) => item.playerId === playerId);
    if (!player || state.currentPlayer !== playerId) return null;
    const cards = [...player.cards].sort((a, b) => cardValue(a, state.ruleset) - cardValue(b, state.ruleset));
    const length = state.lastPlay?.cards.length ?? 1;
    for (const size of new Set([length, 4, 6, 8])) {
      for (const cardIds of combinations(cards.map((card) => card.cardId), size)) {
        const action = { type: 'PLAY_CARDS' as const, cardIds };
        if (this.validateAction(state, action, playerId)) return action;
      }
    }
    return state.lastPlay ? { type: 'PASS' } : null;
  }

  private advance(state: TienLenState): void {
    const active = state.players.filter((player) => !player.isFinished);
    const index = state.players.findIndex((player) => player.playerId === state.currentPlayer);
    const clockwise = state.players.slice(index + 1).concat(state.players.slice(0, index + 1));
    const leader = state.lastPlay?.playerId;
    const boundary = clockwise.findIndex((player) => player.playerId === leader);
    const next = (boundary >= 0 ? clockwise.slice(0, boundary) : clockwise).find((player) => !player.isFinished && !state.passedPlayers?.includes(player.playerId));
    if (next) state.currentPlayer = next.playerId;
    else {
      state.currentPlayer = active.some((player) => player.playerId === leader) ? leader! :
        clockwise.find((player) => !player.isFinished)!.playerId;
      state.leaderPlayer = state.currentPlayer;
      state.table = [];
      state.lastPlay = undefined;
      state.passedPlayers = [];
      state.passCount = 0;
      this.event(state, 'TRICK_RESET', state.currentPlayer);
    }
    state.turnNumber++;
    state.timer = { startedAt: new Date().toISOString(), endsAt: new Date(Date.now() + 60000).toISOString() };
  }

  private event(state: TienLenState, type: string, playerId?: string, payload?: Record<string, unknown>) { const event = { type, at: new Date().toISOString(), playerId, payload }; state.eventLog.push(event); return event; }
}
function clone<T>(value: T): T { return JSON.parse(JSON.stringify(value)) as T; }

function* combinations(ids: string[], count: number, start = 0, picked: string[] = []): Generator<string[]> {
  if (!count) {
    yield picked;
    return;
  }
  for (let i = start; i <= ids.length - count; i++) yield* combinations(ids, count - 1, i + 1, [...picked, ids[i]]);
}
