---
name: Jorge Assistant Interface
colors:
  surface: '#fbf8ff'
  surface-dim: '#dad9e3'
  surface-bright: '#fbf8ff'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f4f2fd'
  surface-container: '#eeedf7'
  surface-container-high: '#e8e7f1'
  surface-container-highest: '#e3e1ec'
  on-surface: '#1a1b22'
  on-surface-variant: '#3d4947'
  inverse-surface: '#2f3038'
  inverse-on-surface: '#f1effa'
  outline: '#6d7a77'
  outline-variant: '#bcc9c6'
  surface-tint: '#006a61'
  primary: '#00685f'
  on-primary: '#ffffff'
  primary-container: '#008378'
  on-primary-container: '#f4fffc'
  inverse-primary: '#6bd8cb'
  secondary: '#006398'
  on-secondary: '#ffffff'
  secondary-container: '#5bb8fe'
  on-secondary-container: '#00476e'
  tertiary: '#924628'
  on-tertiary: '#ffffff'
  tertiary-container: '#b05e3d'
  on-tertiary-container: '#fffbff'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#89f5e7'
  primary-fixed-dim: '#6bd8cb'
  on-primary-fixed: '#00201d'
  on-primary-fixed-variant: '#005049'
  secondary-fixed: '#cce5ff'
  secondary-fixed-dim: '#93ccff'
  on-secondary-fixed: '#001d31'
  on-secondary-fixed-variant: '#004b73'
  tertiary-fixed: '#ffdbce'
  tertiary-fixed-dim: '#ffb59a'
  on-tertiary-fixed: '#370e00'
  on-tertiary-fixed-variant: '#773215'
  background: '#fbf8ff'
  on-background: '#1a1b22'
  surface-variant: '#e3e1ec'
typography:
  headline-sm:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: '600'
    lineHeight: 24px
    letterSpacing: -0.015em
  body-lg:
    fontFamily: Inter
    fontSize: 15px
    fontWeight: '400'
    lineHeight: 22px
    letterSpacing: -0.01em
  body-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
    letterSpacing: -0.006em
  body-sm:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '400'
    lineHeight: 16px
    letterSpacing: 0em
  label-md:
    fontFamily: Inter
    fontSize: 13px
    fontWeight: '500'
    lineHeight: 16px
    letterSpacing: 0em
  label-sm:
    fontFamily: Inter
    fontSize: 11px
    fontWeight: '600'
    lineHeight: 14px
    letterSpacing: 0.02em
  code-sm:
    fontFamily: JetBrains Mono
    fontSize: 12px
    fontWeight: '400'
    lineHeight: 18px
    letterSpacing: 0em
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  gutter: 0.75rem
  margin: 1rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 0.75rem
  space-lg: 1rem
  space-xl: 1.5rem
---

## Brand & Style

This design system defines an embeddable developer portfolio AI chat widget focused on engineering credibility, precision, and frictionless utility. The visual narrative combines modern minimalism with systematic micro-architectures found in developer tooling and productivity software.

- **Brand Personality**: Calm, technically adept, direct, and unpretentious. The interface acts as an articulate technical proxy for a senior engineer, prioritizing crisp information density over decorative noise.
- **Target Audience**: Technical recruiters, hiring managers, engineering leaders, and fellow software engineers seeking rapid context on skills, past architecture decisions, and portfolio work.
- **Emotional Response**: Quiet competence, effortless responsiveness, legibility, and architectural rigor.
- **Design Style**: Modern Minimalist with subtle structural borders. The widget uses crisp 1px structural framing, neutral zinc/slate tones, and purposeful teal-cyan accents to communicate state without distracting from conversation history.

## Colors

The palette relies on balanced slate-zinc neutrals paired with a focused teal accent (`#0D9488`) and an ancillary cyan-blue (`#0284C7`) for system notifications, active connection states, and code links. All combinations adhere strictly to WCAG AA guidelines with 4.5:1 text contrast and 3:1 non-text control contrast.

