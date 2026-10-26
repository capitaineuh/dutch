'use client';
import { useLayoutEffect, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import type { CardLocation, MotionEvent, View } from '@/types/game';
import { PlayingCard } from './playing-card';

export function locationKey(location: CardLocation) {
    return location.zone === 'slot' ? `slot:${location.slot}` : location.zone === 'held' ? `held:${location.player}` : location.zone;
}
function elementAt(location: CardLocation): HTMLElement | null {
    return document.querySelector(`[data-motion="${CSS.escape(locationKey(location))}"]`);
}
export function CardMovements({ view }: { view: View | null }) {
    const seen = useRef(new Set<string>());
    const context = useRef('');
    const [queue, setQueue] = useState<MotionEvent[]>([]);
    useLayoutEffect(() => {
        const key = view ? `${view.pin}:${view.round}` : '';
        const events = view?.motions ?? [];
        if (context.current !== key) {
            context.current = key;
            seen.current = new Set(events.map(e => e.id));
            setQueue([]);
            return;
        }
        const fresh = events.filter(e => !seen.current.has(e.id));
        fresh.forEach(e => seen.current.add(e.id));
        if (seen.current.size > 256) seen.current = new Set(events.map(e => e.id));
        if (fresh.length) setQueue(previous => [...previous, ...fresh]);
    }, [view]);
    return queue[0] ? <Movement key={queue[0].id} event={queue[0]} complete={() => setQueue(previous => previous.slice(1))} /> : null;
}
function Movement({ event, complete }: { event: MotionEvent; complete: () => void }) {
    const reduced = useReducedMotion();
    const [rects, setRects] = useState<{ from: DOMRect; to: DOMRect; index: number }[]>([]);
    const finished = useRef(complete);
    finished.current = complete;
    useLayoutEffect(() => {
        const destinations: HTMLElement[] = [];
        const measured = event.moves.flatMap((move, index) => {
            const source = elementAt(move.from), destination = elementAt(move.to);
            if (!source || !destination) return [];
            destinations.push(destination);
            if (!reduced) destination.dataset.incoming = event.id;
            return [{ from: source.getBoundingClientRect(), to: destination.getBoundingClientRect(), index }];
        });
        setRects(measured);
        const finish = setTimeout(() => {
            destinations.forEach(node => {
                if (node.dataset.incoming === event.id) delete node.dataset.incoming;
                node.dataset.arrived = event.id;
                setTimeout(() => { if (node.dataset.arrived === event.id) delete node.dataset.arrived; }, 850);
            });
            finished.current();
        }, reduced || !measured.length ? 30 : 620);
        return () => { clearTimeout(finish); destinations.forEach(node => { if (node.dataset.incoming === event.id) delete node.dataset.incoming; }); };
    }, [event, reduced]);
    if (reduced) return null;
    return <div className="card-flight-layer" aria-hidden="true">{rects.map(({ from, to, index }) => <motion.div key={index} className="card-flight"
        initial={{ left: from.left, top: from.top, width: from.width, height: from.height, rotate: -6, opacity: 1 }}
        animate={{ left: to.left, top: to.top, width: to.width, height: to.height, rotate: 0, opacity: 1 }}
        transition={{ duration: .58, ease: [.22, .68, .24, 1] }}>
        <PlayingCard card={event.moves[index].face} />
    </motion.div>)}</div>;
}
