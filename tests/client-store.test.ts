import { test } from 'node:test';
import assert from 'node:assert/strict';
import { useGame } from '../src/lib/client-store';
import type { View } from '../src/types/game';

test('client : un seul polling à la fois, erreurs transitoires silencieuses et ordre des versions', async () => {
    const original=globalThis.fetch;const session={pin:'123456',playerId:'p',token:'t'};
    useGame.setState({session,view:null,busy:false,error:'',connection:'connected'});
    let calls=0;let release!:()=>void;
    const gate=new Promise<void>(resolve=>{release=resolve;});
    const snapshot={version:10,me:'p'} as View;
    globalThis.fetch=async()=>{calls++;await gate;return new Response(JSON.stringify(snapshot));};
    try {
        const one=useGame.getState().poll(),two=useGame.getState().poll();
        assert.equal(one,two);release();await Promise.all([one,two]);assert.equal(calls,1);
        globalThis.fetch=async()=>new Response(JSON.stringify({error:'busy'}),{status:503});
        await useGame.getState().poll();assert.equal(useGame.getState().error,'');assert.equal(useGame.getState().connection,'reconnecting');
        globalThis.fetch=async()=>new Response(JSON.stringify({...snapshot,version:9}));
        await useGame.getState().poll();assert.equal(useGame.getState().view!.version,10);
        useGame.setState({busy:true});globalThis.fetch=async()=>{throw new Error('Must not poll while writing');};
        await useGame.getState().poll();assert.equal(useGame.getState().error,'');
    } finally {globalThis.fetch=original;useGame.setState({session:null,view:null,busy:false});}
});
