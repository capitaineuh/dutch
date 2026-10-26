import { randomUUID } from 'node:crypto';
import type { Room } from '../types/game';
const globalStore = globalThis as unknown as { dutchRooms?: Map<string, Room>; dutchQueues?: Map<string, Promise<unknown>> };
const rooms = globalStore.dutchRooms ??= new Map();
const queues = globalStore.dutchQueues ??= new Map();
const url = process.env.UPSTASH_REDIS_REST_URL, token = process.env.UPSTASH_REDIS_REST_TOKEN;
export class RoomBusyError extends Error { constructor() { super('Le salon est occupé. Réessayez dans un instant.'); } }
async function redis(...command: unknown[]) {
    const res = await fetch(url!, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(command), cache: 'no-store', signal: AbortSignal.timeout(5000) });
    if (!res.ok) throw new Error('Stockage temporairement indisponible.');
    const data = await res.json();
    if (data.error) throw new Error('Erreur du stockage Redis.');
    return data.result;
}
export const persistent = !!(url && token);
// Reading an atomically committed snapshot never takes a writer's lock.
export async function readRoom(pin: string): Promise<Room | undefined> {
    if (!persistent) return rooms.has(pin) ? structuredClone(rooms.get(pin)) : undefined;
    const raw = await redis('GET', `dutch:${pin}`);
    return raw ? JSON.parse(raw) : undefined;
}
export async function transact<T>(pin: string, fn: (room: Room | undefined) => { room: Room; result: T }): Promise<T> {
    const run = async () => {
        if (!persistent) {
            const value = fn(await readRoom(pin));
            rooms.set(pin, value.room);
            return value.result;
        }
        const lock = randomUUID();
        const until = Date.now() + 2000;
        while (!await redis('SET', `dutch:lock:${pin}`, lock, 'NX', 'PX', 10000)) {
            if (Date.now() >= until) throw new RoomBusyError();
            await new Promise(resolve => setTimeout(resolve, 40 + Math.random() * 60));
        }
        try {
            const value = fn(await readRoom(pin));
            const saved = await redis('EVAL', "if redis.call('GET',KEYS[1]) == ARGV[1] then redis.call('SET',KEYS[2],ARGV[2],'EX',86400) return 1 else return 0 end", 2, `dutch:lock:${pin}`, `dutch:${pin}`, lock, JSON.stringify(value.room));
            if (!saved) throw new RoomBusyError();
            return value.result;
        } finally {
            // A committed write stays successful even if cleanup fails: the lease expires.
            await redis('EVAL', "if redis.call('GET',KEYS[1]) == ARGV[1] then return redis.call('DEL',KEYS[1]) else return 0 end", 1, `dutch:lock:${pin}`, lock).catch(() => {});
        }
    };
    const previous = queues.get(pin) ?? Promise.resolve();
    const next = previous.catch(() => {}).then(run);
    queues.set(pin, next);
    try { return await next; }
    finally { if (queues.get(pin) === next) queues.delete(pin); }
}
