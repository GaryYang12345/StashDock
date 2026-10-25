import type { StashItem } from '../../src/types';
import type { Language } from './copy';
import { savedDemoReferences } from './demo-references';
import { demoDescriptions } from './demo-descriptions';
import githubMark from './assets/favicons/github.png?inline';
import radixMark from './assets/favicons/radix.png?inline';
import attentionMark from './assets/favicons/attention.png?inline';
import styleMark from './assets/favicons/style-guide.png?inline';
import radixCover from './assets/covers/radix.jpg';
import attentionCover from './assets/covers/attention.jpg';
import styleCover from './assets/covers/style-guide.jpg';
import verlCover from './assets/covers/verl.png';
import deepagentsCover from './assets/covers/deepagents.png';

// Public references use real sources and locally bundled previews. Text is an
// editorial summary, not a full-page capture. Credits: assets/covers/NOTICE.md.
// Selected saved examples live in demo-references; the remaining local documents
// are fictional samples. This static website never accesses a live user library.
type DemoText = { title: string; excerpt: string; content: string };
type DemoItem = Omit<StashItem, 'title' | 'excerpt' | 'content' | 'tags'> & { text: { en: DemoText; zh: DemoText } };
const at = (day: number) => `2026-10-${String(day).padStart(2, '0')}T09:00:00.000Z`;
const origin = (platform: string, importMethod: NonNullable<StashItem['origin']>['importMethod'], extra: Partial<NonNullable<StashItem['origin']>> = {}) => ({ platform, importMethod, importedAt: at(20), ...extra });
const webpage = (faviconUrl: string, previewKind: 'screenshot' | 'cover' = 'cover') => origin('chrome', 'browser_bookmarks', { faviconUrl, contentOrigin: 'generated', previewKind });

