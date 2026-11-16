import type { Composer, Piece } from '../engine/types';
import raw from './catalog.json';

const data = raw as unknown as { composers: Composer[]; pieces: Piece[] };

export const COMPOSERS: Composer[] = data.composers;
export const PIECES: Piece[] = data.pieces;

const composerMap = new Map(COMPOSERS.map((c) => [c.id, c]));
const pieceMap = new Map(PIECES.map((p) => [p.id, p]));

export const composerOf = (id: string): Composer => composerMap.get(id)!;
export const pieceOf = (id: string): Piece | undefined => pieceMap.get(id);
export const piecesBy = (composerId: string): Piece[] => PIECES.filter((p) => p.composer === composerId);
