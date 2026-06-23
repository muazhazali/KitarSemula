'use client';

import { useEffect, useRef } from 'react';
import type { RecyclingCenter } from '@/lib/types';
import { getMarkerColor, isOpenNow, formatDistance } from '@/lib/utils/centers';

interface RecyclingMapProps {
  centers: RecyclingCenter[];
  selectedId?: string;
  userLocation?: { lat: number; lng: number };
  onSelectCenter?: (center: RecyclingCenter) => void;
}

const MARKER_COLORS = {
  green: '#16a34a',
  red: '#dc2626',
  grey: '#6b7280',
  orange: '#ea580c',
};

export default function RecyclingMap({
  centers,
  selectedId,
  userLocation,
  onSelectCenter,
}: RecyclingMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const leafletMapRef = useRef<import('leaflet').Map | null>(null);
  const markersRef = useRef<Map<string, import('leaflet').CircleMarker>>(new Map());

  useEffect(() => {
    if (!mapRef.current || leafletMapRef.current) return;

    let cancelled = false;

    const initMap = async () => {
      const L = (await import('leaflet')).default;
      await import('leaflet/dist/leaflet.css');
      if (cancelled || !mapRef.current) return;

      const map = L.map(mapRef.current, {
        center: [4.2105, 108.9758],
        zoom: 6,
        zoomControl: true,
      });

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 19,
      }).addTo(map);

      leafletMapRef.current = map;
    };

    initMap();

    return () => {
      cancelled = true;
      leafletMapRef.current?.remove();
      leafletMapRef.current = null;
    };
  }, []);

  // Update markers when centers change
  useEffect(() => {
    const map = leafletMapRef.current;
    if (!map) return;

    const updateMarkers = async () => {
      const L = (await import('leaflet')).default;

      // Remove old markers
      markersRef.current.forEach((m) => m.remove());
      markersRef.current.clear();

      centers.forEach((center) => {
        const color = MARKER_COLORS[getMarkerColor(center)];
        const isSelected = center.id === selectedId;
        const openNow = isOpenNow(center);

        const marker = L.circleMarker([center.latitude, center.longitude], {
          radius: isSelected ? 12 : 8,
          fillColor: color,
          color: isSelected ? '#fff' : color,
          weight: isSelected ? 3 : 1.5,
          opacity: 1,
          fillOpacity: isSelected ? 1 : 0.85,
        });

        const distStr =
          center.distance_km != null
            ? `<span style="color:#6b7280;font-size:12px">${formatDistance(center.distance_km)} away</span><br/>`
            : '';

        const itemsShort =
          center.accepted_items.slice(0, 4).join(', ') +
          (center.accepted_items.length > 4 ? `… +${center.accepted_items.length - 4}` : '');

        const statusColor = openNow ? '#16a34a' : '#dc2626';
        const statusLabel = openNow
          ? 'Open Now'
          : center.status === 'ACTIVE'
            ? 'Closed Now'
            : center.status.replace('_', ' ');

        marker.bindPopup(
          `<div style="min-width:200px;font-family:system-ui,sans-serif">
            <strong style="font-size:14px;line-height:1.3">${center.name}</strong><br/>
            <span style="color:#374151;font-size:12px;display:block;margin:4px 0">${center.address}</span>
            ${distStr}
            <span style="font-size:12px;color:${statusColor};font-weight:600">${statusLabel}</span><br/>
            <span style="font-size:11px;color:#6b7280;margin-top:2px;display:block">${itemsShort}</span>
            <div style="margin-top:8px">
              <a href="/center/${center.slug}"
                style="display:inline-block;background:#16a34a;color:#fff;padding:4px 12px;border-radius:4px;font-size:12px;text-decoration:none;font-weight:600">
                View Details &rarr;
              </a>
            </div>
          </div>`,
          { maxWidth: 260 },
        );

        marker.on('click', () => {
          onSelectCenter?.(center);
        });

        marker.addTo(map);
        markersRef.current.set(center.id, marker);
      });
    };

    updateMarkers();
  }, [centers, selectedId, onSelectCenter]);

  // Update selected marker size
  useEffect(() => {
    const map = leafletMapRef.current;
    if (!map || !selectedId) return;

    const updateSelected = async () => {
      const L = (await import('leaflet')).default;

      markersRef.current.forEach((marker, id) => {
        const center = centers.find((c) => c.id === id);
        if (!center) return;
        const color = MARKER_COLORS[getMarkerColor(center)];
        const isSelected = id === selectedId;

        (marker as ReturnType<typeof L.circleMarker>).setStyle({
          radius: isSelected ? 12 : 8,
          fillOpacity: isSelected ? 1 : 0.85,
          weight: isSelected ? 3 : 1.5,
          color: isSelected ? '#fff' : color,
        });

        if (isSelected) {
          marker.openPopup();
          map.panTo([center.latitude, center.longitude], { animate: true });
        }
      });
    };

    updateSelected();
  }, [selectedId, centers]);

  // Show user location
  useEffect(() => {
    const map = leafletMapRef.current;
    if (!map || !userLocation) return;

    const showLocation = async () => {
      const L = (await import('leaflet')).default;

      L.circleMarker([userLocation.lat, userLocation.lng], {
        radius: 8,
        fillColor: '#2563eb',
        color: '#fff',
        weight: 2,
        fillOpacity: 1,
      })
        .bindTooltip('You are here', { permanent: false })
        .addTo(map);

      map.flyTo([userLocation.lat, userLocation.lng], 12, { animate: true, duration: 1.5 });
    };

    showLocation();
  }, [userLocation]);

  return (
    <div
      ref={mapRef}
      className="h-full w-full"
      role="application"
      aria-label="Interactive map of recycling centers in Malaysia"
    />
  );
}
