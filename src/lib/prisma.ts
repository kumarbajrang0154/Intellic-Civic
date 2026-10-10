import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

function getDatasourceUrl(): string | undefined {
  const url = process.env.DATABASE_URL;
  if (!url) return undefined;
  if (!url.includes('connect_timeout=')) {
    const separator = url.includes('?') ? '&' : '?';
    return `${url}${separator}connect_timeout=25&pool_timeout=25`;
  }
  return url;
}

const datasourceUrl = getDatasourceUrl();

export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    ...(datasourceUrl ? { datasourceUrl } : {}),
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  });

// Always attach to globalThis to preserve connection pool across Vercel Serverless Function invocations
globalForPrisma.prisma = prisma;

export default prisma;
