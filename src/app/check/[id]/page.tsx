import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense, type CSSProperties } from "react";
import { PRODUCT } from "@/lib/config/product";
import { BOIP_TARIEVEN, euro } from "@/lib/config/tarieven";
import { ACTIEVE_STATUSSEN, DISCLAIMER, EINDOORDEEL_LABEL, type GescoordeHit } from "@/lib/schema/pipeline";
import { loadDemoCheck } from "@/lib/store";
import "./report.css";

// Beoogde merknamen zijn vertrouwelijk: nooit indexeren.
export const metadata: Metadata = { title: "Merkonderzoek", robots: { index: false, follow: false } };

const BRON: Record<string, string> = { boip: "Benelux (BOIP)", euipo: "EU (EUIPO)", tmview: "TMview" };
const STATUS: Record<string, string> = {
  aangevraagd: "Aangevraagd",
  gepubliceerd: "Gepubliceerd",
  ingeschreven: "Ingeschreven",
  vervallen: "Vervallen",
};
const GROND: Record<string, { label: string; vraag: string }> = {
  beschrijvend: { label: "Beschrijvend", vraag: "Beschrijft de naam wat je verkoopt?" },
  gangbaar: { label: "Gangbare term", vraag: "Is het een gewoon woord in de branche?" },
  lovend: { label: "Alleen lovend", vraag: "Is het alleen een aanprijzing?" },
  geografisch: { label: "Geografisch", vraag: "Verwijst de naam naar een herkomst?" },
  misleidend: { label: "Misleidend", vraag: "Wekt de naam een verkeerde verwachting?" },
  openbare_orde: { label: "Openbare orde", vraag: "Is de naam aanstootgevend?" },
};
const VARIANT: Record<string, string> = {
  exact: "exact",
  aaneen: "spatie of streepje",
  meervoud: "meervoud",
  spelling: "spelling",
  fonetisch: "klank",
  vertaling: "vertaling",
  dominant_woord: "kernwoord",
};
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
const RISICO_VOLGORDE: Record<string, number> = { hoog: 0, middel: 1, laag: 2 };
const TALEN = ["nl", "fr", "en", "de"] as const;

const SECTIES = [
  ["oordeel", "Oordeel"],
  ["onderscheidend", "Onderscheidend vermogen"],
  ["zoeken", "Zo hebben we gezocht"],
  ["conflicten", "Conflicten"],
  ["klassen", "Klassen"],
  ["kosten", "Kosten"],
  ["aanvullend", "Domein en handelsnaam"],
  ["vervolg", "Wat nu"],
  ["verantwoording", "Verantwoording"],
] as const;

const isActief = (h: GescoordeHit) => (ACTIEVE_STATUSSEN as readonly string[]).includes(h.status);
const kleur = (v: number) => (v >= 70 ? "#b3261e" : v >= 40 ? "#b58900" : "#2f7d55");

function Meter({ value, tint = true }: { value: number; tint?: boolean }) {
  const v = Math.round(value);
  return (
    <span className="meter">
      <i style={{ "--v": v, "--c": tint ? kleur(v) : undefined } as CSSProperties} />
      <b>{v}</b>
    </span>
  );
}

function Hit({ hit }: { hit: GescoordeHit }) {
  const actief = isActief(hit);
  const s = hit.scores;
  return (
    <li className="hit" data-risk={actief ? hit.risico : undefined}>
      <div className="hit-top">
        <strong>{hit.merk}</strong>
        {actief ? <span className={`risk ${hit.risico}`}>Risico {hit.risico}</span> : <span className="risk">Niet meer actief</span>}
      </div>
      <dl className="hit-facts">
        <div>
          <dt>Register</dt>
          <dd>{BRON[hit.bron]}</dd>
        </div>
        <div>
          <dt>Nummer</dt>
          <dd>{hit.nummer}</dd>
        </div>
        <div>
          <dt>Status</dt>
          <dd>{STATUS[hit.status]}</dd>
        </div>
        <div>
          <dt>Klassen</dt>
          <dd>
            {hit.klassen.join(", ")}
            {s.klassenOverlap.length ? ` (overlap: ${s.klassenOverlap.join(", ")})` : " (geen overlap)"}
          </dd>
        </div>
        <div style={{ gridColumn: "1 / -1" }}>
          <dt>Houder</dt>
          <dd>{hit.houder ?? "Onbekend"}</dd>
        </div>
      </dl>
      <div className="hit-sim">
        <div>
          Beeld
          <Meter value={s.visueel * 100} />
        </div>
        <div>
          Klank
          <Meter value={s.auditief * 100} />
        </div>
        <div>
          Betekenis
          <Meter value={s.begripsmatig * 100} />
        </div>
        <div>
          Soortgelijke producten
          <Meter value={s.soortgelijkheid * 100} />
        </div>
      </div>
      <p>{hit.uitleg}</p>
      <p className="rp-note">Gevonden met de zoekvariant “{hit.gevondenMet}”.</p>
    </li>
  );
}

