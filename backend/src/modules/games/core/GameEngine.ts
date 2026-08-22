/**
 * Kiến trúc chuẩn mực cho mọi Game cắm vào nền tảng.
 * Bất kỳ game nào (UNO, Werewolf, Tiến Lên...) đều phải implement interface này.
 */
export interface GameEngine<TState, TAction, TResult> {
  // Khởi tạo trạng thái game (chia bài, phát vai)
  initialize(players: string[], config: any): TState;
  
  // Server-authoritative: Kiểm tra hành động có hợp lệ không
  validateAction(state: TState, action: TAction, playerId: string): boolean;
  
  // Áp dụng hành động, sinh ra state mới và các event để bắn Realtime
  applyAction(state: TState, action: TAction, playerId: string): { newState: TState; events: any[] };
  
  // Ẩn thông tin nhạy cảm (Ví dụ: Player A không được xem bài Player B)
  getPublicState(state: TState, playerId: string): any;
  
  // Kiểm tra điều kiện thắng
  isFinished(state: TState): boolean;
  
  // Tính toán kết quả và phần thưởng
  calculateResult(state: TState): TResult;
}