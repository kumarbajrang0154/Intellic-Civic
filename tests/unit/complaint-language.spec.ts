import { test, expect } from '@playwright/test';
import {
  getStaffComplaintText,
  normalizeStaffLanguage,
  STAFF_LANGUAGE_OPTIONS,
} from '@/lib/complaint-language';

test.describe('Staff Complaint Language Mapper (Auto-Translation)', () => {
  const sampleTamilComplaint = {
    title: 'தெருவிளக்கு எரியவில்லை',
    description: 'வார்டு 12 பிரதான சாலையில் மூன்று நாட்களாக விளக்கு இல்லை',
    language: 'ta',
    titleEn: 'Streetlight not working',
    descriptionEn: 'Light has been out for three days on Ward 12 main road',
  };

  test('displays translated English titleEn and descriptionEn when en is selected', () => {
    const res = getStaffComplaintText(sampleTamilComplaint, 'en');
    expect(res.displayTitle).toBe('Streetlight not working');
    expect(res.displayDescription).toBe('Light has been out for three days on Ward 12 main road');
    expect(res.isTitleFallback).toBe(false);
    expect(res.isDescFallback).toBe(false);
    expect(res.showOriginalBadge).toBe(false);
    expect(res.isTranslated).toBe(true);
  });

  test('defaults to English translation when selectedLanguage is omitted', () => {
    const res = getStaffComplaintText(sampleTamilComplaint);
    expect(res.displayTitle).toBe('Streetlight not working');
    expect(res.displayDescription).toBe('Light has been out for three days on Ward 12 main road');
    expect(res.selectedLanguage).toBe('en');
  });

  test('displays original citizen language without fallback badge when original or matching code is selected', () => {
    const asOriginal = getStaffComplaintText(sampleTamilComplaint, 'original');
    expect(asOriginal.displayTitle).toBe(sampleTamilComplaint.title);
    expect(asOriginal.displayDescription).toBe(sampleTamilComplaint.description);
    expect(asOriginal.isTitleFallback).toBe(false);
    expect(asOriginal.isDescFallback).toBe(false);
    expect(asOriginal.showOriginalBadge).toBe(false);
    expect(asOriginal.isTranslated).toBe(false);

    const asExplicitTa = getStaffComplaintText(sampleTamilComplaint, 'TA');
    expect(asExplicitTa.displayTitle).toBe(sampleTamilComplaint.title);
    expect(asExplicitTa.displayDescription).toBe(sampleTamilComplaint.description);
    expect(asExplicitTa.isTitleFallback).toBe(false);
    expect(asExplicitTa.sourceLanguage).toBe('ta');
  });

  test('flags fallback badge when non-English complaint lacks cached titleEn or descriptionEn', () => {
    const untranslated = {
      title: 'मुख्य सड़क पर गड्ढा है',
      description: 'वाहन चालकों को परेशानी हो रही है',
      language: 'hi',
      titleEn: null,
      descriptionEn: '',
    };

    const res = getStaffComplaintText(untranslated, 'en');
    expect(res.displayTitle).toBe(untranslated.title);
    expect(res.displayDescription).toBe(untranslated.description);
    expect(res.isTitleFallback).toBe(true);
    expect(res.isDescFallback).toBe(true);
    expect(res.showOriginalBadge).toBe(true);
    expect(res.isTranslated).toBe(false);
  });

  test('falls back safely to translated English when an unsupported target language is selected', () => {
    const res = getStaffComplaintText(sampleTamilComplaint, 'hi');
    expect(res.displayTitle).toBe('Streetlight not working');
    expect(res.displayDescription).toBe('Light has been out for three days on Ward 12 main road');
    expect(res.isTitleFallback).toBe(true);
    expect(res.showOriginalBadge).toBe(true);
  });

  test('normalizeStaffLanguage and options handle aliases safely', () => {
    expect(normalizeStaffLanguage('english')).toBe('en');
    expect(normalizeStaffLanguage('NATIVE')).toBe('original');
    expect(normalizeStaffLanguage(null)).toBe('en');
    expect(STAFF_LANGUAGE_OPTIONS.map((o) => o.value)).toEqual(['en', 'original']);
  });
});

