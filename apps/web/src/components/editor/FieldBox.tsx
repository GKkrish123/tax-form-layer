'use client';

import { memo, useRef } from 'react';
import clsx from 'clsx';
import type { Field, Rect } from '@tax-form-layer/spec';
import { resolveBinding, formatValue, queryJsonPath } from '@tax-form-layer/engine';
import { useEditor } from '@/lib/store';
import type { CanvasGeometry } from './FormCanvas';

function getBinding(field: Field): { path: string | null; isBound: boolean } {
  if (field.type === 'repeat') return { path: field.itemsPath, isBound: true };
  if (!('binding' in field)) return { path: null, isBound: false };
  const b = field.binding;
  if (b.source === 'jsonpath') {
    const isBound = b.path !== '$.' && b.path.length > 2;
    return { path: b.path, isBound };
  }
  if (b.source === 'template') return { path: `"${b.template}"`, isBound: true };
  if (b.source === 'const')    return { path: String(b.value), isBound: true };
  if (b.source === 'pointer')  return { path: b.pointer, isBound: true };
  return { path: null, isBound: false };
}

const FORMAT_BADGE: Record<string, string> = {
  currency: '$',
  percent: '%',
  date: 'date',
  ssn: 'SSN',
  ein: 'EIN',
  phone: 'tel',
  text: 'txt',
};

function formatBadge(field: Field): string | null {
  if (!('format' in field) || !field.format) return null;
  const t = (field.format as { type?: string }).type ?? '';
  return FORMAT_BADGE[t] ?? null;
}

type Corner = 'nw' | 'ne' | 'sw' | 'se';

type DragMode =
  | { kind: 'move'; startX: number; startY: number; rect: Rect }
  | { kind: 'resize'; corner: Corner; startX: number; startY: number; rect: Rect };

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

