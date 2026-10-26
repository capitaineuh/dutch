import { NextRequest, NextResponse } from 'next/server';
import { act, view } from '@/lib/game-engine';
import { RoomBusyError, transact } from '@/lib/room-store';
import { authenticate, MissingRoomError, roomView, SessionError } from '@/lib/room-service';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
type Context = { params: Promise<{ pin: string }> };
const tokenOf = (req: NextRequest) => req.headers.get('authorization')?.replace('Bearer ', '');
function failure(error: unknown) {
    const status = error instanceof RoomBusyError ? 503 : error instanceof SessionError || error instanceof MissingRoomError ? error.status : 400;
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Requête invalide.' }, { status, headers: status === 503 ? { 'Retry-After': '1' } : {} });
}
export async function GET(req: NextRequest, ctx: Context) {
    try {
        const { pin } = await ctx.params;
        if (!/^\d{6}$/.test(pin)) throw new Error('Code invalide.');
        return NextResponse.json(await roomView(pin, tokenOf(req)), { headers: { 'Cache-Control': 'private, no-store' } });
    } catch (error) { return failure(error); }
}
export async function POST(req: NextRequest, ctx: Context) {
    try {
        const { pin } = await ctx.params;
        if (!/^\d{6}$/.test(pin)) throw new Error('Code invalide.');
        const origin = req.headers.get('origin');
        if (origin && origin !== req.nextUrl.origin) return NextResponse.json({ error: 'Origine refusée.' }, { status: 403 });
        const action = await req.json();
        if (!action || typeof action.type !== 'string') throw new Error('Action invalide.');
        return await transact(pin, latest => {
            const { room, player } = authenticate(latest, tokenOf(req));
            act(room, player, action);
            room.version++;
            return { room, result: NextResponse.json(view(room, player), { headers: { 'Cache-Control': 'private, no-store' } }) };
        });
    } catch (error) { return failure(error); }
}
