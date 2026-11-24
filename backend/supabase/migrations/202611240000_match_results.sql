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
