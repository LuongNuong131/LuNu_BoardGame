import { GameEngine } from '../core/GameEngine';

export type CatalogAction = {
  type: string;
  payload?: any;
  cardId?: string;
  card?: any;
  amount?: number;
};

type CatalogCard = { id: string; rank: number; label: string; suit: 'S' | 'H' | 'D' | 'C'; color: 'RED' | 'BLACK' };
type CatalogState = {
  gameId: string;
  players: string[];
  hands: Record<string, CatalogCard[]>;
  deck: CatalogCard[];
  discardPile: CatalogCard[];
  currentTurnIndex: number;
  phase: string;
  winner: string | null;
  scores: Record<string, number>;
  bets: Record<string, number>;
  folded: Record<string, boolean>;
  done: Record<string, boolean>;
  positions: Record<string, number>;
  dice: number | null;
  votes: Record<string, string>;
  roles?: Record<string, string>;
  dealerId?: string | null;
  lastAction?: any;
};

const CONFIG: Record<string, { handSize: number; category: 'card' | 'board' | 'social'; startingCoins: number }> = {
  WEREWOLF: { handSize: 0, category: 'social', startingCoins: 0 },
  TIEN_LEN: { handSize: 13, category: 'card', startingCoins: 0 },
  BLACKJACK: { handSize: 2, category: 'card', startingCoins: 0 },
  PHOM: { handSize: 9, category: 'card', startingCoins: 0 },
  XI_DACH: { handSize: 2, category: 'card', startingCoins: 0 },
  POKER: { handSize: 2, category: 'card', startingCoins: 0 },
  MAU_BINH: { handSize: 13, category: 'card', startingCoins: 0 },
  BAO_CAO: { handSize: 3, category: 'card', startingCoins: 0 },
  LIENG: { handSize: 3, category: 'card', startingCoins: 0 },
  CHESS: { handSize: 0, category: 'board', startingCoins: 0 },
  CO_TUONG: { handSize: 0, category: 'board', startingCoins: 0 },
  CO_CA_NGUA: { handSize: 0, category: 'board', startingCoins: 0 },
  CO_TY_PHU: { handSize: 0, category: 'board', startingCoins: 1500 },
  EXPLODING_KITTENS: { handSize: 4, category: 'social', startingCoins: 0 },
  UNO: { handSize: 7, category: 'card', startingCoins: 0 }
};

const shuffle = <T>(items: T[]) => {
  for (let i = items.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [items[i], items[j]] = [items[j], items[i]];
  }
  return items;
};

export class CatalogGameEngine implements GameEngine<CatalogState, CatalogAction, any> {
  constructor(private readonly gameId: string) {}

  private get config() { return CONFIG[this.gameId] || CONFIG.TIEN_LEN; }

  private createDeck(): CatalogCard[] {
    const deck: CatalogCard[] = [];
    const suits: CatalogCard['suit'][] = ['S', 'H', 'D', 'C'];
    let id = 0;
    for (const suit of suits) {
      for (let rank = 1; rank <= 13; rank += 1) {
        id += 1;
        deck.push({ id: `${this.gameId}-${id}`, rank, label: rank === 1 ? 'A' : rank === 11 ? 'J' : rank === 12 ? 'Q' : rank === 13 ? 'K' : String(rank), suit, color: suit === 'H' || suit === 'D' ? 'RED' : 'BLACK' });
      }
    }
    if (this.gameId === 'EXPLODING_KITTENS') {
      for (let index = 0; index < 4; index += 1) deck.push({ id: `${this.gameId}-DEFUSE-${index}`, rank: 0, label: 'DEFUSE', suit: 'C', color: 'BLACK' });
    }
    return shuffle(deck);
  }

