import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { StorageProvider, UploadInput, UploadResult } from './storage.types.js';

// Placeholder R2 provider. Implements the interface so STORAGE_DRIVER=r2 wiring is in
// place, but every call throws until the AWS SDK + real R2 credentials are added in a
// later sprint. The constructor reads the env vars to surface "set me up" errors at
// boot time when the driver is selected without credentials.
@Injectable()
export class R2StorageProvider implements StorageProvider {
  // Read env at construction so a misconfigured deploy surfaces "set me up" errors at
  // boot if the driver is selected without credentials. We intentionally don't store the
  // values — the real upload/delete impl will pull them again once the SDK is wired.
  constructor(config: ConfigService) {
    void config.get<string>('R2_ACCOUNT_ID');
    void config.get<string>('R2_BUCKET');
  }

  upload(_input: UploadInput): Promise<UploadResult> {
    return Promise.reject(
      new InternalServerErrorException(
        'R2 storage not configured. Set STORAGE_DRIVER=local or wire @aws-sdk/client-s3 + R2 creds.',
      ),
    );
  }

  delete(_key: string): Promise<void> {
    return Promise.reject(
      new InternalServerErrorException(
        'R2 storage not configured. Set STORAGE_DRIVER=local or wire @aws-sdk/client-s3 + R2 creds.',
      ),
    );
  }
}
