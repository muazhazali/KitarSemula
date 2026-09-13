'use client';

import { useState } from 'react';
import { ThumbsUpIcon, ThumbsDownIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

interface VoteButtonsProps {
  slug: string;
  initialUpvotes: number;
  initialDownvotes: number;
}

export function VoteButtons({ slug, initialUpvotes, initialDownvotes }: VoteButtonsProps) {
  const [upvotes, setUpvotes] = useState(initialUpvotes);
  const [downvotes, setDownvotes] = useState(initialDownvotes);
  const [voted, setVoted] = useState<'UP' | 'DOWN' | null>(null);
  const [loading, setLoading] = useState(false);

  const handleVote = async (type: 'UP' | 'DOWN') => {
    if (voted) {
      toast.info('You have already voted for this center.');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`/api/centers/${slug}/vote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type }),
      });
      if (!res.ok) throw new Error();
      const data = (await res.json()) as { upvote_count: number; downvote_count: number };
      setUpvotes(data.upvote_count);
      setDownvotes(data.downvote_count);
      setVoted(type);
      toast.success(type === 'UP' ? 'Thanks for the upvote!' : 'Feedback recorded.');
    } catch {
      toast.error('Could not record your vote. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center gap-2">
      <Button
        variant={voted === 'UP' ? 'default' : 'outline'}
        size="sm"
        onClick={() => handleVote('UP')}
        disabled={loading || voted !== null}
        className="gap-1.5"
        aria-label={`Upvote. Current count: ${upvotes}`}
        aria-pressed={voted === 'UP'}
      >
        <ThumbsUpIcon className="size-4" data-icon="inline-start" aria-hidden="true" />
        {upvotes}
      </Button>
      <Button
        variant={voted === 'DOWN' ? 'destructive' : 'outline'}
        size="sm"
        onClick={() => handleVote('DOWN')}
        disabled={loading || voted !== null}
        className="gap-1.5"
        aria-label={`Downvote. Current count: ${downvotes}`}
        aria-pressed={voted === 'DOWN'}
      >
        <ThumbsDownIcon className="size-4" data-icon="inline-start" aria-hidden="true" />
        {downvotes}
      </Button>
    </div>
  );
}
