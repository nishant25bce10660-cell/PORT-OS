# PORT OS App-Icon Design System and CSS Implementation Guide

> **Document type:** Standalone design and implementation specification
> **Project:** PORT OS
> **Status:** Design specification only; this document does not prove that icon redesign has been implemented.
> **Purpose:** Guide an AI coding agent through auditing, redesigning, implementing, and verifying the application and file icon system.

**Status: DESIGN SPECIFICATION ADDED — NOT EVIDENCE THAT ICONS HAVE BEEN IMPLEMENTED.** This section is an implementation brief for the coding agent. The actual repository must be inspected and the icon redesign must be implemented and verified before a completion status is recorded.

### 1. Reference and scope

Primary design reference: [Apple Human Interface Guidelines — App icons](https://developer.apple.com/design/human-interface-guidelines/app-icons)

Use Apple's guidance as a design reference for clarity, layered construction, consistency, and adaptability. Create an original PORT OS identity; do not copy Apple's application artwork, proprietary symbols, logos, or exact icon compositions. PORT OS runs in a browser, so browser CSS and SVG implementation must not be described as Apple's native Icon Composer or native macOS icon behavior.

The guide applies to the branded application icons in the PORT OS desktop, dock, application launcher, and Finder. Small interface/action glyphs (such as close, back, volume, and context-menu arrows) should remain a separate icon category. Do not turn every small action glyph into a detailed app icon.

### 2. Source-derived Apple design principles

Apply the following principles from Apple's App Icons guidance:

1. **One recognizable core idea.** Each application icon should communicate one main concept at a glance. Prefer a small number of distinctive shapes instead of a collage of symbols.
2. **Simplicity at small sizes.** Fine detail, thin strokes, tiny labels, and complicated textures become illegible when icons are reduced. Preview icons at the actual desktop and dock sizes.
3. **Layered construction.** Separate the background and foreground symbol into distinct layers when practical. Use overlap, scale, and restrained transparency to create depth rather than relying on many decorative effects.
4. **Clearly defined foreground edges.** Avoid feathered or overly soft foreground silhouettes that become muddy at small sizes. Keep the principal symbol crisp.
5. **Purposeful background.** Prefer a simple solid color or controlled gradient that supports the foreground symbol. A background should not compete with the icon's central idea.
6. **Avoid excessive baked-in effects.** Apple advises letting the native system supply its own icon blur, shadows, highlights, bevels, and related effects, where that system behavior is available. In PORT OS, the browser does not provide Apple's native icon composition; therefore, use only subtle, deliberate CSS depth and do not pretend CSS recreates native Liquid Glass behavior.
7. **Consistent identity across variants.** Dark, light, tinted, hover, selected, and disabled treatments should preserve the same core symbol. Do not swap the meaning or basic silhouette across appearances.
8. **Prefer vector source artwork.** Use inline SVG or standalone SVG source assets for scalable, crisp marks. For raster artwork such as mesh gradients or textures, use lossless sources where appropriate. Keep high-resolution source assets available.
9. **Avoid unnecessary text and screenshots.** Do not put file names, app names, instructions, or miniature UI screenshots inside the icon. Use adjacent labels for names. Only use a letter or monogram when it is essential to the PORT OS brand or the icon's recognition.
10. **Preserve source geometry and safe spacing.** Keep primary content centered and away from the edges. Do not bake rounded corners into reusable source artwork if the display layer can apply the shape consistently.

Apple's current guidance lists square 1024 × 1024 px layered artwork for iOS, iPadOS, and macOS app-icon layouts, with system-applied masking and multiple appearances. For this browser implementation, use square viewBox-based SVGs or square high-resolution source assets; the browser component applies the on-screen shape. Do not apply Apple's platform sizes as if they were a web runtime requirement. Source: [Apple HIG: App icons](https://developer.apple.com/design/human-interface-guidelines/app-icons).

### 3. PORT OS icon taxonomy

Create and maintain a coherent icon registry instead of hardcoding new artwork into individual components.

| Category | Examples | Design rule |
|---|---|---|
| Branded application icons | Finder, Terminal, System Settings, portfolio apps | Each gets one distinctive silhouette and a controlled background material. |
| File-type icons | Markdown, source code, certificates, images, generic documents | Shared document silhouette; a small, bold, type-specific glyph differentiates the type. |
| Folder icons | Projects, Certifications and Education, Owner's Data | Same folder geometry; vary only purposeful category accents when useful. |
| System utility icons | Trash, power, lock, network status | Use a simple, recognizable silhouette; do not make them appear to be branded third-party apps. |
| Inline action glyphs | Close, back, forward, volume, context-menu actions | Use small SVG/Lucide-style symbols; no app-icon container, heavy gradients, or decorative material. |

Maintain the existing PORT OS brand mark, including the geometric N, as a distinct identity asset. Do not force the N mark into every icon. Branded applications and file-type icons should be recognizable on their own while sharing the same visual grammar.

### 4. Required implementation sequence for the AI agent

1. **Audit all icon uses.** Search the repository for icon components, image assets, emojis used as icons, CSS-drawn logos, `lucide-react` usage, file-type icon logic, dock definitions, Finder rows/cards, desktop icons, and app launchers. Build a list of every displayed logo and where it is used.
2. **Classify the icons.** Separate application icons, file-type icons, folder icons, system utilities, and inline action glyphs. Do not treat them as one interchangeable style.
3. **Preserve functionality.** Record each icon's application ID, click/double-click behavior, accessible label, selected state, drag hit area, and context-menu target before replacing its artwork. Visual refactoring must not change routing, authorization, or opening behavior.
4. **Define shared design tokens.** Put background, accent, edge, symbol, opacity, border radius, and optional shadow tokens in the existing shared stylesheet/design-token system. Avoid per-component hardcoded style drift.
5. **Build a reusable icon component.** Prefer the project's existing React/SVG approach. The component should accept a stable icon ID or semantic `kind`, class name, size, accessible label, and selected/disabled state. Avoid raw HTML injection or interpreting asset names as markup.
6. **Create simple layered artwork.** Each app icon uses a background layer and one principal foreground symbol, with additional layers only when they improve recognition. Ensure crisp edges, balanced spacing, and a clear silhouette.
7. **Create file-type variants.** Use one coherent base for documents, then differentiate Markdown, code, certificate, image, and generic file categories with restrained, legible glyphs. Do not use the same icon for every known file type if metadata safely identifies the type.
8. **Apply display masking in CSS.** Keep source SVG geometry square and reusable. Apply rounding, clipping, sizing, and border treatment at the component level, rather than permanently baking rounded corners into source artwork.
9. **Implement state variants.** Default, hover, focused, selected, disabled, and dark/light surroundings should retain the same core icon geometry. Keep hover changes subtle and never make hover the only indicator of an action.
10. **Test realistic sizes.** Inspect desktop icons, Finder rows, Finder grid/gallery cards, dock icons, context menus, and any settings preview at their real dimensions. Verify that the icon reads at 16, 24, 32, 48, and 64 CSS pixels where those sizes are actually used.
11. **Check accessibility and performance.** Decorative SVGs should be hidden from assistive technology when the adjacent text already names the item. Interactive icon buttons need an accessible name, keyboard focus, and sufficient hit area. Avoid expensive filters and perpetual animations on every icon.
12. **Verify and document.** Run the build and UI tests, capture before/after screenshots using current project conventions, inspect the diff for accidental behavior changes, and update this same `PROGRESS.md` with the real files changed and actual evidence. Do not mark the icon task as complete just because a CSS class or asset was added.

### 5. Reusable CSS design format

The following is a starting format, not a mandate to introduce a second styling system. Integrate the token names and class structure into the existing CSS architecture. If a shared icon system already exists, adapt it rather than duplicating it.

```css
/* PORT OS app-icon design tokens: keep in the existing shared token file. */
:root {
  --portos-icon-size: 48px;
  --portos-icon-radius: 22%;
  --portos-icon-bg: #202633;
  --portos-icon-bg-deep: #111722;
  --portos-icon-accent: #55c7e8;
  --portos-icon-symbol: #f4f7fb;
  --portos-icon-symbol-muted: #cbd5e1;
  --portos-icon-edge: rgb(255 255 255 / 14%);
  --portos-icon-highlight: rgb(255 255 255 / 9%);
  --portos-icon-shadow: 0 5px 14px rgb(0 0 0 / 22%);
  --portos-icon-focus: #7dd3fc;
}

/* App icon shell. Source artwork stays square; CSS supplies the browser mask. */
.portos-app-icon {
  position: relative;
  display: inline-grid;
  place-items: center;
  width: var(--portos-icon-size);
  aspect-ratio: 1;
  flex: 0 0 auto;
  overflow: hidden;
  isolation: isolate;
  border-radius: var(--portos-icon-radius);
  background: linear-gradient(
    145deg,
    var(--portos-icon-bg),
    var(--portos-icon-bg-deep)
  );
  border: 1px solid var(--portos-icon-edge);
  box-shadow: var(--portos-icon-shadow);
}

/* Optional restrained highlight: never obscure the foreground symbol. */
.portos-app-icon::before {
  content: "";
  position: absolute;
  inset: 0;
  z-index: 0;
  pointer-events: none;
  background: linear-gradient(
    155deg,
    var(--portos-icon-highlight),
    transparent 52%
  );
}

.portos-app-icon__background,
.portos-app-icon__symbol {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}

.portos-app-icon__background {
  z-index: 0;
  object-fit: cover;
}

.portos-app-icon__symbol {
  z-index: 1;
  display: block;
  padding: 19%;
  color: var(--portos-icon-symbol);
  fill: currentColor;
  stroke: currentColor;
  stroke-linecap: round;
  stroke-linejoin: round;
}

/* A semantic file-type marker can use an accent, not a tiny word label. */
.portos-app-icon[data-kind="markdown"] {
  --portos-icon-bg: #263342;
  --portos-icon-accent: #79c8f2;
}

.portos-app-icon[data-kind="code"] {
  --portos-icon-bg: #252b45;
  --portos-icon-accent: #a5b4fc;
}

.portos-app-icon[data-kind="certificate"] {
  --portos-icon-bg: #303126;
  --portos-icon-accent: #e8c77a;
}

.portos-app-icon[data-kind="folder"] {
  --portos-icon-bg: #24364a;
  --portos-icon-accent: #8fc8ef;
}

/* States preserve geometry and meaning. */
.portos-app-icon--selected {
  outline: 2px solid var(--portos-icon-focus);
  outline-offset: 2px;
}

.portos-app-icon-button {
  display: inline-grid;
  place-items: center;
  padding: 4px;
  border: 0;
  border-radius: 10px;
  color: inherit;
  background: transparent;
  cursor: pointer;
}

.portos-app-icon-button:focus-visible {
  outline: 2px solid var(--portos-icon-focus);
  outline-offset: 3px;
}

@media (hover: hover) and (prefers-reduced-motion: no-preference) {
  .portos-app-icon-button:hover .portos-app-icon {
    transform: translateY(-1px);
  }
}

@media (prefers-reduced-motion: reduce) {
  .portos-app-icon,
  .portos-app-icon-button,
  .portos-app-icon::before {
    animation: none !important;
    transition: none !important;
  }
}
```

#### CSS rules for the implementing AI

- The code above is a reusable visual format; adapt values to the project's existing token system after inspecting it.
- Do not blindly apply an identical heavy gradient, border, shadow, and highlight to every icon. Use common geometry and tokens, but keep application silhouettes distinctive.
- Keep high-resolution source artwork separate from UI labels and interaction logic.
- Prefer SVG paths for crisp foreground artwork. Avoid emoji as final branded app icons.
- Do not introduce `filter: blur()`, large `drop-shadow()` stacks, exaggerated bevels, permanent glow, or multiple overlapping pseudo-elements unless a specific icon has a reviewed visual reason.
- Keep `pointer-events` and hit targets correct so a decorative layer cannot block dragging, selection, double-click, or context-menu interaction.
- The CSS rounded rectangle is a PORT OS web-display choice. Do not bake the rounded corners into the base source SVG if it needs to remain reusable.
- Ensure forced-colors/high-contrast mode and actual focus indicators remain functional. Never remove an accessible outline without a replacement.
- If CSS custom properties already define application surfaces and accents, reuse them rather than introducing conflicting duplicates.

### 6. Recommended component contract

Use or adapt an API resembling the following; match the project's actual TypeScript/component conventions:

```tsx
type PortOSIconKind =
  | "finder"
  | "terminal"
  | "settings"
  | "markdown"
  | "code"
  | "certificate"
  | "image"
  | "folder"
  | "trash"
  | "generic-file";

type PortOSIconProps = {
  kind: PortOSIconKind;
  size?: number;
  label?: string;
  selected?: boolean;
  disabled?: boolean;
  className?: string;
};
```

This is an illustrative contract, not an instruction to duplicate an existing component. Preserve strong typing, semantic labels, existing event behavior, and a single source of truth for the icon mapping.

### 7. Visual and functional acceptance checklist

The AI agent must verify all applicable checks after implementing the new icon system:

- [ ] All app icons and file-type icons used across the desktop, dock, Finder and previews have been inventoried.
- [ ] Every visible icon uses the shared design system or a documented existing exception.
- [ ] App icons use simple, distinctive silhouettes and clear visual hierarchy.
- [ ] File types are visually distinguishable where the underlying metadata supports the distinction.
- [ ] No unnecessary tiny text or miniature screenshot is baked into an icon.
- [ ] Source artwork remains scalable and its core content is centered.
- [ ] Corner rounding and visual states are handled consistently by the display component.
- [ ] Default, selected, hover, keyboard-focus and disabled states remain recognizable.
- [ ] Icons remain legible on the PORT OS dark desktop and against the Finder/window surfaces.
- [ ] Icons remain legible at the actual rendered sizes, including small dock and list-row sizes.
- [ ] Double-click, drag, selection, context menus and accessible labels still work.
- [ ] The redesign does not modify file identity, protected data, routing, or authorization.
- [ ] No unsafe imported image/SVG content is executed or inserted as arbitrary HTML.
- [ ] Reduced-motion and high-contrast/focus behavior are preserved.
- [ ] Build, relevant automated tests, and visual regression checks have been run.
- [ ] `PROGRESS.md` records the exact components/assets changed and the results actually observed.

### 8. Embedded implementation prompt for the coding agent

> Inspect the current PORT OS repository and apply the official Apple Human Interface Guidelines for app-icon design as a reference, not as artwork to copy. First inventory every application icon, file-type icon, folder icon, dock icon and inline action glyph. Separate those categories. Create or extend one reusable, typed icon registry and component using the existing React/SVG and shared CSS-token architecture. Redesign app and file icons with a simple unique central idea, crisp vector geometry, restrained layered depth, appropriate dark-theme contrast, and consistent variants. Keep the geometric PORT OS N brand mark distinct. Do not use emoji as final branded app icons, duplicate Apple's proprietary app artwork, embed filenames as tiny icon text, or apply exaggerated gloss to every icon. Keep source artwork square and scalable; apply browser corner masking through the display component. Preserve all existing item IDs, labels, click/double-click behavior, drag hit areas, selection, context-menu behavior, and access permissions. Then test the icons at real sizes in the desktop, dock, Finder list/grid/gallery, and relevant settings previews. Run the actual build and related tests, inspect screenshots and the diff, fix regressions, and update the existing `PROGRESS.md` in place with truthful status and evidence. Do not mark the redesign complete until those checks pass.

### 9. Source note

The principles in this section are based on Apple's public [Human Interface Guidelines for App icons](https://developer.apple.com/design/human-interface-guidelines/app-icons), including simplicity, layered design, defined foreground edges, vector artwork, consistent appearances, careful use of visual effects, and platform-specific icon construction. CSS examples, PORT OS tokens, component contracts, category taxonomy and acceptance tests are implementation recommendations for this web project; they are not quoted requirements from Apple.
