'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { ChevronRight, Eye, GitCompare, History, Loader2, RefreshCw, RotateCcw } from 'lucide-react';
import { parseTemplate } from '@tax-form-layer/spec';
import { confirmDiscard } from '@/lib/unsaved';
import { diffTemplates, type FieldChange } from '@/lib/version-diff';
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
  const docEpoch = useEditor((s) => s.docEpoch);
  const loadTemplate = useEditor((s) => s.loadTemplate);
  const setGhostFields = useEditor((s) => s.setGhostFields);
  const ghostFields = useEditor((s) => s.ghostFields);
  const [versions, setVersions] = useState<VersionInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [restoring, setRestoring] = useState<number | null>(null);
  const [diffing, setDiffing] = useState<number | null>(null);
  const listGen = useRef(0);
  const restoreGen = useRef(0);
  const [diff, setDiff] = useState<{ version: number; changes: FieldChange[] } | null>(null);

  const load = useCallback(async (requested: string) => {
    const gen = ++listGen.current;
    setLoading(true);
    try {
      const res = await fetch(`/api/templates/${encodeURIComponent(requested)}`);
      if (gen !== listGen.current) return;
      if (useEditor.getState().template.id !== requested) return;
      if (res.ok) {
        const json = (await res.json()) as { versions: VersionInfo[] };
        setVersions(json.versions);
      } else {
        setVersions([]);
      }
    } catch {
      if (gen !== listGen.current) return;
      setVersions([]);
    } finally {
      if (gen === listGen.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    setVersions([]);
    setDiff(null);
    if (!open) return;
    void load(slug);
    const handler = () => void load(useEditor.getState().template.id);
    window.addEventListener('templates:changed', handler);
    return () => window.removeEventListener('templates:changed', handler);
  }, [load, open, slug, docEpoch]);

  async function fetchVersionTemplate(version: number) {
    const requestedSlug = slug;
    const res = await fetch(
      `/api/templates/${encodeURIComponent(requestedSlug)}?version=${version}`,
    );
    if (!res.ok) throw new Error('Version not found');
    const json = (await res.json()) as { document: unknown };
    const parsed = parseTemplate(json.document);
    if (!parsed.ok) throw new Error(parsed.errors[0]?.message ?? 'Invalid version');
    if (useEditor.getState().template.id !== requestedSlug) throw new Error('Form changed');
    return parsed.template;
  }

  async function restore(version: number) {
    if (!confirmDiscard(useEditor.getState().dirty, 'Restore this version and discard current edits?')) {
      return;
    }
    const gen = ++restoreGen.current;
    setRestoring(version);
    const toastId = 'restore-version';
    toast.loading(`Restoring v${version}…`, { id: toastId });
    try {
      const template = await fetchVersionTemplate(version);
      if (gen !== restoreGen.current) return;
      loadTemplate(template, { dirty: true });
      setGhostFields(null);
      toast.success(`Restored version ${version}`, { id: toastId });
    } catch (err) {
      if (gen !== restoreGen.current) return;
      toast.error('Could not restore version', {
        id: toastId,
        description: err instanceof Error ? err.message : undefined,
      });
    } finally {
      if (gen === restoreGen.current) setRestoring(null);
    }
  }

  async function compare(version: number) {
    setDiffing(version);
    try {
      const older = await fetchVersionTemplate(version);
      const current = useEditor.getState().template;
      setDiff({ version, changes: diffTemplates(older, current) });
    } catch (err) {
      toast.error('Could not diff version', {
        description: err instanceof Error ? err.message : undefined,
      });
    } finally {
      setDiffing(null);
    }
  }

  async function ghost(version: number) {
    try {
      const older = await fetchVersionTemplate(version);
      const page = useEditor.getState().activePage;
      const fields = older.pages.find((p) => p.number === page)?.fields ?? [];
      setGhostFields(fields);
      toast.info(`Ghost overlay from v${version}`, {
        description: `${fields.length} field(s) on page ${page}`,
      });
    } catch (err) {
      toast.error('Could not load ghosts', {
        description: err instanceof Error ? err.message : undefined,
      });
    }
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
            onClick={() => void load(slug)}
          >
            <RefreshCw className="h-3 w-3" />
          </Button>
        )}
      </div>

      {open && (
        <div className="scroll-slim max-h-56 overflow-auto px-2 pb-3">
          {loading && versions.length === 0 && (
            <p className="px-2 text-[11px] text-muted-foreground">Loading…</p>
          )}
          {!loading && versions.length === 0 && (
            <p className="px-2 text-[11px] text-muted-foreground">No saved versions yet.</p>
          )}
          {versions.map((v) => (
            <div key={v.version} className="rounded-md px-2 py-1.5 hover:bg-accent">
              <div className="flex items-center justify-between gap-1">
                <div className="min-w-0 text-[11px]">
                  <span className="font-semibold text-foreground">v{v.version}</span>
                  <span className="ml-2 truncate text-muted-foreground">{v.message ?? ''}</span>
                </div>
                <div className="flex shrink-0 gap-0.5">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 px-1.5 text-[10px]"
                    title="Spatial ghost overlay"
                    onClick={() => void ghost(v.version)}
                  >
                    <Eye className="h-3 w-3" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 px-1.5 text-[10px]"
                    title="Diff fields vs current"
                    onClick={() => void compare(v.version)}
                  >
                    {diffing === v.version ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <GitCompare className="h-3 w-3" />
                    )}
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    className="h-6 px-2 text-[10px]"
                    onClick={() => void restore(v.version)}
                  >
                    {restoring === v.version ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <RotateCcw className="h-3 w-3" />
                    )}
                    Restore
                  </Button>
                </div>
              </div>
            </div>
          ))}
          {ghostFields && (
            <Button
              variant="outline"
              size="sm"
              className="mt-1 h-6 w-full text-[10px]"
              onClick={() => setGhostFields(null)}
            >
              Clear ghosts
            </Button>
          )}
          {diff && (
            <div className="mt-2 rounded-md border bg-muted/40 p-2">
              <p className="mb-1 text-[10px] font-semibold text-foreground">
                Diff vs v{diff.version} ({diff.changes.length} change
                {diff.changes.length === 1 ? '' : 's'})
              </p>
              {diff.changes.length === 0 ? (
                <p className="text-[10px] text-muted-foreground">No field changes.</p>
              ) : (
                diff.changes.slice(0, 20).map((c) => (
                  <p key={`${c.kind}-${c.id}`} className="truncate font-mono text-[10px]">
                    <span
                      className={
                        c.kind === 'added'
                          ? 'text-emerald-600'
                          : c.kind === 'removed'
                            ? 'text-red-600'
                            : 'text-amber-600'
                      }
                    >
                      {c.kind}
                    </span>{' '}
                    {c.id}
                    {c.detail ? ` · ${c.detail}` : ''}
                  </p>
                ))
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
