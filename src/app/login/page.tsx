import type { Metadata } from "next";
import { Suspense } from "react";
import LoginForm from "./login-form";

export const metadata: Metadata = { title: "Inloggen", robots: { index: false } };

async function Form({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  const { next, error } = await searchParams;
  const safeNext = next && next.startsWith("/") && !next.startsWith("//") ? next : "/dashboard";
  return (
    <>
      {error && (
        <p className="error" role="alert">
          {error === "otp_expired"
            ? "Deze link is verlopen of al gebruikt. Vraag een nieuwe aan en open alleen de nieuwste mail."
            : "Inloggen is niet gelukt. Vraag een nieuwe link aan."}
        </p>
      )}
      <LoginForm next={safeNext} />
    </>
  );
}

export default function Page(props: PageProps<"/login">) {
  return (
    <main className="page">
      <h1>Inloggen</h1>
      <p className="muted">Geen wachtwoord nodig. We sturen je een link per e-mail.</p>
      <Suspense fallback={null}>
        <Form searchParams={props.searchParams} />
      </Suspense>
    </main>
  );
}
