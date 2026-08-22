import { GameEngine } from '../core/GameEngine';
import { UnoState, UnoAction, UnoCard, UnoColor, UnoType } from './uno.types';

export class UnoEngine implements GameEngine<UnoState, UnoAction, any> {
  
  // 1. Tạo và xào bài
  private createDeck(): UnoCard[] {
    const colors: UnoColor[] = ['RED', 'GREEN', 'BLUE', 'YELLOW'];
    const deck: UnoCard[] = [];
    let idCounter = 1;

    for (const color of colors) {
      deck.push({ id: `c${idCounter++}`, color, type: '0' });
      for (const type of ['1','2','3','4','5','6','7','8','9','SKIP','REVERSE','DRAW_TWO'] as UnoType[]) {
        deck.push({ id: `c${idCounter++}`, color, type });
        deck.push({ id: `c${idCounter++}`, color, type }); // Mỗi thẻ x2
      }
    }
    for (let i = 0; i < 4; i++) {
      deck.push({ id: `c${idCounter++}`, color: 'WILD', type: 'WILD' });
      deck.push({ id: `c${idCounter++}`, color: 'WILD', type: 'WILD_DRAW_FOUR' });
    }
    // Thuật toán xào bài (Fisher-Yates)
    for (let i = deck.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [deck[i], deck[j]] = [deck[j], deck[i]];
    }
    return deck;
  }

  // 2. Khởi tạo ván đấu
  initialize(players: string[], config: any): UnoState {
    const deck = this.createDeck();
    const hands: Record<string, UnoCard[]> = {};
    
    // Chia mỗi người 7 lá
    players.forEach(p => {
      hands[p] = deck.splice(0, 7);
    });

    // Lật lá đầu tiên (không được là lá đặc biệt Wild)
    let firstCard = deck.shift()!;
    while (firstCard.color === 'WILD') {
      deck.push(firstCard);
      firstCard = deck.shift()!;
    }

    return {
      players,
      hands,
      deck,
      discardPile: [firstCard],
      currentTurnIndex: 0,
      direction: 1,
      currentColor: firstCard.color,
      winner: null
    };
  }

  // 3. Kiểm tra tính hợp lệ của nước đi (Server Authoritative)
  validateAction(state: UnoState, action: UnoAction, playerId: string): boolean {
    if (state.winner) return false; // Game over
    if (state.players[state.currentTurnIndex] !== playerId) return false; // Chưa tới lượt

    if (action.type === 'DRAW_CARD') return true;

    if (action.type === 'PLAY_CARD') {
      const hand = state.hands[playerId];
      const card = hand.find(c => c.id === action.payload.cardId);
      if (!card) return false; // Không có lá bài này trên tay

      // Bài đen (Wild) đánh lúc nào cũng được
      if (card.color === 'WILD') {
        if (!action.payload.chosenColor || action.payload.chosenColor === 'WILD') return false; // Phải chọn màu
        return true;
      }

      // Đánh bài màu: Cùng màu hoặc cùng số/loại
      const topCard = state.discardPile[state.discardPile.length - 1];
      if (card.color === state.currentColor || card.type === topCard.type) {
        return true;
      }
    }
    return false;
  }

  private nextTurn(state: UnoState, steps: number = 1) {
    const numPlayers = state.players.length;
    state.currentTurnIndex = (state.currentTurnIndex + (state.direction * steps) + numPlayers * 10) % numPlayers;
  }

  private drawCards(state: UnoState, playerIndex: number, count: number) {
    const targetPlayer = state.players[playerIndex];
    for (let i = 0; i < count; i++) {
      if (state.deck.length === 0) {
        // Nọc hết bài -> Lấy bài đã đánh xào lại làm Nọc (chừa lại lá trên cùng)
        const topCard = state.discardPile.pop()!;
        state.deck = state.discardPile.sort(() => Math.random() - 0.5);
        state.discardPile = [topCard];
      }
      if (state.deck.length > 0) {
        state.hands[targetPlayer].push(state.deck.shift()!);
      }
    }
  }

  // 4. Cập nhật State dựa trên Action
  applyAction(state: UnoState, action: UnoAction, playerId: string): { newState: UnoState; events: any[] } {
    const newState = JSON.parse(JSON.stringify(state)) as UnoState;
    const events: any[] = [];

    if (action.type === 'DRAW_CARD') {
      this.drawCards(newState, newState.currentTurnIndex, 1);
      this.nextTurn(newState);
      events.push({ type: 'PLAYER_DRAWN', playerId });
    } 
    else if (action.type === 'PLAY_CARD') {
      const hand = newState.hands[playerId];
      const cardIndex = hand.findIndex(c => c.id === action.payload.cardId);
      const card = hand.splice(cardIndex, 1)[0];
      
      newState.discardPile.push(card);
      newState.currentColor = card.color === 'WILD' ? action.payload.chosenColor! : card.color;

      events.push({ type: 'CARD_PLAYED', playerId, card, chosenColor: newState.currentColor });

      // Check hết bài -> Thắng
      if (hand.length === 0) {
        newState.winner = playerId;
        events.push({ type: 'GAME_OVER', winner: playerId });
        return { newState, events };
      }

      // Xử lý hiệu ứng bài
      let stepsToNext = 1;
      if (card.type === 'REVERSE') {
        newState.direction *= -1;
        if (newState.players.length === 2) stepsToNext = 2; // Đấu tay đôi thì Reverse = Skip
      } 
      else if (card.type === 'SKIP') {
        stepsToNext = 2;
      } 
      else if (card.type === 'DRAW_TWO') {
        const targetIndex = (newState.currentTurnIndex + newState.direction + newState.players.length) % newState.players.length;
        this.drawCards(newState, targetIndex, 2);
        stepsToNext = 2; // Ép mất lượt
      } 
      else if (card.type === 'WILD_DRAW_FOUR') {
        const targetIndex = (newState.currentTurnIndex + newState.direction + newState.players.length) % newState.players.length;
        this.drawCards(newState, targetIndex, 4);
        stepsToNext = 2; // Ép mất lượt
      }

      this.nextTurn(newState, stepsToNext);
    }

    return { newState, events };
  }

  // 5. Lọc dữ liệu trước khi gửi cho Client (Ẩn bài của người khác)
  getPublicState(state: UnoState, playerId: string): any {
    const publicHands: Record<string, number> = {};
    for (const p of state.players) {
      publicHands[p] = state.hands[p].length; // Chỉ gửi số lượng bài
    }

    return {
      ...state,
      hands: undefined, // Xóa mảng tay bài gốc
      deckCount: state.deck.length,
      deck: undefined,
      myHand: state.hands[playerId] || [], // Chỉ trả bài của chính người gọi API
      playerCardCounts: publicHands
    };
  }

  isFinished(state: UnoState): boolean {
    return state.winner !== null;
  }

  calculateResult(state: UnoState): any {
    return { winner: state.winner };
  }
}