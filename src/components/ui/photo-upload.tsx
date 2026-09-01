'use client';

import * as React from 'react';
import { UploadCloud, X, Image as ImageIcon, Loader2, AlertCircle } from 'lucide-react';
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

  const handleFileSelection = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setError(null);

    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
    const maxSize = 10 * 1024 * 1024; // 10MB

    const newFiles: File[] = Array.from(files);

    if (value.length + uploadingFiles.length + newFiles.length > maxFiles) {
      setError(`Maximum ${maxFiles} photos allowed per complaint.`);
      return;
    }

    for (const file of newFiles) {
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
    for (const file of newFiles) {
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
        // Fetch upload signature from BFF
        const sigRes = await fetch('/api/upload/signature', { method: 'POST' });
        const sigData = await sigRes.json();

        if (!sigRes.ok) {
          throw new Error(sigData.message || 'Signature request failed');
        }

        const { timestamp, signature, cloudName, apiKey } = sigData;

        // Construct Cloudinary upload FormData
        const formData = new FormData();
        formData.append('file', file);
        formData.append('api_key', apiKey);
        formData.append('timestamp', String(timestamp));
        formData.append('signature', signature);

        const uploadRes = await fetch(
          `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
          {
            method: 'POST',
            body: formData,
          },
        );

        const uploadData = await uploadRes.json();

        if (!uploadRes.ok) {
          throw new Error(uploadData.error?.message || 'Cloudinary upload failed');
        }

        const secureUrl = uploadData.secure_url;

        setUploadingFiles((prev) =>
          prev.map((item) =>
            item.id === fileId
              ? { ...item, progress: 100, url: secureUrl }
              : item,
          ),
        );

        if (onChange) {
          onChange([...value, secureUrl]);
        }
      } catch (err: any) {
        setUploadingFiles((prev) =>
          prev.map((item) =>
            item.id === fileId
              ? { ...item, error: err.message || 'Upload failed' }
              : item,
          ),
        );
      }
    }
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

    // Update parent if it had completed url
    if (target?.url) {
      const updatedValue = value.filter((url) => url !== target.url);
      if (onChange) onChange(updatedValue);
    }
  };

  return (
    <div className={cn('space-y-4', className)}>
      {/* Drop / Select Area */}
      <label className="relative flex flex-col items-center justify-center w-full h-36 border-2 border-dashed border-primary/30 hover:border-primary rounded-xl cursor-pointer bg-primary/5 hover:bg-primary/10 transition-colors p-4 text-center">
        <div className="flex flex-col items-center justify-center space-y-2">
          <UploadCloud className="h-8 w-8 text-primary" />
          <div className="text-sm font-medium text-foreground">
            <span className="text-primary font-semibold">Click to upload</span> or drag and drop photos
          </div>
          <p className="text-xs text-muted-foreground">
            JPG, PNG, or WebP (max 10MB per photo)
          </p>
        </div>
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          className="hidden"
          onChange={(e) => handleFileSelection(e.target.files)}
        />
      </label>

      {/* Validation Error Message */}
      {error && (
        <div className="flex items-center gap-2 p-3 text-xs text-destructive bg-destructive/10 rounded-md border border-destructive/20">
          <AlertCircle className="h-4 w-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Photo Previews Grid */}
      {(value.length > 0 || uploadingFiles.length > 0) && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
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