  initialize(players: string[], _config: any): CatalogState {
    const deck = this.createDeck();
    const hands: Record<string, CatalogCard[]> = {};
    const scores: Record<string, number> = {};
    const bets: Record<string, number> = {};
    const folded: Record<string, boolean> = {};
    const done: Record<string, boolean> = {};
    const positions: Record<string, number> = {};
    const roles: Record<string, string> = {};
    for (const [index, player] of players.entries()) {
      hands[player] = [];
      for (let cardIndex = 0; cardIndex < this.config.handSize && deck.length; cardIndex += 1) hands[player].push(deck.shift()!);
      scores[player] = this.config.startingCoins;
      bets[player] = 0;
      folded[player] = false;
      done[player] = false;
      positions[player] = 0;
      if (this.gameId === 'WEREWOLF') roles[player] = index === 0 ? 'WEREWOLF' : index === 1 ? 'SEER' : 'VILLAGER';
    }
    return {
      gameId: this.gameId,
      players,
      hands,
      deck,
      discardPile: [],
      currentTurnIndex: 0,
      phase: this.gameId === 'WEREWOLF' ? 'NIGHT' : 'PLAYING',
      winner: null,
      scores,
      bets,
      folded,
      done,
      positions,
      dice: null,
      votes: {},
      roles: this.gameId === 'WEREWOLF' ? roles : undefined,
      dealerId: this.gameId === 'XI_DACH' ? players[0] || null : null
    };
  }

  addPlayer(state: CatalogState, playerId: string) {
    if (state.players.includes(playerId)) return state;
    const nextState = JSON.parse(JSON.stringify(state)) as CatalogState;
    nextState.players.push(playerId);
    nextState.hands[playerId] = [];
    nextState.scores[playerId] = this.config.startingCoins;
    nextState.bets[playerId] = 0;
    nextState.folded[playerId] = false;
    nextState.done[playerId] = false;
    nextState.positions[playerId] = 0;
    if (this.gameId === 'WEREWOLF') nextState.roles = { ...(nextState.roles || {}), [playerId]: 'VILLAGER' };
    for (let index = 0; index < Math.min(this.config.handSize, 3) && nextState.deck.length; index += 1) nextState.hands[playerId].push(nextState.deck.shift()!);
    return nextState;
  }

  private currentPlayer(state: CatalogState) {
    return state.players[state.currentTurnIndex];
  }

  private activePlayers(state: CatalogState) {
    return state.players.filter((player) => !state.folded[player] && !state.done[player]);
  }

  private hasCard(state: CatalogState, playerId: string, action: CatalogAction) {
    const requestedId = action.payload?.cardId || action.cardId || action.payload?.card?.id || action.card?.id;
    return Boolean(requestedId && state.hands[playerId]?.some((card) => card.id === requestedId));
  }

  getAiAction(state: CatalogState, playerId: string, difficulty: 'EASY' | 'MEDIUM' | 'HARD'): CatalogAction | null {
    if (this.currentPlayer(state) !== playerId || this.isFinished(state)) return null;
    if (this.config.category === 'board') return { type: difficulty === 'HARD' ? 'MOVE' : 'ROLL_DICE', payload: difficulty === 'HARD' ? { steps: 2 } : {} };
    if (this.gameId === 'POKER' || this.gameId === 'LIENG') return { type: difficulty === 'HARD' ? 'RAISE' : difficulty === 'MEDIUM' ? 'CALL' : 'CHECK', payload: { amount: difficulty === 'HARD' ? 20 : 0 } };
    if (this.gameId === 'BLACKJACK' || this.gameId === 'XI_DACH') return this.handTotal(state.hands[playerId]) < (difficulty === 'HARD' ? 18 : 16) ? { type: 'HIT' } : { type: 'STAND' };
    if (state.hands[playerId]?.length) return { type: 'PLAY_CARD', payload: { cardId: state.hands[playerId][0].id } };
    return { type: this.gameId === 'WEREWOLF' ? 'PASS' : 'DRAW_CARD' };
  }

