'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Loader2, Sparkles, Trash2 } from 'lucide-react';
import type { Field, Binding, FormatSpec, RepeatingGroup } from '@tax-form-layer/spec';
import { formatValue, resolveBinding, queryJsonPath, compileTemplate } from '@tax-form-layer/engine';
import { useEditor } from '@/lib/store';
import { previewPath } from '@/lib/jsonpath';
import { IssuesList } from './IssuesList';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

function IssuesEmpty() {
  const template = useEditor((s) => s.template);
  const data = useEditor((s) => s.data);
  const compiled = compileTemplate(template, data);
  const total = compiled.coverage.bound.length + compiled.coverage.missing.length;
  return (
    <IssuesList
      issues={compiled.issues}
      bound={compiled.coverage.bound.length}
      total={total}
    />
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {  
  return (
    <div className="grid grid-cols-[84px_1fr] items-center gap-2 py-1">
      <span className="text-[11px] font-medium text-muted-foreground">{label}</span>
      {children}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="panel-title mb-1.5">{title}</h3>
      <div className="rounded-lg border bg-card px-2.5 py-1.5 shadow-sm">{children}</div>
    </div>
  );
}

function Choice<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label?: string }[];
}) {
  return (
    <Select value={value} onValueChange={(v) => onChange(v as T)}>
      <SelectTrigger>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value} className="capitalize">
            {o.label ?? o.value}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <input
      type="checkbox"
      checked={checked}
      onChange={(e) => onChange(e.target.checked)}
      className="h-4 w-4 rounded border-input accent-[hsl(var(--primary))]"
    />
  );
}

