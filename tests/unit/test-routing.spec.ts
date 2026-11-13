import { test } from '@playwright/test';
import { classifyComplaintRouting, DEFAULT_CATEGORIES } from '@/services/ai-provider';

test('AI routing for 5 test civic descriptions', async () => {
  const cases = [
    { title: 'Road issue', desc: 'pothole on a main road' },
    { title: 'Drainage problem', desc: 'blocked drain with bad smell' },
    { title: 'Electrical fault', desc: 'street light not working' },
    { title: 'Waste overflow', desc: 'garbage not collected for 3 days' },
    { title: 'Water outage', desc: 'no water supply in the lane' },
  ];

  const results = [];
  for (const c of cases) {
    const res = await classifyComplaintRouting(c.desc, c.title, DEFAULT_CATEGORIES);
    const cat = DEFAULT_CATEGORIES.find(x => x.id === res.category);
    results.push({
      description: c.desc,
      category: cat ? cat.name : (res.category || 'Unassigned'),
      categoryId: res.category,
      department: cat ? (cat.department || cat.departmentId) : 'Unassigned',
      priority: res.priority || 'MEDIUM',
      fallbackTriggered: Boolean(res.fallbackTriggered),
      provider: res.provider,
      confidence: res.confidence,
    });
  }

  console.log('TABLE_RESULTS_START');
  console.log(JSON.stringify(results, null, 2));
  console.log('TABLE_RESULTS_END');
});
