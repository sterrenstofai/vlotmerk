"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, type CSSProperties, type ReactNode } from "react";
import { BRANDS, luminance, readableOn } from "./brands";
import { FONTS } from "./fonts";
import { PRODUCT } from "@/lib/config/product";
import { Logo } from "./logo";
import type { Hang, Pile, ToyLook } from "./toys";
import "lenis/dist/lenis.css";
import "./landing.css";

const EXAMPLE = "/check/voorbeeld";
const PRICE_LINE = "De check is gratis. Depot €79 + BOIP-tarief.";

const SOURCES = ["Benelux (BOIP)", "EU (EUIPO)", "Domeinnamen", "KvK"];

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
            <a href="#registers">Wat we checken</a>
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
            <Words>Is je merknaam sterk genoeg?</Words>
          </h1>
          <p className="hero-sub" data-rv>
            Vul je naam in en zie binnen twee minuten of hij botst met bestaande merken.
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

        {/* 13. Afsluiter */}
        <section className="s closer" id="start">
          <h2 className="disp" data-rv>
            Check je naam voordat je hem vastlegt.
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
            <a href="#registers">Wat we checken</a>
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
