/**
 * Validation schema helpers for Citizen Portal API routes
 */

export interface ValidationResult<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export function validateReopenInput(body: any): ValidationResult<{ reason: string }> {
  if (!body || typeof body !== 'object') {
    return { success: false, error: 'Request body must be a valid JSON object.' };
  }

  const { reason } = body;
  if (!reason || typeof reason !== 'string' || reason.trim().length < 10) {
    return { success: false, error: 'Reopen reason must be at least 10 characters long.' };
  }

  return { success: true, data: { reason: reason.trim() } };
}

export function validateFeedbackInput(body: any): ValidationResult<{ rating: number; comment?: string }> {
  if (!body || typeof body !== 'object') {
    return { success: false, error: 'Request body must be a valid JSON object.' };
  }

  const { rating, comment } = body;
  const numRating = Number(rating);

  if (isNaN(numRating) || !Number.isInteger(numRating) || numRating < 1 || numRating > 5) {
    return { success: false, error: 'Rating must be an integer between 1 and 5.' };
  }

  if (comment !== undefined && typeof comment !== 'string') {
    return { success: false, error: 'Comment must be a string if provided.' };
  }

  return {
    success: true,
    data: {
      rating: numRating,
      comment: comment ? comment.trim() : undefined,
    },
  };
}

export function validateDuplicateCheckInput(body: any): ValidationResult<{
  title: string;
  description: string;
  latitude?: number;
  longitude?: number;
}> {
  if (!body || typeof body !== 'object') {
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
