'use client';

import { useEditor } from '@/lib/store';
import { FieldBox } from './FieldBox';
import type { CanvasGeometry } from './FormCanvas';

const EMPTY: never[] = [];

export function EditLayer({ geom }: { geom: CanvasGeometry }) {
  const fields = useEditor((s) => {
    const page = s.template.pages.find((p) => p.number === s.activePage);
    return page?.fields ?? EMPTY;
  });

  return (
    <>
      {fields.map((field) => (
        <FieldBox key={field.id} field={field} geom={geom} />
      ))}
    </>
  );
}
