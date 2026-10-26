import { randomUUID } from 'node:crypto';
import type { CardMovement, Room, Target } from '../types/game';
export const atSlot = (t: Target) => ({ zone: 'slot' as const, player: t.player, slot: t.slot });
export const atHeld = (player: string) => ({ zone: 'held' as const, player });
export function motionEvent(r: Room, ...moves: CardMovement[]) {
    (r.motions ??= []).push({ id: randomUUID(), at: Date.now(), moves });
    r.motions = r.motions.slice(-32);
}
