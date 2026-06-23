import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getCenterBySlug } from '@/lib/utils/centers';
import { SEED_CENTERS } from '@/lib/seed-data';
import { CenterDetailClient } from '@/components/centers/center-detail-client';

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateStaticParams() {
  return SEED_CENTERS.map((c) => ({ slug: c.slug }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const center = getCenterBySlug(slug);

  if (!center) {
    return { title: 'Center Not Found | KitarSemula.app' };
  }

  const itemsList = center.accepted_items.slice(0, 5).join(', ');
  const description =
    `Recycling center in ${center.area}, ${center.state}. Accepts: ${itemsList}. ${center.notes ?? ''}`.trim();

  return {
    title: center.name,
    description,
    openGraph: {
      title: `${center.name} | KitarSemula.app`,
      description,
      type: 'website',
      images: center.thumbnail_url ? [{ url: center.thumbnail_url }] : [],
    },
  };
}

export default async function CenterPage({ params }: PageProps) {
  const { slug } = await params;
  const center = getCenterBySlug(slug);

  if (!center) notFound();

  // JSON-LD structured data
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'LocalBusiness',
    name: center.name,
    description: `Recycling center accepting: ${center.accepted_items.join(', ')}`,
    address: {
      '@type': 'PostalAddress',
      streetAddress: center.address,
      addressRegion: center.state,
      addressCountry: 'MY',
    },
    geo: {
      '@type': 'GeoCoordinates',
      latitude: center.latitude,
      longitude: center.longitude,
    },
    ...(center.phone && { telephone: center.phone }),
    ...(center.website_url && { url: center.website_url }),
    ...(center.thumbnail_url && { image: center.thumbnail_url }),
    openingHours: Object.entries(center.opening_hours)
      .filter(([, v]) => v)
      .map(([day, hours]) => {
        const dayCode = day.slice(0, 2).replace(/^(.)/, (c) => c.toUpperCase());
        return `${dayCode} ${hours}`;
      }),
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <CenterDetailClient center={center} />
    </>
  );
}
