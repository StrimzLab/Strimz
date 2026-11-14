import { Nav } from '@/components/Nav'
import { Hero } from '@/components/Hero'
import { CreatorsAndTips } from '@/components/CreatorsAndTips'
import { HowItWorks } from '@/components/HowItWorks'
import { ProCard } from '@/components/ProCard'
import { Footer } from '@/components/Footer'

export default function HomePage() {
  return (
    <>
      <Nav />
      <main>
        <Hero />
        <CreatorsAndTips />
        <HowItWorks />
        <ProCard />
      </main>
      <Footer />
    </>
  )
}
