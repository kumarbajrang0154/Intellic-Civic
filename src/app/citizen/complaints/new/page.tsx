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
  Sparkles,
  Mic,
  MicOff,
  Navigation,
  Wand2,
  Volume2,
  Copy,
  ExternalLink,
  ShieldAlert,
  ArrowRight,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { PhotoUpload } from '@/components/ui/photo-upload';
import { AppShell } from '@/components/layout/app-shell';
import { toast } from 'sonner';

interface Category {
  id: string;
  name: string;
  description?: string;
}

interface PotentialDuplicate {
  id: string;
  ticketId: string;
  title: string;
  description: string;
  address?: string;
  similarityScore: number;
  createdAt: string;
}

export default function NewComplaintPage() {
  const router = useRouter();

  const [user, setUser] = React.useState<{ name: string; role: 'CITIZEN' }>({
    name: 'Citizen',
    role: 'CITIZEN',
  });

  const [categories, setCategories] = React.useState<Category[]>([]);
  const [loadingCategories, setLoadingCategories] = React.useState(true);

  // Form state
  const [title, setTitle] = React.useState('');
  const [description, setDescription] = React.useState('');
  const [categoryId, setCategoryId] = React.useState('');
  const [address, setAddress] = React.useState('');
  const [latitude, setLatitude] = React.useState<number | null>(null);
  const [longitude, setLongitude] = React.useState<number | null>(null);
  const [evidenceUrls, setEvidenceUrls] = React.useState<string[]>([]);

  // Geolocation & Landmark state
  const [gettingLocation, setGettingLocation] = React.useState(false);
  const [fetchingLandmark, setFetchingLandmark] = React.useState(false);
  const [locationSuccess, setLocationSuccess] = React.useState(false);

  // Voice Assistant state
  const [speechSupported, setSpeechSupported] = React.useState(false);
  const [listeningTarget, setListeningTarget] = React.useState<'title' | 'description' | 'address' | 'full' | null>(null);
  const [transcriptPreview, setTranscriptPreview] = React.useState('');
  const [usedVoiceInput, setUsedVoiceInput] = React.useState(false);
  const recognitionRef = React.useRef<any>(null);

  // Duplicate Check State
  const [duplicateWarning, setDuplicateWarning] = React.useState<PotentialDuplicate[] | null>(null);
  const [checkingDuplicates, setCheckingDuplicates] = React.useState(false);
  const [bypassDuplicateCheck, setBypassDuplicateCheck] = React.useState(false);

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

    if (typeof window !== 'undefined') {
      const SpeechRecognition =
        (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        setSpeechSupported(true);
      }
    }
  }, []);

  // ---------------------------------------------------------------------------
  // REVERSE GEOCODING (Auto-fetch Landmark Address from GPS)
  // ---------------------------------------------------------------------------
  const reverseGeocode = async (lat: number, lng: number) => {
    setFetchingLandmark(true);
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}`,
        { headers: { 'Accept-Language': 'en' } },
      );
      if (res.ok) {
        const data = await res.json();
        const displayAddr = data.display_name;
        if (displayAddr) {
          setAddress(displayAddr);
          toast.success('Landmark address auto-fetched from GPS location!');
        }
      }
    } catch (err) {
      console.warn('Failed to reverse geocode location', err);
    } finally {
      setFetchingLandmark(false);
    }
  };

  const handleGetCurrentLocation = () => {
    if (!navigator.geolocation) {
      setSubmitError('Geolocation is not supported by your browser.');
      return;
    }

    setGettingLocation(true);
    setLocationSuccess(false);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        setLatitude(lat);
        setLongitude(lng);
        setGettingLocation(false);
        setLocationSuccess(true);
        toast.success('GPS coordinates captured!');

        reverseGeocode(lat, lng);
      },
      (error) => {
        setGettingLocation(false);
        setSubmitError('Unable to retrieve your location. You can enter an address manually.');
      },
    );
  };

  // ---------------------------------------------------------------------------
  // VOICE ASSISTANT & SPEECH-TO-TEXT DICTATION
  // ---------------------------------------------------------------------------
  const startListening = (target: 'title' | 'description' | 'address' | 'full') => {
    if (listeningTarget === target) {
      stopListening();
      return;
    }

    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      toast.error('Voice dictation is not supported on this browser. Try Chrome or Edge.');
      return;
    }

    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch (e) {}
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = target === 'full' || target === 'description';
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onstart = () => {
      setListeningTarget(target);
      setUsedVoiceInput(true);
      setTranscriptPreview('');
      toast.info(
        target === 'full'
          ? '🎙️ Smart Voice Assistant listening... Describe your issue naturally.'
          : `🎙️ Voice dictation active... Speak into microphone.`,
      );
    };

    recognition.onresult = (event: any) => {
      let currentTranscript = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        currentTranscript += event.results[i][0].transcript;
      }
      setTranscriptPreview(currentTranscript);

      if (target === 'title') {
        setTitle(currentTranscript);
      } else if (target === 'description') {
        setDescription(currentTranscript);
      } else if (target === 'address') {
        setAddress(currentTranscript);
      } else if (target === 'full') {
        if (!title || title.length < 5) {
          const firstSentence = currentTranscript.split('.')[0] || currentTranscript;
          setTitle(firstSentence.slice(0, 100));
        }
        setDescription(currentTranscript);
      }
    };

    recognition.onerror = (event: any) => {
      console.error('Speech recognition error', event.error);
      toast.error('Voice dictation error: ' + event.error);
      stopListening();
    };

    recognition.onend = () => {
      setListeningTarget(null);
    };

    recognitionRef.current = recognition;
    recognition.start();
  };

  const stopListening = () => {
    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch (e) {}
      recognitionRef.current = null;
    }
    setListeningTarget(null);
    toast.success('Voice dictation stopped.');
  };

  // ---------------------------------------------------------------------------
  // FORM VALIDATION & SUBMISSION
  // ---------------------------------------------------------------------------
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

  const executeFinalSubmit = async () => {
    setIsSubmitting(true);
    setSubmitError(null);
    setEvidenceWarning(null);

    try {
      const complaintPayload: any = {
        title: title.trim(),
        description: description.trim(),
        isVoiceInput: usedVoiceInput || transcriptPreview !== '',
        voiceTranscript: transcriptPreview || undefined,
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

      // Attach evidence photos if uploaded
      if (evidenceUrls.length > 0) {
        let uploadFailedCount = 0;

        for (const imageUrl of evidenceUrls) {
          try {
            const evRes = await fetch(`/api/complaints/${complaintId}/evidence`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ imageUrl, stage: 'BEFORE' }),
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    // Check for duplicates first unless bypassed
    if (!bypassDuplicateCheck) {
      setCheckingDuplicates(true);
      setSubmitError(null);
      try {
        const dupRes = await fetch('/api/complaints/check-duplicate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: title.trim(),
            description: description.trim(),
            latitude,
            longitude,
          }),
        });

        if (dupRes.ok) {
          const dupData = await dupRes.json();
          if (dupData.matched && dupData.potentialDuplicates?.length > 0) {
            setDuplicateWarning(dupData.potentialDuplicates);
            setCheckingDuplicates(false);
            return; // Show warning UI to user
          }
        }
      } catch (err) {
        console.warn('Duplicate check failed, proceeding to submit', err);
      } finally {
        setCheckingDuplicates(false);
      }
    }

    await executeFinalSubmit();
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
              Report municipal issues via text typing or Voice Assistant for automated AI triage.
            </p>
          </div>
        </div>

        {/* BATCH B — Duplicate Complaint Warning Modal Card */}
        {duplicateWarning && duplicateWarning.length > 0 && (
          <Card className="border-2 border-amber-500/60 bg-amber-500/10 shadow-lg">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2 text-amber-800 dark:text-amber-300">
                <ShieldAlert className="h-5 w-5 text-amber-600 shrink-0" />
                <CardTitle className="text-base font-bold">
                  Similar Complaint Already Reported Nearby
                </CardTitle>
              </div>
              <CardDescription className="text-xs text-amber-900/80 dark:text-amber-200">
                Our system detected potential duplicate complaints matching your issue and location:
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {duplicateWarning.map((dup) => (
                <div
                  key={dup.id}
                  className="p-3 bg-background border rounded-lg flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs"
                >
                  <div className="space-y-1 min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-primary">{dup.ticketId}</span>
                      <span className="bg-amber-100 text-amber-800 text-[10px] font-bold px-2 py-0.5 rounded-full border border-amber-200">
                        {Math.round(dup.similarityScore * 100)}% Match
                      </span>
                    </div>
                    <div className="font-semibold text-foreground truncate">{dup.title}</div>
                    {dup.address && <div className="text-muted-foreground truncate">{dup.address}</div>}
                  </div>
                  <Link href={`/citizen/complaints/${dup.id}`} target="_blank">
                    <Button variant="outline" size="sm" className="text-xs gap-1 shrink-0">
                      View Ticket <ExternalLink className="h-3 w-3" />
                    </Button>
                  </Link>
                </div>
              ))}

              <div className="pt-2 flex flex-col sm:flex-row items-center justify-end gap-3 border-t border-amber-500/20">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setDuplicateWarning(null)}
                  className="w-full sm:w-auto text-xs"
                >
                  Edit My Complaint
                </Button>
                <Button
                  type="button"
                  size="sm"
                  onClick={() => {
                    setBypassDuplicateCheck(true);
                    setDuplicateWarning(null);
                    executeFinalSubmit();
                  }}
                  className="w-full sm:w-auto text-xs bg-amber-600 hover:bg-amber-700 text-white font-semibold gap-1.5"
                >
                  This is Different, Submit Anyway <ArrowRight className="h-3.5 w-3.5" />
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Smart Voice Assistant Banner Card */}
        {speechSupported && (
          <div className="p-4 rounded-xl border border-primary/30 bg-gradient-to-r from-primary/10 via-primary/5 to-background shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="h-10 w-10 rounded-full bg-primary/20 flex items-center justify-center text-primary shrink-0 mt-0.5">
                <Wand2 className="h-5 w-5" />
              </div>
              <div>
                <div className="font-semibold text-sm flex items-center gap-2">
                  <span>Smart AI Voice Assistant</span>
                  <span className="text-[10px] px-2 py-0.5 bg-primary/20 text-primary font-bold rounded-full uppercase">
                    Voice Dictation
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Click the mic to dictate your whole complaint by speaking naturally. Our AI fills out title and description automatically.
                </p>
              </div>
            </div>

            <Button
              type="button"
              variant={listeningTarget === 'full' ? 'destructive' : 'default'}
              size="sm"
              onClick={() => startListening('full')}
              className="shrink-0 gap-2 font-semibold shadow-md w-full sm:w-auto"
            >
              {listeningTarget === 'full' ? (
                <>
                  <span className="relative flex h-2.5 w-2.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-white"></span>
                  </span>
                  Listening... Stop
                </>
              ) : (
                <>
                  <Mic className="h-4 w-4" />
                  Speak Full Complaint
                </>
              )}
            </Button>
          </div>
        )}

        {/* Live Speech Dictation Transcript Box */}
        {listeningTarget && transcriptPreview && (
          <div className="p-3 bg-primary/10 border border-primary/30 rounded-lg text-xs flex items-start gap-2">
            <Volume2 className="h-4 w-4 text-primary shrink-0 mt-0.5 animate-pulse" />
            <div>
              <span className="font-bold text-primary block">Live Speech Transcript:</span>
              <span className="italic text-foreground">{transcriptPreview}</span>
            </div>
          </div>
        )}

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
              {/* Title with Voice Dictation */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label htmlFor="title" className="text-sm font-semibold text-foreground">
                    Complaint Title <span className="text-destructive">*</span>
                  </label>

                  {speechSupported && (
                    <Button
                      type="button"
                      variant={listeningTarget === 'title' ? 'destructive' : 'ghost'}
                      size="sm"
                      onClick={() => startListening('title')}
                      className="h-7 text-xs px-2 gap-1 text-primary hover:text-primary"
                    >
                      {listeningTarget === 'title' ? (
                        <>
                          <MicOff className="h-3.5 w-3.5" />
                          <span>Stop</span>
                        </>
                      ) : (
                        <>
                          <Mic className="h-3.5 w-3.5" />
                          <span>Dictate Title</span>
                        </>
                      )}
                    </Button>
                  )}
                </div>

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

              {/* Description with Voice Dictation */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label htmlFor="description" className="text-sm font-semibold text-foreground">
                    Detailed Description <span className="text-destructive">*</span>
                  </label>

                  {speechSupported && (
                    <Button
                      type="button"
                      variant={listeningTarget === 'description' ? 'destructive' : 'ghost'}
                      size="sm"
                      onClick={() => startListening('description')}
                      className="h-7 text-xs px-2 gap-1 text-primary hover:text-primary"
                    >
                      {listeningTarget === 'description' ? (
                        <>
                          <MicOff className="h-3.5 w-3.5" />
                          <span>Stop</span>
                        </>
                      ) : (
                        <>
                          <Mic className="h-3.5 w-3.5" />
                          <span>Dictate Description</span>
                        </>
                      )}
                    </Button>
                  )}
                </div>

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

              {/* Location Section with Auto-Fetch Landmark & GPS */}
              <div className="space-y-3 p-4 rounded-lg border bg-muted/30">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2 font-semibold text-sm">
                    <MapPin className="h-4 w-4 text-primary shrink-0" />
                    <span>Issue Location / Landmark</span>
                  </div>

                  <div className="flex items-center gap-2">
                    {speechSupported && (
                      <Button
                        type="button"
                        variant={listeningTarget === 'address' ? 'destructive' : 'outline'}
                        size="sm"
                        onClick={() => startListening('address')}
                        className="text-xs gap-1 h-8"
                      >
                        <Mic className="h-3.5 w-3.5" />
                        <span>Dictate Landmark</span>
                      </Button>
                    )}

                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleGetCurrentLocation}
                      disabled={gettingLocation || fetchingLandmark}
                      className="text-xs gap-1.5 h-8"
                    >
                      {gettingLocation || fetchingLandmark ? (
                        <>
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          <span>Auto-Fetching Landmark...</span>
                        </>
                      ) : (
                        <>
                          <Navigation className="h-3.5 w-3.5 text-primary" />
                          <span>Use My Location & Fetch Landmark</span>
                        </>
                      )}
                    </Button>
                  </div>
                </div>

                <Input
                  placeholder="Street address, landmark, or area name (Auto-fetched from GPS or type manually)"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                />

                {locationSuccess && (
                  <p className="text-xs text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    GPS Coordinates captured ({latitude?.toFixed(5)}, {longitude?.toFixed(5)})
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
                  <Button variant="outline" type="button" disabled={isSubmitting || checkingDuplicates}>
                    Cancel
                  </Button>
                </Link>
                <Button type="submit" disabled={isSubmitting || checkingDuplicates} className="min-w-[140px]">
                  {checkingDuplicates ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      Checking Duplicates...
                    </>
                  ) : isSubmitting ? (
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
