'use client';

import { useEffect, useState } from 'react';
import clsx from 'clsx';
import { SlidersHorizontal } from 'lucide-react';
import { useEditor } from '@/lib/store';
import { Toolbar } from './Toolbar';
import { FormCanvas } from './FormCanvas';
import { DataExplorer } from './DataExplorer';
import { PropertyPanel } from './PropertyPanel';
import { VersionPanel } from './VersionPanel';
import { PropertiesDrawer } from './PropertiesDrawer';

function useIsLg() {
  const [isLg, setIsLg] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1200px)');
    const sync = () => setIsLg(mq.matches);
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, []);
  return isLg;
}

export function EditorShell() {
  const selectField = useEditor((s) => s.selectField);
  const selectedFieldId = useEditor((s) => s.selectedFieldId);
  const isLg = useIsLg();
  const [leftOpen, setLeftOpen] = useState(false);
  const [rightOpen, setRightOpen] = useState(false);
  const [propsDrawerOpen, setPropsDrawerOpen] = useState(false);

  useEffect(() => {
    setLeftOpen(isLg);
    setRightOpen(isLg);
    if (isLg) setPropsDrawerOpen(false);
  }, [isLg]);

  useEffect(() => {
    if (selectedFieldId) {
      if (isLg) setRightOpen(true);
      else setPropsDrawerOpen(true);
    }
  }, [selectedFieldId, isLg]);

  function handlePropsDrawerChange(open: boolean) {
    setPropsDrawerOpen(open);
    if (!open && !isLg) selectField(null);
  }

  function toggleRight() {
    if (isLg) {
      setRightOpen((v) => !v);
      return;
    }
    setPropsDrawerOpen((v) => !v);
  }

  return (
    <div className="flex h-[100dvh] max-h-[100dvh] flex-col overflow-hidden bg-muted">
      <Toolbar
        onToggleLeft={() => setLeftOpen((v) => !v)}
        onToggleRight={toggleRight}
        leftOpen={leftOpen}
        rightOpen={isLg ? rightOpen : propsDrawerOpen}
      />

      <div className="relative flex min-h-0 min-w-0 flex-1 flex-col">
        <div className="relative flex min-h-0 min-w-0 flex-1">
          {leftOpen && (
            <button
              aria-label="Close panels"
              className="absolute inset-0 z-20 bg-slate-900/20 lg:hidden"
              onClick={() => setLeftOpen(false)}
            />
          )}

          <aside
            className={clsx(
              'absolute inset-y-0 left-0 z-30 flex min-w-0 flex-col overflow-hidden border-r bg-background shadow-panel',
              'w-[min(100%,20rem)] transition-transform duration-200',
              'lg:static lg:z-auto lg:shadow-none lg:transition-[width,opacity] lg:duration-200',
              leftOpen
                ? 'translate-x-0 lg:w-72 lg:max-w-[22vw] lg:opacity-100 xl:w-80'
                : '-translate-x-full lg:w-0 lg:translate-x-0 lg:overflow-hidden lg:opacity-0',
            )}
          >
            <div className="flex h-full min-w-0 w-full flex-col overflow-hidden">
              <DataExplorer />
            </div>
          </aside>

          <main
            className="workspace-bg min-h-0 min-w-0 flex-1 overflow-hidden"
            onClick={() => {
              if (isLg) selectField(null);
            }}
          >
            <FormCanvas />
          </main>

          <aside
            className={clsx(
              'min-w-0 flex-col overflow-hidden border-l bg-background',
              'lg:transition-[width,opacity] lg:duration-200',
              rightOpen
                ? 'hidden lg:flex lg:w-80 lg:max-w-[24vw] lg:opacity-100 xl:w-96'
                : 'hidden lg:flex lg:w-0 lg:overflow-hidden lg:opacity-0',
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
                <VersionPanel />
              </div>
            </div>
          </aside>
        </div>

        {!isLg && (
          <PropertiesDrawer open={propsDrawerOpen} onOpenChange={handlePropsDrawerChange} />
        )}
      </div>
    </div>
  );
}
