# StashDock app icon

The original `assets/brand/icon.svg` remains unchanged. These exports reuse its
exact path, scaled proportionally and centered on a 1024 × 1024 canvas.
The mark occupies 640px in width; the master background is opaque white.

## Files

- `app-icon.svg` / `app-icon-1024.png`: unmasked, full-bleed white master.
- `app-icon-dark.svg` / `app-icon-dark-1024.png`: corresponding dark artwork.
- `app-icon.ico` / `windows/`: fifteen Windows shell sizes, 16–256px, with a white
  rounded tile that fills the canvas. Only the rounded corners are transparent.
  The approved plate and mark are enlarged together; their internal ratio is
  unchanged. No baked shadow or glass effects. Apple layers are not enlarged.
- `app-icon.icns`: static macOS compatibility icon, including 1024px representation.
  This is not a Liquid Glass icon or a verified Mac application bundle.
- `apple/02-mark.svg`: transparent, unmasked black foreground.
- `apple/02-mark-dark.svg`: the same foreground geometry in white.
- `apple/01-background.svg`: full-bleed white reference background. Prefer setting
  white directly in Icon Composer rather than importing this background image.
- `composition.json`: artwork handoff metadata, **not** an Apple `.icon` project.

SVGs can be imported directly into Figma as editable vectors. The master and
foreground artwork have no rounded-square mask, bevel, blur or lighting baked in.

## Build

```sh
node scripts/generate-app-icons.mjs
```

Uses the already-installed Tauri CLI SVG renderer. No additional rendering engine,
Node package, browser or design account is installed. Outputs are deterministic;
identical bytes retain mtimes. Desktop's Windows brand build invokes this script.
Tray, browser toolbar and inline wordmark remain separate transparent brand assets.

## Finish native Liquid Glass on Mac

1. In Apple's Icon Composer create a Mac icon and save it as `AppIcon.icon`.
2. Set its background to white. Import `apple/02-mark.svg` into one foreground
   group, preserving its 1024px canvas and existing placement. Do not add a mask.
3. Keep the original black identity in Default. Start with automatic system
   specular highlights and restrained translucency; do not wash the mark out.
   In Dark, use the matching white foreground and subdued graphite background.
   Review the automatically derived clear/tinted/mono appearances too.
4. Let Icon Composer apply dynamic material, refraction, shadows and the system
   corner mask. The original vector layer contains none of these effects.
5. Compile the `.icon` with the installed Apple toolchain and integrate the actual
   generated bundle resources into the macOS app. Tauri's static `.icns` setting
   alone does not prove native Liquid Glass support. Inspect the real signed or
   development `.app` in Finder, Dock and different system appearances.
6. Use `app-icon.icns` as a static compatibility baseline until native integration
   has been verified. Test at 16, 32, 64 and 128px next to other app icons.

The current work was performed on Windows. A genuine `.icon` project, Apple
compiler integration and actual dynamic material still need the Mac machine.
Do not label the static previews as native Liquid Glass screenshots.

Official references (checked 2026-10-19):

- [Apple app icon HIG](https://developer.apple.com/design/human-interface-guidelines/app-icons)
- [Icon Composer](https://developer.apple.com/icon-composer/)
- [Creating your app icon](https://developer.apple.com/documentation/xcode/creating-your-app-icon-using-icon-composer)
