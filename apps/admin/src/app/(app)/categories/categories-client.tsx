'use client';

import * as React from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { Pencil, Plus, Trash2, Upload, X } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Pill } from '@/components/ui/pill';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Textarea } from '@/components/ui/textarea';
import { TreeView, type TreeReorderUpdate } from '@/components/ui/tree-view';
import { uploadImageFile } from '@/lib/upload';
import {
  createCategoryAction,
  deleteCategoryAction,
  reorderCategoriesAction,
  updateCategoryAction,
} from './actions';

export interface CategoryRow {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  parentId: string | null;
  imageUrl: string | null;
  sortOrder: number;
  isActive: boolean;
  seoTitle: string | null;
  seoDescription: string | null;
  children: CategoryRow[];
}

type SheetMode =
  | { kind: 'closed' }
  | { kind: 'create'; parentId: string | null }
  | { kind: 'edit'; node: CategoryRow };

export function CategoriesClient({ initial }: { initial: CategoryRow[] }) {
  const router = useRouter();
  const [mode, setMode] = React.useState<SheetMode>({ kind: 'closed' });
  const [pending, startTransition] = React.useTransition();

  async function handleReorder(updates: TreeReorderUpdate[]) {
    startTransition(async () => {
      const result = await reorderCategoriesAction({ updates });
      if (!result.ok) {
        toast.error(result.error ?? 'Reorder failed');
        return;
      }
      toast.success('Categories reordered');
      router.refresh();
    });
  }

  return (
    <>
      <div className="mb-4 flex items-center justify-between">
        <p className="text-[13px] text-ink-500">
          {initial.length === 0 ? 'No categories yet.' : `${countNodes(initial)} categor${countNodes(initial) === 1 ? 'y' : 'ies'}`}
        </p>
        <Button size="sm" onClick={() => setMode({ kind: 'create', parentId: null })}>
          <Plus className="mr-1.5 h-4 w-4" />
          New category
        </Button>
      </div>

      {initial.length === 0 ? (
        <EmptyState
          title="No categories yet"
          description="Add the first category to start organising your catalogue."
          action={
            <Button onClick={() => setMode({ kind: 'create', parentId: null })}>
              <Plus className="mr-1.5 h-4 w-4" /> Add category
            </Button>
          }
        />
      ) : (
        <TreeView<CategoryRow>
          nodes={initial}
          onReorder={handleReorder}
          renderRow={(node) => (
            <div className="flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-2">
                <span className="truncate text-[13px] font-medium text-ink-900">{node.name}</span>
                <span className="font-mono text-[10.5px] text-ink-400">/{node.slug}</span>
              </div>
              <div className="flex items-center gap-1.5">
                {!node.isActive ? <Pill tone="neutral">Hidden</Pill> : null}
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setMode({ kind: 'create', parentId: node.id })}
                  aria-label="Add subcategory"
                >
                  <Plus className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setMode({ kind: 'edit', node })}
                  aria-label="Edit category"
                >
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => {
                    if (
                      typeof window !== 'undefined' &&
                      window.confirm(`Delete "${node.name}"? Children must be moved first.`)
                    ) {
                      startTransition(async () => {
                        const result = await deleteCategoryAction(node.id);
                        if (!result.ok) {
                          toast.error(result.error ?? 'Delete failed');
                          return;
                        }
                        toast.success('Category deleted');
                        router.refresh();
                      });
                    }
                  }}
                  aria-label="Delete category"
                  disabled={pending}
                >
                  <Trash2 className="h-4 w-4 text-danger" />
                </Button>
              </div>
            </div>
          )}
        />
      )}

      <CategorySheet
        mode={mode}
        flat={flatten(initial)}
        onClose={() => setMode({ kind: 'closed' })}
        onSaved={() => {
          setMode({ kind: 'closed' });
          router.refresh();
        }}
      />
    </>
  );
}

interface CategorySheetProps {
  mode: SheetMode;
  flat: CategoryRow[];
  onClose: () => void;
  onSaved: () => void;
}

