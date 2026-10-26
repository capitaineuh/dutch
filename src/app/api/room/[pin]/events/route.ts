import { NextRequest } from 'next/server';
import { tick, view } from '@/lib/game-engine';
import { transact } from '@/lib/room-store';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;
export async function GET(req: NextRequest, ctx: {
    params: Promise<{
        pin: string;
    }>;
}) {
    const { pin } = await ctx.params;
    const token = req.headers.get('authorization')?.replace('Bearer ', '');
    if (!/^\d{6}$/.test(pin) || !token)
        return new Response('Session requise', { status: 401 });
    const encoder = new TextEncoder();
    let stop = false;
    const stream = new ReadableStream({ async start(controller) { const until = Date.now() + 25000; req.signal.addEventListener('abort', () => { stop = true; }); try {
            while (!stop && Date.now() < until) {
                const data = await transact(pin, r => { if (!r)
                    throw new Error('Salon introuvable'); const p = r.players.find(p => p.token === token); if (!p)
                    throw new Error('Session invalide'); tick(r); p.lastSeen = Date.now(); return { room: r, result: view(r, p) }; });
                controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
                await new Promise(resolve => setTimeout(resolve, 300));
            }
        }
        catch {
            if (!stop)
                controller.enqueue(encoder.encode('event: error\ndata: Connexion interrompue\n\n'));
        }
        finally {
            controller.close();
        } }, cancel() { stop = true; } });
    return new Response(stream, { headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'private, no-cache, no-transform', 'Connection': 'keep-alive', 'X-Accel-Buffering': 'no' } });
}
