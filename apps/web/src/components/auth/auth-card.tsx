'use client'

import type { ReactNode } from 'react'
import { motion } from 'framer-motion'
import { fadeUp } from '@/lib/motion'
import { cn } from '@strimz/ui'

/**
 * Centred auth card — direct evolution of the prior `AuthFormContainer`.
 * 380px on desktop, full-bleed on mobile, with the signature
 * `strimz-auth-shadow` and a bordered green chip above the title.
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
        'strimz-auth-shadow w-full rounded-2xl border border-border/60 bg-background/95 p-8 backdrop-blur md:w-[420px]',
        className,
      )}
    >
      <div className="mb-6 text-center">
        <h1 className="font-poppins text-2xl font-semibold tracking-tight">{title}</h1>
        {description && (
          <p className="mt-2 text-sm text-muted-foreground">{description}</p>
        )}
      </div>
      {children}
    </motion.div>
  )
}
