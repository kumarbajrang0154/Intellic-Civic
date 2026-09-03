import prisma from '@/lib/prisma';

export interface PlatformSettingsItem {
  id: string;
  // 1. General Branding
  platformName: string;
  shortName: string;
  organizationName: string;
  logoUrl: string | null;
  faviconUrl: string | null;

  // 2. Contact Information
  supportEmail: string;
  officialPhone: string;
  citizenSupportNumber: string;
  officeContactNumber: string;
  workingHours: string;

  // 3. Organization Address
  officeName: string;
  address: string;
  city: string;
  district: string;
  state: string;
  pincode: string;
  country: string;

  // 4. Google Maps
  googleMapsUrl: string | null;
  latitude: number | null;
  longitude: number | null;

  // 5. Social Links
  websiteUrl: string | null;
  facebookUrl: string | null;
  instagramUrl: string | null;
  twitterUrl: string | null;
  linkedinUrl: string | null;
  youtubeUrl: string | null;

  // 6. Footer Settings
  footerDescription: string;
  copyrightText: string;

  // 7. Legal Settings
  privacyPolicyUrl: string | null;
  termsConditionsUrl: string | null;

  // 8. SEO & Meta
  metaTitle: string;
  metaDescription: string;
  metaKeywords: string;
  openGraphImageUrl: string | null;

  updatedAt: string;
  createdAt: string;
}

const DEFAULT_SETTINGS = {
  id: 'global',
  platformName: 'IntelliCivic Platform',
  shortName: 'IntelliCivic',
  organizationName: 'Smart City Municipal Corporation',
  logoUrl: null,
  faviconUrl: null,
  supportEmail: 'support@intellicivic.gov.in',
  officialPhone: '+91 1800-123-4567',
  citizenSupportNumber: '+91 1800-111-2222',
  officeContactNumber: '+91 011-23456789',
  workingHours: 'Mon - Sat: 9:00 AM - 6:00 PM',
  officeName: 'Civic Center HQ',
  address: '1, Municipal Circle, Connaught Place',
  city: 'New Delhi',
  district: 'Central Delhi',
  state: 'Delhi',
  pincode: '110001',
  country: 'India',
  googleMapsUrl: 'https://maps.google.com/?q=28.6315,77.2167',
  latitude: 28.6315,
  longitude: 77.2167,
  websiteUrl: 'https://smartaicity.vercel.app',
  facebookUrl: 'https://facebook.com/intellicivic',
  instagramUrl: 'https://instagram.com/intellicivic',
  twitterUrl: 'https://x.com/intellicivic',
  linkedinUrl: 'https://linkedin.com/company/intellicivic',
  youtubeUrl: 'https://youtube.com/@intellicivic',
  footerDescription:
    'Empowering citizens and municipal administration with AI-driven civic complaint resolution, transparent tracking, and automated field governance.',
  copyrightText: '© 2026 IntelliCivic Smart City Platform. All rights reserved.',
  privacyPolicyUrl: '/privacy',
  termsConditionsUrl: '/terms',
  metaTitle: 'IntelliCivic - AI Driven Smart City Civic Platform',
  metaDescription:
    'Report civic complaints, track real-time resolution, and connect with municipal departments efficiently.',
  metaKeywords: 'smart city, civic complaint, municipal governance, pothole repair, sanitation, AI triage',
  openGraphImageUrl: null,
};

function formatSettings(item: any): PlatformSettingsItem {
  return {
    id: item.id || 'global',
    platformName: item.platformName || DEFAULT_SETTINGS.platformName,
    shortName: item.shortName || DEFAULT_SETTINGS.shortName,
    organizationName: item.organizationName || DEFAULT_SETTINGS.organizationName,
    logoUrl: item.logoUrl ?? null,
    faviconUrl: item.faviconUrl ?? null,
    supportEmail: item.supportEmail || DEFAULT_SETTINGS.supportEmail,
    officialPhone: item.officialPhone || DEFAULT_SETTINGS.officialPhone,
    citizenSupportNumber: item.citizenSupportNumber || DEFAULT_SETTINGS.citizenSupportNumber,
    officeContactNumber: item.officeContactNumber || DEFAULT_SETTINGS.officeContactNumber,
    workingHours: item.workingHours || DEFAULT_SETTINGS.workingHours,
    officeName: item.officeName || DEFAULT_SETTINGS.officeName,
    address: item.address || DEFAULT_SETTINGS.address,
    city: item.city || DEFAULT_SETTINGS.city,
    district: item.district || DEFAULT_SETTINGS.district,
    state: item.state || DEFAULT_SETTINGS.state,
    pincode: item.pincode || DEFAULT_SETTINGS.pincode,
    country: item.country || DEFAULT_SETTINGS.country,
    googleMapsUrl: item.googleMapsUrl ?? DEFAULT_SETTINGS.googleMapsUrl,
    latitude: item.latitude ?? DEFAULT_SETTINGS.latitude,
    longitude: item.longitude ?? DEFAULT_SETTINGS.longitude,
    websiteUrl: item.websiteUrl ?? DEFAULT_SETTINGS.websiteUrl,
    facebookUrl: item.facebookUrl ?? DEFAULT_SETTINGS.facebookUrl,
    instagramUrl: item.instagramUrl ?? DEFAULT_SETTINGS.instagramUrl,
    twitterUrl: item.twitterUrl ?? DEFAULT_SETTINGS.twitterUrl,
    linkedinUrl: item.linkedinUrl ?? DEFAULT_SETTINGS.linkedinUrl,
    youtubeUrl: item.youtubeUrl ?? DEFAULT_SETTINGS.youtubeUrl,
    footerDescription: item.footerDescription || DEFAULT_SETTINGS.footerDescription,
    copyrightText: item.copyrightText || DEFAULT_SETTINGS.copyrightText,
    privacyPolicyUrl: item.privacyPolicyUrl ?? DEFAULT_SETTINGS.privacyPolicyUrl,
    termsConditionsUrl: item.termsConditionsUrl ?? DEFAULT_SETTINGS.termsConditionsUrl,
    metaTitle: item.metaTitle || DEFAULT_SETTINGS.metaTitle,
    metaDescription: item.metaDescription || DEFAULT_SETTINGS.metaDescription,
    metaKeywords: item.metaKeywords || DEFAULT_SETTINGS.metaKeywords,
    openGraphImageUrl: item.openGraphImageUrl ?? null,
    updatedAt: item.updatedAt instanceof Date ? item.updatedAt.toISOString() : new Date().toISOString(),
    createdAt: item.createdAt instanceof Date ? item.createdAt.toISOString() : new Date().toISOString(),
  };
}

export async function getPlatformSettings(): Promise<PlatformSettingsItem> {
  try {
    let settings = await prisma.platformSettings.findUnique({
      where: { id: 'global' },
    });

    if (!settings) {
      settings = await prisma.platformSettings.create({
        data: DEFAULT_SETTINGS,
      });
    }

    return formatSettings(settings);
  } catch (error) {
    console.error('[SETTINGS STORE ERROR] getPlatformSettings failed:', error);
    return formatSettings(DEFAULT_SETTINGS);
  }
}

export async function updatePlatformSettings(
  input: Partial<Omit<PlatformSettingsItem, 'id' | 'createdAt' | 'updatedAt'>>,
): Promise<PlatformSettingsItem> {
  const updated = await prisma.platformSettings.upsert({
    where: { id: 'global' },
    update: {
      ...input,
    },
    create: {
      ...DEFAULT_SETTINGS,
      ...input,
    },
  });

  return formatSettings(updated);
}
