import { randomInt, shuffle } from '../core/random';
import type { GameEngine } from '../core/GameEngine';
import {
  CLASSIC_10_RULESET,
  type PendingNightAction,
  type WerewolfAction,
  type WerewolfEvent,
  type WerewolfGameState,
  type WerewolfPhase,
  type WerewolfPlayerState,
  type WerewolfResult,
  type WerewolfRuleset,
  roleName,
  roleTeam,
  rulesetForPlayerCount,
} from './werewolf.types';

const NIGHT_ACTION_PHASES: Record<string, WerewolfPhase> = {
  werewolf: 'NIGHT', seer: 'NIGHT', guard: 'NIGHT', witch: 'NIGHT',
};

export class WerewolfEngine implements GameEngine<WerewolfGameState, WerewolfAction, WerewolfResult> {
  initialize(players: string[], config: Partial<WerewolfRuleset> & { gameId?: string; roomId?: string; seed?: number } = {}): WerewolfGameState {
    const { seed, gameId, roomId, ...overrides } = config;
    const rules = { ...rulesetForPlayerCount(players.length), ...overrides };
    if (players.length < rules.minPlayers || players.length > rules.maxPlayers) throw new Error('Invalid player count for Werewolf ruleset.');
    if (rules.roles.length !== players.length) throw new Error('Role composition must match player count.');
    const roles = seed === undefined ? shuffle(rules.roles) : deterministicShuffle([...rules.roles], seed);
    const now = new Date().toISOString();
    const state: WerewolfGameState = {
      gameId: gameId ?? `werewolf_${Date.now()}`,
      roomId,
      phase: 'NIGHT', day: 0, night: 1,
      phaseStartedAt: now,
      phaseEndsAt: addSeconds(now, rules.nightDurationSeconds),
      players: players.map((playerId, index) => ({ playerId, seat: index + 1, alive: true, roleId: roles[index], disconnected: false, usedAbilities: [] })),
      pendingNightActions: [], votes: {}, deaths: [], events: [], randomSeed: seed ?? 0, sequence: 0, rules,
    };
    return this.emit(state, 'GAME_STARTED', { payload: { playerCount: players.length } });
  }

  validateAction(state: WerewolfGameState, action: WerewolfAction, playerId: string): boolean {
    if (!action || !this.availableActions(state, playerId).includes(action.type)) return false;
    const player = state.players.find((p) => p.playerId === playerId)!;
    const target = state.players.find((p) => p.playerId === action.targetPlayerId && p.alive);
    if (action.type === 'WEREWOLF_KILL') return Boolean(target && target.roleId !== 'werewolf');
    if (action.type === 'GUARD_PROTECT') return Boolean(target && (!(state.rules?.guardCannotRepeatTarget ?? true) || target.playerId !== player.lastGuardTarget));
    if (['CAST_VOTE', 'SEER_CHECK', 'WITCH_POISON', 'HUNTER_SHOOT'].includes(action.type)) return Boolean(target && target.playerId !== playerId);
    return true;
  }

  advanceExpired(state: WerewolfGameState, now = Date.now()): WerewolfGameState {
    if (state.phase === 'GAME_OVER' || Date.parse(state.phaseEndsAt) > now) return state;
    const next = clone(state);
    if (state.phase === 'NIGHT') return this.resolveNight(next);
    if (state.phase === 'DISCUSSION') return this.transition(next, 'VOTING');
    if (state.phase === 'VOTING') return this.resolveVote(next);
    if (state.phase === 'LAST_WORD') return this.afterDeath(next);
    return state;
  }

