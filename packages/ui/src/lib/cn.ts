import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

/**
 * Compose Tailwind class lists with conditional logic and automatic
 * conflict resolution (later-specified classes beat earlier ones).
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs))
}
