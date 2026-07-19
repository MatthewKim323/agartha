import Hero from '@/components/sections/Hero';
import About from '@/components/sections/About';
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
