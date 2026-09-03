'use client';

import * as React from 'react';
import {
  Building,
  Building2,
  Globe,
  Globe2,
  Image as ImageIcon,
  Info,
  KeyRound,
  Layout,
  Loader2,
  Lock,
  Mail,
  MapPin,
  Phone,
  RotateCcw,
  Save,
  Search,
  Share2,
  ShieldAlert,
  Sparkles,
} from 'lucide-react';
import { AppShell } from '@/components/layout/app-shell';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';

type TabSection =
  | 'branding'
  | 'contact'
  | 'address'
  | 'maps'
  | 'social'
  | 'footer'
  | 'legal'
  | 'seo';

interface PlatformSettingsForm {
  // 1. General Branding
  platformName: string;
  shortName: string;
  organizationName: string;
  logoUrl: string;
  faviconUrl: string;

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
  googleMapsUrl: string;
  latitude: number | string;
  longitude: number | string;

  // 5. Social Links
  websiteUrl: string;
  facebookUrl: string;
  instagramUrl: string;
  twitterUrl: string;
  linkedinUrl: string;
  youtubeUrl: string;

  // 6. Footer Settings
  footerDescription: string;
  copyrightText: string;

  // 7. Legal Settings
  privacyPolicyUrl: string;
  termsConditionsUrl: string;

  // 8. SEO & Meta
  metaTitle: string;
  metaDescription: string;
  metaKeywords: string;
  openGraphImageUrl: string;
}

const DEFAULT_FORM_STATE: PlatformSettingsForm = {
  platformName: 'IntelliCivic Platform',
  shortName: 'IntelliCivic',
  organizationName: 'Smart City Municipal Corporation',
  logoUrl: '',
  faviconUrl: '',
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
  openGraphImageUrl: '',
};

