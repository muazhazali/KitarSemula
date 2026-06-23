'use client';

import Image from 'next/image';
import Link from 'next/link';
import { MapPinIcon, ThumbsUpIcon, NavigationIcon, ClockIcon, CheckCircleIcon } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import type { RecyclingCenter } from '@/lib/types';
import { formatDistance, getTodayHours, isOpenNow } from '@/lib/utils/centers';
import { cn } from '@/lib/utils';

interface CenterCardProps {
  center: RecyclingCenter;
  isSelected?: boolean;
  onSelect?: () => void;
}

export function CenterCard({ center, isSelected, onSelect }: CenterCardProps) {
  const openNow = isOpenNow(center);
  const todayHours = getTodayHours(center);

  const statusBadgeVariant = () => {
    if (center.status === 'ACTIVE' && openNow) return 'default';
    if (center.status === 'CLOSED') return 'destructive';
    return 'secondary';
  };

  const statusLabel = () => {
    if (center.status === 'ACTIVE') return openNow ? 'Open Now' : 'Closed Now';
    if (center.status === 'CLOSED') return 'Permanently Closed';
    if (center.status === 'TEMPORARILY_CLOSED') return 'Temp. Closed';
    return 'Unknown';
  };

  return (
    <div
      className={cn(
        'group bg-card hover:border-primary/30 relative flex cursor-pointer gap-3 rounded-xl border p-3 transition-all hover:shadow-md',
        isSelected && 'ring-primary border-primary shadow-md ring-2',
      )}
      onClick={onSelect}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') onSelect?.();
      }}
      aria-label={`${center.name} — ${statusLabel()}`}
      aria-pressed={isSelected}
    >
      {/* Thumbnail */}
      <div className="bg-muted size-20 shrink-0 overflow-hidden rounded-lg">
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
      <div className="flex min-w-0 flex-1 flex-col gap-1">
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
          <MapPinIcon className="text-muted-foreground mt-0.5 size-3 shrink-0" aria-hidden="true" />
          <p className="text-muted-foreground line-clamp-1 text-xs">
            {center.distance_km != null && (
              <span className="text-foreground font-medium">
                {formatDistance(center.distance_km)} ·{' '}
              </span>
            )}
            {center.area}, {center.state}
          </p>
        </div>

        {/* Items */}
        <div className="mt-0.5 flex flex-wrap gap-1">
          {center.accepted_items.slice(0, 3).map((item) => (
            <span
              key={item}
              className="bg-secondary text-secondary-foreground inline-block rounded-full px-1.5 py-0.5 text-[10px] font-medium"
            >
              {item}
            </span>
          ))}
          {center.accepted_items.length > 3 && (
            <span className="bg-muted text-muted-foreground inline-block rounded-full px-1.5 py-0.5 text-[10px] font-medium">
              +{center.accepted_items.length - 3}
            </span>
          )}
        </div>

        {/* Bottom row */}
        <div className="mt-auto flex items-center justify-between pt-1">
          <div className="flex items-center gap-2">
            <Badge
              variant={statusBadgeVariant()}
              className="h-auto px-1.5 py-0.5 text-[10px] font-medium"
            >
              {statusLabel()}
            </Badge>
            <div className="text-muted-foreground flex items-center gap-1 text-[10px]">
              <ThumbsUpIcon className="size-3" aria-hidden="true" />
              {center.upvote_count}
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <Link
              href={`/center/${center.slug}`}
              className="text-primary text-[11px] font-medium hover:underline"
              onClick={(e) => e.stopPropagation()}
            >
              Details
            </Link>
            {center.google_maps_url && (
              <a
                href={center.google_maps_url}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="text-muted-foreground hover:text-primary inline-flex items-center gap-0.5 text-[11px] font-medium"
                aria-label={`Get directions to ${center.name}`}
              >
                <NavigationIcon className="size-3" aria-hidden="true" />
                Route
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
