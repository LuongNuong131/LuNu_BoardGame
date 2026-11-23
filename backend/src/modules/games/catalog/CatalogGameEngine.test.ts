import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { initializeGames } from '../core/init-games';
import { gameRegistry } from '../core/GameRegistry';
import { settleBets } from './BettingRules';
import { bestPokerHand, compareRanks, type PlayingCard } from './CardRules';
import { ChessEngine, ChineseChessEngine, PokerEngine, MauBinhEngine, PhomEngine } from './CatalogEngines';

const point = (square: string) => ({ row: 8 - Number(square[1]), column: square.charCodeAt(0) - 97 });
const move = (from: string, to: string) => ({ type: 'MOVE', payload: { from: point(from), to: point(to) } });
const card = (rank: number, suit: PlayingCard['suit']): PlayingCard => ({
  rank, suit, id: `${rank}${suit}`, label: String(rank), color: suit === 'D' || suit === 'H' ? 'RED' : 'BLACK',
});

test('Chess refuses non-board actions and ends at checkmate before capturing the king', () => {
  const engine = new ChessEngine();
  let state = engine.initialize(['a', 'b']);
  assert.equal(engine.validateAction(state, { type: 'ROLL_DICE' }, 'a'), false);
  assert.equal(engine.validateAction(state, move('e7', 'e5'), 'a'), false);
  for (const [player, from, to] of [['a', 'f2', 'f3'], ['b', 'e7', 'e5'], ['a', 'g2', 'g4'], ['b', 'd8', 'h4']]) {
    state = engine.applyAction(state, move(from, to), player).newState;
  }
  assert.equal(state.endReason, 'CHECKMATE');
  assert.equal(state.winner, 'b');
  assert.equal(engine.getPublicState(state, 'a').legalMoves.length, 0);
});

test('Xiangqi permits the elephant near its river and keeps the kings from facing one another', () => {
  const engine = new ChineseChessEngine();
  const state = engine.initialize(['a', 'b']);
  assert.equal(engine.validateAction(state, { type: 'MOVE', payload: { from: [9, 2], to: [7, 4] } }, 'a'), true);
  state.board = Array.from({ length: 10 }, () => Array(9).fill(null));
  state.board[0][4] = { type: 'KING', color: 'BLACK_SIDE' };
  state.board[9][4] = { type: 'KING', color: 'RED' };
  state.board[6][4] = { type: 'ROOK', color: 'RED' };
  assert.equal(engine.validateAction(state, { type: 'MOVE', payload: { from: [6, 4], to: [6, 3] } }, 'a'), false);
});

test('Hold’em compares wheel straights and flush kickers by hand strength', () => {
  const wheel = bestPokerHand([card(1, 'H'), card(2, 'S'), card(3, 'C'), card(4, 'S'), card(5, 'D'), card(9, 'S'), card(11, 'S')]);
  const six = bestPokerHand([card(2, 'H'), card(3, 'H'), card(4, 'D'), card(5, 'D'), card(6, 'C'), card(1, 'H'), card(12, 'H')]);
  const flush = bestPokerHand([card(1, 'H'), card(3, 'H'), card(7, 'H'), card(11, 'H'), card(12, 'H'), card(12, 'S'), card(12, 'C')]);
  assert.deepEqual(wheel, [4, 5]);
  assert.ok(compareRanks(six, wheel) > 0);
  assert.ok(compareRanks(flush, six) > 0);
});

