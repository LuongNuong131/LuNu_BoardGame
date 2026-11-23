-- Keep account roles and balance changes behind server-owned operations.
revoke update on public.profiles from anon, authenticated;
drop policy if exists profiles_self_update on public.profiles;
revoke execute on function public.join_room(uuid, uuid) from public, anon, authenticated;
grant execute on function public.join_room(uuid, uuid) to service_role;
revoke execute on function public.process_wallet_transaction(uuid, bigint, text, text, uuid) from public, anon, authenticated;
grant execute on function public.process_wallet_transaction(uuid, bigint, text, text, uuid) to service_role;

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  account_name text := coalesce(new.raw_user_meta_data ->> 'username', split_part(new.email, '@', 1));
  account_role text := coalesce(new.raw_app_meta_data ->> 'role', 'USER');
begin
  if account_role not in ('USER', 'MODERATOR', 'ADMIN', 'SUPER_ADMIN') then account_role := 'USER'; end if;
  insert into public.profiles(id, username, display_name, role)
    values(new.id, account_name, coalesce(new.raw_user_meta_data ->> 'display_name', account_name), account_role)
    on conflict(id) do nothing;
  insert into public.wallets(user_id, balance) values(new.id, 10000) on conflict(user_id) do nothing;
  return new;
end;
$$;

create table if not exists public.game_session_entries (
  session_id uuid not null references public.game_sessions(id) on delete cascade,
  user_id uuid not null,
  entry_amount bigint not null check (entry_amount > 0),
  primary key (session_id, user_id)
);
alter table public.game_session_entries enable row level security;
revoke all on public.game_session_entries from anon, authenticated;

-- Players are charged at start and the pot is paid or refunded in the same
-- transaction as the terminal session write. Old matches have no escrow rows.
create or replace function public.lunu_settle_session_entries(
  match_id uuid, match_state jsonb, match_status text, match_winner uuid
) returns void language plpgsql security definer set search_path = '' as $$
declare
  entry record;
  pool bigint;
  payout bigint;
  winners uuid[];
  winner_count integer;
  winner_index integer := 0;
begin
  perform 1 from public.game_session_entries where session_id = match_id order by user_id for update;
  select coalesce(sum(entry_amount), 0) into pool from public.game_session_entries where session_id = match_id;
  if pool = 0 then return; end if;
  select coalesce(array_agg(participant.user_id order by participant.user_id), array[]::uuid[]) into winners
    from public.game_session_entries participant join public.profiles profile on profile.id = participant.user_id
    where participant.session_id = match_id and match_status = 'FINISHED' and
      (participant.user_id = match_winner
        or coalesce(match_state -> 'winners', '[]'::jsonb) ? participant.user_id::text
        or coalesce(match_state -> 'winnerPlayers', '[]'::jsonb) ? participant.user_id::text);
  winner_count := cardinality(winners);
  for entry in select participant.* from public.game_session_entries participant
      join public.profiles profile on profile.id = participant.user_id
      where session_id = match_id order by participant.user_id loop
    if winner_count = 0 then
      perform public.process_wallet_transaction(entry.user_id, entry.entry_amount, 'GAME_REFUND', 'Hoàn phí ván ' || match_id::text);
    elsif entry.user_id = any(winners) then
      winner_index := winner_index + 1;
      payout := pool / winner_count + case when winner_index <= pool % winner_count then 1 else 0 end;
      perform public.process_wallet_transaction(entry.user_id, payout, 'GAME_PAYOUT', 'Thưởng ván ' || match_id::text);
    end if;
  end loop;
  delete from public.game_session_entries where session_id = match_id;
end;
$$;
revoke execute on function public.lunu_settle_session_entries(uuid, jsonb, text, uuid) from public, anon, authenticated;

-- Publish session changes without putting any hands, decks or roles on Realtime.
create table if not exists public.game_session_signals (
  id uuid primary key references public.game_sessions(id) on delete cascade,
  room_id uuid not null references public.game_rooms(id) on delete cascade,
  status text not null,
  updated_at timestamptz not null
);
alter table public.game_session_signals enable row level security;
grant select on public.game_session_signals to authenticated;
drop policy if exists authenticated_session_signals on public.game_session_signals;
create policy authenticated_session_signals on public.game_session_signals for select to authenticated using (true);

create or replace function public.lunu_lock_session_room() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  lobby_status text;
  active_players text[];
  proposed_players text[];
begin
  select status into lobby_status from public.game_rooms where id = new.room_id for update;
  if lobby_status is distinct from 'WAITING' then
    raise exception 'lunu_room_running' using errcode = 'P0001';
  end if;
  select coalesce(array_agg(user_id::text order by user_id::text), array[]::text[])
    into active_players from (
      select user_id from public.game_room_players where room_id = new.room_id and role = 'PLAYER' for key share
    ) seated;
  select coalesce(array_agg(id order by id), array[]::text[]) into proposed_players
    from (
      select case jsonb_typeof(entry) when 'string' then entry #>> '{}' else entry ->> 'playerId' end as id
      from jsonb_array_elements(new.current_state -> 'players') as players(entry)
    ) roster where left(id, 3) <> 'AI_';
  if proposed_players is distinct from active_players then
    raise exception 'lunu_roster_changed' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

create or replace function public.lunu_publish_session_change() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  fee bigint;
  participant record;
