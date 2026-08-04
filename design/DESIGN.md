---
name: Lumina Finance
colors:
  surface: '#0b1326'
  surface-dim: '#0b1326'
  surface-bright: '#31394d'
  surface-container-lowest: '#060e20'
  surface-container-low: '#131b2e'
  surface-container: '#171f33'
  surface-container-high: '#222a3d'
  surface-container-highest: '#2d3449'
  on-surface: '#dae2fd'
  on-surface-variant: '#b9caca'
  inverse-surface: '#dae2fd'
  inverse-on-surface: '#283044'
  outline: '#849495'
  outline-variant: '#3a494a'
  surface-tint: '#00dce5'
  primary: '#e9feff'
  on-primary: '#003739'
  primary-container: '#00f5ff'
  on-primary-container: '#006c71'
  inverse-primary: '#00696e'
  secondary: '#4edea3'
  on-secondary: '#003824'
  secondary-container: '#00a572'
  on-secondary-container: '#00311f'
  tertiary: '#fff9f0'
  on-tertiary: '#3a3000'
  tertiary-container: '#ffdb3f'
  on-tertiary-container: '#736000'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#63f7ff'
  primary-fixed-dim: '#00dce5'
  on-primary-fixed: '#002021'
  on-primary-fixed-variant: '#004f53'
  secondary-fixed: '#6ffbbe'
  secondary-fixed-dim: '#4edea3'
  on-secondary-fixed: '#002113'
  on-secondary-fixed-variant: '#005236'
  tertiary-fixed: '#ffe16c'
  tertiary-fixed-dim: '#e7c427'
  on-tertiary-fixed: '#221b00'
  on-tertiary-fixed-variant: '#544600'
  background: '#0b1326'
  on-background: '#dae2fd'
  surface-variant: '#2d3449'
typography:
  headline-lg:
    fontFamily: Inter
    fontSize: 32px
    fontWeight: '700'
    lineHeight: 40px
    letterSpacing: -0.02em
  headline-lg-mobile:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '700'
    lineHeight: 32px
    letterSpacing: -0.01em
  headline-md:
    fontFamily: Inter
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 28px
  body-lg:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  body-sm:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  label-caps:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '600'
    lineHeight: 16px
    letterSpacing: 0.05em
  mono-data:
    fontFamily: monospace
    fontSize: 14px
    fontWeight: '500'
    lineHeight: 20px
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  unit: 4px
  gutter: 16px
  margin-mobile: 16px
  margin-desktop: 32px
  container-max: 1440px
---

## Brand & Style

This design system is engineered for high-performance financial data management, where precision meets a premium, high-contrast aesthetic. The personality is authoritative, sophisticated, and technologically advanced. It targets power users who require clarity during extended sessions of data analysis.

The style is **Corporate Modern with subtle Neon-Minimalist influences**. It leverages a "Dark UI" first approach, utilizing deep slate backgrounds to reduce eye strain, while employing vibrant electric accents to draw attention to critical transactional data and primary actions. Visual hierarchy is established through meticulous border work and soft, localized glows rather than heavy skeuomorphism.

## Colors

The palette is anchored in a very deep slate (#0F172A) to provide a rich, expansive canvas. 

- **Primary (Electric Cyan):** Used for primary buttons, active states, and focus indicators. It provides a "glow" effect against the dark backdrop.
- **Secondary (Emerald Green):** Dedicated to "Success" states, positive market movements, and secondary highlights.
- **Neutral/Surface:** A tiered system of slates. Surfaces use a slightly lighter hex to create perceived depth.
- **Borders:** Clean, low-opacity strokes (#334155) define the structure without creating visual noise.

## Typography

This design system utilizes **Inter** for all interface elements to ensure maximum legibility across dense data grids. 

- **Headlines:** Feature tight letter-spacing and bold weights to provide strong structural anchors.
- **Data Display:** For financial figures and account numbers, a monospaced font or Inter with tabular numerals should be used to ensure column alignment in tables.
- **Labels:** Small caps with increased tracking are used for table headers and category descriptors to differentiate them from interactive content.

## Layout & Spacing

The layout follows a **Fluid Grid** model with a 12-column structure for desktop. 

- **Rhythm:** All spacing is based on a 4px baseline grid. 
- **Density:** High-density layouts are preferred for data-heavy views, utilizing 8px (sm) and 16px (md) internal padding for components.
- **Desktop:** 12 columns with 16px gutters.
- **Tablet:** 8 columns with 16px gutters.
- **Mobile:** 4 columns with 12px gutters and 16px side margins.

## Elevation & Depth

Hierarchy is established through **Tonal Layering** and **Subtle Glows** rather than traditional shadows.

- **Level 0 (Base):** Deep Slate (#0F172A).
- **Level 1 (Cards/Panels):** Surface Slate (#1E293B) with a 1px solid border (#334155).
- **Level 2 (Modals/Popovers):** Surface Slate with a subtle outer glow using the primary color at 10% opacity to simulate light emission.
- **Interactive States:** Hovering over a card should slightly brighten the border color rather than increasing shadow depth.

## Shapes

The shape language is **Soft** and professional. 

- **Standard Elements:** Buttons, inputs, and cards use a 0.25rem (4px) radius to maintain a precise, engineered feel.
- **Large Containers:** Dashboard widgets or main content areas use `rounded-lg` (8px).
- **Interactive Feedback:** Focus states should use a sharp 2px offset ring in the Primary Electric color.

## Components

### Buttons
- **Primary:** Solid Electric Cyan background with Dark Slate text. Include a subtle `box-shadow` glow of the same color at 20% opacity.
- **Secondary:** Transparent background with a 1px Primary border.
- **Ghost:** No background, white text, becomes tinted with Primary on hover.

### Inputs & Fields
- Backgrounds are 10% darker than the surface they sit on.
- Bottom-border only or full-outline (1px) are both acceptable, provided they use the #334155 border color.
- Active state: Border changes to Electric Cyan with a soft inner glow.

### Data Tables
- Row hover state: Background shifts to a slightly lighter slate.
- Zebra striping: Avoided; use thin 1px horizontal dividers instead.
- Column headers: Use `label-caps` typography.

### Chips & Badges
- Used for status (e.g., "Pending", "Complete"). 
- Status-specific colors (Primary for active, Secondary for success, Red for alert) should be applied as a subtle background tint (15% opacity) with high-contrast text.

### Cards
- No drop shadows. Use a 1px border. 
- Headers within cards should have a thin bottom-divider to separate titles from content.