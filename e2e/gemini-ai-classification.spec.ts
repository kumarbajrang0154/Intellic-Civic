import { test, expect } from '@playwright/test';
import { classifyComplaintRouting } from '@/services/gemini-service';

test.describe('Priority 3: Gemini AI Classification Live Integration', () => {
  test('Gemini 3.5 Flash successfully classifies civic complaint and does not return fallback reasoning', async () => {
    const title = 'Severe water pipeline rupture on 5th Main Road';
    const description = 'High pressure water pipeline broken near central bus stop causing major street flooding and traffic block.';

    const result = await classifyComplaintRouting(description, title);

    console.log('Gemini Classification Result:', result);

    expect(result.category).toBeTruthy();
    expect(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).toContain(result.priority);
    expect(result.reasoning).not.toContain('Fallback keyword heuristic routing used');
    expect(result.reasoning).not.toContain('Gemini Error');
  });
});
