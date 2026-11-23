export type WerewolfPhase =
  | 'LOBBY'
  | 'NIGHT'
  | 'DAWN'
  | 'DISCUSSION'
  | 'VOTING'
  | 'EXECUTION'
  | 'LAST_WORD'
  | 'DEATH_TRIGGER'
  | 'WIN_CHECK'
  | 'GAME_OVER';

export type WerewolfRoleId = 'werewolf' | 'villager' | 'seer' | 'witch' | 'guard' | 'hunter';
export type WerewolfTeam = 'WEREWOLF' | 'VILLAGE';
export type TiePolicy = 'NO_EXECUTION' | 'RANDOM_EXECUTION' | 'REVOTE';
export type WerewolfActionType =
  | 'SKIP_NIGHT'
  | 'WEREWOLF_KILL'
  | 'SEER_CHECK'
  | 'GUARD_PROTECT'
  | 'WITCH_HEAL'
  | 'WITCH_POISON'
  | 'CAST_VOTE'
  | 'SKIP_VOTE'
  | 'HUNTER_SHOOT'
  | 'CONFIRM_LAST_WORD';

export interface WerewolfRuleset {
  minPlayers: number;
  maxPlayers: number;
  roles: WerewolfRoleId[];
  nightDurationSeconds: number;
  discussionDurationSeconds: number;
  votingDurationSeconds: number;
  lastWordDurationSeconds: number;
  revealRolesOnDeath: boolean;
  tiePolicy: TiePolicy;
  guardCannotRepeatTarget: boolean;
  witchHealUses: number;
  witchPoisonUses: number;
}

export interface WerewolfPlayerState {
  playerId: string;
  seat: number;
  alive: boolean;
  roleId: WerewolfRoleId;
  disconnected: boolean;
  lastGuardTarget?: string;
  loverId?: string;
  usedAbilities: string[];
  seen?: Record<string, WerewolfTeam>;
}

export interface PendingNightAction {
  actorId: string;
  type: WerewolfActionType;
  targetId?: string;
  submittedAt: string;
}

export interface WerewolfDeath {
  victimId: string;
  source: string;
  killerId?: string;
  reason: string;
  at: string;
}

export interface WerewolfEvent {
  id: string;
  type: string;
  at: string;
  actorId?: string;
  targetId?: string;
  payload?: Record<string, unknown>;
}

export interface WerewolfGameState {
  gameId: string;
  roomId?: string;
  phase: WerewolfPhase;
  day: number;
  night: number;
  phaseStartedAt: string;
  phaseEndsAt: string;
  players: WerewolfPlayerState[];
  pendingNightActions: PendingNightAction[];
  votes: Record<string, string | 'SKIP'>;
  deaths: WerewolfDeath[];
  events: WerewolfEvent[];
  winnerTeam?: WerewolfTeam;
  winnerPlayers?: string[];
  randomSeed: number;
  sequence: number;
  rules?: WerewolfRuleset;
  pendingVictim?: string;
  revoteDay?: number;
}

export interface WerewolfResult {
  gameId: string;
  winnerTeam?: WerewolfTeam;
  winnerPlayers: string[];
  loserPlayers: string[];
  days: number;
  nights: number;
  kills: number;
  executions: number;
}

export interface WerewolfAction {
  type: WerewolfActionType;
  targetPlayerId?: string;
  idempotencyKey?: string;
}

export const CLASSIC_10_RULESET: WerewolfRuleset = {
  minPlayers: 6,
  maxPlayers: 18,
  roles: ['werewolf', 'werewolf', 'werewolf', 'seer', 'witch', 'guard', 'hunter', 'villager', 'villager', 'villager'],
  nightDurationSeconds: 60,
  discussionDurationSeconds: 180,
  votingDurationSeconds: 30,
  lastWordDurationSeconds: 30,
  revealRolesOnDeath: true,
  tiePolicy: 'NO_EXECUTION',
  guardCannotRepeatTarget: true,
  witchHealUses: 1,
  witchPoisonUses: 1,
};

export function rulesetForPlayerCount(playerCount: number): WerewolfRuleset {
  if (playerCount < 6 || playerCount > 18) throw new Error('Werewolf supports 6–18 players.');
  const wolves = Math.max(2, Math.floor(playerCount / 4));
  const roles: WerewolfRoleId[] = Array.from({ length: wolves }, () => 'werewolf');
  roles.push('seer', 'witch', 'guard', 'hunter');
  while (roles.length < playerCount) roles.push('villager');
  return { ...CLASSIC_10_RULESET, maxPlayers: playerCount, roles };
}

export function roleTeam(roleId: WerewolfRoleId): WerewolfTeam {
  return roleId === 'werewolf' ? 'WEREWOLF' : 'VILLAGE';
}

export function roleName(roleId: WerewolfRoleId): string {
  return ({ werewolf: 'Ma Sói', villager: 'Dân làng', seer: 'Tiên tri', witch: 'Phù thủy', guard: 'Bảo vệ', hunter: 'Thợ săn' } as const)[roleId];
}
