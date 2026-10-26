import { NextRequest, NextResponse } from 'next/server';
import { act, tick, view } from '@/lib/game-engine';
import { transact } from '@/lib/room-store';
import type { Action } from '@/types/game';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
async function handle(req: NextRequest, ctx: {
    params: Promise<{
        pin: string;
    }>;
}, action?: Action) { try {
    const { pin } = await ctx.params;
    if (!/^\d{6}$/.test(pin))
        throw new Error('Code invalide.');
    return await transact(pin, r => { if (!r)
        throw new Error('Salon introuvable ou expiré.'); const token = req.headers.get('authorization')?.replace('Bearer ', ''); const p = r.players.find(p => p.token === token); if (!p)
        throw new Error('Session non autorisée.'); tick(r); p.lastSeen = Date.now(); if (action)
        act(r, p, action); r.version++; return { room: r, result: NextResponse.json(view(r, p), { headers: { 'Cache-Control': 'private, no-store' } }) }; });
}
catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Action invalide.' }, { status: 400 });
} }
export async function GET(req: NextRequest, ctx: {
    params: Promise<{
        pin: string;
    }>;
}) { return handle(req, ctx); }
export async function POST(req: NextRequest, ctx: {
    params: Promise<{
        pin: string;
    }>;
}) { try {
    const origin = req.headers.get('origin');
    if (origin && origin !== req.nextUrl.origin)
        return NextResponse.json({ error: 'Origine refusée.' }, { status: 403 });
    return handle(req, ctx, await req.json());
}
catch {
    return NextResponse.json({ error: 'Requête invalide.' }, { status: 400 });
} }
