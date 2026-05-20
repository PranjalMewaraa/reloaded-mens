import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module.js';

async function bootstrap() {
  // rawBody:true captures the unparsed request bytes on req.rawBody so the mock-payment
  // webhook handler can verify its HMAC signature over the original body. Without this,
  // express.json() consumes the stream before we can hash it.
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { rawBody: true });
  const config = app.get(ConfigService);

  // Trust the X-Forwarded-For chain from Cloudflare → Caddy → api so that
  // req.ip resolves to the real visitor IP, not the docker network gateway.
  // ThrottlerGuard's per-IP limits depend on this being correct, otherwise
  // every request would look like the same internal IP and one user could
  // exhaust the bucket for everyone.
  app.set('trust proxy', 1);

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

  // OpenAPI / Swagger UI — exposed at /api-docs in non-production by default.
  // Auto-discovered from Nest's controller + DTO metadata; we don't have
  // @ApiTags / @ApiProperty annotations everywhere yet, so the UI is rough
  // (controllers + routes show up, request/response shapes are inferred
  // from Zod schemas at runtime, not OpenAPI metadata at build time).
  // Still useful as a route inventory + smoke-test surface. Gate behind
  // `ENABLE_SWAGGER=true` in production if you want it there.
  const enableSwagger =
    (config.get<string>('ENABLE_SWAGGER') ?? '').toLowerCase() === 'true' ||
    (config.get<string>('NODE_ENV') ?? 'development') !== 'production';
  if (enableSwagger) {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('Reloaded Menswear API')
      .setDescription(
        'Internal REST API for the storefront + admin. Mounted under /api/v1. ' +
          'Cookie-based auth (access_token for admin, customer_access for storefront).',
      )
      .setVersion('0.1.0')
      .addCookieAuth('access_token', { type: 'apiKey', in: 'cookie' })
      .addCookieAuth('customer_access', { type: 'apiKey', in: 'cookie' })
      .build();
    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('api-docs', app, document, {
      swaggerOptions: { persistAuthorization: true },
    });
  }

  const port = config.get<number>('API_PORT') ?? 4000;
  const host = config.get<string>('API_HOST') ?? '0.0.0.0';

  await app.listen(port, host);
  console.log(`API listening on http://${host}:${port}/api/v1`);
}

bootstrap().catch((err) => {
  console.error('Failed to start API:', err);
  process.exit(1);
});
