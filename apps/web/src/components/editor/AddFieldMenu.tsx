'use client';

import { Plus } from 'lucide-react';
import type { Field } from '@tax-form-layer/spec';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { FIELD_PRESETS } from '@/lib/presets';

const FIELD_TYPES: { type: Field['type']; hint: string }[] = [
  { type: 'value', hint: 'Scalar value' },
  { type: 'checkbox', hint: 'Mark if truthy' },
  { type: 'radio', hint: 'Exclusive option' },
  { type: 'comb', hint: 'One char / cell' },
  { type: 'repeat', hint: 'Repeating rows' },
];

export function newField(type: Field['type']): Field {
  const id = `${type}_${Math.random().toString(36).slice(2, 7)}`;
  const rect = {
    x: 0.4,
    y: 0.45,
    width: 0.15,
    height: 0.03,
    rotation: 0,
    unit: 'fraction' as const,
  };
  switch (type) {
    case 'value':
      return {
        type,
        id,
        rect,
        binding: { source: 'jsonpath', path: '$.' },
        format: { type: 'none' },
      };
    case 'checkbox':
      return {
        type,
        id,
        rect: { ...rect, width: 0.02, height: 0.02 },
        binding: { source: 'jsonpath', path: '$.' },
        mark: 'check',
        markText: 'X',
      };
    case 'comb':
      return {
        type,
        id,
        rect,
        binding: { source: 'jsonpath', path: '$.' },
        format: { type: 'none' },
        cells: 9,
        cellGap: 0.1,
        alignRight: false,
      };
    case 'radio':
      return {
        type,
        id,
        rect: { ...rect, width: 0.02, height: 0.02 },
        group: 'group',
        option: true,
        binding: { source: 'jsonpath', path: '$.' },
        mark: 'check',
        markText: 'X',
      };
    case 'repeat':
      return {
        type,
        id,
        rect: { ...rect, width: 0.9, x: 0.05 },
        itemsPath: '$.',
        rowHeight: 0.035,
        fields: [
          {
            type: 'value',
            id: `${id}_col1`,
            rect: { x: 0, y: 0, width: 0.2, height: 0.03, rotation: 0, unit: 'fraction' },
            binding: { source: 'jsonpath', path: '@.' },
            format: { type: 'none' },
          },
        ],
      };
  }
}

export function AddFieldMenu({
  onAdd,
  side = 'bottom',
  compact = false,
  showPresets = false,
}: {
  onAdd: (field: Field) => void;
  side?: 'top' | 'bottom';
  compact?: boolean;
  showPresets?: boolean;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        {compact ? (
          <button
            type="button"
            className="flex h-full min-h-0 w-full flex-col items-center justify-center gap-0.5 text-[10px] font-medium text-muted-foreground touch-manipulation"
            aria-label="Add field"
          >
            <Plus className="h-5 w-5" />
            Add
          </button>
        ) : (
          <Button size="sm">
            <Plus /> <span className="hidden sm:inline">Add field</span>
          </Button>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="center" side={side} className="w-52">
        <DropdownMenuLabel>Add field</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {FIELD_TYPES.map(({ type, hint }) => (
          <DropdownMenuItem key={type} onSelect={() => onAdd(newField(type))}>
            <span className="h-2 w-2 rounded-sm bg-primary" />
            <span className="capitalize">{type}</span>
            <span className="ml-auto text-[10px] text-muted-foreground">{hint}</span>
          </DropdownMenuItem>
        ))}
        {showPresets && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuLabel>Presets</DropdownMenuLabel>
            {FIELD_PRESETS.map((p) => (
              <DropdownMenuItem key={p.id} onSelect={() => onAdd(p.create())}>
                {p.label}
              </DropdownMenuItem>
            ))}
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
