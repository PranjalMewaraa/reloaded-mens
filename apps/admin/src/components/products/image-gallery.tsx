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
import { GripVertical, Star, Trash2, Upload } from 'lucide-react';
import { toast } from 'sonner';
import type { ProductImage } from '@repo/types';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Input } from '@/components/ui/input';
import { Pill } from '@/components/ui/pill';
import { uploadImageFile } from '@/lib/upload';
import { cn } from '@/lib/utils';

interface ImageGalleryProps {
  images: ProductImage[];
  onChange: (next: ProductImage[]) => void;
}

export function ImageGallery({ images, onChange }: ImageGalleryProps) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));
  const [uploading, setUploading] = React.useState(false);

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
    setUploading(true);
    try {
      const startSort = sorted.length;
      const added: ProductImage[] = [];
      for (let i = 0; i < files.length; i += 1) {
        const file = files[i];
        try {
          const { url } = await uploadImageFile(file);
          added.push({ url, alt: '', sortOrder: startSort + i });
        } catch (err) {
          toast.error(`${file.name}: ${(err as Error).message}`);
        }
      }
      if (added.length > 0) {
        emit([...sorted, ...added]);
        toast.success(`${added.length} image${added.length === 1 ? '' : 's'} uploaded`);
      }
    } finally {
      setUploading(false);
    }
  }

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

  return (
    <div className="space-y-3">
      {sorted.length === 0 ? (
        <EmptyState
          icon={<Upload className="h-7 w-7" />}
          title="No images yet"
          description="Drop or pick files below. JPEG, PNG, or WebP, up to 5 MB each."
        />
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext
            items={sorted.map((i) => i.url)}
            strategy={rectSortingStrategy}
          >
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
            </div>
          </SortableContext>
        </DndContext>
      )}

      <label
        className={cn(
          'flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-ink-200 bg-snow p-6 text-center text-[13px] text-ink-500 transition hover:border-ink-900 hover:text-ink-900',
          uploading ? 'opacity-50' : '',
        )}
      >
        <Upload className="h-5 w-5" />
        <span>{uploading ? 'Uploading…' : 'Click to upload or drop images here'}</span>
        <input
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
          disabled={uploading}
        />
      </label>
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
          className="absolute left-1.5 top-1.5 rounded-md bg-snow/90 p-1 text-ink-700 backdrop-blur-sm hover:text-ink-900"
          aria-label="Drag to reorder"
        >
          <GripVertical className="h-3.5 w-3.5" />
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
