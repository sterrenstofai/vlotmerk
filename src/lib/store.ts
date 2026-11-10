import { berekenKosten } from "@/lib/config/tarieven";
import { checkSchema, type Check } from "@/lib/schema/records";
import trapvonk from "@/lib/seed/trapvonk.json";
import { createClient } from "@/lib/supabase/server";

/**
 * Voorbeeldchecks die zonder database beschikbaar zijn.
 * De naam en alle treffers zijn verzonnen; er staat geen bestaand merk in.
 */
const DEMOS: Record<string, unknown> = { voorbeeld: trapvonk };

export const isDemo = (id: string) => id in DEMOS;

export type CheckRow = { id: string; naam: string; status: string; updated_at: string };

export async function getUser() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  return data.user;
}

/** De checks van de ingelogde gebruiker. RLS laat alleen eigen rijen zien. */
export async function listChecks(): Promise<CheckRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("checks")
    .select("id, naam, status, updated_at")
    .order("updated_at", { ascending: false });
  return data ?? [];
}

/** Een voorbeeldcheck uit de code. Gooit een fout als de seed niet meer bij het schema of de tarieven past. */
export function loadDemoCheck(id: string): Check | null {
  if (!isDemo(id)) return null;
  const check = checkSchema.parse(DEMOS[id]);
  if (check.rapport) {
    const { kosten } = check.rapport.eindoordeel;
    const verwacht = berekenKosten(check.rapport.klassen.klassen.length);
    if (kosten.boip !== verwacht.boip || kosten.totaal !== verwacht.totaal) {
      throw new Error(`Voorbeeldcheck ${id}: de kosten kloppen niet meer met het tarievenbestand.`);
    }
  }
  return check;
}
