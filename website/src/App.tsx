import { SiteShell } from './parts/SiteShell';
import { Hero } from './sections/Hero';
import { Scattered } from './sections/Scattered';
import { LiveDemo } from './sections/LiveDemo';
import { DesktopDemo } from './sections/DesktopDemo';
import { Pillars } from './sections/Pillars';
import { Platforms } from './sections/Platforms';
import { OneLibrary } from './sections/OneLibrary';
import { Download } from './sections/Download';

export function App() {
  return <SiteShell><main>
    <Hero />
    <Scattered />
    <LiveDemo />
    <DesktopDemo />
    <Pillars />
    <Platforms />
    <OneLibrary />
    <Download />
  </main></SiteShell>;
}
