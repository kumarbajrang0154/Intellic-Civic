'use client';

import * as React from 'react';
import {
  UploadCloud,
  X,
  Image as ImageIcon,
  Loader2,
  AlertCircle,
  Camera,
  RefreshCw,
  CheckCircle2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export interface PhotoUploadProps {
  value?: string[];
  onChange?: (urls: string[]) => void;
  maxFiles?: number;
  className?: string;
}

interface UploadingFile {
  id: string;
  file: File;
  preview: string;
  progress: number;
  url?: string;
  error?: string;
}

export function PhotoUpload({
  value = [],
  onChange,
  maxFiles = 5,
  className,
}: PhotoUploadProps) {
  const [uploadingFiles, setUploadingFiles] = React.useState<UploadingFile[]>([]);
  const [error, setError] = React.useState<string | null>(null);

  // Hidden input refs
  const galleryInputRef = React.useRef<HTMLInputElement | null>(null);
  const nativeCameraInputRef = React.useRef<HTMLInputElement | null>(null);

  // Live Camera Modal State
  const [showCameraModal, setShowCameraModal] = React.useState(false);
  const [cameraFacingMode, setCameraFacingMode] = React.useState<'environment' | 'user'>('environment');
  const [cameraLoading, setCameraLoading] = React.useState(false);
  const [cameraError, setCameraError] = React.useState<string | null>(null);

  const videoRef = React.useRef<HTMLVideoElement | null>(null);
  const canvasRef = React.useRef<HTMLCanvasElement | null>(null);
  const mediaStreamRef = React.useRef<MediaStream | null>(null);

  // Stop camera stream when unmounted or closed
  const stopCameraStream = React.useCallback(() => {
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }
  }, []);

  React.useEffect(() => {
    return () => {
      stopCameraStream();
    };
  }, [stopCameraStream]);

  // Handle image files processing & upload
  const handleFileSelection = async (files: FileList | File[] | null) => {
    if (!files || files.length === 0) return;
    setError(null);

    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
    const maxSize = 10 * 1024 * 1024; // 10MB

    const fileListArray: File[] = Array.from(files);

    if (value.length + uploadingFiles.length + fileListArray.length > maxFiles) {
      setError(`Maximum ${maxFiles} photos allowed per complaint.`);
      return;
    }

    for (const file of fileListArray) {
      if (!allowedTypes.includes(file.type)) {
        setError('Only JPG, PNG, and WebP images are allowed.');
        return;
      }
      if (file.size > maxSize) {
        setError(`File "${file.name}" exceeds maximum allowed size of 10MB.`);
        return;
      }
    }

    // Process each valid file
    for (const file of fileListArray) {
      const fileId = Math.random().toString(36).substring(7);
      const preview = URL.createObjectURL(file);

      const newItem: UploadingFile = {
        id: fileId,
        file,
        preview,
        progress: 0,
      };

      setUploadingFiles((prev) => [...prev, newItem]);

      try {
        let secureUrl = '';

        // Try signature request for Cloudinary
        try {
          const sigRes = await fetch('/api/upload/signature', { method: 'POST' });
          if (sigRes.ok) {
            const sigData = await sigRes.json();
            if (sigData.cloudName && sigData.cloudName !== 'demo' && sigData.apiKey !== '1234567890') {
              const { timestamp, signature, cloudName, apiKey } = sigData;
              const formData = new FormData();
              formData.append('file', file);
              formData.append('api_key', apiKey);
              formData.append('timestamp', String(timestamp));
              formData.append('signature', signature);

              const uploadRes = await fetch(
                `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
                { method: 'POST', body: formData },
              );

              if (uploadRes.ok) {
                const uploadData = await uploadRes.json();
                secureUrl = uploadData.secure_url;
              }
            }
          }
        } catch (cloudErr) {
          // Cloudinary unavailable, proceed to data URL fallback
        }

        // Local Data URL Fallback if Cloudinary is not configured
        if (!secureUrl) {
          secureUrl = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(file);
          });
        }

        setUploadingFiles((prev) =>
          prev.map((item) =>
            item.id === fileId ? { ...item, progress: 100, url: secureUrl } : item,
          ),
        );

        if (onChange) {
          onChange([...value, secureUrl]);
        }
      } catch (err: any) {
        setUploadingFiles((prev) =>
          prev.map((item) =>
            item.id === fileId ? { ...item, error: err.message || 'Upload failed' } : item,
          ),
        );
      }
    }
  };

  // Live Camera Controls
  const startLiveCamera = async (facingMode: 'environment' | 'user' = 'environment') => {
    setShowCameraModal(true);
    setCameraLoading(true);
    setCameraError(null);
    stopCameraStream();

    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Camera access is not supported by your browser.');
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: facingMode },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      });

      mediaStreamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setCameraLoading(false);
    } catch (err: any) {
      console.error('Camera access error:', err);
      setCameraLoading(false);
      setCameraError(
        err.message || 'Could not access phone camera. Please grant camera permission.',
      );
    }
  };

  const flipCamera = () => {
    const nextFacingMode = cameraFacingMode === 'environment' ? 'user' : 'environment';
    setCameraFacingMode(nextFacingMode);
    startLiveCamera(nextFacingMode);
  };

  const capturePhotoFromCamera = () => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;

    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        const capturedFile = new File(
          [blob],
          `camera_photo_${Date.now()}.jpg`,
          { type: 'image/jpeg' },
        );

        handleFileSelection([capturedFile]);
        closeCameraModal();
      },
      'image/jpeg',
      0.9,
    );
  };

  const closeCameraModal = () => {
    stopCameraStream();
    setShowCameraModal(false);
    setCameraError(null);
  };

  const handleRemoveExisting = (indexToRemove: number) => {
    const updated = value.filter((_, idx) => idx !== indexToRemove);
    if (onChange) onChange(updated);
  };

  const handleRemoveUploading = (idToRemove: string) => {
    const target = uploadingFiles.find((f) => f.id === idToRemove);
    if (target?.preview) {
      URL.revokeObjectURL(target.preview);
    }
    const updatedUploading = uploadingFiles.filter((f) => f.id !== idToRemove);
    setUploadingFiles(updatedUploading);

    if (target?.url) {
      const updatedValue = value.filter((url) => url !== target.url);
      if (onChange) onChange(updatedValue);
    }
  };

  return (
    <div className={cn('space-y-4', className)}>
      {/* Hidden File & Camera Input Elements */}
      <input
        type="file"
        ref={galleryInputRef}
        accept="image/jpeg,image/png,image/webp"
        multiple
        className="hidden"
        onChange={(e) => handleFileSelection(e.target.files)}
      />
      <input
        type="file"
        ref={nativeCameraInputRef}
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => handleFileSelection(e.target.files)}
      />

      {/* Action Buttons: Camera Capture vs Gallery Upload */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {/* Button 1: Live Phone Camera Access */}
        <button
          type="button"
          onClick={() => {
            // Check if mobile or open in-app live camera modal
            const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
            if (isMobile && nativeCameraInputRef.current) {
              nativeCameraInputRef.current.click();
            } else {
              startLiveCamera(cameraFacingMode);
            }
          }}
          className="flex items-center justify-center gap-2 p-3.5 border-2 border-dashed border-primary/40 hover:border-primary rounded-xl bg-primary/5 hover:bg-primary/10 transition-colors group cursor-pointer text-left"
        >
          <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary group-hover:scale-110 transition-transform shrink-0">
            <Camera className="h-5 w-5" />
          </div>
          <div>
            <div className="text-xs sm:text-sm font-bold text-foreground">
              Take Photo with Camera
            </div>
            <div className="text-[11px] text-muted-foreground">
              Access phone camera live to capture evidence
            </div>
          </div>
        </button>

        {/* Button 2: Upload from Device Gallery */}
        <button
          type="button"
          onClick={() => galleryInputRef.current?.click()}
          className="flex items-center justify-center gap-2 p-3.5 border-2 border-dashed border-muted-foreground/30 hover:border-primary rounded-xl bg-muted/30 hover:bg-muted/60 transition-colors group cursor-pointer text-left"
        >
          <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center text-muted-foreground group-hover:text-primary group-hover:scale-110 transition-transform shrink-0">
            <UploadCloud className="h-5 w-5" />
          </div>
          <div>
            <div className="text-xs sm:text-sm font-bold text-foreground">
              Upload from Gallery
            </div>
            <div className="text-[11px] text-muted-foreground">
              Select JPG, PNG, or WebP images from device
            </div>
          </div>
        </button>
      </div>

      {/* Validation Error Message */}
      {error && (
        <div className="flex items-center gap-2 p-3 text-xs text-destructive bg-destructive/10 rounded-md border border-destructive/20">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Live In-App Camera View Modal */}
      {showCameraModal && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex flex-col items-center justify-center p-4">
          <div className="w-full max-w-lg bg-card border rounded-2xl overflow-hidden shadow-2xl flex flex-col">
            {/* Modal Header */}
            <div className="p-4 bg-muted/50 border-b flex items-center justify-between">
              <div className="flex items-center gap-2 font-bold text-sm">
                <Camera className="h-4 w-4 text-primary" />
                <span>Live Phone Camera Viewfinder</span>
              </div>
              <Button variant="ghost" size="icon" onClick={closeCameraModal} className="h-8 w-8">
                <X className="h-4 w-4" />
              </Button>
            </div>

            {/* Video Feed Area */}
            <div className="relative aspect-video bg-black flex items-center justify-center overflow-hidden">
              {cameraLoading && (
                <div className="flex flex-col items-center gap-2 text-white">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  <span className="text-xs">Initializing camera feed...</span>
                </div>
              )}

              {cameraError ? (
                <div className="p-6 text-center text-destructive space-y-2">
                  <AlertCircle className="h-8 w-8 mx-auto" />
                  <p className="text-xs font-semibold">{cameraError}</p>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => startLiveCamera(cameraFacingMode)}
                    className="text-xs mt-2"
                  >
                    Retry Camera
                  </Button>
                </div>
              ) : (
                <video
                  ref={videoRef}
                  playsInline
                  muted
                  className="w-full h-full object-cover"
                />
              )}

              {/* Hidden Canvas for Capture */}
              <canvas ref={canvasRef} className="hidden" />
            </div>

            {/* Modal Footer Controls */}
            {!cameraError && (
              <div className="p-4 bg-muted/30 border-t flex items-center justify-between gap-3">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={flipCamera}
                  className="text-xs gap-1.5"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  Flip Camera
                </Button>

                <Button
                  type="button"
                  onClick={capturePhotoFromCamera}
                  disabled={cameraLoading}
                  className="gap-2 font-bold text-xs bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg"
                >
                  <Camera className="h-4 w-4" />
                  Capture Photo
                </Button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Photo Previews Grid */}
      {(value.length > 0 || uploadingFiles.length > 0) && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 pt-2">
          {/* Existing uploaded URLs */}
          {value.map((url, idx) => (
            <div
              key={`val-${idx}`}
              className="relative group aspect-square rounded-lg border bg-muted overflow-hidden shadow-sm"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={url}
                alt={`Evidence ${idx + 1}`}
                className="w-full h-full object-cover"
              />
              <button
                type="button"
                onClick={() => handleRemoveExisting(idx)}
                aria-label="Remove photo"
                className="absolute top-1.5 right-1.5 p-1 rounded-full bg-black/60 text-white hover:bg-destructive transition-colors opacity-90 group-hover:opacity-100"
              >
                <X className="h-4 w-4" />
              </button>
              <div className="absolute bottom-1 left-1 bg-black/60 text-white text-[10px] px-1.5 py-0.5 rounded font-mono">
                Photo #{idx + 1}
              </div>
            </div>
          ))}

          {/* Currently uploading files */}
          {uploadingFiles.map((item) => (
            <div
              key={item.id}
              className="relative aspect-square rounded-lg border bg-muted overflow-hidden shadow-sm flex flex-col items-center justify-center"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={item.preview}
                alt="Uploading preview"
                className={cn('w-full h-full object-cover', {
                  'opacity-40': item.progress < 100 || item.error,
                })}
              />

              {item.progress < 100 && !item.error && (
                <div className="absolute inset-0 bg-black/40 flex flex-col items-center justify-center p-2 text-white">
                  <Loader2 className="h-6 w-6 animate-spin mb-1" />
                  <span className="text-xs font-semibold">Uploading...</span>
                </div>
              )}

              {item.error && (
                <div className="absolute inset-0 bg-destructive/80 flex flex-col items-center justify-center p-2 text-white text-center">
                  <AlertCircle className="h-5 w-5 mb-1" />
                  <span className="text-[10px] font-medium leading-tight">
                    {item.error}
                  </span>
                </div>
              )}

              <button
                type="button"
                onClick={() => handleRemoveUploading(item.id)}
                aria-label="Remove photo"
                className="absolute top-1.5 right-1.5 p-1 rounded-full bg-black/60 text-white hover:bg-destructive transition-colors opacity-90"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