begin
  insert into public.game_session_signals(id, room_id, status, updated_at)
    values(new.id, new.room_id, new.status, new.updated_at)
    on conflict(id) do update set status = excluded.status, updated_at = excluded.updated_at;
  if tg_op = 'INSERT' and new.status = 'PLAYING' then
    select entry_fee into fee from public.game_rooms where id = new.room_id;
    if fee > 0 then
      if exists (
        select 1 from jsonb_array_elements(new.current_state -> 'players') as players(entry)
        where jsonb_typeof(entry) = 'string' and left(entry #>> '{}', 3) = 'AI_'
      ) then raise exception 'lunu_ai_free_only' using errcode = 'P0001'; end if;
      for participant in select user_id from public.game_room_players where room_id = new.room_id and role = 'PLAYER' order by user_id loop
        perform public.process_wallet_transaction(participant.user_id, -fee, 'GAME_ENTRY', 'Phí ván ' || new.id::text);
        insert into public.game_session_entries(session_id, user_id, entry_amount) values (new.id, participant.user_id, fee);
      end loop;
    end if;
    update public.game_rooms set status = 'RUNNING', updated_at = now() where id = new.room_id;
  elsif tg_op = 'UPDATE' and old.status = 'PLAYING' and new.status <> 'PLAYING' then
    perform public.lunu_settle_session_entries(new.id, new.current_state, new.status, new.winner_id);
    update public.game_rooms set status = 'WAITING', updated_at = now() where id = new.room_id and status = 'RUNNING';
  end if;
  return new;
end;
$$;

create or replace function public.lunu_release_session_seat() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  next_host uuid;
begin
  if old.role <> 'PLAYER' or not exists (select 1 from public.game_rooms where id = old.room_id) then return old; end if;
  update public.game_sessions as session
    set status = 'ABANDONED',
        updated_at = greatest(clock_timestamp(), session.updated_at + interval '1 millisecond'),
        current_state = session.current_state || jsonb_build_object('revision', coalesce((session.current_state ->> 'revision')::integer, 0) + 1, 'endReason', 'PLAYER_LEFT')
    where session.room_id = old.room_id and session.status = 'PLAYING'
      and exists (
        select 1 from jsonb_array_elements(session.current_state -> 'players') as players(entry)
        where (case jsonb_typeof(entry) when 'string' then entry #>> '{}' else entry ->> 'playerId' end) = old.user_id::text
      );
  select user_id into next_host from public.game_room_players where room_id = old.room_id and role = 'PLAYER'
    order by seat_index nulls last, joined_at limit 1;
  if next_host is not null then
    update public.game_rooms set owner_id = next_host, updated_at = now() where id = old.room_id and owner_id = old.user_id;
  end if;
  return old;
end;
$$;

-- Refund active entries before a room is removed and cascades delete its matches.
create or replace function public.lunu_refund_deleted_room() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  match_id uuid;
begin
  for match_id in select id from public.game_sessions where room_id = old.id and status = 'PLAYING' loop
    perform public.lunu_settle_session_entries(match_id, '{}'::jsonb, 'ABANDONED', null);
  end loop;
  return old;
end;
$$;
drop trigger if exists lunu_refund_deleted_room on public.game_rooms;
create trigger lunu_refund_deleted_room before delete on public.game_rooms
  for each row execute function public.lunu_refund_deleted_room();

create or replace function public.lunu_sync_admin_room_status() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.status = 'RUNNING' then
    if not exists (select 1 from public.game_sessions where room_id = new.id and status = 'PLAYING') then
      raise exception 'lunu_no_active_session' using errcode = 'P0001';
    end if;
  elsif old.status = 'RUNNING' then
    update public.game_sessions as session
      set status = 'ABANDONED',
          updated_at = greatest(clock_timestamp(), session.updated_at + interval '1 millisecond'),
          current_state = session.current_state || jsonb_build_object('revision', coalesce((session.current_state ->> 'revision')::integer, 0) + 1, 'endReason', 'ROOM_CLOSED')
      where session.room_id = old.id and session.status = 'PLAYING';
  end if;
  return new;
end;
$$;
drop trigger if exists lunu_sync_admin_room_status on public.game_rooms;
create trigger lunu_sync_admin_room_status after update of status on public.game_rooms
  for each row when (new.status is distinct from old.status) execute function public.lunu_sync_admin_room_status();

drop trigger if exists lunu_lock_session_room on public.game_sessions;
create trigger lunu_lock_session_room before insert on public.game_sessions
  for each row when (new.status = 'PLAYING') execute function public.lunu_lock_session_room();
drop trigger if exists lunu_publish_session_change on public.game_sessions;
create trigger lunu_publish_session_change after insert or update on public.game_sessions
  for each row execute function public.lunu_publish_session_change();
drop trigger if exists lunu_release_session_seat on public.game_room_players;
create trigger lunu_release_session_seat after delete on public.game_room_players
  for each row execute function public.lunu_release_session_seat();

insert into public.game_session_signals(id, room_id, status, updated_at)
  select id, room_id, status, updated_at from public.game_sessions on conflict(id) do nothing;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'game_sessions') then
      alter publication supabase_realtime drop table public.game_sessions;
    end if;
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'game_session_signals') then
      alter publication supabase_realtime add table public.game_session_signals;
    end if;
  end if;
end;
$$;
