'use client';

// Drag-to-reorder image gallery with inline alt-text and primary indicator. dnd-kit
// SortableContext handles the keyboard + pointer drag UX. Image uploads go directly to
// the API via /lib/upload.ts so big bytes never traverse the Next.js server.

import * as React from 'react';
import Image from 'next/image';
import {
  DndContext,
  DragEndEvent,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  rectSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Camera, GripVertical, Loader2, Star, Trash2, Upload } from 'lucide-react';
import { toast } from 'sonner';
import type { ProductImage } from '@repo/types';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Input } from '@/components/ui/input';
import { Pill } from '@/components/ui/pill';
import { uploadImageFile } from '@/lib/upload';
import { cn } from '@/lib/utils';

// Phase 2a (mobile): per-file pending preview while uploads are in flight,
// shown alongside committed thumbs with a spinner overlay.
interface PendingImage {
  tempId: string;
  previewUrl: string;
  fileName: string;
}

interface ImageGalleryProps {
  images: ProductImage[];
  onChange: (next: ProductImage[]) => void;
}

export function ImageGallery({ images, onChange }: ImageGalleryProps) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));
  // Pending state per in-flight file. Object URLs are revoked when the upload
  // settles so we don't leak blobs.
  const [pending, setPending] = React.useState<PendingImage[]>([]);
  const pickerRef = React.useRef<HTMLInputElement | null>(null);
  const cameraRef = React.useRef<HTMLInputElement | null>(null);

  // Always render in sortOrder (and normalise on every change).
  const sorted = React.useMemo(
    () => [...images].sort((a, b) => a.sortOrder - b.sortOrder),
    [images],
  );

  function emit(next: ProductImage[]) {
    onChange(next.map((img, i) => ({ ...img, sortOrder: i })));
  }

  function handleDragEnd(e: DragEndEvent) {
    if (!e.over || e.active.id === e.over.id) return;
    const fromIdx = sorted.findIndex((i) => i.url === e.active.id);
    const toIdx = sorted.findIndex((i) => i.url === e.over!.id);
    if (fromIdx === -1 || toIdx === -1) return;
    emit(arrayMove(sorted, fromIdx, toIdx));
  }

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;

    // Stamp each incoming file with a temp id + object URL preview so the UI
    // shows the photo immediately, then upload in parallel.
    const list = Array.from(files);
    const items: Array<PendingImage & { file: File }> = list.map((file, i) => ({
      tempId: `pending-${Date.now()}-${i}-${Math.random().toString(36).slice(2, 8)}`,
      previewUrl: URL.createObjectURL(file),
      fileName: file.name,
      file,
    }));
    setPending((prev) => [...prev, ...items.map(({ file: _f, ...p }) => p)]);

    // Run them concurrently. allSettled so one failure doesn't kill the batch.
    const results = await Promise.allSettled(
      items.map(async (item) => {
        try {
          const { url } = await uploadImageFile(item.file);
          return { ok: true as const, tempId: item.tempId, url };
        } catch (err) {
          throw { tempId: item.tempId, fileName: item.fileName, error: (err as Error).message };
        }
      }),
    );

    // Collect new ProductImages in original drop order so the gallery sort
    // reflects the operator's chosen order.
    const startSort = sorted.length;
    const successById = new Map<string, string>();
    let failed = 0;
    for (const r of results) {
      if (r.status === 'fulfilled' && r.value.ok) {
        successById.set(r.value.tempId, r.value.url);
      } else if (r.status === 'rejected') {
        const reason = r.reason as { fileName: string; error: string };
        failed += 1;
        toast.error(`${reason.fileName}: ${reason.error}`);
      }
    }

    if (successById.size > 0) {
      const added: ProductImage[] = items
        .map((item, i) => {
          const url = successById.get(item.tempId);
          if (!url) return null;
          return { url, alt: '', sortOrder: startSort + i };
        })
        .filter((x): x is ProductImage => x !== null);
      emit([...sorted, ...added]);
      if (failed === 0) {
        toast.success(`${added.length} image${added.length === 1 ? '' : 's'} uploaded`);
      }
    }

    // Drop the pending previews + revoke their object URLs.
    setPending((prev) => {
      const matchIds = new Set(items.map((i) => i.tempId));
      prev.filter((p) => matchIds.has(p.tempId)).forEach((p) => URL.revokeObjectURL(p.previewUrl));
      return prev.filter((p) => !matchIds.has(p.tempId));
    });
  }

  // Revoke any leftover object URLs on unmount (e.g. operator navigates away
  // mid-upload).
  React.useEffect(() => {
    return () => {
      pending.forEach((p) => URL.revokeObjectURL(p.previewUrl));
    };
    // eslint disabled — we deliberately want cleanup-on-unmount only.

  }, []);

  function makePrimary(url: string) {
    const idx = sorted.findIndex((i) => i.url === url);
    if (idx <= 0) return;
    const next = [...sorted];
    const [picked] = next.splice(idx, 1);
    next.unshift(picked);
    emit(next);
  }

  function updateAlt(url: string, alt: string) {
    emit(sorted.map((i) => (i.url === url ? { ...i, alt } : i)));
  }

  function remove(url: string) {
    emit(sorted.filter((i) => i.url !== url));
  }

  // Combined render list: real images + in-flight pending previews.
  const hasContent = sorted.length > 0 || pending.length > 0;

  return (
    <div className="space-y-3">
      {!hasContent ? (
        <EmptyState
          icon={<Upload className="h-7 w-7" />}
          title="No images yet"
          description="Take a photo or pick from your gallery. JPEG, PNG, or WebP, up to 5 MB each."
        />
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={sorted.map((i) => i.url)} strategy={rectSortingStrategy}>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {sorted.map((img, idx) => (
                <SortableThumb
                  key={img.url}
                  image={img}
                  isPrimary={idx === 0}
                  onMakePrimary={() => makePrimary(img.url)}
                  onAltChange={(alt) => updateAlt(img.url, alt)}
                  onRemove={() => remove(img.url)}
                />
              ))}
              {pending.map((p) => (
                <PendingThumb key={p.tempId} pending={p} />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}

      {/* Mobile-friendly action row — Camera (rear camera) and Gallery split
          so the operator goes straight to either source without poking the
          OS-level picker twice. The hidden <input>s carry `multiple` so the
          gallery pick can grab a whole shoot at once. */}
      <div className="flex flex-col gap-2 sm:flex-row">
        <Button
          type="button"
          variant="outline"
          className="flex-1"
          onClick={() => cameraRef.current?.click()}
        >
          <Camera className="mr-2 h-4 w-4" />
          Take photo
        </Button>
        <Button
          type="button"
          variant="outline"
          className="flex-1"
          onClick={() => pickerRef.current?.click()}
        >
          <Upload className="mr-2 h-4 w-4" />
          Pick from gallery
        </Button>
      </div>
      <p className="text-center font-mono text-[10.5px] uppercase tracking-caps text-ink-500">
        JPEG · PNG · WebP · AVIF · GIF — up to 5 MB each
      </p>

      {/* Explicit MIME list (not just `image/*`) so Safari + iOS file pickers
          surface .avif files. The mobile camera input keeps `image/*` so the
          OS shows its native camera; AVIF isn't a camera capture format
          anyway. Keep these in sync with ALLOWED_IMAGE_MIMES in
          apps/api/src/uploads/uploads.controller.ts. */}
      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          handleFiles(e.target.files);
          // Reset value so re-picking the same file fires onChange.
          if (cameraRef.current) cameraRef.current.value = '';
        }}
      />
      <input
        ref={pickerRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/avif,image/gif"
        multiple
        className="hidden"
        onChange={(e) => {
          handleFiles(e.target.files);
          if (pickerRef.current) pickerRef.current.value = '';
        }}
      />
    </div>
  );
}

function PendingThumb({ pending }: { pending: PendingImage }) {
  return (
    <div className="group relative overflow-hidden rounded-md border border-ink-100 bg-snow">
      <div className="relative aspect-square overflow-hidden bg-ink-50">
        {/* Plain <img> intentional — pending.previewUrl is a blob: URL from
            createObjectURL, which next/image refuses to optimise. */}
        <img
          src={pending.previewUrl}
          alt={pending.fileName}
          className="absolute inset-0 h-full w-full object-cover opacity-70"
        />
        <div className="absolute inset-0 flex items-center justify-center bg-ink-900/20">
          <Loader2 className="h-6 w-6 animate-spin text-snow" />
        </div>
      </div>
      <div className="px-2 py-1.5 text-center font-mono text-[10.5px] text-ink-500">Uploading…</div>
    </div>
  );
}

interface SortableThumbProps {
  image: ProductImage;
  isPrimary: boolean;
  onMakePrimary: () => void;
  onAltChange: (alt: string) => void;
  onRemove: () => void;
}

function SortableThumb({
  image,
  isPrimary,
  onMakePrimary,
  onAltChange,
  onRemove,
}: SortableThumbProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: image.url,
  });
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        'group relative overflow-hidden rounded-md border bg-snow',
        isPrimary ? 'ring-1 ring-ink-900' : 'border-ink-100',
        isDragging ? 'opacity-60' : '',
      )}
    >
      <div className="relative aspect-square overflow-hidden bg-ink-50">
        <Image
          src={image.url}
          alt={image.alt || 'Product image'}
          fill
          sizes="(min-width:1024px) 25vw, (min-width: 640px) 33vw, 50vw"
          className="object-cover"
          unoptimized
        />
        <button
          type="button"
          {...attributes}
          {...listeners}
          className="absolute left-1.5 top-1.5 inline-flex h-8 w-8 items-center justify-center rounded-md bg-snow/90 text-ink-700 backdrop-blur-sm hover:text-ink-900 touch-none"
          aria-label="Drag to reorder"
        >
          <GripVertical className="h-4 w-4" />
        </button>
        {isPrimary ? (
          <div className="absolute right-1.5 top-1.5">
            <Pill tone="ink">Primary</Pill>
          </div>
        ) : null}
      </div>
      <div className="space-y-1.5 p-2">
        <Input
          value={image.alt}
          onChange={(e) => onAltChange(e.target.value)}
          placeholder="Alt text"
          className="h-9 text-[12.5px]"
        />
        <div className="flex items-center gap-1">
          {!isPrimary ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-[11.5px]"
              onClick={onMakePrimary}
            >
              <Star className="mr-1 h-3 w-3" /> Primary
            </Button>
          ) : null}
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="ml-auto h-7 w-7 text-danger"
            onClick={onRemove}
            aria-label="Remove image"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
}