  applyAction(state: WerewolfGameState, action: WerewolfAction, playerId: string): { newState: WerewolfGameState; events: WerewolfEvent[] } {
    if (!this.validateAction(state, action, playerId)) throw new Error('INVALID_ACTION');
    let next = clone(state);
    const before = next.sequence;
    const player = next.players.find((p) => p.playerId === playerId)!;
    if (action.type === 'CAST_VOTE' || action.type === 'SKIP_VOTE') {
      next.votes[playerId] = action.type === 'SKIP_VOTE' ? 'SKIP' : action.targetPlayerId!;
      this.emit(next, 'VOTE_CAST', { actorId: playerId });
      if (Object.keys(next.votes).length >= next.players.filter((p) => p.alive).length) next = this.resolveVote(next);
    } else if (action.type === 'CONFIRM_LAST_WORD' || action.type === 'HUNTER_SHOOT') {
      if (action.type === 'HUNTER_SHOOT') this.kill(next, action.targetPlayerId!, 'HUNTER', 'HUNTER_SHOT');
      next = this.afterDeath(next);
    } else {
      const pending: PendingNightAction = { actorId: playerId, type: action.type, targetId: action.targetPlayerId, submittedAt: new Date().toISOString() };
      next.pendingNightActions.push(pending);
      if (action.type === 'WITCH_HEAL' || action.type === 'WITCH_POISON') player.usedAbilities.push(action.type === 'WITCH_HEAL' ? 'heal' : 'poison');
      if (action.type === 'GUARD_PROTECT') player.lastGuardTarget = action.targetPlayerId;
      if (action.type === 'SEER_CHECK') (player.seen ??= {})[action.targetPlayerId!] = roleTeam(next.players.find((p) => p.playerId === action.targetPlayerId)!.roleId);
      if (this.nightReady(next)) next = this.resolveNight(next);
    }
    return { newState: next, events: this.publicEvents(next).filter((event) => Number(event.id.split(':').at(-1)) > before) };
  }

  private publicEvents(state: WerewolfGameState) {
    return state.events.filter((event) => event.type !== 'ACTION_SUBMITTED');
  }

  getPublicState(state: WerewolfGameState, playerId: string) {
    const viewer = state.players.find((p) => p.playerId === playerId);
    const reveal = (p: WerewolfPlayerState) => p.playerId === playerId || (viewer?.roleId === 'werewolf' && p.roleId === 'werewolf') || state.phase === 'GAME_OVER';
    return {
      gameId: state.gameId, phase: state.phase, day: state.day, night: state.night,
      phaseStartedAt: state.phaseStartedAt, phaseEndsAt: state.phaseEndsAt,
      players: state.players.map((p) => ({ playerId: p.playerId, seat: p.seat, alive: p.alive, disconnected: p.disconnected, roleId: reveal(p) ? p.roleId : undefined, roleName: reveal(p) ? roleName(p.roleId) : undefined })),
      votes: state.phase === 'VOTING' ? Object.fromEntries(Object.keys(state.votes).map((id) => [id, true])) : {},
      deaths: state.deaths.map((d) => ({ ...d, roleId: state.phase === 'GAME_OVER' || (state.rules?.revealRolesOnDeath ?? true) ? state.players.find((p) => p.playerId === d.victimId)?.roleId : undefined })),
      events: this.publicEvents(state).slice(-30), winnerTeam: state.winnerTeam, winnerPlayers: state.winnerPlayers,
      myAvailableActions: this.availableActions(state, playerId), mySight: viewer?.seen,
      threatenedId: viewer?.roleId === 'witch' && this.wolvesReady(state) ? this.wolfTarget(state) : undefined,
    };
  }

  isFinished(state: WerewolfGameState): boolean { return state.phase === 'GAME_OVER'; }

  calculateResult(state: WerewolfGameState): WerewolfResult {
    const winnerPlayers = state.players.filter((p) => p.alive && roleTeam(p.roleId) === state.winnerTeam).map((p) => p.playerId);
    return { gameId: state.gameId, winnerTeam: state.winnerTeam, winnerPlayers, loserPlayers: state.players.filter((p) => !winnerPlayers.includes(p.playerId)).map((p) => p.playerId), days: state.day, nights: state.night, kills: state.deaths.filter((d) => d.source === 'WEREWOLF').length, executions: state.deaths.filter((d) => d.source === 'VOTE').length };
  }

