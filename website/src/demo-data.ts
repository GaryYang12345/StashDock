import type { StashItem } from '../../src/types';
// Favicons are raster data URIs, as the product only accepts those for inline site icons.
import xMark from './assets/favicons/x.png?inline';
import githubMark from './assets/favicons/github.png?inline';
import journalMark from './assets/favicons/journal.png?inline';
import researchMark from './assets/favicons/research.png?inline';
import xiaohongshuMark from '../../src/assets/brands/xiaohongshu.png?inline';
import type { Language } from './copy';

// A small demonstration library for the page. Covers are drawn here as quiet,
// generic page sketches (no real site is reproduced); files and notes use the
// product's own type covers.
const svg = (body: string, w = 640, h = 360) => `data:image/svg+xml;utf8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${body}</svg>`)}`;
const bar = (x: number, y: number, w: number, h: number, fill: string, r = h / 2) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="${fill}"/>`;

const article = (tint: string, ink: string) => svg(`<rect width="640" height="360" fill="#fbfbfa"/>
  ${bar(48, 40, 84, 12, '#d9d9d6')}${bar(48, 84, 330, 26, ink, 8)}${bar(48, 122, 260, 26, ink, 8)}
  ${bar(48, 178, 300, 10, '#cfcfcb')}${bar(48, 200, 286, 10, '#d8d8d4')}${bar(48, 222, 250, 10, '#dededa')}
  <rect x="396" y="40" width="196" height="240" rx="22" fill="${tint}"/><circle cx="494" cy="138" r="46" fill="#ffffff" fill-opacity=".7"/>
  ${bar(48, 296, 120, 10, '#e2e2de')}`);
const post = (tint: string, accent: string) => svg(`<rect width="640" height="360" fill="#ffffff"/>
  <circle cx="72" cy="64" r="22" fill="${accent}"/>${bar(108, 50, 120, 12, '#2b2b2b')}${bar(108, 70, 80, 10, '#c9c9c9')}
  ${bar(50, 112, 470, 12, '#3a3a3a')}${bar(50, 134, 520, 12, '#3a3a3a')}${bar(50, 156, 380, 12, '#3a3a3a')}
  <rect x="50" y="190" width="540" height="140" rx="20" fill="${tint}"/>${bar(80, 226, 180, 14, '#ffffff', 7)}${bar(80, 252, 120, 14, '#ffffff', 7)}`);
const repo = () => svg(`<rect width="640" height="360" fill="#f6f7f8"/>
  <rect x="32" y="32" width="576" height="296" rx="20" fill="#ffffff" stroke="#e5e7ea"/>
  ${bar(60, 62, 160, 14, '#24292f', 7)}${bar(236, 62, 60, 14, '#d8dee4', 7)}
  ${[0, 1, 2, 3, 4, 5].map(i => `${bar(60, 110 + i * 32, 18, 12, '#d0d7de', 4)}${bar(92, 110 + i * 32, 140 + ((i * 53) % 160), 12, i % 3 ? '#8c959f' : '#57606a', 6)}`).join('')}
  <rect x="420" y="104" width="160" height="196" rx="14" fill="#f6f8fa"/>${bar(440, 128, 90, 10, '#afb8c1')}${bar(440, 150, 110, 10, '#d0d7de')}`);
const research = (tint: string) => svg(`<rect width="640" height="360" fill="#fafaf8"/>
  ${bar(48, 44, 380, 24, '#262626', 8)}${bar(48, 80, 220, 12, '#bdbdb8')}
  ${[0, 1, 2, 3, 4].map(i => `<rect x="${60 + i * 108}" y="${300 - (60 + ((i * 47) % 120))}" width="64" height="${60 + ((i * 47) % 120)}" rx="12" fill="${i === 3 ? '#1f1f1f' : tint}"/>`).join('')}
  ${bar(48, 316, 544, 2, '#e4e4e0', 1)}`);
const screen = () => svg(`<rect width="640" height="360" fill="#eef1f4"/>
  <rect x="200" y="28" width="240" height="304" rx="34" fill="#ffffff" stroke="#dde2e7"/>
  ${bar(232, 72, 120, 16, '#1d1d1f', 8)}${bar(232, 100, 170, 10, '#c7ccd1')}
  <rect x="232" y="134" width="176" height="96" rx="18" fill="#e6ecf2"/>
  ${bar(232, 252, 176, 40, '#1d1d1f', 20)}${bar(268, 300, 104, 8, '#c7ccd1')}`, 640, 360);


type DemoText = { title: string; excerpt: string; content: string };
type DemoItem = Omit<StashItem, 'title' | 'excerpt' | 'content' | 'tags'> & { tags: { en: string[]; zh: string[] }; text: { en: DemoText; zh: DemoText } };

