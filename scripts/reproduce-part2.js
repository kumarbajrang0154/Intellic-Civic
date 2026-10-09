const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');
const { GoogleGenerativeAI, SchemaType } = require('@google/generative-ai');

dotenv.config();

const categories = [
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

const categoryOptionsStr = categories
  .map((c) => `- ID: "${c.id}" | Name: "${c.name}" | Department: "${c.department}" | Description: "${c.description}"`)
  .join('\n');

const testCases = [
  {
    name: '1. Pothole',
    file: 'e2e/fixtures/pothole.jpg',
    title: 'Deep road pothole',
    description: 'Severe crater on asphalt roadway dangerous for vehicles',
  },
  {
    name: '2. Garbage Pile',
    file: 'e2e/fixtures/garbage_pile.jpg',
    title: 'Overflowing garbage pile',
    description: 'Massive heap of municipal garbage decaying on roadside',
  },
  {
    name: '3. Broken Streetlight',
    file: 'e2e/fixtures/broken_streetlight.jpg',
    title: 'Broken streetlight',
    description: 'Damaged streetlight pole with shattered lamp fixture hanging down',
  },
  {
    name: '4. Water Leakage',
    file: 'e2e/fixtures/water_leakage.jpg',
    title: 'Water pipe leakage',
    description: 'Ruptured supply line spraying clean drinking water onto street',
  },
  {
    name: '5. Blocked Drain',
    file: 'e2e/fixtures/blocked_drain.jpg',
    title: 'Blocked drainage channel',
    description: 'Clogged stormwater drain overflowing with stagnant black wastewater',
  },
  {
    name: '6. Text-Only Complaint',
    file: null,
    title: 'Streetlights not working on 4th cross avenue',
    description: 'Street lights on 4th cross avenue are completely dark creating nighttime pedestrian safety hazard',
  },
];

async function run() {
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  const model = genAI.getGenerativeModel({
    model: 'gemini-3.1-flash-lite',
    generationConfig: {
      responseMimeType: 'application/json',
      responseSchema: {
        type: SchemaType.OBJECT,
        properties: {
          category: { type: SchemaType.STRING },
          confidence: { type: SchemaType.NUMBER },
          priority: { type: SchemaType.STRING },
          reasoning: { type: SchemaType.STRING },
          language: { type: SchemaType.STRING },
          titleEn: { type: SchemaType.STRING },
          descriptionEn: { type: SchemaType.STRING },
        },
        required: ['category', 'confidence', 'priority', 'reasoning', 'language'],
      },
    },
  });

  for (const tc of testCases) {
    console.log(`\n======================================================`);
    console.log(`TEST CASE: ${tc.name}`);
    console.log(`======================================================`);

    const prompt = `You are an AI Civic Complaint Triage Engine for a Smart City Platform.
Analyze the complaint information (including the attached image if provided), detect its language, classify category and priority, and assess confidence.

Complaint Title: ${tc.title}
Complaint Description: ${tc.description}
${tc.file ? 'An evidence photograph is attached. Analyze both the photograph and text to identify the civic issue and department.' : 'No photograph attached. Analyze the text description.'}

Available Municipal Categories (You MUST pick one exact category ID from this list):
${categoryOptionsStr}

Allowed Priority Levels: LOW, MEDIUM, HIGH, CRITICAL.

Instructions:
1. "category": Must be strictly one of the Category IDs from the list above. Do NOT invent new IDs.
2. "confidence": A number from 0.0 to 1.0 indicating your confidence in the category choice.
3. "priority": One of LOW, MEDIUM, HIGH, CRITICAL.
4. "reasoning": 1-2 sentence explanation connecting the evidence/text to the chosen category.
5. "language": Detect 2-letter ISO code (e.g. "en", "ta", "hi").
6. "titleEn": If language is NOT "en", accurately translate title to English, else null.
7. "descriptionEn": If language is NOT "en", accurately translate description to English, else null.

Return strictly JSON matching schema.`;

    let imagePart = null;
    let requestParts = [];

    if (tc.file) {
      const buffer = fs.readFileSync(tc.file);
      const b64 = buffer.toString('base64');
      imagePart = {
        inlineData: {
          mimeType: 'image/jpeg',
          data: b64,
        },
      };
      requestParts = [prompt, imagePart];

      console.log(`\n[Request Shape Sent to Gemini]:`);
      console.log(JSON.stringify({
        model: 'gemini-3.1-flash-lite',
        contents: [
          { type: 'text', text: prompt.slice(0, 150) + '... [truncated prompt]' },
          {
            inlineData: {
              mimeType: 'image/jpeg',
              data: `${b64.slice(0, 50)}... [truncated, length: ${b64.length}]`,
            },
          },
        ],
      }, null, 2));
    } else {
      requestParts = [prompt];
      console.log(`\n[Request Shape Sent to Gemini]:`);
      console.log(JSON.stringify({
        model: 'gemini-3.1-flash-lite',
        contents: [
          { type: 'text', text: prompt.slice(0, 150) + '... [truncated prompt]' },
        ],
      }, null, 2));
    }

    console.log(`\n[Category List Given to Model]:`);
    console.log(categoryOptionsStr);

    async function callWithRetry(fn, retries = 3, delays = [1500, 3000, 5000]) {
      let attempt = 0;
      while (true) {
        try {
          return await fn();
        } catch (err) {
          const status = err?.status || 0;
          const msg = String(err?.message || '');
          const isRetryable = status === 429 || status === 503 || msg.includes('429') || msg.includes('503') || msg.includes('high demand');
          if (isRetryable && attempt < retries) {
            const delay = delays[attempt] || 3000;
            console.log(`[HTTP ${status || '503'} High Demand Spike detected] Retrying attempt ${attempt + 1}/${retries} in ${delay}ms...`);
            await new Promise((r) => setTimeout(r, delay));
            attempt++;
          } else {
            throw err;
          }
        }
      }
    }

    const res = await callWithRetry(() => model.generateContent(requestParts));
    const rawText = res.response.text();
    console.log(`\n[Raw Model Text Response]:`);
    console.log(rawText);

    const parsed = JSON.parse(rawText);
    console.log(`\n[Parsed Result]:`);
    console.log(JSON.stringify(parsed, null, 2));

    const matchedCat = categories.find((c) => c.id === parsed.category);
    console.log(`\n[Provider Used]: gemini`);
    console.log(`[Final Assigned Category -> Department]: ${parsed.category} (${matchedCat?.name}) -> ${matchedCat?.department} (${matchedCat?.departmentId})`);

    // Pacing delay to avoid RPM spikes
    await new Promise((r) => setTimeout(r, 2500));
  }
}

run().catch((err) => {
  console.error('Fatal reproduction error:', err);
  process.exit(1);
});
