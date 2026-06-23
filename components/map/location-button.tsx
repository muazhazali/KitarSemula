'use client';

import { useState } from 'react';
import { LocateIcon, LoaderIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

interface LocationButtonProps {
  onLocation: (lat: number, lng: number) => void;
}

export function LocationButton({ onLocation }: LocationButtonProps) {
  const [loading, setLoading] = useState(false);

  const handleLocate = () => {
    if (!navigator.geolocation) {
      toast.error('Geolocation is not supported by your browser');
      return;
    }

    setLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLoading(false);
        onLocation(pos.coords.latitude, pos.coords.longitude);
        toast.success('Location found! Showing nearest centers.');
      },
      () => {
        setLoading(false);
        toast.error('Could not get your location. Please check permissions.');
      },
      { timeout: 10000, maximumAge: 60000 },
    );
  };

  return (
    <Button
      variant="outline"
      size="icon"
      onClick={handleLocate}
      disabled={loading}
      className="bg-background border-border size-10 shadow-sm"
      aria-label="Use my location"
      title="Use my location"
    >
      {loading ? (
        <LoaderIcon className="size-4 animate-spin" aria-hidden="true" />
      ) : (
        <LocateIcon className="size-4" aria-hidden="true" />
      )}
    </Button>
  );
}