export default function PlatformSettingsPage() {
  const [activeTab, setActiveTab] = React.useState<TabSection>('branding');
  const [formData, setFormData] = React.useState<PlatformSettingsForm>(DEFAULT_FORM_STATE);
  const [initialData, setInitialData] = React.useState<PlatformSettingsForm>(DEFAULT_FORM_STATE);
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [unauthorized, setUnauthorized] = React.useState(false);
  const [currentUserRole, setCurrentUserRole] = React.useState<string>('SUPER_ADMIN');

  // Fetch current platform settings
  const fetchSettings = React.useCallback(async () => {
    setLoading(true);
    setUnauthorized(false);
    try {
      const res = await fetch('/api/admin/settings');
      if (res.status === 403) {
        setUnauthorized(true);
        setLoading(false);
        return;
      }

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Failed to load platform settings');
      }

      const s = data.settings;
      const loadedForm: PlatformSettingsForm = {
        platformName: s.platformName || DEFAULT_FORM_STATE.platformName,
        shortName: s.shortName || DEFAULT_FORM_STATE.shortName,
        organizationName: s.organizationName || DEFAULT_FORM_STATE.organizationName,
        logoUrl: s.logoUrl || '',
        faviconUrl: s.faviconUrl || '',
        supportEmail: s.supportEmail || DEFAULT_FORM_STATE.supportEmail,
        officialPhone: s.officialPhone || DEFAULT_FORM_STATE.officialPhone,
        citizenSupportNumber: s.citizenSupportNumber || DEFAULT_FORM_STATE.citizenSupportNumber,
        officeContactNumber: s.officeContactNumber || DEFAULT_FORM_STATE.officeContactNumber,
        workingHours: s.workingHours || DEFAULT_FORM_STATE.workingHours,
        officeName: s.officeName || DEFAULT_FORM_STATE.officeName,
        address: s.address || DEFAULT_FORM_STATE.address,
        city: s.city || DEFAULT_FORM_STATE.city,
        district: s.district || DEFAULT_FORM_STATE.district,
        state: s.state || DEFAULT_FORM_STATE.state,
        pincode: s.pincode || DEFAULT_FORM_STATE.pincode,
        country: s.country || DEFAULT_FORM_STATE.country,
        googleMapsUrl: s.googleMapsUrl || DEFAULT_FORM_STATE.googleMapsUrl,
        latitude: s.latitude ?? DEFAULT_FORM_STATE.latitude,
        longitude: s.longitude ?? DEFAULT_FORM_STATE.longitude,
        websiteUrl: s.websiteUrl || DEFAULT_FORM_STATE.websiteUrl,
        facebookUrl: s.facebookUrl || DEFAULT_FORM_STATE.facebookUrl,
        instagramUrl: s.instagramUrl || DEFAULT_FORM_STATE.instagramUrl,
        twitterUrl: s.twitterUrl || DEFAULT_FORM_STATE.twitterUrl,
        linkedinUrl: s.linkedinUrl || DEFAULT_FORM_STATE.linkedinUrl,
        youtubeUrl: s.youtubeUrl || DEFAULT_FORM_STATE.youtubeUrl,
        footerDescription: s.footerDescription || DEFAULT_FORM_STATE.footerDescription,
        copyrightText: s.copyrightText || DEFAULT_FORM_STATE.copyrightText,
        privacyPolicyUrl: s.privacyPolicyUrl || DEFAULT_FORM_STATE.privacyPolicyUrl,
        termsConditionsUrl: s.termsConditionsUrl || DEFAULT_FORM_STATE.termsConditionsUrl,
        metaTitle: s.metaTitle || DEFAULT_FORM_STATE.metaTitle,
        metaDescription: s.metaDescription || DEFAULT_FORM_STATE.metaDescription,
        metaKeywords: s.metaKeywords || DEFAULT_FORM_STATE.metaKeywords,
        openGraphImageUrl: s.openGraphImageUrl || '',
      };

      setFormData(loadedForm);
      setInitialData(loadedForm);
    } catch (err: any) {
      toast.error(err.message || 'Error loading platform settings');
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  // Handle Input Changes
  const handleChange = (field: keyof PlatformSettingsForm, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  // Reset form to last loaded initial data
  const handleReset = () => {
    setFormData(initialData);
    toast.info('Form changes reset to last saved state.');
  };

  // Save Settings
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();

    // Client-side Validation
    if (!formData.platformName.trim()) {
      toast.error('Platform Name is required');
      setActiveTab('branding');
      return;
    }

    if (!formData.supportEmail.includes('@')) {
      toast.error('Please enter a valid Support Email');
      setActiveTab('contact');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        ...formData,
        latitude: formData.latitude !== '' ? Number(formData.latitude) : null,
        longitude: formData.longitude !== '' ? Number(formData.longitude) : null,
      };

      const res = await fetch('/api/admin/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Failed to save settings');
      }

      toast.success('Platform Settings saved successfully!');
      setInitialData(formData);
    } catch (err: any) {
      toast.error(err.message || 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const navTabs: { id: TabSection; label: string; icon: any }[] = [
    { id: 'branding', label: 'General Branding', icon: ImageIcon },
    { id: 'contact', label: 'Contact Information', icon: Phone },
    { id: 'address', label: 'Organization Address', icon: Building2 },
    { id: 'maps', label: 'Google Maps', icon: MapPin },
    { id: 'social', label: 'Social Links', icon: Share2 },
    { id: 'footer', label: 'Footer Settings', icon: Layout },
    { id: 'legal', label: 'Legal Policies', icon: Lock },
    { id: 'seo', label: 'SEO & Metadata', icon: Search },
  ];

  if (unauthorized) {
    return (
      <AppShell user={{ name: 'Staff Member', role: 'ADMIN' }}>
        <div className="max-w-2xl mx-auto py-12">
          <Card className="border-destructive/30 shadow-lg">
            <CardHeader className="text-center space-y-2">
              <div className="mx-auto h-12 w-12 rounded-full bg-destructive/10 text-destructive flex items-center justify-center">
                <ShieldAlert className="h-6 w-6" />
              </div>
              <CardTitle className="text-2xl font-bold">Access Restricted</CardTitle>
              <CardDescription>
                Only Super Admin accounts (`SUPER_ADMIN` role) are authorized to view or edit global platform configuration settings.
              </CardDescription>
            </CardHeader>
            <CardContent className="text-center space-y-4">
              <Alert variant="destructive">
                <AlertTitle>403 Forbidden</AlertTitle>
                <AlertDescription>
                  Your current account does not have Super Admin privileges.
                </AlertDescription>
              </Alert>
              <Button onClick={() => (window.location.href = '/admin')}>
                Return to Admin Dashboard
              </Button>
            </CardContent>
          </Card>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell user={{ name: 'Bajrang Kumar (Super Admin)', role: 'SUPER_ADMIN' }}>
      <div className="space-y-6">
        {/* Page Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b pb-4">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">Platform & Organization Settings</h1>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-primary/10 text-primary border border-primary/20">
                SUPER_ADMIN ONLY
              </span>
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              Configure global municipal branding, contact numbers, address, footer content, legal terms, and SEO.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={handleReset}
              disabled={loading || saving}
              className="gap-1.5 text-xs"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Reset Changes
            </Button>
            <Button
              size="sm"
              onClick={handleSave}
              disabled={loading || saving}
              className="gap-1.5 text-xs font-semibold bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white shadow"
            >
              {saving ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="h-3.5 w-3.5" />
                  Save Settings
                </>
              )}
            </Button>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center p-16">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
            {/* Left Settings Navigation */}
            <div className="md:col-span-3 space-y-1">
              <div className="text-xs font-semibold text-muted-foreground uppercase px-3 py-1">
                Setting Sections
              </div>
              <nav className="space-y-1">
                {navTabs.map((tab) => {
                  const Icon = tab.icon;
                  const isActive = activeTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setActiveTab(tab.id)}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs sm:text-sm font-medium transition-all text-left ${
                        isActive
                          ? 'bg-primary text-primary-foreground font-semibold shadow-sm'
                          : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                      }`}
                    >
                      <Icon className="h-4 w-4 shrink-0" />
                      <span>{tab.label}</span>
                    </button>
                  );
                })}
              </nav>

              {/* Dynamic Live Preview Box */}
              <div className="pt-4">
                <Card className="border-primary/20 bg-primary/5">
                  <CardHeader className="p-3">
                    <CardTitle className="text-xs font-bold flex items-center gap-1.5 text-primary">
                      <Sparkles className="h-3.5 w-3.5" /> Live Branding Preview
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-3 pt-0 space-y-2 text-xs">
                    <div className="flex items-center gap-2 p-2 bg-card rounded border">
                      {formData.logoUrl ? (
                        <img
                          src={formData.logoUrl}
                          alt="Logo"
                          className="h-6 w-6 object-contain rounded"
                        />
                      ) : (
                        <ImageIcon className="h-5 w-5 text-muted-foreground" />
                      )}
                      <div className="min-w-0">
                        <p className="font-bold truncate">{formData.platformName || 'Platform Name'}</p>
                        <p className="text-[10px] text-muted-foreground truncate">{formData.shortName}</p>
                      </div>
                    </div>

                    <div className="p-2 bg-card rounded border text-[11px] space-y-1">
                      <p className="font-semibold text-muted-foreground">Footer Preview:</p>
                      <p className="text-[10px] text-muted-foreground line-clamp-2">{formData.footerDescription}</p>
                      <p className="text-[9px] text-muted-foreground font-mono truncate">{formData.copyrightText}</p>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>

            {/* Main Form Content Area */}
            <div className="md:col-span-9">
              <form onSubmit={handleSave}>
                {/* 1. GENERAL BRANDING */}
                {activeTab === 'branding' && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg flex items-center gap-2">
                        <ImageIcon className="h-5 w-5 text-primary" /> General Branding
                      </CardTitle>
                      <CardDescription>
                        Define your platform title, short name, organization brand, and app logos.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                          <label className="text-xs font-semibold">Platform Name *</label>
                          <Input
                            value={formData.platformName}
                            onChange={(e) => handleChange('platformName', e.target.value)}
                            placeholder="e.g. IntelliCivic Platform"
                            required
                          />
                        </div>

                        <div className="space-y-1.5">
                          <label className="text-xs font-semibold">Short Name *</label>
                          <Input
                            value={formData.shortName}
                            onChange={(e) => handleChange('shortName', e.target.value)}
                            placeholder="e.g. IntelliCivic"
                            required
                          />
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold">Organization Name</label>
                        <Input
                          value={formData.organizationName}
                          onChange={(e) => handleChange('organizationName', e.target.value)}
                          placeholder="e.g. Smart City Municipal Corporation"
                        />
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                          <label className="text-xs font-semibold">Logo Image URL</label>
                          <Input
                            value={formData.logoUrl}
                            onChange={(e) => handleChange('logoUrl', e.target.value)}
                            placeholder="https://example.com/logo.png"
                          />
                          <p className="text-[11px] text-muted-foreground">PNG, SVG or WEBP recommended URL.</p>
                        </div>

                        <div className="space-y-1.5">
                          <label className="text-xs font-semibold">Favicon Image URL</label>
                          <Input
                            value={formData.faviconUrl}
                            onChange={(e) => handleChange('faviconUrl', e.target.value)}
                            placeholder="https://example.com/favicon.ico"
                          />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* 2. CONTACT INFORMATION */}
                {activeTab === 'contact' && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg flex items-center gap-2">
                        <Phone className="h-5 w-5 text-primary" /> Contact Information
                      </CardTitle>
                      <CardDescription>
                        Official municipal emails, toll-free support numbers, and office operating hours.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                          <label className="text-xs font-semibold">Support Email *</label>
                          <Input
                            type="email"
                            value={formData.supportEmail}
                            onChange={(e) => handleChange('supportEmail', e.target.value)}
                            placeholder="support@intellicivic.gov.in"
                            required
                          />
                        </div>

                        <div className="space-y-1.5">
                          <label className="text-xs font-semibold">Official Phone</label>
                          <Input
                            value={formData.officialPhone}
                            onChange={(e) => handleChange('officialPhone', e.target.value)}
                            placeholder="+91 1800-123-4567"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                          <label className="text-xs font-semibold">Citizen Support Helpline</label>
                          <Input
                            value={formData.citizenSupportNumber}
                            onChange={(e) => handleChange('citizenSupportNumber', e.target.value)}
                            placeholder="+91 1800-111-2222"
                          />
                        </div>

                        <div className="space-y-1.5">
                          <label className="text-xs font-semibold">Office Contact Number</label>
                          <Input
                            value={formData.officeContactNumber}
                            onChange={(e) => handleChange('officeContactNumber', e.target.value)}
                            placeholder="+91 011-23456789"
                          />
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold">Working Hours</label>
                        <Input
                          value={formData.workingHours}
                          onChange={(e) => handleChange('workingHours', e.target.value)}
                          placeholder="e.g. Mon - Sat: 9:00 AM - 6:00 PM"
                        />
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* 3. ORGANIZATION ADDRESS */}
                {activeTab === 'address' && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg flex items-center gap-2">
                        <Building2 className="h-5 w-5 text-primary" /> Organization Address
                      </CardTitle>
                      <CardDescription>
                        Physical head office address and regional location details.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold">Office Name</label>
                        <Input
                          value={formData.officeName}
                          onChange={(e) => handleChange('officeName', e.target.value)}
                          placeholder="e.g. Civic Center HQ"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold">Full Street Address</label>
                        <textarea
                          className="w-full min-h-[80px] rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                          value={formData.address}
                          onChange={(e) => handleChange('address', e.target.value)}
                          placeholder="1, Municipal Circle, Connaught Place"
                        />
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <div className="space-y-1.5">
                          <label className="text-xs font-semibold">City</label>
                          <Input
                            value={formData.city}
                            onChange={(e) => handleChange('city', e.target.value)}
                            placeholder="New Delhi"
                          />
                        </div>

                        <div className="space-y-1.5">
                          <label className="text-xs font-semibold">District</label>
                          <Input
                            value={formData.district}
                            onChange={(e) => handleChange('district', e.target.value)}
                            placeholder="Central Delhi"
                          />
                        </div>

                        <div className="space-y-1.5">
                          <label className="text-xs font-semibold">State</label>
                          <Input
                            value={formData.state}
                            onChange={(e) => handleChange('state', e.target.value)}
                            placeholder="Delhi"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                          <label className="text-xs font-semibold">Pincode / Postal Code</label>
                          <Input
                            value={formData.pincode}
                            onChange={(e) => handleChange('pincode', e.target.value)}
                            placeholder="110001"
                          />
                        </div>

                        <div className="space-y-1.5">
                          <label className="text-xs font-semibold">Country</label>
                          <Input
                            value={formData.country}
                            onChange={(e) => handleChange('country', e.target.value)}
                            placeholder="India"
                          />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* 4. GOOGLE MAPS */}
                {activeTab === 'maps' && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg flex items-center gap-2">
                        <MapPin className="h-5 w-5 text-primary" /> Google Maps Integration
                      </CardTitle>
                      <CardDescription>
                        Municipal headquarters geographic coordinates and map preview URL.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold">Google Maps URL</label>
                        <Input
                          value={formData.googleMapsUrl}
                          onChange={(e) => handleChange('googleMapsUrl', e.target.value)}
                          placeholder="https://maps.google.com/?q=28.6315,77.2167"
                        />
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                          <label className="text-xs font-semibold">Latitude</label>
                          <Input
                            type="number"
                            step="any"
                            value={formData.latitude}
                            onChange={(e) => handleChange('latitude', e.target.value)}
                            placeholder="28.6315"
                          />
                        </div>

                        <div className="space-y-1.5">
                          <label className="text-xs font-semibold">Longitude</label>
                          <Input
                            type="number"
                            step="any"
                            value={formData.longitude}
                            onChange={(e) => handleChange('longitude', e.target.value)}
                            placeholder="77.2167"
                          />
                        </div>
                      </div>

                      {/* Location Preview Card */}
                      <div className="p-4 rounded-xl border bg-accent/30 space-y-2">
                        <div className="flex items-center gap-2 font-semibold text-xs text-primary">
                          <MapPin className="h-4 w-4" /> Location Coordinates Preview
                        </div>
                        <p className="text-xs text-muted-foreground font-mono">
                          Coordinates: Lat {formData.latitude || '28.6315'}, Lng {formData.longitude || '77.2167'}
                        </p>
                        {formData.googleMapsUrl && (
                          <a
                            href={formData.googleMapsUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline font-medium"
                          >
                            Open location in Google Maps &rarr;
                          </a>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* 5. SOCIAL LINKS */}
                {activeTab === 'social' && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg flex items-center gap-2">
                        <Share2 className="h-5 w-5 text-primary" /> Social Links & Portals
                      </CardTitle>
                      <CardDescription>
                        Links to official social channels and main government portal.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold">Official Website</label>
                        <Input
                          value={formData.websiteUrl}
                          onChange={(e) => handleChange('websiteUrl', e.target.value)}
                          placeholder="https://smartaicity.vercel.app"
                        />
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                          <label className="text-xs font-semibold">Facebook</label>
                          <Input
                            value={formData.facebookUrl}
                            onChange={(e) => handleChange('facebookUrl', e.target.value)}
                            placeholder="https://facebook.com/intellicivic"
                          />
                        </div>

                        <div className="space-y-1.5">
                          <label className="text-xs font-semibold">Instagram</label>
                          <Input
                            value={formData.instagramUrl}
                            onChange={(e) => handleChange('instagramUrl', e.target.value)}
                            placeholder="https://instagram.com/intellicivic"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                          <label className="text-xs font-semibold">X / Twitter</label>
                          <Input
                            value={formData.twitterUrl}
                            onChange={(e) => handleChange('twitterUrl', e.target.value)}
                            placeholder="https://x.com/intellicivic"
                          />
                        </div>

                        <div className="space-y-1.5">
                          <label className="text-xs font-semibold">LinkedIn</label>
                          <Input
                            value={formData.linkedinUrl}
                            onChange={(e) => handleChange('linkedinUrl', e.target.value)}
                            placeholder="https://linkedin.com/company/intellicivic"
                          />
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold">YouTube Channel</label>
                        <Input
                          value={formData.youtubeUrl}
                          onChange={(e) => handleChange('youtubeUrl', e.target.value)}
                          placeholder="https://youtube.com/@intellicivic"
                        />
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* 6. FOOTER SETTINGS */}
                {activeTab === 'footer' && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg flex items-center gap-2">
                        <Layout className="h-5 w-5 text-primary" /> Footer Settings
                      </CardTitle>
                      <CardDescription>
                        Custom text descriptions and copyright notices displayed across page footers.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold">Footer Description</label>
                        <textarea
                          className="w-full min-h-[90px] rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                          value={formData.footerDescription}
                          onChange={(e) => handleChange('footerDescription', e.target.value)}
                          placeholder="Empowering citizens and municipal administration..."
                        />
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold">Copyright Text</label>
                        <Input
                          value={formData.copyrightText}
                          onChange={(e) => handleChange('copyrightText', e.target.value)}
                          placeholder="© 2026 IntelliCivic Smart City Platform. All rights reserved."
                        />
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* 7. LEGAL SETTINGS */}
                {activeTab === 'legal' && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg flex items-center gap-2">
                        <Lock className="h-5 w-5 text-primary" /> Legal & Terms
                      </CardTitle>
                      <CardDescription>
                        URL links or documentation pages for citizen privacy policy and platform terms.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold">Privacy Policy Link</label>
                        <Input
                          value={formData.privacyPolicyUrl}
                          onChange={(e) => handleChange('privacyPolicyUrl', e.target.value)}
                          placeholder="/privacy"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold">Terms and Conditions Link</label>
                        <Input
                          value={formData.termsConditionsUrl}
                          onChange={(e) => handleChange('termsConditionsUrl', e.target.value)}
                          placeholder="/terms"
                        />
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* 8. SEO & META */}
                {activeTab === 'seo' && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg flex items-center gap-2">
                        <Search className="h-5 w-5 text-primary" /> SEO & Social Metadata
                      </CardTitle>
                      <CardDescription>
                        Default search engine titles, descriptions, keywords, and OpenGraph image previews.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold">Meta Title</label>
                        <Input
                          value={formData.metaTitle}
                          onChange={(e) => handleChange('metaTitle', e.target.value)}
                          placeholder="IntelliCivic - AI Driven Smart City Civic Platform"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold">Meta Description</label>
                        <textarea
                          className="w-full min-h-[80px] rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                          value={formData.metaDescription}
                          onChange={(e) => handleChange('metaDescription', e.target.value)}
                          placeholder="Report civic complaints, track real-time resolution..."
                        />
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold">Meta Keywords</label>
                        <Input
                          value={formData.metaKeywords}
                          onChange={(e) => handleChange('metaKeywords', e.target.value)}
                          placeholder="smart city, civic complaint, municipal governance"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold">Open Graph Preview Image URL</label>
                        <Input
                          value={formData.openGraphImageUrl}
                          onChange={(e) => handleChange('openGraphImageUrl', e.target.value)}
                          placeholder="https://example.com/og-image.png"
                        />
                      </div>
                    </CardContent>
                  </Card>
                )}
              </form>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
