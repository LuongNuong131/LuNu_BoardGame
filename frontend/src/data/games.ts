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
    description: 'Đọc vị, thuyết phục và sống sót qua từng đêm.', players: '6–18 người', minPlayers: 6, maxPlayers: 18, duration: '25–40 phút', difficulty: 'Chiến thuật', fee: 'Phí phòng tùy chủ phòng', featured: true,
    rules: ['Vai được phát kín. Ban đêm Sói, Tiên tri, Bảo vệ và Phù thủy dùng năng lực.', 'Ban ngày thảo luận rồi bỏ phiếu. Phiếu hòa không loại ai trong luật mặc định.', 'Dân làng thắng khi loại hết Sói. Sói thắng khi còn đông bằng phe làng.'],
    howToPlay: ['Nhận vai trò bí mật và làm theo năng lực trong đêm.', 'Ban ngày thảo luận, bỏ phiếu treo một người.', 'Hoàn thành mục tiêu phe của bạn trước khi bị loại.']
  },
  {
    id: 'TIEN_LEN', name: 'Tiến lên', shortName: 'Tiến lên', category: 'cards', icon: 'bi-suit-spade-fill', accent: '#58c7b0',
    description: 'Bài tiến lên miền Nam nhịp nhanh, luật rõ ràng.', players: '2–4 người', minPlayers: 2, maxPlayers: 4, duration: '8–15 phút', difficulty: 'Phổ thông', fee: 'Cược ván', featured: true,
    rules: ['Mỗi người nhận 13 lá. Nước đầu có 3 bích hoặc lá nhỏ nhất đã chia.', 'Chặn bằng bộ mạnh hơn cùng loại, hoặc dùng hàng để chặt theo luật bàn.', 'Đã bỏ lượt thì chờ vòng tiếp. Hết bài sớm nhất về nhất.'],
    howToPlay: ['Chọn một lá hoặc một bộ hợp lệ để đánh.', 'Chặn lượt đối thủ bằng bộ mạnh hơn.', 'Quản lý heo, hàng và lượt cuối để về nhất.']
  },
  {
    id: 'BLACKJACK', name: 'Blackjack', shortName: 'Blackjack', category: 'cards', icon: 'bi-diamond-fill', accent: '#f5bb5b',
    description: 'Chạm 21 gần nhất, không vượt quá 21.', players: '1–5 người', minPlayers: 1, maxPlayers: 5, duration: '5–10 phút', difficulty: 'Dễ vào bàn', fee: 'Cược tay', featured: true,
    rules: ['Mỗi người so bài riêng với nhà cái. Nhà cái rút khi dưới 17.', 'Blackjack hai lá thắng 21 điểm có từ ba lá trở lên.', 'Quá 21 là thua. Bằng nhà cái thì hòa.'],
    howToPlay: ['Chọn Rút thêm hoặc Dừng bài.', 'Chờ nhà cái mở bài để xem kết quả từng tay.']
  },
  {
    id: 'PHOM', name: 'Phỏm', shortName: 'Phỏm', category: 'cards', icon: 'bi-stack', accent: '#df7fa6',
    description: 'Ăn bài, ghép phỏm và giảm điểm lá rác.', players: '2–4 người', minPlayers: 2, maxPlayers: 4, duration: '12–20 phút', difficulty: 'Chiến thuật', fee: 'Cược ván', featured: true,
    rules: ['Mỗi người có 9 lá, người đi đầu có 10 lá.', 'Tạo phỏm đồng hạng hoặc dây đồng chất.', 'Tính điểm bài rác sau khi hạ.'],
    howToPlay: ['Rút từ nọc hoặc dùng hai lá để ăn lá vừa đánh.', 'Đánh một lá rác để chuyển lượt.', 'Ù thắng ngay. Khi hết vòng, hệ thống xếp phỏm và tính điểm lá rác.']
  },
  {
    id: 'XI_DACH', name: 'Xì dách', shortName: 'Xì dách', category: 'cards', icon: 'bi-fire', accent: '#ed8d56',
    description: 'So từng tay với nhà cái, ưu tiên xì bàn, xì dách và ngũ linh.', players: '2–4 người', minPlayers: 2, maxPlayers: 4, duration: '8–12 phút', difficulty: 'Phổ thông', fee: 'Cược tay',
    rules: ['Ghế đầu làm cái và rút sau các tay còn lại.', 'Xì bàn hơn xì dách, xì dách hơn ngũ linh không quắc.', 'Kết toán từng tay với nhà cái.'],
    howToPlay: ['Rút bài để đạt điểm mục tiêu, tránh quắc.', 'Chờ nhà cái dừng và xem kết quả so bài.']
  },
  {
    id: 'POKER', name: 'Poker', shortName: 'Poker', category: 'cards', icon: 'bi-circle-square', accent: '#8ba7ff',
    description: 'Bàn cược Texas Hold’em với nhịp độ chuyên nghiệp.', players: '2–9 người', minPlayers: 2, maxPlayers: 9, duration: '15–45 phút', difficulty: 'Nâng cao', fee: 'Chip trong ván',
    rules: ['Mỗi người có 1.000 chip trong ván. Mức blind là 10 và 20.', 'Chọn bộ 5 lá mạnh nhất từ 2 lá tẩy và 5 lá chung.', 'Tất tay có thể tạo pot phụ. Tay ngang nhau chia phần pot đủ điều kiện.'],
    howToPlay: ['Đặt cược, theo, tố hoặc bỏ bài đúng lượt.', 'Tạo bộ 5 lá mạnh nhất từ 2 lá tẩy và 5 lá chung.', 'Người còn lại cuối cùng hoặc tay mạnh nhất nhận pot.']
  },
  {
    id: 'MAU_BINH', name: 'Mậu binh', shortName: 'Mậu binh', category: 'cards', icon: 'bi-grid-3x3-gap-fill', accent: '#b879ef',
    description: 'Xếp 13 lá thành ba chi, cân não ở từng vị trí.', players: '2–4 người', minPlayers: 2, maxPlayers: 4, duration: '8–15 phút', difficulty: 'Nâng cao', fee: 'Cược ván',
    rules: ['Xếp chi đầu 3 lá, chi giữa và chi cuối 5 lá.', 'Chi trước phải yếu hơn chi sau.', 'So từng chi và tính điểm thắng thua.'],
    howToPlay: ['Chọn chi rồi bấm từng lá để xếp.', 'Chi yếu hơn đặt trước. Binh lủng thua cả ba chi.', 'Khi mọi người chốt, hệ thống so từng chi. Thắng cả ba được nhân đôi điểm.']
  },
  {
    id: 'BAO_CAO', name: 'Bài cào', shortName: 'Bài cào', category: 'cards', icon: 'bi-three-dots', accent: '#60d8ac',
    description: 'Một vòng nhanh, gọn và minh bạch.', players: '2–6 người', minPlayers: 2, maxPlayers: 6, duration: '2–5 phút', difficulty: 'Rất dễ', fee: 'Cược vòng',
    rules: ['Mỗi người nhận ba lá. Lá J, Q và K tính 10 điểm.', 'Cộng điểm và lấy chữ số hàng đơn vị.', 'Ai có điểm cao nhất thắng. Bằng điểm thì đồng thắng.'],
    howToPlay: ['Chốt tay để báo sẵn sàng mở.', 'Xem điểm khi toàn bộ bàn đã chốt.']
  },
  {
    id: 'LIENG', name: 'Liêng', shortName: 'Liêng', category: 'cards', icon: 'bi-lightning-charge-fill', accent: '#f27d91',
    description: 'Bluff, tố và đọc nhịp bàn trong ba lá.', players: '2–6 người', minPlayers: 2, maxPlayers: 6, duration: '5–12 phút', difficulty: 'Tâm lý', fee: 'Blind + pot',
    rules: ['Mỗi người có ba lá kín và góp 10 chip đầu ván.', 'Chọn theo, tố, nhường hoặc úp tùy lượt cược.', 'Sáp hơn liêng, liêng hơn ảnh, sau đó so điểm hàng đơn vị.'],
    howToPlay: ['Quan sát nhịp cược và vị trí.', 'Chọn hành động có xác nhận trước khi gửi.', 'Pot và lịch sử cược được khóa theo từng vòng.']
  },
  {
    id: 'CHESS', name: 'Cờ vua', shortName: 'Cờ vua', category: 'board', icon: 'bi-bricks', accent: '#78b5f4',
    description: 'Đấu trí chuẩn quốc tế với máy hoặc người thật.', players: '2 người', minPlayers: 2, maxPlayers: 2, duration: '10–30 phút', difficulty: 'Chiến thuật', fee: 'Phí bàn tùy chọn', featured: true, aiModes: ['Dễ', 'Trung bình', 'Khó'],
    rules: ['Có nhập thành, bắt tốt qua đường và phong cấp.', 'Chiếu hết thắng. Hết nước hợp lệ khi không bị chiếu thì hòa.', 'Bàn luyện tập và bàn đấu máy có ba mức độ.'],
    howToPlay: ['Chọn một quân để xem các ô đích hợp lệ.', 'Chọn quân phong cấp khi tốt đến hàng cuối.']
  },
  {
    id: 'CO_TUONG', name: 'Cờ tướng', shortName: 'Cờ tướng', category: 'board', icon: 'bi-columns-gap', accent: '#e1a860',
    description: 'Bàn cờ phương Đông cổ điển, đấu người hoặc máy.', players: '2 người', minPlayers: 2, maxPlayers: 2, duration: '15–40 phút', difficulty: 'Chiến thuật', fee: 'Phí bàn tùy chọn', featured: true, aiModes: ['Dễ', 'Trung bình', 'Khó'],
    rules: ['Quân bị chặn theo luật chân mã, mắt tượng, pháo và giới hạn cung, sông.', 'Hai tướng không được đối mặt. Hết nước hợp lệ là thua.', 'Bàn xử hòa khi thế cờ lặp ba lần hoặc sau 300 nước.'],
    howToPlay: ['Chọn quân để xem các ô đích hợp lệ.', 'Chiếu bí hoặc chặn hết nước đối phương để thắng.']
  },
  {
    id: 'CO_CA_NGUA', name: 'Cờ cá ngựa', shortName: 'Cá ngựa', category: 'board', icon: 'bi-emoji-smile-fill', accent: '#e8825d',
    description: 'Cuộc đua vui nhộn, hợp nhóm bạn và gia đình.', players: '2–4 người', minPlayers: 2, maxPlayers: 4, duration: '10–20 phút', difficulty: 'Thư giãn', fee: 'Phí bàn tùy chọn',
    rules: ['Tung được 1 hoặc 6 để xuất quân. Đi được quân với mặt 6 thì được thêm lượt.', 'Quân không nhảy qua quân khác trên đường. Đáp xuống ô đối thủ để đá quân về chuồng.', 'Đưa cả bốn quân về đích bằng số bước vừa đủ.'],
    howToPlay: ['Bấm tung xúc xắc khi tới lượt.', 'Chọn quân hợp lệ để di chuyển.', 'Tận dụng nước ăn quân và về chuồng an toàn.']
  },
  {
    id: 'CO_TY_PHU', name: 'Cờ tỷ phú', shortName: 'Tỷ phú', category: 'board', icon: 'bi-buildings-fill', accent: '#67c7d9',
    description: 'Mua đất, xây tài sản và quản lý dòng tiền.', players: '2–6 người', minPlayers: 2, maxPlayers: 6, duration: '25–60 phút', difficulty: 'Chiến lược', fee: 'Phí bàn tùy chọn',
    rules: ['Luật Thành phố LuNu. Mỗi người bắt đầu với 1.500 xu trong ván.', 'Đến đất trống có thể mua. Đến đất đã có chủ phải trả tiền thuê.', 'Người trụ lại cuối cùng thắng. Sau 20 vòng, bàn so tổng tài sản.'],
    howToPlay: ['Tung hai xúc xắc để di chuyển. Qua Quảng trường được nhận 200 xu.', 'Nâng cấp khi dừng ở đất của mình để tăng tiền thuê.']
  },
  {
    id: 'EXPLODING_KITTENS', name: 'Mèo nổ', shortName: 'Mèo nổ', category: 'social', icon: 'bi-stars', accent: '#f18cb4',
    description: 'Rút bài, né mèo nổ và phá kế hoạch đối thủ.', players: '2–5 người', minPlayers: 2, maxPlayers: 5, duration: '10–20 phút', difficulty: 'Vui nhộn', fee: 'Phí bàn tùy chọn',
    rules: ['Trong luật LuNu, mỗi người có một lá Gỡ bom lúc bắt đầu.', 'Dùng Xáo bài, Bỏ lượt hoặc rút một lá. Nếu rút bom, dùng Gỡ bom và cài lại vào nọc.', 'Ai còn sống cuối cùng thắng.'],
    howToPlay: ['Theo dõi số lá trong nọc trước khi rút.', 'Sau khi gỡ bom, chọn vị trí để cài bom lại.']
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
