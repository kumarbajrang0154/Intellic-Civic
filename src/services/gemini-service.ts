import { GoogleGenerativeAI, SchemaType } from '@google/generative-ai';

export interface PhotoVerificationResult {
  verified: boolean;
  confidence: number;
  reasoning: string;
}

export interface ComplaintRoutingResult {
  category: string;
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  reasoning: string;
}

export interface CategoryInfo {
  id: string;
  name: string;
  description?: string;
}

const DEFAULT_CATEGORIES: CategoryInfo[] = [
  { id: 'cat-sanitation', name: 'Sanitation & Solid Waste', description: 'Garbage collection, street cleaning, dumpsters, waste disposal' },
  { id: 'cat-roads', name: 'Roads & Infrastructure', description: 'Potholes, broken footpaths, damaged bridges, manhole covers' },
  { id: 'cat-water', name: 'Water Supply & Sanitation', description: 'Pipeline leaks, contaminated water supply, low pressure, drainage blockage' },
  { id: 'cat-electricity', name: 'Electricity & Streetlights', description: 'Non-functional streetlights, dangerous loose wiring, transformer spark' },
];

/**
 * Heuristic keyword-based fallback function for complaint routing.
 * Used when Gemini API is unconfigured, times out, or throws an error.
 */
export function fallbackKeywordRouting(title: string, description: string): ComplaintRoutingResult {
  const text = (title + ' ' + description).toLowerCase();

  let category = 'cat-sanitation';
  if (text.includes('garbage') || text.includes('waste') || text.includes('clean') || text.includes('trash')) {
    category = 'cat-sanitation';
  } else if (text.includes('road') || text.includes('pothole') || text.includes('path') || text.includes('bridge')) {
    category = 'cat-roads';
  } else if (text.includes('water') || text.includes('leak') || text.includes('sewer') || text.includes('drain')) {
    category = 'cat-water';
  } else if (text.includes('light') || text.includes('wire') || text.includes('electric') || text.includes('power')) {
    category = 'cat-electricity';
  } else {
    category = 'cat-sanitation';
  }

  const descLower = description.toLowerCase();
  let priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' = 'MEDIUM';
  if (descLower.includes('danger') || descLower.includes('hazard') || descLower.includes('emergency') || descLower.includes('fire')) {
    priority = 'CRITICAL';
  } else if (descLower.includes('severe') || descLower.includes('urgent') || descLower.includes('block')) {
    priority = 'HIGH';
  }

  return {
    category,
    priority,
    reasoning: 'Fallback keyword heuristic routing used (AI service unavailable or unconfigured).',
  };
}

/**
 * Returns a initialized GoogleGenerativeAI client if a valid GEMINI_API_KEY is configured in .env.
 * Returns null if key is missing or is the default placeholder.
 */
function getGeminiClient(): GoogleGenerativeAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'your_gemini_api_key_here' || apiKey.trim() === '') {
    return null;
  }
  return new GoogleGenerativeAI(apiKey);
}

/**
 * Helper to fetch image data as a inlineData object for Gemini multimodal API.
 */
async function prepareImagePart(imageUrlOrBase64: string): Promise<{ inlineData: { data: string; mimeType: string } }> {
  if (imageUrlOrBase64.startsWith('data:')) {
    const matches = imageUrlOrBase64.match(/^data:(image\/[a-zA-Z+]+);base64,(.+)$/);
    if (matches) {
      return {
        inlineData: {
          mimeType: matches[1],
          data: matches[2],
        },
      };
    }
  }

  if (imageUrlOrBase64.startsWith('http://') || imageUrlOrBase64.startsWith('https://')) {
    const res = await fetch(imageUrlOrBase64, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'image/*, */*',
      },
    });
    if (!res.ok) {
      throw new Error(`Failed to fetch image from URL (${res.status} ${res.statusText})`);
    }
    const arrayBuffer = await res.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const contentType = res.headers.get('content-type') || 'image/jpeg';
    const mimeType = contentType.split(';')[0];
    return {
      inlineData: {
        mimeType: mimeType.startsWith('image/') ? mimeType : 'image/jpeg',
        data: buffer.toString('base64'),
      },
    };
  }

  // Treat as raw base64 string if no prefix
  return {
    inlineData: {
      mimeType: 'image/jpeg',
      data: imageUrlOrBase64,
    },
  };
}

/**
 * Executes a promise with a timeout (default 10,000ms).
 */
function withTimeout<T>(promise: Promise<T>, timeoutMs = 10000, errorMessage = 'Gemini API call timed out'): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(errorMessage));
    }, timeoutMs);

    promise
      .then((res) => {
        clearTimeout(timer);
        resolve(res);
      })
      .catch((err) => {
        clearTimeout(timer);
        reject(err);
      });
  });
}

/**
 * Verifies if an uploaded photo plausibly matches the described civic complaint using Gemini Vision API.
 * Uses Gemini's JSON mode / response schema for structured output.
 */
