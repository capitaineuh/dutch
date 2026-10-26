import { randomInt, randomUUID } from 'node:crypto';
import { slotPosition, validPosition, freePosition } from './grid';
import { motionEvent, atSlot, atHeld } from './motions';
import type { Action, Card, Player, Room, Suit, Target, View } from '@/types/game';
export const points = (c: Card) => c.rank === 13 && (c.suit === '♥' || c.suit === '♦') ? 0 : c.rank;
const fail = (message: string): never => { throw new Error(message); };
export function deck(count: number): Card[] { const cards: Card[] = []; for (let d = 0; d < count; d++)
    for (const suit of ['♥', '♦', '♣', '♠'] as Suit[])
        for (let rank = 1; rank <= 13; rank++)
            cards.push({ id: randomUUID(), rank, suit }); for (let i = cards.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [cards[i], cards[j]] = [cards[j], cards[i]];
} return cards; }
export function player(name: string): Player { if (typeof name !== 'string' || !name.trim() || name.trim().length > 24)
    fail('Pseudo requis (24 caractères maximum).'); return { id: randomUUID(), token: randomUUID(), name: name.trim(), score: 0, ready: false, seen: false, lastSeen: Date.now(), slots: [] }; }
export function createRoom(pin: string, p: Player, settings: Room['settings']): Room { return { pin, host: p.id, players: [p], phase: 'lobby', round: 0, settings: { rounds: Math.max(1, Math.min(20, Number(settings.rounds) || 5)), seconds: Math.max(10, Math.min(120, Number(settings.seconds) || 25)), limit: Math.max(0, Math.min(1000, Number(settings.limit) || 0)) }, deck: [], discard: [], active: 0, step: 'draw', held: null, source: 'deck', deadline: 0, caller: null, remaining: [], extra: false, gift: null, reveals: [], logs: [], results: {}, version: 0, swap: null }; }
function log(r: Room, text: string) { r.logs.unshift({ id: randomUUID(), text, at: Date.now() }); r.logs = r.logs.slice(0, 80); }
function timer(r: Room) { r.deadline = Date.now() + r.settings.seconds * 1000; }
export function startRound(r: Room) { r.motions = []; r.suspended = []; r.round++; r.deck = deck(r.players.length > 4 ? 2 : 1); r.discard = []; r.caller = null; r.remaining = []; r.gift = null; r.held = null; r.extra = false; r.reveals = []; r.results = {}; r.active = (r.round - 1) % r.players.length; r.step = 'draw'; for (const p of r.players) {
    p.seen = false;
    p.slots = Array.from({ length: 4 }, (_, i) => ({ id: randomUUID(), card: r.deck.pop()!, position: {col:i%2,row:Math.floor(i/2)} }));
} r.discard.push(r.deck.pop()!); r.phase = 'memory'; r.deadline = Date.now() + 15000; log(r, `Manche ${r.round} : mémorisez vos deux cartes du bas.`); }
function draw(r: Room): Card { if (!r.deck.length) {
    const top = r.discard.pop();
    r.deck = r.discard;
    r.discard = top ? [top] : [];
    for (let i = r.deck.length - 1; i > 0; i--) {
        const j = randomInt(i + 1);
        [r.deck[i], r.deck[j]] = [r.deck[j], r.deck[i]];
    }
} return r.deck.pop() ?? fail('La pioche est épuisée.'); }
function slot(r: Room, t?: Target) { const p = r.players.find(p => p.id === t?.player) ?? fail('Joueur inconnu.'); const s = p.slots.find(s => s.id === t?.slot) ?? fail('Emplacement inconnu.'); if (!s.card)
    fail('Emplacement vide.'); return { p, s }; }
function reveal(r: Room, c: Card, audience: string, ms = 4000) { r.reveals.push({ audience, card: c.id, until: Date.now() + ms }); }
function finish(r: Room) { const raw = Object.fromEntries(r.players.map(p => [p.id, p.slots.reduce((n, s) => n + (s.card ? points(s.card) : 0), 0)])); if (r.caller && r.players.some(p => p.id !== r.caller && raw[p.id] <= raw[r.caller!]))
    raw[r.caller] = raw[r.caller] === 0 ? 10 : raw[r.caller] * 2; r.results = raw; for (const p of r.players)
    p.score += raw[p.id]; r.phase = r.round >= r.settings.rounds || (r.settings.limit > 0 && r.players.some(p => p.score >= r.settings.limit)) ? 'finished' : 'results'; log(r, 'Fin de manche : toutes les cartes sont révélées.'); }
function advance(r: Room) { if (r.suspended?.length) {
    const previous = r.suspended.pop()!;
    Object.assign(r, previous);
    timer(r);
    return;
} const current = r.players[r.active]; if (r.caller)
    r.remaining = r.remaining.filter(id => id !== current.id); if (r.caller && !r.remaining.length) {
    finish(r);
    return;
} if (r.extra && !r.caller) {
    r.extra = false;
}
else {
    do {
        r.active = (r.active + 1) % r.players.length;
    } while (r.players[r.active].id === r.caller);
} r.step = 'draw'; timer(r); }
function call(r: Room, p: Player) { if (r.caller)
    return; r.caller = p.id; r.remaining = r.players.filter(x => x.id !== p.id).map(x => x.id); log(r, `${p.name} crie DUTCH ! Dernier tour.`); if (r.players[r.active].id === p.id)
    advance(r); }
