'use client';

import * as React from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { User, Mail, MapPin, Phone, CheckCircle2, Sparkles, Loader2 } from 'lucide-react';
import { AppShell } from '@/components/layout/app-shell';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { toast } from 'sonner';

function CitizenProfileForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isFirstTimeParam = searchParams.get('firstTime') === 'true';

  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const [mobileNumber, setMobileNumber] = React.useState('');
  const [name, setName] = React.useState('');
  const [email, setEmail] = React.useState('');
  const [address, setAddress] = React.useState('');
  const [avatarUrl, setAvatarUrl] = React.useState('');
  const [isProfileComplete, setIsProfileComplete] = React.useState(false);

  // Fetch current citizen profile
  React.useEffect(() => {
    async function loadProfile() {
      try {
        const res = await fetch('/api/citizen/profile');
        if (res.ok) {
          const data = await res.json();
          if (data.profile) {
            setMobileNumber(data.profile.mobileNumber || '');
            setName(data.profile.name || '');
            setEmail(data.profile.email || '');
            setAddress(data.profile.address || '');
            setAvatarUrl(data.profile.avatarUrl || '');
            setIsProfileComplete(Boolean(data.profile.isProfileComplete));
          }
        }
      } catch (err) {
        console.error('Failed to load citizen profile', err);
      } finally {
        setLoading(false);
      }
    }
    loadProfile();
  }, []);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError('Please enter your full name');
      return;
    }
    if (!email.trim() || !email.includes('@')) {
      setError('Please enter a valid Gmail / Email address');
      return;
    }
    if (!address.trim()) {
      setError('Please enter your residential address');
      return;
    }

    setSaving(true);
    try {
      const res = await fetch('/api/citizen/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          email,
          address,
          avatarUrl,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Failed to update profile');
      }

      setIsProfileComplete(true);
      toast.success('Profile saved successfully!');

      if (isFirstTimeParam || !isProfileComplete) {
        router.push('/citizen');
      }
      router.refresh();
    } catch (err: any) {
      setError(err.message || 'Error saving profile');
      toast.error(err.message || 'Error saving profile');
    } finally {
      setSaving(false);
    }
  };

  return (
    <AppShell
      user={{
        name: name || 'Citizen',
        role: 'CITIZEN',
      }}
    >
      <div className="max-w-3xl mx-auto space-y-6">
        {/* Welcome Banner for First Time Users */}
        {(isFirstTimeParam || !isProfileComplete) && (
          <Alert className="border-primary/40 bg-primary/5 text-primary">
            <Sparkles className="h-5 w-5 text-primary shrink-0" />
            <AlertTitle className="font-bold text-base">Complete Your Citizen Profile</AlertTitle>
            <AlertDescription className="text-sm mt-1">
              Welcome to IntelliCivic! Please fill out your profile details (Name, Gmail, Address & Profile Picture) before filing complaints.
            </AlertDescription>
          </Alert>
        )}

        <div className="border-b pb-4">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
            Citizen Profile Settings
          </h1>
          <p className="text-muted-foreground text-xs sm:text-sm mt-1">
            Manage your personal contact details, verified mobile number, address, and profile picture.
          </p>
        </div>

        {loading ? (
          <Card className="p-8 text-center">
            <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary mb-2" />
            <p className="text-sm text-muted-foreground">Loading profile details...</p>
          </Card>
        ) : (
          <form onSubmit={handleSaveProfile} className="space-y-6">
            <Card className="shadow-sm">
              <CardHeader>
                <CardTitle className="text-lg">Personal Information</CardTitle>
                <CardDescription>
                  Your details are used for official complaint resolution notifications and municipal records.
                </CardDescription>
              </CardHeader>

              <CardContent className="space-y-5">
                {error && (
                  <Alert variant="destructive">
                    <AlertTitle>Profile Update Error</AlertTitle>
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}

                {/* Profile Avatar Selector / Upload */}
                <div className="flex flex-col sm:flex-row items-center gap-4 p-4 bg-muted/40 rounded-xl border">
                  <div className="relative h-20 w-20 rounded-full border-2 border-primary/30 overflow-hidden bg-muted flex items-center justify-center shrink-0">
                    {avatarUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={avatarUrl} alt={name || 'Avatar'} className="h-full w-full object-cover" />
                    ) : (
                      <User className="h-10 w-10 text-muted-foreground" />
                    )}
                  </div>

                  <div className="space-y-2 text-center sm:text-left flex-1 min-w-0">
                    <div className="font-semibold text-sm">Profile Picture URL</div>
                    <Input
                      type="url"
                      placeholder="https://example.com/avatar.jpg"
                      value={avatarUrl}
                      onChange={(e) => setAvatarUrl(e.target.value)}
                      className="text-xs font-mono"
                    />
                    <p className="text-[11px] text-muted-foreground">
                      Enter an image URL or choose a sample avatar below.
                    </p>

                    {/* Quick Preset Avatars */}
                    <div className="flex items-center gap-2 pt-1">
                      <span className="text-[11px] font-medium text-muted-foreground">Preset:</span>
                      {[
                        'https://api.dicebear.com/7.x/avataaars/svg?seed=Citizen1',
                        'https://api.dicebear.com/7.x/avataaars/svg?seed=Citizen2',
                        'https://api.dicebear.com/7.x/avataaars/svg?seed=Citizen3',
                      ].map((url, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => setAvatarUrl(url)}
                          className="text-[10px] px-2 py-0.5 rounded border bg-background hover:bg-accent text-foreground font-medium"
                        >
                          Avatar {idx + 1}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Verified Mobile Number (Disabled) */}
                <div className="space-y-2">
                  <label className="text-sm font-medium flex items-center gap-1.5">
                    <Phone className="h-4 w-4 text-primary" />
                    <span>Verified Mobile Number</span>
                  </label>
                  <div className="relative">
                    <Input
                      type="text"
                      value={mobileNumber ? `+91 ${mobileNumber}` : ''}
                      disabled
                      className="bg-muted text-muted-foreground font-medium"
                    />
                    <span className="absolute right-3 top-2.5 text-xs text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Verified
                    </span>
                  </div>
                </div>

                {/* Full Name */}
                <div className="space-y-2">
                  <label htmlFor="name" className="text-sm font-medium flex items-center gap-1.5">
                    <User className="h-4 w-4 text-primary" />
                    <span>Full Name <span className="text-destructive">*</span></span>
                  </label>
                  <Input
                    id="name"
                    type="text"
                    placeholder="e.g. Bajrang Kumar"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                  />
                </div>

                {/* Gmail / Email Address */}
                <div className="space-y-2">
                  <label htmlFor="email" className="text-sm font-medium flex items-center gap-1.5">
                    <Mail className="h-4 w-4 text-primary" />
                    <span>Gmail / Email Address <span className="text-destructive">*</span></span>
                  </label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="e.g. citizen@gmail.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>

                {/* Residential / Locality Address */}
                <div className="space-y-2">
                  <label htmlFor="address" className="text-sm font-medium flex items-center gap-1.5">
                    <MapPin className="h-4 w-4 text-primary" />
                    <span>Residential / Area Address <span className="text-destructive">*</span></span>
                  </label>
                  <Textarea
                    id="address"
                    rows={3}
                    placeholder="e.g. House No. 42, Park View Colony, Ward 12, Main City"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    required
                  />
                </div>
              </CardContent>
            </Card>

            <div className="flex flex-col sm:flex-row items-center justify-end gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => router.push('/citizen')}
                className="w-full sm:w-auto"
              >
                Cancel
              </Button>
              <Button type="submit" disabled={saving} className="w-full sm:w-auto">
                {saving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving Profile...
                  </>
                ) : (
                  'Save & Continue'
                )}
              </Button>
            </div>
          </form>
        )}
      </div>
    </AppShell>
  );
}

export default function CitizenProfilePage() {
  return (
    <React.Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center p-8">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      }
    >
      <CitizenProfileForm />
    </React.Suspense>
  );
}