export async function verifyComplaintPhoto(
  imageUrlOrBase64: string,
  complaintDescription: string,
  category: string,
): Promise<PhotoVerificationResult> {
  const fallbackResult: PhotoVerificationResult = {
    verified: false,
    confidence: 0.0,
    reasoning: 'unverified — AI check unavailable',
  };

  const genAI = getGeminiClient();
  if (!genAI) {
    console.warn('[Gemini AI] GEMINI_API_KEY is missing or placeholder. Falling back to unverified status for photo.');
    return fallbackResult;
  }

  try {
    const imagePart = await prepareImagePart(imageUrlOrBase64);

    const model = genAI.getGenerativeModel({
      model: 'gemini-3.6-flash',
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: SchemaType.OBJECT,
          properties: {
            verified: {
              type: SchemaType.BOOLEAN,
              description: 'True if photo plausibly shows the described civic issue/category, false otherwise.',
            },
            confidence: {
              type: SchemaType.NUMBER,
              description: 'Confidence score between 0.0 and 1.0.',
            },
            reasoning: {
              type: SchemaType.STRING,
              description: 'Concise 1-2 sentence explanation of the judgment.',
            },
          },
          required: ['verified', 'confidence', 'reasoning'],
        },
      },
    });

    const prompt = `You are an expert AI urban infrastructure inspector for a Smart City Platform.
Analyze the provided evidence photo submitted for a civic complaint.

Complaint Details:
- Category / Topic: ${category}
- Citizen Description: ${complaintDescription}

Evaluate whether the photo plausibly shows the described civic issue or matches the category.
Return structured JSON output with:
- "verified": boolean (true if photo depicts the described issue or related infrastructure damage)
- "confidence": number (0.0 to 1.0)
- "reasoning": string (1-2 sentence explanation)`;

    const apiCall = model.generateContent([prompt, imagePart]);
    const response = await withTimeout(apiCall, 10000, 'Gemini photo verification timed out after 10s');
    const responseText = response.response.text();
    const parsed = JSON.parse(responseText);

    return {
      verified: Boolean(parsed.verified),
      confidence: typeof parsed.confidence === 'number' ? Math.min(Math.max(parsed.confidence, 0), 1) : 0.5,
      reasoning: parsed.reasoning || 'Photo verification completed.',
    };
  } catch (error: any) {
    console.warn('[Gemini AI] Error or timeout during photo verification:', error.message || error);
    return fallbackResult;
  }
}

/**
 * Classifies complaint category and priority using Gemini LLM.
 * Returns category ID/name, priority enum, and reasoning in structured JSON format.
 */
export async function classifyComplaintRouting(
  complaintDescription: string,
  complaintTitle = '',
  availableCategories: CategoryInfo[] = DEFAULT_CATEGORIES,
): Promise<ComplaintRoutingResult> {
  const fallback = fallbackKeywordRouting(complaintTitle, complaintDescription);

  const genAI = getGeminiClient();
  if (!genAI) {
    console.warn('[Gemini AI] GEMINI_API_KEY is missing or placeholder. Triggering keyword-heuristic routing fallback.');
    return fallback;
  }

  try {
    const categoryOptionsStr = availableCategories
      .map((c) => `- ID: "${c.id}", Name: "${c.name}" (${c.description || ''})`)
      .join('\n');

    const model = genAI.getGenerativeModel({
      model: 'gemini-3.6-flash',
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: SchemaType.OBJECT,
          properties: {
            category: {
              type: SchemaType.STRING,
              description: 'Must match one of the available category IDs.',
            },
            priority: {
              type: SchemaType.STRING,
              description: 'Must be one of: LOW, MEDIUM, HIGH, CRITICAL.',
            },
            reasoning: {
              type: SchemaType.STRING,
              description: 'Short 1-2 sentence reasoning for the chosen category and priority level.',
            },
          },
          required: ['category', 'priority', 'reasoning'],
        },
      },
    });

    const prompt = `You are an AI Civic Complaint Triage Engine for a Smart City Platform.
Analyze the complaint title and description, then classify it into the most appropriate Category ID and Priority Level.

Complaint Title: ${complaintTitle}
Complaint Description: ${complaintDescription}

Available Categories:
${categoryOptionsStr}

Allowed Priority Levels:
- LOW: Minor cosmetic or non-urgent issues
- MEDIUM: Standard maintenance requests (default)
- HIGH: Significant disruption or safety concern requiring urgent attention
- CRITICAL: Immediate danger, hazard, fire, severe structural breakdown or public safety emergency

Return JSON matching:
{
  "category": "<one of the valid Category IDs>",
  "priority": "LOW" | "MEDIUM" | "HIGH" | "CRITICAL",
  "reasoning": "<concise explanation>"
}`;

    const apiCall = model.generateContent(prompt);
    const response = await withTimeout(apiCall, 10000, 'Gemini complaint routing classification timed out after 10s');
    const responseText = response.response.text();
    const parsed = JSON.parse(responseText);

    const validCategoryIds = new Set(availableCategories.map((c) => c.id));
    let selectedCategory = String(parsed.category || '').trim();
    if (!validCategoryIds.has(selectedCategory)) {
      // Try matching by name if ID was missed
      const matchedByName = availableCategories.find(
        (c) => c.name.toLowerCase() === selectedCategory.toLowerCase(),
      );
      selectedCategory = matchedByName ? matchedByName.id : fallback.category;
    }

    let selectedPriority = String(parsed.priority || '').toUpperCase() as 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    if (!['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].includes(selectedPriority)) {
      selectedPriority = fallback.priority;
    }

    return {
      category: selectedCategory,
      priority: selectedPriority,
      reasoning: parsed.reasoning || 'AI triage classification complete.',
    };
  } catch (error: any) {
    console.warn('[Gemini AI] Error or timeout during complaint routing classification:', error.message || error);
    return fallback;
  }
}
