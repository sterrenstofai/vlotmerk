import { PRODUCT } from "@/lib/config/product";

/**
 * Voorlopig woordmerk: de productnaam in de koptekst-letter. Een eigen logo is er nog niet.
 * De kleur volgt de tekstkleur van de omgeving.
 */
export function Logo({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 300 72" fill="currentColor" aria-hidden="true">
      <text x="0" y="56" fontSize="64" fontWeight="600" letterSpacing="-2" textLength="300" lengthAdjust="spacingAndGlyphs">
        {PRODUCT.naam}
      </text>
    </svg>
  );
}
