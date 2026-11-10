import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { euro } from "@/lib/config/tarieven";
import { ACTIEVE_STATUSSEN, DISCLAIMER, EINDOORDEEL_LABEL, type GescoordeHit } from "@/lib/schema/pipeline";
import { loadDemoCheck } from "@/lib/store";

// Beoogde merknamen zijn vertrouwelijk: nooit indexeren.
export const metadata: Metadata = { title: "Check", robots: { index: false, follow: false } };

const BRON: Record<string, string> = { boip: "Benelux (BOIP)", euipo: "EU (EUIPO)", tmview: "TMview" };
const ONDERSCHEIDEND: Record<string, { label: string; risico: string }> = {
  sterk: { label: "Sterk", risico: "laag" },
  twijfel: { label: "Twijfel", risico: "middel" },
  zwak: { label: "Zwak", risico: "hoog" },
};
const UITKOMST_RISICO: Record<string, string> = {
  sterke_kandidaat: "laag",
  kan_met_aandachtspunten: "middel",
  riskant: "hoog",
  niet_doen: "hoog",
};

const isActief = (h: GescoordeHit) => (ACTIEVE_STATUSSEN as readonly string[]).includes(h.status);

function HitRow({ hit }: { hit: GescoordeHit }) {
  return (
    <li>
      <span>
        <b>{hit.merk}</b> · {BRON[hit.bron]} · klasse {hit.klassen.join(", ")}
        <br />
        <span className="muted">
          {hit.houder ?? "Houder onbekend"} · {hit.nummer}
        </span>
        <br />
        {hit.uitleg}
      </span>
      {isActief(hit) ? <span className={`risk ${hit.risico}`}>Risico {hit.risico}</span> : <span className="risk">Niet meer actief</span>}
    </li>
  );
}

async function Content({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  // Sessie 1 kent alleen de hard gecodeerde voorbeeldcheck. Checks uit de database volgen in sessie 5 en 6.
  const check = loadDemoCheck(id);
  if (!check?.rapport) notFound();
  const r = check.rapport;
  const onderscheidend = ONDERSCHEIDEND[r.absoluteGronden.oordeel];
  const actief = r.hits.filter(isActief);
  const prominent = actief.filter((h) => h.risico !== "laag");
  const overig = r.hits.filter((h) => !prominent.includes(h));
  const uitgevallen = r.bronnen.filter((b) => !b.ok);

  return (
    <>
      <p className="demo-note">Dit is een voorbeeld. De naam, de houders en de inschrijfnummers zijn verzonnen.</p>
      <h1>{check.naam}</h1>
      <p className="muted">{check.omschrijving}</p>

      <section className="block verdict">
        <h2>
          {EINDOORDEEL_LABEL[r.eindoordeel.uitkomst]}
          <span className={`risk ${UITKOMST_RISICO[r.eindoordeel.uitkomst]}`}>Risico {UITKOMST_RISICO[r.eindoordeel.uitkomst]}</span>
        </h2>
        <p>{r.eindoordeel.samenvatting}</p>
        <p className="muted">Volgende stap: {r.eindoordeel.volgendeStap}</p>
      </section>

      <section className="block">
        <h2>
          Onderscheidend vermogen
          <span className={`risk ${onderscheidend.risico}`}>{onderscheidend.label}</span>
        </h2>
        <p>{r.absoluteGronden.uitleg}</p>
      </section>

      <section className="block">
        <h2>Conflicten</h2>
        {uitgevallen.length > 0 && (
          <p className="error" role="alert">
            {uitgevallen.map((b) => BRON[b.bron]).join(" en ")} tijdelijk niet bereikbaar. Dit overzicht is daardoor niet volledig.
          </p>
        )}
        <p className="muted">
          Gezocht op {r.varianten.length} varianten in {r.bronnen.filter((b) => b.ok).map((b) => BRON[b.bron]).join(" en ")}.
        </p>
        {prominent.length ? (
          <ul className="rows">
            {prominent.map((h) => (
              <HitRow key={h.nummer} hit={h} />
            ))}
          </ul>
        ) : (
          uitgevallen.length === 0 && <p>Geen treffers met een middelhoog of hoog risico gevonden.</p>
        )}
        {overig.length > 0 && (
          <details>
            <summary className="muted">Overige treffers ({overig.length})</summary>
            <ul className="rows" style={{ marginTop: 8 }}>
              {overig.map((h) => (
                <HitRow key={h.nummer} hit={h} />
              ))}
            </ul>
          </details>
        )}
      </section>

      <section className="block">
        <h2>Klassen</h2>
        <ul className="rows">
          {r.klassen.klassen.map((k) => (
            <li key={k.klasse}>
              <span>
                <b>Klasse {k.klasse}</b> · {k.termen.map((t) => t.term).join("; ")}
                <br />
                <span className="muted">{k.waarom}</span>
              </span>
              <span className="tag">{k.meerkosten ? `+ ${euro(k.meerkosten)}` : "in basistarief"}</span>
            </li>
          ))}
        </ul>
        <p className="muted">{r.klassen.toelichting}</p>
      </section>

      <section className="block">
        <h2>Kosten</h2>
        <ul className="rows">
          <li>
            <span>BOIP-tarief, {r.eindoordeel.kosten.aantalKlassen} klassen</span>
            <span>{euro(r.eindoordeel.kosten.boip)}</span>
          </li>
          <li>
            <span>Depotdossier</span>
            <span>{euro(r.eindoordeel.kosten.onzeDienst)}</span>
          </li>
          <li>
            <b>Totaal, excl. btw</b>
            <b>{euro(r.eindoordeel.kosten.totaal)}</b>
          </li>
        </ul>
        <p className="muted">BOIP betaalt het tarief niet terug als het je merk weigert.</p>
      </section>

      <section className="block">
        <h2>Domeinnamen</h2>
        <ul className="rows">
          {r.aanvullend.domeinen.map((d) => (
            <li key={d.domein}>
              <span>{d.domein}</span>
              <span className={`risk ${d.status === "vrij" ? "laag" : d.status === "bezet" ? "middel" : ""}`}>{d.status}</span>
            </li>
          ))}
        </ul>
      </section>

      {r.eindoordeel.aandachtspunten.length > 0 && (
        <section className="block">
          <h2>Aandachtspunten</h2>
          <ul className="rows">
            {r.eindoordeel.aandachtspunten.map((a) => (
              <li key={a}>
                <span>{a}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <p className="muted">{DISCLAIMER}</p>
      <p className="muted">
        BOIP toetst zelf niet op oudere merken. Houders van oudere merken kunnen tot twee maanden na publicatie oppositie instellen.
      </p>
      <div className="row-actions">
        <Link className="btn ghost" href="/">
          Terug
        </Link>
      </div>
    </>
  );
}

export default function Page(props: PageProps<"/check/[id]">) {
  return (
    <main className="page">
      <Suspense fallback={<p className="muted">Laden…</p>}>
        <Content params={props.params} />
      </Suspense>
    </main>
  );
}
