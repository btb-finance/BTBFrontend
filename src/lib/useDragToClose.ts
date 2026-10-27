'use client';
import { useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent, type MouseEvent as ReactMouseEvent } from 'react';

/** Pulled at least this far, or flicked down this fast (px per ms), the sheet closes; less and it springs back. */
const CLOSE_DISTANCE = 90;
const CLOSE_SPEED = 0.6;

/**
 * Swipe a bottom sheet down to close it. `dragProps` go on the part you grab (the whole sheet when nothing in it
 * scrolls, else its header) and `sheetStyle` on the sheet, which follows the finger down and never up. A tap still
 * taps; a drag never ends in a stray tap on whatever was under the finger.
 */
export function useDragToClose(onClose: () => void) {
  const [offset, setOffset] = useState(0);
  const [dragging, setDragging] = useState(false);
  const start = useRef<{ id: number; y: number; t: number } | null>(null);
  const moved = useRef(false);

  const onPointerDown = (e: ReactPointerEvent<HTMLElement>) => {
    if (e.button !== 0) return;
    start.current = { id: e.pointerId, y: e.clientY, t: performance.now() };
    moved.current = false;
  };
  const onPointerMove = (e: ReactPointerEvent<HTMLElement>) => {
    const s = start.current;
    if (!s || s.id !== e.pointerId) return;
    const dy = Math.max(0, e.clientY - s.y);
    if (!moved.current && dy > 6) {
      moved.current = true;
      setDragging(true);
      e.currentTarget.setPointerCapture(e.pointerId);
    }
    if (moved.current) setOffset(dy);
  };
  const finish = (e: ReactPointerEvent<HTMLElement>) => {
    const s = start.current;
    if (!s || s.id !== e.pointerId) return;
    start.current = null;
    if (!moved.current) return;
    const dy = Math.max(0, e.clientY - s.y);
    const speed = dy / Math.max(1, performance.now() - s.t);
    setDragging(false);
    if (dy > CLOSE_DISTANCE || (dy > 30 && speed > CLOSE_SPEED)) onClose();
    else setOffset(0);
  };
  // A drag that ends over a button must not press it.
  const onClickCapture = (e: ReactMouseEvent<HTMLElement>) => {
    if (moved.current) { e.preventDefault(); e.stopPropagation(); moved.current = false; }
  };

  const dragProps = { onPointerDown, onPointerMove, onPointerUp: finish, onPointerCancel: finish, onClickCapture };
  const sheetStyle: CSSProperties = {
    transform: offset ? `translateY(${offset}px)` : undefined,
    transition: dragging ? 'none' : 'transform 180ms ease',
  };
  return { dragProps, sheetStyle };
}
