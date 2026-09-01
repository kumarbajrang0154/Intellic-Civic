import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpExceptionFilter } from './common/exceptions/http-exception.filter';

/**
 * Shared NestJS application bootstrap configuration.
 * Applied identically to both the local dev server (main.ts) and the
 * Vercel serverless handler (api/index.ts).
 *
 * Call this AFTER NestFactory.create() but BEFORE app.listen() / handler creation.
 */
export async function configureApp(app: INestApplication): Promise<void> {
  const configService = app.get(ConfigService);
  const frontendUrl =
    configService.get<string>('FRONTEND_URL') ||
    configService.get<string>('app.frontendUrl') ||
    'http://localhost:3000';

  // Global API prefix
  app.setGlobalPrefix('api/v1');

  // CORS — allow the local dev origin AND the production web app domain.
  // NEXT_PUBLIC_WEB_URL must be set in the API's Vercel env vars to the
  // deployed web app URL (e.g. https://intellic-civic.vercel.app).
  const webProductionUrl = configService.get<string>('NEXT_PUBLIC_WEB_URL') || '';
  const allowedOrigins = [
    frontendUrl,
    'http://localhost:3000',
    'http://localhost:4000',
  ];
  if (webProductionUrl && !allowedOrigins.includes(webProductionUrl)) {
    allowedOrigins.push(webProductionUrl);
  }

  app.enableCors({
    origin: allowedOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
  });

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // Global exception filter
  app.useGlobalFilters(new HttpExceptionFilter());
}
