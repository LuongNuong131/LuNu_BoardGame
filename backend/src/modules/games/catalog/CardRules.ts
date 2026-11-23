export interface PlayingCard {
  id: string;
  rank: number;
  label: string;
  suit: 'S' | 'H' | 'D' | 'C';
  color: 'RED' | 'BLACK';
}

type HandRank = number[];
const highRank = (card: PlayingCard) => card.rank === 1 ? 14 : card.rank;
export const compareRanks = (left: HandRank, right: HandRank) => {
  for (let i = 0; i < Math.max(left.length, right.length); i++) {
    const difference = (left[i] ?? 0) - (right[i] ?? 0);
    if (difference) return difference;
  }
  return 0;
};

export function rankHand(cards: PlayingCard[]): HandRank {
  const ranks = cards.map(highRank).sort((a, b) => b - a);
  const unique = [...new Set(ranks)];
  const groups = unique.map((rank) => ({ rank, count: ranks.filter((value) => value === rank).length }))
    .sort((a, b) => b.count - a.count || b.rank - a.rank);
  const ordered = groups.map(({ rank }) => rank);
  const flush = cards.length === 5 && cards.every((card) => card.suit === cards[0].suit);
  const straight = unique.length === 5 && (unique[0] - unique[4] === 4 ? unique[0] : unique.join(',') === '14,5,4,3,2' ? 5 : 0);
  if (straight && flush) return [8, straight];
  if (groups[0].count === 4) return [7, ...ordered];
  if (groups[0].count === 3 && groups[1]?.count === 2) return [6, ...ordered];
  if (flush) return [5, ...ranks];
  if (straight) return [4, straight];
  if (groups[0].count === 3) return [3, ...ordered];
  if (groups[0].count === 2 && groups[1]?.count === 2) return [2, ...ordered];
  if (groups[0].count === 2) return [1, ...ordered];
  return [0, ...ranks];
}

function* choose<T>(items: T[], count: number, start = 0, prefix: T[] = []): Generator<T[]> {
  if (count === 0) {
    yield prefix;
    return;
  }
  for (let i = start; i <= items.length - count; i++) {
    yield* choose(items, count - 1, i + 1, [...prefix, items[i]]);
  }
}

export function bestPokerHand(cards: PlayingCard[]) {
  let best: HandRank = [];
  for (const candidate of choose(cards, 5)) {
    const rank = rankHand(candidate);
    if (compareRanks(rank, best) > 0) best = rank;
  }
  return best;
}

export function rankLieng(cards: PlayingCard[]) {
  const ranks = cards.map((card) => card.rank).sort((a, b) => a - b);
  if (ranks[0] === ranks[2]) return [3, ranks[0] === 1 ? 14 : ranks[0]];
  if (ranks.join(',') === '1,12,13') return [2, 14];
  if (ranks[1] === ranks[0] + 1 && ranks[2] === ranks[1] + 1) return [2, ranks[2]];
  if (ranks[0] >= 11) return [1, ...ranks.reverse()];
  return [0, ranks.reduce((sum, rank) => sum + Math.min(rank, 10), 0) % 10];
}

export function handGroups(hand: PlayingCard[], ids: unknown) {
  if (!Array.isArray(ids) || ids.length !== 3 || ![3, 5, 5].every((size, i) => Array.isArray(ids[i]) && ids[i].length === size)) return null;
  const flat = ids.flat();
  if (new Set(flat).size !== hand.length || !flat.every((id) => hand.some((card) => card.id === id))) return null;
  return ids.map((group) => group.map((id: string) => hand.find((card) => card.id === id)!)) as PlayingCard[][];
}

export function arrangeMauBinh(hand: PlayingCard[]): PlayingCard[][] {
  for (const back of choose(hand, 5)) {
    const remaining = hand.filter((card) => !back.includes(card));
    const backRank = rankHand(back);
    for (const middle of choose(remaining, 5)) {
      const middleRank = rankHand(middle);
      if (compareRanks(backRank, middleRank) < 0) continue;
      const front = remaining.filter((card) => !middle.includes(card));
      if (compareRanks(middleRank, rankHand(front)) >= 0) return [front, middle, back];
    }
  }
  return [hand.slice(0, 3), hand.slice(3, 8), hand.slice(8)];
}

export const isMeld = (cards: PlayingCard[]) => {
  if (cards.length < 3) return false;
  if (cards.every((card) => card.rank === cards[0].rank)) return true;
  const ranks = cards.map((card) => card.rank).sort((a, b) => a - b);
  return cards.every((card) => card.suit === cards[0].suit) && ranks.every((rank, i) => !i || rank === ranks[i - 1] + 1);
};

export function phomPoints(hand: PlayingCard[], requiredMelds: string[][] = []) {
  const requiredMask = requiredMelds.flat().reduce((mask, id) => {
    const i = hand.findIndex((card) => card.id === id);
    return i < 0 ? mask : mask | (1 << i);
  }, 0);
  let best = { deadwood: hand.reduce((sum, card) => sum + card.rank, 0), melds: 0 };
  const melds: number[] = [];
  for (let mask = 1; mask < (1 << hand.length); mask++) {
    if ((mask & requiredMask) !== 0) continue;
    const subset = hand.filter((_, i) => mask & (1 << i));
    if (isMeld(subset)) melds.push(mask);
  }
  const visited = new Set<number>();
  const walk = (mask: number, count: number) => {
    if (visited.has(mask)) return;
    visited.add(mask);
    const deadwood = hand.reduce((sum, card, i) => mask & (1 << i) ? sum : sum + card.rank, 0);
    if (deadwood < best.deadwood || (!best.melds && count)) best = { deadwood, melds: count };
    for (const meld of melds) if ((meld & mask) === 0) walk(mask | meld, count + 1);
  };
  walk(requiredMask, requiredMelds.length);
  return best;
}
