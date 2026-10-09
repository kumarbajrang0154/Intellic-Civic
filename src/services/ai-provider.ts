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
  language?: string | null;
  titleEn?: string | null;
  descriptionEn?: string | null;
  fallbackTriggered?: boolean;
  provider?: 'gemini' | 'groq' | 'fallback';
}

export interface CategoryInfo {
  id: string;
  name: string;
  description?: string;
}

export interface VoiceParseResult {
  title: string;
  description: string;
  category?: string;
}

export interface AiHealthResult {
  ok: boolean;
  provider: 'gemini' | 'groq';
  model: string;
  status: number;
  latencyMs: number;
  error?: string;
  failoverActive?: boolean;
  failoverReason?: string;
}

export const DEFAULT_CATEGORIES: CategoryInfo[] = [
  { id: 'cat-sanitation', name: 'Sanitation & Solid Waste', description: 'Garbage collection, street cleaning, dumpsters, waste disposal' },
  { id: 'cat-roads', name: 'Roads & Infrastructure', description: 'Potholes, broken footpaths, damaged bridges, manhole covers' },
  { id: 'cat-water', name: 'Water Supply & Sanitation', description: 'Pipeline leaks, contaminated water supply, low pressure, drainage blockage' },
  { id: 'cat-electricity', name: 'Electricity & Streetlights', description: 'Non-functional streetlights, dangerous loose wiring, transformer spark' },
];

export const DEFAULT_GEMINI_MODEL = 'gemini-3.8-flash';
export const DEFAULT_GROQ_MODEL = 'qwen/qwen3.8-27b';

export function getGeminiModel(): string {
  return process.env.GEMINI_MODEL?.trim() || DEFAULT_GEMINI_MODEL;
}

export function getGroqModel(): string {
  return process.env.GROQ_MODEL?.trim() || DEFAULT_GROQ_MODEL;
}

export function getActiveAiProvider(): 'gemini' | 'groq' {
  const provider = (process.env.AI_PROVIDER || 'gemini').trim().toLowerCase();
  return provider === 'groq' ? 'groq' : 'gemini';
}

/**
 * Heuristic script/language detector for complaints.
 */
export function detectTextLanguage(text: string, defaultLang?: string): string {
  if (defaultLang && defaultLang.toLowerCase().trim() && defaultLang.toLowerCase().trim() !== 'en') {
    return defaultLang.toLowerCase().trim().slice(0, 2);
  }
  if (/[\u0B80-\u0BFF]/.test(text)) return 'ta'; // Tamil
  if (/[\u0900-\u097F]/.test(text)) return 'hi'; // Hindi
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
    provider: 'fallback',
  };
}

/**
 * Sanitizes error messages by scrubbing any potential API keys and extracts HTTP status.
 */
export function sanitizeAiErrorMessage(error: any): { status: number; message: string } {
  let status = error?.status || error?.statusCode;
  let message = error?.message || String(error || 'Unknown AI error');

  const geminiKey = process.env.GEMINI_API_KEY;
  if (geminiKey && geminiKey.length > 5) {
    message = message.split(geminiKey).join('[REDACTED_API_KEY]');
  }
  const groqKey = process.env.GROQ_API_KEY;
  if (groqKey && groqKey.length > 5) {
    message = message.split(groqKey).join('[REDACTED_API_KEY]');
  }

  message = message.replace(/https?:\/\/[^\s"'<>]*(?:key=[a-zA-Z0-9_\-]+)[^\s"'<>]*/g, (url: string) => {
    return url.replace(/key=[a-zA-Z0-9_\-]+/g, 'key=[REDACTED_API_KEY]');
  });
  message = message.replace(/key=[a-zA-Z0-9_\-]+/g, 'key=[REDACTED_API_KEY]');
  message = message.replace(/Bearer\s+[a-zA-Z0-9_\-]+/gi, 'Bearer [REDACTED_API_KEY]');

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

function withTimeout<T>(promise: Promise<T>, timeoutMs = 10000, errorMessage = 'AI API call timed out'): Promise<T> {
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

// ---------------------------------------------------------------------------
// 1. GEMINI PROVIDER IMPLEMENTATION
// ---------------------------------------------------------------------------

function getGeminiClient(): GoogleGenerativeAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'your_gemini_api_key_here' || apiKey.trim() === '') {
    return null;
  }
  return new GoogleGenerativeAI(apiKey);
}