function CategorySheet({ mode, flat, onClose, onSaved }: CategorySheetProps) {
  const isOpen = mode.kind !== 'closed';
  const initialName = mode.kind === 'edit' ? mode.node.name : '';
  const initialSlug = mode.kind === 'edit' ? mode.node.slug : '';
  const initialDescription = mode.kind === 'edit' ? mode.node.description ?? '' : '';
  const initialParent =
    mode.kind === 'edit'
      ? mode.node.parentId ?? ''
      : mode.kind === 'create'
      ? mode.parentId ?? ''
      : '';
  const initialSeoTitle = mode.kind === 'edit' ? mode.node.seoTitle ?? '' : '';
  const initialSeoDescription = mode.kind === 'edit' ? mode.node.seoDescription ?? '' : '';
  const initialActive = mode.kind === 'edit' ? mode.node.isActive : true;
  const initialImageUrl = mode.kind === 'edit' ? mode.node.imageUrl ?? '' : '';

  const [name, setName] = React.useState(initialName);
  const [slug, setSlug] = React.useState(initialSlug);
  const [slugDirty, setSlugDirty] = React.useState(false);
  const [description, setDescription] = React.useState(initialDescription);
  const [parentId, setParentId] = React.useState(initialParent);
  const [seoTitle, setSeoTitle] = React.useState(initialSeoTitle);
  const [seoDescription, setSeoDescription] = React.useState(initialSeoDescription);
  const [isActive, setIsActive] = React.useState(initialActive);
  const [imageUrl, setImageUrl] = React.useState(initialImageUrl);
  const [uploading, setUploading] = React.useState(false);
  const [pending, startTransition] = React.useTransition();

  // Reset form fields when the mode changes (open with new node / close).
  React.useEffect(() => {
    setName(initialName);
    setSlug(initialSlug);
    setSlugDirty(false);
    setDescription(initialDescription);
    setParentId(initialParent);
    setSeoTitle(initialSeoTitle);
    setSeoDescription(initialSeoDescription);
    setIsActive(initialActive);
    setImageUrl(initialImageUrl);
  }, [mode]);

  async function handleImageFile(file: File | undefined) {
    if (!file) return;
    setUploading(true);
    try {
      const { url } = await uploadImageFile(file);
      setImageUrl(url);
    } catch (err) {
      toast.error((err as Error).message || 'Upload failed');
    } finally {
      setUploading(false);
    }
  }

  function handleNameChange(v: string) {
    setName(v);
    if (!slugDirty) setSlug(slugify(v));
  }

  function submit() {
    if (mode.kind === 'closed') return;
    const payload = {
      slug,
      name,
      description: description.trim() ? description : null,
      parentId: parentId || null,
      imageUrl: imageUrl.trim() ? imageUrl : null,
      seoTitle: seoTitle.trim() ? seoTitle : null,
      seoDescription: seoDescription.trim() ? seoDescription : null,
      isActive,
      sortOrder: 0,
    };
    startTransition(async () => {
      const result =
        mode.kind === 'create'
          ? await createCategoryAction(payload)
          : await updateCategoryAction(mode.node.id, payload);
      if (!result.ok) {
        toast.error(result.error ?? 'Save failed');
        return;
      }
      toast.success(mode.kind === 'create' ? 'Category created' : 'Category updated');
      onSaved();
    });
  }

  // Disallow making a node a child of itself or any of its descendants.
  const invalidParentIds = React.useMemo(() => {
    if (mode.kind !== 'edit') return new Set<string>();
    const out = new Set<string>([mode.node.id]);
    const stack = [...mode.node.children];
    while (stack.length > 0) {
      const cur = stack.pop()!;
      out.add(cur.id);
      stack.push(...cur.children);
    }
    return out;
  }, [mode]);

  return (
    <Sheet open={isOpen} onOpenChange={(v) => (!v ? onClose() : null)}>
      <SheetContent side="right" className="flex w-full flex-col p-0 sm:max-w-md">
        <SheetHeader>
          <SheetTitle>{mode.kind === 'edit' ? 'Edit category' : 'New category'}</SheetTitle>
          <SheetDescription>
            {mode.kind === 'edit'
              ? 'Update the details and visibility.'
              : 'Fill the basics. You can add subcategories later.'}
          </SheetDescription>
        </SheetHeader>
        <div className="flex-1 overflow-y-auto px-6 py-4">
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="cat-name">Name</Label>
              <Input
                id="cat-name"
                value={name}
                onChange={(e) => handleNameChange(e.target.value)}
                placeholder="Casual Shirts"
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cat-slug">Slug</Label>
              <Input
                id="cat-slug"
                value={slug}
                onChange={(e) => {
                  setSlug(e.target.value);
                  setSlugDirty(true);
                }}
                placeholder="casual-shirts"
                required
              />
              <p className="font-mono text-[10.5px] text-ink-500">
                /categories/{slug || 'slug'}
              </p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cat-parent">Parent</Label>
              <select
                id="cat-parent"
                value={parentId}
                onChange={(e) => setParentId(e.target.value)}
                className="flex h-12 w-full rounded-xl border border-ink-200 bg-snow px-3.5 text-[14px] text-ink-900"
              >
                <option value="">(Top level)</option>
                {flat
                  .filter((n) => !invalidParentIds.has(n.id))
                  .map((n) => (
                    <option key={n.id} value={n.id}>
                      {' '.repeat(depthOf(flat, n.id) * 2)}
                      {n.name}
                    </option>
                  ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cat-desc">Description</Label>
              <Textarea
                id="cat-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                placeholder="Optional"
              />
            </div>

            {/* Sprint 9 — category banner image. Renders at the top of the
                /c/<slug> page on the storefront. Drop one file at a time;
                preview shows current selection with a quick-remove. */}
            <div className="space-y-1.5">
              <Label>Image</Label>
              {imageUrl ? (
                <div className="relative aspect-[3/1] overflow-hidden rounded-xl border border-ink-100 bg-ink-50">
                  <Image
                    src={imageUrl}
                    alt={name || 'Category image'}
                    fill
                    sizes="(min-width: 640px) 28rem, 90vw"
                    className="object-cover"
                    unoptimized
                  />
                  <button
                    type="button"
                    onClick={() => setImageUrl('')}
                    className="absolute right-2 top-2 inline-flex h-7 w-7 items-center justify-center rounded-full bg-snow/90 text-ink-900 shadow-soft-sm hover:bg-snow"
                    aria-label="Remove image"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ) : (
                <label
                  className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-ink-200 bg-snow p-5 text-center text-[12.5px] text-ink-500 hover:border-ink-900 hover:text-ink-900 ${
                    uploading ? 'opacity-50' : ''
                  }`}
                >
                  <Upload className="h-5 w-5" />
                  <span>{uploading ? 'Uploading…' : 'Click to upload a banner'}</span>
                  <span className="font-mono text-[10.5px] text-ink-400">JPEG / PNG / WebP · up to 5 MB</span>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => handleImageFile(e.target.files?.[0])}
                    disabled={uploading}
                  />
                </label>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="cat-seo-title">SEO title</Label>
              <Input
                id="cat-seo-title"
                value={seoTitle}
                onChange={(e) => setSeoTitle(e.target.value)}
                placeholder="Optional"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cat-seo-desc">SEO description</Label>
              <Textarea
                id="cat-seo-desc"
                value={seoDescription}
                onChange={(e) => setSeoDescription(e.target.value)}
                rows={2}
                placeholder="Optional"
              />
            </div>
            <label className="flex items-center gap-2 text-[13px] text-ink-900">
              <input
                type="checkbox"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
                className="h-4 w-4 rounded border-ink-300"
              />
              Active (visible on storefront)
            </label>
          </div>
        </div>
        <SheetFooter>
          <Button variant="ghost" onClick={onClose} disabled={pending}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={pending || !name || !slug}>
            {pending ? 'Saving…' : mode.kind === 'edit' ? 'Save changes' : 'Create category'}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

function flatten(nodes: CategoryRow[]): CategoryRow[] {
  const out: CategoryRow[] = [];
  function walk(list: CategoryRow[]) {
    for (const n of list) {
      out.push(n);
      walk(n.children);
    }
  }
  walk(nodes);
  return out;
}

function countNodes(nodes: CategoryRow[]): number {
  return flatten(nodes).length;
}

function depthOf(flat: CategoryRow[], id: string): number {
  const byId = new Map(flat.map((n) => [n.id, n]));
  let depth = 0;
  let cur = byId.get(id);
  while (cur && cur.parentId) {
    depth += 1;
    cur = byId.get(cur.parentId);
  }
  return depth;
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
