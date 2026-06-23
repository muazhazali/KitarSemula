'use client';

import { useState } from 'react';
import { PencilIcon, LoaderIcon } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { MALAYSIA_STATES, RECYCLABLE_CATEGORIES } from '@/lib/types';
import type { RecyclingCenter } from '@/lib/types';
import { toast } from 'sonner';

interface SuggestEditDialogProps {
  center: RecyclingCenter;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SuggestEditDialog({ center, open, onOpenChange }: SuggestEditDialogProps) {
  const [submitting, setSubmitting] = useState(false);
  const [selectedItems, setSelectedItems] = useState<string[]>(center.accepted_items);
  const [email, setEmail] = useState('');

  const toggleItem = (item: string) => {
    setSelectedItems((prev) =>
      prev.includes(item) ? prev.filter((i) => i !== item) : [...prev, item],
    );
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!email) return;

    setSubmitting(true);
    await new Promise((r) => setTimeout(r, 600));
    setSubmitting(false);
    toast.success('Edit suggestion submitted for review. Thank you!');
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <PencilIcon className="text-primary size-4" aria-hidden="true" />
            Suggest an Edit
          </DialogTitle>
          <DialogDescription>
            Suggest corrections to the information for <strong>{center.name}</strong>. All edits are
            reviewed before publishing.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <Tabs defaultValue="basic">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="basic">Basic Info</TabsTrigger>
              <TabsTrigger value="items">Items</TabsTrigger>
              <TabsTrigger value="hours">Hours</TabsTrigger>
            </TabsList>

            {/* Basic info */}
            <TabsContent value="basic" className="mt-4 flex flex-col gap-3">
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium">Center Name</label>
                <Input name="name" defaultValue={center.name} />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium">Address</label>
                <Input name="address" defaultValue={center.address} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium">State</label>
                  <Select name="state" defaultValue={center.state}>
                    <SelectTrigger>
                      <SelectValue />
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
                  <label className="text-sm font-medium">Area</label>
                  <Input name="area" defaultValue={center.area} />
                </div>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium">Phone</label>
                <Input name="phone" defaultValue={center.phone ?? ''} />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium">Website</label>
                <Input name="website_url" type="url" defaultValue={center.website_url ?? ''} />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium">Notes</label>
                <Textarea name="notes" defaultValue={center.notes ?? ''} rows={2} />
              </div>
            </TabsContent>

            {/* Items */}
            <TabsContent value="items" className="mt-4">
              <p className="text-muted-foreground mb-3 text-sm">
                Select all items this center accepts.
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
            </TabsContent>

            {/* Hours */}
            <TabsContent value="hours" className="mt-4 flex flex-col gap-2">
              {(
                [
                  'monday',
                  'tuesday',
                  'wednesday',
                  'thursday',
                  'friday',
                  'saturday',
                  'sunday',
                ] as const
              ).map((day) => (
                <div key={day} className="flex items-center gap-3">
                  <span className="w-24 text-sm font-medium capitalize">{day}</span>
                  <Input
                    name={`hours_${day}`}
                    defaultValue={center.opening_hours[day] ?? ''}
                    placeholder="e.g. 9:00 AM – 5:00 PM"
                    className="flex-1"
                  />
                </div>
              ))}
            </TabsContent>
          </Tabs>

          {/* Email */}
          <div className="flex flex-col gap-1.5">
            <label htmlFor="suggest-email" className="text-sm font-medium">
              Your Email <span className="text-destructive">*</span>
            </label>
            <Input
              id="suggest-email"
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
            <Button type="submit" disabled={submitting || !email}>
              {submitting && <LoaderIcon className="mr-2 size-4 animate-spin" aria-hidden="true" />}
              Submit Suggestion
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
