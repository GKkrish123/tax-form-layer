'use client';

import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { parseTemplate, type Field } from '@tax-form-layer/spec';
import { useEditor } from '@/lib/store';
import { FIELD_PRESETS } from '@/lib/presets';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';

function newValueField(): Field {
  return {
    type: 'value',
    id: `value_${Math.random().toString(36).slice(2, 7)}`,
    rect: { x: 0.4, y: 0.45, width: 0.15, height: 0.03, rotation: 0, unit: 'fraction' },
    binding: { source: 'jsonpath', path: '$.' },
    format: { type: 'none' },
  };
}

export function CommandPalette({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const [q, setQ] = useState('');
  const addField = useEditor((s) => s.addField);
  const setMode = useEditor((s) => s.setMode);
  const undo = useEditor((s) => s.undo);
  const redo = useEditor((s) => s.redo);
  const fields = useEditor((s) => s.template.pages.find((p) => p.number === s.activePage)?.fields ?? []);
  const selectField = useEditor((s) => s.selectField);

  const commands = useMemo(() => {
    const list: Array<{ id: string; label: string; run: () => void }> = [
      { id: 'add-value', label: 'Add value field', run: () => addField(newValueField()) },
      { id: 'preview', label: 'Toggle preview', run: () => setMode(useEditor.getState().mode === 'preview' ? 'edit' : 'preview') },
      { id: 'split', label: 'Split view', run: () => setMode('split') },
      { id: 'undo', label: 'Undo', run: () => undo() },
      { id: 'redo', label: 'Redo', run: () => redo() },
      {
        id: 'validate',
        label: 'Validate against spec',
        run: () => {
          const res = parseTemplate(useEditor.getState().template);
          if (res.ok) toast.success('Valid against spec');
          else toast.error(res.errors[0]?.message ?? 'Invalid template');
        },
      },
      {
        id: 'zoom-100',
        label: 'Zoom 100% actual size',
        run: () => {
          const pageW = useEditor.getState().template.pageSize.width;
          useEditor.getState().setViewportZoom((pageW * 96) / 72 / 920);
        },
      },
      {
        id: 'add-page',
        label: 'Add blank page',
        run: () => useEditor.getState().addPage(),
      },
      {
        id: 'duplicate-page',
        label: 'Duplicate current page',
        run: () => useEditor.getState().duplicatePage(),
      },
      {
        id: 'delete-page',
        label: 'Delete current page',
        run: () => {
          const s = useEditor.getState();
          if (s.template.pages.length <= 1) {
            toast.info('The template needs at least one page');
            return;
          }
          s.removePage(s.activePage);
        },
      },
      ...FIELD_PRESETS.map((p) => ({ id: p.id, label: `Insert ${p.label}`, run: () => addField(p.create()) })),
      ...fields.map((f) => ({
        id: `go-${f.id}`,
        label: `Go to ${f.label ?? f.id}`,
        run: () => selectField(f.id),
      })),
    ];
    const n = q.trim().toLowerCase();
    return n ? list.filter((c) => c.label.toLowerCase().includes(n)) : list;
  }, [q, addField, setMode, undo, redo, fields, selectField]);

  useEffect(() => {
    if (!open) setQ('');
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="p-0 sm:max-w-md">
        <DialogHeader className="px-3 pt-3">
          <DialogTitle>Command palette</DialogTitle>
        </DialogHeader>
        <div className="px-3">
          <Input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Type a command…" />
        </div>
        <div className="scroll-slim max-h-72 overflow-auto p-2">
          {commands.slice(0, 30).map((c) => (
            <button
              key={c.id}
              className="flex w-full rounded-md px-2 py-1.5 text-left text-sm hover:bg-accent"
              onClick={() => {
                c.run();
                onOpenChange(false);
              }}
            >
              {c.label}
            </button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
