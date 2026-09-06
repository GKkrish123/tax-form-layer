'use client';

import { useRef } from 'react';
import { toast } from 'sonner';
import {
  Boxes,
  Check,
  Download,
  FileDown,
  PanelLeft,
  PanelRight,
  Plus,
  Save,
  Upload,
} from 'lucide-react';
import { parseTemplate, type Field } from '@tax-form-layer/spec';
import { useEditor } from '@/lib/store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { FormsMenu } from './FormsMenu';
import { AiMenu } from './AiMenu';

function newField(type: Field['type']): Field {
  const id = `${type}_${Math.random().toString(36).slice(2, 7)}`;
  const rect = {
    x: 0.4,
    y: 0.45,
    width: 0.15,
    height: 0.03,
    rotation: 0,
    unit: 'fraction' as const,
  };
  switch (type) {
    case 'value':
      return {
        type,
        id,
        rect,
        binding: { source: 'jsonpath', path: '$.' },
        format: { type: 'none' },
      };
    case 'checkbox':
      return {
        type,
        id,
        rect: { ...rect, width: 0.02, height: 0.02 },
        binding: { source: 'jsonpath', path: '$.' },
        mark: 'check',
        markText: 'X',
      };
    case 'comb':
      return {
        type,
        id,
        rect,
        binding: { source: 'jsonpath', path: '$.' },
        format: { type: 'none' },
        cells: 9,
        cellGap: 0.1,
        alignRight: false,
      };
    case 'repeat':
      return {
        type,
        id,
        rect: { ...rect, width: 0.9, x: 0.05 },
        itemsPath: '$.',
        rowHeight: 0.035,
        fields: [
          {
            type: 'value',
            id: `${id}_col1`,
            rect: { x: 0, y: 0, width: 0.2, height: 0.03, rotation: 0, unit: 'fraction' },
            binding: { source: 'jsonpath', path: '@.' },
            format: { type: 'none' },
          },
        ],
      };
  }
}

interface ToolbarProps {
  onToggleLeft: () => void;
  onToggleRight: () => void;
  leftOpen: boolean;
  rightOpen: boolean;
}

