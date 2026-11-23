export const RACE_LENGTH = 48;
export const STABLE_FINISH = 53;
export const raceOffset = (seat: number, seats: number) => seat * (RACE_LENGTH / seats);
export const raceSquare = (progress: number, seat: number, seats: number) => (progress + raceOffset(seat, seats)) % RACE_LENGTH;

export function horseMoves(horses: Record<string, number[]>, players: string[], player: string, die: number) {
  const seat = players.indexOf(player);
  return horses[player].flatMap((progress, index) => {
    if (progress === STABLE_FINISH || (progress === -1 && die !== 1 && die !== 6)) return [];
    const destination = progress === -1 ? 0 : progress + die;
    if (destination > STABLE_FINISH) return [];
    if (destination < STABLE_FINISH && horses[player].includes(destination)) return [];
    for (let step = Math.max(0, progress + 1); step < destination && step < RACE_LENGTH; step++) {
      const square = raceSquare(step, seat, players.length);
      if (players.some((id, otherSeat) => horses[id].some((position) =>
        position >= 0 && position < RACE_LENGTH && raceSquare(position, otherSeat, players.length) === square))) return [];
    }
    return [{ index, destination }];
  });
}

export const CITY_CELLS = Array.from({ length: 24 }, (_, index) => {
  const names: Record<number, string> = {
    0: 'Quảng trường', 1: 'Bến Sen', 2: 'Phố Tre', 3: 'Chợ Gốm', 4: 'Thư viện', 5: 'Sân Ga',
    6: 'Công viên', 7: 'Hẻm Đèn', 8: 'Phố Lụa', 9: 'Vườn Mây', 10: 'Nhà Hát', 11: 'Kênh Xanh',
    12: 'Thuế đô thị', 13: 'Phố Sách', 14: 'Bến Tàu', 15: 'Đồi Thông', 16: 'Xưởng Mộc', 17: 'Phố Hoa',
    18: 'Lễ hội', 19: 'Bến Ngọc', 20: 'Phố Trúc', 21: 'Cầu Đá', 22: 'Vịnh Sao', 23: 'Tháp LuNu',
  };
  const special = index % 6 === 0;
  const price = special ? 0 : 80 + index * 10;
  return { index, name: names[index], price, rent: Math.floor(price / 4) };
});
