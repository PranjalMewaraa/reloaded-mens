'use client';

// Sprint 9 simplification — name + slug live at the top of the editor in a
// header card. Slug auto-syncs from name until the operator edits it explicitly
// (same UX as the old /products/new form, just inline).
//
// Phase 2b — accepts autosave status props and renders the AutoSaveStatus pill
// next to the publish control so the operator can see saves landing without
// scrolling to the SaveBar.

import * as React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PublishControl } from './publish-control';
import { AutoSaveStatus } from '../product-editor';
import type { EditorProduct } from '../product-editor';

interface HeaderSectionProps {
  draft: EditorProduct;
  patch: <K extends keyof EditorProduct>(key: K, value: EditorProduct[K]) => void;
  productId: string;
  dirty: boolean;
  autoStatus: 'idle' | 'pending' | 'saving' | 'saved' | 'error';
  lastSavedAt: number | null;
  onPublishedChange: (next: boolean) => void;
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-');
}

export function HeaderSection({
  draft,
  patch,
  productId,
  dirty,
  autoStatus,
  lastSavedAt,
  onPublishedChange,
}: HeaderSectionProps) {
  // The auto-sync flag is purely local. When the operator types in the slug
  // field, we lock it; if they later clear the slug we don't re-sync — feels
  // creepy to overwrite their explicit edit.
  const [slugDirty, setSlugDirty] = React.useState(() => !draft.slug.startsWith('draft-'));

  function handleNameChange(v: string) {
    patch('name', v);
    if (!slugDirty) {
      patch('slug', slugify(v));
    }
  }

  return (
    <Card>
      <CardContent className="space-y-4 pt-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 flex-1 space-y-1.5">
            <Label htmlFor="p-name">Name</Label>
            <Input
              id="p-name"
              value={draft.name}
              onChange={(e) => handleNameChange(e.target.value)}
              placeholder="Reloaded Camp Shirt"
              autoCapitalize="words"
              autoComplete="off"
              autoCorrect="off"
              className="text-[16px]"
            />
          </div>
          <div className="flex flex-col items-end gap-1.5">
            <AutoSaveStatus status={autoStatus} lastSavedAt={lastSavedAt} />
            <PublishControl
              draft={draft}
              dirty={dirty}
              productId={productId}
              onPublishedChange={onPublishedChange}
            />
          </div>
        </div>

        <details className="rounded-md border border-ink-100 bg-snow open:bg-ink-50/40">
          <summary className="cursor-pointer list-none px-3 py-2 font-mono text-[10.5px] uppercase tracking-caps text-ink-500">
            URL slug · /p/{draft.slug || 'slug'}
          </summary>
          <div className="space-y-1.5 border-t border-ink-100 px-3 py-3">
            <Label htmlFor="p-slug">Slug</Label>
            <Input
              id="p-slug"
              value={draft.slug}
              onChange={(e) => {
                patch('slug', e.target.value);
                setSlugDirty(true);
              }}
              placeholder="reloaded-camp-shirt"
              autoCapitalize="none"
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
              inputMode="url"
              className="font-mono"
            />
            <p className="font-mono text-[10.5px] text-ink-500">
              Auto-generated from name. Edit only if you need a specific URL.
            </p>
          </div>
        </details>
      </CardContent>
    </Card>
  );
}
