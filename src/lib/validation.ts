/**
 * Validation schema helpers for Citizen Portal API routes
 */

export interface ValidationResult<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export const FEEDBACK_COMMENT_MAX_LENGTH = 500;
export const REOPEN_REASON_MIN_LENGTH = 10;
export const REOPEN_REASON_MAX_LENGTH = 500;

export function validateComplaintIdParam(id: unknown): ValidationResult<string> {
  if (typeof id !== 'string') {
    return { success: false, error: 'Invalid complaint ID.' };
  }
  const trimmed = id.trim();
  if (!trimmed || trimmed.length > 128 || /\s/.test(trimmed)) {
    return { success: false, error: 'Invalid complaint ID format.' };
  }
  return { success: true, data: trimmed };
}

export function validateReopenInput(body: any): ValidationResult<{ reason: string }> {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { success: false, error: 'Request body must be a valid JSON object.' };
  }

  const { reason } = body;
  if (typeof reason !== 'string') {
    return { success: false, error: 'Reopen reason must be a string.' };
  }

  const trimmed = reason.trim();
  if (trimmed.length < REOPEN_REASON_MIN_LENGTH) {
    return {
      success: false,
      error: `Reopen reason must be at least ${REOPEN_REASON_MIN_LENGTH} characters long.`,
    };
  }

  if (trimmed.length > REOPEN_REASON_MAX_LENGTH) {
    return {
      success: false,
      error: `Reopen reason must not exceed ${REOPEN_REASON_MAX_LENGTH} characters.`,
    };
  }

  return { success: true, data: { reason: trimmed } };
}

export function validateFeedbackInput(body: any): ValidationResult<{ rating: number; comment?: string }> {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { success: false, error: 'Request body must be a valid JSON object.' };
  }

  const { rating, comment, comments } = body;
  if (typeof rating !== 'number' || !Number.isInteger(rating) || rating < 1 || rating > 5) {
    return { success: false, error: 'Rating must be an integer between 1 and 5.' };
  }

  const rawComment = comment !== undefined ? comment : comments;
  if (rawComment !== undefined && rawComment !== null && typeof rawComment !== 'string') {
    return { success: false, error: 'Comment must be a string if provided.' };
  }

  const trimmedComment = typeof rawComment === 'string' ? rawComment.trim() : undefined;
  if (trimmedComment && trimmedComment.length > FEEDBACK_COMMENT_MAX_LENGTH) {
    return {
      success: false,
      error: `Comment must not exceed ${FEEDBACK_COMMENT_MAX_LENGTH} characters.`,
    };
  }

  return {
    success: true,
    data: {
      rating,
      comment: trimmedComment || undefined,
    },
  };
}

export function validateDuplicateCheckInput(body: any): ValidationResult<{
  title: string;
  description: string;
  latitude?: number;
  longitude?: number;
}> {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { success: false, error: 'Request body must be a valid JSON object.' };
  }

  const { title, description, latitude, longitude } = body;

  if (!title || typeof title !== 'string' || title.trim().length < 3) {
    return { success: false, error: 'Title is required (min 3 chars).' };
  }

  if (!description || typeof description !== 'string' || description.trim().length < 10) {
    return { success: false, error: 'Description is required (min 10 chars).' };
  }

  return {
    success: true,
    data: {
      title: title.trim(),
      description: description.trim(),
      latitude: latitude !== undefined && latitude !== null ? Number(latitude) : undefined,
      longitude: longitude !== undefined && longitude !== null ? Number(longitude) : undefined,
    },
  };
}
