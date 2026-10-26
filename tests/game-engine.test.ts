import { test } from 'node:test';
import assert from 'node:assert/strict';
import { act, createRoom, deck, player, points, startRound, tick, view } from '../src/lib/game-engine';
import type { Card, Room } from '../src/types/game';
import { slotPosition } from '../src/lib/grid';
function setup(n = 2) { const ps = Array.from({ length: n }, (_, i) => player(`Joueur ${i}`)); const r = createRoom('123456', ps[0], { rounds: 5, seconds: 25, limit: 0 }); r.players = ps; startRound(r); for (const p of ps)
    act(r, p, { type: 'memorized' }); return r; }
const card = (rank: number, suit: Card['suit'] = '♥'): Card => ({ id: crypto.randomUUID(), rank, suit });
test('52/104 cartes uniques et valeur des rois', () => { assert.equal(deck(1).length, 52); assert.equal(new Set(deck(2).map(c => c.id)).size, 104); assert.equal(points(card(13)), 0); assert.equal(points(card(13, '♠')), 13); assert.equal(setup(5).deck.length, 83); });
test('projection privée : mémoire, carte piochée, tokens et deck', () => { const r = setup(); startRound(r); const p = r.players[0], other = r.players[1]; assert.equal(view(r, p).players[0].slots.filter(s => s.card).length, 2); assert.equal(view(r, other).players[0].slots.filter(s => s.card).length, 0); assert.ok(!JSON.stringify(view(r, p)).includes(p.token)); assert.ok(!('deck' in view(r, p))); for (const x of r.players)
    act(r, x, { type: 'memorized' }); act(r, r.players[r.active], { type: 'draw' }); assert.ok(view(r, r.players[r.active]).held); assert.equal(view(r, r.players[(r.active + 1) % 2]).held, null); });
test('prendre la défausse impose un remplacement, y compris au timeout', () => { const r = setup(), p = r.players[0]; act(r, p, { type: 'take' }); assert.throws(() => act(r, p, { type: 'discard' })); const held = r.held; r.deadline = 0; tick(r); assert.equal(p.slots[0].card?.id, held?.id); });
test('coupe ratée : carte conservée et pénalité cachée', () => { const r = setup(), p = r.players[1]; r.discard = [card(7)]; p.slots[0].card = card(8); const id = p.slots[0].card.id; act(r, p, { type: 'snap', target: { player: p.id, slot: p.slots[0].id }, top: r.discard[0].id }); assert.equal(p.slots.length, 5); assert.equal(p.slots[0].card?.id, id); assert.equal(view(r, p).players[1].slots[4].card, null); });
test('coupe adverse : don obligatoire et défausse périmée rejetée', () => { const r = setup(), p = r.players[1], other = r.players[0]; r.discard = [card(7)]; other.slots[0].card = card(7); const top = r.discard[0].id; act(r, p, { type: 'snap', target: { player: other.id, slot: other.slots[0].id }, top }); assert.ok(r.gift); assert.throws(() => act(r, other, { type: 'draw' })); const given = p.slots[0].card; act(r, p, { type: 'give', target: { player: p.id, slot: p.slots[0].id } }); assert.equal(other.slots[0].card?.id, given?.id); assert.equal(p.slots.filter(s => s.card).length, 3); assert.throws(() => act(r, p, { type: 'snap', target: { player: p.id, slot: p.slots[1].id }, top })); });
test('Dame privée et Valet échange les positions sans dévoiler', () => { const r = setup(), p = r.players[0], other = r.players[1]; r.step = 'queen'; act(r, p, { type: 'peek', target: { player: other.id, slot: other.slots[0].id } }); assert.ok(view(r, p).players[1].slots[0].card); assert.equal(view(r, other).players[1].slots[0].card, null); r.reveals = []; r.step = 'jack'; const a = p.slots[0].card, b = other.slots[0].card; act(r, p, { type: 'swap', target: { player: p.id, slot: p.slots[0].id }, second: { player: other.id, slot: other.slots[0].id } }); assert.equal(p.slots[0].card, b); assert.equal(other.slots[0].card, a); assert.ok(r.swap); });
test('10 rejoue, puis passe la main', () => { const r = setup(), p = r.players[0]; r.held = card(10); r.step = 'held'; act(r, p, { type: 'discard' }); act(r, p, { type: 'end' }); assert.equal(r.active, 0); r.step = 'end'; act(r, p, { type: 'end' }); assert.equal(r.active, 1); });
function scoreRound(values: number[], caller = 0) { const r = setup(values.length); r.players.forEach((p, i) => { p.slots = [{ id: crypto.randomUUID(), card: card(values[i]) }]; }); r.active = caller; r.step = 'end'; act(r, r.players[caller], { type: 'dutch' }); while (r.phase === 'playing') {
    r.step = 'end';
    act(r, r.players[r.active], { type: 'end' });
} return r; }
test('Dutch : dernier tour unique, strict minimum, égalité et zéro', () => { let r = scoreRound([2, 3, 4]); assert.equal(r.results[r.players[0].id], 2); r = scoreRound([4, 4]); assert.equal(r.results[r.players[0].id], 8); r = scoreRound([13, 13]); assert.equal(r.results[r.players[0].id], 10); });
test('coupe de Dame interrompt puis restaure le tour et la carte privée', () => { const r = setup(), p = r.players[1], active = r.players[0]; r.discard = [card(12)]; p.slots[0].card = card(12); act(r, active, { type: 'draw' }); const held = r.held; act(r, p, { type: 'snap', target: { player: p.id, slot: p.slots[0].id }, top: r.discard.at(-1)!.id }); assert.equal(r.active, 1); assert.equal(r.step, 'queen'); assert.ok(!JSON.stringify(view(r, p)).includes(held!.id)); act(r, p, { type: 'peek', target: { player: active.id, slot: active.slots[0].id } }); act(r, p, { type: 'end' }); assert.equal(r.active, 0); assert.equal(r.held?.id, held?.id); });

