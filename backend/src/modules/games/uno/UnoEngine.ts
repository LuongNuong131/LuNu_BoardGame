import { shuffle } from '../core/random';
import type { GameEngine } from '../core/GameEngine';
import type { UnoState, UnoAction, UnoCard, UnoColor, UnoType } from './uno.types';

const COLORS: UnoColor[] = ['RED', 'GREEN', 'BLUE', 'YELLOW'];

export class UnoEngine implements GameEngine<UnoState, UnoAction, any> {
  
  // 1. Tạo và xào bài
  private createDeck(): UnoCard[] {
    const deck: UnoCard[] = [];
    let idCounter = 1;

    for (const color of COLORS) {
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
    return shuffle(deck);
  }

  // 2. Khởi tạo ván đấu
  initialize(players: string[], _config: any): UnoState {
    const deck = this.createDeck();
    const hands: Record<string, UnoCard[]> = {};
    
    // Chia mỗi người 7 lá
    players.forEach(p => {
      hands[p] = deck.splice(0, 7);
    });

    const firstCard = deck.splice(deck.findIndex((card) => /^\d$/.test(card.type)), 1)[0];

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

  addPlayer(state: UnoState, playerId: string): UnoState {
    if (state.players.includes(playerId)) return state;
    const nextState = JSON.parse(JSON.stringify(state)) as UnoState;
    nextState.players.push(playerId);
    nextState.hands[playerId] = [];
    this.drawCards(nextState, nextState.players.length - 1, Math.min(7, nextState.deck.length));
    return nextState;
  }

  getAiAction(state: UnoState, playerId: string, _difficulty: 'EASY' | 'MEDIUM' | 'HARD'): UnoAction | null {
    if (state.players[state.currentTurnIndex] !== playerId || state.winner) return null;
    const hand = state.hands[playerId] || [];
    const color = [...COLORS].sort((a, b) => hand.filter((card) => card.color === b).length - hand.filter((card) => card.color === a).length)[0];
    for (const card of hand) {
      const action: UnoAction = { type: 'PLAY_CARD', payload: { cardId: card.id, chosenColor: card.color === 'WILD' ? color : undefined, sayUno: true } };
      if (this.validateAction(state, action, playerId)) return action;
    }
    return state.drawnCardId || !this.validateAction(state, { type: 'DRAW_CARD' }, playerId) ? { type: 'PASS' } : { type: 'DRAW_CARD' };
  }

  validateAction(state: UnoState, action: UnoAction, playerId: string): boolean {
    if (!action || state.winner || state.players[state.currentTurnIndex] !== playerId) return false;
    const canDraw = state.deck.length > 0 || state.discardPile.length > 1;
    if (action.type === 'DRAW_CARD') return !state.drawnCardId && canDraw;
    if (action.type === 'PASS') return Boolean(state.drawnCardId) || !canDraw;
    if (action.type !== 'PLAY_CARD') return false;
    const hand = state.hands[playerId];
    const card = hand.find((item) => item.id === action.payload?.cardId);
    if (!card || (state.drawnCardId && state.drawnCardId !== card.id)) return false;
    if (card.color === 'WILD') {
      return COLORS.includes(action.payload.chosenColor!) && (card.type !== 'WILD_DRAW_FOUR' ||
        !hand.some((item) => item.color === state.currentColor));
    }
    return card.color === state.currentColor || card.type === state.discardPile.at(-1)?.type;
  }

  private nextTurn(state: UnoState, steps: number = 1) {
    state.drawnCardId = undefined;
    const numPlayers = state.players.length;
    state.currentTurnIndex = (state.currentTurnIndex + (state.direction * steps) + numPlayers * 10) % numPlayers;
  }

  private drawCards(state: UnoState, playerIndex: number, count: number) {
    const targetPlayer = state.players[playerIndex];
    for (let i = 0; i < count; i++) {
      if (state.deck.length === 0) {
        // Nọc hết bài -> Lấy bài đã đánh xào lại làm Nọc (chừa lại lá trên cùng)
        const topCard = state.discardPile.pop()!;
        state.deck = shuffle(state.discardPile);
        state.discardPile = [topCard];
      }
      if (state.deck.length > 0) {
        state.hands[targetPlayer].push(state.deck.shift()!);
      }
    }
  }

  // 4. Cập nhật State dựa trên Action
  applyAction(state: UnoState, action: UnoAction, playerId: string): { newState: UnoState; events: any[] } {
    if (!this.validateAction(state, action, playerId)) throw new Error('INVALID_ACTION');
    const newState = JSON.parse(JSON.stringify(state)) as UnoState;
    const events: any[] = [];

    if (action.type === 'DRAW_CARD') {
      this.drawCards(newState, newState.currentTurnIndex, 1);
      newState.drawnCardId = newState.hands[playerId].at(-1)?.id;
      events.push({ type: 'PLAYER_DRAWN', playerId });
    } 
    else if (action.type === 'PASS') {
      this.nextTurn(newState);
      events.push({ type: 'PASS', playerId });
    } else if (action.type === 'PLAY_CARD') {
      const hand = newState.hands[playerId];
      const cardIndex = hand.findIndex(c => c.id === action.payload.cardId);
      const card = hand.splice(cardIndex, 1)[0];
      
      newState.discardPile.push(card);
      newState.currentColor = card.color === 'WILD' ? action.payload.chosenColor! : card.color;

      events.push({ type: 'CARD_PLAYED', playerId, card, chosenColor: newState.currentColor });

      const won = hand.length === 0;
      if (hand.length === 1 && action.payload.sayUno !== true) {
        this.drawCards(newState, newState.currentTurnIndex, 2);
        events.push({ type: 'UNO_PENALTY', playerId });
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
      if (won) {
        newState.winner = playerId;
        events.push({ type: 'GAME_OVER', winner: playerId });
      }
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
      drawnCardId: state.players[state.currentTurnIndex] === playerId ? state.drawnCardId : undefined,
      availableActions: [
        ...(this.validateAction(state, { type: 'DRAW_CARD' }, playerId) ? ['DRAW_CARD'] : []),
        ...(this.validateAction(state, { type: 'PASS' }, playerId) ? ['PASS'] : []),
      ],
      playableCards: (state.hands[playerId] || []).filter((card) =>
        this.validateAction(state, { type: 'PLAY_CARD', payload: { cardId: card.id, chosenColor: 'RED' } }, playerId)).map((card) => card.id),
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