'use client';

import { useEffect, useRef, useState } from 'react';
import type { RecyclingCenter } from '@/lib/types';
import { getMarkerColor, isOpenNow, formatDistance } from '@/lib/utils/centers';

interface RecyclingMapProps {
  centers: RecyclingCenter[];
  selectedId?: string;
  userLocation?: { lat: number; lng: number };
  onSelectCenter?: (center: RecyclingCenter) => void;
}

type LeafletNamespace = typeof import('leaflet');

const MARKER_COLORS = {
  green: '#16a34a',
  red: '#dc2626',
  grey: '#6b7280',
  orange: '#ea580c',
};

/**
 * Markers use a 44x44 transparent hit area around a small colored dot so they
 * stay tappable on phones while keeping the visual size compact.
 */
function createCenterIcon(L: LeafletNamespace, color: string, isSelected: boolean) {
  const dotSize = isSelected ? 20 : 16;

  return L.divIcon({
    className: 'kitar-center-marker',
    html: `<span style="display:flex;align-items:center;justify-content:center;width:44px;height:44px;"><span style="display:block;width:${dotSize}px;height:${dotSize}px;border-radius:9999px;background:${color};border:${isSelected ? '3px solid #fff' : `1.5px solid ${color}`};box-shadow:0 1px 4px rgba(0,0,0,0.45);"></span></span>`,
    iconSize: [44, 44],
    iconAnchor: [22, 22],
    popupAnchor: [0, -16],
  });
}

export default function RecyclingMap({
  centers,
  selectedId,
  userLocation,
  onSelectCenter,
}: RecyclingMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const leafletMapRef = useRef<import('leaflet').Map | null>(null);
  const markersRef = useRef<Map<string, import('leaflet').Marker>>(new Map());
  const userMarkerRef = useRef<import('leaflet').CircleMarker | null>(null);
  const [mapReady, setMapReady] = useState(false);

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
      setMapReady(true);
      window.setTimeout(() => map.invalidateSize(), 0);
    };

    initMap();

    return () => {
      cancelled = true;
      leafletMapRef.current?.remove();
      leafletMapRef.current = null;
      setMapReady(false);
    };
  }, []);

  // Leaflet needs a nudge whenever the container height changes (mobile map expand).
  useEffect(() => {
    const map = leafletMapRef.current;
    const container = mapRef.current;
    if (!map || !mapReady || !container) return;

    const observer = new ResizeObserver(() => map.invalidateSize());
    observer.observe(container);
    return () => observer.disconnect();
  }, [mapReady]);

  // Update markers when centers change
  useEffect(() => {
    const map = leafletMapRef.current;
    if (!map || !mapReady) return;

    const updateMarkers = async () => {
      const L = (await import('leaflet')).default;

      // Remove old markers
      markersRef.current.forEach((m) => m.remove());
      markersRef.current.clear();

      centers.forEach((center) => {
        const color = MARKER_COLORS[getMarkerColor(center)];
        const openNow = isOpenNow(center);

        const marker = L.marker([center.latitude, center.longitude], {
          icon: createCenterIcon(L, color, false),
          title: center.name,
          riseOnHover: true,
          keyboard: true,
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
          `<div style="min-width:210px;font-family:system-ui,sans-serif">
            <strong style="font-size:14px;line-height:1.3">${center.name}</strong><br/>
            <span style="color:#374151;font-size:12px;display:block;margin:4px 0">${center.address}</span>
            ${distStr}
            <span style="font-size:12px;color:${statusColor};font-weight:600">${statusLabel}</span><br/>
            <span style="font-size:11px;color:#6b7280;margin-top:2px;display:block">${itemsShort}</span>
            <div style="margin-top:8px">
              <a href="/center/${center.slug}"
                style="display:inline-flex;align-items:center;min-height:44px;background:#16a34a;color:#fff;padding:8px 16px;border-radius:6px;font-size:13px;text-decoration:none;font-weight:600">
                View Details &rarr;
              </a>
            </div>
          </div>`,
          { maxWidth: 280, minWidth: 220, autoPanPadding: [24, 24] },
        );

        marker.on('click', () => {
          onSelectCenter?.(center);
        });

        marker.addTo(map);
        markersRef.current.set(center.id, marker);
      });

      // Keep the viewport focused on the current result set. Skip while the user
      // is navigating by location, where flyTo owns the viewport.
      if (centers.length > 0 && !userLocation) {
        const bounds = L.latLngBounds(
          centers.map((center) => [center.latitude, center.longitude] as [number, number]),
        );
        map.fitBounds(bounds, { padding: [32, 32], maxZoom: 12 });
      }
    };

    updateMarkers();
  }, [centers, userLocation, onSelectCenter, mapReady]);

  // Highlight the selected marker and bring it into view
  useEffect(() => {
    const map = leafletMapRef.current;
    if (!map || !mapReady || !selectedId) return;

    const updateSelected = async () => {
      const L = (await import('leaflet')).default;

      markersRef.current.forEach((marker, id) => {
        const center = centers.find((c) => c.id === id);
        if (!center) return;
        const color = MARKER_COLORS[getMarkerColor(center)];
        const isSelected = id === selectedId;

        marker.setIcon(createCenterIcon(L, color, isSelected));

        if (isSelected) {
          marker.openPopup();
          map.panTo([center.latitude, center.longitude], { animate: true });
        }
      });
    };

    updateSelected();
  }, [selectedId, centers, mapReady]);

  // Show user location
  useEffect(() => {
    const map = leafletMapRef.current;
    if (!map || !mapReady || !userLocation) return;

    const showLocation = async () => {
      const L = (await import('leaflet')).default;

      userMarkerRef.current?.remove();
      userMarkerRef.current = L.circleMarker([userLocation.lat, userLocation.lng], {
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
  }, [userLocation, mapReady]);

  return (
    <div
      ref={mapRef}
      className="h-full w-full"
      role="application"
      aria-label="Interactive map of recycling centers in Malaysia"
    />
  );
}
