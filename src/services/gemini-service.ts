import { GoogleGenerativeAI, SchemaType } from '@google/generative-ai';
import fs from 'node:fs';
import path from 'node:path';

export interface PhotoVerificationResult {
  verified: boolean;
  confidence: number;
  reasoning: string;
}

export interface ComplaintRoutingResult {
  category: string;
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  reasoning: string;
  language?: string | null;
  titleEn?: string | null;
  descriptionEn?: string | null;
  fallbackTriggered?: boolean;
}

export interface CategoryInfo {
  id: string;
  name: string;
  description?: string;
}

export const DEFAULT_CATEGORIES: CategoryInfo[] = [
  { id: 'cat-sanitation', name: 'Sanitation & Solid Waste', description: 'Garbage collection, street cleaning, dumpsters, waste disposal' },
  { id: 'cat-roads', name: 'Roads & Infrastructure', description: 'Potholes, broken footpaths, damaged bridges, manhole covers' },
  { id: 'cat-water', name: 'Water Supply & Sanitation', description: 'Pipeline leaks, contaminated water supply, low pressure, drainage blockage' },
  { id: 'cat-electricity', name: 'Electricity & Streetlights', description: 'Non-functional streetlights, dangerous loose wiring, transformer spark' },
];

/**
 * Heuristic script/language detector for complaints.
 * Detects Indian regional languages (Tamil, Hindi, Telugu, etc.) or falls back to 'en'.
 */
export function detectTextLanguage(text: string, defaultLang?: string): string {
  if (defaultLang && defaultLang.toLowerCase().trim() && defaultLang.toLowerCase().trim() !== 'en') {
    return defaultLang.toLowerCase().trim().slice(0, 2);
  }
  if (/[\u0B80-\u0BFF]/.test(text)) return 'ta'; // Tamil
  if (/[\u0900-\u097F]/.test(text)) return 'hi'; // Hindi / Devanagari
  if (/[\u0C00-\u0C7F]/.test(text)) return 'te'; // Telugu
  if (/[\u0C80-\u0CFF]/.test(text)) return 'kn'; // Kannada
  if (/[\u0D00-\u0D7F]/.test(text)) return 'ml'; // Malayalam
  if (/[\u0980-\u09FF]/.test(text)) return 'bn'; // Bengali
  if (/[\u0A80-\u0AFF]/.test(text)) return 'gu'; // Gujarati
  if (/[\u0A00-\u0A7F]/.test(text)) return 'pa'; // Punjabi
  if (/[\u0B00-\u0B7F]/.test(text)) return 'or'; // Odia
  return 'en';
}

/**
 * Heuristic keyword-based fallback function for complaint routing.
 * Used when Gemini API is unconfigured, times out, or throws an error.
 */
export function fallbackKeywordRouting(
  title: string,
  description: string,
  hintLang?: string,
): ComplaintRoutingResult {
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

  const detected = detectTextLanguage(title + ' ' + description, hintLang);

  return {
    category,
    priority,
    reasoning: 'Fallback keyword heuristic routing used (AI service unavailable or unconfigured).',
    language: detected !== 'en' ? detected : (hintLang && hintLang !== 'en' ? hintLang : 'en'),
    titleEn: null,
    descriptionEn: null,
    fallbackTriggered: true,
  };
}

export const DEFAULT_GEMINI_MODEL = 'gemini-3.8-flash';

/**
 * Returns the configured Gemini model name from GEMINI_MODEL env var or default fallback.
 */
export function getGeminiModel(): string {
  return process.env.GEMINI_MODEL?.trim() || DEFAULT_GEMINI_MODEL;
}

/**
 * Sanitizes error messages by scrubbing any potential API keys and extracts HTTP status.
 */
