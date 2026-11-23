import { Chess } from 'chess.js';
import type { GameEngine } from '../core/GameEngine';
import { randomInt, shuffle } from '../core/random';
import { chessBoard, chessKey, chessMoves, legalChessMove, restoreChess } from '../boards/ChessRules';
import { xiangqiBoard, xiangqiCheck, xiangqiMoves, legalXiangqiMove, type BoardPiece, type Point, type XiangqiColor } from '../boards/XiangqiRules';
import { arrangeMauBinh, compareRanks, handGroups, isMeld, phomPoints, rankHand, type PlayingCard } from './CardRules';
import { bettingOptions, initializeBets, playBet, validBet, type BettingState } from './BettingRules';
import { CITY_CELLS, RACE_LENGTH, STABLE_FINISH, horseMoves, raceSquare } from './RaceRules';

export type CatalogAction = { type: string; payload?: Record<string, unknown>; cardId?: string; amount?: number };
interface CatalogState extends BettingState {
  discardPile: PlayingCard[];
  scores: Record<string, number>;
  done: Record<string, boolean>;
  positions: Record<string, number>;
  dice: number | null;
  dealerId?: string | null;
  dealerHand?: PlayingCard[];
  outcomes?: Record<string, string>;
  hasDrawn: Record<string, boolean>;
  discardCounts?: Record<string, number>;
  claimedMelds?: Record<string, string[][]>;
  arrangements?: Record<string, string[][]>;
  lastDiscardBy?: string;
  board?: Array<Array<BoardPiece | null>>;
  boardSize?: { rows: number; columns: number };
  chess?: { fen: string };
  positionCounts?: Record<string, number>;
  moveCount?: number;
  checked?: boolean;
  endReason?: string;
  pendingExplosion: Record<string, boolean>;
  horses?: Record<string, number[]>;
  properties?: Record<number, { owner: string; level: number }>;
  cityTurns?: number;
  cityDecision?: boolean;
}

const HAND_SIZE: Record<string, number> = {
  BLACKJACK: 2, PHOM: 9, XI_DACH: 2, POKER: 2, MAU_BINH: 13, BAO_CAO: 3, LIENG: 3, EXPLODING_KITTENS: 4,
};

const mapPlayers = <T>(players: string[], value: (player: string) => T) =>
  Object.fromEntries(players.map((player) => [player, value(player)]));
const event = (type: string, playerId: string, details = {}) => ({ type, playerId, ...details });

function deckFor(gameId: string) {
  const suits = ['S', 'H', 'D', 'C'] as const;
  return shuffle(suits.flatMap((suit, suitIndex) => Array.from({ length: 13 }, (_, index) => {
    const rank = index + 1;
    return {
      id: `${gameId}-${suitIndex * 13 + rank}`, rank, suit,
      label: rank === 1 ? 'A' : rank > 10 ? ['J', 'Q', 'K'][rank - 11] : String(rank),
      color: suit === 'H' || suit === 'D' ? 'RED' as const : 'BLACK' as const,
    };
  })));
}

const specialCard = (label: string, index: number): PlayingCard => ({
  id: `EXPLODING_KITTENS-${label}-${index}`, label, rank: 0, suit: 'C', color: label === 'EXPLODING' ? 'RED' : 'BLACK',
});

function score21(hand: PlayingCard[]) {
  let total = hand.reduce((sum, card) => sum + Math.min(card.rank, 10), 0);
  if (total <= 11 && hand.some((card) => card.rank === 1)) total += 10;
  return total;
}

function rank21(hand: PlayingCard[], gameId: string) {
  const total = score21(hand);
  if (gameId === 'XI_DACH' && hand.length === 2 && hand.every((card) => card.rank === 1)) return 24;
  if (total === 21 && hand.length === 2) return 23;
  if (gameId === 'XI_DACH' && hand.length >= 5 && total <= 21) return 22;
  return total > 21 ? -1 : total;
}

