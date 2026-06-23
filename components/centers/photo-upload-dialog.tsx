'use client';

import { useState, useRef, useCallback } from 'react';
import { CameraIcon, XIcon, LoaderIcon, UploadCloudIcon } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import Image from 'next/image';

interface PhotoUploadDialogProps {
  centerName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_SIZE_MB = 5;

export function PhotoUploadDialog({ centerName, open, onOpenChange }: PhotoUploadDialogProps) {
  const [preview, setPreview] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback((file: File) => {
    if (!ACCEPTED_TYPES.includes(file.type)) {
      toast.error('Please upload a JPG, PNG, or WebP image.');
      return;
    }
    if (file.size > MAX_SIZE_MB * 1024 * 1024) {
      toast.error(`File must be smaller than ${MAX_SIZE_MB}MB.`);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreview(url);
    setFileName(file.name);
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  };

  const clearPreview = () => {
    if (preview) URL.revokeObjectURL(preview);
    setPreview(null);
    setFileName(null);
    if (inputRef.current) inputRef.current.value = '';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!preview || !email) return;

    setSubmitting(true);
    // Simulate R2 upload delay (swap for real upload on Cloudflare)
    await new Promise((r) => setTimeout(r, 900));
    setSubmitting(false);
    toast.success('Photo submitted for review. Thank you!');
    clearPreview();
    setEmail('');
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CameraIcon className="text-primary size-4" aria-hidden="true" />
            Upload a Photo
          </DialogTitle>
          <DialogDescription>
            Share a photo of <strong>{centerName}</strong> to help others find it. Photos are
            reviewed before publishing.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {/* Drop zone / preview */}
          {preview ? (
            <div className="relative aspect-video overflow-hidden rounded-lg border">
              <Image src={preview} alt="Preview of selected photo" fill className="object-cover" />
              <button
                type="button"
                onClick={clearPreview}
                className="bg-background/90 border-border hover:bg-background absolute top-2 right-2 flex size-7 items-center justify-center rounded-full border"
                aria-label="Remove selected photo"
              >
                <XIcon className="size-4" aria-hidden="true" />
              </button>
              {fileName && (
                <div className="bg-background/80 absolute right-0 bottom-0 left-0 px-3 py-1">
                  <span className="text-muted-foreground block truncate text-xs">{fileName}</span>
                </div>
              )}
            </div>
          ) : (
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={handleDrop}
              onClick={() => inputRef.current?.click()}
              className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed py-10 transition-colors ${
                dragging
                  ? 'border-primary bg-primary/5'
                  : 'border-border hover:border-primary/50 hover:bg-muted/40'
              }`}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter') inputRef.current?.click();
              }}
              aria-label="Click or drag to upload a photo"
            >
              <UploadCloudIcon className="text-muted-foreground size-8" aria-hidden="true" />
              <p className="text-foreground text-sm font-medium">
                Click to upload or drag &amp; drop
              </p>
              <p className="text-muted-foreground text-xs">JPG, PNG, WebP — max 5MB</p>
              <input
                ref={inputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={handleInputChange}
                className="sr-only"
                aria-label="Upload photo file"
              />
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <label htmlFor="photo-email" className="text-sm font-medium">
              Your Email <span className="text-destructive">*</span>
            </label>
            <Input
              id="photo-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
            />
          </div>

          {/* Turnstile placeholder */}
          <div className="border-border text-muted-foreground flex items-center justify-center rounded-md border border-dashed py-3 text-xs">
            Cloudflare Turnstile verification (enabled on deployment)
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting || !preview || !email}>
              {submitting ? (
                <LoaderIcon className="mr-2 size-4 animate-spin" aria-hidden="true" />
              ) : (
                <UploadCloudIcon className="mr-2 size-4" aria-hidden="true" />
              )}
              Upload Photo
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