function power(r: Room, c: Card) { r.step = c.rank === 12 ? 'queen' : c.rank === 11 ? 'jack' : 'end'; if (c.rank === 10)
    r.extra = true; timer(r); }
function snapPower(r: Room, p: Player, c: Card) { if (![10, 11, 12].includes(c.rank) || !p.slots.some(s => s.card))
    return; (r.suspended ??= []).push({ active: r.active, step: r.step, held: r.held, source: r.source, extra: r.extra }); r.active = r.players.findIndex(x => x.id === p.id); r.held = null; r.extra = false; power(r, c); if (c.rank === 10) {
    r.step = 'draw';
    r.extra = false;
} }
function auto(r: Room, p: Player) { if (!p.slots.some(s => s.card) && !r.caller)
    call(r, p); }
export function tick(r: Room) { if (r.deadline > Date.now())
    return; if (r.phase === 'memory') {
    for (const p of r.players)
        p.seen = true;
    r.phase = 'playing';
    timer(r);
}
else if (r.phase === 'playing') {
    if (r.gift) {
        const actor = r.players.find(p => p.id === r.gift!.actor)!;
        const own = actor.slots.find(s => s.card);
        if (own)
            give(r, actor, { player: actor.id, slot: own.id });
        else
            r.gift = null;
    }
    if (r.phase !== 'playing')
        return;
    if (r.held) {
        if (r.source === 'discard') {
            const own = r.players[r.active].slots.find(s => s.card);
            if (own) {
                const replaced = own.card!;
                motionEvent(r,{from:atHeld(r.players[r.active].id),to:atSlot({player:r.players[r.active].id,slot:own.id}),face:null},{from:atSlot({player:r.players[r.active].id,slot:own.id}),to:{zone:'discard'},face:replaced});
                own.card = r.held;
                r.held = null;
                r.discard.push(replaced);
                power(r, replaced);
                return;
            }
        }
        const c = r.held;
        r.held = null;
        r.discard.push(c);
        motionEvent(r,{from:atHeld(r.players[r.active].id),to:{zone:'discard'},face:c});
        power(r, c);
        return;
    }
    advance(r);
} }
function give(r: Room, p: Player, t?: Target) { if (r.gift?.actor !== p.id)
    fail('Aucun don en attente.'); const own = slot(r, t); if (own.p.id !== p.id)
    fail('Choisissez votre carte.'); const target = r.players.find(x => x.id === r.gift!.target.player)!.slots.find(s => s.id === r.gift!.target.slot)!; motionEvent(r, {from:atSlot(t!),to:atSlot(r.gift!.target),face:null}); target.card = own.s.card; own.s.card = null; r.gift = null; const top = r.discard.at(-1); if (top)
    snapPower(r, p, top); auto(r, p); }
