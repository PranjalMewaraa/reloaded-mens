import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

// Standard shadcn cn helper. Mirrors @repo/ui's cn but kept local so shadcn CLI
// can generate components without cross-package wiring.
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