const xiangqiColor = (index: number): XiangqiColor => index === 0 ? 'RED' : 'BLACK_SIDE';
const selectedId = (action: CatalogAction) => action.payload?.cardId ?? action.cardId;

function pointOf(value: unknown, rows: number, columns: number): Point | null {
  if (!value || typeof value !== 'object') return null;
  const [row, column] = Array.isArray(value) ? value : [(value as Point).row, (value as Point).column];
  return Number.isInteger(row) && row >= 0 && row < rows && Number.isInteger(column) && column >= 0 && column < columns ? { row, column } : null;
}

export class CatalogGameEngine implements GameEngine<CatalogState, CatalogAction, unknown> {
  private readonly gameId: string;

  constructor(gameId: string) {
    this.gameId = gameId;
  }

  private get betting() { return this.gameId === 'POKER' || this.gameId === 'LIENG'; }
  private get boardGame() { return this.gameId === 'CHESS' || this.gameId === 'CO_TUONG'; }
  private get twentyOne() { return this.gameId === 'BLACKJACK' || this.gameId === 'XI_DACH'; }

  initialize(players: string[]): CatalogState {
    let deck = HAND_SIZE[this.gameId] ? deckFor(this.gameId) : [];
    const hands = mapPlayers(players, () => deck.splice(0, HAND_SIZE[this.gameId] || 0));
    const state: CatalogState = {
      gameId: this.gameId, players, deck, hands, discardPile: [], currentTurnIndex: 0,
      winner: null, phase: 'PLAYING', scores: mapPlayers(players, () => this.gameId === 'CO_TY_PHU' ? 1500 : 0),
      bets: mapPlayers(players, () => 0), folded: mapPlayers(players, () => false), done: mapPlayers(players, () => false),
      positions: mapPlayers(players, () => 0), dice: null, hasDrawn: mapPlayers(players, () => false),
      communityCards: [], bettingRound: 'PREFLOP', currentBet: 0, pendingExplosion: mapPlayers(players, () => false),
    };
    if (this.betting) initializeBets(state);
    if (this.gameId === 'BLACKJACK') state.dealerHand = deck.splice(0, 2);
    if (this.gameId === 'XI_DACH') {
      state.dealerId = players[0];
      state.currentTurnIndex = 1;
    }
    if (this.gameId === 'PHOM') {
      hands[players[0]].push(deck.shift()!);
      state.hasDrawn[players[0]] = true;
      state.discardCounts = mapPlayers(players, () => 0);
      state.claimedMelds = mapPlayers(players, () => []);
    }
    if (this.gameId === 'MAU_BINH') state.arrangements = {};
    if (this.gameId === 'CHESS') {
      const chess = new Chess();
      state.chess = { fen: chess.fen() };
      state.positionCounts = { [chessKey(chess)]: 1 };
      state.board = chessBoard(chess);
      state.boardSize = { rows: 8, columns: 8 };
    }
    if (this.gameId === 'CO_TUONG') {
      state.board = xiangqiBoard();
      state.boardSize = { rows: 10, columns: 9 };
      state.positionCounts = { [this.boardKey(state)]: 1 };
      state.moveCount = 0;
    }
    if (this.gameId === 'CO_CA_NGUA') state.horses = mapPlayers(players, () => [-1, -1, -1, -1]);
    if (this.gameId === 'CO_TY_PHU') state.properties = {};
    if (this.gameId === 'EXPLODING_KITTENS') {
      const actionCards = ['SKIP', 'SHUFFLE', 'SKIP', 'SHUFFLE', 'SKIP', 'SHUFFLE'];
      deck = shuffle([...deck, ...actionCards.map(specialCard), ...players.slice(1).map((_, i) => specialCard('EXPLODING', i))]);
      state.deck = deck;
      players.forEach((id, i) => hands[id].push(specialCard('DEFUSE', i)));
    }
    return state;
  }

