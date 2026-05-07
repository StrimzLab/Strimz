'use client'

import { Toaster as Sonner, type ToasterProps } from 'sonner'

/**
 * Strimz toast — hardcoded `theme="light"`. Sonner reads `prefers-color-scheme`
 * by default and goes dark on Mac/Windows users with dark system mode, which
 * is wrong for Strimz (light-mode only).
 */
export function Toaster({ ...props }: ToasterProps) {
  return (
    <Sonner
      theme="light"
      className="toaster group"
      toastOptions={{
        classNames: {
          toast:
            'group toast !bg-white !text-[#050020] !border !border-[#E5E7EB] !shadow-[0_18px_40px_-15px_rgba(5,0,32,0.18)] font-poppins',
          title: '!text-[#050020] !font-[600]',
          description: '!text-[#58556A]',
          actionButton: '!bg-[#02C76A] !text-white',
          cancelButton: '!bg-[#F9FAFB] !text-[#58556A]',
          success: '!text-[#050020]',
          error: '!text-[#050020]',
        },
      }}
      {...props}
    />
  )
}

export { toast } from 'sonner'
