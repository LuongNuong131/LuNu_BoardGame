import { apiClient } from '@/services/api/apiClient';

export type Outcome = 'WIN' | 'LOSS' | 'DRAW' | 'ABANDONED' | 'UNKNOWN';
type Mode = 'PVP' | 'BOT' | 'HOUSE';
export type RankingPeriod = '30d' | 'all';

export interface MatchResult {
  session_id: string;
  game_id: string;
  room_name: string;
  started_at: string;
  ended_at: string;
  mode: Mode;
  outcome: Outcome;
  can_view: boolean;
}

export interface MatchStats {
  played: number;
  wins: number;
  losses: number;
  draws: number;
}

interface Standing extends MatchStats {
  place: number;
  points: number;
}

export interface Leader extends Standing {
  username: string;
  display_name: string;
  avatar_url: string | null;
  is_me: boolean;
}

interface Leaderboard {
  leaders: Leader[];
  me: Standing | null;
}

interface HistoryPage {
  items: MatchResult[];
  nextCursor: string | null;
}

type Response<T> = { data: T };
export const outcomes: Record<Outcome, string> = {
  WIN: 'Thắng', LOSS: 'Thua', DRAW: 'Hòa', ABANDONED: 'Dừng ván', UNKNOWN: 'Chưa rõ',
};
export const modes: Record<Mode, string> = {
  PVP: 'Đấu người', BOT: 'Đấu máy', HOUSE: 'Đấu nhà cái',
};

export async function fetchHistory(filters: { game?: string; outcome?: Outcome; before?: string }, signal: AbortSignal) {
  const response = await apiClient.get<unknown, Response<HistoryPage>>('/results/me', { params: filters, signal });
  return response.data;
}

export async function fetchMatchStats(signal: AbortSignal) {
  const response = await apiClient.get<unknown, Response<MatchStats>>('/results/me/stats', { signal });
  return response.data;
}

export async function fetchLeaderboard(filters: { game?: string; period: RankingPeriod }, signal: AbortSignal) {
  const response = await apiClient.get<unknown, Response<Leaderboard>>('/results/leaderboard', { params: filters, signal });
  return response.data;
}

const percentage = new Intl.NumberFormat('vi-VN', { style: 'percent', maximumFractionDigits: 1 });
export const winRate = (stats: MatchStats) => stats.played ? percentage.format(stats.wins / stats.played) : '—';

export function errorMessage(error: unknown) {
  return error && typeof error === 'object' && 'message' in error && typeof error.message === 'string' ?
    error.message : 'Không thể tải dữ liệu ván chơi.';
}
