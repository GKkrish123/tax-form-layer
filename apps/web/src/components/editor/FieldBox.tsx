'use client';

import { useRef } from 'react';
import clsx from 'clsx';
import type { Field } from '@tax-form-layer/spec';
import { useEditor } from '@/lib/store';
import type { CanvasGeometry } from './FormCanvas';

type Corner = 'nw' | 'ne' | 'sw' | 'se';

const TYPE_COLORS: Record<Field['type'], string> = {
  value: 'border-sky-500/80 bg-sky-500/10',
  checkbox: 'border-emerald-500/80 bg-emerald-500/10',
  comb: 'border-violet-500/80 bg-violet-500/10',
  repeat: 'border-amber-500/80 bg-amber-500/10',
};

const LABEL_COLORS: Record<Field['type'], string> = {
  value: 'bg-sky-600',
  checkbox: 'bg-emerald-600',
  comb: 'bg-violet-600',
  repeat: 'bg-amber-600',
};

export function FieldBox({ field, geom }: { field: Field; geom: CanvasGeometry }) {
  const selected = useEditor((s) => s.selectedFieldId === field.id);
  const selectField = useEditor((s) => s.selectField);
  const updateFieldRect = useEditor((s) => s.updateFieldRect);
  const dragState = useRef<{ startX: number; startY: number; rect: typeof field.rect } | null>(
    null,
  );

  // Only fractional coordinates are directly editable on the canvas.
  const editable = field.rect.unit === 'fraction';
  const left = field.rect.x * geom.width;
  const top = field.rect.y * geom.height;
  const width = field.rect.width * geom.width;
  const height = field.rect.height * geom.height;

  function beginMove(e: React.PointerEvent) {
    if (!editable) return;
    e.stopPropagation();
    selectField(field.id);
    (e.target as Element).setPointerCapture(e.pointerId);
    dragState.current = { startX: e.clientX, startY: e.clientY, rect: { ...field.rect } };
  }

  function onMove(e: React.PointerEvent) {
    const st = dragState.current;
    if (!st) return;
    const dx = (e.clientX - st.startX) / geom.width;
    const dy = (e.clientY - st.startY) / geom.height;
    updateFieldRect(field.id, {
      x: clamp01(st.rect.x + dx),
      y: clamp01(st.rect.y + dy),
    });
  }

  function endDrag(e: React.PointerEvent) {
    dragState.current = null;
    try {
      (e.target as Element).releasePointerCapture(e.pointerId);
    } catch {
      /* no-op */
    }
  }

  function beginResize(corner: Corner) {
    return (e: React.PointerEvent) => {
      if (!editable) return;
      e.stopPropagation();
      selectField(field.id);
      (e.target as Element).setPointerCapture(e.pointerId);
      const start = { startX: e.clientX, startY: e.clientY, rect: { ...field.rect } };
      dragState.current = start;
      (dragState.current as unknown as { corner: Corner }).corner = corner;
    };
  }

  function onResizeMove(e: React.PointerEvent) {
    const st = dragState.current as (typeof dragState.current & { corner?: Corner }) | null;
    if (!st?.corner) return;
    const dx = (e.clientX - st.startX) / geom.width;
    const dy = (e.clientY - st.startY) / geom.height;
    const r = st.rect;
    const next = { x: r.x, y: r.y, width: r.width, height: r.height };
    if (st.corner === 'se') {
      next.width = Math.max(0.01, r.width + dx);
      next.height = Math.max(0.01, r.height + dy);
    } else if (st.corner === 'ne') {
      next.width = Math.max(0.01, r.width + dx);
      next.height = Math.max(0.01, r.height - dy);
      next.y = r.y + dy;
    } else if (st.corner === 'sw') {
      next.width = Math.max(0.01, r.width - dx);
      next.height = Math.max(0.01, r.height + dy);
      next.x = r.x + dx;
    } else {
      next.width = Math.max(0.01, r.width - dx);
      next.height = Math.max(0.01, r.height - dy);
      next.x = r.x + dx;
      next.y = r.y + dy;
    }
    updateFieldRect(field.id, next);
  }

  const handlePointerMove = (e: React.PointerEvent) => {
    const st = dragState.current as (typeof dragState.current & { corner?: Corner }) | null;
    if (st?.corner) onResizeMove(e);
    else onMove(e);
  };

  return (
    <div
      role="button"
      tabIndex={0}
      onPointerDown={beginMove}
      onPointerMove={handlePointerMove}
      onPointerUp={endDrag}
      onClick={(e) => {
        e.stopPropagation();
        selectField(field.id);
      }}
      className={clsx(
        'group absolute box-border cursor-move rounded-[3px] border transition-shadow',
        TYPE_COLORS[field.type],
        selected
          ? 'z-10 border-transparent ring-2 ring-primary ring-offset-1'
          : 'hover:shadow-md hover:ring-1 hover:ring-slate-400/50',
        !editable && 'cursor-not-allowed opacity-70',
      )}
      style={{ left, top, width, height }}
      title={field.label ?? field.id}
    >
      <span
        className={clsx(
          'pointer-events-none absolute -top-5 left-0 z-20 max-w-[220px] truncate rounded px-1.5 py-0.5 text-[9px] font-medium text-white shadow-sm transition-opacity',
          LABEL_COLORS[field.type],
          selected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100',
        )}
      >
        {field.boxNumber ? `${field.boxNumber} · ` : ''}
        {field.id}
      </span>
      {selected &&
        editable &&
        (['nw', 'ne', 'sw', 'se'] as Corner[]).map((corner) => (
          <span
            key={corner}
            onPointerDown={beginResize(corner)}
            onPointerMove={onResizeMove}
            onPointerUp={endDrag}
            className={clsx(
              'absolute h-2.5 w-2.5 rounded-full border-2 border-primary bg-white shadow-sm',
              corner === 'nw' && '-left-1.5 -top-1.5 cursor-nwse-resize',
              corner === 'ne' && '-right-1.5 -top-1.5 cursor-nesw-resize',
              corner === 'sw' && '-bottom-1.5 -left-1.5 cursor-nesw-resize',
              corner === 'se' && '-bottom-1.5 -right-1.5 cursor-nwse-resize',
            )}
          />
        ))}
    </div>
  );
}

function clamp01(v: number): number {
  return Math.min(1, Math.max(0, v));
}
