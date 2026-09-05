'use client';

import { useMemo } from 'react';
import { planTemplate, type DrawOp } from '@tax-form-layer/engine';
import type { Style } from '@tax-form-layer/spec';
import { useEditor } from '@/lib/store';
import type { CanvasGeometry } from './FormCanvas';

function fontFamily(font: string | undefined): string {
  if (font?.startsWith('Times')) return 'Georgia, "Times New Roman", serif';
  if (font?.startsWith('Courier')) return 'ui-monospace, Menlo, monospace';
  return 'Helvetica, Arial, sans-serif';
}

function cssJustify(align: Style['align']): string {
  return align === 'right' ? 'flex-end' : align === 'center' ? 'center' : 'flex-start';
}

function cssAlign(v: Style['verticalAlign']): string {
  return v === 'top' ? 'flex-start' : v === 'bottom' ? 'flex-end' : 'center';
}

export function PreviewLayer({ geom }: { geom: CanvasGeometry }) {
  const template = useEditor((s) => s.template);
  const data = useEditor((s) => s.data);
  const activePage = useEditor((s) => s.activePage);

  const ops = useMemo(() => {
    try {
      const plan = planTemplate(template, data);
      return plan.pages.find((p) => p.number === activePage)?.ops ?? [];
    } catch {
      return [] as DrawOp[];
    }
  }, [template, data, activePage]);

  const s = geom.ptToPx;

  return (
    <>
      {ops.map((op, i) => {
        const left = op.rect.x * s;
        const top = op.rect.y * s;
        const width = op.rect.width * s;
        const height = op.rect.height * s;

        if (![left, top, width, height].every(Number.isFinite)) return null;

        if (op.kind === 'text') {
          return (
            <div
              key={`${op.fieldId}-${i}`}
              className="absolute flex overflow-hidden leading-none"
              style={{
                left,
                top,
                width,
                height,
                justifyContent: cssJustify(op.style.align),
                alignItems: cssAlign(op.style.verticalAlign),
                fontFamily: fontFamily(op.style.font),
                fontSize: op.style.fontSize * s,
                color: op.style.color,
                fontWeight: op.style.font?.includes('Bold') ? 700 : 400,
                fontStyle: /Italic|Oblique/.test(op.style.font ?? '') ? 'italic' : 'normal',
                whiteSpace: op.style.overflow === 'wrap' ? 'pre-wrap' : 'nowrap',
              }}
            >
              {op.text}
            </div>
          );
        }

        return (
          <svg
            key={`${op.fieldId}-${i}`}
            className="absolute"
            style={{ left, top, width, height }}
            viewBox="0 0 10 10"
            stroke={op.color}
            strokeWidth={1.4}
            fill={op.mark === 'fill' ? op.color : 'none'}
          >
            {op.mark === 'cross' && (
              <>
                <line x1="1" y1="1" x2="9" y2="9" />
                <line x1="9" y1="1" x2="1" y2="9" />
              </>
            )}
            {op.mark === 'check' && <polyline points="1,5 4,8 9,2" />}
            {op.mark === 'fill' && <rect x="0" y="0" width="10" height="10" />}
            {op.mark === 'text' && (
              <text x="5" y="8" textAnchor="middle" fontSize="8" fill={op.color} stroke="none">
                {op.markText}
              </text>
            )}
          </svg>
        );
      })}
    </>
  );
}
