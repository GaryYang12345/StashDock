# Website demonstration references

The website uses a static, explicitly curated sample library. It never connects
to a visitor's or the owner's live StashDock database. Saved titles remain in
their original language. Local documents not listed below are fictional samples.

## Owner-selected examples

The owner selected these references for the website on 2026-10-25. Their existing
small card previews are reused unchanged; they are not generated replacements.
The selected pages' locally saved bodies were reread through StashDock on
2026-10-25 and are retained in `data/saved-reference-content.json`.
The SFT/RL source capture itself ends at 20,000 characters and retains its
incomplete-capture flag. The website adds no additional cut-off to these bodies.
The two X Articles were subsequently recaptured from their rendered public
article DOM on 2026-10-25 using the corrected canonical extension reader.
Their real text replaces the previous authored overviews. The darkzodchi
article retains an incomplete flag because an embedded quoted post is collapsed.
Design Spells retains all nine captured examples with duplicate labels and
listing numbers removed at the owner's request. The very short Uiverse capture
has an authored English overview, clearly labelled and marked AI-generated, plus its
saved page text. Image references have authored notes about their bundled
previews, not claims that an original file was parsed. Private library IDs,
file paths and temporary access parameters are not included. Original files
are not distributed as downloads.
Demo tags are curated into Design, AI, Writing, Travel and Work. They do not
reproduce or modify the owner's library tags.

| Preview / note | Source |
| --- | --- |
| `plot-color.jpg` — Plot-color-design | Owner-selected scientific-plot palette image; original attribution not supplied |
| `card-ui.jpg` — card-ui-design | Owner-selected profile-card design reference; original attribution not supplied |
| `korea-artist.jpg` — Korea-Artist-design | Owner-selected illustration reference; original attribution not supplied |
| `arc-ui.jpg` | https://uiarc.dev/ |
| `bay-weekend.jpg` | https://www.xiaohongshu.com/explore/69785820000000001a02aac7 |
| `oregon-101.jpg` | https://www.xiaohongshu.com/explore/6aaea630000000000e03f000 |
| `ucb-sakana.jpg` | https://www.xiaohongshu.com/explore/6acbb0390000000014001d37 |
| `intelligence-index.jpg` | https://artificialanalysis.ai/evaluations/artificial-analysis-intelligence-index |
| `gui-harvest.jpg` | https://arxiv.org/abs/2610.00948 |
| `darkzodchi.jpg` | https://x.com/zodchiii/status/2109623079429460478 |
| `seeco.jpg` | https://x.com/seeconvm/status/2106096193235259564 |
| `laws-of-ux.jpg` | https://lawsofux.com/ |
| `sft-rl-opd.jpg` | https://nrehiew.github.io/blog/sft_rl_opd |
| `design-spells.jpg` | https://designspells.com/ |
| `uiverse.jpg` | https://uiverse.io/ |
| `basic-pitch.jpg` | https://basicpitch.spotify.com/ |
| Anti-Defensive Writing | English demo note authored at the owner's request; not the original saved note |

`anti-defensive-writing-v1.jpg` is an AI-generated editorial cover made with the
built-in image generation tool on 2026-10-25 at the owner's request. It is not
a captured document, third-party website preview or a new default file icon.
Its text reads “Anti-defensive writing” and “Clear claims. Useful evidence.”
The original generated artwork was optimized to a 720px-wide JPEG for the site.
Generation brief: `anti-defensive-writing.prompt.md` in this directory.

Selection from a personal library does not establish ownership of third-party
artwork. Confirm publication rights for the three image references before a
public launch; retain original creator attribution when available.

## Additional public references

| Preview | Original source | Reference use |
| --- | --- | --- |
| `verl.png` | https://github.com/verl-project/verl | RL post-training and OPD |
| `deepagents.png` | https://github.com/langchain-ai/deepagents | Agent harnesses |
| `radix.jpg` | https://www.radix-ui.com/ | UI composition and accessibility |
| `attention.jpg` | https://distill.pub/2016/augmented-rnns/ | Neural attention and memory |
| `style-guide.jpg` | https://developers.google.com/style/highlights | Technical writing |

Repository previews are the projects' own GitHub Open Graph images, retrieved
2026-10-25. Repository summaries are editorial paraphrases, not captured pages.
verl's OPD reference: https://verl.readthedocs.io/en/latest/algo/opd.html

Radix and Google previews reproduce a small signed-out viewport. Distill uses
its own Open Graph image, reduced to 1120px. Artwork and trademarks remain with
their respective owners. No endorsement is implied.

- Radix Themes: WorkOS / Radix UI contributors. Component code is MIT licensed;
  this does not imply all website artwork is MIT.
  https://github.com/radix-ui/themes/blob/main/LICENSE
- Distill: Chris Olah and Shan Carter, *Attention and Augmented Recurrent Neural
  Networks* (2016), https://doi.org/10.23915/distill.00001, CC BY 4.0.
  Preview: https://distill.pub/2016/augmented-rnns/thumbnail.jpg
- Google for Developers: *Google developer documentation style guide: Highlights*,
  CC BY 4.0 except where indicated. https://developers.google.com/terms/site-policies
- verl: Apache-2.0 repository. https://github.com/verl-project/verl
- Deep Agents: MIT repository. https://github.com/langchain-ai/deepagents

Favicons are locally bundled site identifiers. They are not StashDock branding
or a customer-logo strip. Sources without an available site icon use the shared
source-identity fallback.

`favicons/sft-rl-opd.png` reproduces the source page's own inline SVG favicon
(a solid rose circle extending beyond its square viewBox), rasterized at 32px
on 2026-10-25. Source: https://nrehiew.github.io/blog/sft_rl_opd.
`favicons/designspells.png` is the Design Spells site identifier supplied by the
project owner on 2026-10-25. It is bundled in hero and demo cards; no remote
favicon request is made during page load.