### Light Mode Roles
- **Canvas / Root Background**: `#FAFAFA`
- **Surface (Widget Card & Messages Container)**: `#FFFFFF`
- **Surface Subtle (Agent Messages / Code Blocks)**: `#F4F4F5`
- **Surface Hover**: `#ECECEE`
- **Text Primary**: `#09090B` (contrast 19.5:1 on white)
- **Text Secondary**: `#52525B` (contrast 5.6:1 on white)
- **Text Muted / Placeholder**: `#71717A` (contrast 4.6:1 on white)
- **Border Crisp**: `#E4E4E7` (subtle structural divider)
- **Border Strong / Interactive**: `#A1A1AA`
- **Accent Primary**: `#0F766E` (darkened for text against light backgrounds) / `#0D9488` (for graphical fills & badges)
- **Accent Contrast Text**: `#FFFFFF`
- **Focus Ring**: `#0284C7` (high-contrast active state ring)

### Dark Mode Roles
- **Canvas / Host Backdrop**: `#09090B`
- **Surface (Widget Card)**: `#18181B`
- **Surface Subtle (User Bubble / Code Blocks)**: `#27272A`
- **Surface Elevated / Input Field**: `#212124`
- **Text Primary**: `#FAFAFA` (contrast 16.8:1 on `#18181B`)
- **Text Secondary**: `#A1A1AA` (contrast 5.4:1 on `#18181B`)
- **Text Muted / Placeholder**: `#71717A` (contrast 4.5:1 on `#18181B`)
- **Border Crisp**: `#27272A`
- **Border Strong / Interactive**: `#3F3F46`
- **Accent Primary**: `#14B8A6` (brightened for dark theme readability)
- **Accent Subtle Fill**: `rgba(13, 148, 136, 0.15)`
- **Focus Ring**: `#38BDF8`

## Typography

The typography leverages an authoritative system font stack headed by **Inter**, falling back directly to `-apple-system`, `BlinkMacSystemFont`, `'Segoe UI'`, `Roboto`, and `sans-serif`. Code snippets, commands, and markdown inline blocks render with an optimized developer monospace stack (`JetBrains Mono`, `ui-monospace`, `SFMono-Regular`, `Menlo`, `monospace`).

- Optical sizing is prioritized: headings use tighter letter spacing (`-0.015em`) for compactness, while small labels use slight positive tracking (`0.02em`) to maintain legibility at 11px.
- Paragraph spacing within chat messages maintains a strict 8px gap between Markdown segments.
- Form controls and conversational turns anchor to 14px (`body-md`) to optimize line capacity inside restricted floating drawer viewports.

## Layout & Spacing

The widget is engineered for embedded integration via fixed/floating placement without destabilizing parent website layouts.

### Structural Framework
- **Desktop Floating Window**: Fixed dimensions of 380px to 420px width and max 640px height (or `calc(100vh - 5rem)`), positioned bottom-right with `margin: 1.5rem`.
- **Mobile Responsive Drawer**: On viewports under 480px, the widget reflows to a docked bottom sheet or full-viewport overlay (`width: 100vw`, `height: 100dvh`), adhering to device safe-area insets.
- **Vertical Rhythm**: 8px baseline grid dictates all interior padding and layout gaps.
- **Conversational Stream Spacing**: Messages use `space-md` (12px) separation between consecutive bubbles from distinct actors, and `space-xs` (4px) between clustered sequential turns from the same speaker.
- **Touch Constraints**: Minimum tap target area is 44×44px across all viewport sizes for actionable triggers (floating launcher button, close, copy action, and send buttons).

## Elevation & Depth

Visual hierarchy uses **low-contrast outlines combined with shallow, highly diffuse ambient shadows** to retain a lean footprint that does not overwhelm the host portfolio's design.

- **Floating Launcher Button**: 
  - Light mode: `box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08), 0 1px 2px rgba(0, 0, 0, 0.04);`
  - Dark mode: `box-shadow: 0 4px 16px rgba(0, 0, 0, 0.4), 0 0 0 1px rgba(255, 255, 255, 0.08);`