async function prepareGeminiImagePart(imageUrlOrBase64: string): Promise<{ inlineData: { data: string; mimeType: string } }> {
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
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko)',
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

  return {
    inlineData: {
      mimeType: 'image/jpeg',
      data: imageUrlOrBase64,
    },
  };
}

async function verifyComplaintPhotoGemini(
  imageUrlOrBase64: string,
  complaintDescription: string,
  category: string,
): Promise<PhotoVerificationResult> {
  const genAI = getGeminiClient();
  if (!genAI) {
    throw new Error('GEMINI_API_KEY is missing or unconfigured (Status 400).');
  }

  const imagePart = await prepareGeminiImagePart(imageUrlOrBase64);
  const currentModel = getGeminiModel();

  const model = genAI.getGenerativeModel({
    model: currentModel,
    generationConfig: {
      responseMimeType: 'application/json',
      responseSchema: {
        type: SchemaType.OBJECT,
        properties: {
          verified: { type: SchemaType.BOOLEAN },
          confidence: { type: SchemaType.NUMBER },
          reasoning: { type: SchemaType.STRING },
        },
        required: ['verified', 'confidence', 'reasoning'],
      },
    },
  });

  const prompt = `You are an expert AI urban infrastructure inspector for a Smart City Platform.
Analyze the provided evidence photo submitted for a civic complaint.
Category: ${category}
Description: ${complaintDescription}
Evaluate whether the photo plausibly shows the described civic issue or matches the category. Return JSON with verified (bool), confidence (0-1), reasoning (str).`;

  const apiCall = model.generateContent([prompt, imagePart]);
  const response = await withTimeout(apiCall, 10000, 'Gemini photo verification timed out after 10s');
  const parsed = JSON.parse(response.response.text());

  return {
    verified: Boolean(parsed.verified),
    confidence: typeof parsed.confidence === 'number' ? Math.min(Math.max(parsed.confidence, 0), 1) : 0.5,
    reasoning: parsed.reasoning || 'Photo verification completed via Gemini.',
  };
}

