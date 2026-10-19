'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { ArrowUpRight } from 'lucide-react'
import { Card, CardContent } from '@strimz/ui'
import { fadeUp } from '@/lib/motion'
import { Odometer } from '@/components/marketing/motion/odometer'

export function KpiCard({
  label,
  value,
  subtle,
  href,
  icon: Icon,
}: {
  label: string
  value: string
  subtle?: string
  href: string
  icon: React.ComponentType<{ className?: string }>
}) {
  const shown = useRollOnce(value)
  return (
    <motion.div
      variants={fadeUp}
      whileHover={{ y: -3 }}
      transition={{ type: 'spring', stiffness: 240, damping: 18 }}
    >
      <Link href={href} className="group block">
        <Card className="shadow-sub-card border-border/60 hover:border-accent/40 transition-colors">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div className="text-muted-foreground text-sm font-medium">{label}</div>
              <Icon className="text-muted-foreground/60 size-4" />
            </div>
            <div className="font-sora mt-3 text-2xl font-bold tracking-tight">
              <Odometer value={shown} />
            </div>
            {subtle && <div className="text-muted-foreground mt-1 text-xs">{subtle}</div>}
            <div className="text-accent mt-4 inline-flex items-center text-xs font-medium opacity-0 transition-opacity group-hover:opacity-100">
              View details <ArrowUpRight className="ml-1 size-3" />
            </div>
          </CardContent>
        </Card>
      </Link>
    </motion.div>
  )
}

const zeroed = (value: string) => value.replace(/\d/gu, '0')

/** The first value with digits rolls up from zeros once; later changes roll as they come. */
function useRollOnce(value: string): string {
  const rolled = useRef(false)
  const [shown, setShown] = useState(() => (/\d/u.test(value) ? zeroed(value) : value))

  useEffect(() => {
    if (rolled.current || !/\d/u.test(value)) {
      setShown(value)
      return
    }
    rolled.current = true
    setShown(zeroed(value))
    // Two frames so the zeros are painted before the digits roll.
    let inner = 0
    let done = false
    const outer = requestAnimationFrame(() => {
      inner = requestAnimationFrame(() => {
        done = true
        setShown(value)
      })
    })
    return () => {
      cancelAnimationFrame(outer)
      cancelAnimationFrame(inner)
      if (!done) rolled.current = false
    }
  }, [value])

  return shown
}