  validateAction(state: CatalogState, action: CatalogAction, playerId: string): boolean {
    if (this.isFinished(state) || !state.players.includes(playerId) || state.folded[playerId] || state.done[playerId]) return false;
    const freeTurnActions = this.gameId === 'WEREWOLF' && ['VOTE', 'NIGHT_ACTION'].includes(action.type);
    if (!freeTurnActions && this.currentPlayer(state) !== playerId) return false;
    if (!action?.type) return false;
    if (['DRAW_CARD', 'HIT', 'STAND', 'PASS', 'CHECK', 'CALL', 'RAISE', 'BET', 'FOLD', 'ROLL_DICE', 'MOVE', 'END_TURN', 'VOTE', 'NIGHT_ACTION', 'CHOOSE_DEALER', 'DEFUSE'].includes(action.type)) return true;
    if (['PLAY_CARD', 'DISCARD', 'SUBMIT_HAND'].includes(action.type)) return this.hasCard(state, playerId, action) || action.type === 'SUBMIT_HAND';
    return false;
  }

  private draw(state: CatalogState, playerId: string, count = 1) {
    for (let index = 0; index < count; index += 1) {
      if (!state.deck.length && state.discardPile.length > 1) state.deck = shuffle(state.discardPile.splice(0, state.discardPile.length - 1));
      const card = state.deck.shift();
      if (card) state.hands[playerId].push(card);
    }
  }

  private advance(state: CatalogState, events: any[]) {
    const start = state.currentTurnIndex;
    for (let offset = 1; offset <= state.players.length; offset += 1) {
      const nextIndex = (start + offset) % state.players.length;
      const nextPlayer = state.players[nextIndex];
      if (!state.folded[nextPlayer] && !state.done[nextPlayer]) { state.currentTurnIndex = nextIndex; return; }
    }
    const active = this.activePlayers(state);
    if (active.length === 1) { state.winner = active[0]; events.push({ type: 'GAME_OVER', winner: active[0] }); }
  }

  private removeSelectedCard(state: CatalogState, playerId: string, action: CatalogAction) {
    const cardId = action.payload?.cardId || action.cardId || action.payload?.card?.id || action.card?.id;
    const index = state.hands[playerId].findIndex((card) => card.id === cardId);
    return index >= 0 ? state.hands[playerId].splice(index, 1)[0] : null;
  }

