'use client';

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { ChevronDown, FilePlus2, FileText, FolderOpen } from 'lucide-react';
import { parseTemplate } from '@tax-form-layer/spec';
import { useEditor } from '@/lib/store';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { NewFormDialog } from './NewFormDialog';

interface StoredTemplate {
  slug: string;
  title: string;
  latest: number;
}

export function FormsMenu() {
  const loadTemplate = useEditor((s) => s.loadTemplate);
  const currentId = useEditor((s) => s.template.id);
  const [templates, setTemplates] = useState<StoredTemplate[]>([]);
  const [newOpen, setNewOpen] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/templates');
      if (res.ok) {
        const json = (await res.json()) as { templates: StoredTemplate[] };
        setTemplates(json.templates);
      }
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    void load();
    const handler = () => void load();
    window.addEventListener('templates:changed', handler);
    return () => window.removeEventListener('templates:changed', handler);
  }, [load]);

  async function openTemplate(slug: string) {
    try {
      const res = await fetch(`/api/templates/${encodeURIComponent(slug)}`);
      if (!res.ok) throw new Error('Not found');
      const json = (await res.json()) as { document: unknown };
      const parsed = parseTemplate(json.document);
      if (!parsed.ok) throw new Error(parsed.errors[0]?.message ?? 'Invalid template');
      loadTemplate(parsed.template, { dirty: false });
      toast.success('Opened form', { description: parsed.template.title });
    } catch (err) {
      toast.error('Could not open form', {
        description: err instanceof Error ? err.message : undefined,
      });
    }
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm">
            <FolderOpen /> <span className="hidden sm:inline">Forms</span> <ChevronDown className="opacity-60" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-64">
          <DropdownMenuItem onSelect={() => setNewOpen(true)}>
            <FilePlus2 /> New form…
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuLabel>Saved forms</DropdownMenuLabel>
          {templates.length === 0 && (
            <div className="px-2 py-1.5 text-[11px] text-muted-foreground">
              No saved forms yet. Use “Save” to store one.
            </div>
          )}
          {templates.map((t) => (
            <DropdownMenuItem key={t.slug} onSelect={() => void openTemplate(t.slug)}>
              <FileText />
              <span className="truncate">{t.title}</span>
              {t.slug === currentId && (
                <span className="ml-auto text-[10px] text-primary">current</span>
              )}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      <NewFormDialog open={newOpen} onOpenChange={setNewOpen} />
    </>
  );
}
