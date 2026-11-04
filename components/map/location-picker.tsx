'use client';

import { useEffect, useRef } from 'react';

export interface PickedLocation {
  lat: number;
  lng: number;
}

interface LocationPickerProps {
  value?: PickedLocation;
  onChange: (value: PickedLocation) => void;
}

const MALAYSIA_CENTER: [number, number] = [4.2105, 108.9758];

export default function LocationPicker({ value, onChange }: LocationPickerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<import('leaflet').Map | null>(null);
  const markerRef = useRef<import('leaflet').CircleMarker | null>(null);
  const observerRef = useRef<ResizeObserver | null>(null);
  const leafletRef = useRef<typeof import('leaflet') | null>(null);
  const onChangeRef = useRef(onChange);
  const valueRef = useRef(value);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    valueRef.current = value;
  }, [value]);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    let cancelled = false;

    const init = async () => {
      const L = (await import('leaflet')).default;
      await import('leaflet/dist/leaflet.css');
      if (cancelled || !containerRef.current) return;

      leafletRef.current = L;
      const initial = valueRef.current;
      const map = L.map(containerRef.current, {
        center: initial ? [initial.lat, initial.lng] : MALAYSIA_CENTER,
        zoom: initial ? 16 : 6,
        scrollWheelZoom: false,
      });

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 19,
      }).addTo(map);

      if (initial) {
        markerRef.current = L.circleMarker([initial.lat, initial.lng], {
          radius: 9,
          fillColor: '#16a34a',
          color: '#fff',
          weight: 2.5,
          fillOpacity: 1,
        }).addTo(map);
      }

      map.on('click', (event) => {
        const next = { lat: event.latlng.lat, lng: event.latlng.lng };
        if (markerRef.current) markerRef.current.setLatLng([next.lat, next.lng]);
        else
          markerRef.current = L.circleMarker([next.lat, next.lng], {
            radius: 9,
            fillColor: '#16a34a',
            color: '#fff',
            weight: 2.5,
            fillOpacity: 1,
          }).addTo(map);
        onChangeRef.current(next);
      });

      mapRef.current = map;

      const observer = new ResizeObserver(() => map.invalidateSize());
      observer.observe(containerRef.current);
      observerRef.current = observer;
      window.setTimeout(() => map.invalidateSize(), 0);
    };

    init();

    return () => {
      cancelled = true;
      observerRef.current?.disconnect();
      observerRef.current = null;
      mapRef.current?.remove();
      mapRef.current = null;
      markerRef.current = null;
    };
  }, []);

  useEffect(() => {
    const L = leafletRef.current;
    const map = mapRef.current;
    if (!L || !map || !value) return;

    if (markerRef.current) {
      markerRef.current.setLatLng([value.lat, value.lng]);
    } else {
      markerRef.current = L.circleMarker([value.lat, value.lng], {
        radius: 9,
        fillColor: '#16a34a',
        color: '#fff',
        weight: 2.5,
        fillOpacity: 1,
      }).addTo(map);
    }

    if (map.getZoom() < 14) map.setView([value.lat, value.lng], 16);
  }, [value]);

  return (
    <div
      ref={containerRef}
      className="border-border h-44 w-full overflow-hidden rounded-lg border sm:h-52"
      role="application"
      aria-label="Tap the map to place the recycling center"
    />
  );
}
