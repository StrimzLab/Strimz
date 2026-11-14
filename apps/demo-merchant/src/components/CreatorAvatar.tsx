import type { Creator } from '@/lib/creators'

export function CreatorAvatar({ creator, size = 48 }: { creator: Creator; size?: number }) {
  const initials = creator.name
    .split(' ')
    .map((p) => p[0])
    .join('')
  return (
    <span
      aria-hidden
      className="font-display grid shrink-0 place-items-center rounded-2xl font-bold text-white"
      style={{
        width: size,
        height: size,
        fontSize: size * 0.36,
        background: `linear-gradient(135deg, hsl(${creator.hue} 85% 58%), hsl(${(creator.hue + 40) % 360} 80% 42%))`,
      }}
    >
      {initials}
    </span>
  )
}
