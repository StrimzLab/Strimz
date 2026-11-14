'use client'

import { gsap } from 'gsap'
import { CustomEase } from 'gsap/CustomEase'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { useGSAP } from '@gsap/react'

gsap.registerPlugin(useGSAP, ScrollTrigger, CustomEase)

// Same curve as --ease-out-quint in globals.css.
export const EASE_OUT = CustomEase.create('mk-out', '0.23, 1, 0.32, 1')

export const MOTION_OK = '(prefers-reduced-motion: no-preference)'

// Use this, not `once: true`: a once trigger that starts already passed kills itself mid-refresh
// and throws inside ScrollTrigger, which stops every trigger after it.
export const PLAY_ONCE = { toggleActions: 'play none none none' } as const

export { gsap, ScrollTrigger, useGSAP }
