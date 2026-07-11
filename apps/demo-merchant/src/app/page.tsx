import { Nav } from '@/components/Nav'
import { Hero } from '@/components/Hero'
import { FeaturesGrid } from '@/components/FeaturesGrid'
import { CreatorSpotlight } from '@/components/CreatorSpotlight'
import { ProCard } from '@/components/ProCard'
import { Footer } from '@/components/Footer'

export default function HomePage() {
  return (
    <>
      <Nav />
      <main>
        <Hero />
        <FeaturesGrid />
        <CreatorSpotlight />
        <ProCard />
      </main>
      <Footer />
    </>
  )
}
