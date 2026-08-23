import { strict as assert } from 'node:assert';
import { WerewolfEngine } from './WerewolfEngine';
import { WerewolfAction } from './werewolf.types';

const engine = new WerewolfEngine();
const players = ['p1', 'p2', 'p3', 'p4', 'p5', 'p6'];
const state = engine.initialize(players, { gameId: 'test-game', seed: 42 });

assert.equal(state.players.length, 6);
assert.equal(state.phase, 'NIGHT');
assert.equal(engine.getPublicState(state, 'p1').players.every((p: any) => p.roleId === undefined || p.playerId === 'p1'), true);

const wolf = state.players.find((p) => p.roleId === 'werewolf')!;
const nonWolf = state.players.find((p) => p.roleId !== 'werewolf')!;
assert.equal(engine.validateAction(state, { type: 'WEREWOLF_KILL', targetPlayerId: wolf.playerId }, wolf.playerId), false);
assert.equal(engine.validateAction(state, { type: 'WEREWOLF_KILL', targetPlayerId: nonWolf.playerId }, wolf.playerId), true);
assert.equal(engine.validateAction(state, { type: 'WEREWOLF_KILL', targetPlayerId: nonWolf.playerId }, nonWolf.playerId), false);

let current = state;
const actions: Array<[string, WerewolfAction]> = [];
for (const player of current.players.filter((p) => p.alive)) {
  if (player.roleId === 'werewolf') actions.push([player.playerId, { type: 'WEREWOLF_KILL', targetPlayerId: nonWolf.playerId }]);
  if (player.roleId === 'seer') actions.push([player.playerId, { type: 'SEER_CHECK', targetPlayerId: wolf.playerId }]);
  if (player.roleId === 'guard') actions.push([player.playerId, { type: 'GUARD_PROTECT', targetPlayerId: nonWolf.playerId }]);
  if (player.roleId === 'witch') actions.push([player.playerId, { type: 'WITCH_HEAL' }]);
}
for (const [actorId, action] of actions) current = engine.applyAction(current, action, actorId).newState;
assert.equal(current.phase, 'VOTING');
assert.equal(current.players.find((p) => p.playerId === nonWolf.playerId)?.alive, true);

for (const player of current.players.filter((p) => p.alive)) {
  if (current.phase !== 'VOTING') break;
  const target = current.players.find((p) => p.alive && p.playerId !== player.playerId && p.roleId === 'werewolf');
  current = engine.applyAction(current, target ? { type: 'CAST_VOTE', targetPlayerId: target.playerId } : { type: 'SKIP_VOTE' }, player.playerId).newState;
}
assert.ok(['NIGHT', 'GAME_OVER', 'LAST_WORD'].includes(current.phase));
console.log('Werewolf engine tests passed');
