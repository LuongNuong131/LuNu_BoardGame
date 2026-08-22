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
