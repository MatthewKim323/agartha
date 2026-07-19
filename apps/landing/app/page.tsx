import Hero from '@/components/sections/Hero';
import About from '@/components/sections/About';
import SkillSlider from '@/components/sections/SkillSlider';
import ThreeLanes from '@/components/sections/ThreeLanes';
import Stats from '@/components/sections/Stats';
import StackTicker from '@/components/sections/StackTicker';
import ReflexGrid from '@/components/sections/ReflexGrid';
import LogoMark from '@/components/sections/LogoMark';
import Footer from '@/components/sections/Footer';

export default function Page() {
  return (
    <main>
      <Hero />
      <About />
      <SkillSlider />
      <ThreeLanes />
      <Stats />
      <StackTicker />
      <ReflexGrid />
      <LogoMark />
      <Footer />
    </main>
  );
}
