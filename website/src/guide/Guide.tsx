import { useEffect, useState, type MouseEvent } from 'react';
import { ArrowLeft, ArrowUpRight, Check, ChevronDown, Copy } from 'lucide-react';
import { Button } from '../../../src/components/arc/button/button';
import SegmentedControl from '../../../src/components/arc/segmented-control/segmented-control';
import { useCopyFeedback } from '../../../src/components/arc/lib/use-copy-feedback';
import chatgpt from '../../../src/assets/brands/chatgpt.svg';
import chrome from '../../../src/assets/brands/chrome.svg';
import edge from '../../../src/assets/brands/edge.svg';
import firefox from '../../../src/assets/brands/firefox.svg';
import safari from '../../../src/assets/brands/safari.svg';
import { links } from '../copy';
import { OsMark } from '../parts/OsMark';
import { useSite } from '../parts/useSite';
import { guideCopy, guideSections, pluginCommands, type GuideSection } from './guide-copy';
import { PluginWalkthrough } from './PluginWalkthrough';
import './guide.css';

type Browser = 'chrome' | 'edge' | 'firefox' | 'safari';
const browsers = [
  { value: 'chrome', label: 'Chrome', mark: chrome, address: 'chrome://extensions', source: 'https://developer.chrome.com/docs/extensions/get-started/tutorial/hello-world#load-unpacked' },
  { value: 'edge', label: 'Edge', mark: edge, address: 'edge://extensions', source: 'https://learn.microsoft.com/en-us/microsoft-edge/extensions/getting-started/extension-sideloading' },
  { value: 'firefox', label: 'Firefox', mark: firefox, address: 'about:debugging#/runtime/this-firefox', source: 'https://extensionworkshop.com/documentation/develop/temporary-installation-in-firefox/' },
  { value: 'safari', label: 'Safari', mark: safari, address: '', source: 'https://support.apple.com/guide/safari/sfri32508/mac' },
] as const;

function GuideCopy({ value, label }: { value: string; label: string }) {
  const { language } = useSite();
  const text = guideCopy[language];
  const { state, copy } = useCopyFeedback();
  const feedback = state === 'copied' ? text.copied : state === 'error' ? text.copyFailed : '';
  return <span className="guide-copy-wrap">
    <Button type="button" variant="secondary" size="sm" className="guide-copy" data-copy-state={state}
      aria-label={label} onClick={() => copy(value).then(() => undefined)}>
      {state === 'copied' ? <Check size={16} aria-hidden="true" /> : <Copy size={16} aria-hidden="true" />}
      {feedback || text.copy}
    </Button>
    <span className={state === 'error' ? 'guide-copy-error' : 'sr-only'} role="status">{state === 'error' ? text.copyRecovery : feedback}</span>
  </span>;
}

function SourceLink({ href }: { href: string }) {
  const { language } = useSite();
  return <a className="guide-source" href={href} target="_blank" rel="noreferrer">{guideCopy[language].source}<ArrowUpRight size={14} aria-hidden="true" /></a>;
}

function Steps({ items }: { items: string[] }) {
  return <ol className="guide-steps">{items.map((item, index) => <li key={index}>{item}</li>)}</ol>;
}

function Entries({ items }: { items: { title: string; body: string }[] }) {
  return <div className="guide-entries">{items.map(item => <div key={item.title}><h3>{item.title}</h3><p>{item.body}</p></div>)}</div>;
}

