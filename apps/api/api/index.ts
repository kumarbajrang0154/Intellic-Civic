/**
 * apps/api/api/index.ts
 *
 * Vercel serverless entry point for the NestJS API.
 *
 * Architecture:
 *  - NestFactory.create() is called ONCE outside the exported handler so the
 *    NestJS application is reused across warm invocations (avoids cold-start
 *    penalty on every request).
 *  - @vendia/serverless-express bridges between Vercel's Node.js handler
 *    signature and Express (which NestJS uses internally via platform-express).
 *  - All global config (CORS, pipes, filters, prefix) is applied via the
 *    shared configureApp() function — identical to main.ts (local dev).
 *
 * ⚠️  SERVERLESS LIMITATIONS (flagged below file)
 */

import { NestFactory } from '@nestjs/core';
import { ExpressAdapter } from '@nestjs/platform-express';
import serverlessExpress from '@vendia/serverless-express';
import * as express from 'express';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/bootstrap';

type ServerlessHandler = (req: any, res: any, next?: any) => void | Promise<void>;

// Module-level singleton — reused across warm Vercel invocations.
let cachedHandler: ServerlessHandler | null = null;

async function buildHandler(): Promise<ServerlessHandler> {
  const expressApp = express();
  const nestApp = await NestFactory.create(AppModule, new ExpressAdapter(expressApp));

  // Apply identical global config as local dev (validation, CORS, filters, prefix)
  await configureApp(nestApp);

  // NestJS must be initialized before the express adapter is used
  await nestApp.init();

  return serverlessExpress({ app: expressApp }) as unknown as ServerlessHandler;
}

/**
 * Vercel Node.js serverless function handler.
 */
export default async function handler(req: any, res: any): Promise<void> {
  if (!cachedHandler) {
    cachedHandler = await buildHandler();
  }
  await (cachedHandler as ServerlessHandler)(req, res);
}
