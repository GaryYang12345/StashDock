import chatgptMark from '../../../src/assets/brands/chatgpt.svg';
import claudeMark from '../../../src/assets/brands/claude.svg';
import { Reveal } from '../parts/Reveal';
import { useSite } from '../parts/useSite';
import './platforms.css';

const logo = (file: string) => `${import.meta.env.BASE_URL}logos/${file}.svg`;
const rows = [
  [['ChatGPT', 'openai'], ['Claude', 'claude-color'], ['Gemini', 'gemini-color'], ['DeepSeek', 'deepseek-color'], ['Kimi', 'kimi'], ['Qwen', 'qwen-color'], ['Doubao', 'doubao-color'], ['Perplexity', 'perplexity-color']],
  [['Grok', 'grok'], ['Copilot', 'copilot-color'], ['Cursor', 'cursor'], ['Mistral', 'mistral-color'], ['Zhipu GLM', 'zhipu-color'], ['Yuanbao', 'yuanbao-color'], ['MiniMax', 'minimax-color'], ['WorkBuddy', 'workbuddy-color'], ['Meta AI', 'metaai-color']],
] as const;
const zhNames: Record<string, string> = { Qwen: '通义千问', Doubao: '豆包', 'Zhipu GLM': '智谱清言', Yuanbao: '元宝' };

export function Platforms() {
  const { copy, language } = useSite();
  return <section className="section platforms" aria-labelledby="platforms-title">
    <Reveal className="page section-head center">
      <h2 id="platforms-title" className="display display-lg">{copy.platforms.title}</h2>
      <p className="lede">{copy.platforms.body}</p>
    </Reveal>
    <div className="marquee" aria-label={rows.flat().map(([name]) => name).join(', ')} role="img">
      {rows.map((row, i) => <div key={i} className="marquee-row" data-reverse={i % 2 || undefined} aria-hidden="true">
        <div className="marquee-track">
          {[...row, ...row].map(([name, file], j) => <span key={j} className="platform">
            <img src={logo(file)} alt="" width={28} height={28} loading="lazy" draggable={false} />
            <span>{language === 'zh' ? zhNames[name] ?? name : name}</span>
          </span>)}
        </div>
      </div>)}
    </div>
    <Reveal className="plugin-status page" delay={80}>
      <div className="plugin-row"><img src={chatgptMark} alt="" width={24} height={24} /><span className="plugin-name">ChatGPT</span><span className="plugin-badge ready">{copy.platforms.available}</span></div>
      <div className="plugin-row"><img src={claudeMark} alt="" width={24} height={24} /><span className="plugin-name">Claude</span><span className="plugin-badge ready">{copy.platforms.available}</span></div>
    </Reveal>
  </section>;
}
