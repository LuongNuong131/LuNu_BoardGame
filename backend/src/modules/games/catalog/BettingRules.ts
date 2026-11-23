import { bestPokerHand, compareRanks, rankLieng, type PlayingCard } from './CardRules';

type Street = 'PREFLOP' | 'FLOP' | 'TURN' | 'RIVER' | 'SHOWDOWN';
export interface BettingState {
  gameId: string;
  players: string[];
  hands: Record<string, PlayingCard[]>;
  deck: PlayingCard[];
  communityCards: PlayingCard[];
  bettingRound: Street;
  currentTurnIndex: number;
  currentBet: number;
  bets: Record<string, number>;
  folded: Record<string, boolean>;
  phase: string;
  winner: string | null;
  winners?: string[];
  stacks?: Record<string, number>;
  invested?: Record<string, number>;
  payouts?: Record<string, number>;
  minRaise?: number;
  actedAt?: Record<string, number>;
}

const BIG_BLIND = 20;
const chips = (state: BettingState, player: string) => state.stacks?.[player] ?? Math.max(0, 1000 - (state.bets[player] || 0));
const paid = (state: BettingState, player: string) => state.bets[player] || 0;
const due = (state: BettingState, player: string) => Math.max(0, state.currentBet - paid(state, player));
const live = (state: BettingState) => state.players.filter((player) => !state.folded[player]);
const canRaise = (state: BettingState, player: string) => state.actedAt?.[player] === undefined ||
  state.currentBet - state.actedAt[player] >= (state.minRaise ?? BIG_BLIND);

export function bettingOptions(state: BettingState, player: string) {
  const max = paid(state, player) + chips(state, player);
  const canIncrease = canRaise(state, player) && live(state).some((other) => other !== player && chips(state, other) > 0);
  return {
    due: Math.min(due(state, player), chips(state, player)),
    min: Math.min(state.currentBet + (state.minRaise ?? BIG_BLIND), max),
    max,
    actions: [
      due(state, player) ? 'CALL' : 'CHECK',
      ...(canIncrease && max > state.currentBet ? [state.currentBet ? 'RAISE' : 'BET'] : []),
      'FOLD',
    ],
  };
}

export function validBet(state: BettingState, player: string, type: string, amount: unknown) {
  if (chips(state, player) <= 0) return false;
  const options = bettingOptions(state, player);
  if (!options.actions.includes(type)) return false;
  return type !== 'BET' && type !== 'RAISE' || typeof amount === 'number' &&
    Number.isSafeInteger(amount) && amount >= options.min && amount <= options.max;
}

function pay(state: BettingState, player: string, amount: number) {
  state.bets[player] += amount;
  state.stacks![player] -= amount;
  state.invested![player] += amount;
}

export function initializeBets(state: BettingState) {
  state.stacks = Object.fromEntries(state.players.map((player) => [player, 1000]));
  state.invested = Object.fromEntries(state.players.map((player) => [player, 0]));
  state.actedAt = {};
  state.minRaise = BIG_BLIND;
  if (state.gameId === 'POKER') {
    const smallBlind = state.players.length === 2 ? 0 : 1;
    pay(state, state.players[smallBlind], BIG_BLIND / 2);
    pay(state, state.players[smallBlind + 1], BIG_BLIND);
    state.currentBet = BIG_BLIND;
    state.currentTurnIndex = (smallBlind + 2) % state.players.length;
  } else {
    for (const player of state.players) {
      pay(state, player, 10);
      state.bets[player] = 0;
    }
  }
}

function reveal(state: BettingState) {
  const count = state.bettingRound === 'PREFLOP' ? 3 : 1;
  state.deck.shift();
  state.communityCards.push(...state.deck.splice(0, count));
  state.bettingRound = state.bettingRound === 'PREFLOP' ? 'FLOP' : state.bettingRound === 'FLOP' ? 'TURN' : 'RIVER';
}

