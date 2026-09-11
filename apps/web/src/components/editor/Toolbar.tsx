'use client';

import { useRef, useState } from 'react';
import { toast } from 'sonner';
import {
  Archive,
  Boxes,
  Check,
  Columns2,
  Download,
  Eye,
  FileDown,
  Image as ImageIcon,
  Loader2,
  MoreHorizontal,
  MousePointer2,
  PanelLeft,
  PanelRight,
  Pencil,
  Redo2,
  Save,
  Square,
  Undo2,
  Upload,
} from 'lucide-react';
import { parseTemplate } from '@tax-form-layer/spec';
import { compileTemplate } from '@tax-form-layer/engine';
import { useEditor } from '@/lib/store';
import { FIELD_PRESETS } from '@/lib/presets';
import { alignRects } from '@/lib/snap';
import { clearDraft } from '@/lib/drafts';
import { confirmDiscard } from '@/lib/unsaved';
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
import { AddFieldMenu } from './AddFieldMenu';

interface ToolbarProps {
  onToggleLeft: () => void;
  onToggleRight: () => void;
  onOpenIssues: () => void;
  leftOpen: boolean;
  rightOpen: boolean;
}

export function Toolbar({ onToggleLeft, onToggleRight, onOpenIssues, leftOpen, rightOpen }: ToolbarProps) {
  const mode = useEditor((s) => s.mode);
  const setMode = useEditor((s) => s.setMode);
  const title = useEditor((s) => s.template.title);
  const setTitle = useEditor((s) => s.setTitle);
  const addField = useEditor((s) => s.addField);
  const dirty = useEditor((s) => s.dirty);
  const currentId = useEditor((s) => s.template.id);
  const fixtures = useEditor((s) => s.template.fixtures);
  const fixtureId = useEditor((s) => s.fixtureId);
  const selectedFieldIds = useEditor((s) => s.selectedFieldIds);
  const undo = useEditor((s) => s.undo);
  const redo = useEditor((s) => s.redo);
  const tool = useEditor((s) => s.tool);
  const setTool = useEditor((s) => s.setTool);
  const template = useEditor((s) => s.template);
  const data = useEditor((s) => s.data);
  const compiled = compileTemplate(template, data);
  const bound = compiled.coverage.bound.length;
  const missing = compiled.coverage.missing.length;
  const issueCount = compiled.issues.length;
  const fileRef = useRef<HTMLInputElement>(null);
  const inflightSaves = useRef(new Set<string>());
  const [savingId, setSavingId] = useState<string | null>(null);

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
    if (!confirmDiscard(useEditor.getState().dirty)) {
      e.target.value = '';
      return;
    }
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

  async function downloadPng() {
    const { template, data, baseDocUrl } = useEditor.getState();
    await toast.promise(
      (async () => {
        const res = await fetch('/api/render?format=png', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ template, data, baseUrl: baseDocUrl }),
        });
        if (!res.ok) throw new Error('Render failed');
        const blob = await res.blob();
        triggerDownload(blob, `${template.id}.filled.png`);
      })(),
      { loading: 'Rendering PNG…', success: 'PNG downloaded', error: 'Render failed' },
    );
  }

  async function downloadBatch() {
    const { template, data, baseDocUrl } = useEditor.getState();
    const payloads =
      template.fixtures && template.fixtures.length > 0
        ? template.fixtures.map((f) => f.data)
        : [data, data];
    await toast.promise(
      (async () => {
        const res = await fetch('/api/render/batch', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ template, data: payloads, baseUrl: baseDocUrl }),
        });
        if (!res.ok) throw new Error('Batch failed');
        const blob = await res.blob();
        triggerDownload(blob, `${template.id}.batch.zip`);
      })(),
      { loading: 'Batch filling…', success: 'Zip downloaded', error: 'Batch failed' },
    );
  }

  async function saveVersion() {
    const { template, revision, markSaved } = useEditor.getState();
    if (inflightSaves.current.has(template.id)) return;

    inflightSaves.current.add(template.id);
    setSavingId(template.id);
    const toastId = toast.loading('Saving…');
    try {
      const res = await fetch('/api/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ template }),
      });
      const json = (await res.json().catch(() => ({}))) as { version?: number; error?: string };
      if (!res.ok) {
        toast.error('Save failed', {
          id: toastId,
          description: json.error,
          duration: 8000,
          action: {
            label: 'Retry',
            onClick: () => {
              void saveVersion();
            },
          },
        });
        return;
      }
      markSaved({ id: template.id, revision });
      clearDraft(template.id);
      toast.success(`Saved version ${json.version}`, { id: toastId });
      window.dispatchEvent(new CustomEvent('templates:changed'));
    } catch (err) {
      toast.error('Save failed', {
        id: toastId,
        description: err instanceof Error ? err.message : undefined,
        duration: 8000,
        action: {
          label: 'Retry',
          onClick: () => {
            void saveVersion();
          },
        },
      });
    } finally {
      inflightSaves.current.delete(template.id);
      setSavingId((id) => (id === template.id ? null : id));
    }
  }

  function applyFixture(id: string) {
    const fx = fixtures?.find((f) => f.id === id);
    useEditor.getState().setFixtureId(id);
    if (fx) useEditor.getState().setData(fx.data);
  }

  function zoomActual() {
    const pageW = useEditor.getState().template.pageSize.width;
    useEditor.getState().setViewportZoom((pageW * 96) / 72 / 920);
  }

  const moreMenu = (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="icon" aria-label="More actions">
          <MoreHorizontal />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56 max-h-[min(70vh,28rem)] overflow-y-auto">
        <DropdownMenuLabel>Edit</DropdownMenuLabel>
        <DropdownMenuItem onSelect={undo}>
          <Undo2 /> Undo
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={redo}>
          <Redo2 /> Redo
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={zoomActual}>100% actual size</DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={onOpenIssues}>
          Coverage {bound}/{bound + missing}
          {issueCount > 0 ? ` · ${issueCount} issue${issueCount === 1 ? '' : 's'}` : ''}
        </DropdownMenuItem>
        {fixtures && fixtures.length > 0 && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuLabel>Fixtures</DropdownMenuLabel>
            {fixtures.map((f) => (
              <DropdownMenuItem key={f.id} onSelect={() => applyFixture(f.id)}>
                {f.title}
                {f.id === (fixtureId ?? fixtures[0]!.id) ? ' ✓' : ''}
              </DropdownMenuItem>
            ))}
          </>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={validate}>
          <Check /> Validate
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={exportJson}>
          <Download /> Export JSON
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => fileRef.current?.click()}>
          <Upload /> Import JSON
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => void downloadPdf()}>
          <FileDown /> Download PDF
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => void downloadPng()}>
          <ImageIcon /> Download PNG
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => void downloadBatch()}>
          <Archive /> Batch zip
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );

  const saveButton = (compact: boolean) => (
    <Button
      size={compact ? 'icon' : 'sm'}
      onClick={() => void saveVersion()}
      disabled={savingId === currentId}
      aria-label={savingId === currentId ? 'Saving' : 'Save'}
    >
      {savingId === currentId ? <Loader2 className="animate-spin" /> : <Save />}
      {!compact && (
        <span className="hidden sm:inline">{savingId === currentId ? 'Saving…' : 'Save'}</span>
      )}
    </Button>
  );

  const fileInput = (
    <input
      ref={fileRef}
      type="file"
      accept="application/json"
      className="hidden"
      onChange={importJson}
    />
  );

  return (
    <>
      <header className="z-40 flex h-12 shrink-0 items-center gap-1.5 border-b bg-background/95 px-2 backdrop-blur lg:hidden">
        <FormsMenu />
        <div className="flex min-w-0 flex-1 items-center gap-1.5">
          <Input
            className="h-8 min-w-0 flex-1 px-2 text-sm"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Untitled"
            aria-label="Form title"
          />
          {dirty && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" title="Unsaved" />}
        </div>
        <Tabs
          value={mode}
          onValueChange={(v) => setMode(v as 'edit' | 'preview' | 'split')}
          className="shrink-0"
        >
          <TabsList className="h-8 p-0.5">
            <TabsTrigger value="edit" className="px-2" aria-label="Edit" title="Edit">
              <Pencil className="h-3.5 w-3.5" />
            </TabsTrigger>
            <TabsTrigger value="preview" className="px-2" aria-label="Preview" title="Preview">
              <Eye className="h-3.5 w-3.5" />
            </TabsTrigger>
            <TabsTrigger value="split" className="px-2" aria-label="Compare" title="Compare">
              <Columns2 className="h-3.5 w-3.5" />
            </TabsTrigger>
          </TabsList>
        </Tabs>
        <AiMenu compact />
        {moreMenu}
        {saveButton(true)}
      </header>

      <header className="z-40 hidden flex-wrap items-center gap-2 border-b bg-background/90 px-3 py-2 backdrop-blur lg:flex">
        <IconToggle label="Toggle data panel" active={leftOpen} onClick={onToggleLeft}>
          <PanelLeft />
        </IconToggle>

        <div className="flex shrink-0 items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-indigo-700 text-primary-foreground shadow-sm">
            <Boxes className="h-4 w-4" />
          </span>
          <span className="hidden text-sm font-semibold tracking-tight xl:block">
            Tax&nbsp;Form&nbsp;Layer
          </span>
        </div>

        <Separator orientation="vertical" className="mx-0.5 h-6" />

        <FormsMenu />

        <Input
          className="w-48 md:w-64"
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

        <Tabs
          value={mode === 'split' ? 'split' : mode}
          onValueChange={(v) => setMode(v as 'edit' | 'preview' | 'split')}
          className="shrink-0"
        >
          <TabsList>
            <TabsTrigger value="edit">Edit</TabsTrigger>
            <TabsTrigger value="preview">Preview</TabsTrigger>
            <TabsTrigger value="split">Split</TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="flex items-center gap-0.5">
          <IconToggle label="Pointer tool (V)" active={tool === 'pointer'} onClick={() => setTool('pointer')}>
            <MousePointer2 />
          </IconToggle>
          <IconToggle label="Draw box (B)" active={tool === 'draw'} onClick={() => setTool('draw')}>
            <Square />
          </IconToggle>
          <ActionButton label="100% actual size (1in = 72pt)" onClick={zoomActual}>
            100%
          </ActionButton>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={onOpenIssues}
          title="Open compile coverage and issues"
        >
          <span className={missing > 0 || issueCount > 0 ? 'text-amber-700' : undefined}>
            {bound}/{bound + missing} bound
          </span>
          {issueCount > 0 && (
            <span className="ml-1 rounded-full bg-amber-100 px-1.5 text-[10px] text-amber-800">
              {issueCount}
            </span>
          )}
        </Button>
        {fixtures && fixtures.length > 0 && (
          <select
            className="h-7 rounded-md border bg-background px-1 text-[11px]"
            value={fixtureId ?? fixtures[0]!.id}
            onChange={(e) => applyFixture(e.target.value)}
          >
            {fixtures.map((f) => (
              <option key={f.id} value={f.id}>
                {f.title}
              </option>
            ))}
          </select>
        )}

        <div className="ml-auto flex items-center justify-end gap-1.5">
          <ActionButton label="Undo" onClick={undo}>
            <Undo2 />
          </ActionButton>
          <ActionButton label="Redo" onClick={redo}>
            <Redo2 />
          </ActionButton>
          {selectedFieldIds.length > 1 && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  Align
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                {(['left', 'center', 'right', 'top', 'middle', 'bottom', 'distributeX', 'distributeY'] as const).map(
                  (m) => (
                    <DropdownMenuItem
                      key={m}
                      onSelect={() => {
                        const page = useEditor
                          .getState()
                          .template.pages.find((p) => p.number === useEditor.getState().activePage);
                        if (!page) return;
                        const updates = alignRects(selectedFieldIds, page.fields, m);
                        useEditor.getState().updateFieldRects(updates);
                      }}
                    >
                      {m}
                    </DropdownMenuItem>
                  ),
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
          <AddFieldMenu onAdd={addField} />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                Presets
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              {FIELD_PRESETS.map((p) => (
                <DropdownMenuItem key={p.id} onSelect={() => addField(p.create())}>
                  {p.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          <AiMenu />

          <ActionButton label="Validate against spec" onClick={validate}>
            <Check /> <span className="hidden xl:inline">Validate</span>
          </ActionButton>
          <ActionButton label="Export annotation JSON" onClick={exportJson}>
            <Download /> <span className="hidden xl:inline">Export</span>
          </ActionButton>
          <ActionButton label="Import annotation JSON" onClick={() => fileRef.current?.click()}>
            <Upload /> <span className="hidden xl:inline">Import</span>
          </ActionButton>
          <ActionButton label="Download filled PDF" onClick={downloadPdf}>
            <FileDown /> <span className="hidden xl:inline">PDF</span>
          </ActionButton>
          <ActionButton label="Download PNG" onClick={() => void downloadPng()}>
            <ImageIcon /> <span className="hidden xl:inline">PNG</span>
          </ActionButton>
          <ActionButton label="Batch fill zip" onClick={() => void downloadBatch()}>
            <Archive />
          </ActionButton>
          {saveButton(false)}

          <IconToggle label="Toggle properties panel" active={rightOpen} onClick={onToggleRight}>
            <PanelRight />
          </IconToggle>
        </div>
      </header>
      {fileInput}
    </>
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

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
