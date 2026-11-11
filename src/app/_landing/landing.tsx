"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, type CSSProperties, type ReactNode } from "react";
import { BOIP_TARIEVEN, PRIJZEN, euro, totaalMetCheck } from "@/lib/config/tarieven";
import { VERGELIJKING } from "@/lib/config/vergelijking";
import { BRANDS, luminance, readableOn } from "./brands";
import { FONTS } from "./fonts";
import { PRODUCT } from "@/lib/config/product";
import { Logo } from "./logo";
import { loadSprite, paintSprite, type SpriteKey } from "./sprites";
import type { Hang, Pile, ToyLook } from "./toys";
import "lenis/dist/lenis.css";
import "./landing.css";

const EXAMPLE = "/check/voorbeeld";
const TOTAAL = totaalMetCheck(1);
const ONZE_PRIJS = PRIJZEN.check + PRIJZEN.depot;
const BOIP = BOIP_TARIEVEN.depotMetEersteKlasse;
const BESPARING = Math.floor(VERGELIJKING.merkenbureaus.laag - TOTAAL);
const PRICE_LINE = `Samen ${euro(TOTAAL)}, excl. btw. Bij een merkenbureau ${euro(VERGELIJKING.merkenbureaus.laag)} tot ${euro(VERGELIJKING.merkenbureaus.hoog)}.`;
const PEILDATUM = new Date(VERGELIJKING.peildatum).toLocaleDateString("nl-NL", { day: "numeric", month: "long", year: "numeric" });

const SOURCES = ["Benelux (BOIP)", "EU (EUIPO)", "Domeinnamen", "KvK"];

const STEPS: { title: string; short: string; price: string; text: string; icon: SpriteKey }[] = [
  {
    title: "Check je naam",
    short: "Check",
    price: euro(PRIJZEN.check),
    text: "Vul je naam in en vertel wat je doet. Binnen een halve minuut weet je of de naam sterk genoeg is en of er een bijna gelijk merk bestaat.",
    icon: "loupe",
  },
  {
    title: "Rapport en depotdossier",
    short: "Rapport en dossier",
    price: euro(PRIJZEN.depot),
    text: "Het volledige onderzoek naar botsende merken, de klassen die bij je passen, en een dossier dat zo in het formulier van BOIP past.",
    icon: "page",
  },
  {
    title: "Indienen bij BOIP",
    short: "BOIP-tarief",
    price: euro(BOIP),
    text: "Kopiëren, plakken, indienen. Je betaalt het tarief rechtstreeks aan BOIP, het officiële merkenbureau van de Benelux.",
    icon: "stamp",
  },
];

const WHY: { title: string; text: string; icon: SpriteKey }[] = [
  {
    title: "Wie eerst deponeert, heeft het merk.",
    text: "In de Benelux telt de datum van je depot. Legt een ander jouw naam eerder vast, dan sta jij achteraan, ook als je de naam al jaren gebruikt.",
    icon: "lock",
  },
  {
    title: "BOIP kijkt niet of je naam al bestaat.",
    text: "BOIP schrijft je merk in zonder te controleren op oudere merken. De houder daarvan kan tot twee maanden na publicatie bezwaar maken.",
    icon: "bell",
  },
  {
    title: "Geweigerd is geld weg.",
    text: `Wijst BOIP je naam af, dan krijg je de ${euro(BOIP)} niet terug. Een check van ${euro(PRIJZEN.check)} vooraf is de goedkoopste verzekering.`,
    icon: "shield",
  },
];

const FLOW: { when: string; title: string; text: string; price: string; ours: boolean }[] = [
  { when: "Stap 1", title: "Check", text: "Onderscheidend vermogen, bijna gelijke merken en je domeinnaam.", price: euro(PRIJZEN.check), ours: true },
  { when: "Stap 2", title: "Rapport en depotdossier", text: "Volledige conflictscan, klassenadvies en alle velden van het BOIP-formulier ingevuld, met stappenplan.", price: euro(PRIJZEN.depot), ours: true },
  { when: "Stap 3", title: "Indienen bij BOIP", text: "Je dient zelf in via MyBOIP en betaalt BOIP rechtstreeks. Eén klasse zit in het tarief.", price: euro(BOIP), ours: false },
  { when: "Daarna", title: "Toetsing en publicatie", text: "BOIP toetst je merk en publiceert het. Anderen hebben twee maanden om bezwaar te maken.", price: "Inbegrepen", ours: false },
  { when: "Klaar", title: "Inschrijving", text: "Je merk is ingeschreven en tien jaar van jou.", price: "Inbegrepen", ours: false },
  { when: "Optie", title: "Bewaking", text: "Elke week kijken we of iemand een merk aanvraagt dat op het jouwe lijkt. Je hoort het op tijd.", price: `${euro(PRIJZEN.bewakingPerMaand)} per maand`, ours: true },
];

