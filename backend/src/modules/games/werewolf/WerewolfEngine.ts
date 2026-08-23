import { GameEngine } from '../core/GameEngine';
import {
  CLASSIC_10_RULESET,
  PendingNightAction,
  WerewolfAction,
  WerewolfEvent,
  WerewolfGameState,
  WerewolfPhase,
  WerewolfPlayerState,
  WerewolfResult,
  WerewolfRoleId,
  WerewolfRuleset,
  roleName,
  roleTeam,
  rulesetForPlayerCount,
} from './werewolf.types';

const NIGHT_ACTION_PHASES: Record<string, WerewolfPhase> = {
  werewolf: 'NIGHT', seer: 'NIGHT', guard: 'NIGHT', witch: 'NIGHT',
};

export class WerewolfEngine implements GameEngine<WerewolfGameState, WerewolfAction, WerewolfResult> {
  initialize(players: string[], config: Partial<WerewolfRuleset> & { gameId?: string; roomId?: string; seed?: number } = {}): WerewolfGameState {
    const rules = { ...rulesetForPlayerCount(players.length), ...config };
    if (players.length < rules.minPlayers || players.length > rules.maxPlayers) throw new Error('Invalid player count for Werewolf ruleset.');
    if (rules.roles.length !== players.length) throw new Error('Role composition must match player count.');
    const roles = deterministicShuffle([...rules.roles], config.seed ?? 1337);
    const now = new Date().toISOString();
    const state: WerewolfGameState = {
      gameId: config.gameId ?? `werewolf_${Date.now()}`,
      roomId: config.roomId,
      phase: 'NIGHT', day: 0, night: 1,
      phaseStartedAt: now,
      phaseEndsAt: addSeconds(now, rules.nightDurationSeconds),
      players: players.map((playerId, index) => ({ playerId, seat: index + 1, alive: true, roleId: roles[index], disconnected: false, usedAbilities: [] })),
      pendingNightActions: [], votes: {}, deaths: [], events: [], randomSeed: config.seed ?? 1337, sequence: 0,
    };
    return this.emit(state, 'GAME_STARTED', { payload: { playerCount: players.length } });
  }

  validateAction(state: WerewolfGameState, action: WerewolfAction, playerId: string): boolean {
    const player = state.players.find((p) => p.playerId === playerId);
    const target = action.targetPlayerId ? state.players.find((p) => p.playerId === action.targetPlayerId) : undefined;
    if (!player || !player.alive || state.phase === 'GAME_OVER') return false;
    if (action.type === 'CAST_VOTE' || action.type === 'SKIP_VOTE') return state.phase === 'VOTING' && !state.votes[playerId] && (!!target ? target.alive : action.type === 'SKIP_VOTE');
    if (action.type === 'CONFIRM_LAST_WORD') return state.phase === 'LAST_WORD';
    if (state.phase !== 'NIGHT' || NIGHT_ACTION_PHASES[player.roleId] !== 'NIGHT') return false;
    if (state.pendingNightActions.some((a) => a.actorId === playerId)) return false;
    if (action.type === 'WEREWOLF_KILL' && player.roleId === 'werewolf') return !!target && target.alive && target.roleId !== 'werewolf' && target.playerId !== playerId;
    if (action.type === 'SEER_CHECK' && player.roleId === 'seer') return !!target && target.alive && target.playerId !== playerId;
    if (action.type === 'GUARD_PROTECT' && player.roleId === 'guard') return !!target && target.alive && target.playerId !== player.lastGuardTarget;
    if (action.type === 'WITCH_HEAL' && player.roleId === 'witch') return !player.usedAbilities.includes('heal');
    if (action.type === 'WITCH_POISON' && player.roleId === 'witch') return !player.usedAbilities.includes('poison') && !!target && target.alive;
    return false;
  }

  applyAction(state: WerewolfGameState, action: WerewolfAction, playerId: string): { newState: WerewolfGameState; events: WerewolfEvent[] } {
    if (!this.validateAction(state, action, playerId)) throw new Error('INVALID_ACTION');
    let next = clone(state);
    const player = next.players.find((p) => p.playerId === playerId)!;
    if (action.type === 'CAST_VOTE' || action.type === 'SKIP_VOTE') {
      next.votes[playerId] = action.type === 'SKIP_VOTE' ? 'SKIP' : action.targetPlayerId!;
      next = this.emit(next, 'VOTE_CAST', { actorId: playerId, targetId: action.targetPlayerId });
      if (Object.keys(next.votes).length >= next.players.filter((p) => p.alive).length) next = this.resolveVote(next);
      return { newState: next, events: next.events.slice(-3) };
    }
    if (action.type === 'CONFIRM_LAST_WORD') {
      next = this.transition(next, 'DEATH_TRIGGER');
      next = this.resolveDeathTriggers(next);
      return { newState: next, events: next.events.slice(-4) };
    }
    const pending: PendingNightAction = { actorId: playerId, type: action.type, targetId: action.targetPlayerId, submittedAt: new Date().toISOString() };
    next.pendingNightActions.push(pending);
    if (action.type === 'WITCH_HEAL' || action.type === 'WITCH_POISON') player.usedAbilities.push(action.type === 'WITCH_HEAL' ? 'heal' : 'poison');
    if (action.type === 'GUARD_PROTECT') player.lastGuardTarget = action.targetPlayerId;
    next = this.emit(next, 'ACTION_SUBMITTED', { actorId: playerId, targetId: action.targetPlayerId, payload: { action: action.type } });
    if (this.nightReady(next)) next = this.resolveNight(next);
    return { newState: next, events: next.events.slice(-3) };
  }

