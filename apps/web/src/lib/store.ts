import { create } from 'zustand';
import { parseTemplate, type FormTemplate, type Field, type Rect } from '@tax-form-layer/spec';
import w2 from '@tax-form-layer/spec/examples/w2-2024';

const initialParsed = parseTemplate(w2);
const initialTemplate: FormTemplate = initialParsed.ok
  ? initialParsed.template
  : (w2 as unknown as FormTemplate);

export type EditorMode = 'edit' | 'preview' | 'split';
export type AiBusyKind = 'detect-boxes' | 'suggest-bindings' | null;
export type EditorTool = 'pointer' | 'draw';

const HISTORY_CAP = 50;

interface EditorState {
  template: FormTemplate;
  data: unknown;
  fixtureId: string | null;
  activePage: number;
  selectedFieldId: string | null;
  selectedFieldIds: string[];
  hoveredFieldId: string | null;
  mode: EditorMode;
  tool: EditorTool;
  baseDocUrl: string;
  dirty: boolean;
  revision: number;
  docEpoch: number;
  aiBusy: AiBusyKind;
  past: FormTemplate[];
  future: FormTemplate[];
  viewportZoom: number;
  panX: number;
  panY: number;
  guides: { x?: number; y?: number }[];
  ghostFields: Field[] | null;
  issuesOpen: boolean;

  setMode: (mode: EditorMode) => void;
  setTool: (tool: EditorTool) => void;
  setAiBusy: (aiBusy: AiBusyKind) => void;
  setIssuesOpen: (open: boolean) => void;
  selectField: (id: string | null, opts?: { additive?: boolean }) => void;
  setHoveredField: (id: string | null) => void;
  setActivePage: (n: number) => void;
  setData: (data: unknown) => void;
  setFixtureId: (id: string | null) => void;
  setTemplate: (t: FormTemplate) => void;
  loadTemplate: (t: FormTemplate, opts?: { dirty?: boolean }) => void;
  setBaseDocUrl: (url: string) => void;
  setTitle: (title: string) => void;
  updateField: (id: string, patch: Partial<Field>) => void;
  updateFieldRect: (id: string, rect: Partial<Rect>) => void;
  updateFieldRects: (updates: Array<{ id: string; rect: Partial<Rect> }>) => void;
  addField: (field: Field) => void;
  addFields: (fields: Field[]) => void;
  updateActivePageFields: (updater: (fields: Field[]) => Field[]) => void;
  removeField: (id: string) => void;
  removeFields: (ids: string[]) => void;
  markSaved: (opts: { id: string; revision: number }) => void;
  undo: () => void;
  redo: () => void;
  setViewportZoom: (zoom: number) => void;
  setPan: (x: number, y: number) => void;
  resetViewport: () => void;
  setGuides: (guides: { x?: number; y?: number }[]) => void;
  setGhostFields: (fields: Field[] | null) => void;
  duplicateSelected: () => void;
  nudgeSelected: (dx: number, dy: number) => void;
  addPage: () => void;
  duplicatePage: () => void;
  copyFieldsToPage: (target: number) => void;
  removePage: (n: number) => void;
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

function pushPast(s: EditorState): FormTemplate[] {
  return [...s.past, s.template].slice(-HISTORY_CAP);
}

function uniqueSuffix(): string {
  return `_${Math.random().toString(36).slice(2, 6)}`;
}

function cloneFields(fields: Field[]): Field[] {
  const suffix = uniqueSuffix();
  const idMap = new Map<string, string>();

  const cloned = fields.map((field) => {
    const id = `${field.id}${suffix}`;
    idMap.set(field.id, id);
    if (field.type === 'repeat') {
      return {
        ...field,
        id,
        fields: field.fields.map((child) => {
          const cid = `${child.id}${suffix}`;
          idMap.set(child.id, cid);
          return { ...child, id: cid };
        }),
      };
    }
    return { ...field, id };
  });

  return cloned.map((field) => {
    if (field.type !== 'repeat' || !field.overflow?.statementFieldId) return field;
    const mapped = idMap.get(field.overflow.statementFieldId);
    if (!mapped) return field;
    return { ...field, overflow: { ...field.overflow, statementFieldId: mapped } };
  });
}

export const useEditor = create<EditorState>((set, get) => ({
  template: initialTemplate,
  data: initialTemplate.sampleData ?? {},
  fixtureId: 'complete',
  activePage: 1,
  selectedFieldId: null,
  selectedFieldIds: [],
  hoveredFieldId: null,
  mode: 'edit',
  tool: 'pointer',
  baseDocUrl: baseUrlOf(initialTemplate),
  dirty: false,
  revision: 0,
  docEpoch: 0,
  aiBusy: null,
  past: [],
  future: [],
  viewportZoom: 1,
  panX: 0,
  panY: 0,
  guides: [],
  ghostFields: null,
  issuesOpen: false,

  setMode: (mode) => set({ mode }),
  setTool: (tool) => set({ tool }),
  setAiBusy: (aiBusy) => set({ aiBusy }),
  setIssuesOpen: (issuesOpen) => set({ issuesOpen }),
  selectField: (id, opts) =>
    set((s) => {
      if (!id) return { selectedFieldId: null, selectedFieldIds: [] };
      if (opts?.additive) {
        const has = s.selectedFieldIds.includes(id);
        const ids = has ? s.selectedFieldIds.filter((x) => x !== id) : [...s.selectedFieldIds, id];
        return {
          selectedFieldIds: ids,
          selectedFieldId: ids[ids.length - 1] ?? null,
          issuesOpen: false,
        };
      }
      return { selectedFieldId: id, selectedFieldIds: [id], issuesOpen: false };
    }),
  setHoveredField: (hoveredFieldId) => set({ hoveredFieldId }),
  setActivePage: (activePage) =>
    set({ activePage, selectedFieldId: null, selectedFieldIds: [], ghostFields: null }),
  setData: (data) => set({ data }),
  setFixtureId: (fixtureId) => set({ fixtureId }),
  setBaseDocUrl: (baseDocUrl) => set({ baseDocUrl }),
  setGuides: (guides) => set({ guides }),
  setGhostFields: (ghostFields) => set({ ghostFields }),
  setViewportZoom: (viewportZoom) => set({ viewportZoom: Math.min(4, Math.max(0.25, viewportZoom)) }),
  setPan: (panX, panY) => set({ panX, panY }),
  resetViewport: () => set({ viewportZoom: 1, panX: 0, panY: 0 }),

  setTemplate: (template) =>
    set((s) => ({
      template,
      data: (template as { sampleData?: unknown }).sampleData ?? s.data,
      baseDocUrl: baseUrlOf(template),
      selectedFieldId: null,
      selectedFieldIds: [],
      activePage: 1,
      dirty: true,
      revision: s.revision + 1,
      docEpoch: s.docEpoch + 1,
      past: [],
      future: [],
      ghostFields: null,
    })),
  loadTemplate: (template, opts) =>
    set((s) => ({
      template,
      data: (template as { sampleData?: unknown }).sampleData ?? {},
      fixtureId: template.fixtures?.[0]?.id ?? 'complete',
      baseDocUrl: baseUrlOf(template),
      selectedFieldId: null,
      selectedFieldIds: [],
      activePage: 1,
      dirty: opts?.dirty ?? false,
      revision: s.revision + 1,
      docEpoch: s.docEpoch + 1,
      past: [],
      future: [],
      ghostFields: null,
    })),
  setTitle: (title) =>
    set((s) => ({
      template: { ...s.template, title },
      dirty: true,
      revision: s.revision + 1,
      past: pushPast(s),
      future: [],
    })),

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
        selectedFieldIds: s.selectedFieldIds.map((x) => (x === id && typeof patch.id === 'string' ? patch.id : x)),
        dirty: true,
        revision: s.revision + 1,
        past: pushPast(s),
        future: [],
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
        past: pushPast(s),
        future: [],
      };
    }),

