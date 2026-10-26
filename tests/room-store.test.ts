import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRoom, player, startRound } from '../src/lib/game-engine';
import type { Room } from '../src/types/game';

test('Redis : lectures concurrentes sans verrou, écritures sérialisées et contention absorbée', async () => {
    const originalFetch = globalThis.fetch;
    process.env.UPSTASH_REDIS_REST_URL = 'https://redis.test';
    process.env.UPSTASH_REDIS_REST_TOKEN = 'test-only';
    const host=player('Alice'), guest=player('Bob');
    const room=createRoom('864201',host,{rounds:5,seconds:25,limit:0});room.players.push(guest);startRound(room);
    const values=new Map<string,string>([['dutch:864201',JSON.stringify(room)]]);
    const commands: unknown[][]=[];
    let busyAttempts=0;
    globalThis.fetch=async (_input, init) => {
        const command=JSON.parse(String(init?.body));commands.push(command);
        const [op,key,value]=command;
        let result:unknown=null;
        if(op==='GET')result=values.get(key)??null;
        if(op==='SET'){
            if(busyAttempts>0)busyAttempts--;
            else if(!values.has(key)){values.set(key,value);result='OK';}
        }
        if(op==='EVAL'){
            const count=command[2],lockKey=command[3];
            if(count===2){const roomKey=command[4],lock=command[5],data=command[6];if(values.get(lockKey)===lock){values.set(roomKey,data);result=1;}else result=0;}
            else {if(values.get(lockKey)===command[4])values.delete(lockKey);result=1;}
        }
        return new Response(JSON.stringify({result}),{headers:{'Content-Type':'application/json'}});
    };
    try {
        const {roomView,SessionError}=await import('../src/lib/room-service');
        const {transact,readRoom}=await import('../src/lib/room-store');
        const snapshots=await Promise.all(Array.from({length:64},()=>roomView(room.pin,host.token)));
        assert.equal(snapshots.length,64);
        assert.ok(commands.every(c=>c[0]==='GET'),'A regular poll must never acquire or write a lock');
        assert.ok(snapshots.every(v=>v.players[1].slots.every(s=>s.card===null)));
        await assert.rejects(()=>roomView(room.pin,'invalid'),SessionError);
        busyAttempts=3;
        await Promise.all(Array.from({length:8},()=>transact(room.pin,r=>{r!.version++;return {room:r!,result:r!.version};})));
        assert.equal((await readRoom(room.pin))!.version,8);
        assert.equal(values.has('dutch:lock:864201'),false);
        // Many observers hit an expired timer together: advance it exactly once.
        const expired=JSON.parse(values.get('dutch:864201')!) as Room;
        expired.deadline=0;values.set('dutch:864201',JSON.stringify(expired));
        await Promise.all(Array.from({length:16},()=>roomView(room.pin,host.token)));
        const final=(await readRoom(room.pin))!;
        assert.equal(final.phase,'playing');assert.equal(final.version,9);
    } finally {globalThis.fetch=originalFetch;delete process.env.UPSTASH_REDIS_REST_URL;delete process.env.UPSTASH_REDIS_REST_TOKEN;}
});