export function act(r: Room, p: Player, a: Action) {
    tick(r);
    p.lastSeen = Date.now();
    if (a.type === 'ready' && r.phase === 'lobby') {
        p.ready = !p.ready;
        return;
    }
    if (a.type === 'start' || a.type === 'next') {
        if (p.id !== r.host)
            fail('Action réservée à l’hôte.');
        if (a.type === 'start' && (r.phase !== 'lobby' || r.players.length < 2))
            fail('Il faut au moins deux joueurs.');
        if (a.type === 'next' && r.phase !== 'results')
            fail('Manche indisponible.');
        startRound(r);
        return;
    }
    if (a.type === 'memorized' && r.phase === 'memory') {
        p.seen = true;
        if (r.players.every(x => x.seen)) {
            r.phase = 'playing';
            timer(r);
        }
        return;
    }
    if (r.phase !== 'playing')
        fail('La manche n’est pas en cours.');
    if (a.type === 'move') {
        if (p.id === r.caller || r.gift) fail('Vos cartes ne peuvent pas ?tre d?plac?es maintenant.');
        if (!validPosition(a.position)) fail('Position de grille invalide.');
        const own = slot(r, a.target);
        if (own.p.id !== p.id) fail('Vous pouvez uniquement d?placer vos propres cartes.');
        const before = slotPosition(own.s, p.slots.indexOf(own.s));
        const destination = a.position!;
        const other = p.slots.find((s,i) => {const pos=slotPosition(s,i); return s!==own.s && pos.col===destination.col && pos.row===destination.row;});
        if (other) other.position = before;
        own.s.position = destination;
        return;
    }
    if (a.type === 'give') {
        give(r, p, a.target);
        return;
    }
    if (r.gift)
        fail('Un don de carte doit être résolu.');
    if (a.type === 'snap') {
        if (p.id === r.caller)
            fail('Vos cartes sont verrouillées.');
        const top = r.discard.at(-1);
        if (!top || top.id !== a.top)
            fail('La défausse a changé, réessayez.');
        const { p: owner, s } = slot(r, a.target);
        if (owner.id === r.caller)
            fail('Les cartes du crieur sont verrouillées.');
        if (s.card!.rank !== top!.rank) {
            reveal(r, s.card!, '*', 1800);
            const penalty = { id: randomUUID(), card: draw(r), position: freePosition(p.slots) };
            p.slots.push(penalty);
            motionEvent(r, {from:{zone:'deck'},to:atSlot({player:p.id,slot:penalty.id}),face:null});
            log(r, `${p.name} manque sa coupe : une carte de pénalité.`);
            return;
        }
        if (owner.id !== p.id && !p.slots.some(s => s.card))
            fail('Vous n’avez aucune carte à donner.');
        const c = s.card!;
        s.card = null;
        r.discard.push(c);
        motionEvent(r, {from:atSlot(a.target!),to:{zone:'discard'},face:c});
        log(r, `${p.name} coupe avec succès !`);
        if (owner.id !== p.id) {
            r.gift = { actor: p.id, target: a.target! };
            timer(r);
        }
        else {
            snapPower(r, p, c);
            auto(r, p);
        }
        return;
    }
    if (r.players[r.active].id !== p.id)
        fail('Ce n’est pas votre tour.');
    switch (a.type) {
        case 'draw':
        case 'take':
            if (r.step !== 'draw')
                fail('Action indisponible.');
            r.held = a.type === 'draw' ? draw(r) : (r.discard.pop() ?? fail('Défausse vide.'));
            r.source = a.type === 'draw' ? 'deck' : 'discard';
            r.step = 'held';
            motionEvent(r, {from:{zone:a.type==='draw'?'deck':'discard'},to:atHeld(p.id),face:a.type==='take'?r.held:null});
            log(r, `${p.name} ${a.type === 'draw' ? 'pioche une carte face cachée' : 'prend la défausse'}.`);
            break;
        case 'replace': {
            if (r.step !== 'held' || !r.held)
                fail('Piochez d’abord.');
            const { p: owner, s } = slot(r, a.target);
            if (owner.id !== p.id)
                fail('Choisissez une de vos cartes.');
            const c = s.card!;
            motionEvent(r, {from:atHeld(p.id),to:atSlot(a.target!),face:null}, {from:atSlot(a.target!),to:{zone:'discard'},face:c});
            s.card = r.held;
            r.held = null;
            r.discard.push(c);
            log(r, `${p.name} défausse ${label(c)}.`);
            power(r, c);
            break;
        }
        case 'discard':
            if (r.step !== 'held' || !r.held || r.source === 'discard')
                fail('Vous devez échanger cette carte.');
            {
                const c = r.held!;
                r.held = null;
                r.discard.push(c);
                motionEvent(r, {from:atHeld(p.id),to:{zone:'discard'},face:c});
                log(r, `${p.name} défausse ${label(c)}.`);
                power(r, c);
            }
            break;
        case 'peek':
            if (r.step !== 'queen')
                fail('Pouvoir indisponible.');
            reveal(r, slot(r, a.target).s.card!, p.id);
            r.step = 'end';
            log(r, `${p.name} utilise la vision de la Dame.`);
            break;
        case 'swap': {
            if (r.step !== 'jack')
                fail('Pouvoir indisponible.');
            const x = slot(r, a.target), y = slot(r, a.second);
            if (x.s === y.s)
                fail('Choisissez deux cartes différentes.');
            [x.s.card, y.s.card] = [y.s.card, x.s.card];
            motionEvent(r, {from:atSlot(a.target!),to:atSlot(a.second!),face:null}, {from:atSlot(a.second!),to:atSlot(a.target!),face:null});
            r.swap = { first: a.target!, second: a.second!, at: Date.now() };
            r.step = 'end';
            log(r, `${p.name} échange deux cartes à l’aveugle.`);
            break;
        }
        case 'end':
            if (r.step !== 'end')
                fail('Terminez votre action.');
            advance(r);
            break;
        case 'dutch':
            if (r.step !== 'end' || r.caller)
                fail('Annoncez Dutch à la fin de votre tour.');
            call(r, p);
            break;
        default: fail('Action invalide.');
    }
}
export function label(c: Card) { return `${({ 1: 'As', 11: 'Valet', 12: 'Dame', 13: 'Roi' } as Record<number, string>)[c.rank] ?? c.rank}${c.suit}`; }
export function view(r: Room, p: Player): View { const { deck: cards, players, held, reveals, discard, suspended, ...rest } = r; return { ...rest, me: p.id, deckCount: cards.length, top: discard.at(-1) ?? null, held: r.players[r.active]?.id === p.id ? held : null, players: players.map(({ token: secret, slots, ...other }) => ({ ...other, slots: slots.map((s, i) => ({ id: s.id, position: slotPosition(s,i), occupied: !!s.card, card: s.card && (r.phase === 'results' || r.phase === 'finished' || (r.phase === 'memory' && other.id === p.id && !other.seen && i >= 2) || reveals.some(v => (v.audience === p.id || v.audience === '*') && v.card === s.card!.id && v.until > Date.now())) ? s.card : null })) })) }; }
