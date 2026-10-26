import type { GridPosition } from '../types/game';

export const GRID_COLUMNS = 4;
export const GRID_MAX_ROWS = 32;
export function slotPosition(slot: { position?: GridPosition }, index: number): GridPosition {
    return slot.position ?? { col: index % 2, row: Math.floor(index / 2) };
}
export function validPosition(value?: GridPosition): value is GridPosition {
    return !!value && Number.isInteger(value.col) && Number.isInteger(value.row)
        && value.col >= 0 && value.col < GRID_COLUMNS && value.row >= 0 && value.row < GRID_MAX_ROWS;
}
export function freePosition(slots: { position?: GridPosition }[]): GridPosition {
    const occupied = new Set(slots.map((s, i) => { const p = slotPosition(s, i); return `${p.col}:${p.row}`; }));
    for (let row = 0; row < GRID_MAX_ROWS; row++) {
        for (let col = 0; col < GRID_COLUMNS; col++) {
            if (!occupied.has(`${col}:${row}`)) return { col, row };
        }
    }
    throw new Error('La grille est pleine.');
}
