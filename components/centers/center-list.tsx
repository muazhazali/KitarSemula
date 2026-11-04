'use client';

import { useEffect, useRef } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { CenterCard } from './center-card';
import type { RecyclingCenter } from '@/lib/types';
import { MapPinIcon } from 'lucide-react';

interface CenterListProps {
  centers: RecyclingCenter[];
  selectedId?: string;
  isLoading?: boolean;
}

export function CenterList({ centers, selectedId, isLoading }: CenterListProps) {
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!selectedId || !listRef.current) return;

    const cards = Array.from(listRef.current.querySelectorAll<HTMLElement>('[data-center-id]'));
    const selected = cards.find((card) => card.dataset.centerId === selectedId);
    selected?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [selectedId]);

  if (isLoading) {
    return (
      <div className="flex flex-col gap-3 p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex gap-3 rounded-xl border p-3">
            <Skeleton className="size-20 shrink-0 rounded-lg" />
            <div className="flex flex-1 flex-col gap-2">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-1/2" />
              <Skeleton className="h-3 w-2/3" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (centers.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center px-4 py-16 text-center">
        <div className="bg-muted mb-3 flex size-12 items-center justify-center rounded-full">
          <MapPinIcon className="text-muted-foreground size-6" aria-hidden="true" />
        </div>
        <p className="text-foreground text-sm font-semibold">No centers found</p>
        <p className="text-muted-foreground mt-1 text-xs">Try adjusting your search or filters</p>
      </div>
    );
  }

  return (
    <div
      ref={listRef}
      className="flex flex-col gap-2.5 p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]"
    >
      {centers.map((center) => (
        <CenterCard key={center.id} center={center} isSelected={center.id === selectedId} />
      ))}
    </div>
  );
}
