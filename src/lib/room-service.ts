import type { Player, Room, View } from '../types/game';
import { tick, view } from './game-engine';
import { readRoom, RoomBusyError, transact } from './room-store';

export class SessionError extends Error { readonly status = 401; }
export class MissingRoomError extends Error { readonly status = 404; }
export function authenticate(room: Room | undefined, token?: string): { room: Room; player: Player } {
    if (!room) throw new MissingRoomError('Salon introuvable ou expiré.');
    const player = token && room.players.find(p => p.token === token);
    if (!player) throw new SessionError('Session non autorisée.');
    return { room, player };
}
function maintenanceNeeded(room: Room, player: Player) {
    return ((room.phase === 'memory' || room.phase === 'playing') && room.deadline <= Date.now())
        || Date.now() - player.lastSeen > 15000;
}
export async function roomView(pin: string, token?: string): Promise<View> {
    const initial = authenticate(await readRoom(pin), token);
    if (!maintenanceNeeded(initial.room, initial.player)) return view(initial.room, initial.player);
    try {
        return await transact(pin, latest => {
            const { room, player } = authenticate(latest, token);
            if (maintenanceNeeded(room, player)) {
                tick(room);
                player.lastSeen = Date.now();
                room.version++;
            }
            return { room, result: view(room, player) };
        });
    } catch (error) {
        if (!(error instanceof RoomBusyError)) throw error;
        const latest = authenticate(await readRoom(pin), token);
        return view(latest.room, latest.player);
    }
}
