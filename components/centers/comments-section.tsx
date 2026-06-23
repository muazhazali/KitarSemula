'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { MessageSquareIcon, LoaderIcon, SendIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import type { Comment } from '@/lib/types';

interface CommentsSectionProps {
  slug: string;
}

async function fetchComments(slug: string): Promise<Comment[]> {
  const res = await fetch(`/api/centers/${slug}/comments`);
  if (!res.ok) return [];
  const data = await res.json();
  return data.comments;
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

export function CommentsSection({ slug }: CommentsSectionProps) {
  const queryClient = useQueryClient();
  const [comment, setComment] = useState('');
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [showForm, setShowForm] = useState(false);

  const { data: comments, isLoading } = useQuery({
    queryKey: ['comments', slug],
    queryFn: () => fetchComments(slug),
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!comment.trim() || !email.trim()) return;

    setSubmitting(true);
    try {
      const res = await fetch(`/api/centers/${slug}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ comment_text: comment, submitter_email: email }),
      });
      const data = await res.json();
      if (!res.ok) {
        const msg = data.issues?.[0]?.message ?? data.error ?? 'Submission failed';
        toast.error(msg);
        return;
      }
      toast.success('Comment submitted! It will appear after review.');
      setComment('');
      setEmail('');
      setShowForm(false);
      queryClient.invalidateQueries({ queryKey: ['comments', slug] });
    } catch {
      toast.error('Could not submit comment. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section aria-labelledby="comments-heading">
      <div className="mb-4 flex items-center justify-between">
        <h2
          id="comments-heading"
          className="text-foreground flex items-center gap-2 text-base font-semibold"
        >
          <MessageSquareIcon className="text-muted-foreground size-4" aria-hidden="true" />
          Comments
          {comments && comments.length > 0 && (
            <span className="text-muted-foreground text-sm font-normal">({comments.length})</span>
          )}
        </h2>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowForm((v) => !v)}
          aria-expanded={showForm}
        >
          {showForm ? 'Cancel' : 'Leave a Comment'}
        </Button>
      </div>

      {/* Comment form */}
      {showForm && (
        <form
          onSubmit={handleSubmit}
          className="bg-muted/40 mb-6 flex flex-col gap-3 rounded-lg border p-4"
        >
          <Textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Share your experience or useful information about this center…"
            rows={3}
            required
            minLength={5}
            maxLength={1000}
            aria-label="Comment text"
          />
          <Input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Your email (not shown publicly)"
            required
            aria-label="Your email address"
          />
          {/* Turnstile placeholder */}
          <div className="border-border text-muted-foreground flex items-center justify-center rounded-md border border-dashed py-3 text-xs">
            Cloudflare Turnstile verification (enabled on deployment)
          </div>
          <Button type="submit" disabled={submitting} size="sm" className="gap-1.5 self-end">
            {submitting ? (
              <LoaderIcon className="size-4 animate-spin" aria-hidden="true" />
            ) : (
              <SendIcon className="size-4" data-icon="inline-start" aria-hidden="true" />
            )}
            Submit Comment
          </Button>
        </form>
      )}

      {/* Comment list */}
      {isLoading ? (
        <div className="flex flex-col gap-3">
          {[1, 2].map((i) => (
            <div key={i} className="flex flex-col gap-2">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
            </div>
          ))}
        </div>
      ) : comments && comments.length > 0 ? (
        <div className="flex flex-col gap-4">
          {comments.map((c, i) => (
            <div key={c.id}>
              {i > 0 && <Separator className="mb-4" />}
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-2">
                  <span className="text-foreground text-xs font-medium">
                    {c.submitter_email.split('@')[0].replace(/./g, (ch, i) => (i > 1 ? '*' : ch))}
                    @…
                  </span>
                  <span className="text-muted-foreground text-xs">{timeAgo(c.created_at)}</span>
                </div>
                <p className="text-foreground text-sm leading-relaxed">{c.comment_text}</p>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-muted-foreground text-sm">
          No comments yet. Be the first to share your experience.
        </p>
      )}
    </section>
  );
}