  private advance(state: CatalogState) {
    for (let offset = 1; offset <= state.players.length; offset++) {
      const next = (state.currentTurnIndex + offset) % state.players.length;
      if (!state.done[state.players[next]] && !state.folded[state.players[next]]) {
        state.currentTurnIndex = next;
        return;
      }
    }
  }

  private finish(state: CatalogState, winners: string[], reason: string) {
    state.phase = 'FINISHED';
    state.winners = winners;
    state.winner = winners.length === 1 ? winners[0] : null;
    state.endReason = reason;
  }

  private bestScores(state: CatalogState, lowest = false) {
    const values = Object.values(state.scores);
    const best = lowest ? Math.min(...values) : Math.max(...values);
    return state.players.filter((player) => state.scores[player] === best);
  }

  private boardKey(state: CatalogState) {
    return JSON.stringify([state.currentTurnIndex, state.board]);
  }

  private boardActions(state: CatalogState) {
    return this.gameId === 'CHESS' ? chessMoves(restoreChess(state)) : xiangqiMoves(state.board!, xiangqiColor(state.currentTurnIndex));
  }

  private applyBoardMove(state: CatalogState, action: CatalogAction, player: string) {
    const from = action.payload!.from as Point;
    const to = action.payload!.to as Point;
    let notation: string | undefined;
    if (this.gameId === 'CHESS') {
      const game = restoreChess(state);
      state.positionCounts ??= { [chessKey(game)]: 1 };
      const move = legalChessMove(game, from, to, action.payload?.promotion)!;
      game.move(move);
      state.chess = { fen: game.fen() };
      const key = chessKey(game);
      state.positionCounts[key] = (state.positionCounts[key] || 0) + 1;
      state.board = chessBoard(game);
      notation = move.san;
      this.advance(state);
      state.checked = game.isCheck();
      if (game.isCheckmate()) this.finish(state, [player], 'CHECKMATE');
      else if (game.isDraw() || state.positionCounts[key] >= 3) this.finish(state, [], game.isStalemate() ? 'STALEMATE' : 'DRAW');
    } else {
      state.board![to.row][to.column] = state.board![from.row][from.column];
      state.board![from.row][from.column] = null;
      this.advance(state);
      const color = xiangqiColor(state.currentTurnIndex);
      state.checked = xiangqiCheck(state.board!, color);
      const key = this.boardKey(state);
      state.positionCounts ??= {};
      state.positionCounts[key] = (state.positionCounts[key] || 0) + 1;
      state.moveCount = (state.moveCount || 0) + 1;
      if (!xiangqiMoves(state.board!, color).length) this.finish(state, [player], state.checked ? 'CHECKMATE' : 'NO_LEGAL_MOVES');
      else if (state.positionCounts[key] >= 3 || state.moveCount >= 300) this.finish(state, [], 'DRAW');
    }
    return event('PIECE_MOVED', player, { from, to, notation });
  }

  private phomClaim(state: CatalogState, player: string, ids: unknown) {
    const card = state.discardPile.at(-1);
    if (!card || !state.lastDiscardBy || state.lastDiscardBy === player || !Array.isArray(ids) || ids.length !== 2 || new Set(ids).size !== 2) return false;
    const cards = ids.map((id) => state.hands[player].find((item) => item.id === id));
    const locked = state.claimedMelds?.[player]?.flat() || [];
    return cards.every((item): item is PlayingCard => Boolean(item && !locked.includes(item.id))) && isMeld([card, ...cards]);
  }

  private settlePhom(state: CatalogState) {
    const points = mapPlayers(state.players, (id) => phomPoints(state.hands[id], state.claimedMelds?.[id]));
    state.scores = mapPlayers(state.players, (id) => points[id].deadwood);
    const best = Math.min(...state.players.map((id) => points[id].deadwood + (points[id].melds ? 0 : 1000)));
    this.finish(state, state.players.filter((id) => points[id].deadwood + (points[id].melds ? 0 : 1000) === best), 'PHOM_POINTS');
  }

