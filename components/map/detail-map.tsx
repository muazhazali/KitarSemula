'use client';

import { useEffect, useRef } from 'react';

interface DetailMapProps {
  lat: number;
  lng: number;
  name: string;
}

export default function DetailMap({ lat, lng, name }: DetailMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const initialised = useRef(false);

  useEffect(() => {
    if (!mapRef.current || initialised.current) return;
    initialised.current = true;

    const init = async () => {
      const L = (await import('leaflet')).default;
      await import('leaflet/dist/leaflet.css');

      const map = L.map(mapRef.current!, {
        center: [lat, lng],
        zoom: 15,
        zoomControl: false,
        scrollWheelZoom: false,
        dragging: false,
      });

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 19,
      }).addTo(map);

      L.circleMarker([lat, lng], {
        radius: 10,
        fillColor: '#16a34a',
        color: '#fff',
        weight: 2.5,
        fillOpacity: 1,
      })
        .bindTooltip(name, { permanent: false })
        .addTo(map);
    };

    init();
  }, [lat, lng, name]);

  return (
    <div
      ref={mapRef}
      className="h-full w-full overflow-hidden rounded-lg"
      role="img"
      aria-label={`Map showing location of ${name}`}
    />
  );
}
