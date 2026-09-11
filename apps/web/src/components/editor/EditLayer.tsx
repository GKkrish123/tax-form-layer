'use client';

import { useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { compileTemplate } from '@tax-form-layer/engine';
import { useEditor } from '@/lib/store';
import { FieldBox } from './FieldBox';
import type { CanvasGeometry } from './FormCanvas';
import type { Field, Issue } from '@tax-form-layer/spec';

const EMPTY: never[] = [];

function bareFieldId(fieldId: string): string {
  const withoutCopy = fieldId.includes(':') ? fieldId.split(':').slice(1).join(':') : fieldId;
  return withoutCopy.split('[')[0] ?? withoutCopy;
}

export function EditLayer({ geom }: { geom: CanvasGeometry }) {
  const template = useEditor((s) => s.template);
  const data = useEditor((s) => s.data);
  const fields = useEditor((s) => {
    const page = s.template.pages.find((p) => p.number === s.activePage);
    return page?.fields ?? EMPTY;
  });
  const ghostFields = useEditor((s) => s.ghostFields);
  const guides = useEditor((s) => s.guides);
  const tool = useEditor((s) => s.tool);
  const selectField = useEditor((s) => s.selectField);
  const addField = useEditor((s) => s.addField);
  const setTool = useEditor((s) => s.setTool);
  const layerRef = useRef<HTMLDivElement>(null);
  const [marquee, setMarquee] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const drag = useRef<{
    kind: 'marquee' | 'draw';
    x0: number;
    y0: number;
  } | null>(null);

  const issuesByField = useMemo(() => {
    const map = new Map<string, Issue>();
    try {
      const { issues } = compileTemplate(template, data);
      for (const issue of issues) {
        if (!issue.fieldId) continue;
        const id = bareFieldId(issue.fieldId);
        const existing = map.get(id);
        if (!existing || issue.severity === 'error') map.set(id, issue);
      }
    } catch {
      /* invalid template */
    }
    return map;
  }, [template, data]);

  function fracFromEvent(e: React.PointerEvent) {
    const el = layerRef.current;
    if (!el) return { x: 0, y: 0 };
    const r = el.getBoundingClientRect();
    return {
      x: (e.clientX - r.left) / r.width,
      y: (e.clientY - r.top) / r.height,
    };
  }

  return (
    <div
      ref={layerRef}
      className="absolute inset-0"
      onPointerDown={(e) => {
        if (e.target !== e.currentTarget) return;
        const p = fracFromEvent(e);
        if (tool === 'draw') {
          drag.current = { kind: 'draw', x0: p.x, y0: p.y };
          setMarquee({ x: p.x, y: p.y, w: 0, h: 0 });
          (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
          return;
        }
        selectField(null);
        drag.current = { kind: 'marquee', x0: p.x, y0: p.y };
        setMarquee({ x: p.x, y: p.y, w: 0, h: 0 });
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      }}
      onPointerMove={(e) => {
        if (!drag.current) return;
        const p = fracFromEvent(e);
        const x = Math.min(drag.current.x0, p.x);
        const y = Math.min(drag.current.y0, p.y);
        setMarquee({
          x,
          y,
          w: Math.abs(p.x - drag.current.x0),
          h: Math.abs(p.y - drag.current.y0),
        });
      }}
      onPointerUp={() => {
        if (!drag.current || !marquee) {
          drag.current = null;
          setMarquee(null);
          return;
        }
        if (drag.current.kind === 'draw' && marquee.w > 0.01 && marquee.h > 0.008) {
          const field: Field = {
            type: 'value',
            id: `value_${Math.random().toString(36).slice(2, 7)}`,
            rect: {
              x: marquee.x,
              y: marquee.y,
              width: marquee.w,
              height: marquee.h,
              rotation: 0,
              unit: 'fraction',
            },
            binding: { source: 'jsonpath', path: '$.' },
            format: { type: 'none' },
          };
          addField(field);
          setTool('pointer');
        }
        if (drag.current.kind === 'marquee') {
          const hits = fields.filter((f) => overlaps(f.rect, marquee)).map((f) => f.id);
          useEditor.setState({
            selectedFieldIds: hits,
            selectedFieldId: hits[hits.length - 1] ?? null,
          });
        }
        drag.current = null;
        setMarquee(null);
      }}
      onDragOver={(e) => {
        if (e.dataTransfer.types.includes('text/jsonpath')) e.preventDefault();
      }}
      onDrop={(e) => {
        const path = e.dataTransfer.getData('text/jsonpath');
        if (!path) return;
        e.preventDefault();
        void navigator.clipboard?.writeText(path);
        toast.info('JSONPath copied', { description: path });
      }}
    >
      {ghostFields?.map((field) => (
        <div
          key={`ghost-${field.id}`}
          className="pointer-events-none absolute border border-dashed border-indigo-400/70 bg-indigo-400/10"
          style={{
            left: field.rect.x * geom.width,
            top: field.rect.y * geom.height,
            width: field.rect.width * geom.width,
            height: field.rect.height * geom.height,
          }}
        />
      ))}
      {fields.map((field) => (
        <FieldBox key={field.id} field={field} geom={geom} issue={issuesByField.get(field.id)} />
      ))}
      {guides.map((g, i) =>
        g.x !== undefined ? (
          <div
            key={`gx-${i}`}
            className="pointer-events-none absolute top-0 h-full w-px bg-fuchsia-500"
            style={{ left: g.x * geom.width }}
          />
        ) : (
          <div
            key={`gy-${i}`}
            className="pointer-events-none absolute left-0 h-px w-full bg-fuchsia-500"
            style={{ top: (g.y ?? 0) * geom.height }}
          />
        ),
      )}
      {marquee && (
        <div
          className="pointer-events-none absolute border border-primary/70 bg-primary/10"
          style={{
            left: marquee.x * geom.width,
            top: marquee.y * geom.height,
            width: marquee.w * geom.width,
            height: marquee.h * geom.height,
          }}
        />
      )}
    </div>
  );
}

function overlaps(
  rect: { x: number; y: number; width: number; height: number },
  m: { x: number; y: number; w: number; h: number },
) {
  return !(
    rect.x > m.x + m.w ||
    rect.x + rect.width < m.x ||
    rect.y > m.y + m.h ||
    rect.y + rect.height < m.y
  );
}
