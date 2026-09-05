'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { ChevronDown, ScanSearch, Sparkles, Wand2 } from 'lucide-react';
import type { Field } from '@tax-form-layer/spec';
import { useEditor } from '@/lib/store';
import { captureCanvasDataUrl } from '@/lib/canvas-capture';
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

export function AiMenu() {
  const addFields = useEditor((s) => s.addFields);
  const [genOpen, setGenOpen] = useState(false);
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [detecting, setDetecting] = useState(false);

  useEffect(() => {
    fetch('/api/ai/status')
      .then((r) => r.json())
      .then((j: { configured: boolean }) => setConfigured(j.configured))
      .catch(() => setConfigured(false));
  }, []);

  async function autoDetect() {
    const imageDataUrl = captureCanvasDataUrl();
    if (!imageDataUrl) {
      toast.error('Open a form first', { description: 'The page must be rendered to scan it.' });
      return;
    }
    setDetecting(true);
    try {
      const res = await fetch('/api/ai/detect-boxes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageDataUrl }),
      });
      const json = (await res.json()) as { fields?: Field[]; error?: string };
      if (res.status === 501) {
        toast.info('AI vision not configured', {
          description: 'Set AI_API_KEY and AI_VISION_MODEL to enable box detection.',
        });
        return;
      }
      if (!res.ok || !json.fields) throw new Error(json.error ?? 'Detection failed');
      if (json.fields.length === 0) {
        toast.info('No boxes detected');
        return;
      }
      addFields(json.fields);
      toast.success(`Added ${json.fields.length} detected field(s)`, {
        description: 'Review, bind, and adjust them as needed.',
      });
    } catch (err) {
      toast.error('Detection failed', {
        description: err instanceof Error ? err.message : undefined,
      });
    } finally {
      setDetecting(false);
    }
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm">
            <Sparkles /> <span className="hidden sm:inline">AI</span> <ChevronDown className="opacity-60" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-60">
          <DropdownMenuLabel className="flex items-center justify-between">
            AI assist
            <Badge variant={configured ? 'success' : 'secondary'}>
              {configured === null ? '…' : configured ? 'connected' : 'offline'}
            </Badge>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => setGenOpen(true)}>
            <Wand2 /> Generate field…
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => void autoDetect()} disabled={detecting}>
            <ScanSearch /> {detecting ? 'Scanning…' : 'Auto-detect boxes'}
          </DropdownMenuItem>
          {!configured && (
            <div className="px-2 py-1.5 text-[10px] leading-relaxed text-muted-foreground">
              Offline mode: field generation uses heuristics; box detection needs an AI key.
            </div>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <AiFieldDialog open={genOpen} onOpenChange={setGenOpen} />
    </>
  );
}
