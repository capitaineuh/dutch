'use client';
import { create } from 'zustand';
import type { Action, View } from '@/types/game';
type Session = { pin: string; playerId: string; token: string };
type Store = {
    view: View | null; session: Session | null; error: string; busy: boolean;
    connection: 'connected' | 'reconnecting';
    connect: (name: string, pin?: string, settings?: { rounds: number; seconds: number; limit: number }) => Promise<void>;
    restore: () => void; poll: () => Promise<void>; action: (a: Action) => Promise<boolean>; leave: () => void;
};
let channel: BroadcastChannel | undefined;
let polling: Promise<void> | null = null;
export const useGame = create<Store>((set, get) => {
    const accept = (data: View, session: Session) => {
        if (get().session?.token !== session.token) return;
        const current = get().view;
        if (!current || data.version >= current.version) set({ view: data, connection: 'connected' });
    };
    return {
        view: null, session: null, error: '', busy: false, connection: 'connected',
        connect: async (name, pin, settings) => {
            set({ busy: true, error: '' });
            try {
                const res = await fetch('/api/game', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, pin, settings }) });
                const data = await res.json();
                if (!res.ok) throw new Error(data.error);
                localStorage.setItem('dutch-session', JSON.stringify(data.session));
                set({ session: data.session, view: data.view, connection: 'connected' });
            } catch (e) { set({ error: (e as Error).message }); }
            finally { set({ busy: false }); }
        },
        restore: () => {
            try {
                const raw = localStorage.getItem('dutch-session');
                if (raw) {
                    const session = JSON.parse(raw);
                    if (/^\d{6}$/.test(session.pin) && typeof session.token === 'string') set({ session });
                    else localStorage.removeItem('dutch-session');
                }
            } catch { localStorage.removeItem('dutch-session'); }
            if ('BroadcastChannel' in window) {
                channel ??= new BroadcastChannel('dutch-events');
                channel.onmessage = event => { if (event.data?.pin === get().session?.pin) void get().poll(); };
            }
        },
        poll: () => {
            if (polling) return polling;
            const session = get().session;
            if (!session || get().busy) return Promise.resolve();
            polling = (async () => {
                try {
                    const res = await fetch(`/api/room/${session.pin}`, { headers: { Authorization: `Bearer ${session.token}` }, cache: 'no-store', signal: AbortSignal.timeout(8000) });
                    const data = await res.json();
                    if (!res.ok) {
                        if (get().session?.token === session.token) {
                            if (res.status === 401 || res.status === 404) set({ error: data.error });
                            else set({ connection: 'reconnecting' });
                        }
                        return;
                    }
                    accept(data, session);
                } catch {
                    if (get().session?.token === session.token) set({ connection: 'reconnecting' });
                }
            })().finally(() => { polling = null; });
            return polling;
        },
        action: async action => {
            const session = get().session;
            if (!session || get().busy) return false;
            set({ busy: true, error: '' });
            try {
                const res = await fetch(`/api/room/${session.pin}`, { method: 'POST', headers: { Authorization: `Bearer ${session.token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(action) });
                const data = await res.json();
                if (!res.ok) throw new Error(data.error);
                accept(data, session);
                channel?.postMessage({ pin: session.pin });
                return true;
            } catch (error) {
                if (get().session?.token === session.token) set({ error: (error as Error).message });
                return false;
            } finally { set({ busy: false }); }
        },
        leave: () => { localStorage.removeItem('dutch-session'); set({ session: null, view: null, error: '', connection: 'connected' }); },
    };
});
