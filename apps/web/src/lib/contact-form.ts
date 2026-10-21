import { z } from 'zod'
import { contactRequestInputSchema } from '@strimz/shared-types'

const { company } = contactRequestInputSchema.shape

// An empty input sends '', which the API's optional company would reject.
export const contactFormSchema = contactRequestInputSchema.extend({
  company: z.preprocess(
    (value) => (typeof value === 'string' && value.trim() === '' ? undefined : value),
    company,
  ),
})

export type ContactFormValues = z.output<typeof contactFormSchema>

export const contactErrorMap: z.ZodErrorMap = (issue, ctx) => {
  const field = issue.path[0]
  const tooBig = issue.code === z.ZodIssueCode.too_big
  switch (field) {
    case 'name':
      return { message: tooBig ? 'Keep your name under 120 characters.' : 'Enter your name.' }
    case 'email':
      return { message: 'Enter an email we can reply to.' }
    case 'company':
      return { message: 'Keep the company name under 120 characters.' }
    case 'message':
      if (tooBig) return { message: 'Keep your message under 4,000 characters.' }
      return {
        message:
          typeof ctx.data === 'string' && ctx.data.trim() !== ''
            ? 'Add a little more detail (20 characters or more).'
            : 'Tell us a little about what you need.',
      }
    default:
      return { message: ctx.defaultError }
  }
}
