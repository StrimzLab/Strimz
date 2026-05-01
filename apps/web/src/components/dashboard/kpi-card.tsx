'use client'

import Link from 'next/link'
import { motion } from 'framer-motion'
import { ArrowUpRight } from 'lucide-react'
import { Card, CardContent } from '@strimz/ui'
import { fadeUp } from '@/lib/motion'

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
  return (
    <motion.div
      variants={fadeUp}
      whileHover={{ y: -3 }}
      transition={{ type: 'spring', stiffness: 240, damping: 18 }}
    >
      <Link href={href} className="group block">
        <Card className="strimz-card-shadow border-border/60 transition-colors hover:border-[#02C76A]/40">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div className="text-sm font-medium text-muted-foreground">{label}</div>
              <Icon className="size-4 text-muted-foreground/60" />
            </div>
            <div className="mt-3 font-sora text-2xl font-bold tracking-tight">{value}</div>
            {subtle && <div className="mt-1 text-xs text-muted-foreground">{subtle}</div>}
            <div className="mt-4 inline-flex items-center text-xs font-medium text-[#02C76A] opacity-0 transition-opacity group-hover:opacity-100">
              View details <ArrowUpRight className="ml-1 size-3" />
            </div>
          </CardContent>
        </Card>
      </Link>
    </motion.div>
  )
}
