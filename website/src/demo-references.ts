import type { StashItem } from '../../src/types';
import savedReferenceContent from './data/saved-reference-content.json';
import { demoDescriptions } from './demo-descriptions';
import plotColorCover from './assets/covers/plot-color.jpg';
import cardUiCover from './assets/covers/card-ui.jpg';
import koreaArtistCover from './assets/covers/korea-artist.jpg';
import arcUiCover from './assets/covers/arc-ui.jpg';
import bayWeekendCover from './assets/covers/bay-weekend.jpg';
import oregonCover from './assets/covers/oregon-101.jpg';
import sakanaCover from './assets/covers/ucb-sakana.jpg';
import intelligenceCover from './assets/covers/intelligence-index.jpg';
import guiHarvestCover from './assets/covers/gui-harvest.jpg';
import darkzodchiCover from './assets/covers/darkzodchi.jpg';
import seecoCover from './assets/covers/seeco.jpg';
import lawsOfUxCover from './assets/covers/laws-of-ux.jpg';
import opdArticleCover from './assets/covers/sft-rl-opd.jpg';
import designSpellsCover from './assets/covers/design-spells.jpg';
import designSpellsMark from './assets/favicons/designspells.png?inline';
import uiverseCover from './assets/covers/uiverse.jpg';
import basicPitchCover from './assets/covers/basic-pitch.jpg';
import uiverseMark from './assets/favicons/uiverse.png?inline';
import basicPitchMark from './assets/favicons/basic-pitch.png?inline';
import xhsMark from './assets/favicons/bay-weekend.png?inline';
import xMark from './assets/favicons/seeco.png?inline';
import arcMark from './assets/favicons/arc-ui.ico?inline';
import analysisMark from './assets/favicons/intelligence-index.ico?inline';
import arxivMark from './assets/favicons/gui-harvest.png?inline';
import uxMark from './assets/favicons/laws-of-ux.png?inline';
import antiDefensiveCover from './assets/covers/anti-defensive-writing-v1.jpg';
import opdMark from './assets/favicons/sft-rl-opd.png?inline';