  private availableActions(state: WerewolfGameState, playerId: string): WerewolfAction['type'][] {
    const player = state.players.find((p) => p.playerId === playerId);
    if (!player) return [];
    if (state.phase === 'LAST_WORD') return (state.pendingVictim ?? state.deaths.at(-1)?.victimId) === playerId ?
      ['CONFIRM_LAST_WORD', ...(player.roleId === 'hunter' ? ['HUNTER_SHOOT' as const] : [])] : [];
    if (!player.alive) return [];
    if (state.phase === 'VOTING') return state.votes[playerId] ? [] : ['CAST_VOTE', 'SKIP_VOTE'];
    if (state.phase !== 'NIGHT' || !NIGHT_ACTION_PHASES[player.roleId] || state.pendingNightActions.some((a) => a.actorId === playerId)) return [];
    if (player.roleId === 'witch') {
      if (!this.wolvesReady(state)) return [];
      const heal = player.usedAbilities.filter((ability) => ability === 'heal').length < (state.rules?.witchHealUses ?? 1);
      const poison = player.usedAbilities.filter((ability) => ability === 'poison').length < (state.rules?.witchPoisonUses ?? 1);
      return [...(heal && this.wolfTarget(state) ? ['WITCH_HEAL' as const] : []), ...(poison ? ['WITCH_POISON' as const] : []), 'SKIP_NIGHT'];
    }
    return [({ werewolf: 'WEREWOLF_KILL', seer: 'SEER_CHECK', guard: 'GUARD_PROTECT' } as const)[player.roleId as 'werewolf' | 'seer' | 'guard'], 'SKIP_NIGHT'];
  }

  private wolvesReady(state: WerewolfGameState) {
    return state.players.filter((p) => p.alive && p.roleId === 'werewolf').every((p) =>
      state.pendingNightActions.some((a) => a.actorId === p.playerId));
  }

  private wolfTarget(state: WerewolfGameState) {
    return mostFrequent(state.pendingNightActions.filter((a) => a.type === 'WEREWOLF_KILL' && a.targetId).map((a) => a.targetId!));
  }

  private nightReady(state: WerewolfGameState): boolean {
    const required = state.players.filter((p) => p.alive && NIGHT_ACTION_PHASES[p.roleId]);
    return required.every((p) => state.pendingNightActions.some((a) => a.actorId === p.playerId));
  }

  private resolveNight(state: WerewolfGameState): WerewolfGameState {
    const next = clone(state);
    const target = this.wolfTarget(next);
    const protectedId = next.pendingNightActions.find((a) => a.type === 'GUARD_PROTECT')?.targetId;
    const healed = next.pendingNightActions.some((a) => a.type === 'WITCH_HEAL');
    const poison = next.pendingNightActions.find((a) => a.type === 'WITCH_POISON')?.targetId;
    const previousDeaths = next.deaths.length;
    if (target && target !== protectedId && !healed) this.kill(next, target, 'WEREWOLF', 'NIGHT_KILL');
    if (poison) this.kill(next, poison, 'WITCH', 'POISON');
    next.pendingNightActions = [];
    next.pendingVictim = next.deaths.slice(previousDeaths).find((d) =>
      next.players.find((p) => p.playerId === d.victimId)?.roleId === 'hunter')?.victimId;
    return next.pendingVictim ? this.transition(next, 'LAST_WORD') : this.afterDeath(next, true);
  }

  private resolveVote(state: WerewolfGameState): WerewolfGameState {
    let next = clone(state); const counts = new Map<string, number>();
    next.players.filter((p) => p.alive).forEach((p) => { const vote = next.votes[p.playerId]; if (vote && vote !== 'SKIP') counts.set(vote, (counts.get(vote) ?? 0) + 1); });
    const max = Math.max(0, ...counts.values()); const leaders = [...counts.entries()].filter(([, count]) => count === max).map(([id]) => id);
    const policy = next.rules?.tiePolicy ?? 'NO_EXECUTION';
    if (leaders.length > 1 && policy === 'REVOTE' && next.revoteDay !== next.day) {
      next.votes = {};
      next.revoteDay = next.day;
      this.emit(next, 'REVOTE');
      return this.transition(next, 'VOTING');
    }
    const victim = leaders.length === 1 ? leaders[0] : leaders.length && policy === 'RANDOM_EXECUTION' ? leaders[randomInt(leaders.length)] : undefined;
    next.votes = {};
    if (victim) this.kill(next, victim, 'VILLAGE', 'EXECUTION');
    this.emit(next, 'VOTE_FINISHED', { targetId: victim });
    next.pendingVictim = victim;
    return victim ? this.transition(next, 'LAST_WORD') : this.afterDeath(next, false);
  }