  private settleTwentyOne(state: CatalogState) {
    if (this.gameId === 'BLACKJACK') {
      state.dealerHand ??= state.deck.splice(0, 2);
      while (score21(state.dealerHand) < 17 && state.deck.length) state.dealerHand.push(state.deck.shift()!);
    }
    const dealer = state.dealerId ?? null;
    const dealerCards = dealer ? state.hands[dealer] : state.dealerHand!;
    const dealerRank = rank21(dealerCards, this.gameId);
    const winners: string[] = [];
    state.outcomes = {};
    let dealerWins = 0;
    for (const player of state.players.filter((id) => id !== dealer)) {
      const rank = rank21(state.hands[player], this.gameId);
      const outcome = rank < 0 || rank < dealerRank ? 'LOSS' : rank === dealerRank ? 'PUSH' : 'WIN';
      state.outcomes[player] = outcome;
      if (outcome === 'WIN') winners.push(player);
      if (outcome === 'LOSS') dealerWins++;
    }
    if (dealer && dealerWins) winners.push(dealer);
    state.scores = mapPlayers(state.players, (id) => score21(state.hands[id]));
    this.finish(state, winners, 'DEALER_SETTLEMENT');
  }

  private settleMauBinh(state: CatalogState) {
    const ranks = mapPlayers(state.players, (id) => {
      const groups = handGroups(state.hands[id], state.arrangements?.[id]) ?? arrangeMauBinh(state.hands[id]);
      return groups.map(rankHand);
    });
    const valid = (id: string) => compareRanks(ranks[id][0], ranks[id][1]) <= 0 && compareRanks(ranks[id][1], ranks[id][2]) <= 0;
    state.scores = mapPlayers(state.players, () => 0);
    for (let i = 0; i < state.players.length; i++) for (let j = i + 1; j < state.players.length; j++) {
      const a = state.players[i];
      const b = state.players[j];
      const score = valid(a) === valid(b) ? ranks[a].reduce((sum, rank, group) => sum + Math.sign(compareRanks(rank, ranks[b][group])), 0) :
        valid(a) ? 3 : -3;
      const adjusted = !valid(a) && !valid(b) ? 0 : Math.abs(score) === 3 ? score * 2 : score;
      state.scores[a] += adjusted;
      state.scores[b] -= adjusted;
    }
    this.finish(state, this.bestScores(state), 'MAU_BINH_POINTS');
  }

  private available(state: CatalogState, player: string) {
    if (this.isFinished(state) || state.players[state.currentTurnIndex] !== player || state.folded[player] || state.done[player]) return [];
    if (this.betting) return bettingOptions(state, player).actions;
    if (this.boardGame) return ['MOVE'];
    if (this.twentyOne) return [...(state.deck.length && rank21(state.hands[player], this.gameId) < 22 && score21(state.hands[player]) < 21 ? ['HIT'] : []), 'STAND'];
    switch (this.gameId) {
      case 'PHOM': return state.hasDrawn[player] ? ['DISCARD'] : [...(state.deck.length ? ['DRAW_CARD'] : []), ...(state.lastDiscardBy ? ['TAKE_DISCARD'] : [])];
      case 'BAO_CAO':
      case 'MAU_BINH': return ['SUBMIT_HAND'];
      case 'EXPLODING_KITTENS': return state.pendingExplosion[player] ? ['DEFUSE'] : ['DRAW_CARD', 'PLAY_CARD'];
      case 'CO_CA_NGUA': return state.dice && state.horses ? ['MOVE_HORSE'] : ['ROLL_DICE'];
      case 'CO_TY_PHU': {
        if (!state.cityDecision) return ['ROLL_DICE'];
        const cell = CITY_CELLS[state.positions[player] % CITY_CELLS.length];
        const property = state.properties?.[cell.index];
        return ['END_TURN', ...(!property && cell.price > 0 && cell.price <= state.scores[player] ? ['BUY'] : []),
          ...(property?.owner === player && property.level < 3 && state.scores[player] >= Math.floor(cell.price / 2) ? ['UPGRADE'] : [])];
      }
      default: return [];
    }
  }