async function Content({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  // Voorlopig alleen de hard gecodeerde voorbeeldcheck. Checks uit de database volgen met de betaalflow.
  const check = loadDemoCheck(id);
  if (!check?.rapport) notFound();
  const r = check.rapport;
  const k = r.eindoordeel.kosten;
  const onderscheidend = ONDERSCHEIDEND[r.absoluteGronden.oordeel];
  const risico = UITKOMST_RISICO[r.eindoordeel.uitkomst];
  const hits = [...r.hits].sort((a, b) => Number(isActief(b)) - Number(isActief(a)) || RISICO_VOLGORDE[a.risico] - RISICO_VOLGORDE[b.risico]);
  const actief = hits.filter(isActief);
  const opvallend = actief.filter((h) => h.risico !== "laag");
  const overig = hits.filter((h) => !opvallend.includes(h));
  const uitgevallen = r.bronnen.filter((b) => !b.ok);
  const bereikbaar = r.bronnen.filter((b) => b.ok);
  const datum = new Date(check.aangemaakt).toLocaleDateString("nl-NL", { day: "numeric", month: "long", year: "numeric" });
  const nummer = `VM-${check.aangemaakt.slice(0, 4)}-${check.id === "voorbeeld" ? "0000" : check.id.slice(0, 4).toUpperCase()}`;
  const kern = r.klassen.klassen.filter((x) => x.kern);

  return (
    <div className="rp">
      <div className="rp-top">
        <Link className="brand" href="/">
          {PRODUCT.naam}
        </Link>
        <span className="doc">
          Merkonderzoek {nummer} · {datum}
        </span>
      </div>

      <div className="rp-body">
        <nav className="rp-nav" aria-label="Onderdelen van het rapport">
          <p>Inhoud</p>
          {SECTIES.map(([anker, label], i) => (
            <a key={anker} href={`#${anker}`}>
              <span>{String(i + 1).padStart(2, "0")}</span>
              {label}
            </a>
          ))}
        </nav>

        <article className="rp-doc">
          {check.id === "voorbeeld" && (
            <p className="rp-demo">Voorbeeldrapport. De naam, de merken, de houders en de inschrijfnummers zijn verzonnen.</p>
          )}

          <header className="rp-head">
            <p className="rp-kicker">Merkonderzoek Benelux · woordmerk</p>
            <h1>{check.naam}</h1>
            <dl className="rp-meta">
              <div>
                <dt>Rapportnummer</dt>
                <dd>{nummer}</dd>
              </div>
              <div>
                <dt>Datum onderzoek</dt>
                <dd>{datum}</dd>
              </div>
              <div>
                <dt>Gebied</dt>
                <dd>Benelux</dd>
              </div>
              <div>
                <dt>Registers</dt>
                <dd>{r.bronnen.map((b) => BRON[b.bron].replace(/ \(.*/, "")).join(", ")}</dd>
              </div>
              <div className="wide">
                <dt>Opgegeven activiteiten</dt>
                <dd>{check.omschrijving}</dd>
              </div>
            </dl>
          </header>

          <section className="rp-sec" id="oordeel">
            <header>
              <span>01</span>
              <h2>Oordeel</h2>
            </header>
            <div className="rp-verdict">
              <div className="top">
                <strong>{EINDOORDEEL_LABEL[r.eindoordeel.uitkomst]}</strong>
                <span className={`risk ${risico}`}>Risico {risico}</span>
              </div>
              <p>{r.eindoordeel.samenvatting}</p>
            </div>
            <dl className="rp-keys">
              <div>
                <dt>Onderscheidend</dt>
                <dd>
                  {onderscheidend.label}
                  <small>zes gronden, vier talen</small>
                </dd>
              </div>
              <div>
                <dt>Conflicten</dt>
                <dd>
                  {opvallend.length} van {actief.length}
                  <small>actieve merken met verhoogd risico</small>
                </dd>
              </div>
              <div>
                <dt>Klassen</dt>
                <dd>
                  {kern.map((x) => x.klasse).join(" en ")}
                  <small>{kern.length === 1 ? "één klasse" : `${kern.length} klassen`} geadviseerd</small>
                </dd>
              </div>
              <div>
                <dt>Kosten depot</dt>
                <dd>
                  {euro(k.totaal)}
                  <small>BOIP en dossier, excl. btw</small>
                </dd>
              </div>
            </dl>
          </section>

          <section className="rp-sec" id="onderscheidend">
            <header>
              <span>02</span>
              <h2>Onderscheidend vermogen</h2>
              <span className={`risk ${onderscheidend.risico}`}>{onderscheidend.label}</span>
            </header>
            <p className="rp-lead">{r.absoluteGronden.uitleg}</p>
            <div className="rp-scroll">
              <table className="rp-table stack">
                <thead>
                  <tr>
                    <th>Weigeringsgrond</th>
                    <th>Kans op weigering</th>
                    <th>Talen</th>
                    <th>Bevinding</th>
                  </tr>
                </thead>
                <tbody>
                  {r.absoluteGronden.gronden.map((g) => (
                    <tr key={g.grond}>
                      <td>
                        <b>{GROND[g.grond].label}</b>
                        <div className="sub">{GROND[g.grond].vraag}</div>
                      </td>
                      <td>
                        <Meter value={g.score} />
                      </td>
                      <td>
                        <span className="langs">
                          {TALEN.map((t) => (
                            <span key={t} data-hit={g.talen.includes(t) ? "1" : undefined}>
                              {t}
                            </span>
                          ))}
                        </span>
                      </td>
                      <td>{g.toelichting}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="rp-note">
              Dit zijn de gronden waarop BOIP een merk uit zichzelf weigert. De score is de geschatte kans op een weigering, van 0 tot 100. Een
              gemarkeerde taal betekent dat het bezwaar in die taal speelt.
            </p>
          </section>

          <section className="rp-sec" id="zoeken">
            <header>
              <span>03</span>
              <h2>Zo hebben we gezocht</h2>
            </header>
            {uitgevallen.length > 0 && (
              <p className="risk hoog" role="alert" style={{ whiteSpace: "normal", borderRadius: 10, padding: "10px 14px" }}>
                {uitgevallen.map((b) => BRON[b.bron]).join(" en ")} was tijdens het onderzoek niet bereikbaar. Dit rapport is daardoor niet
                volledig. Een ontbrekend register is geen schone uitslag.
              </p>
            )}
            <dl className="rp-stats">
              <div>
                <b>{bereikbaar.length}</b>
                <span>registers doorzocht</span>
              </div>
              <div>
                <b>{r.varianten.length}</b>
                <span>zoekvarianten</span>
              </div>
              <div>
                <b>{hits.length}</b>
                <span>merken beoordeeld</span>
              </div>
              <div>
                <b>{opvallend.length}</b>
                <span>met verhoogd risico</span>
              </div>
            </dl>
            <h3>Zoekvarianten</h3>
            <ul className="chips">
              {r.varianten.map((v) => (
                <li key={v.term}>
                  {v.term}
                  <small>
                    {VARIANT[v.soort]}
                    {v.taal ? ` ${v.taal}` : ""}
                  </small>
                </li>
              ))}
            </ul>
            <p className="rp-note">
              We zoeken niet alleen op de naam zelf. Een ouder merk kan ook bezwaar maken als het anders is gespeld maar hetzelfde klinkt, of
              als het in een andere taal hetzelfde betekent. EU-merken gelden ook in de Benelux en tellen daarom mee.
            </p>
          </section>

          <section className="rp-sec" id="conflicten">
            <header>
              <span>04</span>
              <h2>Conflicten</h2>
            </header>
            {opvallend.length ? (
              <>
                <p className="rp-lead">
                  {opvallend.length === 1 ? "Eén merk verdient" : `${opvallend.length} merken verdienen`} je aandacht. Per merk zie je hoe sterk
                  het op jouw naam lijkt in beeld, klank en betekenis, en hoe dicht de producten bij elkaar liggen.
                </p>
                <ul style={{ display: "grid", gap: 12 }}>
                  {opvallend.map((h) => (
                    <Hit key={h.nummer} hit={h} />
                  ))}
                </ul>
              </>
            ) : (
              uitgevallen.length === 0 && (
                <p className="rp-lead">We vonden geen actief merk met een middelhoog of hoog risico. Dat sluit een conflict niet uit.</p>
              )
            )}
            {overig.length > 0 && (
              <>
                <h3>Overige beoordeelde merken</h3>
                <div className="rp-scroll">
                  <table className="rp-table stack">
                    <thead>
                      <tr>
                        <th>Merk</th>
                        <th>Register</th>
                        <th>Klassen</th>
                        <th>Status</th>
                        <th>Waarom laag</th>
                        <th className="num">Risico</th>
                      </tr>
                    </thead>
                    <tbody>
                      {overig.map((h) => (
                        <tr key={h.nummer}>
                          <td>
                            <b>{h.merk}</b>
                            <div className="sub">{h.nummer}</div>
                          </td>
                          <td>{BRON[h.bron].replace(/ \(.*/, "")}</td>
                          <td>{h.klassen.join(", ")}</td>
                          <td>{STATUS[h.status]}</td>
                          <td>{h.uitleg}</td>
                          <td className="num">
                            {isActief(h) ? <span className={`risk ${h.risico}`}>{h.risico}</span> : <span className="risk">niet actief</span>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </section>

          <section className="rp-sec" id="klassen">
            <header>
              <span>05</span>
              <h2>Klassen</h2>
            </header>
            <div className="rp-scroll">
              <table className="rp-table stack">
                <thead>
                  <tr>
                    <th>Klasse</th>
                    <th>Omschrijving voor je depot</th>
                    <th>Waarom</th>
                    <th className="num">BOIP</th>
                  </tr>
                </thead>
                <tbody>
                  {r.klassen.klassen.map((x) => (
                    <tr key={x.klasse}>
                      <td>
                        <b>{x.klasse}</b>
                        {!x.kern && <div className="sub">optie</div>}
                      </td>
                      <td>
                        {x.termen.map((t) => (
                          <div key={t.term}>{t.term}</div>
                        ))}
                      </td>
                      <td>{x.waarom}</td>
                      <td className="num">{x.meerkosten ? `+ ${euro(x.meerkosten)}` : "in basistarief"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="rp-note">{r.klassen.toelichting}</p>
          </section>

          <section className="rp-sec" id="kosten">
            <header>
              <span>06</span>
              <h2>Kosten</h2>
            </header>
            <table className="rp-table">
              <tbody>
                <tr>
                  <td>
                    BOIP-tarief, eerste klasse
                    <div className="sub">Betaal je rechtstreeks aan BOIP bij het indienen</div>
                  </td>
                  <td className="num">{euro(BOIP_TARIEVEN.depotMetEersteKlasse)}</td>
                </tr>
                {k.boip > BOIP_TARIEVEN.depotMetEersteKlasse && (
                  <tr>
                    <td>BOIP-tarief, extra {k.aantalKlassen === 2 ? "klasse" : "klassen"}</td>
                    <td className="num">{euro(k.boip - BOIP_TARIEVEN.depotMetEersteKlasse)}</td>
                  </tr>
                )}
                <tr>
                  <td>
                    Depotdossier
                    <div className="sub">Alle velden van het BOIP-formulier ingevuld, dit rapport inbegrepen</div>
                  </td>
                  <td className="num">{euro(k.onzeDienst)}</td>
                </tr>
              </tbody>
              <tfoot>
                <tr>
                  <td>Totaal voor {k.aantalKlassen === 1 ? "één klasse" : `${k.aantalKlassen} klassen`}, excl. btw</td>
                  <td className="num">{euro(k.totaal)}</td>
                </tr>
              </tfoot>
            </table>
            <p className="rp-note">
              BOIP-tarieven van {new Date(k.tariefdatum).toLocaleDateString("nl-NL", { day: "numeric", month: "long", year: "numeric" })}. BOIP
              betaalt het tarief niet terug als het je merk weigert.
            </p>
          </section>

          <section className="rp-sec" id="aanvullend">
            <header>
              <span>07</span>
              <h2>Domein en handelsnaam</h2>
            </header>
            <table className="rp-table">
              <tbody>
                {r.aanvullend.domeinen.map((d) => (
                  <tr key={d.domein}>
                    <td>{d.domein}</td>
                    <td className="num">
                      <span className={`risk ${d.status === "vrij" ? "laag" : d.status === "bezet" ? "middel" : ""}`}>{d.status}</span>
                    </td>
                  </tr>
                ))}
                <tr>
                  <td>
                    Handelsregister (KvK)
                    <div className="sub">Bedrijven met dezelfde of bijna dezelfde naam</div>
                  </td>
                  <td className="num">
                    {r.aanvullend.handelsnamen === null ? (
                      <span className="risk">niet gecontroleerd</span>
                    ) : r.aanvullend.handelsnamen.length ? (
                      <span className="risk middel">{r.aanvullend.handelsnamen.length} gevonden</span>
                    ) : (
                      <span className="risk laag">geen gevonden</span>
                    )}
                  </td>
                </tr>
              </tbody>
            </table>
            <p className="rp-note">
              Een oudere handelsnaam is geen merk, maar de eigenaar kan zich in zijn eigen regio wel tegen jouw gebruik verzetten.
            </p>
          </section>

          <section className="rp-sec" id="vervolg">
            <header>
              <span>08</span>
              <h2>Wat nu</h2>
            </header>
            <p className="rp-lead">{r.eindoordeel.volgendeStap}</p>
            {r.eindoordeel.aandachtspunten.length > 0 && (
              <>
                <h3>Aandachtspunten</h3>
                <ol className="steps">
                  {r.eindoordeel.aandachtspunten.map((a) => (
                    <li key={a}>
                      <span>{a}</span>
                    </li>
                  ))}
                </ol>
              </>
            )}
            <h3>Na het indienen</h3>
            <ol className="steps">
              <li>
                <span>BOIP toetst je merk op de gronden uit onderdeel 02.</span>
              </li>
              <li>
                <span>BOIP publiceert je aanvraag. Houders van oudere merken hebben daarna twee maanden om oppositie in te stellen.</span>
              </li>
              <li>
                <span>Komt er geen oppositie, dan wordt je merk ingeschreven. De inschrijving geldt tien jaar.</span>
              </li>
            </ol>
          </section>

          <section className="rp-sec" id="verantwoording">
            <header>
              <span>09</span>
              <h2>Verantwoording</h2>
            </header>
            <p className="rp-note">
              Dit onderzoek is uitgevoerd op {datum} met de registergegevens van dat moment. De beoordeling volgt de toetsing die BOIP zelf
              toepast: eerst de absolute weigeringsgronden, daarna de overeenstemming met oudere merken in beeld, klank en betekenis, en de
              soortgelijkheid van de producten en diensten. Merken die na deze datum zijn aangevraagd, staan er niet in.
            </p>
            <p className="rp-note">
              BOIP toetst zelf niet op oudere merken. Daarom laat dit rapport zien welke merken bezwaar zouden kunnen maken, zodat je dat weet
              voordat je betaalt voor een depot.
            </p>
            <p className="rp-note">{DISCLAIMER}</p>
            <div className="rp-actions">
              <Link className="rp-btn ghost" href="/">
                Terug naar {PRODUCT.naam}
              </Link>
            </div>
          </section>
        </article>
      </div>
    </div>
  );
}

export default function Page(props: PageProps<"/check/[id]">) {
  return (
    <Suspense fallback={<p style={{ padding: 24 }}>Laden…</p>}>
      <Content params={props.params} />
    </Suspense>
  );
}
