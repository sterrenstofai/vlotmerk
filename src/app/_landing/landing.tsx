"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, type CSSProperties, type ReactNode } from "react";
import { BOIP_TARIEVEN, PRIJZEN, berekenKosten, euro } from "@/lib/config/tarieven";
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
const EEN_KLASSE = berekenKosten(1);
const PRICE_LINE = `Check gratis. Rapport ${euro(PRIJZEN.rapport)}. Depot ${euro(PRIJZEN.depot)} + BOIP-tarief.`;
const PEILDATUM = new Date(VERGELIJKING.peildatum).toLocaleDateString("nl-NL", { day: "numeric", month: "long", year: "numeric" });

const SOURCES = ["Benelux (BOIP)", "EU (EUIPO)", "Domeinnamen", "KvK"];

const STEPS: { title: string; price: string; text: string; icon: SpriteKey }[] = [
  {
    title: "Check je naam",
    price: "Gratis",
    text: "Vul je naam in en vertel wat je doet. Je ziet direct of de naam sterk genoeg is en of er een bijna gelijk merk bestaat.",
    icon: "loupe",
  },
  {
    title: "Lees je rapport",
    price: euro(PRIJZEN.rapport),
    text: "Alle merken die op jouw naam lijken, met het risico erbij. Plus de klassen die bij je passen en wat het kost.",
    icon: "page",
  },
  {
    title: "Leg je merk vast",
    price: `${euro(PRIJZEN.depot)} + ${euro(BOIP_TARIEVEN.depotMetEersteKlasse)} BOIP`,
    text: "Je krijgt een dossier dat zo in het formulier van BOIP past. Kopiëren, plakken, indienen. Het rapport zit erbij.",
    icon: "stamp",
  },
];

const FLOW: { when: string; title: string; text: string; price: string; ours: boolean }[] = [
  { when: "Stap 1", title: "Check", text: "Onderscheidend vermogen, bijna gelijke merken en je domeinnaam.", price: "Gratis", ours: true },
  { when: "Stap 2", title: "Rapport", text: "Volledige conflictscan, klassenadvies en kostenberekening, ook als PDF.", price: euro(PRIJZEN.rapport), ours: true },
  { when: "Stap 3", title: "Depotdossier", text: "Alle velden van het BOIP-formulier ingevuld, met stappenplan. Het rapport zit erbij.", price: euro(PRIJZEN.depot), ours: true },
  { when: "Indienen", title: "BOIP-tarief", text: "Je dient zelf in via MyBOIP en betaalt BOIP rechtstreeks. Eén klasse zit in het tarief.", price: euro(BOIP_TARIEVEN.depotMetEersteKlasse), ours: false },
  { when: "Daarna", title: "Toetsing en publicatie", text: "BOIP toetst je merk en publiceert het. Anderen hebben twee maanden om bezwaar te maken.", price: "Inbegrepen", ours: false },
  { when: "Klaar", title: "Inschrijving", text: "Je merk is ingeschreven en tien jaar van jou.", price: "Inbegrepen", ours: false },
  { when: "Optie", title: "Bewaking", text: "Elke week kijken we of iemand een merk aanvraagt dat op het jouwe lijkt. Je hoort het op tijd.", price: `${euro(PRIJZEN.bewakingPerMaand)} per maand`, ours: true },
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
            <a href="#proces">Het proces</a>
            <Link href={EXAMPLE}>Voorbeeld</Link>
          </nav>
        </div>
        <div className="nav-panel">
          <Link className="nav-link" href="/login">
            Inloggen
          </Link>
          <Link className="btn small" href={EXAMPLE}>
            Check je naam
          </Link>
        </div>
      </header>

      <main>
        {/* 1. Hero: objecten hangen boven een gecentreerde kop */}
        <section className="hero" id="top">
          <div className="hang" ref={hangHost} aria-hidden="true" />
          <h1 className="disp" data-rv>
            <Words>Je merk vastgelegd in 1, 2, 3.</Words>
          </h1>
          <p className="hero-sub" data-rv>
            Check je naam, lees je rapport en leg je merk vast. Zonder bureau en zonder uurtarief.
          </p>
          <div className="hero-cta" data-rv>
            {cta("Bekijk een voorbeeldcheck")}
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

        {/* 3. Drie stappen, elk met zijn prijs */}
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
              <span>Bekijk een voorbeeld</span>
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

        {/* 4. Prijs: vergelijking links, kaart met de optelsom rechts */}
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
                <span className="compare-bar" style={{ "--w": EEN_KLASSE.totaal / VERGELIJKING.merkenbureaus.hoog } as CSSProperties} />
                <span className="compare-price disp">{euro(EEN_KLASSE.totaal)}</span>
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
              bureaus, gepeild op {PEILDATUM}. Zelf indienen bij BOIP zonder check kost {euro(BOIP_TARIEVEN.depotMetEersteKlasse)}.
            </p>
          </div>
          <div className="col h">
            <div className="price-card" data-rv>
              <div>
                <p className="price disp">{euro(EEN_KLASSE.totaal)}</p>
                <p className="per">alles bij elkaar, voor één klasse, excl. btw</p>
              </div>
              <ul>
                <li className="sum">
                  <span>Check</span>
                  <span>Gratis</span>
                </li>
                <li className="sum">
                  <span>Depotdossier, rapport inbegrepen</span>
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
              {cta("Bekijk een voorbeeldcheck")}
            </div>
          </div>
        </section>

        {/* 5. Het hele proces, met bij elke stap wat het kost */}
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

        {/* 13. Afsluiter */}
        <section className="s closer" id="start">
          <h2 className="disp" data-rv>
            Eerst checken. Dan vastleggen.
          </h2>
          <div className="hero-cta" data-rv>
            {cta("Bekijk een voorbeeldcheck")}
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
            <Link href={EXAMPLE}>Voorbeeldcheck</Link>
          </div>
          <div>
            <h3>Account</h3>
            <Link href="/login">Inloggen</Link>
            <Link href="/dashboard">Mijn checks</Link>
          </div>
          <div>
            <h3>Gemaakt door</h3>
            <span>Sterrenstof</span>
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
