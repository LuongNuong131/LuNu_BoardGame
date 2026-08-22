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
