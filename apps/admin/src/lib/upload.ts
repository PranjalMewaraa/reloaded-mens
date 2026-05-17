'use client';

// Client-side image upload helper. Posts directly to the API via the browser fetch so
// HttpOnly auth cookies flow automatically — we don't go through the server-only `api()`
// wrapper (which reads next/headers cookies()).

import { env } from './env';

export interface UploadedImage {
  key: string;
  url: string;
}

const ENDPOINT = `${env.NEXT_PUBLIC_ADMIN_API_URL}/api/v1/uploads/image`;

export async function uploadImageFile(file: File): Promise<UploadedImage> {
  const fd = new FormData();
  fd.append('file', file, file.name);

  const res = await fetch(ENDPOINT, {
    method: 'POST',
    body: fd,
    credentials: 'include',
  });

  if (!res.ok) {
    let detail = '';
    try {
      const body = (await res.json()) as { message?: string; error?: string };
      detail = body.message ?? body.error ?? '';
    } catch {
      // Body not JSON — fall through with empty detail.
    }
    throw new Error(detail || `Upload failed (${res.status})`);
  }

  return (await res.json()) as UploadedImage;
}