function FieldBoxImpl({ field, geom }: { field: Field; geom: CanvasGeometry }) {
  const selected = useEditor((s) => s.selectedFieldId === field.id);
  const selectField = useEditor((s) => s.selectField);
  const updateFieldRect = useEditor((s) => s.updateFieldRect);
  const data = useEditor((s) => s.data);

  const elRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<DragMode | null>(null);
  const liveRef = useRef({
    x: field.rect.x,
    y: field.rect.y,
    width: field.rect.width,
    height: field.rect.height,
  });
  const movedRef = useRef(false);

  const editable = field.rect.unit === 'fraction';

  function applyDom(next: { x: number; y: number; width: number; height: number }) {
    const el = elRef.current;
    if (!el) return;
    el.style.left = `${next.x * geom.width}px`;
    el.style.top = `${next.y * geom.height}px`;
    el.style.width = `${next.width * geom.width}px`;
    el.style.height = `${next.height * geom.height}px`;
  }

  function beginMove(e: React.PointerEvent) {
    if (!editable) return;
    e.stopPropagation();
    e.preventDefault();
    selectField(field.id);
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    movedRef.current = false;
    liveRef.current = {
      x: field.rect.x,
      y: field.rect.y,
      width: field.rect.width,
      height: field.rect.height,
    };
    dragRef.current = {
      kind: 'move',
      startX: e.clientX,
      startY: e.clientY,
      rect: { ...field.rect },
    };
    elRef.current?.classList.add('is-dragging');
  }

  function beginResize(corner: Corner) {
    return (e: React.PointerEvent) => {
      if (!editable) return;
      e.stopPropagation();
      e.preventDefault();
      selectField(field.id);
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      movedRef.current = false;
      liveRef.current = {
        x: field.rect.x,
        y: field.rect.y,
        width: field.rect.width,
        height: field.rect.height,
      };
      dragRef.current = {
        kind: 'resize',
        corner,
        startX: e.clientX,
        startY: e.clientY,
        rect: { ...field.rect },
      };
      elRef.current?.classList.add('is-dragging');
    };
  }

  function onPointerMove(e: React.PointerEvent) {
    const st = dragRef.current;
    if (!st) return;
    e.stopPropagation();

    const sx = geom.width * geom.scale;
    const sy = geom.height * geom.scale;
    const dx = (e.clientX - st.startX) / sx;
    const dy = (e.clientY - st.startY) / sy;
    if (Math.abs(e.clientX - st.startX) + Math.abs(e.clientY - st.startY) > 2) {
      movedRef.current = true;
    }

    let next = { ...liveRef.current };
    if (st.kind === 'move') {
      next = {
        ...next,
        x: clamp01(st.rect.x + dx),
        y: clamp01(st.rect.y + dy),
      };
    } else {
      const r = st.rect;
      next = { x: r.x, y: r.y, width: r.width, height: r.height };
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
    }

    liveRef.current = next;
    applyDom(next);
  }

  function endDrag(e: React.PointerEvent) {
    const st = dragRef.current;
    if (!st) return;
    e.stopPropagation();
    dragRef.current = null;
    elRef.current?.classList.remove('is-dragging');
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      /* no-op */
    }

    const live = liveRef.current;
    updateFieldRect(field.id, {
      x: live.x,
      y: live.y,
      width: live.width,
      height: live.height,
    });
  }

  const left = field.rect.x * geom.width;
  const top = field.rect.y * geom.height;
  const width = field.rect.width * geom.width;
  const height = field.rect.height * geom.height;

  const { path: bindingPath, isBound } = getBinding(field);
  const badge = formatBadge(field);
  const pathLabel = bindingPath
    ? isBound
      ? bindingPath.replace(/^\$\.?/, '')
      : 'unbound'
    : null;

  const liveValue = (() => {
    try {
      if (field.type === 'repeat') {
        const items = queryJsonPath(field.itemsPath, { root: data });
        if (!Array.isArray(items)) return 'no data';
        const shown = field.maxRows ? Math.min(items.length, field.maxRows) : items.length;
        return `${shown} row${shown !== 1 ? 's' : ''}${field.maxRows && items.length > field.maxRows ? ` of ${items.length}` : ''}`;
      }
      if (!('binding' in field)) return null;
      const raw = resolveBinding(field.binding, { root: data });
      if (raw === undefined || raw === null) return null;
      const fmt = 'format' in field ? field.format : undefined;
      const formatted = fmt
        ? formatValue(
            typeof raw === 'object' ? JSON.stringify(raw) : (raw as string | number | boolean),
            fmt,
          )
        : String(raw);
      return formatted !== null && formatted !== undefined && String(formatted).trim() !== ''
        ? String(formatted)
        : null;
    } catch {
      return null;
    }
  })();

  return (
    <div
      ref={elRef}
      role="button"
      tabIndex={0}
      onPointerDown={beginMove}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onClick={(e) => {
        e.stopPropagation();
        if (movedRef.current) return;
        selectField(field.id);
      }}
      className={clsx(
        'field-box group absolute box-border cursor-move rounded-[3px] border',
        TYPE_COLORS[field.type],
        selected
          ? 'z-10 border-transparent ring-2 ring-primary ring-offset-1'
          : 'hover:shadow-md hover:ring-1 hover:ring-slate-400/50',
        !editable && 'cursor-not-allowed opacity-70',
      )}
      style={{ left, top, width, height }}
      title={
        [field.label ?? field.id, bindingPath ? `→ ${bindingPath}` : null]
          .filter(Boolean)
          .join('  ')
      }
    >
      <span
        className={clsx(
          'pointer-events-none absolute -top-[22px] left-0 z-20 max-w-[240px] truncate rounded px-1.5 py-0.5 text-[10px] font-medium text-white shadow-sm',
          LABEL_COLORS[field.type],
          selected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100',
        )}
      >
        {field.boxNumber ? `${field.boxNumber} · ` : ''}
        {field.label ?? field.id}
      </span>

      {bindingPath !== null && (
        <span
          className={clsx(
            'pointer-events-none absolute right-1 top-1 h-2 w-2 rounded-full shadow-sm',
            isBound ? 'bg-emerald-500' : 'bg-orange-400',
          )}
          title={isBound ? `Bound: ${bindingPath}` : 'Not yet bound'}
        />
      )}

      {badge && (
        <span
          className={clsx(
            'pointer-events-none absolute bottom-0.5 left-0.5 rounded px-1 py-px text-[8px] font-semibold leading-tight opacity-70',
            LABEL_COLORS[field.type],
            'text-white',
          )}
        >
          {badge}
        </span>
      )}

      {pathLabel !== null && (
        <span
          className={clsx(
            'pointer-events-none absolute inset-x-1.5 top-1/2 -translate-y-1/2 truncate text-center font-mono leading-none text-[9px]',
            isBound ? 'text-slate-600/70' : 'text-orange-500/90',
          )}
        >
          {pathLabel}
        </span>
      )}

      {liveValue !== null && (
        <span
          className={clsx(
            'pointer-events-none absolute -bottom-[22px] left-0 z-20 max-w-[240px] truncate rounded px-1.5 py-0.5',
            'bg-slate-700/90 text-[10px] font-mono font-medium text-white shadow-sm',
            selected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100',
          )}
        >
          {liveValue}
        </span>
      )}

      {selected &&
        editable &&
        (['nw', 'ne', 'sw', 'se'] as Corner[]).map((corner) => (
          <span
            key={corner}
            onPointerDown={beginResize(corner)}
            onPointerMove={onPointerMove}
            onPointerUp={endDrag}
            onPointerCancel={endDrag}
            className={clsx(
              'absolute h-2.5 w-2.5 touch-none rounded-full border-2 border-primary bg-white shadow-sm',
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

function rectEqual(a: Rect, b: Rect): boolean {
  return (
    a.x === b.x &&
    a.y === b.y &&
    a.width === b.width &&
    a.height === b.height &&
    a.unit === b.unit &&
    a.rotation === b.rotation
  );
}

export const FieldBox = memo(FieldBoxImpl, (prev, next) => {
  if (
    prev.geom.width !== next.geom.width ||
    prev.geom.height !== next.geom.height ||
    prev.geom.scale !== next.geom.scale
  ) {
    return false;
  }
  if (prev.field === next.field) return true;
  const pb = getBinding(prev.field);
  const nb = getBinding(next.field);
  return (
    prev.field.id === next.field.id &&
    prev.field.type === next.field.type &&
    prev.field.label === next.field.label &&
    prev.field.boxNumber === next.field.boxNumber &&
    pb.path === nb.path &&
    pb.isBound === nb.isBound &&
    rectEqual(prev.field.rect, next.field.rect)
  );
});

function clamp01(v: number): number {
  return Math.min(1, Math.max(0, v));
}
