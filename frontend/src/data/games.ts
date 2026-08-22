export type GameCategory = 'cards' | 'board' | 'social';

export interface GameDefinition {
  id: string;
  name: string;
  shortName: string;
  category: GameCategory;
  icon: string;
  accent: string;
  description: string;
  players: string;
  minPlayers: number;
  maxPlayers: number;
  duration: string;
  difficulty: string;
  fee: string;
  rules: string[];
  howToPlay: string[];
  featured?: boolean;
  aiModes?: string[];
}

export const GAME_CATALOG: GameDefinition[] = [
  {
    id: 'WEREWOLF', name: 'Ma Sói', shortName: 'Ma Sói', category: 'social', icon: 'bi-moon-stars-fill', accent: '#9c7bff',
    description: 'Đọc vị, thuyết phục và sống sót qua từng đêm.', players: '6–18 người', minPlayers: 6, maxPlayers: 18, duration: '25–40 phút', difficulty: 'Chiến thuật', fee: 'Phí bàn + pot thưởng', featured: true,
    rules: ['Quản trò điều phối đêm và ngày.', 'Vai trò được phát kín, không chia sẻ thông tin ngoài luật.', 'Người sống cuối cùng của phe thắng nhận pot.'],
    howToPlay: ['Nhận vai trò bí mật và làm theo năng lực trong đêm.', 'Ban ngày thảo luận, bỏ phiếu treo một người.', 'Hoàn thành mục tiêu phe của bạn trước khi bị loại.']
  },
  {
    id: 'TIEN_LEN', name: 'Tiến lên', shortName: 'Tiến lên', category: 'cards', icon: 'bi-suit-spade-fill', accent: '#58c7b0',
    description: 'Bài tiến lên miền Nam nhịp nhanh, luật rõ ràng.', players: '2–4 người', minPlayers: 2, maxPlayers: 4, duration: '8–15 phút', difficulty: 'Phổ thông', fee: 'Cược ván', featured: true,
    rules: ['Mỗi người bắt đầu với 13 lá.', 'Đánh bộ lớn hơn cùng loại hoặc bỏ lượt.', 'Hết bài trước là người thắng ván.'],
    howToPlay: ['Chọn một lá hoặc một bộ hợp lệ để đánh.', 'Chặn lượt đối thủ bằng bộ mạnh hơn.', 'Quản lý heo, hàng và lượt cuối để về nhất.']
  },
  {
    id: 'BLACKJACK', name: 'Blackjack', shortName: 'Blackjack', category: 'cards', icon: 'bi-diamond-fill', accent: '#f5bb5b',
    description: 'Chạm 21 gần nhất, không vượt quá 21.', players: '1–5 người', minPlayers: 1, maxPlayers: 5, duration: '5–10 phút', difficulty: 'Dễ vào bàn', fee: 'Cược tay', featured: true,
    rules: ['Người chơi đấu với nhà cái.', 'Blackjack tự nhiên trả theo cấu hình bàn.', 'Quá 21 là thua ngay.'],
    howToPlay: ['Chọn Hit để rút thêm hoặc Stand để dừng.', 'So tổng điểm với nhà cái khi nhà cái mở bài.', 'Bàn tiền hiển thị rõ mức cược, thắng và hoàn trả.']
  },
  {
    id: 'PHOM', name: 'Phỏm', shortName: 'Phỏm', category: 'cards', icon: 'bi-stack', accent: '#df7fa6',
    description: 'Ăn bài, gửi bài và hạ phỏm thật khéo.', players: '2–4 người', minPlayers: 2, maxPlayers: 4, duration: '12–20 phút', difficulty: 'Chiến thuật', fee: 'Cược ván', featured: true,
    rules: ['Mỗi người có 9 lá, người đi đầu có 10 lá.', 'Tạo phỏm đồng hạng hoặc dây đồng chất.', 'Tính điểm bài rác sau khi hạ.'],
    howToPlay: ['Rút hoặc ăn lá vừa đánh tùy tình huống.', 'Đánh một lá rác sau mỗi lượt.', 'Hạ phỏm, gửi bài và tối ưu điểm rác.']
  },
  {
    id: 'XI_DACH', name: 'Xì dách', shortName: 'Xì dách', category: 'cards', icon: 'bi-fire', accent: '#ed8d56',
    description: 'Bàn cái luân phiên, luật riêng theo bàn 4 người.', players: '2–4 người', minPlayers: 2, maxPlayers: 4, duration: '8–12 phút', difficulty: 'Phổ thông', fee: 'Cược tay',
    rules: ['Bàn 4 người có thể chọn một người làm cái.', 'Trong trận, quyền làm cái có thể đổi sau mỗi ván.', 'Người cái đối đầu lần lượt với các tay còn lại.'],
    howToPlay: ['Chọn làm cái khi phòng đủ người hoặc nhận quyền cái từ ván trước.', 'Rút bài để đạt điểm mục tiêu, tránh quắc.', 'Kết toán riêng từng tay với nhà cái.']
  },
  {
    id: 'POKER', name: 'Poker', shortName: 'Poker', category: 'cards', icon: 'bi-circle-square', accent: '#8ba7ff',
    description: 'Bàn cược Texas Hold’em với nhịp độ chuyên nghiệp.', players: '2–9 người', minPlayers: 2, maxPlayers: 9, duration: '15–45 phút', difficulty: 'Nâng cao', fee: 'Blind + rake',
    rules: ['Small blind và big blind xoay theo vị trí.', 'Mỗi tay có flop, turn, river.', 'Bàn hiển thị pot, blind và lịch sử hành động.'],
    howToPlay: ['Đặt cược, theo, tố hoặc bỏ bài đúng lượt.', 'Tạo bộ 5 lá mạnh nhất từ 2 lá tẩy và 5 lá chung.', 'Người còn lại cuối cùng hoặc tay mạnh nhất nhận pot.']
  },
  {
    id: 'MAU_BINH', name: 'Mậu binh', shortName: 'Mậu binh', category: 'cards', icon: 'bi-grid-3x3-gap-fill', accent: '#b879ef',
    description: 'Xếp 13 lá thành ba chi, cân não ở từng vị trí.', players: '2–4 người', minPlayers: 2, maxPlayers: 4, duration: '8–15 phút', difficulty: 'Nâng cao', fee: 'Cược ván',
    rules: ['Xếp chi đầu 3 lá, chi giữa và chi cuối 5 lá.', 'Chi trước phải yếu hơn chi sau.', 'So từng chi và tính điểm thắng thua.'],
    howToPlay: ['Kéo thả 13 lá vào ba chi.', 'Kiểm tra không binh lủng trước khi gửi.', 'Đọc thế bài đối thủ qua lịch sử kết quả, không qua bài kín.']
  },
  {
    id: 'BAO_CAO', name: 'Bài cào', shortName: 'Bài cào', category: 'cards', icon: 'bi-three-dots', accent: '#60d8ac',
    description: 'Một vòng nhanh, gọn và minh bạch.', players: '2–6 người', minPlayers: 2, maxPlayers: 6, duration: '2–5 phút', difficulty: 'Rất dễ', fee: 'Cược vòng',
    rules: ['Mỗi người nhận ba lá.', 'Tính điểm theo hàng đơn vị.', 'Bằng điểm ưu tiên theo chất/lá tùy cấu hình bàn.'],
    howToPlay: ['Chọn mức cược trong giới hạn của phòng.', 'Mở bài đồng thời khi đủ người.', 'Hệ thống tự động kết toán và cập nhật ví.']
  },
  {
    id: 'LIENG', name: 'Liêng', shortName: 'Liêng', category: 'cards', icon: 'bi-lightning-charge-fill', accent: '#f27d91',
    description: 'Bluff, tố và đọc nhịp bàn trong ba lá.', players: '2–6 người', minPlayers: 2, maxPlayers: 6, duration: '5–12 phút', difficulty: 'Tâm lý', fee: 'Blind + pot',
    rules: ['Mỗi tay nhận ba lá kín.', 'Người chơi có thể theo, tố hoặc úp.', 'So sánh bộ và điểm khi còn người trong pot.'],
    howToPlay: ['Quan sát nhịp cược và vị trí.', 'Chọn hành động có xác nhận trước khi gửi.', 'Pot và lịch sử cược được khóa theo từng vòng.']
  },
  {
    id: 'CHESS', name: 'Cờ vua', shortName: 'Cờ vua', category: 'board', icon: 'bi-bricks', accent: '#78b5f4',
    description: 'Đấu trí chuẩn quốc tế với máy hoặc người thật.', players: '2 người', minPlayers: 2, maxPlayers: 2, duration: '10–30 phút', difficulty: 'Xếp hạng', fee: 'Phí bàn tùy chọn', featured: true, aiModes: ['Dễ', 'Trung bình', 'Khó'],
    rules: ['Tuân theo luật cờ vua chuẩn.', 'Có đồng hồ và cảnh báo nước đi.', 'Có thể chọn máy theo ba cấp độ.'],
    howToPlay: ['Chọn ô quân muốn di chuyển rồi chọn ô đích.', 'Dùng đồng hồ để kiểm soát thời gian.', 'Chiếu hết, hòa hoặc hết giờ sẽ kết thúc ván.']
  },
  {
    id: 'CO_TUONG', name: 'Cờ tướng', shortName: 'Cờ tướng', category: 'board', icon: 'bi-columns-gap', accent: '#e1a860',
    description: 'Bàn cờ phương Đông cổ điển, đấu người hoặc máy.', players: '2 người', minPlayers: 2, maxPlayers: 2, duration: '15–40 phút', difficulty: 'Xếp hạng', fee: 'Phí bàn tùy chọn', featured: true, aiModes: ['Dễ', 'Trung bình', 'Khó'],
    rules: ['Tuân theo luật cờ tướng chuẩn.', 'Tướng không được lộ mặt.', 'Có lịch sử nước đi và tùy chọn đấu máy.'],
    howToPlay: ['Chọn quân và ô đích hợp lệ.', 'Bảo vệ tướng, kiểm soát trung lộ.', 'Chiếu bí hoặc đối thủ xin thua để giành chiến thắng.']
  },
  {
    id: 'CO_CA_NGUA', name: 'Cờ cá ngựa', shortName: 'Cá ngựa', category: 'board', icon: 'bi-emoji-smile-fill', accent: '#e8825d',
    description: 'Cuộc đua vui nhộn, hợp nhóm bạn và gia đình.', players: '2–4 người', minPlayers: 2, maxPlayers: 4, duration: '10–20 phút', difficulty: 'Thư giãn', fee: 'Phí bàn tùy chọn',
    rules: ['Tung xúc xắc để đưa quân ra chuồng.', 'Đưa đủ quân về đích trước để thắng.', 'Phòng hỗ trợ người xem khi bàn đủ chỗ.'],
    howToPlay: ['Bấm tung xúc xắc khi tới lượt.', 'Chọn quân hợp lệ để di chuyển.', 'Tận dụng nước ăn quân và về chuồng an toàn.']
  },
  {
    id: 'CO_TY_PHU', name: 'Cờ tỷ phú', shortName: 'Tỷ phú', category: 'board', icon: 'bi-buildings-fill', accent: '#67c7d9',
    description: 'Mua đất, xây tài sản và quản lý dòng tiền.', players: '2–6 người', minPlayers: 2, maxPlayers: 6, duration: '25–60 phút', difficulty: 'Chiến lược', fee: 'Phí bàn tùy chọn',
    rules: ['Mỗi người bắt đầu với vốn cơ bản.', 'Tiền thuê và giao dịch được hệ thống ghi nhận.', 'Phá sản hoặc cán đích tài sản theo luật phòng.'],
    howToPlay: ['Tung xúc xắc và di chuyển.', 'Mua ô đất, nâng cấp hoặc giao dịch.', 'Theo dõi tài sản ròng trong panel tài chính.']
  },
  {
    id: 'EXPLODING_KITTENS', name: 'Mèo nổ', shortName: 'Mèo nổ', category: 'social', icon: 'bi-stars', accent: '#f18cb4',
    description: 'Rút bài, né mèo nổ và phá kế hoạch đối thủ.', players: '2–5 người', minPlayers: 2, maxPlayers: 5, duration: '10–20 phút', difficulty: 'Vui nhộn', fee: 'Phí bàn tùy chọn',
    rules: ['Rút bài kết thúc lượt nếu không dùng lá khác.', 'Rút Mèo nổ sẽ bị loại nếu không có Defuse.', 'Người sống cuối cùng thắng.'],
    howToPlay: ['Dùng lá hành động để đổi nhịp bàn.', 'Theo dõi số lá còn lại và bluff hợp lý.', 'Giữ Defuse cho khoảnh khắc quyết định.']
  },
  {
    id: 'UNO', name: 'UNO', shortName: 'UNO', category: 'cards', icon: 'bi-palette-fill', accent: '#f06464',
    description: 'Ván bài màu sắc, nhịp nhanh và dễ vào cuộc.', players: '2–8 người', minPlayers: 2, maxPlayers: 8, duration: '8–15 phút', difficulty: 'Phổ thông', fee: 'Miễn phí hoặc cược ván',
    rules: ['Đánh cùng màu, cùng số hoặc lá đặc biệt.', 'Hô UNO khi còn một lá.', 'Hết bài trước là người thắng.'],
    howToPlay: ['Chọn lá hợp lệ trên tay.', 'Rút bài nếu không có nước đi.', 'Dùng Skip, Reverse, Draw Two và Wild đúng thời điểm.']
  }
];

