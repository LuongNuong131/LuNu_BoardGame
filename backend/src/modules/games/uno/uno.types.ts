export type UnoColor = 'RED' | 'GREEN' | 'BLUE' | 'YELLOW' | 'WILD';
export type UnoType = '0'|'1'|'2'|'3'|'4'|'5'|'6'|'7'|'8'|'9'|'SKIP'|'REVERSE'|'DRAW_TWO'|'WILD'|'WILD_DRAW_FOUR';

export interface UnoCard {
  id: string; // Mã định danh duy nhất của lá bài
  color: UnoColor;
  type: UnoType;
}

export interface UnoState {
  players: string[]; // Danh sách User ID
  hands: Record<string, UnoCard[]>; // Bài trên tay mỗi người
  deck: UnoCard[]; // Nọc (bài chưa bốc)
  discardPile: UnoCard[]; // Bài đã đánh
  currentTurnIndex: number; // Tới lượt ai (index trong mảng players)
  direction: 1 | -1; // Chiều đánh (1: xuôi, -1: ngược)
  currentColor: UnoColor; // Màu hiện tại đang đánh
  winner: string | null;
  drawnCardId?: string;
}

export type UnoAction = 
  | { type: 'PLAY_CARD'; payload: { cardId: string; chosenColor?: UnoColor; sayUno?: boolean } }
  | { type: 'DRAW_CARD' | 'PASS'; payload?: Record<string, never> };