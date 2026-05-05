---
name: Monochrome Glassmorphism
colors:
  surface: '#f9f9f9'
  surface-dim: '#dadada'
  surface-bright: '#f9f9f9'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f3f3f3'
  surface-container: '#eeeeee'
  surface-container-high: '#e8e8e8'
  surface-container-highest: '#e2e2e2'
  on-surface: '#1a1c1c'
  on-surface-variant: '#444748'
  inverse-surface: '#2f3131'
  inverse-on-surface: '#f0f1f1'
  outline: '#747878'
  outline-variant: '#c4c7c7'
  surface-tint: '#5f5e5e'
  primary: '#000000'
  on-primary: '#ffffff'
  primary-container: '#1c1b1b'
  on-primary-container: '#858383'
  inverse-primary: '#c8c6c5'
  secondary: '#5d5e66'
  on-secondary: '#ffffff'
  secondary-container: '#e3e1ec'
  on-secondary-container: '#63646c'
  tertiary: '#000000'
  on-tertiary: '#ffffff'
  tertiary-container: '#1a1c1e'
  on-tertiary-container: '#838487'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#e5e2e1'
  primary-fixed-dim: '#c8c6c5'
  on-primary-fixed: '#1c1b1b'
  on-primary-fixed-variant: '#474646'
  secondary-fixed: '#e3e1ec'
  secondary-fixed-dim: '#c6c5cf'
  on-secondary-fixed: '#1a1b22'
  on-secondary-fixed-variant: '#46464e'
  tertiary-fixed: '#e2e2e5'
  tertiary-fixed-dim: '#c6c6c9'
  on-tertiary-fixed: '#1a1c1e'
  on-tertiary-fixed-variant: '#454749'
  background: '#f9f9f9'
  on-background: '#1a1c1c'
  surface-variant: '#e2e2e2'
typography:
  display:
    fontFamily: Inter
    fontSize: 48px
    fontWeight: '700'
    lineHeight: '1.1'
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Inter
    fontSize: 30px
    fontWeight: '600'
    lineHeight: '1.2'
    letterSpacing: -0.01em
  headline-md:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '600'
    lineHeight: '1.3'
  body-lg:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: '400'
    lineHeight: '1.6'
  body-md:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: '1.5'
  body-sm:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: '1.5'
  label-md:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '600'
    lineHeight: '1'
    letterSpacing: 0.05em
  label-sm:
    fontFamily: Inter
    fontSize: 10px
    fontWeight: '500'
    lineHeight: '1'
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  base: 8px
  xs: 4px
  sm: 12px
  md: 24px
  lg: 40px
  xl: 64px
  gutter: 24px
  margin: 32px
---

## Brand & Style

The design system is centered on the concept of "Digital Lucidity." It prioritizes an atmosphere of extreme calm and organized intelligence, designed to act as a quiet assistant rather than a distraction. By stripping away color complexity and leaning into a monochrome palette, the interface highlights content and structure over decoration.

The style combines **Minimalism** with high-fidelity **Glassmorphism**. The aesthetic is defined by white frosted glass surfaces that suggest depth and transparency, signaling a "smart" and "helpful" environment. It evokes a sense of high-end productivity, where the UI feels like a clean, well-lit workspace. Every element is intentional, aiming to reduce cognitive load for users navigating complex browser data or dashboard analytics.

## Colors

This design system utilizes a strict monochrome palette to maintain focus and sophistication. The primary color is a deep charcoal, reserved for high-contrast text and essential calls to action. Secondary and tertiary grays provide hierarchical depth without introducing visual noise.

The "color" of the interface is largely driven by light and transparency. Backgrounds are not solid but are composed of layered translucent whites. Pale gray gradients are applied subtly to surfaces to simulate the way light hits frosted glass, ensuring that even in a colorless environment, the UI feels tactile and three-dimensional.

## Typography

Inter is the sole typeface for the design system, chosen for its exceptional readability in both dense dashboard environments and compact browser extensions. The typographic scale is highly disciplined, using weight and subtle tracking adjustments to create hierarchy rather than color.

Headlines feature tighter letter-spacing and heavier weights to feel "anchored" on the glass surfaces. Body text maintains a generous line height to ensure the "calm" brand pillar is upheld, preventing information-dense areas from feeling cramped. Labels use uppercase styling and increased tracking to provide clear section markers without requiring heavy visual containers.

## Layout & Spacing

The design system employs a **fluid grid** model for the dashboard, allowing it to scale across desktop environments, while the browser extension utilizes a **fixed-width** container with dynamic vertical expansion. 

A 12-column grid governs the dashboard, with a standard 24px gutter to maintain airiness between glass modules. Spacing is strictly based on an 8px rhythmic unit. For the browser extension, margins are reduced to 16px to maximize utility in limited real estate, but the 8px unit remains the foundation for internal padding of components to ensure a consistent visual language across all platforms.

## Elevation & Depth

Depth in this design system is achieved through physical metaphors of light and glass rather than traditional shadows. 

1.  **Backdrop Blur:** All primary surfaces must utilize a high background blur (minimum 20px to 40px) to separate the UI from the underlying desktop or webpage content.
2.  **Glass Layers:** Depth is conveyed by stacking translucent layers. Each successive layer "above" the base increases in opacity slightly (from 70% to 90% white).
3.  **Inner Glow / Strokes:** Every glass surface features a 1px solid white border at 40% opacity. This acts as a "specular highlight," defining the edges of the frosted pane against the blurred background.
4.  **Soft Ambient Shadows:** Only the topmost layer (e.g., a modal or a dropdown) receives a shadow. These shadows are extremely diffused, using a low-opacity charcoal tint to simulate a soft ambient occlusion rather than a direct light source.

## Shapes

The design system uses a high border-radius to reinforce the "helpful" and "modern" aesthetic. 

- **Standard Containers:** Cards and dashboard modules use a 1rem (16px) radius.
- **Interactive Elements:** Buttons and input fields use a 0.5rem (8px) radius.
- **System Components:** Large-scale dashboard sections use 1.5rem (24px) to create a soft, welcoming frame for the content.

The consistency of these curves is vital; sharp corners are strictly avoided to ensure the interface never feels aggressive or purely "utilitarian."

## Components

### Buttons
Primary buttons are solid charcoal with white text for maximum impact. Secondary buttons use the "glass" style: a translucent white background with a 1px border and charcoal text. Ghost buttons use no background and only appear on hover with a subtle gray tint.

### Cards & Modules
The foundational component of the dashboard. Cards must have the `backdrop-filter: blur` property and the 1px specular border. Content inside cards should be padded at 24px (md) to maintain the "organized" feel.

### Input Fields
Inputs are rendered as soft gray "wells" (subtle inner gradients) or clear glass panes. The focus state is indicated by a slightly thicker charcoal border or a subtle increase in the backdrop blur's opacity.

### Chips & Tags
Used for categorization. These are pill-shaped with a 2rem radius, utilizing a tertiary gray background and small-cap labels to remain unobtrusive.

### Lists & Navigation
Navigation items use a "soft highlight" on hover—a low-opacity white fill that rounds to the component's radius. Active states are marked with a small charcoal vertical bar or a bolding of the Inter typeface.

### Browser Extension Specializations
For the extension, components are scaled down (compact spacing), but maintain the same glass effects. Toggle switches and checkboxes follow the monochrome theme: charcoal for "on" and pale gray for "off."