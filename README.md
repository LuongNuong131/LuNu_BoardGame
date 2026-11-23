# LuNu BoardGame

> **Nền tảng board game và card game multiplayer realtime** dành cho những ván chơi có nhịp độ tốt, luật rõ ràng và trải nghiệm cao cấp.

[![Frontend](https://img.shields.io/badge/frontend-Vue%203-42b883?logo=vue.js&logoColor=white)](./frontend)
[![Backend](https://img.shields.io/badge/backend-Fastify%20%2B%20TypeScript-111827?logo=fastify&logoColor=white)](./backend)
[![Database](https://img.shields.io/badge/database-Supabase-3ecf8e?logo=supabase&logoColor=white)](./backend/supabase)
[![Realtime](https://img.shields.io/badge/realtime-Supabase%20Realtime-3ecf8e)](./backend/supabase/LuNuBoardGame_FULL_SCHEMA.sql)

LuNu BoardGame là một hệ thống chơi game nhiều người được xây dựng theo hướng **server-authoritative**. Frontend Vue chịu trách nhiệm hiển thị và tương tác; backend Fastify kiểm tra quyền, luật, lượt chơi và kết toán; Supabase cung cấp Auth, PostgreSQL, Realtime và Storage. Mục tiêu của kiến trúc này là để mọi client nhìn thấy cùng một session, mọi action được kiểm chứng ở server và spectator không thể gửi nước đi giả.

LuNu có 15 trò trong sảnh luyện tập `/practice`. Sảnh này chạy các engine trong trình duyệt với đối thủ máy và không cần tài khoản. Bàn trực tuyến dùng cùng luật, đọc dữ liệu của từng người qua API và phát tín hiệu cập nhật từ Supabase.

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
| **Lobby** | Mặc định hiển thị tất cả game, lọc theo thể loại, phí, số người và trạng thái phòng. Phòng `WAITING` và `RUNNING` đều xuất hiện. Bàn đang chơi cho phép theo dõi và giữ ghế cho ván kế tiếp. |
| **Room seating** | Ghế `PLAYER` được ưu tiên cho người thật. Khi hết ghế, người mới vào `SPECTATOR`. Người chơi có thể trả ghế. Ván hiện tại dừng nếu ghế đó đang tham gia. |
| **Realtime** | Lobby, ghế, chat, session state, action log và trạng thái kết nối được đồng bộ qua Supabase Realtime, kèm polling fallback khi channel lỗi hoặc timeout. |
| **Session** | Mỗi phòng chỉ có một session `PLAYING` theo unique partial index. Start và action dùng optimistic concurrency để tránh tạo ván trùng hoặc ghi đè nước đi. |
| **AI tùy chọn** | AI không thay thế người thật. Chỉ khi chủ phòng chọn đấu máy, backend mới tạo AI slot; người thật vào sau có thể tiếp quản ghế máy ở bàn cờ miễn phí. |
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

| Trò chơi | Luật đang chạy |
|---|---|
| UNO | Đánh theo số hoặc màu, đổi màu, lá phạt, đảo chiều, rút rồi quyết định đánh hay qua lượt, hô UNO. |
| Ma Sói | Chia vai kín, hành động đêm, thảo luận theo giờ, bỏ phiếu, tiên tri, bảo vệ, phù thủy và thợ săn. |
| Tiến lên miền Nam | 13 lá mỗi người, lá mở màn, chặn theo chất, đôi thông, chặt heo, bỏ một vòng và xếp hạng về bài. |
| Blackjack | Mỗi tay đấu với nhà cái tự động, luật Át, blackjack tự nhiên, quắc và hòa. |
| Phỏm | Rút hoặc ăn lá bỏ, khóa phỏm đã ăn, đánh rác, ù và tính điểm các lá rác cuối ván. |
| Xì dách | Ghế đầu làm cái, so từng tay, xì bàn, xì dách, ngũ linh và quắc. |
| Poker | Một tay Texas Hold’em với blind 10/20, 1.000 chip đầu ván, tố, tất tay, bộ 5 lá mạnh nhất và pot phụ. |
| Mậu binh | Xếp chi 3–5–5, so thứ tự để phát hiện binh lủng, tính điểm từng cặp người chơi và sập ba chi. |
| Bài cào | Ba lá, điểm hàng đơn vị và đồng thắng khi bằng điểm. |
| Liêng | Ante, theo, tố, úp và so sáp, liêng, ảnh rồi điểm hàng đơn vị. |
| Cờ vua | Chiếu, chiếu hết, nhập thành, bắt tốt qua đường, phong cấp, hòa do lặp thế hoặc hết nước. |
| Cờ tướng | Chân mã, mắt tượng, cung, sông, pháo, lộ mặt tướng và kết thúc khi không còn nước hợp lệ. Luật hòa của LuNu dùng lặp ba lần hoặc giới hạn 300 nước. |
| Cờ cá ngựa | Bốn quân mỗi người, xuất quân với 1 hoặc 6, đá quân, thêm lượt khi đi được mặt 6 và về đích đúng số bước. |
| Cờ tỷ phú | Biến thể Thành phố LuNu có mua đất, nâng cấp, tiền thuê, phá sản và so tài sản sau 20 vòng. |
| Mèo nổ | Biến thể LuNu có lá Xáo bài, Bỏ lượt và Gỡ bom. Người chơi chọn vị trí cài lại bom, người sống cuối cùng thắng. |

Engine được đăng ký trong [init-games.ts](./backend/src/modules/games/core/init-games.ts).

## Yêu cầu hệ thống

| Thành phần | Khuyến nghị |
|---|---|
| Node.js | Node.js 24 LTS. |
| npm | Đi kèm Node.js, dùng được cho workflow Windows. |
| Git | Để clone, pull và theo dõi migration. |
| Supabase project | Bật Auth, PostgreSQL, Realtime và Storage. |
| Browser | Chromium, Edge hoặc Firefox phiên bản hiện đại. |

Repository không có root `package.json`; frontend và backend là hai workspace độc lập, mỗi workspace có `package.json` và lockfile riêng.

## Cài đặt nhanh

```bash
git clone https://github.com/LuongNuong131/LuNu_BoardGame.git
cd LuNu_BoardGame

npm ci --prefix backend
npm ci --prefix frontend
```

Trên Windows PowerShell, các lệnh trên có thể chạy trong hai terminal riêng. Không commit `.env`, service-role key hoặc bất kỳ secret nào vào Git.

Mở sảnh luyện tập với `npm --prefix frontend run dev` rồi vào `http://localhost:5173/practice`. Hai workspace đều cần cài dependency vì frontend luyện tập nhập các engine TypeScript từ backend.

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
backend/supabase/migrations/202611230000_session_lifecycle.sql
```

Bundle được thiết kế theo hướng idempotent cho việc cài đặt lại. Nó bao gồm bảng profile, wallet, game catalog, room, seating, chat, game session, RLS, Realtime publication, wallet RPC, Storage bucket `avatars`, Storage policies và unique index chống nhiều session `PLAYING` trong cùng một room.

Sau khi sửa bất kỳ migration nào, phải tái tạo bundle trước khi giao cho người dùng:

```bash
cd backend
cat supabase/migrations/*.sql > supabase/LuNuBoardGame_FULL_SCHEMA.sql
```

Với database đã cài ba migration đầu, áp dụng `202611230000_session_lifecycle.sql` trước khi chạy backend mới. Với database mới, dùng toàn bộ bundle. Nếu tài khoản quản trị được tạo bằng mật khẩu mẫu của script cũ, hãy đổi mật khẩu đang dùng. Script mới đọc `LUNU_ADMIN_PASSWORD` từ môi trường.

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
| `/practice` | Sảnh luyện tập công khai với 15 trò chơi. |
| `/login` | Đăng nhập; đăng ký đang được ẩn theo yêu cầu sản phẩm. |
| `/` | Home/dashboard. |
| `/rooms` | Lobby tất cả game. |
| `/room/:id` | Room detail, seating, chat và hướng dẫn game. |
| `/game/:sessionId` | Live arena của session. |
| `/profile` | Profile và avatar lifecycle. |
| `/wallet-history` | Lịch sử giao dịch wallet. |
| `/admin` | Admin dashboard, yêu cầu role phù hợp. |

## Luồng multiplayer realtime

- Chủ bàn bắt đầu khi đủ số người của trò chơi. Thành viên được xếp theo số ghế. PostgreSQL khóa phòng, xác nhận lại danh sách ghế và tạo tối đa một ván đang chạy.
- Người đến muộn có thể theo dõi ván hiện tại và giữ ghế cho ván sau. Ở bàn cờ miễn phí, người vào ghế trống có thể thay máy và giữ nguyên thế cờ.
- API kiểm tra ghế, lượt, phiên bản và luật trước khi ghi nước đi. Kênh `game_session_signals` chỉ phát mã phiên, mã phòng, trạng thái và thời điểm cập nhật. Client lấy bài, vai và quyền hành động đã lọc qua API.
- Client đồng bộ định kỳ mỗi 2,5 giây khi cần và bỏ qua bản trạng thái cũ. Khi người đang chơi trả ghế, ván dừng và phòng mở lại.
- Phòng thu phí bằng xu ảo khi bắt đầu, trả pot theo người thắng, chia pot nếu có nhiều người thắng và hoàn phí khi ván bị hủy hoặc không có người thắng nhận pot. Chip Poker và Liêng chỉ tồn tại trong ván.

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

```bash
npm --prefix backend test
npm --prefix backend run build
npm --prefix frontend run build
```

Bộ test chạy cả 15 engine đến kết quả. Các ca riêng kiểm tra nước cờ hợp lệ, tay Poker, ẩn bài, xếp chi, thông tin riêng của Ma Sói và Tiến lên. Kiểm thử SQL chạy bundle hai lần trên PostgreSQL nhúng, tạo phòng, giữ ghế, đăng ký tín hiệu Realtime, chặn tạo ván trùng và đối soát thu, thưởng, hoàn phí.

Kiểm thử Supabase staging cần hai người chơi và một người xem để xác nhận đăng nhập, nước đi, tín hiệu Realtime, kết nối lại và rời bàn qua API.

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

- Kiểm tra nhiều tài khoản trên một dự án Supabase staging và đo tải Realtime.
- Bổ sung các luật thi đấu chưa có trong phiên bản LuNu, gồm khiếu nại lặp thế ở cờ tướng, gửi bài ở Phỏm, các lựa chọn split/double ở Blackjack và vòng nhiều tay với nút cái luân phiên ở Poker.
- Thêm lịch sử thành tích người chơi và bảng xếp hạng sau khi thống nhất tiêu chí chấm.
- Xác minh giao diện theo trình duyệt và kích thước màn hình trước khi phát hành.

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