export function sanitizeAiErrorMessage(error: any): { status: number; message: string } {
  let status = error?.status || error?.statusCode;
  let message = error?.message || String(error || 'Unknown AI error');

  const apiKey = process.env.GEMINI_API_KEY;
  if (apiKey && apiKey.length > 5) {
    message = message.split(apiKey).join('[REDACTED_API_KEY]');
  }
  // Strip any API key parameters and URLs containing API keys
  message = message.replace(/https?:\/\/[^\s"'<>]*(?:key=[a-zA-Z0-9_\-]+)[^\s"'<>]*/g, (url) => {
    return url.replace(/key=[a-zA-Z0-9_\-]+/g, 'key=[REDACTED_API_KEY]');
  });
  message = message.replace(/key=[a-zA-Z0-9_\-]+/g, 'key=[REDACTED_API_KEY]');

  if (typeof status !== 'number') {
    if (message.includes('403') || message.includes('Forbidden')) status = 403;
    else if (message.includes('404') || message.includes('not found')) status = 404;
    else if (message.includes('429') || message.includes('quota') || message.includes('RESOURCE_EXHAUSTED')) status = 429;
    else if (message.includes('400') || message.includes('Bad Request')) status = 400;
    else if (message.includes('timed out') || message.includes('timeout')) status = 408;
    else status = 500;
  }

  return { status, message };
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
    console.error('[Gemini AI] CONFIG_ERROR: GEMINI_API_KEY is missing or unconfigured. Status: 400. Message: API key missing or placeholder. Photo verification fallback active.');
    return fallbackResult;
  }

  try {
    const imagePart = await prepareImagePart(imageUrlOrBase64);
    const currentModel = getGeminiModel();

    const model = genAI.getGenerativeModel({
      model: currentModel,
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
    const { status, message } = sanitizeAiErrorMessage(error);
    console.error(`[Gemini AI] PHOTO_VERIFICATION_FAILED: Model: ${getGeminiModel()}. Status: ${status}. Message: ${message}`);
    return fallbackResult;
  }
}

/**
 * Classifies complaint category and priority using Gemini LLM.
 * Additionally detects complaint language and translates non-English complaints into English (titleEn, descriptionEn).
 * Returns category ID/name, priority enum, language, English translations, and reasoning in structured JSON format.
 */
export async function classifyComplaintRouting(
  complaintDescription: string,
  complaintTitle = '',
  availableCategories: CategoryInfo[] = DEFAULT_CATEGORIES,
  hintLang?: string,
): Promise<ComplaintRoutingResult> {
  const fallback = fallbackKeywordRouting(complaintTitle, complaintDescription, hintLang);

  // In test environments or when a local mock config exists, handle mocked Gemini
  const mockFilePath = path.join(process.cwd(), '.gemini-mock.json');
  if (fs.existsSync(mockFilePath)) {
    try {
      const rawMock = fs.readFileSync(mockFilePath, 'utf8');
        const mockData = JSON.parse(rawMock);
        if (mockData.mode === 'fail') {
          throw new Error('Mocked Gemini API failure for test verification');
        }
        if (mockData.mode === 'success') {
          const detectedLang = mockData.language || 'en';
          return {
            category: mockData.category || 'cat-sanitation',
            priority: mockData.priority || 'MEDIUM',
            reasoning: mockData.reasoning || 'Mocked Gemini AI classification.',
            language: detectedLang,
            titleEn: detectedLang !== 'en' ? (mockData.titleEn ?? null) : null,
            descriptionEn: detectedLang !== 'en' ? (mockData.descriptionEn ?? null) : null,
            fallbackTriggered: false,
          };
        }
    } catch (mockErr: any) {
      if (mockErr.message && mockErr.message.includes('Mocked Gemini API failure')) {
        const currentModel = getGeminiModel();
        const { status, message } = sanitizeAiErrorMessage(mockErr);
        console.error('[Gemini AI] ROUTING_CLASSIFICATION_FAILED', {
          type: 'GEMINI_CLASSIFICATION_FAILED',
          model: currentModel,
          status,
          errorMessage: message,
          timestamp: new Date().toISOString(),
        });
        return {
          ...fallback,
          reasoning: `[Fallback Heuristic Used — Gemini Error: ${message}] ${fallback.reasoning}`,
          fallbackTriggered: true,
        };
      }
    }
  }

  const genAI = getGeminiClient();
  if (!genAI) {
    console.error('[Gemini AI] CONFIG_ERROR: GEMINI_API_KEY is missing or unconfigured. Status: 400. Message: API key missing or placeholder. Heuristic routing fallback active.');
    return fallback;
  }

  try {
    const categoryOptionsStr = availableCategories
      .map((c) => `- ID: "${c.id}", Name: "${c.name}" (${c.description || ''})`)
      .join('\n');

    const currentModel = getGeminiModel();
    const model = genAI.getGenerativeModel({
      model: currentModel,
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
            language: {
              type: SchemaType.STRING,
              description: 'Detected language 2-letter ISO 639-1 code (e.g. en, ta, hi, te, kn, mr, etc.).',
            },
            titleEn: {
              type: SchemaType.STRING,
              description: 'English translation of complaint title if language is not "en", otherwise empty string.',
            },
            descriptionEn: {
              type: SchemaType.STRING,
              description: 'English translation of complaint description if language is not "en", otherwise empty string.',
            },
          },
          required: ['category', 'priority', 'reasoning', 'language'],
        },
      },
    });

    const prompt = `You are an AI Civic Complaint Triage and Translation Engine for a Smart City Platform.
Analyze the complaint title and description, detect its language, classify category and priority, and translate to English if the language is not English.

Complaint Title: ${complaintTitle}
Complaint Description: ${complaintDescription}

Available Categories:
${categoryOptionsStr}

Allowed Priority Levels:
- LOW: Minor cosmetic or non-urgent issues
- MEDIUM: Standard maintenance requests (default)
- HIGH: Significant disruption or safety concern requiring urgent attention
- CRITICAL: Immediate danger, hazard, fire, severe structural breakdown or public safety emergency

Language & Translation Requirements:
- "language": Detect 2-letter ISO code (e.g. "en" for English, "ta" for Tamil, "hi" for Hindi, etc.).
- If language is NOT "en", accurately translate title to English in "titleEn" and description to English in "descriptionEn".
- If language IS "en", set "titleEn" and "descriptionEn" to empty string or null.

Return JSON matching the schema.`;

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

    let detectedLang = parsed.language ? String(parsed.language).trim().toLowerCase().slice(0, 2) : '';
    if (!detectedLang) {
      detectedLang = detectTextLanguage(complaintTitle + ' ' + complaintDescription, hintLang);
    }

    const isNonEnglish = detectedLang !== 'en';
    const titleEn = isNonEnglish && parsed.titleEn && String(parsed.titleEn).trim()
      ? String(parsed.titleEn).trim()
      : null;
    const descriptionEn = isNonEnglish && parsed.descriptionEn && String(parsed.descriptionEn).trim()
      ? String(parsed.descriptionEn).trim()
      : null;

    return {
      category: selectedCategory,
      priority: selectedPriority,
      reasoning: parsed.reasoning || 'AI triage classification complete.',
      language: detectedLang,
      titleEn,
      descriptionEn,
      fallbackTriggered: false,
    };
  } catch (error: any) {
    const currentModel = getGeminiModel();
    const { status, message } = sanitizeAiErrorMessage(error);
    console.error('[Gemini AI] ROUTING_CLASSIFICATION_FAILED', {
      type: 'GEMINI_CLASSIFICATION_FAILED',
      model: currentModel,
      status,
      errorMessage: message,
      timestamp: new Date().toISOString(),
    });
    return {
      ...fallback,
      reasoning: `[Fallback Heuristic Used — Gemini Error: ${message}] ${fallback.reasoning}`,
      fallbackTriggered: true,
    };
  }
}

