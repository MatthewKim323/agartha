import Hero from '@/components/sections/Hero';
import About from '@/components/sections/About';
import SkillSlider from '@/components/sections/SkillSlider';
import ThreeLanes from '@/components/sections/ThreeLanes';
import Stats from '@/components/sections/Stats';
import StackTicker from '@/components/sections/StackTicker';
import Lineage from '@/components/sections/Lineage';
import LogoMark from '@/components/sections/LogoMark';
import CTA from '@/components/sections/CTA';
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
      <Lineage />
      <LogoMark />
      <CTA />
      <Footer />
    </main>
  );
}
