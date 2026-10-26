'use client';
import { motion, useReducedMotion } from 'framer-motion';
import type { Card } from '@/types/game';
export const cardRank = (c: Card) => ({ 1: 'A', 11: 'J', 12: 'Q', 13: 'K' } as Record<number, string>)[c.rank] ?? c.rank;
export function PlayingCard({ card, onClick, selected = false, small = false, empty = false, slotId, motionKey }: {
    card: Card | null; onClick?: () => void; selected?: boolean; small?: boolean;
    empty?: boolean; slotId?: string; motionKey?: string;
}) {
    const reduced = useReducedMotion();
    const points = card?.rank === 13 && ['♥', '♦'].includes(card.suit) ? 0 : card?.rank;
    return <motion.button type="button" data-slot={slotId} data-motion={motionKey ?? (slotId ? `slot:${slotId}` : undefined)}
        animate={{ rotateY: card ? 0 : 180 }} transition={{ duration: reduced ? 0 : .28 }}
        whileHover={onClick && !reduced ? { y: -3 } : undefined} whileTap={reduced ? undefined : { scale: .97 }}
        onClick={onClick} disabled={!onClick}
        className={`card ${card ? 'face' : 'back'} ${card && ['♥', '♦'].includes(card.suit) ? 'red' : ''} ${selected ? 'selected' : ''} ${small ? 'small' : ''} ${empty ? 'empty' : ''}`}
        aria-label={empty ? 'Emplacement vide' : card ? `${cardRank(card)} ${card.suit}, ${points} points` : 'Carte face cachée'}>
        {!empty && (card ? <><span className="corner">{cardRank(card)}<b>{card.suit}</b></span><span className="suit">{card.suit}</span><span className="corner bottom">{cardRank(card)}<b>{card.suit}</b></span><span className="card-points">{points} pt</span></> : <span className="back-emblem">D</span>)}
    </motion.button>;
}
