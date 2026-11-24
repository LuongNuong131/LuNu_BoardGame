-- LuNu BoardGame core Supabase schema
-- Run this migration before the seating and catalog migrations.

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null unique,
  display_name text not null,
  avatar_url text,
  role text not null default 'USER' check (role in ('USER', 'MODERATOR', 'ADMIN', 'SUPER_ADMIN')),
  status text not null default 'ACTIVE' check (status in ('ACTIVE', 'SUSPENDED', 'BANNED', 'DISABLED')),
  level integer not null default 1 check (level >= 1),
  xp integer not null default 0 check (xp >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles add column if not exists username text;
alter table public.profiles add column if not exists display_name text;
alter table public.profiles add column if not exists avatar_url text;
alter table public.profiles add column if not exists avatar_path text;
alter table public.profiles add column if not exists role text not null default 'USER';
alter table public.profiles add column if not exists status text not null default 'ACTIVE';
alter table public.profiles add column if not exists level integer not null default 1;
alter table public.profiles add column if not exists xp integer not null default 0;
alter table public.profiles add column if not exists created_at timestamptz not null default now();
alter table public.profiles add column if not exists updated_at timestamptz not null default now();

alter table public.profiles alter column role set default 'USER';
alter table public.profiles alter column status set default 'ACTIVE';

create table if not exists public.wallets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.profiles(id) on delete cascade,
  balance bigint not null default 10000 check (balance >= 0),
  updated_at timestamptz not null default now()
);

create table if not exists public.wallet_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  amount bigint not null,
  type text not null,
  reason text not null,
  admin_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.wallet_transactions add column if not exists amount bigint not null default 0;
alter table public.wallet_transactions add column if not exists type text not null default 'LEGACY';
alter table public.wallet_transactions add column if not exists reason text not null default 'Giao dịch cũ';
alter table public.wallet_transactions add column if not exists admin_id uuid references public.profiles(id) on delete set null;

alter table public.wallets add column if not exists balance bigint not null default 10000;
alter table public.wallets add column if not exists updated_at timestamptz not null default now();

create index if not exists wallet_transactions_user_created_idx on public.wallet_transactions(user_id, created_at desc);

