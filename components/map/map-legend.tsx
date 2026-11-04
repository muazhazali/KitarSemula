'use client';

import { useState } from 'react';
import { ChevronDownIcon, ChevronUpIcon } from 'lucide-react';

export function MapLegend() {
  const [open, setOpen] = useState(false);

  const items = [
    { color: 'bg-green-600', label: 'Open Now' },
    { color: 'bg-red-600', label: 'Closed' },
    { color: 'bg-orange-600', label: 'Unverified' },
    { color: 'bg-gray-500', label: 'Unknown Hours' },
  ];

  return (
    <div className="pointer-events-none absolute bottom-3 left-3 z-[500] flex flex-col items-start gap-1.5">
      {open && (
        <div className="bg-background/95 border-border pointer-events-auto rounded-lg border px-3 py-2 shadow-sm backdrop-blur-sm">
          <div className="flex flex-col gap-1">
            {items.map(({ color, label }) => (
              <div key={label} className="flex items-center gap-1.5">
                <span
                  className={`inline-block size-2.5 rounded-full ${color}`}
                  aria-hidden="true"
                />
                <span className="text-muted-foreground text-xs">{label}</span>
              </div>
            ))}
          </div>
        </div>
      )}
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="bg-background/95 border-border pointer-events-auto inline-flex min-h-11 items-center gap-1 rounded-full border px-3 text-xs font-medium shadow-sm backdrop-blur-sm"
        aria-expanded={open}
        aria-label={open ? 'Hide map legend' : 'Show map legend'}
      >
        Legend
        {open ? (
          <ChevronDownIcon className="size-3.5" aria-hidden="true" />
        ) : (
          <ChevronUpIcon className="size-3.5" aria-hidden="true" />
        )}
      </button>
    </div>
  );
}
