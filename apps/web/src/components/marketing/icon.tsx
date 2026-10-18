import { Icon, type IconifyIcon } from '@iconify/react'

export function MkIcon({ icon, className }: { icon: IconifyIcon; className?: string }) {
  return <Icon icon={icon} aria-hidden className={className} />
}