  validateAction(state: CatalogState, action: CatalogAction, player: string): boolean {
    if (!action || !this.available(state, player).includes(action.type)) return false;
    if (this.betting) return validBet(state, player, action.type, action.payload?.amount ?? action.amount);
    if (action.type === 'MOVE') {
      const size = state.boardSize!;
      const from = pointOf(action.payload?.from, size.rows, size.columns);
      const to = pointOf(action.payload?.to, size.rows, size.columns);
      return Boolean(from && to && (this.gameId === 'CHESS' ? legalChessMove(restoreChess(state), from, to, action.payload?.promotion) :
        legalXiangqiMove(state.board!, from, to, xiangqiColor(state.currentTurnIndex))));
    }
    if (action.type === 'MOVE_HORSE') return horseMoves(state.horses!, state.players, player, state.dice!).some(({ index }) => index === action.payload?.index);
    if (action.type === 'TAKE_DISCARD') return this.phomClaim(state, player, action.payload?.cardIds);
    if (action.type === 'DISCARD') return state.hands[player].some((card) => card.id === selectedId(action)) &&
      !(state.claimedMelds?.[player]?.flat().includes(String(selectedId(action))));
    if (action.type === 'PLAY_CARD') return state.hands[player].some((card) => card.id === selectedId(action) && ['SKIP', 'SHUFFLE'].includes(card.label));
    if (action.type === 'DEFUSE') {
      const index = action.payload?.index;
      return state.hands[player].some((card) => card.label === 'DEFUSE') &&
        (index === undefined || typeof index === 'number' && Number.isSafeInteger(index) && index >= 0 && index <= state.deck.length);
    }
    if (this.gameId === 'MAU_BINH') return Boolean(handGroups(state.hands[player], action.payload?.groups));
    return true;
  }

