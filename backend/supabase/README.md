# LuNu Supabase setup

LuNu uses Supabase Auth plus the public tables `profiles`, `wallets`, `wallet_transactions`, `games`, `game_rooms`, `game_room_players`, `game_sessions`, and `chat_messages`.

Run the migrations in filename order from the Supabase SQL Editor or with the Supabase CLI:

```bash
supabase db push
```

The expected order is `202608220000_core_schema.sql`, `202608220001_room_seating.sql`, then `202608220002_game_catalog.sql`. The core migration creates missing tables, profile and wallet triggers, the atomic `process_wallet_transaction` RPC, basic RLS policies, and Realtime publication membership. The seating migration adds `PLAYER`/`SPECTATOR`, deterministic `seat_index`, join ordering, and a unique active-seat index. The catalog migration seeds UNO plus all supported LuNu games.

The TypeScript backend must receive `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` through its local environment. The browser must receive only `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`. Never commit either secret. Admin API routes are protected by the authenticated profile `role` field and accept `SUPER_ADMIN` or `ADMIN` only.

If an older database is started before the seating migration is applied, the room service temporarily falls back to the legacy player-only query so `/api/rooms` does not fail with a 500. Full spectator behavior becomes active immediately after applying `202608220001_room_seating.sql`.