// Explicitly selected public demo examples, copied once from the owner's library.
// Only display fields are exported: no library IDs, local paths or access tokens.
// Saved titles stay in their original language. The English writing note is an
// authored demo sample, not the owner's original note. Captured bodies are kept
// whole, with the source capture limit preserved. Descriptions are marked
// generated; this static website never reads a visitor's library or files.
export const savedDemoReferences: Omit<StashItem, 'tags'>[] = [
  {
    "id": "design-spells",
    "title": "Design Spells · Design details that feel like magic",
    "kind": "web",
    "source": "designspells.com",
    "url": "https://designspells.com/",
    "excerpt": "A collection of interface details, from bookmark sheet transitions and animated pickers to interactive magnifiers and playful waiting states.",
    "content": savedReferenceContent["design-spells"].content,
    "createdAt": "2026-10-25T09:00:00.000Z",
    "preview": designSpellsCover,
    "origin": {
      "faviconUrl": designSpellsMark,
      "platform": "chrome",
      "importMethod": "manual_url",
      "importedAt": "2026-10-25T09:00:00.000Z",
      "contentOrigin": "provided",
      "truncated": savedReferenceContent["design-spells"].captureTruncated,
      "previewKind": "screenshot"
    }
  },
  {
    "id": "sft-rl-opd",
    "title": "SFT, RL, and On-Policy Distillation Through a Distributional Lens",
    "kind": "web",
    "source": "nrehiew.github.io",
    "url": "https://nrehiew.github.io/blog/sft_rl_opd",
    "excerpt": "I have been thinking about post-training methods in terms of distributions. A language model is a distribution over sequences. When we post-train it and attempt to teach it a task,",
    "content": savedReferenceContent["sft-rl-opd"].content,
    "createdAt": "2026-10-25T09:00:00.000Z",
    "preview": opdArticleCover,
    "origin": {
      "faviconUrl": opdMark,
      "platform": "chrome",
      "importMethod": "manual_url",
      "importedAt": "2026-10-25T09:00:00.000Z",
      "contentOrigin": "provided",
      "truncated": savedReferenceContent["sft-rl-opd"].captureTruncated,
      "previewKind": "screenshot"
    }
  },
  {
    "id": "seeco",
    "title": "seeco on X: \"Opus 5.5 Motion Design: What the Viral 'One-Prompt' Videos Are Hiding\" / X",
    "kind": "web",
    "source": "x.com",
    "url": "https://x.com/seeconvm/status/2106096193235259564",
    "excerpt": savedReferenceContent.seeco.content.split('\n\n')[1],
    "content": savedReferenceContent.seeco.content,
    "createdAt": "2026-10-25T09:00:00.000Z",
    "preview": seecoCover,
    "origin": {
      "faviconUrl": xMark,
      "platform": "chrome",
      "importMethod": "manual_url",
      "importedAt": "2026-10-25T09:00:00.000Z",
      "contentOrigin": "provided",
      "truncated": savedReferenceContent.seeco.captureTruncated,
      "previewKind": "screenshot"
    }
  },
  {
    "id": "uiverse",
    "title": "Uiverse | The Largest Library of Open-Source UI elements",
    "kind": "web",
    "source": "uiverse.io",
    "url": "https://uiverse.io/",
    "excerpt": demoDescriptions["uiverse"].split('\n\n')[1],
    "content": demoDescriptions.uiverse + '\n\n### Saved page text\n\n' + savedReferenceContent.uiverse.content,
    "createdAt": "2026-10-25T09:00:00.000Z",
    "preview": uiverseCover,
    "origin": {
      "faviconUrl": uiverseMark,
      "platform": "chrome",
      "importMethod": "browser_bookmarks",
      "importedAt": "2026-10-25T09:00:00.000Z",
      "contentOrigin": "generated",
      "truncated": false,
      "previewKind": "screenshot"
    }
  },
  {
    "id": "bay-weekend",
    "title": "湾区周末｜Mission Peak+半月湾上山下海攻略",
    "kind": "web",
    "source": "Xiaohongshu",
    "url": "https://www.xiaohongshu.com/explore/69785820000000001a02aac7",
    "excerpt": "湾区周末｜Mission Peak+半月湾上山下海攻略 ——— 在美国大部分地方经历寒潮的时候，俺们加州人在湾区仍然可以上山下海、乐此不疲 这次趁着好天气打卡了湾区知名度TOP的Hiking & Beach Trails： Mission Peak⛰️ ➕ Half Moon Bay🏖️ 亲测攻略供大家参考～ ——— ⛰️Mission Peak · 出行",
    "content": savedReferenceContent["bay-weekend"].content,
    "createdAt": "2026-10-25T09:00:00.000Z",
    "preview": bayWeekendCover,
    "origin": {
      "faviconUrl": xhsMark,
      "platform": "chrome",
      "importMethod": "manual_url",
      "importedAt": "2026-10-25T09:00:00.000Z",
      "contentOrigin": "provided",
      "truncated": savedReferenceContent["bay-weekend"].captureTruncated,
      "previewKind": "screenshot"
    }
  },
  {
    "id": "basic-pitch",
    "title": "Basic Pitch: An open source MIDI converter from Spotify - Demo",
    "kind": "web",
    "source": "basicpitch.spotify.com",
    "url": "https://basicpitch.spotify.com/",
    "excerpt": "Demo About Github Try Basic Pitch, a free audio-to-MIDI converter with pitch bend detection, built by Spotify. Learn more or follow the instructions below. Press record and sing a ",
    "content": savedReferenceContent["basic-pitch"].content,
    "createdAt": "2026-10-25T09:00:00.000Z",
    "preview": basicPitchCover,
    "origin": {
      "faviconUrl": basicPitchMark,
      "platform": "chrome",
      "importMethod": "browser_bookmarks",
      "importedAt": "2026-10-25T09:00:00.000Z",
      "contentOrigin": "provided",
      "truncated": savedReferenceContent["basic-pitch"].captureTruncated,
      "previewKind": "screenshot"
    }
  },
  {
    "id": "plot-color",
    "title": "Plot-color-design",
    "kind": "image",
    "source": "Local file",
    "excerpt": demoDescriptions["plot-color"].split('\n\n')[1],
    "content": demoDescriptions["plot-color"],
    "createdAt": "2026-10-25T09:00:00.000Z",
    "favorite": true,
    "assetPath": "Plot-color-design.png",
    "mimeType": "image/png",
    "hasFile": true,
    "preview": plotColorCover,
    "origin": {
      "platform": "local",
      "importMethod": "local_file",
      "importedAt": "2026-10-25T09:00:00.000Z",
      "contentOrigin": "generated"
    }
  },
  {
    "id": "arc-ui",
    "title": "Arc UI: the React UI library your AI agents can build with",
    "kind": "web",
    "source": "uiarc.dev",
    "url": "https://uiarc.dev/",
    "excerpt": "186 animated components and 111 blocks. Add them with the shadcn CLI or the MCP server. Join developers who bought Arc Pro shadcn CLI One command, source in your project. npx shadc",
    "content": savedReferenceContent["arc-ui"].content,
    "createdAt": "2026-10-25T09:00:00.000Z",
    "favorite": true,
    "preview": arcUiCover,
    "origin": {
      "faviconUrl": arcMark,
      "platform": "chrome",
      "importMethod": "manual_url",
      "importedAt": "2026-10-25T09:00:00.000Z",
      "contentOrigin": "provided",
      "truncated": savedReferenceContent["arc-ui"].captureTruncated,
      "previewKind": "screenshot"
    }
  },
  {
    "id": "laws-of-ux",
    "title": "Home | Laws of UX",
    "kind": "web",
    "source": "lawsofux.com",
    "url": "https://lawsofux.com/",
    "excerpt": "Aesthetic-Usability Effect Users often perceive aesthetically pleasing design as design that’s more usable. Choice Overload The tendency for people to get overwhelmed when they are",
    "content": savedReferenceContent["laws-of-ux"].content,
    "createdAt": "2026-10-25T09:00:00.000Z",
    "preview": lawsOfUxCover,
    "origin": {
      "faviconUrl": uxMark,
      "platform": "chrome",
      "importMethod": "manual_url",
      "importedAt": "2026-10-25T09:00:00.000Z",
      "contentOrigin": "provided",
      "truncated": savedReferenceContent["laws-of-ux"].captureTruncated,
      "previewKind": "screenshot"
    }
  },
  {
    "id": "gui-harvest",
    "title": "GUI-HARVEST: Self-Improving GUI Agents through Evidence-Driven Harness Evolution",
    "kind": "web",
    "source": "arxiv.org",
    "url": "https://arxiv.org/abs/2610.00948",
    "excerpt": "GUI-HARVEST: Self-Improving GUI Agents through Evidence-Driven Harness Evolution The executable harness surrounding a GUI model determines how observations are assembled, actions a",
    "content": savedReferenceContent["gui-harvest"].content,
    "createdAt": "2026-10-25T09:00:00.000Z",
    "preview": guiHarvestCover,
    "origin": {
      "faviconUrl": arxivMark,
      "platform": "chrome",
      "importMethod": "manual_url",
      "importedAt": "2026-10-25T09:00:00.000Z",
      "contentOrigin": "provided",
      "truncated": savedReferenceContent["gui-harvest"].captureTruncated,
      "previewKind": "screenshot"
    }
  },
  {
    "id": "oregon-101",
    "title": "俄勒冈101自驾-160英里海岸线完整攻略",
    "kind": "web",
    "source": "Xiaohongshu",
    "url": "https://www.xiaohongshu.com/explore/6aaea630000000000e03f000",
    "excerpt": "俄勒冈101自驾-160英里海岸线完整攻略 如果来 Oregon 自驾，我很推荐这一段 Florence → Cannon Beach 的 101 海岸公路。全程大约 160英里。还有什么景点我错过了吗？ 1️⃣ Sea Lion Caves 可以下到洞里看野生海狮，11月到4月比较容易看到 2️⃣ Heceta Head Lighthouse 车停在tra",
    "content": savedReferenceContent["oregon-101"].content,
    "createdAt": "2026-10-25T09:00:00.000Z",
    "preview": oregonCover,
    "origin": {
      "faviconUrl": xhsMark,
      "platform": "chrome",
      "importMethod": "manual_url",
      "importedAt": "2026-10-25T09:00:00.000Z",
      "contentOrigin": "provided",
      "truncated": savedReferenceContent["oregon-101"].captureTruncated,
      "previewKind": "screenshot"
    }
  },
  {
    "id": "card-ui",
    "title": "card-ui-design",
    "kind": "image",
    "source": "Local file",
    "excerpt": demoDescriptions["card-ui"].split('\n\n')[1],
    "content": demoDescriptions["card-ui"],
    "createdAt": "2026-10-25T09:00:00.000Z",
    "assetPath": "card-ui-design.jpg",
    "mimeType": "image/jpeg",
    "hasFile": true,
    "preview": cardUiCover,
    "origin": {
      "platform": "local",
      "importMethod": "local_file",
      "importedAt": "2026-10-25T09:00:00.000Z",
      "contentOrigin": "generated"
    }
  },
  {
    "id": "intelligence-index",
    "title": "Artificial Analysis Intelligence Index v4.3.2",
    "kind": "web",
    "source": "artificialanalysis.ai",
    "url": "https://artificialanalysis.ai/evaluations/artificial-analysis-intelligence-index",
    "excerpt": "All indexes A composite benchmark aggregating ten challenging evaluations to provide a holistic measure of AI capabilities across mathematics, science, coding, and reasoning. See e",
    "content": savedReferenceContent["intelligence-index"].content,
    "createdAt": "2026-10-25T09:00:00.000Z",
    "preview": intelligenceCover,
    "origin": {
      "faviconUrl": analysisMark,
      "platform": "chrome",
      "importMethod": "manual_url",
      "importedAt": "2026-10-25T09:00:00.000Z",
      "contentOrigin": "provided",
      "truncated": savedReferenceContent["intelligence-index"].captureTruncated,
      "previewKind": "screenshot"
    }
  },
  {
    "id": "ucb-sakana",
    "title": "UCB x Sakana：多Agent自监督实现RSI",
    "kind": "web",
    "source": "Xiaohongshu",
    "url": "https://www.xiaohongshu.com/explore/6acbb0390000000014001d37",
    "excerpt": "UCB x Sakana：多Agent自监督实现RSI Sakana AI 联合 UC Berkeley 发布新论文《RECURSIVE SELF-IMPROVEMENT THROUGH MULTIAGENT SELF-SUPERVISION》提出了 MASS（Multi-Agent Self-Supervision），探索如何利用多 Agent 的集体智慧",
    "content": savedReferenceContent["ucb-sakana"].content,
    "createdAt": "2026-10-25T09:00:00.000Z",
    "preview": sakanaCover,
    "origin": {
      "faviconUrl": xhsMark,
      "platform": "chrome",
      "importMethod": "manual_url",
      "importedAt": "2026-10-25T09:00:00.000Z",
      "contentOrigin": "provided",
      "truncated": savedReferenceContent["ucb-sakana"].captureTruncated,
      "previewKind": "screenshot"
    }
  },
  {
    "id": "korea-artist",
    "title": "Korea-Artist-design",
    "kind": "image",
    "source": "Local file",
    "excerpt": demoDescriptions["korea-artist"].split('\n\n')[1],
    "content": demoDescriptions["korea-artist"],
    "createdAt": "2026-10-25T09:00:00.000Z",
    "assetPath": "Korea-Artist-design.png",
    "mimeType": "image/png",
    "hasFile": true,
    "preview": koreaArtistCover,
    "origin": {
      "platform": "local",
      "importMethod": "local_file",
      "importedAt": "2026-10-25T09:00:00.000Z",
      "contentOrigin": "generated"
    }
  },
  {
    "id": "darkzodchi",
    "title": "darkzodchi on X: \"How To Turn Opus 5.5 Into Your Personal Reverse Engineer (Full Setup Included) \" / X",
    "kind": "web",
    "source": "x.com",
    "url": "https://x.com/zodchiii/status/2109623079429460478",
    "excerpt": savedReferenceContent.darkzodchi.content.split('\n\n')[1],
    "content": savedReferenceContent.darkzodchi.content,
    "createdAt": "2026-10-25T09:00:00.000Z",
    "preview": darkzodchiCover,
    "origin": {
      "faviconUrl": xMark,
      "platform": "chrome",
      "importMethod": "manual_url",
      "importedAt": "2026-10-25T09:00:00.000Z",
      "contentOrigin": "provided",
      "truncated": savedReferenceContent.darkzodchi.captureTruncated,
      "previewKind": "screenshot"
    }
  },
  {
    "id": "anti-defensive",
    "title": "Anti-Defensive Writing",
    "preview": antiDefensiveCover,
    "kind": "note",
    "source": "Demo note",
    "excerpt": "Clear claims, useful evidence, and specific caveats. Write for the reader, not an imaginary critic.",
    "content": "Write for the reader, not for an imaginary critic.\n\n1. Lead with the useful point. State what happened, what it means, or what the reader can do next.\n2. Make a clear claim, then support it with a concrete example or source.\n3. Use positive, direct language. Describe what works and how to use it.\n4. Keep caveats specific. Include one only when it changes a decision or explains a real limit.\n5. Replace vague qualifiers with evidence, numbers, or a precise scope.\n6. Give each paragraph one job. Cut repeated explanations and unnecessary preambles.\n7. Match the reader's knowledge. Explain unfamiliar terms in plain language.\n8. End with a practical next step when one is needed.\n\nBefore sending, ask: Is the main point clear? Is every qualification useful? Can the reader act on this?",
    "createdAt": "2026-10-25T09:00:00.000Z",
    "assetPath": "Anti-Defensive Writing.txt",
    "mimeType": "text/plain",
    "hasFile": true,
    "origin": {
      "platform": "note",
      "importMethod": "note",
      "importedAt": "2026-10-25T09:00:00.000Z",
      "contentOrigin": "generated"
    }
  },
];
