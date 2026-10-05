'use client'

import { useRef } from 'react'
import Image from 'next/image'
import { toast } from 'sonner'
import { getAccessToken } from '@privy-io/react-auth'
import { ImagePlus, Loader2, X } from 'lucide-react'

import { useUploadThing } from '@/lib/uploadthing/client'
import type { StrimzFileRouter } from '@/lib/uploadthing/core'

type Endpoint = keyof StrimzFileRouter

interface ImageUploadProps {
  /** Which file router slug this upload targets. */
  endpoint: Endpoint
  /** Currently-saved image URL, or null if none. */
  value: string | null
  /** Called after a successful upload (URL from UploadThing CDN) OR clear. */
  onChange(url: string | null): void
  /** Human-readable label displayed above the drop target. */
  label?: string
  /**
   * Rendered aspect ratio. `square` for logos and product tiles;
   * `wide` for storefront cover images.
   */
  aspect?: 'square' | 'wide'
  /** Human-readable size hint shown in the empty state. */
  maxSizeLabel?: string
  /** Rendered image alt text. */
  alt?: string
  /** Extra classes on the root, e.g. a width cap for logo boxes. */
  className?: string
}

/**
 * Reusable image-upload control backed by UploadThing.
 *
 * Renders the current image with a remove button when populated; when
 * empty, renders a clickable drop zone. On upload success the parent's
 * `onChange` receives the CDN URL. Persistence is the parent's job
 * (typically `upsertStorefront` or `addStorefrontProduct`).
 *
 * Auth: every upload request needs a Privy bearer token. We fetch a
 * fresh access token via `getAccessToken()` for each attempt and
 * attach it via UploadThing's `headers` option. No session cookies,
 * matching how the rest of the merchant dashboard authenticates.
 */
export function ImageUpload({
  endpoint,
  value,
  onChange,
  label,
  aspect = 'square',
  maxSizeLabel,
  alt = 'Uploaded image',
  className,
}: ImageUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const { startUpload, isUploading } = useUploadThing(endpoint, {
    headers: async (): Promise<Record<string, string>> => {
      const token = await getAccessToken()
      return token ? { authorization: `Bearer ${token}` } : {}
    },
    onClientUploadComplete: (res) => {
      const uploaded = res?.[0]
      if (!uploaded) return
      // The serverData shape comes from the file router's
      // `onUploadComplete` return ,  `url` is typed on every slug.
      onChange(uploaded.serverData.url)
      toast.success('Image uploaded')
    },
    onUploadError: (err) => {
      toast.error(err.message ?? 'Upload failed')
    },
  })

  const aspectClass = aspect === 'wide' ? 'aspect-[3/1]' : 'aspect-square'

  async function handleFiles(files: FileList | null) {
    const file = files?.[0]
    if (!file) return
    await startUpload([file])
    // Reset the input so re-picking the same file re-triggers change.
    if (inputRef.current) inputRef.current.value = ''
  }

  return (
    <div className={className}>
      {label && <p className="font-poppins text-foreground mb-1.5 text-sm font-[500]">{label}</p>}
      {value ? (
        <div className="border-border bg-muted group relative overflow-hidden rounded-md border">
          <div className={aspectClass}>
            <Image
              src={value}
              alt={alt}
              width={800}
              height={aspect === 'wide' ? 267 : 800}
              className="h-full w-full object-cover"
              unoptimized
            />
          </div>
          <button
            type="button"
            onClick={() => onChange(null)}
            className="absolute right-2 top-2 grid size-7 place-items-center rounded-full bg-black/60 text-white opacity-90 transition hover:scale-105 hover:opacity-100"
            aria-label="Remove image"
          >
            <X className="size-3.5" />
          </button>
        </div>
      ) : (
        <label
          htmlFor={`upload-${endpoint}`}
          className={[
            aspectClass,
            'border-border bg-muted hover:border-accent/60 hover:bg-accent/5 grid cursor-pointer place-items-center rounded-md border-2 border-dashed transition-colors',
            isUploading ? 'pointer-events-none opacity-70' : '',
          ].join(' ')}
        >
          <input
            id={`upload-${endpoint}`}
            ref={inputRef}
            type="file"
            accept="image/*"
            className="sr-only"
            disabled={isUploading}
            onChange={(e) => void handleFiles(e.target.files)}
          />
          <div className="text-center">
            {isUploading ? (
              <>
                <Loader2 className="text-accent mx-auto size-6 animate-spin" />
                <p className="font-poppins text-muted-foreground mt-2 text-xs font-[500]">
                  Uploading…
                </p>
              </>
            ) : (
              <>
                <ImagePlus className="text-muted-foreground mx-auto size-6" />
                <p className="font-poppins text-foreground mt-2 text-xs font-[500]">
                  Click to upload
                </p>
                {maxSizeLabel && (
                  <p className="font-poppins text-muted-foreground mt-1 text-[10px]">
                    PNG or JPG · up to {maxSizeLabel}
                  </p>
                )}
              </>
            )}
          </div>
        </label>
      )}
    </div>
  )
}
