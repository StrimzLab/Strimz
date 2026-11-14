'use client'

import {
  generateReactHelpers,
  generateUploadButton,
  generateUploadDropzone,
} from '@uploadthing/react'

import type { StrimzFileRouter } from './core'

/**
 * Typed client helpers. The generics thread the file router's slug
 * types + `onUploadComplete` return shape through to every call-site,
 * so `<UploadDropzone endpoint="storefrontLogo" onClientUploadComplete={(res) => res[0].serverData.url}>`
 * autocompletes and typechecks end-to-end.
 */
export const UploadButton = generateUploadButton<StrimzFileRouter>()
export const UploadDropzone = generateUploadDropzone<StrimzFileRouter>()
export const { useUploadThing, uploadFiles } = generateReactHelpers<StrimzFileRouter>()
