'use client';

import { Database, MousePointer2, Square, SlidersHorizontal } from 'lucide-react';
import { useEditor } from '@/lib/store';
import { cn } from '@/lib/utils';
import { AddFieldMenu } from './AddFieldMenu';

type MobilePane = 'data' | 'props' | null;

export function MobileNav({
  pane,
  onPaneChange,
}: {
  pane: MobilePane;
  onPaneChange: (pane: MobilePane) => void;
}) {
  const tool = useEditor((s) => s.tool);
  const setTool = useEditor((s) => s.setTool);
  const mode = useEditor((s) => s.mode);
  const setMode = useEditor((s) => s.setMode);
  const addField = useEditor((s) => s.addField);
  const selected = useEditor((s) => Boolean(s.selectedFieldId));

  function pickTool(next: 'pointer' | 'draw') {
    if (mode === 'preview') setMode('edit');
    setTool(next);
    onPaneChange(null);
  }

  function toggle(next: Exclude<MobilePane, null>) {
    onPaneChange(pane === next ? null : next);
  }

  return (
    <nav
      className="z-40 shrink-0 border-t bg-background lg:hidden"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      aria-label="Editor tools"
    >
      <div className="grid h-14 grid-cols-5">
        <NavBtn
          label="Data"
          active={pane === 'data'}
          onClick={() => toggle('data')}
        >
          <Database />
        </NavBtn>
        <NavBtn label="Select" active={tool === 'pointer' && pane === null} onClick={() => pickTool('pointer')}>
          <MousePointer2 />
        </NavBtn>
        <NavBtn label="Draw" active={tool === 'draw' && pane === null} onClick={() => pickTool('draw')}>
          <Square />
        </NavBtn>
        <AddFieldMenu
          compact
          side="top"
          showPresets
          onAdd={(field) => {
            if (mode === 'preview') setMode('edit');
            addField(field);
            onPaneChange(null);
          }}
        />
        <NavBtn
          label="Inspect"
          active={pane === 'props'}
          badge={selected && pane !== 'props'}
          onClick={() => toggle('props')}
        >
          <SlidersHorizontal />
        </NavBtn>
      </div>
    </nav>
  );
}

function NavBtn({
  label,
  active,
  badge,
  onClick,
  children,
}: {
  label: string;
  active?: boolean;
  badge?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'relative flex h-full min-h-0 w-full flex-col items-center justify-center gap-0.5 text-[10px] font-medium touch-manipulation',
        active ? 'text-primary' : 'text-muted-foreground',
      )}
    >
      <span className={cn('[&>svg]:h-5 [&>svg]:w-5', active && 'text-primary')}>{children}</span>
      {label}
      {badge && (
        <span className="absolute right-[calc(50%-18px)] top-1.5 h-1.5 w-1.5 rounded-full bg-primary" />
      )}
    </button>
  );
}
