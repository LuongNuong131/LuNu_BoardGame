# LuNu Supabase setup

LuNu uses Supabase Auth plus the public tables `profiles`, `wallets`, `wallet_transactions`, `games`, `game_rooms`, `game_room_players`, `game_sessions`, and `chat_messages`.

Bạn có thể chạy nhanh bằng cách mở file `backend/supabase/LuNuBoardGame_FULL_SCHEMA.sql`, copy toàn bộ nội dung rồi paste vào Supabase Dashboard → SQL Editor → Run. Nếu dùng Supabase CLI, chạy `supabase db push` sau khi đặt các migration vào thư mục migrations.

Thứ tự migration theo tên tệp trong `migrations/`. Với database đã chạy `202611230000_session_lifecycle.sql`, áp dụng `202611240000_match_results.sql` để bật lịch sử và xếp hạng.

Migration mới lưu kết quả tối giản cho từng người khi ván kết thúc và nhập lại những ván còn dữ liệu phiên. Dòng kết quả còn lại sau khi xóa phòng và bị xóa khi xóa tài khoản tương ứng. Bảng kết quả và RPC đọc chỉ cấp quyền cho backend. Client gọi `/api/results` bằng token đăng nhập.

## Avatar Storage lifecycle

Bucket `avatars` là public-read nhưng chỉ user đã đăng nhập mới được ghi/xóa trong thư mục có prefix UUID của chính họ. Backend tạo path theo quy ước:

```text
<user_id>/avatar-<username>-<timestamp>-<short-uuid>.<extension>
```

Khi upload thành công, backend cập nhật `profiles.avatar_url` và `profiles.avatar_path`, sau đó xóa object cũ. Nếu cập nhật profile thất bại, object mới cũng được rollback. Quy ước `kind-username-timestamp` phải được dùng cho mọi tính năng hình ảnh mới để tránh tràn Storage.

## Environment và backend

Backend phải nhận `SUPABASE_URL` và `SUPABASE_SERVICE_ROLE_KEY` qua environment. Browser chỉ nhận `VITE_SUPABASE_URL` và `VITE_SUPABASE_ANON_KEY`. Không commit secret nào.

Nếu chạy bằng npm trên Windows, luôn cài dependency trước khi chạy dev:

```bash
cd backend
npm install
npm run dev
```

`@fastify/multipart` phục vụ endpoint upload avatar. Backend có thể nhận thêm `SUPABASE_ANON_KEY` cho luồng đăng nhập. Nếu thiếu, backend dùng khóa đã cấu hình trên một client riêng cho lần đăng nhập.

Các endpoint profile là `PATCH /api/auth/profile` và `POST /api/auth/profile/avatar` (multipart field `avatar`). Room owner/admin có thể gọi `DELETE /api/rooms/:id`. Admin có thể xóa user bằng `DELETE /api/admin/users/:id`; self-delete và xóa `SUPER_ADMIN` bị chặn.

Nếu database cũ chưa chạy migration seating, room service vẫn có fallback tạm thời. Tuy nhiên để loại bỏ hoàn toàn lỗi `record "existing_record" has no field "id"`, bắt buộc chạy lại SQL bundle để thay function `join_room` bằng bản dùng `EXISTS`.

## Engine

Backend khởi tạo UNO bằng `UnoEngine` và các catalog còn lại bằng engine classes riêng: `WerewolfEngine`, `TienLenEngine`, `BlackjackEngine`, `PhomEngine`, `XiDachEngine`, `PokerEngine`, `MauBinhEngine`, `BaoCaoEngine`, `LiengEngine`, `ChessEngine`, `ChineseChessEngine`, `LudoEngine`, `MonopolyEngine`, và `ExplodingKittensEngine`. Chúng dùng chung contract server-authoritative `initialize → validateAction → applyAction → getPublicState → calculateResult`, che bài kín và phát event cho session Realtime.

Lưu ý production: engine catalog hiện cung cấp vòng chơi server-authoritative có thể khởi tạo, nhận lượt, bài kín, cược/bỏ lượt, xúc xắc, vote và kết quả cho toàn bộ catalog. Các luật thi đấu chuyên sâu như full Texas Hold’em betting streets, luật nước đi hoàn chỉnh của cờ vua/cờ tướng, scoring Phỏm/Mậu binh và AI mạnh theo cấp độ vẫn nên được tinh chỉnh riêng trước khi mở xếp hạng hoặc tiền thật.
