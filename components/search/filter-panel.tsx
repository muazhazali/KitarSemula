'use client';

import type { ReactNode } from 'react';
import { SlidersHorizontalIcon, XIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
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
  variant?: 'inline' | 'sheet';
}

export function countActiveFilters(filters: Partial<SearchParams>) {
  return [
    filters.state && filters.state !== 'all' ? 1 : 0,
    (filters.items?.length ?? 0) > 0 ? 1 : 0,
    filters.open_now ? 1 : 0,
    filters.verified_only ? 1 : 0,
  ].reduce((a, b) => a + b, 0);
}

function ToggleButton({
  active,
  onClick,
  children,
  className,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center justify-center rounded-lg border font-medium whitespace-nowrap transition-colors ${
        active
          ? 'bg-primary text-primary-foreground border-primary'
          : 'bg-background text-foreground border-border hover:bg-muted'
      } ${className ?? ''}`}
      aria-pressed={active}
    >
      {children}
    </button>
  );
}

export function FilterPanel({
  filters,
  onChange,
  resultCount,
  variant = 'inline',
}: FilterPanelProps) {
  const activeFilterCount = countActiveFilters(filters);

  const clearAll = () => {
    onChange({
      state: undefined,
      items: [],
      open_now: false,
      verified_only: false,
      sort: 'recently_updated',
    });
  };

  const toggleItem = (item: string) => {
    const current = filters.items ?? [];
    const updated = current.includes(item) ? current.filter((i) => i !== item) : [...current, item];
    onChange({ ...filters, items: updated });
  };

  if (variant === 'sheet') {
    return (
      <div className="flex flex-col gap-5">
        <div className="flex flex-col gap-2">
          <span className="text-muted-foreground text-xs font-medium">State</span>
          <Select
            value={filters.state && filters.state !== 'all' ? filters.state : 'all'}
            onValueChange={(v) =>
              onChange({ ...filters, state: !v || v === 'all' ? undefined : v })
            }
          >
            <SelectTrigger
              className="w-full text-sm data-[size=default]:h-11"
              aria-label="Filter by state"
            >
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
        </div>

        <div className="flex flex-col gap-2">
          <span className="text-muted-foreground text-xs font-medium">Sort by</span>
          <Select
            value={filters.sort ?? 'recently_updated'}
            onValueChange={(v) => onChange({ ...filters, sort: v as SearchParams['sort'] })}
          >
            <SelectTrigger
              className="w-full text-sm data-[size=default]:h-11"
              aria-label="Sort results"
            >
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
        </div>

        <div className="flex flex-col gap-2">
          <span className="text-muted-foreground text-xs font-medium">Status</span>
          <div className="grid grid-cols-2 gap-2">
            <ToggleButton
              active={Boolean(filters.open_now)}
              onClick={() => onChange({ ...filters, open_now: !filters.open_now })}
              className="h-11 px-3 text-sm"
            >
              Open Now
            </ToggleButton>
            <ToggleButton
              active={Boolean(filters.verified_only)}
              onClick={() => onChange({ ...filters, verified_only: !filters.verified_only })}
              className="h-11 px-3 text-sm"
            >
              Verified Only
            </ToggleButton>
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <span className="text-muted-foreground text-xs font-medium">Accepts</span>
          <div className="flex flex-wrap gap-2">
            {RECYCLABLE_CATEGORIES.map((cat) => {
              const active = filters.items?.includes(cat);
              return (
                <button
                  key={cat}
                  type="button"
                  onClick={() => toggleItem(cat)}
                  className={`inline-flex min-h-10 items-center rounded-full border px-3 text-sm font-medium transition-colors ${
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

        {activeFilterCount > 0 && (
          <Button
            variant="ghost"
            onClick={clearAll}
            className="text-muted-foreground h-11 self-start px-2 text-sm"
          >
            <XIcon className="mr-1 size-4" aria-hidden="true" />
            Clear all filters
          </Button>
        )}
      </div>
    );
  }

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
          <SelectTrigger
            className="w-40 text-xs data-[size=default]:h-9"
            aria-label="Filter by state"
          >
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
          <SelectTrigger className="w-44 text-xs data-[size=default]:h-9" aria-label="Sort results">
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
        <ToggleButton
          active={Boolean(filters.open_now)}
          onClick={() => onChange({ ...filters, open_now: !filters.open_now })}
          className="h-9 px-3 text-xs"
        >
          Open Now
        </ToggleButton>

        <ToggleButton
          active={Boolean(filters.verified_only)}
          onClick={() => onChange({ ...filters, verified_only: !filters.verified_only })}
          className="h-9 px-3 text-xs"
        >
          Verified Only
        </ToggleButton>

        {activeFilterCount > 0 && (
          <Button
            variant="ghost"
            onClick={clearAll}
            className="text-muted-foreground h-9 px-2 text-xs"
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
  );
}