  applyAction(state: CatalogState, action: CatalogAction, player: string) {
    if (!this.validateAction(state, action, player)) throw new Error('INVALID_ACTION');
    const next = structuredClone(state);
    const hand = next.hands[player];
    const events = [];
    if (this.betting) {
      const amount = playBet(next, player, action.type, (action.payload?.amount ?? action.amount) as number | undefined);
      events.push(event(action.type === 'FOLD' ? 'PLAYER_FOLDED' : 'BET_PLACED', player, { amount, action: action.type }));
    } else if (this.boardGame) {
      const size = next.boardSize!;
      events.push(this.applyBoardMove(next, { ...action, payload: { ...action.payload,
        from: pointOf(action.payload?.from, size.rows, size.columns)!, to: pointOf(action.payload?.to, size.rows, size.columns)! } }, player));
    } else if (this.twentyOne) {
      if (action.type === 'HIT') hand.push(next.deck.shift()!);
      if (action.type === 'STAND' || rank21(hand, this.gameId) < 0 || score21(hand) === 21 || rank21(hand, this.gameId) >= 22) {
        next.done[player] = true;
        if (next.players.every((id) => next.done[id] || next.folded[id])) this.settleTwentyOne(next);
        else this.advance(next);
      }
      events.push(event(action.type, player));
    } else if (this.gameId === 'PHOM') {
      next.claimedMelds ??= {};
      next.discardCounts ??= {};
      if (action.type === 'DRAW_CARD') {
        hand.push(next.deck.shift()!);
        next.hasDrawn[player] = true;
      } else if (action.type === 'TAKE_DISCARD') {
        const card = next.discardPile.pop()!;
        hand.push(card);
        (next.claimedMelds[player] ??= []).push([card.id, ...(action.payload!.cardIds as string[])]);
        next.hasDrawn[player] = true;
      } else {
        next.discardPile.push(hand.splice(hand.findIndex((card) => card.id === selectedId(action)), 1)[0]);
        next.lastDiscardBy = player;
        next.hasDrawn[player] = false;
        next.discardCounts[player] = (next.discardCounts[player] || 0) + 1;
        if (phomPoints(hand, next.claimedMelds[player]).deadwood === 0) this.finish(next, [player], 'PHOM_U');
        else if (!next.deck.length || next.players.every((id) => (next.discardCounts![id] || 0) >= 4)) this.settlePhom(next);
        else this.advance(next);
      }
      events.push(event(action.type, player));
    } else if (this.gameId === 'MAU_BINH' || this.gameId === 'BAO_CAO') {
      if (this.gameId === 'MAU_BINH') (next.arrangements ??= {})[player] = action.payload!.groups as string[][];
      next.done[player] = true;
      if (next.players.every((id) => next.done[id])) {
        if (this.gameId === 'MAU_BINH') this.settleMauBinh(next);
        else {
          next.scores = mapPlayers(next.players, (id) => next.hands[id].reduce((sum, card) => sum + Math.min(card.rank, 10), 0) % 10);
          this.finish(next, this.bestScores(next), 'BAO_CAO_POINTS');
        }
      } else this.advance(next);
      events.push(event('HAND_SUBMITTED', player));
    } else if (this.gameId === 'EXPLODING_KITTENS') {
      this.playKittens(next, action, player);
      events.push(event(action.type, player));
    } else if (this.gameId === 'CO_CA_NGUA') {
      this.playHorse(next, action, player);
      events.push(event(action.type, player, { dice: next.dice }));
    } else if (this.gameId === 'CO_TY_PHU') {
      this.playCity(next, action.type, player);
      events.push(event(action.type, player, { dice: next.dice }));
    }
    if (this.isFinished(next)) events.push(event('GAME_OVER', player, { winner: next.winner, reason: next.endReason }));
    return { newState: next, events };
  }

  private playKittens(state: CatalogState, action: CatalogAction, player: string) {
    const hand = state.hands[player];
    if (action.type === 'DEFUSE') {
      const bomb = hand.splice(hand.findIndex((card) => card.label === 'EXPLODING'), 1)[0];
      state.discardPile.push(hand.splice(hand.findIndex((card) => card.label === 'DEFUSE'), 1)[0]);
      if (bomb) state.deck.splice((action.payload?.index as number | undefined) ?? randomInt(state.deck.length + 1), 0, bomb);
      state.pendingExplosion[player] = false;
      this.advance(state);
      return;
    }
    if (action.type === 'PLAY_CARD') {
      const card = hand.splice(hand.findIndex((item) => item.id === selectedId(action)), 1)[0];
      state.discardPile.push(card);
      if (card.label === 'SHUFFLE') state.deck = shuffle(state.deck);
      else this.advance(state);
      return;
    }
    const card = state.deck.shift();
    if (!card) {
      this.finish(state, state.players.filter((id) => !state.folded[id]), 'EMPTY_DECK');
      return;
    }
    if (card.label === 'EXPLODING') {
      if (hand.some((item) => item.label === 'DEFUSE')) {
        hand.push(card);
        state.pendingExplosion[player] = true;
        return;
      }
      state.discardPile.push(card);
      state.folded[player] = true;
    } else hand.push(card);
    const alive = state.players.filter((id) => !state.folded[id]);
    if (alive.length === 1) this.finish(state, alive, 'LAST_PLAYER');
    else this.advance(state);
  }

