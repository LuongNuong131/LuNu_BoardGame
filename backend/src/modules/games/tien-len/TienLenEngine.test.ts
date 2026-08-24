import { strict as assert } from 'node:assert';
import { CombinationEngine } from './CombinationEngine';
import { DeckService } from './DeckService';
import { TienLenEngine } from './TienLenEngine';
import { DEFAULT_TIEN_LEN_RULESET, TienLenCard } from './tien-len.types';

const deckService = new DeckService();
const deck = deckService.createDeck();
assert.equal(deck.length, 52);
assert.equal(new Set(deck.map((card) => card.cardId)).size, 52);
assert.equal(deck.filter((card) => card.cardId === '3S').length, 1);

const combos = new CombinationEngine();
const card = (rank: number, suit: TienLenCard['suit']): TienLenCard => ({ cardId: `${rank}${suit[0]}`, rank, suit, deckId: 'test' });
assert.equal(combos.evaluate([card(3, 'SPADE')], DEFAULT_TIEN_LEN_RULESET).combinationType, 'SINGLE');
assert.equal(combos.evaluate([card(7, 'SPADE'), card(7, 'HEART')], DEFAULT_TIEN_LEN_RULESET).combinationType, 'PAIR');
assert.equal(combos.evaluate([card(4, 'SPADE'), card(5, 'CLUB'), card(6, 'HEART')], DEFAULT_TIEN_LEN_RULESET).combinationType, 'STRAIGHT');
assert.equal(combos.evaluate([card(4, 'SPADE'), card(5, 'CLUB'), card(7, 'HEART')], DEFAULT_TIEN_LEN_RULESET).isValid, false);

const engine = new TienLenEngine();
let state = engine.initialize(['p1', 'p2', 'p3', 'p4'], { gameId: 'test-tien-len', seed: 7 });
assert.equal(state.players.reduce((sum, player) => sum + player.cards.length, 0), 52);
assert.equal(state.players.every((player) => player.cards.length === 13), true);
assert.equal(state.players.find((player) => player.cards.some((item) => item.cardId === '3S'))?.playerId, state.startingPlayer);
assert.equal(engine.getPublicState(state, 'p1').players.every((player: any) => player.cards === undefined), true);

const first = state.players.find((player) => player.playerId === state.startingPlayer)!;
const firstCard = first.cards.slice().sort((a, b) => a.rank - b.rank)[0];
assert.equal(engine.validateAction(state, { type: 'PLAY_CARDS', cardIds: [firstCard.cardId], actionId: 'a1' }, first.playerId), true);
state = engine.applyAction(state, { type: 'PLAY_CARDS', cardIds: [firstCard.cardId], actionId: 'a1' }, first.playerId).newState;
assert.equal(engine.validateAction(state, { type: 'PLAY_CARDS', cardIds: [firstCard.cardId], actionId: 'a1' }, state.currentPlayer), false);
assert.equal(engine.validateAction(state, { type: 'PASS', actionId: 'p1' }, state.currentPlayer), true);
state = engine.applyAction(state, { type: 'PASS', actionId: 'p1' }, state.currentPlayer).newState;
assert.equal(state.turnNumber, 3);
console.log('Tien Len engine tests passed');
