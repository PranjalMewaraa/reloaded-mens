import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { LocalStorageProvider } from './local-storage.provider.js';
import { R2StorageProvider } from './r2-storage.provider.js';
import { STORAGE_PROVIDER, type StorageProvider } from './storage.types.js';

// Provider factory keyed off STORAGE_DRIVER. Default 'local' keeps the dev/MVP flow
// working with no extra env. Flip to 'r2' (once that provider is real) to swap targets
// without touching any controller.
@Module({
  imports: [ConfigModule],
  providers: [
    LocalStorageProvider,
    R2StorageProvider,
    {
      provide: STORAGE_PROVIDER,
      inject: [ConfigService, LocalStorageProvider, R2StorageProvider],
      useFactory: (
        config: ConfigService,
        local: LocalStorageProvider,
        r2: R2StorageProvider,
      ): StorageProvider => {
        const driver = (config.get<string>('STORAGE_DRIVER') ?? 'local').toLowerCase();
        return driver === 'r2' ? r2 : local;
      },
    },
  ],
  exports: [STORAGE_PROVIDER],
})
export class StorageModule {}
