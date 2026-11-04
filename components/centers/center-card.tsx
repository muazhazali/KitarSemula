'use client';

import Image from 'next/image';
import Link from 'next/link';
import { MapPinIcon, ThumbsUpIcon, NavigationIcon, CheckCircleIcon } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import type { RecyclingCenter } from '@/lib/types';
import { formatDistance, isOpenNow } from '@/lib/utils/centers';
import { cn } from '@/lib/utils';

interface CenterCardProps {
  center: RecyclingCenter;
  isSelected?: boolean;
}

export function CenterCard({ center, isSelected }: CenterCardProps) {
  const openNow = isOpenNow(center);

  const statusBadgeVariant = () => {
    if (center.status === 'CLOSED') return 'destructive';
    if (center.status === 'ACTIVE' && openNow) return 'default';
    return 'outline';
  };

  const statusLabel = () => {
    if (center.status === 'ACTIVE') return openNow ? 'Open Now' : 'Closed Now';
    if (center.status === 'CLOSED') return 'Permanently Closed';
    if (center.status === 'TEMPORARILY_CLOSED') return 'Temp. Closed';
    return 'Unknown';
  };

  return (
    <div
      data-center-id={center.id}
      className={cn(
        'group bg-card hover:border-primary/30 focus-within:ring-primary/40 relative flex gap-3 rounded-xl border p-3 transition-all focus-within:ring-2 hover:shadow-md',
        isSelected && 'ring-primary border-primary shadow-md ring-2',
      )}
    >
      {/* Whole card is a link; the Route action sits above it. */}
      <Link
        href={`/center/${center.slug}`}
        className="absolute inset-0 z-0 rounded-xl focus-visible:outline-none"
        aria-label={`View details for ${center.name} — ${statusLabel()}`}
      />

      {/* Thumbnail */}
      <div className="bg-muted size-[72px] shrink-0 overflow-hidden rounded-lg sm:size-20">
        {center.thumbnail_url ? (
          <Image
            src={center.thumbnail_url}
            alt={`Photo of ${center.name}`}
            width={80}
            height={80}
            className="size-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className="flex size-full items-center justify-center">
            <MapPinIcon className="text-muted-foreground size-6" aria-hidden="true" />
          </div>
        )}
      </div>

      {/* Content */}
      <div className="pointer-events-none relative z-[1] flex min-w-0 flex-1 flex-col gap-1">
        {/* Name + verification */}
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-foreground line-clamp-2 text-sm leading-tight font-semibold">
            {center.name}
          </h3>
          {center.verification_status === 'VERIFIED' && (
            <CheckCircleIcon
              className="text-primary mt-0.5 size-4 shrink-0"
              aria-label="Verified center"
            />
          )}
        </div>

        {/* Distance + address */}
        <div className="flex items-start gap-1">
          <MapPinIcon
            className="text-muted-foreground mt-0.5 size-3.5 shrink-0"
            aria-hidden="true"
          />
          <p className="text-muted-foreground line-clamp-1 text-xs">
            {center.distance_km != null && (
              <span className="text-foreground font-medium">
                {formatDistance(center.distance_km)} ·{' '}
              </span>
            )}
            {center.area ? `${center.area}, ` : ''}
            {center.state}
          </p>
        </div>

        {/* Items */}
        <div className="mt-0.5 flex flex-wrap gap-1">
          {center.accepted_items.slice(0, 3).map((item) => (
            <span
              key={item}
              className="bg-secondary text-secondary-foreground inline-block rounded-full px-1.5 py-0.5 text-[11px] font-medium"
            >
              {item}
            </span>
          ))}
          {center.accepted_items.length > 3 && (
            <span className="bg-muted text-muted-foreground inline-block rounded-full px-1.5 py-0.5 text-[11px] font-medium">
              +{center.accepted_items.length - 3}
            </span>
          )}
        </div>

        {/* Bottom row */}
        <div className="mt-auto flex items-center justify-between gap-2 pt-1">
          <div className="flex min-w-0 items-center gap-2">
            <Badge
              variant={statusBadgeVariant()}
              className={cn(
                'h-auto px-1.5 py-0.5 text-[11px] font-medium',
                center.status === 'ACTIVE' && !openNow && 'text-muted-foreground',
              )}
            >
              {statusLabel()}
            </Badge>
            <div className="text-muted-foreground flex items-center gap-1 text-[11px]">
              <ThumbsUpIcon className="size-3.5" aria-hidden="true" />
              {center.upvote_count}
            </div>
          </div>

          {center.google_maps_url && (
            <a
              href={center.google_maps_url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-muted-foreground hover:text-primary pointer-events-auto -mr-1 inline-flex min-h-11 items-center gap-1 rounded-lg px-2 text-xs font-medium transition-colors"
              aria-label={`Get directions to ${center.name}`}
            >
              <NavigationIcon className="size-3.5" aria-hidden="true" />
              Route
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