create table if not exists public.games (
  id text primary key,
  name text not null,
  min_players integer not null check (min_players >= 1),
  max_players integer not null check (max_players >= min_players),
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.game_rooms (
  id uuid primary key default gen_random_uuid(),
  game_id text not null references public.games(id),
  name text not null,
  owner_id uuid not null references public.profiles(id) on delete cascade,
  max_players integer not null check (max_players >= 1),
  entry_fee bigint not null default 0 check (entry_fee >= 0),
  status text not null default 'WAITING' check (status in ('WAITING', 'RUNNING', 'FINISHED', 'CANCELLED')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.game_rooms add column if not exists entry_fee bigint not null default 0;
alter table public.game_rooms add column if not exists updated_at timestamptz not null default now();

create index if not exists game_rooms_status_created_idx on public.game_rooms(status, created_at desc);
create index if not exists game_rooms_owner_idx on public.game_rooms(owner_id);

create table if not exists public.game_room_players (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.game_rooms(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  is_ready boolean not null default false,
  created_at timestamptz not null default now(),
  unique(room_id, user_id)
);

create index if not exists game_room_players_room_idx on public.game_room_players(room_id);

create table if not exists public.game_sessions (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.game_rooms(id) on delete cascade,
  game_id text not null references public.games(id),
  status text not null default 'PLAYING' check (status in ('PLAYING', 'FINISHED', 'ABANDONED')),
  current_state jsonb not null default '{}'::jsonb,
  winner_id uuid references public.profiles(id) on delete set null,
  started_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.game_sessions add column if not exists status text not null default 'PLAYING';
alter table public.game_sessions add column if not exists current_state jsonb not null default '{}'::jsonb;
alter table public.game_sessions add column if not exists winner_id uuid references public.profiles(id) on delete set null;
alter table public.game_sessions add column if not exists started_at timestamptz not null default now();
alter table public.game_sessions add column if not exists updated_at timestamptz not null default now();

create index if not exists game_sessions_room_status_idx on public.game_sessions(room_id, status);
-- Keep only the newest live session if an older installation created duplicates.
delete from public.game_sessions
where id in (
  select id from (
    select id, row_number() over (partition by room_id order by started_at desc, id desc) as duplicate_rank
    from public.game_sessions
    where status = 'PLAYING'
  ) ranked
  where duplicate_rank > 1
);
create unique index if not exists game_sessions_one_playing_per_room_idx on public.game_sessions(room_id) where status = 'PLAYING';

create table if not exists public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  channel_id text not null,
  user_id uuid not null references public.profiles(id) on delete cascade,
  message text,
  content text,
  user_display_name text,
  user_role text,
  expires_at timestamptz not null default (now() + interval '24 hours'),
  created_at timestamptz not null default now(),
  check (char_length(coalesce(content, message, '')) between 1 and 500)
);

alter table public.chat_messages add column if not exists message text;
alter table public.chat_messages add column if not exists content text;
alter table public.chat_messages add column if not exists user_display_name text;
alter table public.chat_messages add column if not exists user_role text default 'USER';
alter table public.chat_messages add column if not exists expires_at timestamptz not null default (now() + interval '24 hours');
-- Legacy installations used message as NOT NULL; content is the canonical field now.
alter table public.chat_messages alter column message drop not null;

create index if not exists chat_messages_channel_created_idx on public.chat_messages(channel_id, created_at desc);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  metadata_username text;
  metadata_display_name text;
begin
  metadata_username := coalesce(new.raw_user_meta_data ->> 'username', split_part(new.email, '@', 1));
  metadata_display_name := coalesce(new.raw_user_meta_data ->> 'display_name', metadata_username);

  insert into public.profiles (id, username, display_name, role)
  values (new.id, metadata_username, metadata_display_name, coalesce(new.raw_user_meta_data ->> 'role', 'USER'))
  on conflict (id) do update set
    display_name = excluded.display_name,
    updated_at = now();

  insert into public.wallets (user_id, balance)
  values (new.id, 10000)
  on conflict (user_id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

create or replace function public.process_wallet_transaction(
  p_user_id uuid,
  p_amount bigint,
  p_type text,
  p_reason text,
  p_admin_id uuid default null
)
returns jsonb
language plpgsql
security definer set search_path = public
as $$
declare
  current_balance bigint;
  next_balance bigint;
  transaction_id uuid;
begin
  if p_amount = 0 then raise exception 'INVALID_AMOUNT'; end if;

  insert into public.wallets (user_id, balance)
  values (p_user_id, 10000)
  on conflict (user_id) do nothing;

  select balance into current_balance from public.wallets where user_id = p_user_id for update;
  next_balance := current_balance + p_amount;
  if next_balance < 0 then raise exception 'INSUFFICIENT_BALANCE'; end if;

  update public.wallets set balance = next_balance, updated_at = now() where user_id = p_user_id;
  insert into public.wallet_transactions (user_id, amount, type, reason, admin_id)
  values (p_user_id, p_amount, p_type, p_reason, p_admin_id)
  returning id into transaction_id;

  return jsonb_build_object('transaction_id', transaction_id, 'user_id', p_user_id, 'amount', p_amount, 'balance', next_balance);
end;
$$;

alter table public.profiles enable row level security;
alter table public.wallets enable row level security;
alter table public.wallet_transactions enable row level security;
alter table public.games enable row level security;
alter table public.game_rooms enable row level security;
alter table public.game_room_players enable row level security;
alter table public.game_sessions enable row level security;
alter table public.chat_messages enable row level security;

-- The backend uses the service role for protected writes. These policies allow a logged-in client
-- to read its own profile/wallet and public game metadata without opening admin data.
drop policy if exists profiles_self_select on public.profiles;
create policy profiles_self_select on public.profiles for select to authenticated using (id = auth.uid());
drop policy if exists profiles_self_update on public.profiles;
create policy profiles_self_update on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());
drop policy if exists games_public_select on public.games;
create policy games_public_select on public.games for select to authenticated using (is_active = true);
drop policy if exists wallets_self_select on public.wallets;
create policy wallets_self_select on public.wallets for select to authenticated using (user_id = auth.uid());
drop policy if exists wallet_transactions_self_select on public.wallet_transactions;
create policy wallet_transactions_self_select on public.wallet_transactions for select to authenticated using (user_id = auth.uid());
drop policy if exists game_rooms_public_select on public.game_rooms;
create policy game_rooms_public_select on public.game_rooms for select to authenticated using (true);
drop policy if exists game_room_players_public_select on public.game_room_players;
create policy game_room_players_public_select on public.game_room_players for select to authenticated using (true);
drop policy if exists chat_messages_public_select on public.chat_messages;
create policy chat_messages_public_select on public.chat_messages for select to authenticated using (expires_at > now());

alter table public.game_rooms replica identity full;
alter table public.game_room_players replica identity full;
alter table public.game_sessions replica identity full;
alter table public.chat_messages replica identity full;

insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do update set public = true;

drop policy if exists avatars_public_read on storage.objects;
create policy avatars_public_read on storage.objects for select using (bucket_id = 'avatars');
drop policy if exists avatars_user_insert on storage.objects;
create policy avatars_user_insert on storage.objects for insert to authenticated with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists avatars_user_update on storage.objects;
create policy avatars_user_update on storage.objects for update to authenticated using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text) with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists avatars_user_delete on storage.objects;
create policy avatars_user_delete on storage.objects for delete to authenticated using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

-- Enable Realtime for the collaboration surfaces when they are not already registered.
do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'game_rooms') then
    alter publication supabase_realtime add table public.game_rooms;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'game_room_players') then
    alter publication supabase_realtime add table public.game_room_players;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'game_sessions') then
    alter publication supabase_realtime add table public.game_sessions;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'chat_messages') then
    alter publication supabase_realtime add table public.chat_messages;
  end if;
