export interface ComplaintLanguageProps {
  title: string;
  description?: string;
  language?: string | null;
  titleEn?: string | null;
  descriptionEn?: string | null;
}

export type StaffLanguagePreference =
  | 'en'
  | 'original'
  | 'hi'
  | 'ta'
  | 'te'
  | 'kn'
  | 'ml'
  | 'bn'
  | 'gu'
  | 'pa'
  | 'or';

export const STAFF_LANGUAGE_OPTIONS: Array<{ value: 'en' | 'original'; label: string }> = [
  { value: 'en', label: 'English (Translated)' },
  { value: 'original', label: 'Original Language' },
];

export function normalizeStaffLanguage(lang?: string | null): string {
  const normalized = (lang || 'en').toLowerCase().trim();
  if (!normalized || normalized === 'english') return 'en';
  if (normalized === 'orig' || normalized === 'native') return 'original';
  return normalized;
}

export interface StaffComplaintTextResult {
  displayTitle: string;
  displayDescription: string;
  isTitleFallback: boolean;
  isDescFallback: boolean;
  showOriginalBadge: boolean;
  isTranslated: boolean;
  sourceLanguage: string;
  selectedLanguage: string;
}

/**
 * Pure mapper returning complaint title and description in the staff portal's selected language.
 * Uses existing `titleEn` / `descriptionEn` fields when English is selected, or displays the
 * complaint's original text when `'original'` (or the matching source language code) is chosen.
 */
export function getStaffComplaintText(
  complaint: ComplaintLanguageProps,
  selectedLanguage: string = 'en',
): StaffComplaintTextResult {
  const sourceLang = (complaint.language || '').toLowerCase().trim() || 'en';
  const isNonEnglish = sourceLang !== 'en';
  const targetLang = normalizeStaffLanguage(selectedLanguage);

  const hasTitleEn = Boolean(complaint.titleEn && complaint.titleEn.trim());
  const hasDescEn = Boolean(complaint.descriptionEn && complaint.descriptionEn.trim());
  const originalTitle = complaint.title;
  const originalDescription = complaint.description || '';

  // Staff explicitly requested citizen's original language or the complaint's exact language code
  if (targetLang === 'original' || (isNonEnglish && targetLang === sourceLang)) {
    return {
      displayTitle: originalTitle,
      displayDescription: originalDescription,
      isTitleFallback: false,
      isDescFallback: false,
      showOriginalBadge: false,
      isTranslated: false,
      sourceLanguage: sourceLang,
      selectedLanguage: targetLang,
    };
  }

  // English mode (default) — also used as safe bridge fallback for uncached third languages
  const displayTitle = hasTitleEn ? complaint.titleEn!.trim() : originalTitle;
  const displayDescription = hasDescEn
    ? complaint.descriptionEn!.trim()
    : originalDescription;

  const isTitleFallback = isNonEnglish && !hasTitleEn;
  const isDescFallback = isNonEnglish && !hasDescEn;
  const translatedBridgeFallback = targetLang !== 'en';

  return {
    displayTitle,
    displayDescription,
    isTitleFallback: isTitleFallback || translatedBridgeFallback,
    isDescFallback:
      isDescFallback || (translatedBridgeFallback && Boolean(originalDescription)),
    showOriginalBadge: isTitleFallback || isDescFallback || translatedBridgeFallback,
    isTranslated:
      targetLang === 'en' && (hasTitleEn || hasDescEn),
    sourceLanguage: sourceLang,
    selectedLanguage: targetLang,
  };
}
