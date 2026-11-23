export type Point = { row: number; column: number };
export type XiangqiColor = 'RED' | 'BLACK_SIDE';
export type BoardPiece = { type: string; color: 'WHITE' | 'BLACK' | XiangqiColor };
type Board = Array<Array<BoardPiece | null>>;

export function xiangqiBoard(): Board {
  const board: Board = Array.from({ length: 10 }, () => Array(9).fill(null));
  const back = ['ROOK', 'KNIGHT', 'ELEPHANT', 'ADVISOR', 'KING', 'ADVISOR', 'ELEPHANT', 'KNIGHT', 'ROOK'];
  for (const [color, row, direction] of [['BLACK_SIDE', 0, 1], ['RED', 9, -1]] as const) {
    back.forEach((type, column) => { board[row][column] = { type, color }; });
    for (const column of [1, 7]) board[row + 2 * direction][column] = { type: 'CANNON', color };
    for (const column of [0, 2, 4, 6, 8]) board[row + 3 * direction][column] = { type: 'PAWN', color };
  }
  return board;
}

function canReach(board: Board, from: Point, to: Point, piece: BoardPiece, attack = false): boolean {
  const target = board[to.row][to.column];
  const dr = to.row - from.row;
  const dc = to.column - from.column;
  const r = Math.abs(dr);
  const c = Math.abs(dc);
  if ((!r && !c) || target?.color === piece.color) return false;
  const red = piece.color === 'RED';
  const ownHalf = red ? to.row >= 5 : to.row <= 4;
  const palace = (red ? to.row >= 7 : to.row <= 2) && to.column >= 3 && to.column <= 5;
  if (piece.type === 'KING' && !(attack && target?.type === 'KING' && dc === 0)) return r + c === 1 && palace;
  if (piece.type === 'ADVISOR') return r === 1 && c === 1 && palace;
  if (piece.type === 'ELEPHANT') return ownHalf && r === 2 && c === 2 && !board[from.row + dr / 2][from.column + dc / 2];
  if (piece.type === 'KNIGHT') {
    if (r === 2 && c === 1) return !board[from.row + Math.sign(dr)][from.column];
    if (r === 1 && c === 2) return !board[from.row][from.column + Math.sign(dc)];
    return false;
  }
  if (piece.type === 'PAWN') return (dc === 0 && dr === (red ? -1 : 1)) || (!dr && c === 1 && (red ? from.row <= 4 : from.row >= 5));
  if (dr && dc) return false;
  let blockers = 0;
  for (let step = 1; step < r + c; step++) {
    if (board[from.row + Math.sign(dr) * step][from.column + Math.sign(dc) * step]) blockers++;
  }
  if (piece.type === 'CANNON') return blockers === (target ? 1 : 0);
  return (piece.type === 'ROOK' || piece.type === 'KING') && blockers === 0;
}

export function xiangqiCheck(board: Board, color: XiangqiColor): boolean {
  const row = board.findIndex((line) => line.some((piece) => piece?.type === 'KING' && piece.color === color));
  if (row < 0) return true;
  const column = board[row].findIndex((piece) => piece?.type === 'KING' && piece.color === color);
  return board.some((line, r) => line.some((piece, c) =>
    piece && piece.color !== color && canReach(board, { row: r, column: c }, { row, column }, piece, true)));
}

export function legalXiangqiMove(board: Board, from: Point, to: Point, color: XiangqiColor): boolean {
  const piece = board[from.row]?.[from.column];
  if (!piece || piece.color !== color || board[to.row][to.column]?.type === 'KING' || !canReach(board, from, to, piece)) return false;
  const copy = board.map((line) => [...line]);
  copy[to.row][to.column] = piece;
  copy[from.row][from.column] = null;
  return !xiangqiCheck(copy, color);
}

export function xiangqiMoves(board: Board, color: XiangqiColor) {
  const moves = [];
  for (let row = 0; row < 10; row++) for (let column = 0; column < 9; column++) {
    if (board[row][column]?.color !== color) continue;
    const from = { row, column };
    for (let r = 0; r < 10; r++) for (let c = 0; c < 9; c++) {
      const to = { row: r, column: c };
      if (legalXiangqiMove(board, from, to, color)) {
        moves.push({ type: 'MOVE', payload: { from, to }, priority: board[r][c] ? 10 : 0 });
      }
    }
  }
  return moves;
}
