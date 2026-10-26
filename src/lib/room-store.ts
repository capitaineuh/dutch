import { randomUUID } from 'node:crypto';
import type { Room } from '@/types/game';
const globalStore = globalThis as unknown as {
    dutchRooms?: Map<string, Room>;
    dutchQueues?: Map<string, Promise<unknown>>;
};
const rooms = globalStore.dutchRooms ??= new Map();
const queues = globalStore.dutchQueues ??= new Map();
const url = process.env.UPSTASH_REDIS_REST_URL, token = process.env.UPSTASH_REDIS_REST_TOKEN;
async function redis(...command: unknown[]) { const res = await fetch(url!, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(command), cache: 'no-store' }); if (!res.ok)
    throw new Error('Stockage temporairement indisponible.'); const data = await res.json(); if (data.error)
    throw new Error('Erreur du stockage Redis.'); return data.result; }
export const persistent = !!(url && token);
export async function transact<T>(pin: string, fn: (room: Room | undefined) => {
    room: Room;
    result: T;
}): Promise<T> {
    const run = async () => {
        if (!persistent) {
            const value = fn(rooms.has(pin) ? structuredClone(rooms.get(pin)) : undefined);
            rooms.set(pin, value.room);
            return value.result;
        }
        const lock = randomUUID();
        const acquired = await redis('SET', `dutch:lock:${pin}`, lock, 'NX', 'PX', 10000);
        if (!acquired)
            throw new Error('Une action est en cours, réessayez.');
        try {
            const raw = await redis('GET', `dutch:${pin}`);
            const value = fn(raw ? JSON.parse(raw) : undefined);
            const saved = await redis('EVAL', "if redis.call('GET',KEYS[1]) == ARGV[1] then redis.call('SET',KEYS[2],ARGV[2],'EX',86400) return 1 else return 0 end", 2, `dutch:lock:${pin}`, `dutch:${pin}`, lock, JSON.stringify(value.room));
            if (!saved)
                throw new Error('Action expirée, réessayez.');
            return value.result;
        }
        finally {
            await redis('EVAL', "if redis.call('GET',KEYS[1]) == ARGV[1] then return redis.call('DEL',KEYS[1]) else return 0 end", 1, `dutch:lock:${pin}`, lock);
        }
    };
    const previous = queues.get(pin) ?? Promise.resolve();
    const next = previous.catch(() => { }).then(run);
    queues.set(pin, next);
    try {
        return await next;
    }
    finally {
        if (queues.get(pin) === next)
            queues.delete(pin);
    }
}
