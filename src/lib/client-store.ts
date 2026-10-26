'use client';
import { create } from 'zustand';
import type { Action, View } from '@/types/game';
type Session = {
    pin: string;
    playerId: string;
    token: string;
};
type Store = {
    view: View | null;
    session: Session | null;
    error: string;
    busy: boolean;
    connect: (name: string, pin?: string, settings?: {
        rounds: number;
        seconds: number;
        limit: number;
    }) => Promise<void>;
    restore: () => void;
    poll: () => Promise<void>;
    action: (a: Action) => Promise<void>;
    leave: () => void;
};
let channel: BroadcastChannel | undefined;
export const useGame = create<Store>((set, get) => ({ view: null, session: null, error: '', busy: false,
    connect: async (name, pin, settings) => { set({ busy: true, error: '' }); try {
        const res = await fetch('/api/game', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, pin, settings }) });
        const data = await res.json();
        if (!res.ok)
            throw new Error(data.error);
        localStorage.setItem('dutch-session', JSON.stringify(data.session));
        set({ session: data.session, view: data.view });
    }
    catch (e) {
        set({ error: (e as Error).message });
    }
    finally {
        set({ busy: false });
    } },
    restore: () => { try {
        const s = localStorage.getItem('dutch-session');
        if (s)
            set({ session: JSON.parse(s) });
    }
    catch {
        localStorage.removeItem('dutch-session');
    } if ('BroadcastChannel' in window) {
        channel ??= new BroadcastChannel('dutch-events');
        channel.onmessage = () => { void get().poll(); };
    } },
    poll: async () => { const s = get().session; if (!s)
        return; try {
        const res = await fetch(`/api/room/${s.pin}`, { headers: { Authorization: `Bearer ${s.token}` }, cache: 'no-store' });
        const data = await res.json();
        if (!res.ok)
            throw new Error(data.error);
        if (get().session?.token === s.token && (!get().view || data.version >= get().view!.version)) set({ view: data });
    }
    catch (e) {
        set({ error: (e as Error).message });
    } },
    action: async (a) => { const s = get().session; if (!s || get().busy)
        return; set({ busy: true, error: '' }); try {
        const res = await fetch(`/api/room/${s.pin}`, { method: 'POST', headers: { Authorization: `Bearer ${s.token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(a) });
        const data = await res.json();
        if (!res.ok)
            throw new Error(data.error);
        if (get().session?.token === s.token && (!get().view || data.version >= get().view!.version)) set({ view: data });
        channel?.postMessage({ pin: s.pin });
    }
    catch (e) {
        set({ error: (e as Error).message });
    }
    finally {
        set({ busy: false });
    } },
    leave: () => { localStorage.removeItem('dutch-session'); set({ session: null, view: null, error: '' }); }
}));