end $$;
-- LuNu room seating model
-- Apply this migration before enabling the full-seat spectator flow.

alter table public.game_room_players
  add column if not exists role text not null default 'PLAYER',
  add column if not exists seat_index integer,
  add column if not exists joined_at timestamptz not null default now();

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'game_room_players_role_check'
  ) then
    alter table public.game_room_players
      add constraint game_room_players_role_check check (role in ('PLAYER', 'SPECTATOR'));
  end if;
end $$;

create unique index if not exists game_room_players_unique_active_seat
  on public.game_room_players (room_id, seat_index)
  where role = 'PLAYER' and seat_index is not null;

create index if not exists game_room_players_room_joined_at_idx
  on public.game_room_players (room_id, joined_at);

create or replace function public.join_room(p_room_id uuid, p_user_id uuid)
returns jsonb
language plpgsql
security definer set search_path = public
as $$
declare
  room_record public.game_rooms%rowtype;
  selected_seat integer;
  assigned_role text;
  existing_role text;
  existing_seat integer;
begin
  select * into room_record from public.game_rooms where id = p_room_id for update;
  if room_record.id is null then raise exception 'ROOM_NOT_FOUND'; end if;

  if exists (select 1 from public.game_room_players where room_id = p_room_id and user_id = p_user_id) then
    select role, seat_index into existing_role, existing_seat
    from public.game_room_players where room_id = p_room_id and user_id = p_user_id;
    return jsonb_build_object('mode', existing_role, 'seatIndex', existing_seat);
  end if;

  select candidate.seat into selected_seat
  from generate_series(1, room_record.max_players) as candidate(seat)
  where not exists (
    select 1 from public.game_room_players p
    where p.room_id = p_room_id and p.role = 'PLAYER' and p.seat_index = candidate.seat
  )
  order by candidate.seat
  limit 1;
  assigned_role := case when selected_seat is null then 'SPECTATOR' else 'PLAYER' end;

  insert into public.game_room_players(room_id, user_id, role, seat_index, is_ready, joined_at)
  values (p_room_id, p_user_id, assigned_role, selected_seat, assigned_role = 'PLAYER', now());

  return jsonb_build_object('mode', assigned_role, 'seatIndex', selected_seat);
