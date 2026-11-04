'use client';

import dynamic from 'next/dynamic';
import { useState, useCallback, useMemo, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { RecycleIcon } from 'lucide-react';
import { SearchBar } from '@/components/search/search-bar';
import { FilterPanel } from '@/components/search/filter-panel';
import { CenterList } from '@/components/centers/center-list';
import { LocationButton } from '@/components/map/location-button';
import { MapLegend } from '@/components/map/map-legend';
import { StateOnboardingDialog } from '@/components/home/state-onboarding-dialog';
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
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState<Partial<SearchParams>>({
    sort: 'recently_updated',
  });
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | undefined>();
  const [selectedCenter, setSelectedCenter] = useState<RecyclingCenter | undefined>();
  const [statePromptOpen, setStatePromptOpen] = useState(false);

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

  return (
    <div className="bg-background flex h-screen flex-col overflow-hidden">
      {/* Header */}
      <header className="border-border bg-background z-10 flex shrink-0 items-center gap-3 border-b px-4 py-3">
        <div className="flex items-center gap-2">
          <RecycleIcon className="text-primary size-5" aria-hidden="true" />
          <span className="text-foreground text-base font-semibold tracking-tight">
            Kitar<span className="text-primary">Semula</span>
          </span>
        </div>
        <div className="max-w-xl flex-1">
          <SearchBar value={searchQuery} onChange={setSearchQuery} />
        </div>
        <div className="ml-auto flex items-center gap-2">
          <LocationButton onLocation={handleLocation} />
        </div>
      </header>

      {/* Main layout: map + sidebar */}
      <div className="flex flex-1 flex-col overflow-hidden md:flex-row">
        {/* Map — full width on mobile, ~60% on desktop */}
        <main
          className="relative isolate order-1 h-[45vh] shrink-0 md:order-2 md:h-full md:flex-1"
          aria-label="Map section"
        >
          <RecyclingMap
            centers={centerList}
            selectedId={selectedCenter?.id}
            userLocation={userLocation}
            onSelectCenter={setSelectedCenter}
          />
          <MapLegend />
        </main>

        {/* Sidebar: filters + list */}
        <aside
          className="border-border order-2 flex shrink-0 flex-col overflow-hidden border-r md:order-1 md:w-[420px]"
          aria-label="Center list"
        >
          {/* Filters */}
          <div className="border-border bg-background shrink-0 border-b px-3 pt-3 pb-2">
            <FilterPanel
              filters={filters}
              onChange={handleFiltersChange}
              resultCount={centerList.length}
            />
          </div>

          {/* Scrollable list */}
          <div className="flex-1 overflow-y-auto">
            <CenterList
              centers={centerList}
              selectedId={selectedCenter?.id}
              isLoading={isLoading}
              onSelectCenter={setSelectedCenter}
            />
          </div>
        </aside>
      </div>
      <StateOnboardingDialog open={statePromptOpen} onSelect={handleStateSelect} />
    </div>
  );
}
