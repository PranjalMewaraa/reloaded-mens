import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import type { NestExpressApplication } from '@nestjs/platform-express';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module.js';

async function bootstrap() {
  // rawBody:true captures the unparsed request bytes on req.rawBody so the mock-payment
  // webhook handler can verify its HMAC signature over the original body. Without this,
  // express.json() consumes the stream before we can hash it.
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { rawBody: true });
  const config = app.get(ConfigService);

  const corsOrigins = (config.get<string>('CORS_ORIGINS') ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  app.enableCors({
    origin: corsOrigins.length > 0 ? corsOrigins : true,
    credentials: true,
  });

  // JSON request bodies — bump from Express's default 100kb so larger product
  // payloads (description + images metadata) fit. Image bytes themselves arrive via
  // multipart through /uploads/image and have their own multer limit configured on
  // the route.
  app.useBodyParser('json', { limit: '2mb' });
  app.useBodyParser('urlencoded', { limit: '2mb', extended: true });
  app.use(cookieParser());
  // The global prefix only applies to controllers — ServeStatic is mounted at /files
  // outside this prefix (see AppModule).
  app.setGlobalPrefix('api/v1', { exclude: ['files/(.*)'] });

  const port = config.get<number>('API_PORT') ?? 4000;
  const host = config.get<string>('API_HOST') ?? '0.0.0.0';

  await app.listen(port, host);
  console.log(`API listening on http://${host}:${port}/api/v1`);
}

bootstrap().catch((err) => {
  console.error('Failed to start API:', err);
  process.exit(1);
});
