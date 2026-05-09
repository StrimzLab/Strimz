import Image from 'next/image'
import type { BaseLayoutProps } from 'fumadocs-ui/layouts/shared'
import blueLogo from '@/../public/logo/blueLogo.png'

/**
 * Shared layout options for the docs surface. The brand mark is the
 * real `blueLogo.png` so the docs nav matches the marketing site.
 */
export function baseOptions(): BaseLayoutProps {
  return {
    nav: {
      title: (
        <Image
          src={blueLogo}
          alt="Strimz"
          width={407}
          height={128}
          priority
          quality={100}
          className="h-auto w-[88px] md:w-[100px]"
        />
      ),
      // Click-target for the logo inside the docs surface. Points at
      // the docs landing rather than the marketing homepage so a reader
      // browsing the documentation can return to the docs index without
      // bouncing out to /.
      url: '/docs',
    },
    githubUrl: 'https://github.com/StrimzLab/strimz',
  }
}