const items: DemoItem[] = [
  { id: 'verl', kind: 'repo', source: 'GitHub', url: 'https://github.com/verl-project/verl', createdAt: at(25), preview: verlCover, origin: { ...webpage(githubMark), sourceUrls: ['https://verl.readthedocs.io/en/latest/algo/opd.html'] },
    text: { en: { title: 'verl-project / verl', excerpt: 'An RL post-training framework with on-policy distillation support.', content: demoDescriptions["verl"] },
      zh: { title: 'verl-project / verl', excerpt: '支持强化学习后训练和 On-Policy Distillation 的开源框架。', content: demoDescriptions["verl"] } } },
  { id: 'deepagents', kind: 'repo', source: 'GitHub', url: 'https://github.com/langchain-ai/deepagents', createdAt: at(25), preview: deepagentsCover, origin: webpage(githubMark),
    text: { en: { title: 'langchain-ai / deepagents', excerpt: 'An agent harness with planning, filesystem tools and subagents.', content: demoDescriptions["deepagents"] },
      zh: { title: 'langchain-ai / deepagents', excerpt: '集成规划、文件系统工具和子 Agent 的开源 agent harness。', content: demoDescriptions["deepagents"] } } },
  { id: 'radix', kind: 'web', source: 'Radix UI', url: 'https://www.radix-ui.com/', createdAt: at(22), favorite: true, preview: radixCover, origin: webpage(radixMark, 'screenshot'),
    text: { en: { title: 'Radix Themes', excerpt: 'An accessible component library for polished product interfaces.', content: demoDescriptions["radix"] },
      zh: { title: 'Radix Themes 组件设计', excerpt: '面向产品界面的 React 组件库，兼顾可访问性和一致性。', content: demoDescriptions["radix"] } } },
  { id: 'attention', kind: 'web', source: 'Distill', url: 'https://distill.pub/2016/augmented-rnns/', createdAt: at(20), favorite: true, preview: attentionCover,
    origin: { ...webpage(attentionMark), author: 'Chris Olah and Shan Carter', publishedAt: '2016-09-08' },
    text: { en: { title: 'Attention and augmented RNNs', excerpt: 'An illustrated explanation of attention and neural memory.', content: demoDescriptions["attention"] },
      zh: { title: '图解注意力机制与增强 RNN', excerpt: '用可视化解释注意力、神经网络记忆及其组合方式。', content: demoDescriptions["attention"] } } },
  { id: 'style-guide', kind: 'web', source: 'Google for Developers', url: 'https://developers.google.com/style/highlights', createdAt: at(18), preview: styleCover, origin: webpage(styleMark, 'screenshot'),
    text: { en: { title: 'Google documentation style guide', excerpt: 'Practical guidance on tone, clarity and accessible technical writing.', content: demoDescriptions["style-guide"] },
      zh: { title: 'Google 技术文档写作指南', excerpt: '关于语气、清晰表达和可访问性写作的实用建议。', content: demoDescriptions["style-guide"] } } },
  { id: 'spec', kind: 'file', source: 'File', createdAt: at(15), assetPath: 'Q3 product spec.pdf', mimeType: 'application/pdf', hasFile: true, origin: origin('local', 'local_file', { fileName: 'Q3 product spec.pdf' }),
    text: { en: { title: 'Q3 product spec.pdf', excerpt: 'Scope, milestones and open questions for Atlas.', content: demoDescriptions["spec"] },
      zh: { title: 'Q3 产品需求.pdf', excerpt: 'Atlas 的范围、里程碑和待定问题。', content: demoDescriptions["spec"] } } },
  { id: 'model', kind: 'file', source: 'File', createdAt: at(14), assetPath: 'Pricing model.xlsx', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', hasFile: true, origin: origin('local', 'local_file', { fileName: 'Pricing model.xlsx' }),
    text: { en: { title: 'Pricing model.xlsx', excerpt: 'Three plans, seat and usage scenarios.', content: demoDescriptions["model"] },
      zh: { title: '定价模型.xlsx', excerpt: '三档方案，按席位和用量的测算。', content: demoDescriptions["model"] } } },
  { id: 'review', kind: 'note', source: 'Note', createdAt: at(13), assetPath: 'Code review checklist.txt', mimeType: 'text/plain', hasFile: true, origin: origin('note', 'note'),
    text: { en: { title: 'Code review checklist', excerpt: 'Correctness first, then naming, then tests that prove the change.', content: demoDescriptions["review"] },
      zh: { title: '代码评审清单', excerpt: '先看正确性，再看命名，最后看能证明改动的测试。', content: demoDescriptions["review"] } } },
  { id: 'interviews', kind: 'file', source: 'File', createdAt: at(12), assetPath: 'Interview notes.docx', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', hasFile: true, origin: origin('local', 'local_file', { fileName: 'Interview notes.docx' }),
    text: { en: { title: 'Interview notes.docx', excerpt: 'Twelve customer conversations, summarized.', content: demoDescriptions["interviews"] },
      zh: { title: '用户访谈记录.docx', excerpt: '十二次用户访谈的整理。', content: demoDescriptions["interviews"] } } },
  { id: 'atlas', kind: 'note', source: 'Note', createdAt: at(11), assetPath: 'Atlas background.txt', mimeType: 'text/plain', hasFile: true, origin: origin('note', 'note'),
    text: { en: { title: 'Project Atlas background', excerpt: 'Who it is for, what we promised, what is out of scope.', content: demoDescriptions["atlas"] },
      zh: { title: 'Atlas 项目背景', excerpt: '面向谁、承诺了什么、哪些不做。', content: demoDescriptions["atlas"] } } },
];

// A small, shared taxonomy for the website examples, independent of import source.
const demoTagGroups = {
  Design: ['design-spells', 'uiverse', 'plot-color', 'arc-ui', 'laws-of-ux', 'card-ui', 'korea-artist', 'radix', 'seeco'],
  AI: ['sft-rl-opd', 'seeco', 'basic-pitch', 'gui-harvest', 'intelligence-index', 'ucb-sakana', 'darkzodchi', 'verl', 'deepagents', 'attention'],
  Writing: ['anti-defensive', 'style-guide'],
  Travel: ['bay-weekend', 'oregon-101'],
  Work: ['spec', 'model', 'review', 'interviews', 'atlas'],
};
export const demoTagNames = Object.keys(demoTagGroups);
const tagsByReference = new Map<string, string[]>();
for (const [tag, ids] of Object.entries(demoTagGroups)) {
  for (const id of ids) tagsByReference.set(id, [...(tagsByReference.get(id) ?? []), tag]);
}

export function demoLibrary(language: Language): StashItem[] {
  return [
    ...savedDemoReferences.map(item => ({ ...item, origin: item.origin ? { ...item.origin } : undefined })),
    ...items.map(({ text, ...item }) => ({ ...item, ...text[language], origin: { ...item.origin!, contentOrigin: 'generated' as const } })),
  ].map(item => ({ ...item, tags: [...(tagsByReference.get(item.id) ?? [])] }));
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
