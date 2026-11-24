import { strict as assert } from 'node:assert';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { createTestDatabase } from './test-database';

const userId = (n: number) => `00000000-0000-0000-0000-${String(n).padStart(12, '0')}`;
const [a, b, c, observer] = [1, 2, 3, 4].map(userId);
const date = '2026-11-24T00:00:00.123456Z';
type Row = { session_id: string; ended_at: string; game_id: string; outcome: string; mode: string; can_view: boolean };

test('records legacy and new results, protects personal history and ranks active members', async () => {
  const db = await createTestDatabase();
  try {
    const bundle = await readFile('supabase/LuNuBoardGame_FULL_SCHEMA.sql', 'utf8');
    const current = await readFile('supabase/migrations/202611240000_match_results.sql', 'utf8');
    assert.ok(bundle.endsWith(current));
    await db.exec(bundle.slice(0, -current.length));

    for (const [i, id] of [a, b, c, observer].entries()) {
      await db.query('insert into auth.users (id, email) values ($1, $2)', [id, `player${i + 1}@gameverse.local`]);
    }
    const games = ['CHESS', 'WEREWOLF', 'BLACKJACK', 'XI_DACH', 'TIEN_LEN', 'LIENG'];
    for (const [index, game] of games.entries()) {
      await db.query("insert into public.game_rooms(id, game_id, name, owner_id, max_players) values($1, $2, 'Bàn ' || $2, $3, 6)",
        [userId(20 + index), game, a]);
    }
    const insert = (id: number, game: string, state: object, finishedAt = date, winner: string | null = null) =>
      db.query(`insert into public.game_sessions(id, room_id, game_id, status, current_state, started_at, updated_at, winner_id)
        values($1, $2, $3, 'FINISHED', $4, '2026-08-01T00:00:00Z', $5, $6)`,
      [userId(id), userId(20 + games.indexOf(game)), game, state, finishedAt, winner]);

    // Insert matches before the migration exists to check backfill from old JSON shapes.
    await insert(100, 'CHESS', { players: [a, b], hands: { [a]: ['private'] } }, date, a);
    await insert(101, 'CHESS', { players: [a, b], winners: [], endReason: 'STALEMATE' });
    await insert(102, 'CHESS', { players: [a, 'AI_HARD'], winner: 'AI_HARD' });
    await insert(103, 'CHESS', { players: [a, b], aiDifficulty: 'MEDIUM', winner: b });
    await insert(104, 'CHESS', { players: [b, c], winners: [] });
    await insert(105, 'CHESS', { players: [b, c], winner: c }, '2026-10-20T00:00:00Z');
    await insert(106, 'CHESS', { players: { bad: 'legacy' } });
    await db.exec(current);
    await db.exec(current);

    await insert(110, 'BLACKJACK', { players: [a, b], outcomes: { [a]: 'WIN', [b]: 'PUSH' } });
    await insert(111, 'XI_DACH', { players: [a, b, c], dealerId: a, outcomes: { [b]: 'WIN', [c]: 'LOSS' } });
    await insert(112, 'WEREWOLF', {
      players: [{ playerId: a, roleId: 'villager', alive: false }, { playerId: b, roleId: 'werewolf' }, { playerId: c, roleId: 'guard' }],
      winnerTeam: 'VILLAGE', winnerPlayers: [c],
    });
    await insert(113, 'TIEN_LEN', { players: [{ playerId: a }, { playerId: b }], winner: b, gameResult: { rankings: [a, b] } });
    await insert(114, 'LIENG', { players: [a, b, c], winners: [a, b] });
    await insert(115, 'CHESS', { players: [a, b], winner: a }, '2026-11-24T00:00:00.123455Z');

    const history = async (member: string, game: string | null = null, outcome: string | null = null, before: Row | null = null, limit = 50) =>
      (await db.query<Row>(`select session_id, game_id, outcome, mode, can_view,
        to_char(ended_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') as ended_at
        from public.lunu_match_history($1, $2, $3, $4, $5, $6)`,
      [member, game, outcome, before?.ended_at ?? null, before?.session_id ?? null, limit])).rows;

    const result = (rows: Row[], id: number) => rows.find((item) => item.session_id === userId(id));
    const own = await history(a);
    assert.equal(own.length, 10);
    assert.equal(result(own, 100)?.outcome, 'WIN');
    assert.equal(result(own, 101)?.outcome, 'DRAW');
    assert.equal(result(own, 102)?.outcome, 'LOSS');
    assert.equal(result(own, 102)?.mode, 'BOT');
    assert.equal(result(own, 103)?.mode, 'BOT');
    assert.equal(result(own, 110)?.mode, 'HOUSE');
    assert.equal(result(own, 111)?.outcome, 'DRAW');
    assert.equal(result(own, 112)?.outcome, 'WIN');
    assert.equal(result(own, 113)?.outcome, 'WIN');
    const memberB = await history(b);
    assert.equal(result(memberB, 104)?.outcome, 'UNKNOWN');
    assert.equal(result(memberB, 110)?.outcome, 'DRAW');
    assert.equal(result(memberB, 112)?.outcome, 'LOSS');
    assert.equal(result(memberB, 113)?.outcome, 'LOSS');
    assert.deepEqual(await history(observer), []);

    const first = await history(a, 'CHESS', null, null, 3);
    const second = await history(a, 'CHESS', null, first[2], 3);
    assert.deepEqual([...first, ...second].map((item) => item.session_id),
      [103, 102, 101, 100, 115].map(userId));
    assert.deepEqual((await history(a, 'CHESS', 'WIN')).map((item) => item.session_id), [100, 115].map(userId));

    const stats = (await db.query('select public.lunu_match_stats($1) as stats', [a])).rows[0].stats;
    assert.deepEqual(stats, { played: 10, wins: 6, losses: 2, draws: 2 });
    const getRank = async (user: string, game: string, since: string | null = null) =>
      (await db.query<{ board: { me: { points: number; place: number } | null; leaders: Array<{ username: string; points: number; place: number; is_me: boolean }> } }>(
        'select public.lunu_leaderboard($1, $2, $3) as board', [user, game, since])).rows[0].board;
    const chess = await getRank(a, 'CHESS', '2026-11-01T00:00:00Z');
    assert.equal(chess.me?.points, 7);
    assert.deepEqual(chess.leaders.map((row) => [row.username, row.points, row.is_me]),
      [['player1', 7, true], ['player2', 1, false]]);
    assert.equal((await getRank(c, 'CHESS')).me?.points, 3);
    const tied = await getRank(c, 'LIENG');
    assert.deepEqual(tied.leaders.map((row) => [row.place, row.points]), [[1, 3], [1, 3], [3, 0]]);
    assert.equal((await getRank(a, 'BLACKJACK')).me, null);
    await db.query("update public.profiles set status = 'SUSPENDED' where id = $1", [b]);
    assert.deepEqual((await getRank(c, 'LIENG')).leaders.map((row) => row.username), ['player1', 'player3']);
    const permissions = (await db.query(`select
      has_table_privilege('authenticated', 'public.game_match_results', 'SELECT') as private_table,
      has_function_privilege('authenticated', 'public.lunu_match_history(uuid,text,text,timestamptz,uuid,integer)', 'EXECUTE') as private_rpc,
      has_function_privilege('service_role', 'public.lunu_match_history(uuid,text,text,timestamptz,uuid,integer)', 'EXECUTE') as api_rpc`)).rows[0];
    assert.deepEqual(permissions, { private_table: false, private_rpc: false, api_rpc: true });
  } finally {
    await db.close();
  }
});
