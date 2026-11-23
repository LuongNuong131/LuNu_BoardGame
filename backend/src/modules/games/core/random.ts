export function randomInt(limit: number): number {
  const ceiling = Math.floor(0x100000000 / limit) * limit;
  const sample = new Uint32Array(1);
  do {
    globalThis.crypto.getRandomValues(sample);
  } while (sample[0] >= ceiling);
  return sample[0] % limit;
}

export function shuffle<T>(items: T[], pick = randomInt): T[] {
  const shuffled = [...items];
  for (let index = shuffled.length - 1; index > 0; index--) {
    const swap = pick(index + 1);
    [shuffled[index], shuffled[swap]] = [shuffled[swap], shuffled[index]];
  }
  return shuffled;
}