export function settleBets(state: BettingState) {
  const active = live(state);
  const invested = state.invested ?? state.bets;
  const payouts = Object.fromEntries(state.players.map((player) => [player, 0]));
  const ranks = Object.fromEntries(active.map((player) => [player, state.gameId === 'POKER' ?
    bestPokerHand([...state.hands[player], ...state.communityCards]) : rankLieng(state.hands[player])]));
  const levels = [...new Set(Object.values(invested))].filter((value) => value > 0).sort((a, b) => a - b);
  const winners = new Set<string>();
  let lastLevel = 0;
  for (const level of levels) {
    const contributors = state.players.filter((player) => invested[player] >= level);
    const pot = (level - lastLevel) * contributors.length;
    lastLevel = level;
    if (contributors.length === 1) {
      payouts[contributors[0]] += pot;
      continue;
    }
    const eligible = active.filter((player) => contributors.includes(player));
    const candidates = eligible.length ? eligible : active;
    const best = [...candidates].sort((a, b) => compareRanks(ranks[b], ranks[a]))[0];
    const tied = state.players.slice(1).concat(state.players[0]).filter((player) =>
      candidates.includes(player) && compareRanks(ranks[player], ranks[best]) === 0);
    tied.forEach((player, index) => {
      payouts[player] += Math.floor(pot / tied.length) + Number(index < pot % tied.length);
      winners.add(player);
    });
  }
  if (!winners.size) {
    const best = [...active].sort((a, b) => compareRanks(ranks[b], ranks[a]))[0];
    active.filter((player) => compareRanks(ranks[player], ranks[best]) === 0).forEach((player) => winners.add(player));
  }
  state.payouts = payouts;
  for (const player of state.players) state.stacks![player] += payouts[player];
  state.winners = [...winners];
  state.winner = state.winners.length === 1 ? state.winners[0] : null;
  state.bettingRound = 'SHOWDOWN';
  state.phase = 'FINISHED';
}

export function playBet(state: BettingState, player: string, type: string, target: number | undefined) {
  state.stacks ??= Object.fromEntries(state.players.map((id) => [id, chips(state, id)]));
  state.invested ??= { ...state.bets };
  state.actedAt ??= {};
  state.minRaise ??= BIG_BLIND;
  let amount = 0;
  if (type === 'FOLD') state.folded[player] = true;
  else {
    amount = type === 'CALL' ? Math.min(chips(state, player), due(state, player)) :
      type === 'BET' || type === 'RAISE' ? target! - paid(state, player) : 0;
    pay(state, player, amount);
    const increase = paid(state, player) - state.currentBet;
    if (increase > 0) {
      state.currentBet += increase;
      if (increase >= state.minRaise) state.minRaise = increase;
    }
    state.actedAt[player] = state.currentBet;
  }

  const active = live(state);
  const funded = active.filter((id) => chips(state, id) > 0);
  const needAction = (id: string) => funded.includes(id) && (
    due(state, id) > 0 || (funded.length > 1 && state.actedAt![id] === undefined)
  );
  for (let offset = 1; offset <= state.players.length && active.length > 1; offset++) {
    const index = (state.currentTurnIndex + offset) % state.players.length;
    if (needAction(state.players[index])) {
      state.currentTurnIndex = index;
      return amount;
    }
  }
  if (active.length === 1 || state.gameId === 'LIENG' || state.bettingRound === 'RIVER' || funded.length <= 1) {
    if (active.length > 1 && state.gameId === 'POKER') while (state.bettingRound !== 'RIVER') reveal(state);
    settleBets(state);
    return amount;
  }
  reveal(state);
  state.currentBet = 0;
  state.minRaise = BIG_BLIND;
  state.actedAt = {};
  state.bets = Object.fromEntries(state.players.map((id) => [id, 0]));
  state.currentTurnIndex = state.players.slice(1).concat(state.players[0]).map((id) => state.players.indexOf(id)).find((i) => funded.includes(state.players[i]))!;
  return amount;
}