export function Guide() {
  const { language } = useSite();
  const text = guideCopy[language];
  const [os, setOs] = useState('windows');
  const [browser, setBrowser] = useState<Browser>('chrome');
  const [active, setActive] = useState<GuideSection>('start');
  const [contentsOpen, setContentsOpen] = useState(false);
  const [destination, setDestination] = useState<string | null>(null);
  const browserInfo = browsers.find(item => item.value === browser)!;
  useEffect(() => {
    document.title = language === 'zh' ? '使用指南 · StashDock' : 'Guide · StashDock';
  }, [language]);
  useEffect(() => {
    const observer = new IntersectionObserver(entries => {
      const visible = entries.find(entry => entry.isIntersecting);
      if (visible) setActive(visible.target.id as GuideSection);
    }, { rootMargin: '-80px 0px -65% 0px' });
    for (const id of guideSections) {
      const node = document.getElementById(id);
      if (node) observer.observe(node);
    }
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    const id = window.location.hash.slice(1);
    if (id) document.getElementById(id)?.scrollIntoView({ block: 'start', behavior: 'instant' });
  }, []);
  // Close the mobile contents before measuring the destination. Otherwise its
  // disappearing height can cancel the browser's in-flight anchor scroll.
  useEffect(() => {
    if (contentsOpen || !destination) return;
    if (window.location.hash !== `#${destination}`) window.history.pushState(null, '', `#${destination}`);
    const target = document.getElementById(destination);
    target?.scrollIntoView({ block: 'start', behavior: 'instant' });
    const heading = target?.querySelector<HTMLElement>('h2, h3, h4');
    if (heading) { heading.tabIndex = -1; heading.focus({ preventScroll: true }); }
    setDestination(null);
  }, [contentsOpen, destination]);
  function navigate(event: MouseEvent<HTMLAnchorElement>, target: string, section: GuideSection) {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
    setActive(section);
    event.preventDefault();
    setDestination(target);
    setContentsOpen(false);
  }
  const navigation = <nav aria-label={text.contents}>{guideSections.map((id, index) => <div key={id}>
    <a href={`#${id}`} aria-current={active === id ? 'location' : undefined}
      onClick={event => navigate(event, id, id)}><span aria-hidden="true">{String(index + 1).padStart(2, '0')}</span>{text.sections[id]}</a>
    {id === 'start' && <div className="guide-install-nav">{[['install-desktop', text.desktop], ['install-plugin', text.plugin], ['install-browser', text.extension]].map(([target, label]) =>
      <a key={target} href={`#${target}`} onClick={event => navigate(event, target, 'start')}>{label}</a>)}</div>}
  </div>)}</nav>;
  return <main className="guide-layout page">
    <aside className="guide-sidebar">
      <a className="guide-back" href="./index.html"><ArrowLeft size={15} aria-hidden="true" />{text.back}</a>
      <p className="guide-contents-label">{text.contents}</p>
      {navigation}
    </aside>
    <div className="guide-body">
      <header className="guide-header"><h1 className="display display-lg">{text.title}</h1><p className="lede">{text.intro}</p></header>
      <details className="guide-mobile-contents" open={contentsOpen} onToggle={event => setContentsOpen(event.currentTarget.open)}>
        <summary>{text.contents}<ChevronDown size={16} aria-hidden="true" /></summary>{navigation}
      </details>

      <section id="start" className="guide-section" aria-labelledby="start-title">
        <h2 id="start-title">{text.sections.start}</h2><p>{text.start}</p>
        <div className="guide-choices">{text.choices.map(item => <div key={item.title}><h3>{item.title}</h3><p>{item.body}</p></div>)}</div>
        <ol className="guide-quick">{text.quick.map(item => <li key={item.title}><h3>{item.title}</h3><p>{item.body}</p></li>)}</ol>
        <div className="guide-install-heading"><h3>{text.installation}</h3><SegmentedControl label={text.platform} value={os} onValueChange={setOs}
          options={[{ value: 'windows', label: 'Windows', accessory: <OsMark os="windows" size={14} /> }, { value: 'mac', label: 'macOS', accessory: <OsMark os="mac" size={14} /> }]} /></div>

        <div id="install-desktop" className="guide-install-block">
          <div className="guide-product-heading"><OsMark os={os === 'mac' ? 'mac' : 'windows'} size={22} /><h3>StashDock Desktop</h3>{os === 'mac' && <span className="guide-soon">{text.soon}</span>}</div>
          <p>{text.desktopIntro}</p>
          {os === 'windows' ? <><Steps items={text.desktopSteps} /><a className="pill secondary small" href={links.desktop}>{text.releases}<ArrowUpRight size={14} aria-hidden="true" /></a></> : <p className="guide-note">{text.desktopMac}</p>}
        </div>

        <div id="install-plugin" className="guide-install-block">
          <div className="guide-product-heading"><img src={chatgpt} width={22} height={22} alt="" /><h3>{text.plugin}</h3>{os === 'mac' && <span className="guide-soon">{text.soon}</span>}</div>
          <p>{text.pluginIntro}</p>
          <a className="guide-source" href="#open-plugin" onClick={event => navigate(event, 'open-plugin', 'start')}>{text.walkthrough.title}<ArrowUpRight size={14} aria-hidden="true" /></a>
          {os === 'windows' ? <>
            <h4>{text.aiInstall}</h4><p>{text.aiInstallBody}</p>
            <div className="guide-request"><p>{text.installPrompt}</p><GuideCopy value={text.installPrompt} label={`${text.copy}: ${text.aiInstall}`} /></div>
            <h4>{text.manualInstall}</h4><p>{text.manualBody}</p><Steps items={text.pluginSteps} />
            <div className="guide-code"><div><span>{text.commands}</span><GuideCopy value={pluginCommands} label={`${text.copy}: ${text.commands}`} /></div><pre><code>{pluginCommands}</code></pre></div>
            <p>{text.afterInstall}</p><p className="guide-note">{text.pluginNote}</p>
            <div className="guide-links"><a className="pill secondary small" href={links.desktop}>{text.releases}<ArrowUpRight size={14} aria-hidden="true" /></a><SourceLink href="https://developers.openai.com/plugins/build/plugins" /></div>
          </> : <p className="guide-note">{text.pluginMac}</p>}
          <PluginWalkthrough />
        </div>

        <div id="install-browser" className="guide-install-block">
          <div className="guide-product-heading"><img src={browserInfo.mark} width={22} height={22} alt="" /><h3>{text.extension}</h3></div>
          <p>{text.browserIntro}</p>
          <SegmentedControl label={text.browserChoice} value={browser} onValueChange={value => setBrowser(value as Browser)}
            options={browsers.map(item => ({ value: item.value, label: item.label, accessory: <img src={item.mark} width={16} height={16} alt="" /> }))} />
          {browser === 'safari' ? <p className="guide-note">{text.safariNote}</p> : <>
            <Steps items={text.browserSteps[browser]} />
            <div className="guide-browser-address"><code>{browserInfo.address}</code><GuideCopy value={browserInfo.address} label={`${text.copy}: ${browserInfo.address}`} /></div>
            {browser === 'firefox' && <p className="guide-note">{text.firefoxNote}</p>}
            <p>{text.browserAfter}</p>
            <a className="pill secondary small" href={links.desktop}>{text.releases}<ArrowUpRight size={14} aria-hidden="true" /></a>
          </>}
          <p className="guide-browser-os">{text.browserOs}</p><SourceLink href={browserInfo.source} />
        </div>
      </section>

      <section id="save" className="guide-section" aria-labelledby="save-title"><h2 id="save-title">{text.sections.save}</h2><p>{text.saveIntro}</p><Entries items={text.save} /></section>
      <section id="manage" className="guide-section" aria-labelledby="manage-title"><h2 id="manage-title">{text.sections.manage}</h2><p>{text.manageIntro}</p><Entries items={text.manage} /></section>
      <section id="use" className="guide-section" aria-labelledby="use-title"><h2 id="use-title">{text.sections.use}</h2><p>{text.useIntro}</p><Entries items={text.use} /></section>
      <section id="ai" className="guide-section" aria-labelledby="ai-title"><h2 id="ai-title">{text.sections.ai}</h2><p>{text.aiIntro}</p>
        <div className="guide-prompts">{text.prompts.map(item => <div key={item.title}><h3>{item.title}</h3><div className="guide-request"><p>{item.body}</p><GuideCopy value={item.body} label={`${text.copy}: ${item.title}`} /></div></div>)}</div>
      </section>
      <section id="preferences" className="guide-section" aria-labelledby="preferences-title"><h2 id="preferences-title">{text.sections.preferences}</h2><p>{text.preferencesIntro}</p><Entries items={text.preferences} /></section>
      <section id="questions" className="guide-section" aria-labelledby="questions-title"><h2 id="questions-title">{text.sections.questions}</h2><Entries items={text.questions} /></section>
    </div>
  </main>;
}