test('Poker enforces bet limits, deals the board, hides cards and conserves chips at settlement', () => {
  const engine = new PokerEngine();
  let state = engine.initialize(['a', 'b', 'c']);
  assert.equal(engine.validateAction(state, { type: 'RAISE', payload: { amount: Infinity } }, 'a'), false);
  assert.equal(engine.validateAction(state, { type: 'CHECK' }, 'a'), false);
  assert.deepEqual(engine.getPublicState(state, 'observer').myHand, []);
  assert.equal('hands' in engine.getPublicState(state, 'a'), false);
  assert.equal('deck' in engine.getPublicState(state, 'a'), false);
  for (let i = 0; i < 20 && !engine.isFinished(state); i++) {
    const player = state.players[state.currentTurnIndex];
    const action = engine.getAiAction(state, player, 'EASY')!;
    state = engine.applyAction(state, action, player).newState;
  }
  assert.equal(state.bettingRound, 'SHOWDOWN');
  assert.equal(state.communityCards.length, 5);
  assert.equal(Object.values(state.stacks!).reduce((sum, amount) => sum + amount, 0), 3000);
});

test('Poker settles the main pot and side pot to their respective winners', () => {
  const engine = new PokerEngine();
  const state = engine.initialize(['a', 'b', 'c']);
  state.hands = { a: [card(1, 'H'), card(1, 'S')], b: [card(13, 'H'), card(13, 'S')], c: [card(12, 'H'), card(12, 'S')] };
  state.communityCards = [card(2, 'H'), card(4, 'D'), card(6, 'C'), card(8, 'D'), card(10, 'S')];
  state.invested = { a: 100, b: 200, c: 200 };
  state.stacks = { a: 0, b: 800, c: 800 };
  settleBets(state);
  assert.deepEqual(state.payouts, { a: 300, b: 200, c: 0 });
  assert.deepEqual(state.winners, ['a', 'b']);
  assert.equal(state.phase, 'FINISHED');
});

test('Phỏm controls the draw/discard phase and Mậu binh rejects duplicate cards', () => {
  const phom = new PhomEngine();
  const hand = phom.initialize(['a', 'b']);
  assert.equal(hand.hands.a.length, 10);
  assert.equal(phom.validateAction(hand, { type: 'DRAW_CARD' }, 'a'), false);
  assert.equal(phom.validateAction(hand, { type: 'DISCARD', payload: { cardId: hand.hands.a[0].id } }, 'a'), true);

  const mauBinh = new MauBinhEngine();
  const state = mauBinh.initialize(['a', 'b']);
  const id = state.hands.a[0].id;
  assert.equal(mauBinh.validateAction(state, { type: 'SUBMIT_HAND', payload: { groups: [Array(3).fill(id), Array(5).fill(id), Array(5).fill(id)] } }, 'a'), false);
});

initializeGames();
for (const id of ['UNO', 'WEREWOLF', 'TIEN_LEN', 'BLACKJACK', 'PHOM', 'XI_DACH', 'POKER', 'MAU_BINH', 'BAO_CAO', 'LIENG', 'CHESS', 'CO_TUONG', 'CO_CA_NGUA', 'CO_TY_PHU', 'EXPLODING_KITTENS']) {
  test(`${id} can run from initialization to a terminal result`, () => {
    const engine = gameRegistry.getEngine(id);
    const players = Array.from({ length: id === 'WEREWOLF' ? 6 : 2 }, (_, i) => `p${i + 1}`);
    let state = engine.initialize(players, {});
    for (let step = 0; step < 3500 && !engine.isFinished(state); step++) {
      const current = state.currentPlayer ?? state.players[state.currentTurnIndex];
      const actions = (current ? [current] : players).map((player) => [player, engine.getAiAction?.(state, player, 'EASY')] as const);
      const picked = actions.find(([, action]) => action);
      if (!picked && engine.advanceExpired) {
        state = engine.advanceExpired(state, Date.parse(state.phaseEndsAt) + 1);
        continue;
      }
      assert.ok(picked, `${id} cannot advance at step ${step}`);
      const [player, action] = picked;
      assert.equal(engine.validateAction(state, action, player), true);
      state = engine.applyAction(state, action, player).newState;
    }
    assert.equal(engine.isFinished(state), true, `${id} did not reach a terminal state`);
    assert.ok(engine.calculateResult(state));
  });
}