  private playHorse(state: CatalogState, action: CatalogAction, player: string) {
    const horses = state.horses ??= mapPlayers(state.players, () => [-1, -1, -1, -1]);
    if (action.type === 'ROLL_DICE') {
      state.dice = randomInt(6) + 1;
      if (!horseMoves(horses, state.players, player, state.dice).length) {
        state.dice = null;
        this.advance(state);
      }
      return;
    }
    const die = state.dice!;
    const { index, destination } = horseMoves(horses, state.players, player, die).find((move) => move.index === action.payload?.index)!;
    horses[player][index] = destination;
    if (destination < RACE_LENGTH) {
      const square = raceSquare(destination, state.currentTurnIndex, state.players.length);
      state.players.forEach((id, seat) => {
        if (id !== player) horses[id] = horses[id].map((pos) => pos >= 0 && pos < RACE_LENGTH && raceSquare(pos, seat, state.players.length) === square ? -1 : pos);
      });
    }
    state.dice = null;
    if (horses[player].every((position) => position === STABLE_FINISH)) this.finish(state, [player], 'ALL_HORSES_HOME');
    else if (die !== 6) this.advance(state);
  }

  private playCity(state: CatalogState, type: string, player: string) {
    const properties = state.properties ??= {};
    const endTurn = () => {
      state.cityDecision = false;
      state.cityTurns = (state.cityTurns || 0) + 1;
      const alive = state.players.filter((id) => !state.folded[id]);
      if (alive.length === 1) this.finish(state, alive, 'LAST_PLAYER');
      else if (state.cityTurns >= state.players.length * 20) {
        const worth = mapPlayers(alive, (id) => state.scores[id] + CITY_CELLS.reduce((sum, cell) =>
          sum + (properties[cell.index]?.owner === id ? cell.price + properties[cell.index].level * Math.floor(cell.price / 2) : 0), 0));
        this.finish(state, alive.filter((id) => worth[id] === Math.max(...Object.values(worth))), 'NET_WORTH');
      } else this.advance(state);
    };
    if (type === 'ROLL_DICE') {
      state.dice = randomInt(6) + 1 + randomInt(6) + 1;
      if (state.positions[player] + state.dice >= CITY_CELLS.length) state.scores[player] += 200;
      state.positions[player] = (state.positions[player] + state.dice) % CITY_CELLS.length;
    }
    const cell = CITY_CELLS[state.positions[player] % CITY_CELLS.length];
    const property = properties[cell.index];
    if (type === 'BUY') {
      state.scores[player] -= cell.price;
      properties[cell.index] = { owner: player, level: 0 };
    }
    if (type === 'UPGRADE') {
      state.scores[player] -= Math.floor(cell.price / 2);
      property.level++;
    }
    if (type !== 'ROLL_DICE') return endTurn();
    const rent = property && property.owner !== player ? cell.rent * (property.level + 1) : 0;
    const fee = rent || (cell.index === 12 ? 100 : 0);
    const balance = state.scores[player];
    state.scores[player] = Math.max(0, balance - fee) + (cell.index === 18 ? 100 : 0);
    if (rent) state.scores[property.owner] += Math.min(balance, rent);
    if (fee > balance) {
      state.folded[player] = true;
      for (const tile of CITY_CELLS) if (properties[tile.index]?.owner === player) delete properties[tile.index];
    }
    state.cityDecision = Boolean(cell.price && !state.folded[player] && (!property || property.owner === player));
    if (!state.cityDecision) endTurn();
  }

