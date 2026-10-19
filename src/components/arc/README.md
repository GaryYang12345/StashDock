# Arc primitives

Free Arc UI components, installed from https://uiarc.dev/r/ using the official shadcn CLI on 2026-10-08. Copyright (c) 2026 Elia Kuratli. See LICENSE for the MIT terms. No Pro source is included.

Components are vendored source, not a hosted runtime. Foundation is imported once in src/main.tsx; variable fonts are bundled locally through Fontsource (Geist and Inter). Browsers request the matching unicode subset, with Windows system fallback for Chinese.

Install additional free items from the project root:

```powershell
npx shadcn@latest add @uiarc/<documented-id>
```

Do not run shadcn init over the current configuration. The root tsconfig paths and Vite alias both resolve @ to src. Arc modules import one another relatively. Do not overwrite local components on update without reviewing the diff.

Sources are kept without local behavior or theme forks. Input, Textarea, Tabs, EmptyState, Skeleton and Alert were fetched verbatim from the official free registry after the shadcn CLI timed out, using Arc's documented manual-install fallback. Registry dependencies were installed with npm. Arc DialogContent and Card quick-look portals target body. FluidDialog composes the Arc Dialog root with Radix's documented container option for panel-relative placement, dismissal and focus management; it never modifies the official DialogContent. Plain HTML browser-extension controls are an adapter to the same foundation, not React Arc components. Their tokens, Inter font, Lucide glyphs, and shared context formatter are synced by scripts/sync-extension-ui.mjs, with a read-only --check mode.

StashDock composition lives outside this directory. See docs/arc-adoption-plan.md and docs/ui-design-language.md. The /design route is a read-only workbench using the desktop bridge, separate from the shipped native window shell.
