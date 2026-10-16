'use client'

import * as React from 'react'
import * as TabsPrimitive from '@radix-ui/react-tabs'
import { cn } from '../lib/cn'

/**
 * Strimz Tabs — clearly visible active state. Active tab gets a white
 * background, brand-green underline, navy text, and a soft elevation.
 *
 * On narrow screens the list scrolls horizontally (no scrollbar) so a
 * 6-tab settings page never overflows the viewport.
 */

export const Tabs = TabsPrimitive.Root

export const TabsList = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.List>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.List>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.List
    ref={ref}
    className={cn(
      'no-scrollbar font-poppins border-border bg-muted text-muted-foreground relative inline-flex h-11 max-w-full items-center justify-start gap-1 overflow-x-auto rounded-[10px] border p-1 text-sm',
      className,
    )}
    {...props}
  />
))
TabsList.displayName = TabsPrimitive.List.displayName

export const TabsTrigger = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Trigger
    ref={ref}
    className={cn(
      'font-poppins group relative inline-flex shrink-0 items-center justify-center whitespace-nowrap rounded-md px-3.5 py-1.5 text-sm font-[500] transition-all',
      'text-muted-foreground hover:text-foreground',
      // Active state: white surface, navy text, brand-green left bar
      'data-[state=active]:bg-card data-[state=active]:text-foreground',
      'data-[state=active]:shadow-[0_1px_2px_-1px_rgba(0,0,0,0.1),0_1px_3px_0_rgba(0,0,0,0.08)]',
      'data-[state=active]:ring-accent/30 data-[state=active]:ring-1 data-[state=active]:ring-inset',
      'focus-visible:ring-accent/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1',
      'disabled:pointer-events-none disabled:opacity-50',
      className,
    )}
    {...props}
  />
))
TabsTrigger.displayName = TabsPrimitive.Trigger.displayName

export const TabsContent = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Content
    ref={ref}
    className={cn(
      'focus-visible:ring-accent/40 mt-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
      className,
    )}
    {...props}
  />
))
TabsContent.displayName = TabsPrimitive.Content.displayName