  getAiAction(state: CatalogState, player: string, difficulty: 'EASY' | 'MEDIUM' | 'HARD'): CatalogAction | null {
    const actions = this.available(state, player);
    if (!actions.length) return null;
    if (this.boardGame) {
      const moves = this.boardActions(state);
      if (!moves.length) return null;
      if (difficulty === 'EASY') return moves[randomInt(moves.length)];
      if (difficulty === 'MEDIUM') return shuffle(moves).sort((a, b) => b.priority - a.priority)[0];
      const ranked = moves.map((move) => {
        const next = structuredClone(state);
        this.applyBoardMove(next, move, player);
        const response = this.isFinished(next) ? 0 : Math.max(0, ...this.boardActions(next).map((reply) => reply.priority));
        return { move, score: (next.winner === player ? 1000 : move.priority) - response };
      });
      return ranked.sort((a, b) => b.score - a.score)[0].move;
    }
    if (this.betting) {
      const options = bettingOptions(state, player);
      const raise = actions.find((type) => type === 'RAISE' || type === 'BET');
      if (raise && difficulty === 'HARD' && options.min <= 100 && randomInt(4) === 0) return { type: raise, payload: { amount: options.min } };
      return { type: actions[0] };
    }
    if (this.twentyOne) return { type: actions.includes('HIT') && score21(state.hands[player]) < (difficulty === 'HARD' ? 18 : 17) ? 'HIT' : 'STAND' };
    if (this.gameId === 'PHOM') {
      if (!state.hasDrawn[player]) return { type: 'DRAW_CARD' };
      const card = [...state.hands[player]].sort((a, b) => b.rank - a.rank).find((item) =>
        !state.claimedMelds?.[player]?.flat().includes(item.id));
      return { type: 'DISCARD', payload: { cardId: card?.id } };
    }
    if (this.gameId === 'MAU_BINH') return { type: 'SUBMIT_HAND', payload: { groups: arrangeMauBinh(state.hands[player]).map((group) => group.map((card) => card.id)) } };
    if (actions.includes('MOVE_HORSE')) {
      const moves = horseMoves(state.horses!, state.players, player, state.dice!);
      return { type: 'MOVE_HORSE', payload: { index: moves.sort((a, b) => b.destination - a.destination)[0].index } };
    }
    if (actions.includes('BUY') && state.scores[player] > 250) return { type: 'BUY' };
    if (actions.includes('UPGRADE') && state.scores[player] > 450) return { type: 'UPGRADE' };
    return { type: actions[0] };
  }

  getPublicState(state: CatalogState, player: string) {
    const { deck, hands, dealerHand, arrangements, chess: _chess, positionCounts: _positions, claimedMelds, ...publicState } = state;
    const finished = this.isFinished(state);
    const showdown = finished && (this.gameId === 'MAU_BINH' || this.gameId === 'BAO_CAO' ||
      this.twentyOne || (this.betting && state.players.filter((id) => !state.folded[id]).length > 1));
    const availableActions = this.available(state, player);
    return {
      ...publicState,
      deckCount: deck.length,
      myHand: hands[player] || [],
      playerCardCounts: mapPlayers(state.players, (id) => hands[id]?.length || 0),
      availableActions,
      legalMoves: this.boardGame && availableActions.length ? this.boardActions(state).map(({ payload }) => payload) : [],
      horseMoves: state.horses && state.dice && availableActions.includes('MOVE_HORSE') ? horseMoves(state.horses, state.players, player, state.dice) : [],
      cityCells: this.gameId === 'CO_TY_PHU' ? CITY_CELLS : undefined,
      dealerCards: dealerHand && (finished ? dealerHand : dealerHand.slice(0, 1)),
      bettingOptions: this.betting && availableActions.length ? bettingOptions(state, player) : undefined,
      shownHands: showdown ? Object.fromEntries(state.players.filter((id) => !state.folded[id] || this.twentyOne).map((id) => [id, hands[id]])) : undefined,
      arrangements: finished ? arrangements : undefined,
      myPhomMelds: claimedMelds?.[player] ?? [],
      myTotal: this.twentyOne && hands[player] ? score21(hands[player]) : undefined,
    };
  }

  isFinished(state: CatalogState) { return state.phase === 'FINISHED' || Boolean(state.winner); }

  calculateResult(state: CatalogState) {
    return { winner: state.winner, winners: state.winners ?? (state.winner ? [state.winner] : []), scores: state.scores, reason: state.endReason };
  }
}
