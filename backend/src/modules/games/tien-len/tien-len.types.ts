export type TienLenSuit = 'SPADE' | 'CLUB' | 'DIAMOND' | 'HEART';
export type TienLenCombinationType = 'SINGLE' | 'PAIR' | 'TRIPLE' | 'FOUR_OF_A_KIND' | 'STRAIGHT';
export type TienLenPhase = 'DEALING' | 'PLAYING' | 'TRICK_RESOLUTION' | 'ROUND_END' | 'FINISHED';
export type TienLenActionType = 'PLAY_CARDS' | 'PASS' | 'SORT_HAND';

export interface TienLenCard { cardId: string; rank: number; suit: TienLenSuit; deckId: string; }
export interface TienLenCombination { isValid: boolean; combinationType?: TienLenCombinationType; rank?: number; highestCard?: TienLenCard; length: number; suit?: TienLenSuit; metadata?: Record<string, unknown>; }
export interface TienLenRuleset { playerCount: number; deckCount: number; rankOrder: number[]; suitOrder: TienLenSuit[]; allowTwoToBeatPair: boolean; allowFourToBeatTwo: boolean; allowStraight: boolean; firstCardId: string; }
export interface TienLenPlayer { playerId: string; seat: number; cards: TienLenCard[]; isConnected: boolean; isAFK: boolean; isFinished: boolean; rank?: number; score: number; currencyChange: number; }
export interface TienLenLastPlay { playerId: string; cards: TienLenCard[]; combination: TienLenCombination; }
export interface TienLenState { gameId: string; roomId?: string; status: TienLenPhase; round: number; phase: TienLenPhase; currentPlayer: string; leaderPlayer: string; turnNumber: number; players: TienLenPlayer[]; table: TienLenCard[]; lastPlay?: TienLenLastPlay; passCount: number; startingPlayer: string; winner?: string; gameResult?: { rankings: string[]; scores: Record<string, number> }; ruleset: TienLenRuleset; timer: { startedAt: string; endsAt: string }; eventLog: Array<{ type: string; at: string; playerId?: string; payload?: Record<string, unknown> }>; actionIds: string[]; shuffleSeed: number; }
export interface TienLenAction { type: TienLenActionType; cardIds?: string[]; actionId?: string; }
export interface TienLenResult { gameId: string; winner?: string; rankings: string[]; scores: Record<string, number>; }

export const DEFAULT_TIEN_LEN_RULESET: TienLenRuleset = { playerCount: 4, deckCount: 52, rankOrder: [3,4,5,6,7,8,9,10,11,12,13,14,15], suitOrder: ['SPADE','CLUB','DIAMOND','HEART'], allowTwoToBeatPair: true, allowFourToBeatTwo: true, allowStraight: true, firstCardId: '3S' };
export const rankValue = (rank: number) => rank === 1 ? 14 : rank === 2 ? 15 : rank;
export const cardValue = (card: TienLenCard, ruleset = DEFAULT_TIEN_LEN_RULESET) => ruleset.rankOrder.indexOf(rankValue(card.rank)) * 10 + ruleset.suitOrder.indexOf(card.suit);
