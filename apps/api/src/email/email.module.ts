import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ConsoleEmailService } from './console.email.service.js';
import { ResendEmailService } from './resend.email.service.js';
import { EMAIL_SERVICE, type EmailService } from './email.types.js';

// Picks the live transport at boot. RESEND_API_KEY present → real Resend sends emails;
// otherwise the console fallback just logs a one-liner so dev flows complete without a
// Resend account.
@Module({
  imports: [ConfigModule],
  providers: [
    ConsoleEmailService,
    {
      provide: EMAIL_SERVICE,
      inject: [ConfigService, ConsoleEmailService],
      useFactory: (config: ConfigService, consoleSvc: ConsoleEmailService): EmailService => {
        const apiKey = config.get<string>('RESEND_API_KEY');
        if (apiKey && apiKey.trim().length > 0) {
          return new ResendEmailService(config);
        }
        return consoleSvc;
      },
    },
  ],
  exports: [EMAIL_SERVICE],
})
export class EmailModule {}
