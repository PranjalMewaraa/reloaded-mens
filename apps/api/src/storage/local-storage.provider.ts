import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomBytes } from 'node:crypto';
import { mkdir, unlink, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { extension as mimeExtension } from 'mime-types';
import type { StorageProvider, UploadInput, UploadResult } from './storage.types.js';

// Writes uploaded files to apps/api/uploads/<folder>/<id>.<ext> and returns a URL that
// resolves through the @nestjs/serve-static mount at /files (configured in AppModule).
//
// Keys are random 12-byte hex strings (24 chars) to avoid leaking originalName and to make
// guessing other users' uploads infeasible.
@Injectable()
export class LocalStorageProvider implements StorageProvider {
  // Absolute path on disk. Resolved once at construction time.
  private readonly rootDir: string;
  // Base URL prefix that maps to rootDir via ServeStatic. Includes trailing slash.
  private readonly publicBase: string;

  constructor(private readonly config: ConfigService) {
    this.rootDir = resolve(process.cwd(), 'uploads');

    // PUBLIC_API_URL is stamped into every upload URL we persist. If it ever
    // silently defaults to localhost in production, the host gets baked into
    // Category.imageUrl / Product.images[].url rows and customers see broken
    // images — fixing it later requires a SQL rewrite of the affected rows.
    // Fail loudly here instead of carrying a confusing default forward.
    const raw = this.config.get<string>('PUBLIC_API_URL');
    const isProd = (this.config.get<string>('NODE_ENV') ?? 'development') === 'production';
    if (!raw || raw.trim().length === 0) {
      if (isProd) {
        throw new Error(
          'PUBLIC_API_URL is required in production. Add it to .env on the VPS ' +
            '(e.g. PUBLIC_API_URL=https://api.reloadedmens.in) and restart the api ' +
            'container. Without it every upload URL would be stamped with localhost.',
        );
      }
      // Dev convenience — keep the localhost default so `pnpm dev` works out of the box.
      console.warn(
        '[LocalStorageProvider] PUBLIC_API_URL not set — defaulting to http://localhost:4000 (dev only).',
      );
    }
    const publicApiUrl = (raw ?? 'http://localhost:4000').trim().replace(/\/+$/, '');
    this.publicBase = `${publicApiUrl}/files`;
  }

  async upload(input: UploadInput): Promise<UploadResult> {
    const folder = sanitizeFolder(input.folder ?? 'misc');
    const ext = safeExtension(input.mimetype, input.originalName);
    const id = randomBytes(12).toString('hex');
    const key = `${folder}/${id}${ext}`;
    const absDir = join(this.rootDir, folder);
    const absPath = join(this.rootDir, key);

    try {
      await mkdir(absDir, { recursive: true });
      await writeFile(absPath, input.buffer);
    } catch (err) {
      throw new InternalServerErrorException(`Failed to write upload: ${(err as Error).message}`);
    }

    return { key, url: `${this.publicBase}/${key}` };
  }

  async delete(key: string): Promise<void> {
    if (!isSafeKey(key)) {
      throw new InternalServerErrorException('Invalid storage key');
    }
    const absPath = join(this.rootDir, key);
    try {
      await unlink(absPath);
    } catch (err) {
      const code = (err as NodeJS.ErrnoException).code;
      // Silently ignore "already gone" — delete should be idempotent.
      if (code === 'ENOENT') return;
      throw new InternalServerErrorException(`Failed to delete upload: ${(err as Error).message}`);
    }
  }
}

// Restrict folder to lowercase letters/digits/hyphens. Prevents path traversal.
function sanitizeFolder(folder: string): string {
  const cleaned = folder.toLowerCase().replace(/[^a-z0-9-]/g, '');
  return cleaned.length > 0 ? cleaned : 'misc';
}

// mime-types returns false for unknown MIMEs; fall back to original name's extension or
// '.bin' as a last resort.
function safeExtension(mimetype: string, originalName: string): string {
  const fromMime = mimeExtension(mimetype);
  if (typeof fromMime === 'string' && fromMime.length > 0) return `.${fromMime}`;
  const match = originalName.match(/\.[a-zA-Z0-9]{1,8}$/);
  return match ? match[0].toLowerCase() : '.bin';
}

// Keys we produce always look like '<folder>/<24-hex>.<ext>'. Reject anything else so a
// caller can't pass '../etc/passwd'.
function isSafeKey(key: string): boolean {
  return /^[a-z0-9-]+\/[a-f0-9]{24}\.[a-z0-9]{1,8}$/.test(key);
}
