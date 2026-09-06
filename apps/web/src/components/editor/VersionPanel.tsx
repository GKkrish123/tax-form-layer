'use client';

import { useCallback, useEffect, useState } from 'react';
import { ChevronRight, History, RefreshCw, RotateCcw } from 'lucide-react';
import { parseTemplate } from '@tax-form-layer/spec';
import { useEditor } from '@/lib/store';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

interface VersionInfo {
  version: number;
  specVersion: string;
  message: string | null;
  createdAt: string;
}

export function VersionPanel() {
  const slug = useEditor((s) => s.template.id);
  const setTemplate = useEditor((s) => s.setTemplate);
  const [versions, setVersions] = useState<VersionInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/templates/${encodeURIComponent(slug)}`);
      if (res.ok) {
        const json = (await res.json()) as { versions: VersionInfo[] };
        setVersions(json.versions);
      } else {
        setVersions([]);
      }
    } finally {
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => {
    if (!open) return;
    void load();
    const handler = () => void load();
    window.addEventListener('templates:changed', handler);
    return () => window.removeEventListener('templates:changed', handler);
  }, [load, open]);

  async function restore(version: number) {
    const res = await fetch(`/api/templates/${encodeURIComponent(slug)}?version=${version}`);
    if (!res.ok) return;
    const json = (await res.json()) as { document: unknown };
    const parsed = parseTemplate(json.document);
    if (parsed.ok) setTemplate(parsed.template);
  }

  return (
    <div className="border-t">
      <div className="flex items-center gap-1 px-2 py-1.5">
        <button
          type="button"
          className="flex min-w-0 flex-1 items-center gap-2 rounded-md px-2 py-1.5 text-left hover:bg-accent"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
        >
          <ChevronRight
            className={cn(
              'h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform duration-150',
              open && 'rotate-90',
            )}
          />
          <History className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          <h3 className="panel-title">Version history</h3>
          {open && versions.length > 0 && (
            <span className="ml-auto text-[10px] tabular-nums text-muted-foreground">
              {versions.length}
            </span>
          )}
        </button>
        {open && (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 shrink-0 px-2 text-primary"
            onClick={() => void load()}
          >
            <RefreshCw className="h-3 w-3" />
          </Button>
        )}
      </div>

      {open && (
        <div className="scroll-slim max-h-40 overflow-auto px-2 pb-3">
          {loading && <p className="px-2 text-[11px] text-muted-foreground">Loading…</p>}
          {!loading && versions.length === 0 && (
            <p className="px-2 text-[11px] text-muted-foreground">No saved versions yet.</p>
          )}
          {versions.map((v) => (
            <div
              key={v.version}
              className="flex items-center justify-between rounded-md px-2 py-1.5 hover:bg-accent"
            >
              <div className="min-w-0 text-[11px]">
                <span className="font-semibold text-foreground">v{v.version}</span>
                <span className="ml-2 truncate text-muted-foreground">{v.message ?? ''}</span>
              </div>
              <Button
                variant="secondary"
                size="sm"
                className="h-6 px-2 text-[10px]"
                onClick={() => void restore(v.version)}
              >
                <RotateCcw className="h-3 w-3" /> Restore
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
