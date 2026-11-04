'use client';

import dynamic from 'next/dynamic';
import { useCallback, useState } from 'react';
import { LoaderIcon, LocateIcon, MapPinIcon, PlusIcon } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { TurnstileWidget, TURNSTILE_RESPONSE_FIELD } from './turnstile-widget';
import { MALAYSIA_STATES, RECYCLABLE_CATEGORIES } from '@/lib/types';
import type { PickedLocation } from '@/components/map/location-picker';
import type { RecyclableCategory } from '@/lib/types';
import { turnstileSiteKey, TURNSTILE_ACTION_CENTER_SUBMIT } from '@/lib/env';

const LocationPicker = dynamic(() => import('@/components/map/location-picker'), {
  ssr: false,
  loading: () => (
    <div className="bg-muted border-border h-44 w-full animate-pulse rounded-lg border sm:h-52" />
  ),
});

interface SuggestCenterDialogProps {
  onClose: () => void;
  defaultState?: string;
}

interface FormState {
  name: string;
  address: string;
  area: string;
  state: string;
  accepted_items: RecyclableCategory[];
  phone: string;
  website_url: string;
  notes: string;
}

const EMPTY_FORM: FormState = {
  name: '',
  address: '',
  area: '',
  state: '',
  accepted_items: [],
  phone: '',
  website_url: '',
  notes: '',
};

const fieldLabel = 'text-muted-foreground text-xs font-medium';