export interface AiHealthResult {
  ok: boolean;
  model: string;
  status: number;
  latencyMs: number;
  error?: string;
}

/**
 * Diagnostic health check performing a lightweight real call against Gemini.
 * Never throws and scrubs any API key from error output.
 */
export async function checkAiHealth(): Promise<AiHealthResult> {
  const model = getGeminiModel();
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey || apiKey === 'your_gemini_api_key_here' || apiKey.trim() === '') {
    return {
      ok: false,
      model,
      status: 400,
      latencyMs: 0,
      error: 'GEMINI_API_KEY is not configured or using placeholder value.',
    };
  }

  const start = Date.now();
  try {
    const genAI = getGeminiClient();
    if (!genAI) {
      return {
        ok: false,
        model,
        status: 400,
        latencyMs: 0,
        error: 'Failed to initialize Gemini client.',
      };
    }

    const generativeModel = genAI.getGenerativeModel({ model });
    const apiCall = generativeModel.generateContent('ping');
    await withTimeout(apiCall, 8000, 'AI health check timed out after 8s');
    const latencyMs = Date.now() - start;

    return {
      ok: true,
      model,
      status: 200,
      latencyMs,
    };
  } catch (err: any) {
    const latencyMs = Date.now() - start;
    const { status, message } = sanitizeAiErrorMessage(err);
    console.error(`[Gemini AI] GENERATE_CONTENT_FAILED: Status ${status} - ${message}`);

    return {
      ok: false,
      model,
      status,
      latencyMs,
      error: message,
    };
  }
}

