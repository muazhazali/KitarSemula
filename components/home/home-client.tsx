'use client';

import dynamic from 'next/dynamic';
import { useState, useCallback, useMemo, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Maximize2Icon, Minimize2Icon, RecycleIcon, SlidersHorizontalIcon } from 'lucide-react';
import { SearchBar } from '@/components/search/search-bar';
import { FilterPanel, countActiveFilters } from '@/components/search/filter-panel';
import { CenterList } from '@/components/centers/center-list';
import { LocationButton } from '@/components/map/location-button';
import { MapLegend } from '@/components/map/map-legend';
import { StateOnboardingDialog } from '@/components/home/state-onboarding-dialog';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { cn } from '@/lib/utils';
import { MALAYSIA_STATES } from '@/lib/types';
import type { RecyclingCenter, SearchParams } from '@/lib/types';

const RecyclingMap = dynamic(() => import('@/components/map/recycling-map'), {
  ssr: false,
  loading: () => (
    <div className="bg-muted flex h-full w-full animate-pulse items-center justify-center">
      <span className="text-muted-foreground text-xs">Loading map...</span>
    </div>
  ),
});

const CENTERS_PAGE_SIZE = 250;
const PREFERRED_STATE_KEY = 'kitarsemula.preferred-state';
const SEARCH_DEBOUNCE_MS = 300;

async function fetchCenters(params: SearchParams): Promise<RecyclingCenter[]> {
  const all: RecyclingCenter[] = [];
  let page = 1;

  for (;;) {
    const url = new URL('/api/centers', window.location.origin);
    if (params.q) url.searchParams.set('q', params.q);
    if (params.state && params.state !== 'all') url.searchParams.set('state', params.state);
    if (params.items?.length) params.items.forEach((i) => url.searchParams.append('items', i));
    if (params.open_now) url.searchParams.set('open_now', 'true');
    if (params.verified_only) url.searchParams.set('verified_only', 'true');
    if (params.sort) url.searchParams.set('sort', params.sort);
    if (params.lat != null) url.searchParams.set('lat', String(params.lat));
    if (params.lng != null) url.searchParams.set('lng', String(params.lng));
    url.searchParams.set('page', String(page));
    url.searchParams.set('limit', String(CENTERS_PAGE_SIZE));

    const res = await fetch(url.toString());
    if (!res.ok) throw new Error('Failed to fetch centers');
    const data = (await res.json()) as { centers: RecyclingCenter[]; total: number };
    all.push(...data.centers);

    if (data.centers.length === 0 || all.length >= data.total) break;
    page += 1;
  }

  return all;
}

function savePreferredState(state: string) {
  try {
    window.localStorage.setItem(PREFERRED_STATE_KEY, state);
  } catch {
    return;
  }
}

