import Head from "next/head";
import Link from "next/link";

export default function Custom500() {
  return (
    <>
      <Head>
        <title>500 - Server Error</title>
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
        <h1>500 - Server-side error occurred</h1>
        <p style={{ marginTop: "1rem" }}>
          Something went wrong on our end.
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
