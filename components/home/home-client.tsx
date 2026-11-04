'use client';

import dynamic from 'next/dynamic';
import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  ChevronDownIcon,
  ChevronUpIcon,
  Maximize2Icon,
  Minimize2Icon,
  PlusIcon,
  RecycleIcon,
  SlidersHorizontalIcon,
} from 'lucide-react';
import { SearchBar } from '@/components/search/search-bar';
import { FilterPanel, countActiveFilters } from '@/components/search/filter-panel';
import { CenterList } from '@/components/centers/center-list';
import { SuggestCenterDialog } from '@/components/centers/suggest-center-dialog';
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
import { loadSelectedCenterSlug, saveSelectedCenterSlug } from '@/lib/view-state';
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
const PEEK_HEIGHT = 112;

type SheetSnap = 'peek' | 'half' | 'full';

const SHEET_SNAP_CLASSES: Record<SheetSnap, string> = {
  peek: 'h-[calc(7rem+env(safe-area-inset-bottom))]',
  half: 'h-[44dvh]',
  full: 'h-[calc(100dvh-4.5rem)]',
};

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
  const [suggestOpen, setSuggestOpen] = useState(false);
  const [sheetSnap, setSheetSnap] = useState<SheetSnap>('half');
  const [dragHeight, setDragHeight] = useState<number | null>(null);
  const sheetRef = useRef<HTMLElement>(null);
  const restoredSlugRef = useRef<string | null>(null);
  const sheetDragRef = useRef<{
    startY: number;
    startHeight: number;
    currentHeight: number;
    moved: boolean;
  } | null>(null);

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

  // Restore the center that was open before navigating to its detail page.
  useEffect(() => {
    restoredSlugRef.current = loadSelectedCenterSlug();
  }, []);

  useEffect(() => {
    if (!centers) return;
    const slug = restoredSlugRef.current;
    if (!slug) return;
    restoredSlugRef.current = null;
    const match = centers.find((center) => center.slug === slug);
    if (match) setSelectedCenter(match);
  }, [centers]);

  useEffect(() => {
    if (selectedCenter) saveSelectedCenterSlug(selectedCenter.slug);
  }, [selectedCenter]);

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

  const getSnapHeights = useCallback((): Record<SheetSnap, number> => {
    const parentHeight =
      sheetRef.current?.parentElement?.getBoundingClientRect().height ?? window.innerHeight;

    return {
      peek: PEEK_HEIGHT,
      half: Math.round(window.innerHeight * 0.44),
      full: Math.max(PEEK_HEIGHT, parentHeight - 8),
    };
  }, []);

  const handleSheetPointerDown = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    if ((event.target as HTMLElement).closest('button')) return;
    if (event.pointerType === 'mouse' && event.button !== 0) return;

    const sheet = sheetRef.current;
    if (!sheet) return;

    const height = sheet.getBoundingClientRect().height;
    sheetDragRef.current = {
      startY: event.clientY,
      startHeight: height,
      currentHeight: height,
      moved: false,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  }, []);

  const handleSheetPointerMove = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      const drag = sheetDragRef.current;
      if (!drag) return;

      const delta = drag.startY - event.clientY;
      if (Math.abs(delta) > 6) drag.moved = true;

      const heights = getSnapHeights();
      const next = Math.min(heights.full, Math.max(heights.peek, drag.startHeight + delta));
      drag.currentHeight = next;
      setDragHeight(next);
    },
    [getSnapHeights],
  );

  const handleSheetPointerEnd = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      const drag = sheetDragRef.current;
      if (!drag) return;

      sheetDragRef.current = null;
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }

      if (!drag.moved) {
        setDragHeight(null);
        setSheetSnap((snap) => (snap === 'peek' ? 'half' : 'peek'));
        return;
      }

      const heights = getSnapHeights();
      const nearest = (Object.keys(heights) as SheetSnap[]).reduce((best, snap) =>
        Math.abs(heights[snap] - drag.currentHeight) < Math.abs(heights[best] - drag.currentHeight)
          ? snap
          : best,
      );

      setSheetSnap(nearest);
      setDragHeight(null);
    },
    [getSnapHeights],
  );

  const cycleSheetSnap = useCallback(() => {
    setDragHeight(null);
    setSheetSnap((snap) => (snap === 'peek' ? 'half' : snap === 'half' ? 'full' : 'peek'));
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
          <Button
            variant="outline"
            size="icon"
            onClick={() => setSuggestOpen(true)}
            className="border-border bg-background size-11 shadow-sm sm:w-auto sm:gap-1.5 sm:px-3"
            aria-label="Add a recycling center"
            title="Add a recycling center"
          >
            <PlusIcon className="size-5 sm:size-4" aria-hidden="true" />
            <span className="hidden text-sm font-medium sm:inline">Add center</span>
          </Button>
          <LocationButton onLocation={handleLocation} />
        </div>
      </header>

      {/* Main layout: map + sidebar */}
      <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden md:flex-row">
        {/* Map — full-height behind the mobile sheet on phones */}
        <main
          className="relative isolate order-1 h-full min-h-0 flex-1 md:order-2"
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
            onClick={() => {
              setDragHeight(null);
              setSheetSnap((snap) => (snap === 'peek' ? 'half' : 'peek'));
            }}
            className="bg-background/95 border-border hover:bg-muted absolute top-3 right-3 z-[500] inline-flex size-11 items-center justify-center rounded-lg border shadow-sm backdrop-blur-sm transition-colors md:hidden"
            aria-label={sheetSnap === 'peek' ? 'Show center list' : 'Expand map'}
            aria-pressed={sheetSnap !== 'peek'}
          >
            {sheetSnap === 'peek' ? (
              <Minimize2Icon className="size-5" aria-hidden="true" />
            ) : (
              <Maximize2Icon className="size-5" aria-hidden="true" />
            )}
          </button>
        </main>

        {/* Mobile: draggable bottom sheet. Desktop: fixed sidebar. */}
        <aside
          ref={sheetRef}
          style={dragHeight !== null ? { height: dragHeight } : undefined}
          className={cn(
            'bg-background border-border absolute inset-x-0 bottom-0 z-30 flex flex-col overflow-hidden rounded-t-2xl border-t pb-[env(safe-area-inset-bottom)] shadow-[0_-12px_32px_rgba(0,0,0,0.18)]',
            'md:static md:order-1 md:h-auto md:w-[420px] md:flex-none md:rounded-none md:border-t-0 md:border-r md:pb-0 md:shadow-none',
            dragHeight === null && 'transition-[height] duration-200 ease-out',
            SHEET_SNAP_CLASSES[sheetSnap],
          )}
          aria-label="Center list"
        >
          {/* Drag handle */}
          <div
            className="relative flex h-9 shrink-0 cursor-grab touch-none items-center justify-center select-none active:cursor-grabbing md:hidden"
            onPointerDown={handleSheetPointerDown}
            onPointerMove={handleSheetPointerMove}
            onPointerUp={handleSheetPointerEnd}
            onPointerCancel={handleSheetPointerEnd}
          >
            <span className="bg-border h-1.5 w-10 rounded-full" aria-hidden="true" />
            <span className="text-muted-foreground absolute left-3 text-xs font-medium">
              {resultLabel}
            </span>
            <button
              type="button"
              onClick={cycleSheetSnap}
              className="text-muted-foreground hover:bg-muted absolute right-1 inline-flex size-9 items-center justify-center rounded-md transition-colors"
              aria-label={
                sheetSnap === 'peek'
                  ? 'Show center list'
                  : sheetSnap === 'half'
                    ? 'Expand center list'
                    : 'Collapse center list'
              }
            >
              {sheetSnap === 'full' ? (
                <ChevronDownIcon className="size-4" aria-hidden="true" />
              ) : (
                <ChevronUpIcon className="size-4" aria-hidden="true" />
              )}
            </button>
          </div>

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
          <div
            className={cn(
              'min-h-0 flex-1 overflow-y-auto overscroll-contain',
              sheetSnap === 'peek' && dragHeight === null && 'hidden md:block',
            )}
          >
            <CenterList
              centers={centerList}
              selectedId={selectedCenter?.id}
              isLoading={isLoading}
            />
          </div>
        </aside>
      </div>
      <StateOnboardingDialog open={statePromptOpen} onSelect={handleStateSelect} />
      {suggestOpen && (
        <SuggestCenterDialog
          onClose={() => setSuggestOpen(false)}
          defaultState={filters.state && filters.state !== 'all' ? filters.state : undefined}
        />
      )}
    </div>
  );
}
