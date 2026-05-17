'use client';

import { MoreVertical } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';

interface Props {
  children: React.ReactNode;
  label?: string;
}

// Standard kebab (⋮) trigger for row actions. Children are DropdownMenuItem nodes.
export function KebabMenu({ children, label = 'Open menu' }: Props) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label={label} className="h-8 w-8 text-ink-500 hover:bg-ink-50 hover:text-ink-900">
          <MoreVertical className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48 rounded-xl">
        {children}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