export function PropertyPanel() {
  const template = useEditor((s) => s.template);
  const activePage = useEditor((s) => s.activePage);
  const selectedFieldId = useEditor((s) => s.selectedFieldId);
  const issuesOpen = useEditor((s) => s.issuesOpen);
  const data = useEditor((s) => s.data);
  const updateField = useEditor((s) => s.updateField);
  const updateFieldRect = useEditor((s) => s.updateFieldRect);
  const updateActivePageFields = useEditor((s) => s.updateActivePageFields);
  const removeField = useEditor((s) => s.removeField);

  const field = template.pages
    .find((p) => p.number === activePage)
    ?.fields.find((f) => f.id === selectedFieldId);

  if (!field || issuesOpen) {
    return <IssuesEmpty />;
  }

  const isRepeat = field.type === 'repeat';
  const hasBinding = !isRepeat;
  const hasFormat = field.type === 'value' || field.type === 'comb';
  const patch = (p: Partial<Field>) => updateField(field.id, p);

  return (
    <div className="scroll-slim flex-1 space-y-4 overflow-auto p-3">
      <Section title="Field">
        <Row label="ID">
          <Input
            value={field.id}
            onChange={(e) => patch({ id: e.target.value } as Partial<Field>)}
          />
        </Row>
        <Row label="Label">
          <Input
            value={field.label ?? ''}
            onChange={(e) => patch({ label: e.target.value } as Partial<Field>)}
          />
        </Row>
        <Row label="Box #">
          <Input
            value={field.boxNumber ?? ''}
            onChange={(e) => patch({ boxNumber: e.target.value } as Partial<Field>)}
          />
        </Row>
        <Row label="Type">
          <Choice
            value={field.type}
            onChange={(type) => {
              if (type === field.type) return;
              const next = convertFieldType(field, type);
              updateActivePageFields((fields) => fields.map((f) => (f.id === field.id ? next : f)));
            }}
            options={[
              { value: 'value', label: 'Value' },
              { value: 'checkbox', label: 'Checkbox' },
              { value: 'radio', label: 'Radio' },
              { value: 'comb', label: 'Comb' },
              { value: 'repeat', label: 'Repeat' },
            ]}
          />
        </Row>
      </Section>

      <Section title="Position (fraction of page)">
        {(['x', 'y', 'width', 'height'] as const).map((k) => (
          <Row key={k} label={k}>
            <Input
              type="number"
              step={0.005}
              min={0}
              value={round(field.rect[k])}
              onChange={(e) => updateFieldRect(field.id, { [k]: toFinite(e.target.value) })}
            />
          </Row>
        ))}
      </Section>

      {isRepeat && (
        <RepeatEditor
          field={field as RepeatingGroup}
          data={data}
          onChange={patch}
        />
      )}

      {hasBinding && 'binding' in field && (
        <BindingEditor
          binding={field.binding}
          data={data}
          label={field.label}
          boxNumber={field.boxNumber}
          onChange={(binding) => patch({ binding } as Partial<Field>)}
        />
      )}

      {hasFormat && 'format' in field && (
        <FormatEditor
          format={field.format}
          onChange={(format) => patch({ format } as Partial<Field>)}
        />
      )}

      {field.type === 'checkbox' && (
        <Section title="Checkbox">
          <Row label="Mark">
            <Choice
              value={field.mark}
              onChange={(mark) => patch({ mark } as Partial<Field>)}
              options={[
                { value: 'check', label: 'Check' },
                { value: 'cross', label: 'Cross' },
                { value: 'fill', label: 'Fill' },
                { value: 'text', label: 'Text' },
              ]}
            />
          </Row>
          {field.mark === 'text' && (
            <Row label="Mark text">
              <Input
                value={field.markText}
                onChange={(e) => patch({ markText: e.target.value } as Partial<Field>)}
              />
            </Row>
          )}
          <Row label="When">
            <Input
              value={field.checkedWhen === undefined ? '' : String(field.checkedWhen)}
              placeholder="truthy (default)"
              onChange={(e) => {
                const raw = e.target.value;
                if (raw === '') {
                  patch({ checkedWhen: undefined } as Partial<Field>);
                  return;
                }
                if (raw === 'true' || raw === 'false') {
                  patch({ checkedWhen: raw === 'true' } as Partial<Field>);
                  return;
                }
                const n = Number(raw);
                patch({ checkedWhen: Number.isFinite(n) && raw.trim() !== '' ? n : raw } as Partial<Field>);
              }}
            />
          </Row>
        </Section>
      )}

      {field.type === 'comb' && (
        <Section title="Comb">
          <Row label="Cells">
            <Input
              type="number"
              min={1}
              value={field.cells}
              onChange={(e) => patch({ cells: Math.max(1, Math.round(toFinite(e.target.value, 1))) } as Partial<Field>)}
            />
          </Row>
          <Row label="Cell gap">
            <Input
              type="number"
              step={0.05}
              min={0}
              max={0.9}
              value={field.cellGap}
              onChange={(e) => patch({ cellGap: Math.min(0.9, Math.max(0, toFinite(e.target.value))) } as Partial<Field>)}
            />
          </Row>
          <Row label="Right align">
            <Toggle
              checked={field.alignRight}
              onChange={(v) => patch({ alignRight: v } as Partial<Field>)}
            />
          </Row>
        </Section>
      )}

      {field.type !== 'repeat' && 'binding' in field && (
        <Section title="Live value">
          <div className="rounded-md bg-muted px-2 py-1.5 font-mono text-xs text-foreground">
            {(() => {
              const raw = resolveBinding(field.binding, { root: data });
              if (field.type === 'checkbox') {
                if (raw === undefined || raw === null || raw === '') return '—';
                const when = field.checkedWhen;
                const checked =
                  when === undefined ? Boolean(raw) : raw === when || String(raw) === String(when);
                return checked ? 'checked' : 'unchecked';
              }
              if (field.type === 'radio') {
                if (raw === undefined || raw === null || raw === '') return '—';
                const selected = raw === field.option || String(raw) === String(field.option);
                return selected ? 'selected' : 'unselected';
              }
              const formatted = formatValue(coerce(raw), field.format);
              return formatted !== null && formatted !== undefined && formatted !== ''
                ? String(formatted)
                : '—';
            })()}
          </div>
        </Section>
      )}

      {field.type === 'radio' && (
        <Section title="Radio">
          <Row label="Group">
            <Input value={field.group} onChange={(e) => patch({ group: e.target.value } as Partial<Field>)} />
          </Row>
          <Row label="Option">
            <Input
              value={String(field.option)}
              onChange={(e) => {
                const raw = e.target.value;
                const option =
                  raw === 'true' ? true : raw === 'false' ? false : raw !== '' && Number.isFinite(Number(raw)) ? Number(raw) : raw;
                patch({ option } as Partial<Field>);
              }}
            />
          </Row>
        </Section>
      )}

      {field.type !== 'repeat' && (
        <Section title="Constraints">
          <Row label="Required">
            <Toggle
              checked={Boolean(field.required)}
              onChange={(v) => patch({ required: v || undefined } as Partial<Field>)}
            />
          </Row>
          <Row label="Pattern">
            <Input
              value={field.pattern ?? ''}
              placeholder="regex"
              onChange={(e) =>
                patch({ pattern: e.target.value || undefined } as Partial<Field>)
              }
            />
          </Row>
          <Row label="Max chars">
            <Input
              type="number"
              min={1}
              value={field.maxChars ?? ''}
              onChange={(e) => {
                const n = Math.round(toFinite(e.target.value));
                patch({ maxChars: n > 0 ? n : undefined } as Partial<Field>);
              }}
            />
          </Row>
        </Section>
      )}

      <Section title="Condition">
        <Row label="Path">
          <Input
            value={
              field.condition && 'path' in field.condition ? field.condition.path : ''
            }
            placeholder="$.filingStatus"
            onChange={(e) => {
              const path = e.target.value;
              if (!path) {
                patch({ condition: undefined } as Partial<Field>);
                return;
              }
              patch({
                condition: {
                  path,
                  operator:
                    field.condition && 'operator' in field.condition
                      ? field.condition.operator
                      : 'eq',
                  value:
                    field.condition && 'value' in field.condition ? field.condition.value : '',
                },
              } as Partial<Field>);
            }}
          />
        </Row>
      </Section>

      <StyleEditor field={field} onChange={patch} />

      <Button variant="destructive" className="w-full" onClick={() => removeField(field.id)}>
        <Trash2 /> Delete field
      </Button>
    </div>
  );
}

