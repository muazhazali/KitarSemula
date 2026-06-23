'use client';

import { useState } from 'react';
import { PlusIcon, LoaderIcon } from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { MALAYSIA_STATES, RECYCLABLE_CATEGORIES } from '@/lib/types';
import { toast } from 'sonner';

interface AddCenterSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AddCenterSheet({ open, onOpenChange }: AddCenterSheetProps) {
  const [submitting, setSubmitting] = useState(false);
  const [selectedItems, setSelectedItems] = useState<string[]>([]);

  const toggleItem = (item: string) => {
    setSelectedItems((prev) =>
      prev.includes(item) ? prev.filter((i) => i !== item) : [...prev, item],
    );
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const data = new FormData(form);

    if (selectedItems.length === 0) {
      toast.error('Please select at least one accepted recyclable item.');
      return;
    }

    setSubmitting(true);
    // Simulate submission delay (swap for real D1 write on Cloudflare)
    await new Promise((r) => setTimeout(r, 800));
    setSubmitting(false);

    toast.success('Thank you! Your submission has been received and will be reviewed.');
    form.reset();
    setSelectedItems([]);
    onOpenChange(false);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>Add a Recycling Center</SheetTitle>
          <SheetDescription>
            Know a recycling center not listed here? Submit it for review. All submissions are
            moderated before publishing.
          </SheetDescription>
        </SheetHeader>

        <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4">
          {/* Name */}
          <div className="flex flex-col gap-1.5">
            <label htmlFor="add-name" className="text-sm font-medium">
              Center Name <span className="text-destructive">*</span>
            </label>
            <Input
              id="add-name"
              name="name"
              required
              placeholder="e.g. Tzu Chi Recycling Station"
            />
          </div>

          {/* Address */}
          <div className="flex flex-col gap-1.5">
            <label htmlFor="add-address" className="text-sm font-medium">
              Address <span className="text-destructive">*</span>
            </label>
            <Input id="add-address" name="address" required placeholder="Street address" />
          </div>

          {/* State + Area */}
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="add-state" className="text-sm font-medium">
                State <span className="text-destructive">*</span>
              </label>
              <Select name="state" required>
                <SelectTrigger id="add-state">
                  <SelectValue placeholder="Select state" />
                </SelectTrigger>
                <SelectContent>
                  {MALAYSIA_STATES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="add-area" className="text-sm font-medium">
                Area / District
              </label>
              <Input id="add-area" name="area" placeholder="e.g. Kepong" />
            </div>
          </div>

          {/* Coordinates */}
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="add-lat" className="text-sm font-medium">
                Latitude
              </label>
              <Input id="add-lat" name="latitude" type="number" step="any" placeholder="3.1569" />
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="add-lng" className="text-sm font-medium">
                Longitude
              </label>
              <Input
                id="add-lng"
                name="longitude"
                type="number"
                step="any"
                placeholder="101.7123"
              />
            </div>
          </div>

          <Separator />

          {/* Accepted items */}
          <div className="flex flex-col gap-2">
            <p className="text-sm font-medium">
              Accepted Items <span className="text-destructive">*</span>
            </p>
            <div className="flex flex-wrap gap-1.5">
              {RECYCLABLE_CATEGORIES.map((cat) => {
                const active = selectedItems.includes(cat);
                return (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => toggleItem(cat)}
                    className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium transition-colors ${
                      active
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'bg-background text-muted-foreground border-border hover:border-primary hover:text-primary'
                    }`}
                    aria-pressed={active}
                  >
                    {cat}
                  </button>
                );
              })}
            </div>
          </div>

          <Separator />

          {/* Contact */}
          <div className="flex flex-col gap-1.5">
            <label htmlFor="add-phone" className="text-sm font-medium">
              Phone
            </label>
            <Input id="add-phone" name="phone" type="tel" placeholder="+603-1234 5678" />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="add-website" className="text-sm font-medium">
              Website URL
            </label>
            <Input
              id="add-website"
              name="website_url"
              type="url"
              placeholder="https://example.com"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="add-gmaps" className="text-sm font-medium">
              Google Maps Link
            </label>
            <Input
              id="add-gmaps"
              name="google_maps_url"
              type="url"
              placeholder="https://maps.google.com/..."
            />
          </div>

          {/* Notes */}
          <div className="flex flex-col gap-1.5">
            <label htmlFor="add-notes" className="text-sm font-medium">
              Notes
            </label>
            <Textarea
              id="add-notes"
              name="notes"
              rows={3}
              placeholder="Opening hours, access instructions, etc."
            />
          </div>

          <Separator />

          {/* Email + Turnstile placeholder */}
          <div className="flex flex-col gap-1.5">
            <label htmlFor="add-email" className="text-sm font-medium">
              Your Email <span className="text-destructive">*</span>
            </label>
            <Input
              id="add-email"
              name="email"
              type="email"
              required
              placeholder="you@example.com"
            />
            <p className="text-muted-foreground text-xs">
              Used for moderation updates only. Not displayed publicly.
            </p>
          </div>

          {/* Turnstile placeholder */}
          <div className="border-border text-muted-foreground flex items-center justify-center rounded-lg border border-dashed py-4 text-xs">
            Cloudflare Turnstile verification (enabled on deployment)
          </div>

          <Button type="submit" disabled={submitting} className="w-full">
            {submitting ? (
              <>
                <LoaderIcon className="mr-2 size-4 animate-spin" aria-hidden="true" />
                Submitting...
              </>
            ) : (
              'Submit for Review'
            )}
          </Button>
        </form>
      </SheetContent>
    </Sheet>
  );
}
