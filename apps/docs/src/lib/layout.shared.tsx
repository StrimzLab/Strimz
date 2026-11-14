import Image from 'next/image'
import type { BaseLayoutProps } from 'fumadocs-ui/layouts/shared'
import blueLogo from '@/../public/logo/blueLogo.png'
import whiteLogo from '@/../public/logo/whiteLogo.png'

// The logo swap lives in docs.css: fumadocs' unlayered CSS overrides Tailwind's dark: display utilities.
export function baseOptions(): BaseLayoutProps {
  return {
    nav: {
      title: (
        <>
          <Image
            src={blueLogo}
            alt="Strimz"
            width={407}
            height={128}
            priority
            quality={100}
            className="docs-logo-light h-auto w-[88px] md:w-[100px]"
          />
          <Image
            src={whiteLogo}
            alt="Strimz"
            width={407}
            height={128}
            priority
            quality={100}
            className="docs-logo-dark h-auto w-[88px] md:w-[100px]"
          />
        </>
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
