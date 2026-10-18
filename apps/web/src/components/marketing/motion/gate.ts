export const MOTION_GATE_CLASS = 'mk-motion'
export const MOTION_READY_FLAG = '__mkMotionReady'
export const MOTION_GATE_TIMEOUT_MS = 3000

/** Runs before first paint. Hero items stay visible unless motion is allowed and the app hydrates in time. */
export const MOTION_GATE_SCRIPT = `(function(){var d=document.documentElement;if(window.matchMedia('(prefers-reduced-motion: reduce)').matches)return;d.classList.add('${MOTION_GATE_CLASS}');setTimeout(function(){if(!window.${MOTION_READY_FLAG})d.classList.remove('${MOTION_GATE_CLASS}')},${MOTION_GATE_TIMEOUT_MS})})()`

export function markMotionReady(): void {
  ;(window as unknown as Record<string, boolean>)[MOTION_READY_FLAG] = true
}
