'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { ChevronDown, Link2, Loader2, ScanSearch, Sparkles, Wand2 } from 'lucide-react';
import type { Field } from '@tax-form-layer/spec';
import { useEditor } from '@/lib/store';
import { captureCanvasDataUrl } from '@/lib/canvas-capture';
import { countEnrichableFields, enrichFieldsHeuristically } from '@/lib/ai/enrich';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { AiFieldDialog } from './AiFieldDialog';

async function suggestBindingPath(
  label: string | undefined,
  boxNumber: string | undefined,
  data: unknown,
): Promise<{ path: string; source: string } | null> {
  const res = await fetch('/api/ai/suggest-binding', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ label, boxNumber, data }),
  });
  if (!res.ok) return null;
  const json = (await res.json()) as {
    suggestions?: Array<{ path: string }>;
    source?: string;
  };
  const path = json.suggestions?.[0]?.path;
  if (!path) return null;
  return { path, source: json.source ?? 'heuristic' };
}

export function AiMenu({ compact = false }: { compact?: boolean }) {
  const addFields = useEditor((s) => s.addFields);
  const updateActivePageFields = useEditor((s) => s.updateActivePageFields);
  const aiBusy = useEditor((s) => s.aiBusy);
  const setAiBusy = useEditor((s) => s.setAiBusy);
  const [genOpen, setGenOpen] = useState(false);
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [bindingRanking, setBindingRanking] = useState(false);

  useEffect(() => {
    fetch('/api/ai/status')
      .then((r) => r.json())
      .then((j: { configured: boolean; bindingRanking?: boolean }) => {
        setConfigured(j.configured);
        setBindingRanking(Boolean(j.bindingRanking));
      })
      .catch(() => {
        setConfigured(false);
        setBindingRanking(false);
      });
  }, []);

  async function autoDetect() {
    if (useEditor.getState().aiBusy) return;
    const imageDataUrl = await captureCanvasDataUrl();
    if (!imageDataUrl) {
      toast.error('Open a form first', { description: 'The page must be rendered to scan it.' });
      return;
    }

    setAiBusy('detect-boxes');
    const toastId = toast.loading('Scanning form for boxes…', {
      description: 'Vision model is reading the page. This can take a few seconds.',
    });

    try {
      const res = await fetch('/api/ai/detect-boxes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageDataUrl }),
      });
      const json = (await res.json()) as { fields?: Field[]; error?: string };
      if (res.status === 501) {
        toast.info('AI vision not configured', {
          id: toastId,
          description: 'Set AI_API_KEY and AI_VISION_MODEL to enable box detection.',
        });
        return;
      }
      if (!res.ok || !json.fields) throw new Error(json.error ?? 'Detection failed');
      if (json.fields.length === 0) {
        toast.info('No boxes detected', {
          id: toastId,
          description: 'The model did not find fillable fields on this page.',
          duration: 10_000,
          action: {
            label: 'Retry',
            onClick: () => {
              void autoDetect();
            },
          },
        });
        return;
      }

      const { data } = useEditor.getState();
      let enriched = enrichFieldsHeuristically(json.fields, data);

      if (bindingRanking) {
        enriched = await Promise.all(
          enriched.map(async (field) => {
            if (field.type === 'repeat' || !('binding' in field)) return field;
            if (field.binding.source !== 'jsonpath') return field;
            const best = await suggestBindingPath(field.label, field.boxNumber, data);
            if (!best) return field;
            return { ...field, binding: { ...field.binding, path: best.path } } as Field;
          }),
        );
      }

      addFields(enriched);
      const bound = enriched.filter((f) => {
        if (f.type === 'repeat' || !('binding' in f)) return false;
        return f.binding.source === 'jsonpath' && f.binding.path !== '$.';
      }).length;

      toast.success(`Added ${enriched.length} detected field(s)`, {
        id: toastId,
        description:
          bound > 0
            ? `${bound} auto-bound from your data. Review and adjust as needed.`
            : 'Review, bind, and adjust them as needed.',
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Detection failed';
      toast.error('AI Detection failed', {
        id: toastId,
        description: message,
        duration: 12_000,
        action: {
          label: 'Retry',
          onClick: () => {
            void autoDetect();
          },
        },
      });
    } finally {
      setAiBusy(null);
    }
  }

  async function suggestEmptyBindings() {
    const { template, activePage, data } = useEditor.getState();
    const page = template.pages.find((p) => p.number === activePage);
    if (!page) return;

    const enrichable = countEnrichableFields(page.fields);
    if (enrichable === 0) {
      toast.info('Nothing to bind', {
        description: 'All fields already have paths, or no empty bindings on this page.',
      });
      return;
    }

    setAiBusy('suggest-bindings');
    const toastId = toast.loading(
      bindingRanking ? 'Ranking bindings with AI…' : 'Suggesting bindings…',
    );
    try {
      if (!bindingRanking) {
        updateActivePageFields((fields) => enrichFieldsHeuristically(fields, data));
        toast.success(`Suggested bindings for ${enrichable} field(s)`, {
          id: toastId,
          description: 'Heuristic match from labels and box numbers — review before saving.',
        });
        return;
      }

      const withMeta = enrichFieldsHeuristically(page.fields, data);
      const next = await Promise.all(
        withMeta.map(async (field) => {
          if (field.type === 'repeat' || !('binding' in field)) return field;
          if (field.binding.source !== 'jsonpath') return field;
          const best = await suggestBindingPath(field.label, field.boxNumber, data);
          if (!best) return field;
          return { ...field, binding: { ...field.binding, path: best.path } } as Field;
        }),
      );

      updateActivePageFields(() => next);
      toast.success(`Suggested bindings for ${enrichable} field(s)`, {
        id: toastId,
        description: 'Ranked with AI — review before saving.',
      });
    } catch (err) {
      toast.error('Could not suggest bindings', {
        id: toastId,
        description: err instanceof Error ? err.message : undefined,
      });
    } finally {
      setAiBusy(null);
    }
  }

  const scanning = aiBusy === 'detect-boxes';
  const suggesting = aiBusy === 'suggest-bindings';
  const busy = scanning || suggesting;

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant={compact ? 'ghost' : 'outline'}
            size={compact ? 'icon' : 'sm'}
            disabled={busy}
            aria-busy={busy}
            aria-label="AI assist"
          >
            {busy ? <Loader2 className="animate-spin" /> : <Sparkles />}
            {!compact && (
              <span className="hidden xl:inline">
                {scanning ? 'Scanning…' : suggesting ? 'Binding…' : 'AI'}
              </span>
            )}
            {!compact && !busy && <ChevronDown className="opacity-60" />}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-64">
          <DropdownMenuLabel className="flex items-center justify-between">
            AI assist
            <Badge variant={configured ? 'success' : 'secondary'}>
              {configured === null ? '…' : configured ? 'connected' : 'offline'}
            </Badge>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => setGenOpen(true)} disabled={busy}>
            <Wand2 /> Generate field…
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => void autoDetect()} disabled={busy}>
            <ScanSearch /> {scanning ? 'Scanning…' : 'Auto-detect boxes'}
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => void suggestEmptyBindings()} disabled={busy}>
            <Link2 /> Suggest empty bindings
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <AiFieldDialog open={genOpen} onOpenChange={setGenOpen} />
    </>
  );
}
