import Hero from '@/components/sections/Hero';
import About from '@/components/sections/About';
import TheGap from '@/components/sections/TheGap';
import Validation from '@/components/sections/Validation';
import WhyEmbodied from '@/components/sections/WhyEmbodied';
import SkillSlider from '@/components/sections/SkillSlider';
import ThreeLanes from '@/components/sections/ThreeLanes';
import Stats from '@/components/sections/Stats';
import LatencyFlow from '@/components/sections/LatencyFlow';
import StackTicker from '@/components/sections/StackTicker';
import ReflexGrid from '@/components/sections/ReflexGrid';
import WhatsNext from '@/components/sections/WhatsNext';
import Footer from '@/components/sections/Footer';

export default function Page() {
  return (
    <main>
      <Hero />
      <About />
      <TheGap />
      <Validation />
      <WhyEmbodied />
      <SkillSlider />
      <ThreeLanes />
      <LatencyFlow />
      <Stats />
      <StackTicker />
      <ReflexGrid />
      <WhatsNext />
      <Footer />
    </main>
  );
}