function normalizeWebsite(value: string): string | undefined {
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

export function SuggestCenterDialog({ onClose, defaultState }: SuggestCenterDialogProps) {
  const [form, setForm] = useState<FormState>(() => ({
    ...EMPTY_FORM,
    state: defaultState ?? '',
  }));
  const [location, setLocation] = useState<PickedLocation | undefined>();
  const [submitting, setSubmitting] = useState(false);
  const [locating, setLocating] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [widgetKey, setWidgetKey] = useState(0);
  const turnstileRequired = Boolean(turnstileSiteKey());

  const update = useCallback(<K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  }, []);

  const toggleItem = useCallback((item: RecyclableCategory) => {
    setForm((prev) => ({
      ...prev,
      accepted_items: prev.accepted_items.includes(item)
        ? prev.accepted_items.filter((existing) => existing !== item)
        : [...prev.accepted_items, item],
    }));
  }, []);

  const handleToken = useCallback((token: string | null) => {
    setTurnstileToken(token);
  }, []);

  const handleLocate = () => {
    if (!navigator.geolocation) {
      toast.error('Geolocation is not supported by your browser.');
      return;
    }

    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocating(false);
        setLocation({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
      },
      () => {
        setLocating(false);
        toast.error('Could not get your location. Please check permissions.');
      },
      { timeout: 10000, maximumAge: 60000 },
    );
  };

  const validate = (): string | null => {
    if (form.name.trim().length < 2) return 'Enter the center name.';
    if (!form.state) return 'Choose the state.';
    if (!form.area.trim()) return 'Enter the area or town.';
    if (form.address.trim().length < 5) return 'Enter the full address.';
    if (!location) return 'Tap the map to place the center location.';
    if (form.accepted_items.length === 0) return 'Select at least one accepted item.';
    if (turnstileRequired && !turnstileToken) return 'Complete the human verification first.';
    return null;
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const problem = validate();
    if (problem) {
      toast.error(problem);
      return;
    }

    if (!location) return;

    setSubmitting(true);
    try {
      const res = await fetch('/api/centers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name.trim(),
          address: form.address.trim(),
          area: form.area.trim(),
          state: form.state,
          latitude: location.lat,
          longitude: location.lng,
          accepted_items: form.accepted_items,
          ...(form.phone.trim() ? { phone: form.phone.trim() } : {}),
          ...(normalizeWebsite(form.website_url)
            ? { website_url: normalizeWebsite(form.website_url) }
            : {}),
          ...(form.notes.trim() ? { notes: form.notes.trim() } : {}),
          ...(turnstileToken ? { [TURNSTILE_RESPONSE_FIELD]: turnstileToken } : {}),
        }),
      });

      const payload = (await res.json()) as { error?: string; message?: string };

      if (!res.ok) {
        toast.error(payload.error ?? 'Could not submit the center. Please try again.');
        setTurnstileToken(null);
        setWidgetKey((key) => key + 1);
        return;
      }

      toast.success(payload.message ?? 'Thanks! Your suggestion is waiting for review.');
      onClose();
    } catch {
      toast.error('Could not submit the center. Please try again.');
      setTurnstileToken(null);
      setWidgetKey((key) => key + 1);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-h-[90dvh] gap-3 overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <PlusIcon className="text-primary size-5" aria-hidden="true" />
            Add a recycling center
          </DialogTitle>
          <DialogDescription>
            Know a drop-off point we are missing? Suggest it here. Submissions are reviewed before
            they appear on the map.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="center-name" className={fieldLabel}>
              Center name
            </label>
            <Input
              id="center-name"
              value={form.name}
              onChange={(event) => update('name', event.target.value)}
              placeholder="e.g. Tzu Chi Recycling Centre"
              maxLength={120}
              required
              className="h-10"
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <span className={fieldLabel}>State</span>
              <Select value={form.state} onValueChange={(value) => update('state', value ?? '')}>
                <SelectTrigger
                  className="w-full text-sm data-[size=default]:h-10"
                  aria-label="Center state"
                >
                  <SelectValue>{form.state || 'Select state'}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {MALAYSIA_STATES.map((state) => (
                    <SelectItem key={state} value={state}>
                      {state}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="center-area" className={fieldLabel}>
                Area / town
              </label>
              <Input
                id="center-area"
                value={form.area}
                onChange={(event) => update('area', event.target.value)}
                placeholder="e.g. Petaling Jaya"
                maxLength={80}
                required
                className="h-10"
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="center-address" className={fieldLabel}>
              Address
            </label>
            <Textarea
              id="center-address"
              value={form.address}
              onChange={(event) => update('address', event.target.value)}
              placeholder="Street, postcode, city"
              maxLength={300}
              rows={2}
              required
            />
          </div>

          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between gap-2">
              <span className={fieldLabel}>Location</span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleLocate}
                disabled={locating}
                className="text-muted-foreground h-8 gap-1.5 px-2"
              >
                {locating ? (
                  <LoaderIcon className="size-3.5 animate-spin" aria-hidden="true" />
                ) : (
                  <LocateIcon className="size-3.5" aria-hidden="true" />
                )}
                Use my location
              </Button>
            </div>
            <LocationPicker value={location} onChange={setLocation} />
            <p className="text-muted-foreground text-xs">
              {location
                ? `${location.lat.toFixed(5)}, ${location.lng.toFixed(5)}`
                : 'Tap the map to place the center.'}
            </p>
          </div>

          <div className="flex flex-col gap-2">
            <span className={fieldLabel}>Accepts</span>
            <div className="flex flex-wrap gap-1.5">
              {RECYCLABLE_CATEGORIES.map((category) => {
                const active = form.accepted_items.includes(category);
                return (
                  <button
                    key={category}
                    type="button"
                    onClick={() => toggleItem(category)}
                    className={`inline-flex min-h-9 items-center rounded-full border px-2.5 text-xs font-medium transition-colors ${
                      active
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'bg-background text-muted-foreground border-border hover:border-primary hover:text-primary'
                    }`}
                    aria-pressed={active}
                  >
                    {category}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="center-phone" className={fieldLabel}>
                Phone (optional)
              </label>
              <Input
                id="center-phone"
                type="tel"
                value={form.phone}
                onChange={(event) => update('phone', event.target.value)}
                placeholder="+60 3-1234 5678"
                maxLength={40}
                className="h-10"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="center-website" className={fieldLabel}>
                Website (optional)
              </label>
              <Input
                id="center-website"
                type="url"
                value={form.website_url}
                onChange={(event) => update('website_url', event.target.value)}
                placeholder="https://example.com"
                maxLength={300}
                className="h-10"
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="center-notes" className={fieldLabel}>
              Notes (optional)
            </label>
            <Textarea
              id="center-notes"
              value={form.notes}
              onChange={(event) => update('notes', event.target.value)}
              placeholder="Opening hours, accepted items, access instructions..."
              maxLength={1000}
              rows={2}
            />
          </div>

          <TurnstileWidget
            key={widgetKey}
            action={TURNSTILE_ACTION_CENTER_SUBMIT}
            onToken={handleToken}
            className="overflow-hidden"
          />

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" className="h-11 sm:h-10" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting} className="h-11 gap-1.5 sm:h-10">
              {submitting ? (
                <LoaderIcon className="size-4 animate-spin" aria-hidden="true" />
              ) : (
                <MapPinIcon className="size-4" aria-hidden="true" />
              )}
              Submit for review
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
