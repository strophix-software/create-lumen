# next/font Build Size and Performance Impact

## Zero Layout Shift & Self-Hosting
`next/font` (specifically `Geist` and `Geist_Mono` via `next/font/google`) automatically optimizes font loading:
1. **Self-Hosting at Build Time**: Google Fonts are downloaded during `next build` and hosted alongside your static assets directly from the same domain. No external requests are made to Google Fonts servers by the browser at runtime, improving privacy and removing DNS/TLS negotiation latency.
2. **Zero Cumulative Layout Shift (CLS)**: Uses CSS `size-adjust` to match fallback fonts automatically while custom fonts are loading.
3. **Preloaded Subsets**: Automatically subsets font glyphs (defaulting to `latin`) to reduce file weight.

## Bundle Footprint
- **Runtime JavaScript**: ~0 bytes (compiled away into CSS variables and HTML classes).
- **Static Assets**: ~20-30 KB compressed WOFF2 font payload served statically with aggressive caching (`Cache-Control: public, max-age=31536000, immutable`).
- **HTML/CSS Injection**: Inline CSS variable definitions (`--font-geist-sans`, `--font-geist-mono`) attached to root wrappers, eliminating render-blocking external stylesheet links.

## Parity Across Routers
- **App Router**: Wired into root `app/layout.tsx` (or `app/layout.js`) via `className={`${geistSans.variable} ${geistMono.variable}`}` on `<html>`.
- **Pages Router**: Wired into root `pages/_app.tsx` (or `pages/_app.js`) wrapping the page tree with `${geistSans.variable} ${geistMono.variable}`. (Note: Per Next.js compiler specifications, `next/font` is strictly prohibited inside `pages/_document.js` with a compile-time error and must be loaded in `_app.js` or page components).
- Both routers expose identical CSS custom properties for global and modular CSS styling.
