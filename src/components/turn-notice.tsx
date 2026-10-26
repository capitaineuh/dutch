'use client';
import { useEffect } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { ArrowRight, Clock3, Eye, Layers, WifiOff, Zap } from 'lucide-react';
import type { Action, View } from '@/types/game';

export function TurnNotice({ view, instruction, remaining, busy, reconnecting, action }: {
    view: View; instruction: string; remaining: number; busy: boolean; reconnecting: boolean;
    action: (type: Action['type']) => void;
}) {
    const mine = view.players[view.active]?.id === view.me;
    const memory = view.phase === 'memory';
    const me = view.players.find(p => p.id === view.me)!;
    const attention = memory ? !me.seen : view.gift ? view.gift.actor === view.me : mine;
    const urgent = attention && remaining <= 8;
    const reduced = useReducedMotion();
    useEffect(() => {
        document.title = attention ? 'À vous de jouer ! — Dutch' : 'Dutch — Partie en cours';
        return () => { document.title = 'Dutch'; };
    }, [attention]);
    return <section className={`turn-notice ${attention ? 'needs-action' : ''} ${urgent ? 'urgent' : ''}`} aria-label="Instructions du tour">
        <motion.div className="turn-notice-symbol" animate={!reduced && attention ? { scale: [1, 1.12, 1] } : { scale: 1 }} transition={{ repeat: Infinity, duration: 2 }}><Zap size={22} /></motion.div>
        <div className="turn-notice-copy" aria-live="polite" aria-atomic="true"><strong>{memory ? 'Mémorisez vos cartes' : attention ? 'À vous de jouer !' : `Tour de ${view.players[view.active]?.name}`}</strong><p>{instruction}</p></div>
        {reconnecting && <span className="connection-status" role="status"><WifiOff size={13} /> Reconnexion…</span>}
        <div className="turn-notice-timer" role="timer" aria-label={`${remaining} secondes restantes`}><Clock3 size={15} /><b>{remaining}<small>s</small></b></div>
        <div className="turn-notice-actions">
            {memory && !me.seen && <button className="primary" disabled={busy} onClick={() => action('memorized')}><Eye size={14} /> J’ai mémorisé</button>}
            {!memory && mine && !view.gift && view.step === 'draw' && <><button className="blue" disabled={busy} onClick={() => action('draw')}><Layers size={14} /> Piocher</button><button className="subtle" disabled={busy || !view.top} onClick={() => action('take')}>Prendre la défausse</button></>}
            {!memory && mine && !view.gift && view.step === 'held' && view.source === 'deck' && <button className="subtle" disabled={busy} onClick={() => action('discard')}>Jeter la carte piochée</button>}
            {!memory && mine && !view.gift && view.step === 'end' && <><button className="blue" disabled={busy} onClick={() => action('end')}>Terminer mon tour <ArrowRight size={14} /></button>{!view.caller && <button className="primary" disabled={busy} onClick={() => action('dutch')}><Zap size={14} /> Dutch !</button>}</>}
        </div>
        {attention && <div className="turn-notice-progress" style={{ width: `${Math.min(100, remaining / (memory ? 15 : view.settings.seconds) * 100)}%` }} />}
    </section>;
}
