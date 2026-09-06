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
import { AppShell } from '@/components/shared/app-shell';
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

  // Reverse Geocoding (Auto-fetch Landmark Address from GPS)
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

  // Voice Assistant & Speech-to-Text Dictation
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

  // Form Validation & Submission
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
            return;
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
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
        <Card className="w-full max-w-lg shadow-md border border-slate-200 bg-white rounded-xl text-center">
          <CardHeader className="space-y-2">
            <div className="mx-auto h-16 w-16 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mb-2">
              <CheckCircle2 className="h-10 w-10" />
            </div>
            <CardTitle className="text-2xl font-bold text-slate-900">Complaint Submitted Successfully!</CardTitle>
            <CardDescription className="text-xs text-slate-500">
              Your ticket has been logged in the system and is queued for automated AI triage.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 inline-block w-full">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                Ticket Reference ID
              </span>
              <span className="text-2xl font-extrabold text-ic-blue font-mono">
                #{createdTicketId}
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
                <Button className="w-full bg-ic-blue hover:bg-blue-700 text-white font-medium">Track This Complaint</Button>
              </Link>
              <Link href="/citizen" className="w-full">
                <Button variant="outline" className="w-full border-slate-200">
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
      <div className="max-w-3xl mx-auto space-y-6 p-6">
        {/* Header */}
        <div className="flex items-center gap-4 border-b border-slate-200 pb-4">
          <Link href="/citizen">
            <Button variant="ghost" size="icon" aria-label="Back to Dashboard" className="text-slate-600">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">File a New Complaint</h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Report municipal issues via text typing or Voice Assistant for automated AI triage.
            </p>
          </div>
        </div>

        {/* Duplicate Complaint Warning Modal Card */}
        {duplicateWarning && duplicateWarning.length > 0 && (
          <Card className="border border-amber-300 bg-amber-50/60 shadow-xs rounded-xl">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2 text-amber-900">
                <ShieldAlert className="h-5 w-5 text-amber-600 shrink-0" />
                <CardTitle className="text-base font-bold">
                  Similar Complaint Already Reported Nearby
                </CardTitle>
              </div>
              <CardDescription className="text-xs text-amber-800">
                Our system detected potential duplicate complaints matching your issue and location:
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {duplicateWarning.map((dup) => (
                <div
                  key={dup.id}
                  className="p-3 bg-white border border-amber-200 rounded-lg flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs"
                >
                  <div className="space-y-1 min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-ic-blue">#{dup.ticketId}</span>
                      <span className="bg-amber-100 text-amber-800 text-[10px] font-bold px-2 py-0.5 rounded-full border border-amber-200">
                        {Math.round(dup.similarityScore * 100)}% Match
                      </span>
                    </div>
                    <div className="font-semibold text-slate-900 truncate">{dup.title}</div>
                    {dup.address && <div className="text-slate-500 truncate">{dup.address}</div>}
                  </div>
                  <Link href={`/citizen/complaints/${dup.id}`} target="_blank">
                    <Button variant="outline" size="sm" className="text-xs gap-1 shrink-0 border-slate-200">
                      View Ticket <ExternalLink className="h-3 w-3" />
                    </Button>
                  </Link>
                </div>
              ))}

              <div className="pt-2 flex flex-col sm:flex-row items-center justify-end gap-3 border-t border-amber-200">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setDuplicateWarning(null)}
                  className="w-full sm:w-auto text-xs border-slate-200"
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
          <div className="p-4 rounded-xl border border-slate-200 bg-white shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-l-4 border-l-indigo-600">
            <div className="flex items-start gap-3">
              <div className="h-10 w-10 rounded-lg bg-indigo-100 flex items-center justify-center text-ai-indigo shrink-0 mt-0.5">
                <Wand2 className="h-5 w-5" />
              </div>
              <div>
                <div className="font-bold text-sm text-slate-900 flex items-center gap-2">
                  <span>Smart AI Voice Assistant</span>
                  <span className="text-[10px] px-2 py-0.5 bg-indigo-100 text-ai-indigo font-bold rounded-full uppercase">
                    Voice Dictation
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  Click the mic to dictate your whole complaint by speaking naturally. Our AI fills out title and description automatically.
                </p>
              </div>
            </div>

            <Button
              type="button"
              variant={listeningTarget === 'full' ? 'destructive' : 'ai'}
              size="sm"
              onClick={() => startListening('full')}
              className="shrink-0 gap-2 font-semibold shadow-xs w-full sm:w-auto text-xs"
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
          <div className="p-3 bg-indigo-50 border border-indigo-200 rounded-lg text-xs flex items-start gap-2">
            <Volume2 className="h-4 w-4 text-ai-indigo shrink-0 mt-0.5 animate-pulse" />
            <div>
              <span className="font-bold text-ai-indigo block">Live Speech Transcript:</span>
              <span className="italic text-slate-700">{transcriptPreview}</span>
            </div>
          </div>
        )}

        {/* Main Form Card */}
        <Card className="shadow-xs border border-slate-200 bg-white rounded-xl">
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
                  <label htmlFor="title" className="text-xs font-bold text-slate-700 uppercase tracking-wide">
                    Complaint Title <span className="text-rose-500">*</span>
                  </label>

                  {speechSupported && (
                    <Button
                      type="button"
                      variant={listeningTarget === 'title' ? 'destructive' : 'ghost'}
                      size="sm"
                      onClick={() => startListening('title')}
                      className="h-7 text-xs px-2 gap-1 text-ai-indigo hover:text-indigo-700"
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
                {errors.title && <p className="text-xs text-rose-600">{errors.title}</p>}
              </div>

              {/* Category Dropdown */}
              <div className="space-y-2">
                <label htmlFor="category" className="text-xs font-bold text-slate-700 uppercase tracking-wide">
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
                <p className="text-xs text-slate-400">
                  If omitted, our Gemini AI will analyze your description to auto-categorize.
                </p>
              </div>

              {/* Description with Voice Dictation */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label htmlFor="description" className="text-xs font-bold text-slate-700 uppercase tracking-wide">
                    Detailed Description <span className="text-rose-500">*</span>
                  </label>

                  {speechSupported && (
                    <Button
                      type="button"
                      variant={listeningTarget === 'description' ? 'destructive' : 'ghost'}
                      size="sm"
                      onClick={() => startListening('description')}
                      className="h-7 text-xs px-2 gap-1 text-ai-indigo hover:text-indigo-700"
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
                  <p className="text-xs text-rose-600">{errors.description}</p>
                )}
              </div>

              {/* Location Section with Auto-Fetch Landmark & GPS */}
              <div className="space-y-3 p-4 rounded-xl border border-slate-200 bg-slate-50/50">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2 font-bold text-xs text-slate-800 uppercase tracking-wide">
                    <MapPin className="h-4 w-4 text-ic-blue shrink-0" />
                    <span>Issue Location / Landmark</span>
                  </div>

                  <div className="flex items-center gap-2">
                    {speechSupported && (
                      <Button
                        type="button"
                        variant={listeningTarget === 'address' ? 'destructive' : 'outline'}
                        size="sm"
                        onClick={() => startListening('address')}
                        className="text-xs gap-1 h-8 border-slate-200"
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
                      className="text-xs gap-1.5 h-8 border-slate-200 text-ic-blue"
                    >
                      {gettingLocation || fetchingLandmark ? (
                        <>
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          <span>Auto-Fetching Landmark...</span>
                        </>
                      ) : (
                        <>
                          <Navigation className="h-3.5 w-3.5 text-ic-blue" />
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
                  <p className="text-xs text-emerald-600 font-semibold flex items-center gap-1">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    GPS Coordinates captured ({latitude?.toFixed(5)}, {longitude?.toFixed(5)})
                  </p>
                )}
              </div>

              {/* Photo Evidence Upload */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wide">
                    Photo Evidence (Optional)
                  </label>
                  <span className="text-xs text-ai-indigo font-semibold flex items-center gap-1">
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
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                <Link href="/citizen">
                  <Button variant="outline" type="button" disabled={isSubmitting || checkingDuplicates} className="border-slate-200">
                    Cancel
                  </Button>
                </Link>
                <Button type="submit" disabled={isSubmitting || checkingDuplicates} className="min-w-[140px] bg-ic-blue hover:bg-blue-700 text-white font-medium">
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