  getPublicState(state: WerewolfGameState, playerId: string): any {
    const viewer = state.players.find((p) => p.playerId === playerId);
    const isWolf = viewer?.roleId === 'werewolf';
    return {
      gameId: state.gameId, phase: state.phase, day: state.day, night: state.night,
      phaseStartedAt: state.phaseStartedAt, phaseEndsAt: state.phaseEndsAt,
      players: state.players.map((p) => ({ playerId: p.playerId, seat: p.seat, alive: p.alive, disconnected: p.disconnected, roleId: p.playerId === playerId || (isWolf && p.roleId === 'werewolf') || state.phase === 'GAME_OVER' ? p.roleId : undefined, roleName: p.playerId === playerId || (isWolf && p.roleId === 'werewolf') || state.phase === 'GAME_OVER' ? roleName(p.roleId) : undefined })),
      votes: state.phase === 'VOTING' || state.phase === 'EXECUTION' || state.phase === 'GAME_OVER' ? state.votes : {},
      deaths: state.deaths.map((d) => ({ ...d, roleId: state.phase === 'GAME_OVER' || (state.deaths.find((x) => x.victimId === d.victimId) && true) ? state.players.find((p) => p.playerId === d.victimId)?.roleId : undefined })),
      events: state.events.slice(-30), winnerTeam: state.winnerTeam, winnerPlayers: state.winnerPlayers,
      myAvailableActions: this.availableActions(state, playerId),
    };
  }

  isFinished(state: WerewolfGameState): boolean { return state.phase === 'GAME_OVER'; }

  calculateResult(state: WerewolfGameState): WerewolfResult {
    const winnerPlayers = state.players.filter((p) => p.alive && roleTeam(p.roleId) === state.winnerTeam).map((p) => p.playerId);
    return { gameId: state.gameId, winnerTeam: state.winnerTeam, winnerPlayers, loserPlayers: state.players.filter((p) => !winnerPlayers.includes(p.playerId)).map((p) => p.playerId), days: state.day, nights: state.night, kills: state.deaths.filter((d) => d.source === 'WEREWOLF').length, executions: state.deaths.filter((d) => d.source === 'VOTE').length };
  }

  private availableActions(state: WerewolfGameState, playerId: string): WerewolfAction['type'][] {
    const player = state.players.find((p) => p.playerId === playerId); if (!player || !player.alive) return [];
    if (state.phase === 'VOTING') return ['CAST_VOTE', 'SKIP_VOTE'];
    if (state.phase === 'LAST_WORD') return ['CONFIRM_LAST_WORD'];
    if (state.phase !== 'NIGHT') return [];
    return ({ werewolf: ['WEREWOLF_KILL'], seer: ['SEER_CHECK'], guard: ['GUARD_PROTECT'], witch: ['WITCH_HEAL', 'WITCH_POISON'] } as Record<WerewolfRoleId, WerewolfAction['type'][]>)[player.roleId] ?? [];
  }

  private nightReady(state: WerewolfGameState): boolean {
    const required = state.players.filter((p) => p.alive && ['werewolf', 'seer', 'guard', 'witch'].includes(p.roleId));
    return required.every((p) => state.pendingNightActions.some((a) => a.actorId === p.playerId)) || required.length === 0;
  }

  private resolveNight(state: WerewolfGameState): WerewolfGameState {
    let next = clone(state); const kill = next.pendingNightActions.filter((a) => a.type === 'WEREWOLF_KILL').map((a) => a.targetId).filter(Boolean) as string[];
    const target = mostFrequent(kill); const protectedId = next.pendingNightActions.find((a) => a.type === 'GUARD_PROTECT')?.targetId;
    const healedId = next.pendingNightActions.find((a) => a.type === 'WITCH_HEAL') ? target : undefined;
    const poison = next.pendingNightActions.find((a) => a.type === 'WITCH_POISON')?.targetId;
    if (target && target !== protectedId && target !== healedId) this.kill(next, target, 'WEREWOLF', 'NIGHT_KILL');
    if (poison) this.kill(next, poison, 'WITCH', 'POISON');
    next.pendingNightActions = []; next = this.checkWin(next);
    return next.phase === 'GAME_OVER' ? next : this.transition(next, 'DAWN');
  }

