'use client';

import { useEffect, useRef } from 'react';
import { MapPinIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { MALAYSIA_STATES } from '@/lib/types';

interface StateOnboardingDialogProps {
  open: boolean;
  onSelect: (state: string) => void;
}

export function StateOnboardingDialog({ open, onSelect }: StateOnboardingDialogProps) {
  const selectedRef = useRef(false);

  useEffect(() => {
    if (open) selectedRef.current = false;
  }, [open]);

  const handleSelect = (state: string) => {
    selectedRef.current = true;
    onSelect(state);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next && !selectedRef.current) onSelect('all');
      }}
    >
      <DialogContent showCloseButton={false} className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MapPinIcon className="text-primary size-5" aria-hidden="true" />
            Where are you looking for recycling centers?
          </DialogTitle>
          <DialogDescription>
            Choose your state to see recycling centers near you. You can change this anytime with
            the state filter.
          </DialogDescription>
        </DialogHeader>

        <div className="grid max-h-[55vh] grid-cols-2 gap-2 overflow-y-auto sm:grid-cols-3">
          {MALAYSIA_STATES.map((state) => (
            <Button
              key={state}
              variant="outline"
              className="h-11 justify-center text-sm"
              onClick={() => handleSelect(state)}
            >
              {state}
            </Button>
          ))}
        </div>

        <Button variant="ghost" className="h-11 w-full" onClick={() => handleSelect('all')}>
          Show all states
        </Button>
      </DialogContent>
    </Dialog>
  );
}
