# LuNu BoardGame structure

The Vue 3 application is organized as a club shell with route-level experiences. `App.vue` owns the sidebar and topbar. `features/home` renders the dashboard, `features/rooms` owns lobby and room-table workflows, and `features/games/GameSessionView.vue` is the reusable live arena shell. `data/games.ts` is the single frontend source of truth for game metadata, rules, fee models, AI modes, and demo-room fixtures.

The Fastify backend keeps the existing modular layout. `modules/rooms` owns room lifecycle and now persists `role`, `seat_index`, and `joined_at` for seat fairness. `modules/games/core` remains the engine boundary; the existing UNO engine is still compatible, and future engines should implement the same `GameEngine` contract. The Supabase migration under `backend/supabase/migrations` is required before enabling the spectator flow in a deployed database.

The current arena intentionally separates presentation from game rules. A concrete engine can supply authoritative state through the existing session endpoints without changing the surrounding lobby, table, spectator, guide, or wallet UI.
