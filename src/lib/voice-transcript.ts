/**
 * Pure functions for Web Speech API transcript processing and field routing.
 *
 * Solves:
 * 1. Mobile browser word repetition (Android Chrome sending duplicate resultIndex).
 * 2. Interim preview leakage into final submitted text.
 * 3. Cross-field dictation leakage (title dictation writing into description).
 */

export interface SpeechRecognitionAlternativeLike {
  transcript: string;
  confidence?: number;
}

export interface SpeechRecognitionResultLike {
  isFinal: boolean;
  length: number;
  [index: number]: SpeechRecognitionAlternativeLike;
}

export interface SpeechRecognitionResultListLike {
  length: number;
  [index: number]: SpeechRecognitionResultLike;
}

export interface SpeechRecognitionEventLike {
  resultIndex: number;
  results: SpeechRecognitionResultListLike;
}

export type VoiceTargetField = 'title' | 'description' | 'address';

export interface FormFields {
  title: string;
  description: string;
  address?: string;
}

export interface AppendTranscriptResult {
  text: string;
  interimText: string;
  lastProcessedIndex: number;
}

export interface RouteVoiceResult {
  fields: FormFields;
  interimText: string;
  lastProcessedIndex: number;
}

/**
 * Pure function to extract and append final speech recognition results without duplication.
 *
 * Rules:
 * 1. Only final results (isFinal === true) are appended to the permanent text.
 * 2. Only processes results starting from Math.max(event.resultIndex, lastProcessedIndex + 1)
 *    to prevent duplicate appending on mobile browsers (Android Chrome) that resend
 *    earlier final results with the same resultIndex.
 * 3. Interim results are captured separately for live preview and never appended to permanent text.
 * 4. Whitespace is cleanly normalized so text is not concatenated without spaces.
 */
export function appendTranscript(
  prevText: string,
  event: SpeechRecognitionEventLike,
  lastProcessedIndex?: number,
): AppendTranscriptResult;
export function appendTranscript(
  fields: FormFields,
  target: VoiceTargetField,
  event: SpeechRecognitionEventLike,
  lastProcessedIndex?: number,
): RouteVoiceResult;
export function appendTranscript(
  first: string | FormFields,
  second: SpeechRecognitionEventLike | VoiceTargetField,
  third?: number | SpeechRecognitionEventLike,
  fourth?: number,
): any {
  if (typeof first === 'object' && first !== null) {
    const fields = first as FormFields;
    const target = second as VoiceTargetField;
    const event = third as SpeechRecognitionEventLike;
    const lastIndex = typeof fourth === 'number' ? fourth : -1;
    return routeVoiceTranscript(fields, target, event, lastIndex);
  }

  const prevText = (first as string) || '';
  const event = second as SpeechRecognitionEventLike;
  const lastIndex = typeof third === 'number' ? third : -1;

  let text = prevText;
  let interimText = '';
  let newLastIndex = lastIndex;

  if (!event || !event.results) {
    return { text, interimText, lastProcessedIndex: lastIndex };
  }

  const startIndex = Math.max(
    typeof event.resultIndex === 'number' ? event.resultIndex : 0,
    lastIndex + 1,
  );

  for (let i = startIndex; i < event.results.length; i++) {
    const resultItem = event.results[i];
    if (!resultItem) continue;

    const transcript = (resultItem[0]?.transcript || '').trim();

    if (resultItem.isFinal) {
      if (transcript) {
        text = text.trim() ? `${text.trim()} ${transcript}` : transcript;
      }
      newLastIndex = Math.max(newLastIndex, i);
    } else {
      interimText = resultItem[0]?.transcript || '';
    }
  }

  return {
    text,
    interimText,
    lastProcessedIndex: newLastIndex,
  };
}

/**
 * Routes speech dictation strictly to the targeted field (title or description).
 * Guarantees no cross-writes:
 * - If target is 'title', ONLY fields.title is updated. fields.description remains unchanged.
 * - If target is 'description', ONLY fields.description is updated. fields.title remains unchanged.
 */
export function routeVoiceTranscript(
  fields: FormFields,
  target: VoiceTargetField,
  event: SpeechRecognitionEventLike,
  lastProcessedIndex = -1,
): RouteVoiceResult {
  const currentVal = fields[target] || '';
  const result = appendTranscript(currentVal, event, lastProcessedIndex);

  const updatedFields: FormFields = {
    ...fields,
    [target]: result.text,
  };

  return {
    fields: updatedFields,
    interimText: result.interimText,
    lastProcessedIndex: result.lastProcessedIndex,
  };
}