  private afterDeath(state: WerewolfGameState, night = state.deaths.find((d) => d.victimId === state.pendingVictim)?.reason !== 'EXECUTION') {
    state.pendingVictim = undefined;
    const next = this.checkWin(state);
    if (next.phase === 'GAME_OVER') return next;
    if (night) {
      next.day++;
      return this.transition(next, 'DISCUSSION');
    }
    next.night++;
    return this.transition(next, 'NIGHT');
  }

  getAiAction(state: WerewolfGameState, playerId: string): WerewolfAction | null {
    const actions = this.availableActions(state, playerId).filter((type) => type !== 'SKIP_NIGHT' && type !== 'SKIP_VOTE' && type !== 'CONFIRM_LAST_WORD');
    for (const type of actions) {
      if (type === 'WITCH_HEAL' && this.validateAction(state, { type }, playerId)) return { type };
      const target = shuffle(state.players).find((p) => this.validateAction(state, { type, targetPlayerId: p.playerId }, playerId));
      if (target) return { type, targetPlayerId: target.playerId };
    }
    const fallback = this.availableActions(state, playerId).find((type) => ['SKIP_NIGHT', 'SKIP_VOTE', 'CONFIRM_LAST_WORD'].includes(type));
    return fallback ? { type: fallback } : null;
  }

  private kill(state: WerewolfGameState, victimId: string, source: string, reason: string): void {
    const victim = state.players.find((p) => p.playerId === victimId); if (!victim || !victim.alive) return;
    victim.alive = false; const at = new Date().toISOString(); state.deaths.push({ victimId, source, reason, at }); this.emit(state, 'PLAYER_DIED', { targetId: victimId, payload: { source, reason } });
    if (victim.loverId) this.kill(state, victim.loverId, 'LOVER', 'LOVE_DEATH_TRIGGER');
    if (victim.roleId === 'hunter') this.emit(state, 'HUNTER_TRIGGERED', { actorId: victimId });
  }

  private checkWin(state: WerewolfGameState): WerewolfGameState {
    const alive = state.players.filter((p) => p.alive); const wolves = alive.filter((p) => p.roleId === 'werewolf').length; const village = alive.length - wolves;
    if (wolves === 0) state.winnerTeam = 'VILLAGE';
    else if (wolves >= village) state.winnerTeam = 'WEREWOLF';
    if (!state.winnerTeam) return state;
    state.winnerPlayers = alive.filter((p) => roleTeam(p.roleId) === state.winnerTeam).map((p) => p.playerId);
    return this.transition(state, 'GAME_OVER');
  }

  private transition(state: WerewolfGameState, phase: WerewolfPhase): WerewolfGameState {
    const next = clone(state);
    next.phase = phase;
    const now = new Date().toISOString();
    next.phaseStartedAt = now;
    const rules = next.rules ?? CLASSIC_10_RULESET;
    const seconds = phase === 'NIGHT' ? rules.nightDurationSeconds : phase === 'DISCUSSION' ? rules.discussionDurationSeconds :
      phase === 'VOTING' ? rules.votingDurationSeconds : phase === 'LAST_WORD' ? rules.lastWordDurationSeconds : 0;
    next.phaseEndsAt = addSeconds(now, seconds);
    return this.emit(next, 'PHASE_CHANGED', { payload: { phase } });
  }

  private emit(state: WerewolfGameState, type: string, extra: Partial<WerewolfEvent> = {}): WerewolfGameState {
    state.sequence += 1; state.events.push({ id: `${state.gameId}:${state.sequence}`, type, at: new Date().toISOString(), ...extra }); return state;
  }
}

function clone<T>(value: T): T { return JSON.parse(JSON.stringify(value)) as T; }
function addSeconds(iso: string, seconds: number): string { return new Date(new Date(iso).getTime() + seconds * 1000).toISOString(); }
function mostFrequent(values: string[]): string | undefined { const counts = new Map<string, number>(); values.forEach((v) => counts.set(v, (counts.get(v) ?? 0) + 1)); return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0]; }
function deterministicShuffle<T>(items: T[], seed: number): T[] { let s = seed >>> 0; for (let i = items.length - 1; i > 0; i -= 1) { s = (s * 1664525 + 1013904223) >>> 0; const j = s % (i + 1); [items[i], items[j]] = [items[j], items[i]]; } return items; }