async function classifyComplaintRoutingGemini(
  complaintDescription: string,
  complaintTitle: string,
  availableCategories: CategoryInfo[],
  hintLang?: string,
): Promise<ComplaintRoutingResult> {
  const genAI = getGeminiClient();
  if (!genAI) {
    throw new Error('GEMINI_API_KEY is missing or unconfigured (Status 400).');
  }

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
          category: { type: SchemaType.STRING },
          priority: { type: SchemaType.STRING },
          reasoning: { type: SchemaType.STRING },
          language: { type: SchemaType.STRING },
          titleEn: { type: SchemaType.STRING },
          descriptionEn: { type: SchemaType.STRING },
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

Allowed Priority Levels: LOW, MEDIUM, HIGH, CRITICAL.

Language & Translation Requirements:
- "language": Detect 2-letter ISO code (e.g. "en", "ta", "hi", etc.).
- If language is NOT "en", accurately translate title to English in "titleEn" and description to English in "descriptionEn".
- If language IS "en", set "titleEn" and "descriptionEn" to empty string or null.

Return JSON matching schema.`;

  const apiCall = model.generateContent(prompt);
  const response = await withTimeout(apiCall, 10000, 'Gemini complaint routing classification timed out after 10s');
  const parsed = JSON.parse(response.response.text());

  const validCategoryIds = new Set(availableCategories.map((c) => c.id));
  let selectedCategory = String(parsed.category || '').trim();
  if (!validCategoryIds.has(selectedCategory)) {
    const matchedByName = availableCategories.find(
      (c) => c.name.toLowerCase() === selectedCategory.toLowerCase(),
    );
    selectedCategory = matchedByName ? matchedByName.id : availableCategories[0].id;
  }

  let selectedPriority = String(parsed.priority || '').toUpperCase() as 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  if (!['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].includes(selectedPriority)) {
    selectedPriority = 'MEDIUM';
  }

  let detectedLang = parsed.language ? String(parsed.language).trim().toLowerCase().slice(0, 2) : '';
  if (!detectedLang) {
    detectedLang = detectTextLanguage(complaintTitle + ' ' + complaintDescription, hintLang);
  }

  const isNonEnglish = detectedLang !== 'en';
  const titleEn = isNonEnglish && parsed.titleEn && String(parsed.titleEn).trim() ? String(parsed.titleEn).trim() : null;
  const descriptionEn = isNonEnglish && parsed.descriptionEn && String(parsed.descriptionEn).trim() ? String(parsed.descriptionEn).trim() : null;

  return {
    category: selectedCategory,
    priority: selectedPriority,
    reasoning: parsed.reasoning || 'AI triage classification complete via Gemini.',
    language: detectedLang,
    titleEn,
    descriptionEn,
    fallbackTriggered: false,
    provider: 'gemini',
  };
}

async function parseVoiceComplaintGemini(
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
          title: { type: SchemaType.STRING },
          description: { type: SchemaType.STRING },
          category: { type: SchemaType.STRING },
        },
        required: ['title', 'description'],
      },
    },
  });

  const prompt = `You are an AI Civic Complaint Voice Parser for a Smart City Platform.
Language: "${language}".
Transcript: "${transcript}".
Extract concise title (max 80 chars) and detailed description in same language. Suggest category if applicable. Return JSON.`;

  const apiCall = model.generateContent(prompt);
  const response = await withTimeout(apiCall, 10000, 'Voice parsing timed out after 10s');
  const parsed = JSON.parse(response.response.text());

  let parsedTitle = String(parsed.title || '').trim();
  if (parsedTitle.length > 80) {
    parsedTitle = parsedTitle.slice(0, 80);
    const lastSpace = parsedTitle.lastIndexOf(' ');
    if (lastSpace > 20) parsedTitle = parsedTitle.slice(0, lastSpace).trim();
  }

  return {
    title: parsedTitle || transcript.slice(0, 80).trim(),
    description: String(parsed.description || transcript).trim(),
    category: parsed.category || undefined,
  };
}

async function checkGeminiHealthDirect(): Promise<AiHealthResult> {
  const model = getGeminiModel();
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey || apiKey === 'your_gemini_api_key_here' || apiKey.trim() === '') {
    return {
      ok: false,
      provider: 'gemini',
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
        provider: 'gemini',
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
      provider: 'gemini',
      model,
      status: 200,
      latencyMs,
    };
  } catch (err: any) {
    const latencyMs = Date.now() - start;
    const { status, message } = sanitizeAiErrorMessage(err);
    console.error(`[Gemini AI] Health check failed: Status ${status} - ${message}`);

    return {
      ok: false,
      provider: 'gemini',
      model,
      status,
      latencyMs,
      error: message,
    };
  }
}

// ---------------------------------------------------------------------------
// 2. GROQ PROVIDER IMPLEMENTATION (Official OpenAI-Compatible Vision & Chat API)
// ---------------------------------------------------------------------------

function getGroqApiKey(): string | null {
  const key = process.env.GROQ_API_KEY?.trim();
  if (!key || key === 'your_groq_api_key_here' || key === '') {
    return null;
  }
  return key;
}

async function callGroqChatCompletions(payload: any, timeoutMs = 10000): Promise<any> {
  const apiKey = getGroqApiKey();
  if (!apiKey) {
    throw new Error('GROQ_API_KEY is not configured or using placeholder value (Status 400).');
  }

  const res = await withTimeout(
    fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    }),
    timeoutMs,
    `Groq API call timed out after ${timeoutMs / 1000}s`,
  );

  if (!res.ok) {
    const errorBody = await res.text().catch(() => '');
    let parsedMsg = `HTTP ${res.status} ${res.statusText}`;
    try {
      const errJson = JSON.parse(errorBody);
      parsedMsg = errJson?.error?.message || parsedMsg;
    } catch {
      if (errorBody) parsedMsg = `${parsedMsg}: ${errorBody.slice(0, 200)}`;
    }
    const err: any = new Error(`Groq API error: ${parsedMsg}`);
    err.status = res.status;
    throw err;
  }

  return res.json();
}

async function verifyComplaintPhotoGroq(
  imageUrlOrBase64: string,
  complaintDescription: string,
  category: string,
): Promise<PhotoVerificationResult> {
  const model = getGroqModel();
  const formattedUrl = imageUrlOrBase64.startsWith('http') || imageUrlOrBase64.startsWith('data:')
    ? imageUrlOrBase64
    : `data:image/jpeg;base64,${imageUrlOrBase64}`;

  const prompt = `You are an expert AI urban infrastructure inspector for a Smart City Platform.
Analyze the provided evidence photo submitted for a civic complaint.
Complaint Category: ${category}
Citizen Description: ${complaintDescription}

Evaluate whether the photo plausibly depicts the described civic issue.
Return strictly a JSON object with:
{
  "verified": true or false,
  "confidence": number between 0.0 and 1.0,
  "reasoning": "1-2 sentence explanation"
}`;

  const payload = {
    model,
    messages: [
      {
        role: 'user',
        content: [
          { type: 'text', text: prompt },
          { type: 'image_url', image_url: { url: formattedUrl } },
        ],
      },
    ],
    response_format: { type: 'json_object' },
  };

  const json = await callGroqChatCompletions(payload, 10000);
  const content = json?.choices?.[0]?.message?.content || '{}';
  const parsed = JSON.parse(content);

  return {
    verified: Boolean(parsed.verified),
    confidence: typeof parsed.confidence === 'number' ? Math.min(Math.max(parsed.confidence, 0), 1) : 0.5,
    reasoning: parsed.reasoning || 'Photo verification completed via Groq.',
  };
}

async function classifyComplaintRoutingGroq(
  complaintDescription: string,
  complaintTitle: string,
  availableCategories: CategoryInfo[],
  hintLang?: string,
): Promise<ComplaintRoutingResult> {
  const model = getGroqModel();
  const categoryOptionsStr = availableCategories
    .map((c) => `- ID: "${c.id}", Name: "${c.name}" (${c.description || ''})`)
    .join('\n');

  const prompt = `You are an AI Civic Complaint Triage and Translation Engine for a Smart City Platform.
Analyze the complaint title and description, detect its language, classify category and priority, and translate to English if not English.

Complaint Title: ${complaintTitle}
Complaint Description: ${complaintDescription}

Available Categories:
${categoryOptionsStr}

Allowed Priority Levels: LOW, MEDIUM, HIGH, CRITICAL.

Return strictly a JSON object with:
{
  "category": "<Must be one of the Available Category IDs above>",
  "priority": "<LOW | MEDIUM | HIGH | CRITICAL>",
  "reasoning": "<1-2 sentence explanation>",
  "language": "<2-letter ISO code e.g. en, ta, hi>",
  "titleEn": "<English title translation if not en, else null>",
  "descriptionEn": "<English description translation if not en, else null>"
}`;

  const payload = {
    model,
    messages: [
      {
        role: 'system',
        content: 'You are an AI Civic Complaint Triage Engine. You must return valid JSON only.',
      },
      {
        role: 'user',
        content: prompt,
      },
    ],
    response_format: { type: 'json_object' },
  };

  const json = await callGroqChatCompletions(payload, 10000);
  const content = json?.choices?.[0]?.message?.content || '{}';
  const parsed = JSON.parse(content);

  const validCategoryIds = new Set(availableCategories.map((c) => c.id));
  let selectedCategory = String(parsed.category || '').trim();
  if (!validCategoryIds.has(selectedCategory)) {
    const matchedByName = availableCategories.find(
      (c) => c.name.toLowerCase() === selectedCategory.toLowerCase(),
    );
    selectedCategory = matchedByName ? matchedByName.id : availableCategories[0].id;
  }

  let selectedPriority = String(parsed.priority || '').toUpperCase() as 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  if (!['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].includes(selectedPriority)) {
    selectedPriority = 'MEDIUM';
  }

  let detectedLang = parsed.language ? String(parsed.language).trim().toLowerCase().slice(0, 2) : '';
  if (!detectedLang) {
    detectedLang = detectTextLanguage(complaintTitle + ' ' + complaintDescription, hintLang);
  }

  const isNonEnglish = detectedLang !== 'en';
  const titleEn = isNonEnglish && parsed.titleEn && String(parsed.titleEn).trim() ? String(parsed.titleEn).trim() : null;
  const descriptionEn = isNonEnglish && parsed.descriptionEn && String(parsed.descriptionEn).trim() ? String(parsed.descriptionEn).trim() : null;

  return {
    category: selectedCategory,
    priority: selectedPriority,
    reasoning: parsed.reasoning || 'AI triage classification complete via Groq.',
    language: detectedLang,
    titleEn,
    descriptionEn,
    fallbackTriggered: false,
    provider: 'groq',
  };
}

async function parseVoiceComplaintGroq(
  transcript: string,
  language = 'en-IN',
): Promise<VoiceParseResult> {
  const model = getGroqModel();
  const prompt = `You are an AI Civic Complaint Voice Parser for a Smart City Platform.
Language: "${language}".
Transcript: "${transcript}".

Extract concise title (maximum 80 characters in the spoken language) and detailed description in the spoken language.
Return strictly JSON:
{
  "title": "<title in spoken language <= 80 chars>",
  "description": "<detailed description in spoken language>",
  "category": "<optional category id>"
}`;

  const payload = {
    model,
    messages: [
      {
        role: 'system',
        content: 'You are an AI Voice Parser. You must return valid JSON only.',
      },
      {
        role: 'user',
        content: prompt,
      },
    ],
    response_format: { type: 'json_object' },
  };

  const json = await callGroqChatCompletions(payload, 10000);
  const content = json?.choices?.[0]?.message?.content || '{}';
  const parsed = JSON.parse(content);

  let parsedTitle = String(parsed.title || '').trim();
  if (parsedTitle.length > 80) {
    parsedTitle = parsedTitle.slice(0, 80);
    const lastSpace = parsedTitle.lastIndexOf(' ');
    if (lastSpace > 20) parsedTitle = parsedTitle.slice(0, lastSpace).trim();
  }

  return {
    title: parsedTitle || transcript.slice(0, 80).trim(),
    description: String(parsed.description || transcript).trim(),
    category: parsed.category || undefined,
  };
}

async function checkGroqHealthDirect(): Promise<AiHealthResult> {
  const model = getGroqModel();
  const apiKey = getGroqApiKey();

  if (!apiKey) {
    return {
      ok: false,
      provider: 'groq',
      model,
      status: 400,
      latencyMs: 0,
      error: 'GROQ_API_KEY is not configured or using placeholder value.',
    };
  }

  const start = Date.now();
  try {
    const payload = {
      model,
      messages: [{ role: 'user', content: 'ping' }],
      max_tokens: 5,
    };
    await callGroqChatCompletions(payload, 8000);
    const latencyMs = Date.now() - start;

    return {
      ok: true,
      provider: 'groq',
      model,
      status: 200,
      latencyMs,
    };
  } catch (err: any) {
    const latencyMs = Date.now() - start;
    const { status, message } = sanitizeAiErrorMessage(err);
    console.error(`[Groq AI] Health check failed: Status ${status} - ${message}`);

    return {
      ok: false,
      provider: 'groq',
      model,
      status,
      latencyMs,
      error: message,
    };
  }
}

// ---------------------------------------------------------------------------
// 3. AUTO-FAILOVER & UNIFIED PUBLIC API
// ---------------------------------------------------------------------------

function shouldFailover(status: number): boolean {
  return [400, 403, 404, 429].includes(status);
}

/**
 * Verifies if an uploaded photo plausibly matches the described civic complaint.
 * Auto-failover: Gemini -> Groq -> Heuristic unverified fallback.
 */
export async function verifyComplaintPhoto(
  imageUrlOrBase64: string,
  complaintDescription: string,
  category: string,
): Promise<PhotoVerificationResult> {
  const primaryProvider = getActiveAiProvider();

  if (primaryProvider === 'groq') {
    try {
      return await verifyComplaintPhotoGroq(imageUrlOrBase64, complaintDescription, category);
    } catch (err: any) {
      const { status, message } = sanitizeAiErrorMessage(err);
      console.error(`[AI Provider: Groq] Photo verification failed: Status ${status} - ${message}`);
      return {
        verified: false,
        confidence: 0.0,
        reasoning: 'unverified — AI unavailable — fallback used',
      };
    }
  }

  // Primary: Gemini
  try {
    return await verifyComplaintPhotoGemini(imageUrlOrBase64, complaintDescription, category);
  } catch (errGemini: any) {
    const { status: geminiStatus, message: geminiMsg } = sanitizeAiErrorMessage(errGemini);
    console.warn(`[Gemini AI] Photo verification failed (HTTP ${geminiStatus}): ${geminiMsg}. Attempting failover to Groq...`);

    if (shouldFailover(geminiStatus) && getGroqApiKey()) {
      try {
        return await verifyComplaintPhotoGroq(imageUrlOrBase64, complaintDescription, category);
      } catch (errGroq: any) {
        const { status: groqStatus, message: groqMsg } = sanitizeAiErrorMessage(errGroq);
        console.error(`[Groq AI Failover] Photo verification also failed: Status ${groqStatus} - ${groqMsg}`);
      }
    }

    return {
      verified: false,
      confidence: 0.0,
      reasoning: 'unverified — AI unavailable — fallback used',
    };
  }
}

/**
 * Classifies complaint category and priority, with language detection and translation.
 * Auto-failover: Gemini -> Groq -> Heuristic keyword fallback ("AI unavailable — fallback used").
 */
export async function classifyComplaintRouting(
  complaintDescription: string,
  complaintTitle = '',
  availableCategories: CategoryInfo[] = DEFAULT_CATEGORIES,
  hintLang?: string,
): Promise<ComplaintRoutingResult> {
  const fallback = fallbackKeywordRouting(complaintTitle, complaintDescription, hintLang);
  const primaryProvider = getActiveAiProvider();

  if (primaryProvider === 'groq') {
    try {
      return await classifyComplaintRoutingGroq(complaintDescription, complaintTitle, availableCategories, hintLang);
    } catch (err: any) {
      const { status, message } = sanitizeAiErrorMessage(err);
      console.error(`[AI Provider: Groq] Classification failed: Status ${status} - ${message}`);
      return {
        ...fallback,
        reasoning: `AI unavailable — fallback used (Groq error: ${message})`,
        fallbackTriggered: true,
      };
    }
  }

  // Primary: Gemini
  try {
    return await classifyComplaintRoutingGemini(complaintDescription, complaintTitle, availableCategories, hintLang);
  } catch (errGemini: any) {
    const { status: geminiStatus, message: geminiMsg } = sanitizeAiErrorMessage(errGemini);
    console.warn(`[Gemini AI] Classification failed (HTTP ${geminiStatus}): ${geminiMsg}. Attempting failover to Groq...`);

    if (shouldFailover(geminiStatus) && getGroqApiKey()) {
      try {
        return await classifyComplaintRoutingGroq(complaintDescription, complaintTitle, availableCategories, hintLang);
      } catch (errGroq: any) {
        const { status: groqStatus, message: groqMsg } = sanitizeAiErrorMessage(errGroq);
        console.error(`[Groq AI Failover] Classification also failed: Status ${groqStatus} - ${groqMsg}`);
        return {
          ...fallback,
          reasoning: `AI unavailable — fallback used (Gemini HTTP ${geminiStatus}, Groq HTTP ${groqStatus})`,
          fallbackTriggered: true,
        };
      }
    }

    return {
      ...fallback,
      reasoning: `AI unavailable — fallback used (Gemini error: ${geminiMsg})`,
      fallbackTriggered: true,
    };
  }
}

/**
 * Parses raw voice transcript into structured title and description in the spoken language.
 * Auto-failover: Gemini -> Groq -> fallback title/desc.
 */
export async function parseVoiceComplaint(
  transcript: string,
  language = 'en-IN',
): Promise<VoiceParseResult> {
  const primaryProvider = getActiveAiProvider();

  if (primaryProvider === 'groq') {
    return await parseVoiceComplaintGroq(transcript, language);
  }

  try {
    return await parseVoiceComplaintGemini(transcript, language);
  } catch (errGemini: any) {
    const { status: geminiStatus, message: geminiMsg } = sanitizeAiErrorMessage(errGemini);
    console.warn(`[Gemini AI] Voice parsing failed (HTTP ${geminiStatus}): ${geminiMsg}. Attempting failover to Groq...`);

    if (shouldFailover(geminiStatus) && getGroqApiKey()) {
      try {
        return await parseVoiceComplaintGroq(transcript, language);
      } catch (errGroq: any) {
        const { status: groqStatus, message: groqMsg } = sanitizeAiErrorMessage(errGroq);
        console.error(`[Groq AI Failover] Voice parsing also failed: Status ${groqStatus} - ${groqMsg}`);
      }
    }

    throw errGemini;
  }
}

/**
 * Diagnostic health check across primary and failover providers.
 * Shows which provider is active, model name, and failure reason if any.
 */
export async function checkAiHealth(): Promise<AiHealthResult> {
  const primary = getActiveAiProvider();

  if (primary === 'groq') {
    return await checkGroqHealthDirect();
  }

  // Primary: Gemini
  const geminiHealth = await checkGeminiHealthDirect();
  if (geminiHealth.ok) {
    return geminiHealth;
  }

  // Gemini failed (e.g. 403, 404, 429, 400). Check if Groq can take over.
  if (shouldFailover(geminiHealth.status) && getGroqApiKey()) {
    const groqHealth = await checkGroqHealthDirect();
    if (groqHealth.ok) {
      return {
        ...groqHealth,
        failoverActive: true,
        failoverReason: `Gemini failed (HTTP ${geminiHealth.status}): ${geminiHealth.error || 'Access denied'}`,
      };
    }

    // Both failed
    return {
      ok: false,
      provider: 'gemini',
      model: `${getGeminiModel()} / ${getGroqModel()}`,
      status: geminiHealth.status,
      latencyMs: geminiHealth.latencyMs + groqHealth.latencyMs,
      error: `AI unavailable — fallback used (Gemini HTTP ${geminiHealth.status}, Groq HTTP ${groqHealth.status})`,
      failoverActive: true,
      failoverReason: `Both Gemini (${geminiHealth.status}) and Groq (${groqHealth.status}) failed.`,
    };
  }

  return geminiHealth;
}
