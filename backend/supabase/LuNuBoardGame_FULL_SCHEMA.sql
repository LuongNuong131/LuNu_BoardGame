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
