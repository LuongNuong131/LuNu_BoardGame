import { randomInt } from 'node:crypto';
import { TienLenCard, TienLenPlayer, TienLenRuleset, TienLenSuit } from './tien-len.types';

const SUITS: TienLenSuit[] = ['SPADE', 'CLUB', 'DIAMOND', 'HEART'];
const RANKS = Array.from({ length: 13 }, (_, index) => index + 3);

export class DeckService {
  createDeck(deckId = 'main'): TienLenCard[] { return SUITS.flatMap((suit) => RANKS.map((rank) => ({ cardId: `${rankLabel(rank)}${suit[0]}`, rank: rank === 14 ? 1 : rank === 15 ? 2 : rank, suit, deckId }))); }
  secureShuffle(cards: TienLenCard[], seed = randomInt(1, 0x7fffffff)): { cards: TienLenCard[]; seed: number } { let cursor = seed >>> 0; const shuffled = [...cards]; for (let index = shuffled.length - 1; index > 0; index -= 1) { cursor = (cursor * 1664525 + 1013904223) >>> 0; const swap = cursor % (index + 1); [shuffled[index], shuffled[swap]] = [shuffled[swap], shuffled[index]]; } return { cards: shuffled, seed }; }
  dealCards(cards: TienLenCard[], players: TienLenPlayer[]): TienLenCard[] { let cursor = 0; const base = Math.floor(cards.length / players.length); const remainder = cards.length % players.length; players.forEach((player, index) => { const count = base + (index < remainder ? 1 : 0); player.cards = cards.slice(cursor, cursor + count); cursor += count; }); return cards.slice(cursor); }
  validateCard(card: TienLenCard): boolean { return Boolean(card?.cardId && card.deckId && SUITS.includes(card.suit) && ((card.rank >= 3 && card.rank <= 13) || card.rank === 1 || card.rank === 2)); }
}
const rankLabel = (rank: number) => rank === 14 ? 'A' : rank === 15 ? '2' : String(rank);
