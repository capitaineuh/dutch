'use client';
import { useEffect, useRef, useState, type PointerEvent } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { Grip, Check } from 'lucide-react';
import type { GridPosition, PublicPlayer, Target } from '@/types/game';
import { GRID_COLUMNS, GRID_MAX_ROWS, slotPosition } from '@/lib/grid';
import { PlayingCard } from './playing-card';

export function HandGrid({ player, self, canOrganize, busy, selected, actionable, choose, move }: {
    player: PublicPlayer; self: boolean; canOrganize: boolean; busy: boolean;
    selected?: string; actionable: boolean; choose: (target: Target) => void;
    move: (slot: string, position: GridPosition) => Promise<boolean>;
}) {
    const [organizing, setOrganizing] = useState(false);
    const [picked, setPicked] = useState<string | null>(null);
    const [optimistic, setOptimistic] = useState<Record<string, GridPosition>>({});
    const [drag, setDrag] = useState<{ slot: string; x: number; y: number; dx: number; dy: number; moving: boolean } | null>(null);
    const grid = useRef<HTMLDivElement>(null);
    const ignoreClick = useRef(false);
    const reduced = useReducedMotion();
    const arranging = organizing && canOrganize;
    useEffect(() => { if (!canOrganize) { setOrganizing(false); setPicked(null); setDrag(null); } }, [canOrganize]);
    useEffect(() => { setPicked(null); }, [player.slots.map(s=>s.id+':'+s.occupied).join(',')]);
    const positions = player.slots.map((slot, i) => optimistic[slot.id] ?? slotPosition(slot, i));
    const columns = arranging ? GRID_COLUMNS : Math.max(2, ...positions.map(p => p.col + 1));
    const usedRows = Math.max(2, ...positions.map(p => p.row + 1));
    const rows = Math.min(GRID_MAX_ROWS, Math.max(usedRows, arranging ? 3 : 2));
    async function commit(slot: string, position: GridPosition) {
        if (!arranging || busy) return;
        const current = player.slots.findIndex(s => s.id === slot);
        const before = positions[current];
        if (before && (before.col !== position.col || before.row !== position.row)) {
            const swapIndex = positions.findIndex((p, i) => i !== current && p.col === position.col && p.row === position.row);
            setOptimistic({ [slot]: position, ...(swapIndex >= 0 ? { [player.slots[swapIndex].id]: before } : {}) });
            try { await move(slot, position); } finally { setOptimistic({}); }
        }
        setPicked(null);
    }
    function pointerDown(event: PointerEvent<HTMLDivElement>, slot: string) {
        if (!arranging || busy || event.button !== 0) return;
        ignoreClick.current = false;
        setDrag({ slot, x: event.clientX, y: event.clientY, dx: 0, dy: 0, moving: false });
    }
    function pointerMove(event: PointerEvent<HTMLDivElement>) {
        if (!drag) return;
        const dx = event.clientX - drag.x, dy = event.clientY - drag.y;
        const moving = drag.moving || Math.hypot(dx, dy) > 6;
        if (moving) { event.currentTarget.setPointerCapture(event.pointerId); event.preventDefault(); ignoreClick.current = true; }
        setDrag({ ...drag, dx, dy, moving });
    }
    function pointerUp(event: PointerEvent<HTMLDivElement>) {
        if (!drag) return;
        if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
        if (drag.moving && grid.current) {
            const rect = grid.current.getBoundingClientRect();
            const style = getComputedStyle(grid.current);
            const cellWidth = parseFloat(style.getPropertyValue('--card-w')) + parseFloat(style.columnGap);
            const cellHeight = parseFloat(style.getPropertyValue('--card-h')) + parseFloat(style.rowGap);
            const col = Math.floor((event.clientX - rect.left + grid.current.scrollLeft) / cellWidth);
            const row = Math.floor((event.clientY - rect.top + grid.current.scrollTop) / cellHeight);
            if (col >= 0 && col < columns && row >= 0 && row < rows) commit(drag.slot, { col, row });
        }
        setDrag(null);
        setTimeout(() => { ignoreClick.current = false; }, 0);
    }
    function click(slot: string, position: GridPosition) {
        if (ignoreClick.current) { ignoreClick.current = false; return; }
        if (arranging) { if (picked && picked !== slot) commit(picked, position); else setPicked(picked === slot ? null : slot); }
        else choose({ player: player.id, slot });
    }
    const emptyCells: GridPosition[] = [];
    if (arranging) for (let row = 0; row < rows; row++) for (let col = 0; col < columns; col++) {
        if (!positions.some(p => p.col === col && p.row === row)) emptyCells.push({ col, row });
    }
    return <div className={`hand-zone ${arranging ? 'is-organizing' : ''}`}>
        <div ref={grid} className={`hand hand-grid ${columns > 2 ? 'hand-grid--wide' : ''}`} style={{ gridTemplateColumns: `repeat(${columns}, var(--card-w))`, gridTemplateRows: `repeat(${rows}, var(--card-h))` }}
            role="group" aria-label={self ? 'Vos cartes' : `Cartes de ${player.name}`}>
            {player.slots.map((s, i) => {
                const p = positions[i]; const dragging = drag?.slot === s.id && drag.moving;
                return <motion.div layout="position" key={s.id} className={`grid-card ${dragging ? 'is-dragging' : ''}`} style={{ gridColumn: p.col + 1, gridRow: p.row + 1, zIndex: dragging ? 20 : 1 }}
                    animate={{ x: dragging ? drag.dx : 0, y: dragging ? drag.dy : 0, scale: dragging ? 1.06 : 1 }} transition={{ duration: reduced ? 0 : dragging ? 0 : .4 }}
                    onPointerDown={e => { if (s.occupied) pointerDown(e, s.id); }} onPointerMove={pointerMove} onPointerUp={pointerUp} onPointerCancel={() => setDrag(null)}>
                    {s.occupied ? <PlayingCard slotId={s.id} card={s.card} small={!self} selected={selected === s.id || picked === s.id}
                        onClick={arranging || (actionable && !busy) ? () => click(s.id, p) : undefined} />
                        : <button type="button" data-motion={`slot:${s.id}`} className="grid-empty" disabled={!arranging || !picked} onClick={() => { if (picked) commit(picked, p); }} aria-label={`Placer ici : colonne ${p.col + 1}, ligne ${p.row + 1}`} />}
                </motion.div>;
            })}
            {emptyCells.map(p => <button type="button" key={`${p.col}:${p.row}`} className="grid-empty" style={{ gridColumn: p.col + 1, gridRow: p.row + 1 }}
                disabled={!picked} onClick={() => { if (picked) commit(picked, p); }} aria-label={`Placer ici : colonne ${p.col + 1}, ligne ${p.row + 1}`} />)}
        </div>
        {self && canOrganize && <button type="button" className={`organize-toggle ${organizing ? 'selected' : ''}`} disabled={busy} onClick={() => { setOrganizing(!organizing); setPicked(null); }}>
            {organizing ? <Check size={12} /> : <Grip size={12} />}{organizing ? 'Terminer le rangement' : 'Organiser mes cartes'}
        </button>}
        {self && arranging && <p className="grid-help">Glissez une carte, ou sélectionnez-la puis sa destination.</p>}
    </div>;
}
