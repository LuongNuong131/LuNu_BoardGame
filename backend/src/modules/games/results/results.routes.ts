import type { FastifyInstance, FastifyRequest } from 'fastify';
import { supabaseAdmin } from '../../../infrastructure/supabase/client';
import { requireAuth } from '../../../middleware/auth.middleware';
import { AppError } from '../../../shared/errors/AppError';

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 50;
const OUTCOMES = ['WIN', 'LOSS', 'DRAW', 'ABANDONED', 'UNKNOWN'];
const UUID = /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i;
const CURSOR_TIME = /^(\d{4}-\d{2}-\d{2})T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-]\d{2}:\d{2})$/;

type Filters = { game?: string; outcome?: string; before?: string; limit?: string; period?: string };
type MatchCursor = { ended_at: string; session_id: string };

function gameFilter(game: unknown) {
  if (game === undefined) return null;
  if (typeof game !== 'string' || !/^[A-Z][A-Z0-9_]{0,30}$/.test(game)) {
    throw new AppError(400, 'INVALID_GAME', 'Mã trò chơi không hợp lệ.');
  }
  return game;
}

function decodeCursor(value: unknown): MatchCursor | null {
  if (value === undefined) return null;
  if (typeof value === 'string' && /^[\w-]{1,150}$/.test(value)) {
    try {
      const [time, id] = JSON.parse(Buffer.from(value, 'base64url').toString('utf8'));
      if (typeof time === 'string' && typeof id === 'string' && UUID.test(id)) {
        const day = CURSOR_TIME.exec(time)?.[1];
        const calendarDate = day && new Date(`${day}T00:00:00Z`);
        if (day && calendarDate && Number.isFinite(calendarDate.getTime()) &&
            calendarDate.toISOString().startsWith(day) && Number.isFinite(Date.parse(time))) {
          return { ended_at: time, session_id: id };
        }
      }
    } catch { /* malformed cursor */ }
  }
  throw new AppError(400, 'INVALID_CURSOR', 'Mốc xem lịch sử không hợp lệ.');
}

function reportFailure(request: FastifyRequest, error: unknown) {
  request.log.error({ err: error }, 'Could not read match results');
  throw new AppError(503, 'MATCH_RESULTS_UNAVAILABLE', 'Tạm thời chưa tải được kết quả ván chơi.');
}

export async function resultsRoutes(server: FastifyInstance) {
  server.addHook('preHandler', requireAuth);
  server.addHook('onRequest', async (_request, reply) => {
    reply.header('Cache-Control', 'private, no-store');
  });

  server.get<{ Querystring: Filters }>('/me', async (request) => {
    const { game, outcome, before, limit } = request.query;
    if (outcome !== undefined && !OUTCOMES.includes(outcome)) {
      throw new AppError(400, 'INVALID_OUTCOME', 'Kết quả lọc không hợp lệ.');
    }
    const size = limit === undefined ? DEFAULT_PAGE_SIZE : Number(limit);
    if (limit !== undefined && (typeof limit !== 'string' || !/^\d{1,2}$/.test(limit) || size < 1 || size > MAX_PAGE_SIZE)) {
      throw new AppError(400, 'INVALID_PAGE_SIZE', 'Số ván mỗi trang phải từ 1 đến 50.');
    }
    const cursor = decodeCursor(before);
    const { data, error } = await supabaseAdmin.rpc('lunu_match_history', {
      p_user_id: request.user!.id,
      p_game_id: gameFilter(game),
      p_outcome: outcome ?? null,
      p_before_time: cursor?.ended_at ?? null,
      p_before_id: cursor?.session_id ?? null,
      p_limit: size + 1,
    });
    if (error) reportFailure(request, error);
    const items = (data || []).slice(0, size);
    const last = items.at(-1) as MatchCursor | undefined;
    const nextCursor = last && data!.length > size ?
      Buffer.from(JSON.stringify([last.ended_at, last.session_id])).toString('base64url') : null;
    return { success: true, data: { items, nextCursor }, error: null };
  });

  server.get('/me/stats', async (request) => {
    const { data, error } = await supabaseAdmin.rpc('lunu_match_stats', { p_user_id: request.user!.id });
    if (error) reportFailure(request, error);
    return { success: true, data, error: null };
  });

  server.get<{ Querystring: Filters }>('/leaderboard', async (request) => {
    const { game, period = '30d' } = request.query;
    if (period !== '30d' && period !== 'all') {
      throw new AppError(400, 'INVALID_PERIOD', 'Khoảng thời gian xếp hạng không hợp lệ.');
    }
    const { data, error } = await supabaseAdmin.rpc('lunu_leaderboard', {
      p_user_id: request.user!.id,
      p_game_id: gameFilter(game),
      p_since: period === '30d' ? new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString() : null,
    });
    if (error) reportFailure(request, error);
    return { success: true, data, error: null };
  });
}