  applyAction(state: CatalogState, action: CatalogAction, playerId: string) {
    const nextState = JSON.parse(JSON.stringify(state)) as CatalogState;
    const events: any[] = [];
    nextState.lastAction = { ...action, playerId, at: new Date().toISOString() };
    switch (action.type) {
      case 'DRAW_CARD': this.draw(nextState, playerId); events.push({ type: 'CARD_DRAWN', playerId }); this.advance(nextState, events); break;
      case 'HIT': this.draw(nextState, playerId); events.push({ type: 'HIT', playerId }); if (this.handTotal(nextState.hands[playerId]) > 21) nextState.folded[playerId] = true; else this.advance(nextState, events); break;
      case 'PLAY_CARD': {
        const card = this.removeSelectedCard(nextState, playerId, action);
        if (card) { nextState.discardPile.push(card); events.push({ type: 'CARD_PLAYED', playerId, card }); }
        if (!nextState.hands[playerId].length && this.gameId !== 'POKER') { nextState.winner = playerId; events.push({ type: 'GAME_OVER', winner: playerId }); } else this.advance(nextState, events);
        break;
      }
      case 'DISCARD': { const card = this.removeSelectedCard(nextState, playerId, action); if (card) nextState.discardPile.push(card); events.push({ type: 'CARD_DISCARDED', playerId }); this.advance(nextState, events); break; }
      case 'DEFUSE': { const card = nextState.hands[playerId].find((item) => item.label === 'DEFUSE'); if (card) nextState.hands[playerId] = nextState.hands[playerId].filter((item) => item.id !== card.id); events.push({ type: 'DEFUSED', playerId }); this.advance(nextState, events); break; }
      case 'STAND': nextState.done[playerId] = true; events.push({ type: 'STAND', playerId }); this.advance(nextState, events); break;
      case 'SUBMIT_HAND': nextState.done[playerId] = true; nextState.scores[playerId] += nextState.hands[playerId].reduce((sum, card) => sum + card.rank, 0); events.push({ type: 'HAND_SUBMITTED', playerId }); this.advance(nextState, events); break;
      case 'BET': case 'CALL': case 'RAISE': case 'CHECK': { const amount = Math.max(0, Number(action.payload?.amount ?? action.amount ?? 0)); nextState.bets[playerId] += amount; events.push({ type: 'BET_PLACED', playerId, amount, action: action.type }); this.advance(nextState, events); break; }
      case 'FOLD': nextState.folded[playerId] = true; events.push({ type: 'PLAYER_FOLDED', playerId }); this.advance(nextState, events); break;
      case 'PASS': case 'END_TURN': this.advance(nextState, events); break;
      case 'ROLL_DICE': { nextState.dice = Math.floor(Math.random() * 6) + 1; nextState.positions[playerId] += nextState.dice; events.push({ type: 'DICE_ROLLED', playerId, dice: nextState.dice, position: nextState.positions[playerId] }); if (nextState.positions[playerId] >= (this.gameId === 'CO_CA_NGUA' ? 56 : 40)) nextState.winner = playerId; else this.advance(nextState, events); break; }
      case 'MOVE': nextState.positions[playerId] += Math.max(1, Number(action.payload?.steps || 1)); events.push({ type: 'PIECE_MOVED', playerId, position: nextState.positions[playerId] }); this.advance(nextState, events); break;
      case 'CHOOSE_DEALER': nextState.dealerId = action.payload?.userId || playerId; events.push({ type: 'DEALER_CHANGED', dealerId: nextState.dealerId }); this.advance(nextState, events); break;
      case 'VOTE': { const target = action.payload?.targetUserId || action.payload?.userId; if (target && nextState.players.includes(target)) nextState.votes[playerId] = target; events.push({ type: 'VOTE_CAST', playerId, target }); if (Object.keys(nextState.votes).length >= this.activePlayers(nextState).length) { const tally: Record<string, number> = {}; Object.values(nextState.votes).forEach((value) => { tally[value] = (tally[value] || 0) + 1; }); const eliminated = Object.entries(tally).sort((a, b) => b[1] - a[1])[0]?.[0]; if (eliminated) nextState.folded[eliminated] = true; nextState.phase = 'NIGHT'; nextState.votes = {}; } break; }
      case 'NIGHT_ACTION': { events.push({ type: 'NIGHT_ACTION', playerId, target: action.payload?.targetUserId || null }); nextState.phase = 'DAY'; this.advance(nextState, events); break; }
      default: break;
    }
    return { newState: nextState, events };
  }

  private handTotal(hand: CatalogCard[]) { return hand.reduce((sum, card) => sum + (card.rank > 10 ? 10 : card.rank), 0); }

  getPublicState(state: CatalogState, playerId: string) {
    const publicHands: Record<string, number> = {};
    for (const player of state.players) publicHands[player] = state.hands[player]?.length || 0;
    const publicState: any = { ...state, hands: undefined, deck: undefined, deckCount: state.deck.length, myHand: state.hands[playerId] || [], playerCardCounts: publicHands };
    if (state.roles) publicState.roles = { [playerId]: state.roles[playerId] };
    return publicState;
  }

  isFinished(state: CatalogState) { return Boolean(state.winner) || this.activePlayers(state).length <= 1; }
  calculateResult(state: CatalogState) { return { winner: state.winner || this.activePlayers(state)[0] || null, scores: state.scores, bets: state.bets }; }
}
