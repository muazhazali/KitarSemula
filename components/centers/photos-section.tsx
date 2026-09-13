'use client';

import { useCallback, useRef, useState } from 'react';
import Image from 'next/image';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { CameraIcon, LoaderIcon, UploadIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { MAX_PHOTOS_PER_CENTER, MAX_PHOTO_BYTES } from '@/lib/types';
import type { CenterPhoto } from '@/lib/types';
import { turnstileSiteKey, TURNSTILE_ACTION_PHOTO_UPLOAD } from '@/lib/env';
import { TurnstileWidget, TURNSTILE_RESPONSE_FIELD } from './turnstile-widget';

interface PhotosSectionProps {
  slug: string;
  centerName: string;
}

interface PhotosResponse {
  photos: CenterPhoto[];
  max: number;
}

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

async function fetchPhotos(slug: string): Promise<PhotosResponse> {
  const res = await fetch(`/api/centers/${slug}/photos`);
  if (!res.ok) return { photos: [], max: MAX_PHOTOS_PER_CENTER };
  return res.json();
}

export function PhotosSection({ slug, centerName }: PhotosSectionProps) {
  const queryClient = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [widgetKey, setWidgetKey] = useState(0);
  const turnstileRequired = Boolean(turnstileSiteKey());

  const { data, isLoading } = useQuery({
    queryKey: ['photos', slug],
    queryFn: () => fetchPhotos(slug),
  });

  const photos = data?.photos ?? [];
  const max = data?.max ?? MAX_PHOTOS_PER_CENTER;
  const remaining = Math.max(0, max - photos.length);

  const handleToken = useCallback((token: string | null) => {
    setTurnstileToken(token);
  }, []);

  const handleFile = async (file: File | undefined) => {
    if (!file) return;

    if (!ALLOWED_TYPES.includes(file.type)) {
      toast.error('Only JPEG, PNG, or WebP images are allowed.');
      return;
    }
    if (file.size > MAX_PHOTO_BYTES) {
      toast.error('Image must be 1 MB or smaller.');
      return;
    }
    if (turnstileRequired && !turnstileToken) {
      toast.error('Please complete the human verification first.');
      return;
    }

    setUploading(true);
    try {
      const body = new FormData();
      body.append('file', file);
      if (turnstileToken) body.append(TURNSTILE_RESPONSE_FIELD, turnstileToken);
      const res = await fetch(`/api/centers/${slug}/photos`, { method: 'POST', body });
      const payload = (await res.json()) as { error?: string };
      if (!res.ok) {
        toast.error(payload.error ?? 'Upload failed. Please try again.');
        return;
      }
      toast.success('Photo uploaded.');
      await queryClient.invalidateQueries({ queryKey: ['photos', slug] });
    } catch {
      toast.error('Could not upload photo. Please try again.');
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
      setTurnstileToken(null);
      setWidgetKey((k) => k + 1);
    }
  };

  return (
    <section aria-labelledby="photos-heading">
      <div className="mb-3 flex items-center justify-between">
        <h2 id="photos-heading" className="text-foreground text-base font-semibold">
          Photos
          {photos.length > 0 && (
            <span className="text-muted-foreground ml-1.5 text-sm font-normal">
              ({photos.length}/{max})
            </span>
          )}
        </h2>

        <input
          ref={inputRef}
          type="file"
          accept={ALLOWED_TYPES.join(',')}
          className="hidden"
          onChange={(e) => handleFile(e.target.files?.[0])}
        />
        {remaining > 0 && (
          <TurnstileWidget
            key={widgetKey}
            action={TURNSTILE_ACTION_PHOTO_UPLOAD}
            onToken={handleToken}
          />
        )}
        <Button
          variant="outline"
          size="sm"
          onClick={() => inputRef.current?.click()}
          disabled={uploading || remaining === 0}
          className="gap-1.5"
          aria-label={
            remaining === 0
              ? `Maximum ${max} photos reached for ${centerName}`
              : `Upload a photo for ${centerName}`
          }
        >
          {uploading ? (
            <LoaderIcon className="size-4 animate-spin" aria-hidden="true" />
          ) : (
            <UploadIcon className="size-4" data-icon="inline-start" aria-hidden="true" />
          )}
          {remaining === 0 ? 'Limit reached' : `Upload (${remaining} left)`}
        </Button>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="bg-muted aspect-video animate-pulse rounded-lg border" />
          ))}
        </div>
      ) : photos.length > 0 ? (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {photos.map((photo) => (
            <div key={photo.id} className="relative aspect-video overflow-hidden rounded-lg border">
              <Image
                src={photo.url}
                alt={`Photo of ${centerName}`}
                fill
                unoptimized
                className="object-cover"
              />
            </div>
          ))}
        </div>
      ) : (
        <div className="border-border flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed py-10 text-center">
          <CameraIcon className="text-muted-foreground size-8" aria-hidden="true" />
          <p className="text-muted-foreground text-sm">
            No photos yet. Be the first to upload one.
          </p>
        </div>
      )}
    </section>
  );
}