function RepeatEditor({
  field,
  data,
  onChange,
}: {
  field: RepeatingGroup;
  data: unknown;
  onChange: (p: Partial<Field>) => void;
}) {
  const items = (() => {
    try {
      const result = queryJsonPath(field.itemsPath, { root: data });
      return Array.isArray(result) ? (result as unknown[]) : null;
    } catch {
      return null;
    }
  })();

  return (
    <Section title="Repeating group">
      <Row label="Items path">
        <Input
          value={field.itemsPath}
          onChange={(e) => onChange({ itemsPath: e.target.value } as Partial<Field>)}
          placeholder="$.items"
        />
      </Row>
      <Row label="Row height">
        <Input
          type="number"
          step={0.005}
          min={0.001}
          value={round(field.rowHeight)}
          onChange={(e) => onChange({ rowHeight: toFinite(e.target.value) } as Partial<Field>)}
        />
      </Row>
      <Row label="Max rows">
        <Input
          type="number"
          min={1}
          value={field.maxRows ?? ''}
          placeholder="unlimited"
          onChange={(e) => {
            const v = toFinite(e.target.value);
            onChange({ maxRows: v > 0 ? v : undefined } as Partial<Field>);
          }}
        />
      </Row>
          <Row label="Overflow">
            <Choice
              value={field.overflow?.strategy ?? 'clip'}
              onChange={(strategy) =>
                onChange({
                  overflow: {
                    strategy,
                    statementText: field.overflow?.statementText,
                    statementFieldId: field.overflow?.statementFieldId,
                  },
                } as Partial<Field>)
              }
              options={[
                { value: 'clip', label: 'Clip' },
                { value: 'paginate', label: 'Paginate' },
                { value: 'statement', label: 'Statement' },
              ]}
            />
          </Row>
          {(field.overflow?.strategy ?? 'clip') === 'statement' && (
            <>
              <Row label="Text">
                <Input
                  value={field.overflow?.statementText ?? ''}
                  placeholder="See attached"
                  onChange={(e) =>
                    onChange({
                      overflow: {
                        strategy: 'statement',
                        statementText: e.target.value,
                        statementFieldId: field.overflow?.statementFieldId,
                      },
                    } as Partial<Field>)
                  }
                />
              </Row>
              <Row label="Field id">
                <Input
                  value={field.overflow?.statementFieldId ?? ''}
                  placeholder="state_see_stmt"
                  onChange={(e) =>
                    onChange({
                      overflow: {
                        strategy: 'statement',
                        statementText: field.overflow?.statementText,
                        statementFieldId: e.target.value || undefined,
                      },
                    } as Partial<Field>)
                  }
                />
              </Row>
            </>
          )}

      <div className="mt-2 space-y-1.5">
        <p className="text-[10px] font-medium text-muted-foreground">Live data</p>
        <div className="rounded-md border bg-muted/50 px-2 py-1.5 text-[10px]">
          {items === null ? (
            <span className="text-muted-foreground italic">
              No array found at <span className="font-mono">{field.itemsPath}</span>
            </span>
          ) : items.length === 0 ? (
            <span className="text-muted-foreground italic">Array is empty</span>
          ) : (
            <>
              <p className="mb-1 font-semibold text-foreground">
                {items.length} row{items.length !== 1 ? 's' : ''}
                {field.maxRows ? ` (max ${field.maxRows} shown)` : ''}
              </p>
              <div className="space-y-0.5">
                {items.slice(0, field.maxRows ?? 4).map((item, i) => (
                  <div
                    key={i}
                    className="flex items-start gap-1.5 rounded bg-background/70 px-1.5 py-0.5"
                  >
                    <span className="shrink-0 font-mono text-muted-foreground">[{i}]</span>
                    <span className="min-w-0 truncate font-mono text-foreground">
                      {typeof item === 'object' && item !== null
                        ? Object.entries(item as Record<string, unknown>)
                            .slice(0, 3)
                            .map(([k, v]) => `${k}: ${JSON.stringify(v)}`)
                            .join('  ·  ')
                        : JSON.stringify(item)}
                    </span>
                  </div>
                ))}
                {items.length > (field.maxRows ?? 4) && (
                  <p className="pl-1 text-muted-foreground">
                    +{items.length - (field.maxRows ?? 4)} more…
                  </p>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      <div className="mt-2 space-y-1">
        <p className="text-[10px] font-medium text-muted-foreground">
          {field.fields.length} child field{field.fields.length !== 1 ? 's' : ''}
        </p>
        <div className="space-y-0.5 rounded-md border bg-muted/50 p-1">
          {field.fields.map((child) => {
            const childPath =
              'binding' in child && child.binding.source === 'jsonpath'
                ? child.binding.path
                : null;
            const preview = (() => {
              if (!childPath || items === null || items.length === 0) return null;
              try {
                const v = resolveBinding(
                  { source: 'jsonpath', path: childPath },
                  { root: items[0], row: items[0] },
                );
                return v !== null && v !== undefined ? String(v) : null;
              } catch {
                return null;
              }
            })();
            return (
              <div
                key={child.id}
                className="flex min-w-0 items-center gap-1.5 rounded px-1.5 py-1 text-[10px] hover:bg-accent"
              >
                <span className="truncate font-medium text-foreground">
                  {child.label ?? child.id}
                </span>
                {childPath && (
                  <span className="ml-auto shrink-0 font-mono text-muted-foreground">
                    {childPath}
                  </span>
                )}
                {preview && (
                  <span className="ml-1 shrink-0 rounded bg-emerald-100 px-1 font-mono text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400">
                    {preview}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </Section>
  );
}

interface Suggestion {
  path: string;
  valuePreview: string;
  reason?: string;
}

function BindingEditor({
  binding,
  data,
  label,
  boxNumber,
  onChange,
}: {
  binding: Binding;
  data: unknown;
  label?: string;
  boxNumber?: string;
  onChange: (b: Binding) => void;
}) {
  const preview = binding.source === 'jsonpath' ? previewPath(binding.path, data) : undefined;
  const [suggestions, setSuggestions] = useState<Suggestion[] | null>(null);
  const [loading, setLoading] = useState(false);

  async function suggest() {
    setLoading(true);
    try {
      const res = await fetch('/api/ai/suggest-binding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ label, boxNumber, data }),
      });
      const json = (await res.json()) as {
        suggestions?: Suggestion[];
        source?: string;
        error?: string;
      };
      if (!res.ok) throw new Error(json.error ?? 'Suggestion failed');
      setSuggestions(json.suggestions ?? []);
      if ((json.suggestions ?? []).length === 0) toast.info('No matching paths found');
    } catch (err) {
      toast.error('Suggestion failed', {
        description: err instanceof Error ? err.message : undefined,
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <Section title="Binding">
      <Row label="Source">
        <Choice
          value={binding.source}
          onChange={(v) => onChange(defaultBinding(v))}
          options={[
            { value: 'jsonpath', label: 'JSONPath' },
            { value: 'pointer', label: 'JSON Pointer' },
            { value: 'const', label: 'Constant' },
            { value: 'template', label: 'Template' },
            { value: 'computed', label: 'Computed' },
          ]}
        />
      </Row>
      {binding.source === 'jsonpath' && (
        <>
          <Row label="Path">
            <div className="flex gap-1">
              <Input
                value={binding.path}
                onChange={(e) => onChange({ ...binding, path: e.target.value })}
              />
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8 shrink-0"
                onClick={suggest}
                disabled={loading}
                title="Suggest bindings"
              >
                {loading ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Sparkles className="h-3.5 w-3.5" />
                )}
              </Button>
            </div>
          </Row>
          {suggestions && suggestions.length > 0 && (
            <div className="mb-1 space-y-0.5 rounded-md border bg-muted/50 p-1">
              {suggestions.map((s) => (
                <button
                  key={s.path}
                  className="flex w-full items-center gap-2 rounded px-1.5 py-1 text-left hover:bg-accent"
                  title={s.reason}
                  onClick={() => {
                    onChange({ source: 'jsonpath', path: s.path });
                    setSuggestions(null);
                  }}
                >
                  <span className="truncate font-mono text-[11px] text-foreground">{s.path}</span>
                  <span className="ml-auto shrink-0 truncate font-mono text-[10px] text-muted-foreground">
                    {s.valuePreview}
                  </span>
                </button>
              ))}
            </div>
          )}
        </>
      )}
      {binding.source === 'pointer' && (
        <Row label="Pointer">
          <Input
            value={binding.pointer}
            onChange={(e) => onChange({ ...binding, pointer: e.target.value })}
          />
        </Row>
      )}
      {binding.source === 'const' && (
        <Row label="Value">
          <Input
            value={String(binding.value)}
            onChange={(e) => onChange({ ...binding, value: e.target.value })}
          />
        </Row>
      )}
      {binding.source === 'template' && (
        <Row label="Template">
          <Input
            value={binding.template}
            onChange={(e) => onChange({ ...binding, template: e.target.value })}
          />
        </Row>
      )}
      {binding.source === 'computed' && binding.op !== 'if' && (
        <>
          <Row label="Op">
            <Choice
              value={binding.op}
              onChange={(op) => onChange({ ...binding, op, args: binding.args } as Binding)}
              options={['sum', 'add', 'sub', 'mul', 'div'].map((o) => ({ value: o }))}
            />
          </Row>
          {(binding.args ?? []).map((arg, i) =>
            arg.source === 'jsonpath' ? (
              <Row key={i} label={`Arg ${i + 1}`}>
                <Input
                  value={arg.path}
                  onChange={(e) => {
                    const args = [...binding.args];
                    args[i] = { source: 'jsonpath', path: e.target.value };
                    onChange({ ...binding, args });
                  }}
                />
              </Row>
            ) : null,
          )}
        </>
      )}
      {binding.source === 'computed' && binding.op === 'if' && (
        <p className="px-1 text-[10px] text-muted-foreground">If-bindings: edit condition on the field.</p>
      )}
      {binding.source === 'jsonpath' && (
        <div className="px-1 pb-1 pt-0.5 font-mono text-[10px] text-muted-foreground">
          → {preview === undefined ? 'no match' : JSON.stringify(preview)}
        </div>
      )}
    </Section>
  );
}

function FormatEditor({
  format,
  onChange,
}: {
  format: FormatSpec;
  onChange: (f: FormatSpec) => void;
}) {
  return (
    <Section title="Format">
      <Row label="Type">
        <Choice
          value={format.type}
          onChange={(v) => onChange(defaultFormat(v))}
          options={[
            'none',
            'text',
            'currency',
            'number',
            'percent',
            'date',
            'ssn',
            'ein',
            'phone',
            'boolean',
          ].map((t) => ({ value: t as FormatSpec['type'] }))}
        />
      </Row>
      {format.type === 'currency' && (
        <>
          <Row label="Decimals">
            <Input
              type="number"
              value={format.decimals}
              onChange={(e) => onChange({ ...format, decimals: toFinite(e.target.value) })}
            />
          </Row>
          <Row label="Negative">
            <Choice
              value={format.negative}
              onChange={(v) => onChange({ ...format, negative: v })}
              options={[
                { value: 'parentheses', label: '(1,234)' },
                { value: 'minus', label: '-1,234' },
                { value: 'none', label: '1,234' },
              ]}
            />
          </Row>
          <Row label="Symbol">
            <Toggle checked={format.symbol} onChange={(v) => onChange({ ...format, symbol: v })} />
          </Row>
        </>
      )}
      {format.type === 'text' && (
        <Row label="Case">
          <Choice
            value={format.case}
            onChange={(v) => onChange({ ...format, case: v })}
            options={['none', 'upper', 'lower', 'title'].map((c) => ({
              value: c as typeof format.case,
            }))}
          />
        </Row>
      )}
      {format.type === 'date' && (
        <Row label="Output">
          <Input
            value={format.outputFormat}
            onChange={(e) => onChange({ ...format, outputFormat: e.target.value })}
          />
        </Row>
      )}
      {format.type === 'ssn' && (
        <Row label="Mask">
          <Toggle checked={format.mask} onChange={(v) => onChange({ ...format, mask: v })} />
        </Row>
      )}
    </Section>
  );
}

function StyleEditor({ field, onChange }: { field: Field; onChange: (p: Partial<Field>) => void }) {
  const style = field.style;
  const set = (p: Record<string, unknown>) =>
    onChange({ style: { ...(style ?? {}), ...p } } as Partial<Field>);
  return (
    <Section title="Style">
      <Row label="Font size">
        <Input
          type="number"
          value={style?.fontSize ?? 9}
          onChange={(e) => set({ fontSize: toFinite(e.target.value, 9) })}
        />
      </Row>
      <Row label="Align">
        <Choice
          value={style?.align ?? 'left'}
          onChange={(v) => set({ align: v })}
          options={['left', 'center', 'right'].map((a) => ({ value: a }))}
        />
      </Row>
      <Row label="Overflow">
        <Choice
          value={style?.overflow ?? 'shrink'}
          onChange={(v) => set({ overflow: v })}
          options={['shrink', 'clip', 'ellipsis', 'wrap'].map((o) => ({ value: o }))}
        />
      </Row>
      <Row label="Color">
        <input
          type="color"
          className={cn(
            'h-8 w-full cursor-pointer rounded-md border border-input bg-background p-1',
          )}
          value={style?.color ?? '#000000'}
          onChange={(e) => set({ color: e.target.value })}
        />
      </Row>
    </Section>
  );
}

function convertFieldType(field: Field, type: Field['type']): Field {
  if (field.type === type) return field;

  const base = {
    id: field.id,
    rect: field.rect,
    ...(field.label ? { label: field.label } : {}),
    ...(field.boxNumber ? { boxNumber: field.boxNumber } : {}),
    ...(field.style ? { style: field.style } : {}),
    ...(field.condition ? { condition: field.condition } : {}),
    ...(field.note ? { note: field.note } : {}),
  };

  const binding: Binding =
    'binding' in field
      ? field.binding
      : field.type === 'repeat'
        ? { source: 'jsonpath', path: field.itemsPath }
        : { source: 'jsonpath', path: '$.' };

  const format: FormatSpec = 'format' in field ? field.format : { type: 'none' };

  switch (type) {
    case 'value':
      return { type, ...base, binding, format };
    case 'checkbox':
      return {
        type,
        ...base,
        binding,
        mark: field.type === 'checkbox' ? field.mark : 'check',
        markText: field.type === 'checkbox' ? field.markText : 'X',
        ...(field.type === 'checkbox' && field.checkedWhen !== undefined
          ? { checkedWhen: field.checkedWhen }
          : {}),
      };
    case 'comb':
      return {
        type,
        ...base,
        binding,
        format,
        cells: field.type === 'comb' ? field.cells : 9,
        cellGap: field.type === 'comb' ? field.cellGap : 0.1,
        alignRight: field.type === 'comb' ? field.alignRight : false,
      };
    case 'radio':
      return {
        type,
        ...base,
        binding,
        group: field.type === 'radio' ? field.group : 'group',
        option: field.type === 'radio' ? field.option : true,
        mark: 'check',
        markText: 'X',
      };
    case 'repeat': {
      const itemsPath =
        field.type === 'repeat'
          ? field.itemsPath
          : 'binding' in field && field.binding.source === 'jsonpath'
            ? field.binding.path
            : '$.';
      const defaultChild: RepeatingGroup['fields'][number] = {
        type: 'value',
        id: `${field.id}_col1`,
        rect: { x: 0, y: 0, width: 0.2, height: 0.03, rotation: 0, unit: 'fraction' },
        binding: { source: 'jsonpath', path: '@.' },
        format: { type: 'none' },
      };
      const fields =
        field.type === 'repeat' && field.fields.length > 0 ? field.fields : [defaultChild];
      return {
        type,
        ...base,
        itemsPath,
        rowHeight: field.type === 'repeat' ? field.rowHeight : 0.035,
        ...(field.type === 'repeat' && field.maxRows ? { maxRows: field.maxRows } : {}),
        fields,
      };
    }
  }
}

function defaultBinding(source: Binding['source']): Binding {
  switch (source) {
    case 'jsonpath':
      return { source: 'jsonpath', path: '$.' };
    case 'pointer':
      return { source: 'pointer', pointer: '/' };
    case 'const':
      return { source: 'const', value: '' };
    case 'template':
      return { source: 'template', template: '{$.field}' };
    case 'computed':
      return {
        source: 'computed',
        op: 'sum',
        args: [
          { source: 'jsonpath', path: '$.' },
          { source: 'jsonpath', path: '$.' },
        ],
      };
  }
}

function defaultFormat(type: FormatSpec['type']): FormatSpec {
  switch (type) {
    case 'currency':
      return {
        type: 'currency',
        locale: 'en-US',
        currency: 'USD',
        decimals: 2,
        symbol: false,
        grouping: true,
        negative: 'parentheses',
      };
    case 'text':
      return { type: 'text', case: 'none' };
    case 'number':
      return { type: 'number', locale: 'en-US', decimals: 0, grouping: false, negative: 'minus' };
    case 'percent':
      return { type: 'percent', locale: 'en-US', decimals: 2, scale: false };
    case 'date':
      return { type: 'date', outputFormat: 'MM/DD/YYYY', locale: 'en-US' };
    case 'ssn':
      return { type: 'ssn', mask: false };
    case 'ein':
      return { type: 'ein' };
    case 'phone':
      return { type: 'phone' };
    case 'boolean':
      return { type: 'boolean', trueText: 'X', falseText: '' };
    case 'none':
      return { type: 'none' };
  }
}

function coerce(v: unknown): string | number | boolean | null | undefined {
  if (v === null || v === undefined) return v;
  if (typeof v === 'object') return JSON.stringify(v);
  return v as string | number | boolean;
}

function round(n: number): number {
  return Math.round(n * 1000) / 1000;
}

function toFinite(value: string, fallback = 0): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}
