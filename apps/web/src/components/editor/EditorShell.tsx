'use client';

import { useEffect, useState } from 'react';
import clsx from 'clsx';
import { Database, SlidersHorizontal } from 'lucide-react';
import { parseTemplate, type FormTemplate } from '@tax-form-layer/spec';
import { useEditor } from '@/lib/store';
import { saveDraft, loadDraft } from '@/lib/drafts';
import { Toolbar } from './Toolbar';
import { FormCanvas } from './FormCanvas';
import { DataExplorer } from './DataExplorer';
import { PropertyPanel } from './PropertyPanel';
import { VersionPanel } from './VersionPanel';
import { LayersPanel } from './LayersPanel';
import { KeyboardShortcuts } from './KeyboardShortcuts';
import { CommandPalette } from './CommandPalette';
import { PageStrip } from './PageStrip';
import { WorkspaceSheet } from './WorkspaceSheet';
import { MobileNav } from './MobileNav';

function useIsLg() {
  const [isLg, setIsLg] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)');
    const sync = () => setIsLg(mq.matches);
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, []);
  return isLg;
}

type MobilePane = 'data' | 'props' | null;

export function EditorShell() {
  const selectField = useEditor((s) => s.selectField);
  const selectedFieldId = useEditor((s) => s.selectedFieldId);
  const mode = useEditor((s) => s.mode);
  const templateId = useEditor((s) => s.template.id);
  const template = useEditor((s) => s.template);
  const data = useEditor((s) => s.data);
  const dirty = useEditor((s) => s.dirty);
  const isLg = useIsLg();
  const [leftOpen, setLeftOpen] = useState(false);
  const [rightOpen, setRightOpen] = useState(false);
  const [mobilePane, setMobilePane] = useState<MobilePane>(null);
  const [cmdOpen, setCmdOpen] = useState(false);

  useEffect(() => {
    const id = useEditor.getState().template.id;
    const draft = loadDraft<{ template: FormTemplate; data: unknown }>(id);
    if (!draft?.template) return;
    const parsed = parseTemplate(draft.template);
    if (!parsed.ok) return;
    useEditor.getState().loadTemplate(parsed.template, { dirty: true });
    if (draft.data !== undefined) useEditor.getState().setData(draft.data);
  }, []);

  useEffect(() => {
    function onBeforeUnload(e: BeforeUnloadEvent) {
      if (useEditor.getState().dirty) e.preventDefault();
    }
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, []);

  useEffect(() => {
    setLeftOpen(isLg);
    setRightOpen(isLg);
    if (isLg) setMobilePane(null);
  }, [isLg]);

  useEffect(() => {
    if (selectedFieldId && isLg) setRightOpen(true);
  }, [selectedFieldId, isLg]);

  useEffect(() => {
    if (!dirty) return;
    const t = window.setTimeout(() => saveDraft(templateId, { template, data }), 800);
    return () => window.clearTimeout(t);
  }, [dirty, template, data, templateId]);

  function closeMobilePane() {
    setMobilePane(null);
    useEditor.getState().setIssuesOpen(false);
  }

  function toggleRight() {
    if (isLg) {
      setRightOpen((v) => !v);
      return;
    }
    setMobilePane((p) => (p === 'props' ? null : 'props'));
  }

  return (
    <div className="flex h-[100dvh] max-h-[100dvh] flex-col overflow-hidden bg-muted">
      <KeyboardShortcuts onCommand={() => setCmdOpen(true)} />
      <CommandPalette open={cmdOpen} onOpenChange={setCmdOpen} />
      <Toolbar
        onToggleLeft={() => setLeftOpen((v) => !v)}
        onToggleRight={toggleRight}
        onOpenIssues={() => {
          useEditor.getState().selectField(null);
          useEditor.getState().setIssuesOpen(true);
          if (isLg) setRightOpen(true);
          else setMobilePane('props');
        }}
        leftOpen={leftOpen}
        rightOpen={isLg ? rightOpen : mobilePane === 'props'}
      />

      <div className="relative flex min-h-0 min-w-0 flex-1 flex-col lg:flex-row">
        <aside
          className={clsx(
            'hidden min-w-0 flex-col overflow-hidden border-r bg-background lg:flex',
            'lg:transition-[width,opacity] lg:duration-200',
            leftOpen
              ? 'lg:w-72 lg:max-w-[22vw] lg:opacity-100 xl:w-80'
              : 'lg:w-0 lg:overflow-hidden lg:opacity-0',
          )}
        >
          <div className="flex h-full min-w-0 w-full flex-col overflow-hidden">
            <DataExplorer />
          </div>
        </aside>

        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          <main
            className="workspace-bg relative min-h-0 min-w-0 flex-1 overflow-hidden"
            onClick={() => {
              if (isLg) selectField(null);
            }}
          >
            {mode === 'split' ? (
              <div className="flex h-full min-h-0 flex-col lg:flex-row">
                <div className="relative min-h-0 min-w-0 flex-1 overflow-hidden border-b lg:border-b-0 lg:border-r">
                  <SplitLabel>Edit</SplitLabel>
                  <FormCanvas forceMode="edit" compact />
                </div>
                <div className="relative min-h-0 min-w-0 flex-1 overflow-hidden">
                  <SplitLabel>Preview</SplitLabel>
                  <FormCanvas forceMode="preview" compact />
                </div>
              </div>
            ) : (
              <FormCanvas />
            )}
            {!mobilePane && (
              <PageStrip className="bottom-[0.75rem] lg:bottom-4" />
            )}
          </main>

          <WorkspaceSheet
            open={!isLg && mobilePane === 'data'}
            onOpenChange={(open) => setMobilePane(open ? 'data' : null)}
            title="Data set"
            icon={<Database className="h-3.5 w-3.5" />}
          >
            <DataExplorer embedded />
          </WorkspaceSheet>

          <WorkspaceSheet
            open={!isLg && mobilePane === 'props'}
            onOpenChange={(open) => {
              if (open) setMobilePane('props');
              else closeMobilePane();
            }}
            title="Properties"
            icon={<SlidersHorizontal className="h-3.5 w-3.5" />}
          >
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
              <div className="scroll-slim min-h-0 flex-1 overflow-y-auto overscroll-contain">
                <PropertyPanel />
                <LayersPanel />
              </div>
              <div className="shrink-0 border-t bg-background">
                <VersionPanel />
              </div>
            </div>
          </WorkspaceSheet>
        </div>

        <aside
          className={clsx(
            'hidden min-w-0 flex-col overflow-hidden border-l bg-background lg:flex',
            'lg:transition-[width,opacity] lg:duration-200',
            rightOpen
              ? 'lg:w-80 lg:max-w-[24vw] lg:opacity-100 xl:w-96'
              : 'lg:w-0 lg:overflow-hidden lg:opacity-0',
          )}
        >
          <div className="flex h-full min-w-0 w-full flex-col overflow-hidden">
            <div className="flex shrink-0 items-center gap-2 border-b px-3 py-2.5 sm:px-4 sm:py-3">
              <span className="flex h-6 w-6 items-center justify-center rounded-md bg-accent text-accent-foreground">
                <SlidersHorizontal className="h-3.5 w-3.5" />
              </span>
              <h2 className="panel-title">Properties</h2>
            </div>
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
              <PropertyPanel />
              <LayersPanel />
              <VersionPanel />
            </div>
          </div>
        </aside>
      </div>

      <MobileNav pane={mobilePane} onPaneChange={setMobilePane} />
    </div>
  );
}

function SplitLabel({ children }: { children: string }) {
  return (
    <span className="pointer-events-none absolute left-2 top-2 z-10 rounded-md bg-background/90 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground shadow-sm">
      {children}
    </span>
  );
}
