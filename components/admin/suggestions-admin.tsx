'use client';

import Link from 'next/link';
import { useState } from 'react';
import {
  ArrowLeftIcon,
  CheckIcon,
  ExternalLinkIcon,
  LoaderIcon,
  LockIcon,
  MapPinIcon,
  RefreshCwIcon,
  XIcon,
} from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import type { CenterSuggestion, SuggestionStatus } from '@/lib/types';

type Filter = SuggestionStatus | 'ALL';

const FILTERS: Filter[] = ['PENDING', 'APPROVED', 'REJECTED', 'ALL'];

function formatDate(value: string): string {
  return new Date(value).toLocaleString('en-MY', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function StatusBadge({ status }: { status: SuggestionStatus }) {
  if (status === 'APPROVED') return <Badge>Approved</Badge>;
  if (status === 'REJECTED') return <Badge variant="destructive">Rejected</Badge>;
  return <Badge variant="outline">Pending</Badge>;
}

export function SuggestionsAdmin() {
  const [tokenInput, setTokenInput] = useState('');
  const [token, setToken] = useState('');
  const [unlocked, setUnlocked] = useState(false);
  const [filter, setFilter] = useState<Filter>('PENDING');
  const [suggestions, setSuggestions] = useState<CenterSuggestion[]>([]);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = async (nextToken: string, nextFilter: Filter) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/suggestions?status=${nextFilter}`, {
        headers: { Authorization: `Bearer ${nextToken}` },
        cache: 'no-store',
      });
      const data = (await res.json()) as { suggestions?: CenterSuggestion[]; error?: string };

      if (res.status === 401) {
        setUnlocked(false);
        setToken('');
        setError('Invalid admin token.');
        return;
      }
      if (!res.ok) {
        setError(data.error ?? 'Could not load suggestions.');
        return;
      }

      setSuggestions(data.suggestions ?? []);
      setToken(nextToken);
      setUnlocked(true);
    } catch {
      setError('Could not load suggestions.');
    } finally {
      setLoading(false);
    }
  };

  const handleUnlock = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!tokenInput.trim()) return;
    void load(tokenInput.trim(), filter);
  };

  const handleFilter = (next: Filter) => {
    setFilter(next);
    if (unlocked) void load(token, next);
  };

  const review = async (id: string, action: 'approve' | 'reject') => {
    setBusyId(id);
    try {
      const res = await fetch(`/api/admin/suggestions/${id}`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action, note: notes[id] ?? undefined }),
      });
      const data = (await res.json()) as { error?: string };

      if (res.status === 401) {
        setUnlocked(false);
        setToken('');
        setError('Your admin session is no longer valid.');
        return;
      }
      if (!res.ok) {
        toast.error(data.error ?? 'Could not review this suggestion.');
        return;
      }

      toast.success(
        action === 'approve' ? 'Center approved and published.' : 'Suggestion rejected.',
      );
      setNotes((prev) => ({ ...prev, [id]: '' }));
      await load(token, filter);
    } catch {
      toast.error('Could not review this suggestion.');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="bg-background min-h-dvh">
      <header className="border-border bg-background sticky top-0 z-20 flex items-center gap-3 border-b px-4 py-3">
        <Link
          href="/"
          className="text-muted-foreground hover:text-foreground inline-flex min-h-10 items-center gap-1.5 rounded-lg px-2 text-sm font-medium transition-colors"
        >
          <ArrowLeftIcon className="size-4" aria-hidden="true" />
          Map
        </Link>
        <span className="text-foreground text-sm font-semibold">Suggestion review</span>
        {unlocked && (
          <Button
            variant="ghost"
            size="sm"
            className="text-muted-foreground ml-auto gap-1.5"
            onClick={() => {
              setUnlocked(false);
              setToken('');
              setSuggestions([]);
            }}
          >
            <LockIcon className="size-3.5" aria-hidden="true" />
            Lock
          </Button>
        )}
      </header>

      <main className="mx-auto flex max-w-3xl flex-col gap-4 px-4 py-6">
        {!unlocked ? (
          <form
            onSubmit={handleUnlock}
            className="border-border mx-auto mt-8 flex w-full max-w-md flex-col gap-3 rounded-xl border p-5"
          >
            <div className="flex items-center gap-2">
              <LockIcon className="text-primary size-5" aria-hidden="true" />
              <h1 className="text-foreground text-base font-semibold">Admin access</h1>
            </div>
            <p className="text-muted-foreground text-sm">
              Enter the admin token configured as the{' '}
              <code className="bg-muted rounded px-1 py-0.5 text-xs">ADMIN_TOKEN</code> Worker
              secret.
            </p>
            <label htmlFor="admin-token" className="text-muted-foreground text-xs font-medium">
              Admin token
            </label>
            <Input
              id="admin-token"
              type="password"
              value={tokenInput}
              onChange={(event) => setTokenInput(event.target.value)}
              placeholder="Paste token"
              autoComplete="off"
              className="h-10"
              required
            />
            <Button type="submit" disabled={loading} className="h-10 gap-1.5">
              {loading ? (
                <LoaderIcon className="size-4 animate-spin" aria-hidden="true" />
              ) : (
                <LockIcon className="size-4" aria-hidden="true" />
              )}
              Unlock
            </Button>
            {error && <p className="text-destructive text-xs">{error}</p>}
          </form>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-2">
              {FILTERS.map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => handleFilter(option)}
                  className={cn(
                    'inline-flex h-9 items-center rounded-full border px-3 text-xs font-medium transition-colors',
                    filter === option
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'bg-background text-muted-foreground border-border hover:border-primary hover:text-primary',
                  )}
                  aria-pressed={filter === option}
                >
                  {option === 'ALL' ? 'All' : option.charAt(0) + option.slice(1).toLowerCase()}
                </button>
              ))}
              <Button
                variant="ghost"
                size="sm"
                className="text-muted-foreground ml-auto gap-1.5"
                disabled={loading}
                onClick={() => void load(token, filter)}
              >
                <RefreshCwIcon
                  className={cn('size-3.5', loading && 'animate-spin')}
                  aria-hidden="true"
                />
                Refresh
              </Button>
            </div>

            {error && <p className="text-destructive text-sm">{error}</p>}

            {loading && suggestions.length === 0 ? (
              <div className="flex items-center justify-center py-16">
                <LoaderIcon className="text-muted-foreground size-6 animate-spin" />
              </div>
            ) : suggestions.length === 0 ? (
              <div className="border-border text-muted-foreground rounded-xl border border-dashed px-4 py-16 text-center text-sm">
                Nothing here. New suggestions will appear in this queue.
              </div>
            ) : (
              <ul className="flex flex-col gap-3">
                {suggestions.map((suggestion) => (
                  <li
                    key={suggestion.id}
                    className="border-border bg-card flex flex-col gap-3 rounded-xl border p-4"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <h2 className="text-foreground text-sm font-semibold">{suggestion.name}</h2>
                        <p className="text-muted-foreground mt-0.5 text-xs">
                          {suggestion.area}, {suggestion.state} · submitted{' '}
                          {formatDate(suggestion.created_at)}
                        </p>
                      </div>
                      <StatusBadge status={suggestion.status} />
                    </div>

                    <div className="text-muted-foreground flex flex-col gap-1 text-xs">
                      <span className="text-foreground">{suggestion.address}</span>
                      <a
                        href={`https://www.google.com/maps/search/?api=1&query=${suggestion.latitude},${suggestion.longitude}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary inline-flex w-fit items-center gap-1 hover:underline"
                      >
                        <MapPinIcon className="size-3" aria-hidden="true" />
                        {suggestion.latitude.toFixed(5)}, {suggestion.longitude.toFixed(5)}
                      </a>
                      {(suggestion.phone || suggestion.website_url) && (
                        <span>
                          {suggestion.phone}
                          {suggestion.phone && suggestion.website_url ? ' · ' : ''}
                          {suggestion.website_url}
                        </span>
                      )}
                      {suggestion.notes && <span>Notes: {suggestion.notes}</span>}
                      {suggestion.review_note && <span>Review note: {suggestion.review_note}</span>}
                    </div>

                    <div className="flex flex-wrap gap-1.5">
                      {suggestion.accepted_items.map((item) => (
                        <span
                          key={item}
                          className="bg-secondary text-secondary-foreground rounded-full px-2 py-0.5 text-[11px] font-medium"
                        >
                          {item}
                        </span>
                      ))}
                    </div>

                    {suggestion.status === 'PENDING' ? (
                      <div className="flex flex-col gap-2">
                        <Textarea
                          value={notes[suggestion.id] ?? ''}
                          onChange={(event) =>
                            setNotes((prev) => ({
                              ...prev,
                              [suggestion.id]: event.target.value,
                            }))
                          }
                          placeholder="Review note (optional)"
                          maxLength={500}
                          rows={2}
                          className="min-h-14"
                          aria-label={`Review note for ${suggestion.name}`}
                        />
                        <div className="flex flex-wrap gap-2">
                          <Button
                            className="h-10 gap-1.5"
                            disabled={busyId === suggestion.id}
                            onClick={() => void review(suggestion.id, 'approve')}
                          >
                            {busyId === suggestion.id ? (
                              <LoaderIcon className="size-4 animate-spin" aria-hidden="true" />
                            ) : (
                              <CheckIcon className="size-4" aria-hidden="true" />
                            )}
                            Approve & publish
                          </Button>
                          <Button
                            variant="outline"
                            className="h-10 gap-1.5"
                            disabled={busyId === suggestion.id}
                            onClick={() => void review(suggestion.id, 'reject')}
                          >
                            <XIcon className="size-4" aria-hidden="true" />
                            Reject
                          </Button>
                        </div>
                      </div>
                    ) : suggestion.center_slug ? (
                      <Link
                        href={`/center/${suggestion.center_slug}`}
                        className="text-primary inline-flex w-fit items-center gap-1 text-xs font-medium hover:underline"
                      >
                        View published center
                        <ExternalLinkIcon className="size-3" aria-hidden="true" />
                      </Link>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </main>
    </div>
  );
}
