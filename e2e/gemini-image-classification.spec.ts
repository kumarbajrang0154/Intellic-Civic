import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';
import { classifyComplaintRouting, CategoryInfo } from '@/services/ai-provider';

const TEST_CATEGORIES: CategoryInfo[] = [
  {
    id: 'cat-sanitation',
    name: 'Sanitation & Solid Waste',
    description: 'Garbage collection, street cleaning, overflow dumpsters, waste disposal.',
    department: 'Solid Waste Management',
    departmentId: 'dept_solid_waste',
  },
  {
    id: 'cat-roads',
    name: 'Roads & Infrastructure',
    description: 'Potholes, broken footpaths, damaged bridges, missing manhole covers.',
    department: 'Roads & Infrastructure',
    departmentId: 'dept_roads_infra',
  },
  {
    id: 'cat-water',
    name: 'Water Supply & Sanitation',
    description: 'Pipeline leaks, contaminated water supply, low pressure, drainage blockage.',
    department: 'Water Supply & Sanitation',
    departmentId: 'dept_water_sanitation',
  },
  {
    id: 'cat-electricity',
    name: 'Electricity & Streetlights',
    description: 'Non-functional streetlights, dangerous loose wiring, transformer spark.',
    department: 'Electricity & Streetlights',
    departmentId: 'dept_electricity_lights',
  },
];

test.describe('PART 2 Live AI Category & Department Identification Suite', () => {
  test.setTimeout(120000); // 2 minutes for vision calls

  test.beforeEach(async () => {
    // 5s pacing to prevent TPM token burst limit on Gemini free tier
    await new Promise((r) => setTimeout(r, 5000));
  });

  test('Image 1: Pothole maps to cat-roads and Roads & Infrastructure', async () => {
    const fixturePath = path.resolve('e2e/fixtures/pothole.jpg');
    expect(fs.existsSync(fixturePath)).toBe(true);

    const result = await classifyComplaintRouting(
      'Deep pothole crater on the road causing risk to vehicles and commuters',
      'Road crater pothole',
      TEST_CATEGORIES,
      'en',
      fixturePath,
    );

    console.log('[Test Pothole Result]:', JSON.stringify(result, null, 2));

    expect(result.fallbackTriggered).toBe(false);
    expect(result.provider).toBe('gemini');
    expect(result.category).toBe('cat-roads');
    expect(result.confidence).toBeGreaterThanOrEqual(0.7);
  });

  test('Image 2: Garbage Pile maps to cat-sanitation and Solid Waste Management', async () => {
    const fixturePath = path.resolve('e2e/fixtures/garbage_pile.jpg');
    expect(fs.existsSync(fixturePath)).toBe(true);

    const result = await classifyComplaintRouting(
      'Massive heap of uncollected municipal garbage rotting on roadside corner',
      'Overflowing garbage pile',
      TEST_CATEGORIES,
      'en',
      fixturePath,
    );

    console.log('[Test Garbage Pile Result]:', JSON.stringify(result, null, 2));

    expect(result.fallbackTriggered).toBe(false);
    expect(result.provider).toBe('gemini');
    expect(result.category).toBe('cat-sanitation');
    expect(result.confidence).toBeGreaterThanOrEqual(0.7);
  });

  test('Image 3: Broken Streetlight maps to cat-electricity and Electricity & Streetlights', async () => {
    const fixturePath = path.resolve('e2e/fixtures/broken_streetlight.jpg');
    expect(fs.existsSync(fixturePath)).toBe(true);

    const result = await classifyComplaintRouting(
      'Damaged bent streetlight pole with shattered lamp fixture hanging dangerously',
      'Broken streetlight fixture',
      TEST_CATEGORIES,
      'en',
      fixturePath,
    );

    console.log('[Test Broken Streetlight Result]:', JSON.stringify(result, null, 2));

    expect(result.fallbackTriggered).toBe(false);
    expect(result.provider).toBe('gemini');
    expect(result.category).toBe('cat-electricity');
    expect(result.confidence).toBeGreaterThanOrEqual(0.7);
  });

  test('Image 4: Water Leakage maps to cat-water and Water Supply & Sanitation', async () => {
    const fixturePath = path.resolve('e2e/fixtures/water_leakage.jpg');
    expect(fs.existsSync(fixturePath)).toBe(true);

    const result = await classifyComplaintRouting(
      'Broken municipal supply pipeline gushing gallons of clean potable water onto street',
      'Ruptured water supply pipeline',
      TEST_CATEGORIES,
      'en',
      fixturePath,
    );

    console.log('[Test Water Leakage Result]:', JSON.stringify(result, null, 2));

    expect(result.fallbackTriggered).toBe(false);
    expect(result.provider).toBe('gemini');
    expect(result.category).toBe('cat-water');
    expect(result.confidence).toBeGreaterThanOrEqual(0.7);
  });

  test('Image 5: Blocked Drain maps to cat-water and Water Supply & Sanitation', async () => {
    const fixturePath = path.resolve('e2e/fixtures/blocked_drain.jpg');
    expect(fs.existsSync(fixturePath)).toBe(true);

    const result = await classifyComplaintRouting(
      'Clogged municipal stormwater drain overflowing with stagnant black wastewater',
      'Blocked drainage canal',
      TEST_CATEGORIES,
      'en',
      fixturePath,
    );

    console.log('[Test Blocked Drain Result]:', JSON.stringify(result, null, 2));

    expect(result.fallbackTriggered).toBe(false);
    expect(result.provider).toBe('gemini');
    expect(result.category).toBe('cat-water');
    expect(result.confidence).toBeGreaterThanOrEqual(0.7);
  });

  test('Case 6: Text-only complaint routes accurately without image', async () => {
    const result = await classifyComplaintRouting(
      'Street lights on 4th cross avenue are completely unlit and pitch dark creating safety risk for pedestrians',
      'Streetlights not working on 4th cross',
      TEST_CATEGORIES,
      'en',
      null,
    );

    console.log('[Test Text-Only Result]:', JSON.stringify(result, null, 2));

    expect(result.fallbackTriggered).toBe(false);
    expect(result.provider).toBe('gemini');
    expect(result.category).toBe('cat-electricity');
    expect(result.confidence).toBeGreaterThanOrEqual(0.7);
  });
});
