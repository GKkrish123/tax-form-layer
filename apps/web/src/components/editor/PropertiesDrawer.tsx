'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronsUpDown, SlidersHorizontal, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PropertyPanel } from './PropertyPanel';
import { VersionPanel } from './VersionPanel';

interface PropertiesDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const MIN_VH = 28;
const MID_VH = 42;
const MAX_VH = 72;

/**
 * Docked (non-modal) bottom sheet for mobile. Lives in the layout flow so the
 * form above stays fully interactive — no overlay, no pointer capture on the PDF.
 * Drag the handle to resize; swipe-feel via snap heights.
 */
export function PropertiesDrawer({ open, onOpenChange }: PropertiesDrawerProps) {
  const [heightVh, setHeightVh] = useState(MID_VH);
  const drag = useRef<{ startY: number; startVh: number } | null>(null);

  useEffect(() => {
    if (open) setHeightVh(MID_VH);
  }, [open]);

  const onHandlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault();
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      drag.current = { startY: e.clientY, startVh: heightVh };
    },
    [heightVh],
  );

  const onHandlePointerMove = useCallback((e: React.PointerEvent) => {
    const st = drag.current;
    if (!st) return;
    const dy = st.startY - e.clientY; // drag up → taller
    const next = Math.min(MAX_VH, Math.max(MIN_VH - 8, st.startVh + (dy / window.innerHeight) * 100));
    setHeightVh(next);
  }, []);

  const onHandlePointerUp = useCallback(
    (e: React.PointerEvent) => {
      const st = drag.current;
      drag.current = null;
      try {
        (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
      if (!st) return;

      // Dismiss if pulled well below the minimum.
      if (heightVh < MIN_VH - 2) {
        onOpenChange(false);
        setHeightVh(MID_VH);
        return;
      }

      // Snap to nearest preset.
      const presets = [MIN_VH, MID_VH, MAX_VH];
      const nearest = presets.reduce((best, p) =>
        Math.abs(p - heightVh) < Math.abs(best - heightVh) ? p : best,
      );
      setHeightVh(nearest);
    },
    [heightVh, onOpenChange],
  );

  if (!open) return null;

  return (
    <section
      className="relative z-30 flex shrink-0 flex-col border-t bg-background shadow-[0_-8px_30px_rgba(15,23,42,0.08)] lg:hidden"
      style={{ height: `${heightVh}vh`, maxHeight: '72vh' }}
      aria-label="Properties"
    >
      <div
        className="flex shrink-0 cursor-ns-resize touch-none flex-col items-center pt-2"
        onPointerDown={onHandlePointerDown}
        onPointerMove={onHandlePointerMove}
        onPointerUp={onHandlePointerUp}
        onPointerCancel={onHandlePointerUp}
      >
        <div className="h-1.5 w-12 rounded-full bg-muted-foreground/35" />
        <div className="flex w-full items-center gap-2 px-3 pb-2 pt-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-md bg-accent text-accent-foreground">
            <SlidersHorizontal className="h-3.5 w-3.5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold leading-none">Properties</p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0"
            aria-label="Close properties"
            onClick={() => onOpenChange(false)}
            onPointerDown={(e) => e.stopPropagation()}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden border-t">
        <div className="scroll-slim min-h-0 flex-1 overflow-y-auto overscroll-contain">
          <PropertyPanel />
        </div>
        <div className="shrink-0 border-t bg-background">
          <VersionPanel />
        </div>
      </div>
    </section>
  );
}
