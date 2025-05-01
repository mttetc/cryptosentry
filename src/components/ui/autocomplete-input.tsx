'use client';

import * as React from 'react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { useDebounce } from '@/hooks/use-debounce';

interface AutocompleteInputProps {
  onSelect: (value: string) => void;
  debounceMs?: number;
  value?: string;
  id?: string;
  name?: string;
  placeholder?: string;
  required?: boolean;
  className?: string;
}

export function AutocompleteInput({
  onSelect,
  debounceMs = 300,
  className,
  value = '',
  ...props
}: AutocompleteInputProps) {
  const [inputValue, setInputValue] = React.useState(value);
  const [suggestions, setSuggestions] = React.useState<string[]>([]);
  const [isOpen, setIsOpen] = React.useState(false);
  const [isLoading, setIsLoading] = React.useState(false);
  const wrapperRef = React.useRef<HTMLDivElement>(null);

  const debouncedSearch = useDebounce(async (query: string) => {
    console.log('[AutocompleteInput] Debounced search triggered for:', query);
    if (!query) {
      console.log('[AutocompleteInput] Empty query, clearing suggestions');
      setSuggestions([]);
      return;
    }

    setIsLoading(true);
    try {
      const url = `/api/search-social?q=${encodeURIComponent(query)}`;
      console.log('[AutocompleteInput] Fetching from URL:', url);
      const res = await fetch(url);
      console.log('[AutocompleteInput] Response status:', res.status);
      if (!res.ok) {
        throw new Error(`Failed to fetch suggestions: ${res.status}`);
      }
      const results = await res.json();
      console.log('[AutocompleteInput] Search results:', results);
      setSuggestions(results);
    } catch (error) {
      console.error('[AutocompleteInput] Failed to fetch suggestions:', error);
      setSuggestions([]);
    } finally {
      setIsLoading(false);
    }
  }, debounceMs);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    console.log('[AutocompleteInput] Input changed:', newValue);
    debouncedSearch(newValue);
    setInputValue(newValue);
    setIsOpen(true);
  };

  const handleSelect = (value: string) => {
    console.log('[AutocompleteInput] Selected value:', value);
    setInputValue(value);
    onSelect(value);
    setSuggestions([]);
    setIsOpen(false);
  };

  React.useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div ref={wrapperRef} className="relative">
      <Input
        onChange={handleInputChange}
        value={inputValue}
        className={cn('w-full', className)}
        {...props}
      />
      {isOpen && (suggestions.length > 0 || isLoading) && (
        <div className="absolute z-50 mt-1 w-full rounded-md border bg-popover shadow-md">
          {isLoading ? (
            <div className="p-2 text-sm text-muted-foreground">Loading...</div>
          ) : (
            <ul className="max-h-60 overflow-auto">
              {suggestions.map((suggestion, index) => (
                <li
                  key={index}
                  className="cursor-pointer px-4 py-2 text-sm hover:bg-accent hover:text-accent-foreground"
                  onClick={() => handleSelect(suggestion)}
                >
                  {suggestion}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
