// Authored website annotations, not recovered source text. Public overviews
// link to their sources in demo-data; document examples are fictional samples.
export const demoDescriptions = {
  uiverse: `Reference overview

Uiverse is a community-built collection of open-source interface elements. It offers examples for exploring component appearance and interaction, with code formats including HTML/CSS, Tailwind and React, plus Figma resources.

Use it to show an AI the kind of button, input, card or loading treatment you have in mind. Compare the examples with the rest of your interface, then adapt their spacing, contrast and interaction states to your own design system.`,
  'plot-color': `Image reference notes

The preview pairs a six-panel scientific figure with a blue-to-rose palette. It uses deep blue, muted blue, pale cyan, soft pink and rose to distinguish curves and related measurements while keeping axes and labels dark on white.

Use this as a visual reference for multi-panel research figures, color ordering and coordinated chart legends. Ask the AI to propose a palette and layout for your own data, while preserving readable labels and distinctions that remain clear beyond color alone.`,
  'card-ui': `Image reference notes

The preview compares two light profile-card treatments. Each combines a portrait, name, verification mark, short description, compact statistics and a Follow action. Large rounded corners, restrained typography and soft neutral elevation keep the information grouped.

Use it to discuss card hierarchy, image cropping, nested corner radii and the balance between identity information and a primary action. Treat the portrait and profile details as visual sample content when adapting the layout.`,
  'korea-artist': `Image reference notes

The preview combines an icy blue mountain scene, off-white paper texture, loose black linework and handwritten text. The contrast between broad textured color and informal drawing gives it an editorial, sketchbook-like character.

Use it as a mood reference for a poster, illustration or expressive page detail. Ask the AI to describe the composition, palette and texture separately before translating the style into a new piece with its own subject and wording.`,
  verl: `Reference overview

verl, also known as HybridFlow, is an open-source framework for reinforcement-learning post-training of language models. Its repository brings together training workflows, configuration examples and integrations for experimentation.

Use the repository and its on-policy distillation documentation when discussing the relationship between student rollouts, teacher supervision and policy updates. Ask the AI to locate the relevant example, explain the data flow and identify the compute and evaluation requirements before proposing an experiment.

Sources:
- https://github.com/verl-project/verl
- https://verl.readthedocs.io/en/latest/algo/opd.html`,
  deepagents: `Reference overview

Deep Agents is an open-source agent harness from LangChain. It provides planning, context management and delegation as a starting point for multi-step work, with filesystem tools and subagents for tasks that need more than a single model response.

Use it to compare an agent harness with a custom application loop. Ask the AI to map the task into tools, state, workspaces and delegated responsibilities, then explain where custom orchestration is necessary. Tool permissions and sandbox boundaries should be designed explicitly.

Source: https://github.com/langchain-ai/deepagents`,
  radix: `Reference overview

Radix provides React interface resources with an emphasis on accessibility, composition and consistent behavior. Radix Themes supplies styled components, while the wider ecosystem also includes primitives, icons and color resources.

Use this reference when asking an AI to build a form, menu or dialog that behaves like a mature product. Review labels, keyboard navigation, focus handling, loading and error states alongside the visual design. Compose documented components and keep the application's spacing and terminology consistent.

Source: https://www.radix-ui.com/`,
  attention: `Reference overview

Chris Olah and Shan Carter's illustrated article explains ways to augment recurrent neural networks. It covers external memory in Neural Turing Machines, attention over inputs, adaptive computation time and neural programmers, connecting these ideas through differentiable attention.

Use it as conceptual background when discussing how a model selects information, accesses memory or allocates computation. Ask the AI to explain one mechanism with a small worked example, then distinguish the historical RNN setting from later architectures.

Source: https://distill.pub/2016/augmented-rnns/`,
  'style-guide': `Reference overview

Google's developer documentation style guide gives practical guidance on tone, grammar, formatting and accessibility. Its highlights recommend conversational language, clear actors in sentences, second-person instructions and descriptive link text.

Use this reference to review a README, setup guide or product explanation. Make the next action easy to find, put conditions before instructions, use sentence-case headings and format code and interface labels consistently. Check that examples and image descriptions work for a broad audience.

Source: https://developers.google.com/style/highlights`,
  spec: `Demo document annotation

The fictional Atlas release specification collects the intended users, core workflows, delivery scope and open product questions. The release focuses on collecting reusable references, finding them quickly and handing them to an AI conversation.

Use this annotation to ask the AI for an implementation checklist, a risk review or a clearer breakdown of milestones. Acceptance criteria should cover empty libraries, long titles, keyboard access, loading, failures and narrow windows. Keep unresolved decisions separate from agreed requirements.`,
  model: `Demo spreadsheet annotation

This fictional pricing workbook compares three plans using seat counts and usage assumptions. The intended comparison separates fixed subscription revenue from usage-dependent costs and makes the assumptions visible beside the results.

Use this annotation to ask the AI which inputs, formulas and scenarios it would inspect: included usage, overage behavior, cost per unit and sensitivity to adoption. A useful review explains how a changed assumption affects the comparison rather than presenting unverified totals.`,
  review: `Code review checklist

1. Confirm the requested behavior and check the existing contract before changing it.
2. Review data ownership, validation, cancellation and stale async responses.
3. Keep shared behavior in shared components and host-specific work in adapters.
4. Check empty, loading, error, long-content and narrow-screen states.
5. Prefer clear names and small responsibilities over extra abstractions.
6. Add tests that reproduce the issue and prove the intended behavior.
7. Verify the actual interaction, including keyboard access and focus return.
8. Remove retired code only after checking its imports, tests and packaging.`,
  interviews: `Demo document annotation

This fictional research document organizes twelve customer conversations about collecting and reusing context. It groups observations around finding saved material, understanding what was captured and moving relevant references into a new AI task.

Use this annotation to ask the AI for a research-synthesis structure: observations, supporting examples, recurring needs and open questions. Keep participant evidence separate from interpretation, and distinguish a repeated pattern from a single request before suggesting product changes.`,
  atlas: `Project Atlas background

Atlas is a fictional workspace for people who repeatedly bring links, files, rules and examples into AI conversations. Its core job is to reduce the work of finding the same context again while leaving selection and organization under the user's control.

The first release prioritizes reliable collection, fast retrieval and straightforward reuse. A tag groups references for a task; a card keeps its source and editable context together.

Out of scope: a second chat application, a complex knowledge-management hierarchy and automatic rewriting of original files. Favor a few complete workflows with clear feedback over a long list of partially implemented features.`,
} as const;
