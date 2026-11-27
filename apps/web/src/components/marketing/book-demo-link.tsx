import type { ComponentProps } from 'react'
import { bookDemoUrl } from '@strimz/web-shared/lib/site-urls'
import { PopLink } from './fx/pop-button'

type Props = Omit<ComponentProps<typeof PopLink>, 'href' | 'target' | 'rel' | 'children'>

export function BookDemoLink({ tone = 'neutral', ...props }: Props) {
  return (
    <PopLink href={bookDemoUrl} target="_blank" rel="noopener noreferrer" tone={tone} {...props}>
      Book a demo
      <span className="sr-only"> (opens in a new tab)</span>
    </PopLink>
  )
}
