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
        <Card className="shadow-sub-card border-border/60 transition-colors hover:border-[#02C76A]/40">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div className="text-muted-foreground text-sm font-medium">{label}</div>
              <Icon className="text-muted-foreground/60 size-4" />
            </div>
            <div className="font-sora mt-3 text-2xl font-bold tracking-tight">{value}</div>
            {subtle && <div className="text-muted-foreground mt-1 text-xs">{subtle}</div>}
            <div className="mt-4 inline-flex items-center text-xs font-medium text-[#02C76A] opacity-0 transition-opacity group-hover:opacity-100">
              View details <ArrowUpRight className="ml-1 size-3" />
            </div>
          </CardContent>
        </Card>
      </Link>
    </motion.div>
  )
}
