'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';
import {
  ArrowLeftIcon,
  MapPinIcon,
  PhoneIcon,
  GlobeIcon,
  NavigationIcon,
  CheckCircleIcon,
  ClockIcon,
  RecycleIcon,
  ChevronRightIcon,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { VoteButtons } from './vote-buttons';
import { OpeningHoursTable } from './opening-hours';
import type { RecyclingCenter } from '@/lib/types';
import { isOpenNow, getTodayHours } from '@/lib/utils/centers';

const DetailMap = dynamic(() => import('@/components/map/detail-map'), {
  ssr: false,
  loading: () => <div className="bg-muted h-full w-full animate-pulse rounded-lg" />,
});

interface CenterDetailClientProps {
  center: RecyclingCenter;
}

export function CenterDetailClient({ center }: CenterDetailClientProps) {
  const openNow = isOpenNow(center);
  const todayHours = getTodayHours(center);

  const statusVariant = () => {
    if (center.status === 'ACTIVE' && openNow) return 'default';
    if (center.status === 'CLOSED') return 'destructive';
    return 'secondary';
  };

  const statusLabel = () => {
    if (center.status === 'ACTIVE') return openNow ? 'Open Now' : 'Closed Now';
    if (center.status === 'CLOSED') return 'Permanently Closed';
    if (center.status === 'TEMPORARILY_CLOSED') return 'Temporarily Closed';
    return 'Status Unknown';
  };

  return (
    <div className="bg-background min-h-screen">
      {/* Top nav */}
      <header className="bg-background/95 border-border sticky top-0 z-20 flex items-center gap-3 border-b px-4 py-3 backdrop-blur-sm">
        <Link
          href="/"
          className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 text-sm font-medium transition-colors"
          aria-label="Back to map"
        >
          <ArrowLeftIcon className="size-4" aria-hidden="true" />
          <span className="hidden sm:inline">Back to Map</span>
        </Link>
        <Separator orientation="vertical" className="h-4" />
        <div className="flex min-w-0 items-center gap-1.5">
          <RecycleIcon className="text-primary size-4 shrink-0" aria-hidden="true" />
          <span className="text-foreground truncate text-sm font-semibold">
            Kitar<span className="text-primary">Semula</span>
          </span>
        </div>
      </header>

      <main className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-6">
        {/* Hero / name section */}
        <section>
          {/* Breadcrumb */}
          <nav
            aria-label="Breadcrumb"
            className="text-muted-foreground mb-3 flex items-center gap-1 text-xs"
          >
            <Link href="/" className="hover:text-foreground transition-colors">
              Home
            </Link>
            <ChevronRightIcon className="size-3" aria-hidden="true" />
            <span>{center.state}</span>
            <ChevronRightIcon className="size-3" aria-hidden="true" />
            <span className="text-foreground max-w-[180px] truncate">{center.name}</span>
          </nav>

          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <h1 className="text-foreground mb-2 text-xl leading-tight font-bold text-balance">
                {center.name}
              </h1>
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant={statusVariant()} className="font-medium">
                  {statusLabel()}
                </Badge>
                {center.verification_status === 'VERIFIED' && (
                  <Badge variant="outline" className="text-primary border-primary/30 gap-1">
                    <CheckCircleIcon className="size-3" aria-hidden="true" />
                    Verified
                  </Badge>
                )}
                {center.verification_status === 'UNVERIFIED' && (
                  <Badge variant="outline" className="border-orange-300 text-orange-600">
                    Unverified
                  </Badge>
                )}
              </div>
            </div>

            {/* Voting */}
            <VoteButtons
              slug={center.slug}
              initialUpvotes={center.upvote_count}
              initialDownvotes={center.downvote_count}
            />
          </div>
        </section>

        {/* Map preview */}
        <div className="border-border h-52 overflow-hidden rounded-xl border shadow-sm sm:h-64">
          <DetailMap lat={center.latitude} lng={center.longitude} name={center.name} />
        </div>

        {/* Info grid */}
        <section aria-labelledby="info-heading" className="grid gap-4 sm:grid-cols-2">
          <h2 id="info-heading" className="sr-only">
            Center Information
          </h2>

          {/* Address */}
          <div className="flex gap-3">
            <MapPinIcon
              className="text-muted-foreground mt-0.5 size-4 shrink-0"
              aria-hidden="true"
            />
            <div>
              <p className="text-muted-foreground mb-0.5 text-xs font-medium">Address</p>
              <p className="text-foreground text-sm">{center.address}</p>
              <p className="text-muted-foreground mt-0.5 text-xs">
                {center.area}, {center.state}
              </p>
            </div>
          </div>

          {/* Today hours */}
          <div className="flex gap-3">
            <ClockIcon
              className="text-muted-foreground mt-0.5 size-4 shrink-0"
              aria-hidden="true"
            />
            <div>
              <p className="text-muted-foreground mb-0.5 text-xs font-medium">Today&apos;s Hours</p>
              <p className={`text-sm font-medium ${openNow ? 'text-primary' : 'text-foreground'}`}>
                {todayHours}
              </p>
            </div>
          </div>

          {/* Phone */}
          {center.phone && (
            <div className="flex gap-3">
              <PhoneIcon
                className="text-muted-foreground mt-0.5 size-4 shrink-0"
                aria-hidden="true"
              />
              <div>
                <p className="text-muted-foreground mb-0.5 text-xs font-medium">Phone</p>
                <a href={`tel:${center.phone}`} className="text-primary text-sm hover:underline">
                  {center.phone}
                </a>
              </div>
            </div>
          )}

          {/* Website */}
          {center.website_url && (
            <div className="flex gap-3">
              <GlobeIcon
                className="text-muted-foreground mt-0.5 size-4 shrink-0"
                aria-hidden="true"
              />
              <div>
                <p className="text-muted-foreground mb-0.5 text-xs font-medium">Website</p>
                <a
                  href={center.website_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary text-sm break-all hover:underline"
                >
                  {center.website_url.replace(/^https?:\/\//, '')}
                </a>
              </div>
            </div>
          )}
        </section>

        {/* Route button */}
        {center.google_maps_url && (
          <a
            href={center.google_maps_url}
            target="_blank"
            rel="noopener noreferrer"
            className="bg-primary text-primary-foreground hover:bg-primary/90 inline-flex w-full items-center justify-center gap-2 rounded-lg px-5 py-2.5 text-sm font-semibold transition-colors sm:w-auto"
          >
            <NavigationIcon className="size-4" aria-hidden="true" />
            Get Directions via Google Maps
          </a>
        )}

        <Separator />

        {/* Accepted items */}
        <section aria-labelledby="items-heading">
          <h2 id="items-heading" className="text-foreground mb-3 text-base font-semibold">
            Accepted Items
          </h2>
          <div className="flex flex-wrap gap-2">
            {center.accepted_items.map((item) => (
              <span
                key={item}
                className="bg-secondary text-secondary-foreground border-border inline-flex items-center rounded-full border px-3 py-1 text-sm font-medium"
              >
                {item}
              </span>
            ))}
          </div>
          {center.tags.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {center.tags.map((tag) => (
                <span
                  key={tag}
                  className="text-muted-foreground border-border rounded-md border px-2 py-0.5 text-xs"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}
        </section>

        <Separator />

        {/* Opening hours */}
        <section aria-labelledby="hours-heading">
          <h2 id="hours-heading" className="text-foreground mb-3 text-base font-semibold">
            Opening Hours
          </h2>
          <OpeningHoursTable hours={center.opening_hours} />
        </section>

        {/* Notes */}
        {center.notes && (
          <>
            <Separator />
            <section aria-labelledby="notes-heading">
              <h2 id="notes-heading" className="text-foreground mb-2 text-base font-semibold">
                Notes
              </h2>
              <p className="text-muted-foreground text-sm leading-relaxed">{center.notes}</p>
            </section>
          </>
        )}

        <Separator />

        {/* Actions footer */}
        <section aria-label="Center actions" className="flex flex-wrap gap-2 pb-6">
          <div className="text-muted-foreground ml-auto self-center text-xs">
            Last updated{' '}
            {new Date(center.updated_at).toLocaleDateString('en-MY', {
              year: 'numeric',
              month: 'short',
              day: 'numeric',
            })}
          </div>
        </section>
      </main>
    </div>
  );
}