export interface VoiceParseResult {
  title: string;
  description: string;
  category?: string;
}

/**
 * Parses raw voice transcript into structured title and description in the spoken language.
 */
export async function parseVoiceComplaint(
  transcript: string,
  language = 'en-IN',
): Promise<VoiceParseResult> {
  const genAI = getGeminiClient();
  if (!genAI) {
    throw new Error('Gemini AI is unconfigured or unavailable.');
  }

  const model = genAI.getGenerativeModel({
    model: getGeminiModel(),
    generationConfig: {
      responseMimeType: 'application/json',
      responseSchema: {
        type: SchemaType.OBJECT,
        properties: {
          title: {
            type: SchemaType.STRING,
            description: 'Concise civic issue title of at most 80 characters in the same language as the transcript.',
          },
          description: {
            type: SchemaType.STRING,
            description: 'Full detailed description in the same language as the transcript.',
          },
          category: {
            type: SchemaType.STRING,
            description: 'Optional category ID.',
          },
        },
        required: ['title', 'description'],
      },
    },
  });

  const prompt = `You are an AI Civic Complaint Voice Parser for a Smart City Platform.
The citizen dictated their complaint via voice in the language: "${language}".
Citizen's raw transcript: "${transcript}"

Instructions:
1. Extract a concise, meaningful title of MAXIMUM 80 characters.
2. Formulate a clean description retaining all details mentioned by the citizen.
3. Suggest the most likely category ID if applicable.
CRITICAL REQUIREMENT: Keep the title and description in the EXACT SAME language as the citizen's transcript. DO NOT translate into English if spoken in Hindi, Tamil, Telugu, Malayalam, Kannada, etc.

Return strictly JSON matching:
{
  "title": "<title <= 80 chars in spoken language>",
  "description": "<detailed description in spoken language>",
  "category": "<optional category id>"
}`;

  try {
    const apiCall = model.generateContent(prompt);
    const response = await withTimeout(apiCall, 10000, 'Voice parsing timed out after 10s');
    const parsed = JSON.parse(response.response.text());

    let parsedTitle = String(parsed.title || '').trim();
    if (parsedTitle.length > 80) {
      parsedTitle = parsedTitle.slice(0, 80);
      const lastSpace = parsedTitle.lastIndexOf(' ');
      if (lastSpace > 20) {
        parsedTitle = parsedTitle.slice(0, lastSpace).trim();
      }
    }

    return {
      title: parsedTitle || transcript.slice(0, 80).trim(),
      description: String(parsed.description || transcript).trim(),
      category: parsed.category || undefined,
    };
  } catch (error: any) {
    const { status, message } = sanitizeAiErrorMessage(error);
    console.error(`[Gemini AI] GENERATE_CONTENT_FAILED: Status ${status} - ${message}`);
    throw error;
  }
}


