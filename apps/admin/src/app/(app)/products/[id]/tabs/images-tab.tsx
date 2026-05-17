'use client';

import type { ProductImage } from '@repo/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ImageGallery } from '@/components/products/image-gallery';

interface ImagesTabProps {
  images: ProductImage[];
  onChange: (images: ProductImage[]) => void;
}

export function ImagesTab({ images, onChange }: ImagesTabProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-[16px]">Images</CardTitle>
      </CardHeader>
      <CardContent>
        <ImageGallery images={images} onChange={onChange} />
      </CardContent>
    </Card>
  );
}