export function HomeClient() {
  const [searchInput, setSearchInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState<Partial<SearchParams>>({
    sort: 'recently_updated',
  });
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | undefined>();
  const [selectedCenter, setSelectedCenter] = useState<RecyclingCenter | undefined>();
  const [statePromptOpen, setStatePromptOpen] = useState(false);
  const [mapExpanded, setMapExpanded] = useState(false);

  useEffect(() => {
    let saved: string | null = null;
    try {
      saved = window.localStorage.getItem(PREFERRED_STATE_KEY);
    } catch {
      saved = null;
    }

    if (saved === 'all' || (saved && (MALAYSIA_STATES as readonly string[]).includes(saved))) {
      if (saved !== 'all') {
        // eslint-disable-next-line react-hooks/set-state-in-effect -- apply the saved filter after mount
        setFilters((prev) => ({ ...prev, state: saved as string }));
      }
      return;
    }

    setStatePromptOpen(true);
  }, []);

  useEffect(() => {
    if (!searchInput) return;

    const timer = window.setTimeout(() => setSearchQuery(searchInput), SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  const handleSearchChange = useCallback((value: string) => {
    setSearchInput(value);
    if (!value) setSearchQuery('');
  }, []);

  const queryParams: SearchParams = useMemo(
    () => ({
      q: searchQuery || undefined,
      ...filters,
      lat: userLocation?.lat,
      lng: userLocation?.lng,
    }),
    [searchQuery, filters, userLocation],
  );

  const { data: centers, isLoading } = useQuery({
    queryKey: ['centers', queryParams],
    queryFn: () => fetchCenters(queryParams),
    placeholderData: (prev) => prev,
  });

  const handleLocation = useCallback((lat: number, lng: number) => {
    setUserLocation({ lat, lng });
    setFilters((prev) => ({ ...prev, sort: 'nearest' }));
  }, []);

  const handleFiltersChange = useCallback((updated: Partial<SearchParams>) => {
    setFilters(updated);
    savePreferredState(updated.state ?? 'all');
  }, []);

  const handleStateSelect = useCallback((state: string) => {
    setFilters((prev) => ({ ...prev, state: state === 'all' ? undefined : state }));
    savePreferredState(state);
    setStatePromptOpen(false);
  }, []);

  const centerList = centers ?? [];
  const activeFilterCount = countActiveFilters(filters);
  const resultLabel = `${centerList.length} ${centerList.length === 1 ? 'center' : 'centers'}`;

  return (
    <div className="bg-background flex h-dvh flex-col overflow-hidden">
      {/* Header */}
      <header className="border-border bg-background z-10 flex shrink-0 items-center gap-2 border-b px-3 py-2.5 sm:gap-3 sm:px-4 sm:py-3">
        <div className="flex shrink-0 items-center gap-2">
          <RecycleIcon className="text-primary size-5" aria-hidden="true" />
          <span className="text-foreground hidden text-base font-semibold tracking-tight sm:inline">
            Kitar<span className="text-primary">Semula</span>
          </span>
        </div>
        <div className="max-w-xl min-w-0 flex-1">
          <SearchBar value={searchInput} onChange={handleSearchChange} />
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <LocationButton onLocation={handleLocation} />
        </div>
      </header>

      {/* Main layout: map + sidebar */}
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden md:flex-row">
        {/* Map — 38dvh on mobile, expandable; full height on desktop */}
        <main
          className={cn(
            'relative isolate order-1 md:order-2 md:h-full md:min-h-0 md:flex-1',
            mapExpanded ? 'min-h-0 flex-1' : 'h-[38dvh] shrink-0',
          )}
          aria-label="Map section"
        >
          <RecyclingMap
            centers={centerList}
            selectedId={selectedCenter?.id}
            userLocation={userLocation}
            onSelectCenter={setSelectedCenter}
          />
          <MapLegend />
          <button
            type="button"
            onClick={() => setMapExpanded((expanded) => !expanded)}
            className="bg-background/95 border-border hover:bg-muted absolute top-3 right-3 z-[500] inline-flex size-11 items-center justify-center rounded-lg border shadow-sm backdrop-blur-sm transition-colors md:hidden"
            aria-label={mapExpanded ? 'Show center list' : 'Expand map'}
            aria-pressed={mapExpanded}
          >
            {mapExpanded ? (
              <Minimize2Icon className="size-5" aria-hidden="true" />
            ) : (
              <Maximize2Icon className="size-5" aria-hidden="true" />
            )}
          </button>
        </main>

        {/* Sidebar: filters + list */}
        <aside
          className={cn(
            'border-border order-2 min-h-0 flex-1 flex-col overflow-hidden md:order-1 md:flex md:w-[420px] md:flex-none md:border-r',
            mapExpanded ? 'hidden md:flex' : 'flex',
          )}
          aria-label="Center list"
        >
          {/* Mobile quick filters */}
          <div className="border-border bg-background flex shrink-0 items-center gap-2 border-b px-3 py-2 md:hidden">
            <Sheet>
              <SheetTrigger
                render={<Button variant="outline" className="h-10 shrink-0 gap-1.5 px-3 text-sm" />}
              >
                <SlidersHorizontalIcon className="size-4" aria-hidden="true" />
                Filters
                {activeFilterCount > 0 && (
                  <span className="bg-primary text-primary-foreground inline-flex size-5 items-center justify-center rounded-full text-[11px] font-semibold">
                    {activeFilterCount}
                  </span>
                )}
              </SheetTrigger>
              <SheetContent side="bottom" className="max-h-[85dvh] gap-0 p-0">
                <div
                  className="bg-border mx-auto mt-2 h-1.5 w-10 shrink-0 rounded-full"
                  aria-hidden="true"
                />
                <SheetHeader className="px-4 pt-3 pb-2">
                  <SheetTitle>Filters</SheetTitle>
                  <SheetDescription>
                    Narrow results by state, sort order, and accepted items.
                  </SheetDescription>
                </SheetHeader>
                <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4">
                  <FilterPanel
                    variant="sheet"
                    filters={filters}
                    onChange={handleFiltersChange}
                    resultCount={centerList.length}
                  />
                </div>
                <SheetFooter className="border-border border-t p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
                  <SheetClose render={<Button className="h-11 w-full text-sm" />}>
                    Show {resultLabel}
                  </SheetClose>
                </SheetFooter>
              </SheetContent>
            </Sheet>

            <button
              type="button"
              onClick={() => handleFiltersChange({ ...filters, open_now: !filters.open_now })}
              className={cn(
                'inline-flex h-10 shrink-0 items-center rounded-lg border px-3 text-sm font-medium transition-colors',
                filters.open_now
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-background text-foreground border-border hover:bg-muted',
              )}
              aria-pressed={filters.open_now}
            >
              Open now
            </button>

            <span className="text-muted-foreground ml-auto shrink-0 text-xs">{resultLabel}</span>
          </div>

          {/* Desktop filters */}
          <div className="border-border bg-background hidden shrink-0 border-b px-3 pt-3 pb-2 md:block">
            <FilterPanel
              filters={filters}
              onChange={handleFiltersChange}
              resultCount={centerList.length}
            />
          </div>

          {/* Scrollable list */}
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
            <CenterList
              centers={centerList}
              selectedId={selectedCenter?.id}
              isLoading={isLoading}
            />
          </div>
        </aside>
      </div>
      <StateOnboardingDialog open={statePromptOpen} onSelect={handleStateSelect} />
    </div>
  );
}
