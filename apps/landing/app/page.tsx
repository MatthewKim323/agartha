import Hero from '@/components/sections/Hero';
import About from '@/components/sections/About';
import TheGap from '@/components/sections/TheGap';
import WhyEmbodied from '@/components/sections/WhyEmbodied';
import SkillSlider from '@/components/sections/SkillSlider';
import ThreeLanes from '@/components/sections/ThreeLanes';
import Stats from '@/components/sections/Stats';
import LatencyFlow from '@/components/sections/LatencyFlow';
import StackTicker from '@/components/sections/StackTicker';
import ReflexGrid from '@/components/sections/ReflexGrid';
import Footer from '@/components/sections/Footer';

export default function Page() {
  return (
    <main>
      <Hero />
      <About />
      <TheGap />
      <WhyEmbodied />
      <SkillSlider />
      <ThreeLanes />
      <LatencyFlow />
      <Stats />
      <StackTicker />
      <ReflexGrid />
      <Footer />
    </main>
  );
}