const VS: { label: string; us: string; bureau: string; zelf: string }[] = [
  { label: "Prijs voor één klasse", us: euro(TOTAAL), bureau: `${euro(VERGELIJKING.merkenbureaus.laag)} tot ${euro(VERGELIJKING.merkenbureaus.hoog)}`, zelf: euro(BOIP) },
  { label: "Onderzoek naar botsende merken", us: "Ja, in je rapport", bureau: "Meestal, verschilt per bureau", zelf: "Nee, zelf uitzoeken" },
  { label: "Klassen gekozen en omschreven", us: "Ja, zo smal mogelijk", bureau: "Ja", zelf: "Nee, zelf doen" },
  { label: "Hoe snel", us: "Rapport binnen twee minuten", bureau: "Op afspraak", zelf: "Zodra je het formulier snapt" },
  { label: "Wie dient in", us: "Jij, met ons ingevulde dossier", bureau: "Het bureau", zelf: "Jij" },
  { label: "Persoonlijk juridisch advies", us: "Nee, wel doorverwijzing", bureau: "Ja", zelf: "Nee" },
];

const FAQ: { q: string; a: string }[] = [
  {
    q: "Waarom is de check niet gratis?",
    a: `Omdat we voor elke check echt in de registers zoeken. ${euro(PRIJZEN.check)} houdt de dienst serieus en is een fractie van de ${euro(BOIP)} die je kwijt bent als BOIP je naam weigert.`,
  },
  {
    q: "Wat betaal ik in totaal?",
    a: `${euro(PRIJZEN.check)} voor de check, ${euro(PRIJZEN.depot)} voor het rapport met depotdossier en ${euro(BOIP)} aan BOIP: samen ${euro(TOTAAL)} voor één klasse, exclusief btw. Een tweede klasse kost ${euro(BOIP_TARIEVEN.tweedeKlasse)} extra bij BOIP, elke klasse daarna ${euro(BOIP_TARIEVEN.derdeKlasseEnVerder)}.`,
  },
  {
    q: "Is mijn merk daarna gegarandeerd ingeschreven?",
    a: "Nee, en wie dat belooft, vertelt niet het hele verhaal. Je krijgt een risico-indicatie: hoe groot is de kans op een weigering of op bezwaar van een ouder merk. BOIP beslist over de inschrijving.",
  },
  {
    q: "Wat als de check slecht uitvalt?",
    a: `Dan heb je voor ${euro(PRIJZEN.check)} voorkomen dat je ${euro(BOIP)} kwijt bent. Je ziet waarom de naam zwak of riskant is, zodat je een betere kunt kiezen of het kunt voorleggen aan een merkengemachtigde.`,
  },
  {
    q: "Moet ik zelf indienen bij BOIP?",
    a: "Ja. Je krijgt een dossier met alle velden van het formulier al ingevuld en een stappenplan. Indienen is kopiëren en plakken. Daardoor betaal je geen bureau en blijft het merk direct op jouw naam staan.",
  },
  {
    q: "Geldt mijn merk ook in België en Luxemburg?",
    a: "Ja. Een Benelux-merk geldt in Nederland, België en Luxemburg tegelijk, tien jaar lang, en is daarna te verlengen.",
  },
];

function Words({ children }: { children: string }) {
  return (
    <>
      {children.split(" ").map((word, i) => (
        <span key={i}>
          <span className="w" style={{ "--i": i } as CSSProperties}>
            <span>{word}</span>
          </span>{" "}
        </span>
      ))}
    </>
  );
}

function KitIcon({ name, color, className = "" }: { name: SpriteKey; color: string; className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    let dead = false;
    loadSprite(name)
      .then((sprite) => {
        if (!dead && ref.current) paintSprite(ref.current, sprite, color);
      })
      .catch(() => {});
    return () => {
      dead = true;
    };
  }, [name, color]);
  return <canvas ref={ref} className={`kicon ${className}`} width={420} height={420} aria-hidden="true" />;
}

