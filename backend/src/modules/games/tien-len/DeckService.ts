import { randomInt, shuffle } from '../core/random';
import type { TienLenCard, TienLenPlayer, TienLenSuit } from './tien-len.types';

const SUITS: TienLenSuit[] = ['SPADE', 'CLUB', 'DIAMOND', 'HEART'];
const RANKS = Array.from({ length: 13 }, (_, index) => index + 3);

export class DeckService {
  createDeck(deckId = 'main'): TienLenCard[] { return SUITS.flatMap((suit) => RANKS.map((rank) => ({ cardId: `${rankLabel(rank)}${suit[0]}`, rank: rank === 14 ? 1 : rank === 15 ? 2 : rank, suit, deckId }))); }
  secureShuffle(cards: TienLenCard[], seed?: number): { cards: TienLenCard[]; seed: number } {
    if (seed === undefined) return { seed: 0, cards: shuffle(cards, randomInt) };
    let cursor = (seed >>> 0) || 1;
    return { seed, cards: shuffle(cards, (limit) => {
      cursor ^= cursor << 13;
      cursor ^= cursor >>> 17;
      cursor ^= cursor << 5;
      return (cursor >>> 0) % limit;
    }) };
  }

  dealCards(cards: TienLenCard[], players: TienLenPlayer[]): TienLenCard[] {
    players.forEach((player, index) => { player.cards = cards.slice(index * 13, (index + 1) * 13); });
    return cards.slice(players.length * 13);
  }
  validateCard(card: TienLenCard): boolean { return Boolean(card?.cardId && card.deckId && SUITS.includes(card.suit) && ((card.rank >= 3 && card.rank <= 13) || card.rank === 1 || card.rank === 2)); }
}
const rankLabel = (rank: number) => rank === 14 ? 'A' : rank === 15 ? '2' : String(rank);
