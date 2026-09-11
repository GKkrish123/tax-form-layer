'use client';

import { useEffect } from 'react';
import { useEditor } from '@/lib/store';

function isTypingTarget(el: EventTarget | null): boolean {
  if (!(el instanceof HTMLElement)) return false;
  const tag = el.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable;
}

export function KeyboardShortcuts({ onCommand }: { onCommand: () => void }) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (isTypingTarget(e.target)) return;
      const meta = e.metaKey || e.ctrlKey;
      const s = useEditor.getState();

      if (meta && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) s.redo();
        else s.undo();
        return;
      }
      if (meta && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        onCommand();
        return;
      }
      if (meta && (e.key === '=' || e.key === '+')) {
        e.preventDefault();
        s.setViewportZoom(s.viewportZoom * 1.15);
        return;
      }
      if (meta && e.key === '-') {
        e.preventDefault();
        s.setViewportZoom(s.viewportZoom / 1.15);
        return;
      }
      if (meta && e.key === '0') {
        e.preventDefault();
        s.resetViewport();
        return;
      }
      if (meta && e.key.toLowerCase() === 'd') {
        e.preventDefault();
        s.duplicateSelected();
        return;
      }
      if (meta && e.key.toLowerCase() === 'a') {
        e.preventDefault();
        const page = s.template.pages.find((p) => p.number === s.activePage);
        if (!page) return;
        const ids = page.fields.map((f) => f.id);
        useEditor.setState({ selectedFieldIds: ids, selectedFieldId: ids[0] ?? null });
        return;
      }
      if (e.key === 'Escape') {
        s.selectField(null);
        s.setTool('pointer');
        return;
      }
      if (e.key === 'Backspace' || e.key === 'Delete') {
        if (s.selectedFieldIds.length) {
          e.preventDefault();
          s.removeFields(s.selectedFieldIds);
        }
        return;
      }
      if (e.key === 'v' && !meta) s.setTool('pointer');
      if (e.key === 'b' && !meta) s.setTool('draw');
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
        e.preventDefault();
        const step = e.shiftKey ? 0.01 : 0.002;
        const dx = e.key === 'ArrowLeft' ? -step : e.key === 'ArrowRight' ? step : 0;
        const dy = e.key === 'ArrowUp' ? -step : e.key === 'ArrowDown' ? step : 0;
        s.nudgeSelected(dx, dy);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onCommand]);
  return null;
}
