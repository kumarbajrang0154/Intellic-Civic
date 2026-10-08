export interface ComplaintLanguageProps {
  title: string;
  description?: string;
  language?: string | null;
  titleEn?: string | null;
  descriptionEn?: string | null;
}

/**
 * Returns the appropriate English text or original fallback for staff-facing portals.
 * If language is not 'en' and titleEn / descriptionEn is missing, falls back to original text
 * and flags isTitleFallback / isDescFallback so an "Original language" badge can be rendered.
 */
export function getStaffComplaintText(complaint: ComplaintLanguageProps) {
  const lang = (complaint.language || '').toLowerCase().trim();
  const isNonEnglish = lang !== '' && lang !== 'en';

  const hasTitleEn = Boolean(complaint.titleEn && complaint.titleEn.trim());
  const hasDescEn = Boolean(complaint.descriptionEn && complaint.descriptionEn.trim());

  const displayTitle = hasTitleEn ? complaint.titleEn!.trim() : complaint.title;
  const displayDescription = hasDescEn ? complaint.descriptionEn!.trim() : (complaint.description || '');

  const isTitleFallback = isNonEnglish && !hasTitleEn;
  const isDescFallback = isNonEnglish && !hasDescEn;

  return {
    displayTitle,
    displayDescription,
    isTitleFallback,
    isDescFallback,
    showOriginalBadge: isTitleFallback || isDescFallback,
  };
}
