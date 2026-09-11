'use client';

import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Copy, Files, Plus, Trash2 } from 'lucide-react';
import { useEditor } from '@/lib/store';
import { cn } from '@/lib/utils';

export function PageStrip({ className }: { className?: string }) {
  const pages = useEditor((s) => s.template.pages);
  const activePage = useEditor((s) => s.activePage);
  const setActivePage = useEditor((s) => s.setActivePage);
  const addPage = useEditor((s) => s.addPage);
  const duplicatePage = useEditor((s) => s.duplicatePage);
  const copyFieldsToPage = useEditor((s) => s.copyFieldsToPage);
  const removePage = useEditor((s) => s.removePage);
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const active = pages.find((p) => p.number === activePage);
  const canDelete = pages.length > 1;

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: PointerEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    window.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  function onDuplicate() {
    const count = active?.fields.length ?? 0;
    duplicatePage();
    toast.success('Page duplicated', {
      description: count ? `${count} field${count === 1 ? '' : 's'} copied onto a new page` : 'Empty page created',
    });
  }

  function onCopyTo(target: number) {
    const count = active?.fields.length ?? 0;
    if (!count) {
      toast.info('Nothing to copy', { description: 'This page has no fields yet.' });
      return;
    }
    copyFieldsToPage(target);
    toast.success(`Copied ${count} field${count === 1 ? '' : 's'} to page ${target}`);
  }

  function onDelete(n: number) {
    const page = pages.find((p) => p.number === n);
    if (!page || !canDelete) return;
    const msg =
      page.fields.length > 0
        ? `Delete page ${n} and its ${page.fields.length} field${page.fields.length === 1 ? '' : 's'}?`
        : `Delete page ${n}?`;
    if (!window.confirm(msg)) return;
    removePage(n);
    toast.success(`Deleted page ${n}`);
  }

  return (
    <div
      ref={rootRef}
      className={cn(
        'pointer-events-none absolute inset-x-0 z-40 flex justify-center px-3',
        className ?? 'bottom-4',
      )}
      onClick={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <div className="pointer-events-auto">
        {!open ? (
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="flex items-center gap-2 rounded-full border bg-background/90 px-3 py-1.5 text-[11px] shadow-lg backdrop-blur-md hover:bg-background"
            title="Pages"
          >
            <Files className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="font-semibold tabular-nums">{activePage}</span>
            <span className="text-muted-foreground">/ {pages.length}</span>
          </button>
        ) : (
          <div className="w-[min(100vw-1.5rem,20rem)] rounded-2xl border bg-background/95 p-2 shadow-xl backdrop-blur-md">
            <div className="mb-1.5 flex items-center justify-between px-1.5 pt-0.5">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                Pages
              </p>
              <button
                type="button"
                className="text-[10px] text-muted-foreground hover:text-foreground"
                onClick={() => setOpen(false)}
              >
                Done
              </button>
            </div>
            <div className="scroll-slim max-h-56 space-y-1 overflow-auto">
              {pages.map((p) => {
                const isActive = p.number === activePage;
                return (
                  <div
                    key={p.number}
                    className={cn(
                      'flex items-center gap-1 rounded-xl border px-1.5 py-1',
                      isActive ? 'border-primary/40 bg-accent' : 'border-transparent hover:bg-accent/60',
                    )}
                  >
                    <button
                      type="button"
                      className="flex min-w-0 flex-1 items-center gap-2 rounded-lg px-1 py-1 text-left"
                      onClick={() => setActivePage(p.number)}
                    >
                      <span
                        className={cn(
                          'flex h-7 w-7 items-center justify-center rounded-lg text-[11px] font-semibold tabular-nums',
                          isActive ? 'bg-primary text-primary-foreground' : 'bg-muted text-foreground',
                        )}
                      >
                        {p.number}
                      </span>
                      <span className="truncate text-[11px] text-muted-foreground">
                        {p.fields.length} field{p.fields.length === 1 ? '' : 's'}
                      </span>
                    </button>
                    {!isActive && (
                      <button
                        type="button"
                        className="rounded-md p-1 text-muted-foreground hover:bg-background hover:text-foreground"
                        title={`Copy fields from page ${activePage} onto page ${p.number}`}
                        onClick={() => onCopyTo(p.number)}
                      >
                        <Copy className="h-3.5 w-3.5" />
                      </button>
                    )}
                    <button
                      type="button"
                      className="rounded-md p-1 text-muted-foreground hover:bg-background hover:text-destructive disabled:opacity-30"
                      title={canDelete ? `Delete page ${p.number}` : 'The template needs at least one page'}
                      disabled={!canDelete}
                      onClick={() => onDelete(p.number)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                );
              })}
            </div>
            <div className="mt-1.5 flex gap-1 border-t pt-1.5">
              <button
                type="button"
                className="flex flex-1 items-center justify-center gap-1 rounded-lg px-2 py-1.5 text-[11px] hover:bg-accent"
                onClick={() => {
                  addPage();
                  toast.success('Blank page added');
                }}
              >
                <Plus className="h-3.5 w-3.5" /> Blank
              </button>
              <button
                type="button"
                className="flex flex-1 items-center justify-center gap-1 rounded-lg px-2 py-1.5 text-[11px] hover:bg-accent"
                onClick={onDuplicate}
              >
                <Copy className="h-3.5 w-3.5" /> Duplicate
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
