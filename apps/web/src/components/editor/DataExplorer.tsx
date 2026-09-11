'use client';

import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { ChevronDown, ChevronRight, Database } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useEditor } from '@/lib/store';
import { buildDataTree, type DataNode } from '@/lib/jsonpath';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';

function assignPathToSelected(path: string) {
  const { selectedFieldId, template, activePage, updateField } = useEditor.getState();
  if (!selectedFieldId) {
    void navigator.clipboard?.writeText(path);
    toast.info('Path copied', { description: path });
    return;
  }
  const field = template.pages
    .find((p) => p.number === activePage)
    ?.fields.find((f) => f.id === selectedFieldId);
  if (!field || field.type === 'repeat') {
    void navigator.clipboard?.writeText(path);
    toast.info('Path copied', { description: path });
    return;
  }
  updateField(selectedFieldId, {
    binding: { source: 'jsonpath', path },
  } as Partial<typeof field>);
  toast.success('Bound', { description: `${selectedFieldId} → ${path}` });
}

function TreeNode({ node, depth }: { node: DataNode; depth: number }) {
  const [open, setOpen] = useState(depth < 2);
  const isBranch = node.kind !== 'leaf';

  return (
    <div>
      <div
        className="group flex min-w-0 cursor-pointer items-center gap-1 overflow-hidden rounded-md px-1.5 py-1 hover:bg-accent"
        style={{ paddingLeft: Math.min(depth, 6) * 10 + 6 }}
        onClick={() => (isBranch ? setOpen((o) => !o) : assignPathToSelected(node.path))}
      draggable={node.kind === 'leaf'}
      onDragStart={(e) => {
        if (node.kind !== 'leaf') return;
        e.dataTransfer.setData('text/jsonpath', node.path);
        e.dataTransfer.effectAllowed = 'copy';
      }}
        title={node.path}
      >
        {isBranch ? (
          <span className="text-muted-foreground">
            {open ? (
              <ChevronDown className="h-3.5 w-3.5" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5" />
            )}
          </span>
        ) : (
          <span className="w-3.5" />
        )}
        <span className="min-w-0 shrink truncate font-mono text-[11px] font-medium text-foreground">
          {node.key}
        </span>
        {node.kind === 'leaf' && (
          <span className="min-w-0 truncate font-mono text-[11px] text-muted-foreground">
            {JSON.stringify(node.value)}
          </span>
        )}
        {node.kind !== 'leaf' && (
          <span className="ml-1 text-[10px] text-muted-foreground">
            {node.kind === 'array' ? `[${node.children?.length ?? 0}]` : '{…}'}
          </span>
        )}
        <Button
          variant="secondary"
          size="sm"
          className={cn(
            'ml-auto h-5 shrink-0 px-1.5 text-[10px]',
            'inline-flex lg:hidden lg:group-hover:inline-flex',
          )}
          onClick={(e) => {
            e.stopPropagation();
            assignPathToSelected(node.path);
          }}
        >
          Use
        </Button>
      </div>
      {isBranch &&
        open &&
        node.children?.map((child) => <TreeNode key={child.path} node={child} depth={depth + 1} />)}
    </div>
  );
}

export function DataExplorer({ embedded = false }: { embedded?: boolean }) {
  const data = useEditor((s) => s.data);
  const setData = useEditor((s) => s.setData);
  const selectedFieldId = useEditor((s) => s.selectedFieldId);
  const [raw, setRaw] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const tree = useMemo(() => buildDataTree(data), [data]);

  return (
    <div className="flex h-full min-w-0 flex-col overflow-hidden">
      {!embedded && (
      <div className="flex min-w-0 shrink-0 items-center justify-between gap-2 border-b px-3 py-3">
        <div className="flex min-w-0 items-center gap-2">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-accent text-accent-foreground">
            <Database className="h-3.5 w-3.5" />
          </span>
          <h2 className="panel-title truncate">Data set</h2>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="h-6 shrink-0 px-2 text-primary"
          onClick={() => setRaw(raw === null ? JSON.stringify(data, null, 2) : null)}
        >
          {raw === null ? 'Edit JSON' : 'Tree view'}
        </Button>
      </div>
      )}
      {embedded && (
        <div className="flex shrink-0 justify-end px-3 py-2">
          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-2 text-primary"
            onClick={() => setRaw(raw === null ? JSON.stringify(data, null, 2) : null)}
          >
            {raw === null ? 'Edit JSON' : 'Tree view'}
          </Button>
        </div>
      )}

      <p className="min-w-0 shrink-0 break-words px-3 py-2 text-[11px] leading-relaxed text-muted-foreground">
        {selectedFieldId ? (
          <>
            Click a leaf to bind it to{' '}
            <span className="font-mono text-foreground">{selectedFieldId}</span>.
          </>
        ) : (
          <>Select a field, then click a leaf to bind its JSONPath — or drag a leaf onto a box.</>
        )}
      </p>

      {raw === null ? (
        <ScrollArea className="flex-1 px-2 pb-4">
          <TreeNode node={tree} depth={0} />
        </ScrollArea>
      ) : (
        <div className="flex flex-1 flex-col gap-2 p-3">
          <Textarea
            className="scroll-slim flex-1 resize-none font-mono !text-[11px] leading-relaxed"
            value={raw}
            onChange={(e) => setRaw(e.target.value)}
          />
          {err && <p className="text-[11px] text-destructive">{err}</p>}
          <Button
            className="w-full"
            onClick={() => {
              try {
                setData(JSON.parse(raw));
                setErr(null);
                setRaw(null);
                toast.success('Data applied');
              } catch (e) {
                setErr(e instanceof Error ? e.message : 'Invalid JSON');
              }
            }}
          >
            Apply data
          </Button>
        </div>
      )}
    </div>
  );
}
