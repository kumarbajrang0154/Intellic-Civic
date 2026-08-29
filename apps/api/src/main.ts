import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';
import { configureApp } from './bootstrap';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule);

  // Apply shared configuration (CORS, pipes, filters, prefix)
  await configureApp(app);

  const configService = app.get(ConfigService);
  const port = configService.get<number>('app.port', 4000);

  await app.listen(port);
  logger.log(`IntelliCivic API Server is running on port ${port} with prefix /api/v1`);
}

bootstrap();