- **Main Widget Window**: 
  - Framed with an explicit 1px border (`#E4E4E7` in light, `#27272A` in dark).
  - Ambient elevation shadow: `0 8px 30px rgba(0, 0, 0, 0.08), 0 2px 8px rgba(0, 0, 0, 0.04)` in light mode; `0 12px 36px rgba(0, 0, 0, 0.5)` in dark mode.
- **In-Chat Message Cards & Overlays**:
  - Zero drop shadow. Elevation is achieved purely through background tonal shifts (`#F4F4F5` / `#27272A`) against surface canvas with crisp 1px borders.
- **Focus Treatment**:
  - Dual-ring focus state for strict accessibility: 2px offset border using surface color, followed by an unbroken 2px solid ring in `#0284C7` (light) or `#38BDF8` (dark).

## Shapes

The geometric scale adopts a consistent 12px–16px standard for containment boundaries, ensuring a modern, polished physical presence while avoiding bubbly, toy-like forms.

- **Main Widget Shell**: `rounded-2xl` (16px) for the root perimeter container to establish a contained, standalone frame.
- **Message Bubbles**:
  - User Bubbles: `16px 16px 4px 16px` (top-left, top-right, bottom-right, bottom-left) to visually anchor origin.
  - Agent Bubbles: `16px 16px 16px 4px` for incoming responses.
- **Buttons & Control Inputs**: `rounded-xl` (12px) for form inputs, interactive prompt suggestions, and action buttons.
- **Badges & Tags**: Full pill styling (`rounded-full` / 9999px) for status indicators, capability chips, and filter tags.
- **Interactive Launcher**: Full circular pill (`rounded-full`) maintaining a precise 56×56px desktop or 48×48px mobile profile.

## Components

### 1. Widget Launcher & Header
- **Launcher**: 56×56px circular floating action button featuring Jorge's avatar or a streamlined chat icon with a subtle status pip (green `#10B981` indicating live responsiveness).
- **Header**: Compact 56px height flex header. Includes Jorge's thumbnail, online badge, bot label (`Asistente de Jorge`), clear context indicator, and an accessible 44×44px dismiss button.

### 2. Chat Bubbles
- **User Messages**: Right-aligned, primary accent background (`#0D9488`), crisp white text (`#FFFFFF`), max-width 85%.
- **Agent Responses**: Left-aligned, subtle neutral background (`#F4F4F5` light / `#27272A` dark), 1px border (`#E4E4E7` / `#3F3F46`), primary text.
- **Inline Code Blocks**: Monospace font (`code-sm`) in `#18181B` with 2px padding, nested inside an isolated rounded block with a copy trigger.

### 3. Prompt Chips / Suggested Questions
- Horizontally scrollable or wrap-grid pills displaying pre-baked queries (e.g., *"What is Jorge's tech stack?"*, *"View recent projects"*).
- Background `#FFFFFF` (light) / `#18181B` (dark), border 1px `#E4E4E7` / `#27272A`. On hover: subtle teal border tint (`#0D9488`) with zero vertical layout shift. Minimum tap target 44px height.

### 4. Input Field & Composer
- Multi-line auto-expanding textarea nested in a framed bounding box (`rounded-xl`).
- 1px border with an active `:focus-within` state utilizing the cyan-blue accent outline (`2px solid #0284C7`).
- Action Send Button: Integrated inside the right gutter of the input container, 44×44px minimum touch target, enabled only when valid characters are present.

### 5. Action Cards & Project Embeds
- Nested micro-cards within agent responses highlighting portfolio repositories or case studies.
- Layout: 1px border, surface background, metadata row (stars, tech tags), and an explicit external link icon with 3:1 contrast compliance.

### 6. Accessibility & Form Controls
- **Checkboxes / Radios**: 18×18px target box inside a 44×44px touch bounding area, 2px border radius, colored fill with high-contrast tick icon.
- **Focus Navigation**: Fully navigable via keyboard (`Tab`, `Shift+Tab`, `Escape` to close widget). Focus rings never hidden via `outline: none` without a matching high-visibility ring replacement.