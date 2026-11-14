import { test, expect } from '@playwright/test';
import {
  extractDbHost,
  isProductionDatabaseHost,
  assertNotProductionDatabase,
} from '../../e2e/support/db-guard';

test.describe('Task A3: Database Deny-List Safety Guard (e2e/support/db-guard.ts)', () => {
  test('extractDbHost correctly parses valid postgres URLs and malformed inputs', () => {
    expect(extractDbHost('postgresql://user:pass@ep-test-db-123.neon.tech/dbname?sslmode=require')).toBe(
      'ep-test-db-123.neon.tech',
    );
    expect(extractDbHost('postgres://user:pass@my-custom-host.internal:5432/db')).toBe('my-custom-host.internal');
    expect(extractDbHost('')).toBe('');
    expect(extractDbHost(undefined)).toBe('');
  });

  test('Case 1: DATABASE_URL host equals PRODUCTION_DB_HOST -> exits 1 and throws error even if TEST_DATABASE_HOST equals it too', () => {
    let exitCode: number | null = null;
    let loggedMessage = '';

    const mockEnv = {
      PRODUCTION_DB_HOST: 'ep-prod-isolated-host.neon.tech',
      DATABASE_URL: 'postgresql://app:secret@ep-prod-isolated-host.neon.tech/intellicivic?sslmode=require',
      TEST_DATABASE_HOST: 'ep-prod-isolated-host.neon.tech', // Equal to production host as in the incident context
    };

    expect(isProductionDatabaseHost({ env: mockEnv })).toBe(true);

    expect(() => {
      assertNotProductionDatabase({
        env: mockEnv,
        exitFn: (code) => {
          exitCode = code;
        },
        logFn: (msg) => {
          loggedMessage = msg;
        },
      });
    }).toThrow('[DATABASE SAFETY GUARD] Aborted: DATABASE_URL host matches PRODUCTION_DB_HOST.');

    expect(exitCode).toBe(1);
    expect(loggedMessage).toContain('VIOLATION: DATABASE_URL host matches PRODUCTION_DB_HOST');
  });

  test('Case 2: DATABASE_URL host does NOT equal PRODUCTION_DB_HOST -> succeeds without exit or error', () => {
    let exitCalled = false;
    let loggedMessage = '';

    const mockEnv = {
      PRODUCTION_DB_HOST: 'ep-prod-isolated-host.neon.tech',
      DATABASE_URL: 'postgresql://app:secret@ep-test-safe-sandbox.neon.tech/intellicivic_test?sslmode=require',
      TEST_DATABASE_HOST: 'ep-test-safe-sandbox.neon.tech',
    };

    expect(isProductionDatabaseHost({ env: mockEnv })).toBe(false);

    expect(() => {
      assertNotProductionDatabase({
        env: mockEnv,
        exitFn: () => {
          exitCalled = true;
        },
        logFn: (msg) => {
          loggedMessage = msg;
        },
      });
    }).not.toThrow();

    expect(exitCalled).toBe(false);
    expect(loggedMessage).toBe('');
  });

  test('Case 2b: PRODUCTION_DB_HOST is unset -> succeeds without blocking', () => {
    let exitCalled = false;

    const mockEnv = {
      DATABASE_URL: 'postgresql://app:secret@ep-any-host.neon.tech/db',
      TEST_DATABASE_HOST: 'ep-any-host.neon.tech',
    };

    expect(isProductionDatabaseHost({ env: mockEnv })).toBe(false);

    expect(() => {
      assertNotProductionDatabase({
        env: mockEnv,
        exitFn: () => {
          exitCalled = true;
        },
      });
    }).not.toThrow();

    expect(exitCalled).toBe(false);
  });
});
