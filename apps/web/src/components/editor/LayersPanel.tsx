'use client';

import { useMemo, useState } from 'react';
import { Layers } from 'lucide-react';
import { useEditor } from '@/lib/store';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

export function LayersPanel() {
  const template = useEditor((s) => s.template);
  const activePage = useEditor((s) => s.activePage);
  const selectedFieldIds = useEditor((s) => s.selectedFieldIds);
  const hoveredFieldId = useEditor((s) => s.hoveredFieldId);
  const selectField = useEditor((s) => s.selectField);
  const setHoveredField = useEditor((s) => s.setHoveredField);
  const updateActivePageFields = useEditor((s) => s.updateActivePageFields);
  const [q, setQ] = useState('');

  const fields = template.pages.find((p) => p.number === activePage)?.fields ?? [];
  const filtered = useMemo(() => {
    const n = q.trim().toLowerCase();
    if (!n) return fields;
    return fields.filter((f) =>
      [f.id, f.label, f.boxNumber].some((x) => x?.toLowerCase().includes(n)),
    );
  }, [fields, q]);

  return (
    <div className="border-t">
      <div className="flex items-center gap-2 px-3 py-2">
        <Layers className="h-3.5 w-3.5 text-muted-foreground" />
        <h3 className="panel-title">Layers</h3>
      </div>
      <div className="px-2 pb-2">
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search fields" />
      </div>
      <div className="scroll-slim max-h-40 overflow-auto px-2 pb-2">
        {filtered.map((f, i) => (
          <button
            key={f.id}
            draggable
            onDragStart={(e) => e.dataTransfer.setData('text/field-id', f.id)}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              const from = e.dataTransfer.getData('text/field-id');
              if (!from || from === f.id) return;
              updateActivePageFields((list) => {
                const next = [...list];
                const a = next.findIndex((x) => x.id === from);
                const b = next.findIndex((x) => x.id === f.id);
                if (a < 0 || b < 0) return list;
                const [item] = next.splice(a, 1);
                next.splice(b, 0, item!);
                return next;
              });
            }}
            onMouseEnter={() => setHoveredField(f.id)}
            onMouseLeave={() => setHoveredField(null)}
            onClick={() => selectField(f.id, { additive: false })}
            className={cn(
              'mb-0.5 flex w-full items-center gap-1 rounded px-1.5 py-1 text-left text-[11px]',
              selectedFieldIds.includes(f.id) ? 'bg-accent' : 'hover:bg-accent/60',
              hoveredFieldId === f.id && 'ring-1 ring-primary/40',
            )}
          >
            <span className="w-4 text-[10px] text-muted-foreground">{i + 1}</span>
            <span className="truncate font-medium">{f.label ?? f.id}</span>
            <span className="ml-auto font-mono text-[10px] text-muted-foreground">{f.type}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
