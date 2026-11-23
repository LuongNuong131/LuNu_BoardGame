import { Chess, type Square } from 'chess.js';

type Move = { from: Square; to: Square; promotion?: string };
type Point = { row: number; column: number };
type Piece = { type: string; color: string };

const PIECES: Record<string, string> = { KING: 'k', QUEEN: 'q', BISHOP: 'b', KNIGHT: 'n', ROOK: 'r', PAWN: 'p' };
const TYPES: Record<string, string> = Object.fromEntries(Object.entries(PIECES).map(([name, key]) => [key, name]));
const PROMOTIONS: Record<string, string> = { QUEEN: 'q', ROOK: 'r', BISHOP: 'b', KNIGHT: 'n' };

export const chessSquare = (point: Point) => (`${'abcdefgh'[point.column]}${8 - point.row}`) as Square;
export const chessPoint = (square: Square) => ({ row: 8 - Number(square[1]), column: square.charCodeAt(0) - 97 });

export function restoreChess(state: {
  chess?: { fen?: string; startingFen?: string; moves?: Move[] };
  board?: Array<Array<Piece | null>>;
  currentTurnIndex: number;
}) {
  if (state.chess?.fen) return new Chess(state.chess.fen);
  if (state.chess?.startingFen) {
    const game = new Chess(state.chess.startingFen);
    for (const move of state.chess.moves ?? []) game.move(move);
    return game;
  }
  if (!state.board) return new Chess();
  const rows = state.board.map((row) => row.reduce((text, piece, index) => {
    const last = Number(text.at(-1));
    if (!piece) return last ? text.slice(0, -1) + (last + 1) : text + '1';
    const symbol = PIECES[piece.type];
    if (!symbol) throw new Error(`Unknown piece in row at column ${index}`);
    return text + (piece.color === 'WHITE' ? symbol.toUpperCase() : symbol);
  }, ''));
  return new Chess(`${rows.join('/')} ${state.currentTurnIndex === 0 ? 'w' : 'b'} - - 0 1`);
}

export function chessBoard(game: Chess) {
  return game.board().map((row) => row.map((piece) => piece ? {
    type: TYPES[piece.type],
    color: piece.color === 'w' ? 'WHITE' as const : 'BLACK' as const,
  } : null));
}

export function legalChessMove(game: Chess, from: Point, to: Point, promotion?: unknown) {
  if (promotion !== undefined && (typeof promotion !== 'string' || !Object.hasOwn(PROMOTIONS, promotion))) return undefined;
  return game.moves({ square: chessSquare(from), verbose: true }).find((move) =>
    move.to === chessSquare(to) && (move.promotion ? move.promotion === PROMOTIONS[String(promotion ?? 'QUEEN')] : promotion === undefined));
}

export function chessKey(game: Chess) {
  return game.fen().split(' ').slice(0, 4).join(' ');
}

export function chessMoves(game: Chess) {
  return game.moves({ verbose: true }).map((move) => ({
    type: 'MOVE',
    payload: {
      from: chessPoint(move.from),
      to: chessPoint(move.to),
      promotion: move.promotion ? TYPES[move.promotion] : undefined,
    },
    priority: (move.captured ? 10 : 0) + (move.promotion ? 8 : 0) + (move.san.endsWith('+') ? 2 : 0) + (move.san.endsWith('#') ? 100 : 0),
  }));
}
