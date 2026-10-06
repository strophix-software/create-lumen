import type { GetServerSideProps, InferGetServerSidePropsType } from "next";
import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";

export const getServerSideProps: GetServerSideProps<{ slug: string }> = async (
  context,
) => {
  const slug = (context.params?.slug as string) || "";
  return {
    props: {
      slug,
    },
  };
};

export default function BlogPost({
  slug,
}: InferGetServerSidePropsType<typeof getServerSideProps>) {
  const router = useRouter();
  const displaySlug = slug || (router.query.slug as string) || "";

  return (
    <>
      <Head>
        <title>{displaySlug}</title>
      </Head>
      <main
        style={{
          padding: "2rem",
          fontFamily: "var(--font-geist-sans, sans-serif)",
          maxWidth: "800px",
          margin: "0 auto",
        }}
      >
        <h1>{displaySlug}</h1>
        <p style={{ marginTop: "1rem" }}>Post slug: {displaySlug}</p>
        <p style={{ marginTop: "1.5rem" }}>
          <Link href="/" style={{ textDecoration: "underline" }}>
            Back to home
          </Link>
        </p>
      </main>
    </>
  );
}
