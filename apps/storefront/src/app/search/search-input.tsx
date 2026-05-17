'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';

interface SearchInputProps {
  initialQuery: string;
}

// Debounced URL-replace. Pages SSR off `?q=` so typing here re-renders the result list
// without any client fetch state to manage.
export function SearchInput({ initialQuery }: SearchInputProps) {
  const router = useRouter();
  const [value, setValue] = React.useState(initialQuery);

  React.useEffect(() => {
    const id = window.setTimeout(() => {
      const trimmed = value.trim();
      if (trimmed === initialQuery) return;
      const next = new URLSearchParams();
      if (trimmed) next.set('q', trimmed);
      router.replace(`/search${next.toString() ? `?${next.toString()}` : ''}`);
    }, 250);
    return () => window.clearTimeout(id);
  }, [value, initialQuery, router]);

  return (
    <label className="flex items-center gap-3 rounded-md border border-ink-200 bg-snow px-3.5 focus-within:border-ink-900">
      <Search className="h-4 w-4 text-ink-400" aria-hidden />
      <Input
        type="search"
        placeholder="Search shirts, knits, fabrics…"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        className="h-12 border-0 px-0 focus-visible:ring-0 focus-visible:ring-offset-0"
        autoFocus
      />
    </label>
  );
}
