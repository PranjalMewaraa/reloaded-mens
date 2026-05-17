'use client';

import * as React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { EmptyState } from '@/components/ui/empty-state';
import { Pill } from '@/components/ui/pill';
import type { CategoryRow } from '../../../categories/categories-client';

interface CategoriesTabProps {
  tree: CategoryRow[];
  value: string[];
  onChange: (ids: string[]) => void;
}

// Recursive checkbox tree. Order in `value` reflects the user's add order so that
// PUT /products/:id/categories can preserve sortOrder.
export function CategoriesTab({ tree, value, onChange }: CategoriesTabProps) {
  const selected = React.useMemo(() => new Set(value), [value]);

  function toggle(id: string, checked: boolean) {
    if (checked) {
      if (selected.has(id)) return;
      onChange([...value, id]);
    } else {
      onChange(value.filter((v) => v !== id));
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-[16px]">Categories</CardTitle>
      </CardHeader>
      <CardContent>
        {tree.length === 0 ? (
          <EmptyState
            title="No categories defined"
            description="Create categories first under Catalogue → Categories."
          />
        ) : (
          <div className="rounded-2xl border border-ink-100">
            <CategoryLevel
              nodes={tree}
              depth={0}
              selected={selected}
              onToggle={toggle}
            />
          </div>
        )}
        {value.length > 0 ? (
          <div className="mt-3 flex flex-wrap gap-2">
            {value.map((id, idx) => {
              const node = findNode(tree, id);
              if (!node) return null;
              return (
                <Pill key={id} tone={idx === 0 ? 'ink' : 'neutral'}>
                  {idx === 0 ? 'Primary · ' : ''}
                  {node.name}
                </Pill>
              );
            })}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

function CategoryLevel({
  nodes,
  depth,
  selected,
  onToggle,
}: {
  nodes: CategoryRow[];
  depth: number;
  selected: Set<string>;
  onToggle: (id: string, checked: boolean) => void;
}) {
  return (
    <ul className="divide-y divide-ink-100">
      {nodes.map((n) => (
        <li key={n.id}>
          <label
            className="flex items-center gap-3 px-3 py-2.5 hover:bg-ink-50"
            style={{ paddingLeft: 12 + depth * 24 }}
          >
            <Checkbox
              checked={selected.has(n.id)}
              onCheckedChange={(c) => onToggle(n.id, c === true)}
            />
            <span className="text-[13px] text-ink-900">{n.name}</span>
            <span className="ml-1 font-mono text-[10.5px] text-ink-400">/{n.slug}</span>
          </label>
          {n.children.length > 0 ? (
            <CategoryLevel
              nodes={n.children}
              depth={depth + 1}
              selected={selected}
              onToggle={onToggle}
            />
          ) : null}
        </li>
      ))}
    </ul>
  );
}

function findNode(tree: CategoryRow[], id: string): CategoryRow | null {
  for (const n of tree) {
    if (n.id === id) return n;
    const inner = findNode(n.children, id);
    if (inner) return inner;
  }
  return null;
}