test('déplacement partagé hors tour, sans dévoiler ni changer la carte', () => {
    const r = setup(), p = r.players[1], s = p.slots[0], original = s.card;
    const before = { active: r.active, step: r.step, deadline: r.deadline };
    act(r, p, { type: 'move', target: { player: p.id, slot: s.id }, position: { col: 3, row: 2 } });
    assert.equal(s.card, original);
    assert.deepEqual(slotPosition(s, 0), { col: 3, row: 2 });
    const otherView = view(r, r.players[0]).players[1].slots[0];
    assert.equal(otherView.card, null);
    assert.deepEqual(otherView.position, { col: 3, row: 2 });
    assert.deepEqual({ active: r.active, step: r.step, deadline: r.deadline }, before);
});
test('déplacer sur une case occupée permute les emplacements et préserve les identités', () => {
    const r = setup(), p = r.players[0];
    const a = p.slots[0].card, b = p.slots[1].card;
    act(r, p, { type: 'move', target: { player: p.id, slot: p.slots[0].id }, position: { col: 1, row: 0 } });
    assert.equal(p.slots[0].card, a); assert.equal(p.slots[1].card, b);
    assert.deepEqual(p.slots[0].position, { col: 1, row: 0 });
    assert.deepEqual(p.slots[1].position, { col: 0, row: 0 });
});
test('déplacements adverses, positions invalides, mémoire et cartes du crieur interdits', () => {
    const r = setup(), p = r.players[0], other = r.players[1];
    const target = { player: p.id, slot: p.slots[0].id };
    assert.throws(() => act(r, other, { type: 'move', target, position: { col: 0, row: 0 } }));
    for (const position of [{col:-1,row:0},{col:4,row:0},{col:0,row:32},{col:.5,row:0},{col:NaN,row:0}])
        assert.throws(() => act(r,p,{type:'move',target,position}));
    r.caller=p.id;
    assert.throws(() => act(r,p,{type:'move',target,position:{col:3,row:0}}));
    r.caller=null; r.phase='memory';
    assert.throws(() => act(r,p,{type:'move',target,position:{col:3,row:0}}));
});
test('anciens salons sans positions : migration implicite et pénalité sans superposition', () => {
    const r=setup(),p=r.players[1];p.slots.forEach(s=>delete s.position);
    act(r,p,{type:'move',target:{player:p.id,slot:p.slots[0].id},position:{col:1,row:0}});
    r.discard=[card(7)];p.slots[2].card=card(8);
    act(r,p,{type:'snap',target:{player:p.id,slot:p.slots[2].id},top:r.discard[0].id});
    const positions=p.slots.map(slotPosition).map(p=>`${p.col}:${p.row}`);
    assert.equal(new Set(positions).size, positions.length);
});
test('animations publiques : trajet de la pioche et remplacement sans fuite de carte cachée', () => {
    const r=setup(),p=r.players[0],other=r.players[1];
    act(r,p,{type:'draw'});const held=r.held!;
    const drawEvent=view(r,other).motions!.at(-1)!;
    assert.deepEqual(drawEvent.moves[0],{from:{zone:'deck'},to:{zone:'held',player:p.id},face:null});
    assert.ok(!JSON.stringify(drawEvent).includes(held.id));
    const s=p.slots[0],discarded=s.card!;
    act(r,p,{type:'replace',target:{player:p.id,slot:s.id}});
    const moves=view(r,other).motions!.at(-1)!.moves;
    assert.equal(moves.length,2);assert.equal(moves[0].face,null);
    assert.equal(moves[0].to.slot,s.id);assert.equal(moves[1].face?.id,discarded.id);
    assert.equal(view(r,other).players[0].slots[0].card,null);
});
