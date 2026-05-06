'use client'

import Image from 'next/image'
import Marquee from 'react-fast-marquee'
import strimzBlueLogoIcon from '@/../public/logoIcons/strimzBlueLogoPNG.svg'

/**
 * Horizontally scrolling marquee — direct match to strimz-subscription's
 * `MovingText`. `bg-[#F9FAFB]` strip with the blue Strimz icon and the
 * brand line repeating. Sits underneath the hero.
 */
export function MovingText() {
  return (
    <Marquee className="h-[60px] w-full bg-[#F9FAFB]" speed={48}>
      {Array.from({ length: 11 }).map((_, i) => (
        <Pill key={i} />
      ))}
    </Marquee>
  )
}

function Pill() {
  return (
    <div className="mr-4 flex w-full items-center gap-4">
      <Image
        src={strimzBlueLogoIcon}
        alt="Strimz"
        className="h-[18.28px] w-[16.97px] md:h-[20.28px] md:w-[18.97px]"
        width={19}
        height={22}
        quality={100}
        priority
      />
      <p className="px-2.5 font-poppins text-sm font-[400] text-[#050020] md:text-base">
        Streamline payments anytime
      </p>
    </div>
  )
}
