'use client';

import { useState } from 'react';
import { FlagIcon, LoaderIcon } from 'lucide-react';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { REPORT_TYPES } from '@/lib/types';
import { toast } from 'sonner';

interface ReportDialogProps {
  slug: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ReportDialog({ slug, open, onOpenChange }: ReportDialogProps) {
  const [reportType, setReportType] = useState('');
  const [description, setDescription] = useState('');
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reportType || !email) return;

    setSubmitting(true);
    try {
      const res = await fetch(`/api/centers/${slug}/report`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          report_type: reportType,
          description: description || undefined,
          submitter_email: email,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? 'Submission failed');
        return;
      }
      toast.success(data.message);
      setReportType('');
      setDescription('');
      setEmail('');
      onOpenChange(false);
    } catch {
      toast.error('Could not submit report. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FlagIcon className="text-destructive size-4" aria-hidden="true" />
            Report an Issue
          </DialogTitle>
          <DialogDescription>
            Help us keep the directory accurate. Reports are reviewed by our team.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="report-type" className="text-sm font-medium">
              Issue Type <span className="text-destructive">*</span>
            </label>
            <Select value={reportType} onValueChange={(v) => setReportType(v ?? '')} required>
              <SelectTrigger id="report-type">
                <SelectValue placeholder="Select an issue" />
              </SelectTrigger>
              <SelectContent>
                {REPORT_TYPES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="report-description" className="text-sm font-medium">
              Additional Details
            </label>
            <Textarea
              id="report-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Provide any extra context that would help our team…"
              rows={3}
              maxLength={500}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="report-email" className="text-sm font-medium">
              Your Email <span className="text-destructive">*</span>
            </label>
            <Input
              id="report-email"
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
            <Button
              type="submit"
              variant="destructive"
              disabled={submitting || !reportType || !email}
            >
              {submitting && <LoaderIcon className="mr-2 size-4 animate-spin" aria-hidden="true" />}
              Submit Report
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
