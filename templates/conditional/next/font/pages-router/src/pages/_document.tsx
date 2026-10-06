import { Html, Head, Main, NextScript } from "next/document";

/**
 * Pages Router Custom Document.
 * Note: Per Next.js compiler specifications, next/font loaders are configured
 * in pages/_app to avoid the 'Cannot be used within pages/_document' compile error.
 */
export default function Document() {
  return (
    <Html lang="en">
      <Head />
      <body className="antialiased">
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