exception when unique_violation then
  -- A concurrent join can only reach this branch on an existing membership.
  select role, seat_index into existing_role, existing_seat
  from public.game_room_players where room_id = p_room_id and user_id = p_user_id;
  return jsonb_build_object('mode', coalesce(existing_role, 'SPECTATOR'), 'seatIndex', existing_seat);
end;
$$;
-- LuNu game catalog metadata.
-- The engines can be added independently behind the existing GameEngine contract.

insert into public.games (id, name, min_players, max_players) values
  ('UNO', 'UNO', 2, 8),
  ('WEREWOLF', 'Ma Sói', 6, 18),
  ('TIEN_LEN', 'Tiến lên', 2, 4),
  ('BLACKJACK', 'Blackjack', 1, 5),
  ('PHOM', 'Phỏm', 2, 4),
  ('XI_DACH', 'Xì dách', 2, 4),
  ('POKER', 'Poker', 2, 9),
  ('MAU_BINH', 'Mậu binh', 2, 4),
  ('BAO_CAO', 'Bài cào', 2, 6),
  ('LIENG', 'Liêng', 2, 6),
  ('CHESS', 'Cờ vua', 2, 2),
  ('CO_TUONG', 'Cờ tướng', 2, 2),
  ('CO_CA_NGUA', 'Cờ cá ngựa', 2, 4),
  ('CO_TY_PHU', 'Cờ tỷ phú', 2, 6),
  ('EXPLODING_KITTENS', 'Mèo nổ', 2, 5)
on conflict (id) do update set
  name = excluded.name,
  min_players = excluded.min_players,
  max_players = excluded.max_players;
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
-- Keep the result when a room and its session are deleted. A deleted member's own rows are removed.
create table if not exists public.game_match_results (
  session_id uuid not null,
  user_id uuid not null references public.profiles(id) on delete cascade,
  game_id text not null,
  room_name text not null,
  started_at timestamptz not null,
  ended_at timestamptz not null,
  mode text not null check (mode in ('PVP', 'BOT', 'HOUSE')),
  outcome text not null check (outcome in ('WIN', 'LOSS', 'DRAW', 'ABANDONED', 'UNKNOWN')),
  primary key (session_id, user_id)
);

alter table public.game_match_results enable row level security;
revoke all on public.game_match_results from public, anon, authenticated;
grant select on public.game_match_results to service_role;

create index if not exists game_match_results_user_history_idx
  on public.game_match_results (user_id, ended_at desc, session_id desc);
create index if not exists game_match_results_leaderboard_idx
  on public.game_match_results (game_id, ended_at) include (user_id, outcome)
  where mode = 'PVP' and outcome in ('WIN', 'LOSS', 'DRAW');

