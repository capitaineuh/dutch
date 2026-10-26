import { NextRequest, NextResponse } from 'next/server';
import { randomInt } from 'node:crypto';
import { createRoom, player, view } from '@/lib/game-engine';
import { transact } from '@/lib/room-store';
export const runtime = 'nodejs';
export async function POST(req: NextRequest) { try {
    const body = await req.json();
    const p = player(body.name);
    const join = body.pin !== undefined;
    if (join && !/^\d{6}$/.test(body.pin))
        throw new Error('Le code doit contenir six chiffres.');
    for (let attempt = 0; attempt < 20; attempt++) {
        const pin = join ? body.pin : String(randomInt(100000, 1000000));
        try {
            return await transact(pin, r => { if (join) {
                if (!r)
                    throw new Error('Salon introuvable.');
                if (r.phase !== 'lobby' || r.players.length >= 8)
                    throw new Error('Salon complet ou partie déjà commencée.');
                r.players.push(p);
            }
            else {
                if (r)
                    throw new Error('collision');
                r = createRoom(pin, p, body.settings ?? {});
            } r.version++; return { room: r, result: NextResponse.json({ view: view(r, p), session: { pin, playerId: p.id, token: p.token } }) }; });
        }
        catch (e) {
            if (e instanceof Error && e.message === 'collision')
                continue;
            throw e;
        }
    }
    throw new Error('Impossible de créer le salon.');
}
catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Requête invalide.' }, { status: 400 });
} }
