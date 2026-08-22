# LuNu BoardGame upgrade plan

LuNu is being evolved from a UNO-first prototype into a premium multi-game club. The first vertical slice prioritizes a consistent high-end lobby experience, game discovery, room seating semantics, spectator mode, per-game fee/rule metadata, and a reusable live arena shell.

The frontend already supports the full game catalog and can render demo rooms when the API is empty or unavailable. The backend now persists `PLAYER` versus `SPECTATOR` participation, assigns the lowest available seat, and releases a seat through the leave endpoint. Concrete server-authoritative engines can be added behind the existing `GameEngine` contract in later slices.

Verification criteria are: the frontend builds with `vue-tsc` and Vite; the login, lobby, room detail, and arena routes render without Supabase environment variables in preview mode; full rooms visibly switch to spectator language; all catalog entries expose their player limits, duration, fee model, rules, and how-to-play content; and the backend compiles with TypeScript.
