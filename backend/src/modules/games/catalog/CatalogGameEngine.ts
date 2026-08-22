import { GameEngine } from '../core/GameEngine';

export type CatalogAction = {
  type: string;
  payload?: any;
  cardId?: string;
  card?: any;
  amount?: number;
};

type CatalogCard = { id: string; rank: number; label: string; suit: 'S' | 'H' | 'D' | 'C'; color: 'RED' | 'BLACK' };
type BoardPiece = { type: string; color: 'WHITE' | 'BLACK' | 'RED' | 'BLACK_SIDE' };
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
  lastPlay?: { playerId: string; cards: CatalogCard[]; kind: string; power: number };
  passesInRound: number;
  hasDrawn: Record<string, boolean>;
  board?: Array<Array<BoardPiece | null>>;
  boardSize?: { rows: number; columns: number };
  communityCards: CatalogCard[];
  bettingRound: 'PREFLOP' | 'FLOP' | 'TURN' | 'RIVER' | 'SHOWDOWN';
  currentBet: number;
  acted: Record<string, boolean>;
  nightActions: Record<string, { type: string; targetUserId?: string }>;
  pendingExplosion: Record<string, boolean>;
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

  private createBoard() {
    if (this.gameId === 'CHESS') {
      const major = ['ROOK', 'KNIGHT', 'BISHOP', 'QUEEN', 'KING', 'BISHOP', 'KNIGHT', 'ROOK'];
      return { board: [major.map((type) => ({ type, color: 'BLACK' as const })), Array.from({ length: 8 }, () => ({ type: 'PAWN', color: 'BLACK' as const })), ...Array.from({ length: 4 }, () => Array(8).fill(null)), Array.from({ length: 8 }, () => ({ type: 'PAWN', color: 'WHITE' as const })), major.map((type) => ({ type, color: 'WHITE' as const }))], boardSize: { rows: 8, columns: 8 } };
    }
    if (this.gameId === 'CO_TUONG') {
      const empty = () => Array(9).fill(null);
      const board = Array.from({ length: 10 }, empty) as Array<Array<BoardPiece | null>>;
      const place = (row: number, column: number, type: string, color: 'RED' | 'BLACK_SIDE') => { board[row][column] = { type, color }; };
      const back = ['ROOK', 'KNIGHT', 'ELEPHANT', 'ADVISOR', 'KING', 'ADVISOR', 'ELEPHANT', 'KNIGHT', 'ROOK'];
      back.forEach((type, column) => { place(0, column, type, 'BLACK_SIDE'); place(9, column, type, 'RED'); });
      [1, 7].forEach((column) => { place(2, column, 'CANNON', 'BLACK_SIDE'); place(7, column, 'CANNON', 'RED'); });
      [0, 2, 4, 6, 8].forEach((column) => { place(3, column, 'PAWN', 'BLACK_SIDE'); place(6, column, 'PAWN', 'RED'); });
      return { board, boardSize: { rows: 10, columns: 9 } };
    }
    return {};
  }

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
      for (let index = 0; index < 4; index += 1) { deck.push({ id: `${this.gameId}-DEFUSE-${index}`, rank: 0, label: 'DEFUSE', suit: 'C', color: 'BLACK' }); deck.push({ id: `${this.gameId}-BOMB-${index}`, rank: 0, label: 'EXPLODING', suit: 'C', color: 'RED' }); }
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
    const hasDrawn: Record<string, boolean> = {};
    const acted: Record<string, boolean> = {};
    const nightActions: Record<string, { type: string; targetUserId?: string }> = {};
    const pendingExplosion: Record<string, boolean> = {};
    const roles: Record<string, string> = {};
    for (const [index, player] of players.entries()) {
      hands[player] = [];
      for (let cardIndex = 0; cardIndex < this.config.handSize && deck.length; cardIndex += 1) hands[player].push(deck.shift()!);
      scores[player] = this.config.startingCoins;
      bets[player] = 0;
      folded[player] = false;
      done[player] = false;
      positions[player] = 0;
      hasDrawn[player] = false;
      acted[player] = false;
      pendingExplosion[player] = false;
      if (this.gameId === 'WEREWOLF') roles[player] = index === 0 ? 'WEREWOLF' : index === 1 ? 'SEER' : 'VILLAGER';
    }
    const boardSetup = this.createBoard();
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
      dealerId: this.gameId === 'XI_DACH' ? players[0] || null : null,
      passesInRound: 0,
      hasDrawn,
      ...boardSetup,
      communityCards: [],
      bettingRound: 'PREFLOP',
      currentBet: this.gameId === 'POKER' ? 20 : 0,
      acted,
      nightActions,
      pendingExplosion
    };
  }

  addPlayer(state: CatalogState, playerId: string) {
    if (state.players.includes(playerId)) return state;
    const nextState = JSON.parse(JSON.stringify(state)) as CatalogState;
    nextState.hasDrawn ||= {};
    nextState.acted ||= {};
    nextState.nightActions ||= {};
    nextState.pendingExplosion ||= {};
    nextState.communityCards ||= [];
    nextState.currentBet ||= 0;
    nextState.bettingRound ||= 'PREFLOP';
    nextState.passesInRound ||= 0;
    nextState.players.push(playerId);
    nextState.hands[playerId] = [];
    nextState.scores[playerId] = this.config.startingCoins;
    nextState.bets[playerId] = 0;
    nextState.folded[playerId] = false;
    nextState.done[playerId] = false;
    nextState.positions[playerId] = 0;
    nextState.hasDrawn[playerId] = false;
    nextState.acted[playerId] = false;
    nextState.nightActions ||= {};
    nextState.pendingExplosion ||= {};
    nextState.pendingExplosion[playerId] = false;
    if (this.gameId === 'WEREWOLF') nextState.roles = { ...(nextState.roles || {}), [playerId]: 'VILLAGER' };
    for (let index = 0; index < this.config.handSize && nextState.deck.length; index += 1) nextState.hands[playerId].push(nextState.deck.shift()!);
    return nextState;
  }

  private currentPlayer(state: CatalogState) {
    return state.players[state.currentTurnIndex];
  }

  private activePlayers(state: CatalogState) {
    return state.players.filter((player) => !state.folded[player] && !state.done[player]);
  }

  private tienLenRank(rank: number) { return rank === 1 ? 14 : rank === 2 ? 15 : rank; }

  private tienLenCombo(cards: CatalogCard[]) {
    const sorted = [...cards].sort((left, right) => this.tienLenRank(left.rank) - this.tienLenRank(right.rank));
    const ranks = sorted.map((card) => this.tienLenRank(card.rank));
    const sameRank = ranks.every((rank) => rank === ranks[0]);
    if (sorted.length === 1) return { kind: 'SINGLE', power: ranks[0] };
    if (sorted.length === 2 && sameRank) return { kind: 'PAIR', power: ranks[0] };
    if (sorted.length === 3 && sameRank) return { kind: 'TRIPLE', power: ranks[0] };
    if (sorted.length === 4 && sameRank) return { kind: 'FOUR', power: ranks[0] };
    const isStraight = sorted.length >= 3 && new Set(ranks).size === sorted.length && ranks.every((rank, index) => index === 0 || rank === ranks[index - 1] + 1) && !ranks.includes(15);
    return isStraight ? { kind: 'STRAIGHT', power: ranks[ranks.length - 1] } : null;
  }

  private cardsFromAction(state: CatalogState, playerId: string, action: CatalogAction) {
    const ids = action.payload?.cardIds || (action.payload?.cardId ? [action.payload.cardId] : action.cardId ? [action.cardId] : action.card?.id ? [action.card.id] : []);
    return ids.map((id: string) => state.hands[playerId]?.find((card) => card.id === id)).filter(Boolean) as CatalogCard[];
  }

  private boardPlayerColor(state: CatalogState, playerId: string) { return state.players.indexOf(playerId) % 2 === 0 ? (this.gameId === 'CHESS' ? 'WHITE' : 'RED') : (this.gameId === 'CHESS' ? 'BLACK' : 'BLACK_SIDE'); }

  private boardCoords(value: any) { if (Array.isArray(value)) return { row: Number(value[0]), column: Number(value[1]) }; return { row: Number(value?.row), column: Number(value?.column) }; }

  private boardInBounds(state: CatalogState, row: number, column: number) { return Number.isInteger(row) && Number.isInteger(column) && row >= 0 && column >= 0 && row < (state.boardSize?.rows || 0) && column < (state.boardSize?.columns || 0); }

  private boardPathClear(state: CatalogState, from: { row: number; column: number }, to: { row: number; column: number }) { const rowStep = Math.sign(to.row - from.row); const columnStep = Math.sign(to.column - from.column); let row = from.row + rowStep; let column = from.column + columnStep; while (row !== to.row || column !== to.column) { if (state.board?.[row]?.[column]) return false; row += rowStep; column += columnStep; } return true; }

  private validChessMove(state: CatalogState, from: { row: number; column: number }, to: { row: number; column: number }, piece: BoardPiece) {
    const target = state.board?.[to.row]?.[to.column];
    if (target?.color === piece.color) return false;
    const rowDelta = to.row - from.row; const columnDelta = to.column - from.column; const absRow = Math.abs(rowDelta); const absColumn = Math.abs(columnDelta);
    if (piece.type === 'ROOK') return (rowDelta === 0 || columnDelta === 0) && this.boardPathClear(state, from, to);
    if (piece.type === 'BISHOP') return absRow === absColumn && this.boardPathClear(state, from, to);
    if (piece.type === 'QUEEN') return (rowDelta === 0 || columnDelta === 0 || absRow === absColumn) && this.boardPathClear(state, from, to);
    if (piece.type === 'KNIGHT') return (absRow === 2 && absColumn === 1) || (absRow === 1 && absColumn === 2);
    if (piece.type === 'KING') return absRow <= 1 && absColumn <= 1 && (absRow + absColumn > 0);
    if (piece.type === 'PAWN') { const direction = piece.color === 'WHITE' ? -1 : 1; const startRow = piece.color === 'WHITE' ? 6 : 1; if (columnDelta === 0 && !target && rowDelta === direction) return true; if (columnDelta === 0 && !target && from.row === startRow && rowDelta === direction * 2) return !state.board?.[from.row + direction]?.[from.column]; return absColumn === 1 && rowDelta === direction && Boolean(target); }
    return false;
  }

  private validXiangqiMove(state: CatalogState, from: { row: number; column: number }, to: { row: number; column: number }, piece: BoardPiece) {
    const target = state.board?.[to.row]?.[to.column]; if (target?.color === piece.color) return false;
    const rowDelta = to.row - from.row; const columnDelta = to.column - from.column; const absRow = Math.abs(rowDelta); const absColumn = Math.abs(columnDelta); const sameSide = piece.color === 'RED' ? to.row >= 7 : to.row <= 2;
    if (piece.type === 'ROOK') return (rowDelta === 0 || columnDelta === 0) && this.boardPathClear(state, from, to);
    if (piece.type === 'CANNON') { if (rowDelta !== 0 && columnDelta !== 0) return false; let row = from.row + Math.sign(rowDelta); let column = from.column + Math.sign(columnDelta); let blockers = 0; while (row !== to.row || column !== to.column) { if (state.board?.[row]?.[column]) blockers += 1; row += Math.sign(rowDelta); column += Math.sign(columnDelta); } return target ? blockers === 1 : blockers === 0; }
    if (piece.type === 'KNIGHT') { if (!((absRow === 2 && absColumn === 1) || (absRow === 1 && absColumn === 2))) return false; const leg = absRow === 2 ? { row: from.row + Math.sign(rowDelta), column: from.column } : { row: from.row, column: from.column + Math.sign(columnDelta) }; return !state.board?.[leg.row]?.[leg.column]; }
    if (piece.type === 'ELEPHANT') { return absRow === 2 && absColumn === 2 && sameSide && !state.board?.[from.row + rowDelta / 2]?.[from.column + columnDelta / 2]; }
    if (piece.type === 'ADVISOR') return absRow === 1 && absColumn === 1 && sameSide && to.column >= 3 && to.column <= 5;
    if (piece.type === 'KING') return absRow + absColumn === 1 && sameSide && to.column >= 3 && to.column <= 5;
    if (piece.type === 'PAWN') { const direction = piece.color === 'RED' ? -1 : 1; const crossedRiver = piece.color === 'RED' ? from.row <= 4 : from.row >= 5; return (rowDelta === direction && columnDelta === 0) || (crossedRiver && rowDelta === 0 && absColumn === 1); }
    return false;
  }

  private validBoardMove(state: CatalogState, playerId: string, action: CatalogAction) {
    if (!state.board || !state.boardSize || state.players[state.currentTurnIndex] !== playerId) return false;
    const from = this.boardCoords(action.payload?.from); const to = this.boardCoords(action.payload?.to);
    if (!this.boardInBounds(state, from.row, from.column) || !this.boardInBounds(state, to.row, to.column) || (from.row === to.row && from.column === to.column)) return false;
    const piece = state.board[from.row]?.[from.column]; if (!piece || piece.color !== this.boardPlayerColor(state, playerId)) return false;
    return this.gameId === 'CHESS' ? this.validChessMove(state, from, to, piece) : this.validXiangqiMove(state, from, to, piece);
  }

  private boardMoves(state: CatalogState, playerId: string) {
    const moves: CatalogAction[] = []; const color = this.boardPlayerColor(state, playerId); const rows = state.boardSize?.rows || 0; const columns = state.boardSize?.columns || 0;
    for (let fromRow = 0; fromRow < rows; fromRow += 1) for (let fromColumn = 0; fromColumn < columns; fromColumn += 1) if (state.board?.[fromRow]?.[fromColumn]?.color === color) for (let toRow = 0; toRow < rows; toRow += 1) for (let toColumn = 0; toColumn < columns; toColumn += 1) { const action = { type: 'MOVE', payload: { from: { row: fromRow, column: fromColumn }, to: { row: toRow, column: toColumn } } }; if (this.validBoardMove(state, playerId, action)) moves.push(action); }
    return moves;
  }

  private hasCard(state: CatalogState, playerId: string, action: CatalogAction) {
    const requestedId = action.payload?.cardId || action.cardId || action.payload?.card?.id || action.card?.id;
    return Boolean(requestedId && state.hands[playerId]?.some((card) => card.id === requestedId));
  }

  getAiAction(state: CatalogState, playerId: string, difficulty: 'EASY' | 'MEDIUM' | 'HARD'): CatalogAction | null {
    if (this.currentPlayer(state) !== playerId || this.isFinished(state)) return null;
    if (this.config.category === 'board') { if (['CHESS', 'CO_TUONG'].includes(this.gameId)) return this.boardMoves(state, playerId)[difficulty === 'HARD' ? 0 : Math.floor(Math.random() * Math.max(1, this.boardMoves(state, playerId).length))] || null; return { type: 'ROLL_DICE', payload: {} }; }
    if (this.gameId === 'PHOM') return state.hasDrawn?.[playerId] ? { type: 'DISCARD', payload: { cardId: state.hands[playerId]?.[0]?.id } } : { type: 'DRAW_CARD', payload: {} };
    if (this.gameId === 'TIEN_LEN') {
      const candidates = (state.hands[playerId] || []).map((card) => ({ type: 'PLAY_CARD', payload: { cardIds: [card.id] } }));
      return candidates.find((candidate) => this.validateAction(state, candidate, playerId)) || { type: 'PASS' };
    }
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
    if (this.gameId === 'WEREWOLF' && action.type === 'VOTE') return state.phase === 'DAY' && Boolean(action.payload?.targetUserId || action.payload?.userId) && state.players.includes(action.payload?.targetUserId || action.payload?.userId);
    if (this.gameId === 'WEREWOLF' && action.type === 'NIGHT_ACTION') return state.phase === 'NIGHT' && ['WEREWOLF', 'SEER'].includes(state.roles?.[playerId] || '') && Boolean(action.payload?.targetUserId) && state.players.includes(action.payload.targetUserId);
    if (this.gameId === 'EXPLODING_KITTENS' && action.type === 'DEFUSE') return Boolean(state.pendingExplosion?.[playerId]) && state.hands[playerId]?.some((card) => card.label === 'DEFUSE');
    if (this.gameId === 'POKER' && action.type === 'CHECK') return state.bets[playerId] === (state.currentBet || 0);
    if (this.gameId === 'POKER' && ['CALL', 'RAISE', 'BET'].includes(action.type)) return Number(action.payload?.amount ?? action.amount ?? 0) >= 0;
    if (this.gameId === 'PHOM' && action.type === 'DRAW_CARD') return !state.hasDrawn?.[playerId];
    if (this.gameId === 'PHOM' && action.type === 'DISCARD') return Boolean(state.hasDrawn?.[playerId]) && this.hasCard(state, playerId, action);
    if (['CHESS', 'CO_TUONG'].includes(this.gameId) && action.type === 'MOVE') return this.validBoardMove(state, playerId, action);
    if (['DRAW_CARD', 'HIT', 'STAND', 'CHECK', 'CALL', 'RAISE', 'BET', 'FOLD', 'ROLL_DICE', 'MOVE', 'END_TURN', 'VOTE', 'NIGHT_ACTION', 'CHOOSE_DEALER', 'DEFUSE'].includes(action.type)) return true;
    if (action.type === 'PASS') return this.gameId !== 'TIEN_LEN' || Boolean(state.lastPlay && state.lastPlay.playerId !== playerId);
    if (action.type === 'PLAY_CARD' && this.gameId === 'TIEN_LEN') {
      const cards = this.cardsFromAction(state, playerId, action);
      const combo = cards.length === (action.payload?.cardIds?.length || (action.payload?.cardId ? 1 : 0)) ? this.tienLenCombo(cards) : null;
      if (!combo) return false;
      const previous = state.lastPlay;
      if (!previous || previous.playerId === playerId) return true;
      if (combo.kind === previous.kind && cards.length === previous.cards.length) return combo.power > previous.power;
      return combo.kind === 'FOUR' && previous.kind === 'PAIR' && previous.power === 15;
    }
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

  private isSimultaneousRound() { return ['BAO_CAO', 'LIENG', 'MAU_BINH', 'PHOM'].includes(this.gameId); }

  private handScore(hand: CatalogCard[]) {
    if (this.gameId === 'BAO_CAO') return hand.reduce((sum, card) => sum + (card.rank > 10 ? 0 : card.rank), 0) % 10;
    if (this.gameId === 'LIENG') { const ranks = hand.map((card) => card.rank).sort((left, right) => left - right); const same = new Set(ranks).size === 1; const straight = ranks.length === 3 && ranks[1] === ranks[0] + 1 && ranks[2] === ranks[1] + 1; return same ? 300 + ranks[0] : straight ? 200 + ranks[2] : 100 + (ranks.reduce((sum, rank) => sum + (rank > 10 ? 10 : rank), 0) % 10); }
    return hand.reduce((sum, card) => sum + (card.rank > 10 ? 10 : card.rank), 0);
  }

  private settleSimultaneousRound(state: CatalogState, events: any[]) {
    if (!this.isSimultaneousRound() || !state.players.every((player) => state.done[player] || state.folded[player])) return false;
    const winner = state.players.filter((player) => !state.folded[player]).sort((left, right) => this.handScore(state.hands[right]) - this.handScore(state.hands[left]))[0] || null;
    state.winner = winner;
    events.push({ type: 'GAME_OVER', winner, scores: Object.fromEntries(state.players.map((player) => [player, this.handScore(state.hands[player])] )) });
    return true;
  }

  private settleTwentyOne(state: CatalogState, events: any[]) {
    if (!['BLACKJACK', 'XI_DACH'].includes(this.gameId) || !state.players.every((player) => state.done[player] || state.folded[player])) return false;
    const winner = state.players.filter((player) => !state.folded[player]).sort((left, right) => this.handTotal(state.hands[right]) - this.handTotal(state.hands[left]))[0] || null;
    state.winner = winner;
    events.push({ type: 'GAME_OVER', winner, scores: Object.fromEntries(state.players.map((player) => [player, this.handTotal(state.hands[player])] )) });
    return true;
  }

  private advance(state: CatalogState, events: any[]) {
    const start = state.currentTurnIndex;
    for (let offset = 1; offset <= state.players.length; offset += 1) {
      const nextIndex = (start + offset) % state.players.length;
      const nextPlayer = state.players[nextIndex];
      if (!state.folded[nextPlayer] && !state.done[nextPlayer]) { state.currentTurnIndex = nextIndex; return; }
    }
    const active = this.activePlayers(state);
    if (!this.isSimultaneousRound() && active.length === 1) { state.winner = active[0]; events.push({ type: 'GAME_OVER', winner: active[0] }); }
  }

  private removeSelectedCard(state: CatalogState, playerId: string, action: CatalogAction) {
    const cardId = action.payload?.cardId || action.cardId || action.payload?.card?.id || action.card?.id;
    const index = state.hands[playerId].findIndex((card) => card.id === cardId);
    return index >= 0 ? state.hands[playerId].splice(index, 1)[0] : null;
  }

  applyAction(state: CatalogState, action: CatalogAction, playerId: string) {
    const nextState = JSON.parse(JSON.stringify(state)) as CatalogState;
    nextState.hasDrawn ||= {};
    nextState.passesInRound ||= 0;
    const events: any[] = [];
    nextState.lastAction = { ...action, playerId, at: new Date().toISOString() };
    switch (action.type) {
      case 'DRAW_CARD': { const before = nextState.hands[playerId].length; this.draw(nextState, playerId); const drawn = nextState.hands[playerId][before]; events.push({ type: 'CARD_DRAWN', playerId, exploding: drawn?.label === 'EXPLODING' }); if (this.gameId === 'EXPLODING_KITTENS' && drawn?.label === 'EXPLODING') { nextState.pendingExplosion[playerId] = true; if (!nextState.hands[playerId].some((card) => card.label === 'DEFUSE')) { nextState.folded[playerId] = true; nextState.pendingExplosion[playerId] = false; events.push({ type: 'PLAYER_EXPLODED', playerId }); this.advance(nextState, events); } } else if (this.gameId === 'PHOM') nextState.hasDrawn[playerId] = true; else this.advance(nextState, events); break; }
      case 'HIT': {
        this.draw(nextState, playerId);
        const total = this.handTotal(nextState.hands[playerId]);
        events.push({ type: 'HIT', playerId, total });
        if (total > 21) { nextState.folded[playerId] = true; this.settleTwentyOne(nextState, events); if (!nextState.winner) this.advance(nextState, events); }
        else if (!['BLACKJACK', 'XI_DACH'].includes(this.gameId)) this.advance(nextState, events);
        break;
      }
      case 'PLAY_CARD': {
        const cards = this.gameId === 'TIEN_LEN' ? this.cardsFromAction(nextState, playerId, action) : [this.removeSelectedCard(nextState, playerId, action)].filter(Boolean) as CatalogCard[];
        cards.forEach((card) => { const index = nextState.hands[playerId].findIndex((item) => item.id === card.id); if (index >= 0) nextState.hands[playerId].splice(index, 1); nextState.discardPile.push(card); });
        if (this.gameId === 'TIEN_LEN') { const combo = this.tienLenCombo(cards)!; nextState.lastPlay = { playerId, cards, kind: combo.kind, power: combo.power }; nextState.passesInRound = 0; events.push({ type: 'COMBO_PLAYED', playerId, kind: combo.kind, cardCount: cards.length, power: combo.power }); }
        else if (cards[0]) events.push({ type: 'CARD_PLAYED', playerId, card: cards[0] });
        if (!nextState.hands[playerId].length && this.gameId !== 'POKER') { nextState.winner = playerId; events.push({ type: 'GAME_OVER', winner: playerId }); } else this.advance(nextState, events);
        break;
      }
      case 'DISCARD': { const card = this.removeSelectedCard(nextState, playerId, action); if (card) nextState.discardPile.push(card); nextState.hasDrawn[playerId] = false; events.push({ type: 'CARD_DISCARDED', playerId }); this.advance(nextState, events); break; }
      case 'DEFUSE': { const card = nextState.hands[playerId].find((item) => item.label === 'DEFUSE'); const bomb = nextState.hands[playerId].find((item) => item.label === 'EXPLODING'); if (card) nextState.hands[playerId] = nextState.hands[playerId].filter((item) => item.id !== card.id); if (bomb) nextState.hands[playerId] = nextState.hands[playerId].filter((item) => item.id !== bomb.id); if (bomb) nextState.deck.splice(Math.floor(Math.random() * (nextState.deck.length + 1)), 0, bomb); nextState.pendingExplosion[playerId] = false; events.push({ type: 'DEFUSED', playerId }); this.advance(nextState, events); break; }
      case 'STAND': nextState.done[playerId] = true; events.push({ type: 'STAND', playerId, total: this.handTotal(nextState.hands[playerId]) }); if (!this.settleTwentyOne(nextState, events)) this.advance(nextState, events); break;
      case 'SUBMIT_HAND': nextState.done[playerId] = true; nextState.scores[playerId] = this.handScore(nextState.hands[playerId]); events.push({ type: 'HAND_SUBMITTED', playerId, score: nextState.scores[playerId] }); if (!this.settleSimultaneousRound(nextState, events)) this.advance(nextState, events); break;
      case 'BET': case 'CALL': case 'RAISE': case 'CHECK': {
        const requested = Math.max(0, Number(action.payload?.amount ?? action.amount ?? 0));
        const amount = this.gameId === 'POKER' ? action.type === 'CALL' ? Math.max(0, (nextState.currentBet || 0) - nextState.bets[playerId]) : ['RAISE', 'BET'].includes(action.type) ? Math.max(1, requested) : 0 : requested;
        if (this.gameId === 'POKER' && ['RAISE', 'BET'].includes(action.type)) nextState.currentBet = Math.max(nextState.currentBet || 0, nextState.bets[playerId] + amount);
        nextState.bets[playerId] += amount; nextState.acted[playerId] = true;
        events.push({ type: 'BET_PLACED', playerId, amount, action: action.type, currentBet: nextState.currentBet });
        const active = this.activePlayers(nextState);
        const roundComplete = this.gameId === 'POKER' && active.length > 0 && active.every((player) => nextState.acted[player] && nextState.bets[player] >= (nextState.currentBet || 0));
        if (roundComplete) {
          if (nextState.bettingRound === 'PREFLOP') { for (let index = 0; index < 3; index += 1) { const card = nextState.deck.shift(); if (card) nextState.communityCards.push(card); } nextState.bettingRound = 'FLOP'; }
          else if (nextState.bettingRound === 'FLOP' || nextState.bettingRound === 'TURN') { const card = nextState.deck.shift(); if (card) nextState.communityCards.push(card); nextState.bettingRound = nextState.bettingRound === 'FLOP' ? 'TURN' : 'RIVER'; }
          else if (nextState.bettingRound === 'RIVER') { nextState.bettingRound = 'SHOWDOWN'; nextState.done = Object.fromEntries(nextState.players.map((player) => [player, true])); }
          nextState.players.forEach((player) => { nextState.acted[player] = false; nextState.bets[player] = 0; }); nextState.currentBet = 0;
        }
        if (this.gameId === 'POKER' && nextState.bettingRound === 'SHOWDOWN') { nextState.winner = active.sort((left, right) => this.handScore(nextState.hands[right].concat(nextState.communityCards)) - this.handScore(nextState.hands[left].concat(nextState.communityCards)))[0] || null; events.push({ type: 'SHOWDOWN', winner: nextState.winner }); }
        else this.advance(nextState, events);
        break;
      }
      case 'FOLD': nextState.folded[playerId] = true; events.push({ type: 'PLAYER_FOLDED', playerId }); this.advance(nextState, events); break;
      case 'PASS': case 'END_TURN': {
        if (this.gameId === 'TIEN_LEN' && nextState.lastPlay) {
          nextState.passesInRound += 1;
          if (nextState.passesInRound >= nextState.players.length - 1) { const lastPlayer = nextState.lastPlay.playerId; nextState.lastPlay = undefined; nextState.passesInRound = 0; nextState.currentTurnIndex = Math.max(0, nextState.players.indexOf(lastPlayer)); }
          else this.advance(nextState, events);
        } else this.advance(nextState, events);
        events.push({ type: 'PASS', playerId });
        break;
      }
      case 'ROLL_DICE': { nextState.dice = Math.floor(Math.random() * 6) + 1; nextState.positions[playerId] += nextState.dice; events.push({ type: 'DICE_ROLLED', playerId, dice: nextState.dice, position: nextState.positions[playerId] }); if (nextState.positions[playerId] >= (this.gameId === 'CO_CA_NGUA' ? 56 : 40)) nextState.winner = playerId; else this.advance(nextState, events); break; }
      case 'MOVE': { if (['CHESS', 'CO_TUONG'].includes(this.gameId)) { const from = this.boardCoords(action.payload?.from); const to = this.boardCoords(action.payload?.to); const piece = nextState.board?.[from.row]?.[from.column]; const captured = nextState.board?.[to.row]?.[to.column]; if (piece && nextState.board) { nextState.board[to.row][to.column] = piece; nextState.board[from.row][from.column] = null; events.push({ type: 'PIECE_MOVED', playerId, from, to, piece: piece.type, captured: captured?.type || null }); if (captured?.type === 'KING') nextState.winner = playerId; else this.advance(nextState, events); } } else { nextState.positions[playerId] += Math.max(1, Number(action.payload?.steps || 1)); events.push({ type: 'PIECE_MOVED', playerId, position: nextState.positions[playerId] }); this.advance(nextState, events); } break; }
      case 'CHOOSE_DEALER': nextState.dealerId = action.payload?.userId || playerId; events.push({ type: 'DEALER_CHANGED', dealerId: nextState.dealerId }); this.advance(nextState, events); break;
      case 'VOTE': { const target = action.payload?.targetUserId || action.payload?.userId; nextState.votes[playerId] = target; events.push({ type: 'VOTE_CAST', playerId, target }); const livingPlayers = this.activePlayers(nextState); if (livingPlayers.every((player) => nextState.votes[player])) { const tally: Record<string, number> = {}; Object.values(nextState.votes).forEach((value) => { tally[value] = (tally[value] || 0) + 1; }); const eliminated = Object.entries(tally).sort((left, right) => right[1] - left[1])[0]?.[0]; if (eliminated) { nextState.folded[eliminated] = true; events.push({ type: 'PLAYER_ELIMINATED', playerId: eliminated, reason: 'VOTE' }); } nextState.phase = 'NIGHT'; nextState.votes = {}; nextState.currentTurnIndex = Math.max(0, nextState.players.findIndex((player) => !nextState.folded[player])); events.push({ type: 'DAY_RESOLVED', eliminated: eliminated || null }); } break; }
      case 'NIGHT_ACTION': { const target = action.payload?.targetUserId || null; nextState.nightActions[playerId] = { type: nextState.roles?.[playerId] || 'NIGHT_ACTION', targetUserId: target }; events.push({ type: 'NIGHT_ACTION', playerId, target }); const livingPlayers = this.activePlayers(nextState); const nightActors = livingPlayers.filter((player) => ['WEREWOLF', 'SEER'].includes(nextState.roles?.[player] || '')); if (nightActors.every((player) => nextState.nightActions[player])) { const wolfTargets = nightActors.filter((player) => nextState.roles?.[player] === 'WEREWOLF').map((player) => nextState.nightActions[player].targetUserId).filter(Boolean); const victim = wolfTargets[0]; if (victim && nextState.players.includes(victim)) { nextState.folded[victim] = true; events.push({ type: 'PLAYER_ELIMINATED', playerId: victim, reason: 'NIGHT' }); } nextState.nightActions = {}; nextState.phase = 'DAY'; nextState.currentTurnIndex = Math.max(0, nextState.players.findIndex((player) => !nextState.folded[player])); events.push({ type: 'NIGHT_RESOLVED', victim: victim || null }); } break; }
      default: break;
    }
    return { newState: nextState, events };
  }

  private handTotal(hand: CatalogCard[]) { let total = hand.reduce((sum, card) => sum + (card.rank > 10 ? 10 : card.rank), 0); const aces = hand.filter((card) => card.rank === 1).length; for (let index = 0; index < aces && total + 10 <= 21; index += 1) total += 10; return total; }

  getPublicState(state: CatalogState, playerId: string) {
    const publicHands: Record<string, number> = {};
    for (const player of state.players) publicHands[player] = state.hands[player]?.length || 0;
    const publicState: any = { ...state, hands: undefined, deck: undefined, deckCount: state.deck.length, myHand: state.hands[playerId] || [], playerCardCounts: publicHands };
    if (state.roles) publicState.roles = { [playerId]: state.roles[playerId] };
    return publicState;
  }

  isFinished(state: CatalogState) {
    if (state.winner) return true;
    if (['BLACKJACK', 'XI_DACH'].includes(this.gameId)) return state.players.every((player) => state.done[player] || state.folded[player]);
    if (this.isSimultaneousRound()) return state.players.every((player) => state.done[player] || state.folded[player]);
    return this.activePlayers(state).length <= 1;
  }
  calculateResult(state: CatalogState) {
    const winner = ['BLACKJACK', 'XI_DACH'].includes(this.gameId) ? state.players.filter((player) => !state.folded[player]).sort((left, right) => this.handTotal(state.hands[right]) - this.handTotal(state.hands[left]))[0] || null : this.isSimultaneousRound() ? state.players.filter((player) => !state.folded[player]).sort((left, right) => this.handScore(state.hands[right]) - this.handScore(state.hands[left]))[0] || null : state.winner || this.activePlayers(state)[0] || null;
    return { winner, scores: state.scores, bets: state.bets };
  }
}