export function Toolbar({ onToggleLeft, onToggleRight, leftOpen, rightOpen }: ToolbarProps) {
  const mode = useEditor((s) => s.mode);
  const setMode = useEditor((s) => s.setMode);
  const title = useEditor((s) => s.template.title);
  const setTitle = useEditor((s) => s.setTitle);
  const addField = useEditor((s) => s.addField);
  const dirty = useEditor((s) => s.dirty);
  const fileRef = useRef<HTMLInputElement>(null);

  function validate() {
    const { template } = useEditor.getState();
    const res = parseTemplate(template);
    if (res.ok) toast.success('Valid against spec');
    else
      toast.error(`${res.errors.length} issue(s)`, {
        description: `${res.errors[0]?.path} — ${res.errors[0]?.message}`,
      });
  }

  function exportJson() {
    const { template } = useEditor.getState();
    const blob = new Blob([JSON.stringify(template, null, 2)], { type: 'application/json' });
    triggerDownload(blob, `${template.id}.annotation.json`);
    toast.success('Annotation exported');
  }

  function importJson(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = parseTemplate(JSON.parse(String(reader.result)));
        if (!parsed.ok)
          return toast.error('Invalid annotation', { description: parsed.errors[0]?.message });
        useEditor.getState().setTemplate(parsed.template);
        toast.success('Annotation imported');
      } catch (err) {
        toast.error('Import failed', {
          description: err instanceof Error ? err.message : undefined,
        });
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  }

  async function downloadPdf() {
    const { template, data, baseDocUrl } = useEditor.getState();
    await toast.promise(
      (async () => {
        const res = await fetch('/api/render', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ template, data, baseUrl: baseDocUrl }),
        });
        if (!res.ok) throw new Error('Render failed');
        const blob = await res.blob();
        triggerDownload(blob, `${template.id}.filled.pdf`);
      })(),
      { loading: 'Rendering PDF…', success: 'Filled PDF downloaded', error: 'Render failed' },
    );
  }

  async function saveVersion() {
    const { template, markSaved } = useEditor.getState();
    const res = await fetch('/api/templates', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ template }),
    });
    if (!res.ok) return toast.error('Save failed');
    const json = (await res.json()) as { version: number };
    markSaved();
    toast.success(`Saved version ${json.version}`);
    window.dispatchEvent(new CustomEvent('templates:changed'));
  }

  return (
    <header className="z-40 flex flex-wrap items-center gap-1.5 border-b bg-background/90 px-2 py-2 backdrop-blur sm:gap-2 sm:px-3">
      <IconToggle
        label="Toggle data panel"
        active={leftOpen}
        onClick={onToggleLeft}
      >
        <PanelLeft />
      </IconToggle>

      <div className="flex shrink-0 items-center gap-2">
        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-indigo-700 text-primary-foreground shadow-sm">
          <Boxes className="h-4 w-4" />
        </span>
        <span className="hidden text-sm font-semibold tracking-tight md:block">
          Tax&nbsp;Form&nbsp;Layer
        </span>
      </div>

      <Separator orientation="vertical" className="mx-0.5 hidden h-6 sm:block" />

      <FormsMenu />

      <Input
        className="min-w-0 flex-1 basis-32 sm:max-w-xs sm:flex-none sm:basis-auto sm:w-48 md:w-64"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Untitled template"
      />
      {dirty && (
        <Badge variant="warning" className="shrink-0">
          <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
          Unsaved
        </Badge>
      )}

      <Tabs value={mode} onValueChange={(v) => setMode(v as 'edit' | 'preview')} className="shrink-0">
        <TabsList>
          <TabsTrigger value="edit">Edit</TabsTrigger>
          <TabsTrigger value="preview">Preview</TabsTrigger>
        </TabsList>
      </Tabs>

      <div className="ml-auto flex max-w-full flex-wrap items-center justify-end gap-1 sm:gap-1.5">
        <AddMenu onAdd={(t) => addField(newField(t))} />
        <AiMenu />

        <ActionButton
          label="Validate against spec"
          onClick={validate}
          className="hidden sm:inline-flex"
        >
          <Check /> <span className="hidden lg:inline">Validate</span>
        </ActionButton>
        <ActionButton
          label="Export annotation JSON"
          onClick={exportJson}
          className="hidden md:inline-flex"
        >
          <Download /> <span className="hidden lg:inline">Export</span>
        </ActionButton>
        <ActionButton
          label="Import annotation JSON"
          onClick={() => fileRef.current?.click()}
          className="hidden md:inline-flex"
        >
          <Upload /> <span className="hidden lg:inline">Import</span>
        </ActionButton>
        <input
          ref={fileRef}
          type="file"
          accept="application/json"
          className="hidden"
          onChange={importJson}
        />
        <ActionButton label="Download filled PDF" onClick={downloadPdf}>
          <FileDown /> <span className="hidden sm:inline">PDF</span>
        </ActionButton>
        <Button size="sm" onClick={saveVersion}>
          <Save /> <span className="hidden sm:inline">Save</span>
        </Button>

        <IconToggle
          label="Toggle properties panel"
          active={rightOpen}
          onClick={onToggleRight}
        >
          <PanelRight />
        </IconToggle>
      </div>
    </header>
  );
}

function ActionButton({
  label,
  onClick,
  className,
  children,
}: {
  label: string;
  onClick: () => void;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button variant="outline" size="sm" onClick={onClick} className={className}>
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

function IconToggle({
  label,
  active,
  onClick,
  className,
  children,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant={active ? 'secondary' : 'ghost'}
          size="icon"
          onClick={onClick}
          className={className}
          aria-label={label}
        >
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

const FIELD_TYPES: { type: Field['type']; hint: string }[] = [
  { type: 'value', hint: 'Scalar value' },
  { type: 'checkbox', hint: 'Mark if truthy' },
  { type: 'comb', hint: 'One char / cell' },
  { type: 'repeat', hint: 'Repeating rows' },
];

function AddMenu({ onAdd }: { onAdd: (t: Field['type']) => void }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button size="sm">
          <Plus /> <span className="hidden sm:inline">Add field</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        <DropdownMenuLabel>Add field</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {FIELD_TYPES.map(({ type, hint }) => (
          <DropdownMenuItem key={type} onSelect={() => onAdd(type)}>
            <span className="h-2 w-2 rounded-sm bg-primary" />
            <span className="capitalize">{type}</span>
            <span className="ml-auto text-[10px] text-muted-foreground">{hint}</span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