function Arrow() {
  return (
    <svg className="arrow" viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
      <path d="M2 8h11M9 3.5 13.5 8 9 12.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function Landing() {
  const root = useRef<HTMLDivElement>(null);
  const hangHost = useRef<HTMLDivElement>(null);
  const pileHost = useRef<HTMLDivElement>(null);
  const hang = useRef<Hang | null>(null);
  const pile = useRef<Pile | null>(null);

  const brand = BRANDS[0];
  const font = FONTS[brand.font];
  const light = luminance(brand.bg) > 0.35;
  const radius = brand.radius >= 32 ? 999 : brand.radius;

  const look: ToyLook = useMemo(
    () => ({
      tints: brand.tints,
      tag: { text: brand.name, font: font.family, weight: font.weight, bg: brand.accent, fg: readableOn(brand.accent), radius },
    }),
    [brand, font, radius],
  );
  const lookRef = useRef(look);

  useEffect(() => {
    lookRef.current = look;
    hang.current?.setLook(look);
    pile.current?.setLook(look);
  }, [look]);

  useEffect(() => {
    const html = document.documentElement;
    const prev = html.style.backgroundColor;
    html.style.backgroundColor = brand.bg;
    return () => {
      html.style.backgroundColor = prev;
    };
  }, [brand.bg]);

  useEffect(() => {
    const el = root.current!;
    el.dataset.js = "1";
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const coarse = window.matchMedia("(pointer: coarse)").matches;
    let dead = false;
    let lenis: { destroy: () => void } | null = null;

    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            e.target.classList.add("in");
            io.unobserve(e.target);
          }
        }
      },
      { rootMargin: "0px 0px -10% 0px", threshold: 0.1 },
    );
    el.querySelectorAll("[data-rv]").forEach((n) => io.observe(n));

    // Voortgang binnen de vastgezette secties, als --p van 0 tot 1.
    const pins = Array.from(el.querySelectorAll<HTMLElement>("[data-pin]"));
    let ticking = false;
    const update = () => {
      ticking = false;
      const vh = window.innerHeight;
      for (const pin of pins) {
        const r = pin.getBoundingClientRect();
        const span = r.height - vh;
        const p = span > 40 ? Math.min(1, Math.max(0, -r.top / span)) : r.top < vh * 0.6 ? 1 : 0;
        pin.style.setProperty("--p", p.toFixed(4));
      }
      el.dataset.scrolled = window.scrollY > 80 ? "1" : "0";
    };
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(update);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    update();

    (async () => {
      try {
        if (!reduced && !coarse) {
          const Lenis = (await import("lenis")).default;
          if (dead) return;
          lenis = new Lenis({ autoRaf: true, lerp: 0.11, anchors: true });
        }
        const { Hang, Pile } = await import("./toys");
        await document.fonts.load(`${lookRef.current.tag.weight} 40px ${lookRef.current.tag.font}`).catch(() => {});
        if (dead) return;
        if (hangHost.current) hang.current = new Hang(hangHost.current, lookRef.current, reduced, coarse);
        if (pileHost.current) pile.current = new Pile(pileHost.current, lookRef.current, reduced, coarse);
      } catch {
        /* zonder de speelobjecten blijft de pagina volledig bruikbaar */
      }
    })();

    return () => {
      dead = true;
      io.disconnect();
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      lenis?.destroy();
      hang.current?.dispose();
      hang.current = null;
      pile.current?.dispose();
      pile.current = null;
    };
  }, []);

  const style = {
    "--bg": brand.bg,
    "--fg": brand.fg,
    "--accent": brand.accent,
    "--on-accent": readableOn(brand.accent),
    "--r": `${radius}px`,
    "--display": font.family,
    "--dw": font.weight,
    "--dt": font.tracking,
    "--dl": font.leading,
    "--ds": font.scale,
  } as CSSProperties;

  const cta = (label: string, variant = ""): ReactNode => (
    <Link className={`btn ${variant}`} href={EXAMPLE}>
      <span>{label}</span>
      <Arrow />
    </Link>
  );

  return (
    <div className="lp" ref={root} style={style} data-light={light ? "1" : undefined}>
      <header className="nav">
        <div className="nav-panel nav-main">
          <a className="logo" href="#top" aria-label={`${PRODUCT.naam}, naar boven`}>
            <Logo />
          </a>
          <nav aria-label="Hoofdmenu">
            <a href="#stappen">Zo werkt het</a>
            <a href="#prijs">Prijs</a>
            <a href="#vergelijk">Vergelijk</a>
            <a href="#vragen">Vragen</a>
          </nav>
        </div>
        <div className="nav-panel">
          <Link className="nav-link" href="/login">
            Inloggen
          </Link>
          <Link className="btn small" href={EXAMPLE}>
            Voorbeeldrapport
          </Link>
        </div>
      </header>

      <main>
        {/* 1. Hero: objecten hangen boven een gecentreerde kop */}
        <section className="hero" id="top">
          <div className="hang" ref={hangHost} aria-hidden="true" />
          <h1 className="disp" data-rv>
            <Words>De goedkoopste merkregistratie van Nederland.</Words>
          </h1>
          <p className="hero-sub" data-rv>
            Je merk veilig en snel vastgelegd, in drie stappen. <span className="pill">Minstens {euro(BESPARING)} goedkoper</span> dan een
            merkenbureau.
          </p>
          <ol className="hero-steps" data-rv aria-label="De drie stappen met hun prijs">
            {STEPS.map((step, i) => (
              <li key={step.short}>
                <span className="hero-n">{i + 1}</span>
                <span className="hero-what">{step.short}</span>
                <b className="disp">{step.price}</b>
              </li>
            ))}
          </ol>
          <div className="hero-cta" data-rv>
            {cta("Bekijk een voorbeeldrapport")}
            <p className="note">{PRICE_LINE}</p>
          </div>
        </section>

        {/* 2. Strook */}
        <section className="strip" id="registers" aria-label="Registers die we doorzoeken">
          <p>We zoeken in de registers waar het om gaat</p>
          <ul>
            {[...SOURCES, "een risico-indicatie, geen garantie"].map((n) => (
              <li key={n}>{n}</li>
            ))}
          </ul>
        </section>

        {/* 3. Waarom nu: drie feiten die de check de moeite waard maken */}
        <section className="s" id="waarom">
          <div className="head-row">
            <div>
              <p className="label" data-rv>
                Waarom nu
              </p>
              <h2 className="disp" data-rv>
                Een naam is pas van jou als hij is vastgelegd.
              </h2>
            </div>
          </div>
          <ul className="why">
            {WHY.map((w, i) => (
              <li key={w.title} className={i === 0 ? "deep" : "soft"} data-rv style={{ "--i": i } as CSSProperties}>
                <span className="why-art">
                  <KitIcon name={w.icon} color={brand.tints[(i + 2) % brand.tints.length]} />
                </span>
                <h3 className="disp">{w.title}</h3>
                <p>{w.text}</p>
              </li>
            ))}
          </ul>
        </section>

        {/* 4. Drie stappen, elk met zijn prijs */}
        <section className="s" id="stappen">
          <div className="head-row">
            <div>
              <p className="label" data-rv>
                Zo werkt het
              </p>
              <h2 className="disp" data-rv>
                Drie stappen. Meer is het niet.
              </h2>
            </div>
            <Link className="btn ghost" href={EXAMPLE} data-rv>
              <span>Bekijk een voorbeeldrapport</span>
              <Arrow />
            </Link>
          </div>
          <ol className="cards three">
            {STEPS.map((step, i) => (
              <li key={step.title} data-rv style={{ "--i": i } as CSSProperties}>
                <div className={`card-art ${i % 2 === 0 ? "deep" : "soft"}`}>
                  <span className="step-n disp">{i + 1}</span>
                  <KitIcon name={step.icon} color={brand.tints[i % brand.tints.length]} />
                </div>
                <h3>
                  {step.title} <span className="pill">{step.price}</span>
                </h3>
                <p>{step.text}</p>
              </li>
            ))}
          </ol>
        </section>

        {/* 5. Het rapport: een voorproef in plaats van een beschrijving */}
        <section className="s g12" id="rapport">
          <div className="col a">
            <p className="label" data-rv>
              Wat je krijgt
            </p>
            <h2 className="disp" data-rv>
              Geen los antwoord. Een onderzoeksdossier.
            </h2>
            <ul className="ticks" data-rv>
              <li>Zes weigeringsgronden van BOIP, getoetst in vier talen</li>
              <li>Tot 25 zoekvarianten: spelling, klank en vertaling</li>
              <li>Per botsend merk de gelijkenis in beeld, klank en betekenis</li>
              <li>Klassen, kosten en de volgende stap, zonder juridische taal</li>
            </ul>
            <Link className="btn ghost" href={EXAMPLE} data-rv>
              <span>Open het hele voorbeeldrapport</span>
              <Arrow />
            </Link>
          </div>
          <div className="col h">
            <Link className="peek deep" href={EXAMPLE} data-rv aria-label="Voorbeeldrapport voor de verzonnen naam Trapvonk">
              <div className="panel-bar">
                <span>Merkonderzoek Benelux · voorbeeld</span>
                <span>Trapvonk</span>
              </div>
              <div className="peek-body">
                <p className="peek-verdict disp">Kan, met aandachtspunten</p>
                <dl className="peek-keys">
                  <div>
                    <dt>Onderscheidend</dt>
                    <dd>Sterk</dd>
                  </div>
                  <div>
                    <dt>Varianten</dt>
                    <dd>12</dd>
                  </div>
                  <div>
                    <dt>Merken beoordeeld</dt>
                    <dd>6</dd>
                  </div>
                  <div>
                    <dt>Verhoogd risico</dt>
                    <dd>1</dd>
                  </div>
                </dl>
                <div className="peek-hit">
                  <p>
                    <b>TRAPVONCK</b> <span className="peek-risk">Risico middel</span>
                  </p>
                  {(
                    [
                      ["Beeld", 90],
                      ["Klank", 100],
                      ["Betekenis", 80],
                      ["Soortgelijke producten", 5],
                    ] as const
                  ).map(([label, v]) => (
                    <div className="peek-meter" key={label}>
                      <span>{label}</span>
                      <i style={{ "--v": v } as CSSProperties} />
                      <b>{v}</b>
                    </div>
                  ))}
                  <p className="peek-why">Klinkt hetzelfde, maar is ingeschreven voor danslessen. Dat is iets heel anders dan fietsen.</p>
                </div>
              </div>
            </Link>
          </div>
        </section>

        {/* 6. Prijs: vergelijking links, kaart met de optelsom rechts */}
        <section className="s g12" id="prijs">
          <div className="col a">
            <p className="label" data-rv>
              Prijs
            </p>
            <h2 className="disp" data-rv>
              Honderden euro’s goedkoper dan een merkenbureau.
            </h2>
            <div className="compare" data-rv role="group" aria-label="Prijsvergelijking voor een Benelux-merk in één klasse">
              <div className="compare-row us">
                <span className="compare-name">{PRODUCT.naam}</span>
                <span className="compare-bar" style={{ "--w": TOTAAL / VERGELIJKING.merkenbureaus.hoog } as CSSProperties} />
                <span className="compare-price disp">{euro(TOTAAL)}</span>
              </div>
              <div className="compare-row">
                <span className="compare-name">Merkenbureau</span>
                <span className="compare-bar" style={{ "--w": 1 } as CSSProperties} />
                <span className="compare-price disp">
                  {euro(VERGELIJKING.merkenbureaus.laag)}–{euro(VERGELIJKING.merkenbureaus.hoog)}
                </span>
              </div>
            </div>
            <p className="note" data-rv>
              Benelux-merk in één klasse, inclusief BOIP-tarief, exclusief btw. Merkenbureaus: vanafprijzen op de websites van drie Nederlandse
              bureaus, gepeild op {PEILDATUM}. Goedkoopste: onze eigen prijs is {euro(ONZE_PRIJS)} voor check, rapport en depotdossier; het
              BOIP-tarief betaal je rechtstreeks aan BOIP.
            </p>
          </div>
          <div className="col h">
            <div className="price-card" data-rv>
              <div>
                <p className="price disp">{euro(TOTAAL)}</p>
                <p className="per">alles bij elkaar, voor één klasse, excl. btw</p>
              </div>
              <ul>
                <li className="sum">
                  <span>Check</span>
                  <span>{euro(PRIJZEN.check)}</span>
                </li>
                <li className="sum">
                  <span>Rapport en depotdossier</span>
                  <span>{euro(PRIJZEN.depot)}</span>
                </li>
                <li className="sum">
                  <span>BOIP-tarief, één klasse</span>
                  <span>{euro(BOIP_TARIEVEN.depotMetEersteKlasse)}</span>
                </li>
                <li className="sum muted">
                  <span>Tweede klasse</span>
                  <span>+ {euro(BOIP_TARIEVEN.tweedeKlasse)}</span>
                </li>
                <li className="sum muted">
                  <span>Elke klasse daarna</span>
                  <span>+ {euro(BOIP_TARIEVEN.derdeKlasseEnVerder)}</span>
                </li>
              </ul>
              {cta("Bekijk een voorbeeldrapport")}
            </div>
          </div>
        </section>

        {/* 7. Eerlijke vergelijking: wij, een bureau en zelf doen */}
        <section className="s" id="vergelijk">
          <div className="head-row">
            <div>
              <p className="label" data-rv>
                Vergelijk
              </p>
              <h2 className="disp" data-rv>
                Meer dan zelf doen. Veel minder dan een bureau.
              </h2>
            </div>
          </div>
          <div className="vs-scroll" data-rv>
            <table className="vs">
              <thead>
                <tr>
                  <th scope="col">
                    <span className="sr">Onderdeel</span>
                  </th>
                  <th scope="col" className="us">
                    {PRODUCT.naam}
                  </th>
                  <th scope="col">Merkenbureau</th>
                  <th scope="col">Zelf bij BOIP</th>
                </tr>
              </thead>
              <tbody>
                {VS.map((row) => (
                  <tr key={row.label}>
                    <th scope="row">{row.label}</th>
                    <td className="us">{row.us}</td>
                    <td>{row.bureau}</td>
                    <td>{row.zelf}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="note flow-note" data-rv>
            Prijzen exclusief btw, inclusief BOIP-tarief. Merkenbureaus: vanafprijzen van drie Nederlandse bureaus, gepeild op {PEILDATUM}. Wat een
            bureau precies doet, verschilt per bureau.
          </p>
        </section>

        {/* 8. Het hele proces, met bij elke stap wat het kost */}
        <section className="s" id="proces">
          <div className="head-row">
            <div>
              <p className="label" data-rv>
                Het proces
              </p>
              <h2 className="disp" data-rv>
                Van naam tot ingeschreven merk.
              </h2>
            </div>
          </div>
          <ol className="flow">
            {FLOW.map((f, i) => (
              <li key={f.title} data-rv data-ours={f.ours ? "1" : undefined} style={{ "--i": i } as CSSProperties}>
                <span className="flow-when">{f.when}</span>
                <span className="flow-what">
                  <b>{f.title}</b>
                  <span>{f.text}</span>
                </span>
                <span className="flow-price">{f.price}</span>
              </li>
            ))}
          </ol>
          <p className="note flow-note" data-rv>
            Prijzen exclusief btw. BOIP betaalt het tarief niet terug als het je merk weigert. Daarom eerst de check.
          </p>
        </section>

        {/* 9. Veelgestelde vragen */}
        <section className="s g12" id="vragen">
          <div className="col a faq-head">
            <p className="label" data-rv>
              Vragen
            </p>
            <h2 className="disp" data-rv>
              Wat mensen willen weten voordat ze beginnen.
            </h2>
          </div>
          <div className="col h">
            <div className="faq" data-rv>
              {FAQ.map((f) => (
                <details key={f.q}>
                  <summary>{f.q}</summary>
                  <p>{f.a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* 13. Afsluiter */}
        <section className="s closer" id="start">
          <h2 className="disp" data-rv>
            Leg je naam vast voordat een ander het doet.
          </h2>
          <div className="hero-cta" data-rv>
            {cta("Bekijk een voorbeeldrapport")}
            <p className="note">{PRICE_LINE}</p>
          </div>
        </section>
      </main>

      {/* 14. Footer: kolommen, stapel en een reuzenwoord */}
      <footer className="foot soft">
        <div className="foot-cols">
          <div>
            <h3>Product</h3>
            <a href="#stappen">Zo werkt het</a>
            <a href="#prijs">Prijs</a>
            <a href="#proces">Het proces</a>
          </div>
          <div>
            <h3>Voorbeeld</h3>
            <Link href={EXAMPLE}>Voorbeeldrapport</Link>
          </div>
          <div>
            <h3>Account</h3>
            <Link href="/login">Inloggen</Link>
            <Link href="/dashboard">Mijn checks</Link>
          </div>
          <div>
            <h3>Gemaakt door</h3>
            <span>Anne Floor Mensink</span>
            <span>© 2026</span>
          </div>
        </div>
        <div className="foot-play">
          <div className="pile" ref={pileHost} aria-hidden="true" />
          <p className="foot-hint">
            <span className="fine">Pak iets op en gooi ermee.</span>
            <span className="coarse">Tik op een object.</span>
          </p>
          <Logo className="wordmark" />
        </div>
      </footer>

    </div>
  );
}
