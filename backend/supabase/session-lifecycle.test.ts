import { strict as assert } from 'node:assert';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { PGlite } from '@electric-sql/pglite';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';

const a = '00000000-0000-0000-0000-000000000001';
const b = '00000000-0000-0000-0000-000000000002';
const fan = '00000000-0000-0000-0000-000000000003';
const room = '00000000-0000-0000-0000-000000000010';
const match = '00000000-0000-0000-0000-000000000011';
const second = '00000000-0000-0000-0000-000000000012';

test('SQL migrations enforce seats, keep secrets private and settle or refund wallet fees once', async () => {
  const db = new PGlite({ extensions: { pgcrypto } });
  try {
    await db.exec(`
      create role authenticated;
      create role anon;
      create role service_role;
      create schema auth;
      create schema storage;
      create table auth.users(id uuid primary key, email text, raw_user_meta_data jsonb, raw_app_meta_data jsonb);
      create function auth.uid() returns uuid language sql as 'select null::uuid';
      create table storage.buckets(id text primary key, name text, public bool, file_size_limit bigint, allowed_mime_types text[]);
      create table storage.objects(bucket_id text, name text);
      create function storage.foldername(text) returns text[] language sql as 'select string_to_array($1, ''/'')';
      create publication supabase_realtime;
    `);
    const bundle = await readFile('supabase/LuNuBoardGame_FULL_SCHEMA.sql', 'utf8');
    await db.exec(bundle);
    await db.exec(bundle);
    for (const [i, id] of [a, b, fan].entries()) {
      await db.query("insert into auth.users values($1, $2, '{\"role\":\"SUPER_ADMIN\"}'::jsonb, '{}'::jsonb)", [id, `member${i}@gameverse.local`]);
    }
    assert.equal((await db.query('select distinct role from public.profiles')).rows[0].role, 'USER');
    const permissions = await db.query(`select
      has_function_privilege('authenticated', 'public.process_wallet_transaction(uuid, bigint, text, text, uuid)', 'EXECUTE') as wallet_rpc,
      has_function_privilege('authenticated', 'public.join_room(uuid, uuid)', 'EXECUTE') as seat_rpc,
      has_table_privilege('authenticated', 'public.game_session_signals', 'SELECT') as signals`);
    assert.deepEqual(permissions.rows, [{ wallet_rpc: false, seat_rpc: false, signals: true }]);
    await db.query("insert into public.game_rooms(id, game_id, name, owner_id, max_players, entry_fee) values($1, 'CHESS', 'Bàn test', $2, 2, 100)", [room, a]);
    for (const id of [a, b, fan]) await db.query('select public.join_room($1, $2)', [room, id]);
    assert.equal((await db.query('select role from public.game_room_players where user_id = $1', [fan])).rows[0].role, 'SPECTATOR');

    const insertMatch = (id: string, players: unknown[]) => db.query(
      "insert into public.game_sessions(id, room_id, game_id, current_state) values($1, $2, 'CHESS', $3)",
      [id, room, { players, hands: { a: ['private-card'] } }],
    );
    await assert.rejects(insertMatch(match, [a, fan]), /lunu_roster_changed/);
    const balance = async (id: string) => Number((await db.query('select balance from public.wallets where user_id = $1', [id])).rows[0].balance);
    await db.query('update public.wallets set balance = 0 where user_id = $1', [b]);
    await assert.rejects(insertMatch(match, [a, b]), /INSUFFICIENT_BALANCE/);
    assert.equal(await balance(a), 10000);
    assert.equal((await db.query('select count(*) as total from public.game_session_signals')).rows[0].total, 0);
    await db.query('update public.wallets set balance = 10000 where user_id = $1', [b]);

    await insertMatch(match, [a, b]);
    assert.equal(await balance(a), 9900);
    assert.equal(await balance(b), 9900);
    assert.equal((await db.query('select status from public.game_rooms where id = $1', [room])).rows[0].status, 'RUNNING');
    await assert.rejects(insertMatch(second, [a, b]), /lunu_room_running/);
    const signal = (await db.query('select * from public.game_session_signals where id = $1', [match])).rows[0];
    assert.deepEqual(Object.keys(signal).sort(), ['id', 'room_id', 'status', 'updated_at']);
    const publication = await db.query("select tablename from pg_publication_tables where pubname = 'supabase_realtime'");
    assert.ok(publication.rows.some((row) => row.tablename === 'game_session_signals'));
    assert.ok(publication.rows.every((row) => row.tablename !== 'game_sessions'));
    const finish = () => db.query("update public.game_sessions set status='FINISHED', winner_id=$1 where id=$2", [a, match]);
    await finish();
    await finish();
    assert.equal(await balance(a), 10100);
    assert.equal(await balance(b), 9900);
    assert.equal((await db.query('select status from public.game_rooms where id = $1', [room])).rows[0].status, 'WAITING');

    await insertMatch(second, [{ playerId: a }, { playerId: b }]);
    await db.query('delete from public.game_room_players where room_id = $1 and user_id = $2', [room, b]);
    assert.equal((await db.query('select status from public.game_sessions where id = $1', [second])).rows[0].status, 'ABANDONED');
    assert.equal(await balance(a), 10100);
    assert.equal(await balance(b), 9900);
    assert.equal(await balance(fan), 10000);
    assert.equal((await db.query('select count(*) as total from public.game_session_entries')).rows[0].total, 0);
    await db.query('select public.join_room($1, $2)', [room, b]);
    await insertMatch('00000000-0000-0000-0000-000000000013', [a, b]);
    await db.query('delete from public.game_rooms where id = $1', [room]);
    assert.equal(await balance(a), 10100);
    assert.equal(await balance(b), 9900);
  } finally {
    await db.close();
  }
});