export const GAME_BY_ID = Object.fromEntries(GAME_CATALOG.map((game) => [game.id, game])) as Record<string, GameDefinition>;

export const DEMO_ROOMS = [
  { id: 'demo-werewolf', name: 'Moonlit Society · Sảnh Bạch Kim', game_id: 'WEREWOLF', max_players: 12, entry_fee: 150, status: 'WAITING', occupied: 8, spectators: 3, ownerName: 'Linh Mộc', featured: true },
  { id: 'demo-poker', name: 'Midnight Hold’em · Table 07', game_id: 'POKER', max_players: 6, entry_fee: 500, status: 'RUNNING', occupied: 6, spectators: 9, ownerName: 'Khanh Vu', featured: true },
  { id: 'demo-chess', name: 'Rapid Arena · 10 phút', game_id: 'CHESS', max_players: 2, entry_fee: 0, status: 'WAITING', occupied: 1, spectators: 4, ownerName: 'An Khang', featured: false },
  { id: 'demo-xidach', name: 'Xì dách bàn cái luân phiên', game_id: 'XI_DACH', max_players: 4, entry_fee: 80, status: 'WAITING', occupied: 4, spectators: 5, ownerName: 'Mỹ Hạnh', featured: false },
  { id: 'demo-tienlen', name: 'Tiến lên · Phòng bạn hữu', game_id: 'TIEN_LEN', max_players: 4, entry_fee: 50, status: 'WAITING', occupied: 2, spectators: 0, ownerName: 'Tú Anh', featured: false },
  { id: 'demo-maubinh', name: 'Mậu binh · No tilt', game_id: 'MAU_BINH', max_players: 4, entry_fee: 200, status: 'WAITING', occupied: 3, spectators: 1, ownerName: 'Duy Minh', featured: false }
];

export const formatCoins = (value: number) => `${value.toLocaleString('vi-VN')} xu`;