  updateFieldRects: (updates) =>
    set((s) => {
      let template = s.template;
      for (const u of updates) {
        const page = template.pages.find((p) => p.number === s.activePage);
        const existing = page?.fields.find((f) => f.id === u.id);
        if (!existing) continue;
        const next = { ...existing, rect: { ...existing.rect, ...u.rect } } as Field;
        template = replaceField(template, s.activePage, u.id, next);
      }
      return { template, dirty: true, revision: s.revision + 1, past: pushPast(s), future: [] };
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
      selectedFieldIds: [field.id],
      dirty: true,
      revision: s.revision + 1,
      past: pushPast(s),
      future: [],
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
      past: pushPast(s),
      future: [],
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
      past: pushPast(s),
      future: [],
    })),

  removeField: (id) =>
    set((s) => ({
      template: replaceField(s.template, s.activePage, id, null),
      selectedFieldId: s.selectedFieldId === id ? null : s.selectedFieldId,
      selectedFieldIds: s.selectedFieldIds.filter((x) => x !== id),
      dirty: true,
      revision: s.revision + 1,
      past: pushPast(s),
      future: [],
    })),

  removeFields: (ids) =>
    set((s) => {
      const setIds = new Set(ids);
      return {
        template: {
          ...s.template,
          pages: s.template.pages.map((p) =>
            p.number === s.activePage ? { ...p, fields: p.fields.filter((f) => !setIds.has(f.id)) } : p,
          ),
        },
        selectedFieldId: null,
        selectedFieldIds: [],
        dirty: true,
        revision: s.revision + 1,
        past: pushPast(s),
        future: [],
      };
    }),

  markSaved: ({ id, revision }) =>
    set((s) => (s.template.id === id && s.revision === revision ? { dirty: false } : s)),

  undo: () =>
    set((s) => {
      const prev = s.past[s.past.length - 1];
      if (!prev) return s;
      return {
        template: prev,
        past: s.past.slice(0, -1),
        future: [s.template, ...s.future].slice(0, HISTORY_CAP),
        dirty: true,
        revision: s.revision + 1,
        selectedFieldId: null,
        selectedFieldIds: [],
      };
    }),
  redo: () =>
    set((s) => {
      const next = s.future[0];
      if (!next) return s;
      return {
        template: next,
        future: s.future.slice(1),
        past: [...s.past, s.template].slice(-HISTORY_CAP),
        dirty: true,
        revision: s.revision + 1,
        selectedFieldId: null,
        selectedFieldIds: [],
      };
    }),

  duplicateSelected: () => {
    const s = get();
    const page = s.template.pages.find((p) => p.number === s.activePage);
    if (!page || s.selectedFieldIds.length === 0) return;
    const clones: Field[] = [];
    for (const id of s.selectedFieldIds) {
      const field = page.fields.find((f) => f.id === id);
      if (!field) continue;
      const nid = `${field.id}_${Math.random().toString(36).slice(2, 6)}`;
      clones.push({
        ...field,
        id: nid,
        rect: { ...field.rect, x: Math.min(0.9, field.rect.x + 0.02), y: Math.min(0.9, field.rect.y + 0.02) },
      } as Field);
    }
    if (clones.length) get().addFields(clones);
    set({
      selectedFieldIds: clones.map((c) => c.id),
      selectedFieldId: clones[clones.length - 1]?.id ?? null,
    });
  },

  nudgeSelected: (dx, dy) => {
    const s = get();
    const page = s.template.pages.find((p) => p.number === s.activePage);
    if (!page) return;
    const updates = s.selectedFieldIds.flatMap((id) => {
      const f = page.fields.find((x) => x.id === id);
      if (!f) return [];
      return [
        {
          id,
          rect: {
            x: Math.min(1, Math.max(0, f.rect.x + dx)),
            y: Math.min(1, Math.max(0, f.rect.y + dy)),
          },
        },
      ];
    });
    if (updates.length) get().updateFieldRects(updates);
  },

  addPage: () =>
    set((s) => {
      const src = s.template.pages.find((p) => p.number === s.activePage);
      const max = Math.max(0, ...s.template.pages.map((p) => p.number));
      const bg =
        typeof src?.backgroundRef === 'number' ? src.backgroundRef : Math.max(0, s.activePage - 1);
      return {
        template: {
          ...s.template,
          pages: [
            ...s.template.pages,
            { number: max + 1, ...(src?.size ? { size: src.size } : {}), backgroundRef: bg, fields: [] },
          ],
        },
        activePage: max + 1,
        selectedFieldId: null,
        selectedFieldIds: [],
        dirty: true,
        revision: s.revision + 1,
        past: pushPast(s),
        future: [],
        ghostFields: null,
      };
    }),

  duplicatePage: () =>
    set((s) => {
      const src = s.template.pages.find((p) => p.number === s.activePage);
      if (!src) return s;
      const max = Math.max(0, ...s.template.pages.map((p) => p.number));
      const next = max + 1;
      return {
        template: {
          ...s.template,
          pages: [
            ...s.template.pages,
            {
              number: next,
              size: src.size,
              backgroundRef: src.backgroundRef ?? src.number - 1,
              fields: cloneFields(src.fields),
            },
          ],
        },
        activePage: next,
        selectedFieldId: null,
        selectedFieldIds: [],
        dirty: true,
        revision: s.revision + 1,
        past: pushPast(s),
        future: [],
        ghostFields: null,
      };
    }),

  copyFieldsToPage: (target) =>
    set((s) => {
      if (target === s.activePage) return s;
      const src = s.template.pages.find((p) => p.number === s.activePage);
      const dest = s.template.pages.find((p) => p.number === target);
      if (!src || !dest || src.fields.length === 0) return s;
      const incoming = cloneFields(src.fields);
      return {
        template: {
          ...s.template,
          pages: s.template.pages.map((p) =>
            p.number === target ? { ...p, fields: [...p.fields, ...incoming] } : p,
          ),
        },
        activePage: target,
        selectedFieldId: null,
        selectedFieldIds: incoming.map((f) => f.id),
        dirty: true,
        revision: s.revision + 1,
        past: pushPast(s),
        future: [],
        ghostFields: null,
      };
    }),

  removePage: (n) =>
    set((s) => {
      if (s.template.pages.length <= 1) return s;
      const remaining = s.template.pages.filter((p) => p.number !== n);
      if (remaining.length === s.template.pages.length) return s;
      const copies = s.template.copies?.map((c) => ({
        ...c,
        pageFilter: c.pageFilter?.filter((pn) => pn !== n),
      }));
      const lower = remaining
        .filter((p) => p.number < n)
        .sort((a, b) => b.number - a.number)[0];
      return {
        template: {
          ...s.template,
          pages: remaining,
          ...(copies ? { copies } : {}),
        },
        activePage: lower?.number ?? remaining[0]!.number,
        selectedFieldId: null,
        selectedFieldIds: [],
        dirty: true,
        revision: s.revision + 1,
        past: pushPast(s),
        future: [],
        ghostFields: null,
      };
    }),
}));
