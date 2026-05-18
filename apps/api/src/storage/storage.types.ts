// Storage abstraction. Two impls today: LocalStorageProvider (disk + ServeStatic at /files)
// and R2StorageProvider (placeholder until R2 creds + AWS SDK are wired in a later sprint).
// Swap via STORAGE_DRIVER env.

export interface UploadInput {
  buffer: Buffer;
  mimetype: string;
  originalName: string;
  // Logical folder under the storage root, e.g. 'products'. Becomes part of the key.
  folder?: string;
}

export interface UploadResult {
  // Stable identifier used to delete later. For LocalStorageProvider this is the relative
  // path under the uploads root, e.g. 'products/abc123.png'.
  key: string;
  // Publicly resolvable URL. For LocalStorageProvider it points at ServeStatic (/files/...).
  url: string;
}

export interface StorageProvider {
  upload(input: UploadInput): Promise<UploadResult>;
  delete(key: string): Promise<void>;
}

// DI token. Inject via @Inject(STORAGE_PROVIDER).
export const STORAGE_PROVIDER = 'STORAGE_PROVIDER';
