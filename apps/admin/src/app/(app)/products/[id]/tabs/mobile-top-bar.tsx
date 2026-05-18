'use client';

// Phase 2c (mobile) — sticky top bar pinned to the editor's scroll container.
// Shows: product name (truncated), draft / published pill, autosave status,
// kebab menu with Publish / Unpublish / Delete. Visible only on `< md` widths;
// desktop continues to use the inline HeaderSection actions.
//
// The bar floats above the page content with `position: sticky`. We mount it
// inside the editor's section list (not the page chrome) so it scrolls with
// product content and inherits the layout's existing background colour.

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Eye, EyeOff, MoreVertical, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Pill } from '@/components/ui/pill';
import { bulkDeleteAction } from '../../actions';
import { updateProductAction } from '../actions';
import { AutoSaveStatus } from '../product-editor';
import type { EditorProduct } from '../product-editor';

type SaveStatus = 'idle' | 'pending' | 'saving' | 'saved' | 'error';

interface MobileTopBarProps {
  draft: EditorProduct;
  productId: string;
  autoStatus: SaveStatus;
  lastSavedAt: number | null;
  onPublishedChange: (next: boolean) => void;
}

export function MobileTopBar({
  draft,
  productId,
  autoStatus,
  lastSavedAt,
  onPublishedChange,
}: MobileTopBarProps) {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);
  const published = draft.isActive;

  async function togglePublish() {
    const previous = published;
    setBusy(true);
    onPublishedChange(!previous);
    const res = await updateProductAction(productId, { isActive: !previous });
    setBusy(false);
    if (!res.ok) {
      onPublishedChange(previous);
      toast.error(res.error ?? 'Could not change publish state');
      return;
    }
    toast.success(!previous ? 'Published' : 'Unpublished');
  }

  async function deleteProduct() {
    if (!confirm('Delete this product? This cannot be undone.')) return;
    setBusy(true);
    const res = await bulkDeleteAction([productId]);
    setBusy(false);
    if (!res.ok) {
      toast.error(res.error ?? 'Delete failed');
      return;
    }
    toast.success('Product deleted');
    router.push('/products');
  }

  return (
    <div className="sticky top-0 z-20 -mx-5 flex h-12 items-center gap-2 border-b border-ink-100 bg-bone/95 px-5 backdrop-blur-md md:hidden">
      <Pill tone={published ? 'success' : 'neutral'} withDot>
        {published ? 'Published' : 'Draft'}
      </Pill>
      <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-ink-900">
        {draft.name}
      </span>
      <AutoSaveStatus status={autoStatus} lastSavedAt={lastSavedAt} />
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9"
            aria-label="Product actions"
            disabled={busy}
          >
            <MoreVertical className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          {published ? (
            <DropdownMenuItem onClick={togglePublish}>
              <EyeOff className="mr-2 h-4 w-4" />
              Unpublish
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem onClick={togglePublish}>
              <Eye className="mr-2 h-4 w-4" />
              Publish
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={deleteProduct} className="text-danger focus:text-danger">
            <Trash2 className="mr-2 h-4 w-4" />
            Delete product
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