const at = (day: number) => `2026-10-${String(day).padStart(2, '0')}T09:00:00.000Z`;
const origin = (platform: string, importMethod: NonNullable<StashItem['origin']>['importMethod'], extra: Partial<NonNullable<StashItem['origin']>> = {}) => ({ platform, importMethod, importedAt: at(20), ...extra });

const items: DemoItem[] = [
  { id: 'rules', kind: 'note', source: 'Note', createdAt: at(22), favorite: true, assetPath: 'Writing rules.txt', mimeType: 'text/plain', hasFile: true, origin: origin('note', 'ai_context'),
    tags: { en: ['Writing', 'Prompts'], zh: ['写作', 'Prompt'] },
    text: { en: { title: 'Writing rules', excerpt: 'Short sentences. No jargon. One idea per paragraph.', content: 'Short sentences. No jargon. One idea per paragraph. Lead with what changed for the reader.' },
      zh: { title: '写作规则', excerpt: '短句。不用术语。一段一个意思。', content: '短句。不用术语。一段一个意思。先说对读者有什么变化。' } } },
  { id: 'calm', kind: 'web', source: 'Journal', url: 'https://journal.example/calm-interfaces', createdAt: at(21), preview: article('#e9e4da', '#1d1d1f'), origin: origin('chrome', 'browser_extension', { faviconUrl: journalMark }),
    tags: { en: ['Design'], zh: ['设计'] },
    text: { en: { title: 'Designing calm interfaces', excerpt: 'Why restraint, spacing and one clear action make software feel considered.', content: 'Restraint, generous spacing and one clear action per surface make software feel considered.' },
      zh: { title: '设计克制的界面', excerpt: '为什么克制、留白和一个清晰的主操作让软件显得用心。', content: '克制、充分的留白、每个界面一个清晰的主操作，让软件显得用心。' } } },
  { id: 'pricing-thread', kind: 'web', source: 'X', url: 'https://x.com/founder/status/1', createdAt: at(20), favorite: true, preview: post('#e7eef7', '#1d1d1f'), origin: origin('x', 'browser_extension', { faviconUrl: xMark }),
    tags: { en: ['Pricing'], zh: ['定价'] },
    text: { en: { title: 'Thread: how we price usage-based plans', excerpt: 'Charge for the outcome customers notice, not the meter they fear.', content: 'Charge for the outcome customers notice, not the meter they fear. Keep one simple entry plan.' },
      zh: { title: '帖子：我们怎样给按量计费定价', excerpt: '按用户感受到的结果收费，而不是让他们害怕的计量。', content: '按用户感受到的结果收费，而不是让他们害怕的计量。保留一个简单的入门方案。' } } },
  { id: 'spec', kind: 'file', source: 'File', createdAt: at(19), assetPath: 'Q3 product spec.pdf', mimeType: 'application/pdf', hasFile: true, origin: origin('local', 'local_file', { fileName: 'Q3 product spec.pdf' }),
    tags: { en: ['Project Atlas'], zh: ['Atlas 项目'] },
    text: { en: { title: 'Q3 product spec.pdf', excerpt: 'Scope, milestones and open questions for Atlas.', content: 'Scope, milestones and open questions for the Atlas release.' },
      zh: { title: 'Q3 产品需求.pdf', excerpt: 'Atlas 的范围、里程碑和待定问题。', content: 'Atlas 版本的范围、里程碑和待定问题。' } } },
  { id: 'model', kind: 'file', source: 'File', createdAt: at(18), assetPath: 'Pricing model.xlsx', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', hasFile: true, origin: origin('local', 'local_file', { fileName: 'Pricing model.xlsx' }),
    tags: { en: ['Pricing', 'Project Atlas'], zh: ['定价', 'Atlas 项目'] },
    text: { en: { title: 'Pricing model.xlsx', excerpt: 'Three plans, seat and usage scenarios.', content: 'Three plans with seat and usage scenarios.' },
      zh: { title: '定价模型.xlsx', excerpt: '三档方案，按席位和用量的测算。', content: '三档方案，按席位和用量的测算。' } } },
  { id: 'onboarding', kind: 'image', source: 'File', createdAt: at(17), preview: screen(), assetPath: 'Onboarding flow.png', mimeType: 'image/png', hasFile: true, origin: origin('local', 'local_file', { fileName: 'Onboarding flow.png' }),
    tags: { en: ['Design', 'Project Atlas'], zh: ['设计', 'Atlas 项目'] },
    text: { en: { title: 'Onboarding flow.png', excerpt: 'First-run screens, latest version.', content: 'First-run screens, latest version.' },
      zh: { title: '新手引导流程.png', excerpt: '首次启动的页面，最新版。', content: '首次启动的页面，最新版。' } } },
  { id: 'review', kind: 'note', source: 'Note', createdAt: at(16), assetPath: 'Code review checklist.txt', mimeType: 'text/plain', hasFile: true, origin: origin('note', 'note'),
    tags: { en: ['Engineering', 'Prompts'], zh: ['工程', 'Prompt'] },
    text: { en: { title: 'Code review checklist', excerpt: 'Correctness first, then naming, then tests that prove the change.', content: 'Correctness first, then naming, then tests that prove the change.' },
      zh: { title: '代码评审清单', excerpt: '先看正确性，再看命名，最后看能证明改动的测试。', content: '先看正确性，再看命名，最后看能证明改动的测试。' } } },
  { id: 'sdk', kind: 'repo', source: 'GitHub', url: 'https://github.com/example/sdk', createdAt: at(15), preview: repo(), origin: origin('chrome', 'browser_bookmarks', { faviconUrl: githubMark }),
    tags: { en: ['Engineering'], zh: ['工程'] },
    text: { en: { title: 'example/sdk', excerpt: 'Client library and API reference.', content: 'Client library and API reference.' },
      zh: { title: 'example/sdk', excerpt: '客户端库和 API 文档。', content: '客户端库和 API 文档。' } } },
  { id: 'voice', kind: 'web', source: 'Xiaohongshu', url: 'https://www.xiaohongshu.com/explore/1', createdAt: at(14), preview: post('#f6e6e6', '#ff2442'), origin: origin('xiaohongshu', 'browser_extension', { faviconUrl: xiaohongshuMark }),
    tags: { en: ['Writing'], zh: ['写作'] },
    text: { en: { title: 'Notes on brand voice', excerpt: 'Speak like a thoughtful friend, not a brochure.', content: 'Speak like a thoughtful friend, not a brochure.' },
      zh: { title: '关于品牌语气的笔记', excerpt: '像一个靠谱的朋友说话，而不是宣传册。', content: '像一个靠谱的朋友说话，而不是宣传册。' } } },
  { id: 'reuse', kind: 'web', source: 'Research', url: 'https://research.example/reuse', createdAt: at(13), preview: research('#dfe6dc'), origin: origin('edge', 'manual_url', { faviconUrl: researchMark }),
    tags: { en: ['Research'], zh: ['调研'] },
    text: { en: { title: 'How people reuse prompts', excerpt: 'Most reused context is project background and house rules.', content: 'Most reused context is project background and house rules.' },
      zh: { title: '人们如何复用 prompt', excerpt: '被复用最多的是项目背景和团队规则。', content: '被复用最多的是项目背景和团队规则。' } } },
  { id: 'interviews', kind: 'file', source: 'File', createdAt: at(12), assetPath: 'Interview notes.docx', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', hasFile: true, origin: origin('local', 'local_file', { fileName: 'Interview notes.docx' }),
    tags: { en: ['Research'], zh: ['调研'] },
    text: { en: { title: 'Interview notes.docx', excerpt: 'Twelve customer conversations, summarized.', content: 'Twelve customer conversations, summarized.' },
      zh: { title: '用户访谈记录.docx', excerpt: '十二次用户访谈的整理。', content: '十二次用户访谈的整理。' } } },
  { id: 'atlas', kind: 'note', source: 'Note', createdAt: at(11), assetPath: 'Atlas background.txt', mimeType: 'text/plain', hasFile: true, origin: origin('note', 'note'),
    tags: { en: ['Project Atlas'], zh: ['Atlas 项目'] },
    text: { en: { title: 'Project Atlas background', excerpt: 'Who it is for, what we promised, what is out of scope.', content: 'Who it is for, what we promised, what is out of scope.' },
      zh: { title: 'Atlas 项目背景', excerpt: '面向谁、承诺了什么、哪些不做。', content: '面向谁、承诺了什么、哪些不做。' } } },
];

export function demoLibrary(language: Language): StashItem[] {
  return items.map(({ text, tags, ...item }) => ({ ...item, ...text[language], tags: tags[language] }));
}

export const fileKinds = new Set(['file', 'pdf', 'image']);

// The product's search contract: every term must appear somewhere.
export function matches(items: StashItem[], query: string) {
  const terms = query.toLocaleLowerCase().split(/\s+/).filter(Boolean);
  if (!terms.length) return [];
  return items.filter(item => {
    const text = `${item.title} ${item.excerpt} ${item.tags.join(' ')} ${item.source}`.toLocaleLowerCase();
    return terms.every(term => text.includes(term));
  });
}
