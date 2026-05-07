'use client'

import type { ReactNode } from 'react'
import { motion } from 'framer-motion'
import { fadeUp } from '@/lib/motion'
import { cn } from '@strimz/ui'

/**
 * Centred auth card — direct evolution of the prior `AuthFormContainer`.
 * 380px on desktop, full-bleed on mobile, with the signature
 * `shadow-auth-card` and a bordered green chip above the title.
 */
export function AuthCard({
  title,
  description,
  children,
  className,
}: {
  title: string
  description?: string
  children: ReactNode
  className?: string
}) {
  return (
    <motion.div
      initial="hidden"
      animate="show"
      variants={fadeUp}
      className={cn(
        'shadow-auth-card border-border/60 bg-background/95 w-full rounded-2xl border p-8 backdrop-blur md:w-[420px]',
        className,
      )}
    >
      <div className="mb-6 text-center">
        <h1 className="font-poppins text-2xl font-semibold tracking-tight">{title}</h1>
        {description && <p className="text-muted-foreground mt-2 text-sm">{description}</p>}
      </div>
      {children}
    </motion.div>
  )
}
