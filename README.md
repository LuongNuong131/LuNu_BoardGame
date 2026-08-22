# LuNu BoardGame

> **Nền tảng board game và card game multiplayer realtime** dành cho những ván chơi có nhịp độ tốt, luật rõ ràng và trải nghiệm cao cấp.

[![Frontend](https://img.shields.io/badge/frontend-Vue%203-42b883?logo=vue.js&logoColor=white)](./frontend)
[![Backend](https://img.shields.io/badge/backend-Fastify%20%2B%20TypeScript-111827?logo=fastify&logoColor=white)](./backend)
[![Database](https://img.shields.io/badge/database-Supabase-3ecf8e?logo=supabase&logoColor=white)](./backend/supabase)
[![Realtime](https://img.shields.io/badge/realtime-Supabase%20Realtime-3ecf8e)](./backend/supabase/LuNuBoardGame_FULL_SCHEMA.sql)

LuNu BoardGame là một hệ thống chơi game nhiều người được xây dựng theo hướng **server-authoritative**. Frontend Vue chịu trách nhiệm hiển thị và tương tác; backend Fastify kiểm tra quyền, luật, lượt chơi và kết toán; Supabase cung cấp Auth, PostgreSQL, Realtime và Storage. Mục tiêu của kiến trúc này là để mọi client nhìn thấy cùng một session, mọi action được kiểm chứng ở server và spectator không thể gửi nước đi giả.

> **Trạng thái dự án:** nền tảng realtime, room seating, player/spectator, profile/avatar, wallet, admin, session concurrency và các catalog engine đã được triển khai. Một số game đã có luật nền tảng playable; các luật thi đấu chuyên sâu vẫn được theo dõi trong roadmap trước khi mở xếp hạng hoặc tiền thật.

## Mục lục

- [Tính năng](#tính-năng)
- [Kiến trúc](#kiến-trúc)
- [Danh mục game](#danh-mục-game)
- [Yêu cầu hệ thống](#yêu-cầu-hệ-thống)
- [Cài đặt nhanh](#cài-đặt-nhanh)
- [Cấu hình environment](#cấu-hình-environment)
- [Thiết lập Supabase](#thiết-lập-supabase)
- [Chạy frontend và backend](#chạy-frontend-và-backend)
- [Luồng multiplayer realtime](#luồng-multiplayer-realtime)
- [Auth, role và bảo mật](#auth-role-và-bảo-mật)
- [Avatar Storage](#avatar-storage)
- [Wallet và audit](#wallet-và-audit)
- [Game engine contract](#game-engine-contract)
- [Cấu trúc repository](#cấu-trúc-repository)
- [API chính](#api-chính)
- [Kiểm thử và release](#kiểm-thử-và-release)
- [Troubleshooting](#troubleshooting)
- [Roadmap](#roadmap)
- [Đóng góp](#đóng-góp)

## Tính năng

| Nhóm | Khả năng |
|---|---|
| **Lobby** | Mặc định hiển thị tất cả game, lọc theo thể loại, phí, số người và trạng thái phòng. Phòng `WAITING` và `RUNNING` đều xuất hiện để người thật có thể vào ghế trống giữa trận. |
| **Room seating** | Ghế `PLAYER` được ưu tiên cho người thật. Khi hết ghế, người mới vào `SPECTATOR`. Khi một người rời bàn, ghế được giải phóng theo thứ tự ổn định. |
| **Realtime** | Lobby, ghế, chat, session state, action log và trạng thái kết nối được đồng bộ qua Supabase Realtime, kèm polling fallback khi channel lỗi hoặc timeout. |
| **Session** | Mỗi phòng chỉ có một session `PLAYING` theo unique partial index. Start và action dùng optimistic concurrency để tránh tạo ván trùng hoặc ghi đè nước đi. |
| **AI tùy chọn** | AI không thay thế người thật. Chỉ khi chủ phòng chọn đấu máy, backend mới tạo AI slot; người thật vào sau sẽ thay thế slot AI nếu còn ghế. |
| **Arena** | Hiển thị participant thật, quyền PLAYER/SPECTATOR, server action log, vòng chơi, pot/bet, community cards và trạng thái realtime. Spectator bị khóa ở cả UI lẫn backend. |
| **Tài khoản** | Supabase Auth, khôi phục session khi reload, profile, username, display name, avatar và trang lịch sử wallet. |
| **Admin** | Dashboard quản lý user, role, wallet audit, xóa phòng và xóa user có safeguard; không cho self-delete hoặc xóa `SUPER_ADMIN`. |
| **Thông báo** | Toast và confirm dialog nội bộ theo thiết kế LuNu; không dùng `alert()`, `confirm()` hay native browser notification. |

## Kiến trúc

```text
┌───────────────────────┐
│ Vue 3 + TypeScript    │
│ Pinia + Router + Vite │
│ Premium Arena UI      │
└───────────┬───────────┘
            │ Axios REST + Supabase client
            ▼
┌───────────────────────┐
│ Fastify + TypeScript  │
│ Auth guards           │
│ Room/session services  │
│ Server-authoritative  │
│ Game engine registry  │
└───────────┬───────────┘
            │ service role / RPC / Realtime
            ▼
┌──────────────────────────────────────────┐
│ Supabase                                 │
│ Auth · PostgreSQL · Realtime · Storage   │
│ profiles · wallets · rooms · sessions    │
└──────────────────────────────────────────┘
```

Frontend không tự quyết định winner, lượt chơi hoặc quyền spectator. Backend đọc session hiện tại, chạy `validateAction()`, áp dụng action bằng engine, ghi `current_state` với điều kiện `updated_at` và phát thay đổi qua Realtime. Supabase service role chỉ được dùng ở backend; browser chỉ được phép dùng URL và anon key.

## Danh mục game

| Game ID | Tên hiển thị | Thể loại | Nền tảng gameplay hiện có |
|---|---|---|---|
| `UNO` | UNO | Card | Engine UNO riêng, turn loop, draw, play, màu và action card. |
| `WEREWOLF` | Ma Sói | Social | Vai trò cơ bản, phase ngày/đêm, vote và night action. |
| `TIEN_LEN` | Tiến lên miền Nam | Card | Đơn, đôi, sám, sảnh, tứ quý, chặn cùng loại, pass và mở vòng mới. |
| `BLACKJACK` | Blackjack | Card | HIT/STAND, tính Át linh hoạt và settlement. |
| `PHOM` | Phỏm | Card | Nhịp rút–đánh, discard và hand submission foundation. |
| `XI_DACH` | Xì dách | Card | HIT/STAND, dealer state và settlement foundation. |
| `POKER` | Poker | Card | Pre-flop, flop, turn, river, community cards, bet/call/raise/check/fold và showdown foundation. |
| `MAU_BINH` | Mậu binh | Card | Chia hand và chốt tay đồng thời; scoring chuyên sâu nằm trong roadmap. |
| `BAO_CAO` | Bài cào | Card | Chốt hand và so điểm server-side. |
| `LIENG` | Liêng | Card | Vòng cược cơ bản, fold và so điểm foundation. |
| `CHESS` | Cờ vua | Board | Board state, quân cờ, kiểm tra đường đi cơ bản, bắt quân và AI move foundation. |
| `CO_TUONG` | Cờ tướng | Board | Board 10×9, quân cờ, pháo, mã, tượng, sĩ, tướng, tốt và AI move foundation. |
| `CO_CA_NGUA` | Cờ cá ngựa | Board | Dice, position và race-to-finish foundation. |
| `CO_TY_PHU` | Cờ tỷ phú | Board | Dice, position và turn loop foundation. |
| `EXPLODING_KITTENS` | Mèo nổ | Card | Bomb, Defuse, pending explosion và loại người chơi khi không cứu được. |

Tên engine được đăng ký tại [`backend/src/modules/games/core/init-games.ts`](./backend/src/modules/games/core/init-games.ts). Các catalog class nằm tại [`backend/src/modules/games/catalog/CatalogEngines.ts`](./backend/src/modules/games/catalog/CatalogEngines.ts).

> **Phân biệt rõ:** “playable foundation” không đồng nghĩa với luật giải đấu hoàn chỉnh. Không nên dùng các engine đang ở roadmap cho tiền thật, ranking chính thức hoặc kết quả có giá trị tài chính trước khi hoàn thiện test luật và audit độc lập.

## Yêu cầu hệ thống

| Thành phần | Khuyến nghị |
|---|---|
| Node.js | LTS hiện hành; trên Windows nên dùng Node.js LTS thay vì bản experimental. |
| npm | Đi kèm Node.js, dùng được cho workflow Windows. |
| Git | Để clone, pull và theo dõi migration. |
| Supabase project | Bật Auth, PostgreSQL, Realtime và Storage. |
| Browser | Chromium, Edge hoặc Firefox phiên bản hiện đại. |

Repository không có root `package.json`; frontend và backend là hai workspace độc lập, mỗi workspace có `package.json` và lockfile riêng.

## Cài đặt nhanh

```bash
git clone https://github.com/LuongNuong131/LuNu_BoardGame.git
cd LuNu_BoardGame

cd backend
npm install

cd ../frontend
npm install
```

Trên Windows PowerShell, các lệnh trên có thể chạy trong hai terminal riêng. Không commit `.env`, service-role key hoặc bất kỳ secret nào vào Git.

## Cấu hình environment

### Backend `.env`

Tạo file `backend/.env`:

```env
PORT=3000
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-server-only-service-role-key
CORS_ORIGIN=http://localhost:5173
```

`SUPABASE_SERVICE_ROLE_KEY` có quyền cao và **chỉ được đặt ở backend**. Không đưa biến này vào frontend hoặc log ra terminal.

### Frontend `.env`

Tạo file `frontend/.env`:

```env
VITE_API_BASE_URL=http://localhost:3000/api
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-browser-safe-anon-key
```

Frontend có placeholder để preview không bị crash khi thiếu Supabase config, nhưng môi trường production phải cung cấp đầy đủ cả hai biến `VITE_SUPABASE_*`.

## Thiết lập Supabase

Mở Supabase Dashboard → **SQL Editor**, sau đó copy và chạy toàn bộ file:

```text
backend/supabase/LuNuBoardGame_FULL_SCHEMA.sql
```

Bundle này ghép các migration theo đúng thứ tự:

```text
backend/supabase/migrations/202608220000_core_schema.sql
backend/supabase/migrations/202608220001_room_seating.sql
backend/supabase/migrations/202608220002_game_catalog.sql
```

Bundle được thiết kế theo hướng idempotent cho việc cài đặt lại. Nó bao gồm bảng profile, wallet, game catalog, room, seating, chat, game session, RLS, Realtime publication, wallet RPC, Storage bucket `avatars`, Storage policies và unique index chống nhiều session `PLAYING` trong cùng một room.

Sau khi sửa bất kỳ migration nào, phải tái tạo bundle trước khi giao cho người dùng:

```bash
cd backend
cat supabase/migrations/202608220000_core_schema.sql \
    supabase/migrations/202608220001_room_seating.sql \
    supabase/migrations/202608220002_game_catalog.sql \
    > supabase/LuNuBoardGame_FULL_SCHEMA.sql
```

Nếu database đã có dữ liệu production, hãy backup trước khi chạy migration. Không tự ý chạy `DROP` trên project thật nếu chưa hiểu tác động.

## Chạy frontend và backend

Terminal 1 — backend:

```bash
cd backend
npm run dev
```

Backend mặc định phục vụ API tại `http://localhost:3000/api`.

Terminal 2 — frontend:

```bash
cd frontend
npm run dev
```

Vite thường phục vụ giao diện tại `http://localhost:5173`.

Build production:

```bash
cd frontend
npm run build

cd ../backend
npm run build
npm run start
```

Các route frontend chính:

| Route | Mục đích |
|---|---|
| `/login` | Đăng nhập; đăng ký đang được ẩn theo yêu cầu sản phẩm. |
| `/` | Home/dashboard. |
| `/rooms` | Lobby tất cả game. |
| `/room/:id` | Room detail, seating, chat và hướng dẫn game. |
| `/game/:sessionId` | Live arena của session. |
| `/profile` | Profile và avatar lifecycle. |
| `/wallet-history` | Lịch sử giao dịch wallet. |
| `/admin` | Admin dashboard, yêu cầu role phù hợp. |

## Luồng multiplayer realtime

Luồng chuẩn của một ván multiplayer như sau:

1. Chủ phòng tạo room ở trạng thái `WAITING`; client đăng ký lobby channel và polling fallback.
2. Người chơi khác gọi `POST /api/rooms/:roomId/join`. RPC `join_room` chọn ghế trống theo `seat_index` bất kể room đang `WAITING` hay `RUNNING`.
3. Nếu còn ghế, response trả `mode: PLAYER`, `seatIndex` và `activeSessionId` nếu session đang chạy. Nếu không còn ghế, response trả `mode: SPECTATOR`.
4. Khi chủ phòng start, backend tạo hoặc lấy session `PLAYING`, khởi tạo engine và cập nhật room thành `RUNNING`.
5. Client nhận `activeSessionId` hoặc event Realtime rồi điều hướng vào cùng `/game/:sessionId`.
6. Khi người thật vào một phòng đang đấu máy và còn ghế, backend gọi `engine.addPlayer()` và thay slot `AI_*` bằng user thật trong `current_state`.
7. Mỗi action được backend kiểm tra role, membership, lượt, payload và luật game. Session update có điều kiện `updated_at`; client thua concurrency sẽ nhận lỗi stale và tự đồng bộ lại.
8. Khi hết ghế, client vẫn được xem state, participant và action log nhưng không thể gửi action. Đây là spectator read-only ở cả hai lớp.

Nếu Realtime chưa bật hoặc publication chưa được áp dụng, polling fallback vẫn giúp lobby và arena cập nhật, nhưng production vẫn phải chạy đúng SQL bundle để đạt độ trễ và tính nhất quán tốt nhất.

## Auth, role và bảo mật

LuNu dùng Supabase Auth cho session người dùng. Backend lấy user từ bearer token, sau đó kiểm tra membership và role trước các thao tác nhạy cảm.

| Role | Quyền chính |
|---|---|
| `USER` | Đăng nhập, profile, tạo/join/leave room, chơi game và xem wallet của chính mình. |
| `ADMIN` | Quản lý user, room và thao tác wallet theo policy. |
| `SUPER_ADMIN` | Quyền quản trị cao nhất; được bảo vệ khỏi thao tác xóa user thông thường. |

Các nguyên tắc bắt buộc:

- Không đưa `SUPABASE_SERVICE_ROLE_KEY` vào Vite hoặc browser bundle.
- Không tin `isPlayer` từ frontend; backend luôn kiểm tra `game_room_players` trước action.
- Không dùng client-side winner, client-side balance hoặc client-side AI result làm dữ liệu chính thức.
- Không xóa user hiện tại hoặc `SUPER_ADMIN` từ admin UI.
- Không chạy migration phá dữ liệu trên production nếu chưa backup.

## Avatar Storage

Avatar được lưu ở bucket Supabase Storage `avatars`, còn database chỉ lưu URL/path metadata. Quy ước đặt tên:

```text
<user_id>/avatar-<username>-<timestamp>-<short-uuid>.<extension>
```

Flow thay avatar:

1. Frontend upload object mới trực tiếp lên Storage bằng session người dùng.
2. Frontend cập nhật `profiles.avatar_url` và `profiles.avatar_path`.
3. Khi cập nhật thành công, object cũ được xóa.
4. Nếu cập nhật profile thất bại, object mới được rollback để tránh rác Storage.

Mọi tính năng hình ảnh mới phải dùng quy tắc **username + timestamp + mã unique**, đồng thời xóa object cũ sau khi object mới đã được lưu thành công. Không lưu byte ảnh trực tiếp vào PostgreSQL.

Backend vẫn giữ endpoint multipart tương thích cho client/API cũ. Nếu `@fastify/multipart` chưa có trong `node_modules`, flow avatar trực tiếp qua Supabase Storage vẫn là flow khuyến nghị; chạy `npm install` để bật đầy đủ endpoint multipart.

## Wallet và audit

Wallet gồm số dư hiện tại và bảng `wallet_transactions` làm audit trail. Các thay đổi wallet admin phải đi qua backend guard, ghi lý do và tạo transaction record. RPC `process_wallet_transaction` là đường chính; service có fallback tương thích cho database cũ nhưng production vẫn nên chạy migration mới nhất để có atomic transaction đầy đủ.

Không hiển thị số dư demo hoặc tự cộng xu ở frontend. Mọi thay đổi balance phải đến từ response backend và được audit trong database.

## Game engine contract

Engine được registry theo `gameId` và tuân theo contract server-authoritative:

```ts
initialize(players, config)
addPlayer?(state, playerId)
validateAction(state, action, playerId)
applyAction(state, action, playerId)
getPublicState(state, viewerId)
calculateResult(state)
getAiAction?(state, playerId, difficulty)
```

`getPublicState()` phải che hand/bài kín của người khác. `validateAction()` phải kiểm tra tối thiểu session phase, active player, quyền player, payload và luật game. `applyAction()` không được tin dữ liệu do client tự tính. `getAiAction()` chỉ được gọi cho player ID dạng AI trong session đấu máy.

Khi thêm game mới, cần cập nhật đồng thời catalog metadata frontend, engine backend, registry, hướng dẫn chơi, min/max player, phí và migration seed nếu game cần xuất hiện trong lobby.

## Cấu trúc repository

```text
LuNu_BoardGame/
├── backend/
│   ├── src/
│   │   ├── infrastructure/supabase/     # Supabase admin/client setup
│   │   ├── middleware/                  # auth và request guards
│   │   ├── modules/
│   │   │   ├── admin/                   # admin controller/routes
│   │   │   ├── auth/                    # auth/profile/avatar
│   │   │   ├── chat/                    # room chat
│   │   │   ├── games/                   # registry, engines, sessions
│   │   │   ├── rooms/                   # room lifecycle và seating
│   │   │   └── wallet/                  # wallet và transaction audit
│   │   ├── shared/                      # errors, storage naming, helpers
│   │   └── index.ts                     # Fastify bootstrap
│   └── supabase/
│       ├── migrations/                  # migration source of truth
│       ├── LuNuBoardGame_FULL_SCHEMA.sql# bundle copy/paste Supabase
│       └── README.md
├── frontend/
│   ├── src/
│   │   ├── components/                  # Toast, Confirm, shared UI
│   │   ├── data/games.ts                # game metadata và rules copy
│   │   ├── features/                    # auth, home, rooms, arena, profile, admin
│   │   ├── services/                    # Axios API và Supabase client
│   │   ├── stores/                      # auth, room, game, UI state
│   │   └── router/index.ts              # route và auth guards
│   └── package.json
├── ASSETS.md
├── PLAN.md
├── STRUCTURE.md
└── README.md
```

## API chính

Tất cả endpoint backend được mount dưới `/api`.

| Method | Endpoint | Mục đích |
|---|---|---|
| `GET` | `/auth/me` | Khôi phục user/session hiện tại. |
| `PATCH` | `/auth/profile` | Cập nhật username/display name/avatar metadata. |
| `POST` | `/auth/profile/avatar` | Multipart avatar endpoint tương thích. |
| `GET` | `/rooms` | Lobby, gồm room WAITING và RUNNING. |
| `POST` | `/rooms` | Tạo room. |
| `GET` | `/rooms/:id` | Room detail, player và spectator metadata. |
| `POST` | `/rooms/:id/join` | Nhận PLAYER nếu còn ghế, nếu không thì SPECTATOR. |
| `POST` | `/rooms/:id/leave` | Rời room và giải phóng ghế. |
| `DELETE` | `/rooms/:id` | Owner/admin xóa room. |
| `POST` | `/sessions/room/:roomId/start` | Chủ phòng start session. |
| `GET` | `/sessions/room/:roomId/active` | Lấy active session và quyền viewer. |
| `GET` | `/sessions/:sessionId` | Lấy public session state. |
| `POST` | `/sessions/:sessionId/action` | Gửi action được engine kiểm tra. |
| `POST` | `/wallet/admin/modify` | Admin điều chỉnh wallet có audit. |
| `DELETE` | `/admin/users/:id` | Admin xóa user với safeguard. |

Tên route thực tế có thể được đối chiếu trong `backend/src/modules/*/*.routes.ts` và controller tương ứng.

## Kiểm thử và release

Type-check backend:

```bash
cd backend
./node_modules/.bin/tsc --pretty false
```

Type-check frontend:

```bash
cd frontend
./node_modules/.bin/vue-tsc --noEmit --pretty false
```

Production build:

```bash
cd frontend
npm run build

cd ../backend
npm run build
```

Smoke test engine nên kiểm tra tối thiểu:

- Người chơi thứ hai vào phòng RUNNING nhận đúng ghế và xuất hiện trong `current_state.players`.
- Spectator không thể gửi action dù frontend bị bypass.
- Hai action cạnh tranh không ghi đè nhau.
- Không tạo hai session `PLAYING` cho một room.
- Tiến lên kiểm tra combo/chặn/pass.
- Phỏm giữ lượt sau khi rút cho tới khi discard.
- Blackjack xử lý Ace 1/11.
- Poker mở đúng flop/turn/river.
- Chess/Cờ tướng từ chối quân sai màu, ô ngoài bàn và đường đi bị chặn.
- Mèo nổ yêu cầu Defuse khi rút Bomb.

Một release hợp lệ cần có migration source, SQL bundle được tái tạo, build frontend/backend thành công, `git diff --check` không lỗi và repository không chứa secret.

## Troubleshooting

### Người chơi thứ hai vẫn ở ngoài phòng khi chủ phòng start

Hãy kiểm tra bốn điểm sau:

1. Cả hai máy đã pull đúng commit mới nhất.
2. Đã chạy lại `backend/supabase/LuNuBoardGame_FULL_SCHEMA.sql` trong đúng Supabase project.
3. Lobby và room đang dùng cùng `VITE_SUPABASE_URL`, còn backend dùng cùng `SUPABASE_URL`.
4. Backend đã restart sau khi cài dependency và frontend đã reload sau build mới.

Trong log backend, join thành công phải trả `mode: PLAYER` và có `activeSessionId` khi session đã chạy. Nếu room đã kín, `mode: SPECTATOR` là hành vi đúng.

### Lỗi `record "existing_record" has no field "id"`

Database đang dùng phiên bản cũ của RPC `join_room`. Chạy lại toàn bộ SQL bundle, đặc biệt migration seating có phiên bản dùng `EXISTS` thay vì truy cập field không tồn tại.

### Lỗi avatar `415 Unsupported Media Type`

Chạy `npm install` trong backend để đồng bộ `@fastify/multipart`. Flow frontend hiện khuyến nghị upload trực tiếp bucket `avatars`; kiểm tra Storage bucket, Storage policies và `VITE_SUPABASE_ANON_KEY` nếu upload trực tiếp thất bại.

### Lỗi wallet admin `500`

Kiểm tra migration wallet/RPC đã được chạy chưa, xem log backend để lấy mã lỗi cụ thể và đảm bảo request có role `ADMIN` hoặc `SUPER_ADMIN`. Không sửa trực tiếp số dư bằng frontend.

### Reload bị văng về login

Kiểm tra Supabase Auth session ở browser, `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` và API base URL. Auth store có cơ chế initialize/refresh/retry; không nên xóa local session giữa lúc đang có request.

## Roadmap

| Giai đoạn | Mục tiêu |
|---|---|
| **R1 — Multiplayer stability** | Hoàn thiện integration test cho join RUNNING, leave/re-seat, reconnect và duplicate start. |
| **R2 — Card rules** | Tách engine chuyên biệt cho Texas Hold’em evaluator/side pot, Phỏm scoring, Mậu binh arrangement, Xì dách dealer flow và Ma Sói role system mở rộng. |
| **R3 — Board rules** | Bổ sung check/checkmate, castling, promotion, en passant cho Chess; tướng đối mặt, luật cung/sông và checkmate cho Cờ tướng. |
| **R4 — Economy safety** | Entry fee, escrow, settlement transaction, idempotency key, ledger reconciliation và audit dashboard trước khi có tiền thật. |
| **R5 — Quality** | Unit/property tests cho từng engine, load test Realtime, observability, structured logs, rate limit và CI/CD. |

## Đóng góp

Trước khi mở pull request, hãy đọc [`STRUCTURE.md`](./STRUCTURE.md), [`PLAN.md`](./PLAN.md) và migration hiện hữu. Một thay đổi feature nên đi theo thứ tự: cập nhật schema nếu cần, cập nhật backend service/controller, cập nhật engine contract hoặc registry, cập nhật Pinia/UI, thêm test/smoke test, tái tạo SQL bundle và chạy build cả hai workspace.

Không gửi secret, service-role key, file `.env`, dữ liệu người dùng thật hoặc dump database vào commit. Các thay đổi destructive phải có migration riêng, mô tả rollback và xác nhận dữ liệu trước khi triển khai.

## License và vận hành

Repository hiện là dự án riêng của chủ sở hữu. Hãy bổ sung license chính thức trước khi phát hành công khai hoặc nhận đóng góp bên ngoài. Môi trường production cần cấu hình HTTPS, secret manager, backup Supabase, monitoring, rate limit và policy vận hành riêng trước khi dùng với tiền hoặc phần thưởng có giá trị.

## References

[1]: https://vuejs.org/guide/introduction.html "Vue.js Guide"
[2]: https://fastify.dev/docs/latest/ "Fastify Documentation"
[3]: https://supabase.com/docs "Supabase Documentation"
[4]: https://www.typescriptlang.org/docs/ "TypeScript Documentation"
[5]: https://vite.dev/guide/ "Vite Guide"
