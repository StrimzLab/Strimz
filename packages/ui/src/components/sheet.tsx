'use client'

import * as React from 'react'
import * as SheetPrimitive from '@radix-ui/react-dialog'
import { cva, type VariantProps } from 'class-variance-authority'
import { X } from 'lucide-react'

import { cn } from '../lib/cn'

/**
 * Strimz Sheet — Radix Dialog primitive styled as a slide-in panel.
 *
 * Animations are written as plain Tailwind transitions on `data-[state]`
 * attributes so they work without `tw-animate-css` keyframes — that was
 * the cause of "the panel opens but stays invisible" on mobile.
 */

const Sheet = SheetPrimitive.Root
const SheetTrigger = SheetPrimitive.Trigger
const SheetClose = SheetPrimitive.Close
const SheetPortal = SheetPrimitive.Portal

const SheetOverlay = React.forwardRef<
  React.ElementRef<typeof SheetPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof SheetPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <SheetPrimitive.Overlay
    ref={ref}
    className={cn(
      'fixed inset-0 z-[60] bg-black/55 backdrop-blur-[2px] transition-opacity duration-300',
      'data-[state=closed]:opacity-0 data-[state=open]:opacity-100',
      className,
    )}
    {...props}
  />
))
SheetOverlay.displayName = SheetPrimitive.Overlay.displayName

const sheetVariants = cva(
  'fixed z-[70] gap-4 bg-white p-6 shadow-2xl transition-transform duration-300 ease-out',
  {
    variants: {
      side: {
        top: [
          'inset-x-0 top-0 border-b',
          'data-[state=open]:translate-y-0 data-[state=closed]:-translate-y-full',
        ].join(' '),
        bottom: [
          'inset-x-0 bottom-0 border-t',
          'data-[state=open]:translate-y-0 data-[state=closed]:translate-y-full',
        ].join(' '),
        left: [
          'inset-y-0 left-0 h-full w-3/4 border-r sm:max-w-sm',
          'data-[state=open]:translate-x-0 data-[state=closed]:-translate-x-full',
        ].join(' '),
        right: [
          'inset-y-0 right-0 h-full w-3/4 border-l sm:max-w-sm',
          'data-[state=open]:translate-x-0 data-[state=closed]:translate-x-full',
        ].join(' '),
      },
    },
    defaultVariants: { side: 'right' },
  },
)

interface SheetContentProps
  extends React.ComponentPropsWithoutRef<typeof SheetPrimitive.Content>,
    VariantProps<typeof sheetVariants> {
  /** Hide the X close button. */
  hideCloseButton?: boolean
}

const SheetContent = React.forwardRef<
  React.ElementRef<typeof SheetPrimitive.Content>,
  SheetContentProps
>(({ side = 'right', className, children, hideCloseButton, ...props }, ref) => (
  <SheetPortal>
    <SheetOverlay />
    <SheetPrimitive.Content ref={ref} className={cn(sheetVariants({ side }), className)} {...props}>
      {children}
      {hideCloseButton ? null : (
        <SheetPrimitive.Close className="absolute right-5 top-5 rounded-md p-1.5 text-[#58556A] transition-colors hover:bg-[#F9FAFB] hover:text-[#050020] focus:outline-none focus:ring-2 focus:ring-[#02C76A]/40 focus:ring-offset-2 disabled:pointer-events-none">
          <X className="h-5 w-5" />
          <span className="sr-only">Close</span>
        </SheetPrimitive.Close>
      )}
    </SheetPrimitive.Content>
  </SheetPortal>
))
SheetContent.displayName = SheetPrimitive.Content.displayName

const SheetHeader = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn('flex flex-col space-y-2 text-center sm:text-left', className)} {...props} />
)
SheetHeader.displayName = 'SheetHeader'

const SheetFooter = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn('flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2', className)}
    {...props}
  />
)
SheetFooter.displayName = 'SheetFooter'

const SheetTitle = React.forwardRef<
  React.ElementRef<typeof SheetPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof SheetPrimitive.Title>
>(({ className, ...props }, ref) => (
  <SheetPrimitive.Title
    ref={ref}
    className={cn('font-sora text-lg font-semibold text-[#050020]', className)}
    {...props}
  />
))
SheetTitle.displayName = SheetPrimitive.Title.displayName

const SheetDescription = React.forwardRef<
  React.ElementRef<typeof SheetPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof SheetPrimitive.Description>
>(({ className, ...props }, ref) => (
  <SheetPrimitive.Description
    ref={ref}
    className={cn('font-poppins text-sm text-[#58556A]', className)}
    {...props}
  />
))
SheetDescription.displayName = SheetPrimitive.Description.displayName

export {
  Sheet,
  SheetPortal,
  SheetOverlay,
  SheetTrigger,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetFooter,
  SheetTitle,
  SheetDescription,
}
