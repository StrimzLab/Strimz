'use client'

import Image, { type StaticImageData } from 'next/image'
import { useReducer } from 'react'
import { cn } from '@strimz/ui'
import { mediaReducer } from '../state'
import { PlaceholderCircle } from './placeholder'

/** Decorative art with a pulsing placeholder while it loads and a quiet fallback if it fails. */
export function ArtImage({
  src,
  size,
  fallback,
  className,
}: {
  src: StaticImageData
  size: number
  fallback: React.ReactNode
  className?: string
}) {
  const [state, dispatch] = useReducer(mediaReducer, 'loading')
  return (
    <span
      className={cn('relative grid place-items-center', className)}
      style={{ width: size, height: size }}
    >
      {state === 'loading' ? (
        <PlaceholderCircle className="absolute inset-0 size-full opacity-30" />
      ) : null}
      {state === 'failed' ? (
        fallback
      ) : (
        <Image
          src={src}
          alt=""
          aria-hidden
          width={size}
          height={size}
          onLoad={() => dispatch('load')}
          onError={() => dispatch('error')}
          className={cn(
            'size-full transition-opacity duration-500',
            state === 'loaded' ? 'opacity-100' : 'opacity-0',
          )}
        />
      )}
    </span>
  )
}
