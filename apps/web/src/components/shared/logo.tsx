import Link from 'next/link'
import Image, { type StaticImageData } from 'next/image'
import { cn } from '@strimz/ui'
import blueLogoSrc from '@/../public/logo/blueLogo.png'
import whiteLogoSrc from '@/../public/logo/whiteLogo.png'
import strimzVectorSrc from '@/../public/logoIcons/StrimzVector.svg'

/**
 * Strimz wordmark — direct port of strimz-subscription's `Logo`. Renders
 * the canonical `blueLogo.png` on light surfaces and `whiteLogo.png` on
 * dark surfaces (footer, dark hero blocks).
 *
 * Default size is `w-[101px] md:w-[116px]` matching the live nav. Pass
 * `className` to override per usage.
 */
export function Logo({
  href = '/',
  variant = 'blue',
  className,
}: {
  href?: string
  variant?: 'blue' | 'white'
  className?: string
}) {
  const src: StaticImageData = variant === 'white' ? whiteLogoSrc : blueLogoSrc
  return (
    <Link href={href} className={cn('inline-block w-[101px] shrink-0 md:w-[116px]', className)}>
      <Image
        src={src}
        alt="Strimz"
        className="h-auto w-full"
        width={407}
        height={128}
        priority
        quality={100}
      />
    </Link>
  )
}

/**
 * The Strimz vector glyph (the centred "S" mark from `StrimzVector.svg`).
 * Used as the centrepiece of the hero orb and CTA badges.
 */
export function StrimzGlyph({ className }: { className?: string }) {
  return (
    <Image
      src={strimzVectorSrc}
      alt=""
      aria-hidden
      className={cn('h-auto w-full', className)}
      width={120}
      height={120}
      priority
      quality={100}
    />
  )
}

/** Alias kept for back-compat with earlier imports of `Glyph`. */
export { StrimzGlyph as Glyph }
