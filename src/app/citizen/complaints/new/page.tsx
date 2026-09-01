'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  MapPin,
  Loader2,
  CheckCircle2,
  AlertCircle,
  FileText,
  Sparkles,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { PhotoUpload } from '@/components/ui/photo-upload';

import { AppShell } from '@/components/layout/app-shell';

interface Category {
  id: string;
  name: string;
  description?: string;
}

export default function NewComplaintPage() {
  const router = useRouter();

  const [user, setUser] = React.useState<{ name: string; role: 'CITIZEN' }>({
    name: 'Citizen',
    role: 'CITIZEN',
  });

  const [categories, setCategories] = React.useState<Category[]>([]);
  const [loadingCategories, setLoadingCategories] = React.useState(true);

  React.useEffect(() => {
    async function loadUser() {
      try {
        const res = await fetch('/api/auth/me');
        if (res.ok) {
          const data = await res.json();
          if (data.user) {
            setUser({ name: data.user.name || 'Citizen User', role: 'CITIZEN' });
          }
        }
      } catch (err) {}
    }
    loadUser();
  }, []);

  // Form state
  const [title, setTitle] = React.useState('');
  const [description, setDescription] = React.useState('');
  const [categoryId, setCategoryId] = React.useState('');
  const [address, setAddress] = React.useState('');
  const [latitude, setLatitude] = React.useState<number | null>(null);
  const [longitude, setLongitude] = React.useState<number | null>(null);
  const [evidenceUrls, setEvidenceUrls] = React.useState<string[]>([]);

  // Geolocation state
  const [gettingLocation, setGettingLocation] = React.useState(false);
  const [locationSuccess, setLocationSuccess] = React.useState(false);

  // Submission state
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [submitError, setSubmitError] = React.useState<string | null>(null);
  const [createdTicketId, setCreatedTicketId] = React.useState<string | null>(null);
  const [createdComplaintId, setCreatedComplaintId] = React.useState<string | null>(null);
  const [evidenceWarning, setEvidenceWarning] = React.useState<string | null>(null);

  // Inline validation errors
  const [errors, setErrors] = React.useState<{
    title?: string;
    description?: string;
  }>({});

  React.useEffect(() => {
    async function fetchCategories() {
      try {
        const res = await fetch('/api/categories');
        if (res.ok) {
          const data = await res.json();
          setCategories(Array.isArray(data) ? data : []);
        }
      } catch (err) {
        console.error('Failed to load categories', err);
      } finally {
        setLoadingCategories(false);
      }
    }
    fetchCategories();
  }, []);

  const handleGetCurrentLocation = () => {
    if (!navigator.geolocation) {
      setSubmitError('Geolocation is not supported by your browser.');
      return;
    }

    setGettingLocation(true);
    setLocationSuccess(false);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLatitude(position.coords.latitude);
        setLongitude(position.coords.longitude);
        setGettingLocation(false);
        setLocationSuccess(true);
      },
      (error) => {
        setGettingLocation(false);
        setSubmitError('Unable to retrieve your location. You can enter an address manually.');
      },
    );
  };

  const validateForm = () => {
    const newErrors: { title?: string; description?: string } = {};

    if (!title.trim() || title.trim().length < 5 || title.trim().length > 200) {
      newErrors.title = 'Title must be between 5 and 200 characters.';
    }

    if (!description.trim() || description.trim().length < 20) {
      newErrors.description = 'Description must be at least 20 characters long.';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    setIsSubmitting(true);
    setSubmitError(null);
    setEvidenceWarning(null);

    try {
      // Step 1: Create Complaint via BFF
      const complaintPayload: any = {
        title: title.trim(),
        description: description.trim(),
      };

      if (categoryId) {
        complaintPayload.categoryId = categoryId;
      }

      if (address.trim() || (latitude !== null && longitude !== null)) {
        complaintPayload.location = {
          address: address.trim() || undefined,
          latitude: latitude ?? 0,
          longitude: longitude ?? 0,
        };
      }

      const res = await fetch('/api/complaints', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(complaintPayload),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || 'Failed to submit complaint');
      }

      const complaintId = data.id;
      const ticketId = data.ticketId;

      setCreatedComplaintId(complaintId);
      setCreatedTicketId(ticketId);

      // Step 2: Attach evidence photos if uploaded
      if (evidenceUrls.length > 0) {
        let uploadFailedCount = 0;

        for (const imageUrl of evidenceUrls) {
          try {
            const evRes = await fetch(`/api/complaints/${complaintId}/evidence`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                imageUrl,
                stage: 'BEFORE',
              }),
            });

            if (!evRes.ok) uploadFailedCount++;
          } catch (evErr) {
            uploadFailedCount++;
          }
        }

        if (uploadFailedCount > 0) {
          setEvidenceWarning(
            `Complaint created successfully, but ${uploadFailedCount} photo(s) failed to attach. You can upload additional photos on the detail page.`,
          );
        }
      }
    } catch (err: any) {
      setSubmitError(err.message || 'An unexpected error occurred during submission.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (createdTicketId && createdComplaintId) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
        <Card className="w-full max-w-lg shadow-lg border-primary/20 text-center">
          <CardHeader className="space-y-2">
            <div className="mx-auto h-16 w-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mb-2">
              <CheckCircle2 className="h-10 w-10" />
            </div>
            <CardTitle className="text-2xl font-bold">Complaint Submitted Successfully!</CardTitle>
            <CardDescription>
              Your ticket has been logged in the system and is queued for automated AI triage.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="p-4 bg-muted/60 rounded-lg border inline-block w-full">
              <span className="text-xs text-muted-foreground uppercase tracking-wider block mb-1">
                Ticket Reference ID
              </span>
              <span className="text-2xl font-extrabold text-primary font-mono">
                {createdTicketId}
              </span>
            </div>

            {evidenceWarning && (
              <Alert variant="destructive" className="text-left text-xs">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Evidence Upload Warning</AlertTitle>
                <AlertDescription>{evidenceWarning}</AlertDescription>
              </Alert>
            )}

            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <Link href={`/citizen/complaints/${createdComplaintId}`} className="w-full">
                <Button className="w-full">Track This Complaint</Button>
              </Link>
              <Link href="/citizen" className="w-full">
                <Button variant="outline" className="w-full">
                  Return to Dashboard
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <AppShell user={user}>
      <div className="max-w-3xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4 border-b pb-4">
          <Link href="/citizen">
            <Button variant="ghost" size="icon" aria-label="Back to Dashboard">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-foreground">File a New Complaint</h1>
            <p className="text-xs text-muted-foreground">
              Report municipal issues for automated AI triage and department resolution.
            </p>
          </div>
        </div>

        {/* Main Form Card */}
        <Card className="shadow-md">
          <CardContent className="p-6 space-y-6">
            {submitError && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Error</AlertTitle>
                <AlertDescription>{submitError}</AlertDescription>
              </Alert>
            )}

            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Title */}
              <div className="space-y-2">
                <label htmlFor="title" className="text-sm font-semibold text-foreground">
                  Complaint Title <span className="text-destructive">*</span>
                </label>
                <Input
                  id="title"
                  placeholder="e.g. Large pothole on Main Street near Metro station"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  maxLength={200}
                  required
                />
                {errors.title && <p className="text-xs text-destructive">{errors.title}</p>}
              </div>

              {/* Category Dropdown */}
              <div className="space-y-2">
                <label htmlFor="category" className="text-sm font-semibold text-foreground">
                  Category (Optional)
                </label>
                <Select
                  id="category"
                  value={categoryId}
                  onChange={(e) => setCategoryId(e.target.value)}
                  disabled={loadingCategories}
                >
                  <option value="">Select issue category (Auto-detected if left blank)</option>
                  {categories.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.name}
                    </option>
                  ))}
                </Select>
                <p className="text-xs text-muted-foreground">
                  If omitted, our Gemini AI will analyze your description to auto-categorize.
                </p>
              </div>

              {/* Description */}
              <div className="space-y-2">
                <label htmlFor="description" className="text-sm font-semibold text-foreground">
                  Detailed Description <span className="text-destructive">*</span>
                </label>
                <Textarea
                  id="description"
                  placeholder="Describe the issue in detail (location landmarks, severity, hazards)... min 20 characters."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={4}
                  required
                />
                {errors.description && (
                  <p className="text-xs text-destructive">{errors.description}</p>
                )}
              </div>

              {/* Location Section */}
              <div className="space-y-3 p-4 rounded-lg border bg-muted/30">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 font-semibold text-sm">
                    <MapPin className="h-4 w-4 text-primary" />
                    <span>Issue Location</span>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleGetCurrentLocation}
                    disabled={gettingLocation}
                    className="text-xs"
                  >
                    {gettingLocation ? (
                      <>
                        <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                        Locating...
                      </>
                    ) : (
                      'Use My Current Location'
                    )}
                  </Button>
                </div>

                <Input
                  placeholder="Street address, landmark, or area name"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                />

                {locationSuccess && (
                  <p className="text-xs text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Coordinates captured ({latitude?.toFixed(5)}, {longitude?.toFixed(5)})
                  </p>
                )}
              </div>

              {/* Photo Evidence Upload */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-semibold text-foreground">
                    Photo Evidence (Optional)
                  </label>
                  <span className="text-xs text-primary font-medium flex items-center gap-1">
                    <Sparkles className="h-3.5 w-3.5" />
                    Photos speed up AI triage
                  </span>
                </div>

                <PhotoUpload
                  value={evidenceUrls}
                  onChange={setEvidenceUrls}
                  maxFiles={5}
                />
              </div>

              {/* Form Actions */}
              <div className="flex items-center justify-end gap-3 pt-4">
                <Link href="/citizen">
                  <Button variant="outline" type="button" disabled={isSubmitting}>
                    Cancel
                  </Button>
                </Link>
                <Button type="submit" disabled={isSubmitting} className="min-w-[140px]">
                  {isSubmitting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      Submitting...
                    </>
                  ) : (
                    'Submit Complaint'
                  )}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
