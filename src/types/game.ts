export type Suit = '♥' | '♦' | '♣' | '♠';
export type Card = {
    id: string;
    rank: number;
    suit: Suit;
};
export type Slot = {
    id: string;
    card: Card | null;
};
export type Player = {
    id: string;
    token: string;
    name: string;
    score: number;
    ready: boolean;
    seen: boolean;
    lastSeen: number;
    slots: Slot[];
};
export type Target = {
    player: string;
    slot: string;
};
export type Action = {
    type: 'ready' | 'start' | 'memorized' | 'draw' | 'take' | 'discard' | 'replace' | 'peek' | 'swap' | 'snap' | 'give' | 'end' | 'dutch' | 'next';
    target?: Target;
    second?: Target;
    top?: string;
};
export type Room = {
    suspended?: {
        active: number;
        step: Room['step'];
        held: Card | null;
        source: Room['source'];
        extra: boolean;
    }[];
    pin: string;
    host: string;
    players: Player[];
    phase: 'lobby' | 'memory' | 'playing' | 'results' | 'finished';
    round: number;
    settings: {
        rounds: number;
        seconds: number;
        limit: number;
    };
    deck: Card[];
    discard: Card[];
    active: number;
    step: 'draw' | 'held' | 'queen' | 'jack' | 'end';
    held: Card | null;
    source: 'deck' | 'discard';
    deadline: number;
    caller: string | null;
    remaining: string[];
    extra: boolean;
    gift: {
        actor: string;
        target: Target;
    } | null;
    reveals: {
        audience: string;
        card: string;
        until: number;
    }[];
    logs: {
        id: string;
        text: string;
        at: number;
    }[];
    results: Record<string, number>;
    version: number;
    swap: {
        first: Target;
        second: Target;
        at: number;
    } | null;
};
export type PublicPlayer = Omit<Player, 'token' | 'slots'> & {
    slots: {
        id: string;
        card: Card | null;
        occupied: boolean;
    }[];
};
export type View = Omit<Room, 'deck' | 'players' | 'held' | 'reveals' | 'discard' | 'suspended'> & {
    players: PublicPlayer[];
    deckCount: number;
    top: Card | null;
    held: Card | null;
    me: string;
};
