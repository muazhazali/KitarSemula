'use client';

import { SlidersHorizontalIcon, XIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { MALAYSIA_STATES, RECYCLABLE_CATEGORIES } from '@/lib/types';
import type { SearchParams } from '@/lib/types';

interface FilterPanelProps {
  filters: Partial<SearchParams>;
  onChange: (filters: Partial<SearchParams>) => void;
  resultCount: number;
}

export function FilterPanel({ filters, onChange, resultCount }: FilterPanelProps) {
  const activeFilterCount = [
    filters.state && filters.state !== 'all' ? 1 : 0,
    (filters.items?.length ?? 0) > 0 ? 1 : 0,
    filters.open_now ? 1 : 0,
    filters.verified_only ? 1 : 0,
    filters.has_photos ? 1 : 0,
  ].reduce((a, b) => a + b, 0);

  const clearAll = () => {
    onChange({
      state: undefined,
      items: [],
      open_now: false,
      verified_only: false,
      has_photos: false,
      sort: 'recently_updated',
    });
  };

  const toggleItem = (item: string) => {
    const current = filters.items ?? [];
    const updated = current.includes(item) ? current.filter((i) => i !== item) : [...current, item];
    onChange({ ...filters, items: updated });
  };

  return (
    <div className="flex flex-col gap-3">
      {/* Top row: state, sort, quick toggles */}
      <div className="flex flex-wrap items-center gap-2">
        <SlidersHorizontalIcon
          className="text-muted-foreground size-4 shrink-0"
          aria-hidden="true"
        />

        {/* State */}
        <Select
          value={filters.state && filters.state !== 'all' ? filters.state : 'all'}
          onValueChange={(v) => onChange({ ...filters, state: !v || v === 'all' ? undefined : v })}
        >
          <SelectTrigger className="h-8 w-40 text-xs" aria-label="Filter by state">
            <SelectValue>
              {filters.state && filters.state !== 'all' ? filters.state : 'All States'}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All States</SelectItem>
            {MALAYSIA_STATES.map((s) => (
              <SelectItem key={s} value={s}>
                {s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Sort */}
        <Select
          value={filters.sort ?? 'recently_updated'}
          onValueChange={(v) => onChange({ ...filters, sort: v as SearchParams['sort'] })}
        >
          <SelectTrigger className="h-8 w-44 text-xs" aria-label="Sort results">
            <SelectValue>
              {filters.sort === 'nearest'
                ? 'Nearest'
                : filters.sort === 'most_upvoted'
                  ? 'Most Upvoted'
                  : 'Recently Updated'}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="recently_updated">Recently Updated</SelectItem>
            <SelectItem value="most_upvoted">Most Upvoted</SelectItem>
            <SelectItem value="nearest">Nearest</SelectItem>
          </SelectContent>
        </Select>

        {/* Quick toggles */}
        <button
          onClick={() => onChange({ ...filters, open_now: !filters.open_now })}
          className={`inline-flex h-8 items-center gap-1 rounded-md border px-3 text-xs font-medium transition-colors ${
            filters.open_now
              ? 'bg-primary text-primary-foreground border-primary'
              : 'bg-background text-foreground border-border hover:bg-muted'
          }`}
          aria-pressed={filters.open_now}
        >
          Open Now
        </button>

        <button
          onClick={() => onChange({ ...filters, verified_only: !filters.verified_only })}
          className={`inline-flex h-8 items-center gap-1 rounded-md border px-3 text-xs font-medium transition-colors ${
            filters.verified_only
              ? 'bg-primary text-primary-foreground border-primary'
              : 'bg-background text-foreground border-border hover:bg-muted'
          }`}
          aria-pressed={filters.verified_only}
        >
          Verified Only
        </button>

        <button
          onClick={() => onChange({ ...filters, has_photos: !filters.has_photos })}
          className={`inline-flex h-8 items-center gap-1 rounded-md border px-3 text-xs font-medium transition-colors ${
            filters.has_photos
              ? 'bg-primary text-primary-foreground border-primary'
              : 'bg-background text-foreground border-border hover:bg-muted'
          }`}
          aria-pressed={filters.has_photos}
        >
          Has Photos
        </button>

        {activeFilterCount > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={clearAll}
            className="text-muted-foreground h-8 px-2 text-xs"
          >
            <XIcon className="mr-1 size-3" aria-hidden="true" />
            Clear ({activeFilterCount})
          </Button>
        )}

        <span className="text-muted-foreground ml-auto shrink-0 text-xs">
          {resultCount} {resultCount === 1 ? 'center' : 'centers'}
        </span>
      </div>

      {/* Item type chips */}
      <div className="flex flex-wrap gap-1.5">
        {RECYCLABLE_CATEGORIES.map((cat) => {
          const active = filters.items?.includes(cat);
          return (
            <button
              key={cat}
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
  );
}
