import { z } from "zod";
import { hitSchema } from "@/lib/schema/pipeline";
import { createAdminClient } from "@/lib/supabase/admin";
import type { ZoekCache } from "./zoek";

/** Zoekresultaten in de tabel source_cache. Alleen voor de server. */
export function databaseCache(): ZoekCache {
  const db = createAdminClient();
  return {
    async lees(bron, sleutel) {
      const { data } = await db.from("source_cache").select("resultaat, opgehaald").eq("bron", bron).eq("zoekterm", sleutel).maybeSingle();
      const hits = z.array(hitSchema).safeParse(data?.resultaat);
      return data && hits.success ? { hits: hits.data, opgehaald: new Date(data.opgehaald) } : null;
    },
    async schrijf(bron, sleutel, hits) {
      const { error } = await db
        .from("source_cache")
        .upsert({ bron, zoekterm: sleutel, resultaat: hits, opgehaald: new Date().toISOString() }, { onConflict: "bron,zoekterm" });
      if (error) console.error(`cache ${bron} niet bijgewerkt`, error.message);
    },
  };
}
