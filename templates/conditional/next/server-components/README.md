# React Server Components (RSC) Boundaries & Linting

This conditional template provides:
1. **Server vs Client Boundary Components**: Clean demonstrations of React Server Components composing Client Components with `"use client"`.
2. **ESLint Rule Wiring (`rsc/no-server-imports-in-client`)**: An AST-based ESLint rule that disallows importing server-only packages (e.g., `server-only`, Node.js built-ins) into Client Components marked with `"use client"`.
3. **Dual Router Compatibility**: Operates seamlessly in both Next.js App Router and Pages Router.

## Components
- `ClientCounter`: An interactive client component demonstrating React state and event handling.
- `ServerCard`: A server-rendered component shell passing children and composing `ClientCounter` across the boundary.

## ESLint Configuration
Wires `rsc/no-server-imports-in-client` and `no-restricted-imports` into Next.js flat configuration (`eslint.config.mjs`).
