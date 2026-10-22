import type { IconifyIcon } from '@iconify/react'
import repeatIcon from '@iconify-icons/solar/repeat-linear'
import restartIcon from '@iconify-icons/solar/restart-linear'
import undoIcon from '@iconify-icons/solar/undo-left-round-linear'
import billIcon from '@iconify-icons/solar/bill-list-linear'
import chartIcon from '@iconify-icons/solar/chart-2-linear'
import linkIcon from '@iconify-icons/solar/link-round-linear'
import shopIcon from '@iconify-icons/solar/shop-2-linear'
import cartIcon from '@iconify-icons/solar/cart-large-2-linear'
import starIcon from '@iconify-icons/solar/star-linear'
import caseIcon from '@iconify-icons/solar/case-linear'
import globeIcon from '@iconify-icons/solar/globus-linear'
import usersIcon from '@iconify-icons/solar/users-group-rounded-linear'
import bookIcon from '@iconify-icons/solar/book-2-linear'
import rocketIcon from '@iconify-icons/solar/rocket-2-linear'
import codeIcon from '@iconify-icons/solar/code-square-linear'
import docIcon from '@iconify-icons/solar/document-text-linear'
import plugIcon from '@iconify-icons/solar/plug-circle-linear'
import routeIcon from '@iconify-icons/solar/routing-2-linear'
import infoIcon from '@iconify-icons/solar/info-circle-linear'
import letterIcon from '@iconify-icons/solar/letter-linear'

import { USE_CASES, type UseCaseId } from './use-cases/data'

export interface NavItem {
  href: string
  label: string
  description: string
  icon?: IconifyIcon
}

export interface NavGroup {
  label: string
  items: readonly NavItem[]
  /** A larger tile beside the list. */
  feature?: NavItem
}

const USE_CASE_ICON: Record<UseCaseId, IconifyIcon> = {
  saas: usersIcon,
  marketplaces: cartIcon,
  creators: starIcon,
  agencies: caseIcon,
  'global-b2b': globeIcon,
}

export const NAV_GROUPS: readonly NavGroup[] = [
  {
    label: 'Product',
    items: [
      {
        href: '/#sheet-subscriptions',
        label: 'Subscriptions',
        description: 'Customers approve once, every renewal charges itself.',
        icon: repeatIcon,
      },
      {
        href: '/#sheet-recovery',
        label: 'Payment recovery',
        description: 'Emails that bring failed charges back.',
        icon: restartIcon,
      },
      {
        href: '/#sheet-refunds',
        label: 'Refunds',
        description: 'Full or partial, each with its own receipt.',
        icon: undoIcon,
      },
      {
        href: '/#sheet-invoices',
        label: 'Invoices',
        description: 'Numbered invoices your clients pay in one click.',
        icon: billIcon,
      },
      {
        href: '/#sheet-analytics',
        label: 'Analytics',
        description: 'Revenue, renewals and where it is heading.',
        icon: chartIcon,
      },
      {
        href: '/#how-it-works',
        label: 'Payment links and checkout',
        description: 'Share a link or add a pay button to your site.',
        icon: linkIcon,
      },
      {
        href: '/use-cases#creators',
        label: 'Storefront',
        description: 'A no-code page for your products and memberships.',
        icon: shopIcon,
      },
    ],
    feature: {
      href: '/#how-it-works',
      label: 'From link to paid in four steps',
      description: 'Create a link, share it, your customer approves, the money is yours.',
      icon: routeIcon,
    },
  },
  {
    label: 'Solutions',
    items: [
      ...USE_CASES.map((u) => ({
        href: `/use-cases#${u.id}`,
        label: u.label,
        description: u.title,
        icon: USE_CASE_ICON[u.id],
      })),
      {
        href: '/use-cases',
        label: 'All use cases',
        description: 'How each kind of business bills with Strimz.',
      },
    ],
  },
  {
    label: 'Developers',
    items: [
      {
        href: '/docs',
        label: 'Documentation',
        description: 'Guides for the dashboard, checkout and billing.',
        icon: bookIcon,
      },
      {
        href: '/docs/quickstart',
        label: 'Quickstart',
        description: 'Take a first test payment in a few minutes.',
        icon: rocketIcon,
      },
      {
        href: '/docs/sdks',
        label: 'SDKs',
        description: 'The server SDK and the React pay button.',
        icon: codeIcon,
      },
      {
        href: '/docs/api/overview',
        label: 'API reference',
        description: 'Every resource, with requests and responses.',
        icon: docIcon,
      },
      {
        href: '/docs/webhooks',
        label: 'Webhooks',
        description: 'Signed events for every payment and charge.',
        icon: plugIcon,
      },
    ],
  },
  {
    label: 'Company',
    items: [
      {
        href: '/about',
        label: 'About',
        description: 'Who we are and how Strimz keeps your money safe.',
        icon: infoIcon,
      },
      {
        href: '/contact',
        label: 'Contact',
        description: 'Questions, demos and support. A person replies.',
        icon: letterIcon,
      },
    ],
  },
]

export const NAV_LINKS: readonly NavItem[] = [
  { href: '/pricing', label: 'Pricing', description: 'Free to start, and cheaper as you grow.' },
]
