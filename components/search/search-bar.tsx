'use client';

import { useState, useCallback } from 'react';
import { SearchIcon, XIcon } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

export function SearchBar({
  value,
  onChange,
  placeholder = 'Search by name, area, or material (e.g. "plastic", "e-waste", "shah alam")',
}: SearchBarProps) {
  const [focused, setFocused] = useState(false);

  const handleClear = useCallback(() => {
    onChange('');
  }, [onChange]);

  return (
    <div
      className={`bg-background relative flex items-center rounded-lg border shadow-sm transition-shadow ${
        focused ? 'ring-primary shadow-md ring-2' : 'border-border'
      }`}
    >
      <SearchIcon
        className="text-muted-foreground pointer-events-none absolute left-3 size-4"
        aria-hidden="true"
      />
      <Input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        placeholder={placeholder}
        className="h-11 border-0 bg-transparent pr-9 pl-9 shadow-none focus-visible:ring-0"
        aria-label="Search recycling centers"
      />
      {value && (
        <Button
          variant="ghost"
          size="icon"
          onClick={handleClear}
          className="text-muted-foreground hover:text-foreground absolute right-1 size-8"
          aria-label="Clear search"
        >
          <XIcon className="size-4" aria-hidden="true" />
        </Button>
      )}
    </div>
  );
}