  private resolveVote(state: WerewolfGameState): WerewolfGameState {
    let next = clone(state); const counts = new Map<string, number>();
    next.players.filter((p) => p.alive).forEach((p) => { const vote = next.votes[p.playerId]; if (vote && vote !== 'SKIP') counts.set(vote, (counts.get(vote) ?? 0) + 1); });
    const max = Math.max(0, ...counts.values()); const leaders = [...counts.entries()].filter(([, count]) => count === max).map(([id]) => id);
    const victim = leaders.length === 1 ? leaders[0] : undefined;
    if (victim) this.kill(next, victim, 'VILLAGE', 'EXECUTION');
    next = this.emit(next, 'VOTE_FINISHED', { targetId: victim }); next = this.checkWin(next);
    return next.phase === 'GAME_OVER' ? next : this.transition(next, 'EXECUTION');
  }

  private resolveDeathTriggers(state: WerewolfGameState): WerewolfGameState { return this.checkWin(state); }

  private kill(state: WerewolfGameState, victimId: string, source: string, reason: string): void {
    const victim = state.players.find((p) => p.playerId === victimId); if (!victim || !victim.alive) return;
    victim.alive = false; const at = new Date().toISOString(); state.deaths.push({ victimId, source, reason, at }); this.emit(state, 'PLAYER_DIED', { targetId: victimId, payload: { source, reason } });
    if (victim.loverId) this.kill(state, victim.loverId, 'LOVER', 'LOVE_DEATH_TRIGGER');
    if (victim.roleId === 'hunter') this.emit(state, 'HUNTER_TRIGGERED', { actorId: victimId });
  }

  private checkWin(state: WerewolfGameState): WerewolfGameState {
    const alive = state.players.filter((p) => p.alive); const wolves = alive.filter((p) => p.roleId === 'werewolf').length; const village = alive.length - wolves;
    if (wolves === 0) { state.winnerTeam = 'VILLAGE'; return this.transition(state, 'GAME_OVER'); }
    if (wolves >= village) { state.winnerTeam = 'WEREWOLF'; return this.transition(state, 'GAME_OVER'); }
    return state;
  }

  private transition(state: WerewolfGameState, phase: WerewolfPhase): WerewolfGameState {
    let next = clone(state); next.phase = phase; next.sequence += 1; const now = new Date().toISOString(); next.phaseStartedAt = now;
    const seconds = phase === 'NIGHT' ? CLASSIC_10_RULESET.nightDurationSeconds : phase === 'DISCUSSION' ? CLASSIC_10_RULESET.discussionDurationSeconds : phase === 'VOTING' ? CLASSIC_10_RULESET.votingDurationSeconds : phase === 'LAST_WORD' ? CLASSIC_10_RULESET.lastWordDurationSeconds : 0;
    next.phaseEndsAt = addSeconds(now, seconds); if (phase === 'DAWN') { next.day += 1; next = this.transition(next, 'DISCUSSION'); } else if (phase === 'DISCUSSION') next = this.transition(next, 'VOTING'); else if (phase === 'EXECUTION') next = this.transition(next, 'LAST_WORD'); else if (phase === 'DEATH_TRIGGER') next = this.transition(next, 'WIN_CHECK'); else if (phase === 'WIN_CHECK') next = this.transition(next, 'NIGHT');
    return this.emit(next, 'PHASE_CHANGED', { payload: { phase: next.phase } });
  }

  private emit(state: WerewolfGameState, type: string, extra: Partial<WerewolfEvent> = {}): WerewolfGameState {
    state.sequence += 1; state.events.push({ id: `${state.gameId}:${state.sequence}`, type, at: new Date().toISOString(), ...extra }); return state;
  }
}

function clone<T>(value: T): T { return JSON.parse(JSON.stringify(value)) as T; }
function addSeconds(iso: string, seconds: number): string { return new Date(new Date(iso).getTime() + seconds * 1000).toISOString(); }
function mostFrequent(values: string[]): string | undefined { const counts = new Map<string, number>(); values.forEach((v) => counts.set(v, (counts.get(v) ?? 0) + 1)); return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0]; }
function deterministicShuffle<T>(items: T[], seed: number): T[] { let s = seed >>> 0; for (let i = items.length - 1; i > 0; i -= 1) { s = (s * 1664525 + 1013904223) >>> 0; const j = s % (i + 1); [items[i], items[j]] = [items[j], items[i]]; } return items; }
