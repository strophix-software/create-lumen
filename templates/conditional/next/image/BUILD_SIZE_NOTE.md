# next/image Build Size and Performance Impact

## Built-In Optimization
`next/image` extends standard HTML `<img>` elements with automatic visual stability and performance optimizations:
1. **Zero Cumulative Layout Shift (CLS)**: Enforces explicit `width` and `height` dimensions or fills the parent container with `fill`, reserving geometric space before the bitmap payload loads.
2. **Modern Format Negotiation**: Serves WebP and AVIF modern formats dynamically when supported by the requesting browser, yielding 30–50% bandwidth reduction compared to legacy JPEG/PNG.
3. **Native Lazy Loading**: Viewport-aware on-demand loading so off-screen images do not delay initial page interactivity. The `priority` property allows opting into preloading for Largest Contentful Paint (LCP) elements.

## Bundle Footprint
- **Runtime JavaScript Overhead**: ~5 KB gzipped client-side runtime handling IntersectionObserver and responsive `srcSet` generation.
- **Build Impact**: Zero additional build time overhead during static compilation when referencing local SVGs or remote URLs; image transformations are handled on-demand by the Next.js server image optimizer.

## Router Parity
- **App Router**: Fully compatible with both Server Components (static rendering) and Client Components (`"use client"`).
- **Pages Router**: Fully compatible with all page and component hierarchies.
