import { Poppins, Sora } from 'next/font/google'

const sora = Sora({ subsets: ['latin'], variable: '--font-sora', display: 'swap' })
const poppins = Poppins({
  weight: ['400', '500', '600', '700', '800'],
  subsets: ['latin'],
  variable: '--font-poppins',
  display: 'swap',
})

export const fontVariables = `${sora.variable} ${poppins.variable}`
