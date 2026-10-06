import type { Metadata } from "next";
import Link from "next/link";

type Props = {
  params: Promise<{ slug: string }> | { slug: string };
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const resolvedParams = await params;
  const slug = resolvedParams?.slug || "";
  return {
    title: slug,
  };
}

export default async function BlogPost({ params }: Props) {
  const resolvedParams = await params;
  const slug = resolvedParams?.slug || "";

  return (
    <main
      style={{
        padding: "2rem",
        fontFamily: "var(--font-geist-sans, sans-serif)",
        maxWidth: "800px",
        margin: "0 auto",
      }}
    >
      <h1>{slug}</h1>
      <p style={{ marginTop: "1rem" }}>Post slug: {slug}</p>
      <p style={{ marginTop: "1.5rem" }}>
        <Link href="/" style={{ textDecoration: "underline" }}>
          Back to home
        </Link>
      </p>
    </main>
  );
}
