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
export type AiBusyKind = 'detect-boxes' | 'suggest-bindings' | null;

interface EditorState {
  template: FormTemplate;
  data: unknown;
  activePage: number;
  selectedFieldId: string | null;
  mode: EditorMode;
  baseDocUrl: string;
  dirty: boolean;
  revision: number;
  docEpoch: number;
  aiBusy: AiBusyKind;

  setMode: (mode: EditorMode) => void;
  setAiBusy: (aiBusy: AiBusyKind) => void;
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
  updateActivePageFields: (updater: (fields: Field[]) => Field[]) => void;
  removeField: (id: string) => void;
  markSaved: (opts: { id: string; revision: number }) => void;
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

export const useEditor = create<EditorState>((set) => ({
  template: initialTemplate,
  data: initialTemplate.sampleData ?? {},
  activePage: 1,
  selectedFieldId: null,
  mode: 'edit',
  baseDocUrl: baseUrlOf(initialTemplate),
  dirty: false,
  revision: 0,
  docEpoch: 0,
  aiBusy: null,

  setMode: (mode) => set({ mode }),
  setAiBusy: (aiBusy) => set({ aiBusy }),
  selectField: (selectedFieldId) => set({ selectedFieldId }),
  setActivePage: (activePage) => set({ activePage, selectedFieldId: null }),
  setData: (data) => set({ data }),
  setBaseDocUrl: (baseDocUrl) => set({ baseDocUrl }),
  setTemplate: (template) =>
    set((s) => ({
      template,
      data: (template as { sampleData?: unknown }).sampleData ?? s.data,
      baseDocUrl: baseUrlOf(template),
      selectedFieldId: null,
      activePage: 1,
      dirty: true,
      revision: s.revision + 1,
      docEpoch: s.docEpoch + 1,
    })),
  loadTemplate: (template, opts) =>
    set((s) => ({
      template,
      data: (template as { sampleData?: unknown }).sampleData ?? {},
      baseDocUrl: baseUrlOf(template),
      selectedFieldId: null,
      activePage: 1,
      dirty: opts?.dirty ?? false,
      revision: s.revision + 1,
      docEpoch: s.docEpoch + 1,
    })),
  setTitle: (title) =>
    set((s) => ({ template: { ...s.template, title }, dirty: true, revision: s.revision + 1 })),

  updateField: (id, patch) =>
    set((s) => {
      const page = s.template.pages.find((p) => p.number === s.activePage);
      const existing = page?.fields.find((f) => f.id === id);
      if (!existing) return s;
      const next = { ...existing, ...patch } as Field;
      const renamed =
        typeof patch.id === 'string' && patch.id !== id && s.selectedFieldId === id
          ? patch.id
          : s.selectedFieldId;
      return {
        template: replaceField(s.template, s.activePage, id, next),
        selectedFieldId: renamed,
        dirty: true,
        revision: s.revision + 1,
      };
    }),

  updateFieldRect: (id, rect) =>
    set((s) => {
      const page = s.template.pages.find((p) => p.number === s.activePage);
      const existing = page?.fields.find((f) => f.id === id);
      if (!existing) return s;
      const next = { ...existing, rect: { ...existing.rect, ...rect } } as Field;
      return {
        template: replaceField(s.template, s.activePage, id, next),
        dirty: true,
        revision: s.revision + 1,
      };
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
      revision: s.revision + 1,
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
      revision: s.revision + 1,
    })),

  updateActivePageFields: (updater) =>
    set((s) => ({
      template: {
        ...s.template,
        pages: s.template.pages.map((p) =>
          p.number === s.activePage ? { ...p, fields: updater(p.fields) } : p,
        ),
      },
      dirty: true,
      revision: s.revision + 1,
    })),

  removeField: (id) =>
    set((s) => ({
      template: replaceField(s.template, s.activePage, id, null),
      selectedFieldId: s.selectedFieldId === id ? null : s.selectedFieldId,
      dirty: true,
      revision: s.revision + 1,
    })),

  markSaved: ({ id, revision }) =>
    set((s) =>
      s.template.id === id && s.revision === revision ? { dirty: false } : s,
    ),
}));
