import prisma from '@/lib/prisma';
import { captureMessage, isSentryConfigured } from '@/lib/error-monitoring';

export interface ComponentHealth {
  status: 'up' | 'degraded' | 'down' | 'unconfigured';
  latencyMs?: number;
}

export interface SystemHealthReport {
  ok: boolean;
  status: 'healthy' | 'degraded';
  timestamp: string;
  uptimeSeconds: number;
  checks: {
    database: ComponentHealth;
    redisRateLimit: ComponentHealth;
    aiProvider: ComponentHealth;
    errorMonitoring: ComponentHealth;
  };
}

export interface HealthDbClient {
  $queryRawUnsafe: (query: string) => Promise<unknown>;
}

/**
 * Non-PII, secret-free readiness & uptime probe for external monitors and admin diagnostics.
 * Never returns connection strings, API keys, hostnames, or stack traces.
 */
export async function checkSystemHealth(options?: {
  db?: HealthDbClient;
  env?: Record<string, string | undefined>;
}): Promise<SystemHealthReport> {
  const db = options?.db ?? (prisma as unknown as HealthDbClient);
  const env = options?.env ?? process.env;

  const dbStart = Date.now();
  let database: ComponentHealth;
  try {
    await db.$queryRawUnsafe('SELECT 1');
    database = { status: 'up', latencyMs: Date.now() - dbStart };
  } catch {
    database = { status: 'down', latencyMs: Date.now() - dbStart };
  }

  const hasRedis = Boolean(
    env.UPSTASH_REDIS_REST_URL?.trim() && env.UPSTASH_REDIS_REST_TOKEN?.trim(),
  );
  const redisRateLimit: ComponentHealth = {
    status: hasRedis ? 'up' : 'unconfigured',
  };

  const hasGemini = Boolean(
    env.GEMINI_API_KEY?.trim() && env.GEMINI_API_KEY.trim() !== 'your_gemini_api_key_here',
  );
  const hasGroq = Boolean(
    env.GROQ_API_KEY?.trim() && env.GROQ_API_KEY.trim() !== 'your_groq_api_key_here',
  );
  const aiProvider: ComponentHealth = {
    status: hasGemini || hasGroq ? 'up' : 'unconfigured',
  };

  const sentryReady = options?.env
    ? Boolean(env.SENTRY_DSN || env.NEXT_PUBLIC_SENTRY_DSN)
    : isSentryConfigured();
  const errorMonitoring: ComponentHealth = {
    status: sentryReady ? 'up' : 'unconfigured',
  };

  const ok = database.status === 'up';
  if (!ok) {
    captureMessage('Health probe reported database DOWN', 'error', {
      service: 'uptime-monitor',
      component: 'database',
    });
  }

  return {
    ok,
    status: ok ? 'healthy' : 'degraded',
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.round(process.uptime()),
    checks: {
      database,
      redisRateLimit,
      aiProvider,
      errorMonitoring,
    },
  };
}

