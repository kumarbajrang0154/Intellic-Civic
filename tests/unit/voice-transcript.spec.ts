import { test, expect } from '@playwright/test';
import {
  appendTranscript,
  routeVoiceTranscript,
  SpeechRecognitionEventLike,
} from '@/lib/voice-transcript';

test.describe('Task 4c — Unit tests for appendTranscript', () => {
  test('1. interim-only update adds nothing to permanent text', () => {
    const prevText = 'Existing complaint text';
    const interimEvent: SpeechRecognitionEventLike = {
      resultIndex: 0,
      results: [
        {
          isFinal: false,
          length: 1,
          0: { transcript: 'interim spoken phrase that is not finished' },
        },
      ],
    };

    const result = appendTranscript(prevText, interimEvent, -1);

    expect(result.text).toBe('Existing complaint text');
    expect(result.interimText).toBe('interim spoken phrase that is not finished');
    expect(result.lastProcessedIndex).toBe(-1);
  });

  test('2. final result appended once to permanent text', () => {
    const prevText = 'Broken road';
    const finalEvent: SpeechRecognitionEventLike = {
      resultIndex: 0,
      results: [
        {
          isFinal: true,
          length: 1,
          0: { transcript: 'near junction' },
        },
      ],
    };

    const result = appendTranscript(prevText, finalEvent, -1);

    expect(result.text).toBe('Broken road near junction');
    expect(result.lastProcessedIndex).toBe(0);
  });

  test('3. repeated event with the same resultIndex does not duplicate on mobile devices', () => {
    // Event 1: First final result arrives
    const event1: SpeechRecognitionEventLike = {
      resultIndex: 0,
      results: [
        {
          isFinal: true,
          length: 1,
          0: { transcript: 'water leakage' },
        },
      ],
    };

    const step1 = appendTranscript('', event1, -1);
    expect(step1.text).toBe('water leakage');
    expect(step1.lastProcessedIndex).toBe(0);

    // Event 2: Mobile Chrome re-sends resultIndex: 0 containing the old result (index 0) AND new result (index 1)
    const event2: SpeechRecognitionEventLike = {
      resultIndex: 0,
      results: [
        {
          isFinal: true,
          length: 1,
          0: { transcript: 'water leakage' },
        },
        {
          isFinal: true,
          length: 1,
          0: { transcript: 'in front of house' },
        },
      ],
    };

    // Passing step1.lastProcessedIndex (0) prevents index 0 from being re-appended
    const step2 = appendTranscript(step1.text, event2, step1.lastProcessedIndex);

    expect(step2.text).toBe('water leakage in front of house');
    expect(step2.text).not.toContain('water leakage water leakage');
    expect(step2.lastProcessedIndex).toBe(1);

    // Event 3: Exactly identical event fired again without new results
    const step3 = appendTranscript(step2.text, event2, step2.lastProcessedIndex);
    expect(step3.text).toBe('water leakage in front of house');
    expect(step3.lastProcessedIndex).toBe(1);
  });

  test('4. title and description targets stay separate (no cross-writes)', () => {
    const initialFields = {
      title: 'Initial Title',
      description: 'Initial Description that is detailed',
    };

    // Dictate into Title
    const titleEvent: SpeechRecognitionEventLike = {
      resultIndex: 0,
      results: [
        {
          isFinal: true,
          length: 1,
          0: { transcript: 'Pothole on Main Road' },
        },
      ],
    };

    const afterTitle = appendTranscript(initialFields, 'title', titleEvent, -1);

    expect(afterTitle.fields.title).toBe('Initial Title Pothole on Main Road');
    // Description must NOT be touched or appended
    expect(afterTitle.fields.description).toBe('Initial Description that is detailed');

    // Dictate into Description
    const descEvent: SpeechRecognitionEventLike = {
      resultIndex: 0,
      results: [
        {
          isFinal: true,
          length: 1,
          0: { transcript: 'Deep crater blocking vehicle traffic' },
        },
      ],
    };

    const afterDesc = appendTranscript(afterTitle.fields, 'description', descEvent, -1);

    // Title must stay exactly as before
    expect(afterDesc.fields.title).toBe('Initial Title Pothole on Main Road');
    // Description receives the description dictation
    expect(afterDesc.fields.description).toBe(
      'Initial Description that is detailed Deep crater blocking vehicle traffic',
    );
  });
});