create or replace function public.lunu_record_match_results(match public.game_sessions)
returns void
language sql
security definer
set search_path = ''
as $$
  with roster as (
    select
      case jsonb_typeof(entry) when 'string' then entry #>> '{}' else entry ->> 'playerId' end as player_id,
      entry ->> 'roleId' as role_id
    from jsonb_array_elements(
      case when jsonb_typeof(match.current_state -> 'players') = 'array'
        then match.current_state -> 'players' else '[]'::jsonb end
    ) entries(entry)
  ), classification as (
    select
      case
        when match.game_id = 'BLACKJACK' then 'HOUSE'
        when nullif(match.current_state ->> 'aiDifficulty', '') is not null
          or exists (select 1 from roster where left(player_id, 3) = 'AI_') then 'BOT'
        else 'PVP'
      end as mode,
      case
        when match.game_id = 'TIEN_LEN' then match.current_state #>> '{gameResult,rankings,0}'
      end as first_rank,
      case
        when match.game_id = 'XI_DACH' and jsonb_typeof(match.current_state -> 'outcomes') = 'object'
        then (select sum(case result when 'LOSS' then 1 when 'WIN' then -1 else 0 end)
              from jsonb_each_text(match.current_state -> 'outcomes') as hands(player_id, result))
      end as dealer_score
  ), results as (
    select roster.player_id, classification.mode,
      case
        when match.status = 'ABANDONED' then 'ABANDONED'
        when match.game_id in ('BLACKJACK', 'XI_DACH')
          and match.current_state -> 'outcomes' ->> roster.player_id in ('WIN', 'LOSS', 'PUSH')
          then case match.current_state -> 'outcomes' ->> roster.player_id when 'PUSH' then 'DRAW'
               else match.current_state -> 'outcomes' ->> roster.player_id end
        when match.game_id = 'XI_DACH' and roster.player_id = match.current_state ->> 'dealerId' and classification.dealer_score is not null
          then case when classification.dealer_score > 0 then 'WIN'
                    when classification.dealer_score < 0 then 'LOSS' else 'DRAW' end
        when match.game_id = 'WEREWOLF' and roster.role_id is not null and match.current_state ->> 'winnerTeam' in ('WEREWOLF', 'VILLAGE')
          then case when (roster.role_id = 'werewolf') = (match.current_state ->> 'winnerTeam' = 'WEREWOLF')
                    then 'WIN' else 'LOSS' end
        when classification.first_rank is not null then case when roster.player_id = classification.first_rank then 'WIN' else 'LOSS' end
        when jsonb_typeof(match.current_state -> 'winners') = 'array'
          then case when match.current_state -> 'winners' ? roster.player_id then 'WIN'
                    when jsonb_array_length(match.current_state -> 'winners') > 0 then 'LOSS'
                    when match.current_state ->> 'endReason' in ('DRAW', 'STALEMATE') then 'DRAW'
                    else 'UNKNOWN' end
        when jsonb_typeof(match.current_state -> 'winnerPlayers') = 'array'
          and match.current_state ->> 'winnerTeam' in ('WEREWOLF', 'VILLAGE')
          then case when match.current_state -> 'winnerPlayers' ? roster.player_id then 'WIN' else 'LOSS' end
        when coalesce(match.current_state ->> 'winner', match.winner_id::text) is not null
          then case when roster.player_id = coalesce(match.current_state ->> 'winner', match.winner_id::text) then 'WIN' else 'LOSS' end
        when match.current_state ->> 'endReason' in ('DRAW', 'STALEMATE') then 'DRAW'
        else 'UNKNOWN'
      end as outcome
    from roster cross join classification
  )
  insert into public.game_match_results (session_id, user_id, game_id, room_name, started_at, ended_at, mode, outcome)
    select match.id, member.id, match.game_id, room.name, match.started_at,
      greatest(match.started_at, match.updated_at), results.mode, results.outcome
    from results
      join public.profiles member on member.id = case
        when results.player_id ~* '^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$' then results.player_id::uuid end
      join public.game_rooms room on room.id = match.room_id
    where match.status in ('FINISHED', 'ABANDONED')
  on conflict (session_id, user_id) do nothing;
$$;

create or replace function public.lunu_record_match_on_finish()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' or old.status = 'PLAYING' then
    perform public.lunu_record_match_results(new);
  end if;
  return new;
end;
$$;

drop trigger if exists lunu_record_match_on_finish on public.game_sessions;
create trigger lunu_record_match_on_finish after insert or update of status on public.game_sessions
  for each row when (new.status in ('FINISHED', 'ABANDONED'))
  execute function public.lunu_record_match_on_finish();

-- A room can be deleted by an admin while the table is still running.
create or replace function public.lunu_record_matches_on_room_delete()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  match public.game_sessions;
begin
  for match in select * from public.game_sessions where room_id = old.id and status = 'PLAYING' loop
    match.status := 'ABANDONED';
    match.updated_at := clock_timestamp();
    perform public.lunu_record_match_results(match);
  end loop;
  return old;
end;
$$;

drop trigger if exists lunu_record_matches_on_room_delete on public.game_rooms;
create trigger lunu_record_matches_on_room_delete before delete on public.game_rooms
  for each row execute function public.lunu_record_matches_on_room_delete();

