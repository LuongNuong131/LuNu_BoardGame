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

  if room_record.status <> 'WAITING' then
    assigned_role := 'SPECTATOR';
  else
    select candidate.seat into selected_seat
    from generate_series(1, room_record.max_players) as candidate(seat)
    where not exists (
      select 1 from public.game_room_players p
      where p.room_id = p_room_id and p.role = 'PLAYER' and p.seat_index = candidate.seat
    )
    order by candidate.seat
    limit 1;
    assigned_role := case when selected_seat is null then 'SPECTATOR' else 'PLAYER' end;
  end if;

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
