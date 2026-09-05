import { create } from 'zustand';
import { parseTemplate, type FormTemplate, type Field, type Rect } from '@tax-form-layer/spec';
import w2 from '@tax-form-layer/spec/examples/w2-2024';

/**
 * Normalize the bundled example through the spec so all schema defaults
 * (rect.unit, rotation, style/format defaults, …) are applied. Without this the
 * raw JSON lacks `unit`, and coordinate conversion would yield NaN.
 */
const initialParsed = parseTemplate(w2);
const initialTemplate: FormTemplate = initialParsed.ok
  ? initialParsed.template
  : (w2 as unknown as FormTemplate);

export type EditorMode = 'edit' | 'preview';

interface EditorState {
  template: FormTemplate;
  data: unknown;
  activePage: number;
  selectedFieldId: string | null;
  mode: EditorMode;
  baseDocUrl: string;
  dirty: boolean;

  setMode: (mode: EditorMode) => void;
  selectField: (id: string | null) => void;
  setActivePage: (n: number) => void;
  setData: (data: unknown) => void;
  setTemplate: (t: FormTemplate) => void;
  loadTemplate: (t: FormTemplate, opts?: { dirty?: boolean }) => void;
  setBaseDocUrl: (url: string) => void;
  setTitle: (title: string) => void;
  updateField: (id: string, patch: Partial<Field>) => void;
  updateFieldRect: (id: string, rect: Partial<Rect>) => void;
  addField: (field: Field) => void;
  addFields: (fields: Field[]) => void;
  removeField: (id: string) => void;
  markSaved: () => void;
}

const FALLBACK_BASE = '/forms/w2-2024.pdf';

function baseUrlOf(template: FormTemplate): string {
  return template.medium.source ?? FALLBACK_BASE;
}

function replaceField(template: FormTemplate, pageNumber: number, id: string, next: Field | null) {
  return {
    ...template,
    pages: template.pages.map((page) => {
      if (page.number !== pageNumber) return page;
      const fields = next
        ? page.fields.map((f) => (f.id === id ? next : f))
        : page.fields.filter((f) => f.id !== id);
      return { ...page, fields };
    }),
  };
}

export const useEditor = create<EditorState>((set, get) => ({
  template: initialTemplate,
  data: initialTemplate.sampleData ?? {},
  activePage: 1,
  selectedFieldId: null,
  mode: 'edit',
  baseDocUrl: baseUrlOf(initialTemplate),
  dirty: false,

  setMode: (mode) => set({ mode }),
  selectField: (selectedFieldId) => set({ selectedFieldId }),
  setActivePage: (activePage) => set({ activePage, selectedFieldId: null }),
  setData: (data) => set({ data }),
  setBaseDocUrl: (baseDocUrl) => set({ baseDocUrl }),
  setTemplate: (template) =>
    set({
      template,
      data: (template as { sampleData?: unknown }).sampleData ?? get().data,
      baseDocUrl: baseUrlOf(template),
      selectedFieldId: null,
      activePage: 1,
      dirty: true,
    }),
  loadTemplate: (template, opts) =>
    set({
      template,
      data: (template as { sampleData?: unknown }).sampleData ?? {},
      baseDocUrl: baseUrlOf(template),
      selectedFieldId: null,
      activePage: 1,
      dirty: opts?.dirty ?? false,
    }),
  setTitle: (title) => set((s) => ({ template: { ...s.template, title }, dirty: true })),

  updateField: (id, patch) =>
    set((s) => {
      const page = s.template.pages.find((p) => p.number === s.activePage);
      const existing = page?.fields.find((f) => f.id === id);
      if (!existing) return s;
      const next = { ...existing, ...patch } as Field;
      return { template: replaceField(s.template, s.activePage, id, next), dirty: true };
    }),

  updateFieldRect: (id, rect) =>
    set((s) => {
      const page = s.template.pages.find((p) => p.number === s.activePage);
      const existing = page?.fields.find((f) => f.id === id);
      if (!existing) return s;
      const next = { ...existing, rect: { ...existing.rect, ...rect } } as Field;
      return { template: replaceField(s.template, s.activePage, id, next), dirty: true };
    }),

  addField: (field) =>
    set((s) => ({
      template: {
        ...s.template,
        pages: s.template.pages.map((p) =>
          p.number === s.activePage ? { ...p, fields: [...p.fields, field] } : p,
        ),
      },
      selectedFieldId: field.id,
      dirty: true,
    })),

  addFields: (fields) =>
    set((s) => ({
      template: {
        ...s.template,
        pages: s.template.pages.map((p) =>
          p.number === s.activePage ? { ...p, fields: [...p.fields, ...fields] } : p,
        ),
      },
      dirty: true,
    })),

  removeField: (id) =>
    set((s) => ({
      template: replaceField(s.template, s.activePage, id, null),
      selectedFieldId: s.selectedFieldId === id ? null : s.selectedFieldId,
      dirty: true,
    })),

  markSaved: () => set({ dirty: false }),
}));