do $$
declare
  match public.game_sessions;
begin
  for match in select * from public.game_sessions where status in ('FINISHED', 'ABANDONED') loop
    perform public.lunu_record_match_results(match);
  end loop;
end;
$$;

create or replace function public.lunu_match_history(
  p_user_id uuid,
  p_game_id text,
  p_outcome text,
  p_before_time timestamptz,
  p_before_id uuid,
  p_limit integer
)
returns table (
  session_id uuid, game_id text, room_name text, started_at timestamptz, ended_at timestamptz,
  mode text, outcome text, can_view boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select result.session_id, result.game_id, result.room_name, result.started_at, result.ended_at,
    result.mode, result.outcome, session.id is not null
  from public.game_match_results result
    left join public.game_sessions session on session.id = result.session_id
  where result.user_id = p_user_id
    and (p_game_id is null or result.game_id = p_game_id)
    and (p_outcome is null or result.outcome = p_outcome)
    and (p_before_time is null or (result.ended_at, result.session_id) < (p_before_time, p_before_id))
  order by result.ended_at desc, result.session_id desc
  limit greatest(1, least(51, p_limit));
$$;

create or replace function public.lunu_match_stats(p_user_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'played', count(*) filter (where outcome in ('WIN', 'LOSS', 'DRAW')),
    'wins', count(*) filter (where outcome = 'WIN'),
    'losses', count(*) filter (where outcome = 'LOSS'),
    'draws', count(*) filter (where outcome = 'DRAW')
  )
  from public.game_match_results where user_id = p_user_id;
$$;

create or replace function public.lunu_leaderboard(p_user_id uuid, p_game_id text, p_since timestamptz)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with totals as (
    select result.user_id, count(*) as played,
      count(*) filter (where result.outcome = 'WIN') as wins,
      count(*) filter (where result.outcome = 'LOSS') as losses,
      count(*) filter (where result.outcome = 'DRAW') as draws
    from public.game_match_results result
    join public.profiles member on member.id = result.user_id and member.status = 'ACTIVE'
    where result.mode = 'PVP' and result.outcome in ('WIN', 'LOSS', 'DRAW')
      and (p_game_id is null or result.game_id = p_game_id)
      and (p_since is null or result.ended_at >= p_since)
    group by result.user_id
  ), standings as (
    select totals.*, totals.wins * 3 + totals.draws as points,
      rank() over (order by totals.wins * 3 + totals.draws desc, totals.wins desc) as place
    from totals
  ), top_members as (
    select standings.*, member.username, member.display_name, member.avatar_url
    from standings join public.profiles member on member.id = standings.user_id
    order by place, member.username, member.id
    limit 50
  )
  select jsonb_build_object(
    'leaders', coalesce((
      select jsonb_agg(to_jsonb(top_members) - 'user_id' ||
        jsonb_build_object('is_me', top_members.user_id = p_user_id)
        order by top_members.place, top_members.username, top_members.user_id)
      from top_members
    ), '[]'::jsonb),
    'me', (select to_jsonb(standings) - 'user_id' from standings where user_id = p_user_id)
  );
$$;

revoke execute on function public.lunu_record_match_results(public.game_sessions) from public, anon, authenticated;
revoke execute on function public.lunu_record_match_on_finish() from public, anon, authenticated;
revoke execute on function public.lunu_record_matches_on_room_delete() from public, anon, authenticated;
revoke execute on function public.lunu_match_history(uuid, text, text, timestamptz, uuid, integer) from public, anon, authenticated;
revoke execute on function public.lunu_match_stats(uuid) from public, anon, authenticated;
revoke execute on function public.lunu_leaderboard(uuid, text, timestamptz) from public, anon, authenticated;
grant execute on function public.lunu_match_history(uuid, text, text, timestamptz, uuid, integer) to service_role;
grant execute on function public.lunu_match_stats(uuid) to service_role;
grant execute on function public.lunu_leaderboard(uuid, text, timestamptz) to service_role;
