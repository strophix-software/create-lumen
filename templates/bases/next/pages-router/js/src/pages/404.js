import Head from "next/head";
import Link from "next/link";

export default function Custom404() {
  return (
    <>
      <Head>
        <title>404 - Page Not Found</title>
      </Head>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          minHeight: "100vh",
          fontFamily: "var(--font-geist-sans, sans-serif)",
          padding: "2rem",
          textAlign: "center",
        }}
      >
        <h1>404 - Page Not Found</h1>
        <p style={{ marginTop: "1rem" }}>
          The page you are looking for does not exist.
        </p>
        <Link
          href="/"
          style={{ marginTop: "1.5rem", textDecoration: "underline" }}
        >
          Go back home
        </Link>
      </div>
    </>
  );
}
