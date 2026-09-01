import { NestFactory } from '@nestjs/core';
import { ExpressAdapter } from '@nestjs/platform-express';
import express, { Express } from 'express';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/bootstrap';

let cachedServer: Express | null = null;

async function bootstrapServer(): Promise<Express> {
  const expressApp = express();
  const nestApp = await NestFactory.create(AppModule, new ExpressAdapter(expressApp));

  // Apply identical global config as local dev (validation, CORS, filters, prefix)
  await configureApp(nestApp);

  // Initialize NestJS without starting an HTTP listener (Vercel handles listening)
  await nestApp.init();

  return expressApp;
}

/**
 * Vercel Node.js serverless function handler.
 */
export default async function handler(req: any, res: any): Promise<void> {
  if (!cachedServer) {
    cachedServer = await bootstrapServer();
  }
  cachedServer(req, res);
}
