'use client';

import { useState } from 'react';
import clsx from 'clsx';
import { SlidersHorizontal } from 'lucide-react';
import { useEditor } from '@/lib/store';
import { Toolbar } from './Toolbar';
import { FormCanvas } from './FormCanvas';
import { DataExplorer } from './DataExplorer';
import { PropertyPanel } from './PropertyPanel';
import { VersionPanel } from './VersionPanel';

export function EditorShell() {
  const selectField = useEditor((s) => s.selectField);
  const [leftOpen, setLeftOpen] = useState(true);
  const [rightOpen, setRightOpen] = useState(true);

  return (
    <div className="flex h-[100dvh] flex-col overflow-hidden bg-muted">
      <Toolbar
        onToggleLeft={() => setLeftOpen((v) => !v)}
        onToggleRight={() => setRightOpen((v) => !v)}
        leftOpen={leftOpen}
        rightOpen={rightOpen}
      />

      <div className="relative flex min-h-0 flex-1">
        {(leftOpen || rightOpen) && (
          <button
            aria-label="Close panels"
            className="absolute inset-0 z-20 bg-slate-900/20 lg:hidden"
            onClick={() => {
              setLeftOpen(false);
              setRightOpen(false);
            }}
          />
        )}

        <aside
          className={clsx(
            'absolute inset-y-0 left-0 z-30 flex w-72 flex-col border-r bg-background shadow-panel transition-transform lg:static lg:z-auto lg:shadow-none',
            leftOpen ? 'translate-x-0' : '-translate-x-full lg:hidden',
          )}
        >
          <DataExplorer />
        </aside>

        <main
          className="workspace-bg min-h-0 flex-1 overflow-hidden"
          onClick={() => selectField(null)}
        >
          <FormCanvas />
        </main>

        <aside
          className={clsx(
            'absolute inset-y-0 right-0 z-30 flex w-80 flex-col border-l bg-background shadow-panel transition-transform lg:static lg:z-auto lg:shadow-none',
            rightOpen ? 'translate-x-0' : 'translate-x-full lg:hidden',
          )}
        >
          <div className="flex items-center gap-2 border-b px-4 py-3">
            <span className="flex h-6 w-6 items-center justify-center rounded-md bg-accent text-accent-foreground">
              <SlidersHorizontal className="h-3.5 w-3.5" />
            </span>
            <h2 className="panel-title">Properties</h2>
          </div>
          <PropertyPanel />
          <VersionPanel />
        </aside>
      </div>
    </div>
  );
}
