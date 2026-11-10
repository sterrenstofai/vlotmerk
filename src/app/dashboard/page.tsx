import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { getUser, listChecks } from "@/lib/store";
import { signOut } from "./actions";

export const metadata: Metadata = { title: "Mijn checks", robots: { index: false } };

const STATUS: Record<string, string> = {
  nieuw: "Nieuw",
  gratis_bezig: "Bezig",
  gratis_klaar: "Check",
  rapport_bezig: "Rapport wordt gemaakt",
  rapport_klaar: "Rapport",
  mislukt: "Mislukt",
};

async function Content() {
  const user = await getUser();
  if (!user) redirect("/login?next=/dashboard");
  const checks = await listChecks();

  return (
    <>
      <p className="muted">Ingelogd als {user.email}</p>
      <h2>Je checks</h2>
      {checks.length ? (
        <ul className="kits">
          {checks.map((c) => (
            <li key={c.id}>
              <span>
                <b>{c.naam}</b> <span className="tag">{STATUS[c.status] ?? c.status}</span>
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="muted">Je hebt nog geen checks.</p>
      )}
      <div className="row-actions">
        <Link className="btn ghost" href="/check/voorbeeld">
          Bekijk een voorbeeldrapport
        </Link>
      </div>
      <form action={signOut}>
        <button className="btn ghost" type="submit">
          Uitloggen
        </button>
      </form>
    </>
  );
}

export default function Page() {
  return (
    <main className="page">
      <h1>Mijn checks</h1>
      <Suspense fallback={<p className="muted">Laden…</p>}>
        <Content />
      </Suspense>
    </main>
  );
}
