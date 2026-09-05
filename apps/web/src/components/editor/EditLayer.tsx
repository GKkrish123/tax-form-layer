'use client';

import { useEditor } from '@/lib/store';
import { FieldBox } from './FieldBox';
import type { CanvasGeometry } from './FormCanvas';

export function EditLayer({ geom }: { geom: CanvasGeometry }) {
  const template = useEditor((s) => s.template);
  const activePage = useEditor((s) => s.activePage);
  const page = template.pages.find((p) => p.number === activePage);

  if (!page) return null;
  return (
    <>
      {page.fields.map((field) => (
        <FieldBox key={field.id} field={field} geom={geom} />
      ))}
    </>
  );
}
